import {
  ArrowRightOutlined,
  CheckCircleFilled,
  InfoCircleOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { Button, Descriptions, Drawer, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../domain/constants';
import {
  selectTenantCommercialView,
  type TenantProductView,
} from '../../domain/controlPlaneViewModels';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';
import './product-catalog.css';

interface ProductCatalogProps {
  compact?: boolean;
}

const purchaseStateMeta = {
  purchased: {
    label: '已购 Entitlement',
    color: 'success',
    icon: <CheckCircleFilled />,
    dotClassName: 'active',
  },
  explanation_only: {
    label: '产品说明 · 未开通',
    color: 'processing',
    icon: <InfoCircleOutlined />,
    dotClassName: 'explanation_only',
  },
  locked: {
    label: '锁定 · 未授权',
    color: 'default',
    icon: <LockOutlined />,
    dotClassName: 'locked',
  },
} as const;

export function ProductCatalog({ compact = false }: ProductCatalogProps) {
  const navigate = useNavigate();
  const snapshot = useControlPlaneStore((state) => state.snapshot);
  const [selected, setSelected] = useState<TenantProductView | null>(null);
  const view = selectTenantCommercialView(snapshot);

  const purchasedCount = view.products.filter((item) => item.purchaseState === 'purchased').length;
  const explanationCount = view.products.filter(
    (item) => item.purchaseState === 'explanation_only',
  ).length;
  const lockedCount = view.products.filter((item) => item.purchaseState === 'locked').length;

  const formatValidity = (item: TenantProductView) => {
    const active = item.entitlements.find((entitlement) => entitlement.status === 'active');
    const sku = item.skus[0];
    if (active) return `${active.validFrom.slice(0, 10)} ~ ${active.validTo.slice(0, 10)}`;
    if (sku) return `${sku.validityDays} 天规格`;
    return '待配置';
  };

  const platformState = (item: TenantProductView) => {
    if (item.purchaseState === 'purchased' && item.product.demoAction === 'usable') {
      return '到店可用';
    }
    if (item.purchaseState === 'locked') return '未授权';
    return '待配置';
  };

  return (
    <section className="d1-surface d1-catalog store-product-catalog" data-testid="enterprise-product-catalog">
      <div className="d1-section-heading">
        <div>
          <Typography.Title level={4}>门店商品与获客能力</Typography.Title>
          <Typography.Text type="secondary">
            {purchasedCount} 项已购 · {explanationCount} 项说明态 · {lockedCount} 项锁定
          </Typography.Text>
        </div>
        <Tag>未接通发布平台</Tag>
      </div>

      <div className="store-product-head">
        <span>套餐/能力</span>
        <span>权益</span>
        <span>期限</span>
        <span>平台状态</span>
        <span>操作</span>
      </div>
      <div className={compact ? 'd1-product-list is-compact' : 'd1-product-list'}>
        {view.products.map((item) => {
          const { product } = item;
          const meta = purchaseStateMeta[item.purchaseState];

          return (
            <article className="d1-product-row" key={product.productId}>
              <div className="d1-product-state">
                <span className={`d1-state-dot is-${meta.dotClassName}`} />
              </div>
              <div className="d1-product-main">
                <Space size={8} wrap>
                  <Typography.Text strong>{product.displayName}</Typography.Text>
                  <Tag color={meta.color} icon={meta.icon}>
                    {meta.label}
                  </Tag>
                </Space>
                <Typography.Text type="secondary">{product.description}</Typography.Text>
                <div className="d1-product-meta">
                  <span>
                    权益{' '}
                    {item.capabilities.map((capability) => capability.displayName).join('、') ||
                      '待配置'}
                  </span>
                  <span>期限 {formatValidity(item)}</span>
                  <span>
                    状态 <strong>{platformState(item)}</strong>
                  </span>
                </div>
              </div>
              <div className="d1-product-actions">
                {item.purchaseState === 'purchased' && product.demoAction === 'usable' ? (
                  <Button
                    icon={<ArrowRightOutlined />}
                    onClick={() => navigate(ROUTES.brand(view.projectId))}
                  >
                    开始使用
                  </Button>
                ) : item.purchaseState === 'explanation_only' ? (
                  <Button onClick={() => setSelected(item)}>查看说明</Button>
                ) : (
                  <Button disabled icon={<LockOutlined />}>
                    未购买 / 待授权
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.product.displayName}
        width={520}
      >
        {selected ? (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Tag color={purchaseStateMeta[selected.purchaseState].color}>
              {purchaseStateMeta[selected.purchaseState].label}
            </Tag>
            <Typography.Paragraph>{selected.product.description}</Typography.Paragraph>
            <Descriptions
              column={1}
              size="small"
              items={[
                {
                  key: 'status',
                  label: '平台状态',
                  children: platformState(selected),
                },
                {
                  key: 'sku',
                  label: '期限',
                  children: formatValidity(selected),
                },
                {
                  key: 'capability',
                  label: '权益',
                  children:
                    selected.capabilities.map((capability) => capability.displayName).join('、') ||
                    '待配置',
                },
                {
                  key: 'entitlement',
                  label: 'Entitlement',
                  children:
                    selected.entitlements
                      .map((entitlement) => entitlement.status)
                      .join('、') || '当前企业无 Entitlement',
                },
                {
                  key: 'stage',
                  label: 'D1 动作',
                  children:
                    selected.purchaseState === 'purchased'
                      ? '已购能力可进入 canonical 企业生产路径'
                      : selected.purchaseState === 'explanation_only'
                        ? '仅产品说明，不代表当前企业已经购买或开通'
                        : '未购买 / 待授权，执行必须拒绝',
                },
              ]}
            />
            <Typography.Text type="secondary">{view.disclaimer}</Typography.Text>
          </Space>
        ) : null}
      </Drawer>
    </section>
  );
}
