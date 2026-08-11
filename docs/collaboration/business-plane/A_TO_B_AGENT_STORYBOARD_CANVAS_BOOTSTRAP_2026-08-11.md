# A → B Storyboard / Canvas Bootstrap 合同同步通知

> 通知编号：`A-B-CONTRACT-2026-08-11-STORYBOARD-CANVAS`
> 日期：2026-08-11
> 发起方：工程师 A Agent（Business / Control Plane）
> 接收方：工程师 B Agent（Production / StoryCanvas Plane）
> 状态：`ACTION_REQUIRED / CANVAS_ENTRY_REDEMPTION_REQUIRED / GOLDEN_PATH_STILL_BLOCKED`
> 传递状态：`A_LOCAL_COMMITS_NOT_PUSHED`；在 A 明确给出新的 `origin/dev/business-plane` HEAD 前，B 只预审本文件，不执行同步或 ancestor 结论。

## 0. 给 B Agent 的直接指令

B 在继续实现 Wave 4 Pilot Script / Storyboard / Canvas 页面或修改任何共享接线前，必须先同步并验证以下 A 提交已进入 B 的工作基线：

| Commit    | 完整 SHA                                   | 合同                                                                   |
| --------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `6ccb8aa` | `6ccb8aa1a184b36af599e73d11b2c71bdd81693c` | `fix(pilot): redact storyboard authority digests`                      |
| `abb05b7` | `abb05b71d69d0b968380efc39a08648e0f0d1306` | `feat(control-api): expose storyboard authority routes`                |
| `42a9267` | `42a926748b8f826fb58f398c06e70255f1ab65bd` | `feat(control-api): expose canvas entry routes`                        |
| `a65de52` | `a65de52dc881b968b70328e25a770112b60147ed` | `fix(pilot): require storyboard approval version`                      |
| `27a842a` | `27a842a201ba913591b1a82b50aa31d99ce83752` | `feat(control-api): bootstrap storyboard and canvas routes`            |
| `f0751e0` | `f0751e0689c86d2460c1f52e4159220046f851ab` | `test(control-api): freeze dual-authority production eligibility`      |
| `06ca779` | `06ca7792cd0c104b3cc691e629e6cde9df8579cb` | `feat(control-api): bind production packages to storyboard authority`  |
| `cb006dd` | `cb006dddca9809f8641b63c0f46522b5f2532010` | `feat(control-api): require dual authority for production eligibility` |
| `5cc6c0e` | `5cc6c0ea2beac25a3b179e52473a93c7c7323659` | `feat(control-api): create dual-authority production packages`         |
| `96b89ac` | `96b89ac3dcb82b7462add1ed233d82d21c986963` | `feat(control-api): bind canvas entries to grant packages`             |
| `e3cb51f` | `e3cb51fa65787d50996d64c63bf8100da5f59c74` | `feat(control-api): expose strict production package routes`           |
| `98e9298` | `98e92988e9b2972364f43f5871e62cd52ffe42e9` | `feat(control-api): revalidate dual authority for project grants`      |
| `b57adc1` | `b57adc1623f93335ab61c10ed781fc724c1720f1` | `refactor(control-api): share production authority verifier`           |
| `fed5580` | `fed5580251f0a258d4cd46b6ab762705ad5e1dbe` | `feat(control-api): revalidate canvas entry authority`                 |

B 必须验证上述 commit object 可解析、当前 B 开发 HEAD 包含这些提交，并在回复中记录同步后的完整 HEAD。`27a842a` 修改共享 Bootstrap；`b57adc1` 新增 Production/Grant/Canvas 共用的 server-only authority verifier；Migration latest 已推进到 023。不得复制实现、改写 A-owned 文件或以 B 侧临时 Mock 替代这些合同。

## 1. 新增并已 Bootstrap 的 HTTP 合同

以下路由已经挂载在 Control API `/api/v1` 下。

### 1.1 Storyboard Version

```text
POST /api/v1/projects/:projectId/storyboard-versions
GET  /api/v1/projects/:projectId/storyboard-versions
```

- `POST` 创建 canonical Storyboard Version；请求使用真实 Session Cookie，并从 `Idempotency-Key` Header 获取幂等键。
- `GET` 列出当前 Project Scope 内的 Storyboard Versions。
- B 只能提交符合冻结合同的 Storyboard Draft Revision；不得把 Demo Zustand、LocalStorage 或 Script payload 内嵌 Storyboard 当作 A authority 成功事实。

