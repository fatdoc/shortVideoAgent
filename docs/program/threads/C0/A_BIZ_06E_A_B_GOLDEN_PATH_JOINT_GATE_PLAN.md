# A-BIZ-06E · A/B Golden Path Joint Gate 计划

- 日期：2026-08-11
- 负责人：工程师 A（业务平台）/ 工程师 B（生产与画布）
- 分支：`dev/business-plane`
- 状态：`A_CANVAS_ENTRY_REDEMPTION_READY / A_BIZ_06E_4P_PLAN_FROZEN / READY_FOR_06E_5A_RED / B_REDEMPTION_CONSUMER_IMPLEMENTATION_REQUIRED / AB_GOLDEN_PATH_NOT_IMPLEMENTED`
- 上游计划：`A_BIZ_06_OPERATIONAL_CLOSURE_JOINT_GATE_PLAN.md`、`A_B_CO_CREATION_SPLIT_2026-08-06.md`
- 冻结基线：`a7f8021b80f540c69e4c45718b335ba2c0fca539`
- 共享同步基线：A/B 远程 HEAD 均为 `a7f8021b80f540c69e4c45718b335ba2c0fca539`；B 已包含 A Canvas Redemption 祖先链
- 细化计划：`A_BIZ_06E_4_5_SHARED_ACTIVATION_GOLDEN_PATH_PLAN.md`

## 2026-08-11 覆盖性状态更新

本节覆盖本文后续仍保留的早期源码审计、`WAITING_FOR_B_BASELINE` 与 06E.4—06E.6 粗粒度描述；历史段落仅保留决策演进背景，当前执行以细化计划为准。

- A/B 远程已共同对齐到 `a7f8021b80f540c69e4c45718b335ba2c0fca539`，baseline blocker 已解除。
- A 已完成 Storyboard authority、Production Package v0.3、Grant v0.2、CanvasEntry/0.2、strict browser client、Migration 020—024 与 server-only internal redemption。
- B 回执只完成 baseline 对齐；StoryCanvas redemption consumer、browser-facing bootstrap 与 Pilot Script/Storyboard/Canvas page 尚未实现。
- 06E.4 已细分为 `06E.4P docs/RED freeze → 06E.4A B consumer/page synchronization → 06E.4B Shared Bridge → 06E.4C Shared Router/regression`。
- 06E.5 已细分为 `06E.5A deterministic PostgreSQL fixture → 06E.5B deterministic runner/harness → 06E.5C real Chrome + PostgreSQL zero-SKIP evidence`。
- A 当前可独立执行的首个 RED 是：`Pilot E2E seed accepts the complete 001—024 migration chain`。
- Shared Router/Bridge Green 必须等待 B consumer/page同步验收；浏览器只携带 non-secret handle 与 canonical tenant/project/package reference，Pilot失败不得回退Demo/Mock/LocalStorage。
- 06E.6真实激活前继续保留 `AB_GOLDEN_PATH_NOT_IMPLEMENTED / FULL_JOINT_GATE_STILL_BLOCKED`。

## 1. 本节点目标

A-BIZ-06E 只负责冻结并验证统一 SaaS 入口中的真实 A/B 黄金路径：

```text
Pilot Tenant Session
→ canonical Project Context
→ approved Script Snapshot
→ approved Storyboard authority
→ Production Package / Grant
→ StoryCanvas Canvas Entry
```

本节点不是把 Demo Script/Storyboard/Canvas 换一个路由名，也不是扩大到 LIVE Provider、媒体质量或付费生产。所有成功事实必须来自真实 Session Cookie、canonical UUID Project、A-owned 权威内容/审批/生产合同与 B-owned 可同步干净基线；缺少任一前置条件时 fail closed。

## 2. 源码与合同审计结论

### 2.1 B baseline 当前不满足执行前置

本地 remote-tracking ref 当前为：

```text
origin/dev/production-plane@84d922c
2026-08-02 docs(production): hand off D2 production plane
```

该提交是旧 D2 生产平面基线，当前 A 分支相对它为 `201 ahead / 0 behind`，没有可证明的 Wave 4 B Golden Path handoff。工作区另有 B-owned 未跟踪文件：

```text
apps/storycanvas/data/vendor/byteplus.ts
```

因此 06E 不得把非空字符串、旧 remote ref 或本地未跟踪文件冒充“已提交、可同步、StoryCanvas tracked clean”的 B baseline。当前状态必须保持 `WAITING_FOR_B_BASELINE`。

### 2.2 A 侧 canonical Project Context 已存在

