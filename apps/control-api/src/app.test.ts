import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';

function testApp(readinessProbe: () => Promise<void>) {
  return createApp({ appVersion: 'test-version', nodeEnv: 'test', readinessProbe });
}

describe('Control API health contract', () => {
  it('reports process liveness without touching dependencies', async () => {
    const readinessProbe = vi.fn(async () => undefined);
    const response = await request(testApp(readinessProbe)).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'control-api',
      version: 'test-version',
    });
    expect(readinessProbe).not.toHaveBeenCalled();
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('reports readiness only when PostgreSQL is available', async () => {
    const response = await request(testApp(async () => undefined)).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready', database: 'available' });
  });

  it('returns 503 without leaking the database error', async () => {
    const response = await request(
      testApp(async () => {
        throw new Error('postgres://user:secret@internal/db');
      }),
    ).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'not_ready', database: 'unavailable' });
    expect(response.text).not.toContain('secret');
  });

  it('uses the standard error envelope for unknown routes', async () => {
    const response = await request(testApp(async () => undefined))
      .get('/missing')
      .set('x-request-id', 'pilot-request-1');

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: 'ROUTE_NOT_FOUND',
      requestId: 'pilot-request-1',
    });
  });

  it('mounts the independent Terms router under /api/v1', async () => {
    const termsRouter = Router();
    termsRouter.get('/public/terms/current', (_request, response) => {
      response.status(200).json({ mounted: true });
    });
    const application = createApp({
      appVersion: 'test-version',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      termsRouter,
    });

    const response = await request(application).get('/api/v1/public/terms/current');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ mounted: true });
  });

  it('mounts the independent Invitation router under /api/v1', async () => {
    const invitationRouter = Router();
    invitationRouter.post('/public/invitations/preview', (_request, response) => {
      response.status(200).json({ mounted: true });
    });
    const application = createApp({
      appVersion: 'test-version',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      invitationRouter,
    });

    const response = await request(application)
      .post('/api/v1/public/invitations/preview')
      .send({ token: 'test' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ mounted: true });
  });
});