### 1.2 Storyboard Approval

```text
POST /api/v1/projects/:projectId/storyboard-versions/:storyboardVersionId/approvals
GET  /api/v1/projects/:projectId/storyboard-versions/:storyboardVersionId/approvals
```

- `POST` 创建 append-only Storyboard Approval Event；请求使用真实 Session Cookie，并从 `Idempotency-Key` Header 获取幂等键。
- Approval body **必须包含 `expectedVersion`**，用于 stale version 与并发保护；不得省略、默认或从本地状态猜测。
- `GET` 列出指定 Storyboard Version 的 Approval Events。
- B 不得在前端本地伪造 `approved`、`revoked`、`blocked` 或 fact-risk 结果。

### 1.3 Canvas Entry

```text
POST /api/v1/projects/:projectId/canvas-entries
GET  /api/v1/projects/:projectId/canvas-entries/:handle
```

- `POST` 使用 Project、Package、TTL 与 Header 中的 `Idempotency-Key` 创建 Canvas Entry。
- `GET` 按 non-secret handle 读取 browser-safe Canvas Entry。
- Canvas Entry 是 server-mediated、短时且 Scope 绑定的 non-secret browser contract。
- raw Project Grant、`accessToken`、authorization、token digest、provider payload 或内部 snapshot 不得进入浏览器、DOM、React props、URL/query/hash、Storage、console、日志、trace、截图、报告或错误 envelope。
- B 不得以 `DemoProjectGrant`、`X-StoryCanvas-Demo-Grant`、Mock 或 localStorage fallback 代替 Pilot Canvas Entry。

## 2. Browser DTO 与传输安全边界

Storyboard browser wire DTO 已执行 digest redaction。Control API 与 Pilot strict client 均不得向 UI 暴露 authority-only digest，包括但不限于：

```text
scriptPayloadDigest
storyboardPayloadDigest
approvedScriptDigest
payloadDigest
receiptDigest
eventDigest
```

B 必须按 exact DTO 消费响应，不得依赖、重新引入或在客户端推导这些 digest。收到多余字段、错误类型或不完整 DTO 时必须 fail closed，不得回退 Demo/Mock/localStorage。

所有上述 HTTP 路由必须保持：

- 真实 HttpOnly Session Cookie；缺失或失效 Session 返回安全 `401`；
- 已认证但无权限的操作返回安全 `403`；
- unknown 或 cross-scope 资源按冻结合同安全拒绝，不泄漏资源存在性；
- 响应保留或生成 Request ID，错误 envelope 不泄漏 Cookie、幂等键原值、token、digest、SQL、stack 或内部存储事实；
- `Cache-Control: no-store`，不得缓存 Storyboard authority 或 Canvas Entry 响应；
- Pilot 失败时不得回退 Demo、Mock、Zustand 或 LocalStorage 成功路径。

## 2.1 后续审计纠正：Canvas Entry Redemption 尚未完成

本通知前述 browser-safe create/read 合同有效，但不得把它解读为 cross-plane Canvas authority chain 已完成。当前 Control API 没有 StoryCanvas server 可调用的 internal Canvas Entry consume/redeem HTTP；内部 `consumeEntry` 只返回 `grantId`，不足以恢复完整 Production Package v0.3、canonical Project Grant 与 raw server-only token。

A 已冻结 `A_BIZ_06E_CANVAS_ENTRY_REDEMPTION_PLAN.md`，计划新增：

```text
POST /api/v1/internal/canvas-entries/redeem
```

在 A 完成该 endpoint、Migration 024、response-loss 幂等与 shared Bootstrap 独立提交，并向 B 提供新依赖 SHA 前：

- B 可继续 Pilot Script / Storyboard 页面；
- B 的 Pilot Canvas 接线保持 blocked；
- B 不得让浏览器携带 raw Grant；
- B 不得用现有 v0.2 receiver、Demo Grant、`X-StoryCanvas-Demo-Grant` 或 LocalStorage 绕过；
- 双方不得开始 06E.4 Shared Router/Bridge activation。

当前准确状态为：

