export type PilotE2eEnvironment = {
  databaseUrl: string;
  databaseName: string;
  controlApiHost: '127.0.0.1';
  controlApiPort: number;
  webHost: '127.0.0.1';
  webPort: number;
};

export type PilotE2eEnvironmentErrorCode =
  | 'PILOT_E2E_MODE_REQUIRED'
  | 'PILOT_E2E_DATABASE_URL_REQUIRED'
  | 'PILOT_E2E_DATABASE_URL_INVALID'
  | 'PILOT_E2E_DATABASE_PROTOCOL_INVALID'
  | 'PILOT_E2E_DATABASE_NOT_DEDICATED'
  | 'PILOT_E2E_PORT_INVALID'
  | 'PILOT_E2E_PORT_CONFLICT'
  | 'PILOT_E2E_DATABASE_IDENTITY_INVALID'
  | 'PILOT_E2E_DATABASE_IDENTITY_MISMATCH';

export class PilotE2eEnvironmentError extends Error {
  constructor(readonly code: PilotE2eEnvironmentErrorCode) {
    super(code);
    this.name = 'PilotE2eEnvironmentError';
  }
}

export type PilotE2eDatabase = {
  raw(sql: string): Promise<unknown>;
};

function fail(code: PilotE2eEnvironmentErrorCode): never {
  throw new PilotE2eEnvironmentError(code);
}

function parsePort(value: string | undefined, fallback: number): number {
  const normalized = value?.trim();
  if (!normalized) return fallback;
  if (!/^\d+$/.test(normalized)) fail('PILOT_E2E_PORT_INVALID');
  const port = Number(normalized);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    fail('PILOT_E2E_PORT_INVALID');
  }
  return port;
}

function parseDedicatedDatabaseUrl(value: string | undefined): {
  databaseUrl: string;
  databaseName: string;
} {
  const databaseUrl = value?.trim();
  if (!databaseUrl) fail('PILOT_E2E_DATABASE_URL_REQUIRED');

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail('PILOT_E2E_DATABASE_URL_INVALID');
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    fail('PILOT_E2E_DATABASE_PROTOCOL_INVALID');
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  } catch {
    fail('PILOT_E2E_DATABASE_URL_INVALID');
  }

  if (
    !databaseName ||
    databaseName.includes('/') ||
    databaseName === 'videoagent_control' ||
    !databaseName.endsWith('_test')
  ) {
    fail('PILOT_E2E_DATABASE_NOT_DEDICATED');
  }

  return { databaseUrl, databaseName };
}

export function parsePilotE2eEnvironment(environment: NodeJS.ProcessEnv): PilotE2eEnvironment {
  if (environment.PILOT_E2E !== 'true') fail('PILOT_E2E_MODE_REQUIRED');

  const database = parseDedicatedDatabaseUrl(environment.CONTROL_API_TEST_DATABASE_URL);
  const controlApiPort = parsePort(environment.PILOT_E2E_CONTROL_API_PORT, 10_601);
  const webPort = parsePort(environment.PILOT_E2E_WEB_PORT, 5_175);
  if (controlApiPort === webPort) fail('PILOT_E2E_PORT_CONFLICT');

  return {
    ...database,
    controlApiHost: '127.0.0.1',
    controlApiPort,
    webHost: '127.0.0.1',
    webPort,
  };
}

export function safePilotE2eEnvironmentSummary(environment: PilotE2eEnvironment): {
  databaseName: string;
  databaseHostCategory: 'loopback' | 'remote';
  controlApiOrigin: string;
  webOrigin: string;
} {
  const hostname = new URL(environment.databaseUrl).hostname.toLowerCase();
  const databaseHostCategory = new Set(['127.0.0.1', 'localhost', '::1']).has(hostname)
    ? 'loopback'
    : 'remote';
  return {
    databaseName: environment.databaseName,
    databaseHostCategory,
    controlApiOrigin: `http://${environment.controlApiHost}:${environment.controlApiPort}`,
    webOrigin: `http://${environment.webHost}:${environment.webPort}`,
  };
}

function databaseNameFromResult(result: unknown): string | null {
  if (typeof result !== 'object' || result === null || !('rows' in result)) return null;
  const rows = (result as { rows?: unknown }).rows;
  if (!Array.isArray(rows) || rows.length !== 1) return null;
  const row = rows[0];
  if (typeof row !== 'object' || row === null || !('database_name' in row)) return null;
  const value = (row as { database_name?: unknown }).database_name;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function assertPilotE2eDatabaseIdentity(
  database: PilotE2eDatabase,
  environment: PilotE2eEnvironment,
): Promise<void> {
  const result = await database.raw('select current_database() as database_name');
  const actualDatabaseName = databaseNameFromResult(result);
  if (!actualDatabaseName) fail('PILOT_E2E_DATABASE_IDENTITY_INVALID');
  if (actualDatabaseName !== environment.databaseName) {
    fail('PILOT_E2E_DATABASE_IDENTITY_MISMATCH');
  }
}

export async function runWithVerifiedPilotE2eDatabase<T>(
  database: PilotE2eDatabase,
  environment: PilotE2eEnvironment,
  operation: () => Promise<T>,
): Promise<T> {
  await assertPilotE2eDatabaseIdentity(database, environment);
  return operation();
}
