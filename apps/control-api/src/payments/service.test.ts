import { describe, expect, it, vi } from 'vitest';
import {
  PaymentIdempotencyConflictError,
  PaymentModeMismatchError,
  PaymentPermissionDeniedError,
  PaymentProviderUnavailableError,
  PaymentVerificationError,
  RechargeIdempotencyConflictError,
  RechargePermissionDeniedError,
  RechargeValidationError,
} from './errors.js';
import { TestPaymentAdapter, UnavailableLivePaymentAdapter } from './paymentProvider.js';
import { PaymentFoundationService } from './service.js';
import type {
  NormalizedPaymentEvent,
  PaymentFoundationStore,
  PaymentProvider,
  RechargeActor,
  RechargeOrder,
} from './types.js';

const now = new Date('2026-08-08T06:00:00.000Z');
const secret = 'recharge-payment-foundation-secret-32-bytes';
const tenantId = '10000000-0000-4000-8000-000000000001';
const organizationId = '20000000-0000-4000-8000-000000000001';
const userId = '30000000-0000-4000-8000-000000000001';
const membershipId = '40000000-0000-4000-8000-000000000001';
const ruleVersionId = '50000000-0000-4000-8000-000000000001';
const orderId = '60000000-0000-4000-8000-000000000001';

const tenantAdmin: RechargeActor = {
  userId,
  membershipId,
  organizationId,
  organizationType: 'TENANT',
  roles: ['tenant_admin'],
  tenantId,
};

const order: RechargeOrder = {
  rechargeOrderId: orderId,
  tenantId,
  walletId: '70000000-0000-4000-8000-000000000001',
  buyerUserId: userId,
  buyerMembershipId: membershipId,
  paymentMode: 'TEST',
  conversionRuleVersionId: ruleVersionId,
  amountMinor: 100,
  currency: 'CNY',
  purchasedCredits: 10,
  bonusCredits: 0,
  bonusExpiresInDays: null,
  status: 'created',
  attributionSnapshotId: null,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
};

function store(overrides: Partial<PaymentFoundationStore> = {}): PaymentFoundationStore {
  return {
    createRechargeOrder: vi.fn(async () => ({ value: order, replayed: false })),
    listRechargeOrders: vi.fn(async () => [order]),
    receivePaymentEvent: vi.fn(async (input) => ({
      value: {
        paymentEventId: '80000000-0000-4000-8000-000000000001',
        paymentMode: input.paymentMode,
        providerCode: input.providerCode,
        providerEventId: input.providerEventId,
        eventType: input.eventType,
        eventDigest: input.eventDigest,
        rechargeOrderId: input.rechargeOrderId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        occurredAt: input.occurredAt.toISOString(),
        receivedAt: input.receivedAt.toISOString(),
        processingStatus: 'received',
        errorCode: null,
      },
      replayed: false,
    })),
    listPaymentEvents: vi.fn(async () => []),
    ...overrides,
  };
}

function service(
  foundationStore: PaymentFoundationStore,
  providers: Partial<Record<'TEST' | 'LIVE', PaymentProvider>> = {},
): PaymentFoundationService {
  return new PaymentFoundationService(foundationStore, secret, {
    now: () => now,
    providers,
  });
}

const testPayload = {
  providerEventId: ' test-event-001 ',
  eventType: 'payment_succeeded',
  rechargeOrderId: orderId.toUpperCase(),
  amountMinor: 100,
  currency: ' cny ',
  occurredAt: '2026-08-08T05:59:00.000Z',
  signature: 'must-not-be-normalized-or-persisted',
  rawCardData: 'must-not-be-normalized-or-persisted',
};

