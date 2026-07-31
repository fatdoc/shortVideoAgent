import { Tag, Typography } from 'antd';
import { ProductCatalog } from '../../components/commercial/ProductCatalog';

export function ProductCatalogPage() {
  return (
    <div className="d1-page-stack">
      <header className="d1-page-header">
        <div>
          <Tag color="blue">企业已购能力</Tag>
          <Typography.Title level={2}>我的产品与能力</Typography.Title>
          <Typography.Paragraph type="secondary">
            已购 Entitlement、说明态和锁定态分别呈现；平台目录不等于企业已购产品。
          </Typography.Paragraph>
        </div>
      </header>
      <ProductCatalog />
    </div>
  );
}
