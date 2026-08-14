import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresCanvasAssetMaterializationRepository } from './materializationRepository.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const record = {
  materializationAttemptId: '90909090-9090-4090-8090-909090909090',
  materializationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tenantId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  packageId: '33333333-3333-4333-8333-333333333333',
  canvasSessionId: 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678',
  actorId: '12121212-1212-4212-8212-121212121212',
  assetId: '88888888-8888-4888-8888-888888888888',
  authorityChecksum: `sha256:${'a'.repeat(64)}`,
  mimeType: 'image/jpeg' as const,
  byteSize: 3,
  createdAt: new Date('2026-08-14T02:00:00.000Z'),
};

describe.skipIf(hasDedicatedTestDatabase)('Canvas materialization PostgreSQL environment', () => {
  it('is explicitly ENVIRONMENT_BLOCKED without a dedicated *_test database', () => {
    expect(hasDedicatedTestDatabase).toBe(false);
  });
});

describe.runIf(hasDedicatedTestDatabase)('PostgresCanvasAssetMaterializationRepository', () => {
  let database: Knex;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await database.raw(`
      drop schema if exists control_plane cascade;
      create schema control_plane;
      create table control_plane.canvas_asset_materialization_attempts (
        materialization_attempt_id uuid primary key,
        materialization_id uuid not null unique,
        tenant_id uuid not null,
        project_id uuid not null,
        package_id uuid not null,
        canvas_session_id text not null,
        actor_id uuid not null,
        asset_id uuid not null,
        authority_checksum text not null,
        mime_type text not null,
        byte_size integer not null,
        created_at timestamptz not null
      );
    `);
  });

  afterAll(async () => {
    if (!database) return;
    await database.raw('drop schema if exists control_plane cascade');
    await database.destroy();
  });

  it('persists same-attempt exact facts and conflicts on any changed scope or authority', async () => {
    const repository = new PostgresCanvasAssetMaterializationRepository(database);
    await expect(repository.createOrReplay(record)).resolves.toMatchObject({ kind: 'created' });
    await expect(repository.createOrReplay(record)).resolves.toMatchObject({ kind: 'replayed' });
    for (const changed of [
      { projectId: '30303030-3030-4030-8030-303030303030' },
      { assetId: '99999999-9999-4999-8999-999999999999' },
      { authorityChecksum: `sha256:${'b'.repeat(64)}` },
      { mimeType: 'image/png' as const },
      { byteSize: 4 },
    ]) {
      await expect(repository.createOrReplay({ ...record, ...changed })).resolves.toEqual({
        kind: 'conflict',
      });
    }
  });
});
