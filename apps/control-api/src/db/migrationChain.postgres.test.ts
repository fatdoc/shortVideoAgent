import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { migrationConfig } from './migrationConfig.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const expectedMigrations = [
  '001_pilot_core.ts',
  '002_auth_session_rotation.ts',
  '003_content_tenant_integrity.ts',
  '004_production_package_grant.ts',
  '005_production_security_hardening.ts',
  '006_organization_foundation.ts',
  '007_channel_foundation.ts',
  '008_organization_membership.ts',
  '009_project_assignment.ts',
  '010_session_active_context.ts',
  '011_terms_versioning.ts',
];

const expectedTables = [
  'auth_sessions',
  'channels',
  'organization_memberships',
  'organization_membership_roles',
  'organizations',
  'project_assignment_backfill_runs',
  'project_assignments',
  'project_grants',
  'projects',
  'tenants',
  'terms_documents',
  'terms_versions',
  'user_consents',
  'users',
];

async function resetDatabase(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await database.schema.withSchema('public').dropTableIfExists('control_api_migrations_lock');
  await database.schema.withSchema('public').dropTableIfExists('control_api_migrations');
}

async function registeredTable(database: Knex, tableName: string): Promise<string | null> {
  const result = await database.raw<{ rows: Array<{ table_name: string | null }> }>(
    'select to_regclass(?)::text as table_name',
    [`control_plane.${tableName}`],
  );
  return result.rows[0]?.table_name ?? null;
}

describe.runIf(hasDedicatedTestDatabase)('Control API migration chain', () => {
  let database: Knex;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await resetDatabase(database);
  });

  afterAll(async () => {
    if (!database) return;
    await resetDatabase(database);
    await database.destroy();
  });

  it('loads migrations 001 through 011 from an empty database and is idempotent on replay', async () => {
    const config = migrationConfig(import.meta.url);
    const [batch, migrations] = await database.migrate.latest(config);

    expect(batch).toBe(1);
    expect(migrations).toEqual(expectedMigrations);
    await expect(
      Promise.all(expectedTables.map((tableName) => registeredTable(database, tableName))),
    ).resolves.toEqual(expectedTables.map((tableName) => `control_plane.${tableName}`));

    const [replayBatch, replayedMigrations] = await database.migrate.latest(config);
    expect(replayBatch).toBe(1);
    expect(replayedMigrations).toEqual([]);

    const applied = await database('public.control_api_migrations').select('name').orderBy('id');
    expect(applied.map(({ name }) => name)).toEqual(expectedMigrations);
  });
});
