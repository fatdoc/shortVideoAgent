import type { OrganizationType, RoleCode } from '../auth/types.js';

export type PaymentMode = 'TEST' | 'LIVE';
export type RechargeOrderStatus =
  'created' | 'pending' | 'paid' | 'partially_refunded' | 'refunded' | 'cancelled' | 'disputed';
export type PaymentEventType =
  'payment_succeeded' | 'payment_failed' | 'refund_succeeded' | 'chargeback_succeeded';
export type PaymentEventProcessingStatus = 'received' | 'applied' | 'rejected';
export type PaymentEventErrorCode =
  | 'invalid_signature'
  | 'unknown_order'
  | 'amount_mismatch'
  | 'currency_mismatch'
  | 'mode_mismatch'
  | 'duplicate_conflict'
  | 'unsupported_event_type'
  | 'provider_unavailable'
  | 'internal_processing_error';

export type RechargeActor = {
  userId: string;
  membershipId: string;
  organizationId: string;
  organizationType: OrganizationType;
  roles: readonly RoleCode[];
  tenantId: string | null;
};

export type RechargeOrder = {
  rechargeOrderId: string;
  tenantId: string;
  walletId: string;
  buyerUserId: string;
  buyerMembershipId: string;
  paymentMode: PaymentMode;
  conversionRuleVersionId: string;
  amountMinor: number;
  currency: string;
  purchasedCredits: number;
  bonusCredits: number;
  bonusExpiresInDays: number | null;
  status: RechargeOrderStatus;
  attributionSnapshotId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentEvent = {
  paymentEventId: string;
  paymentMode: PaymentMode;
  providerCode: string;
  providerEventId: string;
  eventType: PaymentEventType;
  eventDigest: string;
  rechargeOrderId: string;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  receivedAt: string;
  processingStatus: PaymentEventProcessingStatus;
  errorCode: PaymentEventErrorCode | null;
};

export type ReplayableResult<T> = { value: T; replayed: boolean };

export type CreateRechargeOrderInput = {
  paymentMode: PaymentMode;
  conversionRuleVersionId: string;
  idempotencyKey: string;
};

export type CreateRechargeOrderRecord = {
  tenantId: string;
  tenantOrganizationId: string;
  buyerUserId: string;
  buyerMembershipId: string;
  paymentMode: 'TEST';
  conversionRuleVersionId: string;
  idempotencyKey: string;
  requestDigest: string;
  createdAt: Date;
};

export type ProviderVerificationInput = { paymentMode: PaymentMode; payload: unknown };

export type NormalizedPaymentEvent = {
  paymentMode: PaymentMode;
  providerCode: string;
  providerEventId: string;
  eventType: PaymentEventType;
  rechargeOrderId: string;
  amountMinor: number;
  currency: string;
  occurredAt: Date;
};

export interface PaymentProvider {
  readonly mode: PaymentMode;
  verify(input: ProviderVerificationInput): Promise<NormalizedPaymentEvent>;
}

export type ReceivePaymentEventInput = ProviderVerificationInput;
export type ReceivePaymentEventRecord = NormalizedPaymentEvent & {
  eventDigest: string;
  receivedAt: Date;
};

export interface PaymentFoundationStore {
  createRechargeOrder(input: CreateRechargeOrderRecord): Promise<ReplayableResult<RechargeOrder>>;
  receivePaymentEvent(input: ReceivePaymentEventRecord): Promise<ReplayableResult<PaymentEvent>>;
}
