# D2 A-04 控制平面生产交付投影与证据闭环计划

> Owner：A（SaaS 控制平面 / 公共合同 / 最终集成）
> 日期：2026-08-03
> 状态：`A04_2_RELIABILITY_READY`
> 分支：`dev/control-plane`
> 基线：`main@8594e21`
> 正式上游：当前仓库 `main` 与双方确认后的正式 `dev/*` 交付分支；`origin/codex/*` 仅为临时工作分支，不作为需求或集成来源

## 1. 目标

在不扩张真实认证、正式钱包、真实 Provider 或服务端事实源的前提下，基于当前 v0.1 canonical Package / Grant / Receipt / Credit 合同，补齐 A 所有的控制平面生产交付只读投影、运行状态解释和可靠性测试。

A-04 要让企业控制平面能够回答：

1. 当前项目是否已经形成合法生产包和 Grant；
2. 发包、重试、回执同步处于什么状态；
3. 每个 canonical 任务最终成功、失败或取消，是否形成 Asset / Export 证据；
4. 对应额度处于 reserved、consumed 或 released 的哪一阶段；
5. 最近失败是否可重试，以及 reset 后是否真正回到 `DEMO_READY`；
6. 上述信息是否在 Tenant / Project 范围内安全投影，没有泄漏生产正文、Provider 内部信息或跨租户数据。

本阶段仍是前端 + Mock 内部 Demo。任何 UI 和文档都不得把 LocalStorage、Mock Grant、Demo Receipt 或前端额度状态描述为生产级服务端事实。

## 2. A-04.0 基线审计

### 2.1 已有能力

当前 `ControlPlaneDemoState` 已包含：

- 单一 canonical `ProjectProductionPackage`；
- `DemoProjectGrant[]`；
- `GenerationTaskReceipt[]`、`AssetReceipt[]`、`ExportReceipt[]`；
- StoryCanvas transport 状态；
- Wallet、CreditLedger、CreditReservation 与成功/失败额度场景；
- Package → Task → Asset / Export → Credit 的来源链查询。

当前 `useControlPlaneStore` 已包含：

- `dispatchCanonicalPackage()`；
- `retryCanonicalPackage()`；
- `syncStoryCanvasReceipts()`；
- `lastPackageDispatch`、`lastReceiptSync`、`bootstrapResult`、`handoffState`；
- 原子 Demo reset 的 Store 接线。

当前 Bridge 已实现：

- receipt envelope 的 tenant/project/package/digest/task 校验；
- Task → Asset → Export 顺序；
- preflight → ACK → apply 的基本时序；
- ACK 失败时跳过本地 apply；
- duplicate/rejected/ack_error 的 item 结果。

当前 Adapter 已实现：

- 控制平面命令幂等；
- Receipt replay；
- 冲突终态拒绝；
- Asset checksum 冲突拒绝；
- 成功任务在可交付 Asset 到达后 consume + release remainder；
- 失败/取消任务 release；
- checkpoint / rollback / `DEMO_READY` 重建。

### 2.2 已确认缺口

1. `selectTenantCommercialView` 只返回三类 Receipt 数量与状态计数，没有 Package、Grant、transport、sync、额度时序和可恢复动作的项目级交付投影。
2. Dashboard 只订阅 `snapshot`；Store 已保存的 `lastPackageDispatch`、`lastReceiptSync`、`bootstrapResult`、`handoffState` 和控制平面错误没有进入企业交付状态展示。
3. `selectOperationsSummary` 当前按 Receipt 记录条数统计。若同一任务以后包含 queued/running/succeeded 多条合法记录，会把事件数量误写成任务数量；而且 Tenant 视图只按 tenant 过滤，未显式按 project 归并。
4. 渠道 `creditUsage` 来源是固定 `creditScenarios`，不是运行时 Ledger。A-04 的项目交付额度解释必须读取当前 reservation / ledger 派生结果，不能复用静态场景总数冒充实时状态。
5. 核心 `controlPlaneMockAdapter`、`storyCanvasBridge`、`resetDemoExperienceTransaction` 和 `controlPlaneStore` 缺少直接单元测试；现有覆盖主要来自 ViewModel、Dashboard 和生产页面组件。
6. `applyResetSnapshot()` 当前没有明确清除 `lastPackageDispatch`、`lastReceiptSync` 等上一次运行证据，存在 reset 后 UI 继续展示旧状态的风险。
7. item 级 `rejected` / `ack_error` 只保存在 `lastReceiptSync`；Store 顶层错误只在 transport 整体失败时设置。A UI 需要区分“传输失败”和“部分回执失败”，不能只依赖顶层 `error`。
8. `src/services/storyCanvasBridge.ts`、`src/components/production/`、`src/pages/production/` 和 `apps/storycanvas/src/` 属于 B；A 可以读取和建立边界测试，但不得直接修改其实现。发现 Bridge 合同缺口时必须形成给 B 的独立请求。

