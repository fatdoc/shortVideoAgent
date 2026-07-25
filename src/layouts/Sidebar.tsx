import {
  AppstoreOutlined,
  ClusterOutlined,
  FileTextOutlined,
  FundViewOutlined,
  PlusSquareOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Layout, Menu, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEMO_PROJECT_ID, ROUTES } from '../domain/constants';
import { layout } from '../design/tokens';

const { Sider } = Layout;

const items = [
  { key: ROUTES.dashboard, icon: <AppstoreOutlined />, label: '工作台' },
  { key: ROUTES.projectNew, icon: <PlusSquareOutlined />, label: '新建 / Brief' },
  { key: ROUTES.brand(DEMO_PROJECT_ID), icon: <ClusterOutlined />, label: '品牌大脑' },
  { key: ROUTES.script(DEMO_PROJECT_ID), icon: <FileTextOutlined />, label: '脚本编辑' },
  { key: ROUTES.storyboard(DEMO_PROJECT_ID), icon: <VideoCameraOutlined />, label: '分镜清单' },
  { key: ROUTES.roughCut(DEMO_PROJECT_ID), icon: <FundViewOutlined />, label: '素材 / 初剪' },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const selected =
    items.find((item) => location.pathname.startsWith(item.key))?.key ?? ROUTES.dashboard;

  return (
    <Sider
      width={layout.sidebarWidth}
      theme="dark"
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
      }}
    >
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Typography.Text style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
          短视频 Agent
        </Typography.Text>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 4 }}>
          营销生产工作台
        </div>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selected]}
        items={items}
        onClick={({ key }) => navigate(key)}
        style={{ borderInlineEnd: 0, marginTop: 8 }}
      />
    </Sider>
  );
}
