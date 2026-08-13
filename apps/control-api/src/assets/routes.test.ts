import { createHmac } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { PublicSession } from '../auth/service.js';
import { createCanvasAssetRouter } from './routes.js';

const projectId = '22222222-2222-4222-8222-222222222222';
const packageId = '33333333-3333-4333-8333-333333333333';
const assetId = '88888888-8888-4888-8888-888888888888';
const actorId = '12121212-1212-4212-8212-121212121212';
const sessionToken = 'browser-session-token';
const csrfSecret = 'csrf-secret-with-at-least-thirty-two-bytes';
const origin = 'https://app.videoagent.test';
const canvasSessionId = 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678';

const session: PublicSession = {
  user: { id: actorId, email: 'actor@example.test', displayName: 'Actor' },
  tenant: { id: '11111111-1111-4111-8111-111111111111', displayName: 'Tenant' },
  roles: ['tenant_admin'],
  activeContext: {
    membershipId: '13131313-1313-4313-8313-131313131313',
    organizationId: '14141414-1414-4414-8414-141414141414',
    organizationType: 'TENANT',
    organizationDisplayName: 'Tenant',
    membershipVersion: 1,
    primaryRole: 'tenant_admin',
    roles: ['tenant_admin'],
    tenantId: '11111111-1111-4111-8111-111111111111',
  },
  expiresAt: '2026-08-14T04:00:00.000Z',
};

function csrfToken() {
  return createHmac('sha256', csrfSecret).update(sessionToken).digest('base64url');
}

function createBody() {
  return {
    packageId,
    canvasSessionId,
    category: 'image',
    displayName: '门店外景',
    provenance: { kind: 'customer_upload', sourceAssetId: null },
    rights: {
      status: 'pending',
      basis: 'customer_owned',
      validFrom: null,
      validUntil: null,
    },
    storageReference: 'tenant-assets/store-front.png',
    checksum: `sha256:${'a'.repeat(64)}`,
    reuseScope: 'project',
    controlledPreviewUrl: `/api/canvas-v1/assets/${assetId}/preview`,
  };
}

function safeAsset() {
  return {
    objectType: 'AssetRecord',
    contractVersion: '0.1',
    tenantId: session.tenant!.id,
    projectId,
    packageId,
    canvasSessionId,
    assetId,
    category: 'image',
    displayName: '门店外景',
    provenance: {
      kind: 'customer_upload',
      sourceAssetId: null,
      declaredByActorId: actorId,
      declaredAt: '2026-08-14T02:00:00.000Z',
    },
    rights: {
      status: 'pending',
      basis: 'customer_owned',
      validFrom: null,
      validUntil: null,
      reviewedAt: null,
    },
    approval: { status: 'pending', reviewedByActorId: null, reviewedAt: null },
    controlledPreviewUrl: `/api/canvas-v1/assets/${assetId}/preview`,
    createdAt: '2026-08-14T02:00:00.000Z',
    updatedAt: '2026-08-14T02:00:00.000Z',
    occurredAt: '2026-08-14T02:00:00.000Z',
  };
}

