import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '../../app/Providers';
import { ScriptEditorPage } from './ScriptEditorPage';
import { useProjectStore } from '../../stores/projectStore';
import { clearWorkspace } from '../../services/storage';
import { cloneDemoWorkspace } from '../../mocks/demoWorkspace';
import { DEMO_PROJECT_ID } from '../../domain/constants';

const updateScriptAction = useProjectStore.getState().updateScript;

function renderPage(path = `/projects/${DEMO_PROJECT_ID}/script`) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/projects/:projectId/script" element={<ScriptEditorPage />} />
          <Route path="/projects/:projectId/storyboard" element={<div>分镜页占位</div>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('ScriptEditorPage', () => {
  beforeEach(() => {
    clearWorkspace();
    window.localStorage.clear();
    useProjectStore.setState({
      workspace: cloneDemoWorkspace(),
      loading: false,
      error: null,
      hydrated: true,
      lastAction: null,
      updateScript: updateScriptAction,
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders A/B/C versions and five script blocks', async () => {
    renderPage();
    expect(await screen.findByTestId('script-editor-page')).toBeInTheDocument();
    expect(screen.getByTestId('script-version-script-a')).toBeInTheDocument();
    expect(screen.getByTestId('script-version-script-b')).toBeInTheDocument();
    expect(screen.getByTestId('script-version-script-c')).toBeInTheDocument();
    expect(screen.getByTestId('script-block-hook')).toBeInTheDocument();
    expect(screen.getByTestId('script-block-body')).toBeInTheDocument();
    expect(screen.getByTestId('script-block-proof')).toBeInTheDocument();
    expect(screen.getByTestId('script-block-cta')).toBeInTheDocument();
    expect(screen.getByTestId('script-block-disclaimer')).toBeInTheDocument();
    expect(screen.getByTestId('script-claim-list')).toBeInTheDocument();
    expect(screen.getByTestId('script-score-panel')).toBeInTheDocument();
    expect(screen.getByTestId('script-risk-panel')).toBeInTheDocument();
  });

  it('switches script version via store', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('script-editor-page');
    await user.click(screen.getByTestId('script-version-script-b'));
    await waitFor(() => {
      expect(useProjectStore.getState().workspace.activeScriptId).toBe('script-b');
    });
    expect(await screen.findByDisplayValue(/不只是吃火锅/)).toBeInTheDocument();
  });

  it('edits block content and marks dirty until save', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('script-editor-page');
    const hookInput = screen.getByTestId('script-block-content-hook');
    await user.clear(hookInput);
    await user.type(hookInput, '三里屯探店开场测试文案');
    expect(screen.getByText('未保存')).toBeInTheDocument();
    await user.click(screen.getByTestId('script-save-btn'));
    await waitFor(() => {
      const active = useProjectStore
        .getState()
        .workspace.scripts.find((s) => s.id === 'script-a');
      expect(active?.blocks.find((b) => b.type === 'hook')?.content).toContain(
        '三里屯探店开场测试文案',
      );
    });
    expect(await screen.findByText('已同步')).toBeInTheDocument();
  });

  it('toggles claim citation from claim panel', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('script-editor-page');
    await user.click(screen.getByTestId('script-block-body'));
    await user.click(screen.getByTestId('script-claim-C2'));
    await waitFor(() => {
      const body = screen.getByTestId('script-block-body');
      const texts = within(body).getAllByText(/C2/);
      expect(texts.length).toBeGreaterThan(0);
      // draft claimIds should include C2 on body
      // verified via chip + description lines
      expect(body.textContent).toMatch(/C2/);
      expect(body.textContent).toMatch(/营业时间/);
    });
  });

  it('mock generate shows loading then updates draft', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('script-editor-page');
    await user.click(screen.getByTestId('script-generate-btn'));
    expect(await screen.findByText(/正在 Mock 生成/)).toBeInTheDocument();
    await waitFor(
      () => {
        expect(screen.queryByText(/正在 Mock 生成/)).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.getByText('未保存')).toBeInTheDocument();
  });

  it('navigates to storyboard entry', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('script-editor-page');
    await user.click(screen.getByTestId('script-to-storyboard-btn'));
    expect(await screen.findByText('分镜页占位')).toBeInTheDocument();
  });

  it('stays in the editor when a dirty draft cannot be saved before navigation', async () => {
    const user = userEvent.setup();
    useProjectStore.setState({
      updateScript: vi.fn().mockRejectedValue(new Error('模拟保存失败')),
    });
    renderPage();
    await screen.findByTestId('script-editor-page');

    const hookInput = screen.getByTestId('script-block-content-hook');
    await user.clear(hookInput);
    await user.type(hookInput, '这条脏稿不应在保存失败后进入分镜');
    await user.click(screen.getByTestId('script-to-storyboard-btn'));

    expect((await screen.findAllByText('模拟保存失败')).length).toBeGreaterThan(0);
    expect(screen.getByTestId('script-editor-page')).toBeInTheDocument();
    expect(screen.queryByText('分镜页占位')).not.toBeInTheDocument();
  });

  it('resyncs the draft when the shared workspace is reset externally', async () => {
    const user = userEvent.setup();
    const initialHook = cloneDemoWorkspace().scripts[0].blocks.find(
      (block) => block.type === 'hook',
    )?.content;
    renderPage();
    await screen.findByTestId('script-editor-page');

    const hookInput = screen.getByTestId('script-block-content-hook');
    await user.clear(hookInput);
    await user.type(hookInput, '等待外部重置的本地脏稿');
    expect(screen.getByText('未保存')).toBeInTheDocument();

    await act(async () => {
      await useProjectStore.getState().reset();
    });

    expect(await screen.findByDisplayValue(initialHook ?? '')).toBeInTheDocument();
    expect(screen.getByText('已同步')).toBeInTheDocument();
  });
});
