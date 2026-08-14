import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/pilotRuntime', () => ({
  pilotRuntime: {
    mode: 'pilot',
    controlApiBaseUrl: 'https://control.example.com',
    configurationError: null,
  },
}));

const integratedStoryCanvasRender = vi.hoisted(() => vi.fn());

vi.mock('../pages/production/IntegratedStoryCanvasPage', () => ({
  IntegratedStoryCanvasPage: () => {
    integratedStoryCanvasRender();
    return <div data-testid="demo-integrated-storycanvas-page">Demo StoryCanvas</div>;
  },
}));

vi.mock('../pages/auth/RegistrationPage', () => ({
  RegistrationPage: ({
    invitationToken,
    onLogin,
  }: {
    invitationToken?: string | null;
    onLogin?: () => void;
  }) => (
    <div data-testid="registration-route" data-invitation={invitationToken ?? ''}>
      <button type="button" onClick={onLogin}>
        注册完成去登录
      </button>
    </div>
  ),
}));

vi.mock('../pages/pilot/PilotCommissionAuditPages', () => ({
  PilotPlatformCommissionAuditPage: () => (
    <div data-testid="pilot-platform-commission-audit">平台佣金审计空列表</div>
  ),
  PilotChannelCommissionAuditPage: () => (
    <div data-testid="pilot-channel-commission-audit">渠道佣金审计空列表</div>
  ),
}));

vi.mock('../pages/pilot/PilotSettlementDraftPage', () => ({
  PilotPlatformSettlementDraftPage: () => (
    <div data-testid="pilot-platform-settlement-draft">TEST 结算草稿</div>
  ),
}));

vi.mock('../pages/pilot/PilotTenantRechargeAuditPage', () => ({
  PilotTenantRechargeAuditPage: () => (
    <div data-testid="pilot-tenant-recharge-audit">Tenant TEST 充值记录</div>
  ),
}));

vi.mock('../pages/pilot/PilotTermsOperationsPage', () => ({
  PilotTermsOperationsPage: () => (
    <div data-testid="pilot-platform-terms-operations">Platform Terms 运营</div>
  ),
}));

vi.mock('../pages/pilot/PilotInvitationOperationsPages', () => ({
  PilotPlatformInvitationsPage: () => (
    <div data-testid="pilot-platform-invitations">Platform 邀请管理</div>
  ),
  PilotChannelInvitationsPage: () => (
    <div data-testid="pilot-channel-invitations">Channel 邀请管理</div>
  ),
  PilotTenantInvitationsPage: () => (
    <div data-testid="pilot-tenant-invitations">Tenant 邀请管理</div>
  ),
}));

vi.mock('../pages/pilot/PilotMemberOperationsPages', () => ({
  PilotPlatformMembersPage: () => <div data-testid="pilot-platform-members">Platform 成员管理</div>,
  PilotChannelMembersPage: () => <div data-testid="pilot-channel-members">Channel 成员管理</div>,
  PilotTenantMembersPage: () => <div data-testid="pilot-tenant-members">Tenant 成员管理</div>,
}));

vi.mock('../pages/pilot-production/PilotProjectContentPages', () => ({
  PilotProjectContentPage: ({
    routeKey,
    projectId,
  }: {
    routeKey: string;
    projectId: string | null;
  }) => (
    <div data-testid={`pilot-project-content-${routeKey}`} data-project-id={projectId ?? ''}>
      Real Pilot content
    </div>
  ),
}));

vi.mock('../pages/pilot-production/PilotTenantOverviewPages', () => ({
  PilotTenantOverviewPage: ({
    routeKey,
    activeProjectId,
    projects,
  }: {
    routeKey: string;
    activeProjectId: string | null;
    projects: PilotProject[];
  }) => (
    <div
      data-testid={`pilot-tenant-overview-${routeKey}`}
      data-project-id={activeProjectId ?? ''}
      data-project-count={projects.length}
    >
      Real Pilot tenant overview
    </div>
  ),
}));

