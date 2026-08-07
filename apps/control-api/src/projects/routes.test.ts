import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { PublicSession } from '../auth/service.js';
import type { ProjectAccess, ProjectPolicy } from './policy.js';
import { createContentRouter } from './routes.js';
import type { ContentStore } from './types.js';

const tenantId = '10000000-0000-4000-8000-000000000001';
const userId = '10000000-0000-4000-8000-000000000002';
const membershipId = '10000000-0000-4000-8000-000000000003';
const projectId = '10000000-0000-4000-8000-000000000004';

function store(): ContentStore {
  return {
    createProject: vi.fn(),
    listProjects: vi.fn(async () => []),
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

function policy(access: ProjectAccess | null): ProjectPolicy {
  return {
    canCreateProject: vi.fn(async () => access === 'manager'),
    listVisibleProjectIds: vi.fn(async () => (access === 'manager' ? null : [projectId])),
    resolveProjectAccess: vi.fn(async () => access),
  };
}

function tenantSession(role: 'tenant_admin' | 'content_operator'): PublicSession {
  return {
    user: { id: userId, email: 'user@example.com', displayName: 'User' },
    tenant: { id: tenantId, displayName: 'Tenant' },
    roles: [role],
    activeContext: {
      membershipId,
      organizationId: tenantId,
      organizationType: 'TENANT',
      organizationDisplayName: 'Tenant',
      membershipVersion: 3,
      primaryRole: role,
      roles: [role],
      tenantId,
    },
    expiresAt: '2026-08-08T00:00:00.000Z',
  };
}

function app(contentStore: ContentStore, projectPolicy: ProjectPolicy) {
  const contentRouter = createContentRouter({
    store: contentStore,
    policy: projectPolicy,
    resolveSession: async (token) => {
      if (token === 'admin-session') return { session: tenantSession('tenant_admin') };
      if (token === 'operator-session') return { session: tenantSession('content_operator') };
      if (token === 'platform-session') {
        return {
          session: {
            user: {
              id: userId,
              email: 'platform@example.com',
              displayName: 'Platform Admin',
            },
            tenant: null,
            roles: ['platform_admin'],
            activeContext: {
              membershipId,
              organizationId: tenantId,
              organizationType: 'PLATFORM',
              organizationDisplayName: 'Pilot Platform',
              membershipVersion: 1,
              primaryRole: 'platform_admin',
              roles: ['platform_admin'],
              tenantId: null,
            },
            expiresAt: '2026-08-08T00:00:00.000Z',
          },
        };
      }
      return null;
    },
    secureCookies: false,
    sessionTtlSeconds: 28_800,
  });
  return createApp({
    appVersion: 'test',
    nodeEnv: 'test',
    readinessProbe: async () => undefined,
    contentRouter,
  });
}

describe('project HTTP context and policy boundary', () => {
  it('rejects a PLATFORM context before invoking Policy or Tenant content store', async () => {
    const contentStore = store();
    const projectPolicy = policy('manager');
    const response = await request(app(contentStore, projectPolicy))
      .get('/api/v1/projects')
      .set('cookie', 'videoagent_session=platform-session');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('TENANT_CONTEXT_REQUIRED');
    expect(projectPolicy.listVisibleProjectIds).not.toHaveBeenCalled();
    expect(contentStore.listProjects).not.toHaveBeenCalled();
  });

  it('passes the complete verified Membership Context and visible ids to the store', async () => {
    const contentStore = store();
    const projectPolicy = policy('editor');
    const response = await request(app(contentStore, projectPolicy))
      .get('/api/v1/projects')
      .set('cookie', 'videoagent_session=operator-session');

    expect(response.status).toBe(200);
    expect(contentStore.listProjects).toHaveBeenCalledWith(
      {
        userId,
        membershipId,
        organizationId: tenantId,
        organizationType: 'TENANT',
        tenantId,
        membershipVersion: 3,
        primaryRole: 'content_operator',
        roles: ['content_operator'],
      },
      [projectId],
    );
  });

  it('returns 404 and skips the domain store for an unassigned project', async () => {
    const contentStore = store();
    const response = await request(app(contentStore, policy(null)))
      .get(`/api/v1/projects/${projectId}`)
      .set('cookie', 'videoagent_session=operator-session');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PROJECT_NOT_FOUND');
    expect(contentStore.getProject).not.toHaveBeenCalled();
  });

  it('returns 403 and skips writes when a viewer can see but cannot edit a project', async () => {
    const contentStore = store();
    const response = await request(app(contentStore, policy('viewer')))
      .post(`/api/v1/projects/${projectId}/brief-versions`)
      .set('cookie', 'videoagent_session=operator-session')
      .set('idempotency-key', 'viewer-write-1')
      .send({ payload: { title: 'Denied' } });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PERMISSION_DENIED');
    expect(contentStore.createBriefVersion).not.toHaveBeenCalled();
  });

  it('does not let an editor create or manage Project metadata', async () => {
    const contentStore = store();
    const projectPolicy = policy('editor');
    const createResponse = await request(app(contentStore, projectPolicy))
      .post('/api/v1/projects')
      .set('cookie', 'videoagent_session=operator-session')
      .set('idempotency-key', 'operator-project-1')
      .send({
        name: 'Denied Project',
        status: 'draft',
        platform: 'douyin',
        aspectRatio: '9:16',
        targetDurationSeconds: 30,
      });
    const updateResponse = await request(app(contentStore, projectPolicy))
      .patch(`/api/v1/projects/${projectId}`)
      .set('cookie', 'videoagent_session=operator-session')
      .set('idempotency-key', 'operator-project-2')
      .send({ name: 'Denied Rename' });

    expect(createResponse.status).toBe(403);
    expect(createResponse.body.error.code).toBe('PERMISSION_DENIED');
    expect(updateResponse.status).toBe(403);
    expect(updateResponse.body.error.code).toBe('PERMISSION_DENIED');
    expect(contentStore.createProject).not.toHaveBeenCalled();
    expect(contentStore.updateProject).not.toHaveBeenCalled();
  });
});
