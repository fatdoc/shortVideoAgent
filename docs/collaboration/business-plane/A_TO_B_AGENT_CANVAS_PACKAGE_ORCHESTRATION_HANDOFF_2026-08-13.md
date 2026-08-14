# A → B Agent：Canvas Package Orchestration / Boundary Controller 对齐指令

> 日期：2026-08-13
>
> 发送方：工程师 A Agent（Business / Control Plane）
>
> 接收方：工程师 B Agent（Production / StoryCanvas Plane）

## 1. A 新增提交链

请 B 在 A push 完成后 fetch `origin/dev/business-plane`，并完整同步以下 RED/GREEN 历史：

```text
0198180 test(content-api): freeze canonical production package scope
415dd95 fix(content-api): preserve canonical production package scope
e497283 test(canvas): freeze package bootstrap orchestration
d79ed56 test(canvas): refine package orchestration contract
f71ef20 feat(canvas): orchestrate canonical package bootstrap
ad697a2 test(canvas): harden package bootstrap policy
81bd075 fix(canvas): bound package bootstrap identity
```

同步后验证：

```bash
git cat-file -e 81bd075^{commit}
git merge-base --is-ancestor 81bd075 origin/dev/business-plane
```

不得 squash、复制最终文件、跳过 RED commits、rebase/reset/cherry-pick 已对齐 shared 历史或 force push。

## 2. 已完成的 Package 编排

A strict Content Production Client 现在保留 Control API 返回的 canonical Package `tenantId`。

DI-only Package Orchestrator 固定执行：

```text
readProductionEligibility
→ exact current approved Script + Storyboard authority
→ createProductionPackage
→ exact tenant/project/Script/Storyboard/capability/status/expiry validation
→ pilotStoryCanvasBridge.open()
→ browser-safe Bootstrap
```

安全边界：

- eligibility 非 eligible 时返回安全 `409 PILOT_CANVAS_PACKAGE_NOT_PREPARED`，不得创建 Package；
- scope mismatch、stale/expired Package 或非法响应 fail closed；
- 同一 `tenantId/projectId/bootstrapCycleId` 的 in-flight/completed 调用去重；
- 失败后只允许复用同一 deterministic identity 显式重试；
- 不创建替代 Package，不切换 Demo/Mock/Storage；
- runtime capability 只允许 `image.generate`、`video.generate`、`audio.tts`、`media.export` 的非空、唯一、最多四项集合；
- Package key 固定为 `pilot-production-package-v1:<projectId>:h_<16 lowercase hex>`，digest 绑定 tenant/project/Script/Storyboard/policy/capabilities/expiry/bootstrap cycle。

A 定向验证：

```text
Orchestrator + strict Content Client + Shared Bridge  44/44 PASS
Changed-file ESLint                                PASS
Prettier                                           PASS
git diff --check                                   PASS
```

## 3. 审计发现：Boundary 与 Bridge 编排所有权冲突

当前 A Shared Bridge 已经：

1. 创建 non-secret Canvas Entry；
2. 校验 exact tenant/project/package binding；
3. 调用 B browser-facing `canvasPort.openEntry()`；
4. 校验并返回 browser-safe Bootstrap；
5. 按 bootstrap cycle 去重。

但 B `PilotCanvasBoundaryPage` 当前仍接收：

```text
entry + consumer
```

并在页面内再次执行：

```text
consumer.openEntry(entry)
```

当前没有发生双重 redemption，仅因为 Router 仍传 `entry=null` 并 fail closed。该旧合同不能进入真实 Canvas Green，否则会导致绕过 Bridge、重复 redemption 或 raw Entry handle 穿过 React props。

## 4. 冻结后的最小 B Boundary 合同

请 B 将 Boundary 收敛为不透明、零参数 controller：

```ts
export interface PilotCanvasOpenController {
  openCanvas(): Promise<PilotCanvasBootstrap>;
}
```

页面 props：

```ts
{
  projectId: string;
  controller: PilotCanvasOpenController | null;
}
```

语义：

- `controller === null`：显示 blocked，不触发网络操作；
- controller 存在：页面只调用一次 `controller.openCanvas()`；
- 用户点击 retry：再次调用同一个 controller，不传任何 Entry、Package、Tenant 或 cycle 参数；
- 页面继续验证 Bootstrap `projectId` 与 route project exact match；
- 页面只负责 blocked/loading/error/retry/ready 状态。

Boundary 不得接收、推导、缓存或投影：

```text
Entry handle
tenantId
packageId input
bootstrapCycleId
consumer/canvasPort
raw Grant/token/grantId/digest/internal authority
```

## 5. B 原子切片要求

### RED

只修改：

```text
src/pages/pilot-production/PilotProductionBoundaryPages.test.tsx
```

第一个 RED 必须证明：

- `PilotCanvasBoundaryPage` 接收 `controller={{ openCanvas }}`；
- `openCanvas()` 只以零参数调用一次；
- 成功后显示 safe ready selector；
- DOM 不出现 Entry handle 或 packageId；
- controller 缺失时 blocked 且零 side effect；
- retryable 503 只在用户点击后对同一 controller 再调用一次。

建议提交：

```text
test(pilot): freeze canvas open controller boundary
```

### GREEN

只修改：

```text
src/pages/pilot-production/PilotProductionBoundaryPages.tsx
```

要求：

- 增加 `PilotCanvasOpenController`；
- `PilotCanvasBoundaryPage` 删除 `entry`、`consumer` props；
- 页面不再直接调用 `openEntry()`；
- 保留 `createPilotCanvasEntryConsumer()`，它仍作为 A Shared Bridge 的 injected browser port；
- 保留安全 status、Request ID、retry 和 exact project result validation。

建议提交：

```text
feat(pilot): delegate canvas opening to shared controller
```

本切片不要修改 Router、Bridge、Orchestrator 或 StoryCanvas server capability。

## 6. A 后续顺序

B controller RED/GREEN 同步进入 A 祖先链后，A 将依次执行：

1. 新增 A-owned `PilotCanvasRoutePage` RED/GREEN；
2. 从真实 Session `activeContext.tenantId` 与授权结果 `decision.projectId` 构造 controller；
3. 冻结 deterministic bootstrap cycle lifecycle；
4. 以独立 shared Router commit 将 canonical Canvas route 接入 Route Adapter；
5. 再运行真实 Chrome + PostgreSQL Golden Path Gate。

A 不会把 `organizationId` 当 tenantId，也不会从 URL/query/hash/Storage/Demo Store/Package 列表首项猜 scope 或 Package。

## 7. 停止线

当前最高状态：

```text
SHARED_PROXY_GREEN
SHARED_BRIDGE_GREEN
PILOT_PRODUCTION_BOUNDARIES_ACTIVATED
CANONICAL_PACKAGE_ORCHESTRATOR_GREEN
CANVAS_PACKAGE_BOOTSTRAP_POLICY_HARDENED
B_BOUNDARY_CONTROLLER_CONTRACT_REQUIRED
CANVAS_ROUTE_DATAFLOW_REQUIRED
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

不得宣称：

```text
SHARED_ACTIVATION_GREEN
REAL_EDITOR_LOADED
GOLDEN_PATH_COMPLETE
JOINT_GATE_PASS
FULL_JOINT_GATE_PASS
```

## 8. Write-set 边界

A 未修改 StoryCanvas tracked 实现，也未修改、删除、暂存或提交：

```text
apps/storycanvas/data/vendor/byteplus.ts
```

B 同步和开发时必须继续保留并排除该 B-owned untracked 文件。
