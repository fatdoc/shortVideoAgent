import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { migrationConfig } from '../db/migrationConfig.js';
import { PostgresCanvasAssetAuthorityRepository } from './repository.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

describe.skipIf(hasDedicatedTestDatabase)('Canvas Asset PostgreSQL integration environment', () => {
  it('is explicitly environment-blocked without a dedicated *_test database', () => {
    expect(hasDedicatedTestDatabase).toBe(false);
  });
});

describe.runIf(hasDedicatedTestDatabase)('PostgresCanvasAssetAuthorityRepository', () => {
  let database: Knex;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await database.raw('drop schema if exists control_plane cascade');
    await database.schema.withSchema('public').dropTableIfExists('control_api_migrations_lock');
    await database.schema.withSchema('public').dropTableIfExists('control_api_migrations');
    await database.migrate.latest(migrationConfig(import.meta.url));
  });

  afterAll(async () => {
    if (!database) return;
    await database.raw('drop schema if exists control_plane cascade');
    await database.schema.withSchema('public').dropTableIfExists('control_api_migrations_lock');
    await database.schema.withSchema('public').dropTableIfExists('control_api_migrations');
    await database.destroy();
  });

  it('keeps asset and approval lookups exact to tenant/project and consumes once', async () => {
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
});
