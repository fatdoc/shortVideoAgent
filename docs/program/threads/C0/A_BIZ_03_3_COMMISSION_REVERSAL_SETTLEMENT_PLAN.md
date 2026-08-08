# A-BIZ-03.3 · 佣金影子账、冲正与结算草稿计划

- 日期：2026-08-08
- 负责人：工程师 A（业务平台）
- 分支：`dev/business-plane`
- 状态：`03_3A_COMPLETE / 03_3B_PLAN_FROZEN`
- 当前基线：`6a86d8f feat(control-api): add commission shadow ledger schema`
- 上游依据：`A_BIZ_00_3_REGISTRATION_TERMS_BILLING_ADR.md`（ACCEPTED）与 `A_ENGINEER_WAVE0_BOSS_DECISION_REPLY_2026-08-06.md`
- 前置完成：A-BIZ-03.1 TEST Recharge/Payment Foundation、A-BIZ-03.2 Payment/Order/Credit 原子到账

## 1. 节点结论

A-BIZ-03.3 按“先影子账、再原子计提、后安全冲正、最后只读与结算草稿”推进：

1. 建立版本化 Commission Rule、Calculation Outcome、Accrual、Reversal、Settlement Draft；
2. TEST `payment_succeeded` 在现有 Payment/Order/Credit 单事务中追加佣金计算结果；
3. 有合法直接 Channel Attribution 且存在匹配的 ACTIVE TEST Rule 时，原子追加 Commission Accrual；
4. 无归因、归因过期或正式 Rule 未发布时绝不套默认比例，而是写入安全、可审计的 Calculation Outcome；
5. 退款/拒付只先支持能证明无负余额、无比例猜测的 TEST 全额冲正；部分退款、额度已使用/冻结或规则不足时继续 fail closed 并进入人工处理结果；
6. Settlement 只生成草稿和审计快照，不允许 `paid`、提现或自动打款。

本计划不写任何真实佣金百分比、真实退款观察期或正式商业金额。Migration 不 seed Commission Rule；测试 fixture 必须显式标记 TEST / NON_QUOTE。

## 2. 当前基线与缺口

### 2.1 已具备

- RechargeOrder 在创建时冻结 `attributionSnapshotId`；
- ReferralAttribution 已冻结 User、Tenant、可选直接 `referrerChannelId`、12 个月保护期和来源证据；
- TEST `payment_succeeded` 已在单一 PostgreSQL 事务内形成：
  - PaymentEvent `applied`；
  - RechargeOrder `pending → paid`；
  - purchased/bonus Credit Lot；
  - 对应 append-only Credit Ledger issue；
- Provider identity replay、同 Order 并发、Wallet frozen、unsupported Event 和全事务回滚已有合同；
- `refund_succeeded`、`chargeback_succeeded` 已在 Provider/API 枚举中，但 Repository 当前稳定 `rejected / unsupported_event_type`。

### 2.2 尚缺

- `commission_rule_versions`、Calculation Outcome、Accrual、Reversal、Settlement 表；
- 支付成功事务中的佣金资格判定与整数计算；
- Channel/Platform scoped 的佣金只读 Repository、Service 和 HTTP API；
- Refund/Chargeback 的累计金额约束、Credit reclaim 和 Commission reversal；
- Lot 级 reserve/consume/release 尚未进入当前业务 Repository，因此不能假设额度一定未使用；
- 真实佣金比例、舍入方式、退款观察期、部分退款额度映射、税务/KYC/提现/出款规则仍未授权。

## 3. 已冻结业务与工程边界

### 3.1 03.3 负责

- 单级直接归因 Channel 佣金；
- 基数为 RechargeOrder 的实际 TEST 支付净额，金额使用整数 minor unit 与明确 currency；
- Rule Version 保存计算比例表示、舍入方式、退款观察期、币种、TEST/LIVE 和审批证据；
- Accrual 冻结 PaymentEvent、RechargeOrder、ReferralAttribution、Rule Version、Channel、basis、amount 和 calculation snapshot；
- 同一 succeeded PaymentEvent + Rule Scope 最多一个 Accrual；
- 无可用规则时不硬编码、不静默默认，写 Calculation Outcome；
- 退款/拒付通过 append-only Reversal，不更新或删除 Accrual；
- Settlement 只到 `draft/reviewed/approved` 审计状态，数据库禁止进入 `paid`；
- Platform 全局审计、Channel 仅自身受益范围、Tenant 不可读取佣金；
- TEST/LIVE 全链路隔离，LIVE 继续 fail closed。

