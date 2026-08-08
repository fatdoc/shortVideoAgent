import { pilotRuntime, type PilotRuntime } from '../config/pilotRuntime';

export const REGISTRATION_TERMS_DOCUMENT_CODE = 'registration-notice';
export const REGISTRATION_LOCALE = 'zh-CN';

export type PublicInvitationType = 'PLATFORM' | 'CHANNEL' | 'TENANT_MEMBER';
export type PublicRegistrationPath =
  'DIRECT' | 'PLATFORM_INVITATION' | 'CHANNEL_INVITATION' | 'TENANT_MEMBER_INVITATION';

export interface PublicRegistrationTerms {
  termsDocumentId: string;
  termsVersionId: string;
  documentCode: string;
  title: string;
  versionLabel: string;
  locale: string;
  content: string;
  contentDigest: string;
  effectiveAt: string;
  mustReaccept: boolean;
}

export interface PublicInvitationPreview {
  invitationType: PublicInvitationType;
  targetRoleCode: 'content_operator' | null;
  targetOrganizationId: string | null;
  attributionChannelId: string | null;
  expiresAt: string;
  remainingUses: number;
}

export interface PublicRegistrationInput {
  email: string;
  password: string;
  displayName: string;
  tenantDisplayName?: string;
  invitationToken?: string;
  termsVersionId: string;
  locale: string;
  accepted: boolean;
  emailVerificationToken: string;
  idempotencyKey: string;
}

export interface PublicRegistrationResult {
  registrationId: string;
  userId: string;
  tenantId: string;
  membershipId: string;
  registrationPath: PublicRegistrationPath;
  completedAt: string;
}

export interface PublicRegistrationCompletion {
  registration: PublicRegistrationResult;
  replayed: boolean;
}

export class PublicRegistrationApiError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    code: string,
    message: string,
    status: number | null,
    requestId: string | null,
    retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'PublicRegistrationApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type PublicRegistrationApiOptions = {
  runtime?: PilotRuntime;
  fetchImpl?: FetchImplementation;
};

