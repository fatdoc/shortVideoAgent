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

export interface PilotCommercialChannelReference {
  channelId: string;
  organizationId: string;
  displayName: string;
  organizationStatus: 'active';
}

export type PilotTestPaymentEventType =
  'payment_succeeded' | 'payment_failed' | 'refund_succeeded' | 'chargeback_succeeded';
export type PilotPaymentEventProcessingStatus = 'received' | 'applied' | 'rejected';
export type PilotPaymentEventErrorCode =
  | 'invalid_signature'
  | 'unknown_order'
  | 'amount_mismatch'
  | 'currency_mismatch'
  | 'mode_mismatch'
  | 'duplicate_conflict'
  | 'invalid_order_state'
  | 'wallet_unavailable'
  | 'credit_issuance_conflict'
  | 'partial_refund_unsupported'
  | 'credit_reclaim_unsafe'
  | 'commission_reversal_conflict'
  | 'unsupported_event_type'
  | 'provider_unavailable'
  | 'internal_processing_error';

export interface PilotPaymentEventAudit {
  paymentEventId: string;
  paymentMode: 'TEST';
  eventType: PilotTestPaymentEventType;
  rechargeOrderId: string;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  receivedAt: string;
  processingStatus: PilotPaymentEventProcessingStatus;
  errorCode: PilotPaymentEventErrorCode | null;
  processedAt: string | null;
}

export type PilotCommissionCalculationOutcome =
  'accrued' | 'not_attributed' | 'attribution_expired' | 'manual_review';

export interface PilotCommissionCalculationAudit {
  commissionCalculationOutcomeId: string;
  sourcePaymentEventId: string;
  rechargeOrderId: string;
  beneficiaryChannelId: string | null;
  commissionRuleVersionId: string | null;
  basisAmountMinor: number;
  currency: string;
  outcome: PilotCommissionCalculationOutcome;
  reasonCode: string;
  occurredAt: string;
  createdAt: string;
}

export interface PilotCommissionAccrualAudit {
  commissionAccrualId: string;
  calculationOutcomeId: string;
  sourcePaymentEventId: string;
  rechargeOrderId: string;
  beneficiaryChannelId: string;
  commissionRuleVersionId: string;
  basisAmountMinor: number;
  commissionAmountMinor: number;
  currency: string;
  eligibleAt: string;
  occurredAt: string;
  createdAt: string;
}

export interface PilotCommissionReversalAudit {
  commissionReversalId: string;
  commissionAccrualId: string;
  sourcePaymentEventId: string;
  rechargeOrderId: string;
  beneficiaryChannelId: string;
  reversalType: 'refund' | 'chargeback';
  reversalAmountMinor: number;
  currency: string;
  occurredAt: string;
  createdAt: string;
}

export interface PilotCreateTestCommissionSettlementInput {
  paymentMode: 'TEST';
  beneficiaryChannelId: string;
  currency: string;
  periodStart: string;
  cutoffAt: string;
  idempotencyKey: string;
}

export interface PilotCommissionSettlementDraft {
  commissionSettlementId: string;
  paymentMode: 'TEST';
  beneficiaryChannelId: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  cutoffAt: string;
  status: 'draft';
  grossAccrualAmountMinor: number;
  grossReversalAmountMinor: number;
  netAmountMinor: number;
  accrualItemCount: number;
  reversalItemCount: number;
  itemCount: number;
  createdAt: string;
}

export interface PilotCommissionSettlementResult {
  settlement: PilotCommissionSettlementDraft;
  replayed: boolean;
}

export type PilotRechargeOrderStatus =
  'created' | 'pending' | 'paid' | 'partially_refunded' | 'refunded' | 'cancelled' | 'disputed';

export interface PilotRechargeOrderAudit {
  rechargeOrderId: string;
  paymentMode: 'TEST';
  amountMinor: number;
  currency: string;
  purchasedCredits: number;
  bonusCredits: number;
  bonusExpiresInDays: number | null;
  status: PilotRechargeOrderStatus;
  createdAt: string;
  updatedAt: string;
}

export type PilotMemberStatus = 'active' | 'suspended' | 'expired';
export type PilotMemberStatusFilter = PilotMemberStatus | 'all';

export interface PilotCurrentOrganizationMember {
  membershipId: string;
  displayName: string;
  email: string;
  status: PilotMemberStatus;
  primaryRole: PilotRole;
  roles: PilotRole[];
  version: number;
  createdAt: string;
  updatedAt: string;
  isCurrentActor: boolean;
}

export interface PilotMemberSuspendResult {
  member: PilotCurrentOrganizationMember;
  replayed: boolean;
}

export type PilotTermsDocumentStatus = 'active' | 'retired';
export type PilotTermsDocumentStatusFilter = PilotTermsDocumentStatus | 'all';
export type PilotTermsVersionStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';
export type PilotTermsVersionStatusFilter = PilotTermsVersionStatus | 'all';

