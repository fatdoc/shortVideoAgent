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
    expect(screen.getByText('本周导出视频')).toBeInTheDocument();
    expect(screen.getByText('本周数据概览')).toBeInTheDocument();
    expect(screen.getAllByAltText(/项目缩略图/)).toHaveLength(5);
    expect(screen.getByTestId('dashboard-insights')).toBeInTheDocument();
    expect(screen.getAllByTestId('dashboard-project-row')).toHaveLength(5);
    expect(screen.getByText('总体预估收益（本月）')).toBeInTheDocument();
    const workflow = screen.getByTestId('workflow-progress');
    expect(workflow).toHaveTextContent('Brief');
    expect(workflow).toHaveTextContent('脚本');
    expect(workflow).toHaveTextContent('分镜');
    expect(workflow).toHaveTextContent('素材');
    expect(workflow).toHaveTextContent('初剪');
    expect(workflow).toHaveTextContent('审核');
    expect(workflow).toHaveTextContent('导出');
    expect(workflow).not.toHaveTextContent('品牌');
  });

  it('opens the Brief route from new project', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId('dashboard-new-project'));
    expect(await screen.findByText('Brief route')).toBeInTheDocument();
  });

  it('selects a local preview case without replacing the unified workspace', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId('dashboard-select-preview-founder-002'));
    expect(screen.getByText('已选：创始人 IP · 张总访谈')).toBeInTheDocument();
    expect(useProjectStore.getState().workspace.project.id).toBe('demo-local-001');
  });
});
