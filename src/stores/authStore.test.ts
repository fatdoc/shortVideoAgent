import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DemoSession } from '../domain/demoIdentity';
import {
  DEMO_AUTH_PASSWORD,
  DEMO_AUTH_STORAGE_KEY,
} from '../services/demoAuth';
import { useAuthStore } from './authStore';

function resetAuthStore(): void {
  useAuthStore.setState({
    status: 'idle',
    identity: null,
    currentIdentity: null,
    activeOrganization: null,
    activeMembership: null,
    allowedWorkbenches: [],
    defaultRoute: null,
    error: null,
    isAuthenticated: false,
  });
}

describe('authStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetAuthStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('projects the logged-in identity into the active auth state', () => {
    const identity = useAuthStore.getState().login({
      loginName: 'channel',
      password: DEMO_AUTH_PASSWORD,
    });
    const state = useAuthStore.getState();

    expect(identity?.accountId).toBe('demo-account-channel');
    expect(state.status).toBe('authenticated');
    expect(state.currentIdentity).toBe(identity);
    expect(state.activeOrganization?.organizationId).toBe(
      'channel-demo-level-1',
    );
    expect(state.allowedWorkbenches).toEqual(['channel']);
    expect(state.defaultRoute).toBe('/channel/overview');
    expect(state.error).toBeNull();
  });

  it('hydrates anonymously and removes an expired persisted session', () => {
    useAuthStore.getState().login({
      loginName: 'tenant',
      password: DEMO_AUTH_PASSWORD,
    });
    const raw = window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY);
    const session = JSON.parse(raw as string) as DemoSession;
    window.localStorage.setItem(
      DEMO_AUTH_STORAGE_KEY,
      JSON.stringify({
        ...session,
        expiresAt: '2026-07-31T09:59:59.000Z',
      }),
    );
    resetAuthStore();

    expect(useAuthStore.getState().hydrate()).toBeNull();
    expect(useAuthStore.getState()).toMatchObject({
      status: 'anonymous',
      identity: null,
      currentIdentity: null,
      isAuthenticated: false,
    });
    expect(window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY)).toBeNull();
  });

  it('does not restore a previous identity after a failed switch', () => {
    useAuthStore.getState().login({
      loginName: 'tenant',
      password: DEMO_AUTH_PASSWORD,
    });

    expect(
      useAuthStore.getState().login({
        loginName: 'platform',
        password: 'wrong-password',
      }),
    ).toBeNull();

    const state = useAuthStore.getState();
    expect(state.status).toBe('anonymous');
    expect(state.identity).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBe('Demo 账号或统一演示密码不正确。');
    expect(window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY)).toBeNull();
  });

  it('clears both the persisted session and in-memory identity on logout', () => {
    useAuthStore.getState().login({
      loginName: 'platform',
      password: DEMO_AUTH_PASSWORD,
    });

    useAuthStore.getState().logout();

    expect(useAuthStore.getState()).toMatchObject({
      status: 'anonymous',
      identity: null,
      currentIdentity: null,
      isAuthenticated: false,
      error: null,
    });
    expect(window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY)).toBeNull();
  });
});
