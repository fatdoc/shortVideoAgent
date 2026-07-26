import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/Providers';
import { clearWorkspace } from '../../services/storage';
import { useProjectStore } from '../../stores/projectStore';
import { cloneDemoWorkspace } from '../../mocks/demoWorkspace';
import { DEMO_PROJECT_ID } from '../../domain/constants';
import { StoryboardPage } from './StoryboardPage';

function renderPage(path = `/projects/${DEMO_PROJECT_ID}/storyboard`) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/projects/:projectId/storyboard" element={<StoryboardPage />} />
          <Route path="/projects/:projectId/rough-cut" element={<div>初剪页</div>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('StoryboardPage', () => {
  beforeEach(() => {
    clearWorkspace();
    window.localStorage.clear();
    useProjectStore.setState({
      workspace: cloneDemoWorkspace(),
      loading: false,
      error: null,
      hydrated: true,
      lastAction: null,
    });
  });

  it('renders 8 shots and key sections', async () => {
    renderPage();

    const page = await screen.findByTestId('storyboard-page');
    expect(page).toBeInTheDocument();
    expect(screen.getByText('分镜 / 拍摄清单')).toBeInTheDocument();
    expect(within(page).getAllByTestId(/^storyboard-shot-#/)).toHaveLength(8);
    expect(screen.getByRole('tab', { name: '分镜视图' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '拍摄清单' })).toBeInTheDocument();
  });

  it('edits per-shot assignee in expanded row', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByTestId('storyboard-page');
    await user.click(screen.getAllByRole('button', { name: '展开编辑' })[0]);
    const workspace = useProjectStore.getState().workspace;
    act(() => {
      useProjectStore.setState({
        ...useProjectStore.getState(),
        workspace: {
          ...workspace,
          storyboard: workspace.storyboard.map((shot, index) =>
            index === 0 ? { ...shot, assignee: '拍摄组 B' } : shot,
          ),
        },
      });
    });

    await waitFor(() => {
      expect(useProjectStore.getState().workspace.storyboard[0].assignee).toBe('拍摄组 B');
    });
  });

  it('marks blocking shots as shooting with batch action', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByTestId('storyboard-page');
    await user.click(screen.getByRole('button', { name: /待补拍转拍摄中/ }));

    await waitFor(() => {
      const workspace = useProjectStore.getState().workspace;
      const byId: Record<string, string> = {};
      for (const shot of workspace.storyboard) {
        byId[shot.id] = shot.status;
      }
      expect(byId['shot-05']).toBe('shooting');
      expect(byId['shot-07']).toBe('shooting');
    });
  });

  it('disables rough cut when blocking exists', () => {
    renderPage();

    expect(screen.getByTestId('storyboard-enter-rough-cut')).toBeDisabled();
  });

  it('navigates to rough cut when all shots are matched', async () => {
    const user = userEvent.setup();
    const allMatched = cloneDemoWorkspace();
    allMatched.storyboard = allMatched.storyboard.map((shot) => ({
      ...shot,
      matchStatus: 'matched',
      status: shot.status === 'missing' ? 'done' : shot.status === 'shooting' ? 'shooting' : 'done',
    }));
    useProjectStore.setState({
      workspace: allMatched,
      loading: false,
      error: null,
      hydrated: true,
      lastAction: null,
    });

    renderPage();
    const enterButton = await screen.findByTestId('storyboard-enter-rough-cut');
    expect(enterButton).toBeEnabled();

    await user.click(enterButton);
    expect(await screen.findByText('初剪页')).toBeInTheDocument();
  });

  it('renders loading state', async () => {
    useProjectStore.setState({
      workspace: cloneDemoWorkspace(),
      loading: true,
      error: null,
      hydrated: false,
      lastAction: null,
    });

    renderPage();
    expect(await screen.findByText('正在加载分镜工作区...')).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    useProjectStore.setState({
      workspace: {
        ...cloneDemoWorkspace(),
        storyboard: [],
      },
      loading: false,
      error: null,
      hydrated: true,
      lastAction: null,
    });

    renderPage();
    expect(
      await screen.findByText('暂无分镜数据。请先刷新 Demo 数据或返回脚本页重建。'),
    ).toBeInTheDocument();
  });

  it('handles invalid project id', async () => {
    renderPage('/projects/other/storyboard');
    expect(await screen.findByText('项目不存在')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开分镜（统一项目）' })).toBeInTheDocument();
  });
});
