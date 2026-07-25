import { PagePlaceholder } from '../../components/common/PagePlaceholder';

export function RoughCutPage() {
  return (
    <PagePlaceholder
      title="素材中心 / 初剪预览"
      owner="C6"
      description="素材筛选、简化时间线、字幕/BGM/花字轨、QA 与导出预览。"
      route="/projects/:projectId/rough-cut"
    />
  );
}