`src/services/pilotControlApi.ts` 已提供真实 Cookie 驱动的 Project list/read；`src/stores/pilotProjectContextStore.ts` 已限定：

- `TENANT` Session；
- canonical Tenant / Project UUID；
- `tenant_admin` 或 `content_operator`；
- 401/403/404/service error 的严格状态；
- 不从 Demo/localStorage 恢复 Pilot Project 成功事实。

06E 必须复用该上下文，禁止 `DEMO_PROJECT_ID`、固定海底捞字符串或 Organization ID 猜测替代 canonical Project。

### 2.3 统一 SaaS Script/Storyboard/Canvas 仍是 Demo 路径

B-owned 页面当前仍依赖 Demo Store/Bridge：

- `src/pages/script-editor/ScriptEditorPage.tsx` 使用 `useProjectStore`、Mock generate/save、LocalStorage 与 `DEMO_PROJECT_ID`；
- `src/pages/storyboard/StoryboardPage.tsx` 使用 Demo project/control-plane snapshot；
- `src/pages/production/IntegratedStoryCanvasPage.tsx` 使用 `useControlPlaneStore`、`dispatchCanonicalPackage()` 与固定 Demo Project；
- `src/features/storycanvas/StoryCanvasApp.types.ts` 仍校验 `DemoProjectGrant`；
- `src/services/storyCanvasBridge.ts` 仍发送 `X-StoryCanvas-Demo-Grant`。

这些文件属于 B 或共享边界，A 不得直接修改。Demo smoke 可以保留，但 Pilot 路径失败时不得回退 Demo Store/Bridge。

### 2.4 A Control API 已有 Script 与 Production 基础合同

当前已提供：

```text
POST /api/v1/projects/:projectId/script-versions
GET  /api/v1/projects/:projectId/script-versions
POST /api/v1/projects/:projectId/script-versions/:scriptVersionId/approvals
GET  /api/v1/projects/:projectId/production-eligibility
POST /api/v1/projects/:projectId/production-packages
GET  /api/v1/projects/:projectId/production-packages/:packageId
POST /api/v1/projects/:projectId/production-grants
POST /api/v1/internal/project-grants/introspect
```

Production Grant response 含 raw `accessToken`。这些能力尚未进入 strict Pilot frontend client，也没有安全的浏览器 Canvas bootstrap/dispatch 合同。

### 2.5 Storyboard authority 是阻断性合同缺口

协作合同要求 B 返回版本化 Storyboard 草案，A 保存权威版本并执行人工审批，批准后 A 才重新签发包含正式 Storyboard 的 Production Package。

当前实现没有 A-owned Storyboard Version/Approval 事实；`apps/control-api/src/production/repository.ts` 仍通过 `storyboardFromScript(scriptPayload)` 从批准 Script payload 的 `storyboard` 字段构造 Package。该做法不能证明 Storyboard 来自 B 草案、由 A 保存并已人工批准。

冻结结论：在 Storyboard authority 合同完成前，06E 不得创建真实 Golden Path Browser success，也不得让 Demo Storyboard 冒充 approved Storyboard。

### 2.6 B v0.2 runtime 已有后端边界，但浏览器未真实接线

StoryCanvas 已有 v0.2 packages/grants/commands/receipts 路由及 Control API Grant introspection，但统一 SaaS Canvas 页面仍使用 Demo Grant/Bridge。因此已有后端合同测试不等于真实 Pilot Browser Entry 已完成。

## 3. 冻结的权威合同

### 3.1 B baseline attestation

`JOINT_GATE_B_BASELINE_COMMIT` 必须同时满足：

1. 是完整 Git commit object，可由 `git cat-file -e <value>^{commit}` 解析；
2. 已同步进入当前 A 集成历史，`git merge-base --is-ancestor <value> HEAD` 为真；
3. B 明确声明该提交是 Wave 4 Golden Path handoff，而不是旧 D2 remote-tracking ref；
4. 从该 baseline 到 Gate HEAD，B-owned tracked paths 没有未经双方同步的 A-side 变更；
5. Gate 开始和结束时 `git diff -- apps/storycanvas src/features/storycanvas src/pages/storyboard src/pages/script-editor src/pages/production/IntegratedStoryCanvasPage.tsx src/components/storyboard src/components/script` 符合双方已冻结所有权；
6. B-owned 未跟踪文件不被 A 暂存、提交、删除或改写。

非法、未知或未同步值统一阻断为稳定安全代码：

```text
JOINT_GATE_B_BASELINE_COMMIT_INVALID
JOINT_GATE_B_BASELINE_COMMIT_NOT_ANCESTOR
JOINT_GATE_B_BASELINE_ATTESTATION_REQUIRED
```

