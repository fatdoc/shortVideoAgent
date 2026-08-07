import { beforeEach, describe, expect, it, vi } from 'vitest';
import { demoAuth } from '../services/demoAuth';
import {
  PilotControlApiError,
  pilotControlApi,
  type PilotProject,
  type PilotSession,
} from '../services/pilotControlApi';
import { usePilotAuthStore } from './pilotAuthStore';
import { usePilotProjectContextStore } from './pilotProjectContextStore';

const session: PilotSession = {
  user: { id: 'user-1', email: 'pilot@example.com', displayName: '试点用户' },
  tenant: { id: 'tenant-1', displayName: '试点企业' },
  roles: ['tenant_admin'],
  activeContext: {
    membershipId: 'membership-1',
    organizationId: 'tenant-1',
    organizationType: 'TENANT',
    organizationDisplayName: '试点企业',
    membershipVersion: 3,
    primaryRole: 'tenant_admin',
    roles: ['tenant_admin'],
    tenantId: 'tenant-1',
  },
  expiresAt: '2026-08-08T00:00:00.000Z',
};

const project: PilotProject = {
  id: 'project-1',
  name: '真实项目',
  status: 'active',
  platform: 'douyin',
  aspectRatio: '9:16',
  targetDurationSeconds: 30,
  createdBy: 'user-1',
  createdAt: '2026-08-07T00:00:00.000Z',
  updatedAt: '2026-08-07T01:00:00.000Z',
};

describe('pilot auth store', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    usePilotProjectContextStore.getState().reset();
    usePilotAuthStore.setState({
      status: 'idle',
      session: null,
      error: null,
      requestId: null,
    });
  });

  it('handles login and refresh recovery with server Project Context in memory only', async () => {
    vi.spyOn(pilotControlApi, 'login').mockResolvedValue(session);
    vi.spyOn(pilotControlApi, 'listProjects').mockResolvedValue([project]);
    await expect(
      usePilotAuthStore.getState().login({ email: 'pilot@example.com', password: 'secret' }),
    ).resolves.toEqual(session);
    expect(usePilotAuthStore.getState()).toMatchObject({ status: 'authenticated', session });
    expect(usePilotProjectContextStore.getState()).toMatchObject({
      status: 'ready',
      activeProjectId: 'project-1',
      context: { sessionMembershipId: 'membership-1', tenantId: 'tenant-1' },
    });

    usePilotAuthStore.setState({ status: 'idle', session: null });
    vi.spyOn(pilotControlApi, 'hydrate').mockResolvedValue(session);
    await usePilotAuthStore.getState().hydrate();
    expect(usePilotAuthStore.getState()).toMatchObject({ status: 'authenticated', session });
    expect(window.localStorage.length).toBe(0);
  });

  it('clears a restored Session when Project Scope refresh returns 401', async () => {
    vi.spyOn(pilotControlApi, 'hydrate').mockResolvedValue(session);
    vi.spyOn(pilotControlApi, 'listProjects').mockRejectedValue(
      new PilotControlApiError('AUTHENTICATION_REQUIRED', '请先登录。', 401, 'req-project-401'),
    );

    await expect(usePilotAuthStore.getState().hydrate()).resolves.toBeNull();

    expect(usePilotAuthStore.getState()).toMatchObject({
      status: 'anonymous',
      session: null,
      error: null,
      requestId: null,
    });
    expect(usePilotProjectContextStore.getState().status).toBe('unauthorized');
  });

  it('keeps an authenticated Session while exposing a Project API 5xx separately', async () => {
    vi.spyOn(pilotControlApi, 'login').mockResolvedValue(session);
    vi.spyOn(pilotControlApi, 'listProjects').mockRejectedValue(
      new PilotControlApiError('INTERNAL_ERROR', '项目服务错误', 500, 'req-project-500'),
    );

    await expect(
      usePilotAuthStore.getState().login({ email: 'pilot@example.com', password: 'secret' }),
    ).resolves.toEqual(session);

    expect(usePilotAuthStore.getState()).toMatchObject({ status: 'authenticated', session });
    expect(usePilotProjectContextStore.getState()).toMatchObject({
      status: 'service_error',
      error: '项目服务错误',
      requestId: 'req-project-500',
    });
  });

  it('treats session 401 as anonymous but exposes 5xx session failures', async () => {
    vi.spyOn(pilotControlApi, 'hydrate').mockRejectedValueOnce(
      new PilotControlApiError('AUTHENTICATION_REQUIRED', '请先登录。', 401, 'req-401'),
    );
    await usePilotAuthStore.getState().hydrate();
    expect(usePilotAuthStore.getState()).toMatchObject({ status: 'anonymous', error: null });

    vi.mocked(pilotControlApi.hydrate).mockRejectedValueOnce(
      new PilotControlApiError('INTERNAL_ERROR', '服务错误', 500, 'req-500'),
    );
    await usePilotAuthStore.getState().hydrate();
    expect(usePilotAuthStore.getState()).toMatchObject({
      status: 'service_error',
      error: '服务错误',
      requestId: 'req-500',
    });
  });

  it('never falls back to demo auth when login fails', async () => {
    const demoLogin = vi.spyOn(demoAuth, 'login');
    vi.spyOn(pilotControlApi, 'login').mockRejectedValue(
      new PilotControlApiError('CONTROL_API_UNREACHABLE', '无法连接', null, null),
    );

    await usePilotAuthStore.getState().login({ email: 'pilot@example.com', password: 'secret' });

    expect(demoLogin).not.toHaveBeenCalled();
    expect(usePilotAuthStore.getState()).toMatchObject({
      status: 'anonymous',
      session: null,
      error: '无法连接',
    });
  });

  it('refreshes Assignment scope through the authenticated store action', async () => {
    usePilotAuthStore.setState({ status: 'authenticated', session });
    vi.spyOn(pilotControlApi, 'listProjects').mockResolvedValue([project]);

    await expect(usePilotAuthStore.getState().refreshProjectContext()).resolves.toEqual({
      status: 'ready',
    });
    expect(usePilotProjectContextStore.getState().activeProjectId).toBe('project-1');
  });

  it('calls server revocation before clearing all in-memory context, including failure', async () => {
    usePilotAuthStore.setState({ status: 'authenticated', session });
    usePilotProjectContextStore.setState({
      status: 'ready',
      projects: [project],
      activeProjectId: project.id,
      context: {
        tenantId: 'tenant-1',
        projectId: project.id,
        projectName: project.name,
        sessionMembershipId: 'membership-1',
        roleCodes: ['tenant_admin'],
      },
    });
    const revoke = vi
      .spyOn(pilotControlApi, 'logout')
      .mockRejectedValue(new PilotControlApiError('INTERNAL_ERROR', '撤销失败', 500, 'req-logout'));

    const operation = usePilotAuthStore.getState().logout();
    expect(usePilotAuthStore.getState().session).toEqual(session);
    await operation;

    expect(revoke).toHaveBeenCalledOnce();
    expect(usePilotAuthStore.getState()).toMatchObject({
      status: 'anonymous',
      session: null,
      error: '撤销失败',
      requestId: 'req-logout',
    });
    expect(usePilotProjectContextStore.getState()).toMatchObject({
      status: 'idle',
      projects: [],
      context: null,
    });
  });
});
