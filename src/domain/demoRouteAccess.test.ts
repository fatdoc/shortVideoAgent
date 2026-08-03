import { describe, expect, it } from 'vitest';
import { DEMO_PROJECT_ID, DEMO_TENANT_ID } from './constants';
import {
  DEMO_ROUTE_PERMISSIONS,
  DEMO_ROUTE_PERMISSION_WORKBENCH,
  findDemoIdentityByLoginName,
  type DemoRoutePermission,
} from './demoIdentity';
import {
  DEMO_ROUTE_DESCRIPTORS,
  authorizeDemoNavigationRoute,
  authorizeDemoRoute,
  resolveDemoRouteAccess,
  type DemoRouteDescriptor,
} from './demoRouteAccess';

function identity(loginName: string) {
  const resolved = findDemoIdentityByLoginName(loginName);
  expect(resolved).not.toBeNull();
  return resolved!;
}

function canonicalCandidate(descriptor: DemoRouteDescriptor): string {
  return descriptor.pattern
    .replace(':tenantId', DEMO_TENANT_ID)
    .replace(':projectId', DEMO_PROJECT_ID);
}

function allowedPermissions(loginName: string): DemoRoutePermission[] {
  return DEMO_ROUTE_DESCRIPTORS.filter(
    (descriptor) =>
      authorizeDemoRoute(identity(loginName), canonicalCandidate(descriptor)).status === 'allowed',
  ).map((descriptor) => descriptor.permission);
}

const expectedAllowedPermissions = {
  platform: [
    'platform.overview',
    'platform.organizations',
    'platform.catalog',
    'platform.receipts',
  ],
  channel: ['channel.overview', 'channel.products', 'channel.customers', 'channel.customer-usage'],
  tenant: [
    'enterprise.dashboard',
    'enterprise.products',
    'enterprise.project-create',
    'enterprise.project-entry',
    'enterprise.brand-read',
    'enterprise.script',
    'enterprise.storyboard',
    'enterprise.rough-cut',
    'enterprise.usage',
    'enterprise.delivery',
    'production.overview',
    'production.inbox',
    'production.canvas',
    'production.tasks',
    'production.assets',
    'production.export',
  ],
  production: [
    'enterprise.project-entry',
    'enterprise.brand-read',
    'enterprise.script',
    'enterprise.storyboard',
    'enterprise.rough-cut',
    'enterprise.usage',
    'enterprise.delivery',
    'production.overview',
    'production.inbox',
    'production.canvas',
    'production.tasks',
    'production.assets',
    'production.export',
  ],
} as const satisfies Record<string, readonly DemoRoutePermission[]>;

describe('D2 canonical route registry', () => {
  it('registers every route permission exactly once', () => {
    const registeredPermissions = DEMO_ROUTE_DESCRIPTORS.map((descriptor) => descriptor.permission);

    expect(registeredPermissions).toHaveLength(DEMO_ROUTE_PERMISSIONS.length);
    expect(new Set(registeredPermissions).size).toBe(DEMO_ROUTE_PERMISSIONS.length);
    expect(new Set(registeredPermissions)).toEqual(new Set(DEMO_ROUTE_PERMISSIONS));
  });

  it('keeps every route workbench aligned with the permission contract', () => {
    for (const descriptor of DEMO_ROUTE_DESCRIPTORS) {
      expect(descriptor.workbench).toBe(DEMO_ROUTE_PERMISSION_WORKBENCH[descriptor.permission]);
    }
  });

  it('does not register duplicate path patterns', () => {
    const patterns = DEMO_ROUTE_DESCRIPTORS.map((descriptor) => descriptor.pattern);
    expect(new Set(patterns).size).toBe(patterns.length);
  });

  it('returns null for an unknown route', () => {
    expect(resolveDemoRouteAccess('/unknown')).toBeNull();
  });
});

describe('D2 identity route authorization', () => {
  it.each(Object.entries(expectedAllowedPermissions))(
    'allows only the frozen %s route set',
    (loginName, permissions) => {
      expect(allowedPermissions(loginName)).toEqual(permissions);
    },
  );

  it('denies enterprise dashboard, products and project creation to content operators', () => {
    const production = identity('production');

    expect(authorizeDemoRoute(production, '/dashboard').status).toBe('permission-denied');
    expect(authorizeDemoRoute(production, '/enterprise/products').status).toBe('permission-denied');
    expect(authorizeDemoRoute(production, '/projects/new').status).toBe('permission-denied');
  });

  it('denies a canonical registered route when there is no identity', () => {
    expect(authorizeDemoRoute(null, `/projects/${DEMO_PROJECT_ID}/brand`).status).toBe(
      'permission-denied',
    );
  });
});

