import {
  ApartmentOutlined,
  ArrowRightOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  ShopOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Alert, Button, Result, Space, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import type { DemoPriceLayer } from '../../domain/controlPlane';
import {
  selectChannelCommercialView,
  type ChannelCommercialView,
  type CommercialOperationsSummary,
} from '../../domain/controlPlaneViewModels';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';

const PRICE_LAYER_LABELS: Partial<Record<DemoPriceLayer, string>> = {
  CHANNEL_WHOLESALE: '渠道直接批发价',
  CUSTOMER_RETAIL: '企业客户零售价',
  CAMPAIGN: '企业客户活动价',
};

function useChannelCommercialView() {
  const snapshot = useControlPlaneStore((state) => state.snapshot);
  return selectChannelCommercialView(snapshot);
}

function formatMoney(amountMinor: number) {
  return `¥${(amountMinor / 100).toFixed(2)}`;
}

function totalReceipts(operations: CommercialOperationsSummary) {
  return operations.generationTasks.total + operations.assets.total + operations.exports.total;
}

function DemoDisclaimer({ view }: { view: ChannelCommercialView }) {
  return (
    <Alert
      type="info"
      showIcon
      message={view.disclaimer}
      description="渠道库存、价格、订单、销售净额与订单毛差均为只读 Mock 管理口径，不构成正式报价、结算单或法定利润。"
    />
  );
}

function ContentBoundaryAlert() {
  return (
    <Alert
      type="warning"
      showIcon
      message="CHANNEL_SUBTREE_COMMERCIAL 只授权商业摘要"
      description="当前渠道只能查看自身、直接下级与企业客户的商业汇总；品牌、脚本、Claim、提示词、素材和成片正文不在本工作台数据范围内。"
    />
  );
}

function ReceiptSummary({ operations }: { operations: CommercialOperationsSummary }) {
  return (
    <div className="d1-receipt-list">
      <div className="d1-receipt-row">
        <div>
          <Typography.Text strong>GenerationTask</Typography.Text>
          <Typography.Text type="secondary">
            失败 {operations.generationTasks.failed}
          </Typography.Text>
        </div>
        <Tag>{operations.generationTasks.total}</Tag>
      </div>
      <div className="d1-receipt-row">
        <div>
          <Typography.Text strong>Asset</Typography.Text>
          <Typography.Text type="secondary">只统计回执数量和审核状态</Typography.Text>
        </div>
        <Tag>{operations.assets.total}</Tag>
      </div>
      <div className="d1-receipt-row">
        <div>
          <Typography.Text strong>Export</Typography.Text>
          <Typography.Text type="secondary">失败 {operations.exports.failed}</Typography.Text>
        </div>
        <Tag>{operations.exports.total}</Tag>
      </div>
    </div>
  );
}

export function ChannelOverviewPage() {
  const navigate = useNavigate();
  const view = useChannelCommercialView();

  return (
    <div className="d1-page-stack" data-testid="channel-overview-page">
      <header className="d1-page-header">
        <div>
          <Space size={8} wrap>
            <Tag color="cyan">{view.channel.tier}</Tag>
            <Tag>CHANNEL_SUBTREE_COMMERCIAL</Tag>
          </Space>
          <Typography.Title level={2}>渠道经营概览</Typography.Title>
          <Typography.Paragraph type="secondary">
            当前固定视角：{view.channel.displayName}（{view.channel.channelOrganizationId}）。
          </Typography.Paragraph>
        </div>
        <Button type="primary" onClick={() => navigate('/channel/customers')}>
          查看企业客户
        </Button>
      </header>

      <section className="d1-metric-rail">
        <div>
          <ApartmentOutlined />
          <Typography.Text type="secondary">直接下级渠道</Typography.Text>
          <strong>{view.directSubchannels.length}</strong>
        </div>
        <div>
          <TeamOutlined />
          <Typography.Text type="secondary">企业客户</Typography.Text>
          <strong>{view.customers.length}</strong>
        </div>
        <div>
          <DatabaseOutlined />
          <Typography.Text type="secondary">可用额度库存</Typography.Text>
          <strong>{view.inventory.availableCredits.value}</strong>
        </div>
        <div>
          <ShopOutlined />
          <Typography.Text type="secondary">销售净额</Typography.Text>
          <strong>{formatMoney(view.settlementSummary.salesNetAmount.amountMinor)}</strong>
        </div>
        <div>
          <CheckCircleOutlined />
          <Typography.Text type="secondary">订单毛差</Typography.Text>
          <strong>{formatMoney(view.settlementSummary.grossSpread.amountMinor)}</strong>
        </div>
      </section>

      <DemoDisclaimer view={view} />
      <ContentBoundaryAlert />

      <section className="d1-detail-grid">
        <div className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>额度库存</Typography.Title>
              <Typography.Text type="secondary">
                截至 {new Date(view.inventory.asOf).toLocaleString('zh-CN')}
              </Typography.Text>
            </div>
            <Tag color="blue">AI_VIDEO_CREDIT</Tag>
          </div>
          <div className="d1-balance-display">
            <div>
              <span>累计采购</span>
              <strong>{view.inventory.purchasedCredits.value}</strong>
            </div>
            <div>
              <span>当前可用</span>
              <strong>{view.inventory.availableCredits.value}</strong>
            </div>
          </div>
          <Space size={[8, 8]} wrap>
            <Tag>分配下级 {view.inventory.allocatedToSubchannels.value}</Tag>
            <Tag>分配企业 {view.inventory.allocatedToTenants.value}</Tag>
            <Tag color="green">期末结余 {view.settlementSummary.closingAvailableCredits.value}</Tag>
          </Space>
        </div>

        <div className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>订单经营摘要</Typography.Title>
              <Typography.Text type="secondary">
                {view.orders.length} 条已履约演示订单
              </Typography.Text>
            </div>
            <Tag color="green">{view.settlementSummary.status}</Tag>
          </div>
          <div className="d1-receipt-list">
            {view.orders.map((order) => (
              <div className="d1-receipt-row" key={order.orderId}>
                <div>
                  <Typography.Text strong>{order.buyer.displayName}</Typography.Text>
                  <Typography.Text type="secondary">
                    {order.creditAmount.value} 额度 · {order.orderId}
                  </Typography.Text>
                </div>
                <Tag>{formatMoney(order.netAmount.amountMinor)}</Tag>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function ChannelProductsPage() {
  const view = useChannelCommercialView();

  return (
    <div className="d1-page-stack" data-testid="channel-products-page">
      <header className="d1-page-header">
        <div>
          <Space size={8} wrap>
            <Tag color="cyan">{view.channel.tier}</Tag>
            <Tag>渠道可售范围</Tag>
          </Space>
          <Typography.Title level={2}>渠道产品与直接交易价格</Typography.Title>
          <Typography.Paragraph type="secondary">
            只显示当前渠道可见产品、SKU，以及当前渠道作为买方或卖方参与的价格快照。
          </Typography.Paragraph>
        </div>
      </header>

      <DemoDisclaimer view={view} />

      <section className="d1-detail-grid">
        <div className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>可售产品</Typography.Title>
              <Typography.Text type="secondary">锁定产品不进入渠道可售列表。</Typography.Text>
            </div>
            <Tag color="blue">{view.products.length} 项</Tag>
          </div>
          <div className="d1-receipt-list">
            {view.products.map((product) => {
              const productSkus = view.skus.filter((sku) => sku.productId === product.productId);
              return (
                <div className="d1-receipt-row" key={product.productId}>
                  <div>
                    <Typography.Text strong>{product.displayName}</Typography.Text>
                    <Typography.Text type="secondary">
                      {product.code} · {productSkus.map((sku) => sku.displayName).join('、')}
                    </Typography.Text>
                  </div>
                  <Tag color={product.availability === 'active' ? 'green' : 'gold'}>
                    {product.availability === 'active' ? '可售' : '说明态'}
                  </Tag>
                </div>
              );
            })}
          </div>
        </div>

        <div className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>直接交易价格层</Typography.Title>
              <Typography.Text type="secondary">平台上游成本与平台结算价不可见。</Typography.Text>
            </div>
            <Tag color="gold">NON_QUOTE</Tag>
          </div>
          <div className="d1-receipt-list">
            {view.priceSnapshots.map((price) => (
              <div className="d1-receipt-row" key={price.priceSnapshotId}>
                <div>
                  <Space size={6} wrap>
                    <Typography.Text strong>{price.priceLayer}</Typography.Text>
                    <Tag>{PRICE_LAYER_LABELS[price.priceLayer] ?? price.priceLayer}</Tag>
                  </Space>
                  <Typography.Text type="secondary">
                    {price.seller.displayName} → {price.buyer.displayName}
                  </Typography.Text>
                </div>
                <Tag color="blue">{formatMoney(price.unitPrice.amountMinor)} / 额度</Tag>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function ChannelCustomersPage() {
  const navigate = useNavigate();
  const view = useChannelCommercialView();

  return (
    <div className="d1-page-stack" data-testid="channel-customers-page">
      <header className="d1-page-header">
        <div>
          <Space size={8} wrap>
            <Tag color="cyan">{view.channel.tier}</Tag>
            <Tag>canonical Tenant</Tag>
          </Space>
          <Typography.Title level={2}>渠道企业客户</Typography.Title>
          <Typography.Paragraph type="secondary">
            仅展示企业商业状态、已购 Entitlement 与汇总用量，不展示生产正文。
          </Typography.Paragraph>
        </div>
      </header>

      <ContentBoundaryAlert />

      <section className="d1-surface">
        <div className="d1-section-heading">
          <div>
            <Typography.Title level={4}>企业客户商业状态</Typography.Title>
            <Typography.Text type="secondary">
              当前固定渠道直接服务的 canonical Tenant。
            </Typography.Text>
          </div>
          <Tag color="blue">{view.customers.length} 家</Tag>
        </div>
        <div className="d1-receipt-list">
          {view.customers.map((customer) => (
            <div className="d1-customer-row" key={customer.tenantId}>
              <div className="d1-customer-avatar">{customer.displayName.slice(0, 1)}</div>
              <div>
                <Typography.Text strong>{customer.displayName}</Typography.Text>
                <Typography.Text type="secondary">
                  {customer.tenantId} · 已购 Entitlement {customer.activeEntitlementCount}/
                  {customer.entitlementCount} · 汇总用量 {customer.creditUsage.consumed.value}
                </Typography.Text>
              </div>
              <Tag color={customer.status === 'active' ? 'green' : 'default'}>
                {customer.status}
              </Tag>
              <Button
                icon={<ArrowRightOutlined />}
                onClick={() => navigate(`/channel/customers/${customer.tenantId}/usage`)}
              >
                查看商业用量
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ChannelCustomerUsagePage() {
  const navigate = useNavigate();
  const { tenantId } = useParams<{ tenantId: string }>();
  const view = useChannelCommercialView();
  const customer = view.customers.find((item) => item.tenantId === tenantId);

  if (!customer) {
    return (
      <Result
        status="403"
        title="CUSTOMER_SCOPE_DENIED"
        subTitle="该 Tenant 不在当前固定渠道的商业授权范围内。"
        extra={<Button onClick={() => navigate('/channel/customers')}>返回企业客户</Button>}
      />
    );
  }

  const customerOrders = view.orders.filter((order) => order.buyer.partyId === customer.tenantId);

  return (
    <div className="d1-page-stack" data-testid="channel-customer-usage-page">
      <header className="d1-page-header">
        <div>
          <Space size={8} wrap>
            <Tag color="cyan">CHANNEL_SUBTREE_COMMERCIAL</Tag>
            <Tag>{customer.status}</Tag>
          </Space>
          <Typography.Title level={2}>客户商业用量</Typography.Title>
          <Typography.Paragraph type="secondary">
            {customer.displayName}（{customer.tenantId}）的
            Entitlement、Wallet、订单与回执数量摘要。
          </Typography.Paragraph>
        </div>
        <Button onClick={() => navigate('/channel/customers')}>返回企业客户</Button>
      </header>

      <section className="d1-metric-rail">
        <div>
          <CheckCircleOutlined />
          <Typography.Text type="secondary">活跃 Entitlement</Typography.Text>
          <strong>{customer.activeEntitlementCount}</strong>
        </div>
        <div>
          <DatabaseOutlined />
          <Typography.Text type="secondary">Wallet 可用</Typography.Text>
          <strong>{customer.wallet.available.value}</strong>
        </div>
        <div>
          <AuditOutlined />
          <Typography.Text type="secondary">Wallet 冻结</Typography.Text>
          <strong>{customer.wallet.reserved.value}</strong>
        </div>
        <div>
          <ShopOutlined />
          <Typography.Text type="secondary">已消费额度</Typography.Text>
          <strong>{customer.creditUsage.consumed.value}</strong>
        </div>
        <div>
          <ApartmentOutlined />
          <Typography.Text type="secondary">已释放额度</Typography.Text>
          <strong>{customer.creditUsage.released.value}</strong>
        </div>
      </section>

      <DemoDisclaimer view={view} />
      <ContentBoundaryAlert />

      <section className="d1-detail-grid">
        <div className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>订单与额度汇总</Typography.Title>
              <Typography.Text type="secondary">
                {customer.creditUsage.scenarioCount} 个演示消费/释放场景
              </Typography.Text>
            </div>
            <Tag color="blue">{customerOrders.length} 条订单</Tag>
          </div>
          <div className="d1-receipt-list">
            {customerOrders.map((order) => (
              <div className="d1-receipt-row" key={order.orderId}>
                <div>
                  <Typography.Text strong>{order.orderId}</Typography.Text>
                  <Typography.Text type="secondary">
                    {order.creditAmount.value} 额度 · 折扣{' '}
                    {formatMoney(order.discountAmount.amountMinor)}
                  </Typography.Text>
                </div>
                <Tag color="green">净额 {formatMoney(order.netAmount.amountMinor)}</Tag>
              </div>
            ))}
          </div>
        </div>

        <div className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>生产回执数量</Typography.Title>
              <Typography.Text type="secondary">
                三类回执合计 {totalReceipts(customer.operations)}，不展开回执正文。
              </Typography.Text>
            </div>
          </div>
          <ReceiptSummary operations={customer.operations} />
        </div>
      </section>
    </div>
  );
}
