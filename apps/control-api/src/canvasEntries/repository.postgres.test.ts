import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresCanvasEntryRepository } from './repository.js';
import type { CreateCanvasEntryRecord } from './types.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);
const tenantId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const packageId = '33333333-3333-4333-8333-333333333333';
const grantId = '44444444-4444-4444-8444-444444444444';
const userId = '55555555-5555-4555-8555-555555555555';
const entryId = '66666666-6666-4666-8666-666666666666';
const handleA = `ce_${'A'.repeat(32)}`;
const handleB = `ce_${'B'.repeat(32)}`;
const issuedAt = new Date('2026-08-11T03:00:00.000Z');
const expiresAt = new Date('2026-08-11T03:02:00.000Z');

function record(overrides: Partial<CreateCanvasEntryRecord> = {}): CreateCanvasEntryRecord {
  return {
    tenantId,
    projectId,
    packageId,
    handle: handleA,
    idempotencyKey: 'canvas-entry-create-1',
    requestDigest: `sha256:${'a'.repeat(64)}`,
    issuedAt,
    expiresAt,
    createdBy: userId,
    ...overrides,
  };
}

async function createTestSchema(database: Knex): Promise<void> {
  await database.raw(`
    drop schema if exists control_plane cascade;
    create schema control_plane;

    create table control_plane.production_packages (
      package_id uuid primary key,
      tenant_id uuid not null,
      project_id uuid not null,
      valid_from timestamptz not null,
      expires_at timestamptz not null,
      unique (package_id, project_id, tenant_id)
    );

    create table control_plane.project_grants (
      grant_id uuid primary key,
      tenant_id uuid not null,
      project_id uuid not null,
      package_id uuid not null,
      token_digest text not null,
      status text not null check (status in ('active', 'revoked', 'expired')),
      revoked_at timestamptz,
      issued_at timestamptz not null,
      expires_at timestamptz not null,
      unique (grant_id, project_id, tenant_id)
    );

    create table control_plane.canvas_entries (
      canvas_entry_id uuid primary key,
      handle text not null unique,
      tenant_id uuid not null,
      project_id uuid not null,
      package_id uuid not null,
      grant_id uuid not null,
      idempotency_key text not null,
      request_digest text not null,
      state text not null check (state in ('active', 'consumed', 'expired')),
      issued_at timestamptz not null,
      expires_at timestamptz not null,
      consumed_at timestamptz,
      created_by uuid not null,
      unique (tenant_id, project_id, idempotency_key)
    );
  `);
}

describe('PostgresCanvasEntryRepository validation', () => {
  it('rejects request digests outside the migration 021 sha256-prefixed format before database access', async () => {
    const repository = new PostgresCanvasEntryRepository({} as Knex, () => entryId);

    await expect(repository.createEntry(record({ requestDigest: 'a'.repeat(64) }))).rejects.toEqual(
      expect.objectContaining({ code: 'CANVAS_ENTRY_SCHEMA_INVALID', status: 422 }),
    );
  });
});

async function seedActiveBinding(database: Knex): Promise<void> {
  await database('control_plane.production_packages').insert({
    package_id: packageId,
    tenant_id: tenantId,
    project_id: projectId,
    valid_from: new Date('2026-08-11T02:00:00.000Z'),
    expires_at: new Date('2026-08-11T04:00:00.000Z'),
  });
  await database('control_plane.project_grants').insert({
    grant_id: grantId,
    tenant_id: tenantId,
    project_id: projectId,
    package_id: packageId,
    token_digest: `sha256:${'f'.repeat(64)}`,
    status: 'active',
    revoked_at: null,
    issued_at: new Date('2026-08-11T02:50:00.000Z'),
    expires_at: new Date('2026-08-11T03:10:00.000Z'),
  });
}

