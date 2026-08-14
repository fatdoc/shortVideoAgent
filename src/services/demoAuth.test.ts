import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findDemoIdentityByLoginName } from '../domain/demoIdentity';
import {
  DEMO_AUTH_PASSWORD,
  DEMO_SESSION_DURATION_MS,
  DemoAuthError,
  hydrateDemoSession,
  loginWithDemoAccount,
  logoutDemoAccount,
  resolveDemoReturnPath,
} from './demoAuth';

const NOW = new Date('2026-07-31T10:00:00.000Z');

function login(loginName = 'tenant') {
  return loginWithDemoAccount({
    loginName,
    password: DEMO_AUTH_PASSWORD,
  });
}

describe('demoAuth', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    logoutDemoAccount();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    logoutDemoAccount();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps the Demo session in runtime memory instead of browser storage', () => {
    const identity = login();

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(hydrateDemoSession()).toEqual(identity);
  });

  it.each([
    ['platform', 'platform-videoagent', 'PLATFORM', 'platform'],
    ['channel', 'channel-demo-level-1', 'CHANNEL', 'channel'],
    ['tenant', 'tenant-demo-hdl', 'TENANT', 'projects'],
    ['production', 'tenant-demo-hdl', 'TENANT', 'production'],
  ] as const)(
    'creates and restores the canonical %s identity session',
    (loginName, organizationId, organizationType, defaultRouteFragment) => {
      const identity = login(loginName);

      expect(identity.accountId).toBe(`demo-account-${loginName}`);
      expect(hydrateDemoSession()).toMatchObject({
        accountId: identity.accountId,
        activeOrganization: { organizationId, organizationType },
      });
      expect(identity.defaultRoute).toContain(defaultRouteFragment);
      expect(hydrateDemoSession()).toEqual(identity);
    },
  );

  it('rejects incorrect credentials without persisting a session', () => {
    expect(() =>
      loginWithDemoAccount({ loginName: 'tenant', password: 'wrong' }),
    ).toThrowError(DemoAuthError);
    expect(window.localStorage.length).toBe(0);
    expect(hydrateDemoSession()).toBeNull();
  });

  it('hydrates a valid unexpired session and clears it on logout', () => {
    const loggedInIdentity = login('channel');

    expect(hydrateDemoSession()).toEqual(loggedInIdentity);

    logoutDemoAccount();
    expect(window.localStorage.length).toBe(0);
    expect(hydrateDemoSession()).toBeNull();
  });

  it('clears an expired runtime session', () => {
    login();
    vi.setSystemTime(new Date(NOW.getTime() + DEMO_SESSION_DURATION_MS));

    expect(hydrateDemoSession()).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it('does not hydrate from tampered browser storage', () => {
    window.localStorage.setItem('videoagent:demo-auth:session:v1', '{not-json');

    expect(hydrateDemoSession()).toBeNull();
    expect(window.localStorage.getItem('videoagent:demo-auth:session:v1')).toBe('{not-json');
  });

  it('replaces the previous identity with a new independent runtime session', () => {
    const tenantIdentity = login('tenant');
    const platformIdentity = login('platform');

    expect(platformIdentity.accountId).not.toBe(tenantIdentity.accountId);
    expect(hydrateDemoSession()).toEqual(platformIdentity);
  });

  it('does not depend on browser storage APIs for runtime sessions', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    const identity = login('platform');

    expect(hydrateDemoSession()).toEqual(identity);
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });

  it('accepts only an internal path in the current identity workbench', () => {
    const tenant = findDemoIdentityByLoginName('tenant');
    const production = findDemoIdentityByLoginName('production');
    expect(tenant).not.toBeNull();
    expect(production).not.toBeNull();

    expect(
      resolveDemoReturnPath('/projects/demo-local-001/brand?tab=facts#approved', tenant!),
    ).toBe('/projects/demo-local-001/brand?tab=facts#approved');
    expect(resolveDemoReturnPath('/platform/overview', tenant!)).toBe(tenant!.defaultRoute);
    expect(resolveDemoReturnPath('/projects/demo-local-001/unknown', tenant!)).toBe(
      tenant!.defaultRoute,
    );
    expect(resolveDemoReturnPath('/production/canvas/other-project', production!)).toBe(
      production!.defaultRoute,
    );
  });

  it.each([
    ['platform', '/platform/overview'],
    ['channel', '/channel/customers/tenant-demo-hdl/usage'],
    ['tenant', '/projects/demo-local-001/brand'],
    ['production', '/production/tasks/demo-local-001'],
  ])('accepts the canonical %s workbench return path', (loginName, path) => {
    const identity = findDemoIdentityByLoginName(loginName);
    expect(identity).not.toBeNull();

    expect(resolveDemoReturnPath(path, identity!)).toBe(path);
  });

  it('accepts authorized cross-workbench return paths after workbench rollout', () => {
    const tenant = findDemoIdentityByLoginName('tenant');
    const production = findDemoIdentityByLoginName('production');
    expect(tenant).not.toBeNull();
    expect(production).not.toBeNull();

    expect(resolveDemoReturnPath('/production/tasks/demo-local-001', tenant!)).toBe(
      '/production/tasks/demo-local-001',
    );
    expect(resolveDemoReturnPath('/projects/demo-local-001/brand', production!)).toBe(
      '/projects/demo-local-001/brand',
    );
    expect(resolveDemoReturnPath('/dashboard', production!)).toBe(production!.defaultRoute);
  });

  it.each([
    'https://example.com/steal',
    '//example.com/steal',
    '/\\example.com/steal',
    ' /projects/demo-local-001/brand',
    'javascript:alert(1)',
  ])('rejects an unsafe return path: %s', (candidate) => {
    const tenant = findDemoIdentityByLoginName('tenant');
    expect(tenant).not.toBeNull();

    expect(resolveDemoReturnPath(candidate, tenant!)).toBe(tenant!.defaultRoute);
  });
});
