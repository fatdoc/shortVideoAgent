import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { SessionActor } from '../projects/types.js';
import { up as createPilotCore } from '../db/migrations/001_pilot_core.js';
import { up as addContentTenantIntegrity } from '../db/migrations/003_content_tenant_integrity.js';
import { up as addStoryboardAuthority } from '../db/migrations/020_storyboard_authority.js';
import { createStoryboardDraftRevision } from './contract.js';
import { PostgresStoryboardAuthorityStore } from './repository.js';
import { StoryboardAuthorityService } from './service.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const IDS = {
  tenantA: '10000000-0000-4000-8000-000000000001',
  tenantB: '20000000-0000-4000-8000-000000000001',
  userA: '10000000-0000-4000-8000-000000000002',
  userB: '20000000-0000-4000-8000-000000000002',
  membershipA: '10000000-0000-4000-8000-000000000003',
  membershipB: '20000000-0000-4000-8000-000000000003',
  projectA: '10000000-0000-4000-8000-000000000004',
  projectB: '20000000-0000-4000-8000-000000000004',
  scriptA: '10000000-0000-4000-8000-000000000005',
  scriptB: '20000000-0000-4000-8000-000000000005',
  scriptApprovalA: '10000000-0000-4000-8000-000000000006',
  scriptApprovalB: '20000000-0000-4000-8000-000000000006',
  draft1: '10000000-0000-4000-8000-000000000007',
  draft1Alternative: '10000000-0000-4000-8000-000000000008',
  draft2: '10000000-0000-4000-8000-000000000009',
  shot1: '10000000-0000-4000-8000-000000000010',
  shot1Alternative: '10000000-0000-4000-8000-000000000011',
  shot2: '10000000-0000-4000-8000-000000000012',
  command1: '10000000-0000-4000-8000-000000000013',
  command2: '10000000-0000-4000-8000-000000000014',
  receipt1: '10000000-0000-4000-8000-000000000015',
  receipt2: '10000000-0000-4000-8000-000000000016',
} as const;

const scriptDigestHex = 'a'.repeat(64);
const scriptDigest = `sha256:${scriptDigestHex}`;

function actor(tenantId: string, userId: string, membershipId: string): SessionActor {
  return {
    userId,
    membershipId,
    organizationId: tenantId,
    organizationType: 'TENANT',
    tenantId,
    membershipVersion: 1,
    primaryRole: 'tenant_admin',
    roles: ['tenant_admin'],
  };
}

const actorA = actor(IDS.tenantA, IDS.userA, IDS.membershipA);
const actorB = actor(IDS.tenantB, IDS.userB, IDS.membershipB);

function draft(input: {
  draftRevisionId?: string;
  revisionNumber?: number;
  previousRevisionId?: string | null;
  shotId?: string;
  commandId?: string;
  receiptId?: string;
  approvedScriptDigest?: string;
  description?: string;
}) {
  return createStoryboardDraftRevision({
    objectType: 'StoryboardDraftRevision',
    contractVersion: '0.2',
    status: 'draft',
    tenantId: IDS.tenantA,
    projectId: IDS.projectA,
    approvedScriptVersionId: IDS.scriptA,
    approvedScriptDigest: input.approvedScriptDigest ?? scriptDigest,
    draftRevisionId: input.draftRevisionId ?? IDS.draft1,
    revisionNumber: input.revisionNumber ?? 1,
    previousRevisionId: input.previousRevisionId ?? null,
    shots: [
      {
        shotId: input.shotId ?? IDS.shot1,
        sequence: 1,
        description: input.description ?? 'Opening controlled pilot shot.',
        durationSeconds: 5,
        sourceMode: 'mixed',
      },
    ],
    sourceReceipt: {
      providerId: 'openai',
      sourceSystem: 'storycanvas',
      sourceContractVersion: '0.2',
      commandId: input.commandId ?? IDS.command1,
      receiptId: input.receiptId ?? IDS.receipt1,
      receiptDigest: `sha256:${'b'.repeat(64)}`,
      receivedAt: '2026-08-11T03:00:00.000Z',
    },
    generationPolicy: { policyId: 'storyboard-draft-default', policyVersion: '1.0.0' },
    validationSummary: { status: 'passed', issueCodes: [] },
    createdAt: '2026-08-11T03:00:01.000Z',
  });
}

