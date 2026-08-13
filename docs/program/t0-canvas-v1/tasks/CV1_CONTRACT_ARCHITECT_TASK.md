# CV1 · 合同架构师任务书

> 员工：`CV1`
> 任务 ID：`T0-CV1-01`
> 前置：`G0 ACCEPTED`
> 目标 Gate：`G1 Contract`
> 初始状态：`NOT_STARTED`

## 1. 任务目标

冻结 Canvas V1 聚合合同，使 Control Plane、StoryCanvas、Canvas UI 和 Agent 对 ID、状态、错误、资产权利、命令和安全投影只有一种解释。

## 2. 输入合同

必须先审计并保留：

```text
ProjectProductionPackage/0.3
ProjectGrant/0.2
CanvasEntryRedemption/0.1
Pilot Production Contract/0.2
```
不得通过整体升级版本掩盖现有差异。

## 3. 独占写集

```text
docs/program/contracts/canvas-v1/**
apps/storycanvas/src/contracts/canvas-v1/**        # 经 CV0 确认后
src/features/canvas-v1/model/contracts.ts         # 只由 CV1 创建/修改
src/features/canvas-v1/model/contracts.test.ts    # 只由 CV1 创建/修改
```

如果跨两个 TypeScript 工程无法直接共享 runtime parser，以 JSON Schema + canonical fixtures 为事实源，并在两端建立 conformance test。不要为首日引入大型 monorepo/package 重构。

## 4. 必须冻结的合同

```text
CanvasBootstrap/0.1
CanvasDocument/0.1
AssetRecord/0.1
ProviderAssetBinding/0.1
EntityBinding/0.1
ShotAssetRequirement/0.1
ShotReadiness/0.1
CanvasCommand/0.1
CanvasEvent/0.1
```

每个合同必须包含：

- `objectType`、`contractVersion`；
- tenant/project/package/session binding；
- stable ID 与时间戳格式；
- 严格字段和未知字段拒绝；
- status/state transition；
- error code；
- idempotency/replay 行为；
- browser-safe 与 server-only 分类；
- provenance/rights/review 信息；
- forbidden secret markers。

## 5. 关键语义

### 权威归属

```text
Control Plane:
tenant/project、批准事实、业务资产、权利、审核、使用量

StoryCanvas:
Provider binding、技术媒体、连续性、任务、输出、导出

Browser:
安全投影、非秘密业务 ID、状态、受控预览 URL
```

### 生成门禁

`ShotReadiness.ready=true` 只能在以下全部成立时出现：

- rights authorized；
- business approval approved；
- Provider binding active；
- Entity binding approved；
- exact tenant/project/package/session match；
- capability available；
- approved script/storyboard still current。

### 命令

首日只冻结：

```text
ANALYZE_ASSET_REQUIREMENTS
CREATE_VIRTUAL_CHARACTER
SYNC_PROVIDER_ASSET
BIND_ASSET_TO_ENTITY
GENERATE_SHOT
SELECT_SHOT_OUTPUT
SAVE_CANVAS_DOCUMENT
EXPORT_PLAYLIST                # optional capability
```

高成本命令必须有 `userConfirmed=true` 或等价的可验证批准事实，不能由 Agent 自行猜测。

## 6. RED/Fixture

必须先创建：

- 每个对象一个 canonical success fixture；
- malformed/unknown field negative vectors；
- tenant/project/package/session mismatch；
- rights pending/revoked/expired；
- Provider processing/rejected；
- changed-payload idempotency conflict；
- secret-bearing payload rejection；
- browser projection 不包含内部 URI/Token/Grant/Digest。

## 7. 禁止项

- 不实现 Provider、UI、Router 或业务数据库；
- 不修改已有历史合同语义；
- 不把 `asset://` 暴露给浏览器；
- 不允许 `DemoProjectGrant`、Mock、Storage fallback；
- 不修改 Shared RED；
- 不触碰 `byteplus.ts`。

## 8. 原子提交

```text
CV1-A docs/contracts: inventory canvas contract authorities
CV1-B test/contracts: freeze canvas v1 fixtures and negative vectors
CV1-C feat/contracts: add strict canvas v1 parsers/types
CV1-D docs/contracts: publish G1 contract handoff
```

## 9. G1 验收

- 所有 fixture schema PASS；
- 所有 negative vector 按预期失败；
- frontend/backend conformance 一致；
- 权威归属和安全字段无歧义；
- CV2/CV3/CV4/CV5 可以只读合同独立实现；
- `git diff --check` PASS；
- exact write set PASS。

## 10. 启动提示词

```text
你是 CV1，T0-CV1 合同架构师。完整阅读 Master Plan、Employee Rules、
Autonomy Protocol 和本任务书。使用 gpt-5.6-sol/high；报告实际运行配置、
worktree、branch、baseline full SHA、exact write set 与 no-write set。

先审计 Package/0.3、Grant/0.2、CanvasEntryRedemption/0.1 和 Pilot/0.2，
再冻结 Canvas V1 聚合合同。保留现有权威版本，不做大爆炸升级。先写 canonical
fixtures、negative vectors 和安全字段分类，再写严格 parser/type。你不实现 UI、
Provider、Router 或业务数据库。合同冲突提交 REQ-T0CV1-CV1-*。

严格遵守 Master Plan 通用提示词，禁止触碰 byteplus.ts、Demo/Mock fallback、
git add . 和破坏性 Git 操作。完成后返回原子 commit、exact paths、测试、风险、
回滚与下游第一步，申请 G1 验收。
```
