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

  it('mounts the independent Payment router under /api/v1', async () => {
    const paymentRouter = Router();
    paymentRouter.get('/platform/payment-events', (_request, response) => {
      response.status(200).json({ mounted: true });
    });
    const application = createApp({
      appVersion: 'test-version',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      paymentRouter,
    });

    const response = await request(application).get('/api/v1/platform/payment-events');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ mounted: true });
  });

  it('mounts the independent Commercial Channel router under /api/v1', async () => {
    const commercialChannelRouter = Router();
    commercialChannelRouter.get('/channels/current', (_request, response) => {
      response.status(200).json({ mounted: true });
    });
    const application = createApp({
      appVersion: 'test-version',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      commercialChannelRouter,
    });

    const response = await request(application).get('/api/v1/channels/current');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ mounted: true });
  });

  it('mounts the independent Commission audit router under /api/v1', async () => {
    const commissionAuditRouter = Router();
    commissionAuditRouter.get('/platform/commission-audit/calculations', (_request, response) => {
      response.status(200).json({ mounted: true });
    });
    const application = createApp({
      appVersion: 'test-version',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      commissionAuditRouter,
    });

    const response = await request(application).get(
      '/api/v1/platform/commission-audit/calculations',
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ mounted: true });
  });

  it('mounts the independent Commission Settlement router under /api/v1', async () => {
    const commissionSettlementRouter = Router();
    commissionSettlementRouter.post('/platform/commission-settlements', (_request, response) => {
      response.status(201).json({ mounted: true });
    });
    const application = createApp({
      appVersion: 'test-version',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      commissionSettlementRouter,
    });

    const response = await request(application)
      .post('/api/v1/platform/commission-settlements')
      .send({ paymentMode: 'TEST' });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ mounted: true });
  });

  it('mounts the independent Member Directory router under /api/v1', async () => {
    const memberDirectoryRouter = Router();
    memberDirectoryRouter.get('/organizations/current/members', (_request, response) => {
      response.status(200).json({ mounted: true });
    });
    const application = createApp({
      appVersion: 'test-version',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      memberDirectoryRouter,
    });

    const response = await request(application).get('/api/v1/organizations/current/members');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ mounted: true });
  });

  it('mounts the independent Registration router under /api/v1', async () => {
    const registrationRouter = Router();
    registrationRouter.post('/public/registrations', (_request, response) => {
      response.status(201).json({ mounted: true });
    });
    const application = createApp({
      appVersion: 'test-version',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      registrationRouter,
    });

    const response = await request(application)
      .post('/api/v1/public/registrations')
      .send({ test: true });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ mounted: true });
  });

  it('mounts the independent Storyboard Authority router under /api/v1', async () => {
    const storyboardRouter = Router();
    storyboardRouter.get('/projects/:projectId/storyboard-versions', (_request, response) => {
      response.status(200).json({ mounted: true });
    });
    const application = createApp({
      appVersion: 'test-version',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      storyboardRouter,
    });

    const response = await request(application).get(
      '/api/v1/projects/00000000-0000-4000-8000-000000000001/storyboard-versions',
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ mounted: true });
  });

  it('mounts the independent Canvas Entry router under /api/v1', async () => {
    const canvasEntryRouter = Router();
    canvasEntryRouter.get('/projects/:projectId/canvas-entries/:handle', (_request, response) => {
      response.status(200).json({ mounted: true });
    });
    const application = createApp({
      appVersion: 'test-version',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      canvasEntryRouter,
    });

    const response = await request(application).get(
      '/api/v1/projects/00000000-0000-4000-8000-000000000001/canvas-entries/ce_test',
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ mounted: true });
  });

  it('fails closed when Storyboard and Canvas Entry routers are not registered', async () => {
    const application = testApp(async () => undefined);
    const [storyboardResponse, canvasEntryResponse] = await Promise.all([
      request(application)
        .get('/api/v1/projects/00000000-0000-4000-8000-000000000001/storyboard-versions')
        .set('x-request-id', 'storyboard-not-registered'),
      request(application)
        .get('/api/v1/projects/00000000-0000-4000-8000-000000000001/canvas-entries/ce_missing')
        .set('x-request-id', 'canvas-not-registered'),
    ]);

    expect(storyboardResponse.status).toBe(404);
    expect(storyboardResponse.body.error).toMatchObject({
      code: 'ROUTE_NOT_FOUND',
      requestId: 'storyboard-not-registered',
    });
    expect(canvasEntryResponse.status).toBe(404);
    expect(canvasEntryResponse.body.error).toMatchObject({
      code: 'ROUTE_NOT_FOUND',
      requestId: 'canvas-not-registered',
    });
  });
});
