import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from '../db/migrations/001_pilot_core.js';
import { up as addOrganizationFoundation } from '../db/migrations/006_organization_foundation.js';
import { up as addOrganizationMembership } from '../db/migrations/008_organization_membership.js';
import { up as addProjectAssignment } from '../db/migrations/009_project_assignment.js';
import {
  parseProjectAssignmentManifest,
  projectAssignmentManifestDigest,
  runProjectAssignmentBackfill,
  type ProjectAssignmentManifest,
} from './projectAssignmentBackfill.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const tenantAId = '10000000-0000-4000-8000-000000000001';
const tenantBId = '20000000-0000-4000-8000-000000000001';
const tenantAAdminUserId = '10000000-0000-4000-8000-000000000002';
const tenantAOperatorUserId = '10000000-0000-4000-8000-000000000003';
const tenantASuspendedOperatorUserId = '10000000-0000-4000-8000-000000000004';
const tenantBOperatorUserId = '20000000-0000-4000-8000-000000000002';

const tenantAAdminMembershipId = '11000000-0000-4000-8000-000000000001';
const tenantAOperatorMembershipId = '11000000-0000-4000-8000-000000000002';
const tenantASuspendedOperatorMembershipId = '11000000-0000-4000-8000-000000000003';
const tenantBOperatorMembershipId = '21000000-0000-4000-8000-000000000001';

const projectAOneId = '12000000-0000-4000-8000-000000000001';
const projectATwoId = '12000000-0000-4000-8000-000000000002';
const projectBId = '22000000-0000-4000-8000-000000000001';
const unknownMembershipId = '99000000-0000-4000-8000-000000000001';
const unknownProjectId = '99000000-0000-4000-8000-000000000002';

function manifest(overrides: Partial<ProjectAssignmentManifest> = {}): ProjectAssignmentManifest {
  return {
    manifestVersion: 1,
    manifestId: 'pilot-tenant-a-001',
    tenantId: tenantAId,
    approvedByUserId: tenantAAdminUserId,
    assignments: [
      {
        membershipId: tenantAOperatorMembershipId,
        projectId: projectAOneId,
        accessLevel: 'viewer',
      },
      {
        membershipId: tenantAOperatorMembershipId,
        projectId: projectATwoId,
        accessLevel: 'editor',
      },
    ],
    ...overrides,
  };
}

async function resetDataset(database: Knex) {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);
  await database('control_plane.tenants').insert([
    { tenant_id: tenantAId, display_name: 'Tenant A', status: 'active' },
    { tenant_id: tenantBId, display_name: 'Tenant B', status: 'active' },
  ]);
  await database('control_plane.users').insert([
    {
      user_id: tenantAAdminUserId,
      email: 'tenant-a-admin@example.com',
      display_name: 'Tenant A Admin',
      password_hash: 'unused-admin-password',
      status: 'active',
    },
    {
      user_id: tenantAOperatorUserId,
      email: 'tenant-a-operator@example.com',
      display_name: 'Tenant A Operator',
      password_hash: 'unused-operator-password',
      status: 'active',
    },
    {
      user_id: tenantASuspendedOperatorUserId,
      email: 'tenant-a-suspended@example.com',
      display_name: 'Tenant A Suspended Operator',
      password_hash: 'unused-suspended-password',
      status: 'active',
    },
    {
      user_id: tenantBOperatorUserId,
      email: 'tenant-b-operator@example.com',
      display_name: 'Tenant B Operator',
      password_hash: 'unused-tenant-b-password',
      status: 'active',
    },
  ]);
  await database('control_plane.memberships').insert([
    {
      membership_id: tenantAAdminMembershipId,
      tenant_id: tenantAId,
      user_id: tenantAAdminUserId,
      role_code: 'tenant_admin',
      status: 'active',
    },
    {
      membership_id: tenantAOperatorMembershipId,
      tenant_id: tenantAId,
      user_id: tenantAOperatorUserId,
      role_code: 'content_operator',
      status: 'active',
    },
    {
      membership_id: tenantASuspendedOperatorMembershipId,
      tenant_id: tenantAId,
      user_id: tenantASuspendedOperatorUserId,
      role_code: 'content_operator',
      status: 'suspended',
    },
    {
      membership_id: tenantBOperatorMembershipId,
      tenant_id: tenantBId,
      user_id: tenantBOperatorUserId,
      role_code: 'content_operator',
      status: 'active',
    },
  ]);

  await addOrganizationFoundation(database);
  await addOrganizationMembership(database);
  await database('control_plane.projects').insert([
    {
      project_id: projectAOneId,
      tenant_id: tenantAId,
      name: 'Tenant A Project One',
      status: 'active',
      platform: 'douyin',
      aspect_ratio: '9:16',
      target_duration_seconds: 30,
      created_by: tenantAAdminUserId,
    },
    {
      project_id: projectATwoId,
      tenant_id: tenantAId,
      name: 'Tenant A Project Two',
      status: 'draft',
      platform: 'douyin',
      aspect_ratio: '9:16',
      target_duration_seconds: 45,
      created_by: tenantAAdminUserId,
    },
    {
      project_id: projectBId,
      tenant_id: tenantBId,
      name: 'Tenant B Project',
      status: 'active',
      platform: 'douyin',
      aspect_ratio: '9:16',
      target_duration_seconds: 60,
      created_by: tenantBOperatorUserId,
    },
  ]);
  await addProjectAssignment(database);
}

