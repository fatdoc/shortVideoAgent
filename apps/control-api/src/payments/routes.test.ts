import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE_NAME } from '../auth/session.js';
import type { PublicSession } from '../auth/service.js';
import {
  PaymentIdempotencyConflictError,
  PaymentProviderUnavailableError,
  RechargeIdempotencyConflictError,
} from './errors.js';
import { createPaymentRouter } from './routes.js';
import type { PaymentEvent, RechargeOrder } from './types.js';
import { createApp } from '../app.js';

const tenantId = '10000000-0000-4000-8000-000000000001';
const otherTenantId = '10000000-0000-4000-8000-000000000002';
const organizationId = tenantId;
const userId = '20000000-0000-4000-8000-000000000001';
const membershipId = '30000000-0000-4000-8000-000000000001';
const ruleVersionId = '40000000-0000-4000-8000-000000000001';
const orderId = '50000000-0000-4000-8000-000000000001';
const internalToken = 'independent-test-payment-internal-token-32-bytes';

const rechargeOrder: RechargeOrder = {
  rechargeOrderId: orderId,
  tenantId,
  walletId: '60000000-0000-4000-8000-000000000001',
  buyerUserId: userId,
  buyerMembershipId: membershipId,
  paymentMode: 'TEST',
  conversionRuleVersionId: ruleVersionId,
  amountMinor: 100,
  currency: 'CNY',
  purchasedCredits: 10,
  bonusCredits: 2,
  bonusExpiresInDays: 30,
  status: 'created',
  attributionSnapshotId: null,
  createdAt: '2026-08-08T06:00:00.000Z',
  updatedAt: '2026-08-08T06:00:00.000Z',
};

const paymentEvent: PaymentEvent = {
  paymentEventId: '70000000-0000-4000-8000-000000000001',
  paymentMode: 'TEST',
  providerCode: 'test-payment',
  providerEventId: 'provider-event-001',
  eventType: 'payment_succeeded',
  eventDigest: 'a'.repeat(64),
  rechargeOrderId: orderId,
  amountMinor: 100,
  currency: 'CNY',
  occurredAt: '2026-08-08T05:59:00.000Z',
  receivedAt: '2026-08-08T06:00:00.000Z',
  processingStatus: 'received',
  errorCode: null,
};

function session(
  organizationType: PublicSession['activeContext']['organizationType'] = 'TENANT',
  roles: PublicSession['activeContext']['roles'] = ['tenant_admin'],
  activeTenantId: string | null = tenantId,
): PublicSession {
  return {
    user: { id: userId, email: 'admin@example.com', displayName: 'Admin' },
    tenant: activeTenantId === null ? null : { id: activeTenantId, displayName: 'Payment Tenant' },
    roles,
    activeContext: {
      membershipId,
      organizationId:
        organizationType === 'TENANT' ? (activeTenantId ?? organizationId) : organizationId,
      organizationType,
      organizationDisplayName: 'Payment Organization',
      membershipVersion: 1,
      primaryRole: roles[0] ?? 'content_operator',
      roles,
      tenantId: activeTenantId,
    },
    expiresAt: '2026-08-08T08:00:00.000Z',
  };
}

function services() {
  return {
    createRechargeOrder: vi.fn(async () => ({ value: rechargeOrder, replayed: false })),
    listRechargeOrders: vi.fn(async () => [rechargeOrder]),
    receivePaymentEvent: vi.fn(async () => ({ value: paymentEvent, replayed: false })),
    listPaymentEvents: vi.fn(async () => [paymentEvent]),
  };
}

function application(
  options: {
    activeSession?: PublicSession | null;
    service?: ReturnType<typeof services>;
    token?: string;
  } = {},
) {
  const service = options.service ?? services();
  const resolveSession = vi.fn(async () => {
    if (options.activeSession === null) return null;
    return { session: options.activeSession ?? session() };
  });
  const paymentRouter = createPaymentRouter({
    service,
    resolveSession,
    internalToken: options.token ?? internalToken,
    secureCookies: false,
    sessionTtlSeconds: 3600,
  });
  return {
    service,
    resolveSession,
    app: createApp({
      appVersion: 'test',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      paymentRouter,
    }),
  };
}

function cookie(): string {
  return `${SESSION_COOKIE_NAME}=session-token`;
}

const createBody = {
  paymentMode: 'TEST',
  conversionRuleVersionId: ruleVersionId,
  idempotencyKey: 'recharge-001',
};

const eventBody = {
  paymentMode: 'TEST',
  providerEventId: 'provider-event-001',
  eventType: 'payment_succeeded',
  rechargeOrderId: orderId,
  amountMinor: 100,
  currency: 'CNY',
  occurredAt: '2026-08-08T05:59:00.000Z',
};

