# 给负责人 B：D2 生产平面进度对齐与集成阻塞解除请求

> 请求编号：`D2-AB-UNBLOCK-001`  
> 日期：2026-08-02  
> 发起人：负责人 A（控制平面）  
> 接收人：负责人 B（媒体生产平面）  
> 状态：`BLOCKING / WAITING_FOR_B_BRANCH`  
> 目标：解除当前 Build、分支和交接阻塞，先形成可供 A 审查与集成的 `dev/production-plane`

## 0. 可直接发给 B 的简版说明

A 侧 `dev/control-plane` 已完成 A-01、A-02、A-03，并已推送到远端，当前头提交为 `ac9a959`，状态是 `READY_FOR_INTEGRATION`。目前 A 无法进入 D2 集成阶段，主要原因是还没有收到干净的 `dev/production-plane`，并且当前 `main` 上仍有 B 侧 StoryCanvas Grant 类型错误和全仓 Gate 基线缺口。

请 B 先从最新 `origin/main` 建立并推送 `dev/production-plane`。如果现有成果在 `codex/archive-legacy-white-workbench-20260730`，请只迁移 B 负责范围，不要整体合并该归档分支；它与 `main` 已明显分叉，而且夹带 Auth、Brand、Dashboard、Router、Layout、Design 等 A/共享改动。

第一版分支至少需要完成：

1. 修复 `IntegratedStoryCanvasPage.tsx:76` 的 Grant prop TypeScript 错误；
2. 处理或单独提交根 `vite.config.ts` 的 Node 类型问题；
3. 明确 B-01～B-05 当前完成度和未完成项；
4. 提供提交清单、共享文件清单、测试结果和已知风险；
5. 推送 `origin/dev/production-plane`，把分支头提交发给 A。

A 收到后不会把 B 直接合进 `dev/control-plane`，而会从最新 `main` 创建短期 `integration/d2-a03-b03`，按 A → B 顺序合并并执行完整 Gate。

---

## 1. A 当前已完成状态

### 分支与提交

- A 开发分支：`dev/control-plane`
- D2 共同基线：`f48c210`
- A 当前头提交：`ac9a959 docs(control-plane): record A-03 closure evidence`
- 远端状态：`dev/control-plane == origin/dev/control-plane`
- 工作区状态：clean

### 已完成范围

- A-01：Mock 会话、过期/损坏清理、身份切换和安全站内回跳；
- A-02：四身份权限矩阵、canonical Route/Scope Guard、菜单过滤、双工作台与品牌只读；
- A-03：平台、渠道、企业商业视图、Entitlement 产品语义和 Receipt 元数据摘要；
- 四身份、直接 URL 越权和 App Smoke 定向回归；
- 1440×900 与 1280 宽关键页面视觉检查；
- A 未修改 B 独占生产目录。

### A 当前结论

`dev/control-plane` 已经可以交付集成，但这只代表 A 侧 `READY_FOR_INTEGRATION`，不代表 D2 全仓 Gate 已通过。

---

## 2. 当前观察到的 B 分支情况

本地缓存的远端引用中，目前只看到：

```text
origin/codex/archive-legacy-white-workbench-20260730
```

没有看到：

```text
origin/dev/production-plane
```

该 `codex/*` 分支是旧版纯白工作台归档分支，包含 C4 脚本、C5 分镜和 C6 初剪 UI，但存在以下问题：

- 与当前 `main` 已明显分叉；
- 早于当前 StoryCanvas 单前端/monorepo 集成基线；
- 夹带 A 独占的 Auth、Brand、Brief、Dashboard、Workbench 改动；
- 夹带 Router、Layout、Global CSS、Design Token 等共享文件改动；
- 相对当前任务书，没有看到 `src/pages/production/`、`src/features/storycanvas/`、`src/services/storyCanvasBridge.ts` 或 `apps/storycanvas/src/` 的新交接实现。

因此该分支不能作为 B 当前正式交付分支整体合并。

> 说明：此前刷新远端引用时 `git fetch origin --prune` 长时间无输出而中止；请 B 同时确认远端是否已有 A 本地尚未获取到的新生产分支。

---

## 3. 当前阻塞 A 的问题

## P0-1：缺少正式、可审查的 B 开发分支

A 目前没有可用于集成的 `origin/dev/production-plane`，因此无法：

- 审查 B 实际完成了 B-01～B-05 中的哪些内容；
- 确认 B 是否修改了 A 独占目录或共享文件；
- 创建短期集成分支；
- 复跑 D2 全仓 Test/Lint/Build/Governance；
- 验证 A 的权限工作台和 B 的生产主链是否兼容。

### B 需要处理

1. 从最新 `origin/main` 创建或同步：

   ```bash
   git switch main
   git pull --ff-only origin main
   git switch -c dev/production-plane
   ```

   如果本地已有同名分支，则同步 `main`，不要重建覆盖成果。

2. 如果成果位于旧 `codex/*` 分支，只选择性迁移 B 负责范围；禁止整体 merge 归档分支。
3. 推送：

   ```bash
   git push -u origin dev/production-plane
   ```

