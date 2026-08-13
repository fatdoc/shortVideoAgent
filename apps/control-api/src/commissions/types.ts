import type { OrganizationType, RoleCode } from '../auth/types.js';

export type CommissionActor = {
  userId: string;
  membershipId: string;
  organizationId: string;
  organizationType: OrganizationType;
  roles: readonly RoleCode[];
};

export type CommissionCalculationOutcome =
  'accrued' | 'not_attributed' | 'attribution_expired' | 'manual_review';

export type CommissionCalculationAudit = {
  commissionCalculationOutcomeId: string;
  sourcePaymentEventId: string;
  rechargeOrderId: string;
  beneficiaryChannelId: string | null;
  commissionRuleVersionId: string | null;
  basisAmountMinor: number;
  currency: string;
  outcome: CommissionCalculationOutcome;
  reasonCode: string;
  occurredAt: string;
  createdAt: string;
};

export type CommissionAccrualAudit = {
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
};

export type CommissionReversalAudit = {
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
};

export type CommissionCalculationFilter = {
  beneficiaryChannelId?: string;
  outcome?: 'manual_review';
};

export interface CommissionAuditStore {
  findChannelIdByOrganizationId(organizationId: string): Promise<string | null>;
  listCalculations(
    filter: CommissionCalculationFilter,
    limit: number,
  ): Promise<CommissionCalculationAudit[]>;
  listAccruals(
    beneficiaryChannelId: string | null,
    limit: number,
  ): Promise<CommissionAccrualAudit[]>;
  listReversals(
    beneficiaryChannelId: string | null,
    limit: number,
  ): Promise<CommissionReversalAudit[]>;
}
