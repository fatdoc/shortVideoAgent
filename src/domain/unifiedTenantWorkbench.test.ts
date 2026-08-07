import { describe, expect, it } from 'vitest';
import { DEMO_PROJECT_ID, ROUTES } from './constants';
import {
  TENANT_ROUTE_MANIFEST,
  authorizeTenantWorkbenchRoute,
  buildTenantMenu,
  getTenantWorkbenchOptions,
  resolveTenantDefaultRoute,
  type TenantVisibleProject,
} from './unifiedTenantWorkbench';

const tenantId = 'tenant-test-001';
const projects: readonly TenantVisibleProject[] = [
  { projectId: 'project-zeta', tenantId },
  { projectId: 'project-alpha', tenantId },
];

describe('A-BIZ-01.4 unified Tenant route manifest', () => {
  it('registers every route pattern and capability exactly once', () => {
    const patterns = TENANT_ROUTE_MANIFEST.map((route) => route.pattern);
    const capabilities = TENANT_ROUTE_MANIFEST.map((route) => route.capability);

    expect(new Set(patterns).size).toBe(patterns.length);
    expect(new Set(capabilities).size).toBe(capabilities.length);
  });

  it('keeps enterprise and production routes in one ordered Tenant menu', () => {
    const menu = buildTenantMenu({
      roleCodes: ['tenant_admin'],
      projectId: DEMO_PROJECT_ID,
    });

    expect(menu.map((item) => item.path)).toEqual([
      ROUTES.dashboard,
      ROUTES.enterpriseProducts,
      ROUTES.projectNew,
      ROUTES.brand(DEMO_PROJECT_ID),
      ROUTES.script(DEMO_PROJECT_ID),
      ROUTES.storyboard(DEMO_PROJECT_ID),
      ROUTES.roughCut(DEMO_PROJECT_ID),
      ROUTES.productionOverview,
      ROUTES.productionInbox(DEMO_PROJECT_ID),
      ROUTES.productionCanvas(DEMO_PROJECT_ID),
      ROUTES.productionTasks(DEMO_PROJECT_ID),
      ROUTES.productionAssets(DEMO_PROJECT_ID),
      ROUTES.productionExport(DEMO_PROJECT_ID),
    ]);
  });

  it('hides Tenant administration and project creation from content operators', () => {
    const menu = buildTenantMenu({
      roleCodes: ['content_operator'],
      projectId: DEMO_PROJECT_ID,
    });
    const capabilities = menu.map((item) => item.capability);

    expect(capabilities).not.toContain('tenant.dashboard.read');
    expect(capabilities).not.toContain('tenant.products.read');
    expect(capabilities).not.toContain('tenant.projects.create');
    expect(menu.map((item) => item.path)).toContain(ROUTES.brand(DEMO_PROJECT_ID));
    expect(menu.map((item) => item.path)).toContain(ROUTES.productionTasks(DEMO_PROJECT_ID));
  });

  it('uses one Tenant workbench for both supported Tenant roles', () => {
    expect(getTenantWorkbenchOptions(['tenant_admin'])).toEqual([
      { kind: 'tenant', label: '统一创作工作台' },
    ]);
    expect(getTenantWorkbenchOptions(['content_operator'])).toEqual([
      { kind: 'tenant', label: '统一创作工作台' },
    ]);
    expect(getTenantWorkbenchOptions(['content_operator'])).toHaveLength(1);
  });
});

describe('A-BIZ-01.4 Tenant default route', () => {
  it('keeps the canonical Demo project as the Tenant default', () => {
    expect(
      resolveTenantDefaultRoute({
        runtimeMode: 'demo',
        sessionTenantId: tenantId,
        roleCodes: ['tenant_admin'],
        visibleProjects: [],
      }),
    ).toEqual({ status: 'allowed', path: ROUTES.brand(DEMO_PROJECT_ID) });
  });

  it('uses the first stable server-visible Pilot project without a Demo fallback', () => {
    expect(
      resolveTenantDefaultRoute({
        runtimeMode: 'pilot',
        sessionTenantId: tenantId,
        roleCodes: ['content_operator'],
        visibleProjects: projects,
      }),
    ).toEqual({ status: 'allowed', path: ROUTES.brand('project-alpha') });
  });

  it('routes an empty Pilot Project Scope to the safe project list state', () => {
    expect(
      resolveTenantDefaultRoute({
        runtimeMode: 'pilot',
        sessionTenantId: tenantId,
        roleCodes: ['content_operator'],
        visibleProjects: [],
      }),
    ).toEqual({ status: 'allowed', path: '/projects' });
  });

  it('does not select a Pilot project from another Tenant', () => {
    expect(
      resolveTenantDefaultRoute({
        runtimeMode: 'pilot',
        sessionTenantId: tenantId,
        roleCodes: ['tenant_admin'],
        visibleProjects: [{ projectId: 'project-foreign', tenantId: 'tenant-other' }],
      }),
    ).toEqual({ status: 'allowed', path: '/projects' });
  });

  it('fails closed for unknown or non-Tenant roles', () => {
    expect(
      resolveTenantDefaultRoute({
        runtimeMode: 'pilot',
        sessionTenantId: tenantId,
        roleCodes: ['platform_admin'],
        visibleProjects: projects,
      }),
    ).toEqual({ status: 'tenant-context-required' });
  });
});

describe('A-BIZ-01.4 Tenant project route policy', () => {
  it('allows a supported role to open a server-visible Project route', () => {
    expect(
      authorizeTenantWorkbenchRoute({
        pathname: ROUTES.productionTasks('project-alpha'),
        sessionTenantId: tenantId,
        roleCodes: ['content_operator'],
        visibleProjects: projects,
      }),
    ).toMatchObject({ status: 'allowed', projectId: 'project-alpha' });
  });

  it('hides an unassigned Project as not found', () => {
    expect(
      authorizeTenantWorkbenchRoute({
        pathname: ROUTES.brand('project-unassigned'),
        sessionTenantId: tenantId,
        roleCodes: ['content_operator'],
        visibleProjects: projects,
      }),
    ).toEqual({ status: 'project-not-found' });
  });

  it('rejects a visible Project that belongs to another Tenant', () => {
    expect(
      authorizeTenantWorkbenchRoute({
        pathname: ROUTES.brand('project-foreign'),
        sessionTenantId: tenantId,
        roleCodes: ['tenant_admin'],
        visibleProjects: [{ projectId: 'project-foreign', tenantId: 'tenant-other' }],
      }),
    ).toEqual({ status: 'project-not-found' });
  });

  it('denies a known administration route to content operators', () => {
    expect(
      authorizeTenantWorkbenchRoute({
        pathname: ROUTES.dashboard,
        sessionTenantId: tenantId,
        roleCodes: ['content_operator'],
        visibleProjects: projects,
      }),
    ).toEqual({ status: 'permission-denied' });
  });

  it('fails closed for unknown roles and unknown paths', () => {
    expect(
      authorizeTenantWorkbenchRoute({
        pathname: ROUTES.brand('project-alpha'),
        sessionTenantId: tenantId,
        roleCodes: ['unknown_role'],
        visibleProjects: projects,
      }),
    ).toEqual({ status: 'tenant-context-required' });
    expect(
      authorizeTenantWorkbenchRoute({
        pathname: '/tenant/unknown',
        sessionTenantId: tenantId,
        roleCodes: ['tenant_admin'],
        visibleProjects: projects,
      }),
    ).toEqual({ status: 'unregistered' });
  });
});
