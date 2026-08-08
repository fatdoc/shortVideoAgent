import { Alert, Button, Space, Typography } from 'antd';
import { useEffect, useState, type ReactNode } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { pilotRuntime } from '../config/pilotRuntime';
import { DEMO_PROJECT_ID } from '../domain/constants';
import { authorizeDemoNavigationRoute } from '../domain/demoRouteAccess';
import {
  TENANT_ROUTE_MANIFEST,
  authorizeTenantWorkbenchRoute,
  resolveTenantDefaultRoute,
  type TenantRouteManifestEntry,
} from '../domain/unifiedTenantWorkbench';
import { AppShell } from '../layouts/AppShell';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RouteAccessDeniedPage } from '../pages/auth/RouteAccessDeniedPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegistrationPage } from '../pages/auth/RegistrationPage';
import { BrandBrainPage } from '../pages/brand-brain/BrandBrainPage';
import { BriefPage } from '../pages/brief/BriefPage';
import {
  ChannelCustomerUsagePage,
  ChannelCustomersPage,
  ChannelOverviewPage,
  ChannelProductsPage,
} from '../pages/channel/ChannelCommercialPages';
import { ProductCatalogPage } from '../pages/commercial/ProductCatalogPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import {
  PlatformCatalogPage,
  PlatformOrganizationsPage,
  PlatformOverviewPage,
  PlatformReceiptMonitorPage,
} from '../pages/platform/PlatformManagementPages';
import { IntegratedStoryCanvasPage } from '../pages/production/IntegratedStoryCanvasPage';
import { ProductionWorkbenchPage } from '../pages/production/ProductionWorkbenchPage';
import { RoughCutPage } from '../pages/rough-cut/RoughCutPage';
import { ScriptEditorPage } from '../pages/script-editor/ScriptEditorPage';
import { StoryboardPage } from '../pages/storyboard/StoryboardPage';
import { resolveDemoReturnPath } from '../services/demoAuth';
import { useAuthStore } from '../stores/authStore';
import { usePilotAuthStore } from '../stores/pilotAuthStore';
import { usePilotProjectContextStore } from '../stores/pilotProjectContextStore';
import type { PilotProject, PilotSession } from '../services/pilotControlApi';

function SessionLoading() {
  return (
    <div className="d2-session-loading" role="status">
      正在恢复演示身份...
    </div>
  );
}

function RequireSession() {
  const location = useLocation();
  const status = useAuthStore((state) => state.status);
  const hydrate = useAuthStore((state) => state.hydrate);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (status === 'idle') hydrate();
  }, [hydrate, status]);

  if (status === 'idle' || status === 'hydrating') return <SessionLoading />;
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }
  return <Outlet />;
}

function LoginEntry() {
  const location = useLocation();
  const status = useAuthStore((state) => state.status);
  const hydrate = useAuthStore((state) => state.hydrate);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const identity = useAuthStore((state) => state.identity);

  useEffect(() => {
    if (status === 'idle') hydrate();
  }, [hydrate, status]);

  if (status === 'idle' || status === 'hydrating') return <SessionLoading />;
  if (isAuthenticated && identity) {
    const returnTo = (location.state as { from?: unknown } | null)?.from;
    return <Navigate to={resolveDemoReturnPath(returnTo, identity)} replace />;
  }
  return <LoginPage />;
}

function DefaultEntry() {
  const defaultRoute = useAuthStore((state) => state.defaultRoute);
  return <Navigate to={defaultRoute ?? '/login'} replace />;
}

function RouteAccessGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const identity = useAuthStore((state) => state.identity);
  const decision = authorizeDemoNavigationRoute(
    identity,
    `${location.pathname}${location.search}${location.hash}`,
  );

  if (decision.status === 'allowed') return children;
  if (decision.status === 'unregistered') return <NotFoundPage />;

  return <RouteAccessDeniedPage decision={decision} />;
}

function CanonicalProjectEntry() {
  return <Navigate to={`/projects/${DEMO_PROJECT_ID}/brand`} replace />;
}

function DemoRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginEntry />} />
        <Route element={<RequireSession />}>
          <Route element={<AppShell />}>
            <Route index element={<DefaultEntry />} />
            <Route
              path="platform/overview"
              element={
                <RouteAccessGuard>
                  <PlatformOverviewPage />
                </RouteAccessGuard>
              }
            />
            <Route
              path="platform/organizations"
              element={
                <RouteAccessGuard>
                  <PlatformOrganizationsPage />
                </RouteAccessGuard>
              }
            />
            <Route
              path="platform/catalog"
              element={
                <RouteAccessGuard>
                  <PlatformCatalogPage />
                </RouteAccessGuard>
              }
            />
            <Route
              path="platform/production-receipts"
              element={
                <RouteAccessGuard>
                  <PlatformReceiptMonitorPage />
                </RouteAccessGuard>
              }
            />
            <Route
              path="channel/overview"
              element={
                <RouteAccessGuard>
                  <ChannelOverviewPage />
                </RouteAccessGuard>
              }
            />
            <Route
              path="channel/products"
              element={
                <RouteAccessGuard>
                  <ChannelProductsPage />
                </RouteAccessGuard>
              }
            />
            <Route
              path="channel/customers"
              element={
                <RouteAccessGuard>
                  <ChannelCustomersPage />
                </RouteAccessGuard>
              }
            />
            <Route
              path="channel/customers/:tenantId/usage"
              element={
                <RouteAccessGuard>
                  <ChannelCustomerUsagePage />
                </RouteAccessGuard>
              }
            />
            <Route
              path="enterprise/products"
              element={
                <RouteAccessGuard>
                  <ProductCatalogPage />
                </RouteAccessGuard>
              }
            />
            <Route
              path="dashboard"
              element={
                <RouteAccessGuard>
                  <DashboardPage />
                </RouteAccessGuard>
              }
            />
            <Route
              path="projects/new"
              element={
                <RouteAccessGuard>
                  <BriefPage />
                </RouteAccessGuard>
              }
            />
            <Route
              path="projects/:projectId/brand"
              element={
                <RouteAccessGuard>
                  <BrandBrainPage />
                </RouteAccessGuard>
              }
            />
            <Route
              path="projects/:projectId/script"
              element={
                <RouteAccessGuard>
                  <ScriptEditorPage />
                </RouteAccessGuard>
              }
            />
            <Route
              path="projects/:projectId/storyboard"
              element={
                <RouteAccessGuard>
                  <StoryboardPage />
                </RouteAccessGuard>
              }
            />
            <Route
              path="projects/:projectId/rough-cut"
              element={
                <RouteAccessGuard>
                  <RoughCutPage />
                </RouteAccessGuard>
              }
            />
            <Route
              path="projects/:projectId/usage"
              element={
                <RouteAccessGuard>
                  <RoughCutPage view="assets" />
                </RouteAccessGuard>
              }
            />
            <Route
              path="projects/:projectId/delivery"
              element={
                <RouteAccessGuard>
                  <RoughCutPage view="export" />
                </RouteAccessGuard>
              }
            />
            <Route
              path="production/overview"
              element={
                <RouteAccessGuard>
                  <ProductionWorkbenchPage />
                </RouteAccessGuard>
              }
            />
            <Route
              path="production/inbox/:projectId"
              element={
                <RouteAccessGuard>
                  <ProductionWorkbenchPage view="inbox" />
                </RouteAccessGuard>
              }
            />
            <Route
              path="production/canvas/:projectId"
              element={
                <RouteAccessGuard>
                  <IntegratedStoryCanvasPage />
                </RouteAccessGuard>
              }
            />
            <Route
              path="production/tasks/:projectId"
              element={
                <RouteAccessGuard>
                  <ProductionWorkbenchPage view="tasks" />
                </RouteAccessGuard>
              }
            />
            <Route
              path="production/assets/:projectId"
              element={
                <RouteAccessGuard>
                  <ProductionWorkbenchPage view="assets" />
                </RouteAccessGuard>
              }
            />
            <Route
              path="production/export/:projectId"
              element={
                <RouteAccessGuard>
                  <ProductionWorkbenchPage view="export" />
                </RouteAccessGuard>
              }
            />
            <Route
              path="projects/:projectId"
              element={
                <RouteAccessGuard>
                  <CanonicalProjectEntry />
                </RouteAccessGuard>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function PilotStatePage({
  testId,
  title,
  message,
  action,
}: {
  testId: string;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <main className="d2-auth-page" data-testid={testId}>
      <section className="d2-pilot-status-card">
        <Typography.Title level={2}>{title}</Typography.Title>
        <Typography.Paragraph type="secondary">{message}</Typography.Paragraph>
        {action}
      </section>
    </main>
  );
}

function PilotServiceError() {
  const error = usePilotAuthStore((state) => state.error);
  const requestId = usePilotAuthStore((state) => state.requestId);
  const hydrate = usePilotAuthStore((state) => state.hydrate);
  return (
    <main className="d2-auth-page" data-testid="pilot-service-error">
      <section className="d2-pilot-status-card">
        <Typography.Title level={2}>Pilot 服务暂时不可用</Typography.Title>
        <Alert
          type="error"
          showIcon
          message={error ?? '无法恢复 Pilot 会话。'}
          description={requestId ? `请求 ID：${requestId}` : undefined}
        />
        <Button type="primary" onClick={() => void hydrate()}>
          重新连接
        </Button>
      </section>
    </main>
  );
}

function PilotRequireSession() {
  const location = useLocation();
  const status = usePilotAuthStore((state) => state.status);
  const hydrate = usePilotAuthStore((state) => state.hydrate);
  const session = usePilotAuthStore((state) => state.session);

  useEffect(() => {
    if (status === 'idle') void hydrate();
  }, [hydrate, status]);

  if (status === 'idle' || status === 'hydrating') {
    return (
      <div className="d2-session-loading" role="status">
        正在恢复真实会话...
      </div>
    );
  }
  if (status === 'service_error') return <PilotServiceError />;
  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }
  return <Outlet />;
}

