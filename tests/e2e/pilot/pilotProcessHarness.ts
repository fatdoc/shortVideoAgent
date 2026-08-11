import { spawn, type ChildProcessByStdio, type SpawnOptionsWithoutStdio } from 'node:child_process';
import type { Readable } from 'node:stream';

const DEFAULT_OUTPUT_LIMIT_BYTES = 64 * 1024;
const DEFAULT_READINESS_INTERVAL_MS = 50;
const DEFAULT_STOP_TIMEOUT_MS = 5_000;
const MIN_TIMEOUT_MS = 1;

type PilotChildProcess = ChildProcessByStdio<null, Readable, Readable>;

export interface PilotProcessOutput {
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
}

export interface PilotProcessStatus {
  pid: number | undefined;
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
  stopped: boolean;
}

export interface PilotManagedProcess {
  output(): PilotProcessOutput;
  status(): PilotProcessStatus;
  stop(): Promise<void>;
}

export interface PilotProcessSpec {
  command: string;
  args: readonly string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  readinessProbe: (process: PilotManagedProcess) => boolean | Promise<boolean>;
  readinessTimeoutMs: number;
  readinessIntervalMs?: number;
  outputLimitBytes?: number;
  stopTimeoutMs?: number;
}

type TerminalState =
  { kind: 'error' } | { kind: 'exit'; code: number | null; signal: NodeJS.Signals | null };

type ReadinessOutcome = { kind: 'ready' } | { kind: 'retry' } | { kind: 'timeout' } | TerminalState;

interface BoundedCapture {
  chunks: Buffer[];
  bytes: number;
  truncated: boolean;
}

function fixedError(code: string): Error {
  const error = new Error(code);
  error.stack = undefined;
  return error;
}

function positiveInteger(value: number | undefined, fallback?: number): number {
  const resolved = value ?? fallback;
  if (resolved === undefined || !Number.isSafeInteger(resolved) || resolved < MIN_TIMEOUT_MS) {
    throw fixedError('PILOT_E2E_PROCESS_CONFIG_INVALID');
  }
  return resolved;
}

function validateSpec(spec: PilotProcessSpec): {
  outputLimitBytes: number;
  readinessIntervalMs: number;
  readinessTimeoutMs: number;
  stopTimeoutMs: number;
} {
  if (
    typeof spec.command !== 'string' ||
    spec.command.length === 0 ||
    !Array.isArray(spec.args) ||
    typeof spec.cwd !== 'string' ||
    spec.cwd.length === 0 ||
    typeof spec.env !== 'object' ||
    spec.env === null ||
    typeof spec.readinessProbe !== 'function'
  ) {
    throw fixedError('PILOT_E2E_PROCESS_CONFIG_INVALID');
  }
  if (spec.args.some((argument) => typeof argument !== 'string')) {
    throw fixedError('PILOT_E2E_PROCESS_CONFIG_INVALID');
  }
  return {
    outputLimitBytes: positiveInteger(spec.outputLimitBytes, DEFAULT_OUTPUT_LIMIT_BYTES),
    readinessIntervalMs: positiveInteger(spec.readinessIntervalMs, DEFAULT_READINESS_INTERVAL_MS),
    readinessTimeoutMs: positiveInteger(spec.readinessTimeoutMs),
    stopTimeoutMs: positiveInteger(spec.stopTimeoutMs, DEFAULT_STOP_TIMEOUT_MS),
  };
}

function appendBounded(capture: BoundedCapture, chunk: Buffer, limit: number): void {
  if (capture.bytes >= limit) {
    capture.truncated = true;
    return;
  }
  const remaining = limit - capture.bytes;
  if (chunk.length <= remaining) {
    capture.chunks.push(Buffer.from(chunk));
    capture.bytes += chunk.length;
    return;
  }
  capture.chunks.push(Buffer.from(chunk.subarray(0, remaining)));
  capture.bytes += remaining;
  capture.truncated = true;
}

function delay<T>(milliseconds: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds, value));
}

