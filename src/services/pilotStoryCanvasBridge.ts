import type { PilotCanvasEntry, PilotContentProductionApi } from './pilotContentProductionApi';
import { PilotApiError } from './pilotApiTransport';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CYCLE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const HANDLE_PATTERN = /^ce_[A-Za-z0-9_-]{32,64}$/;
const SESSION_PATTERN = /^pcs_[A-Za-z0-9_-]{32,64}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const SAFE_STATUSES = new Set([401, 403, 404, 409, 410, 422, 500, 503]);
const ENTRY_TTL_SECONDS = 120;
const ENTRY_MAX_ATTEMPTS = 2;

export interface PilotStoryCanvasPackageReference {
  tenantId: string;
  projectId: string;
  packageId: string;
}

export interface PilotStoryCanvasEntryReference extends PilotStoryCanvasPackageReference {
  handle: string;
}

export interface PilotStoryCanvasBootstrap {
  schemaVersion: 'pilot-canvas-bootstrap.v1';
  status: 'ready';
  projectId: string;
  packageId: string;
  canvasSessionId: string;
  expiresAt: string;
  requestId: string;
}

export interface PilotStoryCanvasEntryPort {
  openEntry(entry: PilotStoryCanvasEntryReference): Promise<PilotStoryCanvasBootstrap>;
}

export type PilotStoryCanvasBridgePhase = 'creating-entry' | 'redeeming' | 'ready';

export interface OpenPilotStoryCanvasInput extends PilotStoryCanvasPackageReference {
  bootstrapCycleId: string;
}

export interface OpenPilotStoryCanvasOptions {
  signal?: AbortSignal;
  onPhase?: (phase: PilotStoryCanvasBridgePhase) => void;
}

export interface PilotStoryCanvasBridge {
  open(
    input: OpenPilotStoryCanvasInput,
    options?: OpenPilotStoryCanvasOptions,
  ): Promise<PilotStoryCanvasBootstrap>;
}

export interface PilotStoryCanvasBridgeDependencies {
  contentApi: Pick<PilotContentProductionApi, 'createCanvasEntry'>;
  canvasPort: PilotStoryCanvasEntryPort;
}

export class PilotStoryCanvasBridgeError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly requestId: string | null;

  constructor(status: number, code: string, retryable: boolean, requestId: string | null) {
    super('Pilot StoryCanvas could not be opened.');
    this.name = 'PilotStoryCanvasBridgeError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.requestId = requestId;
  }
}

function safeRequestId(value: unknown): string | null {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value) ? value : null;
}

function safeCode(value: unknown, fallback: string): string {
  return typeof value === 'string' && ERROR_CODE_PATTERN.test(value) ? value : fallback;
}

function assertInput(input: OpenPilotStoryCanvasInput): void {
  if (
    !input ||
    typeof input !== 'object' ||
    !UUID_PATTERN.test(input.tenantId) ||
    !UUID_PATTERN.test(input.projectId) ||
    !UUID_PATTERN.test(input.packageId) ||
    !CYCLE_PATTERN.test(input.bootstrapCycleId)
  ) {
    throw new PilotStoryCanvasBridgeError(422, 'PILOT_CANVAS_INPUT_INVALID', false, null);
  }
}

function exactEntryReference(
  entry: PilotCanvasEntry,
  input: OpenPilotStoryCanvasInput,
): PilotStoryCanvasEntryReference {
  if (
    !HANDLE_PATTERN.test(entry.handle) ||
    entry.tenantId !== input.tenantId ||
    entry.projectId !== input.projectId ||
    entry.packageId !== input.packageId
  ) {
    throw new PilotStoryCanvasBridgeError(500, 'PILOT_CANVAS_ENTRY_SCOPE_INVALID', false, null);
  }
  return {
    handle: entry.handle,
    tenantId: entry.tenantId,
    projectId: entry.projectId,
    packageId: entry.packageId,
  };
}

