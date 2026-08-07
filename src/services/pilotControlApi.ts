import { pilotRuntime } from '../config/pilotRuntime';

export type PilotRole =
  'platform_admin' | 'channel_admin' | 'tenant_admin' | 'content_operator' | 'pilot_support';
export type PilotOrganizationType = 'PLATFORM' | 'CHANNEL' | 'TENANT';

export interface PilotActiveContext {
  membershipId: string;
  organizationId: string;
  organizationType: PilotOrganizationType;
  organizationDisplayName: string;
  membershipVersion: number;
  primaryRole: PilotRole;
  roles: PilotRole[];
  tenantId: string | null;
}

export interface PilotSession {
  user: { id: string; email: string; displayName: string };
  tenant: { id: string; displayName: string } | null;
  roles: PilotRole[];
  activeContext: PilotActiveContext;
  expiresAt: string;
}

export type PilotProjectStatus = 'draft' | 'active' | 'production' | 'completed' | 'archived';

export interface PilotProject {
  id: string;
  name: string;
  status: PilotProjectStatus;
  platform: string;
  aspectRatio: string;
  targetDurationSeconds: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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

const PILOT_ROLES = new Set<PilotRole>([
  'platform_admin',
  'channel_admin',
  'tenant_admin',
  'content_operator',
  'pilot_support',
]);
const ORGANIZATION_TYPES = new Set<PilotOrganizationType>(['PLATFORM', 'CHANNEL', 'TENANT']);
const PROJECT_STATUSES = new Set<PilotProjectStatus>([
  'draft',
  'active',
  'production',
  'completed',
  'archived',
]);

function invalidResponse(message: string): PilotControlApiError {
  return new PilotControlApiError('INVALID_API_RESPONSE', message, null, null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requiredString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function validDateString(value: unknown): value is string {
  return requiredString(value) && !Number.isNaN(Date.parse(value));
}

function parseRoles(value: unknown): PilotRole[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every(
      (role): role is PilotRole => typeof role === 'string' && PILOT_ROLES.has(role as PilotRole),
    ) ||
    new Set(value).size !== value.length
  ) {
    return null;
  }
  return [...value];
}

function sameRoles(left: readonly PilotRole[], right: readonly PilotRole[]): boolean {
  return (
    left.length === right.length &&
    left.every((role) => right.includes(role)) &&
    right.every((role) => left.includes(role))
  );
}

function parseSession(value: unknown): PilotSession {
  if (!isRecord(value) || !isRecord(value.user) || !isRecord(value.activeContext)) {
    throw invalidResponse('Control API 返回了无效的会话数据。');
  }

  const tenant = value.tenant;
  const roles = parseRoles(value.roles);
  const contextRoles = parseRoles(value.activeContext.roles);
  const organizationType = value.activeContext.organizationType;
  const primaryRole = value.activeContext.primaryRole;
  const tenantId = value.activeContext.tenantId;

  if (
    !requiredString(value.user.id) ||
    !requiredString(value.user.email) ||
    !requiredString(value.user.displayName) ||
    !roles ||
    !contextRoles ||
    !sameRoles(roles, contextRoles) ||
    !requiredString(value.activeContext.membershipId) ||
    !requiredString(value.activeContext.organizationId) ||
    typeof organizationType !== 'string' ||
    !ORGANIZATION_TYPES.has(organizationType as PilotOrganizationType) ||
    !requiredString(value.activeContext.organizationDisplayName) ||
    !Number.isInteger(value.activeContext.membershipVersion) ||
    (value.activeContext.membershipVersion as number) < 1 ||
    typeof primaryRole !== 'string' ||
    !PILOT_ROLES.has(primaryRole as PilotRole) ||
    !contextRoles.includes(primaryRole as PilotRole) ||
    !(tenantId === null || requiredString(tenantId)) ||
    !validDateString(value.expiresAt)
  ) {
    throw invalidResponse('Control API 返回了无效的会话数据。');
  }

  if (organizationType === 'TENANT') {
    if (
      !isRecord(tenant) ||
      !requiredString(tenant.id) ||
      !requiredString(tenant.displayName) ||
      !requiredString(tenantId) ||
      tenant.id !== tenantId ||
      value.activeContext.organizationId !== tenantId
    ) {
      throw invalidResponse('Control API 返回了不一致的 Tenant 会话上下文。');
    }
  } else if (tenant !== null || tenantId !== null) {
    throw invalidResponse('Control API 为非 Tenant 会话返回了错误的 Tenant Scope。');
  }

  return {
    user: {
      id: value.user.id,
      email: value.user.email,
      displayName: value.user.displayName,
    },
    tenant:
      organizationType === 'TENANT' && isRecord(tenant)
        ? { id: tenant.id as string, displayName: tenant.displayName as string }
        : null,
    roles,
    activeContext: {
      membershipId: value.activeContext.membershipId,
      organizationId: value.activeContext.organizationId,
      organizationType: organizationType as PilotOrganizationType,
      organizationDisplayName: value.activeContext.organizationDisplayName,
      membershipVersion: value.activeContext.membershipVersion as number,
      primaryRole: primaryRole as PilotRole,
      roles: contextRoles,
      tenantId: tenantId as string | null,
    },
    expiresAt: value.expiresAt,
  };
}

function parseProject(value: unknown): PilotProject {
  if (
    !isRecord(value) ||
    !requiredString(value.id) ||
    !requiredString(value.name) ||
    typeof value.status !== 'string' ||
    !PROJECT_STATUSES.has(value.status as PilotProjectStatus) ||
    !requiredString(value.platform) ||
    !requiredString(value.aspectRatio) ||
    !Number.isInteger(value.targetDurationSeconds) ||
    (value.targetDurationSeconds as number) < 1 ||
    !requiredString(value.createdBy) ||
    !validDateString(value.createdAt) ||
    !validDateString(value.updatedAt)
  ) {
    throw invalidResponse('Control API 返回了无效的项目数据。');
  }

  return {
    id: value.id,
    name: value.name,
    status: value.status as PilotProjectStatus,
    platform: value.platform,
    aspectRatio: value.aspectRatio,
    targetDurationSeconds: value.targetDurationSeconds as number,
    createdBy: value.createdBy,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
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

export async function listPilotProjects(): Promise<PilotProject[]> {
  const { body } = await request('/api/v1/projects');
  if (!isRecord(body) || !Array.isArray(body.projects)) {
    throw invalidResponse('Control API 返回了无效的项目列表。');
  }
  return body.projects.map(parseProject);
}

export async function readPilotProject(projectId: string): Promise<PilotProject> {
  if (!requiredString(projectId)) {
    throw new PilotControlApiError('INVALID_PROJECT_ID', '项目 ID 无效。', null, null);
  }
  const { body } = await request(`/api/v1/projects/${encodeURIComponent(projectId)}`);
  return parseProject(body);
}

export const pilotControlApi = {
  login: loginToPilot,
  hydrate: hydratePilotSession,
  logout: logoutPilotSession,
  listProjects: listPilotProjects,
  readProject: readPilotProject,
} as const;
