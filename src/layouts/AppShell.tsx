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
import { useAuthStore } from '../stores/authStore';
import { useControlPlaneStore } from '../stores/controlPlaneStore';
import { pilotRuntime } from '../config/pilotRuntime';
import '../design/d1-experience.css';

const { Content } = Layout;

function ShellFrame({ children, pilot = false }: { children: React.ReactNode; pilot?: boolean }) {
  return (
    <Layout style={{ minHeight: '100vh' }} {...(pilot ? { 'data-testid': 'pilot-app-shell' } : {})}>
      <Sidebar />
      <Layout style={{ marginLeft: layout.sidebarWidth }}>
        <Topbar />
        {!pilot ? <DemoTruthBar /> : null}
        <Content className="app-shell-content">
          <div className="app-page">{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
}

function DemoAppShell() {
  const hydrate = useProjectStore((s) => s.hydrate);
  const hydrated = useProjectStore((s) => s.hydrated);
  const loading = useProjectStore((s) => s.loading);
  const error = useProjectStore((s) => s.error);
  const identity = useAuthStore((state) => state.identity);
  const activeOrganizationId = useControlPlaneStore(
    (state) => state.activeOrganization?.activeOrganizationId,
  );
  const switchActiveOrganization = useControlPlaneStore((state) => state.switchActiveOrganization);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const organizationId = identity?.activeOrganization.organizationId;
    if (organizationId && organizationId !== activeOrganizationId) {
      switchActiveOrganization(organizationId);
    }
  }, [activeOrganizationId, identity, switchActiveOrganization]);

  return (
    <ShellFrame>
      {!hydrated && loading ? (
        <LoadingState tip="正在加载统一 Demo 工作区..." />
      ) : error && !hydrated ? (
        <ErrorState title="工作区加载失败" subTitle={error} onRetry={() => void hydrate()} />
      ) : (
        <Outlet />
      )}
    </ShellFrame>
  );
}

function PilotAppShell() {
  return (
    <ShellFrame pilot>
      <Outlet />
    </ShellFrame>
  );
}

export function AppShell() {
  return pilotRuntime.mode === 'pilot' ? <PilotAppShell /> : <DemoAppShell />;
}
