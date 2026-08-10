import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import knex, { type Knex } from 'knex';
import {
  CONTROL_API_MIGRATION_FINGERPRINT_TABLES,
  CONTROL_API_MIGRATION_NAMES,
} from '../db/migrationContract.js';
import { migrationConfig } from '../db/migrationConfig.js';
import {
  PilotE2eEnvironmentError,
  assertPilotE2eDatabaseIdentity,
  parsePilotE2eEnvironment,
  safePilotE2eEnvironmentSummary,
  type PilotE2eEnvironment,
} from './environment.js';

export type MigrationGateEnvironmentRejection = {
  ok: false;
  reasonCode: string;
};

export type MigrationGateEnvironmentAcceptance = {
  ok: true;
  environment: PilotE2eEnvironment;
  summary: {
    databaseName: string;
    databaseHostCategory: 'loopback' | 'remote';
  };
};

export type MigrationGateEnvironmentResult =
  MigrationGateEnvironmentRejection | MigrationGateEnvironmentAcceptance;

export type MigrationGateOutput = {
  info(line: string): void;
  error(line: string): void;
};

class MigrationGateStageError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'MigrationGateStageError';
  }
}

type MigrationFingerprint = {
  appliedMigrations: string[];
  registeredTables: string[];
  digest: string;
};

const moduleExtension = extname(fileURLToPath(import.meta.url));
const migrationModuleUrl = new URL(`../db/migrate${moduleExtension}`, import.meta.url).href;

export function inspectMigrationGateEnvironment(
  environment: NodeJS.ProcessEnv,
): MigrationGateEnvironmentResult {
  try {
    const parsed = parsePilotE2eEnvironment(environment);
    const summary = safePilotE2eEnvironmentSummary(parsed);
    return {
      ok: true,
      environment: parsed,
      summary: {
        databaseName: summary.databaseName,
        databaseHostCategory: summary.databaseHostCategory,
      },
    };
  } catch (error) {
    return {
      ok: false,
      reasonCode:
        error instanceof PilotE2eEnvironmentError ? error.code : 'PILOT_E2E_ENVIRONMENT_REJECTED',
    };
  }
}

function createMigrationDatabase(environment: PilotE2eEnvironment): Knex {
  return knex({
    client: 'pg',
    connection: environment.databaseUrl,
    pool: {
      min: 0,
      max: 1,
      acquireTimeoutMillis: 10_000,
      idleTimeoutMillis: 1_000,
    },
  });
}

async function runStage<T>(code: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new MigrationGateStageError(code);
  }
}

function equalStringArrays(actual: readonly string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length && actual.every((value, index) => value === expected[index])
  );
}

function equalStringSets(actual: readonly string[], expected: readonly string[]): boolean {
  return equalStringArrays([...actual].sort(), [...expected].sort());
}

function requireCondition(condition: boolean): void {
  if (!condition) throw new Error('migration gate verification rejected');
}

async function resetMigrationState(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await database.schema.withSchema('public').dropTableIfExists('control_api_migrations_lock');
  await database.schema.withSchema('public').dropTableIfExists('control_api_migrations');
}

async function migrationTableExists(database: Knex): Promise<boolean> {
  const result = await database.raw<{ rows: Array<{ table_exists: boolean }> }>(
    "select to_regclass('public.control_api_migrations') is not null as table_exists",
  );
  return result.rows[0]?.table_exists === true;
}

async function appliedMigrationNames(database: Knex): Promise<string[]> {
  if (!(await migrationTableExists(database))) return [];
  const rows = await database('public.control_api_migrations').select('name').orderBy('id');
  return rows.map(({ name }) => String(name));
}

async function registeredTable(database: Knex, tableName: string): Promise<string | null> {
  const result = await database.raw<{ rows: Array<{ table_name: string | null }> }>(
    'select to_regclass(?)::text as table_name',
    [`control_plane.${tableName}`],
  );
  return result.rows[0]?.table_name ?? null;
}

async function migrationFingerprint(database: Knex): Promise<MigrationFingerprint> {
  const appliedMigrations = await appliedMigrationNames(database);
  const registeredTables = await Promise.all(
    CONTROL_API_MIGRATION_FINGERPRINT_TABLES.map((tableName) =>
      registeredTable(database, tableName),
    ),
  );
  const expectedTables = CONTROL_API_MIGRATION_FINGERPRINT_TABLES.map(
    (tableName) => `control_plane.${tableName}`,
  );
  requireCondition(equalStringArrays(appliedMigrations, CONTROL_API_MIGRATION_NAMES));
  requireCondition(
    registeredTables.length === expectedTables.length &&
      registeredTables.every((tableName, index) => tableName === expectedTables[index]),
  );

  const stableFingerprint = {
    appliedMigrations,
    registeredTables: registeredTables as string[],
  };
  return {
    ...stableFingerprint,
    digest: createHash('sha256').update(JSON.stringify(stableFingerprint)).digest('hex'),
  };
}

async function verifyEmptyMigrationState(database: Knex): Promise<void> {
  const schemaResult = await database.raw<{ rows: Array<{ schema_name: string | null }> }>(
    "select to_regnamespace('control_plane')::text as schema_name",
  );
  requireCondition(schemaResult.rows[0]?.schema_name === null);
  requireCondition((await appliedMigrationNames(database)).length === 0);
}

