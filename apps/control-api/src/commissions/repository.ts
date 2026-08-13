import type { Knex } from 'knex';
import type {
  CommissionAccrualAudit,
  CommissionAuditStore,
  CommissionCalculationAudit,
  CommissionCalculationFilter,
  CommissionCalculationOutcome,
  CommissionReversalAudit,
} from './types.js';

type CalculationRow = {
  commission_calculation_outcome_id: string;
  source_payment_event_id: string;
  recharge_order_id: string;
  beneficiary_channel_id: string | null;
  commission_rule_version_id: string | null;
  basis_amount_minor: string | number;
  currency: string;
  outcome: CommissionCalculationOutcome;
  reason_code: string;
  occurred_at: Date | string;
  created_at: Date | string;
};

type AccrualRow = {
  commission_accrual_id: string;
  calculation_outcome_id: string;
  source_payment_event_id: string;
  recharge_order_id: string;
  beneficiary_channel_id: string;
  commission_rule_version_id: string;
  basis_amount_minor: string | number;
  commission_amount_minor: string | number;
  currency: string;
  eligible_at: Date | string;
  occurred_at: Date | string;
  created_at: Date | string;
};

type ReversalRow = {
  commission_reversal_id: string;
  commission_accrual_id: string;
  source_payment_event_id: string;
  recharge_order_id: string;
  beneficiary_channel_id: string;
  reversal_type: 'refund' | 'chargeback';
  amount_minor: string | number;
  currency: string;
  occurred_at: Date | string;
  created_at: Date | string;
};

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function safeInteger(value: string | number, field: string): number {
  const normalized = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(normalized)) {
    throw new Error(`${field} exceeds the supported safe integer range.`);
  }
  return normalized;
}

function boundedLimit(limit: number): number {
  return Math.max(1, Math.min(100, Math.trunc(limit)));
}

function calculationFromRow(row: CalculationRow): CommissionCalculationAudit {
  return {
    commissionCalculationOutcomeId: row.commission_calculation_outcome_id,
    sourcePaymentEventId: row.source_payment_event_id,
    rechargeOrderId: row.recharge_order_id,
    beneficiaryChannelId: row.beneficiary_channel_id,
    commissionRuleVersionId: row.commission_rule_version_id,
    basisAmountMinor: safeInteger(row.basis_amount_minor, 'Commission calculation basis amount'),
    currency: row.currency,
    outcome: row.outcome,
    reasonCode: row.reason_code,
    occurredAt: iso(row.occurred_at),
    createdAt: iso(row.created_at),
  };
}

function accrualFromRow(row: AccrualRow): CommissionAccrualAudit {
  return {
    commissionAccrualId: row.commission_accrual_id,
    calculationOutcomeId: row.calculation_outcome_id,
    sourcePaymentEventId: row.source_payment_event_id,
    rechargeOrderId: row.recharge_order_id,
    beneficiaryChannelId: row.beneficiary_channel_id,
    commissionRuleVersionId: row.commission_rule_version_id,
    basisAmountMinor: safeInteger(row.basis_amount_minor, 'Commission accrual basis amount'),
    commissionAmountMinor: safeInteger(row.commission_amount_minor, 'Commission accrual amount'),
    currency: row.currency,
    eligibleAt: iso(row.eligible_at),
    occurredAt: iso(row.occurred_at),
    createdAt: iso(row.created_at),
  };
}

function reversalFromRow(row: ReversalRow): CommissionReversalAudit {
  return {
    commissionReversalId: row.commission_reversal_id,
    commissionAccrualId: row.commission_accrual_id,
    sourcePaymentEventId: row.source_payment_event_id,
    rechargeOrderId: row.recharge_order_id,
    beneficiaryChannelId: row.beneficiary_channel_id,
    reversalType: row.reversal_type,
    reversalAmountMinor: safeInteger(row.amount_minor, 'Commission reversal amount'),
    currency: row.currency,
    occurredAt: iso(row.occurred_at),
    createdAt: iso(row.created_at),
  };
}

export class PostgresCommissionAuditRepository implements CommissionAuditStore {
  constructor(private readonly database: Knex) {}

  async findChannelIdByOrganizationId(organizationId: string): Promise<string | null> {
    const row = (await this.database('control_plane.channels')
      .select('channel_id')
      .where({ organization_id: organizationId })
      .first()) as { channel_id: string } | undefined;
    return row?.channel_id ?? null;
  }

  async listCalculations(
    filter: CommissionCalculationFilter,
    limit: number,
  ): Promise<CommissionCalculationAudit[]> {
    const query = this.database('control_plane.commission_calculation_outcomes')
      .select(
        'commission_calculation_outcome_id',
        'source_payment_event_id',
        'recharge_order_id',
        'beneficiary_channel_id',
        'commission_rule_version_id',
        'basis_amount_minor',
        'currency',
        'outcome',
        'reason_code',
        'occurred_at',
        'created_at',
      )
      .orderBy('occurred_at', 'desc')
      .orderBy('commission_calculation_outcome_id', 'desc')
      .limit(boundedLimit(limit));
    if (filter.beneficiaryChannelId) {
      query.where('beneficiary_channel_id', filter.beneficiaryChannelId);
    }
    if (filter.outcome) query.where('outcome', filter.outcome);
    const rows = (await query) as CalculationRow[];
    return rows.map(calculationFromRow);
  }

  async listAccruals(
    beneficiaryChannelId: string | null,
    limit: number,
  ): Promise<CommissionAccrualAudit[]> {
    const query = this.database('control_plane.commission_accruals')
      .select(
        'commission_accrual_id',
        'calculation_outcome_id',
        'source_payment_event_id',
        'recharge_order_id',
        'beneficiary_channel_id',
        'commission_rule_version_id',
        'basis_amount_minor',
        'commission_amount_minor',
        'currency',
        'eligible_at',
        'occurred_at',
        'created_at',
      )
      .orderBy('occurred_at', 'desc')
      .orderBy('commission_accrual_id', 'desc')
      .limit(boundedLimit(limit));
    if (beneficiaryChannelId) query.where('beneficiary_channel_id', beneficiaryChannelId);
    const rows = (await query) as AccrualRow[];
    return rows.map(accrualFromRow);
  }

  async listReversals(
    beneficiaryChannelId: string | null,
    limit: number,
  ): Promise<CommissionReversalAudit[]> {
    const query = this.database({ reversal: 'control_plane.commission_reversals' })
      .join(
        { accrual: 'control_plane.commission_accruals' },
        'accrual.commission_accrual_id',
        'reversal.commission_accrual_id',
      )
      .select(
        'reversal.commission_reversal_id',
        'reversal.commission_accrual_id',
        'reversal.source_payment_event_id',
        'accrual.recharge_order_id',
        'accrual.beneficiary_channel_id',
        'reversal.reversal_type',
        'reversal.amount_minor',
        'reversal.currency',
        'reversal.occurred_at',
        'reversal.created_at',
      )
      .orderBy('reversal.occurred_at', 'desc')
      .orderBy('reversal.commission_reversal_id', 'desc')
      .limit(boundedLimit(limit));
    if (beneficiaryChannelId) {
      query.where('accrual.beneficiary_channel_id', beneficiaryChannelId);
    }
    const rows = (await query) as ReversalRow[];
    return rows.map(reversalFromRow);
  }
}
