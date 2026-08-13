import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE_NAME } from '../auth/session.js';
import type { PublicSession } from '../auth/service.js';
import {
  CommissionSettlementEvidenceInvalidError,
  CommissionSettlementIdempotencyConflictError,
  CommissionSettlementPeriodConflictError,
  CommissionSettlementPermissionDeniedError,
  CommissionSettlementScopeNotFoundError,
} from './errors.js';
import { createCommissionSettlementRouter } from './routes.js';
import type { CommissionSettlementService } from './service.js';

const organizationId = 'a0000000-0000-4000-8000-000000000001';
const membershipId = 'b0000000-0000-4000-8000-000000000001';
const channelId = 'c0000000-0000-4000-8000-000000000001';

function session(
  organizationType: PublicSession['activeContext']['organizationType'] = 'PLATFORM',
  roles: PublicSession['activeContext']['roles'] = ['platform_admin'],
): PublicSession {
  return {
    user: {
      id: 'd0000000-0000-4000-8000-000000000001',
      email: 'settlement@example.com',
      displayName: 'Settlement Operator',
    },
    tenant: null,
    roles,
    activeContext: {
      membershipId,
      organizationId,
      organizationType,
      organizationDisplayName: 'Settlement Organization',
      membershipVersion: 1,
      primaryRole: roles[0] ?? 'content_operator',
      roles,
      tenantId: null,
    },
    expiresAt: '2026-09-08T18:00:00.000Z',
  };
}

const body = {
  paymentMode: 'TEST',
  beneficiaryChannelId: channelId,
  currency: 'CNY',
  periodStart: '2026-08-01',
  cutoffAt: '2026-09-08T00:00:00.000Z',
  idempotencyKey: 'commission-settlement:august',
};

const draft = {
  commissionSettlementId: 'e0000000-0000-4000-8000-000000000001',
  paymentMode: 'TEST' as const,
  beneficiaryChannelId: channelId,
  currency: 'CNY',
  periodStart: '2026-08-01',
  periodEnd: '2026-09-01',
  cutoffAt: '2026-09-08T00:00:00.000Z',
  status: 'draft' as const,
  grossAccrualAmountMinor: 15,
  grossReversalAmountMinor: 0,
  netAmountMinor: 15,
  accrualItemCount: 1,
  reversalItemCount: 0,
  itemCount: 1,
  createdAt: '2026-09-08T00:00:01.000Z',
};

function services() {
  return { createDraft: vi.fn<CommissionSettlementService['createDraft']>() };
}

function application(
  options: {
    activeSession?: PublicSession;
    rotatedToken?: string;
    service?: ReturnType<typeof services>;
  } = {},
) {
  const service = options.service ?? services();
  const activeSession = options.activeSession ?? session();
  const router = createCommissionSettlementRouter({
    service,
    resolveSession: vi.fn(async (token: string) =>
      token === 'session-token'
        ? {
            session: activeSession,
            ...(options.rotatedToken ? { token: options.rotatedToken } : {}),
          }
        : null,
    ),
    secureCookies: false,
    sessionTtlSeconds: 3600,
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1', router);
  return { app, service };
}

const cookie = () => `${SESSION_COOKIE_NAME}=session-token`;

describe('Commission Settlement HTTP API', () => {
  it('requires a Session and preserves a rotated cookie', async () => {
    const unauthenticated = await request(application().app)
      .post('/api/v1/platform/commission-settlements')
      .send(body);
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('AUTHENTICATION_REQUIRED');

    const rotated = application({ rotatedToken: 'rotated-token' });
    rotated.service.createDraft.mockResolvedValue({ value: draft, replayed: false });
    const response = await request(rotated.app)
      .post('/api/v1/platform/commission-settlements')
      .set('cookie', cookie())
      .send(body);
    expect(response.headers['set-cookie']?.[0]).toContain(`${SESSION_COOKIE_NAME}=rotated-token`);
  });

  it('returns 201 for creation and 200 for an idempotent replay', async () => {
    const created = application();
    created.service.createDraft.mockResolvedValue({ value: draft, replayed: false });
    const createdResponse = await request(created.app)
      .post('/api/v1/platform/commission-settlements')
      .set('cookie', cookie())
      .send(body);
    expect(createdResponse.status).toBe(201);
    expect(createdResponse.headers['idempotency-replayed']).toBe('false');
    expect(createdResponse.headers['cache-control']).toBe('no-store');
    expect(createdResponse.body).toEqual({ settlement: draft });
    expect(created.service.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({ organizationType: 'PLATFORM', roles: ['platform_admin'] }),
      body,
    );

    const replay = application();
    replay.service.createDraft.mockResolvedValue({ value: draft, replayed: true });
    const replayResponse = await request(replay.app)
      .post('/api/v1/platform/commission-settlements')
      .set('cookie', cookie())
      .send(body);
    expect(replayResponse.status).toBe(200);
    expect(replayResponse.headers['idempotency-replayed']).toBe('true');
  });

  it('rejects malformed or expanded input before calling the service', async () => {
    const { app, service } = application();
    const response = await request(app)
      .post('/api/v1/platform/commission-settlements')
      .set('cookie', cookie())
      .send({ ...body, paymentMode: 'LIVE', periodEnd: '2026-09-01' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('COMMISSION_SETTLEMENT_VALIDATION_FAILED');
    expect(service.createDraft).not.toHaveBeenCalled();
  });

  it.each([
    [new CommissionSettlementScopeNotFoundError(), 404],
    [new CommissionSettlementPermissionDeniedError(), 403],
    [new CommissionSettlementIdempotencyConflictError(), 409],
    [new CommissionSettlementPeriodConflictError(), 409],
    [new CommissionSettlementEvidenceInvalidError(), 409],
  ] as const)('maps the domain error %s to a safe envelope', async (error, status) => {
    const { app, service } = application();
    service.createDraft.mockRejectedValue(error);
    const response = await request(app)
      .post('/api/v1/platform/commission-settlements')
      .set('cookie', cookie())
      .send(body);

    expect(response.status).toBe(status);
    expect(response.body.error).toMatchObject({ code: error.code });
    expect(response.text).not.toMatch(/select |postgres|snapshot|secret/i);
  });

  it('never exposes paid, withdrawable,到账 or internal evidence in a successful body', async () => {
    const { app, service } = application();
    service.createDraft.mockResolvedValue({ value: draft, replayed: false });
    const response = await request(app)
      .post('/api/v1/platform/commission-settlements')
      .set('cookie', cookie())
      .send(body);

    expect(response.status).toBe(201);
    expect(response.text).not.toMatch(/paid|withdrawable|可提现|已到账|snapshot|digest/i);
  });
});
