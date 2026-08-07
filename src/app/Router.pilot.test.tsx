import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/pilotRuntime', () => ({
  pilotRuntime: {
    mode: 'pilot',
    controlApiBaseUrl: 'https://control.example.com',
    configurationError: null,
  },
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

  it('enters the unified shell at the first server-visible Project without Demo fallback', async () => {
    setTenantContext('tenant_admin');
    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/projects/project-alpha/brand');
    });
    expect(screen.getByTestId('pilot-app-shell')).toBeInTheDocument();
    expect(screen.getAllByText('统一创作工作台').length).toBeGreaterThan(0);
    expect(screen.getByRole('menuitem', { name: /品牌大脑/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /生产概览/ })).toBeInTheDocument();
    expect(screen.getByTestId('pilot-route-handoff')).toHaveTextContent('project-alpha');
    expect(screen.getByTestId('pilot-route-handoff')).toHaveTextContent('尚未接入真实 Pilot 数据');
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
    expect(screen.queryByRole('menuitem', { name: /已购能力/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /新建 \/ Brief/ })).not.toBeInTheDocument();
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

  it('fails closed for a non-Tenant Pilot session without entering a Demo workbench', async () => {
    const platformSession: PilotSession = {
      ...tenantSession,
      tenant: null,
      roles: ['platform_admin'],
      activeContext: {
        ...tenantSession.activeContext,
        organizationId: 'platform-1',
        organizationType: 'PLATFORM',
        organizationDisplayName: '试点平台',
        primaryRole: 'platform_admin',
        roles: ['platform_admin'],
        tenantId: null,
      },
    };
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: platformSession,
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
    render(<App />);

    expect(await screen.findByTestId('pilot-tenant-context-required')).toHaveTextContent(
      '需要 Tenant 上下文',
    );
    expect(screen.queryByTestId('pilot-app-shell')).not.toBeInTheDocument();
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
    expect(screen.getByTestId('pilot-route-handoff')).toBeInTheDocument();
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
    expect(screen.getByTestId('pilot-route-handoff')).toBeInTheDocument();
  });
});
