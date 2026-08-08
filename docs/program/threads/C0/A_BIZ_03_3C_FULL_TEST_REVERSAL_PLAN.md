# A-BIZ-03.3C · TEST 全额退款/拒付原子冲正计划

- 日期：2026-08-08
- 负责人：工程师 A（业务平台）
- 分支：`dev/business-plane`
- 状态：`IMPLEMENTED / GATE_PASSED / COMMITTED`
- 实现基线：`61e8b67 feat(control-api): accrue test payment commissions atomically`
- 前置：A-BIZ-03.3B 已把 TEST succeeded Payment、Order、Credit 与 Commission Outcome/Accrual 接入单一 PostgreSQL 事务

## 1. 本切片目标

只为 TEST `refund_succeeded` 与 `chargeback_succeeded` 实现一个可证明安全的全额冲正子集，使一次可安全应用的 Event 在同一 PostgreSQL 事务内完成：

1. PaymentEvent `received → applied`；
2. 原 RechargeOrder 的 purchased/bonus Credit Lot 各追加一条完整 `reclaim` Ledger 事实；
3. 原 succeeded Payment 如有 Commission Accrual，则追加一条全额 Commission Reversal；
4. refund 把 Order 从 `paid → refunded`，chargeback 把 Order 从 `paid → disputed`；
5. 追加与终态一致的 RechargeOrderEvent；
6. 任一校验或写入失败时回滚 PaymentEvent、Credit、Commission、Order 与 OrderEvent 全部事实。

这不是通用退款系统。首版只接受“原订单额度从发行后没有任何冻结、消费、释放、调整或回收证据”的保守安全子集。

## 2. 现状审查结论

### 2.1 已具备

- RechargeOrder 状态机已允许 `paid → refunded/disputed`；
- PaymentEvent 类型已包含 `refund_succeeded` 与 `chargeback_succeeded`；
- RechargeOrderEvent 已包含 `refunded/disputed`，且要求引用同 Order 的 PaymentEvent；
- Credit Lot 冻结 Order、Wallet、原 succeeded Event、额度数量与发行时间；
- Commission Reversal 表已存在，使用原 Accrual row lock 防止累计冲正超过原计提；
- Provider identity replay、同 Order 行锁、PaymentEvent terminal evidence 和事务回滚基础已存在。

### 2.2 必须补齐

- `credit_ledger_entries.operation` 尚无 `reclaim`；
- migration 015 的 Lot-linked Ledger validator 当前只接受唯一 `issue`；
- PaymentEvent amount validator 当前要求所有 Event 与 Order 金额完全相等，无法保存部分退款的稳定 rejected 审计事实；
- Repository 当前把 refund/chargeback 统一拒绝为 `unsupported_event_type`；
- Commission Reversal validator 尚未要求来源退款/拒付 Event 已 `applied`；
- 当前 Lot 级 reserve/consume 分摊不存在，且 Pilot Ledger 的历史 reserve/consume/adjust 可以不带 `credit_lot_id`，所以不能只凭“Lot 没有 linked 后续条目”推断额度未使用。

## 3. 冻结边界

### 3.1 负责

- 仅 `paymentMode=TEST`；
- 仅 `refund_succeeded`、`chargeback_succeeded`；
- 仅 Event amount 与原 Order amount 完全相等的全额事件；
- 仅 Order 当前为 `paid`；
- 仅 Wallet 为 active，且可以按第 4 节证明原订单全部 Lot 可完整回收；
- Credit reclaim、Commission Reversal、Order/Event 与 PaymentEvent terminal evidence 全部在现有 `receivePaymentEvent` 单事务中完成；
- 原 succeeded Payment 没有 Accrual 时不伪造 Reversal；原 Calculation Outcome 已提供无归因、过期或 manual-review 的明确审计原因；
- replay 与同 Order 并发必须零重复、零超额。

### 3.2 不负责

