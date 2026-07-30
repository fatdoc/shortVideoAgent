import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Empty, Space, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ProductionControlSurface,
  type ProductionView,
} from '../../components/production/ProductionControlSurface';
import { TruthBadge } from '../../components/workbench/TruthBadge';
import { DEMO_PROJECT_ID } from '../../domain/constants';

interface RoughCutPageProps {
  view?: ProductionView;
}
export function RoughCutPage({ view = 'all' }: RoughCutPageProps) {
  const navigate = useNavigate();
  const { projectId } = useParams();

  if (projectId !== DEMO_PROJECT_ID) {
    return (
      <Empty
        description={`仅支持 canonical 项目 ${DEMO_PROJECT_ID}，当前为 ${projectId}`}
      >
        <Button
          type="primary"
          onClick={() => navigate(`/projects/${DEMO_PROJECT_ID}/rough-cut`)}
        >
          打开统一交付页
        </Button>
      </Empty>
    );
  }

  return (
    <div className="d1-page-stack">
      <header className="d1-page-header">
        <div>
          <Space size={8} wrap>
            <Tag color="blue">企业交付视图</Tag>
            <TruthBadge capabilityId="demo.local-life-golden-path" compact />
          </Space>
          <Typography.Title level={2}>任务、资产与交付</Typography.Title>
          <Typography.Paragraph type="secondary">
            企业只查看自身项目的回执、额度变化和来源链；导出能力按 Truth Manifest 如实标记。
          </Typography.Paragraph>
        </div>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/projects/${DEMO_PROJECT_ID}/storyboard`)}
        >
          返回分镜
        </Button>
      </header>
      <ProductionControlSurface view={view} />
    </div>
  );
}
