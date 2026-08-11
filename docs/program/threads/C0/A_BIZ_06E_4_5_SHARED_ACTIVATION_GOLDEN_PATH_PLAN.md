# A-BIZ-06E.4P / 06E.5 · Shared Activation 与真实 Golden Path 冻结计划

- 日期：2026-08-11
- 负责人：工程师 A（Business / Control Plane）与工程师 B（Production / StoryCanvas Plane）
- 分支：`dev/business-plane`
- 冻结基线：`a7f8021b80f540c69e4c45718b335ba2c0fca539`
- A 远程：`origin/dev/business-plane@a7f8021b80f540c69e4c45718b335ba2c0fca539`
- B 远程：`origin/dev/production-plane@a7f8021b80f540c69e4c45718b335ba2c0fca539`
- 状态：`A_BIZ_06E_4P_PLAN_FROZEN / B_REDEMPTION_CONSUMER_IMPLEMENTATION_REQUIRED / READY_FOR_06E_5A_RED`
- 上游计划：`A_BIZ_06E_A_B_GOLDEN_PATH_JOINT_GATE_PLAN.md`、`A_BIZ_06E_CANVAS_ENTRY_REDEMPTION_PLAN.md`
- B 对齐回执：`docs/collaboration/production-plane/B_TO_A_AGENT_CANVAS_REDEMPTION_ALIGNMENT_RESPONSE_2026-08-11.md`

## 1. 本轮冻结结论

A/B 已完成 Git baseline 对齐，但只完成了合同祖先链同步，不代表 B 已实现 Canvas Entry redemption consumer 或 Pilot 页面。

当前已满足：

- `a7f8021` 同时是 A/B 远程 HEAD；
- B HEAD 已包含 A Canvas Entry redemption 完整祖先链；
- A 已提供 server-only `POST /api/v1/internal/canvas-entries/redeem`；
- A strict browser client 已提供 Script、Storyboard、Eligibility、Package 与 non-secret Canvas Entry create/read；
- A-owned Storyboard authority、Production Package v0.3、Grant v0.2 与 Migration 020—024 已完成；
- StoryCanvas tracked diff 为零。

当前仍缺：

- B-owned StoryCanvas server redemption client；
- B-owned strict `CanvasEntryRedemption/0.1`、Package v0.3、Grant v0.2 parser；
- B-owned browser-facing、browser-safe Canvas bootstrap endpoint/adapter；
- B-owned Pilot Script、Storyboard 与 Canvas 页面；
- Shared Pilot Bridge 与 Router 激活；
- Golden Path fixture、runner、Playwright spec 与零 SKIP 机器验收。

因此本轮只冻结 06E.4P、06E.4A—C、06E.5A—C 与 06E.6，不把未实现的 B consumer/page 或 Shared Green 伪装为完成。必须继续保留：

