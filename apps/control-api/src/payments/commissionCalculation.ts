import { createHash } from 'node:crypto';

export type CommissionRoundingMode = 'FLOOR' | 'CEILING' | 'HALF_UP';

export type CommissionAttributionFacts = {
  referralAttributionId: string;
  beneficiaryChannelId: string | null;
  status: string;
  effectiveFrom: Date;
  protectedUntil: Date | null;
  channelOrganizationStatus: string | null;
};

export type CommissionRuleFacts = {
  commissionRuleVersionId: string;
  rateNumerator: string | number;
  rateDenominator: string | number;
  roundingMode: CommissionRoundingMode;
  refundObservationDays: number;
};

export type CommissionCalculationSnapshot = {
  schemaVersion: 'commission-calculation-v1';
  outcome: 'accrued' | 'not_attributed' | 'attribution_expired' | 'manual_review';
  reasonCode:
    | 'commission_accrued'
    | 'no_frozen_attribution'
    | 'attribution_expired'
    | 'attribution_unavailable'
    | 'channel_unavailable'
    | 'commission_rule_unavailable';
  sourcePaymentEventId: string;
  rechargeOrderId: string;
  frozenAttributionId: string | null;
  referralAttributionId: string | null;
  beneficiaryChannelId: string | null;
  commissionRuleVersionId: string | null;
  basisAmountMinor: number;
  currency: string;
  rateNumerator: string | null;
  rateDenominator: string | null;
  roundingMode: CommissionRoundingMode | null;
  refundObservationDays: number | null;
  commissionAmountMinor: number | null;
  eligibleAt: string | null;
};

export type CommissionCalculation = {
  outcome: CommissionCalculationSnapshot['outcome'];
  reasonCode: CommissionCalculationSnapshot['reasonCode'];
  referralAttributionId: string | null;
  beneficiaryChannelId: string | null;
  commissionRuleVersionId: string | null;
  snapshot: CommissionCalculationSnapshot;
  digest: string;
  accrual: { commissionAmountMinor: number; eligibleAt: Date } | null;
};

export type CommissionCalculationInput = {
  sourcePaymentEventId: string;
  rechargeOrderId: string;
  frozenAttributionId: string | null;
  basisAmountMinor: number;
  currency: string;
  occurredAt: Date;
  attribution: CommissionAttributionFacts | null;
  matchingRules: readonly CommissionRuleFacts[];
};

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

function calculationDigest(snapshot: CommissionCalculationSnapshot): string {
  return createHash('sha256').update(canonicalJson(snapshot), 'utf8').digest('hex');
}

function checkedBigInt(value: string | number, field: string): bigint {
  const normalized = BigInt(value);
  if (normalized <= 0n) throw new Error(`${field} must be positive.`);
  return normalized;
}

function commissionAmount(
  basisAmountMinor: number,
  numeratorValue: string | number,
  denominatorValue: string | number,
  roundingMode: CommissionRoundingMode,
): number {
  const basis = checkedBigInt(basisAmountMinor, 'Commission basis');
  const numerator = checkedBigInt(numeratorValue, 'Commission rate numerator');
  const denominator = checkedBigInt(denominatorValue, 'Commission rate denominator');
  const product = basis * numerator;
  let rounded: bigint;
  if (roundingMode === 'FLOOR') rounded = product / denominator;
  else if (roundingMode === 'CEILING') rounded = (product + denominator - 1n) / denominator;
  else rounded = (product * 2n + denominator) / (denominator * 2n);

  const amount = Number(rounded);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('Commission amount exceeds the supported positive safe integer range.');
  }
  return amount;
}

function result(
  input: CommissionCalculationInput,
  facts: Omit<
    CommissionCalculationSnapshot,
    | 'schemaVersion'
    | 'sourcePaymentEventId'
    | 'rechargeOrderId'
    | 'frozenAttributionId'
    | 'basisAmountMinor'
    | 'currency'
  >,
  accrual: CommissionCalculation['accrual'] = null,
): CommissionCalculation {
  const snapshot: CommissionCalculationSnapshot = {
    schemaVersion: 'commission-calculation-v1',
    sourcePaymentEventId: input.sourcePaymentEventId,
    rechargeOrderId: input.rechargeOrderId,
    frozenAttributionId: input.frozenAttributionId,
    basisAmountMinor: input.basisAmountMinor,
    currency: input.currency,
    ...facts,
  };
  return {
    outcome: snapshot.outcome,
    reasonCode: snapshot.reasonCode,
    referralAttributionId: snapshot.referralAttributionId,
    beneficiaryChannelId: snapshot.beneficiaryChannelId,
    commissionRuleVersionId: snapshot.commissionRuleVersionId,
    snapshot,
    digest: calculationDigest(snapshot),
    accrual,
  };
}

