import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/Providers';
import {
  PilotControlApiError,
  pilotControlApi,
  type PilotRechargeOrderAudit,
  type PilotSession,
} from '../../services/pilotControlApi';
import * as demoStore from '../../stores/controlPlaneStore';
import { usePilotAuthStore } from '../../stores/pilotAuthStore';
import { usePilotProjectContextStore } from '../../stores/pilotProjectContextStore';
import { PilotTenantRechargeAuditPage } from './PilotTenantRechargeAuditPage';

const TENANT_ID = '80000000-0000-4000-8000-000000000001';
const OTHER_TENANT_ID = '80000000-0000-4000-8000-000000000099';
const SENSITIVE_TOKEN = 'SENSITIVE_RECHARGE_INTERNAL_BODY';

const tenantAdminSession: PilotSession = {
  user: { id: 'user-tenant-admin', email: 'admin@example.com', displayName: '租户管理员' },
  tenant: { id: TENANT_ID, displayName: '海底捞 TEST Tenant' },
  roles: ['tenant_admin'],
  activeContext: {
    membershipId: 'membership-tenant-admin',
    organizationId: TENANT_ID,
    organizationType: 'TENANT',
    organizationDisplayName: '海底捞 TEST Tenant',
    membershipVersion: 1,
    primaryRole: 'tenant_admin',
    roles: ['tenant_admin'],
    tenantId: TENANT_ID,
  },
  expiresAt: '2026-08-10T00:00:00.000Z',
};

const contentOperatorSession: PilotSession = {
  ...tenantAdminSession,
  user: { id: 'user-content', email: 'content@example.com', displayName: '内容运营' },
  roles: ['content_operator'],
  activeContext: {
    ...tenantAdminSession.activeContext,
    membershipId: 'membership-content',
    primaryRole: 'content_operator',
    roles: ['content_operator'],
  },
};

const rechargeOrders: PilotRechargeOrderAudit[] = [
  {
    rechargeOrderId: '81000000-0000-4000-8000-000000000001',
    paymentMode: 'TEST',
    amountMinor: 10000,
    currency: 'CNY',
    purchasedCredits: 1000,
    bonusCredits: 100,
    bonusExpiresInDays: 30,
    status: 'paid',
    createdAt: '2026-08-09T04:00:00.000Z',
    updatedAt: '2026-08-09T04:00:02.000Z',
  },
  {
    rechargeOrderId: '81000000-0000-4000-8000-000000000002',
    paymentMode: 'TEST',
    amountMinor: 2500,
    currency: 'CNY',
    purchasedCredits: 250,
    bonusCredits: 0,
    bonusExpiresInDays: null,
    status: 'refunded',
    createdAt: '2026-08-08T04:00:00.000Z',
    updatedAt: '2026-08-09T05:00:00.000Z',
  },
  {
    rechargeOrderId: '81000000-0000-4000-8000-000000000003',
    paymentMode: 'TEST',
    amountMinor: 5000,
    currency: 'CNY',
    purchasedCredits: 500,
    bonusCredits: 50,
    bonusExpiresInDays: 7,
    status: 'disputed',
    createdAt: '2026-08-07T04:00:00.000Z',
    updatedAt: '2026-08-09T06:00:00.000Z',
  },
];

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
      <PilotTenantRechargeAuditPage />
    </AppProviders>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  usePilotAuthStore.setState({
    status: 'authenticated',
    session: tenantAdminSession,
    error: null,
    requestId: null,
  });
  usePilotProjectContextStore.getState().reset();
});

