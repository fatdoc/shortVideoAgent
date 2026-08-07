import { DEMO_PROJECT_ID, ROUTES } from './constants';

export type TenantWorkbenchRole = 'tenant_admin' | 'content_operator';
export type TenantRuntimeMode = 'demo' | 'pilot';
export type TenantRouteReadiness = 'ready' | 'handoff-required' | 'not-implemented';
export type TenantRouteCapability =
  | 'tenant.projects.list'
  | 'tenant.dashboard.read'
  | 'tenant.products.read'
  | 'tenant.projects.create'
  | 'project.brand.read'
  | 'project.script.read'
  | 'project.storyboard.read'
  | 'project.rough-cut.read'
  | 'project.production.overview'
  | 'project.production.inbox'
  | 'project.production.canvas'
  | 'project.production.tasks'
  | 'project.production.assets'
  | 'project.production.export';

export interface TenantRouteManifestEntry {
  key: string;
  pattern: string;
  label: string;
  order: number;
  capability: TenantRouteCapability;
  roles: readonly TenantWorkbenchRole[];
  requiresProject: boolean;
  showInMenu: boolean;
  pilotReadiness: TenantRouteReadiness;
}

const ALL_TENANT_ROLES = ['tenant_admin', 'content_operator'] as const;
const ADMIN_ONLY = ['tenant_admin'] as const;

export const TENANT_ROUTE_MANIFEST = [
  {
    key: 'projects',
    pattern: '/projects',
    label: '项目',
    order: 0,
    capability: 'tenant.projects.list',
    roles: ALL_TENANT_ROLES,
    requiresProject: false,
    showInMenu: false,
    pilotReadiness: 'ready',
  },
  {
    key: 'dashboard',
    pattern: ROUTES.dashboard,
    label: '企业工作台',
    order: 10,
    capability: 'tenant.dashboard.read',
    roles: ADMIN_ONLY,
    requiresProject: false,
    showInMenu: true,
    pilotReadiness: 'not-implemented',
  },
  {
    key: 'products',
    pattern: ROUTES.enterpriseProducts,
    label: '已购能力',
    order: 20,
    capability: 'tenant.products.read',
    roles: ADMIN_ONLY,
    requiresProject: false,
    showInMenu: true,
    pilotReadiness: 'not-implemented',
  },
  {
    key: 'project-create',
    pattern: ROUTES.projectNew,
    label: '新建 / Brief',
    order: 30,
    capability: 'tenant.projects.create',
    roles: ADMIN_ONLY,
    requiresProject: false,
    showInMenu: true,
    pilotReadiness: 'not-implemented',
  },
  {
    key: 'brand',
    pattern: '/projects/:projectId/brand',
    label: '品牌大脑',
    order: 40,
    capability: 'project.brand.read',
    roles: ALL_TENANT_ROLES,
    requiresProject: true,
    showInMenu: true,
    pilotReadiness: 'handoff-required',
  },
  {
    key: 'script',
    pattern: '/projects/:projectId/script',
    label: '脚本编辑',
    order: 50,
    capability: 'project.script.read',
    roles: ALL_TENANT_ROLES,
    requiresProject: true,
    showInMenu: true,
    pilotReadiness: 'handoff-required',
  },
  {
    key: 'storyboard',
    pattern: '/projects/:projectId/storyboard',
    label: '分镜生产单',
    order: 60,
    capability: 'project.storyboard.read',
    roles: ALL_TENANT_ROLES,
    requiresProject: true,
    showInMenu: true,
    pilotReadiness: 'handoff-required',
  },
  {
    key: 'rough-cut',
    pattern: '/projects/:projectId/rough-cut',
    label: '任务 / 交付',
    order: 70,
    capability: 'project.rough-cut.read',
    roles: ALL_TENANT_ROLES,
    requiresProject: true,
    showInMenu: true,
    pilotReadiness: 'handoff-required',
  },
  {
    key: 'production-overview',
    pattern: ROUTES.productionOverview,
    label: '生产概览',
    order: 80,
    capability: 'project.production.overview',
    roles: ALL_TENANT_ROLES,
    requiresProject: false,
    showInMenu: true,
    pilotReadiness: 'handoff-required',
  },
  {
    key: 'production-inbox',
    pattern: '/production/inbox/:projectId',
    label: '生产包',
    order: 90,
    capability: 'project.production.inbox',
    roles: ALL_TENANT_ROLES,
    requiresProject: true,
    showInMenu: true,
    pilotReadiness: 'handoff-required',
  },
  {
    key: 'production-canvas',
    pattern: '/production/canvas/:projectId',
    label: 'StoryCanvas',
    order: 100,
    capability: 'project.production.canvas',
    roles: ALL_TENANT_ROLES,
    requiresProject: true,
    showInMenu: true,
    pilotReadiness: 'handoff-required',
  },
  {
    key: 'production-tasks',
    pattern: '/production/tasks/:projectId',
    label: '生成任务',
    order: 110,
    capability: 'project.production.tasks',
    roles: ALL_TENANT_ROLES,
    requiresProject: true,
    showInMenu: true,
    pilotReadiness: 'handoff-required',
  },
  {
    key: 'production-assets',
    pattern: '/production/assets/:projectId',
    label: '媒体资产',
    order: 120,
    capability: 'project.production.assets',
    roles: ALL_TENANT_ROLES,
    requiresProject: true,
    showInMenu: true,
    pilotReadiness: 'handoff-required',
  },
  {
    key: 'production-export',
    pattern: '/production/export/:projectId',
    label: '导出 / 来源链',
    order: 130,
    capability: 'project.production.export',
    roles: ALL_TENANT_ROLES,
    requiresProject: true,
    showInMenu: true,
    pilotReadiness: 'handoff-required',
  },
] as const satisfies readonly TenantRouteManifestEntry[];

