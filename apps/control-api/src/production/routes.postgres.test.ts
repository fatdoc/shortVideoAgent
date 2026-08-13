import knex, { type Knex } from 'knex';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { up as createPilotCore } from '../db/migrations/001_pilot_core.js';
import { up as addContentTenantIntegrity } from '../db/migrations/003_content_tenant_integrity.js';
import { up as addProductionPackageGrant } from '../db/migrations/004_production_package_grant.js';
import { up as hardenProductionSecurity } from '../db/migrations/005_production_security_hardening.js';
import { up as addStoryboardAuthority } from '../db/migrations/020_storyboard_authority.js';
import { up as addProductionStoryboardAuthority } from '../db/migrations/022_production_storyboard_authority.js';
import type { ProjectPolicy } from '../projects/policy.js';
import { tokenDigest } from './digest.js';
import { ProjectGrantTokenService } from './grantToken.js';
import { PostgresProductionStore } from './repository.js';
import { createProductionRouter } from './routes.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const tenantA = '25000000-0000-4000-8000-000000000001';
const tenantB = '26000000-0000-4000-8000-000000000001';
const userA = '25000000-0000-4000-8000-000000000002';
const userB = '26000000-0000-4000-8000-000000000002';
const projectA = '25000000-0000-4000-8000-000000000003';
const briefA = '25000000-0000-4000-8000-000000000004';
const scriptA = '25000000-0000-4000-8000-000000000005';
const storyboardA = '25000000-0000-4000-8000-000000000006';
const scriptApprovalA = '25000000-0000-4000-8000-000000000007';
const storyboardApprovalA = '25000000-0000-4000-8000-000000000008';
const storyboardRevocationA = '25000000-0000-4000-8000-000000000009';
const scriptDigest = `sha256:${'a'.repeat(64)}`;
const storyboardDigest = `sha256:${'b'.repeat(64)}`;
const fixedNow = new Date('2026-08-11T06:00:00.000Z');
const signingSecret = 'strict-http-project-grant-secret-at-least-32-chars';

const publicPackageKeys = [
  'objectType',
  'contractVersion',
  'tenantId',
  'projectId',
  'packageId',
  'packageVersion',
  'scriptVersionId',
  'storyboardVersionId',
  'capabilityRequirements',
  'status',
  'payloadDigest',
  'approvedScriptDigest',
  'approvedStoryboardDigest',
  'createdAt',
  'expiresAt',
] as const;

function session(tenantId: string, userId: string) {
  return {
    session: {
      user: { id: userId, email: `${userId}@example.com`, displayName: 'Pilot User' },
      tenant: { id: tenantId, displayName: 'Pilot Tenant' },
      roles: ['tenant_admin'] as const,
      activeContext: {
        membershipId: `${userId.slice(0, -1)}3`,
        organizationId: tenantId,
        organizationType: 'TENANT' as const,
        organizationDisplayName: 'Pilot Tenant',
        membershipVersion: 1,
        primaryRole: 'tenant_admin' as const,
        roles: ['tenant_admin'] as const,
        tenantId,
      },
      expiresAt: new Date(fixedNow.getTime() + 60_000).toISOString(),
    },
  };
}

function packageCommand() {
  return {
    scriptVersionId: scriptA,
    storyboardVersionId: storyboardA,
    capabilityRequirements: ['video.generate', 'media.export'],
    expiresInSeconds: 3_600,
  };
}

