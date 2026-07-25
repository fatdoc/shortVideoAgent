import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { LoadingState } from '../components/common/LoadingState';
import { StatusTag } from '../components/common/StatusTag';
import { appTheme } from '../design/theme';

function renderWithProviders(ui: ReactElement) {
  return render(
    <ConfigProvider locale={zhCN} theme={appTheme} button={{ autoInsertSpace: false }}>
      <AntApp>{ui}</AntApp>
    </ConfigProvider>,
  );
}

describe('common state components', () => {
  it('renders loading tip', () => {
    renderWithProviders(<LoadingState tip="请稍候" />);
    expect(screen.getByText('请稍候')).toBeInTheDocument();
  });

  it('renders empty action and triggers callback', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderWithProviders(
      <EmptyState description="没有项目" actionLabel="去新建" onAction={onAction} />,
    );
    expect(screen.getByText('没有项目')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '去新建' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders error retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithProviders(<ErrorState title="出错了" onRetry={onRetry} />);
    expect(screen.getByText('出错了')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders status tags', () => {
    renderWithProviders(
      <>
        <StatusTag kind="project" value="scripting" />
        <StatusTag kind="match" value="matched" />
        <StatusTag kind="risk" value="low" />
        <StatusTag kind="qa" value="pass" />
      </>,
    );
    expect(screen.getByText('脚本中')).toBeInTheDocument();
    expect(screen.getByText('已匹配')).toBeInTheDocument();
    expect(screen.getByText('低')).toBeInTheDocument();
    expect(screen.getByText('通过')).toBeInTheDocument();
  });
});
