import { Alert, Button, Typography } from 'antd';
import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { pilotRuntime } from '../config/pilotRuntime';
import { DEMO_PROJECT_ID } from '../domain/constants';
import { authorizeDemoNavigationRoute } from '../domain/demoRouteAccess';
import { AppShell } from '../layouts/AppShell';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RouteAccessDeniedPage } from '../pages/auth/RouteAccessDeniedPage';
import { LoginPage } from '../pages/auth/LoginPage';
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
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function PilotLoginEntry() {
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
  if (session) return <Navigate to="/pilot" replace />;
  return <LoginPage />;
}

function PilotSessionPage() {
  const session = usePilotAuthStore((state) => state.session);
  const logout = usePilotAuthStore((state) => state.logout);
  if (!session) return null;

  return (
    <main className="d2-auth-page" data-testid="pilot-session-page">
      <section className="d2-pilot-status-card">
        <Typography.Text type="success">真实会话已建立</Typography.Text>
        <Typography.Title level={2}>欢迎，{session.user.displayName}</Typography.Title>
        <Typography.Paragraph>
          当前组织：{session.tenant?.displayName ?? '非 Tenant 组织'} · {session.user.email}
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          F01 仅完成真实认证接线。真实项目、生产与额度界面将在 F02 接入，当前不会展示 Demo
          业务数据。
        </Typography.Paragraph>
        <Button onClick={() => void logout()}>安全退出</Button>
      </section>
    </main>
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
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PilotLoginEntry />} />
        <Route element={<PilotRequireSession />}>
          <Route path="/pilot" element={<PilotSessionPage />} />
          <Route path="*" element={<Navigate to="/pilot" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export function AppRouter() {
  if (pilotRuntime.mode === null) return <PilotConfigurationBlock />;
  return pilotRuntime.mode === 'pilot' ? <PilotRouter /> : <DemoRouter />;
}