```text
A_CANVAS_ENTRY_REDEMPTION_READY
B_REDEMPTION_CONSUMER_IMPLEMENTATION_REQUIRED
SHARED_ACTIVATION_GREEN_BLOCKED
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

## 2. 不可破坏的 Golden Path

唯一允许被 06E.5 证明的真实链路是：

```text
Real Pilot HttpOnly Session Cookie
→ canonical TENANT Project Context
→ approved Script authority
→ approved Storyboard authority
→ Production Eligibility
→ Production Package v0.3
→ browser-safe CanvasEntry/0.2 handle
→ StoryCanvas server browser-facing bootstrap
→ server-only internal redemption
→ strict CanvasEntryRedemption/0.1
→ StoryCanvas runtime ready
```

以下都不能替代该链路：

- Demo Session、Demo Store、Zustand snapshot 或 LocalStorage；
- `DEMO_PROJECT_ID` 或固定海底捞 Project；
- `DemoProjectGrant`、`X-StoryCanvas-Demo-Grant` 或旧 Demo Bridge；
- 浏览器直接调用 internal redemption；
- 浏览器携带 raw Grant、access token、internal token、grantId 或 digest；
- 通过直接调用 Control API 跳过 Script/Storyboard/Canvas 页面；
- Mock StoryCanvas consumer、Mock provider 成功或预埋完整成功事实；
- bundled Chromium 替代真实 Google Chrome；
- PostgreSQL、Chrome、StoryCanvas 或 B consumer 不可用时使用 `test.skip`。

## 3. 06E.4P · Shared Pilot Activation Contract / RED Freeze

06E.4P 是本计划文档切片，只冻结合同、依赖、写集、RED 与提交顺序，不实现 Shared Green。

### 3.1 canonical Route 与 Context

Pilot canonical routes 保持：

```text
/script-editor/:projectId
/storyboard/:projectId
/production/canvas/:projectId
```

所有 Pilot direct URL 必须：

- 先通过真实 PublicSession Cookie；
- 仅允许 `TENANT` Session；
- 从 `pilotProjectContextStore` 与 Project API 解析 canonical Tenant/Project；
- exact route `projectId` 与可见 Project 不一致时返回安全 404；
- 同 Scope 缺 capability 返回 403；
- 未登录返回登录流程，不进入 Demo Boundary；
- Platform/Channel Session 探测 Tenant production route 返回安全 404；
- service/invalid response 显示安全错误与 Request ID，不回退 Demo。

Router 不得把 `handoff-required` 直接替换成现有 Demo `IntegratedStoryCanvasPage`。B 必须提供显式 Pilot boundary/export 后才能执行 Router Green。

### 3.2 Package bootstrap/selection 前置合同

Canvas route 只有 canonical `projectId`，Canvas Entry create 还需要 exact `packageId`。前端不得从 Demo Store、LocalStorage、最近一条 Commission/Production 记录或任意 UUID 推断 package。

在 06E.4B Green 前，A/B 必须在 B consumer/page handoff 中冻结以下一种明确流程：

1. 由已完成的 Pilot Script/Storyboard/Production 页面创建 exact Package 后，携带 browser-safe package reference 进入 Canvas；或
2. 由独立 Pilot Canvas bootstrap orchestrator 先读取 eligibility，再以稳定幂等键创建 exact Package。

无论采用哪一种，必须满足：

- approved Script + approved Storyboard 是唯一 Package eligibility；
- 刷新或 response-loss 重试不得无条件创建新 Package；
- packageId 不从 Demo、Storage 或列表顺序猜测；
- stale/revoked authority 返回 409/410 并 fail closed；
- capability requirements 与 idempotency key 规则必须版本化并可测试。

在该合同未由 B handoff 明确前，Shared Bridge Green 保持 blocked。

### 3.3 Browser non-secret Entry 合同

浏览器可接触的 Canvas bootstrap 输入最多为：

```text
handle
tenantId
projectId
packageId
issuedAt
expiresAt
```

实际传给 B browser-facing adapter 的最小输入冻结为：

```ts
interface PilotCanvasEntryReference {
  handle: string;
  tenantId: string;
  projectId: string;
  packageId: string;
}
```

浏览器、React props、DOM、URL、Storage、console、trace、截图、report 与错误对象不得出现：

```text
X-Production-Plane-Internal-Token
Authorization
Cookie
accessToken
grantId
tokenDigest
payloadDigest
redemptionIdempotencyKey
Production Package internal snapshot
CanvasEntryRedemption/0.1 server-only DTO
```

浏览器不得直接调用：

```text
POST /api/v1/internal/canvas-entries/redeem
```

### 3.4 B browser-facing port

A 不猜测 B 的 exact HTTP path、Cookie 名、CSRF header、server session ID 或响应 JSON。B 必须先以独立合同/RED/Green commit 冻结 browser-facing adapter，并提供 browser-safe port：

```ts
interface PilotCanvasEntryConsumer {
  openEntry(input: PilotCanvasEntryReference): Promise<BrowserSafeCanvasBootstrap>;
}
```

`BrowserSafeCanvasBootstrap` 只能表达 ready/session-expiry/retryable 状态和安全 Request ID，不得把 internal redemption DTO、raw Grant、access token、grantId 或 digest投影给浏览器。

B server 必须负责：

- server-only internal token；
- stable redemption idempotency key；
- response-loss replay；
- exact Scope binding；
- strict redemption/package/grant parsing；
- raw token 的 server-only 生命周期；
- 后续 runtime command 与 server-side authority 的绑定；
- 401/403/404/409/410/422/500/503 的安全映射；
- 不回退旧 v0.2 receiver、Demo Grant、Mock、Zustand 或 LocalStorage。

### 3.5 状态、错误与恢复

Shared Pilot UI/Bridge 必须显式区分：

```text
loading
empty / not-prepared
preparing-package
creating-entry
redeeming
ready
retrying
expired
conflict
forbidden
not-found
service-unavailable
invalid-response
```

统一错误语义：

- `401`：真实 Session 失效；清理 Session/Project Context；
- `403`：同 Scope 缺角色或 capability；
- `404`：跨 Tenant/Project/Package 或未知资源的等价安全拒绝；
- `409`：stale、replay 或 idempotency conflict；
- `410`：Entry/Grant/Package/authority expired、revoked 或 superseded；
- `422`：strict schema/contract invalid；
- `500`：安全 generic internal error；
- `503`：明确 dependency unavailable，可按冻结策略重试。

所有安全错误保留 Request ID；不得显示原始 response body、目标 ID、SQL、stack、provider body、token、digest 或内部 snapshot。

恢复规则：

- response-loss/503 先重放相同 Entry、相同 body 与相同幂等键；
- 不得因为 503 自动创建新 Package/Entry；
- 409 不自动换 key；
- 410 只允许按冻结状态机进行一次明确重建；
- 用户显式“重新准备”才开启新的 bootstrap cycle；
- 任何失败都不得调用 Demo Bridge。

## 4. 06E.4 原子切片

### 4.1 A-BIZ-06E.4A · B Consumer / Pilot Boundary Synchronization

所有权：B-owned，A 负责同步验收。

B 必须独立交付：

1. StoryCanvas server redemption client RED；
2. StoryCanvas server redemption client Green；
3. browser-facing browser-safe bootstrap contract与实现；
4. Pilot Script/Storyboard/Canvas boundary/page；
5. Package bootstrap/selection 决策；
6. strict parser、replay、expiry、Scope 与 secret containment tests；
7. stable export、endpoint/port、Request ID 与 safe error handoff；
8. StoryCanvas targeted/build PASS 且 tracked clean。

A 验收必须验证：

- B commit object 可解析且进入当前集成 HEAD 祖先链；
- B write set 未混入 Shared Router/Bridge 或 A-owned Control API；
- browser-facing DTO 无 raw token、grantId、digest；
- Pilot consumer 不调用旧 Demo Bridge；
- packageId 来源明确且不依赖 Demo/Storage；
- `apps/storycanvas/data/vendor/byteplus.ts` 未被提交。

在 06E.4A 未验收前：

```text
SHARED_ACTIVATION_GREEN_BLOCKED
```

### 4.2 A-BIZ-06E.4B · Shared Pilot Bridge Activation

所有权：shared；由 A/B 会签，独立 commit。

推荐新增而不是改写 Demo Bridge：

```text
src/services/pilotStoryCanvasBridge.ts
src/services/pilotStoryCanvasBridge.test.ts
```

Bridge 必须：

- 只调用 A strict client 创建/读取 non-secret Canvas Entry；
- 使用 06E.4A 冻结的 exact package reference；
- 通过 dependency-injected B browser-facing adapter 消费 Entry；
- StrictMode/重复渲染保持同一 bootstrap cycle 幂等；
- 401/403/404/409/410/422/500/503 保留安全状态与 Request ID；
- 不读写 LocalStorage/SessionStorage；
- 不调用 `storyCanvasBridge.ts`、`controlPlaneMockAdapter` 或 Demo Store；
- 不构造 `X-StoryCanvas-Demo-Grant`；
- 不把 server-only DTO 或 secret 投影到浏览器。

若需要 runtime/proxy 配置，必须拆成额外 shared commit，不能夹入 Bridge core。

### 4.3 A-BIZ-06E.4C · Shared Router Activation / Regression / Handoff

所有权：shared；独立 commit，完成后明确通知 B 同步。

最小写集：

```text
src/app/Router.tsx
src/app/Router.pilot.test.tsx
src/domain/unifiedTenantWorkbench.ts
src/domain/unifiedTenantWorkbench.test.ts
```

只有测试证明确实需要时才修改：

```text
src/layouts/Sidebar.tsx
src/layouts/Topbar.tsx
```

Green 必须证明：

- canonical Script/Storyboard/Canvas route 不再渲染 generic `pilot-route-handoff`；
- Router 只加载 B 明确导出的 Pilot boundary；
- exact route projectId 传入 canonical Project/Bridge；
- 未登录、403、404、service error、retry 均 fail closed；
- Platform/Channel/Tenant 默认路由与越权边界不回归；
- Demo route 保留，但 Pilot direct URL 不进入 Demo Boundary；
- Pilot 失败不渲染 Demo `IntegratedStoryCanvasPage`；
- Router、Bridge、B page 的 security regression 全部通过。

## 5. 06E.5 原子切片

### 5.1 A-BIZ-06E.5A · Deterministic PostgreSQL Fixture Lifecycle

所有权：A-owned，可独立于 B consumer 先执行 RED/Green。

当前确定性缺口：migration chain 已为 `001—024`，Pilot E2E seed postcondition 仍把 migration 数量冻结为 `19`。`fixtureVersion: 1` 表示当前 seed 数据形状，本次仅修复 migration contract，不因 migration 数量变化而升级。真实 runner 会在启动 Chrome 前因 migrationCount postcondition 失败。

06E.5A 冻结：

- `06E.5A1`：migrationCount 对齐完整 `001—024`，并从权威 migration contract 派生；
- `06E.5A1` 保持 `fixtureVersion: 1`，因为本原子修复不改变 seed 数据形状；
- `06E.5A2`：如新增 Golden Path 输入 fixture、确定性时钟或初始 Production/Canvas 计数，再独立升级 fixtureVersion 并固定 fingerprint；
- deterministic fixture clock；
- canonical Tenant/Project/User/Membership/Assignment；
- approved-script、fact-risk、stale storyboard、cross-scope 等输入 fixture；
- Package/Grant/Canvas Entry/Redemption 成功事实由真实浏览器链创建，不预埋整条成功链；
- seed 后初始 Package/Grant/Entry/Redemption 计数有明确 postcondition；
- `activeSessionCount=0`；
- reset → migrate → seed → verify 连续两轮产生相同非秘密 fingerprint；
- 缺 dedicated `_test` PostgreSQL 时 fail，不得 SKIP。

#### 首个 RED

在 `apps/control-api/src/e2e/resetSeed.test.ts` 冻结：

```ts
expect(summary.migrationCount).toBe(24);
expect(summary.fixtureVersion).toBe(1);
```

本 RED 只证明完整 migration chain；当前实现的 `migrationCount: 19` 应确定性失败，而 `fixtureVersion: 1` 是本切片的正确预期。Production/Canvas 输入 fixture 与初始计数留给独立 `06E.5A2` RED，不混入本修复。

首个 RED 名称：

```text
Pilot E2E seed accepts the complete 001—024 migration chain
```

### 5.2 A-BIZ-06E.5B · Deterministic Golden Path Runner / Harness

所有权：shared；独立 RED commit 与 Green commit，完成后通知 B。

建议入口：

```text
npm run test:e2e:pilot:ab-golden-path
```

建议 runner：

```text
tests/e2e/pilot/run-ab-golden-path.ts
```

Runner 必须管理：

1. dedicated `_test` PostgreSQL reset/migrate/seed/verify；
2. Control API 子进程、readiness、日志捕获与 teardown；
3. Root Vite 子进程、readiness 与 teardown；
4. StoryCanvas server 子进程、专用临时数据目录、readiness、日志捕获与 teardown；
5. A/B 双服务共享且不回显的 internal token；
6. 真实 `channel: chrome`、单 worker、零 retry；
7. B consumer capability与 baseline ancestor preflight；
8. JSON reporter 与零 SKIP 机器验收；
9. DOM/Storage/console/network/trace/screenshot/report/双服务日志敏感信息扫描；
10. 任一进程失败或不可用时非零退出，不得转成 SKIP。

在 B 06E.4A 未同步时，runner 必须在启动 Chrome 前 fail closed：

```text
AB_GOLDEN_PATH_B_CONSUMER_REQUIRED
```

但 `ab-golden-path` phase 此时仍保持 `external`，并继续返回：

```text
AB_GOLDEN_PATH_NOT_IMPLEMENTED
```

不得为了让 harness Green 而提前把 manifest phase 改为 `ready`。

### 5.3 A-BIZ-06E.5C · Real Chrome + PostgreSQL Golden Path Evidence

所有权：shared E2E；只能在 06E.4A—C 与 06E.5A—B 完成后执行。

推荐 spec：

```text
tests/e2e/pilot/browser/ab-golden-path.spec.ts
```

必须以真实浏览器操作验证：

1. 未登录 direct URL 安全回登录；
2. 真实登录生成 HttpOnly `videoagent_session`；
3. canonical TENANT/Project，不出现 `DEMO_PROJECT_ID`；
4. tenant_admin/content_operator 的允许与拒绝矩阵；
5. Script create/list/approve/revoke、digest mismatch、fact-risk blocked；
6. B Storyboard Draft provenance、A authority save/approve/revoke/stale；
7. 只有 approved Script + approved Storyboard 可创建 Package v0.3；
8. exact package reference 创建 non-secret Canvas Entry；
9. 浏览器将 handle/Scope 交给 B server，B server完成 redemption；
10. response-loss replay、expired、conflict、provider unavailable 和安全恢复；
11. 401/403/404/409/410/422/500/503 与 Request ID；
12. StoryCanvas runtime ready 不是 Demo/Mock/旧 receiver 结果；
13. DOM、URL、Storage、console、network error、trace、截图、report、Control API与 StoryCanvas日志无 secret/digest/SQL/stack；
14. StoryCanvas tracked clean，A/B baseline ancestor 仍成立。

#### 零 SKIP 机器验收

Runner 必须解析 JSON report 并要求：

```text
total > 0
passed === expectedTotal
failed === 0
skipped === 0
flaky === 0
interrupted === 0
```

同时固定：

```text
forbidOnly: true
workers: 1
retries: 0
browser channel: chrome
```

禁止：

- `test.skip`；
- `test.fixme`；
- 环境条件 skip；
- no tests found；
- only/filter 缩小矩阵；
- PostgreSQL、Chrome、StoryCanvas、B consumer 或 provider unavailable 被记为 SKIP。

Provider unavailable 是必须执行的安全失败与恢复场景，不证明媒体质量、LIVE Provider、SLA 或正式生产能力。

## 6. A-BIZ-06E.6 · Joint Gate Activation / Closure

06E.6 只能在 06E.5C 真实 Google Chrome + dedicated PostgreSQL Gate 零 SKIP 通过并保存安全证据后执行。

允许的变更：

- `ab-golden-path` 从 `external` 激活为 `ready`；
- manifest command 切到唯一 deterministic runner；
- 更新 manifest/runner tests 与 Pilot E2E README；
- 删除 `AB_GOLDEN_PATH_NOT_IMPLEMENTED`；
- 更新 C0 STATUS/HANDOFF/CHANGELOG 与桌面知识库；
- 记录真实 A/B commit、Chrome版本、PostgreSQL数据库安全标识、test count、零 SKIP 和 artifact scanner 结果。

06E.6 不自动等于 Full Joint Gate PASS。只有全部 required phase、external precondition、diff isolation 与 Final Report Contract 同时通过时，才可单独评估 `JOINT_GATE_PASS`。

在 06E.6 之前必须持续保留：

```text
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