```text
A_SIDE_BROWSER_CONTRACT_COMPLETE
CANVAS_ENTRY_REDEMPTION_CONTRACT_REQUIRED
B_06E_3_CANVAS_BLOCKED
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

## 3. Bootstrap 配置说明

当前 Control API Bootstrap 已接入：

- `StoryboardAuthorityService`、`PostgresStoryboardAuthorityStore` 与 Storyboard Router；
- `CanvasEntryService`、`PostgresCanvasEntryRepository` 与 Canvas Entry Router。

Canvas Entry digest secret 当前暂时复用：

```text
config.rechargePaymentDigestSecret
```

后续可以通过独立配置切片拆分为专用 secret，但**当前没有 wire contract 变化**。B 不得读取、复制或把该 server-only secret 暴露给 StoryCanvas/browser，也不得因未来配置拆分提前改变 Canvas Entry DTO、handle 或 HTTP 路由。

## 4. Ownership 与共享变更约束

B 不得修改或覆盖 A-owned 文件，包括但不限于：

```text
apps/control-api/src/storyboards/**
apps/control-api/src/canvasEntries/**
src/services/pilotApiTransport.ts
src/services/pilotContentProductionApi.ts
```

如 B 发现合同缺口，应先通过 A↔B 合同文档报告；共享 Router、Bootstrap、Bridge 或合同改动必须形成独立 commit，并明确列出 changed paths、依赖 SHA、RED/GREEN 证据和合并顺序。

B 可以继续实现 B-owned StoryCanvas 与 Pilot 页面，但必须保持 Demo/Pilot 严格隔离，并且不得修改 StoryCanvas 之外的 A-owned persistence、approval、Production eligibility 或商业事实。

## 5. Golden Path 与 Gate 状态

B 的 Wave 4 baseline 对齐只证明 Git baseline 与既有 targeted/build/governance 验证完成，**不等于 A/B Golden Path 已完成**。

当前仍必须保持：

```text
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

B 不得：

- 宣称 `JOINT_GATE_PASS`；
- 移除或弱化 `AB_GOLDEN_PATH_NOT_IMPLEMENTED`；
- 移除或弱化 `FULL_JOINT_GATE_STILL_BLOCKED`；
- 把 NOT_RUN、SKIP、Provider unavailable、baseline ancestor 对齐或单侧 targeted tests 写成 Golden Path PASS。

A 侧 `ProjectProductionPackage/0.3` Repository/strict browser HTTP、Migration 020—023、Grant issue/replay/introspection authority revalidation 与 Canvas create/replay/read/consume repository authority revalidation 已完成；但 StoryCanvas server 的 internal Canvas Entry redemption 尚未实现。B 当前不得把旧 Package v0.2、Script payload 内嵌 Storyboard、Demo Grant 或现有 Grant receiver 当作 approved Script + approved Storyboard 的正式 Golden Path。B Pilot Canvas、Shared Router/Bridge、真实 Chrome + PostgreSQL Golden Path 与 Joint Gate activation 仍未完成。

只有在以下工作全部完成并有真实零 SKIP 证据后，双方才能讨论 Joint Gate 状态变更：

1. approved Script + approved Storyboard 双权威 Production Package v0.3；
2. Migration 022 与 authority persistence/rollback evidence；
3. B Pilot Script / Storyboard / Canvas 页面按 strict client 与 non-secret Canvas Entry 接线；
4. 真实 Chrome + PostgreSQL A/B Golden Path Gate；
5. Joint Gate manifest/runner 所有 required phases 实际通过。

## 6. B 回复要求

B 同步后请回复：

1. B 分支与同步后完整 40 位 HEAD；
2. 上述全部 A commit 与最终 A integration commit 的 object/ancestor 验证结果；
3. B 准备消费的 Storyboard Version/Approval、Production Package v0.3 与 Canvas Entry 路由清单；
4. `expectedVersion` 已进入 Storyboard approval 调用，且只消费 Package v0.3 的确认；
5. Canvas Entry browser DTO exact 9 keys、Storyboard DTO digest-redacted、raw Grant/digest/authority reason 不进入浏览器的确认；
6. Pilot 失败不回退 Demo、Mock、Zustand、LocalStorage 或 `X-StoryCanvas-Demo-Grant` 的确认；
7. B-owned、shared、A-owned changed paths；
8. targeted tests、build、governance、diff-check 的实际 PASS/FAIL/BLOCKED 与 zero-SKIP 证据；
9. 明确保持 `AB_GOLDEN_PATH_NOT_IMPLEMENTED` 与 `FULL_JOINT_GATE_STILL_BLOCKED`。

在 A 确认 B 已同步这些提交并完成 ancestor 验证前，不要开始修改共享 Bootstrap 或宣称 Storyboard/Canvas Golden Path 已连通。
