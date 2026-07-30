# C4 HANDOFF · D1 P0 FIX WAVE ROUND 3

- 仓库与工作树：`/Users/docfat/.codex/worktrees/ddad/videoagent`
- 分支与基线：detached HEAD / `8d847adaa4f25b3531f882c7c3a9453e58dff8ba`
- Commit：无；本轮禁止提交
- 合同版本：`0.1`
- Truth release：`D1-FOUNDATION-MOCK`
- Fixture：唯一 `demo-local-001`；由现有 `DemoWorkspace` 派生
- 已完成：
  - `src/domain/controlPlane.ts`：全部 D1 数据类型
  - `src/domain/controlPlaneSchemas.ts`：无依赖运行时 Schema
  - `src/domain/creditLedger.ts`：额度纯函数、重建和 posting group 守恒
  - `src/mocks/controlPlaneDemo.ts`：商业 fixture、canonical Package/Grant/Receipts/Truth Manifest
  - `src/services/controlPlaneMockAdapter.ts`：批准、额度和回执的内存控制平面 Adapter
  - `src/services/storyCanvasBridge.ts`：集中 HTTP transport、发包、重试、Outbox poll/ack
  - `src/services/activeOrganization.ts`：持久 active organization 与授权工作台上下文
  - `src/services/canonicalRouteGuard.ts`：canonical tenant/project 安全拒绝，不做自动映射
  - `src/services/demoExperienceReset.ts`：Workspace + ControlPlane + Bridge 原子 reset/rollback
  - `src/stores/demoExperienceStore.ts`：C6 唯一 `resetDemoExperience()` 调用入口
  - `src/stores/controlPlaneStore.ts`：批准、Bridge、bootstrap、receipt 同步和错误状态
  - `src/stores/projectStore.ts`：兼容旧 `reset()`，内部只委托原子编排
- 明确未修改：业务页面、UI、StoryCanvas、公共共同记忆、公共集成合同、其他员工目录
- 验证：按指令未运行测试、构建、lint、类型检查或治理验证

## C5 精确接手

1. C5 HTTP 合同入口统一在 `STORYCANVAS_ENDPOINTS`：
   - `POST /packages`，body 严格为 `{ package, grant }`
   - `GET /receipts?projectId=...&status=pending|delivered`，grant 只在 `X-StoryCanvas-Demo-Grant: base64url(JSON)` header
   - `POST /receipts/:id/ack`，body 严格为 `{ grant, deliveryId }`
   - API base 默认 `http://localhost:10588/api/production/v0.1`，可由 `configureStoryCanvasBaseUrl()` 改写
2. StoryCanvas 只消费：
   - `tenantId / organizationId / projectId`
   - `creativeBriefSnapshot`
   - Claim `C1—C8` 与风险规则
   - approved `script-a`
   - 8 个 `shotDrafts`
   - `capabilityGrants`
   - `contractVersion / idempotencyKey / digest`
3. 禁止生产侧读取或复制：Wallet、CreditLedger、RateCard、客户价格、渠道树、Provider Key、明文 token。
4. Mock grant：
   - `DemoProjectGrant.mock=true`
   - `mockHandle` 不是 credential
   - 校验 `tenantId/projectId/packageId/capability/scopes`
   - `organizationId` 仅作当前操作主体与审计，不能替代 `tenantId`
5. 回执正例：
   - `createCanonicalSuccessTaskReceipt()`
   - `createCanonicalSuccessAssetReceipt()`
   - `createCanonicalFailureTaskReceipt()`
   - 先提交成功 TaskReceipt 时额度仍 reserved；对应 AssetReceipt 登记后才 consume 100 + release 20
   - 失败 TaskReceipt 无 output asset，立即 release 80
6. Outbox 使用 C5 `id / receiptType / businessId / payloadDigest / deliveryId / delivered / payload`；完整校验 tenant/project/package/digest/task。
7. C4 按 generation-task → asset → export 排序；每条先 checkpoint 预演，再 ACK `{grant,deliveryId}`，确认 C5 Envelope `data.status=acknowledged` 后才提交本地 Adapter。
8. ACK 失败时 Task/Asset/Credit 零变化；不得显示“已入账”。delivered 会在下次调用按 C5 retry 语义重取。
9. Package 与 Receipt 响应均统一读取 `{code,data,message}`；重复包读取 `data.result=duplicate` 或 `data.duplicate=true`。
10. C5 accepted/duplicate 后才允许打开 deepLink；URL 不承担发包或 grant 传递。
9. C5 若实际字段命名需微调，只在 `StoryCanvasBridge` 集中转换；不要要求 C6 页面散落兼容。

## C6 精确接手

1. 控制平面 UI 唯一状态入口：`useControlPlaneStore`；整体验证/重置入口：`resetDemoExperience()`（`src/stores/demoExperienceStore.ts`）。
2. 产品状态：
   - 基础生成、本地生活：`active / usable`
   - 老板 IP、电商：`explanation_only / explain`
   - 数字人、API：`locked`
