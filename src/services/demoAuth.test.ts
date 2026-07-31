import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEMO_SESSION_VERSION,
  type DemoSession,
  findDemoIdentityByLoginName,
} from '../domain/demoIdentity';
import {
  DEMO_AUTH_PASSWORD,
  DEMO_AUTH_STORAGE_KEY,
  DEMO_SESSION_DURATION_MS,
  DemoAuthError,
  hydrateDemoSession,
  loginWithDemoAccount,
  logoutDemoAccount,
  resolveDemoReturnPath,
} from './demoAuth';

const NOW = new Date('2026-07-31T10:00:00.000Z');

function readSession(): DemoSession {
  const raw = window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY);
  expect(raw).toBeTruthy();
  return JSON.parse(raw as string) as DemoSession;
}

function login(loginName = 'tenant') {
  return loginWithDemoAccount({
    loginName,
    password: DEMO_AUTH_PASSWORD,
  });
}

describe('demoAuth', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('writes the complete versioned Demo session contract', () => {
    login();

    expect(readSession()).toEqual({
      version: DEMO_SESSION_VERSION,
      sessionId: expect.any(String),
      identityId: 'demo-account-tenant',
      role: 'enterprise_admin',
      organizationId: 'tenant-demo-hdl',
      organizationType: 'enterprise',
      defaultWorkbench: 'enterprise',
      issuedAt: NOW.toISOString(),
      expiresAt: new Date(NOW.getTime() + DEMO_SESSION_DURATION_MS).toISOString(),
    });
  });

  it.each([
    ['platform', 'platform_admin', 'platform-videoagent', 'platform', 'platform'],
    ['channel', 'channel_agent', 'channel-demo-level-1', 'channel', 'channel'],
    ['tenant', 'enterprise_admin', 'tenant-demo-hdl', 'enterprise', 'enterprise'],
    ['production', 'content_operator', 'tenant-demo-hdl', 'enterprise', 'production'],
  ] as const)(
    'creates and restores the canonical %s identity session',
    (loginName, role, organizationId, organizationType, defaultWorkbench) => {
      const identity = login(loginName);
      const session = readSession();

      expect(session).toMatchObject({
        identityId: identity.accountId,
        role,
        organizationId,
        organizationType,
        defaultWorkbench,
      });
      expect(hydrateDemoSession()).toEqual(identity);
    },
  );

  it('rejects incorrect credentials without persisting a session', () => {
    expect(() => loginWithDemoAccount({ loginName: 'tenant', password: 'wrong' })).toThrowError(
      DemoAuthError,
    );
    expect(window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY)).toBeNull();
  });

  it('hydrates a valid unexpired session and clears it on logout', () => {
    const loggedInIdentity = login('channel');

    expect(hydrateDemoSession()).toEqual(loggedInIdentity);

    logoutDemoAccount();
    expect(window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY)).toBeNull();
    expect(hydrateDemoSession()).toBeNull();
  });

  it('clears an expired session', () => {
    login();
    vi.setSystemTime(new Date(NOW.getTime() + DEMO_SESSION_DURATION_MS));

    expect(hydrateDemoSession()).toBeNull();
    expect(window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY)).toBeNull();
  });

  it.each([
    ['damaged JSON', '{not-json'],
    ['missing field', (session: DemoSession) => ({ ...session, sessionId: undefined })],
    ['wrong version', (session: DemoSession) => ({ ...session, version: 2 })],
    ['unknown identity', (session: DemoSession) => ({ ...session, identityId: 'missing-account' })],
    [
      'unknown organization',
      (session: DemoSession) => ({ ...session, organizationId: 'missing-org' }),
    ],
    ['mismatched role', (session: DemoSession) => ({ ...session, role: 'platform_admin' })],
  ])('clears a session with %s', (_label, mutate) => {
    login();
    const validSession = readSession();
    const invalidSession = typeof mutate === 'function' ? mutate(validSession) : mutate;
    window.localStorage.setItem(
      DEMO_AUTH_STORAGE_KEY,
      typeof invalidSession === 'string' ? invalidSession : JSON.stringify(invalidSession),
    );

    expect(hydrateDemoSession()).toBeNull();
    expect(window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY)).toBeNull();
  });

  it('replaces the previous identity with a new independent session', () => {
    login('tenant');
    const tenantSession = readSession();

    const platformIdentity = login('platform');
    const platformSession = readSession();

    expect(platformSession.sessionId).not.toBe(tenantSession.sessionId);
    expect(platformSession.identityId).toBe('demo-account-platform');
    expect(platformSession.role).toBe('platform_admin');
    expect(platformSession.organizationId).toBe('platform-videoagent');
    expect(hydrateDemoSession()).toEqual(platformIdentity);
  });

  it('fails safely when localStorage cannot persist the session', () => {
    login('tenant');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(() => login('platform')).toThrowError(
      expect.objectContaining({ code: 'SESSION_UNAVAILABLE' }),
    );
    expect(window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY)).toBeNull();
  });

  it('fails anonymously when localStorage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(hydrateDemoSession()).toBeNull();
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

  it('keeps cross-workbench return paths closed until workbench rollout', () => {
    const tenant = findDemoIdentityByLoginName('tenant');
    const production = findDemoIdentityByLoginName('production');
    expect(tenant).not.toBeNull();
    expect(production).not.toBeNull();

    expect(resolveDemoReturnPath('/production/tasks/demo-local-001', tenant!)).toBe(
      tenant!.defaultRoute,
    );
    expect(resolveDemoReturnPath('/projects/demo-local-001/brand', production!)).toBe(
      production!.defaultRoute,
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
