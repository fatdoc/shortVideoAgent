import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DashboardPage } from './DashboardPage';

describe('Store workbench dashboard', () => {
  it('presents the store acquisition queue with one primary action', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    const page = screen.getByTestId('store-workbench-page');
    expect(within(page).getByRole('heading', { name: '今天从待确认内容开始' })).toBeInTheDocument();
    expect(within(page).getByText('生产队列')).toBeInTheDocument();
    expect(within(page).getByText('暂无真实线索归因数据')).toBeInTheDocument();
    expect(page.querySelectorAll('.store-button--primary')).toHaveLength(1);
  });
});
