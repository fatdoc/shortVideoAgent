import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostgresCanvasWorkspaceAuthorityRepository } from '../production/workspaceAuthorityRepository.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

describe.skipIf(hasDedicatedTestDatabase)('Workspace authority PostgreSQL environment', () => {
  it('is explicitly ENVIRONMENT_BLOCKED without a dedicated *_test database', () => {
    expect(hasDedicatedTestDatabase).toBe(false);
  });
});

describe.runIf(hasDedicatedTestDatabase)('PostgresCanvasWorkspaceAuthorityRepository', () => {
  let database: Knex;
  const verifier = vi.fn(async () => ({
    packageId: '33333333-3333-4333-8333-333333333333',
    contractVersion: '0.3' as const,
    status: 'ready' as const,
    expiresAt: new Date('2026-08-14T03:00:00.000Z'),
    capabilityRequirements: ['video.generate' as const],
    scriptVersionId: '44444444-4444-4444-8444-444444444444',
    storyboardVersionId: '55555555-5555-4555-8555-555555555555',
    approvedScriptDigest: `sha256:${'a'.repeat(64)}`,
    approvedStoryboardDigest: `sha256:${'b'.repeat(64)}`,
  }));

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await database.raw(`
      drop schema if exists control_plane cascade;
      create schema control_plane;
      create table control_plane.projects (
        project_id uuid primary key, tenant_id uuid not null, name text not null
      );
      create table control_plane.script_versions (
        script_version_id uuid primary key, tenant_id uuid not null, project_id uuid not null,
        version integer not null
      );
      create table control_plane.storyboard_versions (
        storyboard_version_id uuid primary key, tenant_id uuid not null, project_id uuid not null,
        version integer not null
      );
      insert into control_plane.projects values
        ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '真实门店项目');
      insert into control_plane.script_versions values
        ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 3),
        ('66666666-6666-4666-8666-666666666666', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 99);
      insert into control_plane.storyboard_versions values
        ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 2),
        ('77777777-7777-4777-8777-777777777777', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 88);
    `);
    verifier.mockClear();
  });

  afterAll(async () => {
    if (!database) return;
    await database.raw('drop schema if exists control_plane cascade');
    await database.destroy();
  });

  it('reads numeric versions only from exact Package-bound IDs, never latest rows', async () => {
    const repository = new PostgresCanvasWorkspaceAuthorityRepository(database, verifier);
    const input = {
      tenantId: '11111111-1111-4111-8111-111111111111',
      projectId: '22222222-2222-4222-8222-222222222222',
      packageId: '33333333-3333-4333-8333-333333333333',
      now: new Date('2026-08-14T02:03:00.100Z'),
    };
    await expect(repository.readExact(input)).resolves.toEqual({
      projectName: '真实门店项目',
      scriptId: '44444444-4444-4444-8444-444444444444',
      scriptVersion: 3,
      storyboardId: '55555555-5555-4555-8555-555555555555',
      storyboardVersion: 2,
    });
    expect(verifier).toHaveBeenCalledWith(expect.anything(), input);
  });
});
