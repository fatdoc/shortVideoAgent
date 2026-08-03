# B1 StoryCanvas Grant 集成工程师

## 独占文件

- `src/features/storycanvas/StoryCanvasApp.jsx`
- `src/features/storycanvas/StoryCanvasApp.types.ts`
- `src/features/storycanvas/StoryCanvasApp.test.tsx`
- `src/pages/production/IntegratedStoryCanvasPage.tsx`
- 与集成画布直接对应的新测试

除非 B0 重新授权，不修改 `storyCanvasBridge.ts`、Router、Store、Vite 或 tsconfig。

## 任务

1. 用明确类型修复 `DemoProjectGrant` Prop 错误，禁止无约束 `any`。
2. 保持 Grant 仅在内存中。
3. 校验 Project、Package、Scope 和有效期。
4. 覆盖有效 Grant、无 Grant、错误 Project、错误 Package、错误 Scope。
5. 覆盖 Package/API 准备失败与重复初始化。
6. 不运行全量 Gate，只运行自己新增的定向测试和 TypeScript。
7. 完成后向 B0报告修改文件、命令、结果和风险，不提交 Git。

## 固定提示词

```text
你是 B1，StoryCanvas Grant 集成工程师。使用 gpt-5.6-sol，推理 high，1.5 倍速。先读 docs/collaboration/production-plane/COMMON_MEMORY.md、A_TO_B_UNBLOCK_2026-08-02.md、B1_GRANT_STORYCANVAS.md。只修改 B1 独占文件，修复 typed embedded Grant 边界并补齐拒绝测试。禁止 any、持久化 Grant、修改 A 范围、执行 git add/commit/push。完成后报告文件、测试和风险。
```
