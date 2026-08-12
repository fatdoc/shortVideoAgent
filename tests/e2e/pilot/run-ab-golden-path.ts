import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resetMigrateSeedPilotE2e } from '../../../apps/control-api/src/e2e/resetSeed.js';
import {
  AbGoldenPathPreflightError,
  preflightAbGoldenPath,
  type AbGoldenPathPreflightDependencies,
} from './abGoldenPathPreflight.js';
import {
  assertPilotBrowserArtifactsSafe,
  assertPilotInMemoryEvidenceSafe,
  type PilotArtifactSecurityEvidence,
} from './pilotArtifactSecurity.js';
import {
  assertPilotPlaywrightReport,
  type PilotPlaywrightReportSummary,
} from './pilotPlaywrightReport.js';
import { PilotProcessHarness } from './pilotProcessHarness.js';
import { assertPilotSpecPolicy } from './pilotSpecPolicy.js';

const repositoryRoot = resolve(import.meta.dirname, '../../..');

export type AbGoldenPathRunnerErrorCode =
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
  | 'AB_GOLDEN_PATH_B_CONSUMER_REQUIRED'
  | 'AB_GOLDEN_PATH_NOT_IMPLEMENTED'
  | 'AB_GOLDEN_PATH_RUNNER_FAILED';

export class AbGoldenPathRunnerError extends Error {
  constructor(readonly code: AbGoldenPathRunnerErrorCode) {
    super(code);
    this.name = 'AbGoldenPathRunnerError';
    this.stack = undefined;
  }
}

type SpawnSyncProbe = (
  command: string,
  args: string[],
  options: { cwd: string; shell: false; stdio: 'ignore' },
) => { status: number | null };

export type AbGoldenPathRunnerDependencies = AbGoldenPathPreflightDependencies & {
  attestStoryCanvasTrackedBaseline(commit: string): void | Promise<void>;
  /** Deferred until the real cross-plane spec and B consumer contract are frozen. */
  readGoldenPathInput(): Promise<string>;
  resetMigrateSeed(environment: NodeJS.ProcessEnv): Promise<unknown>;
  createProcessHarness(): PilotProcessHarness;
  probeReadiness(): Promise<boolean>;
};

export interface AbGoldenPathRunnerOptions {
  dependencies?: AbGoldenPathRunnerDependencies;
  repositoryRoot?: string;
}

export interface AbGoldenPathEvidenceInput {
  specSource: unknown;
  playwrightReport: unknown;
  artifactRoot: string;
  secrets: readonly string[];
  securityEvidence?: PilotArtifactSecurityEvidence;
}

function fixedError(code: AbGoldenPathRunnerErrorCode): AbGoldenPathRunnerError {
  return new AbGoldenPathRunnerError(code);
}

function readGitProbeStatus(
  spawnSyncImpl: SpawnSyncProbe,
  root: string,
  args: string[],
): number | null {
  try {
    return spawnSyncImpl('git', args, {
      cwd: root,
      shell: false,
      stdio: 'ignore',
    }).status;
  } catch {
    throw fixedError('JOINT_GATE_B_BASELINE_COMMIT_INVALID');
  }
}

function commitExists(spawnSyncImpl: SpawnSyncProbe, root: string, commit: string): boolean {
  return readGitProbeStatus(spawnSyncImpl, root, ['cat-file', '-e', `${commit}^{commit}`]) === 0;
}

function isCommitAncestor(spawnSyncImpl: SpawnSyncProbe, root: string, commit: string): boolean {
  const status = readGitProbeStatus(spawnSyncImpl, root, [
    'merge-base',
    '--is-ancestor',
    commit,
    'HEAD',
  ]);
  if (status === 0) return true;
  if (status === 1) return false;
  throw fixedError('JOINT_GATE_B_BASELINE_COMMIT_INVALID');
}

function assertTrackedDiffClean(spawnSyncImpl: SpawnSyncProbe, root: string, args: string[]): void {
  const status = readGitProbeStatus(spawnSyncImpl, root, args);
  if (status === 0) return;
  if (status === 1) throw fixedError('JOINT_GATE_B_BASELINE_ATTESTATION_REQUIRED');
  throw fixedError('JOINT_GATE_B_BASELINE_COMMIT_INVALID');
}

function attestStoryCanvasTrackedBaseline(
  spawnSyncImpl: SpawnSyncProbe,
  root: string,
  commit: string,
): void {
  assertTrackedDiffClean(spawnSyncImpl, root, ['diff', '--quiet', '--', 'apps/storycanvas']);
  assertTrackedDiffClean(spawnSyncImpl, root, [
    'diff',
    '--cached',
    '--quiet',
    '--',
    'apps/storycanvas',
  ]);
  assertTrackedDiffClean(spawnSyncImpl, root, [
    'diff',
    '--quiet',
    commit,
    'HEAD',
    '--',
    'apps/storycanvas',
  ]);
}

