import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import { SESSION_COOKIE_NAME } from '../auth/session.js';
import type { PublicSession } from '../auth/service.js';
import { CommissionPermissionDeniedError, CommissionScopeNotFoundError } from './errors.js';
import { createCommissionAuditRouter } from './routes.js';
import type { CommissionAuditService } from './service.js';

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
      email: 'commission@example.com',
      displayName: 'Commission Auditor',
    },
    tenant: null,
    roles,
    activeContext: {
      membershipId,
      organizationId,
      organizationType,
      organizationDisplayName: 'Audit Organization',
      membershipVersion: 1,
      primaryRole: roles[0] ?? 'content_operator',
      roles,
      tenantId: null,
    },
    expiresAt: '2026-08-08T18:00:00.000Z',
  };
}

function services() {
  return {
    listPlatformCalculations: vi.fn<CommissionAuditService['listPlatformCalculations']>(),
    listPlatformAccruals: vi.fn<CommissionAuditService['listPlatformAccruals']>(),
    listPlatformReversals: vi.fn<CommissionAuditService['listPlatformReversals']>(),
    listPlatformManualReviews: vi.fn<CommissionAuditService['listPlatformManualReviews']>(),
    listChannelCalculations: vi.fn<CommissionAuditService['listChannelCalculations']>(),
    listChannelAccruals: vi.fn<CommissionAuditService['listChannelAccruals']>(),
    listChannelReversals: vi.fn<CommissionAuditService['listChannelReversals']>(),
  };
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
  const commissionAuditRouter = createCommissionAuditRouter({
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
  app.use('/api/v1', commissionAuditRouter);
  return { service, app };
}

const cookie = () => `${SESSION_COOKIE_NAME}=session-token`;

describe('Commission audit HTTP API', () => {
  it('requires an active Session and preserves rotated cookies', async () => {
    const unauthenticated = await request(application().app).get(
      '/api/v1/platform/commission-audit/calculations',
    );
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('AUTHENTICATION_REQUIRED');

    const rotated = await request(application({ rotatedToken: 'rotated-token' }).app)
      .get('/api/v1/platform/commission-audit/calculations')
      .set('cookie', cookie());
    expect(rotated.status).toBe(200);
    expect(rotated.headers['set-cookie']?.[0]).toContain(`${SESSION_COOKIE_NAME}=rotated-token`);
  });

  it.each([
    ['calculations', 'listPlatformCalculations', 'calculations'],
    ['accruals', 'listPlatformAccruals', 'accruals'],
    ['reversals', 'listPlatformReversals', 'reversals'],
    ['manual-reviews', 'listPlatformManualReviews', 'manualReviews'],
  ] as const)('serves the bounded Platform %s list', async (path, method, key) => {
    const service = services();
    service[method].mockResolvedValue([]);
    const response = await request(application({ service }).app)
      .get(`/api/v1/platform/commission-audit/${path}?limit=25`)
      .set('cookie', cookie());

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ [key]: [] });
    expect(service[method]).toHaveBeenCalledWith(
      expect.objectContaining({ organizationType: 'PLATFORM', roles: ['platform_admin'] }),
      25,
    );
  });

  it.each([
    ['calculations', 'listChannelCalculations', 'calculations'],
    ['accruals', 'listChannelAccruals', 'accruals'],
    ['reversals', 'listChannelReversals', 'reversals'],
  ] as const)('serves the bounded Channel %s list', async (path, method, key) => {
    const service = services();
    service[method].mockResolvedValue([]);
    const response = await request(
      application({ activeSession: session('CHANNEL', ['channel_admin']), service }).app,
    )
      .get(`/api/v1/channels/${channelId}/commission-audit/${path}?limit=10`)
      .set('cookie', cookie());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ [key]: [] });
    expect(service[method]).toHaveBeenCalledWith(
      expect.objectContaining({ organizationType: 'CHANNEL', roles: ['channel_admin'] }),
      channelId,
      10,
    );
  });

  it('rejects invalid UUIDs and unbounded list parameters before calling the service', async () => {
    const { app, service } = application();
    for (const path of [
      '/api/v1/channels/not-a-uuid/commission-audit/calculations',
      '/api/v1/platform/commission-audit/calculations?limit=101',
      '/api/v1/platform/commission-audit/calculations?limit=10&secret=probe',
    ]) {
      const response = await request(app).get(path).set('cookie', cookie());
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('COMMISSION_QUERY_INVALID');
    }
    expect(service.listPlatformCalculations).not.toHaveBeenCalled();
    expect(service.listChannelCalculations).not.toHaveBeenCalled();
  });

  it.each([
    [new CommissionScopeNotFoundError(), 404, 'COMMISSION_SCOPE_NOT_FOUND'],
    [new CommissionPermissionDeniedError(), 403, 'COMMISSION_PERMISSION_DENIED'],
  ] as const)('maps stable safe scope errors', async (error, status, code) => {
    const service = services();
    service.listPlatformCalculations.mockRejectedValue(error);
    const response = await request(application({ service }).app)
      .get('/api/v1/platform/commission-audit/calculations')
      .set('cookie', cookie());

    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe(code);
    expect(response.text).not.toContain(error.message);
  });
});
