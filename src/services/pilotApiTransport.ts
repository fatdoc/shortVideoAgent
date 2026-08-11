import { pilotRuntime, type PilotRuntime } from '../config/pilotRuntime';

export type PilotApiMethod = 'GET' | 'POST';
export type PilotApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface PilotApiResponse<T> {
  data: T;
  status: number;
  requestId: string | null;
  replayed: boolean | null;
}

export interface PilotApiRequest<T> {
  method: PilotApiMethod;
  path: string;
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
  maxAttempts?: number;
  expectedStatuses: readonly number[];
  parse: (value: unknown) => T;
}

export interface PilotApiTransport {
  request<T>(request: PilotApiRequest<T>): Promise<PilotApiResponse<T>>;
}

export interface PilotApiTransportOptions {
  runtime?: PilotRuntime;
  fetchImpl?: PilotApiFetch;
}

export class PilotApiError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly requestId: string | null;
  readonly retryable: boolean;

  constructor(
    code: string,
    message: string,
    status: number | null,
    requestId: string | null,
    retryable = false,
  ) {
    super(message);
    this.name = 'PilotApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.retryable = retryable;
  }
}

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const RETRYABLE_STATUSES = new Set([503]);

const STATUS_ERRORS: Readonly<Record<number, { code: string; message: string }>> = {
  400: { code: 'PILOT_REQUEST_INVALID', message: '请求格式无效。' },
  401: { code: 'PILOT_SESSION_REQUIRED', message: '登录状态已失效，请重新登录。' },
  403: { code: 'PILOT_PERMISSION_DENIED', message: '当前账号无权执行此操作。' },
  404: { code: 'PILOT_RESOURCE_NOT_FOUND', message: '请求的资源不存在或不可访问。' },
  409: { code: 'PILOT_CONFLICT', message: '请求与当前资源状态冲突。' },
  410: { code: 'PILOT_RESOURCE_EXPIRED', message: '请求的资源已过期。' },
  422: { code: 'PILOT_SCHEMA_INVALID', message: '请求未通过合同校验。' },
  429: { code: 'PILOT_RATE_LIMITED', message: '请求过于频繁，请稍后重试。' },
  503: { code: 'PILOT_SERVICE_UNAVAILABLE', message: '服务暂时不可用，请稍后重试。' },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeRequestId(value: unknown): string | null {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value) ? value : null;
}

function safeErrorCode(value: unknown): string | null {
  return typeof value === 'string' && ERROR_CODE_PATTERN.test(value) ? value : null;
}

function invalidRequest(): PilotApiError {
  return new PilotApiError(
    'INVALID_PILOT_REQUEST',
    'Pilot API 请求不符合严格客户端约束。',
    null,
    null,
  );
}

function validatePath(path: unknown): path is string {
  if (
    typeof path !== 'string' ||
    !path.startsWith('/api/v1/') ||
    path.includes('?') ||
    path.includes('#') ||
    path.includes('\\') ||
    path.includes('//') ||
    Array.from(path).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    })
  ) {
    return false;
  }
  try {
    return path
      .split('/')
      .every(
        (segment) =>
          segment !== '.' && segment !== '..' && !['.', '..'].includes(decodeURIComponent(segment)),
      );
  } catch {
    return false;
  }
}

function validateExpectedStatuses(statuses: readonly number[]): boolean {
  return (
    Array.isArray(statuses) &&
    statuses.length > 0 &&
    new Set(statuses).size === statuses.length &&
    statuses.every((status) => Number.isInteger(status) && status >= 200 && status < 300)
  );
}

function serializeBody(value: unknown): string | null {
  if ((!isRecord(value) && !Array.isArray(value)) || value === null) return null;
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' ? serialized : null;
  } catch {
    return null;
  }
}

function requestIdFromBody(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.error)) return null;
  return safeRequestId(value.error.requestId);
}

function codeFromBody(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.error)) return null;
  return safeErrorCode(value.error.code);
}

function requestIdFromResponse(response: Response, body: unknown): string | null {
  return safeRequestId(response.headers.get('x-request-id')) ?? requestIdFromBody(body);
}

function errorForResponse(
  response: Response,
  body: unknown,
  requestId: string | null,
): PilotApiError {
  const fallback = STATUS_ERRORS[response.status] ?? {
    code: response.status >= 500 ? 'PILOT_SERVICE_ERROR' : 'PILOT_REQUEST_FAILED',
    message:
      response.status >= 500 ? '服务暂时无法完成请求。' : '请求未能完成，请检查当前状态后重试。',
  };
  return new PilotApiError(
    codeFromBody(body) ?? fallback.code,
    fallback.message,
    response.status,
    requestId,
    RETRYABLE_STATUSES.has(response.status),
  );
}

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' &&
      error instanceof DOMException &&
      error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