describe('D2 enabled workbench navigation gate', () => {
  it('allows the frozen cross-workbench routes after the workbench rollout', () => {
    const tenant = identity('tenant');
    const production = identity('production');

    expect(authorizeDemoRoute(tenant, `/production/tasks/${DEMO_PROJECT_ID}`).status).toBe(
      'allowed',
    );
    expect(
      authorizeDemoNavigationRoute(tenant, `/production/tasks/${DEMO_PROJECT_ID}`).status,
    ).toBe('allowed');

    expect(authorizeDemoRoute(production, `/projects/${DEMO_PROJECT_ID}/brand`).status).toBe(
      'allowed',
    );
    expect(
      authorizeDemoNavigationRoute(production, `/projects/${DEMO_PROJECT_ID}/brand`).status,
    ).toBe('allowed');
  });

  it('still rejects workbenches outside the identity contract', () => {
    expect(authorizeDemoNavigationRoute(identity('tenant'), '/platform/overview').status).toBe(
      'permission-denied',
    );
    expect(authorizeDemoNavigationRoute(identity('production'), '/channel/overview').status).toBe(
      'permission-denied',
    );
  });
});

describe('D2 canonical scope authorization', () => {
  it.each([
    '/channel/customers/other-tenant/usage',
    '/projects/other-project/brand',
    '/projects/other-project/script',
    '/production/canvas/other-project',
    '/production/tasks/other-project',
    '/projects/demo%2Flocal-001/brand',
  ])('rejects non-canonical resource path %s', (candidate) => {
    expect(authorizeDemoRoute(identity('tenant'), candidate).status).toBe('scope-denied');
  });

  it('checks canonical scope before identity permission', () => {
    expect(authorizeDemoRoute(identity('platform'), '/projects/other-project/brand').status).toBe(
      'scope-denied',
    );
  });
});

describe('D2 route matching safety', () => {
  it('ignores query and hash when authorizing a route', () => {
    const decision = authorizeDemoRoute(
      identity('tenant'),
      `/projects/${DEMO_PROJECT_ID}/brand?tab=voice#examples`,
    );

    expect(decision.status).toBe('allowed');
    if (decision.status !== 'unregistered') {
      expect(decision.pathname).toBe(`/projects/${DEMO_PROJECT_ID}/brand`);
    }
  });

  it('matches the static project creation path before the project entry path', () => {
    const resolved = resolveDemoRouteAccess('/projects/new');
    expect(resolved?.descriptor.permission).toBe('enterprise.project-create');
    expect(resolved?.params).toEqual({});
  });

  it('matches the canonical project entry route', () => {
    const resolved = resolveDemoRouteAccess(`/projects/${DEMO_PROJECT_ID}`);
    expect(resolved?.descriptor.permission).toBe('enterprise.project-entry');
    expect(resolved?.params).toEqual({ projectId: DEMO_PROJECT_ID });
  });

  it('accepts one trailing slash without accepting extra path segments', () => {
    expect(authorizeDemoRoute(identity('tenant'), '/dashboard/').status).toBe('allowed');
    expect(
      authorizeDemoRoute(identity('tenant'), `/projects/${DEMO_PROJECT_ID}/brand/extra`).status,
    ).toBe('unregistered');
    expect(authorizeDemoRoute(identity('tenant'), '/dashboard//').status).toBe('unregistered');
  });

  it.each([
    'https://example.com/dashboard',
    '//example.com/dashboard',
    '/\\dashboard',
    '\\dashboard',
  ])('rejects unsafe or external candidate %s', (candidate) => {
    expect(authorizeDemoRoute(identity('tenant'), candidate).status).toBe('unregistered');
  });

  it('does not match similar prefixes', () => {
    expect(authorizeDemoRoute(identity('platform'), '/platform/overview-copy').status).toBe(
      'unregistered',
    );
  });
});