function visiblePilotProjects(session: PilotSession, projects: readonly PilotProject[]) {
  const tenantId = session.activeContext.tenantId;
  if (!tenantId) return [];
  return projects.map((project) => ({ projectId: project.id, tenantId }));
}

function safePilotReturnPath(
  candidate: unknown,
  session: PilotSession,
  projects: readonly PilotProject[],
): string | null {
  if (
    typeof candidate !== 'string' ||
    candidate.length === 0 ||
    candidate !== candidate.trim() ||
    Array.from(candidate).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    })
  ) {
    return null;
  }

  const decision = authorizeTenantWorkbenchRoute({
    pathname: candidate,
    sessionTenantId: session.activeContext.tenantId,
    roleCodes: session.roles,
    visibleProjects: visiblePilotProjects(session, projects),
  });
  return decision.status === 'allowed' ? candidate : null;
}

function pilotDefaultPath(session: PilotSession, projects: readonly PilotProject[]): string | null {
  const decision = resolveTenantDefaultRoute({
    runtimeMode: 'pilot',
    sessionTenantId: session.activeContext.tenantId,
    roleCodes: session.roles,
    visibleProjects: visiblePilotProjects(session, projects),
  });
  return decision.status === 'allowed' ? decision.path : null;
}

function PilotLoginEntry() {
  const location = useLocation();
  const navigate = useNavigate();
  const status = usePilotAuthStore((state) => state.status);
  const hydrate = usePilotAuthStore((state) => state.hydrate);
  const session = usePilotAuthStore((state) => state.session);
  const projectStatus = usePilotProjectContextStore((state) => state.status);
  const projects = usePilotProjectContextStore((state) => state.projects);

  useEffect(() => {
    if (status === 'idle') void hydrate();
  }, [hydrate, status]);

  if (
    status === 'idle' ||
    status === 'hydrating' ||
    (session && (projectStatus === 'idle' || projectStatus === 'loading'))
  ) {
    return (
      <div className="d2-session-loading" role="status">
        正在恢复真实会话...
      </div>
    );
  }
  if (status === 'service_error') return <PilotServiceError />;
  if (session) {
    const returnTo = (location.state as { from?: unknown } | null)?.from;
    const target =
      safePilotReturnPath(returnTo, session, projects) ??
      pilotDefaultPath(session, projects) ??
      '/pilot';
    return <Navigate to={target} replace />;
  }
  return <LoginPage onRegister={() => navigate('/register')} />;
}

function PilotRegistrationEntry() {
  const location = useLocation();
  const navigate = useNavigate();
  const status = usePilotAuthStore((state) => state.status);
  const hydrate = usePilotAuthStore((state) => state.hydrate);
  const session = usePilotAuthStore((state) => state.session);
  const projectStatus = usePilotProjectContextStore((state) => state.status);
  const projects = usePilotProjectContextStore((state) => state.projects);
  const [{ invitationToken, sanitizedPath }] = useState(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('invitation');
    if (!params.has('invitation')) {
      return { invitationToken: null, sanitizedPath: null };
    }
    params.delete('invitation');
    const search = params.toString();
    return {
      invitationToken: token,
      sanitizedPath: `${location.pathname}${search ? `?${search}` : ''}${location.hash}`,
    };
  });

  useEffect(() => {
    if (sanitizedPath) navigate(sanitizedPath, { replace: true });
  }, [navigate, sanitizedPath]);

  useEffect(() => {
    if (status === 'idle') void hydrate();
  }, [hydrate, status]);

  if (
    status === 'idle' ||
    status === 'hydrating' ||
    (session && (projectStatus === 'idle' || projectStatus === 'loading'))
  ) {
    return (
      <div className="d2-session-loading" role="status">
        正在恢复真实会话...
      </div>
    );
  }
  if (status === 'service_error') return <PilotServiceError />;
  if (session) {
    const target = pilotDefaultPath(session, projects) ?? '/pilot';
    return <Navigate to={target} replace />;
  }
  return (
    <RegistrationPage
      invitationToken={invitationToken}
      onLogin={() => navigate('/login', { replace: true })}
    />
  );
}

