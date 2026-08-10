import {
  PilotE2eEnvironmentError,
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
  error(line: string): void;
};

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

export function runMigrationGateEnvironmentBoundary(
  environment: NodeJS.ProcessEnv,
  output: MigrationGateOutput,
): number {
  const inspection = inspectMigrationGateEnvironment(environment);
  if (!inspection.ok) {
    output.error(`MIGRATION_GATE_ENVIRONMENT_REJECTED ${inspection.reasonCode}`);
    return 2;
  }

  output.error(
    `MIGRATION_GATE_IMPLEMENTATION_PENDING database=${inspection.summary.databaseName} host=${inspection.summary.databaseHostCategory}`,
  );
  return 2;
}