function harness(
  options: { resolve?: boolean; projectAccess?: 'viewer' | 'editor' | 'manager' | null } = {},
) {
  const service = {
    createAsset: vi.fn(async () => safeAsset()),
    listAssets: vi.fn(async () => []),
    getAsset: vi.fn(async () => safeAsset()),
    transitionRights: vi.fn(async () => safeAsset()),
    transitionApproval: vi.fn(async () => safeAsset()),
    createHighCostApproval: vi.fn(async () => ({
      approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      status: 'active',
    })),
    readHighCostApproval: vi.fn(async () => ({
      approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      status: 'active',
    })),
  };
  const router = createCanvasAssetRouter({
    service,
    policy: {
      canCreateProject: async () => true,
      listVisibleProjectIds: async () => null,
      resolveProjectAccess: async () =>
        options.projectAccess === undefined ? 'manager' : options.projectAccess,
    },
    resolveSession: async () => (options.resolve === false ? null : { session }),
    secureCookies: true,
    sessionTtlSeconds: 3600,
    allowedOrigins: [origin],
    csrfSecret,
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1', router);
  return { app, service };
}

function authenticated(input: request.Test) {
  return input.set('Cookie', `videoagent_session=${sessionToken}`);
}

function unsafe(input: request.Test) {
  return authenticated(input).set('Origin', origin).set('x-csrf-token', csrfToken());
}

describe('Canvas Asset browser route gates', () => {
  it('requires an active Tenant session before project policy or service access', async () => {
    const { app, service } = harness();
    const missing = await request(app).get(`/api/v1/projects/${projectId}/canvas-assets`);
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(service.listAssets).not.toHaveBeenCalled();

    const invalidHarness = harness({ resolve: false });
    const invalid = await authenticated(
      request(invalidHarness.app).get(`/api/v1/projects/${projectId}/canvas-assets`),
    );
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.code).toBe('SESSION_INVALID');
  });

  it('issues an origin-bound CSRF token on safe reads and requires it on every mutation', async () => {
    const { app, service } = harness();
    const safe = await authenticated(
      request(app).get(`/api/v1/projects/${projectId}/canvas-assets`),
    );
    expect(safe.status).toBe(200);
    expect(safe.headers['x-csrf-token']).toBe(csrfToken());
    expect(safe.headers['cache-control']).toBe('no-store');

    const missing = await authenticated(
      request(app).post(`/api/v1/projects/${projectId}/canvas-assets`).send(createBody()),
    );
    expect(missing.status).toBe(403);
    expect(missing.body.error.code).toBe('CSRF_ORIGIN_INVALID');
    expect(service.createAsset).not.toHaveBeenCalled();

    const wrongOrigin = await authenticated(
      request(app)
        .post(`/api/v1/projects/${projectId}/canvas-assets`)
        .set('Origin', 'https://evil.example')
        .set('x-csrf-token', csrfToken())
        .send(createBody()),
    );
    expect(wrongOrigin.status).toBe(403);
    expect(wrongOrigin.body.error.code).toBe('CSRF_ORIGIN_INVALID');

    const wrongToken = await authenticated(
      request(app)
        .post(`/api/v1/projects/${projectId}/canvas-assets`)
        .set('Origin', origin)
        .set('x-csrf-token', 'wrong')
        .send(createBody()),
    );
    expect(wrongToken.status).toBe(403);
    expect(wrongToken.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('returns project-scoped 404 before invoking asset authority', async () => {
    const { app, service } = harness({ projectAccess: null });
    const response = await authenticated(
      request(app).get(`/api/v1/projects/${projectId}/canvas-assets/${assetId}`),
    );
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('CANVAS_ASSET_NOT_FOUND');
    expect(service.getAsset).not.toHaveBeenCalled();
  });

  it('rejects unknown and forbidden browser fields before service execution', async () => {
    const { app, service } = harness();
    const unknown = await unsafe(
      request(app)
        .post(`/api/v1/projects/${projectId}/canvas-assets`)
        .send({ ...createBody(), unexpected: true }),
    );
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe('CANVAS_SCHEMA_INVALID');
    const forbidden = await unsafe(
      request(app)
        .post(`/api/v1/projects/${projectId}/canvas-assets`)
        .send({ ...createBody(), providerAssetId: 'provider-secret' }),
    );
    expect(forbidden.status).toBe(400);
    expect(forbidden.body.error.code).toBe('CANVAS_BROWSER_PROJECTION_UNSAFE');
    expect(service.createAsset).not.toHaveBeenCalled();
  });

  it('allows a project writer through the exact session/origin/CSRF gate', async () => {
    const { app, service } = harness({ projectAccess: 'editor' });
    const response = await unsafe(
      request(app).post(`/api/v1/projects/${projectId}/canvas-assets`).send(createBody()),
    );
    expect(response.status).toBe(201);
    expect(service.createAsset).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(response.body)).not.toMatch(
      /storageReference|checksum|providerAssetId|asset:\/\//i,
    );
  });

  it('returns only approvalId/status when authenticated actor confirms a high-cost action', async () => {
    const { app, service } = harness({ projectAccess: 'editor' });
    const response = await unsafe(
      request(app)
        .post(`/api/v1/projects/${projectId}/canvas-command-approvals`)
        .send({
          packageId,
          canvasSessionId,
          commandType: 'GENERATE_SHOT',
          action: {
            shotId: '66666666-6666-4666-8666-666666666666',
            readinessId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          },
          expiresInSeconds: 120,
          replayPolicy: 'single_use_replay_same_command',
        }),
    );
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      status: 'active',
    });
    expect(service.createHighCostApproval).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(response.body)).not.toMatch(
      /actor|tenant|project|package|session|command|fingerprint|confirmed|expires|replay/i,
    );
  });
});