function PilotTenantContextRequired() {
  const session = usePilotAuthStore((state) => state.session);
  const logout = usePilotAuthStore((state) => state.logout);
  const navigate = useNavigate();
  return (
    <PilotStatePage
      testId="pilot-tenant-context-required"
      title="需要 Tenant 上下文"
      message={`当前组织 ${session?.activeContext.organizationDisplayName ?? '未知'} 不是可进入企业创作工作台的 Tenant 上下文。Pilot 不会把 Platform/Channel 组织伪装成 Tenant，也不会回退 Demo。`}
      action={
        <Button
          onClick={() => {
            void logout().finally(() => navigate('/login', { replace: true }));
          }}
        >
          安全退出
        </Button>
      }
    />
  );
}

function PilotTenantBoundary() {
  const session = usePilotAuthStore((state) => state.session);
  const projectStatus = usePilotProjectContextStore((state) => state.status);
  const supportedRole =
    session?.roles.includes('tenant_admin') || session?.roles.includes('content_operator');

  if (!session) return null;
  if (projectStatus === 'unauthorized') return <Navigate to="/login" replace />;
  if (
    session.activeContext.organizationType !== 'TENANT' ||
    session.tenant === null ||
    !session.activeContext.tenantId ||
    !supportedRole ||
    projectStatus === 'tenant_context_required'
  ) {
    return <PilotTenantContextRequired />;
  }
  return <Outlet />;
}

function PilotDefaultEntry() {
  const session = usePilotAuthStore((state) => state.session);
  const projectStatus = usePilotProjectContextStore((state) => state.status);
  const projects = usePilotProjectContextStore((state) => state.projects);

  if (!session) return null;
  if (projectStatus === 'idle' || projectStatus === 'loading') {
    return <div role="status">正在加载真实项目范围...</div>;
  }
  const target = pilotDefaultPath(session, projects);
  return target ? <Navigate to={target} replace /> : <PilotTenantContextRequired />;
}

function PilotProjectServiceError() {
  const error = usePilotProjectContextStore((state) => state.error);
  const requestId = usePilotProjectContextStore((state) => state.requestId);
  const refreshProjectContext = usePilotAuthStore((state) => state.refreshProjectContext);
  const message = `${error ?? '无法加载当前 Project Scope。'}${
    requestId ? ` 请求 ID：${requestId}` : ''
  }`;
  return (
    <PilotStatePage
      testId="pilot-project-service-error"
      title="Project Scope 服务暂时不可用"
      message={message}
      action={
        <Button type="primary" onClick={() => void refreshProjectContext()}>
          重新加载项目
        </Button>
      }
    />
  );
}

function PilotProjectsPage() {
  const navigate = useNavigate();
  const projectStatus = usePilotProjectContextStore((state) => state.status);
  const projects = usePilotProjectContextStore((state) => state.projects);
  const activeProjectId = usePilotProjectContextStore((state) => state.activeProjectId);
  const selectProject = usePilotAuthStore((state) => state.selectProject);

  if (projectStatus === 'idle' || projectStatus === 'loading') {
    return <div role="status">正在加载真实项目范围...</div>;
  }
  if (projectStatus === 'service_error') return <PilotProjectServiceError />;
  if (projectStatus === 'forbidden') {
    return (
      <PilotStatePage
        testId="pilot-project-forbidden"
        title="无权读取 Project Scope"
        message="服务端拒绝了当前 Membership 的项目列表请求。认证 Session 保留，但不会展示 Demo 项目。"
      />
    );
  }
  if (projectStatus === 'not_found') {
    return (
      <PilotStatePage
        testId="pilot-project-not-found"
        title="项目不存在或不在当前可见范围"
        message="服务端未返回可见 Project；请返回项目列表或联系管理员检查 Assignment。"
      />
    );
  }
  if (projectStatus === 'empty' || projects.length === 0) {
    return (
      <PilotStatePage
        testId="pilot-project-empty"
        title="暂无可访问项目"
        message="当前 Membership 没有服务端可见 Project。系统不会回退海底捞 Demo，也不会猜测 Assignment。"
      />
    );
  }

  return (
    <main data-testid="pilot-project-list">
      <Typography.Title level={2}>真实项目</Typography.Title>
      <Typography.Paragraph type="secondary">
        仅显示 Control API 返回给当前 Membership 的 Project Scope。
      </Typography.Paragraph>
      <Space direction="vertical" size={12}>
        {projects.map((project) => (
          <Button
            key={project.id}
            type={project.id === activeProjectId ? 'primary' : 'default'}
            onClick={() => {
              void selectProject(project.id).then((result) => {
                if (result?.status === 'ready') navigate(`/projects/${project.id}/brand`);
              });
            }}
          >
            {project.name} · {project.id}
          </Button>
        ))}
      </Space>
    </main>
  );
}

