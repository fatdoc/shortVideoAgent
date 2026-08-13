import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

describe('Control API Canvas Asset router registration', () => {
  it('mounts the optional authority router only under /api/v1', async () => {
    const assetRouter = Router();
    assetRouter.get('/projects/:projectId/canvas-assets', (_request, response) => {
      response.status(200).json({ mounted: true });
    });
    const app = createApp({
      appVersion: 'test-version',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      assetRouter,
    });
    const path = '/projects/22222222-2222-4222-8222-222222222222/canvas-assets';
    await expect(request(app).get(`/api/v1${path}`)).resolves.toMatchObject({
      status: 200,
      body: { mounted: true },
    });
    const unversioned = await request(app).get(path);
    expect(unversioned.status).toBe(404);
    expect(unversioned.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('mounts the session registrar only under the internal boundary', async () => {
    const internalCanvasAssetSessionRouter = Router();
    internalCanvasAssetSessionRouter.post('/canvas-asset-sessions', (_request, response) => {
      response.status(201).json({ mounted: true });
    });
    const app = createApp({
      appVersion: 'test-version',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      internalCanvasAssetSessionRouter,
    });
    await expect(
      request(app).post('/api/v1/internal/canvas-asset-sessions').send({}),
    ).resolves.toMatchObject({ status: 201, body: { mounted: true } });
    await expect(request(app).post('/api/v1/canvas-asset-sessions').send({})).resolves.toMatchObject({
      status: 404,
      body: { error: { code: 'ROUTE_NOT_FOUND' } },
    });
  });

  it('mounts asset materialization only under the internal boundary', async () => {
    const internalCanvasAssetMaterializationRouter = Router();
    internalCanvasAssetMaterializationRouter.post(
      '/canvas-assets/materializations',
      (_request, response) => response.status(201).json({ mounted: true }),
    );
    const app = createApp({
      appVersion: 'test-version',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      internalCanvasAssetMaterializationRouter,
    });
    await expect(
      request(app).post('/api/v1/internal/canvas-assets/materializations').send({}),
    ).resolves.toMatchObject({ status: 201, body: { mounted: true } });
    await expect(
      request(app).post('/api/v1/canvas-assets/materializations').send({}),
    ).resolves.toMatchObject({ status: 404, body: { error: { code: 'ROUTE_NOT_FOUND' } } });
  });
});
