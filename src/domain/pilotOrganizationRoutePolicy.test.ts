import { describe, expect, it } from 'vitest';
import {
  PILOT_COMMERCIAL_ROUTE_MANIFEST,
  authorizePilotOrganizationRoute,
  buildPilotCommercialMenu,
  resolvePilotOrganizationDefaultRoute,
  resolvePilotOrganizationEntryPath,
} from './pilotOrganizationRoutePolicy';

const tenantId = '10000000-0000-4000-8000-000000000001';
const visibleProjects = [
  { projectId: 'project-beta', tenantId },
  { projectId: 'project-alpha', tenantId },
];

describe('A-BIZ-03.4B Pilot commercial route manifest', () => {
  it('freezes the four commercial routes and their canonical scopes', () => {
    expect(
      PILOT_COMMERCIAL_ROUTE_MANIFEST.map((route) => ({
        path: route.path,
        organizationType: route.organizationType,
        roles: route.roles,
        requiresProjectContext: route.requiresProjectContext,
      })),
    ).toEqual([
      {
        path: '/platform/commission-audit',
        organizationType: 'PLATFORM',
        roles: ['platform_admin'],
        requiresProjectContext: false,
      },
      {
        path: '/platform/commission-settlements',
        organizationType: 'PLATFORM',
        roles: ['platform_admin'],
        requiresProjectContext: false,
      },
      {
        path: '/channel/commission-audit',
        organizationType: 'CHANNEL',
        roles: ['channel_admin'],
        requiresProjectContext: false,
      },
      {
        path: '/enterprise/recharge-orders',
        organizationType: 'TENANT',
        roles: ['tenant_admin'],
        requiresProjectContext: true,
      },
    ]);
  });
});

describe('A-BIZ-03.4B Pilot organization defaults', () => {
  it('routes a Platform administrator to commission audit without Tenant Project context', () => {
    expect(
      resolvePilotOrganizationDefaultRoute({
        organizationType: 'PLATFORM',
        tenantId: null,
        roleCodes: ['platform_admin'],
        visibleProjects: [],
      }),
    ).toEqual({
      status: 'allowed',
      path: '/platform/commission-audit',
      requiresProjectContext: false,
    });
  });

  it('routes a Channel administrator to its commission audit without Tenant Project context', () => {
    expect(
      resolvePilotOrganizationDefaultRoute({
        organizationType: 'CHANNEL',
        tenantId: null,
        roleCodes: ['channel_admin'],
        visibleProjects: [],
      }),
    ).toEqual({
      status: 'allowed',
      path: '/channel/commission-audit',
      requiresProjectContext: false,
    });
  });

  it('preserves the stable first visible Tenant Project and the empty Project fallback', () => {
    expect(
      resolvePilotOrganizationDefaultRoute({
        organizationType: 'TENANT',
        tenantId,
        roleCodes: ['content_operator'],
        visibleProjects,
      }),
    ).toEqual({
      status: 'allowed',
      path: '/projects/project-alpha/brand',
      requiresProjectContext: true,
    });
    expect(
      resolvePilotOrganizationDefaultRoute({
        organizationType: 'TENANT',
        tenantId,
        roleCodes: ['tenant_admin'],
        visibleProjects: [],
      }),
    ).toEqual({ status: 'allowed', path: '/projects', requiresProjectContext: true });
  });

  it('does not grant pilot_support or a wrong-scope administrator a commercial default', () => {
    expect(
      resolvePilotOrganizationDefaultRoute({
        organizationType: 'PLATFORM',
        tenantId: null,
        roleCodes: ['pilot_support'],
        visibleProjects: [],
      }),
    ).toEqual({ status: 'permission-denied' });
    expect(
      resolvePilotOrganizationDefaultRoute({
        organizationType: 'CHANNEL',
        tenantId: null,
        roleCodes: ['platform_admin'],
        visibleProjects: [],
      }),
    ).toEqual({ status: 'permission-denied' });
  });
});

