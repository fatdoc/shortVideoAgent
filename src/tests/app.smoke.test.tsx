import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../app/App';
import { clearWorkspace } from '../services/storage';
import { useProjectStore } from '../stores/projectStore';
import { cloneDemoWorkspace } from '../mocks/demoWorkspace';
import {
  DEMO_AUTH_PASSWORD,
  loginWithDemoAccount,
} from '../services/demoAuth';
import { useAuthStore } from '../stores/authStore';

describe('app smoke', () => {
  beforeEach(() => {
    clearWorkspace();
    window.localStorage.clear();
    loginWithDemoAccount({
      loginName: 'tenant',
      password: DEMO_AUTH_PASSWORD,
    });
    useAuthStore.getState().hydrate();
    useProjectStore.setState({
      workspace: cloneDemoWorkspace(),
      loading: false,
      error: null,
      hydrated: false,
      lastAction: null,
    });
  });

  it('redirects anonymous users to the role login page', async () => {
    useAuthStore.getState().logout();
    window.history.pushState({}, '', '/dashboard');
    render(<App />);

    expect(await screen.findByRole('heading', { level: 2, name: '登录工作台' })).toBeInTheDocument();
    expect(screen.getByTestId('demo-identity-platform')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('rejects a tenant identity from the platform workbench', async () => {
    window.history.pushState({}, '', '/platform/overview');
    render(<App />);

    expect(await screen.findByText('WORKBENCH_SCOPE_DENIED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回我的工作台' })).toBeInTheDocument();
  });

  it('renders dashboard through router with unified demo data', async () => {
    window.history.pushState({}, '', '/dashboard');
    render(<App />);

    expect(await screen.findByRole('heading', { level: 3, name: '工作台' })).toBeInTheDocument();
    expect(screen.getByText('短视频 Agent')).toBeInTheDocument();
    expect((await screen.findAllByText('demo-local-001')).length).toBeGreaterThan(0);
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

    await user.click(screen.getByRole('menuitem', { name: /分镜/ }));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/projects/demo-local-001/storyboard');
    });

    await user.click(screen.getByRole('menuitem', { name: /任务.*交付/ }));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/projects/demo-local-001/rough-cut');
    });

    await user.click(screen.getByRole('menuitem', { name: /企业工作台/ }));
    expect(await screen.findByRole('heading', { level: 3, name: '工作台' })).toBeInTheDocument();
  }, 15_000);

  it('keeps Brief data consistent across Brand and Script pages', async () => {
    const user = userEvent.setup();
    const nextCta = '领取团购券并到店核销';
    window.history.pushState({}, '', '/projects/new');
    render(<App />);

    await screen.findByRole('heading', { level: 3, name: '新建项目 / Brief' });
    const cta = screen.getByTestId('brief-cta');
    await user.clear(cta);
    await user.type(cta, nextCta);
    await user.click(screen.getByTestId('brief-save'));

    await waitFor(() => {
      const state = useProjectStore.getState();
      expect(state.lastAction).toBe('setBrief');
      expect(state.workspace.brief.cta).toBe(nextCta);
    });

    await user.click(screen.getByRole('menuitem', { name: /品牌大脑/ }));
    await screen.findByRole('heading', { level: 3, name: '品牌 / 商家大脑' });
    expect(await screen.findByText(nextCta)).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /脚本编辑/ }));
    await screen.findByRole('heading', { level: 3, name: '脚本生成与编辑' });
    expect(
      screen.getByText((_, element) => element?.textContent === `CTA：${nextCta}`),
    ).toBeInTheDocument();
  }, 15_000);

  it('shows shell chrome and demo project chip', async () => {
    window.history.pushState({}, '', '/dashboard');
    render(<App />);
    await screen.findByRole('heading', { level: 3, name: '工作台' });
    expect(screen.getByRole('button', { name: /重置 Demo/ })).toBeInTheDocument();
    expect(screen.getAllByText(/海底捞/).length).toBeGreaterThan(0);
    // sidebar footer id
    const sider = document.querySelector('.ant-layout-sider');
    expect(sider).toBeTruthy();
    expect(within(sider as HTMLElement).getByText('DEMO_READY')).toBeInTheDocument();
  });
});