describe('PaymentFoundationService', () => {
  it('creates an explicitly TEST order from the active Tenant administrator context', async () => {
    const createRechargeOrder = vi.fn<PaymentFoundationStore['createRechargeOrder']>(async () => ({
      value: order,
      replayed: false,
    }));
    const foundation = service(store({ createRechargeOrder }));

    await expect(
      foundation.createRechargeOrder(tenantAdmin, {
        paymentMode: 'TEST',
        conversionRuleVersionId: ruleVersionId.toUpperCase(),
        idempotencyKey: ' recharge-001 ',
      }),
    ).resolves.toEqual({ value: order, replayed: false });

    expect(createRechargeOrder).toHaveBeenCalledWith({
      tenantId,
      tenantOrganizationId: organizationId,
      buyerUserId: userId,
      buyerMembershipId: membershipId,
      paymentMode: 'TEST',
      conversionRuleVersionId: ruleVersionId,
      idempotencyKey: 'recharge-001',
      requestDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      createdAt: now,
    });
    expect(createRechargeOrder.mock.calls[0]?.[0]).not.toHaveProperty('amountMinor');
    expect(createRechargeOrder.mock.calls[0]?.[0]).not.toHaveProperty('currency');
    expect(createRechargeOrder.mock.calls[0]?.[0]).not.toHaveProperty('purchasedCredits');
    expect(createRechargeOrder.mock.calls[0]?.[0]).not.toHaveProperty('attributionSnapshotId');
  });

  it('denies non-Tenant administrators and mismatched or absent Tenant contexts', async () => {
    const createRechargeOrder = vi.fn<PaymentFoundationStore['createRechargeOrder']>();
    const foundation = service(store({ createRechargeOrder }));
    const input = {
      paymentMode: 'TEST' as const,
      conversionRuleVersionId: ruleVersionId,
      idempotencyKey: 'recharge-001',
    };

    await expect(
      foundation.createRechargeOrder({ ...tenantAdmin, roles: ['content_operator'] }, input),
    ).rejects.toBeInstanceOf(RechargePermissionDeniedError);
    await expect(
      foundation.createRechargeOrder({ ...tenantAdmin, organizationType: 'CHANNEL' }, input),
    ).rejects.toBeInstanceOf(RechargePermissionDeniedError);
    await expect(
      foundation.createRechargeOrder({ ...tenantAdmin, tenantId: null }, input),
    ).rejects.toBeInstanceOf(RechargePermissionDeniedError);
    expect(createRechargeOrder).not.toHaveBeenCalled();
  });

  it('fails closed for LIVE order creation and validates UUID/idempotency before Store access', async () => {
    const createRechargeOrder = vi.fn<PaymentFoundationStore['createRechargeOrder']>();
    const foundation = service(store({ createRechargeOrder }));

    await expect(
      foundation.createRechargeOrder(tenantAdmin, {
        paymentMode: 'LIVE',
        conversionRuleVersionId: ruleVersionId,
        idempotencyKey: 'recharge-live-001',
      }),
    ).rejects.toBeInstanceOf(PaymentProviderUnavailableError);
    await expect(
      foundation.createRechargeOrder(tenantAdmin, {
        paymentMode: 'TEST',
        conversionRuleVersionId: 'not-a-uuid',
        idempotencyKey: 'recharge-001',
      }),
    ).rejects.toBeInstanceOf(RechargeValidationError);
    await expect(
      foundation.createRechargeOrder(tenantAdmin, {
        paymentMode: 'TEST',
        conversionRuleVersionId: ruleVersionId,
        idempotencyKey: '   ',
      }),
    ).rejects.toBeInstanceOf(RechargeValidationError);
    expect(createRechargeOrder).not.toHaveBeenCalled();
  });

  it('requires a dedicated HMAC secret of at least 32 bytes and produces stable scoped digests', async () => {
    expect(() => new PaymentFoundationService(store(), 'too-short')).toThrow(/32 bytes/i);

    const createRechargeOrder = vi.fn<PaymentFoundationStore['createRechargeOrder']>(async () => ({
      value: order,
      replayed: false,
    }));
    const foundation = service(store({ createRechargeOrder }));
    const input = {
      paymentMode: 'TEST' as const,
      conversionRuleVersionId: ruleVersionId,
      idempotencyKey: 'recharge-001',
    };

    await foundation.createRechargeOrder(tenantAdmin, input);
    await foundation.createRechargeOrder(tenantAdmin, input);
    expect(createRechargeOrder.mock.calls[0]?.[0].requestDigest).toBe(
      createRechargeOrder.mock.calls[1]?.[0].requestDigest,
    );

    const otherActor = { ...tenantAdmin, userId: '30000000-0000-4000-8000-000000000002' };
    await foundation.createRechargeOrder(otherActor, input);
    expect(createRechargeOrder.mock.calls[2]?.[0].requestDigest).not.toBe(
      createRechargeOrder.mock.calls[0]?.[0].requestDigest,
    );
  });

  it('preserves stable order replay/conflict outcomes from the atomic Store', async () => {
    const conflict = new RechargeIdempotencyConflictError();
    const createRechargeOrder = vi
      .fn<PaymentFoundationStore['createRechargeOrder']>()
      .mockResolvedValueOnce({ value: order, replayed: true })
      .mockRejectedValueOnce(conflict);
    const foundation = service(store({ createRechargeOrder }));
    const input = {
      paymentMode: 'TEST' as const,
      conversionRuleVersionId: ruleVersionId,
      idempotencyKey: 'recharge-001',
    };

    await expect(foundation.createRechargeOrder(tenantAdmin, input)).resolves.toEqual({
      value: order,
      replayed: true,
    });
    await expect(foundation.createRechargeOrder(tenantAdmin, input)).rejects.toBe(conflict);
  });

  it('lists RechargeOrders only for an active Tenant administrator with a bounded limit', async () => {
    const listRechargeOrders = vi.fn<PaymentFoundationStore['listRechargeOrders']>(async () => [
      order,
    ]);
    const foundation = service(store({ listRechargeOrders }));

    await expect(foundation.listRechargeOrders(tenantAdmin, 25)).resolves.toEqual([order]);
    expect(listRechargeOrders).toHaveBeenCalledWith(tenantId, 25);
    await expect(
      foundation.listRechargeOrders({ ...tenantAdmin, roles: ['content_operator'] }, 25),
    ).rejects.toBeInstanceOf(RechargePermissionDeniedError);
    await expect(foundation.listRechargeOrders(tenantAdmin, 101)).rejects.toBeInstanceOf(
      RechargeValidationError,
    );
  });

  it('lists Payment Events only for a Platform administrator', async () => {
    const listPaymentEvents = vi.fn<PaymentFoundationStore['listPaymentEvents']>(async () => []);
    const foundation = service(store({ listPaymentEvents }));
    const platformAdmin: RechargeActor = {
      ...tenantAdmin,
      organizationType: 'PLATFORM',
      roles: ['platform_admin'],
      tenantId: null,
    };

    await expect(foundation.listPaymentEvents(platformAdmin, 10)).resolves.toEqual([]);
    expect(listPaymentEvents).toHaveBeenCalledWith(10);
    await expect(foundation.listPaymentEvents(tenantAdmin, 10)).rejects.toBeInstanceOf(
      PaymentPermissionDeniedError,
    );
  });

  it('verifies TEST payloads first and persists only normalized safe event facts', async () => {
    const receivePaymentEvent = vi.fn<PaymentFoundationStore['receivePaymentEvent']>(
      async (input) => store().receivePaymentEvent(input),
    );
    const foundation = service(store({ receivePaymentEvent }));

    const result = await foundation.receivePaymentEvent({
      paymentMode: 'TEST',
      payload: testPayload,
    });

    expect(result.value).toMatchObject({
      paymentMode: 'TEST',
      providerCode: 'test-payment',
      providerEventId: 'test-event-001',
      rechargeOrderId: orderId,
      amountMinor: 100,
      currency: 'CNY',
      processingStatus: 'received',
    });
    expect(receivePaymentEvent).toHaveBeenCalledWith({
      paymentMode: 'TEST',
      providerCode: 'test-payment',
      providerEventId: 'test-event-001',
      eventType: 'payment_succeeded',
      eventDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      rechargeOrderId: orderId,
      amountMinor: 100,
      currency: 'CNY',
      occurredAt: new Date('2026-08-08T05:59:00.000Z'),
      receivedAt: now,
    });
    expect(receivePaymentEvent.mock.calls[0]?.[0]).not.toHaveProperty('signature');
    expect(receivePaymentEvent.mock.calls[0]?.[0]).not.toHaveProperty('rawCardData');
    expect(result.value.processingStatus).toBe('received');
  });

  it('rejects malformed TEST payloads without creating Inbox facts', async () => {
    const receivePaymentEvent = vi.fn<PaymentFoundationStore['receivePaymentEvent']>();
    const foundation = service(store({ receivePaymentEvent }));

    await expect(
      foundation.receivePaymentEvent({
        paymentMode: 'TEST',
        payload: { ...testPayload, amountMinor: 0 },
      }),
    ).rejects.toBeInstanceOf(PaymentVerificationError);
    await expect(
      foundation.receivePaymentEvent({
        paymentMode: 'TEST',
        payload: { ...testPayload, eventType: 'paid' },
      }),
    ).rejects.toBeInstanceOf(PaymentVerificationError);
    expect(receivePaymentEvent).not.toHaveBeenCalled();
  });

  it('fails every LIVE verification closed and never falls back to the TEST Adapter', async () => {
    const verifyTest = vi.fn<PaymentProvider['verify']>();
    const receivePaymentEvent = vi.fn<PaymentFoundationStore['receivePaymentEvent']>();
    const foundation = service(store({ receivePaymentEvent }), {
      TEST: { mode: 'TEST', verify: verifyTest },
      LIVE: new UnavailableLivePaymentAdapter(),
    });

    await expect(
      foundation.receivePaymentEvent({ paymentMode: 'LIVE', payload: testPayload }),
    ).rejects.toBeInstanceOf(PaymentProviderUnavailableError);
    expect(verifyTest).not.toHaveBeenCalled();
    expect(receivePaymentEvent).not.toHaveBeenCalled();
  });

  it('rejects a Provider registered in the wrong mode slot before verification', async () => {
    const verify = vi.fn<PaymentProvider['verify']>();
    const provider: PaymentProvider = { mode: 'LIVE', verify };
    const receivePaymentEvent = vi.fn<PaymentFoundationStore['receivePaymentEvent']>();
    const foundation = service(store({ receivePaymentEvent }), { TEST: provider });

    await expect(
      foundation.receivePaymentEvent({ paymentMode: 'TEST', payload: testPayload }),
    ).rejects.toBeInstanceOf(PaymentModeMismatchError);
    expect(verify).not.toHaveBeenCalled();
    expect(receivePaymentEvent).not.toHaveBeenCalled();
  });

  it('rejects a Provider that returns facts for a different payment mode', async () => {
    const normalized: NormalizedPaymentEvent = {
      paymentMode: 'LIVE',
      providerCode: 'misconfigured-provider',
      providerEventId: 'event-001',
      eventType: 'payment_succeeded',
      rechargeOrderId: orderId,
      amountMinor: 100,
      currency: 'CNY',
      occurredAt: now,
    };
    const provider: PaymentProvider = { mode: 'TEST', verify: vi.fn(async () => normalized) };
    const receivePaymentEvent = vi.fn<PaymentFoundationStore['receivePaymentEvent']>();
    const foundation = service(store({ receivePaymentEvent }), { TEST: provider });

    await expect(
      foundation.receivePaymentEvent({ paymentMode: 'TEST', payload: testPayload }),
    ).rejects.toBeInstanceOf(PaymentModeMismatchError);
    expect(receivePaymentEvent).not.toHaveBeenCalled();
  });

  it('preserves Provider identity replay/conflict outcomes without marking orders paid', async () => {
    const conflict = new PaymentIdempotencyConflictError();
    const baseStore = store();
    const receivePaymentEvent = vi
      .fn<PaymentFoundationStore['receivePaymentEvent']>()
      .mockResolvedValueOnce(
        await baseStore.receivePaymentEvent({
          paymentMode: 'TEST',
          providerCode: 'test-payment',
          providerEventId: 'test-event-001',
          eventType: 'payment_succeeded',
          eventDigest: 'a'.repeat(64),
          rechargeOrderId: orderId,
          amountMinor: 100,
          currency: 'CNY',
          occurredAt: now,
          receivedAt: now,
        }),
      )
      .mockRejectedValueOnce(conflict);
    const foundation = service(store({ receivePaymentEvent }));

    await expect(
      foundation.receivePaymentEvent({ paymentMode: 'TEST', payload: testPayload }),
    ).resolves.toMatchObject({ value: { processingStatus: 'received' } });
    await expect(
      foundation.receivePaymentEvent({ paymentMode: 'TEST', payload: testPayload }),
    ).rejects.toBe(conflict);
  });
});

describe('PaymentProvider adapters', () => {
  it('normalizes only allowlisted TEST fields', async () => {
    const adapter = new TestPaymentAdapter();
    const normalized = await adapter.verify({ paymentMode: 'TEST', payload: testPayload });

    expect(normalized).toEqual({
      paymentMode: 'TEST',
      providerCode: 'test-payment',
      providerEventId: 'test-event-001',
      eventType: 'payment_succeeded',
      rechargeOrderId: orderId,
      amountMinor: 100,
      currency: 'CNY',
      occurredAt: new Date('2026-08-08T05:59:00.000Z'),
    });
    expect(normalized).not.toHaveProperty('signature');
    expect(normalized).not.toHaveProperty('rawCardData');
  });

  it('does not let the TEST Adapter represent LIVE collection', async () => {
    const adapter = new TestPaymentAdapter();
    await expect(
      adapter.verify({ paymentMode: 'LIVE', payload: testPayload }),
    ).rejects.toBeInstanceOf(PaymentModeMismatchError);
  });
});
