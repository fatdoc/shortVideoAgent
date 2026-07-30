# C4 REQUESTS

## REQ-C4-001 · 组织、成员与数据范围语义

- D1 决策：`RESOLVED_BY_C0`
- 决策依据：`COMMON_MEMORY` 事实 14、`T1_C0_SYNTHESIS_V0_1` 2.1
- 落实：Platform 与 ChannelOrganization 独立于 Tenant；Tenant 是生产内容隔离边界；渠道只有显式 Tenant Membership 才可获取项目生产授权。
- 后续：商业 MVP 的转移、支持授权和数据库 Schema 仍需 C1/C0 复核。

## REQ-C4-002 · 用量回执与账本动作映射

- D1 决策：`RESOLVED_FOR_DEMO`
- 落实：演示成功固定 reserve 120 / consume 100 / release 20；失败固定 reserve 80 / consume 0 / release 80；append-only、posting group 守恒、幂等重放。
- 后续：正式 meterCode、真实价格、成本精度和持久化事务仍开放到商业 MVP。

## REQ-C4-003 · 生产任务回执和项目令牌边界

- D1 状态：`PARTIALLY_RESOLVED`
- C4 已完成：可执行 Package/Grant/TaskReceipt/AssetReceipt/ExportReceipt、HTTP Bridge、pending Outbox poll/ack、canonical route 拒绝与错误语义。
- C5 待完成：实现集中定义的 `/packages`、`/receipts`、`/receipts/:id/ack`，并返回相同 fixture/package/task 来源链；C4 不读取 StoryCanvas SQLite。
- 临时方案：Grant 始终显式标记 `MOCK-CONTRACT`，只传非秘密 `mockHandle`，不包含真实签名令牌或 Provider Key。

## REQ-C4-004 · C5 Outbox 实际响应命名确认

- D1 状态：`RESOLVED_FROM_C5_CONSUMER_TRUTH`
- 已读取 C5 路由与 Adapter：统一解包 `{code,data,message}`；使用 `id/receiptType/businessId/payloadDigest/deliveryId/status/payload`，只接受 delivered。
- GET grant 只通过 `X-StoryCanvas-Demo-Grant: base64url(JSON)`；不再发送旧 grant query 或多套 header。
- C5 public row 若省略 project/package/digest，Bridge 只从当前已授权 accepted package 和 payload 补齐后校验；不从 URL、错误 ID 或第二套 fixture 推断。

## REQ-C4-005 · v0.1 静态合同套件何时刷新

- D1 状态：`WAITING_FOR_C0_SCOPE`
- 本轮运行时 Truth、ScriptApproval 与 receipt envelope 已增量修正，但 C0 明确禁止修改公共合同目录。
- 请求：C7 复审并冻结 C5 实际 envelope 命名后，由 C0 明确授权一次性从 C4 canonical 导出刷新 `docs/program/contracts/v0.1/`；禁止手写第二套事实。

## REQ-C4-006 · ACK-first 崩溃窗口

- D1 状态：`ACCEPTED_DEMO_RISK`
- C0 要求 ACK 成功后才允许本地入账，C4 已以 checkpoint 预演保证 ACK 失败零变化。
- 残余：浏览器在 C5 ACK 成功与内存 Adapter 提交之间崩溃时，C5 已 acknowledged、C4 尚未提交；生产版需持久 Inbox/事务协调，D1 不建设复杂微服务。

## REQ-C7-013 · Grant handoff identity 冻结

- D1 状态：`RESOLVED`
- `storycanvas:d1-grant-request`、`storycanvas:d1-grant`、`storycanvas:d1-ready` 统一使用：
  - `projectId=demo-local-001`
  - `packageId=package-demo-local-001-v1`
- request/ready 字段缺失或错值均进入 handoff error；仍强制 trusted origin 与刚打开子窗 `event.source`，grant 不进入 URL 或任何 Storage。
