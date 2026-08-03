import {
  ApiOutlined,
  AppstoreAddOutlined,
  AppstoreOutlined,
  ApartmentOutlined,
  ClusterOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  FundViewOutlined,
  InboxOutlined,
  PlusSquareOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  VideoCameraOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Layout, Menu, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { resolveWorkbenchKind, WORKBENCH_OPTIONS } from '../components/workbench/workbench';
import { colors, layout, zIndex } from '../design/tokens';
import { DEMO_PROJECT_ID, ROUTES } from '../domain/constants';
import { canAccessDemoRoute, type DemoRoutePermission } from '../domain/demoIdentity';
import { useAuthStore } from '../stores/authStore';
import { useControlPlaneStore } from '../stores/controlPlaneStore';

const { Sider } = Layout;

const menuByWorkbench = {
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
  tenant: [
    {
      key: ROUTES.dashboard,
      permission: 'enterprise.dashboard',
      icon: <AppstoreOutlined />,
      label: '企业工作台',
    },
    {
      key: ROUTES.enterpriseProducts,
      permission: 'enterprise.products',
      icon: <AppstoreAddOutlined />,
      label: '已购能力',
    },
    {
      key: ROUTES.projectNew,
      permission: 'enterprise.project-create',
      icon: <PlusSquareOutlined />,
      label: '新建 / Brief',
    },
    {
      key: ROUTES.brand(DEMO_PROJECT_ID),
      permission: 'enterprise.brand-read',
      icon: <ClusterOutlined />,
      label: '品牌大脑',
    },
    {
      key: ROUTES.script(DEMO_PROJECT_ID),
      permission: 'enterprise.script',
      icon: <FileTextOutlined />,
      label: '脚本编辑',
    },
    {
      key: ROUTES.storyboard(DEMO_PROJECT_ID),
      permission: 'enterprise.storyboard',
      icon: <VideoCameraOutlined />,
      label: '分镜生产单',
    },
    {
      key: ROUTES.roughCut(DEMO_PROJECT_ID),
      permission: 'enterprise.rough-cut',
      icon: <FundViewOutlined />,
      label: '任务 / 交付',
    },
  ],
  production: [
    {
      key: ROUTES.productionOverview,
      permission: 'production.overview',
      icon: <AppstoreOutlined />,
      label: '生产概览',
    },
    {
      key: ROUTES.productionInbox(DEMO_PROJECT_ID),
      permission: 'production.inbox',
      icon: <InboxOutlined />,
      label: '生产包',
    },
    {
      key: ROUTES.productionCanvas(DEMO_PROJECT_ID),
      permission: 'production.canvas',
      icon: <ApiOutlined />,
      label: 'StoryCanvas',
    },
    {
      key: ROUTES.productionTasks(DEMO_PROJECT_ID),
      permission: 'production.tasks',
      icon: <VideoCameraOutlined />,
      label: '生成任务',
    },
    {
      key: ROUTES.productionAssets(DEMO_PROJECT_ID),
      permission: 'production.assets',
      icon: <FileDoneOutlined />,
      label: '媒体资产',
    },
    {
      key: ROUTES.productionExport(DEMO_PROJECT_ID),
      permission: 'production.export',
      icon: <WalletOutlined />,
      label: '导出 / 来源链',
    },
  ],
} as const satisfies Record<
  (typeof WORKBENCH_OPTIONS)[number]['kind'],
  readonly {
    key: string;
    permission: DemoRoutePermission;
    icon: React.ReactNode;
    label: string;
  }[]
>;

function selectedMenuKey(pathname: string, items: readonly { key: string }[]) {
  const exact = items.find((item) => item.key === pathname);
  if (exact) return exact.key;
  if (pathname.startsWith('/channel/customers')) return ROUTES.channelCustomers;
  if (pathname.includes('/usage') || pathname.includes('/delivery')) {
    return ROUTES.roughCut(DEMO_PROJECT_ID);
  }
  return items[0]?.key;
}

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const identity = useAuthStore((state) => state.identity);
  const snapshot = useControlPlaneStore((state) => state.snapshot);
  const kind = resolveWorkbenchKind(location.pathname);
  const workbench = WORKBENCH_OPTIONS.find((item) => item.kind === kind)!;
  const items = menuByWorkbench[kind].filter((item) =>
    canAccessDemoRoute(identity, item.permission),
  );
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
          <div className="sidebar-brand-sub">{workbench.shortLabel}</div>
        </div>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={selected ? [selected] : []}
        items={[...items]}
        onClick={({ key }) => navigate(key)}
        style={{ borderInlineEnd: 0, marginTop: 12, paddingBottom: 96 }}
      />
      <div className="sidebar-footer">
        <Typography.Text className="sidebar-footer-state">{snapshot.stateName}</Typography.Text>
        <div>{snapshot.fixtureId}</div>
        <small>{snapshot.truthManifest.disclaimer}</small>
      </div>
    </Sider>
  );
}