- LIVE Event、真实 Provider 退款调用或真实资金退款；
- 部分退款、累计多次退款、按比例 Credit/Commission 冲正；
- 已 reserve/consume/release/adjust 的 Wallet、负余额、跨 Lot 分摊或 FIFO/LIFO；
- disputed 后恢复、退款撤销、二次退款、跨币种或汇率；
- 新的 HTTP 路由或响应字段；现有 Internal TEST Payment Event 入口只透传新的 terminal 结果；
- A-06 的完整 Credit Reservation、消费与生产回执结算；
- B 的 StoryCanvas。

## 4. 可完整回收的保守证明

Repository 在持有 RechargeOrder 与 Wallet 行锁后，必须同时满足：

1. Order 为 `paid`，Event 为 TEST refund/chargeback，currency 与 Order 相同；
2. Event amount 等于 Order amount；小于 Order amount 时保存 `rejected / partial_refund_unsupported`；
3. 锁定 Order 的全部 Credit Lot；
4. Lot 集合必须与 Order 冻结额度完全一致：
   - 恰好一个 PURCHASED Lot，额度等于 `purchased_credits`；
   - `bonus_credits > 0` 时恰好一个 BONUS Lot，额度相等；否则不存在 BONUS Lot；
5. 每个 Lot 恰好有一条合法 linked `issue`，且没有 linked `reclaim`；
6. Wallet 不存在任何 `operation <> issue` 的 Ledger entry；这会保守拒绝所有 reserve/consume/release/adjust 及既有 reclaim 活动；
7. Wallet 不存在任何 Credit Reservation，包括已 released/consumed 的历史 Reservation；
8. 该 Order 不存在已 applied 的 refund/chargeback PaymentEvent；
9. 若存在原 Commission Accrual，则尚未有任何 Reversal；本切片只做一次全额 Reversal。

任一条件不能证明时，Event 保存为稳定 `rejected / credit_reclaim_unsafe` 或 `commission_reversal_conflict`，不写 Credit/Commission/Order 变更。首版宁可误拒绝，也不得猜测可用余额。

## 5. Migration 017 Schema 合同

新增 `017_full_test_payment_reversal.ts`，只做支持安全冲正所需的增量约束。

### 5.1 Credit Ledger reclaim

- 将 Ledger operation check 扩展为：
  - `issue/reserve/consume/release/adjust/reclaim`；
- 把 migration 015 的“每 Lot 唯一 Ledger”索引改为：
  - 每个 Lot 恰好最多一条 `issue`；
  - 每个 Lot 最多一条 `reclaim`；
- 扩展 Lot-linked Ledger validator：
  - `issue` 继续保持 015 的原合同；
  - `reclaim` 必须：
    - `bucket=available`、`delta=-original_credits`；
    - `reservation_id=null`；
    - `posting_group_id=refund/chargeback PaymentEvent ID`；
    - source Event 为同 Order、同 TEST mode、同 currency、全额且已 `applied`；
    - `reference_type=recharge_order`、`reference_id=Order ID`；
    - idempotency key 为 `payment-event:<event-id>:<lot-type>:reclaim`；
    - actor 为 `system/<provider_code>`；
    - reason 为 `recharge_refund_reclaimed` 或 `recharge_chargeback_reclaimed`；
    - occurredAt 与 source Event 一致；
    - 同 Lot 必须已有唯一合法 issue，且不存在既有 reclaim。

不新增可变 Lot balance 字段；Lot 和 Ledger 继续 append-only。

### 5.2 Payment Event 审计

- refund/chargeback Event insert 允许 `0 < amount <= Order amount`，从而让部分退款进入 Inbox 后稳定 rejected；
- succeeded/failed 的既有金额一致性保持不变；
- error code 新增：
  - `partial_refund_unsupported`；
  - `credit_reclaim_unsafe`；
  - `commission_reversal_conflict`；
- PaymentEvent 仍必须先以 `received` 插入，再进入不可变 terminal 状态。

### 5.3 Commission Reversal 补强

扩展 `validate_commission_reversal()`：

