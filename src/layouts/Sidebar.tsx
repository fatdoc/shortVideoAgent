import {
  AppstoreOutlined,
  ClusterOutlined,
  FileTextOutlined,
  FundViewOutlined,
  PlayCircleFilled,
  PlusSquareOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Layout, Menu, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEMO_PROJECT_ID, ROUTES } from '../domain/constants';
import { colors, layout, zIndex } from '../design/tokens';
import { useProjectStore } from '../stores/projectStore';

const { Sider } = Layout;

const items = [
  { key: ROUTES.dashboard, icon: <AppstoreOutlined />, label: '工作台' },
  { key: ROUTES.projectNew, icon: <PlusSquareOutlined />, label: '新建 / Brief' },
  { key: ROUTES.brand(DEMO_PROJECT_ID), icon: <ClusterOutlined />, label: '品牌大脑' },
  { key: ROUTES.script(DEMO_PROJECT_ID), icon: <FileTextOutlined />, label: '脚本编辑' },
  { key: ROUTES.storyboard(DEMO_PROJECT_ID), icon: <VideoCameraOutlined />, label: '分镜清单' },
  { key: ROUTES.roughCut(DEMO_PROJECT_ID), icon: <FundViewOutlined />, label: '素材 / 初剪' },
];

function resolveSelectedKey(pathname: string): string {
  if (pathname.startsWith('/dashboard') || pathname === '/') return ROUTES.dashboard;
  if (pathname.startsWith('/projects/new')) return ROUTES.projectNew;
  if (pathname.includes('/brand')) return ROUTES.brand(DEMO_PROJECT_ID);
  if (pathname.includes('/script')) return ROUTES.script(DEMO_PROJECT_ID);
  if (pathname.includes('/storyboard')) return ROUTES.storyboard(DEMO_PROJECT_ID);
  if (pathname.includes('/rough-cut')) return ROUTES.roughCut(DEMO_PROJECT_ID);
  return ROUTES.dashboard;
}

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const project = useProjectStore((s) => s.workspace.project);
  const selected = resolveSelectedKey(location.pathname);

  return (
    <Sider
      className="app-shell-sidebar"
      width={layout.sidebarWidth}
      theme="light"
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
        <PlayCircleFilled className="sidebar-brand-icon" />
        <Typography.Text className="sidebar-brand-title">短视频营销 Agent</Typography.Text>
        <span className="sr-only">短视频 Agent</span>
      </div>
      <Menu
        className="app-sidebar-menu"
        theme="light"
        mode="inline"
        selectedKeys={[selected]}
        items={items}
        onClick={({ key }) => navigate(key)}
        style={{ borderInlineEnd: 0, marginTop: 8, paddingBottom: 12 }}
      />
      <div className="sidebar-footer">
        <Typography.Text className="sidebar-footer-label">Demo 项目</Typography.Text>
        <Typography.Text className="sidebar-footer-id" strong>
          #{project.id}
        </Typography.Text>
        <div className="sidebar-footer-progress">
          <Typography.Text className="sidebar-footer-label">进度</Typography.Text>
          <Typography.Text strong>{project.progress}%</Typography.Text>
        </div>
      </div>
    </Sider>
  );
}
