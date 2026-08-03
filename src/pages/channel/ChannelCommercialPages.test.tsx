import { render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/Providers';
import type { ControlPlaneDemoState } from '../../domain/controlPlane';
import { createControlPlaneDemoState } from '../../mocks/controlPlaneDemo';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';
import {
  ChannelCustomerUsagePage,
  ChannelCustomersPage,
  ChannelOverviewPage,
  ChannelProductsPage,
} from './ChannelCommercialPages';

const SENSITIVE_TOKEN = 'SENSITIVE-CHANNEL-PRODUCTION-BODY-MUST-STAY-HIDDEN';

function createSensitiveSnapshot() {
  const snapshot = createControlPlaneDemoState();
  snapshot.package = {
    brandFactsSnapshot: SENSITIVE_TOKEN,
    approvedScriptSnapshot: SENSITIVE_TOKEN,
    promptBody: SENSITIVE_TOKEN,
    claimBody: SENSITIVE_TOKEN,
    assetBody: SENSITIVE_TOKEN,
    videoBody: SENSITIVE_TOKEN,
  } as unknown as ControlPlaneDemoState['package'];
  return snapshot;
}

function renderPage(element: ReactElement) {
  return render(
    <AppProviders>
      <MemoryRouter>{element}</MemoryRouter>
    </AppProviders>,
  );
}

function renderUsagePage() {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={['/channel/customers/tenant-demo-hdl/usage']}>
        <Routes>
          <Route path="/channel/customers/:tenantId/usage" element={<ChannelCustomerUsagePage />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

function expectSensitiveContentHidden() {
  expect(screen.queryByText(SENSITIVE_TOKEN)).not.toBeInTheDocument();
  expect(document.body).not.toHaveTextContent(SENSITIVE_TOKEN);
  expect(document.body).not.toHaveTextContent('append-only 分录');
}

describe('A-03.3 channel commercial pages', () => {
  beforeEach(() => {
    useControlPlaneStore.setState({ snapshot: createSensitiveSnapshot() });
  });

  it('renders the fixed channel overview with inventory, net sales and gross spread', () => {
    renderPage(<ChannelOverviewPage />);
    const page = screen.getByTestId('channel-overview-page');

    expect(
      within(page).getByRole('heading', { level: 2, name: '渠道经营概览' }),
    ).toBeInTheDocument();
    expect(within(page).getByText(/一级代理演示组织/)).toBeInTheDocument();
    expect(within(page).getByText('直接下级渠道')).toBeInTheDocument();
    expect(within(page).getByText('企业客户')).toBeInTheDocument();
    expect(within(page).getByText('可用额度库存')).toBeInTheDocument();
    expect(within(page).getByText('销售净额')).toBeInTheDocument();
    expect(within(page).getByText('订单毛差')).toBeInTheDocument();
    expect(within(page).getByText('¥210.00')).toBeInTheDocument();
    expect(within(page).getAllByText('¥60.00')).toHaveLength(2);
    expectSensitiveContentHidden();
  });

  it('renders only channel-visible products and direct transaction price layers', () => {
    renderPage(<ChannelProductsPage />);
    const page = screen.getByTestId('channel-products-page');

    expect(
      within(page).getByRole('heading', {
        level: 2,
        name: '渠道产品与直接交易价格',
      }),
    ).toBeInTheDocument();
    expect(within(page).getByText('AI 视频基础生成包')).toBeInTheDocument();
    expect(within(page).getByText('本地生活 Agent 包')).toBeInTheDocument();
    expect(within(page).getByText('老板 IP Agent 包')).toBeInTheDocument();
    expect(within(page).getByText('电商素材 Agent 包')).toBeInTheDocument();
    expect(within(page).queryByText('数字人 Add-on')).not.toBeInTheDocument();
    expect(within(page).queryByText('API Add-on')).not.toBeInTheDocument();
    expect(within(page).getAllByText('CHANNEL_WHOLESALE')).toHaveLength(2);
    expect(within(page).getByText('CUSTOMER_RETAIL')).toBeInTheDocument();
    expect(within(page).getByText('CAMPAIGN')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('UPSTREAM_COST');
    expect(document.body).not.toHaveTextContent('PLATFORM_SETTLEMENT');
    expectSensitiveContentHidden();
  });

  it('renders canonical customer commercial status, entitlements and aggregated usage', () => {
    renderPage(<ChannelCustomersPage />);
    const page = screen.getByTestId('channel-customers-page');

    expect(
      within(page).getByRole('heading', { level: 2, name: '渠道企业客户' }),
    ).toBeInTheDocument();
    expect(within(page).getByText('海底捞演示企业')).toBeInTheDocument();
    expect(within(page).getByText(/已购 Entitlement 2\/4/)).toBeInTheDocument();
    expect(within(page).getByText(/汇总用量 100/)).toBeInTheDocument();
    expect(within(page).getByRole('button', { name: /查看商业用量/ })).toBeInTheDocument();
    expectSensitiveContentHidden();
  });

  it('renders wallet, order, consumption/release and receipt counts for canonical Tenant', () => {
    renderUsagePage();
    const page = screen.getByTestId('channel-customer-usage-page');

    expect(
      within(page).getByRole('heading', { level: 2, name: '客户商业用量' }),
    ).toBeInTheDocument();
    expect(within(page).getByText('活跃 Entitlement')).toBeInTheDocument();
    expect(within(page).getByText('Wallet 可用')).toBeInTheDocument();
    expect(within(page).getByText('Wallet 冻结')).toBeInTheDocument();
    expect(within(page).getByText('已消费额度')).toBeInTheDocument();
    expect(within(page).getByText('已释放额度')).toBeInTheDocument();
    expect(within(page).getByText('order-demo-level-1-tenant-1000')).toBeInTheDocument();
    expect(within(page).queryByText('order-demo-level-1-level-2-500')).not.toBeInTheDocument();
    expect(within(page).getByText('GenerationTask')).toBeInTheDocument();
    expect(within(page).getByText('Asset')).toBeInTheDocument();
    expect(within(page).getByText('Export')).toBeInTheDocument();
    expectSensitiveContentHidden();
  });
});