- source Event 必须已经 `applied`；
- Event 必须为 TEST；
- Event amount 必须等于原 Accrual 的 `basis_amount_minor`；
- Reversal amount 必须等于原 Accrual `commission_amount_minor`；
- refund 对应 `reversal_type=refund`，chargeback 对应 `chargeback`；
- 保留累计不超过原 Accrual、Order/currency/occurredAt 一致性和 append-only 保护。

### 5.4 Rollback

Migration down 仅在不存在：

- `operation=reclaim` Ledger；
- 已 applied refund/chargeback PaymentEvent；
- Commission Reversal；

时允许恢复 016/015 约束。存在任何冲正审计事实时 fail closed。

## 6. Repository 决策矩阵

| 条件                               | PaymentEvent                              | Credit         | Commission                                  | Order       |
| ---------------------------------- | ----------------------------------------- | -------------- | ------------------------------------------- | ----------- |
| TEST 全额 refund，安全证明成立     | `applied`                                 | 全 Lot reclaim | 有 Accrual 则全额 refund Reversal           | `refunded`  |
| TEST 全额 chargeback，安全证明成立 | `applied`                                 | 全 Lot reclaim | 有 Accrual 则全额 chargeback Reversal       | `disputed`  |
| 原 succeeded 无 Accrual            | `applied`                                 | 全 Lot reclaim | 不创建 Reversal；沿用原 Calculation Outcome | 对应终态    |
| 部分退款/拒付                      | `rejected / partial_refund_unsupported`   | 无             | 无                                          | 保持 `paid` |
| Wallet/Lot/Reservation 证据不安全  | `rejected / credit_reclaim_unsafe`        | 无             | 无                                          | 保持 `paid` |
| Accrual 已有 Reversal 或事实冲突   | `rejected / commission_reversal_conflict` | 无             | 无                                          | 保持 `paid` |
| Order 非 `paid`                    | `rejected / invalid_order_state`          | 无             | 无                                          | 不变        |
| LIVE 或其他 unsupported Event      | 延续 `rejected / unsupported_event_type`  | 无             | 无                                          | 不变        |

## 7. 原子事务顺序

安全路径固定为：

1. 锁 Provider Event identity，处理 replay/digest conflict；
2. `FOR UPDATE` 锁 RechargeOrder 与 Wallet；
3. 插入 PaymentEvent `received`；
4. 校验 TEST refund/chargeback、Order、金额、Wallet；
5. 锁 Order 的 Credit Lots、其 linked Ledger、Wallet 全部 Ledger 和 Reservation；
6. 锁原 succeeded Event、Calculation Outcome、可选 Accrual 与既有 Reversal；
7. 形成第 4 节安全证明；失败则只把 Event 更新为稳定 rejected；
8. 将 PaymentEvent 更新为 `applied`；
9. 为每个 Lot 追加完整 reclaim Ledger；
10. 如有 Accrual，追加全额 Commission Reversal；
11. refund 更新 Order 为 `refunded`，chargeback 更新为 `disputed`；
12. 追加对应 RechargeOrderEvent；
13. 返回 terminal Event。

先把 Event 更新为 `applied` 是为了让 migration 017 的 reclaim/Reversal trigger 能验证来源 Event；仍在同一事务内，后续任何异常会把该更新及 Event insert 一并回滚。

## 8. RED 合同

### 8.1 Migration 017 PostgreSQL 合同

先新增独立 `db/fullTestPaymentReversal.postgres.test.ts` 并在 migration 017 为空骨架时确认 RED：

- operation `reclaim` 在 016 基线上被拒绝；
- migration 后合法 refund reclaim 可写，重复 reclaim 被拒绝；
- 非 applied、非 TEST、非 refund/chargeback、跨 Order/Wallet/Lot、错误 delta/bucket/reason/idempotency 的 reclaim 被拒绝；
- 合法全额 Commission Reversal 可写；非 applied、部分金额、跨 Event/Order/currency 或超额被拒绝；
- Ledger/Reversal 继续 append-only；
- down 在空事实时成功，在存在 reclaim/reversal/applied reversal Event 时 fail closed；
- migration chain 更新为 001～017，并保持 replay idempotent。

