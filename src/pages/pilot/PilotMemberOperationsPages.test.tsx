import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/Providers';
import {
  PilotControlApiError,
  pilotControlApi,
  type PilotCurrentOrganizationMember,
  type PilotSession,
} from '../../services/pilotControlApi';
import * as demoStore from '../../stores/controlPlaneStore';
import { usePilotAuthStore } from '../../stores/pilotAuthStore';
import { usePilotProjectContextStore } from '../../stores/pilotProjectContextStore';
import {
  PilotChannelMembersPage,
  PilotPlatformMembersPage,
  PilotTenantMembersPage,
} from './PilotMemberOperationsPages';

const MEMBER_ID = '71000000-0000-4000-8000-000000000002';
const SENSITIVE = 'SQL password stack MUST_NOT_RENDER';

function session(type: 'PLATFORM' | 'CHANNEL' | 'TENANT', role: string): PilotSession {
  const tenantId = type === 'TENANT' ? '40000000-0000-4000-8000-000000000001' : null;
  return {
    user: { id: 'user-1', email: 'admin@example.com', displayName: '当前管理员' },
    tenant: tenantId ? { id: tenantId, displayName: '租户' } : null,
    roles: [role as PilotSession['roles'][number]],
    activeContext: {
      membershipId: '71000000-0000-4000-8000-000000000001',
      organizationId: tenantId ?? 'a0000000-0000-4000-8000-000000000001',
      organizationType: type,
      organizationDisplayName: '当前组织',
      membershipVersion: 1,
      primaryRole: role as PilotSession['roles'][number],
      roles: [role as PilotSession['roles'][number]],
      tenantId,
    },
    expiresAt: '2026-08-11T00:00:00.000Z',
  };
}

const selfMember: PilotCurrentOrganizationMember = {
  membershipId: '71000000-0000-4000-8000-000000000001',
  displayName: '当前管理员',
  email: 'admin@example.com',
  status: 'active',
  primaryRole: 'platform_admin',
  roles: ['platform_admin'],
  version: 1,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-10T00:00:00.000Z',
  isCurrentActor: true,
};
const otherMember: PilotCurrentOrganizationMember = {
  ...selfMember,
  membershipId: MEMBER_ID,
  displayName: '其他管理员',
  email: 'other@example.com',
  version: 2,
  isCurrentActor: false,
};

function renderPage(element: React.ReactElement) {
  return render(<AppProviders>{element}</AppProviders>);
}

beforeEach(() => {
  vi.restoreAllMocks();
  usePilotProjectContextStore.getState().reset();
});

