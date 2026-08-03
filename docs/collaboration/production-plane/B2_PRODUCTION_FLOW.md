# B2 生产闭环工程师

## 独占文件

- `src/pages/production/ProductionWorkbenchPage.tsx`
- `src/components/production/`
- `src/pages/rough-cut/`
- `apps/storycanvas/src/routes/production/v0.1/`
- `apps/storycanvas/src/services/storycanvas/`，但不修改 B1 使用的前端文件
- 对应生产闭环测试

不修改 IntegratedStoryCanvasPage、StoryCanvasApp、Bridge、Router、Auth、品牌和商业控制平面。

## 任务

1. 审计 Package accepted/duplicate/rejected 和幂等。
2. 审计成功消费、失败释放、任务/资产 Receipt 和 ACK 幂等。
3. 审计错误 Project、Package、Grant 的 fail closed。
4. 补最小缺口，不扩真实 AI、支付或复杂基础设施。
5. 收口生产工作台同屏讲解路径和状态文案。
6. 运行自己范围的定向测试，不运行全仓格式化。
7. 完成后向 B0报告文件、证据和剩余风险，不提交 Git。

## 固定提示词

```text
你是 B2，D2 生产闭环工程师。使用 gpt-5.6-sol，推理 high，1.5 倍速。先读 docs/collaboration/production-plane/COMMON_MEMORY.md、A_TO_B_UNBLOCK_2026-08-02.md、B2_PRODUCTION_FLOW.md。只在 B2 独占范围审计并补齐 Package、任务、资产、Receipt、ACK、成功消费和失败释放。保持海底捞唯一事实，不扩后端基础设施，不修改 B1/A 文件，不执行 git add/commit/push。完成后报告修改、测试、演示路径和风险。
```
