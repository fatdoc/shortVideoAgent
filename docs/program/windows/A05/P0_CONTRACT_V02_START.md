# P0 启动提示词 · C01 Pilot Contract v0.2

你是 A-05 的 P0 合同与集成负责人。你只交付任务节点 `C01`。

## 必读

1. `docs/program/README.md`
2. `docs/program/COMMON_MEMORY.md`
3. `docs/program/A05_MULTI_WINDOW_TOP_LEVEL_DESIGN.md`
4. `docs/program/windows/A05/G0_CHECKPOINT.md`
5. `docs/program/INTEGRATION_CONTRACT.md`
6. `docs/program/contracts/v0.1/README.md`
7. `apps/control-api/src/db/migrations/001_pilot_core.ts`
8. `apps/storycanvas/src/domain/productionContract/v01.ts`

## 目标

建立与 D2 Demo `v0.1` 并存的真实试点合同 `v0.2`，禁止原地改写 Demo 合同。冻结：

- `ProjectProductionPackage`
- `ProjectGrant`
- `GenerationTaskCommand`
- `TaskReceipt`
- `AssetReceipt`
- `ExportReceipt`
- `UsageReceipt`
- `StandardError`
- HTTP header / Idempotency / Replay / ACK 语义

## 文件所有权

只允许新增/修改：

- `docs/program/contracts/v0.2/**`
- `docs/program/INTEGRATION_CONTRACT.md`
- 必要的 P0 状态文档

禁止修改：

- `apps/control-api/**`
- `apps/storycanvas/**`
- `src/**`

## 合同强制规则

- 不得硬编码 `demo-local-001`、C1–C8、海底捞或 15 分钟 Mock Grant。
- 所有跨平面对象包含 `contractVersion`、`tenantId`、`projectId`、`idempotencyKey`、时间字段和 payload digest。
- Grant 只允许 Tenant/Project/Capability/expiry 范围，不包含上游 Key、Wallet、客户价格。
- Receipt 不返回凭据，Provider 成本与客户额度分字段和责任域。
- 标准错误至少覆盖 schema、scope、grant、idempotency、provider、storage、timeout、cancel、receipt replay 和 credit settlement。
- 必须提供成功 fixture 、失败 fixture 和 negative vectors。

## 验收标准

- JSON 样例可被机器解析，字段语义不自相矛盾。
- A 只依赖合同即可实现 Package/Grant/Receipt Inbox。
- B 只依赖合同即可实现 Task/Asset/Export/Usage Receipt。
- 对相同幂等键同 payload 和不同 payload 有明确区分。
- 明确 Task 成功不等于额度 consume；只有 deliverable Asset 入账后才可 consume。
- `git diff --check` 和 Governance PASS。

## 交付

交付状态只能为 `READY_FOR_GATE` 或 `BLOCKED`，附：修改文件、合同版本、fixture 清单、验证命令、未决问题和建议提交信息。不推送、不合并 `main`。
