import { createHmac } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import type { PublicSession } from '../../../apps/control-api/src/auth/service.js';
import { createCanvasAssetRouter } from '../../../apps/control-api/src/assets/routes.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const packageId = '33333333-3333-4333-8333-333333333333';
const actorId = '12121212-1212-4212-8212-121212121212';
const commandId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const canvasSessionId = 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678';
const sessionToken = 'browser-session-token';
const csrfSecret = 'csrf-secret-with-at-least-thirty-two-bytes';
const origin = 'https://app.videoagent.test';

const session: PublicSession = {
  user: { id: actorId, email: 'actor@example.test', displayName: 'Actor' },
  tenant: { id: tenantId, displayName: 'Tenant' },
  roles: ['tenant_admin'],
  activeContext: {
    membershipId: '13131313-1313-4313-8313-131313131313',
    organizationId: '14141414-1414-4414-8414-141414141414',
    organizationType: 'TENANT',
    organizationDisplayName: 'Tenant',
    membershipVersion: 1,
    primaryRole: 'tenant_admin',
    roles: ['tenant_admin'],
    tenantId,
  },
  expiresAt: '2099-08-14T04:00:00.000Z',
};

function exactBody(expiresInSeconds = 60) {
  return {
    packageId,
    canvasSessionId,
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
    expiresInSeconds,
    replayPolicy: 'single_use_replay_same_command',
  } as const;
}

function harness() {
  const createHighCostApproval = vi.fn(async () => ({
    approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    status: 'active',
  }));
  const inert = vi.fn(async () => null as never);
  const router = createCanvasAssetRouter({
    service: {
      createAsset: inert,
      listAssets: vi.fn(async () => []),
      getAsset: inert,
      transitionRights: inert,
      transitionApproval: inert,
      createHighCostApproval,
      readHighCostApproval: inert,
    },
    policy: {
      canCreateProject: async () => true,
      listVisibleProjectIds: async () => null,
      resolveProjectAccess: async () => 'manager',
    },
    resolveSession: async () => ({ session }),
    secureCookies: true,
    sessionTtlSeconds: 3600,
    allowedOrigins: [origin],
    csrfSecret,
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1', router);
  return { app, createHighCostApproval };
}

function post(app: express.Express, body: unknown) {
  const csrf = createHmac('sha256', csrfSecret).update(sessionToken).digest('base64url');
  return request(app)
    .post(`/api/v1/projects/${projectId}/canvas-command-approvals`)
    .set('Cookie', `videoagent_session=${sessionToken}`)
    .set('Origin', origin)
    .set('x-csrf-token', csrf)
    .send(body);
}

describe('CV6 independent browser approval-prepare contract', () => {
  it('accepts literal transport TTL=60 with exact action={commandId,payload}', async () => {
    const { app, createHighCostApproval } = harness();
    const response = await post(app, exactBody());
    expect(response.status).toBe(201);
    expect(createHighCostApproval).toHaveBeenCalledWith(
      expect.objectContaining({ userId: actorId, tenantId }),
      projectId,
      exactBody(),
    );
    expect(response.body).toEqual({
      approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      status: 'active',
    });
  });

  it.each([30, 59, 61, 120, 300])(
    'rejects browser-selected approval TTL %i rather than extending the fixed lifetime',
    async (ttl) => {
      const { app, createHighCostApproval } = harness();
      const response = await post(app, exactBody(ttl));
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('CANVAS_SCHEMA_INVALID');
      expect(createHighCostApproval).not.toHaveBeenCalled();
    },
  );

  it('rejects legacy generic action before minting an approval', async () => {
    const { app, createHighCostApproval } = harness();
    const response = await post(app, {
      ...exactBody(),
      action: {
        shotId: '66666666-6666-4666-8666-666666666666',
        allowAny: true,
      },
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CANVAS_SCHEMA_INVALID');
    expect(createHighCostApproval).not.toHaveBeenCalled();
  });
});