describe('A-BIZ-06C.5 Current Organization Member Operations Pages', () => {
  it('loads a bounded current Organization directory without Demo and hides self suspend', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: session('PLATFORM', 'platform_admin'),
      error: null,
      requestId: null,
    });
    const demoRead = vi.spyOn(demoStore, 'useControlPlaneStore');
    vi.spyOn(pilotControlApi, 'listCurrentOrganizationMembers').mockResolvedValue([
      selfMember,
      otherMember,
    ]);

    renderPage(<PilotPlatformMembersPage />);
    const ready = await screen.findByTestId('pilot-members-ready');
    expect(pilotControlApi.listCurrentOrganizationMembers).toHaveBeenCalledWith('all', 100);
    expect(demoRead).not.toHaveBeenCalled();
    expect(ready).toHaveTextContent('当前管理员');
    expect(within(ready).getAllByRole('button', { name: '停用成员' })).toHaveLength(1);
    expect(ready).toHaveTextContent('当前登录成员不可停用');
  });

  it('supports loading, empty, status filter and retry with safe Request ID', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: session('CHANNEL', 'channel_admin'),
      error: null,
      requestId: null,
    });
    const list = vi
      .spyOn(pilotControlApi, 'listCurrentOrganizationMembers')
      .mockRejectedValueOnce(
        new PilotControlApiError('INTERNAL_ERROR', SENSITIVE, 500, 'members-500'),
      )
      .mockResolvedValue([]);
    renderPage(<PilotChannelMembersPage />);
    const error = await screen.findByTestId('pilot-members-service-error');
    expect(error).toHaveTextContent('请求 ID：members-500');
    expect(error).not.toHaveTextContent(SENSITIVE);
    fireEvent.click(screen.getByRole('button', { name: '重试真实成员目录' }));
    expect(await screen.findByTestId('pilot-members-empty')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Member status filter'), {
      target: { value: 'suspended' },
    });
    await waitFor(() => expect(list).toHaveBeenLastCalledWith('suspended', 100));
  });

  it('suspends with confirmation and exact expectedVersion, then refreshes and reports replay', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: session('PLATFORM', 'platform_admin'),
      error: null,
      requestId: null,
    });
    const list = vi
      .spyOn(pilotControlApi, 'listCurrentOrganizationMembers')
      .mockResolvedValue([otherMember]);
    const suspend = vi
      .spyOn(pilotControlApi, 'suspendCurrentOrganizationMember')
      .mockResolvedValue({
        member: { ...otherMember, status: 'suspended', version: 3 },
        replayed: true,
      });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage(<PilotPlatformMembersPage />);
    const ready = await screen.findByTestId('pilot-members-ready');
    fireEvent.click(within(ready).getByRole('button', { name: '停用成员' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(suspend).toHaveBeenCalledWith(MEMBER_ID, 2);
    expect(await screen.findByTestId('pilot-member-mutation-success')).toHaveTextContent(
      '幂等重放',
    );
    expect(list).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['MEMBER_LAST_ADMIN', 'pilot-member-mutation-last-admin'],
    ['MEMBERSHIP_VERSION_CONFLICT', 'pilot-member-mutation-stale'],
    ['MEMBER_NOT_ACTIVE', 'pilot-member-mutation-inactive'],
  ])('renders fixed safe %s state', async (code, testId) => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: session('PLATFORM', 'platform_admin'),
      error: null,
      requestId: null,
    });
    vi.spyOn(pilotControlApi, 'listCurrentOrganizationMembers').mockResolvedValue([otherMember]);
    vi.spyOn(pilotControlApi, 'suspendCurrentOrganizationMember').mockRejectedValue(
      new PilotControlApiError(code, SENSITIVE, 409, code),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage(<PilotPlatformMembersPage />);
    fireEvent.click(
      within(await screen.findByTestId('pilot-members-ready')).getByRole('button', {
        name: '停用成员',
      }),
    );
    const error = await screen.findByTestId(testId);
    expect(error).toHaveTextContent(`请求 ID：${code}`);
    expect(error).not.toHaveTextContent(SENSITIVE);
  });

  it('clears Session and old rows on 401', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: session('TENANT', 'tenant_admin'),
      error: null,
      requestId: null,
    });
    vi.spyOn(pilotControlApi, 'listCurrentOrganizationMembers').mockRejectedValue(
      new PilotControlApiError('AUTHENTICATION_REQUIRED', SENSITIVE, 401, 'members-401'),
    );
    renderPage(<PilotTenantMembersPage />);
    const error = await screen.findByTestId('pilot-members-unauthorized');
    expect(error).toHaveTextContent('请求 ID：members-401');
    expect(screen.queryByText(otherMember.email)).not.toBeInTheDocument();
    expect(usePilotAuthStore.getState().status).toBe('anonymous');
  });

  it('denies wrong roles and exposes no role edit, restore, delete or batch controls', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: session('TENANT', 'content_operator'),
      error: null,
      requestId: null,
    });
    const list = vi.spyOn(pilotControlApi, 'listCurrentOrganizationMembers').mockResolvedValue([]);
    renderPage(<PilotTenantMembersPage />);
    expect(await screen.findByTestId('pilot-members-permission-denied')).toHaveTextContent(
      '仅 tenant_admin',
    );
    expect(list).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: /角色|恢复|删除|批量|密码|MFA/ }),
    ).not.toBeInTheDocument();
  });
});
