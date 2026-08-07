import {
  ApiOutlined,
  AppstoreAddOutlined,
  AppstoreOutlined,
  ApartmentOutlined,
  ClusterOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FundViewOutlined,
  InboxOutlined,
  PlusSquareOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  VideoCameraOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Layout, Menu, Typography, type MenuProps } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { resolveWorkbenchKind, WORKBENCH_OPTIONS } from '../components/workbench/workbench';
import { pilotRuntime } from '../config/pilotRuntime';
import { colors, layout, zIndex } from '../design/tokens';
import { DEMO_PROJECT_ID, ROUTES } from '../domain/constants';
import { canAccessDemoRoute, type DemoRoutePermission } from '../domain/demoIdentity';
import {
  buildTenantMenu,
  type TenantMenuItem,
  type TenantWorkbenchRole,
} from '../domain/unifiedTenantWorkbench';
import { useAuthStore } from '../stores/authStore';
import { useControlPlaneStore } from '../stores/controlPlaneStore';
import { usePilotAuthStore } from '../stores/pilotAuthStore';
import { usePilotProjectContextStore } from '../stores/pilotProjectContextStore';

const { Sider } = Layout;

interface ShellMenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
}

const legacyMenuByWorkbench = {
  platform: [
    {
      key: ROUTES.platformOverview,
      permission: 'platform.overview',
      icon: <AppstoreOutlined />,
      label: '平台概览',
    },
    {
      key: ROUTES.platformOrganizations,
      permission: 'platform.organizations',
      icon: <ApartmentOutlined />,
      label: '渠道与企业',
    },
    {
      key: ROUTES.platformCatalog,
      permission: 'platform.catalog',
      icon: <AppstoreAddOutlined />,
      label: '产品与能力',
    },
    {
      key: ROUTES.platformReceipts,
      permission: 'platform.receipts',
      icon: <SafetyCertificateOutlined />,
      label: '生产回执',
    },
  ],
  channel: [
    {
      key: ROUTES.channelOverview,
      permission: 'channel.overview',
      icon: <AppstoreOutlined />,
      label: '渠道概览',
    },
    {
      key: ROUTES.channelProducts,
      permission: 'channel.products',
      icon: <AppstoreAddOutlined />,
      label: '可售产品',
    },
    {
      key: ROUTES.channelCustomers,
      permission: 'channel.customers',
      icon: <ShopOutlined />,
      label: '企业客户',
    },
  ],
} as const satisfies Record<
  'platform' | 'channel',
  readonly {
    key: string;
    permission: DemoRoutePermission;
    icon: React.ReactNode;
    label: string;
  }[]
>;

const iconByTenantMenuKey: Record<string, React.ReactNode> = {
  projects: <FolderOpenOutlined />,
  dashboard: <AppstoreOutlined />,
  products: <AppstoreAddOutlined />,
  'project-create': <PlusSquareOutlined />,
  brand: <ClusterOutlined />,
  script: <FileTextOutlined />,
  storyboard: <VideoCameraOutlined />,
  'rough-cut': <FundViewOutlined />,
  'production-overview': <AppstoreOutlined />,
  'production-inbox': <InboxOutlined />,
  'production-canvas': <ApiOutlined />,
  'production-tasks': <VideoCameraOutlined />,
  'production-assets': <FileDoneOutlined />,
  'production-export': <WalletOutlined />,
};

function shellItems(items: readonly TenantMenuItem[]): ShellMenuItem[] {
  return items.map((item) => ({
    key: item.path,
    icon: iconByTenantMenuKey[item.key] ?? <FolderOpenOutlined />,
    label: item.label,
  }));
}

function selectedMenuKey(pathname: string, items: readonly { key: string }[]) {
  const exact = items.find((item) => item.key === pathname);
  if (exact) return exact.key;
  if (pathname.startsWith('/channel/customers')) return ROUTES.channelCustomers;
  if (pathname.includes('/usage') || pathname.includes('/delivery')) {
    return ROUTES.roughCut(DEMO_PROJECT_ID);
  }
  return items[0]?.key;
}

function SidebarFrame({
  subtitle,
  items,
  footer,
}: {
  subtitle: string;
  items: readonly ShellMenuItem[];
  footer: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const selected = selectedMenuKey(location.pathname, items);

  return (
    <Sider
      width={layout.sidebarWidth}
      theme="dark"
      style={{
        overflow: 'hidden',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: zIndex.sidebar,
        background: colors.sidebar,
      }}
    >
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">VA</div>
        <div>
          <div className="sidebar-brand-title">短视频 Agent</div>
          <div className="sidebar-brand-sub">{subtitle}</div>
        </div>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={selected ? [selected] : []}
        items={[...items] as MenuProps['items']}
        onClick={({ key }) => navigate(key)}
        style={{ borderInlineEnd: 0, marginTop: 12, paddingBottom: 96 }}
      />
      <div className="sidebar-footer">{footer}</div>
    </Sider>
  );
}

function demoTenantRoles(accountKind: string | undefined): TenantWorkbenchRole[] {
  if (accountKind === 'tenant') return ['tenant_admin'];
  if (accountKind === 'production') return ['content_operator'];
  return [];
}

function DemoSidebar() {
  const location = useLocation();
  const identity = useAuthStore((state) => state.identity);
  const snapshot = useControlPlaneStore((state) => state.snapshot);
  const kind = resolveWorkbenchKind(location.pathname);
  const unifiedTenant = kind === 'tenant' || kind === 'production';
  const legacyWorkbench = WORKBENCH_OPTIONS.find((item) => item.kind === kind)!;
  const items: ShellMenuItem[] = unifiedTenant
    ? shellItems(
        buildTenantMenu({
          roleCodes: demoTenantRoles(identity?.accountKind),
          projectId: DEMO_PROJECT_ID,
        }),
      )
    : legacyMenuByWorkbench[kind].filter((item) => canAccessDemoRoute(identity, item.permission));

  return (
    <SidebarFrame
      subtitle={unifiedTenant ? '统一创作工作台' : legacyWorkbench.shortLabel}
      items={items}
      footer={
        <>
          <Typography.Text className="sidebar-footer-state">{snapshot.stateName}</Typography.Text>
          <div>{snapshot.fixtureId}</div>
          <small>{snapshot.truthManifest.disclaimer}</small>
        </>
      }
    />
  );
}

function PilotSidebar() {
  const session = usePilotAuthStore((state) => state.session);
  const activeProjectId = usePilotProjectContextStore((state) => state.activeProjectId);
  const status = usePilotProjectContextStore((state) => state.status);
  const context = usePilotProjectContextStore((state) => state.context);
  const items = session
    ? [
        {
          key: '/projects',
          icon: iconByTenantMenuKey.projects,
          label: '项目',
        },
        ...shellItems(
          buildTenantMenu({
            roleCodes: session.roles,
            projectId: activeProjectId,
          }),
        ),
      ]
    : [];

  return (
    <SidebarFrame
      subtitle="统一创作工作台"
      items={items}
      footer={
        <>
          <Typography.Text className="sidebar-footer-state">PILOT · {status}</Typography.Text>
          <div>{session?.activeContext.organizationDisplayName ?? '组织上下文不可用'}</div>
          <small>{context ? `${context.projectName} · ${context.projectId}` : '未选择项目'}</small>
        </>
      }
    />
  );
}

export function Sidebar() {
  return pilotRuntime.mode === 'pilot' ? <PilotSidebar /> : <DemoSidebar />;
}