import App from './App';
import type { PilotProject, PilotSession } from '../services/pilotControlApi';
import { usePilotAuthStore } from '../stores/pilotAuthStore';
import { usePilotProjectContextStore } from '../stores/pilotProjectContextStore';

const tenantSession: PilotSession = {
  user: {
    id: 'user-1',
    email: 'operator@example.com',
    displayName: '试点运营',
  },
  tenant: {
    id: 'tenant-1',
    displayName: '试点企业',
  },
  roles: ['content_operator'],
  activeContext: {
    membershipId: 'membership-1',
    organizationId: 'tenant-1',
    organizationType: 'TENANT',
    organizationDisplayName: '试点企业',
    membershipVersion: 4,
    primaryRole: 'content_operator',
    roles: ['content_operator'],
    tenantId: 'tenant-1',
  },
  expiresAt: '2026-08-08T00:00:00.000Z',
};

const project = (id: string): PilotProject => ({
  id,
  name: `项目 ${id}`,
  status: 'active',
  platform: 'douyin',
  aspectRatio: '9:16',
  targetDurationSeconds: 30,
  createdBy: 'user-1',
  createdAt: '2026-08-07T00:00:00.000Z',
  updatedAt: '2026-08-07T01:00:00.000Z',
});

function setTenantContext(role: 'tenant_admin' | 'content_operator' = 'content_operator') {
  const session: PilotSession = {
    ...tenantSession,
    roles: [role],
    activeContext: {
      ...tenantSession.activeContext,
      primaryRole: role,
      roles: [role],
    },
  };
  const activeProject = project('project-alpha');
  usePilotAuthStore.setState({
    status: 'authenticated',
    session,
    error: null,
    requestId: null,
  });
  usePilotProjectContextStore.setState({
    status: 'ready',
    projects: [activeProject],
    activeProjectId: activeProject.id,
    context: {
      tenantId: 'tenant-1',
      projectId: activeProject.id,
      projectName: activeProject.name,
      sessionMembershipId: 'membership-1',
      roleCodes: [role],
    },
    error: null,
    requestId: null,
  });
}

function setOrganizationContext(
  organizationType: 'PLATFORM' | 'CHANNEL',
  role: 'platform_admin' | 'channel_admin' | 'pilot_support',
) {
  const session: PilotSession = {
    ...tenantSession,
    tenant: null,
    roles: [role],
    activeContext: {
      ...tenantSession.activeContext,
      organizationId: organizationType === 'PLATFORM' ? 'platform-1' : 'organization-channel-1',
      organizationType,
      organizationDisplayName: organizationType === 'PLATFORM' ? '试点平台' : '试点渠道',
      primaryRole: role,
      roles: [role],
      tenantId: null,
    },
  };
  usePilotAuthStore.setState({
    status: 'authenticated',
    session,
    error: null,
    requestId: null,
  });
  usePilotProjectContextStore.setState({
    status: 'tenant_context_required',
    projects: [],
    activeProjectId: null,
    context: null,
    error: null,
    requestId: null,
  });
}

