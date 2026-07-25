import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { BriefPage } from '../pages/brief/BriefPage';
import { BrandBrainPage } from '../pages/brand-brain/BrandBrainPage';
import { ScriptEditorPage } from '../pages/script-editor/ScriptEditorPage';
import { StoryboardPage } from '../pages/storyboard/StoryboardPage';
import { RoughCutPage } from '../pages/rough-cut/RoughCutPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { DEMO_PROJECT_ID } from '../domain/constants';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
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
      </Routes>
    </BrowserRouter>
  );
}
