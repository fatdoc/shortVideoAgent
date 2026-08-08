import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import {
  PaymentIdempotencyConflictError,
  PaymentOrderConflictError,
  RechargeIdempotencyConflictError,
  RechargeRuleUnavailableError,
  RechargeScopeConflictError,
} from './errors.js';
import type {
  CreateRechargeOrderRecord,
  PaymentEvent,
  PaymentEventErrorCode,
  PaymentEventProcessingStatus,
  PaymentEventType,
  PaymentFoundationStore,
  PaymentMode,
  RechargeOrder,
  RechargeOrderStatus,
  ReceivePaymentEventRecord,
  ReplayableResult,
} from './types.js';

type RepositoryEntity = 'wallet' | 'order' | 'orderEvent' | 'paymentEvent';

type RechargeOrderRow = {
  recharge_order_id: string;
  tenant_id: string;
  wallet_id: string;
  buyer_user_id: string;
  buyer_membership_id: string;
  payment_mode: PaymentMode;
  conversion_rule_version_id: string;
  amount_minor: string | number;
  currency: string;
  purchased_credits: string | number;
  bonus_credits: string | number;
  bonus_expires_in_days: number | null;
  status: RechargeOrderStatus;
  attribution_snapshot_id: string | null;
  request_digest: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type PaymentEventRow = {
  payment_event_id: string;
  payment_mode: PaymentMode;
  provider_code: string;
  provider_event_id: string;
  event_type: PaymentEventType;
  event_digest: string;
  recharge_order_id: string;
  amount_minor: string | number;
  currency: string;
  occurred_at: Date | string;
  received_at: Date | string;
  processing_status: PaymentEventProcessingStatus;
  error_code: PaymentEventErrorCode | null;
};

type CreditConversionRuleRow = {
  rule_version_id: string;
  payment_mode: PaymentMode;
  currency: string;
  amount_minor: string | number;
  purchased_credits: string | number;
  bonus_credits: string | number;
  bonus_expires_in_days: number | null;
};

type WalletRow = { wallet_id: string; tenant_id: string; status: string };
type PostgresError = { code?: string; constraint?: string; message?: string };

function postgresError(error: unknown): PostgresError {
  return (error as PostgresError | null) ?? {};
}

function isUniqueViolation(error: unknown): boolean {
  return postgresError(error).code === '23505';
}

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

function orderFromRow(row: RechargeOrderRow): RechargeOrder {
  return {
    rechargeOrderId: row.recharge_order_id,
    tenantId: row.tenant_id,
    walletId: row.wallet_id,
    buyerUserId: row.buyer_user_id,
    buyerMembershipId: row.buyer_membership_id,
    paymentMode: row.payment_mode,
    conversionRuleVersionId: row.conversion_rule_version_id,
    amountMinor: safeInteger(row.amount_minor, 'Recharge Order amount'),
    currency: row.currency,
    purchasedCredits: safeInteger(row.purchased_credits, 'Recharge Order purchased credits'),
    bonusCredits: safeInteger(row.bonus_credits, 'Recharge Order bonus credits'),
    bonusExpiresInDays: row.bonus_expires_in_days,
    status: row.status,
    attributionSnapshotId: row.attribution_snapshot_id,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function paymentEventFromRow(row: PaymentEventRow): PaymentEvent {
  return {
    paymentEventId: row.payment_event_id,
    paymentMode: row.payment_mode,
    providerCode: row.provider_code,
    providerEventId: row.provider_event_id,
    eventType: row.event_type,
    eventDigest: row.event_digest,
    rechargeOrderId: row.recharge_order_id,
    amountMinor: safeInteger(row.amount_minor, 'Payment Event amount'),
    currency: row.currency,
    occurredAt: iso(row.occurred_at),
    receivedAt: iso(row.received_at),
    processingStatus: row.processing_status,
    errorCode: row.error_code,
  };
}

export class PostgresPaymentFoundationRepository implements PaymentFoundationStore {
  constructor(
    private readonly database: Knex,
    private readonly newId: (entity: RepositoryEntity) => string = () => randomUUID(),
  ) {}

  async createRechargeOrder(
    input: CreateRechargeOrderRecord,
  ): Promise<ReplayableResult<RechargeOrder>> {
    try {
      return await this.database.transaction(async (transaction) => {
        await transaction.raw('select pg_advisory_xact_lock(hashtextextended(?, 0))', [
          `recharge:order:${input.tenantId}:${input.idempotencyKey}`,
        ]);
        const existing = await this.findOrderByIdempotencyKey(
          transaction,
          input.tenantId,
          input.idempotencyKey,
          true,
        );
        if (existing) return this.orderReplay(existing, input.requestDigest);

        const tenant = (await transaction('control_plane.tenants as tenant')
          .join(
            'control_plane.organizations as organization',
            'organization.organization_id',
            'tenant.organization_id',
          )
          .select('tenant.tenant_id', 'tenant.organization_id')
          .where({
            'tenant.tenant_id': input.tenantId,
            'tenant.organization_id': input.tenantOrganizationId,
            'tenant.status': 'active',
            'organization.organization_type': 'TENANT',
            'organization.status': 'active',
          })
          .forUpdate('tenant')
          .first()) as { tenant_id: string; organization_id: string } | undefined;
        if (!tenant) throw new RechargeScopeConflictError();

        const membership = (await transaction(
          'control_plane.organization_memberships as membership',
        )
          .join(
            'control_plane.organization_membership_roles as role',
            'role.membership_id',
            'membership.membership_id',
          )
          .select('membership.membership_id')
          .where({
            'membership.membership_id': input.buyerMembershipId,
            'membership.user_id': input.buyerUserId,
            'membership.organization_id': input.tenantOrganizationId,
            'membership.status': 'active',
            'role.role_code': 'tenant_admin',
          })
          .forUpdate('membership')
          .first()) as { membership_id: string } | undefined;
        if (!membership) throw new RechargeScopeConflictError();

        const rule = (await transaction('control_plane.credit_conversion_rule_versions')
          .where({
            rule_version_id: input.conversionRuleVersionId,
            payment_mode: 'TEST',
            status: 'ACTIVE',
          })
          .where('effective_at', '<=', input.createdAt)
          .forUpdate()
          .first()) as CreditConversionRuleRow | undefined;
        if (!rule) throw new RechargeRuleUnavailableError();

        await transaction.raw('select pg_advisory_xact_lock(hashtextextended(?, 0))', [
          `recharge:wallet:${input.tenantId}`,
        ]);
        let wallet = (await transaction('control_plane.wallets')
          .where({ tenant_id: input.tenantId })
          .forUpdate()
          .first()) as WalletRow | undefined;
        if (!wallet) {
          const [createdWallet] = (await transaction('control_plane.wallets')
            .insert({
              wallet_id: this.newId('wallet'),
              tenant_id: input.tenantId,
              credit_type: 'AI_VIDEO_CREDIT',
              status: 'active',
              created_at: input.createdAt,
            })
            .returning('*')) as WalletRow[];
          if (!createdWallet) throw new Error('Wallet insert returned no row.');
          wallet = createdWallet;
        }
        if (wallet.status !== 'active') throw new RechargeScopeConflictError();

        const attribution = (await transaction('control_plane.referral_attributions')
          .select('referral_attribution_id')
          .where({
            tenant_id: input.tenantId,
            user_id: input.buyerUserId,
            status: 'active',
          })
          .where('effective_from', '<=', input.createdAt)
          .orderBy('effective_from', 'desc')
          .orderBy('referral_attribution_id', 'desc')
          .first()) as { referral_attribution_id: string } | undefined;

        const orderId = this.newId('order');
        const [createdOrder] = (await transaction('control_plane.recharge_orders')
          .insert({
            recharge_order_id: orderId,
            tenant_id: input.tenantId,
            wallet_id: wallet.wallet_id,
            buyer_user_id: input.buyerUserId,
            buyer_membership_id: input.buyerMembershipId,
            payment_mode: input.paymentMode,
            conversion_rule_version_id: rule.rule_version_id,
            amount_minor: rule.amount_minor,
            currency: rule.currency,
            purchased_credits: rule.purchased_credits,
            bonus_credits: rule.bonus_credits,
            bonus_expires_in_days: rule.bonus_expires_in_days,
            status: 'created',
            attribution_snapshot_id: attribution?.referral_attribution_id ?? null,
            idempotency_key: input.idempotencyKey,
            request_digest: input.requestDigest,
            created_at: input.createdAt,
            updated_at: input.createdAt,
          })
          .returning('*')) as RechargeOrderRow[];
        if (!createdOrder) throw new Error('Recharge Order insert returned no row.');

        await transaction('control_plane.recharge_order_events').insert({
          recharge_order_event_id: this.newId('orderEvent'),
          recharge_order_id: orderId,
          event_type: 'created',
          source_payment_event_id: null,
          actor_type: 'user',
          actor_id: input.buyerUserId,
          reason_code: 'tenant_recharge_requested',
          occurred_at: input.createdAt,
          created_at: input.createdAt,
        });

        return { value: orderFromRow(createdOrder), replayed: false };
      });
    } catch (error) {
      if (
        error instanceof RechargeIdempotencyConflictError ||
        error instanceof RechargeRuleUnavailableError ||
        error instanceof RechargeScopeConflictError
      ) {
        throw error;
      }
      if (
        isUniqueViolation(error) &&
        postgresError(error).constraint === 'recharge_orders_idempotency_uq'
      ) {
        throw new RechargeIdempotencyConflictError();
      }
      throw error;
    }
  }

  async receivePaymentEvent(
    input: ReceivePaymentEventRecord,
  ): Promise<ReplayableResult<PaymentEvent>> {
    try {
      return await this.database.transaction(async (transaction) => {
        await transaction.raw('select pg_advisory_xact_lock(hashtextextended(?, 0))', [
          `payment:event:${input.providerCode}:${input.providerEventId}`,
        ]);
        const existing = (await transaction('control_plane.payment_events')
          .where({
            provider_code: input.providerCode,
            provider_event_id: input.providerEventId,
          })
          .forUpdate()
          .first()) as PaymentEventRow | undefined;
        if (existing) {
          if (existing.event_digest !== input.eventDigest) {
            throw new PaymentIdempotencyConflictError();
          }
          return { value: paymentEventFromRow(existing), replayed: true };
        }

        const order = (await transaction('control_plane.recharge_orders')
          .where({ recharge_order_id: input.rechargeOrderId })
          .forUpdate()
          .first()) as RechargeOrderRow | undefined;
        if (
          !order ||
          order.payment_mode !== input.paymentMode ||
          safeInteger(order.amount_minor, 'Recharge Order amount') !== input.amountMinor ||
          order.currency !== input.currency
        ) {
          throw new PaymentOrderConflictError();
        }

        const [created] = (await transaction('control_plane.payment_events')
          .insert({
            payment_event_id: this.newId('paymentEvent'),
            payment_mode: input.paymentMode,
            provider_code: input.providerCode,
            provider_event_id: input.providerEventId,
            event_type: input.eventType,
            event_digest: input.eventDigest,
            recharge_order_id: input.rechargeOrderId,
            amount_minor: input.amountMinor,
            currency: input.currency,
            occurred_at: input.occurredAt,
            received_at: input.receivedAt,
            processing_status: 'received',
            error_code: null,
          })
          .returning('*')) as PaymentEventRow[];
        if (!created) throw new Error('Payment Event insert returned no row.');
        return { value: paymentEventFromRow(created), replayed: false };
      });
    } catch (error) {
      if (
        error instanceof PaymentIdempotencyConflictError ||
        error instanceof PaymentOrderConflictError
      ) {
        throw error;
      }
      if (
        isUniqueViolation(error) &&
        postgresError(error).constraint === 'payment_events_provider_identity_uq'
      ) {
        throw new PaymentIdempotencyConflictError();
      }
      const message = postgresError(error).message ?? '';
      if (/payment event|recharge order|amount|currency|mode/i.test(message)) {
        throw new PaymentOrderConflictError();
      }
      throw error;
    }
  }

  private orderReplay(
    row: RechargeOrderRow,
    requestDigest: string,
  ): ReplayableResult<RechargeOrder> {
    if (row.request_digest !== requestDigest) throw new RechargeIdempotencyConflictError();
    return { value: orderFromRow(row), replayed: true };
  }

  private async findOrderByIdempotencyKey(
    database: Knex | Knex.Transaction,
    tenantId: string,
    idempotencyKey: string,
    lock: boolean,
  ): Promise<RechargeOrderRow | undefined> {
    let query = database('control_plane.recharge_orders').where({
      tenant_id: tenantId,
      idempotency_key: idempotencyKey,
    });
    if (lock) query = query.forUpdate();
    return (await query.first()) as RechargeOrderRow | undefined;
  }
}
