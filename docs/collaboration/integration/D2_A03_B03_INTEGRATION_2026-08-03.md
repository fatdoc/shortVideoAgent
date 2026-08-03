# D2 A-03 / B-03 第一轮集成记录

- 日期：2026-08-03
- 集成负责人：A
- 集成分支：`integration/d2-a03-b03`
- 基线：`origin/main@f48c210`
- A 来源：`dev/control-plane@3b99dbf`
- B 来源：`origin/dev/production-plane@84d922c`
- 状态：第一轮代码集成与自动化 Gate 已通过；尚未推送；Phase1 后续分支尚未合入

## 1. 集成范围

本轮只集成双方正式交付分支：

1. A 控制平面：`dev/control-plane`
2. B 生产平面：`origin/dev/production-plane`

明确不包含：

- `origin/codex/storycanvas-phase1-production-loop`
- 该 Phase1 分支中的 `feat(control-plane): add phase1 production projections`（`533b470`）
- 对 A 独占文件 `src/stores/controlPlaneStore.ts` 的 Phase1 改动

## 2. Git 集成结果

从 `origin/main@f48c210` 创建：

```text
integration/d2-a03-b03
```

A 合并提交：

```text
f50bced merge: integrate A control plane
```

B 合并提交：

```text
c76a7ed merge: integrate B production plane
```

两个分支均由 Git `ort` 策略无冲突合入，没有人工覆盖文件。

构建依赖修复提交：

```text
f8962cf build: add Node types for Vite config
```

修复内容：补充开发依赖 `@types/node`，使 `vite.config.ts` 中的 `node:path` 和 `__dirname` 能通过 `tsc -b`。

## 3. 验证结果

### 3.1 A/B 交界定向测试

命令覆盖：

- `src/tests/app.smoke.test.tsx`
- `src/components/production/ProductionControlSurface.test.tsx`
- `src/pages/production/IntegratedStoryCanvasPage.test.tsx`
- `src/features/storycanvas/StoryCanvasApp.types.test.ts`
- `src/domain/controlPlaneViewModels.test.ts`
- `src/domain/demoRouteAccess.test.ts`

结果：

```text
6 files passed
59 tests passed
```

### 3.2 全量测试

默认并发运行曾出现测试环境变慢：8 个失败中 7 个为 5–10 秒超时，失败文件单独复跑均通过。随后使用单 worker 串行复核：

```bash
npm test -- --maxWorkers=1 --no-file-parallelism
```

最终结果：

```text
21 files passed
153 tests passed
```

结论：未发现 A/B 合并导致的测试回归；默认并发超时属于当前测试性能/稳定性问题，后续可单列优化。

### 3.3 Build / TypeScript

```bash
npm run build
```

结果：PASS。

非阻塞警告：主 JS chunk 约 1.75 MB，超过 Vite 500 kB 提示阈值；不影响本轮 Gate，但后续应评估路由级动态加载和 manual chunks。

### 3.4 Governance

```bash
npm run validate:governance
```

结果：PASS。

### 3.5 Git 差异检查

```bash
git diff --check
```

结果：PASS。

## 4. 已知非阻塞项

1. 全量测试默认并发模式在当前机器上可能触发 UI 测试超时；串行模式稳定通过。
2. 部分 Ant Design 测试会输出 `Spin tip` 警告，不影响断言。
3. 构建存在大 chunk 警告，当前主 JS 产物约 1.75 MB。
4. 本轮未进行浏览器尺寸与人工主流程验收。
5. 本轮集成分支尚未推送远端。

## 5. Phase1 隔离结论

`origin/codex/storycanvas-phase1-production-loop@067a935` 建立在 B 正式分支之后，额外包含 12 个提交。该分支修改了 A 独占文件：

```text
src/stores/controlPlaneStore.ts
```

因此 Phase1 分支不得直接整体 merge。后续应：

1. 单独审查 12 个提交；
2. 重点审查 `533b470`；
3. 将控制平面投影需求拆成 A 可审核的最小变更；
4. 禁止整文件覆盖 A 当前的 `controlPlaneStore.ts`；
5. 在新的独立提交中完成迁移、测试和验证。

## 6. 下一 Gate

第一轮集成记录提交后：

1. 检查工作区和提交图；
2. 根据协作约定决定是否推送 `integration/d2-a03-b03`；
3. 启动项目，完成浏览器人工主流程验证；
4. 再进入 Phase1 独立审查，不直接合并 Phase1 分支。
