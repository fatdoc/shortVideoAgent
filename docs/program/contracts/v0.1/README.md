# D1 Static Contract Suite · v0.1

> 状态：`MOCK-CONTRACT / STATIC FIXTURE`  
> 合同版本：`0.1`  
> 唯一项目：`demo-local-001`  
> Fixture digest：`sha256:ecb4856cbceb568b931360335822e3beb590b6a8feefa07e773f3813d2552823`  
> 数据声明：`演示数据 · 非正式报价`

## 来源

本目录由 C4 D1 Foundation 工作树
`/Users/docfat/.codex/worktrees/ddad/videoagent`
中的 canonical TypeScript 导出一次性机械序列化生成。源 HEAD 为
`8d847adaa4f25b3531f882c7c3a9453e58dff8ba`，D1 Foundation 为该工作树未提交增量。

内容事实只来自现有 `DemoWorkspace / demo-local-001 / 海底捞北京三里屯`，没有手写第二套品牌、Claim、脚本或镜头主数据。生成脚本为临时文件，未保留在产品或治理目录。

源文件摘要：

```json
{
  "src/domain/controlPlane.ts": "sha256:b6b142bc90e0502b5a39faf5a4980fd8ea0ca20fad71273b64e5bd4aff5aaf74",
  "src/domain/controlPlaneSchemas.ts": "sha256:a86dd84e987f91dcf12db462a68926e501446f0e62b34ff05c216d7896f32e23",
  "src/domain/controlPlaneUtils.ts": "sha256:6080d8986f33a6031bd6d58282f87865b5d43c4bdb741990bacbaf5c5e5a9324",
  "src/domain/creditLedger.ts": "sha256:b8563967f796f716b085bff5ed36d9a7f9071f694082fe7751605e61a93fe6d2",
  "src/mocks/controlPlaneDemo.ts": "sha256:600fc5df4218e711c2d9e235f7af4336a2b3c5e6e837a3fa499fdfcfafacae8d",
  "src/services/controlPlaneMockAdapter.ts": "sha256:802a44e6f62222edbf0a1dd0ada26410583ee99aad611ed0301f4f45e3ab247b"
}
```

## 文件

- `project-production-package.json`：唯一海底捞生产包；含 C1—C8、批准 script-a、8 镜、基础生成和本地生活能力。
- `demo-project-grant.json`：15 分钟、明确标为 Mock 的项目 grant；`mockHandle` 不是凭证。
- `success-task-receipt.json`：成功任务，实际演示消费 100 额度。
- `success-asset-receipt.json`：成功任务对应的可交付 Demo 资产登记。
- `failure-task-receipt.json`：无可交付资产的确定性失败回执。
- `capability-truth-manifest.json`：REAL-UI / REAL-CAP / MOCK-CONTRACT / HYBRID / LOCKED / FALLBACK 单一真实性来源。
- `commercial-credit-fixture.json`：Platform、独立 ChannelOrganization、Tenant、Membership、产品能力、演示 RateCard、Wallet/Lot/Ledger 和 120/100/20、80/0/80 场景。
- `negative-vectors.json`：scope、tenant、幂等冲突、locked capability、余额不足五类 canonical 负例。

输出摘要：

```json
{
  "project-production-package.json": "sha256:1e73bf56b39cda4470db553795750b39629ad62584f44bc738d8dfa565b81cec",
  "demo-project-grant.json": "sha256:dd5bd3ddb9d5ae85eb5d7c67ea4028922d885a42d70494489bf964a4f4fe14cf",
  "success-task-receipt.json": "sha256:34c25bad6ed190bd6605b73d3f3fcf7b73d517f8440d7dc6619ffd8ad042bc06",
  "success-asset-receipt.json": "sha256:f972ffcc5024a4c3c27439abf44f5a064dff034efffeaec9076b9e768f95d45d",
  "failure-task-receipt.json": "sha256:181a25dbd7230e87665603c737d74eb5875a28e1b913fb6c00d1378c100a6560",
  "capability-truth-manifest.json": "sha256:4ecb1a519518a820d383c962821fec9113eabd5a910b91f0f307ea0006216a02",
  "commercial-credit-fixture.json": "sha256:adb63e4ac431a771f30c791a461f5e51551149f81e2541ea33734ce4f4357d37",
  "negative-vectors.json": "sha256:227158732863147ba35823cae8c0be16440dcea45d8177176f33ea7f397fb8ca"
}
```

## 字段与边界

- Platform、ChannelOrganization 与企业 Tenant 独立；ChannelOrganization fixture 不含 `tenantId`。
- Tenant 是 Brand、Store、Project、Script、Asset 和生产内容的隔离边界。
- grant 的 `organizationId` 仅表示当前操作主体并用于审计，不能替代 `tenantId`。
- 渠道商业关系不能替代显式 Tenant Membership 或项目 scope。
- 生产包禁止携带 Wallet、CreditLedger、RateCard、客户平台价格、Provider Key 或明文 token。
- 门店 Claim C3/C4 中的套餐金额是既有品牌事实，不是平台客户报价。
- 所有额度和商业 fixture 带 `DEMO / NON_QUOTE / 演示数据 · 非正式报价`。
- `requested -> reserved -> consumed | released` 是额度状态；任务状态与额度状态不可合并。

## 真实性与安全

- 本套件是静态 `MOCK-CONTRACT`，不是生产后端、真实交易或真实签名安全证据。
- `demo-project-grant.json` 只有非秘密 `mockHandle`，没有 `accessToken`。
- 所有文件均不包含 Provider Key、平台 Key、真实支付信息或 StoryCanvas SQLite 路径。
- `REAL-CAP` 只描述已有 StoryCanvas 能力基础；`projectIntegrated=false` 时不能作为海底捞跨仓接线完成证据。

## 消费约定

StoryCanvas/C5：

1. 先读取并校验生产包的 `contractVersion/projectId/tenantId/digest`。
2. 建立外部字符串 ID 到 StoryCanvas 内部 ID 的稳定映射，不修改历史整数主键。
3. 成功 TaskReceipt 到达后保持 reserved；只有对应 AssetReceipt 被登记为 deliverable 后，控制平面才消费 100 并释放 20。
4. 失败回执没有 output asset，控制平面全量释放 80。
5. 生产平面不得读取商业 fixture 或自行修改 Wallet/Ledger。

C7：

1. 将 JSON 文件摘要、fixture digest 和合同版本绑定到证据。
2. 同 payload 重放应为 duplicate；同 idempotency key 不同 payload 应为 `IDEMPOTENCY_CONFLICT`。
3. 负例中的 authorization/body 不能覆盖 grant 的 tenant/project 范围。
4. 本目录未运行测试或 Schema 验证，不能单独作为 D1 Gate PASS 证据。