export function calculateCommission(input: CommissionCalculationInput): CommissionCalculation {
  if (input.frozenAttributionId === null) {
    return result(input, {
      outcome: 'not_attributed',
      reasonCode: 'no_frozen_attribution',
      referralAttributionId: null,
      beneficiaryChannelId: null,
      commissionRuleVersionId: null,
      rateNumerator: null,
      rateDenominator: null,
      roundingMode: null,
      refundObservationDays: null,
      commissionAmountMinor: null,
      eligibleAt: null,
    });
  }

  const attribution = input.attribution;
  if (
    attribution === null ||
    attribution.referralAttributionId !== input.frozenAttributionId ||
    attribution.status !== 'active' ||
    attribution.beneficiaryChannelId === null ||
    input.occurredAt < attribution.effectiveFrom ||
    attribution.protectedUntil === null
  ) {
    return result(input, {
      outcome: 'manual_review',
      reasonCode: 'attribution_unavailable',
      referralAttributionId: attribution?.referralAttributionId ?? null,
      beneficiaryChannelId: attribution?.beneficiaryChannelId ?? null,
      commissionRuleVersionId: null,
      rateNumerator: null,
      rateDenominator: null,
      roundingMode: null,
      refundObservationDays: null,
      commissionAmountMinor: null,
      eligibleAt: null,
    });
  }

  if (input.occurredAt >= attribution.protectedUntil) {
    return result(input, {
      outcome: 'attribution_expired',
      reasonCode: 'attribution_expired',
      referralAttributionId: attribution.referralAttributionId,
      beneficiaryChannelId: attribution.beneficiaryChannelId,
      commissionRuleVersionId: null,
      rateNumerator: null,
      rateDenominator: null,
      roundingMode: null,
      refundObservationDays: null,
      commissionAmountMinor: null,
      eligibleAt: null,
    });
  }

  if (attribution.channelOrganizationStatus !== 'active') {
    return result(input, {
      outcome: 'manual_review',
      reasonCode: 'channel_unavailable',
      referralAttributionId: attribution.referralAttributionId,
      beneficiaryChannelId: attribution.beneficiaryChannelId,
      commissionRuleVersionId: null,
      rateNumerator: null,
      rateDenominator: null,
      roundingMode: null,
      refundObservationDays: null,
      commissionAmountMinor: null,
      eligibleAt: null,
    });
  }

  if (input.matchingRules.length > 1) {
    throw new Error('Multiple matching Commission Rules found; refusing ambiguous accrual.');
  }
  const rule = input.matchingRules[0];
  if (!rule) {
    return result(input, {
      outcome: 'manual_review',
      reasonCode: 'commission_rule_unavailable',
      referralAttributionId: attribution.referralAttributionId,
      beneficiaryChannelId: attribution.beneficiaryChannelId,
      commissionRuleVersionId: null,
      rateNumerator: null,
      rateDenominator: null,
      roundingMode: null,
      refundObservationDays: null,
      commissionAmountMinor: null,
      eligibleAt: null,
    });
  }

  const amount = commissionAmount(
    input.basisAmountMinor,
    rule.rateNumerator,
    rule.rateDenominator,
    rule.roundingMode,
  );
  if (!Number.isInteger(rule.refundObservationDays) || rule.refundObservationDays < 0) {
    throw new Error('Commission refund observation days are invalid.');
  }
  const eligibleAt = new Date(
    input.occurredAt.getTime() + rule.refundObservationDays * 24 * 60 * 60 * 1000,
  );
  if (Number.isNaN(eligibleAt.getTime())) throw new Error('Commission eligibleAt is invalid.');

  return result(
    input,
    {
      outcome: 'accrued',
      reasonCode: 'commission_accrued',
      referralAttributionId: attribution.referralAttributionId,
      beneficiaryChannelId: attribution.beneficiaryChannelId,
      commissionRuleVersionId: rule.commissionRuleVersionId,
      rateNumerator: String(rule.rateNumerator),
      rateDenominator: String(rule.rateDenominator),
      roundingMode: rule.roundingMode,
      refundObservationDays: rule.refundObservationDays,
      commissionAmountMinor: amount,
      eligibleAt: eligibleAt.toISOString(),
    },
    { commissionAmountMinor: amount, eligibleAt },
  );
}