### 8.2 Repository PostgreSQL 合同

新增场景至少覆盖：

1. 全额 TEST refund：purchased/bonus 全部 reclaim、Accrual 全额 reversal、Order refunded、Event applied；
2. 全额 TEST chargeback：同上，Order disputed；
3. 原 succeeded 无 Accrual：只 reclaim，不创建 Reversal；
4. Provider replay：零重复 reclaim/reversal/order event；
5. 同 Order 两个 reversal Event 并发：最多一个 applied；
6. 部分退款稳定 rejected；
7. Wallet 有 reserve/consume/release/adjust 任一事实时 rejected；
8. Wallet 有任意历史 Reservation 时 rejected；
9. Lot 缺 issue、Lot 已 reclaim、Lot 集合或额度不一致时 rejected；
10. Accrual 已有 Reversal 时 rejected；
11. Order 非 paid、Wallet frozen、LIVE/其他 Event 保持安全拒绝；
12. reclaim ID、Reversal ID 或 OrderEvent ID 分配/插入故障时全部回滚。

测试 fixture 中所有金额、比例与观察期继续标记 `TEST / NON_QUOTE`。

## 9. 实现切片与提交

### 9.1 计划冻结

只提交计划与 C0 记忆：

```text
docs(business-plane): freeze full test reversal plan
```

### 9.2 RED

新增 migration 017 空骨架、Schema/PostgreSQL 合同与 Repository RED；先确认失败原因确实是 reclaim/处理实现缺失，而不是 fixture 或环境错误。

### 9.3 Green

最小实现：

- migration 017 约束；
- Payment types/error code；
- Repository 安全证明与 refund/chargeback 原子分支；
- 必需的测试 fixture/helper；
- 不修改共享 Bootstrap 与 HTTP route。

功能提交：

```text
feat(control-api): reverse refundable test payments atomically
```

## 10. Gate

```bash
npm --prefix apps/control-api test -- --run src/db/fullTestPaymentReversal.postgres.test.ts --pool=forks --maxWorkers=1
npm --prefix apps/control-api test -- --run src/db/migrationChain.postgres.test.ts src/payments/repository.postgres.test.ts --pool=forks --maxWorkers=1
npm --prefix apps/control-api run typecheck
npm --prefix apps/control-api run build
npm --prefix apps/control-api test -- --pool=forks --maxWorkers=1
npx eslint <本切片 TypeScript 文件>
npx prettier --check <本切片文件>
npm run validate:governance
git diff --check
```

PostgreSQL Gate 使用：

```text
postgresql://127.0.0.1:5432/videoagent_control_test
```

## 11. 完成定义

- migration 017 与 migration chain 通过；
- 两类 TEST 全额 reversal 安全路径通过；
- 部分退款、已使用/冻结/调整、历史 Reservation、已 reclaim/已 reversal 均稳定 fail closed；
- replay/并发零重复；
- 任一中途失败不留下半冲正；
- 全量 Control API、typecheck、build、lint、format、governance、diff check 通过；
- C0 STATUS/HANDOFF/CHANGELOG 与桌面知识库同步；
- 不触碰 B 的 StoryCanvas 未跟踪文件，不 push。

## 12. 实施结果（2026-08-08）

- Migration 017、Repository、Payment error types 与 PostgreSQL 合同均已完成。
- 定向测试：Migration 017 + Repository 2 files / 36 tests PASS。
- 全量 Gate：Control API 47 files / 314 tests PASS；typecheck、build、ESLint、Prettier、Governance、`git diff --check` 全 PASS。
- 已覆盖全额 refund、全额 chargeback、无 Accrual、部分退款拒绝、Wallet 非 issue 活动、历史 Reservation、frozen/non-paid、replay、并发、既有 Commission Reversal、reclaim/Reversal 故障回滚。
- 范围未扩张：LIVE、部分退款、真实 Provider 退款、HTTP 新接口、Settlement 与 StoryCanvas 均未实现或修改。
- 当前状态：`A_BIZ_03_3C_COMPLETE / COMMITTED`。
