import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../apps/control-api/src/app.js';
import { createInternalCanvasApprovalRouter } from '../../../apps/control-api/src/assets/internalApprovalRoutes.js';

const internalToken = 'i'.repeat(48);
const approvalId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const tenantId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const packageId = '33333333-3333-4333-8333-333333333333';
const actorId = '12121212-1212-4212-8212-121212121212';
const commandId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const changedCommandId = 'abababab-abab-4bab-8bab-abababababab';
const canvasSessionId = 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678';

function exactBody() {
  return {
    approvalId,
    tenantId,
    projectId,
    packageId,
    canvasSessionId,
    actorId,
    commandType: 'GENERATE_SHOT',
    action: {
      commandId,
      payload: {
        shotId: '66666666-6666-4666-8666-666666666666',
        readinessId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        prompt: 'safe prompt',
        referenceAssetIds: ['88888888-8888-4888-8888-888888888888'],
      },
    },
    commandId,
  } as const;
}

function application(service: { consumeHighCostApproval(input: unknown): Promise<unknown> }) {
  return createApp({
    appVersion: 'cv6-g2-runtime-gate',
    nodeEnv: 'test',
    readinessProbe: async () => undefined,
    internalCanvasApprovalRouter: createInternalCanvasApprovalRouter({ internalToken, service }),
  });
}

function acceptingService() {
  return {
    consumeHighCostApproval: vi.fn(async () => ({
      approvalId,
      status: 'consumed',
      replayed: false,
    })),
  };
}

describe('CV6 independent Control approval-consume boundary', () => {
  it('authenticates before parsing and emits no reflected malformed body', async () => {
    const service = acceptingService();
    const response = await request(application(service))
      .post('/api/v1/internal/canvas-command-approvals/consume')
      .set('content-type', 'application/json')
      .set('x-production-plane-internal-token', 'wrong')
      .send('{"providerRawBody":"paid-secret"');

    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({
      code: 'CANVAS_APPROVAL_INTERNAL_AUTHORIZATION_INVALID',
      message: 'Internal authorization is invalid.',
      retryable: false,
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(response.body)).not.toMatch(/providerRawBody|paid-secret|stack/iu);
    expect(service.consumeHighCostApproval).not.toHaveBeenCalled();
  });

  it('rejects malformed, unknown and over-64KiB JSON with a fixed safe envelope', async () => {
    const service = acceptingService();
    const malformed = await request(application(service))
      .post('/api/v1/internal/canvas-command-approvals/consume')
      .set('content-type', 'application/json')
      .set('x-production-plane-internal-token', internalToken)
      .send('{"accessToken":"paid-secret"');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error).toMatchObject({
      code: 'CANVAS_APPROVAL_REQUEST_INVALID',
      message: 'Request body is invalid.',
      retryable: false,
    });

    const unknown = await request(application(service))
      .post('/api/v1/internal/canvas-command-approvals/consume')
      .set('x-production-plane-internal-token', internalToken)
      .send({ ...exactBody(), providerRawBody: 'paid-secret' });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe('CANVAS_SCHEMA_INVALID');

    const oversized = await request(application(service))
      .post('/api/v1/internal/canvas-command-approvals/consume')
      .set('content-type', 'application/json')
      .set('x-production-plane-internal-token', internalToken)
      .send(JSON.stringify({ padding: 'x'.repeat(64 * 1024 + 1) }));
    expect(oversized.status).toBe(413);
    expect(oversized.body.error).toMatchObject({
      code: 'CANVAS_APPROVAL_REQUEST_TOO_LARGE',
      message: 'Request body is too large.',
      retryable: false,
    });
    expect(JSON.stringify([malformed.body, unknown.body, oversized.body])).not.toMatch(
      /paid-secret|accessToken|providerRawBody|x{100}|stack/iu,
    );
    expect(service.consumeHighCostApproval).not.toHaveBeenCalled();
  });

  it('accepts only exact action={commandId,payload}, never a legacy generic action', async () => {
    const service = acceptingService();
    const response = await request(application(service))
      .post('/api/v1/internal/canvas-command-approvals/consume')
      .set('x-production-plane-internal-token', internalToken)
      .send({
        ...exactBody(),
        action: {
          shotId: '66666666-6666-4666-8666-666666666666',
          allowAny: true,
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: 'CANVAS_SCHEMA_INVALID',
      retryable: false,
    });
    expect(service.consumeHighCostApproval).not.toHaveBeenCalled();
  });

  it('rejects commandId drift between the exact action and consume authority', async () => {
    const service = acceptingService();
    const response = await request(application(service))
      .post('/api/v1/internal/canvas-command-approvals/consume')
      .set('x-production-plane-internal-token', internalToken)
      .send({ ...exactBody(), commandId: changedCommandId });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: 'CANVAS_SCHEMA_INVALID',
      retryable: false,
    });
    expect(service.consumeHighCostApproval).not.toHaveBeenCalled();
  });

  it('returns only the strict safe replay projection for an exact consume', async () => {
    const service = acceptingService();
    const response = await request(application(service))
      .post('/api/v1/internal/canvas-command-approvals/consume')
      .set('x-production-plane-internal-token', internalToken)
      .send(exactBody());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ approvalId, status: 'consumed', replayed: false });
    expect(service.consumeHighCostApproval).toHaveBeenCalledWith(exactBody());
    expect(JSON.stringify(response.body)).not.toMatch(
      /action|payload|asset:\/\/|provider|internalToken|digest|commandId/iu,
    );
  });

  it('does not expose the internal route when the production dependency is absent', async () => {
    const response = await request(createApp({
      appVersion: 'cv6-g2-runtime-gate',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      internalCanvasApprovalRouter: undefined,
      authRouter: Router(),
    }))
      .post('/api/v1/internal/canvas-command-approvals/consume')
      .set('x-production-plane-internal-token', internalToken)
      .send(exactBody());

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
