# A-BIZ-03.3B · TEST Payment 原子佣金计提计划

- 日期：2026-08-08
- 负责人：工程师 A（业务平台）
- 分支：`dev/business-plane`
- 状态：`COMPLETE / READY_FOR_03_3C_PLANNING`
- 实现基线：`0b96421 docs(business-plane): freeze atomic commission accrual plan`
- 前置：A-BIZ-03.3A migration 016 已建立 Commission Rule、Calculation Outcome 与 Accrual 的数据库保护

## 1. 本切片目标

把 A-BIZ-03.3A 的佣金影子账接入现有 TEST `payment_succeeded` 原子事务，使一次成功支付在同一 PostgreSQL 事务中完成：

1. PaymentEvent `received → applied`；
2. RechargeOrder `created/pending → paid`；
3. purchased/bonus Credit Lot 与对应 Ledger issue；
4. 每个 applied succeeded PaymentEvent 恰好一条 Commission Calculation Outcome；
5. 只有满足冻结直接归因、Channel 可用和唯一 ACTIVE TEST Rule 时才追加 Commission Accrual。

任何 Outcome/Accrual 写入失败都必须回滚 Payment、Order、Credit 与 Commission 全部事实，不能形成半到账。

## 2. 冻结边界

### 2.1 负责

- 仅处理 `paymentMode=TEST` 且 `eventType=payment_succeeded`；
- 读取 RechargeOrder 已冻结的 `attribution_snapshot_id`，不在支付时重新归因；
- 按 PaymentEvent `occurredAt` 判断 Attribution 与 Rule 有效窗口；
- 使用整数 minor unit、Rule 的 numerator/denominator 与显式 rounding mode 计算；
- Calculation Snapshot 使用稳定 canonical JSON，并保存 SHA-256 digest；
- replay、同 Order 并发不同 Event、中途故障保持原有串行和回滚语义；
- Rule/Channel 不可用时写 `manual_review`，绝不使用默认佣金比例。

### 2.2 不负责

- LIVE Payment、真实支付 Provider 或真实商业佣金比例；
- refund/chargeback、Commission Reversal；
- Commission 查询 HTTP API、Channel/Platform 只读投影；
- Settlement Draft 生成、提现、税务、KYC 或自动打款；
- 多级佣金、历史重算或修改 B 的 StoryCanvas。

## 3. 决策矩阵

| 条件                                         | Payment/Order/Credit    | Outcome                                       | Accrual |
| -------------------------------------------- | ----------------------- | --------------------------------------------- | ------- |
| Order 无冻结 Attribution                     | 正常 applied/paid/issue | `not_attributed / no_frozen_attribution`      | 无      |
| Attribution 已过保护期                       | 正常 applied/paid/issue | `attribution_expired / attribution_expired`   | 无      |
| Attribution 缺失、非 active 或无直接 Channel | 正常 applied/paid/issue | `manual_review / attribution_unavailable`     | 无      |
| Channel 或所属 Organization 非 active        | 正常 applied/paid/issue | `manual_review / channel_unavailable`         | 无      |
| 无匹配 ACTIVE TEST Rule                      | 正常 applied/paid/issue | `manual_review / commission_rule_unavailable` | 无      |
| 唯一匹配 Rule                                | 正常 applied/paid/issue | `accrued / commission_accrued`                | 一条    |
| 多个匹配 Rule                                | 整体事务失败并回滚      | 不保留                                        | 不保留  |

unsupported Event、LIVE Event、Wallet unavailable 与 invalid Order state 继续按现有逻辑 rejected，不创建 Commission Outcome。

## 4. 原子事务顺序

Migration 016 要求 Outcome 引用的 PaymentEvent 已为 `applied` 且 RechargeOrder 已为 `paid`，因此成功路径固定为：

