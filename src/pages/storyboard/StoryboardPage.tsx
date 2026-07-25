import { PagePlaceholder } from '../../components/common/PagePlaceholder';

export function StoryboardPage() {
  return (
    <PagePlaceholder
      title="分镜 / 拍摄清单"
      owner="C5"
      description="将脚本转成分镜卡片、拍摄任务、素材匹配状态与拖拽排序。"
      route="/projects/:projectId/storyboard"
    />
  );
}
