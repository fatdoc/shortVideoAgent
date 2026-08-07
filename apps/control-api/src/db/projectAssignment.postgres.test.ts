import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from './migrations/001_pilot_core.js';
import { up as addOrganizationFoundation } from './migrations/006_organization_foundation.js';
import { up as addOrganizationMembership } from './migrations/008_organization_membership.js';
import {
  down as removeProjectAssignment,
  up as addProjectAssignment,
} from './migrations/009_project_assignment.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const tenantAId = '10000000-0000-4000-8000-000000000001';
const tenantBId = '20000000-0000-4000-8000-000000000001';
const tenantAAdminUserId = '10000000-0000-4000-8000-000000000002';
const tenantAOperatorUserId = '10000000-0000-4000-8000-000000000003';
const tenantASuspendedUserId = '10000000-0000-4000-8000-000000000004';
const tenantBOperatorUserId = '20000000-0000-4000-8000-000000000002';
const platformUserId = '30000000-0000-4000-8000-000000000001';
const channelUserId = '40000000-0000-4000-8000-000000000001';

const tenantAAdminMembershipId = '11000000-0000-4000-8000-000000000001';
const tenantAOperatorMembershipId = '11000000-0000-4000-8000-000000000002';
const tenantASuspendedMembershipId = '11000000-0000-4000-8000-000000000003';
const tenantBOperatorMembershipId = '21000000-0000-4000-8000-000000000001';
const platformMembershipId = '31000000-0000-4000-8000-000000000001';
const channelMembershipId = '41000000-0000-4000-8000-000000000001';

const platformOrganizationId = '30000000-0000-4000-8000-000000000010';
const channelOrganizationId = '40000000-0000-4000-8000-000000000010';
const projectAOneId = '12000000-0000-4000-8000-000000000001';
const projectATwoId = '12000000-0000-4000-8000-000000000002';
const projectBId = '22000000-0000-4000-8000-000000000001';
const assignmentOneId = '13000000-0000-4000-8000-000000000001';
const assignmentTwoId = '13000000-0000-4000-8000-000000000002';
const backfillRunId = '14000000-0000-4000-8000-000000000001';
const validManifestDigest = `sha256:${'a'.repeat(64)}`;

async function insertOrganizationMembership(
  database: Knex,
  input: {
    membershipId: string;
    userId: string;
    organizationId: string;
    primaryRoleCode: string;
    roles?: string[];
    status?: 'active' | 'suspended' | 'expired';
  },
) {
  await database.transaction(async (transaction) => {
    await transaction('control_plane.organization_memberships').insert({
      membership_id: input.membershipId,
      user_id: input.userId,
      organization_id: input.organizationId,
      status: input.status ?? 'active',
      primary_role_code: input.primaryRoleCode,
    });
    await transaction('control_plane.organization_membership_roles').insert(
      (input.roles ?? [input.primaryRoleCode]).map((roleCode) => ({
        membership_id: input.membershipId,
        role_code: roleCode,
      })),
    );
  });
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
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: tenantAOperatorUserId,
      email: 'tenant-a-operator@example.com',
      display_name: 'Tenant A Operator',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: tenantASuspendedUserId,
      email: 'tenant-a-suspended@example.com',
      display_name: 'Tenant A Suspended Operator',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: tenantBOperatorUserId,
      email: 'tenant-b-operator@example.com',
      display_name: 'Tenant B Operator',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: platformUserId,
      email: 'platform-admin@example.com',
      display_name: 'Platform Admin',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: channelUserId,
      email: 'channel-admin@example.com',
      display_name: 'Channel Admin',
      password_hash: 'unused',
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
      membership_id: tenantASuspendedMembershipId,
      tenant_id: tenantAId,
      user_id: tenantASuspendedUserId,
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

  await database('control_plane.organizations').insert([
    {
      organization_id: platformOrganizationId,
      organization_type: 'PLATFORM',
      display_name: 'Platform Organization',
      status: 'active',
    },
    {
      organization_id: channelOrganizationId,
      organization_type: 'CHANNEL',
      display_name: 'Channel Organization',
      status: 'active',
      parent_organization_id: platformOrganizationId,
    },
  ]);
  await insertOrganizationMembership(database, {
    membershipId: platformMembershipId,
    userId: platformUserId,
    organizationId: platformOrganizationId,
    primaryRoleCode: 'platform_admin',
  });
  await insertOrganizationMembership(database, {
    membershipId: channelMembershipId,
    userId: channelUserId,
    organizationId: channelOrganizationId,
    primaryRoleCode: 'channel_admin',
  });

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
}