export interface PilotTermsDocument {
  termsDocumentId: string;
  documentCode: string;
  title: string;
  status: PilotTermsDocumentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PilotTermsVersion {
  termsVersionId: string;
  termsDocumentId: string;
  versionLabel: string;
  status: PilotTermsVersionStatus;
  content: string;
  contentDigest: string;
  locale: string;
  publishedAt: string | null;
  effectiveAt: string | null;
  publishedBy: string | null;
  supersedesTermsVersionId: string | null;
  mustReaccept: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PilotCreateTermsDocumentInput {
  documentCode: string;
  title: string;
}

export interface PilotCreateTermsDraftInput {
  versionLabel: string;
  content: string;
  locale: string;
  mustReaccept: boolean;
  supersedesTermsVersionId: string | null;
}

export interface PilotUpdateTermsDraftInput extends PilotCreateTermsDraftInput {
  effectiveAt?: string | null;
}

export interface PilotPublishTermsVersionInput {
  effectiveAt: string;
}

export interface PilotTermsVersionReplayResult {
  version: PilotTermsVersion;
  replayed: boolean;
}

export type PilotInvitationType = 'PLATFORM' | 'CHANNEL' | 'TENANT_MEMBER';
export type PilotInvitationStatus = 'active' | 'revoked' | 'exhausted' | 'expired';
export type PilotInvitationStatusFilter = PilotInvitationStatus | 'all';

export interface PilotInvitationManagement {
  invitationId: string;
  invitationType: PilotInvitationType;
  targetOrganizationId: string | null;
  targetRoleCode: 'content_operator' | null;
  targetEmail: string | null;
  attributionChannelId: string | null;
  status: PilotInvitationStatus;
  validFrom: string;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  remainingUses: number;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
}

export interface PilotCreatePlatformInvitationInput {
  targetEmail: string;
  attributionChannelId: string | null;
  idempotencyKey: string;
}

export interface PilotCreateChannelInvitationInput {
  idempotencyKey: string;
}

export interface PilotCreateTenantInvitationInput {
  targetEmail: string;
  idempotencyKey: string;
}

export interface PilotInvitationCreateResult {
  invitation: PilotInvitationManagement;
  token: string | null;
  replayed: boolean;
}

export interface PilotInvitationReplayResult {
  invitation: PilotInvitationManagement;
  replayed: boolean;
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
      tenant.id !== tenantId
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const TIMEZONE_TIMESTAMP_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/;
const MONTH_START_PATTERN = /^\d{4}-\d{2}-01$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;
const PAYMENT_EVENT_TYPES = new Set<PilotTestPaymentEventType>([
  'payment_succeeded',
  'payment_failed',
  'refund_succeeded',
  'chargeback_succeeded',
]);
const PAYMENT_PROCESSING_STATUSES = new Set<PilotPaymentEventProcessingStatus>([
  'received',
  'applied',
  'rejected',
]);
const PAYMENT_ERROR_CODES = new Set<PilotPaymentEventErrorCode>([
  'invalid_signature',
  'unknown_order',
  'amount_mismatch',
  'currency_mismatch',
  'mode_mismatch',
  'duplicate_conflict',
  'invalid_order_state',
  'wallet_unavailable',
  'credit_issuance_conflict',
  'partial_refund_unsupported',
  'credit_reclaim_unsafe',
  'commission_reversal_conflict',
  'unsupported_event_type',
  'provider_unavailable',
  'internal_processing_error',
]);
const COMMISSION_OUTCOMES = new Set<PilotCommissionCalculationOutcome>([
  'accrued',
  'not_attributed',
  'attribution_expired',
  'manual_review',
]);
const RECHARGE_ORDER_STATUSES = new Set<PilotRechargeOrderStatus>([
  'created',
  'pending',
  'paid',
  'partially_refunded',
  'refunded',
  'cancelled',
  'disputed',
]);
const MEMBER_STATUSES = new Set<PilotMemberStatus>(['active', 'suspended', 'expired']);
const MEMBER_STATUS_FILTERS = new Set<PilotMemberStatusFilter>([
  'all',
  'active',
  'suspended',
  'expired',
]);
const MEMBER_PROJECTION_KEYS = new Set([
  'membershipId',
  'displayName',
  'email',
  'status',
  'primaryRole',
  'roles',
  'version',
  'createdAt',
  'updatedAt',
  'isCurrentActor',
]);
const TERMS_DOCUMENT_STATUSES = new Set<PilotTermsDocumentStatus>(['active', 'retired']);
const TERMS_DOCUMENT_STATUS_FILTERS = new Set<PilotTermsDocumentStatusFilter>([
  'all',
  'active',
  'retired',
]);
const TERMS_VERSION_STATUSES = new Set<PilotTermsVersionStatus>(['DRAFT', 'PUBLISHED', 'RETIRED']);
const TERMS_VERSION_STATUS_FILTERS = new Set<PilotTermsVersionStatusFilter>([
  'all',
  'DRAFT',
  'PUBLISHED',
  'RETIRED',
]);
const TERMS_DOCUMENT_KEYS = new Set([
  'termsDocumentId',
  'documentCode',
  'title',
  'status',
  'createdAt',
  'updatedAt',
]);
const TERMS_VERSION_KEYS = new Set([
  'termsVersionId',
  'termsDocumentId',
  'versionLabel',
  'status',
  'content',
  'contentDigest',
  'locale',
  'publishedAt',
  'effectiveAt',
  'publishedBy',
  'supersedesTermsVersionId',
  'mustReaccept',
  'createdAt',
  'updatedAt',
]);
const TERMS_DRAFT_INPUT_KEYS = new Set([
  'versionLabel',
  'content',
  'locale',
  'mustReaccept',
  'supersedesTermsVersionId',
]);
const TERMS_UPDATE_INPUT_KEYS = new Set([...TERMS_DRAFT_INPUT_KEYS, 'effectiveAt']);
const SHA256_DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const INVITATION_TYPES = new Set<PilotInvitationType>(['PLATFORM', 'CHANNEL', 'TENANT_MEMBER']);
const INVITATION_STATUSES = new Set<PilotInvitationStatus>([
  'active',
  'revoked',
  'exhausted',
  'expired',
]);
const INVITATION_STATUS_FILTERS = new Set<PilotInvitationStatusFilter>([
  'all',
  'active',
  'revoked',
  'exhausted',
  'expired',
]);
const INVITATION_KEYS = new Set([
  'invitationId',
  'invitationType',
  'targetOrganizationId',
  'targetRoleCode',
  'targetEmail',
  'attributionChannelId',
  'status',
  'validFrom',
  'expiresAt',
  'maxUses',
  'usedCount',
  'remainingUses',
  'createdAt',
  'updatedAt',
  'revokedAt',
]);

function uuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function nullableUuid(value: unknown): value is string | null {
  return value === null || uuid(value);
}

function currency(value: unknown): value is string {
  return typeof value === 'string' && CURRENCY_PATTERN.test(value);
}

function timezoneTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    TIMEZONE_TIMESTAMP_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function nullableTimezoneTimestamp(value: unknown): value is string | null {
  return value === null || timezoneTimestamp(value);
}

function safeInteger(value: unknown, minimum?: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    (minimum === undefined || value >= minimum)
  );
}

function exactKeys(value: Record<string, unknown>, expected: ReadonlySet<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function onlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function trimmedText(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= maximum &&
    value === value.trim()
  );
}

function parseReplayHeader(response: Response, message: string): boolean {
  const value = response.headers.get('idempotency-replayed');
  if (!(value === 'true' || value === 'false')) throw invalidResponse(message);
  return value === 'true';
}

function normalizedEmail(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 254 &&
    value === value.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function listLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new PilotControlApiError(
      'INVALID_LIST_LIMIT',
      '商业审计列表 limit 必须为 1 到 100 的整数。',
      null,
      null,
    );
  }
  return limit;
}

function requireUuid(value: string, code: string, message: string): string {
  if (!uuid(value)) throw new PilotControlApiError(code, message, null, null);
  return value;
}

function parseList<T>(
  body: unknown,
  key: string,
  parser: (value: unknown) => T,
  message: string,
): T[] {
  if (!isRecord(body) || !Array.isArray(body[key])) throw invalidResponse(message);
  return body[key].map(parser);
}

function parseCommercialChannel(value: unknown): PilotCommercialChannelReference {
  if (
    !isRecord(value) ||
    !uuid(value.channelId) ||
    !uuid(value.organizationId) ||
    !requiredString(value.displayName) ||
    value.organizationStatus !== 'active'
  ) {
    throw invalidResponse('Control API 返回了无效的商业渠道引用。');
  }
  return {
    channelId: value.channelId,
    organizationId: value.organizationId,
    displayName: value.displayName,
    organizationStatus: 'active',
  };
}

function parsePaymentEvent(value: unknown): PilotPaymentEventAudit {
  if (!isRecord(value)) throw invalidResponse('Control API 返回了无效的 Payment Event。');
  const eventType = value.eventType;
  const processingStatus = value.processingStatus;
  const errorCode = value.errorCode;
  if (
    !uuid(value.paymentEventId) ||
    value.paymentMode !== 'TEST' ||
    !requiredString(value.providerCode) ||
    !requiredString(value.providerEventId) ||
    typeof eventType !== 'string' ||
    !PAYMENT_EVENT_TYPES.has(eventType as PilotTestPaymentEventType) ||
    !requiredString(value.eventDigest) ||
    !uuid(value.rechargeOrderId) ||
    !safeInteger(value.amountMinor, 0) ||
    !currency(value.currency) ||
    !timezoneTimestamp(value.occurredAt) ||
    !timezoneTimestamp(value.receivedAt) ||
    typeof processingStatus !== 'string' ||
    !PAYMENT_PROCESSING_STATUSES.has(processingStatus as PilotPaymentEventProcessingStatus) ||
    !(
      errorCode === null ||
      (typeof errorCode === 'string' &&
        PAYMENT_ERROR_CODES.has(errorCode as PilotPaymentEventErrorCode))
    ) ||
    !nullableTimezoneTimestamp(value.processedAt)
  ) {
    throw invalidResponse('Control API 返回了无效的 Payment Event。');
  }
  return {
    paymentEventId: value.paymentEventId,
    paymentMode: 'TEST',
    eventType: eventType as PilotTestPaymentEventType,
    rechargeOrderId: value.rechargeOrderId,
    amountMinor: value.amountMinor,
    currency: value.currency,
    occurredAt: value.occurredAt,
    receivedAt: value.receivedAt,
    processingStatus: processingStatus as PilotPaymentEventProcessingStatus,
    errorCode: errorCode as PilotPaymentEventErrorCode | null,
    processedAt: value.processedAt,
  };
}

function parseCommissionCalculation(value: unknown): PilotCommissionCalculationAudit {
  if (!isRecord(value)) {
    throw invalidResponse('Control API 返回了无效的佣金计算审计数据。');
  }
  const outcome = value.outcome;
  if (
    !uuid(value.commissionCalculationOutcomeId) ||
    !uuid(value.sourcePaymentEventId) ||
    !uuid(value.rechargeOrderId) ||
    !nullableUuid(value.beneficiaryChannelId) ||
    !nullableUuid(value.commissionRuleVersionId) ||
    !safeInteger(value.basisAmountMinor, 0) ||
    !currency(value.currency) ||
    typeof outcome !== 'string' ||
    !COMMISSION_OUTCOMES.has(outcome as PilotCommissionCalculationOutcome) ||
    !requiredString(value.reasonCode) ||
    !timezoneTimestamp(value.occurredAt) ||
    !timezoneTimestamp(value.createdAt)
  ) {
    throw invalidResponse('Control API 返回了无效的佣金计算审计数据。');
  }
  return {
    commissionCalculationOutcomeId: value.commissionCalculationOutcomeId,
    sourcePaymentEventId: value.sourcePaymentEventId,
    rechargeOrderId: value.rechargeOrderId,
    beneficiaryChannelId: value.beneficiaryChannelId,
    commissionRuleVersionId: value.commissionRuleVersionId,
    basisAmountMinor: value.basisAmountMinor,
    currency: value.currency,
    outcome: outcome as PilotCommissionCalculationOutcome,
    reasonCode: value.reasonCode,
    occurredAt: value.occurredAt,
    createdAt: value.createdAt,
  };
}

function parseManualReview(value: unknown): PilotCommissionCalculationAudit {
  const review = parseCommissionCalculation(value);
  if (review.outcome !== 'manual_review') {
    throw invalidResponse('Control API 返回了非 manual_review 的人工处理记录。');
  }
  return review;
}

function parseCommissionAccrual(value: unknown): PilotCommissionAccrualAudit {
  if (
    !isRecord(value) ||
    !uuid(value.commissionAccrualId) ||
    !uuid(value.calculationOutcomeId) ||
    !uuid(value.sourcePaymentEventId) ||
    !uuid(value.rechargeOrderId) ||
    !uuid(value.beneficiaryChannelId) ||
    !uuid(value.commissionRuleVersionId) ||
    !safeInteger(value.basisAmountMinor, 0) ||
    !safeInteger(value.commissionAmountMinor, 0) ||
    !currency(value.currency) ||
    !timezoneTimestamp(value.eligibleAt) ||
    !timezoneTimestamp(value.occurredAt) ||
    !timezoneTimestamp(value.createdAt)
  ) {
    throw invalidResponse('Control API 返回了无效的佣金计提审计数据。');
  }
  return {
    commissionAccrualId: value.commissionAccrualId,
    calculationOutcomeId: value.calculationOutcomeId,
    sourcePaymentEventId: value.sourcePaymentEventId,
    rechargeOrderId: value.rechargeOrderId,
    beneficiaryChannelId: value.beneficiaryChannelId,
    commissionRuleVersionId: value.commissionRuleVersionId,
    basisAmountMinor: value.basisAmountMinor,
    commissionAmountMinor: value.commissionAmountMinor,
    currency: value.currency,
    eligibleAt: value.eligibleAt,
    occurredAt: value.occurredAt,
    createdAt: value.createdAt,
  };
}

function parseCommissionReversal(value: unknown): PilotCommissionReversalAudit {
  if (
    !isRecord(value) ||
    !uuid(value.commissionReversalId) ||
    !uuid(value.commissionAccrualId) ||
    !uuid(value.sourcePaymentEventId) ||
    !uuid(value.rechargeOrderId) ||
    !uuid(value.beneficiaryChannelId) ||
    !(value.reversalType === 'refund' || value.reversalType === 'chargeback') ||
    !safeInteger(value.reversalAmountMinor, 0) ||
    !currency(value.currency) ||
    !timezoneTimestamp(value.occurredAt) ||
    !timezoneTimestamp(value.createdAt)
  ) {
    throw invalidResponse('Control API 返回了无效的佣金冲正审计数据。');
  }
  return {
    commissionReversalId: value.commissionReversalId,
    commissionAccrualId: value.commissionAccrualId,
    sourcePaymentEventId: value.sourcePaymentEventId,
    rechargeOrderId: value.rechargeOrderId,
    beneficiaryChannelId: value.beneficiaryChannelId,
    reversalType: value.reversalType,
    reversalAmountMinor: value.reversalAmountMinor,
    currency: value.currency,
    occurredAt: value.occurredAt,
    createdAt: value.createdAt,
  };
}

function parseSettlement(value: unknown): PilotCommissionSettlementDraft {
  if (
    !isRecord(value) ||
    !uuid(value.commissionSettlementId) ||
    value.paymentMode !== 'TEST' ||
    !uuid(value.beneficiaryChannelId) ||
    !currency(value.currency) ||
    !timezoneTimestamp(value.periodStart) ||
    !timezoneTimestamp(value.periodEnd) ||
    !timezoneTimestamp(value.cutoffAt) ||
    value.status !== 'draft' ||
    !safeInteger(value.grossAccrualAmountMinor, 0) ||
    !safeInteger(value.grossReversalAmountMinor, 0) ||
    !safeInteger(value.netAmountMinor) ||
    !safeInteger(value.accrualItemCount, 0) ||
    !safeInteger(value.reversalItemCount, 0) ||
    !safeInteger(value.itemCount, 0) ||
    value.netAmountMinor !== value.grossAccrualAmountMinor - value.grossReversalAmountMinor ||
    value.itemCount !== value.accrualItemCount + value.reversalItemCount ||
    !timezoneTimestamp(value.createdAt)
  ) {
    throw invalidResponse('Control API 返回了无效的 TEST 佣金结算草稿。');
  }
  return {
    commissionSettlementId: value.commissionSettlementId,
    paymentMode: 'TEST',
    beneficiaryChannelId: value.beneficiaryChannelId,
    currency: value.currency,
    periodStart: value.periodStart,
    periodEnd: value.periodEnd,
    cutoffAt: value.cutoffAt,
    status: 'draft',
    grossAccrualAmountMinor: value.grossAccrualAmountMinor,
    grossReversalAmountMinor: value.grossReversalAmountMinor,
    netAmountMinor: value.netAmountMinor,
    accrualItemCount: value.accrualItemCount,
    reversalItemCount: value.reversalItemCount,
    itemCount: value.itemCount,
    createdAt: value.createdAt,
  };
}

function parseRechargeOrder(value: unknown): {
  tenantId: string;
  audit: PilotRechargeOrderAudit;
} {
  if (!isRecord(value)) throw invalidResponse('Control API 返回了无效的充值订单审计数据。');
  const status = value.status;
  if (
    !uuid(value.rechargeOrderId) ||
    !uuid(value.tenantId) ||
    !uuid(value.walletId) ||
    !uuid(value.buyerUserId) ||
    !uuid(value.buyerMembershipId) ||
    value.paymentMode !== 'TEST' ||
    !uuid(value.conversionRuleVersionId) ||
    !safeInteger(value.amountMinor, 0) ||
    !currency(value.currency) ||
    !safeInteger(value.purchasedCredits, 0) ||
    !safeInteger(value.bonusCredits, 0) ||
    !(value.bonusExpiresInDays === null || safeInteger(value.bonusExpiresInDays, 1)) ||
    typeof status !== 'string' ||
    !RECHARGE_ORDER_STATUSES.has(status as PilotRechargeOrderStatus) ||
    !nullableUuid(value.attributionSnapshotId) ||
    !timezoneTimestamp(value.createdAt) ||
    !timezoneTimestamp(value.updatedAt)
  ) {
    throw invalidResponse('Control API 返回了无效的充值订单审计数据。');
  }
  return {
    tenantId: value.tenantId,
    audit: {
      rechargeOrderId: value.rechargeOrderId,
      paymentMode: 'TEST',
      amountMinor: value.amountMinor,
      currency: value.currency,
      purchasedCredits: value.purchasedCredits,
      bonusCredits: value.bonusCredits,
      bonusExpiresInDays: value.bonusExpiresInDays,
      status: status as PilotRechargeOrderStatus,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    },
  };
}

function parseTermsDocument(value: unknown): PilotTermsDocument {
  if (!isRecord(value) || !exactKeys(value, TERMS_DOCUMENT_KEYS)) {
    throw invalidResponse('Control API 返回了无效的 Terms 文档。');
  }
  const status = value.status;
  if (
    !uuid(value.termsDocumentId) ||
    !trimmedText(value.documentCode, 100) ||
    !trimmedText(value.title, 300) ||
    typeof status !== 'string' ||
    !TERMS_DOCUMENT_STATUSES.has(status as PilotTermsDocumentStatus) ||
    !timezoneTimestamp(value.createdAt) ||
    !timezoneTimestamp(value.updatedAt)
  ) {
    throw invalidResponse('Control API 返回了无效的 Terms 文档。');
  }
  return {
    termsDocumentId: value.termsDocumentId,
    documentCode: value.documentCode,
    title: value.title,
    status: status as PilotTermsDocumentStatus,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function parseTermsVersion(value: unknown): PilotTermsVersion {
  if (!isRecord(value) || !exactKeys(value, TERMS_VERSION_KEYS)) {
    throw invalidResponse('Control API 返回了无效的 Terms 版本。');
  }
  const status = value.status;
  if (
    !uuid(value.termsVersionId) ||
    !uuid(value.termsDocumentId) ||
    !trimmedText(value.versionLabel, 100) ||
    typeof status !== 'string' ||
    !TERMS_VERSION_STATUSES.has(status as PilotTermsVersionStatus) ||
    !trimmedText(value.content, 1_000_000) ||
    typeof value.contentDigest !== 'string' ||
    !SHA256_DIGEST_PATTERN.test(value.contentDigest) ||
    !trimmedText(value.locale, 35) ||
    !nullableTimezoneTimestamp(value.publishedAt) ||
    !nullableTimezoneTimestamp(value.effectiveAt) ||
    !nullableUuid(value.publishedBy) ||
    !nullableUuid(value.supersedesTermsVersionId) ||
    typeof value.mustReaccept !== 'boolean' ||
    !timezoneTimestamp(value.createdAt) ||
    !timezoneTimestamp(value.updatedAt)
  ) {
    throw invalidResponse('Control API 返回了无效的 Terms 版本。');
  }
  return {
    termsVersionId: value.termsVersionId,
    termsDocumentId: value.termsDocumentId,
    versionLabel: value.versionLabel,
    status: status as PilotTermsVersionStatus,
    content: value.content,
    contentDigest: value.contentDigest,
    locale: value.locale,
    publishedAt: value.publishedAt,
    effectiveAt: value.effectiveAt,
    publishedBy: value.publishedBy,
    supersedesTermsVersionId: value.supersedesTermsVersionId,
    mustReaccept: value.mustReaccept,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function parseInvitationManagement(value: unknown): PilotInvitationManagement {
  if (!isRecord(value) || !exactKeys(value, INVITATION_KEYS)) {
    throw invalidResponse('Control API 返回了无效的邀请管理数据。');
  }
  const invitationType = value.invitationType;
  const status = value.status;
  const targetEmail = value.targetEmail;
  if (
    !uuid(value.invitationId) ||
    typeof invitationType !== 'string' ||
    !INVITATION_TYPES.has(invitationType as PilotInvitationType) ||
    !nullableUuid(value.targetOrganizationId) ||
    !(value.targetRoleCode === null || value.targetRoleCode === 'content_operator') ||
    !(
      targetEmail === null ||
      (normalizedEmail(targetEmail) && targetEmail === targetEmail.toLowerCase())
    ) ||
    !nullableUuid(value.attributionChannelId) ||
    typeof status !== 'string' ||
    !INVITATION_STATUSES.has(status as PilotInvitationStatus) ||
    !timezoneTimestamp(value.validFrom) ||
    !timezoneTimestamp(value.expiresAt) ||
    Date.parse(value.expiresAt) <= Date.parse(value.validFrom) ||
    !safeInteger(value.maxUses, 1) ||
    !safeInteger(value.usedCount, 0) ||
    !safeInteger(value.remainingUses, 0) ||
    value.remainingUses !== Math.max(0, value.maxUses - value.usedCount) ||
    !timezoneTimestamp(value.createdAt) ||
    !timezoneTimestamp(value.updatedAt) ||
    !nullableTimezoneTimestamp(value.revokedAt) ||
    (status === 'revoked' ? value.revokedAt === null : value.revokedAt !== null)
  ) {
    throw invalidResponse('Control API 返回了无效的邀请管理数据。');
  }

  const validPlatform =
    invitationType === 'PLATFORM' &&
    value.targetOrganizationId === null &&
    value.targetRoleCode === null &&
    targetEmail !== null &&
    value.maxUses === 1;
  const validChannel =
    invitationType === 'CHANNEL' &&
    value.targetOrganizationId === null &&
    value.targetRoleCode === null &&
    targetEmail === null &&
    value.attributionChannelId === null &&
    value.maxUses === 100;
  const validTenant =
    invitationType === 'TENANT_MEMBER' &&
    uuid(value.targetOrganizationId) &&
    value.targetRoleCode === 'content_operator' &&
    targetEmail !== null &&
    value.attributionChannelId === null &&
    value.maxUses === 1;
  if (!(validPlatform || validChannel || validTenant)) {
    throw invalidResponse('Control API 返回了不一致的邀请类型与目标。');
  }

  return {
    invitationId: value.invitationId,
    invitationType: invitationType as PilotInvitationType,
    targetOrganizationId: value.targetOrganizationId,
    targetRoleCode: value.targetRoleCode,
    targetEmail,
    attributionChannelId: value.attributionChannelId,
    status: status as PilotInvitationStatus,
    validFrom: value.validFrom,
    expiresAt: value.expiresAt,
    maxUses: value.maxUses,
    usedCount: value.usedCount,
    remainingUses: value.remainingUses,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    revokedAt: value.revokedAt,
  };
}

function parseCurrentOrganizationMember(value: unknown): PilotCurrentOrganizationMember {
  if (!isRecord(value) || !exactKeys(value, MEMBER_PROJECTION_KEYS)) {
    throw invalidResponse('Control API 返回了无效的成员目录数据。');
  }
  const status = value.status;
  const primaryRole = value.primaryRole;
  const roles = parseRoles(value.roles);
  if (
    !uuid(value.membershipId) ||
    !requiredString(value.displayName) ||
    value.displayName !== value.displayName.trim() ||
    !normalizedEmail(value.email) ||
    typeof status !== 'string' ||
    !MEMBER_STATUSES.has(status as PilotMemberStatus) ||
    typeof primaryRole !== 'string' ||
    !PILOT_ROLES.has(primaryRole as PilotRole) ||
    !roles ||
    !roles.includes(primaryRole as PilotRole) ||
    !safeInteger(value.version, 1) ||
    !timezoneTimestamp(value.createdAt) ||
    !timezoneTimestamp(value.updatedAt) ||
    typeof value.isCurrentActor !== 'boolean'
  ) {
    throw invalidResponse('Control API 返回了无效的成员目录数据。');
  }
  return {
    membershipId: value.membershipId,
    displayName: value.displayName,
    email: value.email,
    status: status as PilotMemberStatus,
    primaryRole: primaryRole as PilotRole,
    roles,
    version: value.version,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    isCurrentActor: value.isCurrentActor,
  };
}

function commercialRead(path: string) {
  return request(path, { cache: 'no-store' });
}

export async function listPilotCurrentOrganizationMembers(
  status: PilotMemberStatusFilter = 'all',
  limit = 100,
): Promise<PilotCurrentOrganizationMember[]> {
  if (!MEMBER_STATUS_FILTERS.has(status)) {
    throw new PilotControlApiError('INVALID_MEMBER_STATUS', '成员目录 status 无效。', null, null);
  }
  const bounded = listLimit(limit);
  const { body } = await commercialRead(
    `/api/v1/organizations/current/members?status=${encodeURIComponent(status)}&limit=${bounded}`,
  );
  return parseList(
    body,
    'members',
    parseCurrentOrganizationMember,
    'Control API 返回了无效的成员目录。',
  );
}

export async function suspendPilotCurrentOrganizationMember(
  membershipId: string,
  expectedVersion: number,
): Promise<PilotMemberSuspendResult> {
  const canonicalMembershipId = requireUuid(
    membershipId,
    'INVALID_MEMBERSHIP_ID',
    'Membership ID 无效。',
  );
  if (!safeInteger(expectedVersion, 1)) {
    throw new PilotControlApiError(
      'INVALID_MEMBER_VERSION',
      '成员 expectedVersion 必须为正整数。',
      null,
      null,
    );
  }
  const { response, body } = await request(
    `/api/v1/organizations/current/members/${encodeURIComponent(canonicalMembershipId)}/suspend`,
    {
      method: 'POST',
      body: JSON.stringify({ expectedVersion }),
    },
  );
  return {
    member: parseCurrentOrganizationMember(isRecord(body) ? body.member : null),
    replayed: parseReplayHeader(response, 'Control API 返回了无效的成员停用幂等状态。'),
  };
}

function validateTermsDraftInput(
  input: PilotCreateTermsDraftInput | PilotUpdateTermsDraftInput,
  allowEffectiveAt: boolean,
): void {
  if (!isRecord(input)) {
    throw new PilotControlApiError(
      allowEffectiveAt ? 'INVALID_TERMS_DRAFT_UPDATE_INPUT' : 'INVALID_TERMS_DRAFT_INPUT',
      'Terms 草稿输入无效。',
      null,
      null,
    );
  }
  const record = input;
  const allowed = allowEffectiveAt ? TERMS_UPDATE_INPUT_KEYS : TERMS_DRAFT_INPUT_KEYS;
  const effectiveAt = record.effectiveAt;
  if (
    !onlyKeys(record, allowed) ||
    ![...TERMS_DRAFT_INPUT_KEYS].every((key) => Object.hasOwn(record, key)) ||
    !trimmedText(record.versionLabel, 100) ||
    !trimmedText(record.content, 1_000_000) ||
    !trimmedText(record.locale, 35) ||
    typeof record.mustReaccept !== 'boolean' ||
    !nullableUuid(record.supersedesTermsVersionId) ||
    (Object.hasOwn(record, 'effectiveAt') &&
      !(effectiveAt === null || timezoneTimestamp(effectiveAt)))
  ) {
    throw new PilotControlApiError(
      allowEffectiveAt ? 'INVALID_TERMS_DRAFT_UPDATE_INPUT' : 'INVALID_TERMS_DRAFT_INPUT',
      'Terms 草稿输入无效。',
      null,
      null,
    );
  }
}

export async function listPilotTermsDocuments(
  status: PilotTermsDocumentStatusFilter = 'all',
  limit = 100,
): Promise<PilotTermsDocument[]> {
  if (!TERMS_DOCUMENT_STATUS_FILTERS.has(status)) {
    throw new PilotControlApiError(
      'INVALID_TERMS_DOCUMENT_STATUS',
      'Terms 文档目录 status 无效。',
      null,
      null,
    );
  }
  const bounded = listLimit(limit);
  const { body } = await commercialRead(
    `/api/v1/platform/terms/documents?status=${encodeURIComponent(status)}&limit=${bounded}`,
  );
  if (!isRecord(body) || !exactKeys(body, new Set(['documents']))) {
    throw invalidResponse('Control API 返回了无效的 Terms 文档目录。');
  }
  return parseList(
    body,
    'documents',
    parseTermsDocument,
    'Control API 返回了无效的 Terms 文档目录。',
  );
}

export async function listPilotTermsVersions(
  documentId: string,
  status: PilotTermsVersionStatusFilter = 'all',
  limit = 100,
): Promise<PilotTermsVersion[]> {
  const canonicalDocumentId = requireUuid(
    documentId,
    'INVALID_TERMS_DOCUMENT_ID',
    'Terms Document ID 无效。',
  );
  if (!TERMS_VERSION_STATUS_FILTERS.has(status)) {
    throw new PilotControlApiError(
      'INVALID_TERMS_VERSION_STATUS',
      'Terms 版本目录 status 无效。',
      null,
      null,
    );
  }
  const bounded = listLimit(limit);
  const { body } = await commercialRead(
    `/api/v1/platform/terms/documents/${encodeURIComponent(canonicalDocumentId)}/versions?status=${encodeURIComponent(status)}&limit=${bounded}`,
  );
  if (!isRecord(body) || !exactKeys(body, new Set(['versions']))) {
    throw invalidResponse('Control API 返回了无效的 Terms 版本目录。');
  }
  return parseList(
    body,
    'versions',
    parseTermsVersion,
    'Control API 返回了无效的 Terms 版本目录。',
  );
}

export async function createPilotTermsDocument(
  input: PilotCreateTermsDocumentInput,
): Promise<PilotTermsDocument> {
  const record = input as unknown as Record<string, unknown>;
  if (
    !isRecord(input) ||
    !exactKeys(record, new Set(['documentCode', 'title'])) ||
    !trimmedText(record.documentCode, 100) ||
    !trimmedText(record.title, 300)
  ) {
    throw new PilotControlApiError(
      'INVALID_TERMS_DOCUMENT_INPUT',
      'Terms 文档输入无效。',
      null,
      null,
    );
  }
  const { body } = await request('/api/v1/platform/terms/documents', {
    method: 'POST',
    body: JSON.stringify({ documentCode: input.documentCode, title: input.title }),
  });
  const document = parseTermsDocument(body);
  if (document.status !== 'active') {
    throw invalidResponse('Control API 返回了无效的新建 Terms 文档状态。');
  }
  return document;
}

export async function createPilotTermsDraft(
  documentId: string,
  input: PilotCreateTermsDraftInput,
): Promise<PilotTermsVersion> {
  const canonicalDocumentId = requireUuid(
    documentId,
    'INVALID_TERMS_DOCUMENT_ID',
    'Terms Document ID 无效。',
  );
  validateTermsDraftInput(input, false);
  const { body } = await request(
    `/api/v1/platform/terms/documents/${encodeURIComponent(canonicalDocumentId)}/versions`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  const version = parseTermsVersion(body);
  if (version.termsDocumentId !== canonicalDocumentId || version.status !== 'DRAFT') {
    throw invalidResponse('Control API 返回了跨文档或非 DRAFT 的 Terms 版本。');
  }
  return version;
}

export async function updatePilotTermsDraft(
  versionId: string,
  input: PilotUpdateTermsDraftInput,
): Promise<PilotTermsVersion> {
  const canonicalVersionId = requireUuid(
    versionId,
    'INVALID_TERMS_VERSION_ID',
    'Terms Version ID 无效。',
  );
  validateTermsDraftInput(input, true);
  const { body } = await request(
    `/api/v1/platform/terms/versions/${encodeURIComponent(canonicalVersionId)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
  const version = parseTermsVersion(body);
  if (version.termsVersionId !== canonicalVersionId || version.status !== 'DRAFT') {
    throw invalidResponse('Control API 返回了错误目标或非 DRAFT 的 Terms 版本。');
  }
  return version;
}

export async function publishPilotTermsVersion(
  versionId: string,
  input: PilotPublishTermsVersionInput,
): Promise<PilotTermsVersionReplayResult> {
  const canonicalVersionId = requireUuid(
    versionId,
    'INVALID_TERMS_VERSION_ID',
    'Terms Version ID 无效。',
  );
  const record = input as unknown as Record<string, unknown>;
  if (
    !isRecord(input) ||
    !exactKeys(record, new Set(['effectiveAt'])) ||
    !timezoneTimestamp(record.effectiveAt)
  ) {
    throw new PilotControlApiError(
      'INVALID_TERMS_PUBLISH_INPUT',
      'Terms 发布生效时间无效。',
      null,
      null,
    );
  }
  const { response, body } = await request(
    `/api/v1/platform/terms/versions/${encodeURIComponent(canonicalVersionId)}/publish`,
    { method: 'POST', body: JSON.stringify({ effectiveAt: input.effectiveAt }) },
  );
  const version = parseTermsVersion(body);
  if (version.termsVersionId !== canonicalVersionId || version.status !== 'PUBLISHED') {
    throw invalidResponse('Control API 返回了错误目标或非 PUBLISHED 的 Terms 版本。');
  }
  return {
    version,
    replayed: parseReplayHeader(response, 'Control API 返回了无效的 Terms 发布幂等状态。'),
  };
}

export async function retirePilotTermsVersion(
  versionId: string,
): Promise<PilotTermsVersionReplayResult> {
  const canonicalVersionId = requireUuid(
    versionId,
    'INVALID_TERMS_VERSION_ID',
    'Terms Version ID 无效。',
  );
  const { response, body } = await request(
    `/api/v1/platform/terms/versions/${encodeURIComponent(canonicalVersionId)}/retire`,
    { method: 'POST', body: JSON.stringify({}) },
  );
  const version = parseTermsVersion(body);
  if (version.termsVersionId !== canonicalVersionId || version.status !== 'RETIRED') {
    throw invalidResponse('Control API 返回了错误目标或非 RETIRED 的 Terms 版本。');
  }
  return {
    version,
    replayed: parseReplayHeader(response, 'Control API 返回了无效的 Terms 退役幂等状态。'),
  };
}

function validateInvitationStatus(status: PilotInvitationStatusFilter): void {
  if (!INVITATION_STATUS_FILTERS.has(status)) {
    throw new PilotControlApiError(
      'INVALID_INVITATION_STATUS',
      '邀请目录 status 无效。',
      null,
      null,
    );
  }
}

async function listPilotInvitations(
  path: string,
  status: PilotInvitationStatusFilter,
  limit: number,
): Promise<PilotInvitationManagement[]> {
  validateInvitationStatus(status);
  const bounded = listLimit(limit);
  const { body } = await commercialRead(
    `${path}?status=${encodeURIComponent(status)}&limit=${bounded}`,
  );
  if (!isRecord(body) || !exactKeys(body, new Set(['invitations']))) {
    throw invalidResponse('Control API 返回了无效的邀请目录。');
  }
  return parseList(
    body,
    'invitations',
    parseInvitationManagement,
    'Control API 返回了无效的邀请目录。',
  );
}

export async function listPilotPlatformInvitations(
  status: PilotInvitationStatusFilter = 'all',
  limit = 100,
): Promise<PilotInvitationManagement[]> {
  const invitations = await listPilotInvitations('/api/v1/platform/invitations', status, limit);
  if (!invitations.every((invitation) => invitation.invitationType === 'PLATFORM')) {
    throw invalidResponse('Control API 返回了非 Platform 的邀请。');
  }
  return invitations;
}

export async function listPilotChannelInvitations(
  channelId: string,
  status: PilotInvitationStatusFilter = 'all',
  limit = 100,
): Promise<PilotInvitationManagement[]> {
  const canonicalChannelId = requireUuid(
    channelId,
    'INVALID_CHANNEL_ID',
    'canonical Channel ID 无效。',
  );
  const invitations = await listPilotInvitations(
    `/api/v1/channels/${encodeURIComponent(canonicalChannelId)}/invitations`,
    status,
    limit,
  );
  if (!invitations.every((invitation) => invitation.invitationType === 'CHANNEL')) {
    throw invalidResponse('Control API 返回了非 Channel 的邀请。');
  }
  return invitations;
}

export async function listPilotTenantInvitations(
  tenantId: string,
  status: PilotInvitationStatusFilter = 'all',
  limit = 100,
): Promise<PilotInvitationManagement[]> {
  const canonicalTenantId = requireUuid(
    tenantId,
    'INVALID_TENANT_ID',
    'canonical Tenant ID 无效。',
  );
  const invitations = await listPilotInvitations(
    `/api/v1/tenants/${encodeURIComponent(canonicalTenantId)}/invitations`,
    status,
    limit,
  );
  if (
    !invitations.every(
      (invitation) =>
        invitation.invitationType === 'TENANT_MEMBER' &&
        invitation.targetOrganizationId === canonicalTenantId,
    )
  ) {
    throw invalidResponse('Control API 返回了跨 Tenant 的邀请。');
  }
  return invitations;
}

function validateIdempotencyKey(value: unknown): value is string {
  return trimmedText(value, 200);
}

function parseInvitationCreateResult(
  response: Response,
  body: unknown,
  expectedType: PilotInvitationType,
  expectedTenantId?: string,
): PilotInvitationCreateResult {
  const replayed = parseReplayHeader(response, 'Control API 返回了无效的邀请创建幂等状态。');
  if (!isRecord(body) || !exactKeys(body, new Set(['invitation', 'token']))) {
    throw invalidResponse('Control API 返回了无效的邀请创建响应。');
  }
  const invitation = parseInvitationManagement(body.invitation);
  if (
    invitation.invitationType !== expectedType ||
    (expectedTenantId !== undefined && invitation.targetOrganizationId !== expectedTenantId)
  ) {
    throw invalidResponse('Control API 返回了错误 Scope 的邀请。');
  }
  const token = body.token;
  if (replayed ? token !== null : !trimmedText(token, 1024)) {
    throw invalidResponse('Control API 返回了不一致的邀请 Token replay 状态。');
  }
  return { invitation, token: token as string | null, replayed };
}

export async function createPilotPlatformInvitation(
  input: PilotCreatePlatformInvitationInput,
): Promise<PilotInvitationCreateResult> {
  if (
    !isRecord(input) ||
    !exactKeys(input, new Set(['targetEmail', 'attributionChannelId', 'idempotencyKey'])) ||
    !normalizedEmail(input.targetEmail) ||
    !nullableUuid(input.attributionChannelId) ||
    !validateIdempotencyKey(input.idempotencyKey)
  ) {
    throw new PilotControlApiError(
      'INVALID_PLATFORM_INVITATION_INPUT',
      'Platform 邀请输入无效。',
      null,
      null,
    );
  }
  const { response, body } = await request('/api/v1/platform/invitations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return parseInvitationCreateResult(response, body, 'PLATFORM');
}

export async function createPilotChannelInvitation(
  channelId: string,
  input: PilotCreateChannelInvitationInput,
): Promise<PilotInvitationCreateResult> {
  const canonicalChannelId = requireUuid(
    channelId,
    'INVALID_CHANNEL_ID',
    'canonical Channel ID 无效。',
  );
  if (
    !isRecord(input) ||
    !exactKeys(input, new Set(['idempotencyKey'])) ||
    !validateIdempotencyKey(input.idempotencyKey)
  ) {
    throw new PilotControlApiError(
      'INVALID_CHANNEL_INVITATION_INPUT',
      'Channel 邀请输入无效。',
      null,
      null,
    );
  }
  const { response, body } = await request(
    `/api/v1/channels/${encodeURIComponent(canonicalChannelId)}/invitations`,
    { method: 'POST', body: JSON.stringify({ idempotencyKey: input.idempotencyKey }) },
  );
  return parseInvitationCreateResult(response, body, 'CHANNEL');
}

export async function createPilotTenantInvitation(
  tenantId: string,
  input: PilotCreateTenantInvitationInput,
): Promise<PilotInvitationCreateResult> {
  const canonicalTenantId = requireUuid(
    tenantId,
    'INVALID_TENANT_ID',
    'canonical Tenant ID 无效。',
  );
  if (
    !isRecord(input) ||
    !exactKeys(input, new Set(['targetEmail', 'idempotencyKey'])) ||
    !normalizedEmail(input.targetEmail) ||
    !validateIdempotencyKey(input.idempotencyKey)
  ) {
    throw new PilotControlApiError(
      'INVALID_TENANT_INVITATION_INPUT',
      'Tenant 邀请输入无效。',
      null,
      null,
    );
  }
  const { response, body } = await request(
    `/api/v1/tenants/${encodeURIComponent(canonicalTenantId)}/invitations`,
    {
      method: 'POST',
      body: JSON.stringify({
        targetEmail: input.targetEmail,
        idempotencyKey: input.idempotencyKey,
      }),
    },
  );
  return parseInvitationCreateResult(response, body, 'TENANT_MEMBER', canonicalTenantId);
}

export async function revokePilotInvitation(
  invitationId: string,
): Promise<PilotInvitationReplayResult> {
  const canonicalInvitationId = requireUuid(
    invitationId,
    'INVALID_INVITATION_ID',
    'Invitation ID 无效。',
  );
  const { response, body } = await request(
    `/api/v1/invitations/${encodeURIComponent(canonicalInvitationId)}/revoke`,
    { method: 'POST', body: JSON.stringify({}) },
  );
  const replayed = parseReplayHeader(response, 'Control API 返回了无效的邀请撤销幂等状态。');
  if (!isRecord(body) || !exactKeys(body, new Set(['invitation']))) {
    throw invalidResponse('Control API 返回了无效的邀请撤销响应。');
  }
  const invitation = parseInvitationManagement(body.invitation);
  if (invitation.invitationId !== canonicalInvitationId || invitation.status !== 'revoked') {
    throw invalidResponse('Control API 返回了错误目标或非 revoked 的邀请。');
  }
  return { invitation, replayed };
}

export async function readPilotCurrentChannel(): Promise<PilotCommercialChannelReference> {
  const { body } = await commercialRead('/api/v1/channels/current');
  return parseCommercialChannel(isRecord(body) ? body.channel : null);
}

export async function listPilotActiveChannels(
  limit = 100,
): Promise<PilotCommercialChannelReference[]> {
  const bounded = listLimit(limit);
  const { body } = await commercialRead(`/api/v1/platform/channels?status=active&limit=${bounded}`);
  return parseList(body, 'channels', parseCommercialChannel, 'Control API 返回了无效的渠道目录。');
}

export async function listPilotPlatformPaymentEvents(
  limit = 50,
): Promise<PilotPaymentEventAudit[]> {
  const bounded = listLimit(limit);
  const { body } = await commercialRead(`/api/v1/platform/payment-events?limit=${bounded}`);
  return parseList(
    body,
    'paymentEvents',
    parsePaymentEvent,
    'Control API 返回了无效的 Payment Event 列表。',
  );
}

async function listPlatformCommission<T>(
  path: string,
  key: string,
  parser: (value: unknown) => T,
  limit: number,
): Promise<T[]> {
  const bounded = listLimit(limit);
  const { body } = await commercialRead(
    `/api/v1/platform/commission-audit/${path}?limit=${bounded}`,
  );
  return parseList(body, key, parser, 'Control API 返回了无效的平台佣金审计列表。');
}

export function listPilotPlatformCommissionCalculations(
  limit = 50,
): Promise<PilotCommissionCalculationAudit[]> {
  return listPlatformCommission('calculations', 'calculations', parseCommissionCalculation, limit);
}

export function listPilotPlatformCommissionAccruals(
  limit = 50,
): Promise<PilotCommissionAccrualAudit[]> {
  return listPlatformCommission('accruals', 'accruals', parseCommissionAccrual, limit);
}

export function listPilotPlatformCommissionReversals(
  limit = 50,
): Promise<PilotCommissionReversalAudit[]> {
  return listPlatformCommission('reversals', 'reversals', parseCommissionReversal, limit);
}

export function listPilotPlatformCommissionManualReviews(
  limit = 50,
): Promise<PilotCommissionCalculationAudit[]> {
  return listPlatformCommission('manual-reviews', 'manualReviews', parseManualReview, limit);
}

async function listChannelCommission<T>(
  channelId: string,
  path: string,
  key: string,
  parser: (value: unknown) => T,
  limit: number,
): Promise<T[]> {
  const canonicalChannelId = requireUuid(
    channelId,
    'INVALID_CHANNEL_ID',
    'canonical Channel ID 无效。',
  );
  const bounded = listLimit(limit);
  const { body } = await commercialRead(
    `/api/v1/channels/${encodeURIComponent(canonicalChannelId)}/commission-audit/${path}?limit=${bounded}`,
  );
  return parseList(body, key, parser, 'Control API 返回了无效的渠道佣金审计列表。');
}

export function listPilotChannelCommissionCalculations(
  channelId: string,
  limit = 50,
): Promise<PilotCommissionCalculationAudit[]> {
  return listChannelCommission(
    channelId,
    'calculations',
    'calculations',
    parseCommissionCalculation,
    limit,
  );
}

export function listPilotChannelCommissionAccruals(
  channelId: string,
  limit = 50,
): Promise<PilotCommissionAccrualAudit[]> {
  return listChannelCommission(channelId, 'accruals', 'accruals', parseCommissionAccrual, limit);
}

export function listPilotChannelCommissionReversals(
  channelId: string,
  limit = 50,
): Promise<PilotCommissionReversalAudit[]> {
  return listChannelCommission(channelId, 'reversals', 'reversals', parseCommissionReversal, limit);
}

function normalizeSettlementInput(
  input: PilotCreateTestCommissionSettlementInput,
): PilotCreateTestCommissionSettlementInput {
  const idempotencyKey = input.idempotencyKey.trim();
  const periodStartDate = new Date(`${input.periodStart}T00:00:00.000Z`);
  if (
    input.paymentMode !== 'TEST' ||
    !uuid(input.beneficiaryChannelId) ||
    !currency(input.currency) ||
    !MONTH_START_PATTERN.test(input.periodStart) ||
    Number.isNaN(periodStartDate.getTime()) ||
    periodStartDate.toISOString().slice(0, 10) !== input.periodStart ||
    !timezoneTimestamp(input.cutoffAt) ||
    !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)
  ) {
    throw new PilotControlApiError(
      'INVALID_SETTLEMENT_INPUT',
      'TEST 佣金结算草稿输入无效。',
      null,
      null,
    );
  }
  return { ...input, idempotencyKey };
}

export async function createPilotTestCommissionSettlement(
  input: PilotCreateTestCommissionSettlementInput,
): Promise<PilotCommissionSettlementResult> {
  const normalized = normalizeSettlementInput(input);
  const { response, body } = await request('/api/v1/platform/commission-settlements', {
    method: 'POST',
    body: JSON.stringify(normalized),
  });
  const replayedHeader = response.headers.get('idempotency-replayed');
  if (!(replayedHeader === 'true' || replayedHeader === 'false')) {
    throw invalidResponse('Control API 返回了无效的 Settlement 幂等状态。');
  }
  return {
    settlement: parseSettlement(isRecord(body) ? body.settlement : null),
    replayed: replayedHeader === 'true',
  };
}

export async function listPilotTenantRechargeOrders(
  tenantId: string,
  limit = 50,
): Promise<PilotRechargeOrderAudit[]> {
  const canonicalTenantId = requireUuid(
    tenantId,
    'INVALID_TENANT_ID',
    'canonical Tenant ID 无效。',
  );
  const bounded = listLimit(limit);
  const { body } = await commercialRead(
    `/api/v1/tenants/${encodeURIComponent(canonicalTenantId)}/recharge-orders?limit=${bounded}`,
  );
  const orders = parseList(
    body,
    'rechargeOrders',
    parseRechargeOrder,
    'Control API 返回了无效的充值订单列表。',
  );
  return orders.map((order) => {
    if (order.tenantId !== canonicalTenantId) {
      throw invalidResponse('Control API 返回了跨 Tenant 的充值订单。');
    }
    return order.audit;
  });
}

export const pilotControlApi = {
  login: loginToPilot,
  hydrate: hydratePilotSession,
  logout: logoutPilotSession,
  listProjects: listPilotProjects,
  readProject: readPilotProject,
  listCurrentOrganizationMembers: listPilotCurrentOrganizationMembers,
  suspendCurrentOrganizationMember: suspendPilotCurrentOrganizationMember,
  listTermsDocuments: listPilotTermsDocuments,
  listTermsVersions: listPilotTermsVersions,
  createTermsDocument: createPilotTermsDocument,
  createTermsDraft: createPilotTermsDraft,
  updateTermsDraft: updatePilotTermsDraft,
  publishTermsVersion: publishPilotTermsVersion,
  retireTermsVersion: retirePilotTermsVersion,
  listPlatformInvitations: listPilotPlatformInvitations,
  listChannelInvitations: listPilotChannelInvitations,
  listTenantInvitations: listPilotTenantInvitations,
  createPlatformInvitation: createPilotPlatformInvitation,
  createChannelInvitation: createPilotChannelInvitation,
  createTenantInvitation: createPilotTenantInvitation,
  revokeInvitation: revokePilotInvitation,
  readCurrentChannel: readPilotCurrentChannel,
  listActiveChannels: listPilotActiveChannels,
  listPlatformPaymentEvents: listPilotPlatformPaymentEvents,
  listPlatformCommissionCalculations: listPilotPlatformCommissionCalculations,
  listPlatformCommissionAccruals: listPilotPlatformCommissionAccruals,
  listPlatformCommissionReversals: listPilotPlatformCommissionReversals,
  listPlatformCommissionManualReviews: listPilotPlatformCommissionManualReviews,
  listChannelCommissionCalculations: listPilotChannelCommissionCalculations,
  listChannelCommissionAccruals: listPilotChannelCommissionAccruals,
  listChannelCommissionReversals: listPilotChannelCommissionReversals,
  createTestCommissionSettlement: createPilotTestCommissionSettlement,
  listTenantRechargeOrders: listPilotTenantRechargeOrders,
} as const;
