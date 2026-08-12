import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../app/App';
import { clearWorkspace } from '../services/storage';
import { useProjectStore } from '../stores/projectStore';
import { cloneDemoWorkspace } from '../mocks/demoWorkspace';
import { DEMO_AUTH_PASSWORD, loginWithDemoAccount } from '../services/demoAuth';
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

    expect(
      await screen.findByRole('heading', { level: 2, name: '登录工作台' }),
    ).toBeInTheDocument();
    expect(screen.getByText('门店素材 → 获客视频')).toBeInTheDocument();
    expect(screen.queryByText(/海底捞|短视频营销 Agent/)).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('returns to a safe protected path after login', async () => {
    useAuthStore.getState().logout();
    window.history.pushState({}, '', '/dashboard?tab=summary#approved');
    render(<App />);

    await screen.findByRole('heading', { level: 2, name: '登录工作台' });
    expect(window.history.state.usr?.from).toBe('/dashboard?tab=summary#approved');
    act(() => {
      useAuthStore.getState().login({
        loginName: 'tenant',
        password: DEMO_AUTH_PASSWORD,
      });
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
      expect(window.location.search).toBe('?tab=summary');
      expect(window.location.hash).toBe('#approved');
    });
  });

  it('renders the unified permission-denied contract', async () => {
    window.history.pushState({}, '', '/platform/overview');
    render(<App />);

    expect(await screen.findByText('ROUTE_PERMISSION_DENIED')).toBeInTheDocument();
    expect(screen.getByTestId('route-access-denied')).toHaveTextContent('目标区域：平台总览');
    expect(screen.getByTestId('route-access-denied')).toHaveTextContent(
      '当前身份：企业老板 · 租户企业管理员',
    );
    expect(screen.getByTestId('route-access-denied')).toHaveTextContent(
      '海底捞三里屯店 · tenant-demo-hdl',
    );
    expect(
      screen.getByText('前端 Demo 拒绝，不代表生产 RBAC 或服务端安全控制。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回我的工作台' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出并切换身份' })).toBeInTheDocument();
  });

  it('renders the unified canonical scope denial', async () => {
    window.history.pushState({}, '', '/projects/other-project/brand');
    render(<App />);

    expect(await screen.findByText('ROUTE_ID_REJECTED')).toBeInTheDocument();
    expect(screen.getByTestId('route-access-denied')).toHaveTextContent(
      '目标区域：品牌大脑 · /projects/other-project/brand',
    );
    expect(screen.getByText(/不是 canonical Demo 资源/)).toBeInTheDocument();
  });

  it('logs out from the unified denial page before switching identity', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/platform/overview');
    render(<App />);

    await screen.findByText('ROUTE_PERMISSION_DENIED');
    await user.click(screen.getByRole('button', { name: '退出并切换身份' }));

    expect(
      await screen.findByRole('heading', { level: 2, name: '登录工作台' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(useAuthStore.getState().identity).toBeNull();
  });

  it('lets the content operator use one read-only creation workbench', async () => {
    const user = userEvent.setup();
    useAuthStore.getState().logout();
    loginWithDemoAccount({
      loginName: 'production',
      password: DEMO_AUTH_PASSWORD,
    });
    useAuthStore.getState().hydrate();
    window.history.pushState({}, '', '/production/overview');
    render(<App />);

    expect(
      await screen.findByRole('heading', { level: 2, name: '媒体生产工作台' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '切换工作台' })).toBeDisabled();
    expect(screen.getAllByText('统一创作工作台').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('menuitem', { name: /品牌大脑/ }));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/projects/demo-local-001/brand');
    });
    expect(await screen.findByTestId('store-profile-page')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /门店总览/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /商品套餐/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /获客任务/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /AI 探店脚本/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /探店分镜/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /剪辑成片/ })).toBeInTheDocument();
  });

  it('keeps the store acquisition chain in one workbench', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/dashboard');
    render(<App />);

    await screen.findByTestId('store-workbench-page');
    expect(screen.getByText('门店获客工作台')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /门店资产/ }));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/production/assets/demo-local-001');
    });
    expect(await screen.findByTestId('store-assets-page')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /门店档案/ }));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/projects/demo-local-001/brand');
    });
    expect(await screen.findByTestId('store-profile-page')).toBeInTheDocument();
  }, 10_000);

  it('renders dashboard through router with unified demo data', async () => {
    window.history.pushState({}, '', '/dashboard');
    render(<App />);

    expect(await screen.findByTestId('store-workbench-page')).toBeInTheDocument();
    expect(screen.getByText('生产队列')).toBeInTheDocument();
    expect(screen.getByText('暂无真实线索归因数据')).toBeInTheDocument();
  });

  it('navigates across the primary store acquisition routes', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/dashboard');
    render(<App />);

    await screen.findByTestId('store-workbench-page');

    await user.click(screen.getByRole('link', { name: /获客任务/ }));
    expect(await screen.findByTestId('store-campaign-page')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /门店档案/ }));
    expect(await screen.findByTestId('store-profile-page')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /AI 探店脚本/ }));
    expect(await screen.findByTestId('script-editor-page')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /探店分镜/ }));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/projects/demo-local-001/storyboard');
    });

    await user.click(screen.getByRole('link', { name: /剪辑成片/ }));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/projects/demo-local-001/rough-cut');
    });

    await user.click(screen.getByRole('link', { name: /门店总览/ }));
    expect(await screen.findByTestId('store-workbench-page')).toBeInTheDocument();
  }, 15_000);

  it('keeps campaign, script and publishing states honest across the chain', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/projects/new');
    render(<App />);

    await screen.findByTestId('store-campaign-page');
    expect(screen.getByText('真实投放未接通')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /AI 探店脚本/ }));
    expect(await screen.findByText('事实引用（5）')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /发布投放/ }));
    expect(await screen.findByText('待配置 / 待发布')).toBeInTheDocument();
  }, 15_000);

  it('shows shell chrome and demo project chip', async () => {
    window.history.pushState({}, '', '/dashboard');
    render(<App />);
    await screen.findByTestId('store-workbench-page');
    expect(screen.getByText('门店获客工作台')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '门店获客流程' })).toBeInTheDocument();
    expect(screen.getByText(/未接通真实投放与线索 Provider/)).toBeInTheDocument();
  });
});
