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

function commercialRead(path: string) {
  return request(path, { cache: 'no-store' });
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
