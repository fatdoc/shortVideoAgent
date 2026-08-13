# A-BIZ-03.3E · TEST Commission Settlement Draft 计划

- 日期：2026-08-08
- 负责人：工程师 A（业务平台）
- 分支：`dev/business-plane`
- 状态：`COMPLETE / COMMITTED / GATE_PASS`
- 上游计划：`A_BIZ_03_3_COMMISSION_REVERSAL_SETTLEMENT_PLAN.md`
- 前置提交：`b26a268 docs(business-plane): close scoped commission read apis`
- 实现提交：`9b252ee`（Migration 018）、`499dcbb`（核心）、`0433fdb`（共享 Bootstrap）

## 1. 本节点目标

本节点只交付由 Platform Admin 显式创建的 **TEST Commission Settlement Draft**：

1. 按 beneficiary Channel、currency、UTC 自然月和 cutoff 冻结可审计草稿；
2. 只处理能够证明来自 TEST Payment 和在来源事件发生时有效的 Commission Rule 的事实；
3. 只纳入到达 `eligibleAt`、尚未被 Settlement Item 占用的净 Accrual/Reversal；
4. 同请求幂等 replay，不同请求复用同 key 返回 409；
5. 同 Scope/Period 并发创建零重复；
6. 响应和快照只表达 `draft`，不表达 `paid`、已到账、可提现或真实出款。

本节点不新增真实支付、真实佣金比例、KYC、税务、发票、提现、自动打款，也不实现 review/approve HTTP 命令。数据库既有 `draft → reviewed → approved` 生命周期继续保留，后两步另行规划。

## 2. 已审计的现有基础

Migration `016_commission_shadow_ledger.ts` 已提供：

- `commission_settlements`：
  - `(beneficiary_channel_id, currency, period_start, period_end)` 唯一；
  - `idempotency_key` 全局唯一；
  - UTC 自然月和 `cutoff_at >= period_end` 约束；
  - 状态仅 `draft/reviewed/approved`；
  - 创建、审核、批准 Actor 均必须是 active Platform Admin；
  - Scope、Period、cutoff、snapshot、digest 和创建人不可修改。
- `commission_settlement_items`：
  - 一个 Item 只引用一个 Accrual 或一个 Reversal；
  - Accrual 和 Reversal 各自最多被一个 Item 占用；
  - Item Channel/currency/period/cutoff 必须匹配 Settlement；
  - Accrual 必须满足 `eligible_at <= cutoff_at`；
  - Accrual Item 保存完整正金额，Reversal Item 保存完整负金额；
  - Item 只能加入 draft，且 append-only。

现有 Payment/Commission 代码还提供：

- TEST succeeded Payment、Order、Credit、Calculation Outcome、Accrual 的单事务证据；
- TEST full refund/chargeback、Credit reclaim、Commission Reversal 的单事务证据；
- canonical snapshot/digest、PostgreSQL advisory lock、幂等 replay/conflict 模式；
- Platform Admin Session Scope 和统一 HTTP 错误信封。

## 3. HTTP 合同

### 3.1 Route

```text
POST /api/v1/platform/commission-settlements
```

仅 active Platform Admin 可调用：

- 非 PLATFORM Organization 返回 404，隐藏能力；
- PLATFORM Scope 缺 `platform_admin` 返回 403；
- 未认证或失效 Session 返回 401；
- 权限失败前不得执行 Settlement Repository 写查询。

### 3.2 Request

```json
{
  "paymentMode": "TEST",
  "beneficiaryChannelId": "uuid",
  "currency": "CNY",
  "periodStart": "2026-08-01",
  "cutoffAt": "2026-09-08T00:00:00.000Z",
  "idempotencyKey": "commission-settlement:channel:2026-08:CNY"
}
```

冻结规则：

- `paymentMode` 当前只接受字面量 `TEST`；LIVE 返回稳定的验证错误，不回退 TEST；
- `beneficiaryChannelId` 必须是 active Channel，关联 Organization 也必须 active；
- `currency` 必须是三位大写 ISO 风格代码；
- `periodStart` 必须是 `YYYY-MM-01`，Service 推导 `periodEnd` 为下一 UTC 月第一日；
- `cutoffAt` 必须是带时区的合法时间，且不早于 `periodEnd`；
- `idempotencyKey` trim 后 1–200 字符，只允许 `[A-Za-z0-9._:-]`；
- 不接受客户端传 `periodEnd`、状态、金额、Item ID、Rule ID 或审批字段。

### 3.3 Response

首次创建返回 201，幂等 replay 返回 200；二者均设置：

```text
idempotency-replayed: false|true
cache-control: no-store
```

