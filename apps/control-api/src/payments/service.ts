import { paymentEventDigest, rechargeOrderRequestDigest } from './digest.js';
import {
  PaymentModeMismatchError,
  PaymentProviderUnavailableError,
  RechargePermissionDeniedError,
  RechargeValidationError,
} from './errors.js';
import { TestPaymentAdapter, UnavailableLivePaymentAdapter } from './paymentProvider.js';
import type {
  CreateRechargeOrderInput,
  PaymentEvent,
  PaymentFoundationStore,
  PaymentMode,
  PaymentProvider,
  RechargeActor,
  RechargeOrder,
  ReceivePaymentEventInput,
  ReplayableResult,
} from './types.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ServiceOptions = {
  now?: () => Date;
  providers?: Partial<Record<PaymentMode, PaymentProvider>>;
};

function uuid(value: string, field: string): string {
  const normalized = value.trim().toLowerCase();
  if (!uuidPattern.test(normalized)) {
    throw new RechargeValidationError(`${field} must be a UUID.`);
  }
  return normalized;
}

function idempotencyKey(value: string): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 200) {
    throw new RechargeValidationError('idempotencyKey is invalid.');
  }
  return normalized;
}

export class PaymentFoundationService {
  private readonly now: () => Date;
  private readonly providers: Record<PaymentMode, PaymentProvider>;

  constructor(
    private readonly store: PaymentFoundationStore,
    private readonly digestSecret: string,
    options: ServiceOptions = {},
  ) {
    if (Buffer.byteLength(digestSecret, 'utf8') < 32) {
      throw new Error('Recharge payment digest secret must contain at least 32 bytes.');
    }
    this.now = options.now ?? (() => new Date());
    this.providers = {
      TEST: options.providers?.TEST ?? new TestPaymentAdapter(),
      LIVE: options.providers?.LIVE ?? new UnavailableLivePaymentAdapter(),
    };
  }

  async createRechargeOrder(
    actor: RechargeActor,
    input: CreateRechargeOrderInput,
  ): Promise<ReplayableResult<RechargeOrder>> {
    if (
      actor.organizationType !== 'TENANT' ||
      actor.tenantId === null ||
      !actor.roles.includes('tenant_admin')
    ) {
      throw new RechargePermissionDeniedError();
    }
    if (input.paymentMode !== 'TEST') throw new PaymentProviderUnavailableError();

    const facts = {
      tenantId: uuid(actor.tenantId, 'actor.tenantId'),
      tenantOrganizationId: uuid(actor.organizationId, 'actor.organizationId'),
      buyerUserId: uuid(actor.userId, 'actor.userId'),
      buyerMembershipId: uuid(actor.membershipId, 'actor.membershipId'),
      paymentMode: input.paymentMode,
      conversionRuleVersionId: uuid(input.conversionRuleVersionId, 'conversionRuleVersionId'),
      idempotencyKey: idempotencyKey(input.idempotencyKey),
    };

    return this.store.createRechargeOrder({
      ...facts,
      requestDigest: rechargeOrderRequestDigest(this.digestSecret, facts),
      createdAt: this.now(),
    });
  }

  async receivePaymentEvent(
    input: ReceivePaymentEventInput,
  ): Promise<ReplayableResult<PaymentEvent>> {
    const provider = this.providers[input.paymentMode];
    if (provider.mode !== input.paymentMode) throw new PaymentModeMismatchError();
    const normalized = await provider.verify(input);
    if (normalized.paymentMode !== input.paymentMode) throw new PaymentModeMismatchError();

    return this.store.receivePaymentEvent({
      ...normalized,
      eventDigest: paymentEventDigest(normalized),
      receivedAt: this.now(),
    });
  }
}
