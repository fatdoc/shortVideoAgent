# A-BIZ-06E.R · Canvas Entry Internal Redemption 计划

- 日期：2026-08-11
- 负责人：工程师 A（Business / Control Plane）
- 分支：`dev/business-plane`
- 状态：`PLAN_FROZEN / READY_FOR_06E_R1_RED`
- 上游计划：`A_BIZ_06E_A_B_GOLDEN_PATH_JOINT_GATE_PLAN.md`
- 前置提交：`fed5580 feat(control-api): revalidate canvas entry authority`
- 协作基线：`origin/dev/production-plane@f68ac6a551231243d10978e9a798286672dd95e6`

## 1. 目标与阻断结论

本计划补齐 non-secret Canvas Entry 从浏览器交给 StoryCanvas server 后的服务端兑换链：

```text
Pilot Browser
→ non-secret Canvas Entry handle
→ StoryCanvas server
→ Control API internal redemption
→ exact Production Package v0.3 + canonical Project Grant + regenerated raw access token
→ StoryCanvas server-only runtime
```

现有 Browser HTTP 只提供：

```text
POST /api/v1/projects/:projectId/canvas-entries
GET  /api/v1/projects/:projectId/canvas-entries/:handle
```

`CanvasEntryService` / `PostgresCanvasEntryRepository` 虽已有 `consumeEntry`，但没有 internal HTTP route；其结果也只有 `grantId`，无法让独立 StoryCanvas 服务恢复完整 Package、Grant 和 raw token。现有 StoryCanvas v0.2 receiver 仍要求 raw bearer Grant 并调用 `/api/v1/internal/project-grants/introspect`。因此 A 侧 browser-safe authority contract 已完成，但 cross-plane redemption 尚未完成。

冻结状态必须纠正为：