async function executeMigrationGate(database: Knex, output: MigrationGateOutput): Promise<void> {
  const config = migrationConfig(migrationModuleUrl);

  await runStage('MIGRATION_GATE_RESET_FAILED', () => resetMigrationState(database));
  await runStage('MIGRATION_GATE_RESET_FAILED', () => verifyEmptyMigrationState(database));
  output.info('MIGRATION_GATE_RESET_PASS');

  const [forwardBatch, forwardMigrations] = await runStage('MIGRATION_GATE_FORWARD_FAILED', () =>
    database.migrate.latest(config),
  );
  const forwardFingerprint = await runStage(
    'MIGRATION_GATE_FORWARD_VERIFICATION_FAILED',
    async () => {
      requireCondition(forwardBatch === 1);
      requireCondition(equalStringArrays(forwardMigrations, CONTROL_API_MIGRATION_NAMES));
      return migrationFingerprint(database);
    },
  );
  output.info(
    `MIGRATION_GATE_FORWARD_PASS batch=${forwardBatch} count=${forwardMigrations.length}`,
  );

  const [replayBatch, replayMigrations] = await runStage('MIGRATION_GATE_FORWARD_FAILED', () =>
    database.migrate.latest(config),
  );
  await runStage('MIGRATION_GATE_FORWARD_VERIFICATION_FAILED', async () => {
    requireCondition(replayBatch === 1);
    requireCondition(replayMigrations.length === 0);
    requireCondition((await migrationFingerprint(database)).digest === forwardFingerprint.digest);
  });
  output.info(`MIGRATION_GATE_REPLAY_PASS batch=${replayBatch} count=${replayMigrations.length}`);

  const [rollbackBatch, rollbackMigrations] = await runStage('MIGRATION_GATE_ROLLBACK_FAILED', () =>
    database.migrate.rollback(config),
  );
  await runStage('MIGRATION_GATE_ROLLBACK_VERIFICATION_FAILED', async () => {
    requireCondition(rollbackBatch === 1);
    requireCondition(equalStringSets(rollbackMigrations, CONTROL_API_MIGRATION_NAMES));
    await verifyEmptyMigrationState(database);
  });
  output.info(
    `MIGRATION_GATE_ROLLBACK_PASS batch=${rollbackBatch} count=${rollbackMigrations.length}`,
  );
  output.info('MIGRATION_GATE_ROLLBACK_EMPTY_PASS');

  const [reapplyBatch, reapplyMigrations] = await runStage('MIGRATION_GATE_REAPPLY_FAILED', () =>
    database.migrate.latest(config),
  );
  const reapplyFingerprint = await runStage(
    'MIGRATION_GATE_REAPPLY_VERIFICATION_FAILED',
    async () => {
      requireCondition(reapplyBatch === 1);
      requireCondition(equalStringArrays(reapplyMigrations, CONTROL_API_MIGRATION_NAMES));
      return migrationFingerprint(database);
    },
  );
  output.info(
    `MIGRATION_GATE_REAPPLY_PASS batch=${reapplyBatch} count=${reapplyMigrations.length}`,
  );
  requireCondition(reapplyFingerprint.digest === forwardFingerprint.digest);
  output.info('MIGRATION_GATE_FINGERPRINT_PASS');
}

export async function runControlApiMigrationGate(
  environment: NodeJS.ProcessEnv,
  output: MigrationGateOutput,
): Promise<number> {
  const inspection = inspectMigrationGateEnvironment(environment);
  if (!inspection.ok) {
    output.error(`MIGRATION_GATE_ENVIRONMENT_REJECTED ${inspection.reasonCode}`);
    return 2;
  }

  const database = createMigrationDatabase(inspection.environment);
  let identityVerified = false;
  let primaryFailure: string | null = null;
  let cleanupFailed = false;

  try {
    try {
      await assertPilotE2eDatabaseIdentity(database, inspection.environment);
      identityVerified = true;
    } catch (error) {
      if (error instanceof PilotE2eEnvironmentError) {
        output.error(`MIGRATION_GATE_DATABASE_IDENTITY_REJECTED ${error.code}`);
      } else {
        output.error('MIGRATION_GATE_CONNECTION_FAILED');
      }
      return 1;
    }

    output.info(
      `RUNNING_MIGRATION_GATE database=${inspection.summary.databaseName} host=${inspection.summary.databaseHostCategory}`,
    );
    try {
      await executeMigrationGate(database, output);
    } catch (error) {
      primaryFailure =
        error instanceof MigrationGateStageError
          ? error.code
          : 'MIGRATION_GATE_REAPPLY_VERIFICATION_FAILED';
      output.error(primaryFailure);
    }
  } finally {
    if (identityVerified) {
      try {
        await resetMigrationState(database);
        await verifyEmptyMigrationState(database);
        output.info('MIGRATION_GATE_CLEANUP_PASS');
      } catch {
        cleanupFailed = true;
        output.error('MIGRATION_GATE_CLEANUP_FAILED');
      }
    }
    try {
      await database.destroy();
    } catch {
      cleanupFailed = true;
      output.error('MIGRATION_GATE_CLEANUP_FAILED');
    }
  }

  if (primaryFailure || cleanupFailed) return 1;
  output.info('MIGRATION_ROLLBACK_REAPPLY_PASS');
  return 0;
}
