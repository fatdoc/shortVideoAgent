import type { ReactNode } from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { appTheme } from '../design/theme';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ConfigProvider locale={zhCN} theme={appTheme}>
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