async function tableRegistration(database: Knex, tableName: string) {
  const result = await database.raw<{ rows: Array<{ table_name: string | null }> }>(
    'select to_regclass(?)::text as table_name',
    [`control_plane.${tableName}`],
  );
  return result.rows[0]?.table_name ?? null;
}

async function expectProjectAssignmentFoundationPresent(database: Knex) {
  expect(await tableRegistration(database, 'project_assignment_backfill_runs')).toBe(
    'control_plane.project_assignment_backfill_runs',
  );
  expect(await tableRegistration(database, 'project_assignments')).toBe(
    'control_plane.project_assignments',
  );
}

function assignmentRow(
  overrides: Partial<Record<string, string | Date | null>> = {},
): Record<string, string | Date | null> {
  return {
    project_assignment_id: assignmentOneId,
    project_id: projectAOneId,
    membership_id: tenantAOperatorMembershipId,
    tenant_id: tenantAId,
    organization_id: tenantAId,
    access_level: 'viewer',
    status: 'active',
    assignment_source: 'manual',
    backfill_run_id: null,
    created_by: tenantAAdminUserId,
    ...overrides,
  };
}

async function insertBackfillRun(database: Knex) {
  await database('control_plane.project_assignment_backfill_runs').insert({
    backfill_run_id: backfillRunId,
    manifest_id: 'pilot-manifest-001',
    manifest_digest: validManifestDigest,
    manifest_version: 1,
    assignment_count: 1,
    tenant_id: tenantAId,
    organization_id: tenantAId,
    approved_by: tenantAAdminUserId,
  });
}