const INVITATION_TYPES = new Set<PublicInvitationType>(['PLATFORM', 'CHANNEL', 'TENANT_MEMBER']);
const REGISTRATION_PATHS = new Set<PublicRegistrationPath>([
  'DIRECT',
  'PLATFORM_INVITATION',
  'CHANNEL_INVITATION',
  'TENANT_MEMBER_INVITATION',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;

const safeMessages: Record<string, string> = {
  INVALID_TERMS_REQUEST: '用户须知请求格式无效。',
  TERMS_NOT_AVAILABLE: '当前用户须知暂不可用。',
  INVITATION_VALIDATION_FAILED: '邀请校验请求格式无效。',
  INVITATION_UNAVAILABLE: '邀请不可用。',
  INVITATION_RATE_LIMITED: '邀请校验请求过多，请稍后重试。',
  INVALID_REGISTRATION_REQUEST: '注册请求格式无效。',
  REGISTRATION_TERMS_NOT_ACCEPTED: '请明确接受当前用户须知。',
  EMAIL_VERIFICATION_FAILED: '邮箱验证失败。',
  REGISTRATION_CONFLICT: '无法使用当前身份完成注册。',
  REGISTRATION_IDEMPOTENCY_CONFLICT: '注册请求与之前的提交不一致。',
  TERMS_VERSION_STALE: '用户须知已更新，请重新阅读并确认。',
  EMAIL_VERIFICATION_UNAVAILABLE: '邮箱验证服务暂不可用。',
  REGISTRATION_RATE_LIMITED: '注册请求过多，请稍后重试。',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function requiredString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function validUuid(value: unknown): value is string {
  return requiredString(value) && UUID_PATTERN.test(value);
}

function validDate(value: unknown): value is string {
  return requiredString(value) && !Number.isNaN(Date.parse(value));
}

function nullableUuid(value: unknown): value is string | null {
  return value === null || validUuid(value);
}

function invalidResponse(message: string): PublicRegistrationApiError {
  return new PublicRegistrationApiError('INVALID_API_RESPONSE', message, null, null);
}

function parseTerms(value: unknown): PublicRegistrationTerms {
  const keys = [
    'termsDocumentId',
    'termsVersionId',
    'documentCode',
    'title',
    'versionLabel',
    'locale',
    'content',
    'contentDigest',
    'effectiveAt',
    'mustReaccept',
  ] as const;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, keys) ||
    !validUuid(value.termsDocumentId) ||
    !validUuid(value.termsVersionId) ||
    !requiredString(value.documentCode) ||
    !requiredString(value.title) ||
    !requiredString(value.versionLabel) ||
    !requiredString(value.locale) ||
    !requiredString(value.content) ||
    !requiredString(value.contentDigest) ||
    !SHA256_PATTERN.test(value.contentDigest) ||
    !validDate(value.effectiveAt) ||
    typeof value.mustReaccept !== 'boolean'
  ) {
    throw invalidResponse('Control API 返回了无效的用户须知。');
  }
  return {
    termsDocumentId: value.termsDocumentId,
    termsVersionId: value.termsVersionId,
    documentCode: value.documentCode,
    title: value.title,
    versionLabel: value.versionLabel,
    locale: value.locale,
    content: value.content,
    contentDigest: value.contentDigest,
    effectiveAt: value.effectiveAt,
    mustReaccept: value.mustReaccept,
  };
}

function parseInvitation(value: unknown): PublicInvitationPreview {
  const keys = [
    'invitationType',
    'targetRoleCode',
    'targetOrganizationId',
    'attributionChannelId',
    'expiresAt',
    'remainingUses',
  ] as const;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, keys) ||
    typeof value.invitationType !== 'string' ||
    !INVITATION_TYPES.has(value.invitationType as PublicInvitationType) ||
    !(value.targetRoleCode === null || value.targetRoleCode === 'content_operator') ||
    !nullableUuid(value.targetOrganizationId) ||
    !nullableUuid(value.attributionChannelId) ||
    !validDate(value.expiresAt) ||
    !Number.isInteger(value.remainingUses) ||
    (value.remainingUses as number) < 0
  ) {
    throw invalidResponse('Control API 返回了无效的邀请预览。');
  }
  return {
    invitationType: value.invitationType as PublicInvitationType,
    targetRoleCode: value.targetRoleCode,
    targetOrganizationId: value.targetOrganizationId,
    attributionChannelId: value.attributionChannelId,
    expiresAt: value.expiresAt,
    remainingUses: value.remainingUses as number,
  };
}

function parseRegistration(value: unknown): PublicRegistrationResult {
  const keys = [
    'registrationId',
    'userId',
    'tenantId',
    'membershipId',
    'registrationPath',
    'completedAt',
  ] as const;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, keys) ||
    !validUuid(value.registrationId) ||
    !validUuid(value.userId) ||
    !validUuid(value.tenantId) ||
    !validUuid(value.membershipId) ||
    typeof value.registrationPath !== 'string' ||
    !REGISTRATION_PATHS.has(value.registrationPath as PublicRegistrationPath) ||
    !validDate(value.completedAt)
  ) {
    throw invalidResponse('Control API 返回了无效的注册结果。');
  }
  return {
    registrationId: value.registrationId,
    userId: value.userId,
    tenantId: value.tenantId,
    membershipId: value.membershipId,
    registrationPath: value.registrationPath as PublicRegistrationPath,
    completedAt: value.completedAt,
  };
}

