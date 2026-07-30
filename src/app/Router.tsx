import { Button, Result } from 'antd';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
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
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/platform/overview" replace />} />
          <Route
            path="platform/overview"
            element={<WorkbenchHomePage kind="platform" />}
          />
          <Route
            path="platform/organizations"
            element={<WorkbenchHomePage kind="platform" />}
          />
          <Route
            path="platform/catalog"
            element={<ProductCatalogPage audience="platform" />}
          />
          <Route
            path="platform/production-receipts"
            element={<PlatformReceiptMonitorPage />}
          />
          <Route
            path="channel/overview"
            element={<WorkbenchHomePage kind="channel" />}
          />
          <Route
            path="channel/products"
            element={<ProductCatalogPage audience="channel" />}
          />
          <Route
            path="channel/customers"
            element={<WorkbenchHomePage kind="channel" />}
          />
          <Route
            path="channel/customers/:tenantId/usage"
            element={<WorkbenchHomePage kind="channel" />}
          />
          <Route
            path="enterprise/products"
            element={<ProductCatalogPage audience="tenant" />}
          />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="projects/new" element={<BriefPage />} />
          <Route path="projects/:projectId/brand" element={<BrandBrainPage />} />
          <Route path="projects/:projectId/script" element={<ScriptEditorPage />} />
          <Route path="projects/:projectId/storyboard" element={<StoryboardPage />} />
          <Route path="projects/:projectId/rough-cut" element={<RoughCutPage />} />
          <Route
            path="projects/:projectId/usage"
            element={<RoughCutPage view="assets" />}
          />
          <Route
            path="projects/:projectId/delivery"
            element={<RoughCutPage view="export" />}
          />
          <Route
            path="production/overview"
            element={<ProductionWorkbenchPage />}
          />
          <Route
            path="production/inbox/:projectId"
            element={<ProductionWorkbenchPage view="inbox" />}
          />
          <Route
            path="production/canvas/:projectId"
            element={<ProductionWorkbenchPage view="inbox" />}
          />
          <Route
            path="production/tasks/:projectId"
            element={<ProductionWorkbenchPage view="tasks" />}
          />
          <Route
            path="production/assets/:projectId"
            element={<ProductionWorkbenchPage view="assets" />}
          />
          <Route
            path="production/export/:projectId"
            element={<ProductionWorkbenchPage view="export" />}
          />
          <Route
            path="projects/:projectId"
            element={<CanonicalProjectEntry />}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