describe('Payment HTTP API', () => {
  it('creates an explicitly TEST RechargeOrder for the active Tenant administrator', async () => {
    const { app, service } = application();
    const response = await request(app)
      .post(`/api/v1/tenants/${tenantId}/recharge-orders`)
      .set('cookie', cookie())
      .send(createBody);

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ rechargeOrder });
    expect(response.body.rechargeOrder.paymentMode).toBe('TEST');
    expect(service.createRechargeOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        membershipId,
        organizationId,
        organizationType: 'TENANT',
        tenantId,
        roles: ['tenant_admin'],
      }),
      createBody,
    );
  });

  it('returns 200 and an explicit replay header for a safe order replay', async () => {
    const service = services();
    service.createRechargeOrder.mockResolvedValue({ value: rechargeOrder, replayed: true });
    const response = await request(application({ service }).app)
      .post(`/api/v1/tenants/${tenantId}/recharge-orders`)
      .set('cookie', cookie())
      .send(createBody);

    expect(response.status).toBe(200);
    expect(response.headers['idempotency-replayed']).toBe('true');
    expect(response.body.rechargeOrder.paymentMode).toBe('TEST');
  });

  it('returns 404 for a valid cross-Tenant path before calling the service', async () => {
    const { app, service } = application();
    const response = await request(app)
      .post(`/api/v1/tenants/${otherTenantId}/recharge-orders`)
      .set('cookie', cookie())
      .send(createBody);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RECHARGE_SCOPE_NOT_FOUND');
    expect(service.createRechargeOrder).not.toHaveBeenCalled();
  });

  it('returns 403 when the active Tenant is in scope but lacks recharge permission', async () => {
    const { app, service } = application({
      activeSession: session('TENANT', ['content_operator'], tenantId),
    });
    const response = await request(app)
      .post(`/api/v1/tenants/${tenantId}/recharge-orders`)
      .set('cookie', cookie())
      .send(createBody);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RECHARGE_PERMISSION_DENIED');
    expect(service.createRechargeOrder).not.toHaveBeenCalled();
  });

  it('rejects LIVE or unknown RechargeOrder fields at the HTTP boundary', async () => {
    const { app, service } = application();
    for (const body of [
      { ...createBody, paymentMode: 'LIVE' },
      { ...createBody, amountMinor: 100 },
    ]) {
      const response = await request(app)
        .post(`/api/v1/tenants/${tenantId}/recharge-orders`)
        .set('cookie', cookie())
        .send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('RECHARGE_VALIDATION_FAILED');
    }
    expect(service.createRechargeOrder).not.toHaveBeenCalled();
  });

  it('lists only the active Tenant RechargeOrders with a bounded limit', async () => {
    const { app, service } = application();
    const response = await request(app)
      .get(`/api/v1/tenants/${tenantId}/recharge-orders?limit=25`)
      .set('cookie', cookie());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ rechargeOrders: [rechargeOrder] });
    expect(service.listRechargeOrders).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId }),
      25,
    );
  });

  it('does not let a browser Session impersonate the internal TEST Provider', async () => {
    const { app, service } = application();
    const response = await request(app)
      .post('/api/v1/internal/payments/test/events')
      .set('cookie', cookie())
      .send(eventBody);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('PAYMENT_INTERNAL_AUTHORIZATION_FAILED');
    expect(service.receivePaymentEvent).not.toHaveBeenCalled();
  });

  it('accepts a safe TEST Payment Event only with the independent internal token', async () => {
    const { app, service } = application();
    const response = await request(app)
      .post('/api/v1/internal/payments/test/events')
      .set('x-test-payment-internal-token', internalToken)
      .send(eventBody);

    expect(response.status).toBe(202);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ paymentEvent });
    expect(response.body.paymentEvent.paymentMode).toBe('TEST');
    expect(service.receivePaymentEvent).toHaveBeenCalledWith({
      paymentMode: 'TEST',
      payload: eventBody,
    });
  });

  it('returns 200 for Payment Event replay and 409 for identity conflict', async () => {
    const replayService = services();
    replayService.receivePaymentEvent.mockResolvedValue({ value: paymentEvent, replayed: true });
    const replay = await request(application({ service: replayService }).app)
      .post('/api/v1/internal/payments/test/events')
      .set('x-test-payment-internal-token', internalToken)
      .send(eventBody);
    expect(replay.status).toBe(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');

    const conflictService = services();
    conflictService.receivePaymentEvent.mockRejectedValue(new PaymentIdempotencyConflictError());
    const conflict = await request(application({ service: conflictService }).app)
      .post('/api/v1/internal/payments/test/events')
      .set('x-test-payment-internal-token', internalToken)
      .send(eventBody);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('PAYMENT_IDEMPOTENCY_CONFLICT');
  });

  it('maps unavailable and Recharge idempotency domain errors without leaking internals', async () => {
    const unavailableService = services();
    unavailableService.receivePaymentEvent.mockRejectedValue(new PaymentProviderUnavailableError());
    const unavailable = await request(application({ service: unavailableService }).app)
      .post('/api/v1/internal/payments/test/events')
      .set('x-test-payment-internal-token', internalToken)
      .send(eventBody);
    expect(unavailable.status).toBe(503);
    expect(unavailable.body.error.code).toBe('PAYMENT_PROVIDER_UNAVAILABLE');

    const conflictService = services();
    conflictService.createRechargeOrder.mockRejectedValue(new RechargeIdempotencyConflictError());
    const conflict = await request(application({ service: conflictService }).app)
      .post(`/api/v1/tenants/${tenantId}/recharge-orders`)
      .set('cookie', cookie())
      .send(createBody);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('RECHARGE_IDEMPOTENCY_CONFLICT');
    expect(conflict.text).not.toContain('different facts');
  });

  it('allows only an active Platform administrator to list safe Payment Events', async () => {
    const platformSession = session('PLATFORM', ['platform_admin'], null);
    const { app, service } = application({ activeSession: platformSession });
    const response = await request(app)
      .get('/api/v1/platform/payment-events?limit=10')
      .set('cookie', cookie());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ paymentEvents: [paymentEvent] });
    expect(service.listPaymentEvents).toHaveBeenCalledWith(
      expect.objectContaining({ organizationType: 'PLATFORM', tenantId: null }),
      10,
    );
    expect(response.text).not.toContain('signature');
    expect(response.text).not.toContain('rawCardData');
  });

  it('returns 404 when a Tenant context probes the Platform Payment Event scope', async () => {
    const { app, service } = application();
    const response = await request(app)
      .get('/api/v1/platform/payment-events')
      .set('cookie', cookie());

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PAYMENT_EVENTS_NOT_FOUND');
    expect(service.listPaymentEvents).not.toHaveBeenCalled();
  });
});