async function responseBody(response: Response): Promise<unknown> {
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function retryAfterSeconds(response: Response): number | null {
  const raw = response.headers.get('retry-after');
  if (!raw || !/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function responseError(response: Response, body: unknown): PublicRegistrationApiError {
  const envelope = isRecord(body) && isRecord(body.error) ? body.error : null;
  const code = envelope && requiredString(envelope.code) ? envelope.code : 'CONTROL_API_ERROR';
  const requestId =
    (envelope && requiredString(envelope.requestId) ? envelope.requestId : null) ??
    response.headers.get('x-request-id');
  return new PublicRegistrationApiError(
    code,
    safeMessages[code] ?? '注册服务请求失败，请稍后重试。',
    response.status,
    requestId,
    retryAfterSeconds(response),
  );
}

function configuredBaseUrl(runtime: PilotRuntime): string {
  if (runtime.mode !== 'pilot' || runtime.configurationError || !runtime.controlApiBaseUrl) {
    throw new PublicRegistrationApiError(
      'PILOT_CONFIGURATION_ERROR',
      runtime.configurationError ?? '当前未启用真实注册运行模式。',
      null,
      null,
    );
  }
  return runtime.controlApiBaseUrl;
}

function registrationBody(input: PublicRegistrationInput): PublicRegistrationInput {
  return {
    email: input.email,
    password: input.password,
    displayName: input.displayName,
    termsVersionId: input.termsVersionId,
    locale: input.locale,
    accepted: input.accepted,
    emailVerificationToken: input.emailVerificationToken,
    idempotencyKey: input.idempotencyKey,
    ...(input.tenantDisplayName === undefined
      ? {}
      : { tenantDisplayName: input.tenantDisplayName }),
    ...(input.invitationToken === undefined ? {} : { invitationToken: input.invitationToken }),
  };
}

export function createPublicRegistrationApi(options: PublicRegistrationApiOptions = {}) {
  const runtime = options.runtime ?? pilotRuntime;
  const fetchImpl =
    options.fetchImpl ??
    ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));

  async function request(
    path: string,
    init: RequestInit,
  ): Promise<{ response: Response; body: unknown }> {
    try {
      const response = await fetchImpl(`${configuredBaseUrl(runtime)}${path}`, {
        ...init,
        credentials: 'include',
        headers: {
          accept: 'application/json',
          ...(init.body ? { 'content-type': 'application/json' } : {}),
          ...init.headers,
        },
      });
      const body = await responseBody(response);
      if (!response.ok) throw responseError(response, body);
      return { response, body };
    } catch (error) {
      if (error instanceof PublicRegistrationApiError) throw error;
      throw new PublicRegistrationApiError(
        'CONTROL_API_UNREACHABLE',
        '无法连接注册服务，请检查服务状态后重试。',
        null,
        null,
      );
    }
  }

  return {
    async loadCurrentTerms(): Promise<PublicRegistrationTerms> {
      const query = new URLSearchParams({
        documentCode: REGISTRATION_TERMS_DOCUMENT_CODE,
        locale: REGISTRATION_LOCALE,
      });
      const { body } = await request(`/api/v1/public/terms/current?${query.toString()}`, {
        method: 'GET',
      });
      if (!isRecord(body) || !hasOnlyKeys(body, ['terms'])) {
        throw invalidResponse('Control API 返回了无效的用户须知响应。');
      }
      return parseTerms(body.terms);
    },

    async previewInvitation(token: string): Promise<PublicInvitationPreview> {
      const { body } = await request('/api/v1/public/invitations/preview', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      if (!isRecord(body) || !hasOnlyKeys(body, ['invitation'])) {
        throw invalidResponse('Control API 返回了无效的邀请预览响应。');
      }
      return parseInvitation(body.invitation);
    },

    async register(input: PublicRegistrationInput): Promise<PublicRegistrationCompletion> {
      const { response, body } = await request('/api/v1/public/registrations', {
        method: 'POST',
        body: JSON.stringify(registrationBody(input)),
      });
      const replayHeader = response.headers.get('idempotency-replayed');
      const replayed = response.status === 200 && replayHeader === 'true';
      if (
        ![200, 201].includes(response.status) ||
        (response.status === 200 && !replayed) ||
        (response.status === 201 && replayHeader === 'true') ||
        !isRecord(body) ||
        !hasOnlyKeys(body, ['registration'])
      ) {
        throw invalidResponse('Control API 返回了无效的注册响应。');
      }
      return { registration: parseRegistration(body.registration), replayed };
    },
  };
}

export const publicRegistrationApi = createPublicRegistrationApi();
