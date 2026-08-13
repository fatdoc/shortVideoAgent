import { createHmac } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { PublicSession } from '../auth/service.js';
import { createCanvasAssetRouter } from './routes.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const packageId = '33333333-3333-4333-8333-333333333333';
const actorId = '12121212-1212-4212-8212-121212121212';
const activationAttemptId = '90909090-9090-4090-8090-909090909090';
const sessionToken = 'browser-session-token';
const csrfSecret = 'csrf-secret-with-at-least-thirty-two-bytes';
const origin = 'https://app.videoagent.test';
const activationPath = `/api/v1/projects/${projectId}/production-packages/${packageId}/canvas-activation`;

const session: PublicSession = {
  user: { id: actorId, email: 'actor@example.test', displayName: 'Actor' },
  tenant: { id: tenantId, displayName: 'Tenant' },
  roles: ['tenant_admin'],
  activeContext: {
    membershipId: '13131313-1313-4313-8313-131313131313',
    organizationId: '14141414-1414-4414-8414-141414141414',
    organizationType: 'TENANT',
    organizationDisplayName: 'Tenant',
    membershipVersion: 1,
    primaryRole: 'tenant_admin',
    roles: ['tenant_admin'],
    tenantId,
  },
  expiresAt: '2026-08-14T04:00:00.000Z',
};

function entry() {
  return {
    objectType: 'CanvasEntry' as const,
    contractVersion: '0.2' as const,
    handle: `ce_${'A'.repeat(32)}`,
    tenantId,
    projectId,
    packageId,
    state: 'active' as const,
    issuedAt: '2026-08-14T02:00:00.000Z',
    expiresAt: '2026-08-14T02:02:00.000Z',
  };
}

function assetService() {
  return {
    createAsset: vi.fn(),
    listAssets: vi.fn(async () => []),
    getAsset: vi.fn(),
    transitionRights: vi.fn(),
    transitionApproval: vi.fn(),
    createHighCostApproval: vi.fn(),
    readHighCostApproval: vi.fn(),
  };
}

function harness(
  options: {
    resolve?: boolean;
    projectAccess?: 'viewer' | 'editor' | 'manager' | null;
    replayed?: boolean;
    rotatedToken?: string;
  } = {},
) {
  const activationService = {
    activate: vi.fn(async () => ({ entry: entry(), replayed: options.replayed ?? false })),
  };
  const policy = {
    canCreateProject: async () => true,
    listVisibleProjectIds: async () => null,
    resolveProjectAccess: vi.fn(async () =>
      options.projectAccess === undefined ? 'manager' : options.projectAccess,
    ),
  };
  const router = createCanvasAssetRouter({
    service: assetService(),
    activationService,
    policy,
    resolveSession: async () =>
      options.resolve === false
        ? null
        : { session, ...(options.rotatedToken ? { token: options.rotatedToken } : {}) },
    secureCookies: true,
    sessionTtlSeconds: 3600,
    allowedOrigins: [origin],
    csrfSecret,
  });
  const app = express();
  app.use((_, response, next) => {
    response.locals.requestId = 'req-canvas-activation-test';
    next();
  });
  app.use(express.json());
  app.use('/api/v1', router);
  return { app, activationService, policy };
}

function csrfToken(token = sessionToken) {
  return createHmac('sha256', csrfSecret).update(token).digest('base64url');
}

function authenticated(input: request.Test) {
  return input.set('Cookie', `videoagent_session=${sessionToken}`);
}

function guarded(input: request.Test, token = sessionToken) {
  return authenticated(input).set('Origin', origin).set('x-csrf-token', csrfToken(token));
}

