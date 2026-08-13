import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { canvasEntryError } from './errors.js';
import {
  createInternalCanvasEntryRouter,
  type CanvasEntryRedemptionResult,
  type InternalCanvasEntryRedemptionService,
  type InternalCanvasEntryRouterOptions,
} from './internalRoutes.js';

const internalToken = 'storycanvas-internal-token-at-least-32-bytes';
const tenantId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const packageId = '33333333-3333-4333-8333-333333333333';
const handle = `ce_${'A'.repeat(32)}`;
const idempotencyKey = 'canvas-redemption-key-1';
const accessToken = 'header.payload.signature';

function redemption(
  overrides: Partial<CanvasEntryRedemptionResult> = {},
): CanvasEntryRedemptionResult {
  return {
    objectType: 'CanvasEntryRedemption',
    contractVersion: '0.1',
    handle,
    tenantId,
    projectId,
    packageId,
    consumedAt: '2026-08-11T06:00:00.000Z',
    productionPackage: {
      objectType: 'ProjectProductionPackage',
      contractVersion: '0.3',
      tenantId,
      projectId,
      packageId,
      approvedScript: { content: 'server-only package content' },
    },
    grant: {
      objectType: 'ProjectGrant',
      contractVersion: '0.2',
      tenantId,
      projectId,
      packageId,
      grantId: '44444444-4444-4444-8444-444444444444',
    },
    tokenType: 'Bearer',
    accessToken,
    replayed: false,
    ...overrides,
  };
}

function serviceResult(replayed = false, overrides: Partial<CanvasEntryRedemptionResult> = {}) {
  const result = redemption({ ...overrides, replayed });
  const { replayed: replayFlag, ...value } = result;
  return { value, replayed: replayFlag };
}

function service(
  overrides: Partial<InternalCanvasEntryRedemptionService> = {},
): InternalCanvasEntryRedemptionService {
  return {
    redeemEntry: vi.fn(async () => serviceResult()),
    ...overrides,
  };
}

function app(routerOptions: InternalCanvasEntryRouterOptions) {
  const application = express();
  application.disable('x-powered-by');
  application.use(express.json({ limit: '1mb', strict: true }));
  application.use('/api/v1/internal', createInternalCanvasEntryRouter(routerOptions));
  return application;
}

function post(
  application: ReturnType<typeof app>,
  options: { token?: string | null; key?: string | null; body?: unknown; requestId?: string } = {},
) {
  let pending = request(application).post('/api/v1/internal/canvas-entries/redeem');
  if (options.token !== null) {
    pending = pending.set('x-production-plane-internal-token', options.token ?? internalToken);
  }
  if (options.key !== null) {
    pending = pending.set('idempotency-key', options.key ?? idempotencyKey);
  }
  if (options.requestId) pending = pending.set('x-request-id', options.requestId);
  return pending.send(
    options.body ?? {
      handle,
      tenantId,
      projectId,
      packageId,
    },
  );
}

function expectSafeError(
  response: Awaited<ReturnType<typeof post>>,
  expected: { status: number; code: string; requestId?: string; retryable?: boolean },
): void {
  expect(response.status).toBe(expected.status);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['x-request-id']).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
  expect(response.body).toEqual({
    error: {
      code: expected.code,
      message: expect.any(String),
      category: expect.any(String),
      retryable: expected.retryable ?? false,
      details: {},
      requestId: expected.requestId ?? response.headers['x-request-id'],
    },
  });
}

function expectNoSensitiveErrorData(response: Awaited<ReturnType<typeof post>>): void {
  const serialized = JSON.stringify(response.body).toLowerCase();
  for (const marker of [
    internalToken.toLowerCase(),
    idempotencyKey.toLowerCase(),
    accessToken.toLowerCase(),
    'grantid',
    'tokendigest',
    'requestdigest',
    'payloaddigest',
    'authoritydigest',
    'approvedscript',
    'select * from',
    'postgres password',
    'stack trace',
  ]) {
    expect(serialized).not.toContain(marker);
  }
}

