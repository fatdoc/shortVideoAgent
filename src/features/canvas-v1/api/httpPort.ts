import {
  parseCanvasV1BrowserContract,
  type AssetRecordV01,
  type CanvasCommandV01,
  type CanvasDocumentV01,
  type CanvasEventV01,
  type ShotReadinessV01,
} from '../model/contracts';
import type { CanvasWorkspaceV01 } from '../model/workspaceContract';
import {
  CANONICAL_CANVAS_UUID,
  legacyOpenRequest,
  parseCanvasActivationResponse,
  parseFormalCanvasBootstrap,
  parseFormalCanvasWorkspace,
  parseLegacyCanvasOpenResponse,
  type CanvasActivationResponse,
  type CanvasRouteSelection,
  type LegacyCanvasOpenRequest,
  type LegacyCanvasOpenResponse,
} from './activation';
import { PilotStoryCanvasBridgeError, bridgeError } from './errors';

const CSRF = /^[A-Za-z0-9_-]{43,128}$/u;
const ENTRY_HANDLE = /^ce_[A-Za-z0-9_-]{32,64}$/u;
const SESSION = /^pcs_[A-Za-z0-9_-]{24,128}$/u;
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const HIGH_COST_COMMANDS = new Set([
  'CREATE_VIRTUAL_CHARACTER',
  'BIND_ASSET_TO_ENTITY',
  'GENERATE_SHOT',
  'SELECT_SHOT_OUTPUT',
  'EXPORT_PLAYLIST',
]);

export type CanvasFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface CanvasApprovalPrepareRequest {
  packageId: string;
  canvasSessionId: string;
  commandType:
    | 'CREATE_VIRTUAL_CHARACTER'
    | 'BIND_ASSET_TO_ENTITY'
    | 'GENERATE_SHOT'
    | 'SELECT_SHOT_OUTPUT'
    | 'EXPORT_PLAYLIST';
  action: { commandId: string; payload: CanvasCommandV01['payload'] };
  expiresInSeconds: 60;
  replayPolicy: 'single_use_replay_same_command';
}

function strictLegacyOpenRequest(input: LegacyCanvasOpenRequest): LegacyCanvasOpenRequest {
  const output = exact(
    input,
    ['handle', 'tenantId', 'projectId', 'packageId'],
    'PILOT_CANVAS_BOOTSTRAP_INVALID',
  );
  if (typeof output.handle !== 'string' || !ENTRY_HANDLE.test(output.handle)) {
    throw bridgeError('PILOT_CANVAS_BOOTSTRAP_INVALID');
  }
  return legacyOpenRequest({
    objectType: 'CanvasEntry',
    contractVersion: '0.2',
    handle: output.handle,
    tenantId: validUuid(String(output.tenantId), 'PILOT_CANVAS_BOOTSTRAP_INVALID'),
    projectId: validUuid(String(output.projectId), 'PILOT_CANVAS_BOOTSTRAP_INVALID'),
    packageId: validUuid(String(output.packageId), 'PILOT_CANVAS_BOOTSTRAP_INVALID'),
    state: 'active',
    issuedAt: '2000-01-01T00:00:00.000Z',
    expiresAt: '2000-01-01T00:00:00.001Z',
  });
}

export interface CanvasApprovalProjection {
  approvalId: string;
  status: 'active';
}

export interface PilotStoryCanvasHttpPort {
  acquireControlCsrf(projectId: string): Promise<string>;
  activate(
    projectId: string,
    packageId: string,
    input: { activationAttemptId: string },
    csrfToken: string,
  ): Promise<CanvasActivationResponse>;
  openLegacy(input: LegacyCanvasOpenRequest): Promise<LegacyCanvasOpenResponse>;
  readBootstrap(canvasSessionId: string, selection: CanvasRouteSelection): Promise<ReturnType<typeof parseFormalCanvasBootstrap>>;
  readWorkspace(canvasSessionId: string, selection: CanvasRouteSelection): Promise<CanvasWorkspaceV01>;
  readDocument(canvasSessionId: string, documentId: string): Promise<CanvasDocumentV01>;
  readAssets(canvasSessionId: string): Promise<AssetRecordV01[]>;
  readReadiness(canvasSessionId: string, shotId: string): Promise<ShotReadinessV01>;
  prepareApproval(
    projectId: string,
    input: CanvasApprovalPrepareRequest,
    csrfToken: string,
  ): Promise<CanvasApprovalProjection>;
  dispatch(command: CanvasCommandV01): Promise<CanvasEventV01>;
}

