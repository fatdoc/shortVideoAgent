import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PilotControlApiError,
  pilotControlApi,
  type PilotProject,
  type PilotSession,
} from '../services/pilotControlApi';
import { usePilotProjectContextStore } from './pilotProjectContextStore';

const tenantSession: PilotSession = {
  user: { id: 'user-1', email: 'pilot@example.com', displayName: '试点用户' },
  tenant: { id: 'tenant-1', displayName: '试点企业' },
  roles: ['content_operator'],
  activeContext: {
    membershipId: 'membership-1',
    organizationId: 'tenant-1',
    organizationType: 'TENANT',
    organizationDisplayName: '试点企业',
    membershipVersion: 4,
    primaryRole: 'content_operator',
    roles: ['content_operator'],
    tenantId: 'tenant-1',
  },
  expiresAt: '2026-08-08T00:00:00.000Z',
};

const project = (id: string): PilotProject => ({
  id,
  name: `项目 ${id}`,
  status: 'active',
  platform: 'douyin',
  aspectRatio: '9:16',
  targetDurationSeconds: 30,
  createdBy: 'user-1',
  createdAt: '2026-08-07T00:00:00.000Z',
  updatedAt: '2026-08-07T01:00:00.000Z',
});

describe('Pilot Project Context store', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    usePilotProjectContextStore.getState().reset();
  });

  it('loads server-visible projects and selects the first stable project in memory', async () => {
    vi.spyOn(pilotControlApi, 'listProjects').mockResolvedValue([
      project('project-zeta'),
      project('project-alpha'),
    ]);

    await expect(usePilotProjectContextStore.getState().load(tenantSession)).resolves.toEqual({
      status: 'ready',
    });

    expect(usePilotProjectContextStore.getState()).toMatchObject({
      status: 'ready',
      activeProjectId: 'project-alpha',
      context: {
        tenantId: 'tenant-1',
        projectId: 'project-alpha',
        projectName: '项目 project-alpha',
        sessionMembershipId: 'membership-1',
        roleCodes: ['content_operator'],
      },
    });
    expect(window.localStorage.length).toBe(0);
  });

  it('represents an empty Project Scope without a Demo fallback', async () => {
    vi.spyOn(pilotControlApi, 'listProjects').mockResolvedValue([]);

    await usePilotProjectContextStore.getState().load(tenantSession);

    expect(usePilotProjectContextStore.getState()).toMatchObject({
      status: 'empty',
      projects: [],
      activeProjectId: null,
      context: null,
    });
  });

  it('fails closed for non-Tenant sessions without calling the Project API', async () => {
    const list = vi.spyOn(pilotControlApi, 'listProjects');
    const platformSession: PilotSession = {
      ...tenantSession,
      tenant: null,
      roles: ['platform_admin'],
      activeContext: {
        ...tenantSession.activeContext,
        organizationId: 'platform-1',
        organizationType: 'PLATFORM',
        organizationDisplayName: '试点平台',
        primaryRole: 'platform_admin',
        roles: ['platform_admin'],
        tenantId: null,
      },
    };

    await expect(usePilotProjectContextStore.getState().load(platformSession)).resolves.toEqual({
      status: 'tenant_context_required',
    });

    expect(list).not.toHaveBeenCalled();
    expect(usePilotProjectContextStore.getState()).toMatchObject({
      status: 'tenant_context_required',
      projects: [],
      context: null,
    });
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [500, 'service_error'],
  ] as const)('keeps HTTP %i as stable %s state', async (status, expectedStatus) => {
    vi.spyOn(pilotControlApi, 'listProjects').mockRejectedValue(
      new PilotControlApiError('REQUEST_FAILED', '请求失败', status, `req-${status}`),
    );

    await expect(usePilotProjectContextStore.getState().load(tenantSession)).resolves.toEqual({
      status: expectedStatus,
    });

    expect(usePilotProjectContextStore.getState()).toMatchObject({
      status: expectedStatus,
      error: '请求失败',
      requestId: `req-${status}`,
      projects: [],
      context: null,
    });
  });

  it('reconfirms a visible Project with read API before changing context', async () => {
    vi.spyOn(pilotControlApi, 'listProjects').mockResolvedValue([
      project('project-alpha'),
      project('project-beta'),
    ]);
    const read = vi
      .spyOn(pilotControlApi, 'readProject')
      .mockResolvedValue(project('project-beta'));
    await usePilotProjectContextStore.getState().load(tenantSession);

    await expect(
      usePilotProjectContextStore.getState().select(tenantSession, 'project-beta'),
    ).resolves.toEqual({ status: 'ready' });

    expect(read).toHaveBeenCalledWith('project-beta');
    expect(usePilotProjectContextStore.getState()).toMatchObject({
      activeProjectId: 'project-beta',
      context: { projectId: 'project-beta', projectName: '项目 project-beta' },
    });
  });

  it('does not call Project read for an ID outside the server-visible list', async () => {
    vi.spyOn(pilotControlApi, 'listProjects').mockResolvedValue([project('project-alpha')]);
    const read = vi.spyOn(pilotControlApi, 'readProject');
    await usePilotProjectContextStore.getState().load(tenantSession);

    await expect(
      usePilotProjectContextStore.getState().select(tenantSession, 'project-unassigned'),
    ).resolves.toEqual({ status: 'not_found' });

    expect(read).not.toHaveBeenCalled();
    expect(usePilotProjectContextStore.getState()).toMatchObject({
      status: 'not_found',
      activeProjectId: null,
      context: null,
    });
  });
});