describe('A-BIZ-03.4E Tenant TEST RechargeOrder Audit', () => {
  it('uses only the Session canonical tenantId and renders loading followed by empty', async () => {
    const response = deferred<PilotRechargeOrderAudit[]>();
    const demoStoreRead = vi.spyOn(demoStore, 'useControlPlaneStore');
    vi.spyOn(pilotControlApi, 'listTenantRechargeOrders').mockReturnValue(response.promise);

    renderPage();

    expect(screen.getByTestId('pilot-tenant-recharge-loading')).toBeInTheDocument();
    expect(pilotControlApi.listTenantRechargeOrders).toHaveBeenCalledWith(TENANT_ID, 50);
    expect(pilotControlApi.listTenantRechargeOrders).not.toHaveBeenCalledWith(OTHER_TENANT_ID, 50);
    expect(demoStoreRead).not.toHaveBeenCalled();
    response.resolve([]);

    const empty = await screen.findByTestId('pilot-tenant-recharge-empty');
    expect(empty).toHaveTextContent('当前 bounded window 没有 TEST RechargeOrder');
    expect(screen.getByText(/非真实收款、非可用余额承诺/)).toBeInTheDocument();
  });

  it('renders only the bounded safe TEST audit projection including refund and dispute states', async () => {
    vi.spyOn(pilotControlApi, 'listTenantRechargeOrders').mockResolvedValue(rechargeOrders);

    renderPage();

    const ready = await screen.findByTestId('pilot-tenant-recharge-ready');
    expect(ready).toHaveTextContent('100.00 CNY');
    expect(ready).toHaveTextContent('购买额度 1,000');
    expect(ready).toHaveTextContent('赠送额度 100');
    expect(ready).toHaveTextContent('paid');
    expect(ready).toHaveTextContent('refunded');
    expect(ready).toHaveTextContent('disputed');
    expect(ready).toHaveTextContent('退款/争议仅表示 TEST 审计状态');
    expect(document.body).not.toHaveTextContent(rechargeOrders[0].rechargeOrderId);
    expect(document.body).not.toHaveTextContent(TENANT_ID);
  });

  it('does not expose Recharge POST, payment simulation, provider data or Demo fallback', async () => {
    vi.spyOn(pilotControlApi, 'listTenantRechargeOrders').mockResolvedValue(rechargeOrders);

    renderPage();
    await screen.findByTestId('pilot-tenant-recharge-ready');

    expect(
      screen.queryByRole('button', { name: /创建|立即充值|模拟支付|发起退款/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Provider Event');
    expect(document.body).not.toHaveTextContent('conversionRuleVersionId');
    expect(document.body).not.toHaveTextContent('attributionSnapshotId');
  });

  it('fails closed for a content operator before calling the real API', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: contentOperatorSession,
      error: null,
      requestId: null,
    });
    const list = vi.spyOn(pilotControlApi, 'listTenantRechargeOrders').mockResolvedValue([]);

    renderPage();

    const denied = await screen.findByTestId('pilot-tenant-recharge-permission-denied');
    expect(denied).toHaveTextContent('仅 tenant_admin 可查看');
    expect(list).not.toHaveBeenCalled();
    expect(usePilotAuthStore.getState().status).toBe('authenticated');
  });

  it('clears old rows while retrying a service failure and keeps the Request ID safe', async () => {
    const retryResponse = deferred<PilotRechargeOrderAudit[]>();
    const list = vi
      .spyOn(pilotControlApi, 'listTenantRechargeOrders')
      .mockResolvedValueOnce(rechargeOrders)
      .mockReturnValueOnce(retryResponse.promise);

    renderPage();
    await screen.findByTestId('pilot-tenant-recharge-ready');
    fireEvent.click(screen.getByRole('button', { name: /重新加载真实充值审计/ }));

    const retrying = screen.getByTestId('pilot-tenant-recharge-retrying');
    expect(retrying).not.toHaveTextContent('100.00 CNY');
    retryResponse.reject(
      new PilotControlApiError('INTERNAL_ERROR', SENSITIVE_TOKEN, 500, 'recharge-500'),
    );

    const error = await screen.findByTestId('pilot-tenant-recharge-service-error');
    expect(error).toHaveTextContent('请求 ID：recharge-500');
    expect(error).not.toHaveTextContent(SENSITIVE_TOKEN);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('clears Pilot Session on 401 and never renders the raw error body', async () => {
    vi.spyOn(pilotControlApi, 'listTenantRechargeOrders').mockRejectedValue(
      new PilotControlApiError('AUTHENTICATION_REQUIRED', SENSITIVE_TOKEN, 401, 'recharge-401'),
    );

    renderPage();

    const state = await screen.findByTestId('pilot-tenant-recharge-unauthorized');
    expect(state).toHaveTextContent('会话已失效，请重新登录');
    expect(state).toHaveTextContent('请求 ID：recharge-401');
    expect(state).not.toHaveTextContent(SENSITIVE_TOKEN);
    expect(usePilotAuthStore.getState()).toMatchObject({ status: 'anonymous', session: null });
  });

  it('fails closed when the Session has no canonical Tenant context', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: {
        ...tenantAdminSession,
        tenant: null,
        activeContext: { ...tenantAdminSession.activeContext, tenantId: null },
      },
      error: null,
      requestId: null,
    });
    const list = vi.spyOn(pilotControlApi, 'listTenantRechargeOrders').mockResolvedValue([]);

    renderPage();

    expect(await screen.findByTestId('pilot-tenant-recharge-context-error')).toHaveTextContent(
      'canonical Tenant Context 不可用',
    );
    expect(list).not.toHaveBeenCalled();
  });
});