function exactBootstrap(
  value: PilotStoryCanvasBootstrap,
  input: OpenPilotStoryCanvasInput,
): PilotStoryCanvasBootstrap {
  const candidate = value as unknown as Record<string, unknown>;
  const expectedKeys = [
    'canvasSessionId',
    'expiresAt',
    'packageId',
    'projectId',
    'requestId',
    'schemaVersion',
    'status',
  ];
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    JSON.stringify(Object.keys(candidate).sort()) !== JSON.stringify(expectedKeys) ||
    value.schemaVersion !== 'pilot-canvas-bootstrap.v1' ||
    value.status !== 'ready' ||
    value.projectId !== input.projectId ||
    value.packageId !== input.packageId ||
    !SESSION_PATTERN.test(value.canvasSessionId) ||
    !Number.isFinite(Date.parse(value.expiresAt)) ||
    !REQUEST_ID_PATTERN.test(value.requestId)
  ) {
    throw new PilotStoryCanvasBridgeError(500, 'PILOT_CANVAS_BOOTSTRAP_INVALID', false, null);
  }
  return value;
}

function errorShape(value: unknown): {
  status?: unknown;
  code?: unknown;
  retryable?: unknown;
  requestId?: unknown;
} | null {
  return value && typeof value === 'object'
    ? (value as {
        status?: unknown;
        code?: unknown;
        retryable?: unknown;
        requestId?: unknown;
      })
    : null;
}

function normalizeControlError(error: unknown): PilotStoryCanvasBridgeError {
  if (error instanceof PilotStoryCanvasBridgeError) return error;
  if (error instanceof PilotApiError && error.status !== null && SAFE_STATUSES.has(error.status)) {
    return new PilotStoryCanvasBridgeError(
      error.status,
      safeCode(error.code, 'PILOT_CANVAS_ENTRY_FAILED'),
      error.retryable,
      safeRequestId(error.requestId),
    );
  }
  return new PilotStoryCanvasBridgeError(503, 'PILOT_CANVAS_DEPENDENCY_UNAVAILABLE', true, null);
}

function normalizePortError(error: unknown): PilotStoryCanvasBridgeError {
  if (error instanceof PilotStoryCanvasBridgeError) return error;
  const shape = errorShape(error);
  if (
    shape &&
    typeof shape.status === 'number' &&
    SAFE_STATUSES.has(shape.status) &&
    typeof shape.retryable === 'boolean'
  ) {
    return new PilotStoryCanvasBridgeError(
      shape.status,
      safeCode(shape.code, 'PILOT_CANVAS_BOOTSTRAP_FAILED'),
      shape.retryable,
      safeRequestId(shape.requestId),
    );
  }
  return new PilotStoryCanvasBridgeError(500, 'PILOT_CANVAS_BOOTSTRAP_FAILED', false, null);
}

function cycleKey(input: OpenPilotStoryCanvasInput): string {
  return `${input.tenantId}:${input.projectId}:${input.packageId}:${input.bootstrapCycleId}`;
}

function entryIdempotencyKey(input: OpenPilotStoryCanvasInput): string {
  return `pilot-canvas-entry-v1:${input.projectId}:${input.packageId}:${input.bootstrapCycleId}`;
}

export function createPilotStoryCanvasBridge(
  dependencies: PilotStoryCanvasBridgeDependencies,
): PilotStoryCanvasBridge {
  const cycles = new Map<string, Promise<PilotStoryCanvasBootstrap>>();

  return {
    open(input, options = {}) {
      try {
        assertInput(input);
      } catch (error) {
        return Promise.reject(error);
      }

      const key = cycleKey(input);
      const existing = cycles.get(key);
      if (existing) return existing;

      const pending = (async () => {
        options.onPhase?.('creating-entry');
        let entry: PilotCanvasEntry;
        try {
          const result = await dependencies.contentApi.createCanvasEntry(
            input.projectId,
            { packageId: input.packageId, ttlSeconds: ENTRY_TTL_SECONDS },
            entryIdempotencyKey(input),
            { maxAttempts: ENTRY_MAX_ATTEMPTS, signal: options.signal },
          );
          entry = result.value;
        } catch (error) {
          throw normalizeControlError(error);
        }

        const reference = exactEntryReference(entry, input);
        options.onPhase?.('redeeming');
        let bootstrap: PilotStoryCanvasBootstrap;
        try {
          bootstrap = await dependencies.canvasPort.openEntry(reference);
        } catch (error) {
          throw normalizePortError(error);
        }

        const exact = exactBootstrap(bootstrap, input);
        options.onPhase?.('ready');
        return exact;
      })();

      cycles.set(key, pending);
      void pending.catch(() => {
        if (cycles.get(key) === pending) cycles.delete(key);
      });
      return pending;
    },
  };
}
