import { describe, expect, it } from 'vitest';
import {
  DEMO_ACTION_PERMISSIONS,
  DEMO_ROUTE_PERMISSIONS,
  DEMO_ROUTE_PERMISSION_WORKBENCH,
  canAccessDemoPermission,
  canAccessDemoRoute,
  findDemoIdentityByLoginName,
  type DemoPermission,
} from './demoIdentity';

function identity(loginName: string) {
  const resolved = findDemoIdentityByLoginName(loginName);
  expect(resolved).not.toBeNull();
  return resolved!;
}

const expectedPermissions = {
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
    'enterprise.brand-manage',
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
} as const satisfies Record<string, readonly DemoPermission[]>;

describe('D2 demo permission matrix', () => {
  it.each(Object.entries(expectedPermissions))(
    'freezes the exact %s permission set',
    (loginName, permissions) => {
      expect(identity(loginName).permissions).toEqual(permissions);
    },
  );

  it('keeps platform and channel identities out of enterprise and production routes', () => {
    expect(canAccessDemoRoute(identity('platform'), 'enterprise.brand-read')).toBe(false);
    expect(canAccessDemoRoute(identity('platform'), 'production.overview')).toBe(false);
    expect(canAccessDemoRoute(identity('channel'), 'enterprise.brand-read')).toBe(false);
    expect(canAccessDemoRoute(identity('channel'), 'production.overview')).toBe(false);
  });

  it('allows the enterprise administrator to operate enterprise and production routes', () => {
    const tenant = identity('tenant');

    expect(canAccessDemoRoute(tenant, 'enterprise.dashboard')).toBe(true);
    expect(canAccessDemoRoute(tenant, 'enterprise.project-create')).toBe(true);
    expect(canAccessDemoRoute(tenant, 'enterprise.brand-read')).toBe(true);
    expect(canAccessDemoPermission(tenant, 'enterprise.brand-manage')).toBe(true);
    expect(canAccessDemoRoute(tenant, 'production.canvas')).toBe(true);
    expect(canAccessDemoRoute(tenant, 'production.export')).toBe(true);
  });

  it('limits the content operator to approved enterprise-chain and production routes', () => {
    const production = identity('production');

    expect(canAccessDemoRoute(production, 'enterprise.brand-read')).toBe(true);
    expect(canAccessDemoRoute(production, 'enterprise.script')).toBe(true);
    expect(canAccessDemoRoute(production, 'enterprise.delivery')).toBe(true);
    expect(canAccessDemoRoute(production, 'production.canvas')).toBe(true);

    expect(canAccessDemoRoute(production, 'enterprise.dashboard')).toBe(false);
    expect(canAccessDemoRoute(production, 'enterprise.products')).toBe(false);
    expect(canAccessDemoRoute(production, 'enterprise.project-create')).toBe(false);
    expect(canAccessDemoPermission(production, 'enterprise.brand-manage')).toBe(false);
  });

  it('denies every permission when there is no authenticated identity', () => {
    for (const permission of [...DEMO_ROUTE_PERMISSIONS, ...DEMO_ACTION_PERMISSIONS]) {
      expect(canAccessDemoPermission(null, permission)).toBe(false);
    }
  });

  it('maps every route permission to exactly one workbench', () => {
    expect(Object.keys(DEMO_ROUTE_PERMISSION_WORKBENCH)).toEqual([...DEMO_ROUTE_PERMISSIONS]);
    expect(DEMO_ROUTE_PERMISSION_WORKBENCH['enterprise.brand-read']).toBe('tenant');
    expect(DEMO_ROUTE_PERMISSION_WORKBENCH['production.canvas']).toBe('production');
  });
});
