import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/Providers';
import {
  PilotControlApiError,
  pilotControlApi,
  type PilotCommissionAccrualAudit,
  type PilotCommissionCalculationAudit,
  type PilotCommissionReversalAudit,
  type PilotPaymentEventAudit,
  type PilotSession,
} from '../../services/pilotControlApi';
import * as demoStore from '../../stores/controlPlaneStore';
import { usePilotAuthStore } from '../../stores/pilotAuthStore';
import { usePilotProjectContextStore } from '../../stores/pilotProjectContextStore';
import {
  PilotChannelCommissionAuditPage,
  PilotPlatformCommissionAuditPage,
} from './PilotCommissionAuditPages';

const CHANNEL_ID = '30000000-0000-4000-8000-000000000001';
const ORGANIZATION_ID = 'a0000000-0000-4000-8000-000000000001';
const SENSITIVE_TOKEN = 'SENSITIVE_PROVIDER_PAYLOAD_MUST_NOT_RENDER';

const platformSession: PilotSession = {
  user: { id: 'user-platform', email: 'platform@example.com', displayName: '平台管理员' },
  tenant: null,
  roles: ['platform_admin'],
  activeContext: {
    membershipId: 'membership-platform',
    organizationId: ORGANIZATION_ID,
    organizationType: 'PLATFORM',
    organizationDisplayName: '平台组织',
    membershipVersion: 1,
    primaryRole: 'platform_admin',
    roles: ['platform_admin'],
    tenantId: null,
  },
  expiresAt: '2026-08-10T00:00:00.000Z',
};

const paymentEvent: PilotPaymentEventAudit = {
  paymentEventId: '10000000-0000-4000-8000-000000000001',
  paymentMode: 'TEST',
  eventType: 'payment_succeeded',
  rechargeOrderId: '10000000-0000-4000-8000-000000000002',
  amountMinor: 12345,
  currency: 'CNY',
  occurredAt: '2026-08-09T01:00:00.000Z',
  receivedAt: '2026-08-09T01:00:01.000Z',
  processingStatus: 'applied',
  errorCode: null,
  processedAt: '2026-08-09T01:00:02.000Z',
};

const calculation: PilotCommissionCalculationAudit = {
  commissionCalculationOutcomeId: '20000000-0000-4000-8000-000000000001',
  sourcePaymentEventId: paymentEvent.paymentEventId,
  rechargeOrderId: paymentEvent.rechargeOrderId,
  beneficiaryChannelId: CHANNEL_ID,
  commissionRuleVersionId: '40000000-0000-4000-8000-000000000001',
  basisAmountMinor: 12345,
  currency: 'CNY',
  outcome: 'accrued',
  reasonCode: 'commission_accrued',
  occurredAt: paymentEvent.occurredAt,
  createdAt: paymentEvent.processedAt!,
};

const accrual: PilotCommissionAccrualAudit = {
  commissionAccrualId: '50000000-0000-4000-8000-000000000001',
  calculationOutcomeId: calculation.commissionCalculationOutcomeId,
  sourcePaymentEventId: paymentEvent.paymentEventId,
  rechargeOrderId: paymentEvent.rechargeOrderId,
  beneficiaryChannelId: CHANNEL_ID,
  commissionRuleVersionId: calculation.commissionRuleVersionId!,
  basisAmountMinor: 12345,
  commissionAmountMinor: 1500,
  currency: 'CNY',
  eligibleAt: '2026-08-16T01:00:00.000Z',
  occurredAt: paymentEvent.occurredAt,
  createdAt: paymentEvent.processedAt!,
};

