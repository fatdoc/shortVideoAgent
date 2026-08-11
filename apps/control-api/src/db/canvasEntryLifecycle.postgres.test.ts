import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from './migrations/001_pilot_core.js';
import { up as addContentTenantIntegrity } from './migrations/003_content_tenant_integrity.js';
import { up as addProductionPackageGrant } from './migrations/004_production_package_grant.js';
import {
  down as removeCanvasEntryLifecycle,
  up as addCanvasEntryLifecycle,
} from './migrations/021_canvas_entries.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const tenantId = '21000000-0000-4000-8000-000000000001';
const otherTenantId = '21000000-0000-4000-8000-000000000002';
const userId = '21000000-0000-4000-8000-000000000003';
const projectId = '21000000-0000-4000-8000-000000000004';
const scriptVersionId = '21000000-0000-4000-8000-000000000005';
const packageId = '21000000-0000-4000-8000-000000000006';
const grantId = '21000000-0000-4000-8000-000000000007';
const canvasEntryId = '21000000-0000-4000-8000-000000000008';
const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;
const issuedAt = '2026-08-11T01:00:00.000Z';
const expiresAt = '2026-08-11T01:02:00.000Z';

async function resetFoundation(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);
  await addContentTenantIntegrity(database);
  await addProductionPackageGrant(database);

  await database('control_plane.tenants').insert([
    { tenant_id: tenantId, display_name: 'Canvas Entry Tenant', status: 'active' },
    { tenant_id: otherTenantId, display_name: 'Other Tenant', status: 'active' },
  ]);
  await database('control_plane.users').insert({
    user_id: userId,
    email: 'canvas-entry@example.com',
    display_name: 'Canvas Entry Operator',
    password_hash: 'unused',
    status: 'active',
  });
  await database('control_plane.projects').insert({
    project_id: projectId,
    tenant_id: tenantId,
    name: 'Canvas Entry Project',
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
    payload_digest: digestA,
    created_by: userId,
  });
  await database('control_plane.production_packages').insert({
    package_id: packageId,
    tenant_id: tenantId,
    project_id: projectId,
    contract_version: '0.2',
    idempotency_key: 'package-001',
    package_digest: digestB,
    snapshot: { approvedScript: { scriptVersionId } },
    status: 'ready',
    valid_from: issuedAt,
    expires_at: '2026-08-11T01:15:00.000Z',
    package_version: 1,
    organization_id: tenantId,
    approved_script_version_id: scriptVersionId,
    created_by: userId,
  });
  await database('control_plane.project_grants').insert({
    grant_id: grantId,
    tenant_id: tenantId,
    project_id: projectId,
    package_id: packageId,
    token_digest: digestA,
    capabilities: JSON.stringify(['image.generate']),
    status: 'active',
    issued_at: issuedAt,
    expires_at: '2026-08-11T01:10:00.000Z',
    contract_version: '0.2',
    idempotency_key: 'grant-001',
    payload_digest: digestB,
    scopes: JSON.stringify(['production.package.read']),
    key_id: 'test-key',
    nonce: 'test-nonce',
    created_by: userId,
  });
}

function canvasEntryRow(overrides: Record<string, unknown> = {}) {
  return {
    canvas_entry_id: canvasEntryId,
    handle: `ce_${'a'.repeat(32)}`,
    tenant_id: tenantId,
    project_id: projectId,
    package_id: packageId,
    grant_id: grantId,
    idempotency_key: 'canvas-entry-001',
    request_digest: digestA,
    state: 'active',
    issued_at: issuedAt,
    expires_at: expiresAt,
    consumed_at: null,
    created_by: userId,
    ...overrides,
  };
}

