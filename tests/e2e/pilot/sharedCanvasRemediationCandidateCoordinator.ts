import type { SharedCanvasNoPostgresRuntimeAcceptanceResult } from './sharedCanvasNoPostgresRuntimeAcceptance.js';
import type { SharedCanvasRemediationLifecycleOracleResult } from './sharedCanvasRemediationLifecycleOracle.js';

export type SharedCanvasRemediationCandidateCoordinatorErrorCode =
  | 'SHARED_CANVAS_CANDIDATE_GIT_ATTESTATION_FAILED'
  | 'SHARED_CANVAS_CANDIDATE_HTTP_LOG_FAILED'
  | 'SHARED_CANVAS_CANDIDATE_RUNTIME_FAILED'
  | 'SHARED_CANVAS_CANDIDATE_LIFECYCLE_FAILED';

export class SharedCanvasRemediationCandidateCoordinatorError extends Error {
  constructor(readonly code: SharedCanvasRemediationCandidateCoordinatorErrorCode) {
    super(code);
    this.name = 'SharedCanvasRemediationCandidateCoordinatorError';
    this.stack = undefined;
  }
}

export interface SharedCanvasRemediationCandidateGitAttestationResult {
  verifiedCommitCount: number;
  verifiedWriteSetCount: number;
}

export interface SharedCanvasRemediationCandidateHttpLogResult {
  malformedValidated: boolean;
  oversizedValidated: boolean;
  runtimeLogValidated: boolean;
}

export interface SharedCanvasRemediationCandidateCoordinatorDependencies {
  attestGit(): Promise<SharedCanvasRemediationCandidateGitAttestationResult>;
  validateHttpLog(): Promise<SharedCanvasRemediationCandidateHttpLogResult>;
  validateRuntimeHarness(): Promise<SharedCanvasNoPostgresRuntimeAcceptanceResult>;
  validateLifecycle(): Promise<SharedCanvasRemediationLifecycleOracleResult>;
}

export interface SharedCanvasRemediationCandidateCoordinatorResult {
  status: 'coordinator-ready';
  code: 'A_REM_VAL_5_CANDIDATE_COORDINATOR_READY';
  gitAttested: true;
  httpLogValidated: true;
  runtimeHarnessValidated: true;
  lifecycleValidated: true;
}

type ExactValues = Readonly<Record<string, unknown>>;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readExactDataValues(value: unknown, expectedKeys: readonly string[]): ExactValues | null {
  try {
    if (!isPlainRecord(value)) return null;

    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expectedKeys.length ||
      !keys.every((key) => typeof key === 'string' && expectedKeys.includes(key))
    ) {
      return null;
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const values: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        !Object.hasOwn(descriptor, 'value')
      ) {
        return null;
      }
      values[key] = descriptor.value;
    }
    return values;
  } catch {
    return null;
  }
}

function fail(code: SharedCanvasRemediationCandidateCoordinatorErrorCode): never {
  throw new SharedCanvasRemediationCandidateCoordinatorError(code);
}

async function runStage<T>(
  callback: () => Promise<T>,
  code: SharedCanvasRemediationCandidateCoordinatorErrorCode,
): Promise<T> {
  try {
    return await Promise.resolve().then(callback);
  } catch {
    return fail(code);
  }
}

function assertGitResult(value: unknown): void {
  const result = readExactDataValues(value, ['verifiedCommitCount', 'verifiedWriteSetCount']);
  if (result === null || result.verifiedCommitCount !== 8 || result.verifiedWriteSetCount !== 5) {
    fail('SHARED_CANVAS_CANDIDATE_GIT_ATTESTATION_FAILED');
  }
}

function assertHttpLogResult(value: unknown): void {
  const result = readExactDataValues(value, [
    'malformedValidated',
    'oversizedValidated',
    'runtimeLogValidated',
  ]);
  if (
    result === null ||
    result.malformedValidated !== true ||
    result.oversizedValidated !== true ||
    result.runtimeLogValidated !== true
  ) {
    fail('SHARED_CANVAS_CANDIDATE_HTTP_LOG_FAILED');
  }
}

function assertRuntimeResult(value: unknown): void {
  const result = readExactDataValues(value, [
    'status',
    'code',
    'controlApiRequestCount',
    'storyCanvasStarted',
    'storyCanvasStopped',
    'dataRootRemoved',
  ]);
  if (
    result === null ||
    result.status !== 'harness-ready' ||
    result.code !== 'A_REM_VAL_3_RUNTIME_HARNESS_READY' ||
    result.controlApiRequestCount !== 2 ||
    result.storyCanvasStarted !== true ||
    result.storyCanvasStopped !== true ||
    result.dataRootRemoved !== true
  ) {
    fail('SHARED_CANVAS_CANDIDATE_RUNTIME_FAILED');
  }
}

function assertLifecycleResult(value: unknown): void {
  const result = readExactDataValues(value, [
    'status',
    'code',
    'registryEventCount',
    'shutdownSignal',
    'boundedShutdown',
  ]);
  if (
    result === null ||
    result.status !== 'oracle-ready' ||
    result.code !== 'A_REM_VAL_4_LIFECYCLE_ORACLE_READY' ||
    result.registryEventCount !== 8 ||
    (result.shutdownSignal !== 'SIGTERM' && result.shutdownSignal !== 'SIGINT') ||
    result.boundedShutdown !== true
  ) {
    fail('SHARED_CANVAS_CANDIDATE_LIFECYCLE_FAILED');
  }
}

export async function coordinateSharedCanvasRemediationCandidateAcceptance(
  dependencies: SharedCanvasRemediationCandidateCoordinatorDependencies,
): Promise<SharedCanvasRemediationCandidateCoordinatorResult> {
  const gitResult = await runStage(
    () => dependencies.attestGit(),
    'SHARED_CANVAS_CANDIDATE_GIT_ATTESTATION_FAILED',
  );
  assertGitResult(gitResult);

  const httpLogResult = await runStage(
    () => dependencies.validateHttpLog(),
    'SHARED_CANVAS_CANDIDATE_HTTP_LOG_FAILED',
  );
  assertHttpLogResult(httpLogResult);

  const runtimeResult = await runStage(
    () => dependencies.validateRuntimeHarness(),
    'SHARED_CANVAS_CANDIDATE_RUNTIME_FAILED',
  );
  assertRuntimeResult(runtimeResult);

  const lifecycleResult = await runStage(
    () => dependencies.validateLifecycle(),
    'SHARED_CANVAS_CANDIDATE_LIFECYCLE_FAILED',
  );
  assertLifecycleResult(lifecycleResult);

  return {
    status: 'coordinator-ready',
    code: 'A_REM_VAL_5_CANDIDATE_COORDINATOR_READY',
    gitAttested: true,
    httpLogValidated: true,
    runtimeHarnessValidated: true,
    lifecycleValidated: true,
  };
}
