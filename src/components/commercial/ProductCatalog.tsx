import {
  ArrowRightOutlined,
  CheckCircleFilled,
  InfoCircleOutlined,
  LockOutlined,
} from '@ant-design/icons';
import {
  Button,
  Descriptions,
  Drawer,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Product } from '../../domain/controlPlane';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';
import { TruthBadge } from '../workbench/TruthBadge';

type CatalogAudience = 'platform' | 'channel' | 'tenant';

interface ProductCatalogProps {
  audience: CatalogAudience;
  compact?: boolean;
}

const availabilityMeta = {
  active: {
    label: '已开通',
    color: 'success',
    icon: <CheckCircleFilled />,
  },
  explanation_only: {
    label: '产品说明',
    color: 'processing',
    icon: <InfoCircleOutlined />,
  },
  locked: {
    label: '未购买 / 待授权',
    color: 'default',
    icon: <LockOutlined />,
  },
} as const;

export function ProductCatalog({
  audience,
  compact = false,
}: ProductCatalogProps) {
  const navigate = useNavigate();
  const snapshot = useControlPlaneStore((state) => state.snapshot);
  const [selected, setSelected] = useState<Product | null>(null);
  const products = snapshot.commercial.products;
  const capabilities = snapshot.commercial.capabilities;
  const skus = snapshot.commercial.skus;
  const entitlements = snapshot.commercial.entitlements;
  const rateCard = snapshot.commercial.rateCard;

  const selectedDetails = useMemo(() => {
    if (!selected) return null;
    return {
      capabilities: capabilities.filter((capability) =>
        selected.capabilityIds.includes(capability.capabilityId),
      ),
      sku: skus.find((sku) => sku.productId === selected.productId),
    };
  }, [capabilities, selected, skus]);

  const activeCount = products.filter((product) => product.availability === 'active').length;
  const explanationCount = products.filter(
    (product) => product.availability === 'explanation_only',
  ).length;
  const lockedCount = products.filter((product) => product.availability === 'locked').length;

  const actionLabel =
    audience === 'platform'
      ? '查看目录'
      : audience === 'channel'
        ? '查看可售范围'
        : '开始使用';

  return (
    <section className="d1-surface d1-catalog">
      <div className="d1-section-heading">
        <div>
          <Typography.Title level={4}>产品与能力</Typography.Title>
          <Typography.Text type="secondary">
            {activeCount} 项可用 · {explanationCount} 项说明态 · {lockedCount} 项锁定
          </Typography.Text>
        </div>
        <Tag color="gold">{snapshot.truthManifest.disclaimer}</Tag>
      </div>

      <div className={compact ? 'd1-product-list is-compact' : 'd1-product-list'}>
        {products.map((product) => {
          const meta = availabilityMeta[product.availability];
          const capability = capabilities.find(
            (item) => item.capabilityId === product.capabilityIds[0],
          );
          const entitlement = entitlements.find(
            (item) => item.capabilityId === capability?.capabilityId,
          );
          const truthCapabilityId =
            product.demoAction === 'usable'
              ? 'demo.local-life-golden-path'
              : product.code === 'product.digital_human_addon'
                ? product.capabilityIds[0]
                : null;
          return (
            <article className="d1-product-row" key={product.productId}>
              <div className="d1-product-state">
                <span className={`d1-state-dot is-${product.availability}`} />
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
                  <span>{capability?.code ?? 'capability unavailable'}</span>
                  <span>
                    Entitlement {entitlement?.status ?? product.availability}
                  </span>
                </div>
              </div>
              <div className="d1-product-actions">
                {product.demoAction === 'usable' ? (
                  <Button
                    type={audience === 'tenant' ? 'primary' : 'default'}
                    icon={<ArrowRightOutlined />}
                    onClick={() => {
                      if (audience === 'tenant') {
                        navigate('/dashboard');
                      } else {
                        setSelected(product);
                      }
                    }}
                  >
                    {actionLabel}
                  </Button>
                ) : product.demoAction === 'explain' ? (
                  <Button onClick={() => setSelected(product)}>查看说明</Button>
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

      {!compact ? (
        <div className="d1-ratecard-rail">
          <div>
            <Typography.Text type="secondary">演示 RateCard</Typography.Text>
            <Typography.Text strong>{rateCard.version}</Typography.Text>
          </div>
          <div>
            <Typography.Text type="secondary">标准动作</Typography.Text>
            <Typography.Text strong>
              {rateCard.inputBand.durationSeconds}s · {rateCard.inputBand.resolution}
            </Typography.Text>
          </div>
          <div>
            <Typography.Text type="secondary">预计额度</Typography.Text>
            <Typography.Text strong>{rateCard.estimatedCredits.value}</Typography.Text>
          </div>
          <div>
            <Typography.Text type="secondary">最多冻结</Typography.Text>
            <Typography.Text strong>{rateCard.maxReservedCredits.value}</Typography.Text>
          </div>
          <div className="d1-ratecard-disclaimer">
            <Typography.Text type="secondary">
              仅形成已登记可交付资产后结算，不承诺额度与人民币、时长或模型调用固定换算。
            </Typography.Text>
          </div>
        </div>
      ) : null}

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.displayName}
        width={520}
      >
        {selected && selectedDetails ? (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Tag color={availabilityMeta[selected.availability].color}>
              {availabilityMeta[selected.availability].label}
            </Tag>
            <Typography.Paragraph>{selected.description}</Typography.Paragraph>
            <Descriptions
              column={1}
              size="small"
              items={[
                {
                  key: 'product',
                  label: 'Product',
                  children: selected.code,
                },
                {
                  key: 'sku',
                  label: 'SKU',
                  children: selectedDetails.sku?.displayName ?? '无演示 SKU',
                },
                {
                  key: 'capability',
                  label: 'Capability',
                  children: selectedDetails.capabilities
                    .map((capability) => capability.displayName)
                    .join('、'),
                },
                {
                  key: 'stage',
                  label: 'D1 动作',
                  children:
                    selected.demoAction === 'usable'
                      ? '可进入演示黄金路径'
                      : selected.demoAction === 'explain'
                        ? '仅产品说明，不进入执行'
                        : '未购买 / 待授权，执行必须拒绝',
                },
              ]}
            />
            {selectedDetails.capabilities.map((capability) => (
              <TruthBadge
                key={capability.capabilityId}
                capabilityId={capability.capabilityId}
              />
            ))}
            <Typography.Text type="secondary">
              {snapshot.truthManifest.disclaimer}
            </Typography.Text>
          </Space>
        ) : null}
      </Drawer>
    </section>
  );
}