async function seedApprovedAuthority(database: Knex): Promise<void> {
  await database('control_plane.projects').insert({
    project_id: projectA,
    tenant_id: tenantA,
    name: 'Strict HTTP Project',
    status: 'active',
    platform: 'douyin',
    aspect_ratio: '9:16',
    target_duration_seconds: 30,
    created_by: userA,
  });
  await database('control_plane.creative_briefs').insert({
    brief_id: briefA,
    tenant_id: tenantA,
    project_id: projectA,
    version: 1,
    status: 'approved',
    payload: {
      objective: 'Create a controlled TEST production package.',
      audience: ['pilot-reviewers'],
      platforms: ['douyin'],
      brandPolicySnapshot: {
        facts: [],
        prohibitedTerms: [],
        requiredDisclosures: ['TEST only'],
        sourceDigest: `sha256:${'c'.repeat(64)}`,
      },
    },
    payload_digest: `sha256:${'d'.repeat(64)}`,
    created_by: userA,
  });
  await database('control_plane.script_versions').insert({
    script_version_id: scriptA,
    tenant_id: tenantA,
    project_id: projectA,
    version: 1,
    status: 'approved',
    payload: {
      content: 'Approved script authority content that is server-only.',
      storyboard: [
        {
          shotId: 'legacy-script-fallback',
          sequence: 1,
          description: 'Legacy fallback that must not be used.',
          durationSeconds: 30,
          sourceMode: 'generated',
        },
      ],
    },
    payload_digest: scriptDigest,
    created_by: userA,
  });
  await database('control_plane.script_approvals').insert({
    approval_id: scriptApprovalA,
    tenant_id: tenantA,
    project_id: projectA,
    script_version_id: scriptA,
    status: 'approved',
    fact_risk_status: 'cleared',
    reason: 'Approved for TEST production.',
    acted_by: userA,
    acted_at: new Date('2026-08-11T05:55:00.000Z'),
  });
  await database('control_plane.storyboard_versions').insert({
    storyboard_version_id: storyboardA,
    tenant_id: tenantA,
    project_id: projectA,
    script_version_id: scriptA,
    version: 1,
    status: 'draft',
    draft_revision_id: '25000000-0000-4000-8000-000000000010',
    draft_revision_number: 1,
    previous_draft_revision_id: null,
    script_payload_digest: scriptDigest,
    payload: {
      shots: [
        {
          shotId: '25000000-0000-4000-8000-000000000011',
          sequence: 1,
          description: 'Approved storyboard shot that is server-only.',
          durationSeconds: 30,
          sourceMode: 'mixed',
        },
      ],
    },
    payload_digest: storyboardDigest,
    provenance: {
      objectType: 'StoryboardDraftRevision',
      contractVersion: '0.2',
      status: 'draft',
      tenantId: tenantA,
      projectId: projectA,
      approvedScriptVersionId: scriptA,
      approvedScriptDigest: scriptDigest,
      draftRevisionId: '25000000-0000-4000-8000-000000000010',
      revisionNumber: 1,
      previousRevisionId: null,
      sourceReceipt: {
        providerId: 'storycanvas',
        sourceSystem: 'storycanvas',
        sourceContractVersion: '0.2',
        commandId: '25000000-0000-4000-8000-000000000012',
        receiptId: '25000000-0000-4000-8000-000000000013',
        receiptDigest: `sha256:${'e'.repeat(64)}`,
        receivedAt: '2026-08-11T05:50:00.000Z',
      },
      generationPolicy: { policyId: 'pilot.storyboard', policyVersion: '0.2.0' },
      validationSummary: { status: 'passed', issueCodes: [] },
      createdAt: '2026-08-11T05:51:00.000Z',
    },
    created_by: userA,
  });
  await database('control_plane.storyboard_approvals').insert({
    storyboard_approval_id: storyboardApprovalA,
    tenant_id: tenantA,
    project_id: projectA,
    storyboard_version_id: storyboardA,
    status: 'approved',
    fact_risk_status: 'cleared',
    reason: 'Approved storyboard authority.',
    idempotency_key: 'strict-http-storyboard-approval',
    event_digest: `sha256:${'f'.repeat(64)}`,
    acted_by: userA,
    acted_at: new Date('2026-08-11T05:56:00.000Z'),
  });
  await database('control_plane.storyboard_versions')
    .where({ storyboard_version_id: storyboardA })
    .update({ status: 'approved' });
}

