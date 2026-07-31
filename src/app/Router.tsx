import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
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

export function AppRouter() {
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
                  <ProductCatalogPage audience="tenant" />
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