### 3.2 03.3 明确不负责

- 真实微信/支付宝、真实商户签名与真实资金退款；
- 真实佣金百分比、真实退款观察期、税务、发票、KYC、提现、出款或自动打款；
- 多级佣金、旧批发差价、招募奖励、团队层级抽佣；
- 改绑并追溯重算历史佣金；
- 部分退款的现金到额度舍入策略，除非规则版本明确提供且获得业务确认；
- B 的 StoryCanvas、媒体 Provider、生产任务或跨平面 Receipt 结算；
- A-06 的完整 Lot 消耗顺序、Reservation 分摊和生产回执结算。

## 4. 无 Rule 和不可安全退款的处理语义

### 4.1 Payment succeeded 的佣金结果

客户已经通过 TEST Event 完成支付时，佣金规则缺失不能导致客户“已支付但不到账”。因此三账按以下方式解耦，但在同一事务中保存结果：

| 条件                                | Payment/Order/Credit    | Commission Outcome                    |
| ----------------------------------- | ----------------------- | ------------------------------------- |
| 无 referrer Channel                 | 正常 applied/paid/issue | `not_attributed`，不创建 Accrual      |
| Attribution 已超过保护期            | 正常 applied/paid/issue | `attribution_expired`，不创建 Accrual |
| Channel/组织不可用                  | 正常 applied/paid/issue | `manual_review / channel_unavailable` |
| 找不到匹配 ACTIVE TEST Rule         | 正常 applied/paid/issue | `manual_review / rule_unavailable`    |
| 匹配多个 ACTIVE Rule                | 整个事务 fail closed    | 配置冲突，禁止任意选 Rule             |
| Attribution + Channel + Rule 均合法 | 正常 applied/paid/issue | `accrued` 并创建唯一 Accrual          |

`manual_review` 不是零佣金业务结论，也不能向 Channel 展示为可结算金额；它只是平台审计异常。

### 4.2 Refund/Chargeback 的安全子集

首个实现只允许 TEST 全额事件，并要求：

- 原 Order 已 paid，且尚未存在累计退款/拒付；
- Event amount/currency 与原 Order 完全一致；
- 原 Order 的 purchased/bonus Lot 可证明仍全部处于 available，没有 reserve/consume/reclaim；
- 对应 Accrual 若存在，可进行等额全量 Commission Reversal；
- 所有 Credit reclaim、Commission Reversal、Order 状态/Event 和 PaymentEvent terminal evidence 同事务完成。

以下情况稳定拒绝并保持零副作用：

- 部分退款；
- 累计金额超过原 Order；
- Lot 已消耗、冻结、过期处理不明确或无法证明可回收；
- Commission/Attribution/Rule 快照不一致；
- LIVE 事件；
- 重复但 digest 冲突的 Provider Event。

建议安全错误码：

```text
refund_policy_unavailable
refund_amount_conflict
credit_reclaim_unavailable
commission_reversal_conflict
chargeback_manual_review
```

部分退款和已消费额度的自动处理必须在商业规则与 Lot 分摊合同冻结后另开切片，不得在 03.3 中猜测。

## 5. Schema 计划

### 5.1 Migration 016：Commission Shadow Ledger

新增：

```text
commission_rule_versions
commission_calculation_outcomes
commission_accruals
commission_reversals
commission_settlements
commission_settlement_items
```

#### Commission Rule Version

最小事实：

- `commission_rule_version_id`
- `rule_code` / `version_label`
- `payment_mode: TEST | LIVE`
- `status: DRAFT | ACTIVE | RETIRED`
- `scope_type: DIRECT_ATTRIBUTION`
- `basis_type: NET_PAID_AMOUNT`
- `currency`
- `rate_numerator` / `rate_denominator`
- `rounding_mode`
- `refund_observation_days`
- `rule_digest`
- `effective_at` / `retired_at`
- `approved_by_membership_id`
- `created_at`

规则：

- 不使用浮点；计算使用整数和显式舍入；
- ACTIVE/RETIRED 只接受 active PLATFORM `platform_admin`；
- 同 mode/currency/scope 的有效窗口不得重叠；
- DRAFT 不得被支付事务使用；
- migration 不 seed 任何 Rule；
- Rule 核心计算事实不可更新，生命周期只能 DRAFT → ACTIVE → RETIRED。

