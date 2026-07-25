import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { layout } from '../design/tokens';

const { Content } = Layout;

export function AppShell() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout style={{ marginLeft: layout.sidebarWidth }}>
        <Topbar />
        <Content style={{ marginTop: layout.topbarHeight, padding: 24, background: '#F5F7FA' }}>
          <div className="app-page">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
