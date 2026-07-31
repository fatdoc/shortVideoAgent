import { DEMO_PROJECT_ID, DEMO_TENANT_ID } from './constants';
import {
  canAccessDemoRoute,
  type DemoIdentity,
  type DemoRoutePermission,
  type DemoWorkbench,
} from './demoIdentity';

export type DemoRouteScope = 'none' | 'canonical-tenant' | 'canonical-project';

export interface DemoRouteDescriptor {
  pattern: string;
  permission: DemoRoutePermission;
  workbench: DemoWorkbench;
  targetLabel: string;
  scope: DemoRouteScope;
}

export const DEMO_ROUTE_DESCRIPTORS = [
  {
    pattern: '/platform/overview',
    permission: 'platform.overview',
    workbench: 'platform',
    targetLabel: '平台总览',
    scope: 'none',
  },
  {
    pattern: '/platform/organizations',
    permission: 'platform.organizations',
    workbench: 'platform',
    targetLabel: '组织管理',
    scope: 'none',
  },
  {
    pattern: '/platform/catalog',
    permission: 'platform.catalog',
    workbench: 'platform',
    targetLabel: '平台产品目录',
    scope: 'none',
  },
  {
    pattern: '/platform/production-receipts',
    permission: 'platform.receipts',
    workbench: 'platform',
    targetLabel: '生产回执监控',
    scope: 'none',
  },
  {
    pattern: '/channel/overview',
    permission: 'channel.overview',
    workbench: 'channel',
    targetLabel: '渠道总览',
    scope: 'none',
  },
  {
    pattern: '/channel/products',
    permission: 'channel.products',
    workbench: 'channel',
    targetLabel: '渠道产品目录',
    scope: 'none',
  },
  {
    pattern: '/channel/customers',
    permission: 'channel.customers',
    workbench: 'channel',
    targetLabel: '渠道客户',
    scope: 'none',
  },
  {
    pattern: '/channel/customers/:tenantId/usage',
    permission: 'channel.customer-usage',
    workbench: 'channel',
    targetLabel: '客户用量',
    scope: 'canonical-tenant',
  },
  {
    pattern: '/dashboard',
    permission: 'enterprise.dashboard',
    workbench: 'tenant',
    targetLabel: '企业工作台',
    scope: 'none',
  },
  {
    pattern: '/enterprise/products',
    permission: 'enterprise.products',
    workbench: 'tenant',
    targetLabel: '企业已购能力',
    scope: 'none',
  },
  {
    pattern: '/projects/new',
    permission: 'enterprise.project-create',
    workbench: 'tenant',
    targetLabel: '新建项目 Brief',
    scope: 'none',
  },
  {
    pattern: '/projects/:projectId',
    permission: 'enterprise.project-entry',
    workbench: 'tenant',
    targetLabel: '项目入口',
    scope: 'canonical-project',
  },
  {
    pattern: '/projects/:projectId/brand',
    permission: 'enterprise.brand-read',
    workbench: 'tenant',
    targetLabel: '品牌大脑',
    scope: 'canonical-project',
  },
  {
    pattern: '/projects/:projectId/script',
    permission: 'enterprise.script',
    workbench: 'tenant',
    targetLabel: '脚本编辑',
    scope: 'canonical-project',
  },
  {
    pattern: '/projects/:projectId/storyboard',
    permission: 'enterprise.storyboard',
    workbench: 'tenant',
    targetLabel: '分镜清单',
    scope: 'canonical-project',
  },
  {
    pattern: '/projects/:projectId/rough-cut',
    permission: 'enterprise.rough-cut',
    workbench: 'tenant',
    targetLabel: '素材与初剪',
    scope: 'canonical-project',
  },
  {
    pattern: '/projects/:projectId/usage',
    permission: 'enterprise.usage',
    workbench: 'tenant',
    targetLabel: '项目用量',
    scope: 'canonical-project',
  },
  {
    pattern: '/projects/:projectId/delivery',
    permission: 'enterprise.delivery',
    workbench: 'tenant',
    targetLabel: '项目交付',
    scope: 'canonical-project',
  },
  {
    pattern: '/production/overview',
    permission: 'production.overview',
    workbench: 'production',
    targetLabel: '生产总览',
    scope: 'none',
  },
  {
    pattern: '/production/inbox/:projectId',
    permission: 'production.inbox',
    workbench: 'production',
    targetLabel: '生产收件箱',
    scope: 'canonical-project',
  },
  {
    pattern: '/production/canvas/:projectId',
    permission: 'production.canvas',
    workbench: 'production',
    targetLabel: 'StoryCanvas',
    scope: 'canonical-project',
  },
  {
    pattern: '/production/tasks/:projectId',
    permission: 'production.tasks',
    workbench: 'production',
    targetLabel: '生产任务',
    scope: 'canonical-project',
  },
  {
    pattern: '/production/assets/:projectId',
    permission: 'production.assets',
    workbench: 'production',
    targetLabel: '生产资产',
    scope: 'canonical-project',
  },
  {
    pattern: '/production/export/:projectId',
    permission: 'production.export',
    workbench: 'production',
    targetLabel: '生产导出',
    scope: 'canonical-project',
  },
] as const satisfies readonly DemoRouteDescriptor[];