## 7. 写集与所有权冻结

### 7.1 A-owned 写集

06E.5A 可修改：

```text
apps/control-api/src/e2e/fixtures.ts
apps/control-api/src/e2e/resetSeed.ts
apps/control-api/src/e2e/resetSeed.test.ts
tests/e2e/pilot/browser/fixtures.ts
tests/e2e/pilot/pilotArtifactSecurity.ts
tests/e2e/pilot/pilotArtifactSecurity.test.ts
```

若 strict A client 出现真实合同缺口，只能独立提交：

```text
src/services/pilotApiTransport.ts
src/services/pilotApiTransport.test.ts
src/services/pilotContentProductionApi.ts
src/services/pilotContentProductionApi.test.ts
```

不得把 A-owned client 修复夹入 Shared Router/Bridge commit。

### 7.2 B-owned 写集

B consumer/page 原子提交限定：

```text
apps/storycanvas/src/**
src/pages/script-editor/**
src/pages/storyboard/**
src/pages/production/**
src/features/storycanvas/**
```

B 不得在同一提交中修改 Shared Router、Joint Gate runner或 A-owned Control API core。`apps/storycanvas/src/contracts/v0.2/**` 若需修改，必须作为明确合同提交并由 A 会签。

### 7.3 Shared 写集

Shared 变更必须独立 commit 并通知对方同步：