function PilotManifestRoute({ route }: { route: TenantRouteManifestEntry }) {
  const location = useLocation();
  const session = usePilotAuthStore((state) => state.session);
  const projectStatus = usePilotProjectContextStore((state) => state.status);
  const projects = usePilotProjectContextStore((state) => state.projects);

  if (!session) return null;
  if (projectStatus === 'idle' || projectStatus === 'loading') {
    return <div role="status">正在加载真实项目范围...</div>;
  }
  if (projectStatus === 'service_error') return <PilotProjectServiceError />;
  if (projectStatus === 'forbidden') {
    return (
      <PilotStatePage
        testId="pilot-route-permission-denied"
        title={`无权访问${route.label}`}
        message="服务端拒绝了当前 Membership 的 Project Scope，前端不会显示 Demo 内容。"
      />
    );
  }

  const decision = authorizeTenantWorkbenchRoute({
    pathname: `${location.pathname}${location.search}${location.hash}`,
    sessionTenantId: session.activeContext.tenantId,
    roleCodes: session.roles,
    visibleProjects: visiblePilotProjects(session, projects),
  });

  if (decision.status === 'tenant-context-required') return <PilotTenantContextRequired />;
  if (decision.status === 'project-not-found') {
    return (
      <PilotStatePage
        testId="pilot-project-not-found"
        title="项目不存在或不在当前可见范围"
        message="该 Project ID 未出现在服务端当前 Membership 的可见列表中。系统不会读取其他 Tenant 或 Demo 项目。"
      />
    );
  }
  if (decision.status === 'permission-denied') {
    return (
      <PilotStatePage
        testId="pilot-route-permission-denied"
        title={`无权访问${route.label}`}
        message="当前 Role 不具备该 Manifest 路由的能力。隐藏菜单不会替代服务端授权。"
      />
    );
  }
  if (decision.status === 'unregistered') return <NotFoundPage />;

  const projectCopy = decision.projectId ? `Project ${decision.projectId} · ` : '';
  if (route.pilotReadiness === 'handoff-required') {
    return (
      <PilotStatePage
        testId="pilot-route-handoff"
        title={route.label}
        message={`${projectCopy}路由和 Membership Scope 已接通，但该页面尚未接入真实 Pilot 数据。当前只显示 handoff 状态，不会把 Demo 内容伪装成生产成功。`}
      />
    );
  }
  return (
    <PilotStatePage
      testId="pilot-route-unavailable"
      title={route.label}
      message={`${projectCopy}该能力尚未在 Pilot 实现。系统保留真实 Session 与 Project Context，但不会回退 Demo。`}
    />
  );
}

function PilotConfigurationBlock() {
  return (
    <main className="d2-auth-page" data-testid="pilot-configuration-error">
      <section className="d2-pilot-status-card">
        <Typography.Title level={2}>运行配置已阻断</Typography.Title>
        <Alert type="error" showIcon message={pilotRuntime.configurationError} />
      </section>
    </main>
  );
}

function PilotRouter() {
  if (pilotRuntime.configurationError) return <PilotConfigurationBlock />;
  const manifestRoutes = TENANT_ROUTE_MANIFEST.filter((route) => route.pattern !== '/projects');
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PilotLoginEntry />} />
        <Route path="/register" element={<PilotRegistrationEntry />} />
        <Route element={<PilotRequireSession />}>
          <Route element={<PilotTenantBoundary />}>
            <Route element={<AppShell />}>
              <Route index element={<PilotDefaultEntry />} />
              <Route path="/pilot" element={<PilotDefaultEntry />} />
              <Route path="/projects" element={<PilotProjectsPage />} />
              {manifestRoutes.map((route) => (
                <Route
                  key={route.key}
                  path={route.pattern}
                  element={<PilotManifestRoute route={route} />}
                />
              ))}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export function AppRouter() {
  if (pilotRuntime.mode === null) return <PilotConfigurationBlock />;
  return pilotRuntime.mode === 'pilot' ? <PilotRouter /> : <DemoRouter />;
}