export type DemoRouteParams = Readonly<Record<string, string>>;

export interface ResolvedDemoRouteAccess {
  descriptor: DemoRouteDescriptor;
  pathname: string;
  params: DemoRouteParams;
}

export type DemoRouteAccessDecision =
  | ({ status: 'allowed' } & ResolvedDemoRouteAccess)
  | ({ status: 'permission-denied' } & ResolvedDemoRouteAccess)
  | ({ status: 'scope-denied' } & ResolvedDemoRouteAccess)
  | { status: 'unregistered'; candidate: string };

function extractInternalPathname(candidate: string): string | null {
  const boundaryIndexes = [candidate.indexOf('?'), candidate.indexOf('#')].filter(
    (index) => index >= 0,
  );
  const boundary = boundaryIndexes.length > 0 ? Math.min(...boundaryIndexes) : candidate.length;
  let pathname = candidate.slice(0, boundary);

  if (
    !pathname.startsWith('/') ||
    pathname.startsWith('//') ||
    pathname.includes('\\') ||
    pathname.includes('//')
  ) {
    return null;
  }

  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  if (pathname.length > 1 && pathname.endsWith('/')) {
    return null;
  }

  return pathname;
}

function matchRoutePattern(pattern: string, pathname: string): DemoRouteParams | null {
  const patternSegments = pattern.slice(1).split('/');
  const pathnameSegments = pathname.slice(1).split('/');

  if (patternSegments.length !== pathnameSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    const pathnameSegment = pathnameSegments[index];

    if (!patternSegment || !pathnameSegment) {
      return null;
    }

    if (patternSegment.startsWith(':')) {
      params[patternSegment.slice(1)] = pathnameSegment;
      continue;
    }

    if (patternSegment !== pathnameSegment) {
      return null;
    }
  }

  return params;
}

export function resolveDemoRouteAccess(candidate: string): ResolvedDemoRouteAccess | null {
  const pathname = extractInternalPathname(candidate);

  if (!pathname) {
    return null;
  }

  for (const descriptor of DEMO_ROUTE_DESCRIPTORS) {
    const params = matchRoutePattern(descriptor.pattern, pathname);

    if (params) {
      return { descriptor, pathname, params };
    }
  }

  return null;
}

function isCanonicalScope({ descriptor, params }: ResolvedDemoRouteAccess): boolean {
  switch (descriptor.scope) {
    case 'none':
      return true;
    case 'canonical-tenant':
      return params.tenantId === DEMO_TENANT_ID;
    case 'canonical-project':
      return params.projectId === DEMO_PROJECT_ID;
  }
}

export function authorizeDemoRoute(
  identity: DemoIdentity | null,
  candidate: string,
): DemoRouteAccessDecision {
  const resolved = resolveDemoRouteAccess(candidate);

  if (!resolved) {
    return { status: 'unregistered', candidate };
  }

  if (!isCanonicalScope(resolved)) {
    return { status: 'scope-denied', ...resolved };
  }

  if (!canAccessDemoRoute(identity, resolved.descriptor.permission)) {
    return { status: 'permission-denied', ...resolved };
  }

  return { status: 'allowed', ...resolved };
}
