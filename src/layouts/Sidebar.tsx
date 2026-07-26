import {
  AppstoreOutlined,
  BarChartOutlined,
  CheckSquareOutlined,
  ClusterOutlined,
  FileTextOutlined,
  FolderOutlined,
  PictureOutlined,
  PlayCircleFilled,
  PlaySquareOutlined,
  SettingOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Button, Layout, Menu, Progress, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEMO_PROJECT_ID, ROUTES } from '../domain/constants';
import { colors, layout, zIndex } from '../design/tokens';
import { useProjectStore } from '../stores/projectStore';

const { Sider } = Layout;

const items = [
  { key: ROUTES.dashboard, icon: <AppstoreOutlined />, label: '工作台' },
  { key: 'demo-projects', icon: <FolderOutlined />, label: '项目' },
  { key: ROUTES.projectNew, icon: <FileTextOutlined />, label: 'Brief' },
  { key: ROUTES.brand(DEMO_PROJECT_ID), icon: <ClusterOutlined />, label: '品牌/商家大脑' },
  { key: ROUTES.script(DEMO_PROJECT_ID), icon: <FileTextOutlined />, label: '脚本' },
  { key: ROUTES.storyboard(DEMO_PROJECT_ID), icon: <VideoCameraOutlined />, label: '分镜' },
  { key: 'demo-assets', icon: <PictureOutlined />, label: '素材中心' },
  { key: ROUTES.roughCut(DEMO_PROJECT_ID), icon: <PlaySquareOutlined />, label: '初剪预览' },
  { key: 'demo-review', icon: <CheckSquareOutlined />, label: '审核导出' },
  { key: 'demo-growth', icon: <BarChartOutlined />, label: '数据洞察' },
  { key: 'demo-settings', icon: <SettingOutlined />, label: '设置' },
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
        onClick={({ key }) => {
          if (key === 'demo-projects') {
            navigate(ROUTES.dashboard);
            return;
          }
          if (key === 'demo-assets') {
            navigate(ROUTES.roughCut(DEMO_PROJECT_ID));
            return;
          }
          if (key.startsWith('/')) {
            navigate(key);
          }
        }}
        style={{ borderInlineEnd: 0, marginTop: 8, paddingBottom: 12 }}
      />
      <div className="sidebar-footer">
        <div className="sidebar-plan-row">
          <Typography.Text strong>企业版</Typography.Text>
          <Typography.Text type="secondary">2026-06-01 到期</Typography.Text>
        </div>
        <div className="sidebar-storage-row">
          <Typography.Text className="sidebar-footer-label">存储空间</Typography.Text>
          <Typography.Text type="secondary">320 GB / 1 TB</Typography.Text>
        </div>
        <Progress percent={32} size="small" showInfo={false} />
        <Button type="link" size="small" block>
          升级套餐
        </Button>
        <span className="sr-only">
          当前演示项目 #{project.id}，进度 {project.progress}%
        </span>
      </div>
    </Sider>
  );
}
