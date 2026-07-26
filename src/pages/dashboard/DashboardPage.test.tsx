import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/Providers';
import { cloneDemoWorkspace } from '../../mocks/demoWorkspace';
import { useProjectStore } from '../../stores/projectStore';
import { DashboardPage } from './DashboardPage';

function renderPage() {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects/new" element={<div>Brief route</div>} />
          <Route path="/projects/:projectId/script" element={<div>Script route</div>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    useProjectStore.setState({
      workspace: cloneDemoWorkspace(),
      loading: false,
      error: null,
      hydrated: true,
      lastAction: null,
    });
  });

  it('renders unified demo metrics and project row', () => {
    renderPage();
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    expect(screen.getByText('海底捞火锅·北京三里屯店探店视频')).toBeInTheDocument();
    expect(screen.getByText('品牌事实')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-progress')).toBeInTheDocument();
  });

  it('opens the Brief route from new project', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId('dashboard-new-project'));
    expect(await screen.findByText('Brief route')).toBeInTheDocument();
  });
});