function requestId(response: Response): string | null {
  const value = response.headers.get('x-request-id');
  return value && REQUEST_ID.test(value) ? value : null;
}

function exact(value: unknown, keys: readonly string[], code: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw bridgeError(code);
  const output = value as Record<string, unknown>;
  if (Object.keys(output).sort().join('\0') !== [...keys].sort().join('\0')) {
    throw bridgeError(code);
  }
  return output;
}

function safeServerError(value: unknown, response: Response): PilotStoryCanvasBridgeError {
  try {
    const envelope = exact(value, ['error'], 'CANVAS_TRANSPORT_UNAVAILABLE');
    const error = exact(
      envelope.error,
      ['code', 'message', 'retryable', 'requestId'],
      'CANVAS_TRANSPORT_UNAVAILABLE',
    );
    if (
      typeof error.code !== 'string' ||
      !/^[A-Z][A-Z0-9_]{2,100}$/u.test(error.code) ||
      typeof error.message !== 'string' ||
      error.message.length < 1 ||
      error.message.length > 160 ||
      /(?:asset:\/\/|bearer\s|x-amz-|x-tos-|token|credential|secret|digest|grant)/iu.test(
        error.message,
      ) ||
      typeof error.retryable !== 'boolean' ||
      typeof error.requestId !== 'string' ||
      !REQUEST_ID.test(error.requestId)
    ) {
      throw bridgeError('CANVAS_TRANSPORT_UNAVAILABLE');
    }
    return bridgeError(error.code, {
      status: response.status,
      retryable: error.retryable,
      requestId: error.requestId,
    });
  } catch (error) {
    if (
      error instanceof PilotStoryCanvasBridgeError &&
      error.code !== 'CANVAS_TRANSPORT_UNAVAILABLE'
    ) {
      return error;
    }
    return bridgeError('CANVAS_TRANSPORT_UNAVAILABLE', {
      status: response.status,
      retryable: response.status >= 500,
      requestId: requestId(response),
    });
  }
}

async function responseJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) {
    throw bridgeError('CANVAS_TRANSPORT_INVALID_RESPONSE', {
      status: response.status,
      requestId: requestId(response),
    });
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw bridgeError('CANVAS_TRANSPORT_INVALID_RESPONSE', {
      status: response.status,
      requestId: requestId(response),
    });
  }
  if (!response.ok) throw safeServerError(value, response);
  return value;
}

function baseInit(method: 'GET' | 'POST', headers: HeadersInit): RequestInit {
  return {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    headers,
  };
}

async function safeFetch(fetchImpl: CanvasFetch, path: string, init: RequestInit): Promise<Response> {
  if (!path.startsWith('/api/') || path.startsWith('//') || path.includes('://')) {
    throw bridgeError('CANVAS_TRANSPORT_PATH_INVALID');
  }
  try {
    return await fetchImpl(path, init);
  } catch (error) {
    if (error instanceof PilotStoryCanvasBridgeError) throw error;
    throw bridgeError('CANVAS_TRANSPORT_UNAVAILABLE', { retryable: true });
  }
}

function validUuid(value: string, code = 'CANVAS_SCHEMA_INVALID'): string {
  if (!CANONICAL_CANVAS_UUID.test(value)) throw bridgeError(code);
  return value;
}

function validSession(value: string): string {
  if (!SESSION.test(value)) throw bridgeError('CANVAS_SESSION_INVALID');
  return value;
}

function validCsrf(value: string): string {
  if (!CSRF.test(value)) throw bridgeError('CANVAS_CSRF_INVALID');
  return value;
}

function canvasHeaders(canvasSessionId: string, mutation = false): Record<string, string> {
  return {
    accept: 'application/json',
    'x-canvas-session-id': validSession(canvasSessionId),
    ...(mutation ? { 'content-type': 'application/json', 'x-storycanvas-csrf': 'pilot-canvas-v1' } : {}),
  };
}

function parseDocumentEnvelope(value: unknown): CanvasDocumentV01 {
  const envelope = exact(value, ['document', 'requestId'], 'CANVAS_SCHEMA_INVALID');
  if (typeof envelope.requestId !== 'string' || !REQUEST_ID.test(envelope.requestId)) {
    throw bridgeError('CANVAS_SCHEMA_INVALID');
  }
  const document = parseCanvasV1BrowserContract(envelope.document);
  if (document.objectType !== 'CanvasDocument') throw bridgeError('CANVAS_SCHEMA_INVALID');
  return document;
}

