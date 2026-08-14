import { createHash } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createInternalCanvasAssetMaterializationRouter } from './internalMaterializationRoutes.js';

const internalToken = 'independent-production-plane-internal-token-for-tests';
const jpeg = Buffer.from([0xff, 0xd8, 0xff]);

function body() {
  return {
    objectType: 'CanvasAssetMaterializationRequest',
    contractVersion: '0.1',
    tenantId: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222',
    packageId: '33333333-3333-4333-8333-333333333333',
    canvasSessionId: 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678',
    assetId: '88888888-8888-4888-8888-888888888888',
    actorId: '12121212-1212-4212-8212-121212121212',
    materializationAttemptId: '90909090-9090-4090-8090-909090909090',
    requestId: 'req-materialization-001',
    occurredAt: '2026-08-14T02:00:00.000Z',
  };
}

function responseForBytes(bytes = jpeg) {
  return {
    objectType: 'CanvasAssetMaterialization',
    contractVersion: '0.1',
    tenantId: body().tenantId,
    projectId: body().projectId,
    packageId: body().packageId,
    canvasSessionId: body().canvasSessionId,
    assetId: body().assetId,
    materializationAttemptId: body().materializationAttemptId,
    materializationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    category: 'virtual_character',
    mimeType: 'image/jpeg',
    byteSize: bytes.length,
    checksum: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    contentEncoding: 'base64',
    contentBase64: bytes.toString('base64'),
    replayed: false,
    requestId: body().requestId,
    occurredAt: body().occurredAt,
  };
}

const response = () => responseForBytes();

function harness(output = response()) {
  const service = { materialize: vi.fn(async () => output) };
  const router = createInternalCanvasAssetMaterializationRouter({ internalToken, service });
  const app = express();
  app.use('/api/v1/internal', router);
  return { app, service };
}

function authorized(input: request.Test) {
  return input
    .set('x-production-plane-internal-token', internalToken)
    .set('x-request-id', body().requestId)
    .set('content-type', 'application/json');
}

describe('server-only Canvas asset materialization route', () => {
  it('authenticates in constant time before JSON parsing', async () => {
    const { app, service } = harness();
    const result = await request(app)
      .post('/api/v1/internal/canvas-assets/materializations')
      .set('content-type', 'application/json')
      .send('{broken');
    expect(result.status).toBe(401);
    expect(result.body).toEqual({
      error: {
        code: 'CANVAS_MATERIALIZATION_INTERNAL_AUTH_INVALID',
        message: 'Canvas materialization internal authentication is invalid.',
        retryable: false,
        requestId: expect.any(String),
      },
    });
    expect(result.headers['cache-control']).toBe('no-store');
    expect(service.materialize).not.toHaveBeenCalled();
  });

  it('enforces malformed JSON, strict body and 16 KiB limits with fixed errors', async () => {
    const { app, service } = harness();
    const malformed = await authorized(
      request(app).post('/api/v1/internal/canvas-assets/materializations'),
    ).send('{broken');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('CANVAS_MATERIALIZATION_REQUEST_INVALID');

    const unknown = await authorized(
      request(app).post('/api/v1/internal/canvas-assets/materializations'),
    ).send(JSON.stringify({ ...body(), storageReference: 'private/secret.jpg' }));
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe('CANVAS_MATERIALIZATION_REQUEST_INVALID');

    const oversized = await authorized(
      request(app).post('/api/v1/internal/canvas-assets/materializations'),
    ).send(JSON.stringify({ ...body(), padding: 'x'.repeat(17 * 1024) }));
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe('CANVAS_MATERIALIZATION_REQUEST_TOO_LARGE');
    expect(service.materialize).not.toHaveBeenCalled();
    expect(JSON.stringify([malformed.body, unknown.body, oversized.body])).not.toMatch(
      /storageReference|private\/secret|internal-token|broken/i,
    );
  });

  it('returns only the strict server response and no-store', async () => {
    const { app, service } = harness();
    const result = await authorized(
      request(app).post('/api/v1/internal/canvas-assets/materializations'),
    ).send(JSON.stringify(body()));
    expect(result.status).toBe(201);
    expect(result.body).toEqual(response());
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.headers).not.toHaveProperty('idempotency-replayed');
    expect(service.materialize).toHaveBeenCalledWith(body());
  });

  it('returns an exact 8 MiB JPEG without parser failure', async () => {
    const exactLimit = Buffer.alloc(8 * 1024 * 1024);
    exactLimit.set(jpeg);
    const output = responseForBytes(exactLimit);
    const { app } = harness(output);
    const result = await authorized(
      request(app).post('/api/v1/internal/canvas-assets/materializations'),
    ).send(JSON.stringify(body()));
    expect(result.status).toBe(201);
    expect(result.body.byteSize).toBe(exactLimit.length);
    expect(result.body.checksum).toBe(output.checksum);
    expect(result.body.contentBase64.length).toBe(11_184_812);
  });
});