describe('A-BIZ-01.4C Pilot unified creation shell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/pilot');
    usePilotAuthStore.setState({
      status: 'anonymous',
      session: null,
      error: null,
      requestId: null,
    });
    usePilotProjectContextStore.getState().reset();
  });

  it('opens public registration, consumes its invitation token, and removes it from the URL', async () => {
    window.history.replaceState({}, '', '/register?invitation=secret-token&source=partner');
    render(<App />);

    const registration = await screen.findByTestId('registration-route');
    expect(registration).toHaveAttribute('data-invitation', 'secret-token');
    await waitFor(() => {
      expect(window.location.pathname).toBe('/register');
      expect(window.location.search).toBe('?source=partner');
    });
    expect(window.location.href).not.toContain('secret-token');
  });

  it('redirects an authenticated registration visitor to the legal Pilot default project', async () => {
    setTenantContext('tenant_admin');
    window.history.replaceState({}, '', '/register');
    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/projects/project-alpha/brand');
    });
    expect(screen.queryByTestId('registration-route')).not.toBeInTheDocument();
  });

  it('opens registration from the anonymous Pilot login entry', async () => {
    window.history.replaceState({}, '', '/login');
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '创建账号' }));

    expect(await screen.findByTestId('registration-route')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/register');
  });

  it('returns to login when registration asks to continue there', async () => {
    window.history.replaceState({}, '', '/register');
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '注册完成去登录' }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });
    expect(await screen.findByTestId('pilot-login-page')).toBeInTheDocument();
  });

  it('enters the unified shell at the first server-visible Project without Demo fallback', async () => {
    setTenantContext('tenant_admin');
    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/projects/project-alpha/brand');
    });
    expect(screen.getByTestId('pilot-app-shell')).toBeInTheDocument();
    expect(screen.getAllByText('统一创作工作台').length).toBeGreaterThan(0);
    expect(screen.getByRole('menuitem', { name: /内容策划/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('menuitem', { name: /品牌大脑/ })).toBeInTheDocument();
    const productionMenu = screen.getByRole('menuitem', { name: /视频生产/ });
    expect(productionMenu).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menuitem', { name: /生产概览/ })).not.toBeInTheDocument();
    fireEvent.click(productionMenu);
    expect(await screen.findByRole('menuitem', { name: /生产概览/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /内容策划/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByTestId('pilot-project-content-brand')).toHaveAttribute(
      'data-project-id',
      'project-alpha',
    );
    expect(screen.queryByTestId('pilot-route-handoff')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pilot-session-page')).not.toBeInTheDocument();
    expect(screen.queryByText(/海底捞/)).not.toBeInTheDocument();
  });

  it('uses the manifest to hide administration and reject dashboard for content operators', async () => {
    setTenantContext('content_operator');
    window.history.replaceState({}, '', '/dashboard');
    render(<App />);

    expect(await screen.findByTestId('pilot-route-permission-denied')).toHaveTextContent(
      '无权访问企业工作台',
    );
    expect(screen.queryByRole('menuitem', { name: /企业工作台/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /生产能力/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /新建 \/ Brief/ })).not.toBeInTheDocument();
  });

  it('routes tenant administrators to real Dashboard and production capability pages', async () => {
    setTenantContext('tenant_admin');
    window.history.replaceState({}, '', '/dashboard');
    render(<App />);

    expect(await screen.findByTestId('pilot-tenant-overview-dashboard')).toHaveAttribute(
      'data-project-id',
      'project-alpha',
    );
    expect(screen.queryByTestId('pilot-route-unavailable')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: /生产能力/ }));
    expect(await screen.findByTestId('pilot-tenant-overview-products')).toHaveAttribute(
      'data-project-count',
      '1',
    );
    expect(screen.getAllByText('生产能力').length).toBeGreaterThan(0);
    expect(screen.queryByText('企业已购能力')).not.toBeInTheDocument();
  });

  it('routes an empty server Project Scope to the explicit project empty state', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: tenantSession,
      error: null,
      requestId: null,
    });
    usePilotProjectContextStore.setState({
      status: 'empty',
      projects: [],
      activeProjectId: null,
      context: null,
      error: null,
      requestId: null,
    });
    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/projects');
    });
    expect(screen.getByTestId('pilot-project-empty')).toHaveTextContent('暂无可访问项目');
    expect(screen.queryByText(/demo-local-001/)).not.toBeInTheDocument();
  });

  it('routes a Platform session into the commercial shell without Tenant Project Context', async () => {
    setOrganizationContext('PLATFORM', 'platform_admin');
    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/platform/commission-audit');
    });
    expect(screen.getByTestId('pilot-platform-commission-audit')).toBeInTheDocument();
    expect(screen.getByTestId('pilot-app-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('pilot-tenant-context-required')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('当前 Pilot 项目')).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /佣金审计/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /TEST 结算草稿/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /项目/ })).not.toBeInTheDocument();
  });

  it('routes a Channel session into its audit shell without a Project selector', async () => {
    setOrganizationContext('CHANNEL', 'channel_admin');
    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/channel/commission-audit');
    });
    expect(screen.getByTestId('pilot-channel-commission-audit')).toBeInTheDocument();
    expect(screen.queryByLabelText('当前 Pilot 项目')).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /佣金审计/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /TEST 结算草稿/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /项目/ })).not.toBeInTheDocument();
  });

  it('adds Tenant Recharge audit only for tenant administrators', async () => {
    setTenantContext('tenant_admin');
    window.history.replaceState({}, '', '/enterprise/recharge-orders');
    render(<App />);

    expect(await screen.findByTestId('pilot-tenant-recharge-audit')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '当前 Pilot 项目' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /TEST 充值记录/ })).toBeInTheDocument();
  });

  it('returns 403 semantics before loading Tenant Recharge for a content operator', async () => {
    setTenantContext('content_operator');
    window.history.replaceState({}, '', '/enterprise/recharge-orders');
    render(<App />);

    expect(await screen.findByTestId('pilot-route-permission-denied')).toHaveTextContent(
      '无权访问TEST 充值记录',
    );
    expect(screen.queryByTestId('pilot-tenant-recharge-audit')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /TEST 充值记录/ })).not.toBeInTheDocument();
  });

  it('returns 404 semantics for a registered route outside the active organization Scope', async () => {
    setOrganizationContext('PLATFORM', 'platform_admin');
    window.history.replaceState({}, '', '/channel/commission-audit');
    render(<App />);

    expect(await screen.findByTestId('pilot-route-not-found')).toHaveTextContent('页面不存在');
    expect(screen.queryByTestId('pilot-channel-commission-audit')).not.toBeInTheDocument();
    expect(screen.queryByText('进入 Demo 脚本')).not.toBeInTheDocument();
  });

  it('returns 403 semantics for a same-Scope Platform session without the required role', async () => {
    setOrganizationContext('PLATFORM', 'pilot_support');
    window.history.replaceState({}, '', '/platform/commission-audit');
    render(<App />);

    expect(await screen.findByTestId('pilot-route-permission-denied')).toHaveTextContent(
      '无权访问佣金审计',
    );
    expect(screen.queryByTestId('pilot-platform-commission-audit')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /佣金审计/ })).not.toBeInTheDocument();
  });

  it('restores an authorized Platform commercial returnTo without waiting for Project Context', async () => {
    setOrganizationContext('PLATFORM', 'platform_admin');
    window.history.replaceState(
      { usr: { from: '/platform/commission-settlements?period=2026-07' }, key: 'pilot-login' },
      '',
      '/login',
    );
    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/platform/commission-settlements');
      expect(window.location.search).toBe('?period=2026-07');
    });
    expect(screen.getByTestId('pilot-platform-settlement-draft')).toBeInTheDocument();
    expect(screen.queryByLabelText('当前 Pilot 项目')).not.toBeInTheDocument();
  });

  it('rejects a cross-Scope Platform returnTo and falls back to the Platform default', async () => {
    setOrganizationContext('PLATFORM', 'platform_admin');
    window.history.replaceState(
      { usr: { from: '/channel/commission-audit' }, key: 'pilot-login' },
      '',
      '/login',
    );
    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/platform/commission-audit');
    });
    expect(screen.getByTestId('pilot-platform-commission-audit')).toBeInTheDocument();
    expect(screen.queryByTestId('pilot-channel-commission-audit')).not.toBeInTheDocument();
  });

  it('hides an unassigned direct Project URL as not found', async () => {
    setTenantContext();
    window.history.replaceState({}, '', '/projects/project-beta/brand');
    render(<App />);

    expect(await screen.findByTestId('pilot-project-not-found')).toHaveTextContent(
      '项目不存在或不在当前可见范围',
    );
  });

  it('restores only an authorized manifest return path after login', async () => {
    setTenantContext();
    window.history.replaceState(
      { usr: { from: '/projects/project-alpha/script?tab=draft' }, key: 'pilot-login' },
      '',
      '/login',
    );
    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/projects/project-alpha/script');
      expect(window.location.search).toBe('?tab=draft');
    });
    expect(screen.getByTestId('pilot-project-content-script')).toHaveAttribute(
      'data-project-id',
      'project-alpha',
    );
  });

  it('keeps a Project API service failure inside the authenticated Pilot shell', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: tenantSession,
      error: null,
      requestId: null,
    });
    usePilotProjectContextStore.setState({
      status: 'service_error',
      projects: [],
      activeProjectId: null,
      context: null,
      error: '项目服务不可用',
      requestId: 'req-project-500',
    });
    window.history.replaceState({}, '', '/projects');
    render(<App />);

    expect(await screen.findByTestId('pilot-project-service-error')).toHaveTextContent(
      '项目服务不可用 请求 ID：req-project-500',
    );
    expect(screen.getByTestId('pilot-app-shell')).toBeInTheDocument();
    expect(usePilotAuthStore.getState().session).toEqual(tenantSession);
  });

  it('keeps a direct Project route service failure as a retryable service error', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: {
        ...tenantSession,
        roles: ['tenant_admin'],
        activeContext: {
          ...tenantSession.activeContext,
          primaryRole: 'tenant_admin',
          roles: ['tenant_admin'],
        },
      },
      error: null,
      requestId: null,
    });
    usePilotProjectContextStore.setState({
      status: 'service_error',
      projects: [],
      activeProjectId: null,
      context: null,
      error: '项目服务不可用',
      requestId: 'req-project-route-500',
    });
    window.history.replaceState({}, '', '/projects/project-alpha/brand');
    render(<App />);

    expect(await screen.findByTestId('pilot-project-service-error')).toHaveTextContent(
      '项目服务不可用 请求 ID：req-project-route-500',
    );
    expect(screen.queryByTestId('pilot-project-not-found')).not.toBeInTheDocument();
  });

  it('rejects an unsafe login return target and falls back to the server-visible Project', async () => {
    setTenantContext();
    window.history.replaceState(
      { usr: { from: 'https://evil.example/projects/project-alpha/script' }, key: 'pilot-login' },
      '',
      '/login',
    );
    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/projects/project-alpha/brand');
    });
    expect(screen.getByTestId('pilot-project-content-brand')).toBeInTheDocument();
  });
});

