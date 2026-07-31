import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/Providers';
import { createControlPlaneDemoState } from '../../mocks/controlPlaneDemo';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';
import { ProductCatalogPage } from './ProductCatalogPage';

function renderPage() {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={['/enterprise/products']}>
        <Routes>
          <Route path="/enterprise/products" element={<ProductCatalogPage />} />
          <Route path="/projects/:projectId/brand" element={<div>Canonical brand route</div>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('ProductCatalogPage', () => {
  beforeEach(() => {
    useControlPlaneStore.setState({ snapshot: createControlPlaneDemoState() });
  });

  it('separates purchased entitlements, explanation-only products and locked products', () => {
    renderPage();

    expect(screen.getByText('2 项已购 · 2 项说明态 · 2 项锁定')).toBeInTheDocument();
    expect(screen.getAllByText('已购 Entitlement')).toHaveLength(2);
    expect(screen.getAllByText('产品说明 · 未开通')).toHaveLength(2);
    expect(screen.getAllByText('锁定 · 未授权')).toHaveLength(2);
    expect(screen.queryByText('演示 RateCard')).not.toBeInTheDocument();
    expect(screen.getByText(/平台目录不等于企业已购产品/)).toBeInTheDocument();
  });

  it('opens the canonical brand entry from a purchased usable product', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByRole('button', { name: /开始使用/ })[0]);

    expect(await screen.findByText('Canonical brand route')).toBeInTheDocument();
  });

  it('keeps explanation-only products non-executable and locked products disabled', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getAllByRole('button', { name: /未购买.*待授权/ })).toHaveLength(2);
    for (const button of screen.getAllByRole('button', { name: /未购买.*待授权/ })) {
      expect(button).toBeDisabled();
    }

    await user.click(screen.getAllByRole('button', { name: '查看说明' })[0]);
    expect(await screen.findByText('当前企业无 Entitlement')).toBeInTheDocument();
    expect(screen.getByText(/不代表当前企业已经购买或开通/)).toBeInTheDocument();
  });
});