### 2.3 审计基线验证

执行：

```bash
npm test -- \
  src/domain/controlPlaneViewModels.test.ts \
  src/pages/dashboard/DashboardPage.test.tsx \
  src/components/production/ProductionControlSurface.test.tsx \
  src/pages/production/IntegratedStoryCanvasPage.test.tsx \
  --maxWorkers=1 --no-file-parallelism
```

结果：`4 files / 16 tests PASS`。

存在 Ant Design `Spin tip` 使用方式警告，但不影响本轮测试结果；A-04 不借此修改 B 的生产页面。

## 3. 文件边界

### 3.1 A 允许修改

- `src/domain/controlPlane.ts`
- `src/domain/controlPlaneViewModels.ts`
- 可新增 `src/domain/controlPlaneDeliveryView.ts` 及其测试
- `src/domain/creditLedger.ts` 及 A 范围测试
- `src/services/controlPlaneMockAdapter.ts` 及其测试
- `src/services/demoExperienceReset.ts` 及其测试
- `src/stores/controlPlaneStore.ts` 及其测试
- `src/pages/dashboard/`
- `src/components/workbench/`
- `docs/program/threads/C0/`
- A 侧协作、状态和交接文档

### 3.2 共享文件：默认不修改

- `src/app/Router.tsx`
- `src/layouts/`
- `src/design/global.css`
- `src/design/tokens.ts`
- `src/domain/constants.ts`
- `src/stores/projectStore.ts`
- `docs/program/contracts/`
- `docs/program/INTEGRATION_CONTRACT.md`

如果确有必要，必须单独提交并说明原因，不能夹带在 A 的 ViewModel、Store 或 Dashboard 功能提交中。

### 3.3 B 独占：只读

- `src/services/storyCanvasBridge.ts`
- `src/pages/production/`
- `src/components/production/`
- `src/features/storycanvas/`
- `src/pages/script-editor/`
- `src/pages/storyboard/`
- `src/pages/rough-cut/`
- `apps/storycanvas/src/`

A 不从 `origin/codex/*` 提取上述实现。B 正式变更只能通过双方约定的正式 `dev/*` 交付分支进入后续集成。

## 4. A-04 输出合同草案

A-04.1 应形成纯函数、Tenant/Project scoped 的只读投影。建议输出结构包含：

```text
TenantProjectDeliveryView
├── scope: tenantId / projectId
├── package: missing / ready / expired
├── grant: missing / active / expired / scope_mismatch
├── transport: offline / sending / accepted / duplicate / rejected / retryable
├── receiptSync: idle / clean / partial_failure / failed
├── tasks[]
│   ├── generationTaskId / shotId / terminalStatus
│   ├── assetEvidence / exportEvidence
│   └── credit: none / reserved / consumed / released
├── summary
│   ├── uniqueTaskCount / succeeded / failed / cancelled / inProgress
│   ├── deliverableAssetCount / exportCount
│   └── reserved / consumed / released credits
├── lastError（安全字段）
├── availableActions（只读动作建议）
└── disclaimer: DEMO / MOCK-CONTRACT / 非服务端事实源
```

投影禁止返回：

- Provider Key、上游请求或模型内部参数；
- `storageReference`、明文凭证、跨租户 ID 列表；
- prompt、脚本正文、品牌事实正文或素材正文；
- 价格、订单、渠道库存和结算字段；
- 原始 CreditLedger 全量记录；
- B Runtime 的内部 Attempt、队列或数据库状态。

## 5. 分步实施与提交

### A-04.1 · 项目交付只读投影

1. 先写 ViewModel 测试：唯一任务归并、Tenant/Project 过滤、敏感字段隔离、额度派生、Package/Grant 状态。
2. 实现纯函数 selector，不在 selector 内读 LocalStorage、Store 或 Bridge 单例。
3. 将 runtime transport/sync 输入作为显式参数或 A Store 安全快照传入，保持未来服务端替换能力。
4. 保留现有商业 selector 的兼容性，避免平台和渠道页面被 A-04 意外改变。

计划提交：

```text
feat(control-plane): add tenant delivery evidence projection
```

### A-04.2 · Store / Adapter 可靠性

1. 为 Adapter 补充命令幂等、Receipt duplicate、冲突终态、成功/失败额度时序测试。
2. 为 Store 补充 dispatch/retry/sync 的状态映射和部分失败解释测试；Bridge 使用 mock/stub，不修改 B 实现。
3. 为原子 reset 补充成功清理、失败 rollback 和旧运行证据清除测试。
4. 修复确认存在的 A 范围缺口；若问题位于 Bridge，记录请求交给 B，不跨边界修复。

计划提交：

```text
test(control-plane): cover delivery sync and reset invariants
```

