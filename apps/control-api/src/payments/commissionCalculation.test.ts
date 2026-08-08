import { describe, expect, it } from 'vitest';
import {
  calculateCommission,
  type CommissionCalculationInput,
  type CommissionRoundingMode,
} from './commissionCalculation.js';

function input(
  roundingMode: CommissionRoundingMode,
  basisAmountMinor = 101,
  rateNumerator = 15,
  rateDenominator = 100,
): CommissionCalculationInput {
  return {
    sourcePaymentEventId: '10000000-0000-4000-8000-000000000001',
    rechargeOrderId: '10000000-0000-4000-8000-000000000002',
    frozenAttributionId: '10000000-0000-4000-8000-000000000003',
    basisAmountMinor,
    currency: 'CNY',
    occurredAt: new Date('2026-08-08T05:59:00.000Z'),
    attribution: {
      referralAttributionId: '10000000-0000-4000-8000-000000000003',
      beneficiaryChannelId: '10000000-0000-4000-8000-000000000004',
      status: 'active',
      effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
      protectedUntil: new Date('2027-08-01T00:00:00.000Z'),
      channelOrganizationStatus: 'active',
    },
    matchingRules: [
      {
        commissionRuleVersionId: '10000000-0000-4000-8000-000000000005',
        rateNumerator,
        rateDenominator,
        roundingMode,
        refundObservationDays: 7,
      },
    ],
  };
}

describe('calculateCommission', () => {
  it.each([
    ['FLOOR', 15],
    ['CEILING', 16],
    ['HALF_UP', 15],
  ] as const)('uses explicit %s integer rounding', (roundingMode, expectedAmount) => {
    const calculation = calculateCommission(input(roundingMode));

    expect(calculation.outcome).toBe('accrued');
    expect(calculation.accrual?.commissionAmountMinor).toBe(expectedAmount);
    expect(calculation.snapshot.commissionAmountMinor).toBe(expectedAmount);
  });

  it('rounds an exact HALF_UP midpoint away from zero', () => {
    expect(calculateCommission(input('HALF_UP', 105, 1, 10)).accrual?.commissionAmountMinor).toBe(
      11,
    );
  });

  it('produces a deterministic canonical digest for the same frozen facts', () => {
    const first = calculateCommission(input('FLOOR'));
    const second = calculateCommission(input('FLOOR'));

    expect(first.digest).toBe(second.digest);
    expect(first.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fails closed for ambiguous matching Rules', () => {
    const facts = input('FLOOR');
    facts.matchingRules = [...facts.matchingRules, { ...facts.matchingRules[0]! }];

    expect(() => calculateCommission(facts)).toThrow('Multiple matching Commission Rules');
  });
});
