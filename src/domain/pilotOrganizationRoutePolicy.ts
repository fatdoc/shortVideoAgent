import type { PilotOrganizationType, PilotRole } from '../services/pilotControlApi';
import {
  TENANT_ROUTE_MANIFEST,
  authorizeTenantWorkbenchRoute,
  resolveTenantDefaultRoute,
  type TenantRouteManifestEntry,
  type TenantVisibleProject,
} from './unifiedTenantWorkbench';

export type PilotCommercialRouteCapability =
  | 'platform.commission.audit.read'
  | 'platform.commission.settlement.create'
  | 'channel.commission.audit.read'
  | 'tenant.recharge.audit.read'
  | 'platform.operations.terms.manage'
  | 'platform.operations.invitations.manage'
  | 'platform.operations.members.manage'
  | 'channel.operations.invitations.manage'
  | 'channel.operations.members.manage'
  | 'tenant.operations.invitations.manage'
  | 'tenant.operations.members.manage';

export interface PilotCommercialRouteManifestEntry {
  key: string;
  path: string;
  label: string;
  order: number;
  capability: PilotCommercialRouteCapability;
  organizationType: PilotOrganizationType;
  roles: readonly PilotRole[];
  requiresProjectContext: boolean;
  showInMenu: boolean;
}

export const PILOT_COMMERCIAL_ROUTE_MANIFEST = [
  {
    key: 'platform-commission-audit',
    path: '/platform/commission-audit',
    label: '佣金审计',
    order: 10,
    capability: 'platform.commission.audit.read',
    organizationType: 'PLATFORM',
    roles: ['platform_admin'],
    requiresProjectContext: false,
    showInMenu: true,
  },
  {
    key: 'platform-commission-settlements',
    path: '/platform/commission-settlements',
    label: 'TEST 结算草稿',
    order: 20,
    capability: 'platform.commission.settlement.create',
    organizationType: 'PLATFORM',
    roles: ['platform_admin'],
    requiresProjectContext: false,
    showInMenu: true,
  },
  {
    key: 'channel-commission-audit',
    path: '/channel/commission-audit',
    label: '佣金审计',
    order: 10,
    capability: 'channel.commission.audit.read',
    organizationType: 'CHANNEL',
    roles: ['channel_admin'],
    requiresProjectContext: false,
    showInMenu: true,
  },
  {
    key: 'tenant-recharge-orders',
    path: '/enterprise/recharge-orders',
    label: 'TEST 充值记录',
    order: 25,
    capability: 'tenant.recharge.audit.read',
    organizationType: 'TENANT',
    roles: ['tenant_admin'],
    requiresProjectContext: true,
    showInMenu: true,
  },
  {
    key: 'platform-terms',
    path: '/platform/terms',
    label: 'Terms 运营',
    order: 30,
    capability: 'platform.operations.terms.manage',
    organizationType: 'PLATFORM',
    roles: ['platform_admin'],
    requiresProjectContext: false,
    showInMenu: true,
  },
  {
    key: 'platform-invitations',
    path: '/platform/invitations',
    label: '邀请管理',
    order: 40,
    capability: 'platform.operations.invitations.manage',
    organizationType: 'PLATFORM',
    roles: ['platform_admin'],
    requiresProjectContext: false,
    showInMenu: true,
  },
  {
    key: 'platform-members',
    path: '/platform/members',
    label: '成员管理',
    order: 50,
    capability: 'platform.operations.members.manage',
    organizationType: 'PLATFORM',
    roles: ['platform_admin'],
    requiresProjectContext: false,
    showInMenu: true,
  },
  {
    key: 'channel-invitations',
    path: '/channel/invitations',
    label: '邀请管理',
    order: 20,
    capability: 'channel.operations.invitations.manage',
    organizationType: 'CHANNEL',
    roles: ['channel_admin'],
    requiresProjectContext: false,
    showInMenu: true,
  },
  {
    key: 'channel-members',
    path: '/channel/members',
    label: '成员管理',
    order: 30,
    capability: 'channel.operations.members.manage',
    organizationType: 'CHANNEL',
    roles: ['channel_admin'],
    requiresProjectContext: false,
    showInMenu: true,
  },
  {
    key: 'tenant-invitations',
    path: '/enterprise/invitations',
    label: '邀请管理',
    order: 30,
    capability: 'tenant.operations.invitations.manage',
    organizationType: 'TENANT',
    roles: ['tenant_admin'],
    requiresProjectContext: false,
    showInMenu: true,
  },
  {
    key: 'tenant-members',
    path: '/enterprise/members',
    label: '成员管理',
    order: 40,
    capability: 'tenant.operations.members.manage',
    organizationType: 'TENANT',
    roles: ['tenant_admin'],
    requiresProjectContext: false,
    showInMenu: true,
  },
] as const satisfies readonly PilotCommercialRouteManifestEntry[];