class ManagedPilotProcess implements PilotManagedProcess {
  readonly #child: PilotChildProcess;
  readonly #outputLimitBytes: number;
  readonly #readinessIntervalMs: number;
  readonly #readinessTimeoutMs: number;
  readonly #stopTimeoutMs: number;
  readonly #readinessProbe: PilotProcessSpec['readinessProbe'];
  readonly #stdout: BoundedCapture = { chunks: [], bytes: 0, truncated: false };
  readonly #stderr: BoundedCapture = { chunks: [], bytes: 0, truncated: false };
  readonly #terminal: Promise<TerminalState>;
  readonly #spawned: Promise<'spawned' | TerminalState>;
  readonly #onStopped: (process: ManagedPilotProcess) => void;
  #terminalState: TerminalState | undefined;
  #stopPromise: Promise<void> | undefined;
  #stopped = false;

  constructor(
    child: PilotChildProcess,
    spec: PilotProcessSpec,
    validated: ReturnType<typeof validateSpec>,
    onStopped: (process: ManagedPilotProcess) => void,
  ) {
    this.#child = child;
    this.#outputLimitBytes = validated.outputLimitBytes;
    this.#readinessIntervalMs = validated.readinessIntervalMs;
    this.#readinessTimeoutMs = validated.readinessTimeoutMs;
    this.#stopTimeoutMs = validated.stopTimeoutMs;
    this.#readinessProbe = spec.readinessProbe;
    this.#onStopped = onStopped;

    child.stdout.on('data', (chunk: Buffer) =>
      appendBounded(this.#stdout, chunk, this.#outputLimitBytes),
    );
    child.stderr.on('data', (chunk: Buffer) =>
      appendBounded(this.#stderr, chunk, this.#outputLimitBytes),
    );

    this.#terminal = new Promise<TerminalState>((resolve) => {
      const finish = (state: TerminalState) => {
        if (this.#terminalState) return;
        this.#terminalState = state;
        resolve(state);
      };
      child.once('error', () => finish({ kind: 'error' }));
      child.once('exit', (code, signal) => finish({ kind: 'exit', code, signal }));
    });
    this.#spawned = new Promise<'spawned' | TerminalState>((resolve) => {
      child.once('spawn', () => resolve('spawned'));
      void this.#terminal.then(resolve);
    });
  }

  async waitUntilReady(): Promise<void> {
    const spawnOutcome = await this.#spawned;
    if (spawnOutcome !== 'spawned') throw this.#terminalError(spawnOutcome);

    const deadline = Date.now() + this.#readinessTimeoutMs;
    while (true) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) throw fixedError('PILOT_E2E_CHILD_NOT_READY');

      const probe: Promise<ReadinessOutcome> = Promise.resolve()
        .then(() => this.#readinessProbe(this))
        .then((ready): ReadinessOutcome => (ready ? { kind: 'ready' } : { kind: 'retry' }))
        .catch((): ReadinessOutcome => ({ kind: 'retry' }));
      const outcome = await Promise.race<ReadinessOutcome>([
        probe,
        this.#terminal,
        delay(remainingMs, { kind: 'timeout' }),
      ]);

      if (outcome.kind === 'ready') return;
      if (outcome.kind === 'error' || outcome.kind === 'exit') {
        throw this.#terminalError(outcome);
      }
      if (outcome.kind === 'timeout') throw fixedError('PILOT_E2E_CHILD_NOT_READY');

      const retryRemainingMs = deadline - Date.now();
      if (retryRemainingMs <= 0) throw fixedError('PILOT_E2E_CHILD_NOT_READY');
      const retryOutcome = await Promise.race<ReadinessOutcome>([
        this.#terminal,
        delay(Math.min(this.#readinessIntervalMs, retryRemainingMs), { kind: 'retry' }),
      ]);
      if (retryOutcome.kind === 'error' || retryOutcome.kind === 'exit') {
        throw this.#terminalError(retryOutcome);
      }
    }
  }

  output(): PilotProcessOutput {
    return {
      stdout: Buffer.concat(this.#stdout.chunks, this.#stdout.bytes).toString('utf8'),
      stderr: Buffer.concat(this.#stderr.chunks, this.#stderr.bytes).toString('utf8'),
      stdoutTruncated: this.#stdout.truncated,
      stderrTruncated: this.#stderr.truncated,
    };
  }

  status(): PilotProcessStatus {
    return {
      pid: this.#child.pid,
      exitCode: this.#child.exitCode,
      signalCode: this.#child.signalCode,
      stopped: this.#stopped,
    };
  }

  stop(): Promise<void> {
    if (!this.#stopPromise) {
      this.#stopPromise = Promise.resolve().then(() => this.#stopOnce());
    }
    return this.#stopPromise;
  }

  async #stopOnce(): Promise<void> {
    try {
      if (!this.#terminalState) {
        this.#signal('SIGTERM');
        const termOutcome = await Promise.race<TerminalState | 'timeout'>([
          this.#terminal,
          delay(this.#stopTimeoutMs, 'timeout'),
        ]);
        if (termOutcome === 'timeout' && !this.#terminalState) {
          this.#signal('SIGKILL');
          const killOutcome = await Promise.race<TerminalState | 'timeout'>([
            this.#terminal,
            delay(this.#stopTimeoutMs, 'timeout'),
          ]);
          if (killOutcome === 'timeout') throw fixedError('PILOT_E2E_CHILD_STOP_FAILED');
        }
      }
    } finally {
      this.#stopped = true;
      this.#onStopped(this);
    }
  }

  #signal(signal: NodeJS.Signals): void {
    try {
      this.#child.kill(signal);
    } catch {
      // Never expose platform errors, command details, environment, or child diagnostics.
    }
  }

  #terminalError(state: TerminalState): Error {
    return fixedError(
      state.kind === 'error' ? 'PILOT_E2E_CHILD_SPAWN_FAILED' : 'PILOT_E2E_CHILD_EXITED',
    );
  }
}

export class PilotProcessHarness {
  #processes: ManagedPilotProcess[] = [];
  #stopPromise: Promise<void> | undefined;

  get size(): number {
    return this.#processes.length;
  }

  async start(spec: PilotProcessSpec): Promise<PilotManagedProcess> {
    if (this.#stopPromise) throw fixedError('PILOT_E2E_PROCESS_HARNESS_STOPPED');

    let validated: ReturnType<typeof validateSpec>;
    try {
      validated = validateSpec(spec);
    } catch {
      await this.#stopAfterFailure();
      throw fixedError('PILOT_E2E_PROCESS_CONFIG_INVALID');
    }

    let child: PilotChildProcess;
    try {
      const spawnOptions: SpawnOptionsWithoutStdio = {
        cwd: spec.cwd,
        env: { ...spec.env },
        shell: false,
      };
      child = spawn(spec.command, [...spec.args], {
        ...spawnOptions,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {
      await this.#stopAfterFailure();
      throw fixedError('PILOT_E2E_CHILD_SPAWN_FAILED');
    }

    const managed = new ManagedPilotProcess(child, spec, validated, (stopped) => {
      this.#processes = this.#processes.filter((process) => process !== stopped);
    });
    this.#processes.push(managed);

    try {
      await managed.waitUntilReady();
      return managed;
    } catch (error) {
      await this.#stopAfterFailure();
      if (error instanceof Error && error.message.startsWith('PILOT_E2E_')) throw error;
      throw fixedError('PILOT_E2E_CHILD_START_FAILED');
    }
  }

  stop(): Promise<void> {
    if (!this.#stopPromise) {
      this.#stopPromise = Promise.resolve().then(() => this.#stopAll());
    }
    return this.#stopPromise;
  }

  async #stopAfterFailure(): Promise<void> {
    try {
      await this.stop();
    } catch {
      // Preserve the original fixed start/readiness error code.
    }
  }

  async #stopAll(): Promise<void> {
    let failed = false;
    for (const process of [...this.#processes].reverse()) {
      try {
        await process.stop();
      } catch {
        failed = true;
      }
    }
    if (failed) throw fixedError('PILOT_E2E_CHILD_STOP_FAILED');
  }
}
