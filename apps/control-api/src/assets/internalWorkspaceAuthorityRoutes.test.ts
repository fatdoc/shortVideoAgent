import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { CanvasWorkspaceAuthorityError } from './workspaceAuthorityErrors.js';
import { createInternalCanvasWorkspaceAuthorityRouter } from './internalWorkspaceAuthorityRoutes.js';

const internalToken = 'independent-production-plane-internal-token-for-tests';
const body = {
  objectType: 'CanvasWorkspaceAuthorityRequest',
  contractVersion: '0.1',
  tenantId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  packageId: '33333333-3333-4333-8333-333333333333',
  canvasSessionId: 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678',
  actorId: '12121212-1212-4212-8212-121212121212',
  requestId: 'req-canvas-workspace-authority-001',
  occurredAt: '2026-08-14T02:03:00.000Z',
};
const output = {
  objectType: 'CanvasWorkspaceAuthority',
  contractVersion: '0.1',
  tenantId: body.tenantId,
  projectId: body.projectId,
  packageId: body.packageId,
  canvasSessionId: body.canvasSessionId,
  project: { projectName: '门店探店获客视频' },
  approvedScript: { scriptId: '44444444-4444-4444-8444-444444444444', version: 3 },
  approvedStoryboard: { storyboardId: '55555555-5555-4555-8555-555555555555', version: 2 },
  assets: [],
  completeness: { project: true, approvedScript: true, approvedStoryboard: true, assets: true },
  requestId: body.requestId,
  occurredAt: '2026-08-14T02:03:00.100Z',
};

function harness() {
  const service = { read: vi.fn(async () => output) };
  const app = express();
  app.use(
    '/api/v1/internal',
    createInternalCanvasWorkspaceAuthorityRouter({ internalToken, service }),
  );
  return { app, service };
}

function authorized(input: request.Test) {
  return input
    .set('x-production-plane-internal-token', internalToken)
    .set('x-request-id', body.requestId)
    .set('content-type', 'application/json');
}

describe('server-only Canvas workspace authority route', () => {
  it('authenticates before parsing malformed JSON', async () => {
    const { app, service } = harness();
    const result = await request(app)
      .post('/api/v1/internal/canvas-workspace-authorities')
      .set('content-type', 'application/json')
      .send('{broken');
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe('CANVAS_WORKSPACE_AUTHORITY_INTERNAL_AUTH_INVALID');
    expect(result.headers['cache-control']).toBe('no-store');
    expect(service.read).not.toHaveBeenCalled();
  });

  it('enforces malformed, unknown and oversized request bodies before service reads', async () => {
    const { app, service } = harness();
    const malformed = await authorized(
      request(app).post('/api/v1/internal/canvas-workspace-authorities'),
    ).send('{broken');
    expect(malformed.status).toBe(400);
    const unknown = await authorized(
      request(app).post('/api/v1/internal/canvas-workspace-authorities'),
    ).send(JSON.stringify({ ...body, latest: true }));
    expect(unknown.status).toBe(400);
    const oversized = await authorized(
      request(app).post('/api/v1/internal/canvas-workspace-authorities'),
    ).send(JSON.stringify({ ...body, padding: 'x'.repeat(17 * 1024) }));
    expect(oversized.status).toBe(413);
    expect(service.read).not.toHaveBeenCalled();
  });

  it('returns the strict no-store aggregate and fixed casting errors without partial assets', async () => {
    const h = harness();
    const success = await authorized(
      request(h.app).post('/api/v1/internal/canvas-workspace-authorities'),
    ).send(JSON.stringify(body));
    expect(success.status).toBe(200);
    expect(success.body).toEqual(output);
    expect(success.headers['cache-control']).toBe('no-store');

    h.service.read.mockRejectedValueOnce(
      new CanvasWorkspaceAuthorityError('PRIMARY_VIRTUAL_CHARACTER_MISSING'),
    );
    const blocked = await authorized(
      request(h.app).post('/api/v1/internal/canvas-workspace-authorities'),
    ).send(JSON.stringify(body));
    expect(blocked.status).toBe(409);
    expect(blocked.body).toEqual({
      error: {
        code: 'PRIMARY_VIRTUAL_CHARACTER_MISSING',
        message: expect.any(String),
        retryable: false,
        requestId: body.requestId,
      },
    });
    expect(JSON.stringify(blocked.body)).not.toMatch(/assets|packageSnapshot|digest|storage|provider/i);
  });
});