export interface PilotCommercialMenuItem {
  key: string;
  path: string;
  label: string;
  capability: PilotCommercialRouteCapability;
  requiresProjectContext: boolean;
}

export type PilotOrganizationDefaultRouteDecision =
  | {
      status: 'allowed';
      path: string;
      requiresProjectContext: boolean;
    }
  | { status: 'permission-denied' }
  | { status: 'tenant-context-required' };

export type PilotOrganizationRouteDecision =
  | {
      status: 'allowed';
      routeKind: 'commercial';
      route: PilotCommercialRouteManifestEntry;
      projectId: null;
    }
  | {
      status: 'allowed';
      routeKind: 'tenant';
      route: TenantRouteManifestEntry;
      projectId: string | null;
    }
  | { status: 'scope-not-found' }
  | { status: 'permission-denied' }
  | { status: 'tenant-context-required' }
  | { status: 'project-not-found' }
  | { status: 'unregistered' };

export type PilotOrganizationEntryPathDecision =
  | {
      status: 'allowed';
      path: string;
      source: 'return-to' | 'default';
      requiresProjectContext: boolean;
    }
  | { status: 'permission-denied' }
  | { status: 'tenant-context-required' };

interface PilotOrganizationPolicyContext {
  organizationType: PilotOrganizationType;
  tenantId: string | null;
  roleCodes: readonly string[];
  visibleProjects: readonly TenantVisibleProject[];
}

function hasRole(roleCodes: readonly string[], allowedRoles: readonly PilotRole[]): boolean {
  return allowedRoles.some((role) => roleCodes.includes(role));
}

