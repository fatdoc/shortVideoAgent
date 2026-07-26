import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/Providers';
import { cloneDemoWorkspace } from '../../mocks/demoWorkspace';
import { clearWorkspace } from '../../services/storage';
import { useProjectStore } from '../../stores/projectStore';
import { BriefPage } from './BriefPage';

function renderPage() {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={['/projects/new']}>
        <Routes>
          <Route path="/projects/new" element={<BriefPage />} />
          <Route path="/projects/:projectId/script" element={<div>Script route</div>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('BriefPage', () => {
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

  it('saves edited Brief fields through the shared store', async () => {
    const user = userEvent.setup();
    renderPage();
    const merchant = screen.getByTestId('brief-merchant');
    await user.clear(merchant);
    await user.type(merchant, '海底捞火锅·北京三里屯店');
    await user.click(screen.getByTestId('brief-save'));
    await waitFor(() => {
      expect(useProjectStore.getState().workspace.brief.merchantName).toBe(
        '海底捞火锅·北京三里屯店',
      );
    });
    expect(await screen.findByText('已保存')).toBeInTheDocument();
  });

  it('simulates asset upload and applies AI suggestions', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByText('已有 6 个素材引用')).toBeInTheDocument();
    await user.click(screen.getByTestId('brief-upload'));
    expect(screen.getByText('已有 7 个素材引用')).toBeInTheDocument();
    await user.click(screen.getByTestId('brief-ai-suggest'));
    expect(await screen.findByDisplayValue(/前 3 秒用三里屯深夜火锅场景/)).toBeInTheDocument();
  });

  it('exposes the five-step creation flow and routes both primary CTAs to script', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByText('Brief 填写')).toBeInTheDocument();
    expect(screen.getByText('生成脚本')).toBeInTheDocument();
    expect(screen.getByText('分镜与排期')).toBeInTheDocument();
    expect(screen.getByText('素材与预算确认')).toBeInTheDocument();
    expect(screen.getByText('完成创建')).toBeInTheDocument();
    expect(screen.queryByText('品牌核验')).not.toBeInTheDocument();
    const kuaishou = screen.getByRole('button', { name: '快手' });
    expect(kuaishou).toHaveAttribute('aria-pressed', 'false');
    await user.click(kuaishou);
    expect(kuaishou).toHaveAttribute('aria-pressed', 'true');
    const scriptButtons = screen.getAllByRole('button', { name: /下一步：生成脚本/ });
    expect(scriptButtons).toHaveLength(2);
    await user.click(scriptButtons[0]);
    expect(await screen.findByText('Script route')).toBeInTheDocument();
  });
});
