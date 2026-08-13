import { StoryCanvasEditor, makeEditorBootstrapState } from "./StoryCanvasApp";
import { useMemo } from "react";

const isDevelopmentOrTest =
  import.meta.env.DEV ||
  import.meta.env.MODE === "test";

/**
 * 开发/测试专用直接编辑器入口，不经过生产入口和 Router。
 */
export function StoryCanvasEditorHarness({ api, bootstrap }) {
  if (!isDevelopmentOrTest) return null;
  const editorBootstrap = useMemo(() => makeEditorBootstrapState(bootstrap), [bootstrap]);
  return (
    <section data-testid="storycanvas-editor-harness">
      <StoryCanvasEditor api={api} bootstrap={editorBootstrap} />
    </section>
  );
}

export const __STORYCANVAS_CAN_RENDER_EDITOR_HARNESS__ = isDevelopmentOrTest;
