import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from './migrations/001_pilot_core.js';
import { up as addContentTenantIntegrity } from './migrations/003_content_tenant_integrity.js';
import {
  down as removeStoryboardAuthority,
  up as addStoryboardAuthority,
} from './migrations/020_storyboard_authority.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const tenantId = '20000000-0000-4000-8000-000000000001';
const otherTenantId = '20000000-0000-4000-8000-000000000002';
const userId = '20000000-0000-4000-8000-000000000003';
const projectId = '20000000-0000-4000-8000-000000000004';
const scriptVersionId = '20000000-0000-4000-8000-000000000005';
const storyboardVersionId = '20000000-0000-4000-8000-000000000006';
const approvalId = '20000000-0000-4000-8000-000000000007';
const digest = `sha256:${'a'.repeat(64)}`;
const otherDigest = `sha256:${'b'.repeat(64)}`;

async function resetFoundation(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);
  await addContentTenantIntegrity(database);
  await database('control_plane.tenants').insert([
    { tenant_id: tenantId, display_name: 'Storyboard Tenant', status: 'active' },
    { tenant_id: otherTenantId, display_name: 'Other Tenant', status: 'active' },
  ]);
  await database('control_plane.users').insert({
    user_id: userId,
    email: 'storyboard-authority@example.com',
    display_name: 'Storyboard Authority',
    password_hash: 'unused',
    status: 'active',
  });
  await database('control_plane.projects').insert({
    project_id: projectId,
    tenant_id: tenantId,
    name: 'Storyboard Project',
    status: 'active',
    platform: 'douyin',
    aspect_ratio: '9:16',
    target_duration_seconds: 30,
    created_by: userId,
  });
  await database('control_plane.script_versions').insert({
    script_version_id: scriptVersionId,
    tenant_id: tenantId,
    project_id: projectId,
    version: 1,
    status: 'approved',
    payload: { title: 'Approved Script' },
    payload_digest: digest,
    created_by: userId,
  });
}

function storyboardRow(overrides: Record<string, unknown> = {}) {
  return {
    storyboard_version_id: storyboardVersionId,
    tenant_id: tenantId,
    project_id: projectId,
    script_version_id: scriptVersionId,
    version: 1,
    status: 'draft',
    draft_revision_id: 'storyboard-revision-001',
    draft_revision_number: 1,
    previous_draft_revision_id: null,
    script_payload_digest: digest,
    payload: { shots: [{ shotId: 'shot-001', sequence: 1 }] },
    payload_digest: otherDigest,
    provenance: {
      sourceReceipt: {
        receiptId: 'receipt-001',
        receiptDigest: digest,
        receivedAt: '2026-08-11T00:00:00.000Z',
      },
    },
    created_by: userId,
    ...overrides,
  };
}

describe.runIf(hasDedicatedTestDatabase)('storyboard authority migration', () => {
  let database: Knex;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await resetFoundation(database);
    await addStoryboardAuthority(database);
  });

  afterAll(async () => {
    await database?.raw('drop schema if exists control_plane cascade');
    await database?.destroy();
  });

  it('creates tenant/project/script-bound storyboard versions with digest constraints', async () => {
    await database('control_plane.storyboard_versions').insert(storyboardRow());

    await expect(
      database('control_plane.storyboard_versions').insert(
        storyboardRow({
          storyboard_version_id: '20000000-0000-4000-8000-000000000008',
          version: 2,
          draft_revision_id: 'storyboard-revision-002',
          payload_digest: 'not-a-digest',
        }),
      ),
    ).rejects.toThrow(/digest|constraint/i);

    await expect(
      database('control_plane.storyboard_versions').insert(
        storyboardRow({
          storyboard_version_id: '20000000-0000-4000-8000-000000000009',
          tenant_id: otherTenantId,
          version: 2,
          draft_revision_id: 'storyboard-revision-003',
        }),
      ),
    ).rejects.toThrow(/foreign key|constraint/i);
  });

  it('keeps storyboard payload/scope immutable while allowing authority status projection', async () => {
    await database('control_plane.storyboard_versions').insert(storyboardRow());

    await expect(
      database('control_plane.storyboard_versions')
        .where({ storyboard_version_id: storyboardVersionId })
        .update({ payload: { shots: [] } }),
    ).rejects.toThrow(/immutable/i);

    await database('control_plane.storyboard_approvals').insert({
      storyboard_approval_id: approvalId,
      tenant_id: tenantId,
      project_id: projectId,
      storyboard_version_id: storyboardVersionId,
      status: 'approved',
      fact_risk_status: 'cleared',
      reason: 'Human approval',
      idempotency_key: 'storyboard-status-approve-001',
      event_digest: digest,
      acted_by: userId,
    });
    await database('control_plane.storyboard_versions')
      .where({ storyboard_version_id: storyboardVersionId })
      .update({ status: 'approved' });

    await expect(
      database('control_plane.storyboard_versions')
        .select('status')
        .where({ storyboard_version_id: storyboardVersionId })
        .first(),
    ).resolves.toEqual({ status: 'approved' });
  });

  it('stores append-only approval events with stable tenant idempotency', async () => {
    await database('control_plane.storyboard_versions').insert(storyboardRow());
    await database('control_plane.storyboard_approvals').insert({
      storyboard_approval_id: approvalId,
      tenant_id: tenantId,
      project_id: projectId,
      storyboard_version_id: storyboardVersionId,
      status: 'approved',
      fact_risk_status: 'cleared',
      reason: 'Human approval',
      idempotency_key: 'storyboard-approve-001',
      event_digest: digest,
      acted_by: userId,
    });

    await expect(
      database('control_plane.storyboard_approvals')
        .where({ storyboard_approval_id: approvalId })
        .update({ reason: 'rewritten' }),
    ).rejects.toThrow(/append-only/i);
    await expect(
      database('control_plane.storyboard_approvals')
        .where({ storyboard_approval_id: approvalId })
        .delete(),
    ).rejects.toThrow(/append-only/i);
    await expect(
      database('control_plane.storyboard_approvals').insert({
        storyboard_approval_id: '20000000-0000-4000-8000-000000000010',
        tenant_id: tenantId,
        project_id: projectId,
        storyboard_version_id: storyboardVersionId,
        status: 'approved',
        fact_risk_status: 'cleared',
        reason: 'Replay with conflicting identity',
        idempotency_key: 'storyboard-approve-001',
        event_digest: otherDigest,
        acted_by: userId,
      }),
    ).rejects.toThrow(/unique|constraint/i);
  });

  it('allows empty rollback and blocks rollback once authority evidence exists', async () => {
    await removeStoryboardAuthority(database);
    expect(await database.schema.withSchema('control_plane').hasTable('storyboard_versions')).toBe(
      false,
    );

    await addStoryboardAuthority(database);
    await database('control_plane.storyboard_versions').insert(storyboardRow());
    await expect(removeStoryboardAuthority(database)).rejects.toThrow(/rollback blocked/i);
  });
});