describe('A-BIZ-06E.R4 internal Canvas Entry redemption HTTP', () => {
  it('fails closed before schema or Service access for missing, short, or wrong internal tokens', async () => {
    const entryService = service();
    const application = app({ service: entryService, internalToken });
    const responses = await Promise.all([
      post(application, { token: null, key: null, body: { accessToken, grantId: packageId } }),
      post(application, { token: 'wrong' }),
      post(application, { token: 'x'.repeat(internalToken.length) }),
    ]);

    for (const response of responses) {
      expectSafeError(response, {
        status: 401,
        code: 'CANVAS_ENTRY_INTERNAL_AUTHORIZATION_INVALID',
      });
      expectNoSensitiveErrorData(response);
    }
    expect(entryService.redeemEntry).not.toHaveBeenCalled();
  });

  it('requires exact JSON body and Idempotency-Key only from the header', async () => {
    const entryService = service();
    const application = app({ service: entryService, internalToken });
    const invalidRequests = [
      post(application, { key: null }),
      post(application, { key: 'invalid key with spaces' }),
      post(application, { key: `x${'a'.repeat(200)}` }),
      post(application, { body: { handle, tenantId, projectId } }),
      post(application, { body: { handle: 'not-a-handle', tenantId, projectId, packageId } }),
      post(application, { body: { handle, tenantId: 'not-a-uuid', projectId, packageId } }),
      post(application, {
        body: { handle, tenantId, projectId, packageId, idempotencyKey },
      }),
      post(application, { body: { handle, tenantId, projectId, packageId, grantId: packageId } }),
      post(application, { body: { handle, tenantId, projectId, packageId, accessToken } }),
    ];

    for (const pending of invalidRequests) {
      const response = await pending;
      expectSafeError(response, { status: 422, code: 'CANVAS_ENTRY_SCHEMA_INVALID' });
      expectNoSensitiveErrorData(response);
    }
    expect(entryService.redeemEntry).not.toHaveBeenCalled();
  });

  it('rejects a non-JSON media type before Service access', async () => {
    const entryService = service();
    const response = await request(app({ service: entryService, internalToken }))
      .post('/api/v1/internal/canvas-entries/redeem')
      .set('x-production-plane-internal-token', internalToken)
      .set('idempotency-key', idempotencyKey)
      .type('text/plain')
      .send(JSON.stringify({ handle, tenantId, projectId, packageId }));

    expectSafeError(response, { status: 422, code: 'CANVAS_ENTRY_SCHEMA_INVALID' });
    expectNoSensitiveErrorData(response);
    expect(entryService.redeemEntry).not.toHaveBeenCalled();
  });

  it('passes only canonical redemption facts and returns the server-only result with no-store', async () => {
    const redeemEntry = vi.fn(async () => serviceResult());
    const response = await post(app({ service: service({ redeemEntry }), internalToken }), {
      requestId: 'canvas-redemption-success',
    });

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe('canvas-redemption-success');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['idempotency-replayed']).toBe('false');
    expect(response.body).toEqual(redemption());
    expect(redeemEntry).toHaveBeenCalledWith({
      handle,
      tenantId,
      projectId,
      packageId,
      idempotencyKey,
      redeemedBy: 'storycanvas-production-plane',
    });
  });

  it('returns exact response-loss replay as 200 and exposes only the replay flag in the header', async () => {
    const response = await post(
      app({
        internalToken,
        service: service({ redeemEntry: vi.fn(async () => serviceResult(true)) }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers['idempotency-replayed']).toBe('true');
    expect(response.body).toEqual(redemption({ replayed: true }));
  });

  it.each([
    ['CANVAS_ENTRY_NOT_FOUND', 404, 'CANVAS_ENTRY_NOT_FOUND'],
    ['CANVAS_ENTRY_IDEMPOTENCY_CONFLICT', 409, 'CANVAS_ENTRY_IDEMPOTENCY_CONFLICT'],
    ['CANVAS_ENTRY_REPLAYED', 409, 'CANVAS_ENTRY_IDEMPOTENCY_CONFLICT'],
    ['CANVAS_ENTRY_EXPIRED', 410, 'CANVAS_ENTRY_EXPIRED'],
  ] as const)(
    'maps %s to stable safe %i without exposing domain details',
    async (source, status, code) => {
      const response = await post(
        app({
          internalToken,
          service: service({
            redeemEntry: vi.fn(async () => {
              throw canvasEntryError(
                source,
                `postgres password=raw-secret authorization=Bearer ${accessToken}`,
                {
                  grantId: packageId,
                  requestDigest: 'sha256:secret',
                  snapshot: { approvedScript: 'secret' },
                },
              );
            }),
          }),
        }),
        { requestId: `canvas-redemption-${status}` },
      );

      expectSafeError(response, {
        status,
        code,
        requestId: `canvas-redemption-${status}`,
      });
      expectNoSensitiveErrorData(response);
    },
  );

  it('maps an explicit dependency outage to retryable 503 without serializing SQL or stack', async () => {
    const dependencyError = Object.assign(
      new Error(`SELECT * FROM grants; postgres password=raw-secret; stack trace ${accessToken}`),
      { status: 503, code: 'DATABASE_UNAVAILABLE', query: 'SELECT * FROM canvas_entries' },
    );
    const response = await post(
      app({
        internalToken,
        service: service({
          redeemEntry: vi.fn(async () => {
            throw dependencyError;
          }),
        }),
      }),
    );

    expectSafeError(response, {
      status: 503,
      code: 'CANVAS_ENTRY_DEPENDENCY_UNAVAILABLE',
      retryable: true,
    });
    expectNoSensitiveErrorData(response);
  });

  it('maps unknown failures and malformed Service results to safe 500 responses', async () => {
    const thrown = await post(
      app({
        internalToken,
        service: service({
          redeemEntry: vi.fn(async () => {
            throw new Error(
              `stack trace SELECT * FROM grants grantId=${packageId} token=${accessToken}`,
            );
          }),
        }),
      }),
    );
    const malformed = await post(
      app({
        internalToken,
        service: service({
          redeemEntry: vi.fn(async () => ({
            ...serviceResult(),
            value: {
              ...serviceResult().value,
              tenantId: '99999999-9999-4999-8999-999999999999',
              sql: 'SELECT * FROM canvas_entries',
              stack: 'stack trace',
            },
          })),
        }),
      }),
    );

    for (const response of [thrown, malformed]) {
      expectSafeError(response, { status: 500, code: 'INTERNAL_ERROR' });
      expectNoSensitiveErrorData(response);
    }
  });

  it('generates a Request ID when the shared app middleware is not mounted', async () => {
    const response = await post(app({ service: service(), internalToken }));

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('fails startup closed for an undersized configured internal token', () => {
    expect(() =>
      createInternalCanvasEntryRouter({ internalToken: 'too-short', service: service() }),
    ).toThrow('Internal Canvas Entry token must contain at least 32 bytes.');
  });
});