export interface TenantVisibleProject {
  projectId: string;
  tenantId: string;
}

export interface TenantMenuItem {
  key: string;
  path: string;
  label: string;
  capability: TenantRouteCapability;
  pilotReadiness: TenantRouteReadiness;
}

export interface TenantWorkbenchOption {
  kind: 'tenant';
  label: '统一创作工作台';
}

export type TenantDefaultRouteDecision =
  { status: 'allowed'; path: string } | { status: 'tenant-context-required' };

export type TenantRouteDecision =
  | { status: 'allowed'; route: TenantRouteManifestEntry; projectId: string | null }
  | { status: 'tenant-context-required' }
  | { status: 'project-not-found' }
  | { status: 'permission-denied' }
  | { status: 'unregistered' };

function supportedRoles(roleCodes: readonly string[]): TenantWorkbenchRole[] {
  return ALL_TENANT_ROLES.filter((role) => roleCodes.includes(role));
}

function pathForRoute(route: TenantRouteManifestEntry, projectId: string | null): string | null {
  if (!route.requiresProject) return route.pattern;
  if (!projectId) return null;
  return route.pattern.replace(':projectId', encodeURIComponent(projectId));
}

function normalizeInternalPath(candidate: string): string | null {
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return null;
  }

  const pathname = candidate.split(/[?#]/u, 1)[0];
  if (!pathname || pathname.includes('//')) return null;
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

function matchRoute(
  pathname: string,
): { route: TenantRouteManifestEntry; projectId: string | null } | null {
  for (const route of TENANT_ROUTE_MANIFEST) {
    const patternParts = route.pattern.split('/');
    const pathParts = pathname.split('/');
    if (patternParts.length !== pathParts.length) continue;

    let projectId: string | null = null;
    let matches = true;
    for (let index = 0; index < patternParts.length; index += 1) {
      const patternPart = patternParts[index];
      const pathPart = pathParts[index];
      if (patternPart === ':projectId') {
        if (!pathPart) {
          matches = false;
          break;
        }
        try {
          const decoded = decodeURIComponent(pathPart);
          if (!decoded || decoded.includes('/') || decoded.includes('\\')) {
            matches = false;
            break;
          }
          projectId = decoded;
        } catch {
          matches = false;
          break;
        }
      } else if (patternPart !== pathPart) {
        matches = false;
        break;
      }
    }
    if (matches) return { route, projectId };
  }
  return null;
}

export function getTenantWorkbenchOptions(
  roleCodes: readonly string[],
): readonly TenantWorkbenchOption[] {
  if (supportedRoles(roleCodes).length === 0) return [];
  return [{ kind: 'tenant', label: '统一创作工作台' }];
}

export function buildTenantMenu(input: {
  roleCodes: readonly string[];
  projectId: string | null;
}): TenantMenuItem[] {
  const roles = supportedRoles(input.roleCodes);
  if (roles.length === 0) return [];

  const menu: TenantMenuItem[] = [];
  for (const route of TENANT_ROUTE_MANIFEST) {
    if (!route.showInMenu || !route.roles.some((role) => roles.includes(role))) continue;
    const path = pathForRoute(route, input.projectId);
    if (!path) continue;
    menu.push({
      key: route.key,
      path,
      label: route.label,
      capability: route.capability,
      pilotReadiness: route.pilotReadiness,
    });
  }
  return menu;
}

export function resolveTenantDefaultRoute(input: {
  runtimeMode: TenantRuntimeMode;
  sessionTenantId: string | null;
  roleCodes: readonly string[];
  visibleProjects: readonly TenantVisibleProject[];
}): TenantDefaultRouteDecision {
  if (!input.sessionTenantId || supportedRoles(input.roleCodes).length === 0) {
    return { status: 'tenant-context-required' };
  }

  if (input.runtimeMode === 'demo') {
    return { status: 'allowed', path: ROUTES.brand(DEMO_PROJECT_ID) };
  }

  const firstProjectId = input.visibleProjects
    .filter((project) => project.tenantId === input.sessionTenantId)
    .map((project) => project.projectId)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))[0];

  return {
    status: 'allowed',
    path: firstProjectId ? ROUTES.brand(firstProjectId) : '/projects',
  };
}

export function authorizeTenantWorkbenchRoute(input: {
  pathname: string;
  sessionTenantId: string | null;
  roleCodes: readonly string[];
  visibleProjects: readonly TenantVisibleProject[];
}): TenantRouteDecision {
  const roles = supportedRoles(input.roleCodes);
  if (!input.sessionTenantId || roles.length === 0) {
    return { status: 'tenant-context-required' };
  }

  const pathname = normalizeInternalPath(input.pathname);
  if (!pathname) return { status: 'unregistered' };

  const match = matchRoute(pathname);
  if (!match) return { status: 'unregistered' };

  if (!match.route.roles.some((role) => roles.includes(role))) {
    return { status: 'permission-denied' };
  }

  if (match.route.requiresProject) {
    const visibleProject = input.visibleProjects.find(
      (project) =>
        project.projectId === match.projectId && project.tenantId === input.sessionTenantId,
    );
    if (!visibleProject) return { status: 'project-not-found' };
  }

  return { status: 'allowed', route: match.route, projectId: match.projectId };
}