```text
A_SIDE_BROWSER_CONTRACT_COMPLETE
CANVAS_ENTRY_REDEMPTION_CONTRACT_REQUIRED
B_06E_3_CANVAS_BLOCKED
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

在本计划 Green 且 B 同步 shared Bootstrap commit 前，不得激活 06E.4 Shared Router/Bridge，不得宣称 A/B Canvas Golden Path 已连通。

## 2. 冻结的 Internal HTTP 合同

### 2.1 Endpoint 与调用方

```text
POST /api/v1/internal/canvas-entries/redeem
```

唯一合法调用方是受信任的 StoryCanvas server。浏览器、Pilot React 页面、Demo Bridge 或任何公开客户端不得直接调用该 endpoint。

必须携带：

```http
X-Production-Plane-Internal-Token: <server-only secret>
Idempotency-Key: <stable redemption key>
Content-Type: application/json
```

请求 body 必须是 exact object：

```json
{
  "handle": "ce_<non-secret-handle>",
  "tenantId": "<canonical UUID>",
  "projectId": "<canonical UUID>",
  "packageId": "<canonical UUID>"
}
```

不得接受或猜测 `grantId`、raw Grant、access token、organizationId、Demo project ID、额外字段或浏览器本地 authority。

### 2.2 Server-only success DTO

成功响应只允许在 Control API 与 StoryCanvas server 之间传输，冻结为 exact object：

```json
{
  "objectType": "CanvasEntryRedemption",
  "contractVersion": "0.1",
  "handle": "ce_<non-secret-handle>",
  "tenantId": "<canonical UUID>",
  "projectId": "<canonical UUID>",
  "packageId": "<canonical UUID>",
  "consumedAt": "<ISO-8601>",
  "productionPackage": { "contractVersion": "0.3" },
  "grant": { "objectType": "ProjectGrant", "contractVersion": "0.2" },
  "tokenType": "Bearer",
  "accessToken": "<raw server-only token>",
  "replayed": false
}
```

完整 parser 必须校验 exact keys、UUID/handle/timestamp、Package v0.3、Grant v0.2、Package/Grant/Entry 的 tenant/project/package/grant exact binding，以及重新签发 token 与持久化 `token_digest` 一致。响应必须设置 `Cache-Control: no-store`。

`accessToken` 不持久化；Control API 使用持久化 Grant claims 与 `ProjectGrantTokenService` 确定性重签。该 DTO 不得进入浏览器响应、URL、DOM、React props、Storage、console、普通应用日志、错误 envelope、trace、截图或 Gate 报告。

### 2.3 安全错误语义

- `401`：internal token 缺失或不匹配；使用 constant-time digest comparison，不区分原因。
- `404`：handle 或 exact tenant/project/package binding 不存在；不得泄漏哪个维度不匹配。
- `409`：Entry 已由其他 idempotency key 兑换，或相同 key 的 request digest 不同。
- `410`：Entry/Grant/Package/Script/Storyboard authority 已过期、撤销、supersede 或 stale。
- `422`：Header/body schema 不合法、额外字段、非法 UUID/handle/idempotency key。
- `500`：未预期内部错误；安全 generic envelope。
- `503`：明确可识别的数据库/依赖暂不可用；安全 retryable envelope。

所有响应必须包含 Request ID，错误不得回显 internal token、Idempotency-Key 原值、raw token、grantId、token/payload/authority digest、Package snapshot、SQL、stack 或内部存在性判断。

## 3. 幂等与事务模型

Canvas Entry 仍是一次性 capability。为应对“数据库已提交但网络响应丢失”，同一个 redemption idempotency key 和同一个 request digest 必须能安全重放；不同 key 或同 key 不同 digest 必须稳定 `409`。

冻结 Migration 024 在 `control_plane.canvas_entries` 增加 nullable redemption facts：

```text
redemption_idempotency_key
redemption_request_digest
redeemed_by
```

约束：

1. `active` / `expired` Entry 的 redemption facts 必须全部为 null；
2. `consumed` Entry 必须同时具有 `consumed_at` 与三项 redemption facts；
3. redemption key 满足既有幂等键格式，digest 为 `sha256:<64 hex>`；
4. scope、create idempotency facts、redemption facts 一经写入不可变；
5. 只允许 `active → consumed|expired`；禁止 delete 与 consumed/expired 后续转换；
6. rollback 仅在不存在 Canvas Entry evidence 时允许，保持 fail closed；
7. migration contract latest 从 023 推进到 024，并覆盖 chain、fingerprint、up/down evidence。

单事务顺序冻结为：

1. 以 exact handle/tenant/project/package `FOR UPDATE` 读取 Entry；
2. 已 consumed 时只允许 exact redemption key + digest replay；
3. 检查 Entry expiry；
4. 复用 Production Authority verifier 校验 Package v0.3 与当前 Script/Storyboard authority；
5. exact grantId/package/project/tenant 读取 active Grant，并校验 Grant 覆盖 Entry 有效期；
6. 原子写入 `state=consumed`、`consumed_at` 与 redemption facts；
7. 在同一受控读取链中恢复完整 Package 与 Grant；
8. 提交后生成/返回 server-only token；若 token digest 不匹配则 fail closed，不返回部分成功。

实现不得允许“任意 internal caller 对 consumed handle 无限重放”，也不得在 consume 后创建新 Grant。

## 4. 原子实施切片

### 4.1 A-BIZ-06E.R1 · 合同与 RED

- 新增 internal route contract tests；
- 证明当前 `/api/v1/internal/canvas-entries/redeem` 为 404；
- 冻结 exact body/header、401/404/409/410/422/500/503、Request ID、`no-store` 与敏感信息 Oracle；
- RED 只提交测试/fixture，不混入 Green。

首个 RED：

> StoryCanvas server 只有 non-secret Canvas Entry handle、没有 raw Project Grant 时，必须能通过固定 internal endpoint 一次性兑换；当前 endpoint 不存在并返回 404，因此 Golden Path 仍 blocked。

### 4.2 A-BIZ-06E.R2 · Migration 024

- 增加 redemption facts 与完整 lifecycle check；
- 更新 immutable trigger；
- 更新 migration contract、lifecycle PostgreSQL tests、up/down rollback tests；
- Migration 独立提交，不混入 HTTP Bootstrap。

### 4.3 A-BIZ-06E.R3 · Repository / Service

- 扩展 Canvas Entry types/parser/errors；
- 由 Repository 原子 redeem，并复用现有 authority verifier；
- 增加 ProductionStore server-only grant/package restoration API，不伪造 SessionActor、不创建新 Grant；
- token 确定性重签并比对持久化 digest；
- 覆盖 create/consume/redeem 竞争、response-loss replay、different-key conflict、stale authority、token mismatch 与事务回滚。

该切片是 A-owned core，独立提交。

### 4.4 A-BIZ-06E.R4 · Internal HTTP / Shared Bootstrap

- 新增 `apps/control-api/src/canvasEntries/internalRoutes.ts` 及测试；
- 在 `apps/control-api/src/app.ts` 与 `apps/control-api/src/server.ts` 挂载；
- 复用现有 `productionPlaneInternalToken`，不新增浏览器配置；
- Bootstrap/共享合同独立提交并明确通知 B。

### 4.5 A-BIZ-06E.R5 · B Handoff

- 更新 A→B 合同文档，给出 endpoint、exact DTO、依赖 SHA 与测试证据；
- B 新增 server-side redemption client，并升级自己的 runtime parser 以消费 Package v0.3；
- B 不得修改 A-owned `apps/control-api/src/canvasEntries/**`；
- B 页面仍不得使用 `DemoProjectGrant`、`X-StoryCanvas-Demo-Grant`、Mock 或 LocalStorage fallback。

## 5. RED / GREEN 验证矩阵

至少覆盖：

1. missing/wrong internal token → 401，service 未调用；
2. missing/invalid/reused Idempotency-Key → 422/409；
3. body 缺字段、额外字段、非法 handle/UUID → 422；
4. unknown/cross-scope exact binding → 404；
5. active exact binding → 200，exact server-only DTO，`replayed=false`；
6. same key + same digest response-loss retry → 200，`replayed=true`；
7. different key 或 same key + different digest → 409；
8. expired/stale/revoked authority → 410，active Entry 持久化 expired；
9. concurrent redeem 只有一个首次消费，其余仅允许 exact replay；
10. Package/Grant/token digest mismatch → fail closed，无敏感信息；
11. database/internal failure → safe 500/503 + Request ID；
12. browser Canvas routes 不暴露或代理 internal redemption；
13. JSON/log/error Oracle 不包含 token、grantId、digest、snapshot、SQL、stack；
14. StoryCanvas tracked diff 始终为零。

## 6. Gate 与非目标

每个切片运行与其写集匹配的 targeted tests；最终至少运行：

```text
npm --prefix apps/control-api run test -- <targeted files>
npm --prefix apps/control-api run typecheck
npm --prefix apps/control-api run build
npm run validate:governance
npm run test:joint-gate:manifest
npm run test:joint-gate:plan
npx prettier --check <changed files>
git diff --check
```

不得执行或宣称 Full Joint Gate PASS。继续保留：

```text
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

本计划不实现：

- B-owned Pilot Script/Storyboard/Canvas 页面；
- Shared Router/Bridge 激活；
- StoryCanvas tracked 代码；
- LIVE Provider、媒体质量、付费生产、KYC、税务、提现或自动打款；
- 新的 review/approve HTTP；
- raw Grant 浏览器传输或任何 Demo fallback；
- Full Joint Gate activation。
