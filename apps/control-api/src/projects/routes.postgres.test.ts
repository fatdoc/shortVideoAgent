import request from 'supertest';
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { up as createPilotCore } from '../db/migrations/001_pilot_core.js';
import { up as addSessionRotation } from '../db/migrations/002_auth_session_rotation.js';
import { up as addContentTenantIntegrity } from '../db/migrations/003_content_tenant_integrity.js';
import type { ProjectPolicy } from './policy.js';
import { createContentRouter } from './routes.js';
import { PostgresContentStore } from './repository.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);
const tenantA = '10000000-0000-4000-8000-000000000001';
const tenantB = '20000000-0000-4000-8000-000000000001';
const userA = '10000000-0000-4000-8000-000000000002';
const userB = '20000000-0000-4000-8000-000000000002';

function session(tenantId: string, userId: string) {
  return {
    session: {
      user: { id: userId, email: `${userId}@example.com`, displayName: 'Pilot User' },
      tenant: { id: tenantId, displayName: 'Pilot Tenant' },
      roles: ['tenant_admin'] as const,
      activeContext: {
        membershipId: `${userId}-membership`,
        organizationId: tenantId,
        organizationType: 'TENANT' as const,
        organizationDisplayName: 'Pilot Tenant',
        membershipVersion: 1,
        primaryRole: 'tenant_admin' as const,
        roles: ['tenant_admin'] as const,
        tenantId,
      },
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  };
}

describe.runIf(hasDedicatedTestDatabase)('A03 PostgreSQL HTTP workflow', () => {
  let database: Knex;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    database = knex({ client: 'pg', connection: databaseUrl });
    await database.raw('drop schema if exists control_plane cascade');
    await createPilotCore(database);
    await addSessionRotation(database);
    await addContentTenantIntegrity(database);
    const projectPolicy: ProjectPolicy = {
      canCreateProject: async () => true,
      listVisibleProjectIds: async () => null,
      resolveProjectAccess: async () => 'manager',
    };
    const contentRouter = createContentRouter({
      store: new PostgresContentStore(database),
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
      contentRouter,
    });
  });

  beforeEach(async () => {
    await database.raw(`
      truncate table
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

  it('persists versions, isolates tenants, replays writes, and revokes production eligibility', async () => {
    const projectPayload = {
      name: 'Launch Video',
      status: 'draft',
      platform: 'douyin',
      aspectRatio: '9:16',
      targetDurationSeconds: 30,
    };
    expect((await request(app).post('/api/v1/projects').send(projectPayload)).status).toBe(401);

    const created = await request(app)
      .post('/api/v1/projects')
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'project-1')
      .send(projectPayload);
    expect(created.status).toBe(201);
    const projectId = created.body.id as string;

    const replay = await request(app)
      .post('/api/v1/projects')
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'project-1')
      .send(projectPayload);
    expect(replay.status).toBe(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(replay.body.id).toBe(projectId);

    const updated = await request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'project-update-1')
      .send({ name: 'Launch Video Updated', status: 'active' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ name: 'Launch Video Updated', status: 'active' });

    const conflict = await request(app)
      .post('/api/v1/projects')
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'project-1')
      .send({ ...projectPayload, name: 'Different' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(
      await database('control_plane.projects')
        .where({ tenant_id: tenantA })
        .count('* as count')
        .first(),
    ).toMatchObject({ count: '1' });

    const crossTenant = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set('cookie', 'videoagent_session=tenant-b-session');
    expect(crossTenant.status).toBe(404);
    expect(crossTenant.body.error.code).toBe('PROJECT_NOT_FOUND');

    for (const [index, goal] of ['awareness', 'conversion'].entries()) {
      const brief = await request(app)
        .post(`/api/v1/projects/${projectId}/brief-versions`)
        .set('cookie', 'videoagent_session=tenant-a-session')
        .set('idempotency-key', `brief-${index + 1}`)
        .send({ payload: { goal } });
      expect(brief.status).toBe(201);
      expect(brief.body.version).toBe(index + 1);
    }
    const briefReplay = await request(app)
      .post(`/api/v1/projects/${projectId}/brief-versions`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'brief-2')
      .send({ payload: { goal: 'conversion' } });
    expect(briefReplay.status).toBe(200);
    expect(briefReplay.body.version).toBe(2);
    expect(
      await database('control_plane.creative_briefs')
        .where({ project_id: projectId })
        .count('* as count')
        .first(),
    ).toMatchObject({ count: '2' });

    let latestScriptId = '';
    for (const [index, title] of ['draft one', 'draft two'].entries()) {
      const script = await request(app)
        .post(`/api/v1/projects/${projectId}/script-versions`)
        .set('cookie', 'videoagent_session=tenant-a-session')
        .set('idempotency-key', `script-${index + 1}`)
        .send({ payload: { title, fullText: `private script ${index + 1}` } });
      expect(script.status).toBe(201);
      expect(script.body.version).toBe(index + 1);
      latestScriptId = script.body.id as string;
    }

    const approved = await request(app)
      .post(`/api/v1/projects/${projectId}/script-versions/${latestScriptId}/approvals`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'approval-1')
      .send({ status: 'approved', factRiskStatus: 'cleared' });
    expect(approved.status).toBe(201);
    const eligible = await request(app)
      .get(`/api/v1/projects/${projectId}/production-eligibility`)
      .set('cookie', 'videoagent_session=tenant-a-session');
    expect(eligible.body).toMatchObject({
      eligible: true,
      scriptVersionId: latestScriptId,
      scriptVersion: 2,
      reasonCode: 'ELIGIBLE',
    });

    const revoked = await request(app)
      .post(`/api/v1/projects/${projectId}/script-versions/${latestScriptId}/approvals`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'approval-2')
      .send({ status: 'revoked', factRiskStatus: 'cleared', reason: 'Brand requested changes' });
    expect(revoked.status).toBe(201);
    const ineligible = await request(app)
      .get(`/api/v1/projects/${projectId}/production-eligibility`)
      .set('cookie', 'videoagent_session=tenant-a-session');
    expect(ineligible.body).toMatchObject({ eligible: false, reasonCode: 'APPROVAL_REVOKED' });

    const blocked = await request(app)
      .post(`/api/v1/projects/${projectId}/script-versions/${latestScriptId}/approvals`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'approval-3')
      .send({ status: 'blocked', factRiskStatus: 'cleared', reason: 'Legal hold' });
    expect(blocked.status).toBe(201);
    const blockedEligibility = await request(app)
      .get(`/api/v1/projects/${projectId}/production-eligibility`)
      .set('cookie', 'videoagent_session=tenant-a-session');
    expect(blockedEligibility.body).toMatchObject({
      eligible: false,
      reasonCode: 'SCRIPT_BLOCKED',
    });
    expect(
      await database('control_plane.script_approvals')
        .where({ script_version_id: latestScriptId })
        .count('* as count')
        .first(),
    ).toMatchObject({ count: '3' });

    const briefs = await request(app)
      .get(`/api/v1/projects/${projectId}/brief-versions`)
      .set('cookie', 'videoagent_session=tenant-a-session');
    const scripts = await request(app)
      .get(`/api/v1/projects/${projectId}/script-versions`)
      .set('cookie', 'videoagent_session=tenant-a-session');
    expect(
      briefs.body.briefVersions.map((version: { version: number }) => version.version),
    ).toEqual([1, 2]);
    expect(
      scripts.body.scriptVersions.map((version: { version: number }) => version.version),
    ).toEqual([1, 2]);
  });

  it('rejects client tenant injection and unresolved-risk approval', async () => {
    const injected = await request(app)
      .post('/api/v1/projects')
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'injected-project')
      .send({
        name: 'Injected',
        status: 'draft',
        platform: 'douyin',
        aspectRatio: '9:16',
        targetDurationSeconds: 15,
        tenantId: tenantB,
      });
    expect(injected.status).toBe(400);
    expect(await database('control_plane.projects').count('* as count').first()).toMatchObject({
      count: '0',
    });

    const project = await request(app)
      .post('/api/v1/projects')
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'risk-project')
      .send({
        name: 'Risk Review',
        status: 'draft',
        platform: 'douyin',
        aspectRatio: '9:16',
        targetDurationSeconds: 15,
      });
    const script = await request(app)
      .post(`/api/v1/projects/${project.body.id as string}/script-versions`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'risk-script')
      .send({ payload: { title: 'Unverified claim' } });
    const approval = await request(app)
      .post(
        `/api/v1/projects/${project.body.id as string}/script-versions/${script.body.id as string}/approvals`,
      )
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'risk-approval')
      .send({ status: 'approved', factRiskStatus: 'unresolved' });
    expect(approval.status).toBe(400);
    expect(approval.body.error.code).toBe('INVALID_APPROVAL');
    expect(
      await database('control_plane.script_approvals').count('* as count').first(),
    ).toMatchObject({ count: '0' });
  });
});
