import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CONTROL_API_MIGRATION_FINGERPRINT_TABLES,
  CONTROL_API_MIGRATION_NAMES,
} from './migrationContract.js';
import { migrationConfig } from './migrationConfig.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const expectedMigrations = [...CONTROL_API_MIGRATION_NAMES];

const expectedTables = [...CONTROL_API_MIGRATION_FINGERPRINT_TABLES];

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

  it('loads migrations 001 through 024 from an empty database and is idempotent on replay', async () => {
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
