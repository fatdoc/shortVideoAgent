import type { ReactNode } from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { appTheme } from '../design/theme';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={appTheme}
      wave={{ disabled: false }}
      button={{ autoInsertSpace: false }}
    >
      <AntApp message={{ maxCount: 3 }} notification={{ placement: 'topRight' }}>
        {children}
      </AntApp>
    </ConfigProvider>
  );
}