```text
src/app/Router.tsx
src/app/Router.pilot.test.tsx
src/domain/unifiedTenantWorkbench.ts
src/domain/unifiedTenantWorkbench.test.ts
src/services/pilotStoryCanvasBridge.ts
src/services/pilotStoryCanvasBridge.test.ts
scripts/joint-gate-manifest.mjs
scripts/joint-gate-manifest.test.mjs
scripts/run-joint-gate.mjs
package.json
playwright.pilot.config.ts
playwright.pilot-ab-golden-path.config.ts
tests/e2e/pilot/run-ab-golden-path.ts
tests/e2e/pilot/browser/ab-golden-path.spec.ts
tests/e2e/pilot/README.md
```

`src/layouts/Sidebar.tsx` 与 `src/layouts/Topbar.tsx` 只有确有 Router呈现回归时才加入独立 shared commit。

### 7.4 禁止写集

A 本轮及后续 A-owned/shared 提交禁止修改：

```text
apps/storycanvas/**
apps/storycanvas/data/vendor/byteplus.ts
src/services/storyCanvasBridge.ts
```

Demo Bridge 原则上保持不变；若未来确需共享修改，必须另立计划、独立 commit 并经 A/B 会签，不能作为 Pilot 快速接线手段。

## 8. 原子提交顺序