async function rowCounts(database: Knex) {
  const runCount = await database('control_plane.project_assignment_backfill_runs').count<{
    count: string;
  }>('* as count');
  const assignmentCount = await database('control_plane.project_assignments').count<{
    count: string;
  }>('* as count');
  return {
    runs: Number(runCount[0]?.count ?? 0),
    assignments: Number(assignmentCount[0]?.count ?? 0),
  };
}

async function expectBackfillError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe.skipIf(!hasDedicatedTestDatabase)('project assignment backfill runner PostgreSQL', () => {
  let database: Knex;

  beforeEach(async () => {
    database ??= knex({
      client: 'pg',
      connection: databaseUrl,
      pool: { min: 0, max: 6 },
    });
    await resetDataset(database);
  });

  afterAll(async () => {
    await database?.raw('drop schema if exists control_plane cascade');
    await database?.destroy();
  });

  it('atomically records one immutable run and all explicitly approved assignments', async () => {
    const result = await runProjectAssignmentBackfill(database, manifest());

    expect(result).toEqual({
      manifestId: 'pilot-tenant-a-001',
      manifestDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      assignmentCount: 2,
      replay: false,
    });
    expect(await database('control_plane.project_assignment_backfill_runs').select()).toEqual([
      expect.objectContaining({
        manifest_id: result.manifestId,
        manifest_digest: result.manifestDigest,
        manifest_version: 1,
        assignment_count: 2,
        tenant_id: tenantAId,
        organization_id: tenantAId,
        approved_by: tenantAAdminUserId,
      }),
    ]);
    expect(
      await database('control_plane.project_assignments')
        .select(
          'project_id',
          'membership_id',
          'tenant_id',
          'organization_id',
          'access_level',
          'status',
          'assignment_source',
          'created_by',
        )
        .orderBy('project_id'),
    ).toEqual([
      {
        project_id: projectAOneId,
        membership_id: tenantAOperatorMembershipId,
        tenant_id: tenantAId,
        organization_id: tenantAId,
        access_level: 'viewer',
        status: 'active',
        assignment_source: 'pilot_backfill',
        created_by: tenantAAdminUserId,
      },
      {
        project_id: projectATwoId,
        membership_id: tenantAOperatorMembershipId,
        tenant_id: tenantAId,
        organization_id: tenantAId,
        access_level: 'editor',
        status: 'active',
        assignment_source: 'pilot_backfill',
        created_by: tenantAAdminUserId,
      },
    ]);
  });

  it('canonicalizes assignment order and replays without duplicate rows', async () => {
    const original = manifest();
    const reordered = manifest({ assignments: [...original.assignments].reverse() });

    expect(projectAssignmentManifestDigest(parseProjectAssignmentManifest(original))).toBe(
      projectAssignmentManifestDigest(parseProjectAssignmentManifest(reordered)),
    );

    const first = await runProjectAssignmentBackfill(database, original);
    const replay = await runProjectAssignmentBackfill(database, reordered);

    expect(first.replay).toBe(false);
    expect(replay).toEqual({ ...first, replay: true });
    expect(await rowCounts(database)).toEqual({ runs: 1, assignments: 2 });
  });

  it('rejects manifest identity conflicts, digest reuse, unknown fields and duplicate pairs', async () => {
    const original = manifest();
    await runProjectAssignmentBackfill(database, original);

    await expectBackfillError(
      runProjectAssignmentBackfill(
        database,
        manifest({
          assignments: [
            {
              membershipId: tenantAOperatorMembershipId,
              projectId: projectAOneId,
              accessLevel: 'editor',
            },
          ],
        }),
      ),
      'MANIFEST_ID_CONFLICT',
    );
    await expectBackfillError(
      runProjectAssignmentBackfill(database, manifest({ manifestId: 'pilot-tenant-a-002' })),
      'MANIFEST_DIGEST_CONFLICT',
    );
    await expectBackfillError(
      runProjectAssignmentBackfill(database, { ...manifest(), unexpected: 'reject-me' }),
      'MANIFEST_INVALID',
    );
    await expectBackfillError(
      runProjectAssignmentBackfill(
        database,
        manifest({
          manifestId: 'pilot-tenant-a-003',
          assignments: [
            {
              membershipId: tenantAOperatorMembershipId,
              projectId: projectAOneId,
              accessLevel: 'viewer',
            },
            {
              membershipId: tenantAOperatorMembershipId,
              projectId: projectAOneId,
              accessLevel: 'editor',
            },
          ],
        }),
      ),
      'MANIFEST_INVALID',
    );
    expect(await rowCounts(database)).toEqual({ runs: 1, assignments: 2 });
  });

  it('rejects a wrong-role or inactive approver and leaves no partial evidence', async () => {
    await expectBackfillError(
      runProjectAssignmentBackfill(database, manifest({ approvedByUserId: tenantAOperatorUserId })),
      'APPROVER_UNAUTHORIZED',
    );

    await database('control_plane.organization_memberships')
      .where({ membership_id: tenantAAdminMembershipId })
      .update({ status: 'suspended' });
    await expectBackfillError(
      runProjectAssignmentBackfill(database, manifest({ manifestId: 'pilot-inactive-admin' })),
      'APPROVER_UNAUTHORIZED',
    );
    expect(await rowCounts(database)).toEqual({ runs: 0, assignments: 0 });
  });

  it('rejects invalid Membership and Project scopes with zero partial writes', async () => {
    const invalidInputs: Array<{ input: ProjectAssignmentManifest; code: string }> = [
      {
        input: manifest({
          manifestId: 'cross-tenant-membership',
          assignments: [
            {
              membershipId: tenantBOperatorMembershipId,
              projectId: projectAOneId,
              accessLevel: 'viewer',
            },
          ],
        }),
        code: 'ASSIGNMENT_TARGET_INVALID',
      },
      {
        input: manifest({
          manifestId: 'inactive-membership',
          assignments: [
            {
              membershipId: tenantASuspendedOperatorMembershipId,
              projectId: projectAOneId,
              accessLevel: 'viewer',
            },
          ],
        }),
        code: 'ASSIGNMENT_TARGET_INVALID',
      },
      {
        input: manifest({
          manifestId: 'wrong-role-membership',
          assignments: [
            {
              membershipId: tenantAAdminMembershipId,
              projectId: projectAOneId,
              accessLevel: 'viewer',
            },
          ],
        }),
        code: 'ASSIGNMENT_TARGET_INVALID',
      },
      {
        input: manifest({
          manifestId: 'unknown-membership',
          assignments: [
            {
              membershipId: unknownMembershipId,
              projectId: projectAOneId,
              accessLevel: 'viewer',
            },
          ],
        }),
        code: 'ASSIGNMENT_TARGET_INVALID',
      },
      {
        input: manifest({
          manifestId: 'cross-tenant-project',
          assignments: [
            {
              membershipId: tenantAOperatorMembershipId,
              projectId: projectBId,
              accessLevel: 'viewer',
            },
          ],
        }),
        code: 'PROJECT_INVALID',
      },
      {
        input: manifest({
          manifestId: 'unknown-project',
          assignments: [
            {
              membershipId: tenantAOperatorMembershipId,
              projectId: unknownProjectId,
              accessLevel: 'viewer',
            },
          ],
        }),
        code: 'PROJECT_INVALID',
      },
    ];

    for (const invalid of invalidInputs) {
      await expectBackfillError(
        runProjectAssignmentBackfill(database, invalid.input),
        invalid.code,
      );
      expect(await rowCounts(database)).toEqual({ runs: 0, assignments: 0 });
    }
  });

  it('fails closed for an inactive Tenant and malformed input', async () => {
    await database('control_plane.tenants').where({ tenant_id: tenantAId }).update({
      status: 'suspended',
    });
    await expectBackfillError(runProjectAssignmentBackfill(database, manifest()), 'TENANT_INVALID');
    await expectBackfillError(
      runProjectAssignmentBackfill(database, undefined),
      'MANIFEST_INVALID',
    );
    await expectBackfillError(
      runProjectAssignmentBackfill(database, {
        manifestVersion: 1,
        manifestId: 'empty-assignments',
        tenantId: tenantAId,
        approvedByUserId: tenantAAdminUserId,
        assignments: [],
      }),
      'MANIFEST_INVALID',
    );
    expect(await rowCounts(database)).toEqual({ runs: 0, assignments: 0 });
  });

  it('emits only fixed safe log fields and never leaks rejected sensitive input', async () => {
    const logs: unknown[] = [];
    const safeResult = await runProjectAssignmentBackfill(database, manifest(), {
      logger: (entry) => logs.push(entry),
    });
    expect(logs).toEqual([
      {
        event: 'project_assignment_backfill_completed',
        ...safeResult,
      },
    ]);

    const secretEmail = 'private-customer@example.com';
    const secretToken = 'token-super-secret-value';
    const secretPassword = 'password-super-secret-value';
    const secretContent = 'confidential-content-body';
    let rejected: unknown;
    try {
      await runProjectAssignmentBackfill(database, {
        ...manifest({ manifestId: 'sensitive-invalid-input' }),
        email: secretEmail,
        token: secretToken,
        password: secretPassword,
        content: secretContent,
      });
    } catch (error) {
      rejected = error;
    }

    expect(rejected).toMatchObject({ code: 'MANIFEST_INVALID' });
    const serialized = JSON.stringify({ logs, rejected });
    expect(serialized).not.toContain(secretEmail);
    expect(serialized).not.toContain(secretToken);
    expect(serialized).not.toContain(secretPassword);
    expect(serialized).not.toContain(secretContent);
  });

  it('serializes concurrent replay attempts without duplicate assignments', async () => {
    const results = await Promise.all([
      runProjectAssignmentBackfill(database, manifest()),
      runProjectAssignmentBackfill(database, manifest()),
    ]);

    expect(results.map((result) => result.replay).sort()).toEqual([false, true]);
    expect(new Set(results.map((result) => result.manifestDigest)).size).toBe(1);
    expect(await rowCounts(database)).toEqual({ runs: 1, assignments: 2 });
  });
});
