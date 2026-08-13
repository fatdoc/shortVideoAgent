import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as addCanvasAssetSessionAuthority } from '../db/migrations/026_canvas_asset_session_authority.js';
import { PostgresCanvasAssetSessionAuthorityRepository } from './sessionRepository.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);
const tenantId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const packageId = '33333333-3333-4333-8333-333333333333';
const grantId = '44444444-4444-4444-8444-444444444444';
const actorId = '12121212-1212-4212-8212-121212121212';
const canvasEntryId = '77777777-7777-4777-8777-777777777777';
const handle = `ce_${'A'.repeat(32)}`;
const canvasSessionId = 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678';
const registeredAt = new Date('2026-08-14T02:00:00.000Z');
const packageExpiresAt = new Date('2026-08-14T02:10:00.000Z');
const grantExpiresAt = new Date('2026-08-14T02:05:00.000Z');

async function createSchema(database: Knex): Promise<void> {
  await database.raw(`
    drop schema if exists control_plane cascade;
    create schema control_plane;
    create table control_plane.tenants (tenant_id uuid primary key);
    create table control_plane.users (user_id uuid primary key);
    create table control_plane.projects (
      project_id uuid primary key,
      tenant_id uuid not null,
      unique (project_id, tenant_id)
    );
    create table control_plane.production_packages (
      package_id uuid primary key,
      project_id uuid not null,
      tenant_id uuid not null,
      status text not null,
      valid_from timestamptz not null,
      expires_at timestamptz not null,
      unique (package_id, project_id, tenant_id)
    );
    create table control_plane.project_grants (
      grant_id uuid primary key,
      package_id uuid not null,
      project_id uuid not null,
      tenant_id uuid not null,
      status text not null,
      revoked_at timestamptz,
      issued_at timestamptz not null,
      expires_at timestamptz not null,
      unique (grant_id, package_id, project_id, tenant_id)
    );
    create table control_plane.canvas_entries (
      canvas_entry_id uuid primary key,
      handle text not null unique,
      tenant_id uuid not null,
      project_id uuid not null,
      package_id uuid not null,
      grant_id uuid not null,
      state text not null,
      consumed_at timestamptz,
      expires_at timestamptz not null
    );
    create table control_plane.canvas_asset_records (
      asset_id uuid primary key,
      tenant_id uuid not null,
      project_id uuid not null,
      package_id uuid not null,
      canvas_session_id text not null,
      declared_by_actor_id uuid not null
    );
    create table control_plane.high_cost_command_approvals (
      approval_id uuid primary key,
      tenant_id uuid not null,
      project_id uuid not null,
      package_id uuid not null,
      canvas_session_id text not null,
      actor_id uuid not null
    );
  `);
  await addCanvasAssetSessionAuthority(database);
  await database('control_plane.tenants').insert({ tenant_id: tenantId });
  await database('control_plane.users').insert({ user_id: actorId });
  await database('control_plane.projects').insert({ project_id: projectId, tenant_id: tenantId });
  await database('control_plane.production_packages').insert({
    package_id: packageId,
    project_id: projectId,
    tenant_id: tenantId,
    status: 'ready',
    valid_from: new Date('2026-08-14T01:00:00.000Z'),
    expires_at: packageExpiresAt,
  });
  await database('control_plane.project_grants').insert({
    grant_id: grantId,
    package_id: packageId,
    project_id: projectId,
    tenant_id: tenantId,
    status: 'active',
    revoked_at: null,
    issued_at: new Date('2026-08-14T01:30:00.000Z'),
    expires_at: grantExpiresAt,
  });
  await database('control_plane.canvas_entries').insert({
    canvas_entry_id: canvasEntryId,
    handle,
    tenant_id: tenantId,
    project_id: projectId,
    package_id: packageId,
    grant_id: grantId,
    state: 'consumed',
    consumed_at: new Date('2026-08-14T01:59:30.000Z'),
    expires_at: new Date('2026-08-14T02:00:30.000Z'),
  });
}

describe.skipIf(hasDedicatedTestDatabase)('Canvas asset session PostgreSQL environment', () => {
  it('is explicitly environment-blocked without a dedicated *_test database', () => {
    expect(hasDedicatedTestDatabase).toBe(false);
  });
});

describe.runIf(hasDedicatedTestDatabase)('PostgresCanvasAssetSessionAuthorityRepository', () => {
  let database: Knex;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await createSchema(database);
  });

  afterAll(async () => {
    if (!database) return;
    await database.raw('drop schema if exists control_plane cascade');
    await database.destroy();
  });

  function repository() {
    return new PostgresCanvasAssetSessionAuthorityRepository(database, async () => ({
      packageId,
      contractVersion: '0.3',
      status: 'ready',
      expiresAt: packageExpiresAt,
      capabilityRequirements: ['video.generate'],
      scriptVersionId: '55555555-5555-4555-8555-555555555555',
      storyboardVersionId: '66666666-6666-4666-8666-666666666666',
      approvedScriptDigest: `sha256:${'a'.repeat(64)}`,
      approvedStoryboardDigest: `sha256:${'b'.repeat(64)}`,
    }));
  }

  it('derives expiry only from active Package/Grant and preserves exact replay', async () => {
    const store = repository();
    const registration = {
      handle,
      tenantId,
      projectId,
      packageId,
      canvasSessionId,
      actorId,
      registeredAt,
    };
    const first = await store.registerSession(registration);
    expect(first).toMatchObject({ kind: 'created', value: { expiresAt: grantExpiresAt } });
    await expect(store.registerSession(registration)).resolves.toMatchObject({ kind: 'replayed' });
    await expect(
      store.registerSession({
        ...registration,
        actorId: '99999999-9999-4999-8999-999999999999',
      }),
    ).resolves.toEqual({ kind: 'conflict' });
  });

  it('fails closed when exact actor/scope or current Grant authority is absent', async () => {
    const store = repository();
    await store.registerSession({
      handle,
      tenantId,
      projectId,
      packageId,
      canvasSessionId,
      actorId,
      registeredAt,
    });
    await expect(
      store.readActiveSession({
        tenantId,
        projectId,
        packageId,
        canvasSessionId,
        actorId: '99999999-9999-4999-8999-999999999999',
        verifiedAt: registeredAt,
      }),
    ).resolves.toBeNull();
    await database('control_plane.project_grants').where({ grant_id: grantId }).update({
      status: 'revoked',
      revoked_at: registeredAt,
    });
    await expect(
      store.readActiveSession({
        tenantId,
        projectId,
        packageId,
        canvasSessionId,
        actorId,
        verifiedAt: registeredAt,
      }),
    ).resolves.toBeNull();
  });
});