安全投影：

```json
{
  "settlement": {
    "commissionSettlementId": "uuid",
    "paymentMode": "TEST",
    "beneficiaryChannelId": "uuid",
    "currency": "CNY",
    "periodStart": "2026-08-01",
    "periodEnd": "2026-09-01",
    "cutoffAt": "2026-09-08T00:00:00.000Z",
    "status": "draft",
    "grossAccrualAmountMinor": 1500,
    "grossReversalAmountMinor": 300,
    "netAmountMinor": 1200,
    "accrualItemCount": 2,
    "reversalItemCount": 1,
    "itemCount": 3,
    "createdAt": "2026-09-08T00:00:01.000Z"
  }
}
```

不得返回：

- `settlement_snapshot`、`settlement_digest`、Item snapshot/digest；
- Rule 比例、审批凭据、Provider payload/secret、Token；
- User、Tenant、Membership、Attribution 明细；
- `paid`、withdrawable、已到账、可提现等承诺性字段或文案。

## 4. 净额与跨月语义

### 4.1 事件月不回写

沿用数据库已冻结的 append-only 事件月语义：

- Accrual 按自身 `occurred_at` 落入自然月；
- Reversal 按自身 `occurred_at` 落入自然月；
- 跨月退款不修改历史 Accrual 或历史 Settlement；
- 若原 Accrual 已进入旧月 Settlement，后续月通过负 Reversal Item 形成审计调整。

### 4.2 Accrual 候选

Accrual 必须同时满足：

1. Channel/currency 匹配；
2. `occurred_at` 位于 `[periodStart, periodEnd)`；
3. `occurred_at < cutoffAt`；
4. `eligible_at <= cutoffAt`；
5. 没有任何既有 Settlement Item 引用该 Accrual；
6. 来源 PaymentEvent 为 `TEST + payment_succeeded + applied`；
7. Rule 为 TEST，且 `ACTIVE/RETIRED` 的有效窗口覆盖 Accrual `occurred_at`；
8. Rule 的 `refund_observation_days` 可重新证明 Accrual `eligible_at`。

如果一个尚未结算的 Accrual 在 cutoff 前已被累计完全冲正，则该 Accrual 不形成正 Item。

### 4.3 Reversal 候选

Reversal 必须同时满足：

1. 关联 Accrual 的 Channel/currency 匹配；
2. Reversal `occurred_at` 位于 `[periodStart, periodEnd)`；
3. Reversal `occurred_at < cutoffAt`；
4. 没有任何既有 Settlement Item 引用该 Reversal；
5. 来源 PaymentEvent 为 `TEST + refund_succeeded|chargeback_succeeded + applied`；
6. 原 Accrual 已经存在 Settlement Accrual Item。

第 6 条防止“原正佣金从未结算，但只生成一条负调整”。如果 Accrual 与其全额 Reversal 都尚未结算，则两者作为已归零组合跳过，不制造正负两条无业务净额的 Item。若 Accrual 已在旧月草稿中占用，跨月 Reversal 才作为本月负 Item 纳入。

当前 03.3C 仅允许安全的 TEST 全额冲正；未来若部分退款获批，必须单独扩展净额算法和测试，当前实现不得猜测比例。

### 4.4 零额与负额草稿

- 无候选 Item 时仍允许创建零额 Draft，作为该 Scope/Period/cutoff 的审计结果；
- 仅包含已结算历史 Accrual 的跨月 Reversal 时允许负净额 Draft；
- `netAmountMinor` 只是审计汇总，不代表欠款、扣款、可提现余额或真实资金动作。

## 5. TEST Rule 与退款观察期证据

Repository 必须通过数据库事实重新验证：

- PaymentEvent `payment_mode = TEST`；
- Rule `payment_mode = TEST`；
- Rule 在 Accrual `occurred_at` 时处于有效窗口；
- `eligible_at = occurred_at + refund_observation_days`；
- Rule、PaymentEvent、Accrual currency 一致。

Rule 后续从 ACTIVE 进入 RETIRED 不抹除历史有效性；只要历史有效窗口覆盖来源时间仍可结算。DRAFT、LIVE、窗口不覆盖或观察期证据不一致均 fail closed，整笔 Draft 不落库。

## 6. 幂等与并发算法

Repository 在单一 PostgreSQL 事务中：

1. 对 `Channel + currency + periodStart + periodEnd` 取得 transaction advisory lock；
2. 对 `idempotencyKey` 取得 transaction advisory lock；
3. 按 key 查询既有 Settlement：
   - digest 相同：返回原 Draft 与其 Item 汇总，`replayed=true`；
   - digest 不同：409；
