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
import { TruthBadge } from '../workbench/TruthBadge';

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

  return (
    <section className="d1-surface d1-catalog" data-testid="enterprise-product-catalog">
      <div className="d1-section-heading">
        <div>
          <Typography.Title level={4}>企业产品与能力</Typography.Title>
          <Typography.Text type="secondary">
            {purchasedCount} 项已购 · {explanationCount} 项说明态 · {lockedCount} 项锁定
          </Typography.Text>
        </div>
        <Tag color="gold">{view.disclaimer}</Tag>
      </div>

      <div className={compact ? 'd1-product-list is-compact' : 'd1-product-list'}>
        {view.products.map((item) => {
          const { product } = item;
          const meta = purchaseStateMeta[item.purchaseState];
          const entitlementStatuses = item.entitlements.map((entitlement) => entitlement.status);
          const truthCapabilityId =
            item.purchaseState === 'purchased' && product.demoAction === 'usable'
              ? 'demo.local-life-golden-path'
              : product.code === 'product.digital_human_addon'
                ? product.capabilityIds[0]
                : null;

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
                  {truthCapabilityId ? (
                    <TruthBadge capabilityId={truthCapabilityId} compact />
                  ) : null}
                </Space>
                <Typography.Text type="secondary">{product.description}</Typography.Text>
                <div className="d1-product-meta">
                  <span>
                    {item.capabilities.map((capability) => capability.code).join('、') ||
                      'capability unavailable'}
                  </span>
                  <span>
                    Entitlement{' '}
                    {entitlementStatuses.length > 0 ? entitlementStatuses.join(' / ') : '未配置'}
                  </span>
                </div>
              </div>
              <div className="d1-product-actions">
                {item.purchaseState === 'purchased' && product.demoAction === 'usable' ? (
                  <Button
                    type="primary"
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
                  key: 'product',
                  label: 'Product',
                  children: selected.product.code,
                },
                {
                  key: 'sku',
                  label: 'SKU',
                  children: selected.skus.map((sku) => sku.displayName).join('、') || '无演示 SKU',
                },
                {
                  key: 'capability',
                  label: 'Capability',
                  children:
                    selected.capabilities.map((capability) => capability.displayName).join('、') ||
                    '无关联 Capability',
                },
                {
                  key: 'entitlement',
                  label: 'Entitlement',
                  children:
                    selected.entitlements
                      .map((entitlement) => `${entitlement.entitlementId} · ${entitlement.status}`)
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
            {selected.capabilities.map((capability) => (
              <TruthBadge key={capability.capabilityId} capabilityId={capability.capabilityId} />
            ))}
            <Typography.Text type="secondary">{view.disclaimer}</Typography.Text>
          </Space>
        ) : null}
      </Drawer>
    </section>
  );
}