1. 锁 Provider Event identity；
2. replay/conflict 检查；
3. `FOR UPDATE` 锁 RechargeOrder 与 Wallet；
4. 插入 PaymentEvent `received`；
5. 校验 TEST succeeded、Wallet、Order 状态与既有 Lot；
6. Order `created → pending` 并追加 pending OrderEvent；
7. 创建 Credit Lot 与 Ledger issue；
8. Order 更新为 `paid` 并追加 paid OrderEvent；
9. PaymentEvent 更新为 `applied`；
10. 计算并插入 Commission Calculation Outcome；
11. outcome 为 `accrued` 时插入 Commission Accrual；
12. 返回 terminal PaymentEvent。

第 9～11 步仍位于同一个数据库事务；第 10/11 步异常会回滚前面的全部写入。

## 5. 计算与快照合同

新增独立佣金计算模块，Repository 只负责锁、查询和持久化。Canonical snapshot 至少冻结：

- schema version；
- outcome 与 reason code；
- PaymentEvent、RechargeOrder、Attribution、Channel、Rule Version ID；
- basis amount/currency；
- numerator、denominator、rounding mode、refund observation days；
- commission amount 与 eligibleAt（仅 accrued）。

舍入：

- `FLOOR`：向下取整；
- `CEILING`：向上取整；
- `HALF_UP`：正整数金额下按 0.5 向上；
- 结果必须是正安全整数，否则事务 fail closed，不创建近似或零额 Accrual。

## 6. RED 合同

新增独立 PostgreSQL 合同 `payments/commissionAccrual.postgres.test.ts`，至少覆盖：

1. active direct Attribution + 唯一 Rule：Outcome accrued、Accrual 金额/eligibleAt 精确；
2. 无 Attribution：not_attributed，无 Accrual，支付与额度仍成功；
3. Attribution 过期：attribution_expired，无 Accrual；
4. Channel Organization inactive：manual_review，无默认 Accrual；
5. 无匹配 Rule：manual_review，无默认 Accrual；
6. Provider replay：Outcome/Accrual 各一条；
7. 同 Order 并发不同 succeeded Event：仅一个 applied，且仅一组 Commission 事实；
8. 强制 Commission ID/写入失败：PaymentEvent、Order、Lot、Ledger、Outcome、Accrual 全回滚；
9. unsupported/LIVE：rejected 且无 Commission 事实；
10. 测试性构造多个匹配 Rule：Repository 明确 fail closed，事务不保留任何事实。

正常 Schema 已阻止重叠 Rule；第 10 项只在隔离测试中移除该保护以验证 Repository 的第二道防线，不改变生产 migration。

## 7. 版本与协作约束

- 计划冻结独立 commit：`docs(business-plane): freeze atomic commission accrual plan`；
- RED→Green、完整 Gate 和进度同步后独立 commit：`feat(control-api): accrue test payment commissions atomically`；
- 不修改共享 `app.ts`、`server.ts`、`config.ts` 或 HTTP 合同；B 无需等待 Bootstrap 同步；
- 始终排除 B 的 `apps/storycanvas/data/vendor/byteplus.ts`，禁止使用 `git add .`；
- 未经用户明确要求不 push。

## 8. 完成 Gate

- 03.3B 定向 PostgreSQL 合同；
- Payment Repository 既有 PostgreSQL 合同；
- Control API 全量测试；
- `typecheck`、`build`；
- 变更文件 ESLint、Prettier；
- Governance validation；
- `git diff --check`；
- C0 STATUS/HANDOFF/CHANGELOG 与本地知识库进度同步。

## 9. 完成结果

- 新增纯计算模块 `commissionCalculation.ts`：canonical snapshot/digest、BigInt 整数计算、FLOOR/CEILING/HALF_UP 与 eligibleAt。
- TEST succeeded Payment 现在在同一事务内先形成 paid/applied，再追加每 Event 唯一 Outcome；唯一合法 Rule 时追加 Accrual。
- PostgreSQL 合同先以 9 个新场景 RED，随后 Repository 22/22 转绿；纯计算 6/6 转绿。
- 全量 Gate：Control API 46 files / 300 tests，typecheck、build、ESLint、Prettier、Governance、diff check 全 PASS。
- 未修改共享 Bootstrap、HTTP 合同或 StoryCanvas；未实现 refund/chargeback、read API 或 Settlement。
