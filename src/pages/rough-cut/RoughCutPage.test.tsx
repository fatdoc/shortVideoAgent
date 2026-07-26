import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/Providers';
import { DEMO_PROJECT_ID } from '../../domain/constants';
import { cloneDemoWorkspace } from '../../mocks/demoWorkspace';
import { clearWorkspace } from '../../services/storage';
import { useProjectStore } from '../../stores/projectStore';
import { RoughCutPage } from './RoughCutPage';

const updateTimelineAction = useProjectStore.getState().updateTimeline;

function renderPage(path = `/projects/${DEMO_PROJECT_ID}/rough-cut`) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/projects/:projectId/rough-cut" element={<RoughCutPage />} />
          <Route path="*" element={<div>route not handled</div>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('RoughCutPage', () => {
  beforeEach(() => {
    clearWorkspace();
    window.localStorage.clear();
    useProjectStore.setState({
      workspace: cloneDemoWorkspace(),
      loading: false,
      error: null,
      hydrated: true,
      lastAction: null,
      updateTimeline: updateTimelineAction,
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('filters assets and appends selected asset to current timeline track', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('rough-cut-page');

    await user.type(screen.getByTestId('rough-cut-asset-search'), '虾滑');
    expect(await screen.findByTestId('rough-cut-asset-card-asset-shrimp')).toBeInTheDocument();

    const beforeCount = useProjectStore.getState().workspace.timeline.clips.length;
    await user.click(screen.getByTestId('rough-cut-asset-card-asset-shrimp'));
    await user.click(screen.getByTestId('rough-cut-add-video'));

    await waitFor(() => {
      expect(useProjectStore.getState().workspace.timeline.clips).toHaveLength(beforeCount + 1);
    });

    const clips = useProjectStore.getState().workspace.timeline.clips;
    const newestClip = clips[clips.length - 1];
    const latestTrack = 'track-video';
    expect(clips[clips.length - 1].trackId).toBe(latestTrack);
    expect(newestClip.assetId).toBe('asset-shrimp');
  });

  it('allows selecting timeline clip then removing it', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('rough-cut-page');

    await user.click(screen.getByTestId('rough-cut-asset-card-asset-hotpot'));
    await user.click(screen.getByTestId('rough-cut-add-voice'));

    await waitFor(() => {
      const latest = useProjectStore.getState().workspace.timeline.clips.at(-1);
      expect(latest).toBeTruthy();
      expect(latest?.assetId).toBe('asset-hotpot');
    });

    const latest = useProjectStore.getState().workspace.timeline.clips.at(-1);
    const latestId = latest?.id;
    expect(latestId).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId(`rough-cut-clip-${latestId}`)).toBeInTheDocument();
    });
    await user.click(screen.getByTestId(`rough-cut-clip-${latestId}`));

    await user.click(screen.getByTestId('rough-cut-remove-clip'));

    await waitFor(() => {
      expect(
        useProjectStore
          .getState()
          .workspace.timeline.clips.some((clip) => clip.id === latestId),
      ).toBe(false);
    });
  });

  it('shows QA panel and keep export disabled while qa status is not pass', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('rough-cut-page');

    await user.click(screen.getByRole('button', { name: '导出' }));
    expect(screen.getByTestId('rough-cut-export')).toBeDisabled();
    expect(screen.getByText('导出规则')).toBeInTheDocument();
    expect(screen.getAllByText('缺镜').length).toBeGreaterThan(0);
  });

  it('handles invalid project id with guard state', async () => {
    renderPage('/projects/other/rough-cut');
    expect(await screen.findByText('项目不存在')).toBeInTheDocument();
    expect(screen.getByText(/当前为 other/)).toBeInTheDocument();
  });
});
