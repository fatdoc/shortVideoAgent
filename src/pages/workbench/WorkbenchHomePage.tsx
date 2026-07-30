import {
  ApartmentOutlined,
  ArrowRightOutlined,
  BankOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Alert, Button, Result, Space, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { ProductCatalog } from '../../components/commercial/ProductCatalog';
import type { WorkbenchKind } from '../../components/workbench/workbench';
import {
  CanonicalRouteError,
  requireCanonicalRoute,
} from '../../services/canonicalRouteGuard';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';

interface WorkbenchHomePageProps {
  kind: Extract<WorkbenchKind, 'platform' | 'channel'>;
}

export function WorkbenchHomePage({ kind }: WorkbenchHomePageProps) {
  const navigate = useNavigate();
  const { tenantId } = useParams<{ tenantId?: string }>();
  const snapshot = useControlPlaneStore((state) => state.snapshot);
  const commercial = snapshot.commercial;
  const wallet = commercial.creditState.wallet;
  const activeProducts = commercial.products.filter(
    (product) => product.availability === 'active',
  ).length;
  const activeChannel =
    commercial.channels.find((channel) => channel.channelOrganizationId === 'channel-demo-level-1') ??
    commercial.channels[0]!;

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

  if (kind === 'platform') {
    return (
      <div className="d1-page-stack">
        <header className="d1-page-header">
          <div>
            <Tag color="blue">PLATFORM_GLOBAL</Tag>
            <Typography.Title level={2}>平台管理</Typography.Title>
            <Typography.Paragraph type="secondary">
              查看组织、产品、演示额度与生产回执，不展开客户脚本和素材正文。
            </Typography.Paragraph>
          </div>
          <Button
            type="primary"
            icon={<ArrowRightOutlined />}
            onClick={() => navigate('/platform/catalog')}
          >
            管理演示目录
          </Button>
        </header>

        <section className="d1-metric-rail">
          <div>
            <BankOutlined />
            <Typography.Text type="secondary">平台组织</Typography.Text>
            <strong>1</strong>
          </div>
          <div>
            <ApartmentOutlined />
            <Typography.Text type="secondary">渠道节点</Typography.Text>
            <strong>{commercial.channels.length}</strong>
          </div>
          <div>
            <ShopOutlined />
            <Typography.Text type="secondary">企业 Tenant</Typography.Text>
            <strong>1</strong>
          </div>
          <div>
            <CheckCircleOutlined />
            <Typography.Text type="secondary">D1 可用产品</Typography.Text>
            <strong>{activeProducts}</strong>
          </div>
          <div>
            <SafetyCertificateOutlined />
            <Typography.Text type="secondary">回执</Typography.Text>
            <strong>
              {snapshot.generationTaskReceipts.length + snapshot.assetReceipts.length}
            </strong>
          </div>
        </section>

        <section className="d1-detail-grid">
          <div className="d1-surface">
            <div className="d1-section-heading">
              <div>
                <Typography.Title level={4}>渠道与企业组织</Typography.Title>
                <Typography.Text type="secondary">
                  单父、无环、最多总代理 → 一级代理 → 二级代理。
                </Typography.Text>
              </div>
              <Button onClick={() => navigate('/platform/organizations')}>
                查看组织范围
              </Button>
            </div>
            <div className="d1-org-tree">
              <div className="d1-org-node is-platform">
                <span>平台</span>
                <strong>{commercial.platform.displayName}</strong>
              </div>
              {commercial.channels.map((channel) => (
                <div
                  className="d1-org-node"
                  key={channel.channelOrganizationId}
                  style={{ marginLeft: `${channel.depth * 24}px` }}
                >
                  <span>Depth {channel.depth} · {channel.tier}</span>
                  <strong>{channel.displayName}</strong>
                </div>
              ))}
              <div className="d1-org-node is-tenant" style={{ marginLeft: 96 }}>
                <span>Tenant · 生产内容隔离边界</span>
                <strong>{commercial.tenant.displayName}</strong>
              </div>
            </div>
          </div>

          <div className="d1-surface">
            <div className="d1-section-heading">
              <div>
                <Typography.Title level={4}>演示额度总览</Typography.Title>
                <Typography.Text type="secondary">
                  Wallet 投影来自 append-only CreditLedger。
                </Typography.Text>
              </div>
            </div>
            <div className="d1-balance-display">
              <div>
                <span>可用</span>
                <strong>{wallet.available.value}</strong>
              </div>
              <div>
                <span>冻结</span>
                <strong>{wallet.reserved.value}</strong>
              </div>
            </div>
            <Alert
              type="info"
              showIcon
              message={snapshot.truthManifest.disclaimer}
              description="平台上游成本、真实价格和供应商密钥不进入本次客户演示。"
            />
          </div>
        </section>

        <ProductCatalog audience="platform" compact />
      </div>
    );
  }

  return (
    <div className="d1-page-stack">
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
                  channel.parentChannelOrganizationId ===
                  activeChannel.channelOrganizationId,
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
              <Typography.Text type="secondary">
                UI 不按总代理、一级、二级复制。
              </Typography.Text>
            </div>
          </div>
          <div className="d1-channel-list">
            {commercial.channels.map((channel) => (
              <div
                className={
                  channel.channelOrganizationId ===
                  activeChannel.channelOrganizationId
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
              <Typography.Text type="secondary">
                仅商业状态与汇总用量。
              </Typography.Text>
            </div>
          </div>
          <div className="d1-customer-row">
            <div className="d1-customer-avatar">海</div>
            <div>
              <Typography.Text strong>{commercial.tenant.displayName}</Typography.Text>
              <Typography.Text type="secondary">
                已购 2 · 生产内容默认不可见
              </Typography.Text>
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

export function PlatformReceiptMonitorPage() {
  const snapshot = useControlPlaneStore((state) => state.snapshot);
  const credit = snapshot.commercial.creditState;

  return (
    <div className="d1-page-stack">
      <header className="d1-page-header">
        <div>
          <Tag color="blue">平台运营视图</Tag>
          <Typography.Title level={2}>生产回执监控</Typography.Title>
          <Typography.Paragraph type="secondary">
            只展示任务元数据和额度动作，不展开客户脚本、提示词或素材正文。
          </Typography.Paragraph>
        </div>
      </header>

      <section className="d1-detail-grid">
        <div className="d1-surface">
          <div className="d1-section-heading">
            <Typography.Title level={4}>任务回执</Typography.Title>
            <Tag>{snapshot.generationTaskReceipts.length}</Tag>
          </div>
          {snapshot.generationTaskReceipts.length ? (
            <div className="d1-receipt-list">
              {snapshot.generationTaskReceipts.map((receipt) => (
                <div className="d1-receipt-row" key={receipt.generationTaskId}>
                  <div>
                    <Typography.Text strong>{receipt.generationTaskId}</Typography.Text>
                    <Typography.Text type="secondary">
                      {receipt.projectId} · {receipt.taskType} · {receipt.completedAt}
                    </Typography.Text>
                  </div>
                  <Tag color={receipt.status === 'succeeded' ? 'green' : 'red'}>
                    {receipt.status}
                  </Tag>
                </div>
              ))}
            </div>
          ) : (
            <Alert type="info" showIcon message="尚无任务回执" />
          )}
        </div>

        <div className="d1-surface">
          <div className="d1-section-heading">
            <Typography.Title level={4}>账本投影</Typography.Title>
            <Tag>{snapshot.truthManifest.disclaimer}</Tag>
          </div>
          <div className="d1-balance-display">
            <div>
              <span>可用</span>
              <strong>{credit.wallet.available.value}</strong>
            </div>
            <div>
              <span>冻结</span>
              <strong>{credit.wallet.reserved.value}</strong>
            </div>
          </div>
          <Typography.Text type="secondary">
            共 {credit.ledger.length} 条 append-only 分录。
          </Typography.Text>
        </div>
      </section>
    </div>
  );
}
