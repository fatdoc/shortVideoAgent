import { render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/Providers';
import type { ControlPlaneDemoState } from '../../domain/controlPlane';
import { createControlPlaneDemoState } from '../../mocks/controlPlaneDemo';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';
import {
  PlatformCatalogPage,
  PlatformOrganizationsPage,
  PlatformOverviewPage,
  PlatformReceiptMonitorPage,
} from './PlatformManagementPages';

const SENSITIVE_TOKEN = 'SENSITIVE-PRODUCTION-BODY-MUST-STAY-HIDDEN';

function createSensitiveSnapshot() {
  const snapshot = createControlPlaneDemoState();
  snapshot.package = {
    brandFactsSnapshot: SENSITIVE_TOKEN,
    approvedScriptSnapshot: SENSITIVE_TOKEN,
    materialBody: SENSITIVE_TOKEN,
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

function expectSensitiveContentHidden() {
  expect(screen.queryByText(SENSITIVE_TOKEN)).not.toBeInTheDocument();
  expect(document.body).not.toHaveTextContent(SENSITIVE_TOKEN);
  expect(document.body).not.toHaveTextContent('append-only 分录');
}

describe('A-03.2 platform management pages', () => {
  beforeEach(() => {
    useControlPlaneStore.setState({ snapshot: createSensitiveSnapshot() });
  });

  it('keeps the overview focused on platform-wide metrics and management entries', () => {
    renderPage(<PlatformOverviewPage />);
    const page = screen.getByTestId('platform-overview-page');

    expect(
      within(page).getByRole('heading', { level: 2, name: '平台运营概览' }),
    ).toBeInTheDocument();
    expect(within(page).getByText('渠道节点')).toBeInTheDocument();
    expect(within(page).getByText('企业 Tenant')).toBeInTheDocument();
    expect(within(page).getByText('活跃产品')).toBeInTheDocument();
    expect(within(page).getByText('三类回执')).toBeInTheDocument();
    expect(within(page).getByText('商业异常')).toBeInTheDocument();
    expect(within(page).getByText('审计事件')).toBeInTheDocument();
    expect(within(page).queryByText('总代理演示组织')).not.toBeInTheDocument();
    expectSensitiveContentHidden();
  });

  it('renders the complete organization tree and an explicit Tenant content boundary', () => {
    renderPage(<PlatformOrganizationsPage />);
    const page = screen.getByTestId('platform-organizations-page');

    expect(
      within(page).getByRole('heading', { level: 2, name: '平台组织管理' }),
    ).toBeInTheDocument();
    expect(within(page).getByText('短视频营销 Agent 平台')).toBeInTheDocument();
    expect(within(page).getByText('总代理演示组织')).toBeInTheDocument();
    expect(within(page).getByText('一级代理演示组织')).toBeInTheDocument();
    expect(within(page).getByText('二级代理演示组织')).toBeInTheDocument();
    expect(within(page).getByText('海底捞演示企业')).toBeInTheDocument();
    expect(within(page).getByText('Tenant 内容边界：PRODUCTION_CONTENT')).toBeInTheDocument();
    expect(within(page).getByText(/MASTER · Depth 1/)).toBeInTheDocument();
    expect(within(page).getByText(/LEVEL_1 · Depth 2/)).toBeInTheDocument();
    expect(within(page).getByText(/LEVEL_2 · Depth 3/)).toBeInTheDocument();
    expectSensitiveContentHidden();
  });

  it('renders the platform catalog, rate card and all five non-quote price layers', () => {
    renderPage(<PlatformCatalogPage />);
    const page = screen.getByTestId('platform-catalog-page');

    expect(
      within(page).getByRole('heading', { level: 2, name: '平台产品目录' }),
    ).toBeInTheDocument();
    expect(
      within(page).getByRole('heading', { level: 4, name: 'Product 与 SKU' }),
    ).toBeInTheDocument();
    expect(within(page).getByRole('heading', { level: 4, name: 'Capability' })).toBeInTheDocument();
    expect(within(page).getByRole('heading', { level: 4, name: 'RateCard' })).toBeInTheDocument();
    expect(within(page).getByText('STANDARD_5S_720P_VIDEO')).toBeInTheDocument();
    expect(within(page).getAllByText('UPSTREAM_COST').length).toBeGreaterThan(0);
    expect(within(page).getAllByText('PLATFORM_SETTLEMENT').length).toBeGreaterThan(0);
    expect(within(page).getAllByText('CHANNEL_WHOLESALE').length).toBeGreaterThan(0);
    expect(within(page).getAllByText('CUSTOMER_RETAIL').length).toBeGreaterThan(0);
    expect(within(page).getAllByText('CAMPAIGN').length).toBeGreaterThan(0);
    expect(within(page).getByText('演示数据 · 非正式报价')).toBeInTheDocument();
    expectSensitiveContentHidden();
  });

  it('renders only three receipt summaries, failure counts and the unmatched count', () => {
    renderPage(<PlatformReceiptMonitorPage />);
    const page = screen.getByTestId('platform-receipts-page');

    expect(
      within(page).getByRole('heading', { level: 2, name: '平台生产回执监控' }),
    ).toBeInTheDocument();
    expect(within(page).getAllByText('GenerationTask').length).toBeGreaterThan(0);
    expect(within(page).getByText('Asset')).toBeInTheDocument();
    expect(within(page).getByText('Export / 失败')).toBeInTheDocument();
    expect(within(page).getByText('未匹配回执')).toBeInTheDocument();
    expect(within(page).getByText('当前三类回执均为空')).toBeInTheDocument();
    expect(within(page).getByText('GenerationTask 状态')).toBeInTheDocument();
    expect(within(page).getByText('Asset Review 状态')).toBeInTheDocument();
    expect(within(page).getByText('Export 状态')).toBeInTheDocument();
    expect(within(page).queryByText('账本投影')).not.toBeInTheDocument();
    expectSensitiveContentHidden();
  });
});