describe.runIf(hasDedicatedTestDatabase)('A-BIZ-01.1 project assignment migration', () => {
  let database: Knex;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await resetDataset(database);
  });

  afterAll(async () => {
    await database?.raw('drop schema if exists control_plane cascade');
    await database?.destroy();
  });

  it('allows viewer and editor assignments only for an active same-Tenant content operator', async () => {
    await addProjectAssignment(database);
    await expectProjectAssignmentFoundationPresent(database);

    await database('control_plane.project_assignments').insert([
      assignmentRow(),
      assignmentRow({
        project_assignment_id: assignmentTwoId,
        project_id: projectATwoId,
        access_level: 'editor',
      }),
    ]);

    expect(
      await database('control_plane.project_assignments')
        .select(
          'project_assignment_id',
          'project_id',
          'membership_id',
          'tenant_id',
          'organization_id',
          'access_level',
          'status',
          'assignment_source',
          'backfill_run_id',
          'created_by',
        )
        .orderBy('project_assignment_id'),
    ).toEqual([
      assignmentRow(),
      assignmentRow({
        project_assignment_id: assignmentTwoId,
        project_id: projectATwoId,
        access_level: 'editor',
      }),
    ]);
  });

  it('rejects cross-Tenant, non-Tenant, non-content-operator and inactive Membership assignments', async () => {
    await addProjectAssignment(database);
    await expectProjectAssignmentFoundationPresent(database);

    await expect(
      database('control_plane.project_assignments').insert(
        assignmentRow({ project_id: projectBId }),
      ),
    ).rejects.toThrow();
    await expect(
      database('control_plane.project_assignments').insert(
        assignmentRow({ membership_id: tenantBOperatorMembershipId }),
      ),
    ).rejects.toThrow();
    await expect(
      database('control_plane.project_assignments').insert(
        assignmentRow({
          membership_id: platformMembershipId,
          organization_id: platformOrganizationId,
        }),
      ),
    ).rejects.toThrow();
    await expect(
      database('control_plane.project_assignments').insert(
        assignmentRow({
          membership_id: channelMembershipId,
          organization_id: channelOrganizationId,
        }),
      ),
    ).rejects.toThrow();
    await expect(
      database('control_plane.project_assignments').insert(
        assignmentRow({ membership_id: tenantAAdminMembershipId }),
      ),
    ).rejects.toThrow(/content_operator|membership/i);
    await expect(
      database('control_plane.project_assignments').insert(
        assignmentRow({ membership_id: tenantASuspendedMembershipId }),
      ),
    ).rejects.toThrow(/active|membership/i);
  });

  it('rejects duplicate scope and unknown access level, status or source values', async () => {
    await addProjectAssignment(database);
    await expectProjectAssignmentFoundationPresent(database);
    await database('control_plane.project_assignments').insert(assignmentRow());

    await expect(
      database('control_plane.project_assignments').insert(
        assignmentRow({ project_assignment_id: assignmentTwoId }),
      ),
    ).rejects.toThrow();
    await expect(
      database('control_plane.project_assignments').insert(
        assignmentRow({
          project_assignment_id: '13000000-0000-4000-8000-000000000003',
          project_id: projectATwoId,
          access_level: 'owner',
        }),
      ),
    ).rejects.toThrow();
    await expect(
      database('control_plane.project_assignments').insert(
        assignmentRow({
          project_assignment_id: '13000000-0000-4000-8000-000000000004',
          project_id: projectATwoId,
          status: 'deleted',
        }),
      ),
    ).rejects.toThrow();
    await expect(
      database('control_plane.project_assignments').insert(
        assignmentRow({
          project_assignment_id: '13000000-0000-4000-8000-000000000005',
          project_id: projectATwoId,
          assignment_source: 'implicit',
        }),
      ),
    ).rejects.toThrow();
  });

  it('enforces manual and pilot_backfill source consistency with immutable backfill evidence', async () => {
    await addProjectAssignment(database);
    await expectProjectAssignmentFoundationPresent(database);
    await insertBackfillRun(database);

    await expect(
      database('control_plane.project_assignments').insert(
        assignmentRow({ backfill_run_id: backfillRunId }),
      ),
    ).rejects.toThrow();
    await expect(
      database('control_plane.project_assignments').insert(
        assignmentRow({ assignment_source: 'pilot_backfill' }),
      ),
    ).rejects.toThrow();

    await database('control_plane.project_assignments').insert(
      assignmentRow({ assignment_source: 'pilot_backfill', backfill_run_id: backfillRunId }),
    );

    await expect(
      database('control_plane.project_assignment_backfill_runs')
        .where({ backfill_run_id: backfillRunId })
        .update({ assignment_count: 2 }),
    ).rejects.toThrow(/immutable|backfill/i);
    await expect(
      database('control_plane.project_assignment_backfill_runs')
        .where({ backfill_run_id: backfillRunId })
        .delete(),
    ).rejects.toThrow(/immutable|backfill|foreign key/i);
  });

  it('enforces the assignment state machine, immutable scope and audit fields, and delete protection', async () => {
    await addProjectAssignment(database);
    await expectProjectAssignmentFoundationPresent(database);
    await database('control_plane.project_assignments').insert(
      assignmentRow({
        created_at: new Date('2026-08-01T00:00:00.000Z'),
        updated_at: new Date('2026-08-01T00:00:00.000Z'),
      }),
    );

    await database('control_plane.project_assignments')
      .where({ project_assignment_id: assignmentOneId })
      .update({ access_level: 'editor', status: 'suspended' });
    const suspended = await database('control_plane.project_assignments')
      .select('access_level', 'status', 'updated_at')
      .where({ project_assignment_id: assignmentOneId })
      .first();
    expect(suspended?.access_level).toBe('editor');
    expect(suspended?.status).toBe('suspended');
    expect(suspended?.updated_at.getTime()).toBeGreaterThan(
      new Date('2026-08-01T00:00:00.000Z').getTime(),
    );

    await database('control_plane.project_assignments')
      .where({ project_assignment_id: assignmentOneId })
      .update({ status: 'active' });

    await expect(
      database('control_plane.project_assignments')
        .where({ project_assignment_id: assignmentOneId })
        .update({ project_id: projectATwoId }),
    ).rejects.toThrow(/immutable|scope/i);
    await expect(
      database('control_plane.project_assignments')
        .where({ project_assignment_id: assignmentOneId })
        .update({ assignment_source: 'pilot_backfill', backfill_run_id: backfillRunId }),
    ).rejects.toThrow(/immutable|source|backfill/i);
    await expect(
      database('control_plane.project_assignments')
        .where({ project_assignment_id: assignmentOneId })
        .update({ status: 'revoked' }),
    ).rejects.toThrow(/revoked_at|revoked/i);

    const revokedAt = new Date('2026-08-07T12:00:00.000Z');
    await database('control_plane.project_assignments')
      .where({ project_assignment_id: assignmentOneId })
      .update({ status: 'revoked', revoked_at: revokedAt });

    await expect(
      database('control_plane.project_assignments')
        .where({ project_assignment_id: assignmentOneId })
        .update({ status: 'active', revoked_at: null }),
    ).rejects.toThrow(/revoked|terminal/i);
    await expect(
      database('control_plane.project_assignments')
        .where({ project_assignment_id: assignmentOneId })
        .update({ access_level: 'viewer' }),
    ).rejects.toThrow(/revoked|access/i);
    await expect(
      database('control_plane.project_assignments')
        .where({ project_assignment_id: assignmentOneId })
        .delete(),
    ).rejects.toThrow(/delete|history|assignment/i);
  });

  it('retains assignment history when Membership becomes inactive or loses content_operator', async () => {
    await addProjectAssignment(database);
    await expectProjectAssignmentFoundationPresent(database);

    await database.transaction(async (transaction) => {
      await transaction('control_plane.organization_membership_roles').insert({
        membership_id: tenantAOperatorMembershipId,
        role_code: 'tenant_admin',
      });
      await transaction('control_plane.project_assignments').insert(assignmentRow());
    });

    await database('control_plane.organization_memberships')
      .where({ membership_id: tenantAOperatorMembershipId })
      .update({ status: 'suspended' });
    expect(
      await database('control_plane.project_assignments')
        .where({ project_assignment_id: assignmentOneId })
        .first(),
    ).toBeDefined();

    await database.transaction(async (transaction) => {
      await transaction('control_plane.organization_memberships')
        .where({ membership_id: tenantAOperatorMembershipId })
        .update({ status: 'active', primary_role_code: 'tenant_admin' });
      await transaction('control_plane.organization_membership_roles')
        .where({
          membership_id: tenantAOperatorMembershipId,
          role_code: 'content_operator',
        })
        .delete();
    });

    expect(
      await database('control_plane.project_assignments')
        .select('project_assignment_id', 'status')
        .where({ project_assignment_id: assignmentOneId })
        .first(),
    ).toEqual({ project_assignment_id: assignmentOneId, status: 'active' });
  });

  it('rolls back only 009 tables, triggers and composite constraints while preserving prior data', async () => {
    await addProjectAssignment(database);
    await expectProjectAssignmentFoundationPresent(database);
    await database('control_plane.project_assignments').insert(assignmentRow());

    await removeProjectAssignment(database);

    expect(await tableRegistration(database, 'project_assignments')).toBeNull();
    expect(await tableRegistration(database, 'project_assignment_backfill_runs')).toBeNull();
    expect(
      await database('control_plane.projects')
        .select('project_id', 'tenant_id')
        .where({ project_id: projectAOneId })
        .first(),
    ).toEqual({ project_id: projectAOneId, tenant_id: tenantAId });
    expect(
      await database('control_plane.organization_memberships')
        .select('membership_id', 'organization_id')
        .where({ membership_id: tenantAOperatorMembershipId })
        .first(),
    ).toEqual({
      membership_id: tenantAOperatorMembershipId,
      organization_id: tenantAId,
    });
    expect(
      await database('control_plane.tenants')
        .select('tenant_id', 'organization_id')
        .where({ tenant_id: tenantAId })
        .first(),
    ).toEqual({ tenant_id: tenantAId, organization_id: tenantAId });
    expect(
      await database('control_plane.organizations')
        .select('organization_id', 'organization_type')
        .where({ organization_id: tenantAId })
        .first(),
    ).toEqual({ organization_id: tenantAId, organization_type: 'TENANT' });
  });
});