describe('A-BIZ-06E.4P Shared Router fail-closed boundary RED', () => {
  beforeEach(() => {
    integratedStoryCanvasRender.mockClear();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/pilot');
    usePilotAuthStore.setState({
      status: 'anonymous',
      session: null,
      error: null,
      requestId: null,
    });
    usePilotProjectContextStore.getState().reset();
  });

  it('blocks a real Tenant Canvas route when the B Pilot boundary is unavailable', async () => {
    setTenantContext();
    window.history.replaceState({}, '', '/production/canvas/project-alpha');
    render(<App />);

    expect(await screen.findByTestId('pilot-app-shell')).toBeInTheDocument();
    expect.soft(screen.queryByTestId('pilot-route-handoff')).not.toBeInTheDocument();
    expect.soft(screen.queryByTestId('demo-integrated-storycanvas-page')).not.toBeInTheDocument();
    expect.soft(integratedStoryCanvasRender).not.toHaveBeenCalled();

    const blockedState = screen.queryByTestId('pilot-storycanvas-boundary-blocked');
    expect.soft(blockedState).not.toBeNull();
    if (blockedState) {
      expect.soft(blockedState).toHaveTextContent('Project project-alpha');
      expect.soft(blockedState).toHaveTextContent(/StoryCanvas Pilot (边界|服务).*暂不可用/);
      expect.soft(blockedState).toHaveTextContent('不会回退 Demo');
    }
  });
});