3. 所有额度读取 `DemoCreditValue`，固定展示 `演示数据 · 非正式报价`；不得把数值转写成正式价格。
4. 脚本批准动作：
   - `approveCanonicalScript(approvedBy, approvedAt)`
   - `revokeCanonicalScript(revokedBy, revokedAt)`
   - `blockCanonicalScript(reason, factRiskIds, blockedBy, blockedAt)`
   - 发包前必须读取 `snapshot.scriptApprovals`；未批准、blocked、事实风险未解除都会明确失败
5. Bridge 动作：
   - `bootstrap()`：固定返回 `{ status, snapshot, transport, retryable, error }`
   - `configureStoryCanvasBaseUrl(baseUrl)`
   - `dispatchCanonicalPackage()`
   - `retryCanonicalPackage()`
   - `syncStoryCanvasReceipts()`
   - `openStoryCanvas()`：打开白名单子窗并完成内存 grant request/ready handoff
   - `clearStoryCanvasHandoff()`
   - `storycanvas:d1-grant-request` 与 `storycanvas:d1-ready` 必须显式携带 `projectId=demo-local-001`、`packageId=package-demo-local-001-v1`
   - C4 返回的 `storycanvas:d1-grant` 顶层同样携带上述 identity；字段缺失或错值直接进入 handoff error，绝不置为 ready
   - 状态读取 `snapshot.transport`、`bootstrapResult`、`lastPackageDispatch`、`lastReceiptSync`
   - 同步 success receipt 前先调用 `reserveCanonicalSuccess()`；同步 failure receipt 前先调用 `reserveCanonicalFailure()`，否则 Adapter 会以缺少 reservation 安全拒绝且不入账
   - `issueCurrentGrant()` 每次按当前时刻签发 15 分钟 grant；dispatch/retry/sync 自动重新签发
6. Active organization：
   - `activeOrganization`
   - `switchActiveOrganization(organizationId)`
   - 读取 `workbenchKind / roleCodes / tenantId / projectIds / menuContext`
   - `workbenchKind` 只是展示/路由类型，绝不能作为 organization ID
   - platform/channel active 时生产动作会明确拒绝；切回 `tenant-demo-hdl` 才具备 canonical project 执行上下文
7. canonical 本地动作：
   - `createCanonicalPackage()`
   - `issueCanonicalGrant()`
   - `reserveCanonicalSuccess()`
   - `acceptCanonicalSuccessTaskReceipt()`
   - `acceptCanonicalSuccessAssetReceipt()`
   - `reserveCanonicalFailure()`
   - `acceptCanonicalFailureTaskReceipt()`
   - `runCanonicalSuccess()`
   - `runCanonicalFailure()`
   - 旧 `resetDemoReady()` 仅为兼容别名，也会委托 `resetDemoExperience()`
8. 重置：
   - C6 必须调用 `resetDemoExperience()`，不得分别调用 project/control store reset
   - 返回 `ok: true` 才能显示 `DEMO_READY`
   - `ok: false` 已恢复旧 Workspace、ControlPlane 与 Bridge 快照，展示 `RESET_FAILED/error`
   - `projectStore.reset()` 现在直接返回 `DemoExperienceResetResult`，C6 必须读取返回值
9. 关键错误码：
   - `ACTION_SCOPE_DENIED`
   - `TENANT_SCOPE_MISMATCH`
   - `IDEMPOTENCY_CONFLICT`
   - `CAPABILITY_LOCKED`
   - `CAPABILITY_NOT_ENTITLED`
   - `INSUFFICIENT_CREDITS`
   - `SCRIPT_NOT_APPROVED`
   - `SCRIPT_APPROVAL_BLOCKED`
   - `FACT_RISK_UNRESOLVED`
   - `ROUTE_ID_REJECTED`
   - `TRANSPORT_REJECTED`
   - `TRANSPORT_OFFLINE`
   - `GRANT_EXPIRED`
   - `GRANT_SCOPE_MISMATCH`
   - `HANDOFF_ORIGIN_REJECTED`
   - `HANDOFF_TIMEOUT`
   - canonical 负例描述由 `canonicalControlPlaneErrorVectors` 单一导出
10. Truth UI 必须读取 `snapshot.truthManifest`；`storycanvas:d1-ready` 后 phase 为 `handoff_ready`、`projectIntegrated=true`，超时/error 不得写死 ready。

## 未完成

- 业务页面与四工作台 UI。
- C5 生产侧端点与其内部字符串 ID 映射实现（C4 只做 canonical 外部 ID 拒绝）。
- C5 当前只生产 generation-task/asset Outbox；export receipt 仍为兼容预留。
- 真实签名项目令牌、后端持久化、密钥、审计服务和微服务。
- 任何运行验证与 C7 Gate 证据。

## 仍开放 P0

- C4 代码侧：无已知开放 P0。
- 跨仓 Gate：C5 尚未实际联通，因此 Truth 初始必须是 `HTTP_NOT_CONNECTED`；C7 需在集成工作树复核 accepted/duplicate/rejected、ack 重放和 reset 失败回滚。
- 静态合同套件：本轮无权限修改公共 `contracts/v0.1`；待 C0 处理 `REQ-C4-005` 后再从 canonical 导出刷新，不能手改第二套 fixture。
- ACK-first 崩溃窗口见 `REQ-C4-006`；D1 保持内存 Demo，不扩张为持久 Inbox 或微服务。