Runner 不回显原始环境值，不执行任何 required command，也不移除 `AB_GOLDEN_PATH_NOT_IMPLEMENTED`。

### 3.2 Storyboard Draft 与 A-owned authority

B 返回的 `StoryboardDraftRevision` 至少必须绑定：

- `tenantId`、`projectId`；
- approved `scriptVersionId` 与不可变 script payload digest；
- stable revision ID / revision number / previous revision；
- 有序 Shot 集合及每个 Shot 的 stable ID、sequence、duration、description、source mode；
- 来源 Command/Receipt、生成策略版本、validation summary；
- payload digest、createdAt；
- 明确 `draft`，不得携带或暗示 A approval。

A-owned Storyboard authority 至少必须保存：

- canonical Storyboard Version ID / version；
- B draft revision provenance；
- tenant/project/script version/digest 绑定；
- immutable storyboard payload digest；
- `draft / approved / revoked / superseded` 状态；
- append-only Approval Event、actor、actedAt、reason 与 fact-risk 状态；
- 幂等、并发、stale version、跨 Tenant/Project 和 revoked approval 的 fail-closed 语义。

具体 Migration、Repository、Service 与 HTTP 将在 06E.1 test-first 冻结；共享 Control API Bootstrap 必须独立提交并通知 B。

### 3.3 Production Package eligibility

Production Package 只可在以下条件全部为真时创建：

- Script Version 为 approved，Approval 未 revoked/blocked，fact risk cleared；
- Storyboard Version 为 approved，未 revoked/superseded；
- Storyboard 绑定同一 tenant/project/scriptVersionId/script digest；
- 请求的 Script/Storyboard 与当前 eligibility snapshot 一致；
- payload digest、package scope、capability、expiry 与 idempotency 校验通过。

Package 必须显式包含 approved Storyboard 的 version ID、digest、approvedAt、approvedBy；禁止继续从 Script payload 隐式提取 Storyboard 作为正式权威事实。

### 3.4 Grant 与 Browser Canvas bootstrap

冻结安全方向为 **server-mediated bootstrap**：

- raw Project Grant `accessToken` 只允许短时存在于 A/B 服务端内存或受控 server-to-server request；
- raw token 不进入 DOM、React props、URL/query/hash、localStorage、sessionStorage、IndexedDB、console、日志、trace、截图、report 或错误 envelope；
- 浏览器只接收 non-secret Canvas Entry receipt/handle，并继续依赖真实 HttpOnly Pilot Session；
- handle 必须 tenant/project/package 绑定、短时、单用途或明确 replay 语义，过期/重放/错 Scope fail closed；
- B Canvas 只消费通过 introspection 的合法 Package/Grant，不接受 `DemoProjectGrant`、`X-StoryCanvas-Demo-Grant` 或 Mock fallback。

如果现有 B runtime 无法支持 server-mediated bootstrap，必须由 A/B 先冻结替代威胁模型并形成独立共享合同提交；不得临时把 raw Grant 塞进浏览器。

## 4. 原子实施切片

### 4.1 A-BIZ-06E.0 · Baseline Attestation Hardening

A-owned，可在等待 B handoff 时前置：

- 先以 Runner RED 证明“非空但不存在的 commit”当前会错误通过 external precondition；
- 增加 commit object、ancestor 与 attestation validator；
- 保持输出脱敏、required commands 不执行、06E slice blocker 不移除；
- manifest/runner 属共享 Joint Gate，Green 提交后必须明确通知 B 同步。

首个 RED：

> 使用合法 dedicated PostgreSQL URL 和不存在的非空 `JOINT_GATE_B_BASELINE_COMMIT` 执行 Full preflight，必须返回 `JOINT_GATE_B_BASELINE_COMMIT_INVALID`，不得出现 `RUNNING`、提交值或 `JOINT_GATE_PASS`，并继续保留 `AB_GOLDEN_PATH_NOT_IMPLEMENTED`。

完成证据（2026-08-10）：

- RED `f29a0bd` 证明原 runner 只校验 non-empty；
- Green `94fabe1` 将 A/B-owned phases 的 validator 改为 `git-commit-ancestor`，依次校验 40 位 commit、commit object 与 HEAD ancestor；
- Matrix `cf6bf58` 覆盖 missing、invalid、not-ancestor 与 valid synchronized commit；
- manifest `12/12 PASS`，非法值不回显、不执行 required commands，valid HEAD 只保留 06E/06F slice blockers；
- `AB_GOLDEN_PATH_NOT_IMPLEMENTED` 未移除，`ab-golden-path` 仍为 `external`。

