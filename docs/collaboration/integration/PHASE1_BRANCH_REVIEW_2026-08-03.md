# StoryCanvas Phase1 分支集成审查

- 日期：2026-08-03
- 审查人：A
- 当前集成基线：`integration/d2-a03-b03@63cbed2`
- 待审分支：`origin/codex/storycanvas-phase1-production-loop@067a935`
- 待审基线：`origin/dev/production-plane@84d922c`
- 结论：`CONDITIONALLY_ACCEPTABLE / DO_NOT_MERGE_WHOLE_BRANCH`

## 1. 分支事实

Phase1 分支完整包含 B 正式交付分支，并在其后增加 12 个提交：

```text
5de3efd docs(storycanvas): add business and architecture audit baseline
e052bdc docs(storycanvas): plan phase1 production loop
15d810e feat(storycanvas): add phase1 shot production workbench
533b470 feat(control-plane): add phase1 production projections
2a04d94 fix(storycanvas): align phase1 frontend type contracts
f2c0022 docs(storycanvas): define phase1 production contracts
d784339 feat(storycanvas): add phase1 production runtime domain
f626dd1 feat(storycanvas): connect phase1 runtime workbench
98a1edf docs(storycanvas): record phase1 validation status
0ebc6aa docs(storycanvas): document runtime and migration
deb04af feat(storycanvas): expose phase1 delivery evidence
067a935 docs(storycanvas): finalize phase1 evidence
```

总增量：

```text
78 files changed
7597 insertions
17 deletions
```

主要实现：

- 八镜 Phase1 生产工作台；
- Shot、Task、Attempt、Asset、Selection、RoughCut、Export、Provenance；
- StoryCanvas Migration `004`；
- Runtime domain、service、adapter 和 HTTP routes；
- Mock 额度 reserve/consume/release；
- 架构、合同、迁移、测试报告与浏览器证据。

## 2. Git 冲突预演

以双方共同包含的 `84d922c` 为 merge base，对当前集成分支和 Phase1 分支执行只读 `git merge-tree` 预演。

结果：只有一个文本冲突：

```text
src/tests/app.smoke.test.tsx
```

冲突内容只是同一条“登录工作台”断言的换行格式差异，语义一致，容易人工解决。

但是，文本冲突少不代表责任边界安全。Phase1 仍包含 A 独占文件的实质修改，不能据此直接整体 merge。

## 3. P0：A 独占 Store 被跨边界修改

提交：

```text
533b470 feat(control-plane): add phase1 production projections
```

修改 A 独占文件：

```text
src/stores/controlPlaneStore.ts
```

增量约为：

```text
168 insertions
8 deletions
```

主要改动：

1. 新增 `videoagent:control-plane:phase1:v1` LocalStorage 投影；
2. Store 新增 `phase1Projection`；
3. 新增 Task、Attempt、Asset、Selection、RoughCut、Export、Credit 更新动作；
4. 在 Package dispatch/retry 中记录 Phase1 handoff；
5. 在 Receipt sync 中把 canonical receipts 投影到 Phase1；
6. 在 reset 中重置 Phase1 LocalStorage 状态。

功能方向有价值，但该变更把 Phase1 Runtime 投影和持久化直接嵌入 A 的主 Store。Phase1 自己的文档也明确承认：

- 当前投影只是根前端 LocalStorage；
- 不等同于服务端事实源；
- 不支持跨设备恢复；
- Runtime、Receipt 和旧任务/资产表仍并存；
- 尚未形成统一最终事实源。

因此该 Store 改动应由 A 单独迁移和提交，不能直接接受 B 对整文件的修改。

## 4. P0/P1：交付声明的限制

B 的测试报告对限制描述较诚实，但以下项目仍禁止被表述为正式生产闭环完成。

### 4.1 RoughCut 时长不符合合同目标

当前实测：

```text
8 * 6 秒 = 48 秒
```

合同目标：

```text
30 秒
```

当前只能声明 Mock RoughCut 记录形成，不能声明 30 秒主成片已经生成。

### 4.2 Export 不是独立合成成片

当前 Export 复用 valid 镜头资产，并没有产生独立 FFmpeg 合成资产。

因此只能声明 Export 记录/证据链形成，不能声明正式可交付主成片已经导出。

### 4.3 真实 Provider 和钱包未接入

本轮没有完成：

- 真实图片/视频模型；
- Provider polling/cancel/timeout 完整链路；
- 正式钱包 ACK；
- 正式生产账务；
- 跨设备服务端投影恢复。