describe('Control Canvas activation facade HTTP contract', () => {
  it('requires Tenant Session, exact Origin, current CSRF and project writer before activation', async () => {
    const missingSession = harness();
    await expect(request(missingSession.app).post(activationPath).send({ activationAttemptId }))
      .resolves.toMatchObject({ status: 401, body: { error: { code: 'AUTHENTICATION_REQUIRED' } } });
    expect(missingSession.activationService.activate).not.toHaveBeenCalled();

    const invalidSession = harness({ resolve: false });
    await expect(
      authenticated(request(invalidSession.app).post(activationPath)).send({ activationAttemptId }),
    ).resolves.toMatchObject({ status: 401, body: { error: { code: 'SESSION_INVALID' } } });
    expect(invalidSession.activationService.activate).not.toHaveBeenCalled();

    const wrongOrigin = harness();
    await expect(
      authenticated(request(wrongOrigin.app).post(activationPath))
        .set('Origin', 'https://evil.example')
        .set('x-csrf-token', csrfToken())
        .send({ activationAttemptId }),
    ).resolves.toMatchObject({ status: 403, body: { error: { code: 'CSRF_ORIGIN_INVALID' } } });
    expect(wrongOrigin.activationService.activate).not.toHaveBeenCalled();

    const wrongCsrf = harness();
    await expect(
      authenticated(request(wrongCsrf.app).post(activationPath))
        .set('Origin', origin)
        .set('x-csrf-token', 'wrong')
        .send({ activationAttemptId }),
    ).resolves.toMatchObject({ status: 403, body: { error: { code: 'CSRF_TOKEN_INVALID' } } });
    expect(wrongCsrf.activationService.activate).not.toHaveBeenCalled();

    const forbidden = harness({ projectAccess: 'viewer' });
    await expect(
      guarded(request(forbidden.app).post(activationPath)).send({ activationAttemptId }),
    ).resolves.toMatchObject({ status: 403, body: { error: { code: 'PERMISSION_DENIED' } } });
    expect(forbidden.activationService.activate).not.toHaveBeenCalled();
  });

  it('rejects malformed or expanded browser input and raw Idempotency-Key before activation', async () => {
    const { app, activationService } = harness();
    const bodies = [
      {},
      { activationAttemptId: 'not-a-uuid' },
      { activationAttemptId, ttlSeconds: 300 },
      { activationAttemptId, tenantId },
      { activationAttemptId, idempotencyKey: 'browser-key' },
    ];
    for (const body of bodies) {
      const response = await guarded(request(app).post(activationPath)).send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('CANVAS_SCHEMA_INVALID');
    }
    const rawHeader = await guarded(request(app).post(activationPath))
      .set('Idempotency-Key', 'browser-key')
      .send({ activationAttemptId });
    expect(rawHeader.status).toBe(400);
    expect(rawHeader.body.error.code).toBe('CANVAS_SCHEMA_INVALID');
    expect(activationService.activate).not.toHaveBeenCalled();
  });

  it('uses the CSRF token bound to a rotated active Session token', async () => {
    const rotatedToken = 'rotated-browser-session-token';
    const { app, activationService } = harness({ rotatedToken });
    const stale = await guarded(request(app).post(activationPath)).send({ activationAttemptId });
    expect(stale.status).toBe(403);
    expect(activationService.activate).not.toHaveBeenCalled();

    const current = await guarded(request(app).post(activationPath), rotatedToken).send({
      activationAttemptId,
    });
    expect(current.status).toBe(201);
    expect(current.headers['set-cookie']?.join(';')).toContain('videoagent_session=rotated-browser-session-token');
    expect(activationService.activate).toHaveBeenCalledTimes(1);
  });

  it('returns one strict replay authority with no replay header or internal key material', async () => {
    const fresh = harness();
    const freshResponse = await guarded(request(fresh.app).post(activationPath)).send({
      activationAttemptId,
    });
    expect(freshResponse.status).toBe(201);
    expect(freshResponse.headers['cache-control']).toBe('no-store');
    expect(freshResponse.headers).not.toHaveProperty('idempotency-replayed');
    expect(freshResponse.body).toEqual({
      entry: entry(),
      replayed: false,
      requestId: 'req-canvas-activation-test',
    });
    expect(fresh.activationService.activate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: actorId, tenantId }),
      projectId,
      packageId,
      { activationAttemptId },
    );

    const replay = harness({ replayed: true });
    const replayResponse = await guarded(request(replay.app).post(activationPath)).send({
      activationAttemptId,
    });
    expect(replayResponse.status).toBe(200);
    expect(replayResponse.headers).not.toHaveProperty('idempotency-replayed');
    expect(replayResponse.body.replayed).toBe(true);
    expect(JSON.stringify([freshResponse.body, replayResponse.body])).not.toMatch(
      /90909090|idempotency|cva1\.|digest|secret|grant|token/i,
    );
  });
});
