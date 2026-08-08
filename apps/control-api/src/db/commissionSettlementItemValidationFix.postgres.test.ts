import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { migrationConfig } from './migrationConfig.js';
import {
  down as removeCommissionSettlementItemValidationFix,
  up as fixCommissionSettlementItemValidation,
} from './migrations/018_fix_commission_settlement_item_validation.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

async function resetDatabase(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await database.schema.withSchema('public').dropTableIfExists('control_api_migrations_lock');
  await database.schema.withSchema('public').dropTableIfExists('control_api_migrations');
}

async function functionDefinition(database: Knex): Promise<string> {
  const result = await database.raw<{ rows: Array<{ definition: string }> }>(
    `select pg_get_functiondef(procedure.oid) as definition
       from pg_proc procedure
       join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'control_plane'
        and procedure.proname = 'validate_commission_settlement_item'`,
  );
  return result.rows[0]?.definition ?? '';
}

describe.runIf(hasDedicatedTestDatabase)('migration 018 settlement item validation fix', () => {
  let database: Knex;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await resetDatabase(database);
    await database.migrate.latest(migrationConfig(import.meta.url));
  });

  afterAll(async () => {
    if (!database) return;
    await resetDatabase(database);
    await database.destroy();
  });

  it('uses unambiguous record and source alias names for Reversal validation', async () => {
    const definition = await functionDefinition(database);

    expect(definition).toContain('reversal_record record');
    expect(definition).toContain('source_reversal.*');
    expect(definition).toContain('source_accrual.beneficiary_channel_id');
    expect(definition).not.toContain('select reversal.*, accrual.beneficiary_channel_id');
  });

  it('can remove and reapply an empty compatibility layer', async () => {
    await removeCommissionSettlementItemValidationFix(database);
    await expect(functionDefinition(database)).resolves.toContain(
      'select reversal.*, accrual.beneficiary_channel_id',
    );

    await fixCommissionSettlementItemValidation(database);
    await expect(functionDefinition(database)).resolves.toContain('source_reversal.*');
  });
});
