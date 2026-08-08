import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { calculateCommission, type CommissionRuleFacts } from './commissionCalculation.js';
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

type RepositoryEntity =
  | 'wallet'
  | 'order'
  | 'orderEvent'
  | 'paymentEvent'
  | 'creditLot'
  | 'ledgerEntry'
  | 'commissionOutcome'
  | 'commissionAccrual';

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
  processed_at: Date | string | null;
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

type ReferralAttributionRow = {
  referral_attribution_id: string;
  referrer_channel_id: string | null;
  status: string;
  effective_from: Date | string;
  protected_until: Date | string | null;
  channel_organization_status: string | null;
};

type CommissionRuleRow = {
  commission_rule_version_id: string;
  rate_numerator: string | number;
  rate_denominator: string | number;
  rounding_mode: CommissionRuleFacts['roundingMode'];
  refund_observation_days: number;
};
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
    processedAt: row.processed_at === null ? null : iso(row.processed_at),
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

  async listRechargeOrders(tenantId: string, limit: number): Promise<RechargeOrder[]> {
    const rows = (await this.database('control_plane.recharge_orders')
      .where({ tenant_id: tenantId })
      .orderBy('created_at', 'desc')
      .orderBy('recharge_order_id', 'desc')
      .limit(limit)) as RechargeOrderRow[];
    return rows.map(orderFromRow);
  }

  async listPaymentEvents(limit: number): Promise<PaymentEvent[]> {
    const rows = (await this.database('control_plane.payment_events')
      .orderBy('received_at', 'desc')
      .orderBy('payment_event_id', 'desc')
      .limit(limit)) as PaymentEventRow[];
    return rows.map(paymentEventFromRow);
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

        const wallet = (await transaction('control_plane.wallets')
          .where({ wallet_id: order.wallet_id, tenant_id: order.tenant_id })
          .forUpdate()
          .first()) as WalletRow | undefined;
        const paymentEventId = this.newId('paymentEvent');
        const [received] = (await transaction('control_plane.payment_events')
          .insert({
            payment_event_id: paymentEventId,
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
            processed_at: null,
          })
          .returning('*')) as PaymentEventRow[];
        if (!received) throw new Error('Payment Event insert returned no row.');

        const finish = async (
          processingStatus: 'applied' | 'rejected',
          errorCode: PaymentEventErrorCode | null,
        ): Promise<ReplayableResult<PaymentEvent>> => {
          const [terminal] = (await transaction('control_plane.payment_events')
            .where({ payment_event_id: paymentEventId })
            .update({
              processing_status: processingStatus,
              error_code: errorCode,
              processed_at: input.receivedAt,
            })
            .returning('*')) as PaymentEventRow[];
          if (!terminal) throw new Error('Payment Event terminal update returned no row.');
          return { value: paymentEventFromRow(terminal), replayed: false };
        };

        if (input.paymentMode !== 'TEST' || input.eventType !== 'payment_succeeded') {
          return finish('rejected', 'unsupported_event_type');
        }
        if (!wallet || wallet.status !== 'active') {
          return finish('rejected', 'wallet_unavailable');
        }
        if (order.status !== 'created' && order.status !== 'pending') {
          return finish('rejected', 'invalid_order_state');
        }

        const existingLot = await transaction('control_plane.credit_lots')
          .select('credit_lot_id')
          .where({ recharge_order_id: order.recharge_order_id })
          .first();
        if (existingLot) return finish('rejected', 'credit_issuance_conflict');

        if (order.status === 'created') {
          await transaction('control_plane.recharge_orders')
            .where({ recharge_order_id: order.recharge_order_id })
            .update({ status: 'pending' });
          await transaction('control_plane.recharge_order_events').insert({
            recharge_order_event_id: this.newId('orderEvent'),
            recharge_order_id: order.recharge_order_id,
            event_type: 'pending',
            source_payment_event_id: null,
            actor_type: 'system',
            actor_id: input.providerCode,
            reason_code: 'payment_processing_started',
            occurred_at: input.receivedAt,
            created_at: input.receivedAt,
          });
        }

        const issueLot = async (
          lotType: 'PURCHASED' | 'BONUS',
          credits: number,
          expiresAt: Date | null,
        ): Promise<void> => {
          const creditLotId = this.newId('creditLot');
          await transaction('control_plane.credit_lots').insert({
            credit_lot_id: creditLotId,
            tenant_id: order.tenant_id,
            wallet_id: order.wallet_id,
            recharge_order_id: order.recharge_order_id,
            source_payment_event_id: paymentEventId,
            conversion_rule_version_id: order.conversion_rule_version_id,
            lot_type: lotType,
            original_credits: credits,
            issued_at: input.occurredAt,
            expires_at: expiresAt,
            created_at: input.receivedAt,
          });
          await transaction('control_plane.credit_ledger_entries').insert({
            ledger_entry_id: this.newId('ledgerEntry'),
            tenant_id: order.tenant_id,
            wallet_id: order.wallet_id,
            reservation_id: null,
            posting_group_id: paymentEventId,
            operation: 'issue',
            bucket: 'available',
            delta: credits,
            reference_type: 'recharge_order',
            reference_id: order.recharge_order_id,
            idempotency_key: `payment-event:${paymentEventId}:${lotType.toLowerCase()}`,
            actor_type: 'system',
            actor_id: input.providerCode,
            reason_code:
              lotType === 'PURCHASED' ? 'recharge_purchase_issued' : 'recharge_bonus_issued',
            occurred_at: input.occurredAt,
            created_at: input.receivedAt,
            credit_lot_id: creditLotId,
          });
        };

        await issueLot(
          'PURCHASED',
          safeInteger(order.purchased_credits, 'Recharge Order purchased credits'),
          null,
        );
        const bonusCredits = safeInteger(order.bonus_credits, 'Recharge Order bonus credits');
        if (bonusCredits > 0) {
          if (order.bonus_expires_in_days === null) {
            throw new Error('Recharge Order bonus expiry is unavailable.');
          }
          const bonusExpiresAt = new Date(
            input.occurredAt.getTime() + order.bonus_expires_in_days * 24 * 60 * 60 * 1000,
          );
          await issueLot('BONUS', bonusCredits, bonusExpiresAt);
        }

        await transaction('control_plane.recharge_orders')
          .where({ recharge_order_id: order.recharge_order_id })
          .update({ status: 'paid' });
        await transaction('control_plane.recharge_order_events').insert({
          recharge_order_event_id: this.newId('orderEvent'),
          recharge_order_id: order.recharge_order_id,
          event_type: 'paid',
          source_payment_event_id: paymentEventId,
          actor_type: 'system',
          actor_id: input.providerCode,
          reason_code: 'payment_succeeded',
          occurred_at: input.occurredAt,
          created_at: input.receivedAt,
        });

        const applied = await finish('applied', null);
        await this.appendCommissionCalculation(transaction, order, paymentEventId, input);
        return applied;
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

  private async appendCommissionCalculation(
    transaction: Knex.Transaction,
    order: RechargeOrderRow,
    paymentEventId: string,
    input: ReceivePaymentEventRecord,
  ): Promise<void> {
    let attribution: ReferralAttributionRow | null = null;
    if (order.attribution_snapshot_id !== null) {
      attribution =
        ((await transaction('control_plane.referral_attributions as attribution')
          .leftJoin(
            'control_plane.channels as channel',
            'channel.channel_id',
            'attribution.referrer_channel_id',
          )
          .leftJoin(
            'control_plane.organizations as organization',
            'organization.organization_id',
            'channel.organization_id',
          )
          .select(
            'attribution.referral_attribution_id',
            'attribution.referrer_channel_id',
            'attribution.status',
            'attribution.effective_from',
            'attribution.protected_until',
            'organization.status as channel_organization_status',
          )
          .where({ 'attribution.referral_attribution_id': order.attribution_snapshot_id })
          .forUpdate('attribution')
          .first()) as ReferralAttributionRow | undefined) ?? null;
    }

    let matchingRules: CommissionRuleRow[] = [];
    const attributionEligibleForRule =
      attribution !== null &&
      attribution.status === 'active' &&
      attribution.referrer_channel_id !== null &&
      input.occurredAt >= new Date(attribution.effective_from) &&
      attribution.protected_until !== null &&
      input.occurredAt < new Date(attribution.protected_until) &&
      attribution.channel_organization_status === 'active';
    if (attributionEligibleForRule) {
      await transaction.raw('select pg_advisory_xact_lock(hashtextextended(?, 0))', [
        `${input.paymentMode}:${input.currency}:DIRECT_ATTRIBUTION`,
      ]);
      matchingRules = (await transaction('control_plane.commission_rule_versions')
        .select(
          'commission_rule_version_id',
          'rate_numerator',
          'rate_denominator',
          'rounding_mode',
          'refund_observation_days',
        )
        .where({
          payment_mode: input.paymentMode,
          currency: input.currency,
          status: 'ACTIVE',
          scope_type: 'DIRECT_ATTRIBUTION',
          basis_type: 'NET_PAID_AMOUNT',
        })
        .where('effective_at', '<=', input.occurredAt)
        .where((builder) =>
          builder.whereNull('retired_at').orWhere('retired_at', '>', input.occurredAt),
        )
        .orderBy('effective_at', 'desc')
        .orderBy('commission_rule_version_id', 'desc')
        .forUpdate()
        .limit(2)) as CommissionRuleRow[];
    }

    const calculation = calculateCommission({
      sourcePaymentEventId: paymentEventId,
      rechargeOrderId: order.recharge_order_id,
      frozenAttributionId: order.attribution_snapshot_id,
      basisAmountMinor: input.amountMinor,
      currency: input.currency,
      occurredAt: input.occurredAt,
      attribution:
        attribution === null
          ? null
          : {
              referralAttributionId: attribution.referral_attribution_id,
              beneficiaryChannelId: attribution.referrer_channel_id,
              status: attribution.status,
              effectiveFrom: new Date(attribution.effective_from),
              protectedUntil:
                attribution.protected_until === null ? null : new Date(attribution.protected_until),
              channelOrganizationStatus: attribution.channel_organization_status,
            },
      matchingRules: matchingRules.map((rule) => ({
        commissionRuleVersionId: rule.commission_rule_version_id,
        rateNumerator: rule.rate_numerator,
        rateDenominator: rule.rate_denominator,
        roundingMode: rule.rounding_mode,
        refundObservationDays: rule.refund_observation_days,
      })),
    });

    const calculationOutcomeId = this.newId('commissionOutcome');
    await transaction('control_plane.commission_calculation_outcomes').insert({
      commission_calculation_outcome_id: calculationOutcomeId,
      source_payment_event_id: paymentEventId,
      recharge_order_id: order.recharge_order_id,
      referral_attribution_id: calculation.referralAttributionId,
      beneficiary_channel_id: calculation.beneficiaryChannelId,
      commission_rule_version_id: calculation.commissionRuleVersionId,
      basis_amount_minor: input.amountMinor,
      currency: input.currency,
      outcome: calculation.outcome,
      reason_code: calculation.reasonCode,
      calculation_snapshot: calculation.snapshot,
      calculation_digest: calculation.digest,
      occurred_at: input.occurredAt,
      created_at: input.receivedAt,
    });

    if (calculation.accrual === null) return;
    await transaction('control_plane.commission_accruals').insert({
      commission_accrual_id: this.newId('commissionAccrual'),
      calculation_outcome_id: calculationOutcomeId,
      source_payment_event_id: paymentEventId,
      recharge_order_id: order.recharge_order_id,
      referral_attribution_id: calculation.referralAttributionId,
      beneficiary_channel_id: calculation.beneficiaryChannelId,
      commission_rule_version_id: calculation.commissionRuleVersionId,
      basis_amount_minor: input.amountMinor,
      commission_amount_minor: calculation.accrual.commissionAmountMinor,
      currency: input.currency,
      eligible_at: calculation.accrual.eligibleAt,
      calculation_snapshot: calculation.snapshot,
      calculation_digest: calculation.digest,
      occurred_at: input.occurredAt,
      created_at: input.receivedAt,
    });
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
