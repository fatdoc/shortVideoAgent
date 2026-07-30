import { Button, Result } from 'antd';
import { useEffect, type ReactNode } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { AppShell } from '../layouts/AppShell';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { BriefPage } from '../pages/brief/BriefPage';
import { BrandBrainPage } from '../pages/brand-brain/BrandBrainPage';
import { ScriptEditorPage } from '../pages/script-editor/ScriptEditorPage';
import { StoryboardPage } from '../pages/storyboard/StoryboardPage';
import { RoughCutPage } from '../pages/rough-cut/RoughCutPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { DEMO_PROJECT_ID } from '../domain/constants';
import {
  PlatformReceiptMonitorPage,
  WorkbenchHomePage,
} from '../pages/workbench/WorkbenchHomePage';
import { ProductCatalogPage } from '../pages/commercial/ProductCatalogPage';
import { ProductionWorkbenchPage } from '../pages/production/ProductionWorkbenchPage';
import { LoginPage } from '../pages/auth/LoginPage';
import {
  canAccessDemoWorkbench,
  type DemoWorkbench,
} from '../domain/demoIdentity';
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
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

function LoginEntry() {
  const status = useAuthStore((state) => state.status);
  const hydrate = useAuthStore((state) => state.hydrate);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const defaultRoute = useAuthStore((state) => state.defaultRoute);

  useEffect(() => {
    if (status === 'idle') hydrate();
  }, [hydrate, status]);

  if (status === 'idle' || status === 'hydrating') return <SessionLoading />;
  if (isAuthenticated) {
    return <Navigate to={defaultRoute ?? '/dashboard'} replace />;
  }
  return <LoginPage />;
}

function DefaultEntry() {
  const defaultRoute = useAuthStore((state) => state.defaultRoute);
  return <Navigate to={defaultRoute ?? '/login'} replace />;
}

function WorkbenchAccessGuard({
  workbench,
  children,
}: {
  workbench: DemoWorkbench;
  children: ReactNode;
}) {
  const identity = useAuthStore((state) => state.identity);
  const navigate = useNavigate();

  if (canAccessDemoWorkbench(identity, workbench)) return children;

  return (
    <Result
      status="403"
      title="WORKBENCH_SCOPE_DENIED"
      subTitle={`当前身份“${identity?.displayName ?? '未识别'}”无权进入该工作台。Demo 身份也必须遵守角色边界。`}
      extra={
        <Button
          type="primary"
          onClick={() => navigate(identity?.defaultRoute ?? '/login', { replace: true })}
        >
          返回我的工作台
        </Button>
      }
    />
  );
}

