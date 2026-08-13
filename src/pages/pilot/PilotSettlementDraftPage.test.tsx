import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/Providers';
import {
  PilotControlApiError,
  pilotControlApi,
  type PilotCommissionSettlementResult,
  type PilotCommercialChannelReference,
  type PilotSession,
} from '../../services/pilotControlApi';
import * as demoStore from '../../stores/controlPlaneStore';
import { usePilotAuthStore } from '../../stores/pilotAuthStore';
import { usePilotProjectContextStore } from '../../stores/pilotProjectContextStore';
import { PilotPlatformSettlementDraftPage } from './PilotSettlementDraftPage';

const CHANNEL_A: PilotCommercialChannelReference = {
  channelId: '30000000-0000-4000-8000-000000000001',
  organizationId: 'a0000000-0000-4000-8000-000000000001',
  displayName: '渠道 A',
  organizationStatus: 'active',
};
const CHANNEL_B: PilotCommercialChannelReference = {
  channelId: '30000000-0000-4000-8000-000000000002',
  organizationId: 'a0000000-0000-4000-8000-000000000002',
  displayName: '渠道 B',
  organizationStatus: 'active',
};
const SENSITIVE_TOKEN = 'SENSITIVE_SETTLEMENT_INTERNAL_BODY';

const platformSession: PilotSession = {
  user: { id: 'user-platform', email: 'platform@example.com', displayName: '平台管理员' },
  tenant: null,
  roles: ['platform_admin'],
  activeContext: {
    membershipId: 'membership-platform',
    organizationId: 'a0000000-0000-4000-8000-000000000000',
    organizationType: 'PLATFORM',
    organizationDisplayName: '平台组织',
    membershipVersion: 1,
    primaryRole: 'platform_admin',
    roles: ['platform_admin'],
    tenantId: null,
  },
  expiresAt: '2026-08-10T00:00:00.000Z',
};

