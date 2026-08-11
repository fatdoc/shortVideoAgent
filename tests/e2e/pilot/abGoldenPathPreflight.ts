import {
  PilotE2eEnvironmentError,
  parsePilotE2eEnvironment,
} from '../../../apps/control-api/src/e2e/environment.js';

export type AbGoldenPathPreflightErrorCode =
  | 'PILOT_E2E_MODE_REQUIRED'
  | 'AB_GOLDEN_PATH_MODE_REQUIRED'
  | 'PILOT_E2E_BROWSER_CHANNEL_REQUIRED'
  | 'PILOT_E2E_BROWSER_CHANNEL_INVALID'
  | 'PILOT_E2E_DATABASE_URL_REQUIRED'
  | 'PILOT_E2E_DATABASE_URL_INVALID'
  | 'PILOT_E2E_DATABASE_PROTOCOL_INVALID'
  | 'PILOT_E2E_DATABASE_NOT_DEDICATED'
  | 'PILOT_E2E_PORT_INVALID'
  | 'PILOT_E2E_PORT_CONFLICT'
  | 'JOINT_GATE_B_BASELINE_ATTESTATION_REQUIRED'
  | 'JOINT_GATE_B_BASELINE_COMMIT_INVALID'
  | 'JOINT_GATE_B_BASELINE_COMMIT_NOT_ANCESTOR'
  | 'AB_GOLDEN_PATH_B_CONSUMER_REQUIRED';

export class AbGoldenPathPreflightError extends Error {
  constructor(readonly code: AbGoldenPathPreflightErrorCode) {
    super(code);
    this.name = 'AbGoldenPathPreflightError';
    this.stack = undefined;
  }
}

export type AbGoldenPathPreflightDependencies = {
  commitExists(commit: string): boolean | Promise<boolean>;
  isCommitAncestor(commit: string): boolean | Promise<boolean>;
  hasBConsumerCapability(commit: string): boolean | Promise<boolean>;
};

export type AbGoldenPathPreflightResult = {
  browserChannel: 'chrome';
  databaseName: string;
  databaseUrl: string;
  baselineCommit: string;
};

function fail(code: AbGoldenPathPreflightErrorCode): never {
  throw new AbGoldenPathPreflightError(code);
}

function parseEnvironment(environment: NodeJS.ProcessEnv): AbGoldenPathPreflightResult {
  if (environment.PILOT_E2E !== 'true') fail('PILOT_E2E_MODE_REQUIRED');
  if (environment.PILOT_E2E_AB_GOLDEN_PATH !== 'true') {
    fail('AB_GOLDEN_PATH_MODE_REQUIRED');
  }

  const browserChannel = environment.PILOT_E2E_BROWSER_CHANNEL;
  if (!browserChannel) fail('PILOT_E2E_BROWSER_CHANNEL_REQUIRED');
  if (browserChannel !== 'chrome') fail('PILOT_E2E_BROWSER_CHANNEL_INVALID');

  let pilotEnvironment;
  try {
    pilotEnvironment = parsePilotE2eEnvironment(environment);
  } catch (error) {
    if (error instanceof PilotE2eEnvironmentError) {
      switch (error.code) {
        case 'PILOT_E2E_MODE_REQUIRED':
        case 'PILOT_E2E_DATABASE_URL_REQUIRED':
        case 'PILOT_E2E_DATABASE_URL_INVALID':
        case 'PILOT_E2E_DATABASE_PROTOCOL_INVALID':
        case 'PILOT_E2E_DATABASE_NOT_DEDICATED':
        case 'PILOT_E2E_PORT_INVALID':
        case 'PILOT_E2E_PORT_CONFLICT':
          fail(error.code);
        default:
          fail('PILOT_E2E_DATABASE_URL_INVALID');
      }
    }
    fail('PILOT_E2E_DATABASE_URL_INVALID');
  }

  const baselineCommit = environment.JOINT_GATE_B_BASELINE_COMMIT;
  if (!baselineCommit) fail('JOINT_GATE_B_BASELINE_ATTESTATION_REQUIRED');
  if (!/^[0-9a-f]{40}$/i.test(baselineCommit)) {
    fail('JOINT_GATE_B_BASELINE_COMMIT_INVALID');
  }

  return {
    browserChannel,
    databaseName: pilotEnvironment.databaseName,
    databaseUrl: pilotEnvironment.databaseUrl,
    baselineCommit,
  };
}

export async function preflightAbGoldenPath(
  environment: NodeJS.ProcessEnv,
  dependencies: AbGoldenPathPreflightDependencies,
): Promise<AbGoldenPathPreflightResult> {
  const parsed = parseEnvironment(environment);

  let commitExists: boolean;
  try {
    commitExists = await dependencies.commitExists(parsed.baselineCommit);
  } catch {
    fail('JOINT_GATE_B_BASELINE_COMMIT_INVALID');
  }
  if (!commitExists) fail('JOINT_GATE_B_BASELINE_COMMIT_INVALID');

  let isAncestor: boolean;
  try {
    isAncestor = await dependencies.isCommitAncestor(parsed.baselineCommit);
  } catch {
    fail('JOINT_GATE_B_BASELINE_COMMIT_INVALID');
  }
  if (!isAncestor) fail('JOINT_GATE_B_BASELINE_COMMIT_NOT_ANCESTOR');

  let hasConsumer: boolean;
  try {
    hasConsumer = await dependencies.hasBConsumerCapability(parsed.baselineCommit);
  } catch {
    fail('AB_GOLDEN_PATH_B_CONSUMER_REQUIRED');
  }
  if (!hasConsumer) fail('AB_GOLDEN_PATH_B_CONSUMER_REQUIRED');

  return parsed;
}
