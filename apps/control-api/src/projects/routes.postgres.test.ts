import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { up as createPilotCore } from '../db/migrations/001_pilot_core.js';
import { up as addSessionRotation } from '../db/migrations/002_auth_session_rotation.js';
import { up as addContentTenantIntegrity } from '../db/migrations/003_content_tenant_integrity.js';
import { up as addStoryboardAuthority } from '../db/migrations/020_storyboard_authority.js';
import type { ProjectPolicy } from './policy.js';
import { createContentRouter } from './routes.js';
import { PostgresContentStore } from './repository.js';
import { payloadDigest } from './digest.js';
import type { SessionActor } from './types.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);
const tenantA = '10000000-0000-4000-8000-000000000001';
const tenantB = '20000000-0000-4000-8000-000000000001';
const userA = '10000000-0000-4000-8000-000000000002';
const userB = '20000000-0000-4000-8000-000000000002';

function digest(seed: string): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(seed).digest('hex')}`;
}

function browserBrief(objective: string) {
  return {
    objective,
    audience: ['周边消费者'],
    platforms: ['douyin'],
    brandFacts: [{ text: '门店每日供应手冲咖啡', sourceReference: '门店菜单' }],
    prohibitedTerms: ['全网最低价'],
    requiredDisclosures: ['供应以门店当日菜单为准'],
    factsConfirmed: true as const,
  };
}

const trustedActor: SessionActor = {
  userId: userA,
  membershipId: '10000000-0000-4000-8000-000000000003',
  organizationId: tenantA,
  organizationType: 'TENANT',
  tenantId: tenantA,
  membershipVersion: 1,
  primaryRole: 'tenant_admin',
  roles: ['tenant_admin'],
};

const deterministicCanonicalBrief = {
  objective: '[CANVAS_FULL_CASE_BRIEF] deterministic trusted seed',
  audience: ['local-case-reviewers'],
  platforms: ['douyin'],
  brandPolicySnapshot: {
    facts: [
      {
        factId: '71000000-0000-4000-8000-000000000001',
        text: '[CANVAS_FULL_CASE_BRAND] deterministic trusted fact',
        sourceReference: 'local-case://brand/fact-1',
        approved: true as const,
      },
    ],
    prohibitedTerms: ['unverified claim'],
    requiredDisclosures: ['local TEST only'],
    sourceDigest: digest('deterministic-trusted-brief'),
  },
};

async function insertStoryboardVersion(
  database: Knex,
  input: {
    projectId: string;
    scriptVersionId: string;
    version: number;
    status?: 'draft' | 'approved';
  },
): Promise<string> {
  const script = (await database('control_plane.script_versions')
    .select('payload_digest')
    .where({
      tenant_id: tenantA,
      project_id: input.projectId,
      script_version_id: input.scriptVersionId,
    })
    .first()) as { payload_digest: string } | undefined;
  if (!script) throw new Error('script fixture missing');
  const storyboardVersionId = randomUUID();
  const revisionId = randomUUID();
  await database('control_plane.storyboard_versions').insert({
    storyboard_version_id: storyboardVersionId,
    tenant_id: tenantA,
    project_id: input.projectId,
    script_version_id: input.scriptVersionId,
    version: input.version,
    status: 'draft',
    draft_revision_id: revisionId,
    draft_revision_number: input.version,
    previous_draft_revision_id: input.version === 1 ? null : randomUUID(),
    script_payload_digest: `sha256:${script.payload_digest}`,
    payload: { revisionId, shots: [{ sequence: 1 }] },
    payload_digest: digest(`storyboard:${input.projectId}:${input.version}`),
    provenance: {
      sourceReceipt: {
        receiptId: randomUUID(),
        receiptDigest: digest(`receipt:${input.projectId}:${input.version}`),
        receivedAt: '2026-08-11T00:00:00.000Z',
      },
    },
    created_by: userA,
  });
  if (input.status === 'approved') {
    await appendStoryboardApproval(database, input.projectId, storyboardVersionId, {
      status: 'approved',
      factRiskStatus: 'cleared',
      projectStatus: 'approved',
    });
  }
  return storyboardVersionId;
}

async function appendStoryboardApproval(
  database: Knex,
  projectId: string,
  storyboardVersionId: string,
  input: {
    status: 'approved' | 'revoked' | 'blocked';
    factRiskStatus: 'cleared' | 'unresolved';
    projectStatus?: 'draft' | 'approved' | 'revoked';
  },
): Promise<void> {
  const approvalId = randomUUID();
  await database('control_plane.storyboard_approvals').insert({
    storyboard_approval_id: approvalId,
    tenant_id: tenantA,
    project_id: projectId,
    storyboard_version_id: storyboardVersionId,
    status: input.status,
    fact_risk_status: input.factRiskStatus,
    reason: input.status === 'approved' ? null : `${input.status} fixture`,
    idempotency_key: `storyboard-approval-${approvalId}`,
    event_digest: digest(`storyboard-approval:${approvalId}`),
    acted_by: userA,
  });
  if (input.projectStatus) {
    await database('control_plane.storyboard_versions')
      .where({ storyboard_version_id: storyboardVersionId })
      .update({ status: input.projectStatus });
  }
}

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
    await addStoryboardAuthority(database);
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
        control_plane.storyboard_approvals,
        control_plane.storyboard_versions,
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
    const crossTenantEligibility = await request(app)
      .get(`/api/v1/projects/${projectId}/production-eligibility`)
      .set('cookie', 'videoagent_session=tenant-b-session');
    expect(crossTenantEligibility.status).toBe(404);
    expect(crossTenantEligibility.body.error.code).toBe('PROJECT_NOT_FOUND');

    for (const [index, objective] of ['awareness', 'conversion'].entries()) {
      const brief = await request(app)
        .post(`/api/v1/projects/${projectId}/brief-versions`)
        .set('cookie', 'videoagent_session=tenant-a-session')
        .set('idempotency-key', `brief-${index + 1}`)
        .send({ payload: browserBrief(objective) });
      expect(brief.status).toBe(201);
      expect(brief.body.version).toBe(index + 1);
      expect(brief.body.payload).toEqual(browserBrief(objective));
      expect(JSON.stringify(brief.body)).not.toMatch(/sourceDigest|brandPolicySnapshot|sha256:/u);
    }
    const briefReplay = await request(app)
      .post(`/api/v1/projects/${projectId}/brief-versions`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'brief-2')
      .send({ payload: browserBrief('conversion') });
    expect(briefReplay.status).toBe(200);
    expect(briefReplay.body.version).toBe(2);
    expect(
      await database('control_plane.creative_briefs')
        .where({ project_id: projectId })
        .count('* as count')
        .first(),
    ).toMatchObject({ count: '2' });
    const storedBrief = (await database('control_plane.creative_briefs')
      .select('payload')
      .where({ project_id: projectId, version: 2 })
      .first()) as { payload: Record<string, unknown> };
    expect(storedBrief.payload).toMatchObject({
      objective: 'conversion',
      brandPolicySnapshot: {
        facts: [
          expect.objectContaining({
            text: '门店每日供应手冲咖啡',
            sourceReference: '门店菜单',
            approved: true,
          }),
        ],
        sourceDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      },
    });

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
    const storyboardVersionId = await insertStoryboardVersion(database, {
      projectId,
      scriptVersionId: latestScriptId,
      version: 1,
      status: 'approved',
    });
    const eligible = await request(app)
      .get(`/api/v1/projects/${projectId}/production-eligibility`)
      .set('cookie', 'videoagent_session=tenant-a-session');
    expect(eligible.status).toBe(200);
    expect(Object.keys(eligible.body)).toEqual([
      'projectId',
      'eligible',
      'scriptVersionId',
      'scriptVersion',
      'storyboardVersionId',
      'storyboardVersion',
      'reasonCode',
      'scriptApproval',
      'storyboardApproval',
    ]);
    expect(eligible.body).toMatchObject({
      projectId,
      eligible: true,
      scriptVersionId: latestScriptId,
      scriptVersion: 2,
      storyboardVersionId,
      storyboardVersion: 1,
      reasonCode: 'ELIGIBLE',
      scriptApproval: {
        scriptVersionId: latestScriptId,
        status: 'approved',
        factRiskStatus: 'cleared',
      },
      storyboardApproval: {
        storyboardVersionId,
        status: 'approved',
        factRiskStatus: 'cleared',
      },
    });
    expect(eligible.body).not.toHaveProperty('approval');

    const revoked = await request(app)
      .post(`/api/v1/projects/${projectId}/script-versions/${latestScriptId}/approvals`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'approval-2')
      .send({ status: 'revoked', factRiskStatus: 'cleared', reason: 'Brand requested changes' });
    expect(revoked.status).toBe(201);
    const ineligible = await request(app)
      .get(`/api/v1/projects/${projectId}/production-eligibility`)
      .set('cookie', 'videoagent_session=tenant-a-session');
    expect(ineligible.body).toMatchObject({
      eligible: false,
      reasonCode: 'SCRIPT_APPROVAL_REVOKED',
    });

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
    expect(briefs.body.briefVersions[1].payload).toEqual(browserBrief('conversion'));
    expect(JSON.stringify(briefs.body)).not.toMatch(/sourceDigest|brandPolicySnapshot|sha256:/u);
    expect(
      scripts.body.scriptVersions.map((version: { version: number }) => version.version),
    ).toEqual([1, 2]);
  });

  it('lets only the explicit trusted seed boundary persist and replay deterministic canonical Brief authority', async () => {
    const project = await request(app)
      .post('/api/v1/projects')
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'trusted-brief-project')
      .send({
        name: 'Trusted Brief Seed',
        status: 'draft',
        platform: 'douyin',
        aspectRatio: '9:16',
        targetDurationSeconds: 30,
      });
    expect(project.status).toBe(201);
    const projectId = project.body.id as string;
    const store = new PostgresContentStore(database);
    const idempotency = {
      operation: `brief.create:${projectId}`,
      key: 'trusted-canonical-brief-v1',
      payload: { payload: deterministicCanonicalBrief },
    };

    const created = await store.createCanonicalBriefVersionForTrustedSeed(
      trustedActor,
      projectId,
      deterministicCanonicalBrief,
      idempotency,
    );
    expect(created).toMatchObject({ replayed: false });
    expect(created?.value.payload).toEqual(deterministicCanonicalBrief);

    const replay = await store.createCanonicalBriefVersionForTrustedSeed(
      trustedActor,
      projectId,
      deterministicCanonicalBrief,
      idempotency,
    );
    expect(replay).toMatchObject({ replayed: true });
    expect(replay?.value).toEqual(created?.value);

    const stored = await database('control_plane.creative_briefs')
      .select('payload', 'payload_digest')
      .where({ project_id: projectId })
      .first();
    expect(stored?.payload).toEqual(deterministicCanonicalBrief);
    expect(stored?.payload_digest).toBe(payloadDigest(deterministicCanonicalBrief));
    const record = await database('control_plane.idempotency_records')
      .select('request_digest')
      .where({
        tenant_id: tenantA,
        operation: idempotency.operation,
        idempotency_key: idempotency.key,
      })
      .first();
    expect(record?.request_digest).toBe(payloadDigest(idempotency.payload));

    const browserRead = await request(app)
      .get(`/api/v1/projects/${projectId}/brief-versions`)
      .set('cookie', 'videoagent_session=tenant-a-session');
    expect(browserRead.status).toBe(200);
    expect(browserRead.body.briefVersions[0].payload).toEqual({
      objective: deterministicCanonicalBrief.objective,
      audience: deterministicCanonicalBrief.audience,
      platforms: deterministicCanonicalBrief.platforms,
      brandFacts: deterministicCanonicalBrief.brandPolicySnapshot.facts.map(
        ({ text, sourceReference }) => ({ text, sourceReference }),
      ),
      prohibitedTerms: deterministicCanonicalBrief.brandPolicySnapshot.prohibitedTerms,
      requiredDisclosures: deterministicCanonicalBrief.brandPolicySnapshot.requiredDisclosures,
      factsConfirmed: true,
    });
    expect(JSON.stringify(browserRead.body)).not.toMatch(
      /sourceDigest|brandPolicySnapshot|sha256:/u,
    );
  });

  it('uses only the latest script/storyboard authorities and fails closed without fallback', async () => {
    const project = await request(app)
      .post('/api/v1/projects')
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'dual-authority-project')
      .send({
        name: 'Dual Authority',
        status: 'draft',
        platform: 'douyin',
        aspectRatio: '9:16',
        targetDurationSeconds: 30,
      });
    expect(project.status).toBe(201);
    const projectId = project.body.id as string;

    const scriptV1 = await request(app)
      .post(`/api/v1/projects/${projectId}/script-versions`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'dual-authority-script-1')
      .send({ payload: { title: 'Approved script v1' } });
    expect(scriptV1.status).toBe(201);
    const scriptV1Id = scriptV1.body.id as string;
    expect(
      (
        await request(app)
          .post(`/api/v1/projects/${projectId}/script-versions/${scriptV1Id}/approvals`)
          .set('cookie', 'videoagent_session=tenant-a-session')
          .set('idempotency-key', 'dual-authority-script-approval-1')
          .send({ status: 'approved', factRiskStatus: 'cleared' })
      ).status,
    ).toBe(201);

    const withoutStoryboard = await request(app)
      .get(`/api/v1/projects/${projectId}/production-eligibility`)
      .set('cookie', 'videoagent_session=tenant-a-session');
    expect(withoutStoryboard.body).toMatchObject({
      eligible: false,
      storyboardVersionId: null,
      storyboardVersion: null,
      reasonCode: 'NO_STORYBOARD_VERSION',
      storyboardApproval: null,
    });

    await insertStoryboardVersion(database, {
      projectId,
      scriptVersionId: scriptV1Id,
      version: 1,
      status: 'approved',
    });
    const draftStoryboardId = await insertStoryboardVersion(database, {
      projectId,
      scriptVersionId: scriptV1Id,
      version: 2,
    });
    const latestDraft = await request(app)
      .get(`/api/v1/projects/${projectId}/production-eligibility`)
      .set('cookie', 'videoagent_session=tenant-a-session');
    expect(latestDraft.body).toMatchObject({
      eligible: false,
      storyboardVersionId: draftStoryboardId,
      storyboardVersion: 2,
      reasonCode: 'STORYBOARD_NOT_APPROVED',
      storyboardApproval: null,
    });

    const scriptV2 = await request(app)
      .post(`/api/v1/projects/${projectId}/script-versions`)
      .set('cookie', 'videoagent_session=tenant-a-session')
      .set('idempotency-key', 'dual-authority-script-2')
      .send({ payload: { title: 'Approved script v2' } });
    expect(scriptV2.status).toBe(201);
    const scriptV2Id = scriptV2.body.id as string;
    expect(
      (
        await request(app)
          .post(`/api/v1/projects/${projectId}/script-versions/${scriptV2Id}/approvals`)
          .set('cookie', 'videoagent_session=tenant-a-session')
          .set('idempotency-key', 'dual-authority-script-approval-2')
          .send({ status: 'approved', factRiskStatus: 'cleared' })
      ).status,
    ).toBe(201);
    const mismatchedStoryboardId = await insertStoryboardVersion(database, {
      projectId,
      scriptVersionId: scriptV1Id,
      version: 3,
      status: 'approved',
    });
    const bindingMismatch = await request(app)
      .get(`/api/v1/projects/${projectId}/production-eligibility`)
      .set('cookie', 'videoagent_session=tenant-a-session');
    expect(bindingMismatch.body).toMatchObject({
      eligible: false,
      scriptVersionId: scriptV2Id,
      storyboardVersionId: mismatchedStoryboardId,
      reasonCode: 'SCRIPT_STORYBOARD_BINDING_MISMATCH',
    });

    const revokedStoryboardId = await insertStoryboardVersion(database, {
      projectId,
      scriptVersionId: scriptV2Id,
      version: 4,
      status: 'approved',
    });
    await appendStoryboardApproval(database, projectId, revokedStoryboardId, {
      status: 'revoked',
      factRiskStatus: 'cleared',
      projectStatus: 'revoked',
    });
    expect(
      (
        await request(app)
          .get(`/api/v1/projects/${projectId}/production-eligibility`)
          .set('cookie', 'videoagent_session=tenant-a-session')
      ).body,
    ).toMatchObject({
      storyboardVersionId: revokedStoryboardId,
      reasonCode: 'STORYBOARD_APPROVAL_REVOKED',
    });

    const blockedStoryboardId = await insertStoryboardVersion(database, {
      projectId,
      scriptVersionId: scriptV2Id,
      version: 5,
      status: 'approved',
    });
    await appendStoryboardApproval(database, projectId, blockedStoryboardId, {
      status: 'blocked',
      factRiskStatus: 'cleared',
      projectStatus: 'draft',
    });
    expect(
      (
        await request(app)
          .get(`/api/v1/projects/${projectId}/production-eligibility`)
          .set('cookie', 'videoagent_session=tenant-a-session')
      ).body,
    ).toMatchObject({
      storyboardVersionId: blockedStoryboardId,
      reasonCode: 'STORYBOARD_BLOCKED',
    });

    const unresolvedStoryboardId = await insertStoryboardVersion(database, {
      projectId,
      scriptVersionId: scriptV2Id,
      version: 6,
      status: 'approved',
    });
    await appendStoryboardApproval(database, projectId, unresolvedStoryboardId, {
      status: 'approved',
      factRiskStatus: 'unresolved',
    });
    expect(
      (
        await request(app)
          .get(`/api/v1/projects/${projectId}/production-eligibility`)
          .set('cookie', 'videoagent_session=tenant-a-session')
      ).body,
    ).toMatchObject({
      storyboardVersionId: unresolvedStoryboardId,
      reasonCode: 'STORYBOARD_FACT_RISK_UNRESOLVED',
    });
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