**共享通知给 B**：修改 `scripts/joint-gate-manifest.mjs` 或 `scripts/run-joint-gate.mjs` 前必须同步 `94fabe1`；B handoff 必须提供已进入集成 HEAD 祖先链的完整 commit SHA。

### 4.2 A-BIZ-06E.1 · Storyboard Authority / Bootstrap Contract

A/B 共同冻结、A 负责权威持久化：

1. Storyboard Draft/Version/Approval DTO 与 digest；
2. Migration、Repository、Service、HTTP、权限和幂等；
3. Production Eligibility/Package 对 approved Storyboard 的强绑定；
4. server-mediated Canvas Entry bootstrap；
5. v0.2 cross-plane contract fixtures 与安全 Oracle。

本切片先合同/RED，再实现；Migration、core、HTTP、shared Bootstrap、cross-plane contract 必须按所有权拆分独立 commit。

### 4.3 A-BIZ-06E.2 · A-owned Strict Pilot Content/Production Client

只在 06E.1 合同稳定后实现：

- Script Version list/create 与 Approval；
- Storyboard Version list/create 与 Approval；
- Production Eligibility；
- Package create/read；
- non-secret Canvas Entry create/read；
- 真实 Cookie、GET `no-store`、稳定 idempotency、strict runtime parser；
- 401 清理 Session/Project Context，403/404/409/410/422/503 与 Request ID；
- invalid response/service error 不回退 Demo/Mock/localStorage。

A 不修改 B-owned Script/Storyboard/Canvas 页面。

### 4.4 A-BIZ-06E.3 · B-owned Pilot Script / Storyboard / Canvas Pages

由 B 在明确 baseline 上修改并提交：

- Pilot Script 页面使用 canonical Project 与 A strict client，不再用 Mock/localStorage 作为成功事实；
- Pilot Storyboard 页面生成/接收 B draft，再调用 A authority 保存/审批；
- Canvas 页面只使用 non-secret Entry contract，不接受 Demo Grant fallback；
- Demo 路径可保留，但必须由 mode/route policy 与 Pilot 严格隔离；
- B 定向页面、StoryCanvas runtime/security/type/build tests 通过且 tracked clean。

### 4.5 A-BIZ-06E.4 · Shared Router / Bridge Activation

仅在 06E.1～06E.3 双方提交已同步后执行：

- 统一 SaaS Pilot route 使用 canonical Project Context；
- tenant_admin/content_operator 的可见动作按既有 capability policy 授权；
- 未登录 401、同 Scope 缺能力 403、跨 Tenant/Project 安全 404；
- Demo route 不被删除，但 Pilot direct URL 不得落入 Demo Boundary；
- Router、bridge、shared contract 分开提交，并在每个共享提交后通知对方同步。

### 4.6 A-BIZ-06E.5 · Real A/B Browser Golden Path

使用真实 Google Chrome、专用 `_test` PostgreSQL、真实 HttpOnly Session Cookie、单 worker 验证：

1. canonical Tenant/Project，不出现 `DEMO_PROJECT_ID`；
2. tenant_admin/content_operator 的允许与拒绝矩阵；
3. Script create/list/approve/revoke、digest mismatch 与 fact-risk blocked；
4. B Storyboard Draft provenance，A authority save/approve/revoke/stale version；
5. approved Script + approved Storyboard 才能签发 Package；
6. Grant scope、capability、expiry、replay、tenant/project/package binding；
7. non-secret Canvas Entry 和 B runtime introspection；
8. 401/403/404/409/410/422/503、Request ID、retry 与 provider unavailable；
9. 无 Demo/Mock/localStorage fallback；
10. DOM/URL/Storage/console/network error/artifact 无 raw Grant/Token、digest、内部 snapshot、SQL 或 stack；
11. StoryCanvas tracked clean，B baseline attestation 仍成立。

Provider 不可用只证明安全失败和恢复，不外推媒体质量、LIVE 调用、SLA 或正式生产能力。

### 4.7 A-BIZ-06E.6 · Joint Gate Activation / Docs Closure

只有 06E.5 真实 Gate 零 SKIP 后才允许：

- `ab-golden-path` 从 `external`/slice-blocked 激活为 `ready`；
- 命令切到真实 deterministic runner；
- 移除 `AB_GOLDEN_PATH_NOT_IMPLEMENTED`；
- 保留 06F `MIGRATION_ROLLBACK_GATE_NOT_IMPLEMENTED` blocker；
- 更新 Pilot E2E README、C0 STATUS/HANDOFF/CHANGELOG 与桌面知识库；
- 不宣称 Full Joint Gate PASS 或 A-BIZ-06 COMPLETE。

