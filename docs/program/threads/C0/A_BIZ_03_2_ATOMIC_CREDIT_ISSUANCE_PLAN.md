# A-BIZ-03.2 · Payment Event 原子应用与额度发行计划

- 日期：2026-08-08
- 负责人：工程师 A（业务平台）
- 分支：`dev/business-plane`
- 状态：`PLAN_FROZEN / 03_2A_COMPLETE / 03_2B_PENDING`
- 上游依据：`A_BIZ_00_3_REGISTRATION_TERMS_BILLING_ADR.md`（ACCEPTED）
- 前置完成：A-BIZ-03.1A～03.1C（RechargeOrder、PaymentEvent Inbox、TEST Adapter 与 HTTP Bootstrap）

## 1. 本节点目标

把已经验证并写入 Inbox 的 `payment_succeeded` TEST PaymentEvent，以单一 PostgreSQL 事务应用为：

1. PaymentEvent `received → applied`；
2. RechargeOrder `created → pending → paid`，并追加对应 Order Event；
3. 购买额度与可选赠送额度分别形成可追踪 Credit Lot；
4. 每个 Lot 分别追加一条 `issue / available` Credit Ledger Entry；
5. Provider Event 重放返回同一最终结果，不重复 Order Event、Lot 或 Ledger；
6. 任一步失败全部回滚，不允许只 paid、只发额度或只更新 Inbox。

本节点仍是 TEST 能力。响应、日志和文档不得把 TEST Event 描述为真实收款。

## 2. 已冻结边界

### 2.1 03.2 负责

- TEST `payment_succeeded` 的原子应用；
- PaymentEvent、RechargeOrder、Order Event、Credit Lot、Credit Ledger 的一致性；
- 购买额度永不过期；
- 赠送额度按订单冻结的 `bonusExpiresInDays` 计算到期时间；当前 TEST Rule fixture 使用业务已批准默认 90 天，工程代码不硬编码真实 SKU 数字；
- 同 Provider identity/digest 并发与串行 replay 零重复；
- Wallet、Order、Payment Event 全部锁定并验证 Tenant/Mode/Amount/Currency；
- stable applied/rejected 处理结果和安全错误码。

### 2.2 03.2 不负责

- LIVE Provider、微信/支付宝、真实商户配置与真实回调原文；
- Commission Rule、Accrual、Reversal 或 Settlement；
- refund/chargeback 的额度回收与佣金冲正；
- Credit Reservation 消耗算法、到期清理任务或前端余额投影；
- 正式 SKU 价格、额度数量、佣金比例、退款观察期；
- B 的 StoryCanvas、媒体 Provider 或生产画布文件。

## 3. 增量 Schema：migration 015

新增 `015_atomic_credit_issuance.ts`。

### 3.1 `credit_lots`

每次成功订单最多生成两个不可删除来源批次：

- `PURCHASED`：`original_credits = RechargeOrder.purchased_credits`，`expires_at = null`；
- `BONUS`：仅当 `bonus_credits > 0` 创建，`expires_at = PaymentEvent.occurred_at + bonus_expires_in_days`。

最小字段：

- `credit_lot_id`
- `tenant_id` / `wallet_id`
- `recharge_order_id`
- `source_payment_event_id`
- `conversion_rule_version_id`
- `lot_type: PURCHASED | BONUS`
- `original_credits > 0`
- `issued_at`
- `expires_at`
- `created_at`

约束：

- Wallet 必须属于 Tenant；
- PaymentEvent 必须属于 RechargeOrder；
- Rule、Tenant、Wallet 与订单冻结事实一致；
- 同一 `source_payment_event_id + lot_type` 唯一；
- PURCHASED 不过期；BONUS 必须有晚于 issuedAt 的到期时间；
- Lot 来源事实禁止 update/delete。

### 3.2 Credit Ledger 关联

给 `credit_ledger_entries` 增加可空 `credit_lot_id` 外键，兼容历史 Pilot 分录。

充值发行分录必须满足：

- `operation = issue`
- `bucket = available`
- `delta = lot.original_credits > 0`
- `reference_type = recharge_order`
- `reference_id = RechargeOrder UUID`
- `actor_type = system`
- `actor_id = test-payment`
- reason 分别为 `recharge_purchase_issued` / `recharge_bonus_issued`
- 每个 Lot 只允许一条发行分录。

03.2 不把钱的金额写入 Credit delta，也不把 Provider Token 当 AI Credit。

### 3.3 PaymentEvent 处理证据

给 `payment_events` 增加 `processed_at`：

- `received`：`processed_at = null`、`error_code = null`；
- `applied`：`processed_at != null`、`error_code = null`；
- `rejected`：`processed_at != null`、`error_code != null`。

增加安全错误码：

- `invalid_order_state`
- `wallet_unavailable`
- `credit_issuance_conflict`
- `unsupported_event_type`
- `internal_processing_error`

原始 PaymentEvent identity/facts 继续不可修改；terminal processing evidence 不可再次改变。

## 4. 原子处理算法

Repository 在接收规范化 TEST Event 后进入一个事务：

1. 对 `providerCode + providerEventId` 取得 advisory lock；
2. 若 identity 已存在：
   - digest 不同：409 conflict；
   - digest 相同：返回已保存的 terminal/received 结果，不执行副作用；
