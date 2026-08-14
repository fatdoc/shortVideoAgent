import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { canvasAssetError } from './errors.js';
import { createInternalCanvasApprovalRouter } from './internalApprovalRoutes.js';

const internalToken = 'i'.repeat(48);
const approvalId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const tenantId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const packageId = '33333333-3333-4333-8333-333333333333';
const actorId = '12121212-1212-4212-8212-121212121212';
const commandId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const canvasSessionId = 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678';

function body() {
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
        prompt: '门店入口讲解招牌套餐',
        referenceAssetIds: ['88888888-8888-4888-8888-888888888888'],
      },
    },
    commandId,
  } as const;
}

function application(service: { consumeHighCostApproval(input: unknown): Promise<unknown> }) {
  return createApp({
    appVersion: 'test',
    nodeEnv: 'test',
    readinessProbe: async () => undefined,
    internalCanvasApprovalRouter: createInternalCanvasApprovalRouter({ internalToken, service }),
  });
}

describe('internal Canvas approval consumption boundary', () => {
  it('authenticates before parsing and never reflects a malformed secret body', async () => {
    const service = { consumeHighCostApproval: vi.fn() };
    const response = await request(application(service))
      .post('/api/v1/internal/canvas-command-approvals/consume')
      .set('content-type', 'application/json')
      .set('x-production-plane-internal-token', 'wrong')
      .send('{"accessToken":"server-secret"');

    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({
      code: 'CANVAS_APPROVAL_INTERNAL_AUTHORIZATION_INVALID',
      retryable: false,
    });
    expect(JSON.stringify(response.body)).not.toMatch(/accessToken|server-secret|stack/iu);
    expect(service.consumeHighCostApproval).not.toHaveBeenCalled();
  });

  it('uses a bounded strict parser and a fixed safe error envelope', async () => {
    const service = { consumeHighCostApproval: vi.fn() };
    const malformed = await request(application(service))
      .post('/api/v1/internal/canvas-command-approvals/consume')
      .set('content-type', 'application/json')
      .set('x-production-plane-internal-token', internalToken)
      .send('{"providerRawBody":"secret"');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('CANVAS_APPROVAL_REQUEST_INVALID');
    expect(JSON.stringify(malformed.body)).not.toMatch(/providerRawBody|secret|stack/iu);

    const oversized = await request(application(service))
      .post('/api/v1/internal/canvas-command-approvals/consume')
      .set('content-type', 'application/json')
      .set('x-production-plane-internal-token', internalToken)
      .send(JSON.stringify({ padding: 'x'.repeat(70 * 1024) }));
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe('CANVAS_APPROVAL_REQUEST_TOO_LARGE');
    expect(JSON.stringify(oversized.body)).not.toContain('x'.repeat(100));
    expect(service.consumeHighCostApproval).not.toHaveBeenCalled();
  });

  it('forwards the exact immutable scope/action and returns only safe consumption facts', async () => {
    const consumeHighCostApproval = vi.fn(async () => ({
      approvalId,
      status: 'consumed',
      replayed: false,
    }));
    const response = await request(application({ consumeHighCostApproval }))
      .post('/api/v1/internal/canvas-command-approvals/consume')
      .set('x-production-plane-internal-token', internalToken)
      .send(body());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ approvalId, status: 'consumed', replayed: false });
    expect(consumeHighCostApproval).toHaveBeenCalledWith(body());
    expect(JSON.stringify(response.body)).not.toMatch(/action|asset:\/\/|internalToken|digest/iu);
  });

  it('maps exact-binding rejection to a fixed non-reflective response', async () => {
    const service = {
      consumeHighCostApproval: vi.fn(async () => {
        throw canvasAssetError('CANVAS_APPROVAL_INVALID', 'Canvas approval is invalid.');
      }),
    };
    const response = await request(application(service))
      .post('/api/v1/internal/canvas-command-approvals/consume')
      .set('x-production-plane-internal-token', internalToken)
      .send(body());
    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      code: 'CANVAS_APPROVAL_INVALID',
      message: 'Canvas approval is invalid.',
      retryable: false,
    });
    expect(JSON.stringify(response.body)).not.toMatch(/referenceAssetIds|prompt|asset:\/\//iu);
  });
});