#### Commission Calculation Outcome

每个 succeeded PaymentEvent 最多一条，记录：

- source PaymentEvent / RechargeOrder；
- Attribution/Channel/Rule 可空快照引用；
- basis amount/currency；
- outcome：`accrued | not_attributed | attribution_expired | manual_review`；
- reason code；
- calculation snapshot/digest；
- occurred/created time。

Outcome append-only，用来证明“为什么有或没有 Accrual”，避免缺 Rule 时静默套默认值。

#### Accrual / Reversal

- Accrual 必须引用 outcome=`accrued`、同 Order、同 succeeded Event、同 frozen Attribution、同 Channel 和 ACTIVE Rule；
- commission amount 必须等于 Rule 的整数计算结果且大于 0；
- `eligible_at = PaymentEvent.occurredAt + refundObservationDays`；
- Reversal 必须引用原 Accrual和 refund/chargeback PaymentEvent；
- 累计 reversal 不得超过 Accrual；
- 原 Accrual、Reversal 和 calculation snapshot 全部 append-only。

#### Settlement Draft

- 按 Channel + currency + 自然月边界建立；
- item 明确引用 Accrual/Reversal，不保存模糊 ID 数组；
- 只纳入 `eligible_at <= cutoff` 且未被其他有效草稿占用的净额；
- 状态仅允许 `draft → reviewed → approved`；数据库禁止 `paid`；
- Settlement snapshot 保存 period、cutoff、Rule/Attribution/事件摘要和计算 digest。

### 5.2 Refund/Credit Reclaim 增量

预计单独 Migration 017，避免把 Commission Schema 与退款状态机混成一个不可审查提交：

- 扩展 PaymentEvent refund/chargeback 事实约束；
- 增加 append-only Credit Lot reclaim 证据或严格的 Lot-linked refund Ledger 约束；
- 增加 RechargeOrder refunded/disputed Event 与累计金额保护；
- 回滚只允许空退款/冲正事实；存在审计事实时 fail closed。

## 6. 原子算法

### 6.1 succeeded + Accrual

在现有 `receivePaymentEvent()` 事务中：

1. 取得 Provider identity advisory lock；
2. 检查 replay/conflict；
3. 锁定 Order、Wallet、Attribution、Channel 和匹配 Commission Rule；
4. 插入 PaymentEvent received；
5. 创建 Order pending、Credit Lot/Ledger；
6. 写 Commission Calculation Outcome；
7. 若 outcome=accrued，写唯一 Commission Accrual；
8. Order paid、PaymentEvent applied；
9. 任一步失败全部回滚。

### 6.2 refund/chargeback + Reversal

在满足全额安全子集时：

1. 锁定 Provider identity、Order、原 succeeded Event、Credit Lots 和 Accrual；
2. 验证 Event 是 TEST、全额、未重复、未超额；
3. 验证所有 Order 来源 Lot 可完整回收；
4. 追加 Credit reclaim Ledger/证据；
5. 对 Accrual 追加全额 Reversal；无 Accrual 时记录明确 outcome；
6. refund：Order → refunded；chargeback：Order → disputed；
7. 追加 Order Event，PaymentEvent → applied；
8. 任一步失败全部回滚。

## 7. 分步切片与提交

### A-BIZ-03.3A · Migration 016 Commission Schema

- 先写 PostgreSQL RED 合同；
- 实现 Rule、Outcome、Accrual、Reversal、Settlement Draft/Item；
- 验证 append-only、Scope、金额币种、整数计算证据、ACTIVE 审批、窗口不重叠和 fail-closed rollback；
- 不修改 Payment Repository 或 HTTP Bootstrap。

建议提交：

```text
feat(control-api): add commission shadow ledger schema
```

### A-BIZ-03.3B · Atomic TEST Commission Accrual

- 扩展 Payment Store/Repository；
- succeeded 事务写 Calculation Outcome；
- 只有直接 Channel Attribution + 未过保护期 + 唯一 ACTIVE TEST Rule 才创建 Accrual；
- 覆盖无归因、过期、Channel 不可用、Rule 不可用、Rule 冲突、replay、并发和中途失败；
- 不支持 refund/chargeback。

建议提交：

```text
feat(control-api): accrue test payment commissions atomically
```

### A-BIZ-03.3C · Full TEST Refund/Chargeback Reversal