4. 把最终分支头、提交清单和与 `main` 的差异统计发给 A。

---

## P0-2：B 侧 StoryCanvas Grant 类型边界导致全仓 Build 失败

2026-08-02 复跑：

```bash
npx tsc -b --pretty false
```

当前错误之一为：

```text
src/pages/production/IntegratedStoryCanvasPage.tsx(76,23):
TS2322: Type 'DemoProjectGrant' is not assignable to type 'null | undefined'.
```

对应调用：

```tsx
<StoryCanvasApp grant={grant} />
```

当前 `StoryCanvasApp` 位于 JSX 文件中，TypeScript 推断的 `grant` prop 只接受 `null | undefined`，与控制平面签发的 `DemoProjectGrant` 不兼容。

### B 需要处理

- 为内嵌 StoryCanvas 建立明确、可检查的 Grant prop 类型边界；
- 可以使用 TSX 类型、JSDoc 类型或等价的受控声明，但不能用无约束 `any` 隐藏合同问题；
- 必须继续验证 `projectId`、`packageId`、scope 和有效期；
- Grant 只保存在内存中，禁止写入 URL、LocalStorage、sessionStorage 或日志；
- 正确项目/package/grant 可进入画布，错误项目或 scope mismatch 必须 fail closed；
- 增加对应成功、错误项目、错误 package/scope 和无 Grant 测试。

### 验收

```bash
npx tsc -b --pretty false
npm run build
```

不得再出现 `IntegratedStoryCanvasPage.tsx:76` Grant prop 错误。

---

## P0-3：根 Vite Node 类型声明阻塞 Build，必须隔离处理

同一轮 TypeScript 检查还存在：

```text
vite.config.ts(3,18): TS2307 Cannot find module 'node:path'
vite.config.ts(9,25): TS2304 Cannot find name '__dirname'
```

`vite.config.ts` 是共享集成面，不应夹带在生产页面功能提交中。

### B 需要处理

二选一：

1. 在 B 分支准备一个**独立共享修复提交**，例如：

   ```text
   fix(build): restore vite node typings
   ```

   并在交接中明确列为“请求 A 审查的共享文件修改”；

2. 如果 B 不修改共享文件，则提供最小补丁和验证结果，由 A 在集成分支应用。

无论采用哪种方式，最终集成分支上的 `npm run build` 必须通过。

---

## P0-4：B-01～B-05 的真实进度尚不明确

旧归档分支中主要能看到脚本、分镜和初剪 UI，尚不能证明当前任务书中的生产交接闭环已经完成。

请 B 按以下表格逐项回复，不要只写“已完成”：

| 任务                        | 请填写状态                                 | 必须给出的证据                                                               |
| --------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- |
| B-01 基线接管               | NOT_STARTED / IN_PROGRESS / DONE / BLOCKED | 生产账号黄金路径、P0/P1/P2 问题清单                                          |
| B-02 生产工作台视觉收口     | 同上                                       | 1440×900 截图、成功/失败任务讲解路径                                         |
| B-03 StoryCanvas 交接可靠性 | 同上                                       | package/grant/deep-link、offline/rejected/scope mismatch、Grant 不持久化测试 |
| B-04 任务、资产与回执闭环   | 同上                                       | consumed/released、receipt 轮询/投递/ack/幂等、错误项目拒绝                  |
| B-05 测试与交接             | 同上                                       | Test/Lint/Build/Governance、修改文件、已知风险                               |

如果某项未完成，可以先推阶段性 `dev/production-plane`，但必须明确未完成项，不能把旧 C4/C5/C6 UI 描述成当前 B-03/B-04 已完成。

---

## P1-1：全量测试目前不是稳定 PASS

A-03 收口基线为：

```text
132/141 PASS
9 项并发超时失败
1 个环境卸载后的 MutationObserver 异常
```

失败文件单独运行时可以通过，说明当前更像全量并发资源/超时或清理问题，但尚不能把完整 Test Gate 标记为通过。

### B 需要处理

- 先确保 B 修改涉及的 production、StoryCanvas、rough-cut 等定向测试稳定通过；
- 至少执行一次全量 `npm run test` 并记录完整结果；
- 如果仍有超时，列出失败文件、单文件复跑结果和是否与 B 改动相关；
- 不要通过盲目增大全局超时掩盖未清理的 timer、observer、网络 mock 或组件卸载问题。

A 会在短期集成分支继续处理跨域并发和全仓稳定性，但需要 B 先清除其修改引入的测试泄漏。

---

## P1-2：StoryCanvas 存量 Lint 问题需要明确处理边界

A-03 收口时全量 Lint 基线为：

```text
702 problems（697 errors、5 warnings）
```

主要位于 `apps/storycanvas/src/` 等 StoryCanvas 存量代码。

### B 需要处理

- 给出 B 修改前后的 Lint 数量对比；
- B 本次修改的文件不得新增 Lint 错误；
- 对 B 所有权范围执行定向 ESLint；
- 如果要调整 ESLint 配置或排除规则，必须作为独立共享提交并说明理由；
- 不得直接把整个 StoryCanvas 目录排除来制造“假 PASS”。