const reversal: PilotCommissionReversalAudit = {
  commissionReversalId: '60000000-0000-4000-8000-000000000001',
  commissionAccrualId: accrual.commissionAccrualId,
  sourcePaymentEventId: '60000000-0000-4000-8000-000000000002',
  rechargeOrderId: paymentEvent.rechargeOrderId,
  beneficiaryChannelId: CHANNEL_ID,
  reversalType: 'refund',
  reversalAmountMinor: 1500,
  currency: 'CNY',
  occurredAt: '2026-08-09T02:00:00.000Z',
  createdAt: '2026-08-09T02:00:02.000Z',
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

function renderPage(element: ReactElement) {
  return render(
    <AppProviders>
      <MemoryRouter>{element}</MemoryRouter>
    </AppProviders>,
  );
}

function mockPlatformLists(
  result: {
    paymentEvents?: PilotPaymentEventAudit[];
    calculations?: PilotCommissionCalculationAudit[];
    accruals?: PilotCommissionAccrualAudit[];
    reversals?: PilotCommissionReversalAudit[];
    manualReviews?: PilotCommissionCalculationAudit[];
  } = {},
) {
  vi.spyOn(pilotControlApi, 'listPlatformPaymentEvents').mockResolvedValue(
    result.paymentEvents ?? [],
  );
  vi.spyOn(pilotControlApi, 'listPlatformCommissionCalculations').mockResolvedValue(
    result.calculations ?? [],
  );
  vi.spyOn(pilotControlApi, 'listPlatformCommissionAccruals').mockResolvedValue(
    result.accruals ?? [],
  );
  vi.spyOn(pilotControlApi, 'listPlatformCommissionReversals').mockResolvedValue(
    result.reversals ?? [],
  );
  vi.spyOn(pilotControlApi, 'listPlatformCommissionManualReviews').mockResolvedValue(
    result.manualReviews ?? [],
  );
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

describe('A-BIZ-03.4C Platform Commission Audit', () => {
  it('uses only the real Pilot API and renders loading followed by an explicit empty state', async () => {
    const pending = deferred<PilotPaymentEventAudit[]>();
    const demoStoreRead = vi.spyOn(demoStore, 'useControlPlaneStore');
    vi.spyOn(pilotControlApi, 'listPlatformPaymentEvents').mockReturnValue(pending.promise);
    vi.spyOn(pilotControlApi, 'listPlatformCommissionCalculations').mockResolvedValue([]);
    vi.spyOn(pilotControlApi, 'listPlatformCommissionAccruals').mockResolvedValue([]);
    vi.spyOn(pilotControlApi, 'listPlatformCommissionReversals').mockResolvedValue([]);
    vi.spyOn(pilotControlApi, 'listPlatformCommissionManualReviews').mockResolvedValue([]);

    renderPage(<PilotPlatformCommissionAuditPage />);

    expect(screen.getByTestId('pilot-platform-commission-audit-loading')).toBeInTheDocument();
    expect(demoStoreRead).not.toHaveBeenCalled();
    expect(pilotControlApi.listPlatformPaymentEvents).toHaveBeenCalledWith(50);
    expect(pilotControlApi.listPlatformCommissionManualReviews).toHaveBeenCalledWith(50);

    pending.resolve([]);

    expect(await screen.findByTestId('pilot-platform-commission-audit-empty')).toHaveTextContent(
      '当前窗口暂无 TEST 商业审计记录',
    );
    expect(demoStoreRead).not.toHaveBeenCalled();
  });

  it('renders bounded safe audit projections without Demo or sensitive commercial fields', async () => {
    mockPlatformLists({
      paymentEvents: [paymentEvent],
      calculations: [calculation],
      accruals: [accrual],
      reversals: [reversal],
      manualReviews: [{ ...calculation, outcome: 'manual_review', reasonCode: 'rule_unavailable' }],
    });

    renderPage(<PilotPlatformCommissionAuditPage />);

    const page = await screen.findByTestId('pilot-platform-commission-audit-ready');
    expect(within(page).getByText('Payment Events')).toBeInTheDocument();
    expect(within(page).getByText('Commission Calculations')).toBeInTheDocument();
    expect(within(page).getByText('Commission Accruals')).toBeInTheDocument();
    expect(within(page).getByText('Commission Reversals')).toBeInTheDocument();
    expect(within(page).getByText('Manual Reviews')).toBeInTheDocument();
    expect(within(page).getAllByText('123.45 CNY').length).toBeGreaterThan(0);
    expect(within(page).getByText('15.00 CNY')).toBeInTheDocument();
    expect(within(page).getByText('需平台人工处理')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(SENSITIVE_TOKEN);
    expect(document.body).not.toHaveTextContent('真实佣金比例');
    expect(document.body).not.toHaveTextContent('provider');
    expect(screen.getByText(/不表示已到账、可提现、paid 或自动打款/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve|review/i })).not.toBeInTheDocument();
  });

  it('clears stale projections while retrying and calls only the real API again', async () => {
    mockPlatformLists({ paymentEvents: [paymentEvent] });
    renderPage(<PilotPlatformCommissionAuditPage />);
    expect(await screen.findByText('payment_succeeded')).toBeInTheDocument();

    const retry = deferred<PilotPaymentEventAudit[]>();
    vi.mocked(pilotControlApi.listPlatformPaymentEvents).mockReturnValueOnce(retry.promise);
    vi.mocked(pilotControlApi.listPlatformCommissionCalculations).mockResolvedValueOnce([]);
    vi.mocked(pilotControlApi.listPlatformCommissionAccruals).mockResolvedValueOnce([]);
    vi.mocked(pilotControlApi.listPlatformCommissionReversals).mockResolvedValueOnce([]);
    vi.mocked(pilotControlApi.listPlatformCommissionManualReviews).mockResolvedValueOnce([]);

    fireEvent.click(screen.getByRole('button', { name: /重新加载真实审计/ }));

    expect(screen.getByTestId('pilot-platform-commission-audit-retrying')).toBeInTheDocument();
    expect(screen.queryByText('payment_succeeded')).not.toBeInTheDocument();
    retry.resolve([]);
    expect(await screen.findByTestId('pilot-platform-commission-audit-empty')).toBeInTheDocument();
    expect(pilotControlApi.listPlatformPaymentEvents).toHaveBeenCalledTimes(2);
  });

  it.each([
    [403, 'PERMISSION_DENIED', 'pilot-commercial-audit-forbidden', 'req-403'],
    [404, 'CHANNEL_SCOPE_NOT_FOUND', 'pilot-commercial-audit-not-found', 'req-404'],
    [500, 'INTERNAL_ERROR', 'pilot-commercial-audit-service-error', 'req-500'],
  ] as const)(
    'maps HTTP %s to a safe state and preserves Request ID',
    async (status, code, testId, requestId) => {
      mockPlatformLists();
      vi.mocked(pilotControlApi.listPlatformPaymentEvents).mockRejectedValueOnce(
        new PilotControlApiError(code, SENSITIVE_TOKEN, status, requestId),
      );

      renderPage(<PilotPlatformCommissionAuditPage />);

      const state = await screen.findByTestId(testId);
      expect(state).toHaveTextContent(`请求 ID：${requestId}`);
      expect(state).not.toHaveTextContent(SENSITIVE_TOKEN);
    },
  );

  it('fails closed on an invalid success projection without rendering parser details', async () => {
    mockPlatformLists();
    vi.mocked(pilotControlApi.listPlatformPaymentEvents).mockRejectedValueOnce(
      new PilotControlApiError('INVALID_API_RESPONSE', SENSITIVE_TOKEN, null, null),
    );

    renderPage(<PilotPlatformCommissionAuditPage />);

    const state = await screen.findByTestId('pilot-commercial-audit-invalid-response');
    expect(state).toHaveTextContent('页面已 fail closed');
    expect(state).not.toHaveTextContent(SENSITIVE_TOKEN);
    expect(screen.getByRole('button', { name: /重试真实 Control API/ })).toBeInTheDocument();
  });

  it('clears the in-memory Pilot session on 401 without exposing the server body', async () => {
    mockPlatformLists();
    usePilotProjectContextStore.setState({
      status: 'ready',
      projects: [],
      activeProjectId: 'project-stale',
      context: null,
      error: null,
      requestId: null,
    });
    vi.mocked(pilotControlApi.listPlatformPaymentEvents).mockRejectedValueOnce(
      new PilotControlApiError('AUTHENTICATION_REQUIRED', SENSITIVE_TOKEN, 401, 'req-401'),
    );

    renderPage(<PilotPlatformCommissionAuditPage />);

    const state = await screen.findByTestId('pilot-commercial-audit-unauthorized');
    expect(state).toHaveTextContent('会话已失效，请重新登录');
    expect(state).not.toHaveTextContent(SENSITIVE_TOKEN);
    expect(usePilotAuthStore.getState()).toMatchObject({ status: 'anonymous', session: null });
    expect(usePilotProjectContextStore.getState()).toMatchObject({ status: 'idle', projects: [] });
  });
});

describe('A-BIZ-03.4C Channel Commission Audit', () => {
  it('resolves canonical Channel first, then requests only that Channel audit scope', async () => {
    const currentChannel = deferred<{
      channelId: string;
      organizationId: string;
      displayName: string;
      organizationStatus: 'active';
    }>();
    vi.spyOn(pilotControlApi, 'readCurrentChannel').mockReturnValue(currentChannel.promise);
    vi.spyOn(pilotControlApi, 'listChannelCommissionCalculations').mockResolvedValue([]);
    vi.spyOn(pilotControlApi, 'listChannelCommissionAccruals').mockResolvedValue([]);
    vi.spyOn(pilotControlApi, 'listChannelCommissionReversals').mockResolvedValue([]);

    renderPage(<PilotChannelCommissionAuditPage />);

    expect(screen.getByTestId('pilot-channel-commission-audit-loading')).toBeInTheDocument();
    expect(pilotControlApi.listChannelCommissionCalculations).not.toHaveBeenCalled();

    currentChannel.resolve({
      channelId: CHANNEL_ID,
      organizationId: ORGANIZATION_ID,
      displayName: '渠道 A',
      organizationStatus: 'active',
    });

    expect(await screen.findByTestId('pilot-channel-commission-audit-empty')).toHaveTextContent(
      '渠道 A',
    );
    expect(pilotControlApi.listChannelCommissionCalculations).toHaveBeenCalledWith(CHANNEL_ID, 50);
    expect(pilotControlApi.listChannelCommissionAccruals).toHaveBeenCalledWith(CHANNEL_ID, 50);
    expect(pilotControlApi.listChannelCommissionReversals).toHaveBeenCalledWith(CHANNEL_ID, 50);
    expect(pilotControlApi.listChannelCommissionCalculations).not.toHaveBeenCalledWith(
      ORGANIZATION_ID,
      expect.anything(),
    );
  });

  it('stops after a canonical Channel lookup failure and preserves a safe 404 state', async () => {
    vi.spyOn(pilotControlApi, 'readCurrentChannel').mockRejectedValue(
      new PilotControlApiError('CHANNEL_SCOPE_NOT_FOUND', SENSITIVE_TOKEN, 404, 'channel-404'),
    );
    vi.spyOn(pilotControlApi, 'listChannelCommissionCalculations').mockResolvedValue([]);
    vi.spyOn(pilotControlApi, 'listChannelCommissionAccruals').mockResolvedValue([]);
    vi.spyOn(pilotControlApi, 'listChannelCommissionReversals').mockResolvedValue([]);

    renderPage(<PilotChannelCommissionAuditPage />);

    const state = await screen.findByTestId('pilot-commercial-audit-not-found');
    expect(state).toHaveTextContent('请求 ID：channel-404');
    expect(state).not.toHaveTextContent(SENSITIVE_TOKEN);
    expect(pilotControlApi.listChannelCommissionCalculations).not.toHaveBeenCalled();
  });

  it('renders the canonical Channel safe projection and never offers cross-Channel input', async () => {
    vi.spyOn(pilotControlApi, 'readCurrentChannel').mockResolvedValue({
      channelId: CHANNEL_ID,
      organizationId: ORGANIZATION_ID,
      displayName: '渠道 A',
      organizationStatus: 'active',
    });
    vi.spyOn(pilotControlApi, 'listChannelCommissionCalculations').mockResolvedValue([calculation]);
    vi.spyOn(pilotControlApi, 'listChannelCommissionAccruals').mockResolvedValue([accrual]);
    vi.spyOn(pilotControlApi, 'listChannelCommissionReversals').mockResolvedValue([reversal]);

    renderPage(<PilotChannelCommissionAuditPage />);

    const page = await screen.findByTestId('pilot-channel-commission-audit-ready');
    expect(screen.getByRole('heading', { name: '渠道佣金审计' })).toBeInTheDocument();
    expect(within(page).getByText('渠道 A')).toBeInTheDocument();
    expect(within(page).getByText('commission_accrued')).toBeInTheDocument();
    expect(within(page).getByText('15.00 CNY')).toBeInTheDocument();
    expect(within(page).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(page).queryByRole('combobox')).not.toBeInTheDocument();
  });
});
