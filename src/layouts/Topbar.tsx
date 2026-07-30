import {
  BellOutlined,
  DownOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { App, Avatar, Badge, Button, Input, Layout, Space, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { layout, zIndex } from '../design/tokens';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';

const { Header } = Layout;

export function Topbar() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const project = useProjectStore((s) => s.workspace.project);
  const loading = useProjectStore((s) => s.loading);
  const reset = useProjectStore((s) => s.reset);
  const identity = useAuthStore((s) => s.currentIdentity);
  const logout = useAuthStore((s) => s.logout);

  const handleReset = async () => {
    await reset();
    message.success('已重置为统一 Demo 数据');
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const displayName = identity?.displayName ?? project.owner;
  const organizationName = identity?.activeOrganization.organizationName ?? '星火本地生活团队';

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
          {organizationName}
          <DownOutlined style={{ color: '#98A2B3', fontSize: 10 }} />
        </Button>
        <Tooltip title="重置 Demo">
          <Button
            type="text"
            className="topbar-reset"
            icon={<ReloadOutlined />}
            aria-label="重置 Demo"
            loading={loading}
            onClick={() => void handleReset()}
          />
        </Tooltip>
        <Badge count={12} size="small" offset={[-2, 5]}>
          <Button type="text" icon={<BellOutlined />} aria-label="通知" />
        </Badge>
        <Tooltip title="帮助">
          <Button type="text" icon={<QuestionCircleOutlined />} aria-label="帮助" />
        </Tooltip>
        <div className="topbar-divider" />
        <Space size={8} className="topbar-user">
          <Avatar
            size={30}
            src="/placeholders/member.svg"
            icon={<UserOutlined />}
            style={{ background: '#EAF2FF' }}
          />
          <Typography.Text strong style={{ fontSize: 13 }}>
            {displayName}
          </Typography.Text>
          {identity ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {identity.roleLabel}
            </Typography.Text>
          ) : null}
          <DownOutlined style={{ color: '#8C8C8C', fontSize: 11 }} />
          <Tooltip title="退出登录">
            <Button
              type="text"
              icon={<LogoutOutlined />}
              aria-label="退出登录"
              onClick={handleLogout}
            />
          </Tooltip>
        </Space>
      </Space>
    </Header>
  );
}