async function readJson(response: Response): Promise<{ parsed: boolean; value: unknown }> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return { parsed: false, value: null };
  }
  if (!text) return { parsed: true, value: null };
  try {
    return { parsed: true, value: JSON.parse(text) as unknown };
  } catch {
    return { parsed: false, value: null };
  }
}

function replayedFromResponse(response: Response): boolean | null | 'invalid' {
  const value = response.headers.get('idempotency-replayed');
  if (value === null) return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return 'invalid';
}

function validateRequest<T>(request: PilotApiRequest<T>): {
  maxAttempts: number;
  serializedBody: string | undefined;
} {
  if (
    (request.method !== 'GET' && request.method !== 'POST') ||
    !validatePath(request.path) ||
    !validateExpectedStatuses(request.expectedStatuses) ||
    typeof request.parse !== 'function'
  ) {
    throw invalidRequest();
  }

  const maxAttempts = request.maxAttempts ?? 1;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) {
    throw invalidRequest();
  }

  if (request.method === 'GET') {
    if (request.body !== undefined || request.idempotencyKey !== undefined) throw invalidRequest();
    return { maxAttempts, serializedBody: undefined };
  }

  const serializedBody = serializeBody(request.body);
  if (serializedBody === null) throw invalidRequest();
  if (
    request.idempotencyKey !== undefined &&
    !IDEMPOTENCY_KEY_PATTERN.test(request.idempotencyKey)
  ) {
    throw invalidRequest();
  }
  if (maxAttempts > 1 && !request.idempotencyKey) throw invalidRequest();
  return { maxAttempts, serializedBody };
}

export function createPilotApiTransport(options: PilotApiTransportOptions = {}): PilotApiTransport {
  const runtime = options.runtime ?? pilotRuntime;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async request<T>(request: PilotApiRequest<T>): Promise<PilotApiResponse<T>> {
      const { maxAttempts, serializedBody } = validateRequest(request);
      if (runtime.mode !== 'pilot') {
        throw new PilotApiError(
          'PILOT_MODE_REQUIRED',
          '真实内容生产 API 只允许在 Pilot 模式使用。',
          null,
          null,
        );
      }
      if (!runtime.controlApiBaseUrl || runtime.configurationError) {
        throw new PilotApiError(
          'PILOT_CONFIGURATION_ERROR',
          'Pilot Control API 尚未安全配置。',
          null,
          null,
        );
      }

      const headers: Record<string, string> = { Accept: 'application/json' };
      if (request.method === 'POST') {
        headers['Content-Type'] = 'application/json';
        if (request.idempotencyKey) headers['Idempotency-Key'] = request.idempotencyKey;
      }
      const init: RequestInit = {
        method: request.method,
        credentials: 'include',
        cache: 'no-store',
        headers,
        ...(request.method === 'POST' ? { body: serializedBody, signal: request.signal } : {}),
        ...(request.method === 'GET' ? { signal: request.signal } : {}),
      };
      const url = `${runtime.controlApiBaseUrl}${request.path}`;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        let response: Response;
        try {
          response = await fetchImpl(url, init);
        } catch (error) {
          if (isAbortError(error) || request.signal?.aborted) {
            throw new PilotApiError('REQUEST_ABORTED', '请求已取消。', null, null, false);
          }
          if (attempt < maxAttempts) continue;
          throw new PilotApiError(
            'CONTROL_API_UNREACHABLE',
            '无法连接 Pilot Control API。',
            null,
            null,
            true,
          );
        }

        const body = await readJson(response);
        const requestId = requestIdFromResponse(response, body.value);
        if (!response.ok) {
          if (attempt < maxAttempts && RETRYABLE_STATUSES.has(response.status)) continue;
          throw errorForResponse(response, body.value, requestId);
        }

        if (!request.expectedStatuses.includes(response.status)) {
          throw new PilotApiError(
            'INVALID_API_RESPONSE',
            'Control API 返回了非预期状态。',
            response.status,
            requestId,
          );
        }
        if (!body.parsed) {
          throw new PilotApiError(
            'INVALID_API_RESPONSE',
            'Control API 返回了无效响应。',
            response.status,
            requestId,
          );
        }

        const replayed = replayedFromResponse(response);
        if (replayed === 'invalid') {
          throw new PilotApiError(
            'INVALID_API_RESPONSE',
            'Control API 返回了无效响应。',
            response.status,
            requestId,
          );
        }

        try {
          return {
            data: request.parse(body.value),
            status: response.status,
            requestId,
            replayed,
          };
        } catch {
          throw new PilotApiError(
            'INVALID_API_RESPONSE',
            'Control API 返回了不符合严格合同的响应。',
            response.status,
            requestId,
          );
        }
      }

      throw new PilotApiError(
        'CONTROL_API_UNREACHABLE',
        '无法连接 Pilot Control API。',
        null,
        null,
        true,
      );
    },
  };
}

export const pilotApiTransport = createPilotApiTransport();