function parseAssetsEnvelope(value: unknown): AssetRecordV01[] {
  const envelope = exact(value, ['assets', 'requestId'], 'CANVAS_SCHEMA_INVALID');
  if (
    typeof envelope.requestId !== 'string' ||
    !REQUEST_ID.test(envelope.requestId) ||
    !Array.isArray(envelope.assets) ||
    envelope.assets.length > 1000
  ) {
    throw bridgeError('CANVAS_SCHEMA_INVALID');
  }
  return envelope.assets.map((item) => {
    const asset = parseCanvasV1BrowserContract(item);
    if (asset.objectType !== 'AssetRecord') throw bridgeError('CANVAS_SCHEMA_INVALID');
    return asset;
  });
}

function parseReadinessEnvelope(value: unknown): ShotReadinessV01 {
  const envelope = exact(value, ['readiness', 'requestId'], 'CANVAS_SCHEMA_INVALID');
  if (typeof envelope.requestId !== 'string' || !REQUEST_ID.test(envelope.requestId)) {
    throw bridgeError('CANVAS_SCHEMA_INVALID');
  }
  const readiness = parseCanvasV1BrowserContract(envelope.readiness);
  if (readiness.objectType !== 'ShotReadiness') throw bridgeError('CANVAS_SCHEMA_INVALID');
  return readiness;
}

function parseApproval(value: unknown): CanvasApprovalProjection {
  const output = exact(value, ['approvalId', 'status'], 'CANVAS_APPROVAL_INVALID');
  if (
    typeof output.approvalId !== 'string' ||
    !CANONICAL_CANVAS_UUID.test(output.approvalId) ||
    output.status !== 'active'
  ) {
    throw bridgeError('CANVAS_APPROVAL_INVALID');
  }
  return { approvalId: output.approvalId, status: 'active' };
}

function parseEventEnvelope(value: unknown, command: CanvasCommandV01): CanvasEventV01 {
  const envelope = exact(value, ['event', 'requestId'], 'CANVAS_SCHEMA_INVALID');
  if (typeof envelope.requestId !== 'string' || !REQUEST_ID.test(envelope.requestId)) {
    throw bridgeError('CANVAS_SCHEMA_INVALID');
  }
  const event = parseCanvasV1BrowserContract(envelope.event);
  if (
    event.objectType !== 'CanvasEvent' ||
    event.tenantId !== command.tenantId ||
    event.projectId !== command.projectId ||
    event.packageId !== command.packageId ||
    event.canvasSessionId !== command.canvasSessionId ||
    event.commandId !== command.commandId ||
    event.commandType !== command.commandType
  ) {
    throw bridgeError('CANVAS_SCOPE_MISMATCH');
  }
  return event;
}