### 4.4 StoryCanvas Build 依赖不可复现

B 的报告明确记录 StoryCanvas Build 需要本地 `--no-save` 补充 `mariadb`，而该处理没有进入仓库依赖声明。

因此在新的集成分支上，必须从干净环境重新验证 StoryCanvas install/build，不能直接沿用 B 本机的 PASS 结论。

### 4.5 B 的 Root Test 数量不适用于当前集成基线

Phase1 报告记录 Root 全量测试为：

```text
72/72 PASS
```

当前 A/B 第一轮集成基线已经是：

```text
153/153 PASS
```

这说明 Phase1 的 Root Test 结果是在未包含 A 最新控制平面成果的分支上取得，不能作为当前集成分支的最终 Gate。Phase1 迁移后必须重新运行完整测试。

## 5. 推荐拆分方式

禁止执行：

```bash
git merge origin/codex/storycanvas-phase1-production-loop
```

推荐从当前已通过 Gate 的分支建立新的 Phase1 集成分支：

```text
integration/d2-phase1-production-loop
```

按以下四组迁移。

### 组 1：StoryCanvas 审计与合同文档

候选提交：

```text
5de3efd
e052bdc
f2c0022
98a1edf
0ebc6aa
067a935
```

注意：截图数量多、体积较大。文档和证据是否全部进入长期主仓，应在 cherry-pick 前确认；不应因为“无代码冲突”而默认全部接收。

### 组 2：根前端 Phase1 Workbench

候选提交：

```text
15d810e
2a04d94
```

主要范围：

```text
src/features/storycanvas/
```

迁移后先运行 Workbench、StoryCanvas 类型和 MVP API 定向测试。

### 组 3：共享控制平面投影

来源提交：

```text
533b470
```

处理方式：使用 `cherry-pick -n` 或按文件提取，不原样提交。

可先接收并审查：

```text
src/domain/phase1Production.ts
src/domain/phase1Production.test.ts
src/components/production/ProductionControlSurface.tsx
src/components/production/ProductionControlSurface.test.tsx
src/services/storyCanvasBridge.ts
src/services/storyCanvasBridge.phase1.test.ts
```

A 单独实现并提交：

```text
src/stores/controlPlaneStore.ts
```

A 的实现必须明确：

1. Runtime 数据和根控制面 projection 的所有权；
2. LocalStorage 只用于 Demo，不作为 canonical 服务端事实；
3. Receipt sync 的幂等和去重；
4. reset 是否允许清除 Phase1 生产证据；
5. Store action 的错误传播和测试；
6. 后续服务端 projection 替换接口。

### 组 4：StoryCanvas Runtime 与 Migration

候选提交：

```text
d784339
f626dd1
deb04af
```

主要范围：

```text
apps/storycanvas/migrations/
apps/storycanvas/src/domain/storycanvas/
apps/storycanvas/src/routes/production/v0.1/
apps/storycanvas/src/services/storycanvas/
```

`deb04af` 中对 `src/tests/app.smoke.test.tsx` 的修改仅为格式变化，应保留当前集成分支版本，不必引入该 hunk。

## 6. 新 Phase1 集成 Gate

每一组形成独立提交，不把 7597 行一次性带入。最终至少执行：

### Root

```bash
npm test -- --maxWorkers=1 --no-file-parallelism
npm run build
npm run validate:governance
git diff --check
```

### StoryCanvas

```bash
npm --prefix apps/storycanvas run test
npm --prefix apps/storycanvas run build
```

另外必须验证：

1. Migration `004` 的 up、重复 up、down、再次 up；
2. Package duplicate 不创建第二套 Shot；
3. Grant 错误原因不会被覆盖；
4. failed/cancelled 不消费额度并完整释放冻结；
5. valid playable Asset 才能进入 succeeded；
6. Root 当前 153 个测试不回退；
7. 浏览器主链和两个目标视口；
8. 当前 48 秒 RoughCut 和非独立 Export 必须继续标记为限制。

## 7. 最终审查结论

Phase1 分支不是废弃成果，代码、Runtime、迁移和证据具有继续集成价值；但它目前是一个“大而耦合的后续实验/交付分支”，不是可以直接进入当前集成分支的干净 B 正式分支。

最终决定：

```text
第一轮 B 正式分支：已接收并通过自动化 Gate
Phase1 整体分支：拒绝直接 merge
Phase1 分拆迁移：允许进入下一轮
controlPlaneStore.ts：必须由 A 审核并形成 A 独立提交
```
