import { Alert, Space, Tag, Typography } from 'antd';

interface PagePlaceholderProps {
  title: string;
  owner: string;
  description: string;
  route: string;
}

export function PagePlaceholder({ title, owner, description, route }: PagePlaceholderProps) {
  return (
    <div className="app-page-card">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {description}
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Tag color="blue">Gate 0 占位页</Tag>
          <Tag>{owner}</Tag>
          <Tag color="default">{route}</Tag>
        </Space>
        <Alert
          type="info"
          showIcon
          message="业务实现尚未开始"
          description="当前页面仅用于验证路由、布局与统一 Demo 数据骨架。对应业务线程启动后将替换为完整交互。"
        />
      </Space>
    </div>
  );
}
