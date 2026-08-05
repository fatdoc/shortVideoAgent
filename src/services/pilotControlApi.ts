import { pilotRuntime } from '../config/pilotRuntime';

export type PilotRole = 'tenant_admin' | 'content_operator' | 'pilot_support';

export interface PilotSession {
  user: { id: string; email: string; displayName: string };
  tenant: { id: string; displayName: string };
  roles: PilotRole[];
  expiresAt: string;
}

export interface PilotLoginCredentials {
  email: string;
  password: string;
}

export class PilotControlApiError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly requestId: string | null;

  constructor(code: string, message: string, status: number | null, requestId: string | null) {
    super(message);
    this.name = 'PilotControlApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

const PILOT_ROLES = new Set<PilotRole>(['tenant_admin', 'content_operator', 'pilot_support']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requiredString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function parseSession(value: unknown): PilotSession {
  if (!isRecord(value) || !isRecord(value.user) || !isRecord(value.tenant)) {
    throw new PilotControlApiError(
      'INVALID_API_RESPONSE',
      'Control API 返回了无效的会话数据。',
      null,
      null,
    );
  }
  const roles = value.roles;
  if (
    !requiredString(value.user.id) ||
    !requiredString(value.user.email) ||
    !requiredString(value.user.displayName) ||
    !requiredString(value.tenant.id) ||
    !requiredString(value.tenant.displayName) ||
    !Array.isArray(roles) ||
    !roles.every(
      (role): role is PilotRole => typeof role === 'string' && PILOT_ROLES.has(role as PilotRole),
    ) ||
    !requiredString(value.expiresAt) ||
    Number.isNaN(Date.parse(value.expiresAt))
  ) {
    throw new PilotControlApiError(
      'INVALID_API_RESPONSE',
      'Control API 返回了无效的会话数据。',
      null,
      null,
    );
  }
  return {
    user: {
      id: value.user.id,
      email: value.user.email,
      displayName: value.user.displayName,
    },
    tenant: { id: value.tenant.id, displayName: value.tenant.displayName },
    roles,
    expiresAt: value.expiresAt,
  };
}

async function responseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function responseError(response: Response, body: unknown): PilotControlApiError {
  const envelope = isRecord(body) && isRecord(body.error) ? body.error : null;
  const requestId =
    (envelope && requiredString(envelope.requestId) ? envelope.requestId : null) ??
    response.headers.get('x-request-id');
  const code = envelope && requiredString(envelope.code) ? envelope.code : 'CONTROL_API_ERROR';
  const message =
    envelope && requiredString(envelope.message)
      ? envelope.message
      : `Control API 请求失败（HTTP ${response.status}）。`;
  return new PilotControlApiError(code, message, response.status, requestId);
}

function configuredBaseUrl(): string {
  if (
    pilotRuntime.mode !== 'pilot' ||
    pilotRuntime.configurationError ||
    !pilotRuntime.controlApiBaseUrl
  ) {
    throw new PilotControlApiError(
      'PILOT_CONFIGURATION_ERROR',
      pilotRuntime.configurationError ?? '当前未启用 Pilot 运行模式。',
      null,
      null,
    );
  }
  return pilotRuntime.controlApiBaseUrl;
}

async function request(
  path: string,
  init?: RequestInit,
): Promise<{ response: Response; body: unknown }> {
  try {
    const response = await fetch(`${configuredBaseUrl()}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        accept: 'application/json',
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
    const body = await responseBody(response);
    if (!response.ok) throw responseError(response, body);
    return { response, body };
  } catch (error) {
    if (error instanceof PilotControlApiError) throw error;
    throw new PilotControlApiError(
      'CONTROL_API_UNREACHABLE',
      '无法连接 Pilot Control API，请检查服务状态后重试。',
      null,
      null,
    );
  }
}

function sessionFromBody(body: unknown): PilotSession {
  return parseSession(isRecord(body) ? body.session : null);
}

export async function loginToPilot(credentials: PilotLoginCredentials): Promise<PilotSession> {
  const { body } = await request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: credentials.email.trim(),
      password: credentials.password,
      returnTo: '/pilot',
    }),
  });
  return sessionFromBody(body);
}

export async function hydratePilotSession(): Promise<PilotSession> {
  const { body } = await request('/api/v1/auth/session');
  return sessionFromBody(body);
}

export async function logoutPilotSession(): Promise<void> {
  await request('/api/v1/auth/logout', { method: 'POST' });
}

export const pilotControlApi = {
  login: loginToPilot,
  hydrate: hydratePilotSession,
  logout: logoutPilotSession,
} as const;
