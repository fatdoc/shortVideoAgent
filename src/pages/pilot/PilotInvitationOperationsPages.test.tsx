import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/Providers';
import {
  PilotControlApiError,
  pilotControlApi,
  type PilotCommercialChannelReference,
  type PilotInvitationManagement,
  type PilotSession,
} from '../../services/pilotControlApi';
import * as demoStore from '../../stores/controlPlaneStore';
import { usePilotAuthStore } from '../../stores/pilotAuthStore';
import { usePilotProjectContextStore } from '../../stores/pilotProjectContextStore';
import {
  PilotChannelInvitationsPage,
  PilotPlatformInvitationsPage,
  PilotTenantInvitationsPage,
} from './PilotInvitationOperationsPages';

const CHANNEL_ID = '30000000-0000-4000-8000-000000000001';
const CHANNEL_ORG_ID = 'a0000000-0000-4000-8000-000000000001';
const TENANT_ID = '40000000-0000-4000-8000-000000000001';
const INVITATION_ID = '50000000-0000-4000-8000-000000000001';
const TOKEN = 'invite_once_SENSITIVE_TOKEN';
const SENSITIVE_MESSAGE = 'SQL tokenDigest secret stack MUST_NOT_RENDER';

function session(
  organizationType: 'PLATFORM' | 'CHANNEL' | 'TENANT',
  role: 'platform_admin' | 'channel_admin' | 'tenant_admin' | 'content_operator',
): PilotSession {
  const tenant = organizationType === 'TENANT' ? { id: TENANT_ID, displayName: '测试租户' } : null;
  return {
    user: { id: 'user-1', email: 'admin@example.com', displayName: '管理员' },
    tenant,
    roles: [role],
    activeContext: {
      membershipId: 'membership-1',
      organizationId:
        organizationType === 'TENANT'
          ? TENANT_ID
          : organizationType === 'CHANNEL'
            ? CHANNEL_ORG_ID
            : 'b0000000-0000-4000-8000-000000000001',
      organizationType,
      organizationDisplayName: `${organizationType} 组织`,
      membershipVersion: 1,
      primaryRole: role,
      roles: [role],
      tenantId: organizationType === 'TENANT' ? TENANT_ID : null,
    },
    expiresAt: '2026-08-11T00:00:00.000Z',
  };
}

const channelReference: PilotCommercialChannelReference = {
  channelId: CHANNEL_ID,
  organizationId: CHANNEL_ORG_ID,
  displayName: '真实渠道 A',
  organizationStatus: 'active',
};

