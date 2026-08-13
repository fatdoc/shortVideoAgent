import type { OrganizationType, RoleCode } from '../auth/types.js';

export type CommissionSettlementActor = {
  userId: string;
  membershipId: string;
  organizationId: string;
  organizationType: OrganizationType;
  roles: readonly RoleCode[];
};

export type CreateCommissionSettlementInput = {
  paymentMode: 'TEST';
  beneficiaryChannelId: string;
  currency: string;
  periodStart: string;
  cutoffAt: string;
  idempotencyKey: string;
};

export type CreateCommissionSettlementRecord = {
  paymentMode: 'TEST';
  beneficiaryChannelId: string;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  cutoffAt: Date;
  idempotencyKey: string;
  requestDigest: string;
  createdByUserId: string;
  createdByMembershipId: string;
  createdAt: Date;
};

export type CommissionSettlementDraft = {
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
};

export type ReplayableCommissionSettlement = {
  value: CommissionSettlementDraft;
  replayed: boolean;
};

export interface CommissionSettlementStore {
  createDraft(input: CreateCommissionSettlementRecord): Promise<ReplayableCommissionSettlement>;
}