冻结顺序：

```text
06E.4P docs freeze
→ 06E.5A fixture lifecycle RED
→ 06E.5A fixture lifecycle Green
→ 06E.5B runner contract RED
→ B 06E.4A consumer/page RED + Green + handoff
→ A sync/ancestor/write-set attestation
→ 06E.4B Shared Bridge Green
→ 06E.4C Shared Router Green / regression / handoff
→ 06E.5B deterministic harness Green
→ 06E.5C real Chrome/PostgreSQL spec + evidence
→ 06E.6 manifest activation / docs closure
```

每个原子切片独立 commit。任何 Shared Router、Bootstrap、Bridge、manifest、runner或合同变更均不得与 A-owned/B-owned页面实现混合。

## 9. RED 队列

### RED 1：A-owned deterministic fixture

```text
Pilot E2E seed accepts the complete 001—024 migration chain
```

当前预期失败：实现仍把 `migrationCount` 冻结为 `19`；`fixtureVersion` 在本原子修复中保持 `1`。

### RED 2：Shared Router fail-closed activation

真实 TENANT Session + canonical Project 访问 `/production/canvas/:projectId` 时：

- 不得继续渲染 generic handoff；
- 不得渲染 Demo `IntegratedStoryCanvasPage`；
- 必须把 exact projectId 交给只接受 non-secret Entry 的 Pilot boundary；
- B boundary 未安装时显示安全 blocked/service state，不回退 Demo。