function invitation(
  status: PilotInvitationManagement['status'] = 'active',
  invitationType: PilotInvitationManagement['invitationType'] = 'PLATFORM',
): PilotInvitationManagement {
  return {
    invitationId: INVITATION_ID,
    invitationType,
    targetOrganizationId: invitationType === 'TENANT_MEMBER' ? TENANT_ID : null,
    targetRoleCode: invitationType === 'TENANT_MEMBER' ? 'content_operator' : null,
    targetEmail: invitationType === 'CHANNEL' ? null : 'invitee@example.com',
    attributionChannelId: invitationType === 'PLATFORM' ? CHANNEL_ID : null,
    status,
    validFrom: '2026-08-10T01:00:00.000Z',
    expiresAt: '2026-08-17T01:00:00.000Z',
    maxUses: invitationType === 'CHANNEL' ? 100 : 1,
    usedCount: status === 'exhausted' ? 1 : 0,
    remainingUses: status === 'exhausted' ? 0 : invitationType === 'CHANNEL' ? 100 : 1,
    createdAt: '2026-08-10T01:00:00.000Z',
    updatedAt: '2026-08-10T01:00:00.000Z',
    revokedAt: status === 'revoked' ? '2026-08-10T02:00:00.000Z' : null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function renderPage(page: React.ReactElement) {
  return render(<AppProviders>{page}</AppProviders>);
}

beforeEach(() => {
  vi.restoreAllMocks();
  usePilotProjectContextStore.getState().reset();
});

describe('A-BIZ-06C.4 Organization Invitation Operations Pages', () => {
  it('loads Platform invitations and the real active Channel Directory without Demo fallback', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: session('PLATFORM', 'platform_admin'),
      error: null,
      requestId: null,
    });
    const list = deferred<PilotInvitationManagement[]>();
    const demoRead = vi.spyOn(demoStore, 'useControlPlaneStore');
    vi.spyOn(pilotControlApi, 'listActiveChannels').mockResolvedValue([channelReference]);
    vi.spyOn(pilotControlApi, 'listPlatformInvitations').mockReturnValue(list.promise);

    renderPage(<PilotPlatformInvitationsPage />);

    expect(screen.getByTestId('pilot-invitations-loading')).toBeInTheDocument();
    expect(pilotControlApi.listActiveChannels).toHaveBeenCalledWith(100);
    expect(pilotControlApi.listPlatformInvitations).toHaveBeenCalledWith('all', 100);
    expect(demoRead).not.toHaveBeenCalled();
    list.resolve([]);

    expect(await screen.findByTestId('pilot-invitations-empty')).toHaveTextContent(
      '当前 bounded directory 没有邀请',
    );
    expect(screen.getByLabelText('Attribution Channel')).toHaveTextContent('真实渠道 A');
    expect(document.body).not.toHaveTextContent(CHANNEL_ID);
    expect(document.body).not.toHaveTextContent(CHANNEL_ORG_ID);
  });

  it('reads canonical current Channel before listing and never guesses organizationId equals channelId', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: session('CHANNEL', 'channel_admin'),
      error: null,
      requestId: null,
    });
    vi.spyOn(pilotControlApi, 'readCurrentChannel').mockResolvedValue(channelReference);
    vi.spyOn(pilotControlApi, 'listChannelInvitations').mockResolvedValue([]);

    renderPage(<PilotChannelInvitationsPage />);

    expect(await screen.findByTestId('pilot-invitations-empty')).toBeInTheDocument();
    expect(pilotControlApi.readCurrentChannel).toHaveBeenCalledTimes(1);
    expect(pilotControlApi.listChannelInvitations).toHaveBeenCalledWith(CHANNEL_ID, 'all', 100);
    expect(pilotControlApi.listChannelInvitations).not.toHaveBeenCalledWith(
      CHANNEL_ORG_ID,
      'all',
      100,
    );
    expect(screen.getByText('真实渠道 A')).toBeInTheDocument();
  });

  it('uses only Session tenantId and rejects content_operator before any API call', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: session('TENANT', 'tenant_admin'),
      error: null,
      requestId: null,
    });
    const list = vi.spyOn(pilotControlApi, 'listTenantInvitations').mockResolvedValue([]);

    const view = renderPage(<PilotTenantInvitationsPage />);
    expect(await screen.findByTestId('pilot-invitations-empty')).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith(TENANT_ID, 'all', 100);

    view.unmount();
    vi.clearAllMocks();
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: session('TENANT', 'content_operator'),
      error: null,
      requestId: null,
    });
    renderPage(<PilotTenantInvitationsPage />);
    expect(await screen.findByTestId('pilot-invitations-permission-denied')).toHaveTextContent(
      '仅 tenant_admin',
    );
    expect(list).not.toHaveBeenCalled();
  });

  it('renders active, revoked, exhausted and expired directory states without historical tokens', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: session('PLATFORM', 'platform_admin'),
      error: null,
      requestId: null,
    });
    vi.spyOn(pilotControlApi, 'listActiveChannels').mockResolvedValue([channelReference]);
    vi.spyOn(pilotControlApi, 'listPlatformInvitations').mockResolvedValue([
      invitation('active'),
      { ...invitation('revoked'), invitationId: '50000000-0000-4000-8000-000000000002' },
      { ...invitation('exhausted'), invitationId: '50000000-0000-4000-8000-000000000003' },
      { ...invitation('expired'), invitationId: '50000000-0000-4000-8000-000000000004' },
    ]);

    renderPage(<PilotPlatformInvitationsPage />);

    const ready = await screen.findByTestId('pilot-invitations-ready');
    expect(ready).toHaveTextContent('active');
    expect(ready).toHaveTextContent('revoked');
    expect(ready).toHaveTextContent('exhausted');
    expect(ready).toHaveTextContent('expired');
    expect(ready).not.toHaveTextContent(TOKEN);
    expect(document.body).toHaveTextContent('bounded 100');
  });

  it('creates a Platform invitation with an explicit active attribution Channel and shows token once', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: session('PLATFORM', 'platform_admin'),
      error: null,
      requestId: null,
    });
    vi.spyOn(pilotControlApi, 'listActiveChannels').mockResolvedValue([channelReference]);
    const list = vi.spyOn(pilotControlApi, 'listPlatformInvitations').mockResolvedValue([]);
    const create = vi.spyOn(pilotControlApi, 'createPlatformInvitation').mockResolvedValue({
      invitation: invitation('active'),
      token: TOKEN,
      replayed: false,
    });

    renderPage(<PilotPlatformInvitationsPage />);
    await screen.findByTestId('pilot-invitations-empty');
    fireEvent.change(screen.getByLabelText('Target email'), {
      target: { value: 'invitee@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Attribution Channel'), {
      target: { value: CHANNEL_ID },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建邀请' }));

    const token = await screen.findByTestId('pilot-invitation-one-time-token');
    expect(token).toHaveTextContent('仅本次可见');
    expect(token).toHaveTextContent(TOKEN);
    expect(create).toHaveBeenCalledWith({
      targetEmail: 'invitee@example.com',
      attributionChannelId: CHANNEL_ID,
      idempotencyKey: expect.any(String),
    });
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('clears the previous token before another create and does not recover it on replay', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: session('TENANT', 'tenant_admin'),
      error: null,
      requestId: null,
    });
    vi.spyOn(pilotControlApi, 'listTenantInvitations').mockResolvedValue([]);
    const second = deferred<Awaited<ReturnType<typeof pilotControlApi.createTenantInvitation>>>();
    vi.spyOn(pilotControlApi, 'createTenantInvitation')
      .mockResolvedValueOnce({
        invitation: invitation('active', 'TENANT_MEMBER'),
        token: TOKEN,
        replayed: false,
      })
      .mockReturnValueOnce(second.promise);

    renderPage(<PilotTenantInvitationsPage />);
    await screen.findByTestId('pilot-invitations-empty');
    const email = screen.getByLabelText('Target email');
    fireEvent.change(email, { target: { value: 'invitee@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '创建邀请' }));
    expect(await screen.findByText(TOKEN)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '创建邀请' }));
    expect(screen.queryByText(TOKEN)).not.toBeInTheDocument();
    second.resolve({
      invitation: invitation('active', 'TENANT_MEMBER'),
      token: null,
      replayed: true,
    });
    expect(await screen.findByTestId('pilot-invitation-replayed')).toHaveTextContent(
      '幂等重放不恢复历史 Token',
    );
    expect(screen.queryByText(TOKEN)).not.toBeInTheDocument();
  });

  it('creates a Channel invitation using only the canonical current channelId', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: session('CHANNEL', 'channel_admin'),
      error: null,
      requestId: null,
    });
    vi.spyOn(pilotControlApi, 'readCurrentChannel').mockResolvedValue(channelReference);
    vi.spyOn(pilotControlApi, 'listChannelInvitations').mockResolvedValue([]);
    const create = vi.spyOn(pilotControlApi, 'createChannelInvitation').mockResolvedValue({
      invitation: invitation('active', 'CHANNEL'),
      token: TOKEN,
      replayed: false,
    });

    renderPage(<PilotChannelInvitationsPage />);
    await screen.findByTestId('pilot-invitations-empty');
    fireEvent.click(screen.getByRole('button', { name: '创建邀请' }));

    await screen.findByText(TOKEN);
    expect(create).toHaveBeenCalledWith(CHANNEL_ID, { idempotencyKey: expect.any(String) });
    expect(create).not.toHaveBeenCalledWith(CHANNEL_ORG_ID, expect.anything());
  });

  it('revokes only an active invitation after confirmation, reports replay and refreshes', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: session('PLATFORM', 'platform_admin'),
      error: null,
      requestId: null,
    });
    vi.spyOn(pilotControlApi, 'listActiveChannels').mockResolvedValue([]);
    const list = vi
      .spyOn(pilotControlApi, 'listPlatformInvitations')
      .mockResolvedValue([invitation('active')]);
    const revoke = vi.spyOn(pilotControlApi, 'revokeInvitation').mockResolvedValue({
      invitation: invitation('revoked'),
      replayed: true,
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage(<PilotPlatformInvitationsPage />);
    const ready = await screen.findByTestId('pilot-invitations-ready');
    fireEvent.click(within(ready).getByRole('button', { name: '撤销邀请' }));

    expect(window.confirm).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith(INVITATION_ID);
    expect(await screen.findByTestId('pilot-invitation-mutation-success')).toHaveTextContent(
      '幂等重放',
    );
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('maps safe errors, preserves Request ID, retries, and never renders the raw message', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: session('PLATFORM', 'platform_admin'),
      error: null,
      requestId: null,
    });
    vi.spyOn(pilotControlApi, 'listActiveChannels').mockResolvedValue([]);
    const list = vi
      .spyOn(pilotControlApi, 'listPlatformInvitations')
      .mockRejectedValueOnce(
        new PilotControlApiError('INTERNAL_ERROR', SENSITIVE_MESSAGE, 500, 'invite-500'),
      )
      .mockResolvedValueOnce([]);

    renderPage(<PilotPlatformInvitationsPage />);

    const error = await screen.findByTestId('pilot-invitations-service-error');
    expect(error).toHaveTextContent('请求 ID：invite-500');
    expect(error).not.toHaveTextContent(SENSITIVE_MESSAGE);
    fireEvent.click(screen.getByRole('button', { name: '重试真实邀请目录' }));
    expect(await screen.findByTestId('pilot-invitations-empty')).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('clears Pilot Session, Project Context, token and controls on 401', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: session('TENANT', 'tenant_admin'),
      error: null,
      requestId: null,
    });
    vi.spyOn(pilotControlApi, 'listTenantInvitations').mockRejectedValue(
      new PilotControlApiError('AUTHENTICATION_REQUIRED', SENSITIVE_MESSAGE, 401, 'invite-401'),
    );

    renderPage(<PilotTenantInvitationsPage />);

    const error = await screen.findByTestId('pilot-invitations-unauthorized');
    expect(error).toHaveTextContent('请求 ID：invite-401');
    expect(error).not.toHaveTextContent(SENSITIVE_MESSAGE);
    expect(screen.queryByRole('button', { name: '创建邀请' })).not.toBeInTheDocument();
    expect(usePilotAuthStore.getState()).toMatchObject({ status: 'anonymous', session: null });
    expect(usePilotProjectContextStore.getState().status).toBe('idle');
  });

  it('changes the bounded status filter using the real directory only', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: session('PLATFORM', 'platform_admin'),
      error: null,
      requestId: null,
    });
    vi.spyOn(pilotControlApi, 'listActiveChannels').mockResolvedValue([]);
    const list = vi.spyOn(pilotControlApi, 'listPlatformInvitations').mockResolvedValue([]);

    renderPage(<PilotPlatformInvitationsPage />);
    await screen.findByTestId('pilot-invitations-empty');
    fireEvent.change(screen.getByLabelText('Invitation status filter'), {
      target: { value: 'expired' },
    });

    await waitFor(() => expect(list).toHaveBeenCalledWith('expired', 100));
  });
});
