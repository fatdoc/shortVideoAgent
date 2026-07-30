import { Tag, Typography } from 'antd';
import { ProductCatalog } from '../../components/commercial/ProductCatalog';

interface ProductCatalogPageProps {
  audience: 'platform' | 'channel' | 'tenant';
}

const copy = {
  platform: {
    eyebrow: '平台目录',
    title: '产品、Capability 与演示 RateCard',
    description: '配置 D1 可售范围；所有数字均为演示数据，不构成正式报价。',
  },
  channel: {
    eyebrow: '渠道可售范围',
    title: '采购与可售产品',
    description: '当前渠道只看自己的产品范围，不显示平台上游成本。',
  },
  tenant: {
    eyebrow: '企业已购能力',
    title: '我的产品与能力',
    description: '已购、说明态和未购买能力分别呈现，不用假按钮代替授权。',
  },
} as const;

export function ProductCatalogPage({ audience }: ProductCatalogPageProps) {
  const page = copy[audience];
  return (
    <div className="d1-page-stack">
      <header className="d1-page-header">
        <div>
          <Tag color="blue">{page.eyebrow}</Tag>
          <Typography.Title level={2}>{page.title}</Typography.Title>
          <Typography.Paragraph type="secondary">
            {page.description}
          </Typography.Paragraph>
        </div>
      </header>
      <ProductCatalog audience={audience} />
    </div>
  );
}