该 RED 可冻结，但 Router Green 必须等待 06E.4A。

### RED 3：Shared Bridge isolation

Pilot Bridge 的任一成功/失败分支均不得：

- 调用 `storyCanvasBridge`；
- 调用 `controlPlaneMockAdapter`；
- 构造 `X-StoryCanvas-Demo-Grant`；
- 读取或写入 LocalStorage/SessionStorage；
- 向 B adapter 传递 raw Grant、access token、grantId 或 digest。

### RED 4：Golden Path runner contract

```text
npm run test:e2e:pilot:ab-golden-path
```

必须委托 deterministic lifecycle runner，并在 B consumer 未同步时于 Chrome 启动前安全返回 `AB_GOLDEN_PATH_B_CONSUMER_REQUIRED`。当前 script/runner/spec 尚不存在，因此应为 RED。

## 10. 验证与停止条件

每个切片执行与写集匹配的 targeted tests，并至少执行：

```bash
npx prettier --check <changed files>
npm run validate:governance
npm run test:joint-gate:manifest
npm run test:joint-gate:plan
git diff --check
git diff -- apps/storycanvas
git status --short
```

06E.5C 才执行真实 Chrome/PostgreSQL/StoryCanvas lifecycle。当前计划冻结阶段不得运行或宣称 Full Joint Gate PASS。