- 先增加 Migration 017 和 RED 合同；
- 只实现全额、未使用 Lot 的安全子集；
- Credit reclaim、Commission Reversal、Order/PaymentEvent 同事务；
- 部分退款和已使用额度保持稳定 rejected/manual review；
- 若无法证明 Lot 可完整回收，立即停下，不写近似算法。

建议提交：

```text
feat(control-api): reverse refundable test payments atomically
```

### A-BIZ-03.3D · Scoped Read APIs

- Channel Admin 只能查询自身 Channel 的 Calculation/Accrual/Reversal；
- Platform Admin 查询全局和 manual-review 异常；
- Tenant/Content Operator 不可查看佣金；
- bounded list、稳定排序、跨 Scope 404、同 Scope 缺权限 403；
- 响应不包含 Provider secret、原始 payload、内部审批凭据或其他 Channel 数据。

建议提交：

```text
feat(control-api): expose commission audit results
```

### A-BIZ-03.3E · Settlement Draft

- Platform Admin 显式创建 TEST Settlement Draft；
- 只纳入到达 `eligibleAt` 的净 Accrual/Reversal；
- Channel/currency/period 隔离，幂等 replay 和并发零重复；
- 只允许 draft/reviewed/approved，禁止 paid；
- 无 ACTIVE TEST Rule 或退款观察期证据时 fail closed。

建议提交：

```text
feat(control-api): create commission settlement drafts
```

## 8. Test-first 合同

### 8.1 Schema

- migration 016 缺表 RED；
- ACTIVE Rule 必须由 active Platform Admin 批准；
- Rule 时间窗口不能重叠；
- rate 分母为正、计算金额不溢出、currency 匹配；
- Outcome、Accrual、Reversal、Settlement Item append-only；
- 跨 Order/Event/Attribution/Channel/Rule 的伪造 FK 或快照被拒绝；
- Reversal 累计不超过 Accrual；
- Settlement `paid` 被数据库拒绝；
- 有审计事实时 rollback fail closed。

### 8.2 Accrual

- 合法 Channel Attribution + ACTIVE TEST Rule 产生一次 Accrual；
- 同 Event 串行/并发 replay 零重复；
- 同 Order 的第二 succeeded Event 不产生第二 Accrual；
- direct/no Channel 不计提但有 `not_attributed` Outcome；
- Attribution 过期不计提；
- Rule 缺失写 manual review，不使用默认比例；
- 多个匹配 Rule 使事务 fail closed；
- LIVE 不回退 TEST Rule；
- Accrual 插入失败时 Payment/Order/Credit/Commission 全回滚。

### 8.3 Reversal

- 全额 TEST refund 完整回收 Credit 并全额冲正 Commission；
- 全额 chargeback 进入 disputed 并冲正；
- replay 不重复 Reclaim/Reversal；
- 部分退款稳定拒绝；
- 已 reserved/consumed/reclaimed Lot 稳定拒绝并进入人工处理；
- 不得产生负 available；
- 任一 Credit/Commission/Order Event 失败全部回滚。

### 8.4 Scope/API/Settlement

- Channel 只能读取自身受益范围；跨 Channel 404；
- Tenant 探测 Commission Route 404；已知 Channel 缺 `channel_admin` 403；
- Platform manual-review 列表 bounded 且不泄漏敏感字段；
- Settlement Draft 按 UTC 自然月、Channel 和 currency 隔离；
- 未到 eligibleAt、已完全冲正或已被有效 Draft 占用的 Accrual 不得重复纳入；
- draft replay 返回原结果；冲突返回 409；
- API 永不承诺可提现、已到账或真实 paid。

## 9. Gate

每个切片至少运行：

```bash
npm --prefix apps/control-api run typecheck
npm --prefix apps/control-api run build
npm --prefix apps/control-api test -- --pool=forks --maxWorkers=1
npx eslint <本切片 TypeScript 文件>
npx prettier --check <本切片文件>
npm run validate:governance
git diff --check
```

PostgreSQL 与 Supertest 测试需要本机测试数据库和临时监听端口；普通沙箱出现 `EPERM 127.0.0.1:5432` 或 `listen EPERM` 时使用已批准的提升权限运行，不把环境限制误报为代码失败。

## 10. A/B 与 Git 边界

