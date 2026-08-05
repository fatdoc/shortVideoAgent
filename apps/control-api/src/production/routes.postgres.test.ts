import knex, { type Knex } from 'knex';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { up as createPilotCore } from '../db/migrations/001_pilot_core.js';
import { up as addSessionRotation } from '../db/migrations/002_auth_session_rotation.js';
import { up as addContentTenantIntegrity } from '../db/migrations/003_content_tenant_integrity.js';
import { up as addProductionPackageGrant } from '../db/migrations/004_production_package_grant.js';
import { contractPayloadDigest, tokenDigest } from './digest.js';
import { ProjectGrantTokenService } from './grantToken.js';
import { PostgresProductionStore } from './repository.js';
import { createProductionRouter } from './routes.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);
const tenantA = '10000000-0000-4000-8000-000000000001';
const tenantB = '20000000-0000-4000-8000-000000000001';
const userA = '10000000-0000-4000-8000-000000000002';
const userB = '20000000-0000-4000-8000-000000000002';
const projectA = '10000000-0000-4000-8000-000000000004';
const briefA = '10000000-0000-4000-8000-000000000005';
const scriptA = '10000000-0000-4000-8000-000000000006';
const fixedNow = new Date('2026-08-05T01:00:00.000Z');
const signingSecret = 'postgres-test-project-grant-secret-at-least-32-chars';

function session(tenantId: string, userId: string) {
  return {
    session: {
      user: { id: userId, email: `${userId}@example.com`, displayName: 'Pilot User' },
      tenant: { id: tenantId, displayName: 'Pilot Tenant' },
      roles: ['tenant_admin'] as const,
      expiresAt: new Date(fixedNow.getTime() + 60_000).toISOString(),
    },
  };
}

