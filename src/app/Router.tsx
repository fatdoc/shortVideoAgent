import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { BriefPage } from '../pages/brief/BriefPage';
import { BrandBrainPage } from '../pages/brand-brain/BrandBrainPage';
import { ScriptEditorPage } from '../pages/script-editor/ScriptEditorPage';
import { StoryboardPage } from '../pages/storyboard/StoryboardPage';
import { RoughCutPage } from '../pages/rough-cut/RoughCutPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RoleWorkbenchPage } from '../pages/workbench/RoleWorkbenchPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { DEMO_PROJECT_ID } from '../domain/constants';
import { useAuthStore } from '../stores/authStore';

function AuthGate() {
  const location = useLocation();
  const status = useAuthStore((state) => state.status);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    if (status === 'idle') hydrate();
  }, [hydrate, status]);

  if (status === 'idle' || status === 'hydrating') return null;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

function LoginRoute() {
  const status = useAuthStore((state) => state.status);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const defaultRoute = useAuthStore((state) => state.defaultRoute);
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    if (status === 'idle') hydrate();
  }, [hydrate, status]);

  if (status === 'idle' || status === 'hydrating') return null;
  if (isAuthenticated) return <Navigate to={defaultRoute ?? '/dashboard'} replace />;

  return <LoginPage />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="login" element={<LoginRoute />} />
        <Route element={<AuthGate />}>
          <Route path="platform/overview" element={<RoleWorkbenchPage workbench="platform" />} />
          <Route path="channel/overview" element={<RoleWorkbenchPage workbench="channel" />} />
          <Route path="production/overview" element={<RoleWorkbenchPage workbench="production" />} />
        </Route>
        <Route element={<AuthGate />}>
          <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="projects/new" element={<BriefPage />} />
          <Route path="projects/:projectId/brand" element={<BrandBrainPage />} />
          <Route path="projects/:projectId/script" element={<ScriptEditorPage />} />
          <Route path="projects/:projectId/storyboard" element={<StoryboardPage />} />
          <Route path="projects/:projectId/rough-cut" element={<RoughCutPage />} />
          <Route
            path="projects/:projectId"
            element={<Navigate to={`/projects/${DEMO_PROJECT_ID}/brand`} replace />}
          />
          <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