describe.runIf(hasDedicatedTestDatabase)('Strict Production Package v0.3 HTTP PostgreSQL', () => {
  let database: Knex;
  let app: ReturnType<typeof createApp>;
  let tokens: ProjectGrantTokenService;

  beforeAll(async () => {
    database = knex({ client: 'pg', connection: databaseUrl });
    await database.raw('drop schema if exists control_plane cascade');
    await createPilotCore(database);
    await addContentTenantIntegrity(database);
    await addProductionPackageGrant(database);
    await hardenProductionSecurity(database);
    await addStoryboardAuthority(database);
    await addProductionStoryboardAuthority(database);

    tokens = new ProjectGrantTokenService(signingSecret, 'strict-http-kid', () => fixedNow);
    const productionStore = new PostgresProductionStore(database, tokens, () => fixedNow);
    const projectPolicy: ProjectPolicy = {
      canCreateProject: async () => true,
      listVisibleProjectIds: async () => null,
      resolveProjectAccess: async () => 'manager',
    };
    const productionRouter = createProductionRouter({
      store: productionStore,
      policy: projectPolicy,
      resolveSession: async (token) => {
        if (token === 'tenant-a-session') return session(tenantA, userA);
        if (token === 'tenant-b-session') return session(tenantB, userB);
        return null;
      },
      secureCookies: false,
      sessionTtlSeconds: 28_800,
    });
    app = createApp({
      appVersion: 'test',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      productionRouter,
    });
  });

  beforeEach(async () => {
    await database.raw(`
      truncate table
        control_plane.project_grants,
        control_plane.production_packages,
        control_plane.storyboard_approvals,
        control_plane.storyboard_versions,
        control_plane.script_approvals,
        control_plane.script_versions,
        control_plane.creative_briefs,
        control_plane.idempotency_records,
        control_plane.projects,
        control_plane.users,
        control_plane.tenants
      restart identity cascade
    `);
    await database('control_plane.tenants').insert([
      { tenant_id: tenantA, display_name: 'Tenant A', status: 'active' },
      { tenant_id: tenantB, display_name: 'Tenant B', status: 'active' },
    ]);
    await database('control_plane.users').insert([
      {
        user_id: userA,
        email: 'strict-http-a@example.com',
        display_name: 'Strict HTTP A',
        password_hash: 'unused',
        status: 'active',
      },
      {
        user_id: userB,
        email: 'strict-http-b@example.com',
        display_name: 'Strict HTTP B',
        password_hash: 'unused',
        status: 'active',
      },
    ]);
    await seedApprovedAuthority(database);
  });

  afterAll(async () => {
    await database?.destroy();
  });

  function createPackage(key = 'strict-package-v03') {
    return request(app)
      .post(`/api/v1/projects/${projectA}/production-packages`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('x-request-id', `request-${key}`)
      .set('idempotency-key', key)
      .send(packageCommand());
  }

  it('creates, reads, and replays only the exact public v0.3 projection', async () => {
    const created = await createPackage();
    expect(created.status).toBe(201);
    expect(created.headers['cache-control']).toBe('no-store');
    expect(Object.keys(created.body)).toEqual(publicPackageKeys);
    expect(created.body).toMatchObject({
      objectType: 'ProjectProductionPackage',
      contractVersion: '0.3',
      tenantId: tenantA,
      projectId: projectA,
      packageVersion: 1,
      scriptVersionId: scriptA,
      storyboardVersionId: storyboardA,
      capabilityRequirements: ['video.generate', 'media.export'],
      status: 'ready',
      approvedScriptDigest: scriptDigest,
      approvedStoryboardDigest: storyboardDigest,
    });
    expect(created.body.payloadDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(created.text).not.toContain('Approved script authority content');
    expect(created.text).not.toContain('Approved storyboard shot');
    expect(created.body).not.toHaveProperty('snapshot');
    expect(created.body).not.toHaveProperty('idempotencyKey');

    const stored = await database('control_plane.production_packages')
      .select('contract_version', 'approved_storyboard_version_id', 'snapshot')
      .where({ package_id: created.body.packageId })
      .first();
    expect(stored).toMatchObject({
      contract_version: '0.3',
      approved_storyboard_version_id: storyboardA,
    });
    expect(JSON.stringify(stored.snapshot)).toContain('Approved script authority content');
    expect(JSON.stringify(stored.snapshot)).toContain('Approved storyboard shot');

    const read = await request(app)
      .get(`/api/v1/projects/${projectA}/production-packages/${created.body.packageId as string}`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('x-request-id', 'strict-package-read');
    expect(read.status).toBe(200);
    expect(read.headers['cache-control']).toBe('no-store');
    expect(Object.keys(read.body)).toEqual(publicPackageKeys);
    expect(read.body).toEqual(created.body);

    const replay = await createPackage();
    expect(replay.status).toBe(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(replay.body).toEqual(created.body);
    expect(
      await database('control_plane.production_packages').count('* as count').first(),
    ).toMatchObject({ count: '1' });

    const conflict = await request(app)
      .post(`/api/v1/projects/${projectA}/production-packages`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('x-request-id', 'strict-package-conflict')
      .set('idempotency-key', 'strict-package-v03')
      .send({ ...packageCommand(), capabilityRequirements: ['video.generate'] });
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({
      error: {
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'Request conflicts with an earlier request.',
        requestId: 'strict-package-conflict',
      },
    });

    await expect(
      database('control_plane.production_packages')
        .where({ package_id: created.body.packageId })
        .update({ snapshot: JSON.stringify({ tampered: true }) }),
    ).rejects.toThrow(/immutable/);
  });

  it('returns one no-store 404 for cross-tenant and unknown Package reads', async () => {
    const created = await createPackage('strict-package-cross-tenant');
    expect(created.status).toBe(201);

    const crossTenant = await request(app)
      .get(`/api/v1/projects/${projectA}/production-packages/${created.body.packageId as string}`)
      .set('cookie', 'videoagent_session=tenant-b-session')
      .set('x-request-id', 'strict-safe-404');
    const unknown = await request(app)
      .get(`/api/v1/projects/${projectA}/production-packages/25000000-0000-4000-8000-000000000099`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('x-request-id', 'strict-safe-404');

    expect(crossTenant.status).toBe(404);
    expect(crossTenant.headers['cache-control']).toBe('no-store');
    expect(crossTenant.body).toEqual(unknown.body);
    expect(crossTenant.body).toEqual({
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: 'Requested resource does not exist or is not accessible.',
        requestId: 'strict-safe-404',
      },
    });
  });

  it('maps stale Storyboard authority to 409 without returning the old package', async () => {
    const created = await createPackage('strict-package-stale');
    expect(created.status).toBe(201);

    await database('control_plane.storyboard_approvals').insert({
      storyboard_approval_id: storyboardRevocationA,
      tenant_id: tenantA,
      project_id: projectA,
      storyboard_version_id: storyboardA,
      status: 'revoked',
      fact_risk_status: 'cleared',
      reason: 'Storyboard authority revoked.',
      idempotency_key: 'strict-http-storyboard-revocation',
      event_digest: `sha256:${'9'.repeat(64)}`,
      acted_by: userA,
      acted_at: fixedNow,
    });
    await database('control_plane.storyboard_versions')
      .where({ storyboard_version_id: storyboardA })
      .update({ status: 'revoked' });

    const replay = await createPackage('strict-package-stale');
    expect(replay.status).toBe(409);
    expect(replay.headers['cache-control']).toBe('no-store');
    expect(replay.headers['idempotency-replayed']).toBeUndefined();
    expect(replay.body).toEqual({
      error: {
        code: 'PRODUCTION_AUTHORITY_STALE',
        message: 'Production authority is no longer current.',
        requestId: 'request-strict-package-stale',
      },
    });
    expect(replay.body).not.toHaveProperty('packageId');
    expect(replay.text).not.toContain('STORYBOARD_APPROVAL_REVOKED');
  });

  it('keeps the existing Grant v0.2 success and token contract unchanged', async () => {
    const packageResponse = await createPackage('strict-package-for-grant');
    expect(packageResponse.status).toBe(201);

    const grant = await request(app)
      .post(`/api/v1/projects/${projectA}/production-grants`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('x-request-id', 'strict-grant-unchanged')
      .set('idempotency-key', 'strict-grant-v02')
      .send({
        packageId: packageResponse.body.packageId,
        requestedCapabilities: ['video.generate'],
        requestedScopes: ['production.package.read', 'production.task.write'],
      });

    expect(grant.status).toBe(201);
    expect(grant.headers['cache-control']).toBe('no-store');
    expect(grant.body).toMatchObject({
      tokenType: 'Bearer',
      accessToken: expect.any(String),
      grant: {
        objectType: 'ProjectGrant',
        contractVersion: '0.2',
        tenantId: tenantA,
        projectId: projectA,
        packageId: packageResponse.body.packageId,
        capabilities: ['video.generate'],
        scopes: ['production.package.read', 'production.task.write'],
      },
    });
    expect(grant.body.grant.tokenDigest).toBe(tokenDigest(grant.body.accessToken as string));
    expect(tokens.verify(grant.body.accessToken as string).contractVersion).toBe('0.2');

    const storedGrant = await database('control_plane.project_grants')
      .select('*')
      .where({ grant_id: grant.body.grant.grantId })
      .first();
    expect(JSON.stringify(storedGrant)).not.toContain(grant.body.accessToken as string);
  });
});