export function createPilotStoryCanvasHttpPort(options: {
  fetchImpl?: CanvasFetch;
} = {}): PilotStoryCanvasHttpPort {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  return {
    async acquireControlCsrf(projectId) {
      validUuid(projectId);
      const response = await safeFetch(
        fetchImpl,
        `/api/v1/projects/${projectId}/canvas-assets`,
        baseInit('GET', { accept: 'application/json' }),
      );
      if (!response.ok) {
        let value: unknown = null;
        try {
          value = await response.json();
        } catch {
          // The fixed transport error below intentionally does not reflect a response body.
        }
        throw safeServerError(value, response);
      }
      const token = response.headers.get('x-csrf-token');
      if (!token || !CSRF.test(token)) {
        throw bridgeError('CANVAS_CSRF_INVALID', {
          status: response.status,
          requestId: requestId(response),
        });
      }
      return token;
    },

    async activate(projectId, packageId, input, csrfToken) {
      validUuid(projectId, 'CANVAS_ACTIVATION_PROJECT_INVALID');
      validUuid(packageId, 'CANVAS_ACTIVATION_PACKAGE_INVALID');
      validUuid(input.activationAttemptId, 'CANVAS_ACTIVATION_INPUT_INVALID');
      const response = await safeFetch(
        fetchImpl,
        `/api/v1/projects/${projectId}/production-packages/${packageId}/canvas-activation`,
        {
          ...baseInit('POST', {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-csrf-token': validCsrf(csrfToken),
          }),
          body: JSON.stringify({ activationAttemptId: input.activationAttemptId }),
        },
      );
      const value = await responseJson(response);
      return parseCanvasActivationResponse(
        value,
        { projectId, packageId },
        response.headers.get('idempotency-replayed'),
      );
    },

    async openLegacy(input) {
      const body = strictLegacyOpenRequest(input);
      const response = await safeFetch(
        fetchImpl,
        '/api/production/pilot/canvas/bootstrap',
        {
          ...baseInit('POST', {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-storycanvas-csrf': 'pilot-canvas-bootstrap-v1',
          }),
          body: JSON.stringify(body),
        },
      );
      return parseLegacyCanvasOpenResponse(await responseJson(response), input);
    },

    async readBootstrap(canvasSessionId, selection) {
      const response = await safeFetch(
        fetchImpl,
        '/api/production/pilot/canvas/v1/bootstrap',
        baseInit('GET', canvasHeaders(canvasSessionId)),
      );
      return parseFormalCanvasBootstrap(await responseJson(response), {
        ...selection,
        canvasSessionId,
      });
    },

    async readWorkspace(canvasSessionId, selection) {
      const response = await safeFetch(
        fetchImpl,
        '/api/production/pilot/canvas/v1/workspace',
        baseInit('GET', canvasHeaders(canvasSessionId)),
      );
      return parseFormalCanvasWorkspace(await responseJson(response), {
        ...selection,
        canvasSessionId,
      });
    },

    async readDocument(canvasSessionId, documentId) {
      validUuid(documentId);
      const response = await safeFetch(
        fetchImpl,
        `/api/production/pilot/canvas/v1/documents/${documentId}`,
        baseInit('GET', canvasHeaders(canvasSessionId)),
      );
      return parseDocumentEnvelope(await responseJson(response));
    },

    async readAssets(canvasSessionId) {
      const response = await safeFetch(
        fetchImpl,
        '/api/production/pilot/canvas/v1/assets',
        baseInit('GET', canvasHeaders(canvasSessionId)),
      );
      return parseAssetsEnvelope(await responseJson(response));
    },

    async readReadiness(canvasSessionId, shotId) {
      validUuid(shotId);
      const response = await safeFetch(
        fetchImpl,
        `/api/production/pilot/canvas/v1/assets/readiness/${shotId}`,
        baseInit('GET', canvasHeaders(canvasSessionId)),
      );
      return parseReadinessEnvelope(await responseJson(response));
    },

    async prepareApproval(projectId, input, csrfToken) {
      validUuid(projectId);
      validUuid(input.packageId);
      validSession(input.canvasSessionId);
      validUuid(input.action.commandId);
      if (
        !HIGH_COST_COMMANDS.has(input.commandType) ||
        input.expiresInSeconds !== 60 ||
        input.replayPolicy !== 'single_use_replay_same_command' ||
        !input.action.payload ||
        typeof input.action.payload !== 'object' ||
        Array.isArray(input.action.payload)
      ) {
        throw bridgeError('CANVAS_APPROVAL_INVALID');
      }
      const body: CanvasApprovalPrepareRequest = {
        packageId: input.packageId,
        canvasSessionId: input.canvasSessionId,
        commandType: input.commandType,
        action: { commandId: input.action.commandId, payload: structuredClone(input.action.payload) },
        expiresInSeconds: 60,
        replayPolicy: 'single_use_replay_same_command',
      };
      const response = await safeFetch(
        fetchImpl,
        `/api/v1/projects/${projectId}/canvas-command-approvals`,
        {
          ...baseInit('POST', {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-csrf-token': validCsrf(csrfToken),
          }),
          body: JSON.stringify(body),
        },
      );
      return parseApproval(await responseJson(response));
    },

    async dispatch(commandInput) {
      const parsed = parseCanvasV1BrowserContract(commandInput);
      if (parsed.objectType !== 'CanvasCommand') throw bridgeError('CANVAS_SCHEMA_INVALID');
      const response = await safeFetch(
        fetchImpl,
        '/api/production/pilot/canvas/v1/commands',
        {
          ...baseInit('POST', canvasHeaders(parsed.canvasSessionId, true)),
          body: JSON.stringify(parsed),
        },
      );
      return parseEventEnvelope(await responseJson(response), parsed);
    },
  };
}