- A 负责 `apps/control-api/src/commissions/**`、Payment 增量、migration 016/017、对应测试与 C0 文档；
- 03.3A 不修改共享 `app.ts/server.ts/config.ts`，B 无需等待；
- 03.3D/E 如需要共享 Bootstrap，必须作为独立小提交并提前通知 B；
- 不修改 `apps/storycanvas/**`；未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 始终排除；
- 每个切片显式 `git add <files>`，禁止 `git add .`；
- 每个切片独立 commit，未经用户明确要求不 push。

## 11. 必须暂停并汇报的条件

遇到以下任一情况立即暂停，不自行猜测：

1. 需要真实佣金比例、舍入或退款观察期；
2. 部分退款需要决定购买额度/赠送额度的回收顺序或比例；
3. 已消费/冻结额度需要自动追偿、负余额或跨 Lot 分摊；
4. 需要把 Settlement 标记 paid、开放提现或自动打款；
5. 需要修改 B 的 StoryCanvas 或跨平面 Receipt 合同；
6. 上游 main/B 分支改动了 Payment、Credit Ledger、Attribution 或共享 Bootstrap；
7. 测试数据库、端口或 Git 操作因权限/网络阻塞。

汇报必须说明：卡在哪个切片、具体原因、当前已完成证据、是否需要用户手动操作或业务确认。

## 12. 完成定义

A-BIZ-03.3 完成必须同时满足：

- succeeded Payment 的佣金结果可审计，合法 Rule 只计提一次；
- 无 Rule 时绝不套默认比例，manual-review 事实可被 Platform 看见；
- 全额安全退款/拒付能原子追加 Credit reclaim 与 Commission Reversal；
- 部分退款和已使用额度在规则未冻结时 fail closed；
- Settlement 仅为草稿/审核证据，数据库禁止 paid；
- Platform/Channel/Tenant Scope 和 404/403 语义通过；
- PostgreSQL、Service、Repository、Router、Typecheck、Build、Lint、Governance 与 diff-check 全部有真实证据；
- STATUS、HANDOFF、CHANGELOG 和桌面项目记忆同步。

## 13. 下一步

只开始 A-BIZ-03.3A：创建空 migration 016 与 PostgreSQL 合同测试，先确认缺失 Commission Schema 的有效 RED；不提前修改 Payment Repository、HTTP Bootstrap 或退款状态机。

## 11. A-BIZ-03.3A 完成记录（2026-08-08）

- 新增 Migration 016，建立六张不预置任何 TEST/LIVE Rule 的 Commission Shadow Ledger 表：Rule Version、Calculation Outcome、Accrual、Reversal、Settlement 与 Settlement Item。
- Rule 使用整数分子/分母和显式舍入，ACTIVE/RETIRED 必须由 active PLATFORM `platform_admin` 批准；核心计算事实不可修改，生命周期仅允许 `DRAFT → ACTIVE → RETIRED`，同 mode/currency/scope 的已生效窗口不得重叠。
- Outcome、Accrual、Reversal 与 Settlement Item 全部 append-only；Outcome 冻结 succeeded PaymentEvent、paid Order、Attribution、Channel、Rule、basis、currency 与 occurredAt 的一致性。
- Accrual 必须匹配 `accrued` Outcome、未过保护期的直接 Channel Attribution、active Channel Organization 和唯一 ACTIVE Rule；数据库复算整数佣金并校验 `eligible_at`。
- Reversal 只接受对应 Order 的 refund/chargeback PaymentEvent，类型必须一致，按 Accrual 行锁串行累计且不得超过原始佣金。
- Settlement 数据库状态仅允许 `draft/reviewed/approved`，创建、审核、批准均要求 active PLATFORM administrator；Item 只可加入 draft，必须匹配 Channel/currency/自然月/cutoff 和已到达观察期的来源事实，`paid` 被数据库 check 明确拒绝。
- down 在任一 Commission 审计事实存在时 fail closed；空 Schema 可完整回滚。
- Test-first RED：1 file / 7 tests 因六张表不存在而全部失败；Green：定向 7/7，migration chain 联合 8/8。
- 最终 Gate：Control API 45 files / 285 tests PASS；typecheck、build、ESLint、Prettier、Governance 与 `git diff --check` 全 PASS。
- 未修改 Payment Repository、HTTP 或共享 App/Config/Server；未触碰 B 的 `apps/storycanvas/data/vendor/byteplus.ts`。
- 下一步先冻结 A-BIZ-03.3B 的原子计提事务合同，再写 Repository PostgreSQL RED；不得直接把 Schema fixture 比例当成商业默认值。
