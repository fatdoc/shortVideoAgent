import {
  ApiOutlined,
  ArrowRightOutlined,
  BankOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Button, Layout, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { DemoWorkbench } from '../../domain/demoIdentity';
import { DEMO_PROJECT_ID, ROUTES } from '../../domain/constants';
import { useAuthStore } from '../../stores/authStore';
import '../../design/d2-auth.css';

const { Content } = Layout;

const workbenchMeta: Record<
  Exclude<DemoWorkbench, 'tenant'>,
  {
    title: string;
    eyebrow: string;
    description: string;
    icon: ReactNode;
    metrics: readonly [string, string, string][];
    nextActions: readonly string[];
  }
> = {
  platform: {
    title: '平台运营工作台',
    eyebrow: 'Platform',
    description: '查看平台级组织、产品能力、套餐与演示数据治理状态。',
    icon: <BankOutlined />,
    metrics: [
      ['渠道组织', '12', '一级 / 二级渠道'],
      ['租户商家', '86', '已启用 Demo 权益'],
      ['产品能力', '9', '短视频生产链路'],
    ],
    nextActions: ['配置渠道与租户', '审核产品能力开关', '查看平台演示数据'],
  },
  channel: {
    title: '渠道管理工作台',
    eyebrow: 'Channel',
    description: '管理代理商下属商家、套餐开通与交付进度。',
    icon: <TeamOutlined />,
    metrics: [
      ['下属商家', '24', '本月新增 5 家'],
      ['交付项目', '38', '12 个待复核'],
      ['续费提醒', '6', '未来 30 天'],
    ],
    nextActions: ['查看商家列表', '分配制作人员', '跟进套餐续费'],
  },
  production: {
    title: '制作交付工作台',
    eyebrow: 'Production',
    description: '集中处理脚本、分镜、素材与初剪交付任务。',
    icon: <VideoCameraOutlined />,
    metrics: [
      ['待制作', '7', '今日需处理'],
      ['待审核', '4', '品牌事实复核'],
      ['可交付', '3', '初剪已完成'],
    ],
    nextActions: ['进入脚本任务', '整理分镜清单', '检查初剪素材'],
  },
};

interface RoleWorkbenchPageProps {
  workbench: Exclude<DemoWorkbench, 'tenant'>;
}

export function RoleWorkbenchPage({ workbench }: RoleWorkbenchPageProps) {
  const navigate = useNavigate();
  const identity = useAuthStore((state) => state.currentIdentity);
  const logout = useAuthStore((state) => state.logout);
  const defaultRoute = useAuthStore((state) => state.defaultRoute);
  const canAccess = identity?.allowedWorkbenches.includes(workbench) ?? false;
  const meta = workbenchMeta[workbench];

  if (!identity) return <Navigate to="/login" replace />;
  if (!canAccess) return <Navigate to={defaultRoute ?? '/dashboard'} replace />;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Layout className="role-workbench-page">
      <Content className="role-workbench-main">
        <header className="role-workbench-header">
          <div className="role-workbench-brand">
            <span className="role-workbench-mark">VA</span>
            <div>
              <Typography.Text strong>短视频营销 Agent</Typography.Text>
              <Typography.Text type="secondary">{identity.activeOrganization.organizationName}</Typography.Text>
            </div>
          </div>
          <Space size={10}>
            <Tag color="processing">{identity.roleLabel}</Tag>
            <Button icon={<LogoutOutlined />} onClick={handleLogout}>
              退出
            </Button>
          </Space>
        </header>

        <section className="role-workbench-hero">
          <div className="role-workbench-icon">{meta.icon}</div>
          <Tag color="blue">{meta.eyebrow}</Tag>
          <Typography.Title level={1}>{meta.title}</Typography.Title>
          <Typography.Paragraph>{meta.description}</Typography.Paragraph>
        </section>

        <section className="role-workbench-grid" aria-label="角色数据概览">
          {meta.metrics.map(([label, value, hint]) => (
            <article key={label} className="role-workbench-card">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{hint}</small>
            </article>
          ))}
        </section>

        <section className="role-workbench-panel">
          <div className="role-workbench-panel-title">
            <SafetyCertificateOutlined />
            <Typography.Title level={3}>当前身份能力</Typography.Title>
          </div>
          <div className="role-workbench-actions">
            {meta.nextActions.map((action) => (
              <Button key={action} icon={<ApiOutlined />}>
                {action}
              </Button>
            ))}
          </div>
          <Button
            type="primary"
            icon={<ArrowRightOutlined />}
            onClick={() => navigate(ROUTES.brand(DEMO_PROJECT_ID))}
          >
            查看租户 Demo 项目
          </Button>
        </section>
      </Content>
    </Layout>
  );
}
