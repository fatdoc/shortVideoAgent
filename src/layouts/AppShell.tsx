import { useEffect } from 'react';
import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { layout } from '../design/tokens';
import { useProjectStore } from '../stores/projectStore';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { DemoTruthBar } from '../components/workbench/WorkbenchChrome';
import '../design/d1-experience.css';

const { Content } = Layout;

export function AppShell() {
  const hydrate = useProjectStore((s) => s.hydrate);
  const hydrated = useProjectStore((s) => s.hydrated);
  const loading = useProjectStore((s) => s.loading);
  const error = useProjectStore((s) => s.error);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout style={{ marginLeft: layout.sidebarWidth }}>
        <Topbar />
        <DemoTruthBar />
        <Content className="app-shell-content">
          <div className="app-page">
            {!hydrated && loading ? (
              <LoadingState tip="正在加载统一 Demo 工作区..." />
            ) : error && !hydrated ? (
              <ErrorState title="工作区加载失败" subTitle={error} onRetry={() => void hydrate()} />
            ) : (
              <Outlet />
            )}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