async function resetDatabase(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);
  await addContentTenantIntegrity(database);
  await addStoryboardAuthority(database);
  await database('control_plane.tenants').insert([
    { tenant_id: IDS.tenantA, display_name: 'Tenant A', status: 'active' },
    { tenant_id: IDS.tenantB, display_name: 'Tenant B', status: 'active' },
  ]);
  await database('control_plane.users').insert([
    {
      user_id: IDS.userA,
      email: 'storyboard-a@example.com',
      display_name: 'Storyboard A',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: IDS.userB,
      email: 'storyboard-b@example.com',
      display_name: 'Storyboard B',
      password_hash: 'unused',
      status: 'active',
    },
  ]);
  await database('control_plane.projects').insert([
    {
      project_id: IDS.projectA,
      tenant_id: IDS.tenantA,
      name: 'Storyboard Project A',
      status: 'active',
      platform: 'douyin',
      aspect_ratio: '9:16',
      target_duration_seconds: 30,
      created_by: IDS.userA,
    },
    {
      project_id: IDS.projectB,
      tenant_id: IDS.tenantB,
      name: 'Storyboard Project B',
      status: 'active',
      platform: 'douyin',
      aspect_ratio: '9:16',
      target_duration_seconds: 30,
      created_by: IDS.userB,
    },
  ]);
  await database('control_plane.script_versions').insert([
    {
      script_version_id: IDS.scriptA,
      tenant_id: IDS.tenantA,
      project_id: IDS.projectA,
      version: 1,
      status: 'approved',
      payload: { title: 'Approved Script A' },
      payload_digest: scriptDigestHex,
      created_by: IDS.userA,
    },
    {
      script_version_id: IDS.scriptB,
      tenant_id: IDS.tenantB,
      project_id: IDS.projectB,
      version: 1,
      status: 'approved',
      payload: { title: 'Approved Script B' },
      payload_digest: scriptDigestHex,
      created_by: IDS.userB,
    },
  ]);
  await database('control_plane.script_approvals').insert([
    {
      approval_id: IDS.scriptApprovalA,
      tenant_id: IDS.tenantA,
      project_id: IDS.projectA,
      script_version_id: IDS.scriptA,
      status: 'approved',
      fact_risk_status: 'cleared',
      reason: 'Script approved for controlled pilot.',
      acted_by: IDS.userA,
    },
    {
      approval_id: IDS.scriptApprovalB,
      tenant_id: IDS.tenantB,
      project_id: IDS.projectB,
      script_version_id: IDS.scriptB,
      status: 'approved',
      fact_risk_status: 'cleared',
      reason: 'Script approved for controlled pilot.',
      acted_by: IDS.userB,
    },
  ]);
}

