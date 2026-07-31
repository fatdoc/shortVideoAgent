import {
  ApartmentOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  ShopOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Alert, Button, Result, Space, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { ProductCatalog } from '../../components/commercial/ProductCatalog';
import { CanonicalRouteError, requireCanonicalRoute } from '../../services/canonicalRouteGuard';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';

interface WorkbenchHomePageProps {
  kind: 'channel';
}

export function WorkbenchHomePage({ kind }: WorkbenchHomePageProps) {
  const navigate = useNavigate();
  const { tenantId } = useParams<{ tenantId?: string }>();
  const snapshot = useControlPlaneStore((state) => state.snapshot);
  const commercial = snapshot.commercial;
  const activeProducts = commercial.products.filter(
    (product) => product.availability === 'active',
  ).length;
  const activeChannel =
    commercial.channels.find(
      (channel) => channel.channelOrganizationId === 'channel-demo-level-1',
    ) ?? commercial.channels[0]!;

  if (tenantId) {
    try {
      requireCanonicalRoute(tenantId, snapshot.fixtureId);
    } catch (error) {
      const routeError =
        error instanceof CanonicalRouteError
          ? error
          : new CanonicalRouteError('canonical tenant route 校验失败。', {
              receivedTenantId: tenantId,
              receivedProjectId: snapshot.fixtureId,
            });
      return (
        <Result
          status="403"
          title="ROUTE_ID_REJECTED"
          subTitle={`${routeError.message} Tenant=${routeError.details.receivedTenantId}`}
          extra={
            <Button type="primary" onClick={() => navigate('/channel/customers')}>
              返回企业客户列表
            </Button>
          }
        />
      );
    }
  }

  return (
    <div className="d1-page-stack" data-workbench-kind={kind}>
      <header className="d1-page-header">
        <div>
          <Space size={8} wrap>
            <Tag color="cyan">{activeChannel.tier}</Tag>
            <Tag>CHANNEL_SUBTREE_COMMERCIAL</Tag>
          </Space>
          <Typography.Title level={2}>渠道代理</Typography.Title>
          <Typography.Paragraph type="secondary">
            三个代理层级共用同一工作台；深度和数据范围来自当前组织上下文。
          </Typography.Paragraph>
        </div>
        <Button
          type="primary"
          icon={<ArrowRightOutlined />}
          onClick={() => navigate('/channel/products')}
        >
          查看可售产品
        </Button>
      </header>

      <section className="d1-metric-rail">
        <div>
          <TeamOutlined />
          <Typography.Text type="secondary">当前组织</Typography.Text>
          <strong>{activeChannel.displayName}</strong>
        </div>
        <div>
          <ApartmentOutlined />
          <Typography.Text type="secondary">下级渠道</Typography.Text>
          <strong>
            {
              commercial.channels.filter(
                (channel) =>
                  channel.parentChannelOrganizationId === activeChannel.channelOrganizationId,
              ).length
            }
          </strong>
        </div>
        <div>
          <ShopOutlined />
          <Typography.Text type="secondary">企业客户</Typography.Text>
          <strong>1</strong>
        </div>
        <div>
          <CheckCircleOutlined />
          <Typography.Text type="secondary">可售产品</Typography.Text>
          <strong>{activeProducts}</strong>
        </div>
      </section>

      <Alert
        type="warning"
        showIcon
        message="渠道商业可见性不等于 Tenant 生产内容权限"
        description="当前工作台只展示组织、产品与客户商业汇总；脚本、素材、Claim 和成片需要独立 Tenant Membership。"
      />

      <section className="d1-detail-grid">
        <div className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>共用层级视图</Typography.Title>
              <Typography.Text type="secondary">UI 不按总代理、一级、二级复制。</Typography.Text>
            </div>
          </div>
          <div className="d1-channel-list">
            {commercial.channels.map((channel) => (
              <div
                className={
                  channel.channelOrganizationId === activeChannel.channelOrganizationId
                    ? 'd1-channel-row is-active'
                    : 'd1-channel-row'
                }
                key={channel.channelOrganizationId}
              >
                <span>Depth {channel.depth}</span>
                <strong>{channel.displayName}</strong>
                <Tag>{channel.tier}</Tag>
                <small>{channel.status}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>企业客户</Typography.Title>
              <Typography.Text type="secondary">仅商业状态与汇总用量。</Typography.Text>
            </div>
          </div>
          <div className="d1-customer-row">
            <div className="d1-customer-avatar">海</div>
            <div>
              <Typography.Text strong>{commercial.tenant.displayName}</Typography.Text>
              <Typography.Text type="secondary">已购 2 · 生产内容默认不可见</Typography.Text>
            </div>
            <Tag color="green">{commercial.tenant.status}</Tag>
            <Button onClick={() => navigate('/channel/customers/tenant-demo-hdl/usage')}>
              查看商业汇总
            </Button>
          </div>
        </div>
      </section>

      <ProductCatalog audience="channel" compact />
    </div>
  );
}