如果全量存量问题无法在第一版一次清零，需提供明确的分批修复计划和剩余文件清单；A 会据此判断第一轮集成是 `PASS`、`PASS_WITH_BASELINE` 还是继续阻塞。

---

## 4. B 第一版 `dev/production-plane` 的最低交付标准

第一版不要求把所有媒体生产体验一次做到最终视觉，但必须满足以下条件，A 才能开始集成：

- [ ] 分支基于或已同步最新 `origin/main`；
- [ ] 已推送 `origin/dev/production-plane`；
- [ ] 不包含 A 独占目录改动；
- [ ] 旧 `codex/*` 归档分支没有被整体合入；
- [ ] `IntegratedStoryCanvasPage` Grant prop 类型错误已修复；
- [ ] 根 Vite Node 类型问题已有独立修复提交或可应用补丁；
- [ ] B-01～B-05 状态已经逐项填写；
- [ ] production/StoryCanvas 定向测试通过；
- [ ] `npm run build` 通过，或只剩已经双方确认、且不由 B 引入的共享阻塞；
- [ ] `npm run validate:governance` 通过；
- [ ] `git diff --check` 通过；
- [ ] 工作区 clean；
- [ ] 已提供提交清单、修改文件清单、共享文件清单、演示步骤和已知风险。

---

## 5. 提交拆分要求

建议按下面顺序提交，禁止把全部内容压成一个大 commit：

```text
fix(storycanvas): restore typed embedded grant boundary
feat(production): close package and handoff states
feat(production): close task asset and receipt flow
test(production): cover grant handoff and receipt failures
fix(build): restore vite node typings              # 共享文件，单独提交
docs(production): hand off D2 production plane
```

如果只做第一阶段，则至少保持“Grant 类型修复”“生产功能”“测试”“共享文件”“文档”相互独立。

---

## 6. 允许修改与禁止修改

### B 允许修改

- `src/pages/script-editor/`
- `src/pages/storyboard/`
- `src/pages/rough-cut/`
- `src/pages/production/`
- `src/components/production/`
- `src/features/storycanvas/`
- `src/services/storyCanvasBridge.ts`
- 对应测试
- `apps/storycanvas/src/` 中媒体生产 API 与引擎模块

### B 禁止修改

- `src/pages/auth/`
- `src/pages/brand-brain/`
- `src/components/brand/`
- `src/domain/demoIdentity.ts`
- `src/domain/creditLedger.ts`
- 渠道层级、套餐、客户价格和分佣规则
- 海底捞 C1—C8 事实、禁用词和引用规则

### 共享文件

以下文件如必须修改，要先说明理由并放在独立 commit：

- `src/app/Router.tsx`
- `src/layouts/`
- `src/design/global.css`
- `src/design/tokens.ts`
- `src/domain/constants.ts`
- `src/stores/projectStore.ts`
- `vite.config.ts`
- `tsconfig*.json`
- `docs/program/contracts/`
- `docs/program/INTEGRATION_CONTRACT.md`

---

## 7. B 回传模板

请直接复制下面内容填写：

```text
分支：dev/production-plane
分支头：<commit hash>
基线 main：<commit hash>
远端已推送：是 / 否
工作区 clean：是 / 否

B-01：NOT_STARTED / IN_PROGRESS / DONE / BLOCKED
B-02：NOT_STARTED / IN_PROGRESS / DONE / BLOCKED
B-03：NOT_STARTED / IN_PROGRESS / DONE / BLOCKED
B-04：NOT_STARTED / IN_PROGRESS / DONE / BLOCKED
B-05：NOT_STARTED / IN_PROGRESS / DONE / BLOCKED

本轮提交：
- <hash> <subject>

B 独占文件：
- ...

共享文件：
- ...
- 修改原因：...

验证：
- npx tsc -b --pretty false：PASS / FAIL
- npm run build：PASS / FAIL
- npm run test：PASS / FAIL，结果 ...
- B 定向测试：PASS / FAIL，结果 ...
- B 定向 lint：PASS / FAIL，结果 ...
- npm run lint：PASS / FAIL，剩余 ...
- npm run validate:governance：PASS / FAIL
- git diff --check：PASS / FAIL

演示步骤：
1. ...

已知风险：
- ...

需要 A 决策/合并的共享请求：
- ...
```

---

## 8. A 收到分支后的动作

B 分支满足最低交付标准后，A 将：

1. 刷新并审查 `origin/dev/production-plane`；
2. 核对 B 是否越过文件所有权边界；
3. 从最新 `main` 创建短期 `integration/d2-a03-b03`；
4. 先合并 `dev/control-plane`，再合并 `dev/production-plane`；
5. 对 Router、Layout、Design、Contracts、Store 和 Build 配置逐段解决冲突；
6. 执行完整 Test/Lint/Build/Governance；
7. 回归四身份、直接 URL 越权、D1 生产主链和 1440×900/1280×800；
8. Gate 通过后再从集成分支向 `main` 提交 PR。

在此之前，不会把 B 分支直接合入 A 分支，也不会用归档分支覆盖当前成果。