4. 检查同 Scope/Period 是否已有 Settlement：
   - 若请求 digest 相同，返回既有 Draft；
   - 否则返回 409 Scope/Period 冲突；
5. 锁定并验证 active Channel/Organization 与 active Platform Admin Membership；
6. 查询并锁定候选 Accrual/Reversal，重新验证 TEST Rule/Payment/观察期证据；
7. 生成 deterministic canonical Item snapshots/digests；
8. 汇总 gross accrual、gross reversal、net 和 count，生成 Settlement snapshot/digest；
9. 插入 `draft` Settlement；
10. 批量插入 Item；
11. 返回安全投影。

数据库唯一约束作为最后一道并发保护。任一候选、Item、snapshot 或 Actor 校验失败，整个事务回滚，不留下空壳 Settlement。

## 7. Digest 与快照

### 7.1 Request digest

使用服务端 secret 的 HMAC-SHA256，事实至少包含：

- `paymentMode`；
- `beneficiaryChannelId`；
- `currency`；
- `periodStart`、推导后的 `periodEnd`；
- `cutoffAt`；
- trim 后 `idempotencyKey`。

### 7.2 Item snapshot

只保存审计所需 canonical 事实：

- schema/version 与 TEST/NON_QUOTE 标记；
- entry type、source ID、source occurredAt；
- Channel、currency、amount；
- Accrual Item 保存 eligibleAt、Rule Version ID、calculation digest；
- Reversal Item 保存原 Accrual ID、reversal type、reversal digest。

### 7.3 Settlement snapshot

保存：

- schema/version 与 TEST/NON_QUOTE 标记；
- Scope、period、cutoff；
- 按稳定顺序排列的 Item digest 列表；
- gross accrual、gross reversal、net 和 count；
- 创建 Actor Membership ID。

HTTP 不暴露内部 snapshot/digest。

## 8. 错误合同

建议稳定错误：

- `COMMISSION_SETTLEMENT_SCOPE_NOT_FOUND`：404；
- `COMMISSION_SETTLEMENT_PERMISSION_DENIED`：403；
- `COMMISSION_SETTLEMENT_VALIDATION_FAILED`：422；
- `COMMISSION_SETTLEMENT_IDEMPOTENCY_CONFLICT`：409；
- `COMMISSION_SETTLEMENT_PERIOD_CONFLICT`：409；
- `COMMISSION_SETTLEMENT_EVIDENCE_INVALID`：409，TEST Rule/观察期/来源证据不足时 fail closed。

HTTP 使用中文安全文案，内部错误不得泄漏 SQL、secret、snapshot 或其他 Scope 数据。

## 9. Test-first 验收

### 9.1 Service/Route

1. Platform Admin 创建 TEST Draft；
2. 非 Platform Scope 404，Platform 缺角色 403，权限失败前不写 Repository；
3. LIVE、非月初、cutoff 过早、非法 currency/key/UUID 返回稳定错误；
4. 首次 201 + replay false；replay 200 + replay true；
5. 同 key 不同请求 409；
6. 响应无 paid/withdrawable/已到账/可提现及敏感快照。

### 9.2 PostgreSQL Repository

1. 只纳入 period 内、`eligible_at <= cutoff` 的未占用 TEST Accrual；
2. 未到 eligibleAt 不纳入；
3. cutoff 前完全冲正且原 Accrual 未结算时，正负事实均不生成 Item；
4. 原 Accrual 已被旧月 Settlement 占用时，跨月 Reversal 形成负 Item；
5. 已占用 Accrual/Reversal 不重复纳入；
6. LIVE、DRAFT Rule、历史窗口不匹配或观察期证据不一致时整笔 fail closed；
7. 同 key replay 返回原 ID、金额和 Item count；
8. 同 key 不同 digest 返回 409；
9. 同 Scope/Period 不同 key 返回 409；
10. 同 Scope/Period 并发只有一个 Draft，Item 零重复；
11. 任一 Item 插入失败时 Settlement 与其他 Item 全回滚；
12. 零候选允许零额 Draft；安全范围内允许负净额 Draft。

## 10. 预计代码切片与提交

### 10.1 计划冻结

```text
docs(business-plane): freeze test settlement draft plan
```

### 10.2 核心模块

新增：

```text
apps/control-api/src/settlements/types.ts
apps/control-api/src/settlements/errors.ts
apps/control-api/src/settlements/digest.ts
apps/control-api/src/settlements/repository.ts
apps/control-api/src/settlements/repository.postgres.test.ts
apps/control-api/src/settlements/service.ts
apps/control-api/src/settlements/service.test.ts
apps/control-api/src/settlements/routes.ts
apps/control-api/src/settlements/routes.test.ts
```

