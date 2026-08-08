import { commissionSettlementRequestDigest } from './digest.js';
import {
  CommissionSettlementPermissionDeniedError,
  CommissionSettlementScopeNotFoundError,
  CommissionSettlementValidationError,
} from './errors.js';
import type {
  CommissionSettlementActor,
  CommissionSettlementStore,
  CreateCommissionSettlementInput,
  ReplayableCommissionSettlement,
} from './types.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const idempotencyPattern = /^[A-Za-z0-9._:-]{1,200}$/;
const periodPattern = /^\d{4}-\d{2}-01$/;

function uuid(value: string, field: string): string {
  const normalized = value.trim();
  if (!uuidPattern.test(normalized)) {
    throw new CommissionSettlementValidationError(`${field} is invalid.`);
  }
  return normalized.toLowerCase();
}

function currency(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new CommissionSettlementValidationError('currency is invalid.');
  }
  return normalized;
}

function idempotencyKey(value: string): string {
  const normalized = value.trim();
  if (!idempotencyPattern.test(normalized)) {
    throw new CommissionSettlementValidationError('idempotencyKey is invalid.');
  }
  return normalized;
}

function utcMonth(value: string): { start: Date; end: Date; startText: string; endText: string } {
  if (!periodPattern.test(value)) {
    throw new CommissionSettlementValidationError('periodStart must be a UTC month start.');
  }
  const start = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== value) {
    throw new CommissionSettlementValidationError('periodStart must be a valid UTC month start.');
  }
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return {
    start,
    end,
    startText: start.toISOString().slice(0, 10),
    endText: end.toISOString().slice(0, 10),
  };
}

function cutoff(value: string, periodEnd: Date): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new CommissionSettlementValidationError('cutoffAt must be a timezone-aware timestamp.');
  }
  if (parsed.getTime() < periodEnd.getTime()) {
    throw new CommissionSettlementValidationError('cutoffAt cannot be earlier than periodEnd.');
  }
  return parsed;
}

export class CommissionSettlementService {
  constructor(
    private readonly store: CommissionSettlementStore,
    private readonly digestSecret: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createDraft(
    actor: CommissionSettlementActor,
    input: CreateCommissionSettlementInput,
  ): Promise<ReplayableCommissionSettlement> {
    this.requirePlatformAdmin(actor);
    if (input.paymentMode !== 'TEST') {
      throw new CommissionSettlementValidationError('paymentMode must be TEST.');
    }

    const beneficiaryChannelId = uuid(input.beneficiaryChannelId, 'beneficiaryChannelId');
    const normalizedCurrency = currency(input.currency);
    const period = utcMonth(input.periodStart);
    const cutoffAt = cutoff(input.cutoffAt, period.end);
    const normalizedIdempotencyKey = idempotencyKey(input.idempotencyKey);
    const facts = {
      paymentMode: 'TEST' as const,
      beneficiaryChannelId,
      currency: normalizedCurrency,
      periodStart: period.startText,
      periodEnd: period.endText,
      cutoffAt: cutoffAt.toISOString(),
      idempotencyKey: normalizedIdempotencyKey,
    };

    return this.store.createDraft({
      ...facts,
      periodStart: period.start,
      periodEnd: period.end,
      cutoffAt,
      requestDigest: commissionSettlementRequestDigest(this.digestSecret, facts),
      createdByUserId: uuid(actor.userId, 'actor.userId'),
      createdByMembershipId: uuid(actor.membershipId, 'actor.membershipId'),
      createdAt: this.now(),
    });
  }

  private requirePlatformAdmin(actor: CommissionSettlementActor): void {
    if (actor.organizationType !== 'PLATFORM') {
      throw new CommissionSettlementScopeNotFoundError();
    }
    if (!actor.roles.includes('platform_admin')) {
      throw new CommissionSettlementPermissionDeniedError();
    }
  }
}
