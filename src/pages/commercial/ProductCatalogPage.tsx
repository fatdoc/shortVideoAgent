import { Tag, Typography } from 'antd';
import { ProductCatalog } from '../../components/commercial/ProductCatalog';

export function ProductCatalogPage() {
  return (
    <div className="d1-page-stack product-catalog-page">
      <header className="d1-page-header">
        <div>
          <Tag>门店经营</Tag>
          <Typography.Title level={2}>商品套餐</Typography.Title>
          <Typography.Paragraph type="secondary">
            已购权益、期限和平台状态分别呈现；未接通发布平台时只显示待配置。
          </Typography.Paragraph>
        </div>
      </header>
      <ProductCatalog />
    </div>
  );
}