如需要 A 范围功能修复，测试与修复应保持同一原子提交或拆为紧邻提交，并在提交说明中列出不变量。

### A-04.3 · 企业交付状态 UI

1. Dashboard 消费新的只读投影，不直接遍历原始 Receipt payload。
2. 展示项目交付阶段、唯一任务终态、Asset/Export 证据、额度解释、最近同步和安全错误。
3. 只开放现有 Store 已有且权限合法的动作；不在 UI 伪造 B 执行结果。
4. 企业管理员可见；内容运营继续遵守 A-02 对 Dashboard 的拒绝合同。
5. 完成 1440×900 与 1280×800 两档视觉检查。

计划提交：

```text
feat(control-plane): surface tenant delivery evidence
```

### A-04.4 · 回归与收口

1. A-04 selector / Store / Adapter / Dashboard 定向测试。
2. 四身份、canonical Tenant/Project 越权与 App Smoke。
3. 全量串行 Test、Build、Governance、`git diff --check`。
4. 检查 A 未修改 B 独占目录。
5. 更新 STATUS、HANDOFF、CHANGELOG、协作文档和桌面知识库。

计划提交：

```text
docs(control-plane): record A-04 closure evidence
```

## 6. 验收标准

A-04 完成必须同时满足：

- 同一 `generationTaskId` 的多条状态 Receipt 被归并为一个任务，不以事件条数冒充任务数；
- 所有交付状态同时按 canonical Tenant 和 Project 过滤；
- 成功 Task 在 deliverable Asset 前保持 reserved，Asset 后 consume 实际额度并 release remainder；
- 失败/取消 Task 释放对应 reservation；
- duplicate 不重复登记、不重复消费或释放；
- ACK 失败场景在 A Store 投影中明确为未入账；
- reset 后 Package、Grant、Receipt、transport、last dispatch/sync 和错误状态回到一致 Demo 基线；
- Dashboard 不泄漏 Receipt payload、存储引用、Provider 内部字段、商业价格或其他 Tenant 数据；
- A 未修改 B 独占实现；
- 每个切片验证后独立 commit，工作区 clean；
- 文档只声明内部 Mock Demo，不声明生产可用、真实 AI、正式钱包或服务端权威事实。

## 7. 当前依赖与阻塞

A-04.0～A-04.3 基于当前 `main@8594e21` 可以独立实施，目前无 B 阻塞。

未来 Phase1 联合集成仍需 B 提供：

- 双方确认的正式 `dev/*` 交付分支；
- 提交清单；
- 共享文件与合同变更说明；
- 定向 Test / Build 结果；
- 已知限制和演示路径。

在此之前，`integration/d2-phase1-production-loop` 保持在 `main@8594e21`，不接收 `origin/codex/*` 临时分支。

## 8. 2026-08-03 实施进度

### 8.1 A-04.1 项目交付只读投影完成

- 已新增 `selectTenantProjectDeliveryView()`，按 canonical Tenant + Project 双重范围投影 Package、Grant、transport、receipt sync、唯一任务、Asset/Export 证据和运行时额度状态。
- 已覆盖唯一 `generationTaskId` 归并、跨范围隔离、敏感字段隔离、expired/scope mismatch、部分同步失败和安全可恢复动作。
- 提交：`47e74b0 feat(control-plane): add tenant delivery evidence projection`。

### 8.2 A-04.2 Store / Adapter 可靠性完成

- Adapter 测试覆盖 Package/额度命令幂等、Receipt duplicate、冲突终态、成功/失败额度结算与三类 preflight 零副作用。
- Store 测试覆盖 dispatch/retry、部分 ACK 失败零入账、重复同步不重复结算和 transport 整体失败映射。
- Reset 测试覆盖成功清理、普通 rollback、rollback 自身失败、旧 activeOrganization 拒绝和失败时旧运行证据保留。
- 已修复成功 Reset 后 `lastPackageDispatch` / `lastReceiptSync` 残留；未修改 B 独占 Bridge 或生产页面实现。
- A-04.1 + A-04.2 联合回归：6 个 Test Files、28 个 Tests 全部通过；相关 ESLint、Prettier 与 `git diff --check` 通过。
- 提交序列：`85f4251` Adapter 测试 → `3cf56fd` Store 同步测试 → `926fa06` Reset 清理修复 → 本次边界测试与文档收口提交。

### 8.3 下一步

- A-04.2 验收条件已满足，当前无 B 阻塞。
- 下一切片进入 A-04.3：Dashboard 只消费安全 ViewModel，展示企业项目交付状态、额度解释、最近同步和可恢复动作，并保持内容运营拒绝合同。
- 页面级 Reset 成功/失败展示、1440×900 与 1280×800 视觉检查归入 A-04.3，不在可靠性层跨范围实现。