const zeroDraftResult: PilotCommissionSettlementResult = {
  replayed: false,
  settlement: {
    commissionSettlementId: '70000000-0000-4000-8000-000000000001',
    paymentMode: 'TEST',
    beneficiaryChannelId: CHANNEL_A.channelId,
    currency: 'CNY',
    periodStart: '2026-08-01T00:00:00.000Z',
    periodEnd: '2026-09-01T00:00:00.000Z',
    cutoffAt: '2026-09-01T00:00:00.000Z',
    status: 'draft',
    grossAccrualAmountMinor: 0,
    grossReversalAmountMinor: 0,
    netAmountMinor: 0,
    accrualItemCount: 0,
    reversalItemCount: 0,
    itemCount: 0,
    createdAt: '2026-08-09T08:00:00.000Z',
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderPage() {
  return render(
    <AppProviders>
      <PilotPlatformSettlementDraftPage />
    </AppProviders>,
  );
}

function setFormFacts({
  channelId = CHANNEL_A.channelId,
  period = '2026-08',
  cutoff = '2026-09-01T00:00',
}: {
  channelId?: string;
  period?: string;
  cutoff?: string;
} = {}) {
  fireEvent.change(screen.getByLabelText('Active beneficiary Channel'), {
    target: { value: channelId },
  });
  fireEvent.change(screen.getByLabelText('UTC 结算自然月'), { target: { value: period } });
  fireEvent.change(screen.getByLabelText('UTC 截止时间'), { target: { value: cutoff } });
}

beforeEach(() => {
  vi.restoreAllMocks();
  usePilotAuthStore.setState({
    status: 'authenticated',
    session: platformSession,
    error: null,
    requestId: null,
  });
  usePilotProjectContextStore.getState().reset();
});

describe('A-BIZ-03.4D Platform TEST Settlement Draft', () => {
  it('loads only the real active Channel Directory and renders a safe empty state', async () => {
    const directory = deferred<PilotCommercialChannelReference[]>();
    const demoStoreRead = vi.spyOn(demoStore, 'useControlPlaneStore');
    vi.spyOn(pilotControlApi, 'listActiveChannels').mockReturnValue(directory.promise);
    vi.spyOn(pilotControlApi, 'createTestCommissionSettlement').mockResolvedValue(zeroDraftResult);

    renderPage();

    expect(screen.getByTestId('pilot-settlement-channel-loading')).toBeInTheDocument();
    expect(pilotControlApi.listActiveChannels).toHaveBeenCalledWith(100);
    expect(demoStoreRead).not.toHaveBeenCalled();
    directory.resolve([]);

    const empty = await screen.findByTestId('pilot-settlement-channel-empty');
    expect(empty).toHaveTextContent('当前没有可用的 active Channel');
    expect(screen.getAllByText('TEST').length).toBeGreaterThan(0);
    expect(screen.getAllByText('draft').length).toBeGreaterThan(0);
    expect(screen.getAllByText('NON_QUOTE').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/Channel UUID/i)).not.toBeInTheDocument();
    expect(pilotControlApi.createTestCommissionSettlement).not.toHaveBeenCalled();
  });

  it('offers only Directory channels and never provides a manual beneficiary UUID field', async () => {
    vi.spyOn(pilotControlApi, 'listActiveChannels').mockResolvedValue([CHANNEL_A, CHANNEL_B]);
    vi.spyOn(pilotControlApi, 'createTestCommissionSettlement').mockResolvedValue(zeroDraftResult);

    renderPage();

    const form = await screen.findByTestId('pilot-settlement-draft-form');
    const channelSelect = within(form).getByLabelText('Active beneficiary Channel');
    expect(within(channelSelect).getByRole('option', { name: '渠道 A' })).toHaveValue(
      CHANNEL_A.channelId,
    );
    expect(within(channelSelect).getByRole('option', { name: '渠道 B' })).toHaveValue(
      CHANNEL_B.channelId,
    );
    expect(within(form).queryByRole('textbox', { name: /Channel/i })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(CHANNEL_A.organizationId);
  });

  it('creates only a TEST draft with UTC month/cutoff and the selected active Channel', async () => {
    vi.spyOn(pilotControlApi, 'listActiveChannels').mockResolvedValue([CHANNEL_A, CHANNEL_B]);
    const create = vi
      .spyOn(pilotControlApi, 'createTestCommissionSettlement')
      .mockResolvedValue(zeroDraftResult);

    renderPage();
    await screen.findByTestId('pilot-settlement-draft-form');
    setFormFacts({ channelId: CHANNEL_A.channelId });
    fireEvent.click(screen.getByRole('button', { name: /创建 TEST draft/ }));

    await screen.findByTestId('pilot-settlement-current-draft');
    expect(create).toHaveBeenCalledWith({
      paymentMode: 'TEST',
      beneficiaryChannelId: CHANNEL_A.channelId,
      currency: 'CNY',
      periodStart: '2026-08-01',
      cutoffAt: '2026-09-01T00:00:00.000Z',
      idempotencyKey: expect.any(String),
    });
  });

  it('keeps one idempotency key across a retry and rotates it after business facts change', async () => {
    vi.spyOn(pilotControlApi, 'listActiveChannels').mockResolvedValue([CHANNEL_A, CHANNEL_B]);
    const create = vi
      .spyOn(pilotControlApi, 'createTestCommissionSettlement')
      .mockRejectedValueOnce(
        new PilotControlApiError('INTERNAL_ERROR', SENSITIVE_TOKEN, 500, 'settlement-500'),
      )
      .mockResolvedValueOnce(zeroDraftResult)
      .mockResolvedValueOnce({
        ...zeroDraftResult,
        settlement: { ...zeroDraftResult.settlement, beneficiaryChannelId: CHANNEL_B.channelId },
      });

    renderPage();
    await screen.findByTestId('pilot-settlement-draft-form');
    setFormFacts();
    fireEvent.click(screen.getByRole('button', { name: /创建 TEST draft/ }));

    const error = await screen.findByTestId('pilot-settlement-submit-service-error');
    expect(error).toHaveTextContent('请求 ID：settlement-500');
    expect(error).not.toHaveTextContent(SENSITIVE_TOKEN);
    const firstKey = create.mock.calls[0]?.[0].idempotencyKey;

    fireEvent.click(screen.getByRole('button', { name: /重试相同 TEST 事实/ }));
    await screen.findByTestId('pilot-settlement-current-draft');
    expect(create.mock.calls[1]?.[0].idempotencyKey).toBe(firstKey);

    fireEvent.change(screen.getByLabelText('Active beneficiary Channel'), {
      target: { value: CHANNEL_B.channelId },
    });
    fireEvent.click(screen.getByRole('button', { name: /创建 TEST draft/ }));
    await screen.findByText('渠道 B');
    expect(create.mock.calls[2]?.[0].idempotencyKey).not.toBe(firstKey);
  });

  it('does not rotate the key or hide Request ID on a 409 conflict', async () => {
    vi.spyOn(pilotControlApi, 'listActiveChannels').mockResolvedValue([CHANNEL_A]);
    const create = vi
      .spyOn(pilotControlApi, 'createTestCommissionSettlement')
      .mockRejectedValue(
        new PilotControlApiError(
          'SETTLEMENT_IDEMPOTENCY_CONFLICT',
          SENSITIVE_TOKEN,
          409,
          'settlement-409',
        ),
      );

    renderPage();
    await screen.findByTestId('pilot-settlement-draft-form');
    setFormFacts();
    fireEvent.click(screen.getByRole('button', { name: /创建 TEST draft/ }));

    const conflict = await screen.findByTestId('pilot-settlement-submit-conflict');
    expect(conflict).toHaveTextContent('请求 ID：settlement-409');
    expect(conflict).not.toHaveTextContent(SENSITIVE_TOKEN);
    const firstKey = create.mock.calls[0]?.[0].idempotencyKey;

    fireEvent.click(screen.getByRole('button', { name: /重试相同 TEST 事实/ }));
    await screen.findByTestId('pilot-settlement-submit-conflict');
    expect(create.mock.calls[1]?.[0].idempotencyKey).toBe(firstKey);
  });

  it('shows a zero-candidate draft as a valid current result without fabricating history', async () => {
    vi.spyOn(pilotControlApi, 'listActiveChannels').mockResolvedValue([CHANNEL_A]);
    vi.spyOn(pilotControlApi, 'createTestCommissionSettlement').mockResolvedValue(zeroDraftResult);

    renderPage();
    await screen.findByTestId('pilot-settlement-draft-form');
    setFormFacts();
    fireEvent.click(screen.getByRole('button', { name: /创建 TEST draft/ }));

    const result = await screen.findByTestId('pilot-settlement-current-draft');
    expect(result).toHaveTextContent('当前 API 返回的 Draft');
    expect(result).toHaveTextContent('0.00 CNY');
    expect(result).toHaveTextContent('零候选是有效审计结果，不是创建失败');
    expect(result).toHaveTextContent('draft');
    expect(result).toHaveTextContent('NON_QUOTE');
    expect(document.body).not.toHaveTextContent('历史 Settlement');
    expect(document.body).not.toHaveTextContent('已到账');
    expect(screen.getByText(/非到账、非提现、非 paid、非自动打款/)).toBeInTheDocument();
  });

  it('rejects a cutoff before UTC period end without calling the API', async () => {
    vi.spyOn(pilotControlApi, 'listActiveChannels').mockResolvedValue([CHANNEL_A]);
    const create = vi
      .spyOn(pilotControlApi, 'createTestCommissionSettlement')
      .mockResolvedValue(zeroDraftResult);

    renderPage();
    await screen.findByTestId('pilot-settlement-draft-form');
    setFormFacts({ cutoff: '2026-08-31T23:59' });
    fireEvent.click(screen.getByRole('button', { name: /创建 TEST draft/ }));

    expect(await screen.findByTestId('pilot-settlement-validation-error')).toHaveTextContent(
      '不得早于该 UTC 自然月结束时间',
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('clears Pilot Session on a 401 Directory response and does not render raw details', async () => {
    vi.spyOn(pilotControlApi, 'listActiveChannels').mockRejectedValue(
      new PilotControlApiError('AUTHENTICATION_REQUIRED', SENSITIVE_TOKEN, 401, 'directory-401'),
    );
    vi.spyOn(pilotControlApi, 'createTestCommissionSettlement').mockResolvedValue(zeroDraftResult);

    renderPage();

    const state = await screen.findByTestId('pilot-settlement-channel-unauthorized');
    expect(state).toHaveTextContent('会话已失效，请重新登录');
    expect(state).not.toHaveTextContent(SENSITIVE_TOKEN);
    expect(usePilotAuthStore.getState()).toMatchObject({ status: 'anonymous', session: null });
  });
});