describe.runIf(hasDedicatedTestDatabase)('PostgresCanvasEntryRepository', () => {
  let database: Knex;
  let repository: PostgresCanvasEntryRepository;

  beforeAll(async () => {
    database = knex({ client: 'pg', connection: databaseUrl });
  });

  beforeEach(async () => {
    await createTestSchema(database);
    await seedActiveBinding(database);
    repository = new PostgresCanvasEntryRepository(database, () => entryId);
  });

  afterAll(async () => {
    if (!database) return;
    await database.raw('drop schema if exists control_plane cascade');
    await database.destroy();
  });

  it('persists the opaque non-secret handle and immutable binding without secret-bearing columns', async () => {
    await expect(repository.createEntry(record())).resolves.toEqual({
      replayed: false,
      value: {
        objectType: 'CanvasEntry',
        contractVersion: '0.2',
        handle: handleA,
        tenantId,
        projectId,
        packageId,
        state: 'active',
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    });

    const row = await database('control_plane.canvas_entries').first();
    expect(row).toMatchObject({
      canvas_entry_id: entryId,
      handle: handleA,
      tenant_id: tenantId,
      project_id: projectId,
      package_id: packageId,
      grant_id: grantId,
      request_digest: `sha256:${'a'.repeat(64)}`,
      state: 'active',
      created_by: userId,
    });
    expect(Object.keys(row)).not.toEqual(
      expect.arrayContaining([
        'access_token',
        'token_digest',
        'raw_grant',
        'authorization',
        'provider_payload',
      ]),
    );
    expect(JSON.stringify(row)).not.toContain(`sha256:${'f'.repeat(64)}`);
  });

  it('replays the same tenant/project/idempotency request across repository instances with the original handle', async () => {
    const first = await repository.createEntry(record());
    const secondRepository = new PostgresCanvasEntryRepository(
      database,
      () => '77777777-7777-4777-8777-777777777777',
    );
    const replay = await secondRepository.createEntry(
      record({
        handle: handleB,
        issuedAt: new Date('2026-08-11T03:00:10.000Z'),
        expiresAt: new Date('2026-08-11T03:02:10.000Z'),
      }),
    );

    expect(replay).toEqual({ value: first.value, replayed: true });
    await expect(
      database('control_plane.canvas_entries').count('* as count').first(),
    ).resolves.toMatchObject({
      count: '1',
    });
  });

  it('rejects conflicting immutable facts under the same scoped idempotency key', async () => {
    await repository.createEntry(record());

    await expect(
      repository.createEntry(
        record({ requestDigest: `sha256:${'b'.repeat(64)}`, handle: handleB }),
      ),
    ).rejects.toEqual(
      expect.objectContaining({ code: 'CANVAS_ENTRY_IDEMPOTENCY_CONFLICT', status: 409 }),
    );
  });

  it('fails closed unless exactly one active Package/Grant binding covers the whole Entry lifetime', async () => {
    await expect(
      repository.createEntry(record({ packageId: '33333333-3333-4333-9333-333333333333' })),
    ).rejects.toEqual(expect.objectContaining({ code: 'CANVAS_ENTRY_NOT_FOUND', status: 404 }));

    await database('control_plane.project_grants').insert({
      grant_id: '44444444-4444-4444-9444-444444444444',
      tenant_id: tenantId,
      project_id: projectId,
      package_id: packageId,
      token_digest: `sha256:${'e'.repeat(64)}`,
      status: 'active',
      revoked_at: null,
      issued_at: new Date('2026-08-11T02:55:00.000Z'),
      expires_at: new Date('2026-08-11T03:10:00.000Z'),
    });
    await expect(repository.createEntry(record())).rejects.toEqual(
      expect.objectContaining({ code: 'CANVAS_ENTRY_NOT_FOUND', status: 404 }),
    );
    await database('control_plane.project_grants')
      .where({ grant_id: '44444444-4444-4444-9444-444444444444' })
      .delete();

    await database('control_plane.project_grants').where({ grant_id: grantId }).update({
      status: 'revoked',
      revoked_at: issuedAt,
    });
    await expect(repository.createEntry(record())).rejects.toEqual(
      expect.objectContaining({ code: 'CANVAS_ENTRY_NOT_FOUND', status: 404 }),
    );
  });

  it('atomically consumes once and returns only server-side binding plus Grant id', async () => {
    await repository.createEntry(record());

    await expect(
      repository.consumeEntry({
        handle: handleA,
        tenantId,
        projectId,
        packageId,
        consumedAt: issuedAt,
      }),
    ).resolves.toEqual({
      handle: handleA,
      tenantId,
      projectId,
      packageId,
      grantId,
      consumedAt: issuedAt.toISOString(),
    });
    await expect(
      repository.consumeEntry({
        handle: handleA,
        tenantId,
        projectId,
        packageId,
        consumedAt: issuedAt,
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'CANVAS_ENTRY_REPLAYED', status: 409 }));
  });

  it('makes wrong scope indistinguishable from an unknown handle and leaves the Entry active', async () => {
    await repository.createEntry(record());

    await expect(
      repository.consumeEntry({
        handle: handleA,
        tenantId,
        projectId: '22222222-2222-4222-9222-222222222222',
        packageId,
        consumedAt: issuedAt,
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'CANVAS_ENTRY_NOT_FOUND', status: 404 }));
    await expect(
      database('control_plane.canvas_entries').where({ handle: handleA }).first(),
    ).resolves.toMatchObject({ state: 'active', consumed_at: null });
  });

  it('transitions an expired Entry or inactive Grant to expired and returns 410', async () => {
    await repository.createEntry(record({ expiresAt: new Date('2026-08-11T03:00:30.000Z') }));
    const boundary = new Date('2026-08-11T03:00:30.000Z');

    await expect(
      repository.consumeEntry({
        handle: handleA,
        tenantId,
        projectId,
        packageId,
        consumedAt: boundary,
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'CANVAS_ENTRY_EXPIRED', status: 410 }));
    await expect(
      database('control_plane.canvas_entries').where({ handle: handleA }).first(),
    ).resolves.toMatchObject({ state: 'expired', consumed_at: null });

    await database('control_plane.canvas_entries').delete();
    await database('control_plane.project_grants').where({ grant_id: grantId }).update({
      status: 'active',
      revoked_at: null,
    });
    await repository.createEntry(
      record({ handle: handleB, idempotencyKey: 'canvas-entry-create-2' }),
    );
    await database('control_plane.project_grants').where({ grant_id: grantId }).update({
      status: 'revoked',
      revoked_at: issuedAt,
    });
    await expect(
      repository.consumeEntry({
        handle: handleB,
        tenantId,
        projectId,
        packageId,
        consumedAt: issuedAt,
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'CANVAS_ENTRY_EXPIRED', status: 410 }));
  });

  it('serializes concurrent consume attempts into one success and one replay', async () => {
    await repository.createEntry(record());
    const command = { handle: handleA, tenantId, projectId, packageId, consumedAt: issuedAt };
    const results = await Promise.allSettled([
      repository.consumeEntry(command),
      repository.consumeEntry(command),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: expect.objectContaining({ code: 'CANVAS_ENTRY_REPLAYED', status: 409 }),
    });
  });
});