describe.runIf(hasDedicatedTestDatabase)('A05 PostgreSQL package/grant workflow', () => {
  let database: Knex;
  let app: ReturnType<typeof createApp>;
  let tokens: ProjectGrantTokenService;

  beforeAll(async () => {
    database = knex({ client: 'pg', connection: databaseUrl });
    await database.raw('drop schema if exists control_plane cascade');
    await createPilotCore(database);
    await addSessionRotation(database);
    await addContentTenantIntegrity(database);
    await addProductionPackageGrant(database);
    tokens = new ProjectGrantTokenService(signingSecret, 'pilot-test-kid', () => fixedNow);
    const productionRouter = createProductionRouter({
      store: new PostgresProductionStore(database, tokens, () => fixedNow),
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
        control_plane.script_approvals,
        control_plane.script_versions,
        control_plane.creative_briefs,
        control_plane.idempotency_records,
        control_plane.projects,
        control_plane.auth_sessions,
        control_plane.memberships,
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
        email: 'a@example.com',
        display_name: 'A',
        password_hash: 'unused',
        status: 'active',
      },
      {
        user_id: userB,
        email: 'b@example.com',
        display_name: 'B',
        password_hash: 'unused',
        status: 'active',
      },
    ]);
    await database('control_plane.memberships').insert([
      {
        membership_id: '10000000-0000-4000-8000-000000000003',
        tenant_id: tenantA,
        user_id: userA,
        role_code: 'tenant_admin',
        status: 'active',
      },
      {
        membership_id: '20000000-0000-4000-8000-000000000003',
        tenant_id: tenantB,
        user_id: userB,
        role_code: 'tenant_admin',
        status: 'active',
      },
    ]);
  });

  afterAll(async () => {
    await database?.destroy();
  });

  async function seedContent(
    projectId: string,
    scriptId: string,
    approval?: { status: 'approved' | 'revoked' | 'blocked'; factRiskStatus: 'cleared' | 'unresolved' },
  ) {
    const suffix = projectId.slice(-1);
    await database('control_plane.projects').insert({
      project_id: projectId,
      tenant_id: tenantA,
      name: `Pilot ${suffix}`,
      status: 'active',
      platform: 'douyin',
      aspect_ratio: '9:16',
      target_duration_seconds: 15,
      created_by: userA,
    });
    await database('control_plane.creative_briefs').insert({
      brief_id: projectId === projectA ? briefA : `10000000-0000-4000-8000-00000000001${suffix}`,
      tenant_id: tenantA,
      project_id: projectId,
      version: 1,
      status: 'draft',
      payload: JSON.stringify({
        objective: 'Produce one controlled-pilot vertical store video.',
        audience: ['local-store-visitors'],
        platforms: ['douyin'],
        brandPolicySnapshot: {
          facts: [
            {
              factId: `fact-${suffix}`,
              text: 'Pilot fact from customer-provided source material.',
              sourceReference: `customer-material:fact-${suffix}`,
              approved: true,
            },
          ],
          prohibitedTerms: ['unverified-superlative'],
          requiredDisclosures: ['internal-controlled-pilot'],
          sourceDigest: `sha256:${'1'.repeat(64)}`,
        },
      }),
      payload_digest: `brief-${suffix}`,
      created_by: userA,
    });
    await database('control_plane.script_versions').insert({
      script_version_id: scriptId,
      tenant_id: tenantA,
      project_id: projectId,
      version: 1,
      status: 'draft',
      payload: JSON.stringify({
        content: 'Approved pilot script snapshot.',
        storyboard: [
          {
            shotId: `shot-${suffix}`,
            sequence: 1,
            description: 'Opening store-context shot.',
            durationSeconds: 5,
            sourceMode: 'mixed',
          },
        ],
      }),
      payload_digest: `script-${suffix}`,
      created_by: userA,
    });
    if (approval) {
      await database('control_plane.script_approvals').insert({
        approval_id: `10000000-0000-4000-8000-00000000002${suffix}`,
        tenant_id: tenantA,
        project_id: projectId,
        script_version_id: scriptId,
        status: approval.status,
        fact_risk_status: approval.factRiskStatus,
        acted_by: userA,
        acted_at: new Date(fixedNow.getTime() - 60_000),
      });
    }
  }

  function packageRequest(targetProject = projectA, key = 'package-a-v1') {
    return request(app)
      .post(`/api/v1/projects/${targetProject}/production-packages`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', key)
      .send({
        scriptVersionId: targetProject === projectA ? scriptA : targetProject.replace(/.$/, '6'),
        capabilityRequirements: ['video.generate', 'media.export'],
        expiresInSeconds: 21_600,
      });
  }

  it('persists an immutable approved package and safely replays or rejects the command', async () => {
    await seedContent(projectA, scriptA, { status: 'approved', factRiskStatus: 'cleared' });

    const created = await packageRequest();
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      objectType: 'ProjectProductionPackage',
      contractVersion: '0.2',
      tenantId: tenantA,
      projectId: projectA,
      packageVersion: 1,
      approvedScript: { scriptVersionId: scriptA, approvedBy: userA },
    });
    expect(created.body.payloadDigest).toBe(contractPayloadDigest(created.body));

    const replay = await packageRequest();
    expect(replay.status).toBe(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(replay.body.packageId).toBe(created.body.packageId);
    expect(
      await database('control_plane.production_packages').count('* as count').first(),
    ).toMatchObject({ count: '1' });

    const conflict = await request(app)
      .post(`/api/v1/projects/${projectA}/production-packages`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'package-a-v1')
      .send({
        scriptVersionId: scriptA,
        capabilityRequirements: ['video.generate'],
        expiresInSeconds: 21_600,
      });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');

    const crossTenant = await request(app)
      .get(`/api/v1/projects/${projectA}/production-packages/${created.body.packageId as string}`)
      .set('cookie', 'videoagent_session=tenant-b-session');
    expect(crossTenant.status).toBe(404);

    await expect(
      database('control_plane.production_packages')
        .where({ package_id: created.body.packageId })
        .update({ snapshot: JSON.stringify({ tampered: true }) }),
    ).rejects.toThrow(/immutable/);
  });

  it('blocks unapproved, revoked, blocked, and unresolved-risk scripts', async () => {
    const cases = [
      {
        projectId: '10000000-0000-4000-8000-000000000011',
        scriptId: '10000000-0000-4000-8000-000000000016',
        approval: undefined,
        reason: 'SCRIPT_NOT_APPROVED',
      },
      {
        projectId: '10000000-0000-4000-8000-000000000012',
        scriptId: '10000000-0000-4000-8000-000000000026',
        approval: { status: 'revoked', factRiskStatus: 'cleared' } as const,
        reason: 'APPROVAL_REVOKED',
      },
      {
        projectId: '10000000-0000-4000-8000-000000000013',
        scriptId: '10000000-0000-4000-8000-000000000036',
        approval: { status: 'blocked', factRiskStatus: 'cleared' } as const,
        reason: 'SCRIPT_BLOCKED',
      },
      {
        projectId: '10000000-0000-4000-8000-000000000014',
        scriptId: '10000000-0000-4000-8000-000000000046',
        approval: { status: 'approved', factRiskStatus: 'unresolved' } as const,
        reason: 'FACT_RISK_UNRESOLVED',
      },
    ];
    for (const [index, item] of cases.entries()) {
      await seedContent(item.projectId, item.scriptId, item.approval);
      const response = await request(app)
        .post(`/api/v1/projects/${item.projectId}/production-packages`)
        .set('cookie', 'videoagent_session=tenant-a-session')
        .set('idempotency-key', `ineligible-${index}`)
        .send({
          scriptVersionId: item.scriptId,
          capabilityRequirements: ['video.generate'],
        });
      expect(response.status).toBe(403);
      expect(response.body.error).toMatchObject({
        code: 'CAPABILITY_SCOPE_DENIED',
        details: { reasonCode: item.reason },
      });
    }
    expect(
      await database('control_plane.production_packages').count('* as count').first(),
    ).toMatchObject({ count: '0' });
  });

  it('issues a minimal signed grant, stores no raw token, and rechecks approval', async () => {
    await seedContent(projectA, scriptA, { status: 'approved', factRiskStatus: 'cleared' });
    const packageResponse = await packageRequest();
    const grantPayload = {
      packageId: packageResponse.body.packageId as string,
      requestedCapabilities: ['video.generate'],
      requestedScopes: ['production.package.read', 'production.task.write'],
      ttlSeconds: 600,
    };
    const issue = () =>
      request(app)
        .post(`/api/v1/projects/${projectA}/production-grants`)
        .set('cookie', 'videoagent_session=tenant-a-session')
        .set('idempotency-key', 'grant-a-v1')
        .send(grantPayload);

    const created = await issue();
    expect(created.status).toBe(201);
    expect(created.headers['cache-control']).toBe('no-store');
    expect(created.body.grant).toMatchObject({
      objectType: 'ProjectGrant',
      contractVersion: '0.2',
      tenantId: tenantA,
      projectId: projectA,
      packageId: grantPayload.packageId,
      capabilities: ['video.generate'],
      scopes: ['production.package.read', 'production.task.write'],
    });
    expect(created.body.grant.payloadDigest).toBe(contractPayloadDigest(created.body.grant));
    expect(created.body.grant.tokenDigest).toBe(tokenDigest(created.body.accessToken as string));
    expect(tokens.verify(created.body.accessToken as string)).toMatchObject({
      tenantId: tenantA,
      projectId: projectA,
      packageId: grantPayload.packageId,
      capabilities: ['video.generate'],
      scopes: ['production.package.read', 'production.task.write'],
    });

    const replay = await issue();
    expect(replay.status).toBe(200);
    expect(replay.body.accessToken).toBe(created.body.accessToken);
    expect(
      await database('control_plane.project_grants').count('* as count').first(),
    ).toMatchObject({ count: '1' });
    const persisted = JSON.stringify({
      grants: await database('control_plane.project_grants').select('*'),
      idempotency: await database('control_plane.idempotency_records')
        .select('response_body')
        .where({ operation: 'production.grant.issue' }),
    });
    expect(persisted).not.toContain(created.body.accessToken as string);
    expect(persisted).not.toContain(signingSecret);

    const overScoped = await request(app)
      .post(`/api/v1/projects/${projectA}/production-grants`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'grant-over-scope')
      .send({
        ...grantPayload,
        requestedCapabilities: ['audio.tts'],
      });
    expect(overScoped.status).toBe(403);
    expect(overScoped.body.error.code).toBe('CAPABILITY_SCOPE_DENIED');

    const overPrivileged = await request(app)
      .post(`/api/v1/projects/${projectA}/production-grants`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'grant-over-privileged')
      .send({
        ...grantPayload,
        requestedScopes: ['production.package.read', 'production.export.write'],
      });
    expect(overPrivileged.status).toBe(403);
    expect(overPrivileged.body.error.code).toBe('CAPABILITY_SCOPE_DENIED');

    await database('control_plane.script_approvals').insert({
      approval_id: '10000000-0000-4000-8000-000000000030',
      tenant_id: tenantA,
      project_id: projectA,
      script_version_id: scriptA,
      status: 'revoked',
      fact_risk_status: 'cleared',
      reason: 'customer requested changes',
      acted_by: userA,
      acted_at: fixedNow,
    });
    const revoked = await request(app)
      .post(`/api/v1/projects/${projectA}/production-grants`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'grant-after-revoke')
      .send(grantPayload);
    expect(revoked.status).toBe(403);
    expect(revoked.body.error.details.reasonCode).toBe('APPROVAL_REVOKED');
  });
});
