import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { migrationConfig } from './migrationConfig.js';
import {
  down as removeFullTestPaymentReversal,
  up as addFullTestPaymentReversal,
} from './migrations/017_full_test_payment_reversal.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

async function resetDatabase(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await database.schema.withSchema('public').dropTableIfExists('control_api_migrations_lock');
  await database.schema.withSchema('public').dropTableIfExists('control_api_migrations');
}

async function constraintDefinition(database: Knex, constraintName: string): Promise<string> {
  const result = await database.raw<{ rows: Array<{ definition: string }> }>(
    `select pg_get_constraintdef(oid) as definition
       from pg_constraint
      where conname = ?`,
    [constraintName],
  );
  return result.rows[0]?.definition ?? '';
}

async function functionDefinition(database: Knex, functionName: string): Promise<string> {
  const result = await database.raw<{ rows: Array<{ definition: string }> }>(
    `select pg_get_functiondef(procedure.oid) as definition
       from pg_proc procedure
       join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'control_plane'
        and procedure.proname = ?`,
    [functionName],
  );
  return result.rows[0]?.definition ?? '';
}

async function indexNames(database: Knex): Promise<string[]> {
  const result = await database.raw<{ rows: Array<{ indexname: string }> }>(
    `select indexname
       from pg_indexes
      where schemaname = 'control_plane'
        and tablename = 'credit_ledger_entries'
      order by indexname`,
  );
  return result.rows.map(({ indexname }) => indexname);
}

describe.runIf(hasDedicatedTestDatabase)('migration 017 full TEST payment reversal', () => {
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

  it('adds reclaim and stable reversal rejection evidence without weakening existing operations', async () => {
    const operation = await constraintDefinition(database, 'credit_ledger_entries_operation_check');
    const errors = await constraintDefinition(database, 'payment_events_error_code_ck');

    expect(operation).toContain("'reclaim'::text");
    expect(operation).toContain("'consume'::text");
    expect(errors).toContain("'partial_refund_unsupported'::text");
    expect(errors).toContain("'credit_reclaim_unsafe'::text");
    expect(errors).toContain("'commission_reversal_conflict'::text");
  });

  it('installs separate Lot issue/reclaim uniqueness and validates applied source Events', async () => {
    await expect(indexNames(database)).resolves.toEqual(
      expect.arrayContaining([
        'credit_ledger_recharge_lot_issue_uq',
        'credit_ledger_recharge_lot_reclaim_uq',
      ]),
    );

    const ledgerValidator = await functionDefinition(
      database,
      'validate_recharge_credit_ledger_entry',
    );
    const reversalValidator = await functionDefinition(database, 'validate_commission_reversal');
    expect(ledgerValidator).toContain("new.operation = 'reclaim'");
    expect(ledgerValidator).toContain("payment_event.processing_status <> 'applied'");
    expect(reversalValidator).toContain("payment_event.processing_status <> 'applied'");
    expect(reversalValidator).toContain("payment_event.payment_mode <> 'TEST'");
  });

  it('can remove an empty 017 layer and restore the prior operation contract', async () => {
    await removeFullTestPaymentReversal(database);
    const operation = await constraintDefinition(database, 'credit_ledger_entries_operation_check');
    expect(operation).not.toContain("'reclaim'::text");

    await addFullTestPaymentReversal(database);
    await expect(
      constraintDefinition(database, 'credit_ledger_entries_operation_check'),
    ).resolves.toContain("'reclaim'::text");
  });
});
