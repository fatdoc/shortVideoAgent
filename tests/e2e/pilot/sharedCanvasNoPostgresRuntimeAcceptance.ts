import path from 'node:path';
import type { PilotProcessOutput, PilotProcessSpec } from './pilotProcessHarness.js';
import { assertSafePilotCanvasRuntimeOutput } from './sharedCanvasRemediationSecurityOracle.js';

export type SharedCanvasNoPostgresRuntimeAcceptanceErrorCode =
  | 'SHARED_CANVAS_RUNTIME_ACCEPTANCE_CONFIG_INVALID'
  | 'SHARED_CANVAS_RUNTIME_PORT_INVALID'
  | 'SHARED_CANVAS_RUNTIME_DATA_ROOT_INVALID'
  | 'SHARED_CANVAS_RUNTIME_CONTROL_API_ORIGIN_INVALID'
  | 'SHARED_CANVAS_RUNTIME_PORT_CONFLICT'
  | 'SHARED_CANVAS_RUNTIME_START_FAILED'
  | 'SHARED_CANVAS_RUNTIME_SECURITY_VIOLATION'
  | 'SHARED_CANVAS_RUNTIME_CLEANUP_FAILED';

export class SharedCanvasNoPostgresRuntimeAcceptanceError extends Error {
  constructor(code: SharedCanvasNoPostgresRuntimeAcceptanceErrorCode) {
    super(code);
    this.name = 'SharedCanvasNoPostgresRuntimeAcceptanceError';
    this.stack = undefined;
  }
}

export interface SharedCanvasNoPostgresRuntimeAcceptanceOptions {
  repositoryRoot: string;
  storyCanvasPort: number;
  allowedOrigin: string;
}

export interface SharedCanvasNoPostgresRuntimeAcceptanceResult {
  status: 'harness-ready';
  code: 'A_REM_VAL_3_RUNTIME_HARNESS_READY';
  controlApiRequestCount: number;
  storyCanvasStarted: true;
  storyCanvasStopped: true;
  dataRootRemoved: true;
}

export interface SharedCanvasSyntheticControlApiHandle {
  origin: string;
  port: number;
  requestCount(): number;
  close(): Promise<void>;
}

export interface SharedCanvasManagedProcess {
  output(): PilotProcessOutput;
}

export interface SharedCanvasProcessHarness {
  start(spec: PilotProcessSpec): Promise<SharedCanvasManagedProcess>;
  stop(): Promise<void>;
}

export interface SharedCanvasStoryCanvasProcessSpecInput {
  repositoryRoot: string;
  controlApiOrigin: string;
  allowedOrigin: string;
  dataRoot: string;
  internalToken: string;
  storyCanvasPort: number;
}

export interface SharedCanvasNoPostgresRuntimeAcceptanceDependencies {
  generateSecret(): string;
  createTemporaryDataRoot(): Promise<string>;
  startSyntheticControlApi(input: {
    host: '127.0.0.1';
    port: 0;
    internalToken: string;
  }): Promise<SharedCanvasSyntheticControlApiHandle>;
  createProcessHarness(): SharedCanvasProcessHarness;
  createStoryCanvasProcessSpec(input: SharedCanvasStoryCanvasProcessSpecInput): PilotProcessSpec;
  removeTemporaryDataRoot(path: string): Promise<void>;
}

function fixedError(
  code: SharedCanvasNoPostgresRuntimeAcceptanceErrorCode,
): SharedCanvasNoPostgresRuntimeAcceptanceError {
  return new SharedCanvasNoPostgresRuntimeAcceptanceError(code);
}

function isSafeAbsolutePath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value !== '' &&
    value === value.trim() &&
    path.isAbsolute(value) &&
    path.parse(value).root !== path.normalize(value)
  );
}

function isValidPort(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= 65_535;
}

function isExactHttpOrigin(value: unknown): value is string {
  if (typeof value !== 'string' || value === '' || value !== value.trim()) return false;

  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'http:' &&
      parsed.username === '' &&
      parsed.password === '' &&
      parsed.pathname === '/' &&
      parsed.search === '' &&
      parsed.hash === '' &&
      parsed.origin === value
    );
  } catch {
    return false;
  }
}

function validateOptions(options: SharedCanvasNoPostgresRuntimeAcceptanceOptions): void {
  if (!isSafeAbsolutePath(options.repositoryRoot) || !isExactHttpOrigin(options.allowedOrigin)) {
    throw fixedError('SHARED_CANVAS_RUNTIME_ACCEPTANCE_CONFIG_INVALID');
  }
  if (!isValidPort(options.storyCanvasPort)) {
    throw fixedError('SHARED_CANVAS_RUNTIME_PORT_INVALID');
  }
}

function isSafeSecret(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    value.length >= 16 &&
    value.length <= 4_096
  );
}