## 5. 状态、错误、恢复与敏感信息

所有真实 Pilot 页面与 Gate 统一冻结：

- 真实 HttpOnly Session Cookie；401 清 Session/Project Context；
- 同 Scope 缺角色/能力为 403，跨 Tenant/Project/Package/Grant 探测为等价安全 404；
- stale/replay/idempotency conflict 为稳定 409，expired Entry/Grant 为 410，Schema 为 422，依赖不可用为 503；
- 所有安全错误保留 Request ID，不显示原始响应、内部原因、目标 ID 或 provider payload；
- loading、empty、ready、retrying、service error、invalid response 明确可见；
- retry 只重放相同幂等事实，不伪造新 Script/Storyboard/Package/Grant；
- Pilot 失败不得回退 Demo/Mock/localStorage；
- raw Session、Invitation/verification Token、Grant/accessToken、token digest、payload digest、内部 snapshot、password hash、SQL、stack 不得泄漏到浏览器或 artifact。

## 6. 验证矩阵

每个切片执行定向测试；06E 阶段收口至少执行：

```bash
npm run test:joint-gate:manifest
npm run test:joint-gate:plan
CONTROL_API_TEST_DATABASE_URL='<dedicated _test url>' npm run test:e2e:pilot
CONTROL_API_TEST_DATABASE_URL='<dedicated _test url>' npm run test:e2e:pilot:ab-golden-path
npm run test:contracts:pilot
npm --prefix apps/control-api test
npm --prefix apps/control-api run typecheck
npm --prefix apps/control-api run build
npm --prefix apps/storycanvas run test:<B-frozen-target>
npm --prefix apps/storycanvas run build
npm run build
npm run validate:governance
git diff --check
git diff -- apps/storycanvas
```

06E PASS 还要求：

- B baseline commit 已验证、已同步、tracked clean；
- PostgreSQL 与 Browser tests 零 SKIP；
- A/B contract fixture 与 payload digest 双端一致；
- Demo smoke 未被删除或改写成 Pilot 假成功；
- `migration-rollback-reapply` 未完成时 Full Gate 继续 BLOCKED。

## 7. 明确排除项

A-BIZ-06E 不实现：

- LIVE Payment、LIVE Commission、LIVE Settlement；
- 真实佣金比例、paid、提现、KYC、税务、发票或自动打款；
- 未规划的 Commission/Settlement review/approve HTTP；
- 正式 Provider 付费调用、媒体质量验收、生产 SLA；
- 任意 raw Grant 浏览器持久化或 URL handoff；
- 用 Script payload 内嵌 Demo Storyboard 替代 A-owned Storyboard approval；
- A 修改 StoryCanvas 或 B-owned Script/Storyboard/Canvas 文件；
- 修改、暂存、提交或删除 `apps/storycanvas/data/vendor/byteplus.ts`；
- push 当前分支。

## 8. 协作与阻塞规则

B handoff 必须给出：

1. 明确 commit SHA；
2. 该提交的 Wave 4 能力与测试清单；
3. StoryCanvas tracked clean 证明；
4. 需要 A 同步的 shared contract/route/bridge 提交；
5. 已知 Provider 环境限制。

在 B baseline 未满足前：

- 允许完成 06E.0 baseline attestation hardening；
- 允许起草/评审 06E.1 合同，但不得把未同步 B 行为固化为成功实现；
- 不执行 06E.3～06E.6；
- 可并行推进上游已允许的 06F A-owned migration/README 准备工作；
- 状态保持 `WAITING_FOR_B_BASELINE`。

## 9. 冻结结论

A-BIZ-06E 按以下顺序推进：

```text
06E.0 Baseline Attestation
→ 06E.1 Storyboard Authority / Bootstrap Contract
→ 06E.2 A Strict Client
→ 06E.3 B Pilot Pages
→ 06E.4 Shared Router / Bridge
→ 06E.5 Real Browser Golden Path
→ 06E.6 Joint Gate Activation
```

06E.0 baseline attestation 已完成。由于 B 尚未提供 Wave 4 clean baseline，06E.1 实现、Golden Path Browser Gate 与 phase 激活继续阻断；A 转入 06F A-owned migration/README 并行审计：

```text
A_BIZ_06E_0_COMPLETE / WAITING_FOR_B_BASELINE
FULL_JOINT_GATE_STILL_BLOCKED
```