describe('A-BIZ-06C.6 Pilot operations workbench activation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/pilot');
    usePilotAuthStore.setState({
      status: 'anonymous',
      session: null,
      error: null,
      requestId: null,
    });
    usePilotProjectContextStore.getState().reset();
  });

  it('activates Platform Terms, Invitation and Member navigation from the shared manifest', async () => {
    setOrganizationContext('PLATFORM', 'platform_admin');
    window.history.replaceState({}, '', '/platform/terms');
    render(<App />);

    expect(await screen.findByTestId('pilot-platform-terms-operations')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Terms 运营/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /邀请管理/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /成员管理/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('当前 Pilot 项目')).not.toBeInTheDocument();
  });

  it('activates the canonical Channel Invitation page without Tenant Project context', async () => {
    setOrganizationContext('CHANNEL', 'channel_admin');
    window.history.replaceState({}, '', '/channel/invitations');
    render(<App />);

    expect(await screen.findByTestId('pilot-channel-invitations')).toBeInTheDocument();
    expect(screen.queryByLabelText('当前 Pilot 项目')).not.toBeInTheDocument();
  });

  it('keeps Tenant Member operations available during Project service failure without forging a Project', async () => {
    setTenantContext('tenant_admin');
    usePilotProjectContextStore.setState({
      status: 'service_error',
      projects: [],
      activeProjectId: null,
      context: null,
      error: 'Project service unavailable',
      requestId: 'project-500',
    });
    window.history.replaceState({}, '', '/enterprise/members');
    render(<App />);

    expect(await screen.findByTestId('pilot-tenant-members')).toBeInTheDocument();
    expect(screen.queryByLabelText('当前 Pilot 项目')).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /邀请管理/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /成员管理/ })).toBeInTheDocument();
    expect(screen.queryByText('Project service unavailable')).not.toBeInTheDocument();
  });

  it('restores a Tenant operations returnTo without waiting for Project Context', async () => {
    setTenantContext('tenant_admin');
    usePilotProjectContextStore.setState({
      status: 'loading',
      projects: [],
      activeProjectId: null,
      context: null,
      error: null,
      requestId: null,
    });
    window.history.replaceState(
      { usr: { from: '/enterprise/invitations' }, key: 'pilot-login-operations' },
      '',
      '/login',
    );
    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/enterprise/invitations'));
    expect(screen.getByTestId('pilot-tenant-invitations')).toBeInTheDocument();
    expect(screen.queryByLabelText('当前 Pilot 项目')).not.toBeInTheDocument();
  });

  it('uses 404 for cross-Scope probes and 403 for missing same-Scope operation roles', async () => {
    setOrganizationContext('PLATFORM', 'platform_admin');
    window.history.replaceState({}, '', '/channel/members');
    const first = render(<App />);
    expect(await screen.findByTestId('pilot-route-not-found')).toBeInTheDocument();
    first.unmount();

    setTenantContext('content_operator');
    window.history.replaceState({}, '', '/enterprise/members');
    render(<App />);
    expect(await screen.findByTestId('pilot-route-permission-denied')).toHaveTextContent(
      '无权访问成员管理',
    );
    expect(screen.queryByTestId('pilot-tenant-members')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /成员管理/ })).not.toBeInTheDocument();
  });

  it.each([
    {
      pathname: '/platform/invitations',
      organizationType: 'PLATFORM' as const,
      role: 'platform_admin' as const,
      testId: 'pilot-platform-invitations',
    },
    {
      pathname: '/platform/members',
      organizationType: 'PLATFORM' as const,
      role: 'platform_admin' as const,
      testId: 'pilot-platform-members',
    },
    {
      pathname: '/channel/members',
      organizationType: 'CHANNEL' as const,
      role: 'channel_admin' as const,
      testId: 'pilot-channel-members',
    },
  ])('maps $pathname to its real operations page', async (entry) => {
    setOrganizationContext(entry.organizationType, entry.role);
    window.history.replaceState({}, '', entry.pathname);
    render(<App />);

    expect(await screen.findByTestId(entry.testId)).toBeInTheDocument();
  });
});
