import { beforeEach, describe, expect, it, vi } from 'vitest';
import { demoAuth } from '../services/demoAuth';
import {
  PilotControlApiError,
  pilotControlApi,
  type PilotSession,
} from '../services/pilotControlApi';
import { usePilotAuthStore } from './pilotAuthStore';

const session: PilotSession = {
  user: { id: 'user-1', email: 'pilot@example.com', displayName: '试点用户' },
  tenant: { id: 'tenant-1', displayName: '试点企业' },
  roles: ['tenant_admin'],
  expiresAt: '2026-08-06T00:00:00.000Z',
};

describe('pilot auth store', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    usePilotAuthStore.setState({
      status: 'idle',
      session: null,
      error: null,
      requestId: null,
    });
  });

  it('handles login and refresh recovery in memory only', async () => {
    vi.spyOn(pilotControlApi, 'login').mockResolvedValue(session);
    await expect(
      usePilotAuthStore.getState().login({ email: 'pilot@example.com', password: 'secret' }),
    ).resolves.toEqual(session);
    expect(usePilotAuthStore.getState()).toMatchObject({ status: 'authenticated', session });

    usePilotAuthStore.setState({ status: 'idle', session: null });
    vi.spyOn(pilotControlApi, 'hydrate').mockResolvedValue(session);
    await usePilotAuthStore.getState().hydrate();
    expect(usePilotAuthStore.getState()).toMatchObject({ status: 'authenticated', session });
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

  it('calls server revocation before clearing memory, including failure', async () => {
    usePilotAuthStore.setState({ status: 'authenticated', session });
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
  });
});
