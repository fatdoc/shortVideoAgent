import {
  CanvasV1ContractError,
  parseCanvasV1BrowserContract,
  type CanvasBootstrapV01,
} from '../model/contracts';
import {
  CanvasWorkspaceContractError,
  parseCanvasWorkspaceV01,
  type CanvasWorkspaceV01,
} from '../model/workspaceContract';
import { PilotStoryCanvasBridgeError, bridgeError } from './errors';

export const CANONICAL_CANVAS_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const HANDLE = /^ce_[A-Za-z0-9_-]{32,64}$/u;
const CANVAS_SESSION = /^pcs_[A-Za-z0-9_-]{24,128}$/u;
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export interface CanvasRouteSelection {
  projectId: string;
  packageId: string;
}

export interface CanvasSessionSelection extends CanvasRouteSelection {
  canvasSessionId: string;
}

export interface CanvasEntryV02 extends CanvasRouteSelection {
  objectType: 'CanvasEntry';
  contractVersion: '0.2';
  handle: string;
  tenantId: string;
  state: 'active';
  issuedAt: string;
  expiresAt: string;
}

export interface CanvasActivationResponse {
  entry: CanvasEntryV02;
  replayed: boolean;
  requestId: string;
}

export interface LegacyCanvasOpenRequest extends CanvasRouteSelection {
  handle: string;
  tenantId: string;
}

export interface LegacyCanvasOpenResponse extends CanvasRouteSelection {
  schemaVersion: 'pilot-canvas-bootstrap.v1';
  status: 'ready';
  canvasSessionId: string;
  expiresAt: string;
  requestId: string;
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw bridgeError(code);
  }
  return value as Record<string, unknown>;
}

function exact(value: unknown, keys: readonly string[], code: string): Record<string, unknown> {
  const output = record(value, code);
  if (Object.keys(output).sort().join('\0') !== [...keys].sort().join('\0')) {
    throw bridgeError(code);
  }
  return output;
}

function uuid(value: unknown, code: string): string {
  if (typeof value !== 'string' || !CANONICAL_CANVAS_UUID.test(value)) throw bridgeError(code);
  return value;
}

function canonicalTimestamp(value: unknown, code: string): string {
  if (typeof value !== 'string' || !TIMESTAMP.test(value)) throw bridgeError(code);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw bridgeError(code);
  }
  return value;
}

function requestId(value: unknown, code: string): string {
  if (typeof value !== 'string' || !REQUEST_ID.test(value)) throw bridgeError(code);
  return value;
}

function scanActivationResponse(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(scanActivationResponse);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.replace(/[^a-z]/giu, '').toLowerCase();
    if (
      normalized.includes('idempotency') ||
      normalized.includes('digest') ||
      normalized.includes('grant') ||
      normalized.includes('secret') ||
      normalized.includes('token') ||
      normalized.includes('packagesnapshot')
    ) {
      throw bridgeError('CANVAS_BROWSER_PROJECTION_UNSAFE');
    }
    if (
      typeof item === 'string' &&
      /(?:asset:\/\/|bearer\s|x-amz-|x-tos-|access_token=)/iu.test(item)
    ) {
      throw bridgeError('CANVAS_BROWSER_PROJECTION_UNSAFE');
    }
    scanActivationResponse(item);
  }
}

export function parseCanonicalCanvasRouteSelection(input: {
  projectId: string | undefined;
  search: string;
}): CanvasRouteSelection {
  if (!input.projectId || !CANONICAL_CANVAS_UUID.test(input.projectId)) {
    throw bridgeError('CANVAS_ACTIVATION_PROJECT_INVALID');
  }
  const params = new URLSearchParams(input.search);
  const keys = [...params.keys()];
  const packages = params.getAll('packageId');
  if (packages.length === 0) throw bridgeError('CANVAS_ACTIVATION_PACKAGE_REQUIRED');
  if (keys.length !== 1 || packages.length !== 1) {
    throw bridgeError('CANVAS_ACTIVATION_INPUT_INVALID');
  }
  const packageId = packages[0];
  if (!packageId || !CANONICAL_CANVAS_UUID.test(packageId)) {
    throw bridgeError('CANVAS_ACTIVATION_PACKAGE_INVALID');
  }
  return { projectId: input.projectId, packageId };
}

export function createCanvasActivationAttemptId(
  randomUuid: () => string = () => globalThis.crypto.randomUUID(),
): string {
  const value = randomUuid();
  if (!CANONICAL_CANVAS_UUID.test(value)) throw bridgeError('CANVAS_ACTIVATION_INPUT_INVALID');
  return value;
}