describe.runIf(hasDedicatedTestDatabase)(
  'Storyboard Authority PostgreSQL repository/service',
  () => {
    let database: Knex;
    let service: StoryboardAuthorityService;

    beforeEach(async () => {
      database ??= knex({ client: 'pg', connection: databaseUrl });
      await resetDatabase(database);
      service = new StoryboardAuthorityService(
        new PostgresStoryboardAuthorityStore(database, () => new Date('2026-08-11T03:00:10.000Z')),
      );
    });

    afterAll(async () => {
      await database?.raw('drop schema if exists control_plane cascade');
      await database?.destroy();
    });

    it('creates/lists an immutable authority version from a strictly parsed approved Script draft', async () => {
      const sourceDraft = draft({});
      const created = await service.createVersion(actorA, IDS.projectA, {
        draft: sourceDraft,
        idempotencyKey: 'storyboard-create-001',
      });

      expect(created.replayed).toBe(false);
      expect(created.value).toMatchObject({
        tenantId: IDS.tenantA,
        projectId: IDS.projectA,
        scriptVersionId: IDS.scriptA,
        version: 1,
        status: 'draft',
        draft: sourceDraft,
      });
      await expect(service.listVersions(actorA, IDS.projectA)).resolves.toEqual([created.value]);

      await expect(
        database('control_plane.storyboard_versions')
          .where({ storyboard_version_id: created.value.id })
          .update({ provenance: { sourceReceipt: { receiptId: 'rewritten' } } }),
      ).rejects.toThrow(/immutable/i);
    });

    it('requires exact Script digest and the latest append-only Script approval to remain approved/cleared', async () => {
      await expect(
        service.createVersion(actorA, IDS.projectA, {
          draft: draft({ approvedScriptDigest: `sha256:${'c'.repeat(64)}` }),
          idempotencyKey: 'storyboard-digest-mismatch',
        }),
      ).rejects.toMatchObject({ code: 'STORYBOARD_SCRIPT_DIGEST_MISMATCH', status: 409 });

      await database('control_plane.script_approvals').insert({
        approval_id: '10000000-0000-4000-8000-000000000017',
        tenant_id: IDS.tenantA,
        project_id: IDS.projectA,
        script_version_id: IDS.scriptA,
        status: 'blocked',
        fact_risk_status: 'unresolved',
        reason: 'New fact risk.',
        acted_by: IDS.userA,
      });
      await expect(
        service.createVersion(actorA, IDS.projectA, {
          draft: draft({}),
          idempotencyKey: 'storyboard-script-blocked',
        }),
      ).rejects.toMatchObject({ code: 'STORYBOARD_SCRIPT_NOT_APPROVED', status: 409 });

      await expect(
        database('control_plane.storyboard_versions').count('* as count').first(),
      ).resolves.toMatchObject({ count: '0' });
    });

    it('serializes concurrent first revisions so only one project version wins', async () => {
      const first = draft({});
      const competing = draft({
        draftRevisionId: IDS.draft1Alternative,
        shotId: IDS.shot1Alternative,
        commandId: IDS.command2,
        receiptId: IDS.receipt2,
        description: 'Competing first revision.',
      });
      const results = await Promise.allSettled([
        service.createVersion(actorA, IDS.projectA, {
          draft: first,
          idempotencyKey: 'storyboard-concurrent-a',
        }),
        service.createVersion(actorA, IDS.projectA, {
          draft: competing,
          idempotencyKey: 'storyboard-concurrent-b',
        }),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((result) => result.status === 'rejected');
      expect(rejected).toMatchObject({
        status: 'rejected',
        reason: expect.objectContaining({ code: 'STORYBOARD_STALE_REVISION', status: 409 }),
      });
      await expect(
        database('control_plane.storyboard_versions').select('version'),
      ).resolves.toEqual([{ version: 1 }]);
    });

    it('replays identical creates and rejects a reused idempotency key with changed provenance', async () => {
      const sourceDraft = draft({});
      const first = await service.createVersion(actorA, IDS.projectA, {
        draft: sourceDraft,
        idempotencyKey: 'storyboard-create-replay',
      });
      const replay = await service.createVersion(actorA, IDS.projectA, {
        draft: sourceDraft,
        idempotencyKey: 'storyboard-create-replay',
      });

      expect(replay).toEqual({ value: first.value, replayed: true });
      await expect(
        service.createVersion(actorA, IDS.projectA, {
          draft: draft({
            draftRevisionId: IDS.draft1Alternative,
            shotId: IDS.shot1Alternative,
            commandId: IDS.command2,
            receiptId: IDS.receipt2,
          }),
          idempotencyKey: 'storyboard-create-replay',
        }),
      ).rejects.toMatchObject({ code: 'STORYBOARD_IDEMPOTENCY_CONFLICT', status: 409 });
    });

    it('keeps Approval events append-only across blocked, approved, and revoked transitions', async () => {
      const created = await service.createVersion(actorA, IDS.projectA, {
        draft: draft({}),
        idempotencyKey: 'storyboard-create-for-approval',
      });
      const blocked = await service.createApproval(actorA, IDS.projectA, created.value.id, {
        expectedVersion: 1,
        status: 'blocked',
        factRiskStatus: 'unresolved',
        reason: 'Fact risk needs review.',
        idempotencyKey: 'storyboard-block-001',
      });
      const blockedReplay = await service.createApproval(actorA, IDS.projectA, created.value.id, {
        expectedVersion: 1,
        status: 'blocked',
        factRiskStatus: 'unresolved',
        reason: 'Fact risk needs review.',
        idempotencyKey: 'storyboard-block-001',
      });
      expect(blockedReplay).toEqual({ value: blocked.value, replayed: true });

      const approved = await service.createApproval(actorA, IDS.projectA, created.value.id, {
        expectedVersion: 1,
        status: 'approved',
        factRiskStatus: 'cleared',
        idempotencyKey: 'storyboard-approve-001',
      });
      await expect(
        service.createApproval(actorA, IDS.projectA, created.value.id, {
          expectedVersion: 1,
          status: 'blocked',
          factRiskStatus: 'unresolved',
          reason: 'Cannot downgrade an approval to blocked.',
          idempotencyKey: 'storyboard-block-after-approval',
        }),
      ).rejects.toMatchObject({ code: 'STORYBOARD_APPROVAL_STATE_INVALID', status: 409 });

      const revoked = await service.createApproval(actorA, IDS.projectA, created.value.id, {
        expectedVersion: 1,
        status: 'revoked',
        factRiskStatus: 'cleared',
        reason: 'Approval withdrawn by reviewer.',
        idempotencyKey: 'storyboard-revoke-001',
      });

      expect(
        (await service.listApprovals(actorA, IDS.projectA, created.value.id)).map(
          (event) => event.status,
        ),
      ).toEqual(['blocked', 'approved', 'revoked']);
      expect((await service.listVersions(actorA, IDS.projectA))[0]?.status).toBe('revoked');
      await expect(
        database('control_plane.storyboard_approvals')
          .where({ storyboard_approval_id: approved.value.id })
          .update({ reason: 'rewritten' }),
      ).rejects.toThrow(/append-only/i);
      await expect(
        service.createApproval(actorA, IDS.projectA, created.value.id, {
          expectedVersion: 1,
          status: 'approved',
          factRiskStatus: 'cleared',
          idempotencyKey: 'storyboard-approve-after-revoke',
        }),
      ).rejects.toMatchObject({ code: 'STORYBOARD_APPROVAL_STATE_INVALID', status: 409 });
      expect(revoked.value.sequence).toMatch(/^\d+$/);
    });

    it('rejects stale approval targets after a newer project version exists', async () => {
      const first = await service.createVersion(actorA, IDS.projectA, {
        draft: draft({}),
        idempotencyKey: 'storyboard-create-v1',
      });
      await service.createVersion(actorA, IDS.projectA, {
        draft: draft({
          draftRevisionId: IDS.draft2,
          revisionNumber: 2,
          previousRevisionId: IDS.draft1,
          shotId: IDS.shot2,
          commandId: IDS.command2,
          receiptId: IDS.receipt2,
        }),
        idempotencyKey: 'storyboard-create-v2',
      });

      await expect(
        service.createApproval(actorA, IDS.projectA, first.value.id, {
          expectedVersion: 1,
          status: 'approved',
          factRiskStatus: 'cleared',
          idempotencyKey: 'storyboard-stale-approval',
        }),
      ).rejects.toMatchObject({ code: 'STORYBOARD_STALE_VERSION', status: 409 });
    });

    it('returns equivalent safe 404 responses for cross-tenant project/version access', async () => {
      const created = await service.createVersion(actorA, IDS.projectA, {
        draft: draft({}),
        idempotencyKey: 'storyboard-create-cross-scope',
      });

      await expect(service.listVersions(actorB, IDS.projectA)).rejects.toMatchObject({
        code: 'STORYBOARD_NOT_FOUND',
        status: 404,
      });
      await expect(
        service.listApprovals(actorB, IDS.projectA, created.value.id),
      ).rejects.toMatchObject({ code: 'STORYBOARD_NOT_FOUND', status: 404 });
      await expect(
        service.createApproval(actorB, IDS.projectA, created.value.id, {
          expectedVersion: 1,
          status: 'approved',
          factRiskStatus: 'cleared',
          idempotencyKey: 'storyboard-cross-scope-approval',
        }),
      ).rejects.toMatchObject({ code: 'STORYBOARD_NOT_FOUND', status: 404 });
    });
  },
);
