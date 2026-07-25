import { BellOutlined, QuestionCircleOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Badge, Breadcrumb, Button, Layout, Space, Typography } from 'antd';
import { useLocation } from 'react-router-dom';
import { layout } from '../design/tokens';
import { useProjectStore } from '../stores/projectStore';

const { Header } = Layout;

const titleMap: Record<string, string> = {
  dashboard: '工作台',
  new: '新建项目 / Brief',
  brand: '品牌 / 商家大脑',
  script: '脚本生成与编辑',
  storyboard: '分镜 / 拍摄清单',
  'rough-cut': '素材中心 / 初剪预览',
};

export function Topbar() {
  const location = useLocation();
  const project = useProjectStore((s) => s.workspace.project);
  const segment = location.pathname.split('/').filter(Boolean).at(-1) ?? 'dashboard';
  const pageTitle = titleMap[segment] ?? '页面';

  return (
    <Header
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        left: layout.sidebarWidth,
        zIndex: 20,
        height: layout.topbarHeight,
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
      }}
    >
      <Space direction="vertical" size={0}>
        <Breadcrumb
          items={[{ title: '短视频营销 Agent' }, { title: pageTitle }]}
          style={{ fontSize: 12 }}
        />
        <Typography.Text strong>{pageTitle}</Typography.Text>
      </Space>
      <Space size="middle">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Demo：{project.name}
        </Typography.Text>
        <Button type="text" icon={<QuestionCircleOutlined />} />
        <Badge dot>
          <Button type="text" icon={<BellOutlined />} />
        </Badge>
        <Space size={8}>
          <Avatar size="small" icon={<UserOutlined />} style={{ background: '#1677FF' }} />
          <Typography.Text>{project.owner}</Typography.Text>
        </Space>
      </Space>
    </Header>
  );
}