export function parseCanvasActivationResponse(
  input: unknown,
  expected: CanvasRouteSelection,
  replayHeader: string | null = null,
): CanvasActivationResponse {
  if (replayHeader !== null) throw bridgeError('CANVAS_ACTIVATION_RESPONSE_INVALID');
  scanActivationResponse(input);
  const output = exact(input, ['entry', 'replayed', 'requestId'], 'CANVAS_ACTIVATION_RESPONSE_INVALID');
  const rawEntry = exact(
    output.entry,
    [
      'objectType',
      'contractVersion',
      'handle',
      'tenantId',
      'projectId',
      'packageId',
      'state',
      'issuedAt',
      'expiresAt',
    ],
    'CANVAS_ACTIVATION_RESPONSE_INVALID',
  );
  if (
    rawEntry.objectType !== 'CanvasEntry' ||
    rawEntry.contractVersion !== '0.2' ||
    rawEntry.state !== 'active' ||
    typeof rawEntry.handle !== 'string' ||
    !HANDLE.test(rawEntry.handle) ||
    typeof output.replayed !== 'boolean'
  ) {
    throw bridgeError('CANVAS_ACTIVATION_RESPONSE_INVALID');
  }
  const entry: CanvasEntryV02 = {
    objectType: 'CanvasEntry',
    contractVersion: '0.2',
    handle: rawEntry.handle,
    tenantId: uuid(rawEntry.tenantId, 'CANVAS_ACTIVATION_RESPONSE_INVALID'),
    projectId: uuid(rawEntry.projectId, 'CANVAS_ACTIVATION_RESPONSE_INVALID'),
    packageId: uuid(rawEntry.packageId, 'CANVAS_ACTIVATION_RESPONSE_INVALID'),
    state: 'active',
    issuedAt: canonicalTimestamp(rawEntry.issuedAt, 'CANVAS_ACTIVATION_RESPONSE_INVALID'),
    expiresAt: canonicalTimestamp(rawEntry.expiresAt, 'CANVAS_ACTIVATION_RESPONSE_INVALID'),
  };
  if (entry.projectId !== expected.projectId || entry.packageId !== expected.packageId) {
    throw bridgeError('CANVAS_ACTIVATION_SCOPE_MISMATCH');
  }
  if (Date.parse(entry.issuedAt) >= Date.parse(entry.expiresAt)) {
    throw bridgeError('CANVAS_ACTIVATION_RESPONSE_INVALID');
  }
  return {
    entry,
    replayed: output.replayed,
    requestId: requestId(output.requestId, 'CANVAS_ACTIVATION_RESPONSE_INVALID'),
  };
}

export function legacyOpenRequest(entry: CanvasEntryV02): LegacyCanvasOpenRequest {
  return {
    handle: entry.handle,
    tenantId: entry.tenantId,
    projectId: entry.projectId,
    packageId: entry.packageId,
  };
}

export function parseLegacyCanvasOpenResponse(
  input: unknown,
  expected: CanvasRouteSelection,
): LegacyCanvasOpenResponse {
  const output = exact(
    input,
    ['schemaVersion', 'status', 'projectId', 'packageId', 'canvasSessionId', 'expiresAt', 'requestId'],
    'PILOT_CANVAS_BOOTSTRAP_INVALID',
  );
  if (
    output.schemaVersion !== 'pilot-canvas-bootstrap.v1' ||
    output.status !== 'ready' ||
    typeof output.canvasSessionId !== 'string' ||
    !CANVAS_SESSION.test(output.canvasSessionId)
  ) {
    throw bridgeError('PILOT_CANVAS_BOOTSTRAP_INVALID');
  }
  const value: LegacyCanvasOpenResponse = {
    schemaVersion: 'pilot-canvas-bootstrap.v1',
    status: 'ready',
    projectId: uuid(output.projectId, 'PILOT_CANVAS_BOOTSTRAP_INVALID'),
    packageId: uuid(output.packageId, 'PILOT_CANVAS_BOOTSTRAP_INVALID'),
    canvasSessionId: output.canvasSessionId,
    expiresAt: canonicalTimestamp(output.expiresAt, 'PILOT_CANVAS_BOOTSTRAP_INVALID'),
    requestId: requestId(output.requestId, 'PILOT_CANVAS_BOOTSTRAP_INVALID'),
  };
  if (value.projectId !== expected.projectId || value.packageId !== expected.packageId) {
    throw bridgeError('CANVAS_ACTIVATION_SCOPE_MISMATCH');
  }
  return value;
}

export function parseFormalCanvasBootstrap(
  input: unknown,
  expected: CanvasSessionSelection,
): CanvasBootstrapV01 {
  let parsed;
  try {
    parsed = parseCanvasV1BrowserContract(input);
  } catch (error) {
    if (error instanceof CanvasV1ContractError) throw error;
    throw bridgeError('CANVAS_SCHEMA_INVALID');
  }
  if (parsed.objectType !== 'CanvasBootstrap') throw bridgeError('CANVAS_SCHEMA_INVALID');
  if (
    parsed.projectId !== expected.projectId ||
    parsed.packageId !== expected.packageId ||
    parsed.canvasSessionId !== expected.canvasSessionId
  ) {
    throw bridgeError('CANVAS_SCOPE_MISMATCH');
  }
  return parsed;
}

export function parseFormalCanvasWorkspace(
  input: unknown,
  expected: CanvasSessionSelection,
): CanvasWorkspaceV01 {
  try {
    const parsed = parseCanvasWorkspaceV01(input);
    if (
      parsed.projectId !== expected.projectId ||
      parsed.packageId !== expected.packageId ||
      parsed.canvasSessionId !== expected.canvasSessionId
    ) {
      throw bridgeError('CANVAS_WORKSPACE_SCOPE_MISMATCH');
    }
    return parsed;
  } catch (error) {
    if (
      error instanceof CanvasWorkspaceContractError ||
      error instanceof PilotStoryCanvasBridgeError
    ) {
      throw error;
    }
    throw bridgeError('CANVAS_WORKSPACE_SCHEMA_INVALID');
  }
}
