import { PagePlaceholder } from '../../components/common/PagePlaceholder';

export function ScriptEditorPage() {
  return (
    <PagePlaceholder
      title="脚本生成与编辑"
      owner="C4"
      description="生成 A/B/C 脚本版本，支持 Hook/Body/Proof/CTA 编辑与事实引用。"
      route="/projects/:projectId/script"
    />
  );
}
