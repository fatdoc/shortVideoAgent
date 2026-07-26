import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../app/App';
import { clearWorkspace } from '../services/storage';
import { useProjectStore } from '../stores/projectStore';
import { cloneDemoWorkspace } from '../mocks/demoWorkspace';

describe('app smoke', () => {
  beforeEach(() => {
    clearWorkspace();
    window.localStorage.clear();
    useProjectStore.setState({
      workspace: cloneDemoWorkspace(),
      loading: false,
      error: null,
      hydrated: false,
      lastAction: null,
    });
  });

  it('renders dashboard through router with unified demo data', async () => {
    window.history.pushState({}, '', '/dashboard');
    render(<App />);

    expect(await screen.findByRole('heading', { level: 3, name: '工作台' })).toBeInTheDocument();
    expect(screen.getByText('短视频 Agent')).toBeInTheDocument();
    expect(await screen.findByText('demo-local-001')).toBeInTheDocument();
    expect(screen.getByText('品牌事实')).toBeInTheDocument();
  });

  it('navigates across six primary routes from sidebar', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/dashboard');
    render(<App />);

    await screen.findByRole('heading', { level: 3, name: '工作台' });

    await user.click(screen.getByRole('menuitem', { name: /新建 \/ Brief/ }));
    expect(await screen.findByRole('heading', { level: 3, name: '新建项目 / Brief' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /品牌大脑/ }));
    expect(await screen.findByRole('heading', { level: 3, name: '品牌 / 商家大脑' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /脚本编辑/ }));
    expect(await screen.findByRole('heading', { level: 3, name: '脚本生成与编辑' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /分镜清单/ }));
    expect(await screen.findByRole('heading', { level: 3, name: '分镜 / 拍摄清单' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /素材 \/ 初剪/ }));
    expect(await screen.findByRole('heading', { level: 3, name: '素材中心 / 初剪预览' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /工作台/ }));
    expect(await screen.findByRole('heading', { level: 3, name: '工作台' })).toBeInTheDocument();
  });

  it('persists Brief edits through the shared store', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/projects/new');
    render(<App />);

    await screen.findByRole('heading', { level: 3, name: '新建项目 / Brief' });
    const cta = screen.getByTestId('brief-cta');
    await user.clear(cta);
    await user.type(cta, '领取团购券并到店核销');
    await user.click(screen.getByTestId('brief-save'));

    await waitFor(() => {
      const state = useProjectStore.getState();
      expect(state.lastAction).toBe('setBrief');
      expect(state.workspace.brief.cta).toBe('领取团购券并到店核销');
    });
  });

  it('shows shell chrome and demo project chip', async () => {
    window.history.pushState({}, '', '/dashboard');
    render(<App />);
    await screen.findByRole('heading', { level: 3, name: '工作台' });
    expect(screen.getByRole('button', { name: /重置 Demo/ })).toBeInTheDocument();
    expect(screen.getByText(/Demo：海底捞/)).toBeInTheDocument();
    // sidebar footer id
    const sider = document.querySelector('.ant-layout-sider');
    expect(sider).toBeTruthy();
    expect(within(sider as HTMLElement).getByText(/demo-local-001/)).toBeInTheDocument();
  });
});