真实阻塞时才暂停：

- B 未提供 consumer/page contract 或稳定 export；
- package bootstrap/selection 仍不明确；
- B browser-facing endpoint/adapter 未冻结；
- shared 文件出现未同步冲突；
- 缺 dedicated `_test` PostgreSQL、真实 Google Chrome 或 StoryCanvas readiness；
- 任何 secret containment Oracle 失败。

## 11. 明确非目标

本计划不实现：

- LIVE Provider、付费媒体调用、媒体质量、生产 SLA；
- LIVE Payment、LIVE Commission、LIVE Settlement；
- 真实比例、paid、提现、KYC、税务、发票或自动打款；
- 未规划的 review/approve HTTP；
- raw Grant 或 access token 浏览器 handoff；
- B consumer/page 未实现时的 Mock/Demo 假成功；
- StoryCanvas tracked 修改；
- `apps/storycanvas/data/vendor/byteplus.ts` 的修改、暂存、提交或删除；
- 提前移除 `AB_GOLDEN_PATH_NOT_IMPLEMENTED`；
- 提前声明 `A_BIZ_06E_COMPLETE`、`A_BIZ_06_COMPLETE`、`AB_GOLDEN_PATH_COMPLETE`、`JOINT_GATE_PASS` 或 `FULL_JOINT_GATE_PASS`。

## 12. 当前执行入口

本计划冻结后，A 可独立开始的第一个实现切片是：

```text
A-BIZ-06E.5A RED
Pilot E2E seed accepts the complete 001—024 migration chain
```

Shared Router/Bridge Green 的进入条件仍是：

```text
B 06E.4A consumer/page implementation commit
→ A sync + ancestor + write-set + security attestation
→ package bootstrap/selection contract confirmed
```

当前状态保持：

```text
A_BIZ_06E_4P_PLAN_FROZEN
READY_FOR_06E_5A_RED
B_REDEMPTION_CONSUMER_IMPLEMENTATION_REQUIRED
SHARED_ACTIVATION_GREEN_BLOCKED
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```
