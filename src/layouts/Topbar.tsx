import {
  BellOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { App, Avatar, Badge, Breadcrumb, Button, Layout, Space, Tag, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { layout, zIndex } from '../design/tokens';
import { PROJECT_STATUS_LABEL, ROUTES } from '../domain/constants';
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
  const navigate = useNavigate();
  const { message } = App.useApp();
  const project = useProjectStore((s) => s.workspace.project);
  const loading = useProjectStore((s) => s.loading);
  const reset = useProjectStore((s) => s.reset);
  const segment = location.pathname.split('/').filter(Boolean).at(-1) ?? 'dashboard';
  const pageTitle = titleMap[segment] ?? '页面';
  const statusLabel = PROJECT_STATUS_LABEL[project.status] ?? project.status;

  const handleReset = async () => {
    await reset();
    message.success('已重置为统一 Demo 数据');
  };

  return (
    <Header
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        left: layout.sidebarWidth,
        zIndex: zIndex.topbar,
        height: layout.topbarHeight,
        lineHeight: `${layout.topbarHeight}px`,
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
      }}
    >
      <Space direction="vertical" size={0} style={{ lineHeight: 1.2 }}>
        <Breadcrumb
          items={[
            {
              title: (
                <a
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(ROUTES.dashboard);
                  }}
                >
                  短视频营销 Agent
                </a>
              ),
            },
            { title: pageTitle },
          ]}
          style={{ fontSize: 12, lineHeight: '18px' }}
        />
        <Typography.Text strong style={{ lineHeight: '22px' }}>
          {pageTitle}
        </Typography.Text>
      </Space>

      <Space size="middle" wrap className="topbar-meta">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Demo：{project.name}
        </Typography.Text>
        <Tag color="blue">{statusLabel}</Tag>
        <Tag>{project.owner}</Tag>
        <Button
          type="default"
          size="small"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => void handleReset()}
        >
          重置 Demo
        </Button>
        <Button type="text" icon={<QuestionCircleOutlined />} aria-label="帮助" />
        <Badge dot>
          <Button type="text" icon={<BellOutlined />} aria-label="通知" />
        </Badge>
        <Space size={8}>
          <Avatar size="small" icon={<UserOutlined />} style={{ background: '#1677FF' }} />
          <Typography.Text>{project.owner}</Typography.Text>
        </Space>
      </Space>
    </Header>
  );
}