提交：

```text
feat(control-api): create test commission settlement drafts
```

### 10.3 共享 Bootstrap

独立修改并提交：

```text
apps/control-api/src/app.ts
apps/control-api/src/app.test.ts
apps/control-api/src/server.ts
```

提交：

```text
feat(control-api): wire commission settlement routes
```

B 后续修改共享 Bootstrap 前必须同步该提交。

### 10.4 收口

更新：

```text
docs/program/threads/C0/A_BIZ_03_3_COMMISSION_REVERSAL_SETTLEMENT_PLAN.md
docs/program/threads/C0/STATUS.md
docs/program/threads/C0/HANDOFF.md
docs/program/threads/C0/CHANGELOG.md
```

并同步桌面知识库：

```text
/Users/wensheng2tang/Desktop/知识库/项目/shortVideoAgent/开发进度.md
```

## 11. Gate

```bash
npm --prefix apps/control-api test -- \
  src/settlements/service.test.ts \
  src/settlements/routes.test.ts \
  src/settlements/repository.postgres.test.ts \
  --pool=forks --maxWorkers=1
npm --prefix apps/control-api run typecheck
npm --prefix apps/control-api run build
npx eslint apps/control-api/src/settlements
npx prettier --check apps/control-api/src/settlements \
  docs/program/threads/C0/A_BIZ_03_3E_TEST_SETTLEMENT_DRAFT_PLAN.md
CONTROL_API_TEST_DATABASE_URL=postgresql://127.0.0.1:5432/videoagent_control_test \
  npm --prefix apps/control-api test -- --pool=forks --maxWorkers=1
npm run validate:governance
git diff --check
```

## 12. 开工边界

计划提交之后从 RED 测试开始。未获得新商业授权前，任何实现都不得：

- 发布真实佣金 Rule 或真实比例；
- 接受 LIVE Settlement；
- 把 Draft 描述成到账、余额、可提现或 paid；
- 添加 KYC、税务、发票、提现、出款或自动打款；
- 修改 B 的 StoryCanvas/Provider 文件。

## 13. 完成记录（2026-08-08）

- 新增 `apps/control-api/src/settlements/**`，完成 Platform Admin 显式创建 TEST Settlement Draft 的 Repository、Service、Router、安全 DTO、HMAC request digest 与 canonical snapshot digest。
- Route 已接入 `POST /api/v1/platform/commission-settlements`：首次创建 `201 + idempotency-replayed: false`，同事实 replay `200 + idempotency-replayed: true`。
- PostgreSQL Repository 使用 Scope/Period 与 idempotency advisory lock；同 key 不同事实和同 Scope/Period 不同 key 均稳定 409，并发创建只产生一个 Draft 和一组 Item。
- 净额语义已实现：未到 `eligibleAt` 排除；cutoff 前未结算且完全冲正的 Accrual/Reversal 组合净归零；旧月已占用 Accrual 的跨月 Reversal 在新月形成负 Item；零候选可创建零额审计 Draft。
- 来源证据重新验证 TEST applied Payment、来源事件发生时有效的 TEST Rule、观察期、Channel/currency 和 Item 占用；不完整或部分冲正证据 fail closed。
- 新增 Migration 018 修复 Migration 016 的 PL/pgSQL record/alias 重名缺陷；已有 Reversal Settlement Item 时 rollback fail closed，不改写已发布 Migration 016。
- HTTP 投影只返回 `draft` 与汇总金额/数量，不暴露 snapshot/digest、Rule 比例、审批凭据，也不表达 paid、到账、可提现或真实资金动作。
- 共享 Bootstrap 提交 `0433fdb` 修改 `apps/control-api/src/app.ts`、`app.test.ts`、`server.ts`；B 后续修改这些文件前必须先同步该提交。
- 定向 Gate：Migration 018/迁移链/Repository `3 files / 9 tests`；Settlement 核心 `3 files / 26 tests`；Bootstrap/Router `2 files / 19 tests`，全部 PASS。
- 全量 Gate：Control API `54 files / 363 tests` PASS；typecheck、build、ESLint、Prettier、Governance、`git diff --check` 全 PASS。
- `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交。

当前状态：`A_BIZ_03_3E_COMPLETE / A_BIZ_03_3_COMPLETE / READY_FOR_03_4_PLANNING`。下一步只规划 A-BIZ-03.4 商业前端与审计，不在本节点扩张 LIVE Settlement、review/approve 命令、paid、提现、KYC、税务或自动打款。
