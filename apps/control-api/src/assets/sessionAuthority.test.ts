import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createInternalCanvasAssetSessionRouter } from './internalSessionRoutes.js';
import { CanvasAssetSessionAuthorityService } from './sessionService.js';
import type {
  CanvasAssetSessionAuthority,
  CanvasAssetSessionAuthorityStore,
} from './sessionTypes.js';

const scope = {
  handle: `ce_${'A'.repeat(32)}`,
  tenantId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  packageId: '33333333-3333-4333-8333-333333333333',
  canvasSessionId: 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678',
  actorId: '12121212-1212-4212-8212-121212121212',
};
const internalToken = 'production-plane-internal-token-at-least-32-bytes';
const registeredAt = new Date('2026-08-14T02:00:00.000Z');
const expiresAt = new Date('2026-08-14T02:10:00.000Z');

class MemorySessionStore implements CanvasAssetSessionAuthorityStore {
  value: CanvasAssetSessionAuthority | null = null;
  registerCalls = 0;

  async registerSession(input: Parameters<CanvasAssetSessionAuthorityStore['registerSession']>[0]) {
    this.registerCalls += 1;
    if (this.value) {
      const same = Object.entries(input)
        .filter(([key]) => key !== 'registeredAt')
        .every(
        ([key, value]) => this.value?.[key as keyof CanvasAssetSessionAuthority] === value,
      );
      if (!same) return { kind: 'conflict' as const };
      return { kind: 'replayed' as const, value: structuredClone(this.value) };
    }
    this.value = { ...scope, registeredAt: input.registeredAt, expiresAt };
    return { kind: 'created' as const, value: structuredClone(this.value) };
  }

  async readActiveSession(
    input: Parameters<CanvasAssetSessionAuthorityStore['readActiveSession']>[0],
  ) {
    if (!this.value || input.verifiedAt.getTime() >= this.value.expiresAt.getTime()) return null;
    return Object.entries(input)
      .filter(([key]) => key !== 'verifiedAt')
      .every(([key, value]) => this.value?.[key as keyof CanvasAssetSessionAuthority] === value)
      ? structuredClone(this.value)
      : null;
  }
}

describe('Control server-only Canvas asset session authority', () => {
  it('registers exact consumed authority with stable same/same replay and rejects changed scope', async () => {
    const store = new MemorySessionStore();
    const service = new CanvasAssetSessionAuthorityService(store, { now: () => registeredAt });

    await expect(service.registerSession(scope)).resolves.toEqual({
      status: 'active',
      expiresAt: expiresAt.toISOString(),
      replayed: false,
    });
    await expect(service.registerSession(scope)).resolves.toEqual({
      status: 'active',
      expiresAt: expiresAt.toISOString(),
      replayed: true,
    });
    await expect(
      service.registerSession({ ...scope, actorId: '99999999-9999-4999-8999-999999999999' }),
    ).rejects.toMatchObject({ code: 'CANVAS_SESSION_CONFLICT' });
  });

  it('fails closed for a forged package/session/actor before callers can write', async () => {
    const store = new MemorySessionStore();
    const service = new CanvasAssetSessionAuthorityService(store, { now: () => registeredAt });
    await service.registerSession(scope);

    for (const mismatch of [
      { packageId: '99999999-9999-4999-8999-999999999999' },
      { canvasSessionId: 'pcs_ZYXWVUTSRQPONMLKJIHGFEDC87654321' },
      { actorId: '99999999-9999-4999-8999-999999999999' },
    ]) {
      await expect(service.assertActiveSession({ ...scope, ...mismatch })).rejects.toMatchObject({
        code: 'CANVAS_SESSION_INVALID',
      });
    }
  });

  it('exposes a bounded internal-only registrar with constant-token authentication', async () => {
    const service = {
      registerSession: vi.fn(async () => ({
        status: 'active' as const,
        expiresAt: expiresAt.toISOString(),
        replayed: false,
      })),
    };
    const application = express();
    application.use(
      '/api/v1/internal',
      createInternalCanvasAssetSessionRouter({ internalToken, service }),
    );

    const unauthorized = await request(application)
      .post('/api/v1/internal/canvas-asset-sessions')
      .send(scope);
    expect(unauthorized.status).toBe(401);
    expect(service.registerSession).not.toHaveBeenCalled();

    const response = await request(application)
      .post('/api/v1/internal/canvas-asset-sessions')
      .set('x-production-plane-internal-token', internalToken)
      .set('x-request-id', 'register-request-1')
      .send(scope);
    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-request-id']).toBe('register-request-1');
    expect(response.body).toEqual({
      status: 'active',
      expiresAt: expiresAt.toISOString(),
      replayed: false,
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /handle|tenant|project|package|session|actor|grant|token|digest|snapshot/i,
    );

    const sentinel = 'RAW_HANDLE_GRANT_TOKEN_DIGEST_PACKAGE_SNAPSHOT';
    const malformed = await request(application)
      .post('/api/v1/internal/canvas-asset-sessions')
      .set('content-type', 'application/json')
      .set('x-production-plane-internal-token', internalToken)
      .send(`{"handle":"${sentinel}"`);
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('CANVAS_SESSION_REQUEST_INVALID');
    expect(JSON.stringify(malformed.body)).not.toContain(sentinel);

    const oversized = await request(application)
      .post('/api/v1/internal/canvas-asset-sessions')
      .set('x-production-plane-internal-token', internalToken)
      .send({ ...scope, unexpected: sentinel.repeat(2_000) });
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe('CANVAS_SESSION_REQUEST_TOO_LARGE');
    expect(JSON.stringify(oversized.body)).not.toContain(sentinel);
  });
});
