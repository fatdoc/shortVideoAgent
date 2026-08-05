# INTEGRATION CONTRACT · SaaS 与 StoryCanvas

> 当前真实试点合同：`v0.2 FROZEN / READY_FOR_GATE`
>
> Demo 兼容合同：`v0.1 MOCK-CONTRACT`
>
> 本文件定义语义边界，不承诺业务代码已实现全部对象。合同变更必须走联合 Gate，不得由单个平面单方修改。

## 版本路由

- 真实白名单试点只使用 `docs/program/contracts/v0.2/`。
- 现有 D2 Demo 继续使用 `docs/program/contracts/v0.1/`，不将 `demo-local-001`、Mock Grant 或 Demo 额度带入 v0.2。
- 发送方必须显式发送 `X-Contract-Version: 0.2`；接收方不得猜测版本。
- v0.2 机器可读 Schema、fixtures 和负例以 `docs/program/contracts/v0.2/README.md` 为入口。

## 共同标识

v0.2 所有跨平面对象必须包含：

- `objectType`、`contractVersion=0.2`。
- `tenantId`、`projectId`、`idempotencyKey`。
- `occurredAt`、`payloadDigest`。

其他稳定标识包括 `organizationId`、`packageId`、`scriptVersionId`、`shotId`、`assetId`、`generationTaskId`、`timelineVersionId`、`receiptId`。

`payloadDigest` 是去除顶层 `payloadDigest` 后按 RFC 8785 归一化所得的 SHA-256，格式为 `sha256:<lowercase hex>`。

## ProjectProductionPackage

必须包含：

- 项目与租户上下文。
- 场景 Agent 类型。
- Creative Brief。
- 品牌事实、禁用词、引用和风险规则快照。
- 已批准脚本版本。
- 镜头初稿与目标比例、时长、平台。
- 能力要求，但不是授权凭证。
- 过期时间和包版本。

生产包禁止出现 Wallet、RateCard、客户价格、客户额度、上游 API Key、明文 Access Token 或 Provider 凭证。

## ProjectGrant

- 由控制平面签发短期项目授权。
- 仅限 `tenantId/projectId/packageId/capabilities/scopes/issuedAt/expiresAt`。
- 合同中只保留 `tokenDigest/keyId`，明文 Bearer Token 仅通过 HTTPS `Authorization` 传输。
- 不包含上游 Key、Wallet、RateCard 或客户价格。

## GenerationTaskCommand

- 绑定 package、grant、shot、capability 和额度预留引用。
- 任务类型冻结为 `image.generate | video.generate | audio.tts`。
- 允许携带 Provider/Model 路由提示，不携带 Provider Key。
- 超时后调用方必须用原幂等键和原 payload 重试。

## TaskReceipt

必须回传：

- 任务 ID、项目 ID、镜头 ID。
- 任务类型、供应商、模型。
- 状态和进度。
- 输入摘要和引用资产 ID，不回传密钥。
- Provider 用量和 Provider 成本；不回传客户价格或客户额度。
- 输出资产 ID 或标准化错误。
- 任务成功只表示 Provider 执行完成，不等于资产可交付，更不等于客户额度消费。

## AssetReceipt

必须回传：

- 资产 ID、项目 ID、镜头 ID。
- 类型、MIME、尺寸、时长和校验值。
- 来源、模型、任务 ID、提示词摘要。
- 本地或远程存储引用。
- 权利说明、审核状态和版本。

`deliverable=true` 时必须已经完成审核并持有可验证的 checksum 与受 tenant/project scope 保护的存储引用。

## ExportReceipt

- 回传 timeline 版本、输入资产、MP4 媒体属性、checksum 和存储引用。
- 成功回执必须是可播放 `video/mp4 + h264`，并且 `deliverable=true`。
- 失败回执不得伪造 output asset、storage reference 或 checksum。

## UsageReceipt

- 只回传客观计量数量、Provider 成本、预留引用和可交付资产引用。
- `eligible` 必须至少引用一个已登记可交付资产。
- 最终计价、额度消费/释放和追加账本动作由控制平面决定。

## StandardError

错误包络统一为 `StandardError`，其 code 冻结为：

`SCHEMA_INVALID`、`TENANT_SCOPE_MISMATCH`、`PROJECT_SCOPE_MISMATCH`、`CAPABILITY_SCOPE_DENIED`、`GRANT_INVALID`、`GRANT_EXPIRED`、`IDEMPOTENCY_CONFLICT`、`PROVIDER_FAILED`、`STORAGE_FAILED`、`TASK_TIMEOUT`、`TASK_CANCELLED`、`RECEIPT_REPLAY_CONFLICT`、`RECEIPT_TASK_NOT_FOUND`、`CREDIT_SETTLEMENT_FAILED`。

错误不得包含密钥、明文 Token、签名 URL、完整 Provider 请求/响应、Prompt/脚本正文、跨租户资源存在性或客户商业信息。`message` 使用短消息目录，`details` 使用 Schema 允许列表，机器规则见 `contracts/v0.2/error-safety-policy.json`。正则仅是合同 Gate，业务 API、Worker、Provider Adapter 和日志仍必须经过 allowlist sanitizer。

## 额度状态机

```text
requested -> reserved -> consumed
                     \-> released
```

- 创建可计费任务前由控制平面 `reserved`。
- 成功并形成可交付资产后 `consumed`。
- 提交失败、供应商失败或取消后 `released`。
- 超额费用必须创建新的账本动作，不得覆盖旧流水。

## 授权

- 控制平面签发短期项目令牌，至少限定 tenant、project、capability、expiry。
- StoryCanvas 验证项目令牌，不信任前端传入的客户价格。
- 上游 API Key 只存在于服务端供应商适配层。

## Idempotency / Replay / ACK

- 相同 `idempotencyKey + payloadDigest` 必须返回已持久化结果，不产生第二次副作用。
- 相同幂等键不同 digest 返回 `409 IDEMPOTENCY_CONFLICT`。
- 相同 receipt ID 不同 digest 返回 `409 RECEIPT_REPLAY_CONFLICT`。
- `ReceiptAck(accepted|duplicate)` 只代表回执已持久写入 Inbox，不代表任务、资产审核或额度结算完成。
- 回执引用未知任务时固定返回 `404 RECEIPT_TASK_NOT_FOUND` 和 `ReceiptAck(rejected, durablyRecorded=false)`；不写入 durable Inbox，不产生任何额度动作。对外消息固定为 `Receipt cannot be accepted.`，不回显 task/tenant 存在性。
- 完整 HTTP header、Content-Digest、重放和状态码规则见 `contracts/v0.2/TRANSPORT_AND_REPLAY.md`。

## Demo Adapter

Demo 可以在 LocalStorage/Mock 中模拟上述合同，但字段名、状态机和错误语义不得另起一套。

v0.1 只用于现有 Demo 兼容；真实试点不得将 v0.1 Mock Receipt 或 Mock Grant 写入生产事实表。
