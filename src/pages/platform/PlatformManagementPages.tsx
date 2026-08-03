import {
  ApartmentOutlined,
  AuditOutlined,
  BankOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  ExceptionOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { Alert, Button, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { DemoPriceLayer } from '../../domain/controlPlane';
import {
  selectPlatformCommercialView,
  type CommercialOperationsSummary,
} from '../../domain/controlPlaneViewModels';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';

const PRICE_LAYER_LABELS: Record<DemoPriceLayer, string> = {
  UPSTREAM_COST: '上游成本',
  PLATFORM_SETTLEMENT: '平台结算',
  CHANNEL_WHOLESALE: '渠道批发',
  CUSTOMER_RETAIL: '客户零售',
  CAMPAIGN: '活动价',
};

const AVAILABILITY_COLORS = {
  active: 'green',
  explanation_only: 'gold',
  locked: 'default',
} as const;

function usePlatformCommercialView() {
  const snapshot = useControlPlaneStore((state) => state.snapshot);
  return selectPlatformCommercialView(snapshot);
}

function formatMoney(amountMinor: number) {
  return `¥${(amountMinor / 100).toFixed(2)}`;
}

function totalReceipts(operations: CommercialOperationsSummary) {
  return operations.generationTasks.total + operations.assets.total + operations.exports.total;
}

function StatusSummary({ values }: { values: Record<string, number> }) {
  const entries = Object.entries(values);
  if (!entries.length) return <Typography.Text type="secondary">暂无状态记录</Typography.Text>;

  return (
    <Space size={[6, 6]} wrap>
      {entries.map(([status, count]) => (
        <Tag key={status}>
          {status}: {count}
        </Tag>
      ))}
    </Space>
  );
}

function DemoDisclaimer({ text }: { text: string }) {
  return (
    <Alert
      type="info"
      showIcon
      message={text}
      description="以下目录、价格、额度与风险数据仅用于 D1 演示，不构成合同、结算单或正式报价。"
    />
  );
}

export function PlatformOverviewPage() {
  const navigate = useNavigate();
  const view = usePlatformCommercialView();
  const activeProducts = view.products.filter(
    (product) => product.availability === 'active',
  ).length;
  const commercialExceptions =
    view.platformRisk.openCommercialExceptions + view.platformRisk.unmatchedReceiptCount;

  return (
    <div className="d1-page-stack" data-testid="platform-overview-page">
      <header className="d1-page-header">
        <div>
          <Tag color="blue">PLATFORM_GLOBAL</Tag>
          <Typography.Title level={2}>平台运营概览</Typography.Title>
          <Typography.Paragraph type="secondary">
            汇总平台组织、目录、生产回执与商业异常；详细管理职责由独立路由承载。
          </Typography.Paragraph>
        </div>
        <Button type="primary" onClick={() => navigate('/platform/organizations')}>
          查看组织管理
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
          <strong>{view.channels.length}</strong>
        </div>
        <div>
          <ShopOutlined />
          <Typography.Text type="secondary">企业 Tenant</Typography.Text>
          <strong>1</strong>
        </div>
        <div>
          <CheckCircleOutlined />
          <Typography.Text type="secondary">活跃产品</Typography.Text>
          <strong>{activeProducts}</strong>
        </div>
        <div>
          <SafetyCertificateOutlined />
          <Typography.Text type="secondary">三类回执</Typography.Text>
          <strong>{totalReceipts(view.operations)}</strong>
        </div>
      </section>

      <section className="d1-detail-grid">
        <div className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>管理入口</Typography.Title>
              <Typography.Text type="secondary">每条平台路由只承担一种管理语义。</Typography.Text>
            </div>
          </div>
          <div className="d1-channel-list">
            <div className="d1-channel-row">
              <span>组织</span>
              <strong>渠道树与 Tenant 商业边界</strong>
              <Tag>{view.channels.length + 2} 节点</Tag>
              <Button type="link" onClick={() => navigate('/platform/organizations')}>
                进入
              </Button>
            </div>
            <div className="d1-channel-row">
              <span>目录</span>
              <strong>Product / Capability / SKU / RateCard</strong>
              <Tag>{view.products.length} 产品</Tag>
              <Button type="link" onClick={() => navigate('/platform/catalog')}>
                进入
              </Button>
            </div>
            <div className="d1-channel-row">
              <span>回执</span>
              <strong>生产结果与异常计数</strong>
              <Tag>{totalReceipts(view.operations)} 回执</Tag>
              <Button type="link" onClick={() => navigate('/platform/production-receipts')}>
                进入
              </Button>
            </div>
          </div>
        </div>

        <div className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>平台风险摘要</Typography.Title>
              <Typography.Text type="secondary">只读演示投影，不展开客户生产正文。</Typography.Text>
            </div>
          </div>
          <div className="d1-balance-display">
            <div>
              <span>商业异常</span>
              <strong>{commercialExceptions}</strong>
            </div>
            <div>
              <span>审计事件</span>
              <strong>{view.platformRisk.auditEventCount}</strong>
            </div>
          </div>
          <Typography.Text type="secondary">
            冻结 Wallet：{view.platformRisk.frozenWalletCount}；统计时间：{view.platformRisk.asOf}
          </Typography.Text>
        </div>
      </section>

      <DemoDisclaimer text={view.disclaimer} />
    </div>
  );
}

export function PlatformOrganizationsPage() {
  const view = usePlatformCommercialView();

  return (
    <div className="d1-page-stack" data-testid="platform-organizations-page">
      <header className="d1-page-header">
        <div>
          <Tag color="blue">PLATFORM_ORGANIZATIONS</Tag>
          <Typography.Title level={2}>平台组织管理</Typography.Title>
          <Typography.Paragraph type="secondary">
            管理 Platform、Master、Level 1、Level 2 与 canonical Tenant 的商业关系。
          </Typography.Paragraph>
        </div>
      </header>

      <Alert
        type="warning"
        showIcon
        message="Tenant 内容边界：PRODUCTION_CONTENT"
        description="平台组织视图只说明商业归属和授权摘要，不代表可读取品牌、脚本、Claim、提示词、素材或成片正文。"
      />

      <section className="d1-detail-grid">
        <div className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>组织树</Typography.Title>
              <Typography.Text type="secondary">单父、无环、最大深度为三级渠道。</Typography.Text>
            </div>
          </div>
          <div className="d1-org-tree">
            <div className="d1-org-node is-platform">
              <span>Platform · {view.platform.status}</span>
              <strong>{view.platform.displayName}</strong>
              <small>{view.platform.platformId}</small>
            </div>
            {view.channels.map((channel) => (
              <div
                className="d1-org-node"
                key={channel.channelOrganizationId}
                style={{ marginLeft: `${channel.depth * 24}px` }}
              >
                <span>
                  {channel.tier} · Depth {channel.depth} · {channel.status}
                </span>
                <strong>{channel.displayName}</strong>
                <small>
                  parent: {channel.parentChannelOrganizationId ?? view.platform.platformId}
                  {' · '}white-label: {channel.whiteLabelMode ? 'on' : 'off'}
                </small>
              </div>
            ))}
            <div className="d1-org-node is-tenant" style={{ marginLeft: 96 }}>
              <span>
                Tenant · {view.tenant.status} · {view.tenant.acquisitionMode}
              </span>
              <strong>{view.tenant.displayName}</strong>
              <small>
                {view.tenant.tenantId} · service channel:{' '}
                {view.tenant.currentServiceChannelOrganizationId}
              </small>
            </div>
          </div>
        </div>

        <div className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>Tenant 商业授权摘要</Typography.Title>
              <Typography.Text type="secondary">不返回原始额度分录或生产内容。</Typography.Text>
            </div>
          </div>
          <div className="d1-balance-display">
            <div>
              <span>Entitlement</span>
              <strong>{view.tenant.entitlementCount}</strong>
            </div>
            <div>
              <span>Active</span>
              <strong>{view.tenant.activeEntitlementCount}</strong>
            </div>
          </div>
          <Space size={[6, 6]} wrap>
            <Tag color="green">Wallet {view.tenant.wallet.status}</Tag>
            <Tag>可用 {view.tenant.wallet.available.value}</Tag>
            <Tag>冻结 {view.tenant.wallet.reserved.value}</Tag>
          </Space>
          <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
            当前展示是 selector 生成的商业摘要；Tenant 的 dataBoundary 固定为 PRODUCTION_CONTENT。
          </Typography.Paragraph>
        </div>
      </section>

      <DemoDisclaimer text={view.disclaimer} />
    </div>
  );
}

export function PlatformCatalogPage() {
  const view = usePlatformCommercialView();

  return (
    <div className="d1-page-stack" data-testid="platform-catalog-page">
      <header className="d1-page-header">
        <div>
          <Tag color="blue">PLATFORM_CATALOG</Tag>
          <Typography.Title level={2}>平台产品目录</Typography.Title>
          <Typography.Paragraph type="secondary">
            统一查看 Product、Capability、SKU、RateCard 与五层演示价格。
          </Typography.Paragraph>
        </div>
      </header>

      <DemoDisclaimer text={view.disclaimer} />

      <section className="d1-detail-grid">
        <div className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>Product 与 SKU</Typography.Title>
              <Typography.Text type="secondary">平台目录定义和演示销售规格。</Typography.Text>
            </div>
            <Tag>{view.products.length} Products</Tag>
          </div>
          <div className="d1-channel-list">
            {view.products.map((product) => {
              const productSkus = view.skus.filter((sku) => sku.productId === product.productId);
              return (
                <div className="d1-receipt-row" key={product.productId}>
                  <div>
                    <Typography.Text strong>{product.displayName}</Typography.Text>
                    <Typography.Text type="secondary">
                      {product.code} · {product.description}
                    </Typography.Text>
                    <Space size={[6, 6]} wrap>
                      {productSkus.map((sku) => (
                        <Tag key={sku.skuId}>
                          SKU {sku.code} · {sku.includedCredits.value} credits · {sku.validityDays}{' '}
                          days
                        </Tag>
                      ))}
                    </Space>
                  </div>
                  <Tag color={AVAILABILITY_COLORS[product.availability]}>
                    {product.availability}
                  </Tag>
                </div>
              );
            })}
          </div>
        </div>

        <div className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>Capability</Typography.Title>
              <Typography.Text type="secondary">执行能力、依赖与锁定状态。</Typography.Text>
            </div>
            <Tag>{view.capabilities.length}</Tag>
          </div>
          <div className="d1-channel-list">
            {view.capabilities.map((capability) => (
              <div className="d1-receipt-row" key={capability.capabilityId}>
                <div>
                  <Typography.Text strong>{capability.displayName}</Typography.Text>
                  <Typography.Text type="secondary">
                    {capability.code} · {capability.category} · dependencies{' '}
                    {capability.dependencyCapabilityIds.length}
                  </Typography.Text>
                </div>
                <Tag color={AVAILABILITY_COLORS[capability.availability]}>
                  {capability.availability}
                </Tag>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="d1-surface">
        <div className="d1-section-heading">
          <div>
            <Typography.Title level={4}>RateCard</Typography.Title>
            <Typography.Text type="secondary">演示计量规则与额度预留上限。</Typography.Text>
          </div>
          <Tag>{view.rateCard.version}</Tag>
        </div>
        <div className="d1-ratecard-rail">
          <div>
            <Typography.Text type="secondary">Meter</Typography.Text>
            <Typography.Text strong>{view.rateCard.meterCode}</Typography.Text>
          </div>
          <div>
            <Typography.Text type="secondary">Rule</Typography.Text>
            <Typography.Text strong>{view.rateCard.meteringRule}</Typography.Text>
          </div>
          <div>
            <Typography.Text type="secondary">Estimated</Typography.Text>
            <Typography.Text strong>{view.rateCard.estimatedCredits.value}</Typography.Text>
          </div>
          <div>
            <Typography.Text type="secondary">Max reserved</Typography.Text>
            <Typography.Text strong>{view.rateCard.maxReservedCredits.value}</Typography.Text>
          </div>
          <div className="d1-ratecard-disclaimer">
            <Typography.Text type="secondary">Billable outcome</Typography.Text>
            <Typography.Text strong>{view.rateCard.billableOutcome}</Typography.Text>
          </div>
        </div>
      </section>

      <section className="d1-surface">
        <div className="d1-section-heading">
          <div>
            <Typography.Title level={4}>五层演示价格</Typography.Title>
            <Typography.Text type="secondary">
              平台可见上游成本到活动价的完整只读投影。
            </Typography.Text>
          </div>
          <Tag>{view.priceSnapshots.length} snapshots</Tag>
        </div>
        <div className="d1-channel-list">
          {view.priceSnapshots.map((price) => (
            <div className="d1-channel-row" key={price.priceSnapshotId}>
              <span>{PRICE_LAYER_LABELS[price.priceLayer]}</span>
              <strong>{price.priceLayer}</strong>
              <Tag>{formatMoney(price.unitPrice.amountMinor)}</Tag>
              <small>{price.chargeUnit}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function PlatformReceiptMonitorPage() {
  const view = usePlatformCommercialView();
  const { generationTasks, assets, exports } = view.operations;

  return (
    <div className="d1-page-stack" data-testid="platform-receipts-page">
      <header className="d1-page-header">
        <div>
          <Tag color="blue">PLATFORM_RECEIPTS</Tag>
          <Typography.Title level={2}>平台生产回执监控</Typography.Title>
          <Typography.Paragraph type="secondary">
            只显示 GenerationTask、Asset、Export 的状态计数与平台异常摘要。
          </Typography.Paragraph>
        </div>
      </header>

      <section className="d1-metric-rail">
        <div>
          <DatabaseOutlined />
          <Typography.Text type="secondary">GenerationTask</Typography.Text>
          <strong>{generationTasks.total}</strong>
        </div>
        <div>
          <ExceptionOutlined />
          <Typography.Text type="secondary">Task 失败</Typography.Text>
          <strong>{generationTasks.failed}</strong>
        </div>
        <div>
          <SafetyCertificateOutlined />
          <Typography.Text type="secondary">Asset</Typography.Text>
          <strong>{assets.total}</strong>
        </div>
        <div>
          <CheckCircleOutlined />
          <Typography.Text type="secondary">Export / 失败</Typography.Text>
          <strong>
            {exports.total} / {exports.failed}
          </strong>
        </div>
        <div>
          <AuditOutlined />
          <Typography.Text type="secondary">未匹配回执</Typography.Text>
          <strong>{view.platformRisk.unmatchedReceiptCount}</strong>
        </div>
      </section>

      <section className="d1-detail-grid">
        <div className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>回执状态摘要</Typography.Title>
              <Typography.Text type="secondary">
                页面不返回任务输入、脚本、提示词或素材正文。
              </Typography.Text>
            </div>
          </div>
          <div className="d1-receipt-group">
            <Typography.Title level={5}>GenerationTask 状态</Typography.Title>
            <StatusSummary values={generationTasks.byStatus} />
          </div>
          <div className="d1-receipt-group">
            <Typography.Title level={5}>Asset Review 状态</Typography.Title>
            <StatusSummary values={assets.byReviewStatus} />
          </div>
          <div className="d1-receipt-group">
            <Typography.Title level={5}>Export 状态</Typography.Title>
            <StatusSummary values={exports.byStatus} />
          </div>
        </div>

        <div className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>异常与审计</Typography.Title>
              <Typography.Text type="secondary">
                异常计数用于解释 Demo 状态，不代表真实告警系统。
              </Typography.Text>
            </div>
          </div>
          <div className="d1-balance-display">
            <div>
              <span>商业异常</span>
              <strong>{view.platformRisk.openCommercialExceptions}</strong>
            </div>
            <div>
              <span>审计事件</span>
              <strong>{view.platformRisk.auditEventCount}</strong>
            </div>
          </div>
          {totalReceipts(view.operations) === 0 ? (
            <Alert
              type="info"
              showIcon
              message="当前三类回执均为空"
              description="可在 canonical Demo 流程产生回执后刷新此摘要。"
            />
          ) : (
            <Alert type="warning" showIcon message="存在回执记录，请结合失败数与未匹配计数复核。" />
          )}
          <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
            审计入口：按 contract
            version、状态计数和异常编号进入后续服务端审计；本页不暴露客户生产内容。
          </Typography.Paragraph>
        </div>
      </section>

      <DemoDisclaimer text={view.disclaimer} />
    </div>
  );
}
