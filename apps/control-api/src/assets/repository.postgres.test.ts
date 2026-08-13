import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as addCanvasAssetAuthority } from '../db/migrations/025_canvas_asset_authority.js';
import { PostgresCanvasAssetAuthorityRepository } from './repository.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);
const tenantId = '11111111-1111-4111-8111-111111111111';
const otherTenantId = '10101010-1010-4010-8010-101010101010';
const projectId = '22222222-2222-4222-8222-222222222222';
const otherProjectId = '20202020-2020-4020-8020-202020202020';
const packageId = '33333333-3333-4333-8333-333333333333';
const otherPackageId = '30303030-3030-4030-8030-303030303030';
const actorId = '12121212-1212-4212-8212-121212121212';
const assetId = '88888888-8888-4888-8888-888888888888';
const approvalId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const commandId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const canvasSessionId = 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678';
const confirmedAt = new Date('2026-08-14T02:00:00.000Z');

async function createTestSchema(database: Knex): Promise<void> {
  await database.raw(`
    drop schema if exists control_plane cascade;
    create schema control_plane;
    create table control_plane.tenants (tenant_id uuid primary key);
    create table control_plane.users (user_id uuid primary key);
    create table control_plane.projects (
      project_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      unique (project_id, tenant_id)
    );
    create table control_plane.production_packages (
      package_id uuid primary key,
      project_id uuid not null,
      tenant_id uuid not null,
      unique (package_id, project_id, tenant_id),
      foreign key (project_id, tenant_id)
        references control_plane.projects(project_id, tenant_id)
    );
  `);
  await addCanvasAssetAuthority(database);
  await database('control_plane.tenants').insert([
    { tenant_id: tenantId },
    { tenant_id: otherTenantId },
  ]);
  await database('control_plane.users').insert({ user_id: actorId });
  await database('control_plane.projects').insert([
    { project_id: projectId, tenant_id: tenantId },
    { project_id: otherProjectId, tenant_id: tenantId },
  ]);
  await database('control_plane.production_packages').insert([
    { package_id: packageId, project_id: projectId, tenant_id: tenantId },
    { package_id: otherPackageId, project_id: otherProjectId, tenant_id: tenantId },
  ]);
}

describe.skipIf(hasDedicatedTestDatabase)('Canvas Asset PostgreSQL integration environment', () => {
  it('is explicitly environment-blocked without a dedicated *_test database', () => {
    expect(hasDedicatedTestDatabase).toBe(false);
  });
});

describe.runIf(hasDedicatedTestDatabase)('PostgresCanvasAssetAuthorityRepository', () => {
  let database: Knex;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await createTestSchema(database);
  });

  afterAll(async () => {
    if (!database) return;
    await database.raw('drop schema if exists control_plane cascade');
    await database.destroy();
  });

  it('creates the two server authority tables', async () => {
    const repository = new PostgresCanvasAssetAuthorityRepository(database);
    expect(repository).toBeDefined();
    const tables = await database.raw<{ rows: Array<{ name: string | null }> }>(`
      select to_regclass('control_plane.canvas_asset_records')::text as name
      union all
      select to_regclass('control_plane.high_cost_command_approvals')::text as name
    `);
    expect(tables.rows.map(({ name }) => name)).toEqual([
      'control_plane.canvas_asset_records',
      'control_plane.high_cost_command_approvals',
    ]);
  });

  it('keeps asset reads and lifecycle transitions exact to tenant/project', async () => {
    const repository = new PostgresCanvasAssetAuthorityRepository(database);
    const created = await repository.createAsset({
      assetId,
      tenantId,
      projectId,
      packageId,
      canvasSessionId,
      category: 'image',
      displayName: 'Store front',
      provenanceKind: 'customer_upload',
      sourceAssetId: null,
      declaredByActorId: actorId,
      declaredAt: confirmedAt,
      rightsStatus: 'pending',
      rightsBasis: 'customer_owned',
      rightsValidFrom: null,
      rightsValidUntil: null,
      rightsReviewedByActorId: null,
      rightsReviewedAt: null,
      storageReference: 'tenant-assets/store-front.png',
      checksum: `sha256:${'a'.repeat(64)}`,
      reuseScope: 'project',
      controlledPreviewUrl: `/api/canvas-v1/assets/${assetId}/preview`,
    });
    expect(created.assetId).toBe(assetId);
    await expect(
      repository.getAsset({ tenantId: otherTenantId, projectId, assetId }),
    ).resolves.toBeNull();
    await expect(
      repository.getAsset({ tenantId, projectId: otherProjectId, assetId }),
    ).resolves.toBeNull();

    const authorized = await repository.transitionAssetRights({
      tenantId,
      projectId,
      assetId,
      fromStatus: 'pending',
      toStatus: 'authorized',
      validFrom: confirmedAt,
      validUntil: new Date('2027-08-14T02:00:00.000Z'),
      reviewedByActorId: actorId,
      reviewedAt: confirmedAt,
    });
    expect(authorized?.rightsStatus).toBe('authorized');
    await expect(
      repository.transitionAssetRights({
        tenantId,
        projectId,
        assetId,
        fromStatus: 'pending',
        toStatus: 'rejected',
        validFrom: null,
        validUntil: null,
        reviewedByActorId: actorId,
        reviewedAt: confirmedAt,
      }),
    ).resolves.toBeNull();
  });

  it('atomically binds approval consumption and replay to the exact command scope', async () => {
    const repository = new PostgresCanvasAssetAuthorityRepository(database);
    const actionFingerprint = `sha256:${'b'.repeat(64)}`;
    await repository.createHighCostApproval({
      approvalId,
      tenantId,
      projectId,
      packageId,
      canvasSessionId,
      actorId,
      commandType: 'GENERATE_SHOT',
      actionFingerprint,
      confirmedAt,
      expiresAt: new Date('2026-08-14T02:02:00.000Z'),
      replayPolicy: 'single_use_replay_same_command',
    });
    const input = {
      approvalId,
      tenantId,
      projectId,
      packageId,
      canvasSessionId,
      actorId,
      commandType: 'GENERATE_SHOT' as const,
      actionFingerprint,
      commandId,
      consumedAt: new Date('2026-08-14T02:01:00.000Z'),
    };
    await expect(repository.consumeHighCostApproval(input)).resolves.toMatchObject({
      replayed: false,
      value: { status: 'consumed', consumedByCommandId: commandId },
    });
    await expect(
      repository.consumeHighCostApproval({
        ...input,
        consumedAt: new Date('2026-08-14T02:03:00.000Z'),
      }),
    ).resolves.toMatchObject({
      replayed: true,
    });
    await expect(
      repository.consumeHighCostApproval({
        ...input,
        commandId: 'abababab-abab-4bab-8bab-abababababab',
      }),
    ).resolves.toBeNull();
    await expect(
      repository.consumeHighCostApproval({ ...input, projectId: otherProjectId }),
    ).resolves.toBeNull();
  });
});