3. 锁定 RechargeOrder 与 Wallet，验证 mode/amount/currency；
4. 插入 PaymentEvent `received`；
5. 对 `payment_succeeded`：
   - 只接受 Order `created` 或 `pending`；
   - Wallet 必须 active；
   - 若为 `created`，先更新 `pending` 并追加无 Payment source 的 pending Event；
   - 创建 PURCHASED Lot 与对应 Ledger；
   - 有赠送额度时创建 BONUS Lot 与对应 Ledger；
   - 更新 Order `paid` 并追加以当前 PaymentEvent 为 source 的 paid Event；
   - 更新 PaymentEvent 为 `applied` 并写 `processed_at`；
6. 本节点收到 `payment_failed`、`refund_succeeded`、`chargeback_succeeded` 时不猜测业务：PaymentEvent 标记 `rejected / unsupported_event_type`，订单与额度保持不变；
7. 任何 SQL/约束/并发异常使整个事务回滚；未知异常只向外暴露安全错误。

## 5. Replay、并发与乱序语义

- 同 identity + 同 digest：返回原事件与原应用结果，`replayed=true`；
- 同 identity + 不同 digest：`PAYMENT_IDEMPOTENCY_CONFLICT`；
- 第二个不同 identity 的 `payment_succeeded` 指向已 paid Order：事件保留为 `rejected / invalid_order_state`，不重复发行；
- refund/chargeback 在 03.3 冲正模型完成前稳定 rejected，不创建负额度；
- 同订单并发 succeeded 由 Order row lock 串行化，最多一个事件 applied；
- 失败后重试不得观察到半成品 Order Event、Lot 或 Ledger。

## 6. 切片与提交

### A-BIZ-03.2A · Schema / Migration 015

- 先增加 PostgreSQL RED 合同测试；
- 实现 Credit Lot、Ledger 关联、Payment processed evidence 和不可变约束；
- 不修改 HTTP Bootstrap。

建议提交：

```text
feat(control-api): add atomic credit issuance schema
```

### A-BIZ-03.2B · Repository / Service 原子应用

- 扩展 Payment Foundation Store result；
- TEST succeeded 原子落 Order/Lot/Ledger/Event；
- replay、并发、第二成功事件、Wallet 冻结和 unsupported event 测试；
- 保持 LIVE 503 fail closed。

建议提交：

```text
feat(control-api): apply test payments atomically
```

### A-BIZ-03.2C · HTTP 语义与只读结果

- 现有 Internal TEST Event endpoint 返回 applied/rejected 结果；
- Tenant RechargeOrder 查询可看到 paid 摘要，但不暴露 Provider 敏感字段；
- 如需新增只读 Credit issuance 投影，必须保持 Tenant Scope 与 bounded list；
- 共享 App/Config/Server 非必要不改。

建议提交：

```text
feat(control-api): expose test credit issuance results
```

## 7. Gate

每个切片至少运行：

```bash
npm --prefix apps/control-api run typecheck
npm --prefix apps/control-api run build
npm --prefix apps/control-api test -- --pool=forks --maxWorkers=1
npm run validate:governance
git diff --check
```

PostgreSQL 测试必须使用专用 `_test` 数据库并单 worker。并发测试必须证明：一个 Order 最多产生一组 purchased/bonus Lot 与对应 Ledger。

## 8. A/B 与 Git 边界

- A 只修改 `apps/control-api/src/payments/**`、migration `015`、A 测试与 C0 文档；
- 不修改 `apps/storycanvas/**`；未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 始终排除；
- 每切片显式 `git add <files>`，禁止 `git add .`；
- 每切片独立 commit；未经用户要求不 push；
- 03.2 若不修改共享 Bootstrap，B 无需等待；合入 main 后 B 只需正常同步。

## 9. 完成定义

03.2 完成必须同时满足：

- TEST succeeded 后 Event applied、Order paid、Lot/Ledger 一致；
- 同事件 replay 和同订单并发均零重复；
- unsupported/乱序事件不产生额度；
- 任意失败无半到账；
- 购买/赠送额度批次与到期证据可审计；
- LIVE、Commission、退款与真实商业数字继续 fail closed；
- PostgreSQL、Service、Router、Typecheck、Build、Lint、Governance 与 diff-check 有真实证据；
- STATUS、HANDOFF、CHANGELOG 和桌面项目记忆同步。

## 10. 当前进度

- A-BIZ-03.2A 已完成：migration `015_atomic_credit_issuance.ts` 建立 Credit Lot、Ledger Lot 关联、PaymentEvent `processed_at` 与 terminal evidence 约束。
- purchased/bonus Lot 严格绑定同一 Order、Payment Event、Wallet、Tenant、Rule 与冻结额度；购买额度不过期，赠送额度按冻结天数计算到期。
- Recharge issue Ledger 必须与 Lot、Order、Provider、posting group、reason、delta 和 occurredAt 一致；历史无 Lot 的 Pilot Ledger 保持兼容。
- rollback 在存在 Lot、关联 Ledger 或 processed Payment evidence 时 fail closed；空 Schema 可回滚到 migration 014。
- RED：缺失 migration 015 时合同测试无法加载；Green：015 定向 5/5，迁移链 001～015 与定向合计 6/6。
- Control API 全量 Gate：44 files / 273 tests PASS；typecheck、build、定向 ESLint、Governance、`git diff --check` PASS。
- 下一步进入 03.2B：先补 Repository 原子应用 RED，随后实现 TEST succeeded 的 Event/Order/Lot/Ledger 单事务和 replay/并发语义。