function CanonicalProjectEntry() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId?: string }>();

  if (projectId === DEMO_PROJECT_ID) {
    return <Navigate to={`/projects/${DEMO_PROJECT_ID}/brand`} replace />;
  }

  return (
    <Result
      status="403"
      title="ROUTE_ID_REJECTED"
      subTitle={`Project ${projectId ?? 'missing'} 不是 canonical Demo 身份；已安全拒绝，未映射到 ${DEMO_PROJECT_ID}。`}
      extra={
        <Button type="primary" onClick={() => navigate('/dashboard')}>
          返回企业工作台
        </Button>
      }
    />
  );
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
              <WorkbenchAccessGuard workbench="platform">
                <WorkbenchHomePage kind="platform" />
              </WorkbenchAccessGuard>
            }
          />
          <Route
            path="platform/organizations"
            element={
              <WorkbenchAccessGuard workbench="platform">
                <WorkbenchHomePage kind="platform" />
              </WorkbenchAccessGuard>
            }
          />
          <Route
            path="platform/catalog"
            element={
              <WorkbenchAccessGuard workbench="platform">
                <ProductCatalogPage audience="platform" />
              </WorkbenchAccessGuard>
            }
          />
          <Route
            path="platform/production-receipts"
            element={
              <WorkbenchAccessGuard workbench="platform">
                <PlatformReceiptMonitorPage />
              </WorkbenchAccessGuard>
            }
          />
          <Route
            path="channel/overview"
            element={
              <WorkbenchAccessGuard workbench="channel">
                <WorkbenchHomePage kind="channel" />
              </WorkbenchAccessGuard>
            }
          />
          <Route
            path="channel/products"
            element={
              <WorkbenchAccessGuard workbench="channel">
                <ProductCatalogPage audience="channel" />
              </WorkbenchAccessGuard>
            }
          />
          <Route
            path="channel/customers"
            element={
              <WorkbenchAccessGuard workbench="channel">
                <WorkbenchHomePage kind="channel" />
              </WorkbenchAccessGuard>
            }
          />
          <Route
            path="channel/customers/:tenantId/usage"
            element={
              <WorkbenchAccessGuard workbench="channel">
                <WorkbenchHomePage kind="channel" />
              </WorkbenchAccessGuard>
            }
          />
          <Route
            path="enterprise/products"
            element={
              <WorkbenchAccessGuard workbench="tenant">
                <ProductCatalogPage audience="tenant" />
              </WorkbenchAccessGuard>
            }
          />
          <Route path="dashboard" element={<WorkbenchAccessGuard workbench="tenant"><DashboardPage /></WorkbenchAccessGuard>} />
          <Route path="projects/new" element={<WorkbenchAccessGuard workbench="tenant"><BriefPage /></WorkbenchAccessGuard>} />
          <Route path="projects/:projectId/brand" element={<WorkbenchAccessGuard workbench="tenant"><BrandBrainPage /></WorkbenchAccessGuard>} />
          <Route path="projects/:projectId/script" element={<WorkbenchAccessGuard workbench="tenant"><ScriptEditorPage /></WorkbenchAccessGuard>} />
          <Route path="projects/:projectId/storyboard" element={<WorkbenchAccessGuard workbench="tenant"><StoryboardPage /></WorkbenchAccessGuard>} />
          <Route path="projects/:projectId/rough-cut" element={<WorkbenchAccessGuard workbench="tenant"><RoughCutPage /></WorkbenchAccessGuard>} />
          <Route
            path="projects/:projectId/usage"
            element={<WorkbenchAccessGuard workbench="tenant"><RoughCutPage view="assets" /></WorkbenchAccessGuard>}
          />
          <Route
            path="projects/:projectId/delivery"
            element={<WorkbenchAccessGuard workbench="tenant"><RoughCutPage view="export" /></WorkbenchAccessGuard>}
          />
          <Route
            path="production/overview"
            element={<WorkbenchAccessGuard workbench="production"><ProductionWorkbenchPage /></WorkbenchAccessGuard>}
          />
          <Route
            path="production/inbox/:projectId"
            element={<WorkbenchAccessGuard workbench="production"><ProductionWorkbenchPage view="inbox" /></WorkbenchAccessGuard>}
          />
          <Route
            path="production/canvas/:projectId"
            element={<WorkbenchAccessGuard workbench="production"><ProductionWorkbenchPage view="inbox" /></WorkbenchAccessGuard>}
          />
          <Route
            path="production/tasks/:projectId"
            element={<WorkbenchAccessGuard workbench="production"><ProductionWorkbenchPage view="tasks" /></WorkbenchAccessGuard>}
          />
          <Route
            path="production/assets/:projectId"
            element={<WorkbenchAccessGuard workbench="production"><ProductionWorkbenchPage view="assets" /></WorkbenchAccessGuard>}
          />
          <Route
            path="production/export/:projectId"
            element={<WorkbenchAccessGuard workbench="production"><ProductionWorkbenchPage view="export" /></WorkbenchAccessGuard>}
          />
          <Route
            path="projects/:projectId"
            element={<WorkbenchAccessGuard workbench="tenant"><CanonicalProjectEntry /></WorkbenchAccessGuard>}
          />
          <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
