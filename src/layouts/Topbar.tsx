import { LogoutOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';
import { App, Breadcrumb, Button, Layout, Select, Space, Tag, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { WorkbenchSwitcher } from '../components/workbench/WorkbenchChrome';
import { resolveWorkbenchKind, WORKBENCH_OPTIONS } from '../components/workbench/workbench';
import { pilotRuntime } from '../config/pilotRuntime';
import { layout, zIndex } from '../design/tokens';
import { PROJECT_STATUS_LABEL, ROUTES } from '../domain/constants';
import { useControlPlaneStore } from '../stores/controlPlaneStore';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';
import { usePilotAuthStore } from '../stores/pilotAuthStore';
import { usePilotProjectContextStore } from '../stores/pilotProjectContextStore';

const { Header } = Layout;

function pageTitle(pathname: string) {
  if (pathname === '/projects') return '项目';
  if (pathname === '/platform/overview') return '平台概览';
  if (pathname === '/platform/catalog') return '产品与演示 RateCard';
  if (pathname === '/platform/organizations') return '渠道与企业组织';
  if (pathname === '/platform/production-receipts') return '生产回执监控';
  if (pathname === '/channel/overview') return '渠道概览';
  if (pathname === '/channel/products') return '可售产品';
  if (pathname.startsWith('/channel/customers')) return '企业客户';
  if (pathname === '/enterprise/products') return '企业已购能力';
  if (pathname === '/dashboard') return '企业工作台';
  if (pathname === '/projects/new') return '新建项目 / Brief';
  if (pathname.includes('/brand')) return '品牌 / 商家大脑';
  if (pathname.includes('/script')) return '脚本生成与编辑';
  if (pathname.includes('/storyboard')) return '分镜生产单';
  if (pathname.includes('/rough-cut')) return '任务、资产与交付';
  if (pathname.includes('/usage')) return '额度与使用明细';
  if (pathname.includes('/delivery')) return '交付与来源链';
  if (pathname.startsWith('/production/inbox')) return '生产包收件箱';
  if (pathname.startsWith('/production/canvas')) return 'StoryCanvas 入口';
  if (pathname.startsWith('/production/tasks')) return '生成任务';
  if (pathname.startsWith('/production/assets')) return '媒体资产';
  if (pathname.startsWith('/production/export')) return '导出与来源链';
  if (pathname.startsWith('/production')) return '媒体生产概览';
  return 'D1 Demo';
}

function HeaderFrame({
  home,
  workbenchLabel,
  title,
  children,
}: {
  home: string;
  workbenchLabel: string;
  title: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <Header
      className="d1-topbar"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        left: layout.sidebarWidth,
        zIndex: zIndex.topbar,
      }}
    >
      <div className="d1-topbar-title">
        <Breadcrumb
          items={[
            {
              title: (
                <a
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(home);
                  }}
                >
                  {workbenchLabel}
                </a>
              ),
            },
            { title },
          ]}
        />
        <Typography.Text strong>{title}</Typography.Text>
      </div>
      <Space size={12} className="d1-topbar-actions">
        {children}
      </Space>
    </Header>
  );
}

function DemoTopbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const project = useProjectStore((state) => state.workspace.project);
  const loading = useProjectStore((state) => state.loading);
  const reset = useProjectStore((state) => state.reset);
  const controlLoading = useControlPlaneStore((state) => state.loading);
  const identity = useAuthStore((state) => state.identity);
  const logout = useAuthStore((state) => state.logout);
  const kind = resolveWorkbenchKind(location.pathname);
  const tenantRoute =
    identity?.activeOrganization.organizationType === 'TENANT' &&
    (kind === 'tenant' || kind === 'production');
  const workbench = WORKBENCH_OPTIONS.find(
    (item) => item.kind === (tenantRoute ? 'tenant' : kind),
  )!;
  const title = pageTitle(location.pathname);
  const statusLabel = PROJECT_STATUS_LABEL[project.status] ?? project.status;

  const handleReset = async () => {
    const result = await reset();
    if (result.ok) {
      message.success('已重置统一项目与控制平面 DEMO_READY');
      return;
    }
    const rollbackFailed = Boolean(result.error.details.rollbackError);
    message.error(
      `${result.error.code} · ${result.error.message} · ${
        rollbackFailed
          ? '旧快照回滚失败，不得继续演示'
          : '已保留或恢复重置前状态，未宣称 DEMO_READY'
      }`,
    );
  };

  return (
    <HeaderFrame home={workbench.home} workbenchLabel={workbench.shortLabel} title={title}>
      <WorkbenchSwitcher />
      <Tag icon={<UserOutlined />} color="cyan">
        {identity?.displayName} · {identity?.roleLabel}
      </Tag>
      <Tag color="blue">{statusLabel}</Tag>
      <Button
        size="small"
        icon={<ReloadOutlined />}
        loading={loading || controlLoading}
        onClick={() => void handleReset()}
      >
        重置 Demo
      </Button>
      <Button
        size="small"
        icon={<LogoutOutlined />}
        onClick={() => {
          logout();
          navigate('/login', { replace: true });
        }}
      >
        退出
      </Button>
    </HeaderFrame>
  );
}

function PilotTopbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = usePilotAuthStore((state) => state.session);
  const logout = usePilotAuthStore((state) => state.logout);
  const selectProject = usePilotAuthStore((state) => state.selectProject);
  const projects = usePilotProjectContextStore((state) => state.projects);
  const activeProjectId = usePilotProjectContextStore((state) => state.activeProjectId);
  const projectStatus = usePilotProjectContextStore((state) => state.status);
  const title = pageTitle(location.pathname);

  return (
    <HeaderFrame home="/pilot" workbenchLabel="统一创作工作台" title={title}>
      <Select
        aria-label="当前 Pilot 项目"
        size="small"
        value={activeProjectId ?? undefined}
        placeholder="未选择项目"
        loading={projectStatus === 'loading'}
        disabled={projects.length === 0 || projectStatus === 'loading'}
        popupMatchSelectWidth={260}
        options={projects.map((project) => ({ value: project.id, label: project.name }))}
        onChange={(projectId) => {
          void selectProject(projectId).then((result) => {
            if (result?.status === 'ready') navigate(ROUTES.brand(projectId));
          });
        }}
      />
      <Tag icon={<UserOutlined />} color="cyan">
        {session?.user.displayName ?? '未登录'} · {session?.activeContext.primaryRole ?? '无角色'}
      </Tag>
      <Tag color="blue">{session?.activeContext.organizationDisplayName ?? '组织不可用'}</Tag>
      <Button
        size="small"
        icon={<LogoutOutlined />}
        onClick={() => {
          void logout().finally(() => navigate('/login', { replace: true }));
        }}
      >
        安全退出
      </Button>
    </HeaderFrame>
  );
}

export function Topbar() {
  return pilotRuntime.mode === 'pilot' ? <PilotTopbar /> : <DemoTopbar />;
}