describe('A-BIZ-03.4B Pilot direct URL authorization', () => {
  it('allows only the matching Organization scope and role', () => {
    expect(
      authorizePilotOrganizationRoute({
        pathname: '/platform/commission-settlements',
        organizationType: 'PLATFORM',
        tenantId: null,
        roleCodes: ['platform_admin'],
        visibleProjects: [],
      }),
    ).toMatchObject({ status: 'allowed', routeKind: 'commercial' });
    expect(
      authorizePilotOrganizationRoute({
        pathname: '/channel/commission-audit',
        organizationType: 'CHANNEL',
        tenantId: null,
        roleCodes: ['channel_admin'],
        visibleProjects: [],
      }),
    ).toMatchObject({ status: 'allowed', routeKind: 'commercial' });
  });

  it('returns not found for cross-Organization route probes', () => {
    expect(
      authorizePilotOrganizationRoute({
        pathname: '/channel/commission-audit',
        organizationType: 'PLATFORM',
        tenantId: null,
        roleCodes: ['platform_admin'],
        visibleProjects: [],
      }),
    ).toEqual({ status: 'scope-not-found' });
    expect(
      authorizePilotOrganizationRoute({
        pathname: '/projects/project-alpha/brand',
        organizationType: 'CHANNEL',
        tenantId: null,
        roleCodes: ['channel_admin'],
        visibleProjects: [],
      }),
    ).toEqual({ status: 'scope-not-found' });
    expect(
      authorizePilotOrganizationRoute({
        pathname: '/platform/commission-audit',
        organizationType: 'TENANT',
        tenantId,
        roleCodes: ['tenant_admin'],
        visibleProjects,
      }),
    ).toEqual({ status: 'scope-not-found' });
  });

  it('returns permission denied inside the correct scope when the required role is absent', () => {
    expect(
      authorizePilotOrganizationRoute({
        pathname: '/platform/commission-audit',
        organizationType: 'PLATFORM',
        tenantId: null,
        roleCodes: ['pilot_support'],
        visibleProjects: [],
      }),
    ).toEqual({ status: 'permission-denied' });
    expect(
      authorizePilotOrganizationRoute({
        pathname: '/enterprise/recharge-orders',
        organizationType: 'TENANT',
        tenantId,
        roleCodes: ['content_operator'],
        visibleProjects,
      }),
    ).toEqual({ status: 'permission-denied' });
    expect(
      authorizePilotOrganizationRoute({
        pathname: '/projects/project-alpha/brand',
        organizationType: 'TENANT',
        tenantId,
        roleCodes: ['pilot_support'],
        visibleProjects,
      }),
    ).toEqual({ status: 'permission-denied' });
  });

  it('delegates Tenant Project authorization without creating a Demo fallback', () => {
    expect(
      authorizePilotOrganizationRoute({
        pathname: '/projects/project-alpha/brand',
        organizationType: 'TENANT',
        tenantId,
        roleCodes: ['content_operator'],
        visibleProjects,
      }),
    ).toMatchObject({ status: 'allowed', routeKind: 'tenant', projectId: 'project-alpha' });
    expect(
      authorizePilotOrganizationRoute({
        pathname: '/projects/project-missing/brand',
        organizationType: 'TENANT',
        tenantId,
        roleCodes: ['content_operator'],
        visibleProjects,
      }),
    ).toEqual({ status: 'project-not-found' });
  });

  it('rejects unknown and malformed internal paths', () => {
    for (const pathname of ['/platform/unknown', '//evil.example/path', '/platform\\audit']) {
      expect(
        authorizePilotOrganizationRoute({
          pathname,
          organizationType: 'PLATFORM',
          tenantId: null,
          roleCodes: ['platform_admin'],
          visibleProjects: [],
        }),
      ).toEqual({ status: 'unregistered' });
    }
  });
});

describe('A-BIZ-03.4B Pilot safe returnTo', () => {
  it('keeps an allowed internal returnTo including query and hash', () => {
    expect(
      resolvePilotOrganizationEntryPath({
        candidate: '/platform/commission-settlements?period=2026-07#draft',
        organizationType: 'PLATFORM',
        tenantId: null,
        roleCodes: ['platform_admin'],
        visibleProjects: [],
      }),
    ).toEqual({
      status: 'allowed',
      path: '/platform/commission-settlements?period=2026-07#draft',
      source: 'return-to',
      requiresProjectContext: false,
    });
  });

  it('falls back to the scope default for external, unknown, malformed, and cross-scope values', () => {
    for (const candidate of [
      'https://evil.example/platform/commission-audit',
      '//evil.example/platform/commission-audit',
      '/platform/unknown',
      '/channel/commission-audit',
      ' /platform/commission-audit',
      '/platform/commission-audit\u0000',
    ]) {
      expect(
        resolvePilotOrganizationEntryPath({
          candidate,
          organizationType: 'PLATFORM',
          tenantId: null,
          roleCodes: ['platform_admin'],
          visibleProjects: [],
        }),
      ).toEqual({
        status: 'allowed',
        path: '/platform/commission-audit',
        source: 'default',
        requiresProjectContext: false,
      });
    }
  });

  it('does not turn a missing role into a fallback authorization grant', () => {
    expect(
      resolvePilotOrganizationEntryPath({
        candidate: '/platform/commission-audit',
        organizationType: 'PLATFORM',
        tenantId: null,
        roleCodes: ['pilot_support'],
        visibleProjects: [],
      }),
    ).toEqual({ status: 'permission-denied' });
  });

  it('preserves Tenant Project context for an allowed Tenant returnTo', () => {
    expect(
      resolvePilotOrganizationEntryPath({
        candidate: '/projects/project-alpha/brand?tab=facts#claims',
        organizationType: 'TENANT',
        tenantId,
        roleCodes: ['tenant_admin'],
        visibleProjects,
      }),
    ).toEqual({
      status: 'allowed',
      path: '/projects/project-alpha/brand?tab=facts#claims',
      source: 'return-to',
      requiresProjectContext: true,
    });
  });
});

describe('A-BIZ-03.4B commercial menu visibility', () => {
  it('builds menus from the same manifest and hides Tenant recharge from content operators', () => {
    expect(
      buildPilotCommercialMenu({
        organizationType: 'PLATFORM',
        roleCodes: ['platform_admin'],
      }).map((item) => item.path),
    ).toEqual(['/platform/commission-audit', '/platform/commission-settlements']);
    expect(
      buildPilotCommercialMenu({
        organizationType: 'CHANNEL',
        roleCodes: ['channel_admin'],
      }).map((item) => item.path),
    ).toEqual(['/channel/commission-audit']);
    expect(
      buildPilotCommercialMenu({
        organizationType: 'TENANT',
        roleCodes: ['tenant_admin'],
      }).map((item) => item.path),
    ).toEqual(['/enterprise/recharge-orders']);
    expect(
      buildPilotCommercialMenu({
        organizationType: 'TENANT',
        roleCodes: ['content_operator'],
      }),
    ).toEqual([]);
  });
});
