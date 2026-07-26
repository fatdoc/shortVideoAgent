import {
  BellOutlined,
  DownOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { App, Avatar, Badge, Button, Input, Layout, Space, Tooltip, Typography } from 'antd';
import { layout, zIndex } from '../design/tokens';
import { useProjectStore } from '../stores/projectStore';

const { Header } = Layout;

export function Topbar() {
  const { message } = App.useApp();
  const project = useProjectStore((s) => s.workspace.project);
  const loading = useProjectStore((s) => s.loading);
  const reset = useProjectStore((s) => s.reset);

  const handleReset = async () => {
    await reset();
    message.success('已重置为统一 Demo 数据');
  };

  return (
    <Header
      className="app-topbar"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: zIndex.topbar,
        height: layout.topbarHeight,
        lineHeight: `${layout.topbarHeight}px`,
      }}
    >
      <Input
        className="topbar-search"
        size="middle"
        prefix={<SearchOutlined />}
        allowClear
        aria-label="全局搜索"
        placeholder="搜索项目、脚本、素材、任务..."
      />

      <span className="sr-only">Demo：{project.name}</span>

      <Space size={8} className="topbar-meta">
        <Button className="topbar-team" icon={<TeamOutlined />}>
          团队空间
          <DownOutlined style={{ color: '#98A2B3', fontSize: 10 }} />
        </Button>
        <Tooltip title="重置 Demo">
          <Button
            type="text"
            icon={<ReloadOutlined />}
            aria-label="重置 Demo"
            loading={loading}
            onClick={() => void handleReset()}
          />
        </Tooltip>
        <Tooltip title="帮助">
          <Button type="text" icon={<QuestionCircleOutlined />} aria-label="帮助" />
        </Tooltip>
        <Badge dot>
          <Button type="text" icon={<BellOutlined />} aria-label="通知" />
        </Badge>
        <div className="topbar-divider" />
        <Space size={8} className="topbar-user">
          <Avatar size={30} icon={<UserOutlined />} style={{ background: '#1677FF' }} />
          <Typography.Text strong style={{ fontSize: 13 }}>
            {project.owner}
          </Typography.Text>
          <DownOutlined style={{ color: '#8C8C8C', fontSize: 11 }} />
        </Space>
      </Space>
    </Header>
  );
}