describe.runIf(hasDedicatedTestDatabase)('canvas entry lifecycle migration', () => {
  let database: Knex;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await resetFoundation(database);
    await addCanvasEntryLifecycle(database);
  });

  afterAll(async () => {
    await database?.raw('drop schema if exists control_plane cascade');
    await database?.destroy();
  });

  it('stores only an opaque non-secret handle with exact tenant/project/package/grant binding', async () => {
    await database('control_plane.canvas_entries').insert(canvasEntryRow());

    const columns = await database('information_schema.columns')
      .select('column_name')
      .where({ table_schema: 'control_plane', table_name: 'canvas_entries' });
    const columnNames = columns.map(({ column_name }) => column_name);
    expect(columnNames).toContain('handle');
    expect(columnNames).not.toEqual(
      expect.arrayContaining([
        'access_token',
        'raw_grant',
        'provider_payload',
        'provider_request',
        'provider_response',
        'token_digest',
      ]),
    );

    await expect(
      database('control_plane.canvas_entries').insert(
        canvasEntryRow({
          canvas_entry_id: '21000000-0000-4000-8000-000000000009',
          handle: `ce_${'b'.repeat(32)}`,
          tenant_id: otherTenantId,
          idempotency_key: 'canvas-entry-cross-scope',
          request_digest: digestB,
        }),
      ),
    ).rejects.toThrow(/foreign key|constraint/i);
  });

  it('enforces the opaque handle, request digest, project-scoped idempotency, and frozen TTL boundary', async () => {
    await database('control_plane.canvas_entries').insert(canvasEntryRow());

    const idempotencyConstraint = await database.raw<{ rows: Array<{ definition: string }> }>(
      `select pg_get_constraintdef(oid) as definition
       from pg_constraint
       where conname = 'canvas_entries_project_idempotency_uq'`,
    );
    expect(idempotencyConstraint.rows[0]?.definition).toBe(
      'UNIQUE (tenant_id, project_id, idempotency_key)',
    );

    await expect(
      database('control_plane.canvas_entries').insert(
        canvasEntryRow({
          canvas_entry_id: '21000000-0000-4000-8000-000000000010',
          handle: 'not-an-entry-handle',
          idempotency_key: 'canvas-entry-invalid-handle',
          request_digest: digestB,
        }),
      ),
    ).rejects.toThrow(/constraint/i);

    await expect(
      database('control_plane.canvas_entries').insert(
        canvasEntryRow({
          canvas_entry_id: '21000000-0000-4000-8000-000000000011',
          handle: `ce_${'c'.repeat(32)}`,
          idempotency_key: 'canvas-entry-long-ttl',
          request_digest: digestB,
          expires_at: '2026-08-11T01:05:01.000Z',
        }),
      ),
    ).rejects.toThrow(/constraint/i);

    await expect(
      database('control_plane.canvas_entries').insert(
        canvasEntryRow({
          canvas_entry_id: '21000000-0000-4000-8000-000000000013',
          handle: `ce_${'e'.repeat(32)}`,
          idempotency_key: 'canvas-entry-short-ttl',
          request_digest: digestB,
          expires_at: '2026-08-11T01:00:29.000Z',
        }),
      ),
    ).rejects.toThrow(/constraint/i);

    await expect(
      database('control_plane.canvas_entries').insert(
        canvasEntryRow({
          canvas_entry_id: '21000000-0000-4000-8000-000000000012',
          handle: `ce_${'d'.repeat(32)}`,
          request_digest: digestB,
        }),
      ),
    ).rejects.toThrow(/unique|constraint/i);
  });

  it('permits only active-to-consumed or active-to-expired lifecycle transitions', async () => {
    await database('control_plane.canvas_entries').insert(canvasEntryRow());

    await database('control_plane.canvas_entries')
      .where({ canvas_entry_id: canvasEntryId })
      .update({ state: 'consumed', consumed_at: '2026-08-11T01:00:30.000Z' });

    await expect(
      database('control_plane.canvas_entries')
        .where({ canvas_entry_id: canvasEntryId })
        .update({ state: 'active', consumed_at: null }),
    ).rejects.toThrow(/lifecycle|immutable/i);
    await expect(
      database('control_plane.canvas_entries')
        .where({ canvas_entry_id: canvasEntryId })
        .update({ package_id: '21000000-0000-4000-8000-000000000099' }),
    ).rejects.toThrow(/scope|immutable/i);
    await expect(
      database('control_plane.canvas_entries').where({ canvas_entry_id: canvasEntryId }).delete(),
    ).rejects.toThrow(/immutable/i);
  });

  it('allows empty rollback and blocks rollback after lifecycle evidence exists', async () => {
    await removeCanvasEntryLifecycle(database);
    expect(await database.schema.withSchema('control_plane').hasTable('canvas_entries')).toBe(
      false,
    );

    await addCanvasEntryLifecycle(database);
    await database('control_plane.canvas_entries').insert(canvasEntryRow());
    await expect(removeCanvasEntryLifecycle(database)).rejects.toThrow(/rollback blocked/i);
  });
});