export function createLocalAbGoldenPathPreflightDependencies({
  repositoryRoot: root = repositoryRoot,
  spawnSyncImpl = (command, args, options) => spawnSync(command, args, options),
}: {
  repositoryRoot?: string;
  spawnSyncImpl?: SpawnSyncProbe;
} = {}): AbGoldenPathPreflightDependencies &
  Pick<AbGoldenPathRunnerDependencies, 'attestStoryCanvasTrackedBaseline'> {
  return {
    commitExists: (commit) => commitExists(spawnSyncImpl, root, commit),
    isCommitAncestor: (commit) => isCommitAncestor(spawnSyncImpl, root, commit),
    attestStoryCanvasTrackedBaseline: (commit: string) =>
      attestStoryCanvasTrackedBaseline(spawnSyncImpl, root, commit),
    hasBConsumerCapability: async () => {
      // No B consumer capability marker/manifest contract is frozen yet. Fail closed without
      // reading guessed files, consulting the network, or inferring readiness from source shape.
      return false;
    },
  };
}

export function createAbGoldenPathRunnerDependencies(
  root = repositoryRoot,
): AbGoldenPathRunnerDependencies {
  return {
    ...createLocalAbGoldenPathPreflightDependencies({ repositoryRoot: root }),
    readGoldenPathInput: async () => {
      throw fixedError('AB_GOLDEN_PATH_NOT_IMPLEMENTED');
    },
    resetMigrateSeed: resetMigrateSeedPilotE2e,
    createProcessHarness: () => new PilotProcessHarness(),
    probeReadiness: async () => {
      throw fixedError('AB_GOLDEN_PATH_NOT_IMPLEMENTED');
    },
  };
}

export async function validateAbGoldenPathEvidence(
  input: AbGoldenPathEvidenceInput,
): Promise<PilotPlaywrightReportSummary> {
  assertPilotSpecPolicy(input.specSource);
  assertPilotInMemoryEvidenceSafe(input.specSource, input.secrets, input.securityEvidence);
  assertPilotInMemoryEvidenceSafe(input.playwrightReport, input.secrets, input.securityEvidence);
  const report = assertPilotPlaywrightReport(input.playwrightReport);
  await assertPilotBrowserArtifactsSafe(input.artifactRoot, input.secrets, input.securityEvidence);
  return report;
}

export async function runAbGoldenPath(
  environment: NodeJS.ProcessEnv = process.env,
  options: AbGoldenPathRunnerOptions = {},
): Promise<never> {
  const dependencies =
    options.dependencies ??
    createAbGoldenPathRunnerDependencies(options.repositoryRoot ?? repositoryRoot);

  let baselineCommit: string;
  try {
    const preflight = await preflightAbGoldenPath(environment, {
      commitExists: dependencies.commitExists,
      isCommitAncestor: dependencies.isCommitAncestor,
      // The real consumer probe is intentionally deferred until the tracked baseline
      // attestation passes. This preserves the frozen preflight contract while ensuring
      // no consumer/file/database/process/network work starts against a dirty B baseline.
      hasBConsumerCapability: async () => true,
    });
    baselineCommit = preflight.baselineCommit;
  } catch (error) {
    if (error instanceof AbGoldenPathPreflightError) {
      throw fixedError(error.code);
    }
    throw fixedError('AB_GOLDEN_PATH_RUNNER_FAILED');
  }

  try {
    await dependencies.attestStoryCanvasTrackedBaseline(baselineCommit);
  } catch (error) {
    if (
      error instanceof AbGoldenPathRunnerError &&
      (error.code === 'JOINT_GATE_B_BASELINE_ATTESTATION_REQUIRED' ||
        error.code === 'JOINT_GATE_B_BASELINE_COMMIT_INVALID')
    ) {
      throw fixedError(error.code);
    }
    throw fixedError('JOINT_GATE_B_BASELINE_COMMIT_INVALID');
  }

  let hasConsumerCapability: boolean;
  try {
    hasConsumerCapability = await dependencies.hasBConsumerCapability(baselineCommit);
  } catch {
    throw fixedError('AB_GOLDEN_PATH_B_CONSUMER_REQUIRED');
  }
  if (!hasConsumerCapability) {
    throw fixedError('AB_GOLDEN_PATH_B_CONSUMER_REQUIRED');
  }

  // The shared runner intentionally stops here. Until B publishes a frozen local capability
  // marker plus the real browser-safe consumer/spec contract, no file read, database reset,
  // child spawn, readiness network probe, report acceptance, or artifact scan may begin.
  throw fixedError('AB_GOLDEN_PATH_NOT_IMPLEMENTED');
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return typeof entry === 'string' && pathToFileURL(resolve(entry)).href === import.meta.url;
}

if (isMainModule()) {
  try {
    await runAbGoldenPath();
  } catch (error) {
    const code =
      error instanceof AbGoldenPathRunnerError ? error.code : 'AB_GOLDEN_PATH_RUNNER_FAILED';
    console.error(JSON.stringify({ event: 'ab_golden_path_failed', code }));
    process.exitCode = 1;
  }
}
