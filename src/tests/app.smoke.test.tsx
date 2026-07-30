import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../app/App';
import { DEMO_AUTH_PASSWORD, loginWithDemoAccount } from '../services/demoAuth';
import { clearWorkspace } from '../services/storage';
import { useAuthStore } from '../stores/authStore';
import { useProjectStore } from '../stores/projectStore';
import { cloneDemoWorkspace } from '../mocks/demoWorkspace';

describe('app smoke', () => {
  beforeEach(() => {
    clearWorkspace();
    window.localStorage.clear();
    useAuthStore.setState({
      status: 'idle',
      identity: null,
      currentIdentity: null,
      activeOrganization: null,
      activeMembership: null,
      allowedWorkbenches: [],
      defaultRoute: null,
      error: null,
      isAuthenticated: false,
    });
    useProjectStore.setState({
      workspace: cloneDemoWorkspace(),
      loading: false,
      error: null,
      hydrated: false,
      lastAction: null,
    });
  });

  function authenticateTenant() {
    loginWithDemoAccount({ loginName: 'tenant', password: DEMO_AUTH_PASSWORD });
  }

  it('shows login before protected workspace routes', async () => {
    window.history.pushState({}, '', '/dashboard');
    render(<App />);

    expect(await screen.findByRole('heading', { level: 2, name: '登录工作台' })).toBeInTheDocument();
    expect(screen.getByTestId('demo-identity-tenant')).toBeInTheDocument();
  });

  it('renders dashboard through router with unified demo data', async () => {
    authenticateTenant();
    window.history.pushState({}, '', '/dashboard');
    render(<App />);

    expect(await screen.findByRole('heading', { level: 3, name: '工作台' })).toBeInTheDocument();
    expect(screen.getByText('短视频 Agent')).toBeInTheDocument();
    expect(await screen.findByText('demo-local-001')).toBeInTheDocument();
    expect(screen.getByText('品牌事实')).toBeInTheDocument();
  });

  it('navigates across six primary routes from sidebar', async () => {
    const user = userEvent.setup();
    authenticateTenant();
    window.history.pushState({}, '', '/dashboard');
    render(<App />);

    await screen.findByRole('heading', { level: 3, name: '工作台' });

    await user.click(screen.getByRole('menuitem', { name: /Brief/ }));
    expect(await screen.findByRole('heading', { level: 3, name: '新建项目 / Brief' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /品牌\/商家大脑/ }));
    expect(await screen.findByRole('heading', { level: 3, name: '品牌 / 商家大脑' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /脚本/ }));
    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: '海底捞火锅 · 北京三里屯店探店脚本',
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /分镜/ }));
    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: '海底捞火锅·北京三里屯店探店视频',
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /初剪预览/ }));
    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: '海南陵水鸡 · 北京三里屯店',
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /工作台/ }));
    expect(await screen.findByRole('heading', { level: 3, name: '工作台' })).toBeInTheDocument();
  }, 15_000);

  it('keeps Brief data consistent across Brand and Script pages', async () => {
    const user = userEvent.setup();
    const nextCta = '领取团购券并到店核销';
    authenticateTenant();
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

    await user.click(screen.getByRole('menuitem', { name: /品牌\/商家大脑/ }));
    await screen.findByRole('heading', { level: 3, name: '品牌 / 商家大脑' });
    expect(await screen.findByText(nextCta)).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /脚本/ }));
    await screen.findByRole('heading', {
      level: 3,
      name: '海底捞火锅 · 北京三里屯店探店脚本',
    });
    expect(
      screen.getByText((_, element) => element?.textContent === `CTA：${nextCta}`),
    ).toBeInTheDocument();
  }, 15_000);

  it('shows shell chrome and demo project chip', async () => {
    authenticateTenant();
    window.history.pushState({}, '', '/dashboard');
    render(<App />);
    await screen.findByRole('heading', { level: 3, name: '工作台' });
    expect(screen.getByRole('button', { name: /通知/ })).toBeInTheDocument();
    expect(screen.getByText(/Demo：海底捞/)).toBeInTheDocument();
    // sidebar footer id
    const sider = document.querySelector('.ant-layout-sider');
    expect(sider).toBeTruthy();
    expect(within(sider as HTMLElement).getByText(/demo-local-001/)).toBeInTheDocument();
  });
});
