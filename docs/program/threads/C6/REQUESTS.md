# C6 REQUESTS

> 使用 `docs/program/templates/REQUEST_TEMPLATE.md`。

## REQ-C6-001 · D1 商业状态单一 fixture

- 发起人：C6
- 目标 Owner：C2 / C3 / C4
- 请求内容：联合提供 D1 唯一的 Product、Capability、Entitlement、演示 RateCard、Wallet 与 CreditLedger fixture；固定基础生成/本地生活为 active，数字人/API 为 locked，并包含成功任务“冻结 120、消费 100、释放 20”和失败任务“冻结 80、全量释放”的演示状态。
- 请求原因：四入口必须从同一商业状态解释已购/未购买和额度变化，不能由各页面各造一套数字。
- 影响领域/文件：D1 Demo Adapter、平台/渠道/企业工作台、额度与使用明细。
- 是否阻塞：是（阻塞 D1 端到端演示，不阻塞 C6 v0.1 文档评审）
- 临时方案：按 C0 已批准的演示样例在纯 Mock fixture 中实现，所有数字固定标记“演示数据 · 非正式报价”。
- 期望完成 Gate：D1
- C0 决策：待定
- 决策日期：待定
- 状态：RESOLVED_FOR_D1_MOCK（C4 commercial fixture 与 Store 已同步）

## REQ-C6-002 · 唯一海底捞生产包与跨平面回执

- 发起人：C6
- 目标 Owner：C4 / C5
- 请求内容：冻结并实现 D1 唯一 `demo-local-001` ProjectProductionPackage fixture、发包/接收、外部字符串 ID 映射、短期 Demo grant、GenerationTaskReceipt 与 AssetReceipt Mock Adapter；禁止 StoryCanvas 黄金路径回退到“南城咖啡”主数据。
- 请求原因：老板 Demo 必须证明控制平面与媒体生产平面消费同一项目事实，且任务/资产事实能驱动额度解释。
- 影响领域/文件：控制平面 Demo Adapter、StoryCanvas ProductionContractAdapter、任务/资产回执与返回导航。
- 是否阻塞：是（阻塞 D1 双平面闭环，不阻塞 C6 v0.1 文档评审）
- 临时方案：使用进程内 Mock Transport，但字段、状态、错误和幂等语义遵循 `INTEGRATION_CONTRACT.md` v0.1。
- 期望完成 Gate：D1
- C0 决策：待定
- 决策日期：待定
- 状态：PARTIAL（canonical package / Grant / receipts UI 已完成；C5 真实接收与 ID 映射开放）

## REQ-C6-003 · 可确定性生成、导出与来源链

- 发起人：C6
- 目标 Owner：C5
- 请求内容：提供 D1 可确定性演示的成功/失败生成任务、统一 MediaAsset 登记、基础合并导出、ExportArtifact 和来源链；真实供应商或 FireRed 不可用时，在同一海底捞项目内提供明确标识的可操作降级。
- 请求原因：关键操作不得以静态截图代替，且导出必须能追溯到包、脚本、镜头、任务和资产。
- 影响领域/文件：StoryCanvas 任务中心、资产中心、QA、导出与 Receipt Outbox。
- 是否阻塞：是（阻塞 D1 可播放交付闭环，不阻塞 C6 v0.1 文档评审）
- 临时方案：真实画布交互 + Demo 生成任务 + FFmpeg 基础合并；不得标为完整 FireRed AI 剪辑。
- 期望完成 Gate：D1
- C0 决策：待定
- 决策日期：待定
- 状态：PARTIAL（C4 确定性 receipts 与来源链已完成；C5 媒体生成、QA 与 ExportArtifact 开放）

## REQ-C6-004 · Receipt 传输头、ACK 与钱包时序复核

- 发起人：C6
- 目标 Owner：C4 / C7
- 请求内容：复核 17ce `storyCanvasBridge` 是否已采用固定 `X-StoryCanvas-Demo-Grant: base64url(JSON.stringify(grant))`；确认只有 tenant/project/package/task 匹配且 ACK 成功的 Receipt 才满足 D1 钱包变化证据口径。
- 请求原因：当前静态实现仍可见旧 `X-Demo-Grant-*`/query grant，且 Adapter 接收入账发生在 ACK 请求之前；C6 UI 不能越权改 service/store 或伪造钱包。
- 影响领域/文件：`src/services/storyCanvasBridge.ts`、`src/stores/controlPlaneStore.ts`、C7 Receipt/Credit Gate。
- 是否阻塞：是（阻塞双仓 Gate PASS，不阻塞 C6 UI 静态复核）
- 临时方案：C6 UI 明示 delivery/ack/retry，只展示 Store 投影，不自行结算；ack_error 不宣称 acknowledged。
- 期望完成 Gate：D1 P0
- C0 决策：待定
- 决策日期：待定
- 状态：RESOLVED_ROUND_3（C4 已实现固定 grant header、ACK 成功后 apply；ACK 失败零入账）

## REQ-C6-005 · 补齐渠道层级 active organization Membership

- 发起人：C6
- 目标 Owner：C4
- 请求内容：为 D1 需要切换的 MASTER / LEVEL_2 渠道 actor 提供有效 Membership，或明确这些 organization 仅展示不可切换。
- 请求原因：Round 3 UI 已使用真实 organization ID 调用 `switchActiveOrganization(id)`；当前 fixture 只有 channel level-1 Membership，其他渠道 ID 会被 C4 正确拒绝。
- 影响领域/文件：C4 commercial fixture、active organization context、C6 WorkbenchChrome。
- 是否阻塞：否（不阻塞 canonical level-1/tenant 演示；阻塞完整层级切换证据）
- 临时方案：Select 展示真实 ID，但对无 Membership 的 organization 明确禁用，不伪造角色或 scope。
- 期望完成 Gate：D1
- C0 决策：待定
- 决策日期：待定
- 状态：OPEN
