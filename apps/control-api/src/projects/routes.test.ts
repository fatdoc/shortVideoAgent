import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { createContentRouter } from './routes.js';
import type { ContentStore } from './types.js';

function store(): ContentStore {
  return {
    createProject: vi.fn(),
    listProjects: vi.fn(),
    getProject: vi.fn(),
    updateProject: vi.fn(),
    createBriefVersion: vi.fn(),
    listBriefVersions: vi.fn(),
    createScriptVersion: vi.fn(),
    listScriptVersions: vi.fn(),
    createApproval: vi.fn(),
    getProductionEligibility: vi.fn(),
  };
}

describe('project HTTP context boundary', () => {
  it('rejects a PLATFORM context before invoking the Tenant content store', async () => {
    const contentStore = store();
    const contentRouter = createContentRouter({
      store: contentStore,
      resolveSession: async (token) =>
        token === 'platform-session'
          ? {
              session: {
                user: {
                  id: '10000000-0000-4000-8000-000000000001',
                  email: 'platform@example.com',
                  displayName: 'Platform Admin',
                },
                tenant: null,
                roles: ['platform_admin'],
                activeContext: {
                  membershipId: '10000000-0000-4000-8000-000000000002',
                  organizationId: '10000000-0000-4000-8000-000000000003',
                  organizationType: 'PLATFORM',
                  organizationDisplayName: 'Pilot Platform',
                  membershipVersion: 1,
                  primaryRole: 'platform_admin',
                  roles: ['platform_admin'],
                  tenantId: null,
                },
                expiresAt: '2026-08-08T00:00:00.000Z',
              },
            }
          : null,
      secureCookies: false,
      sessionTtlSeconds: 28_800,
    });
    const app = createApp({
      appVersion: 'test',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      contentRouter,
    });

    const response = await request(app)
      .get('/api/v1/projects')
      .set('cookie', 'videoagent_session=platform-session');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('TENANT_CONTEXT_REQUIRED');
    expect(contentStore.listProjects).not.toHaveBeenCalled();
  });
});