function isRepositoryContained(repositoryRoot: string, candidate: string): boolean {
  const relative = path.relative(path.normalize(repositoryRoot), path.normalize(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function validateDataRoot(repositoryRoot: string, dataRoot: unknown): asserts dataRoot is string {
  if (!isSafeAbsolutePath(dataRoot) || isRepositoryContained(repositoryRoot, dataRoot)) {
    throw fixedError('SHARED_CANVAS_RUNTIME_DATA_ROOT_INVALID');
  }
}

function validateSyntheticControlApi(handle: SharedCanvasSyntheticControlApiHandle): void {
  if (!isValidPort(handle.port) || !isExactHttpOrigin(handle.origin)) {
    throw fixedError('SHARED_CANVAS_RUNTIME_CONTROL_API_ORIGIN_INVALID');
  }

  let parsed: URL;
  try {
    parsed = new URL(handle.origin);
  } catch {
    throw fixedError('SHARED_CANVAS_RUNTIME_CONTROL_API_ORIGIN_INVALID');
  }

  if (
    parsed.hostname !== '127.0.0.1' ||
    parsed.port === '' ||
    Number(parsed.port) !== handle.port
  ) {
    throw fixedError('SHARED_CANVAS_RUNTIME_CONTROL_API_ORIGIN_INVALID');
  }
}

function safeRequestCount(handle: SharedCanvasSyntheticControlApiHandle): number {
  try {
    const count = handle.requestCount();
    if (!Number.isSafeInteger(count) || count < 0) {
      throw fixedError('SHARED_CANVAS_RUNTIME_SECURITY_VIOLATION');
    }
    return count;
  } catch (error) {
    if (error instanceof SharedCanvasNoPostgresRuntimeAcceptanceError) throw error;
    throw fixedError('SHARED_CANVAS_RUNTIME_SECURITY_VIOLATION');
  }
}

function assertStoppedOutputSafe(
  process: SharedCanvasManagedProcess,
  dataRoot: string,
  internalToken: string,
): void {
  try {
    const output = process.output();
    assertSafePilotCanvasRuntimeOutput({
      expectedState: 'ready-stopped',
      ...output,
      dataRoot,
      sensitiveValues: [internalToken],
    });
  } catch {
    throw fixedError('SHARED_CANVAS_RUNTIME_SECURITY_VIOLATION');
  }
}

export async function runSharedCanvasNoPostgresRuntimeAcceptance(
  options: SharedCanvasNoPostgresRuntimeAcceptanceOptions,
  dependencies: SharedCanvasNoPostgresRuntimeAcceptanceDependencies,
): Promise<SharedCanvasNoPostgresRuntimeAcceptanceResult> {
  validateOptions(options);

  let internalToken: string;
  try {
    internalToken = dependencies.generateSecret();
  } catch {
    throw fixedError('SHARED_CANVAS_RUNTIME_ACCEPTANCE_CONFIG_INVALID');
  }
  if (!isSafeSecret(internalToken)) {
    throw fixedError('SHARED_CANVAS_RUNTIME_ACCEPTANCE_CONFIG_INVALID');
  }

  let dataRoot: string;
  try {
    dataRoot = await dependencies.createTemporaryDataRoot();
  } catch {
    throw fixedError('SHARED_CANVAS_RUNTIME_DATA_ROOT_INVALID');
  }
  validateDataRoot(options.repositoryRoot, dataRoot);

  let controlApi: SharedCanvasSyntheticControlApiHandle | undefined;
  let harness: SharedCanvasProcessHarness | undefined;
  let managedProcess: SharedCanvasManagedProcess | undefined;
  let primaryError: SharedCanvasNoPostgresRuntimeAcceptanceError | undefined;
  let controlApiRequestCount = 0;

  try {
    try {
      controlApi = await dependencies.startSyntheticControlApi({
        host: '127.0.0.1',
        port: 0,
        internalToken,
      });
    } catch {
      throw fixedError('SHARED_CANVAS_RUNTIME_START_FAILED');
    }

    validateSyntheticControlApi(controlApi);
    if (controlApi.port === options.storyCanvasPort) {
      throw fixedError('SHARED_CANVAS_RUNTIME_PORT_CONFLICT');
    }

    try {
      harness = dependencies.createProcessHarness();
      const spec = dependencies.createStoryCanvasProcessSpec({
        repositoryRoot: options.repositoryRoot,
        controlApiOrigin: controlApi.origin,
        allowedOrigin: options.allowedOrigin,
        dataRoot,
        internalToken,
        storyCanvasPort: options.storyCanvasPort,
      });
      managedProcess = await harness.start(spec);
      controlApiRequestCount = safeRequestCount(controlApi);
    } catch (error) {
      if (error instanceof SharedCanvasNoPostgresRuntimeAcceptanceError) throw error;
      throw fixedError('SHARED_CANVAS_RUNTIME_START_FAILED');
    }
  } catch (error) {
    primaryError =
      error instanceof SharedCanvasNoPostgresRuntimeAcceptanceError
        ? error
        : fixedError('SHARED_CANVAS_RUNTIME_START_FAILED');
  }

  let cleanupFailed = false;
  let stopped = false;

  if (harness !== undefined) {
    try {
      await harness.stop();
      stopped = true;
    } catch {
      cleanupFailed = true;
    }
  }

  if (managedProcess !== undefined && stopped) {
    try {
      assertStoppedOutputSafe(managedProcess, dataRoot, internalToken);
    } catch (error) {
      if (primaryError === undefined) {
        primaryError =
          error instanceof SharedCanvasNoPostgresRuntimeAcceptanceError
            ? error
            : fixedError('SHARED_CANVAS_RUNTIME_SECURITY_VIOLATION');
      }
    }
  }

  if (controlApi !== undefined) {
    try {
      await controlApi.close();
    } catch {
      cleanupFailed = true;
    }
  }

  try {
    await dependencies.removeTemporaryDataRoot(dataRoot);
  } catch {
    cleanupFailed = true;
  }

  if (cleanupFailed) throw fixedError('SHARED_CANVAS_RUNTIME_CLEANUP_FAILED');
  if (primaryError !== undefined) throw primaryError;
  if (managedProcess === undefined || !stopped || controlApi === undefined) {
    throw fixedError('SHARED_CANVAS_RUNTIME_START_FAILED');
  }

  return {
    status: 'harness-ready',
    code: 'A_REM_VAL_3_RUNTIME_HARNESS_READY',
    controlApiRequestCount,
    storyCanvasStarted: true,
    storyCanvasStopped: true,
    dataRootRemoved: true,
  };
}