function normalizeInternalPath(candidate: string): string | null {
  if (
    candidate.length === 0 ||
    candidate !== candidate.trim() ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    Array.from(candidate).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    })
  ) {
    return null;
  }

  const pathname = candidate.split(/[?#]/u, 1)[0];
  if (!pathname || pathname.includes('//')) return null;
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

function matchesManifestPattern(pathname: string, pattern: string): boolean {
  const pathParts = pathname.split('/');
  const patternParts = pattern.split('/');
  if (pathParts.length !== patternParts.length) return false;

  return patternParts.every((part, index) => {
    const candidatePart = pathParts[index];
    if (!part.startsWith(':')) return part === candidatePart;
    if (!candidatePart) return false;
    try {
      const decoded = decodeURIComponent(candidatePart);
      return Boolean(decoded) && !decoded.includes('/') && !decoded.includes('\\');
    } catch {
      return false;
    }
  });
}

function matchesTenantRoute(pathname: string): boolean {
  return TENANT_ROUTE_MANIFEST.some((route) => matchesManifestPattern(pathname, route.pattern));
}

function findCommercialRoute(pathname: string): PilotCommercialRouteManifestEntry | null {
  return PILOT_COMMERCIAL_ROUTE_MANIFEST.find((route) => route.path === pathname) ?? null;
}

export function buildPilotCommercialMenu(input: {
  organizationType: PilotOrganizationType;
  roleCodes: readonly string[];
}): PilotCommercialMenuItem[] {
  return PILOT_COMMERCIAL_ROUTE_MANIFEST.filter(
    (route) =>
      route.showInMenu &&
      route.organizationType === input.organizationType &&
      hasRole(input.roleCodes, route.roles),
  )
    .sort((left, right) => left.order - right.order)
    .map((route) => ({
      key: route.key,
      path: route.path,
      label: route.label,
      capability: route.capability,
      requiresProjectContext: route.requiresProjectContext,
    }));
}

export function resolvePilotOrganizationDefaultRoute(
  input: PilotOrganizationPolicyContext,
): PilotOrganizationDefaultRouteDecision {
  if (input.organizationType === 'PLATFORM') {
    if (!input.roleCodes.includes('platform_admin')) return { status: 'permission-denied' };
    return {
      status: 'allowed',
      path: '/platform/commission-audit',
      requiresProjectContext: false,
    };
  }

  if (input.organizationType === 'CHANNEL') {
    if (!input.roleCodes.includes('channel_admin')) return { status: 'permission-denied' };
    return {
      status: 'allowed',
      path: '/channel/commission-audit',
      requiresProjectContext: false,
    };
  }

  if (!input.tenantId) return { status: 'tenant-context-required' };
  if (!input.roleCodes.includes('tenant_admin') && !input.roleCodes.includes('content_operator')) {
    return { status: 'permission-denied' };
  }

  const tenantDecision = resolveTenantDefaultRoute({
    runtimeMode: 'pilot',
    sessionTenantId: input.tenantId,
    roleCodes: input.roleCodes,
    visibleProjects: input.visibleProjects,
  });
  if (tenantDecision.status !== 'allowed') return tenantDecision;
  return {
    status: 'allowed',
    path: tenantDecision.path,
    requiresProjectContext: true,
  };
}

export function authorizePilotOrganizationRoute(
  input: PilotOrganizationPolicyContext & { pathname: string },
): PilotOrganizationRouteDecision {
  const pathname = normalizeInternalPath(input.pathname);
  if (!pathname) return { status: 'unregistered' };

  const commercialRoute = findCommercialRoute(pathname);
  if (commercialRoute) {
    if (commercialRoute.organizationType !== input.organizationType) {
      return { status: 'scope-not-found' };
    }
    if (!hasRole(input.roleCodes, commercialRoute.roles)) {
      return { status: 'permission-denied' };
    }
    return {
      status: 'allowed',
      routeKind: 'commercial',
      route: commercialRoute,
      projectId: null,
    };
  }

  if (input.organizationType !== 'TENANT') {
    return matchesTenantRoute(pathname)
      ? { status: 'scope-not-found' }
      : { status: 'unregistered' };
  }

  if (!input.tenantId) return { status: 'tenant-context-required' };
  if (!input.roleCodes.includes('tenant_admin') && !input.roleCodes.includes('content_operator')) {
    return matchesTenantRoute(pathname)
      ? { status: 'permission-denied' }
      : { status: 'unregistered' };
  }

  const tenantDecision = authorizeTenantWorkbenchRoute({
    pathname: input.pathname,
    sessionTenantId: input.tenantId,
    roleCodes: input.roleCodes,
    visibleProjects: input.visibleProjects,
  });
  if (tenantDecision.status !== 'allowed') return tenantDecision;
  return {
    status: 'allowed',
    routeKind: 'tenant',
    route: tenantDecision.route,
    projectId: tenantDecision.projectId,
  };
}

export function resolvePilotOrganizationEntryPath(
  input: PilotOrganizationPolicyContext & { candidate: unknown },
): PilotOrganizationEntryPathDecision {
  const defaultDecision = resolvePilotOrganizationDefaultRoute(input);
  if (defaultDecision.status !== 'allowed') return defaultDecision;

  if (typeof input.candidate === 'string') {
    const returnDecision = authorizePilotOrganizationRoute({
      ...input,
      pathname: input.candidate,
    });
    if (returnDecision.status === 'allowed') {
      return {
        status: 'allowed',
        path: input.candidate,
        source: 'return-to',
        requiresProjectContext:
          returnDecision.routeKind === 'commercial'
            ? returnDecision.route.requiresProjectContext
            : true,
      };
    }
  }

  return {
    status: 'allowed',
    path: defaultDecision.path,
    source: 'default',
    requiresProjectContext: defaultDecision.requiresProjectContext,
  };
}
