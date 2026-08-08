# A-BIZ-03.1 · TEST Recharge / Payment Foundation 计划

- 日期：2026-08-08
- 负责人：工程师 A（业务平台）
- 分支：`dev/business-plane`
- 状态：`PLAN_FROZEN / READY_FOR_03_1A_RED`
- 上游依据：`A_BIZ_00_3_REGISTRATION_TERMS_BILLING_ADR.md`（ACCEPTED）
- 前置完成：A-BIZ-02.1～02.4（Terms、Invitation、Registration/Attribution 与前端）

## 1. 本节点目标

建立充值现金事实和支付事件 Inbox 的最小可信底座，并只开放明确标记的 TEST Payment Adapter。当前节点不把 RechargeOrder 当额度余额，不计提佣金，不接真实支付，不把测试到账描述为真实收款。

A-BIZ-03.1 完成后应具备：

1. 版本化、可审计且默认无激活数据的 Credit Conversion Rule / TEST SKU 快照；
2. Tenant 归属明确的 RechargeOrder 与 append-only Order Event；
3. Provider Event identity、digest、金额、币种和模式明确的 PaymentEvent Inbox；
4. 同订单创建请求安全 replay，不同 digest 冲突；
5. 同 Provider Event 重放返回原接收结果，不同 digest 冲突；
6. TEST Adapter 可生成/验证测试事件，LIVE Adapter 默认 unavailable；
7. 支付、额度、佣金继续三账分离，03.1 不提前追加 Credit Ledger 或 Commission 事实。

## 2. 基线审计

### 2.1 已有能力

- migration 001 已有 `wallets`、`credit_reservations`、append-only `credit_ledger_entries`；Ledger operation 已包含 `issue`，但目前没有 Recharge/Payment 发行链路。
- `wallets.tenant_id` 唯一，Wallet 与 Tenant 一对一；当前注册事务不会自动创建 Wallet。
- migration 013 已有不可覆盖的 `referral_attributions`，可作为后续订单归因快照来源。
- Control API 已有 Active Membership Context、Tenant/Channel/Platform Scope、幂等 digest、严格 Router、PostgreSQL transaction 与安全错误模式可复用。

### 2.2 明确缺口

- 没有 RechargeOrder、PaymentEvent、转换规则版本、支付 Provider Port 或 TEST Adapter。
- 没有 Wallet 充值发行事实，也没有 RechargeOrder → PaymentEvent → Credit posting 的唯一关联。
- 没有真实 SKU 售价、额度数量、币种、订单有效期、退款周期或佣金比例；这些不得由工程师填默认商业数字。
- 现有 Demo `NON_QUOTE` 价格、旧渠道批发差价和 LocalStorage 数据不得迁入正式账。

## 3. 切片拆分

### A-BIZ-03.1A · Migration 014 Recharge / Payment Schema

新增 `014_recharge_payment_foundation.ts` 和 PostgreSQL 合同测试，先确认缺表 RED，再实现最小 Schema。

建议对象：

- `credit_conversion_rule_versions`
  - `rule_version_id`
  - `rule_code` / `version_label`
  - `payment_mode: TEST | LIVE`
  - `status: DRAFT | ACTIVE | RETIRED`
  - `currency`（ISO 4217 形式，三位大写字符）
  - `amount_minor > 0`
  - `purchased_credits > 0`
  - `bonus_credits >= 0`
  - `bonus_expires_in_days`：无赠送时为空；有赠送时必须为正数
  - `rule_digest`（SHA-256）
  - `effective_at` / `retired_at`
  - `approved_by_membership_id`：只有激活版本需要可信平台管理员
  - 不 seed TEST 或 LIVE Rule；测试只在 fixture 中插入明确 TEST 数据

- `recharge_orders`
  - `recharge_order_id`
  - `tenant_id` / `wallet_id`
  - `buyer_user_id` / `buyer_membership_id`
  - `payment_mode`
  - `conversion_rule_version_id`
  - `amount_minor` / `currency`
  - `status: created | pending | paid | partially_refunded | refunded | cancelled | disputed`
  - `attribution_snapshot_id`（可空；没有 Channel 归因时保持空，不伪造）
  - `idempotency_key` / keyed-HMAC `request_digest`
  - `created_at` / `updated_at`
  - DB 必须验证 Wallet 属于 Tenant、Buyer Membership 属于同 Tenant Organization/User、金额币种与 Rule 快照一致

- `recharge_order_events`
  - append-only 状态/审计事件；不得用覆盖 Order 历史代替事件
  - `event_type` 与 Order 状态机一致
  - `source_payment_event_id` 可空，仅支付驱动事件引用 PaymentEvent
  - `actor_type` / `actor_id` / `reason_code` / `occurred_at`

- `payment_events`
  - `payment_event_id`
  - `payment_mode: TEST | LIVE`
  - `provider_code` / `provider_event_id`
  - `event_type: payment_succeeded | payment_failed | refund_succeeded | chargeback_succeeded`
  - `event_digest`（SHA-256）
  - `recharge_order_id`
  - `amount_minor` / `currency`
  - `occurred_at` / `received_at`
  - `processing_status: received | applied | rejected`
  - `error_code` 只允许安全枚举或空
  - `provider_code + provider_event_id` 唯一；identity 相同 digest 不同由 Repository 稳定冲突
  - 身份、金额、币种和事件原始事实不可修改/删除；若保留 processing 字段，只允许 `received → applied|rejected` 单向转换

必要兼容调整：

- 给 `wallets` 增加 `(wallet_id, tenant_id)` 复合唯一键，RechargeOrder 使用复合 FK，阻止跨 Tenant Wallet。
- 不修改现有 Credit Ledger operation/bucket 语义；Credit issuance link 留到 A-BIZ-03.2。

03.1A PostgreSQL 合同至少覆盖：

1. 合法 TEST Rule、Wallet、Order、Order Event、Payment Event；
2. 无激活 Rule seed，LIVE 不会因 migration 自动开放；
3. 金额必须整数最小单位且大于零，currency 格式稳定；
4. Order/Wallet/Tenant 和 Buyer Membership/User/Organization 跨 Scope 拒绝；
5. Order 金额币种必须等于冻结 Rule；客户端不能覆盖额度数量；
6. Provider identity 唯一，event/order 金额币种一致；
7. Payment 原始事实与 Order Event append-only；Order 状态不可倒退或跳过合法状态机；
8. TEST/LIVE mode 不能混用；
9. 空事实可 rollback；存在 Rule/Order/Event/Payment 审计事实时 down fail closed；
10. migration chain 从空库加载 001～014，并对重复 latest no-op。

### A-BIZ-03.1B · Domain / Repository / TEST Adapter

先写 Service/Repository/Adapter RED，再实现：

- `PaymentProvider` Port：验证事件并返回最小规范化 Payment Event，不把签名、密钥、原始敏感 body 交给普通日志或 Store。
- `TestPaymentAdapter`：只处理 `paymentMode=TEST`，事件和 UI/响应必须明确 TEST；它不是 LIVE Provider 模拟成功的 fallback。
- `UnavailableLivePaymentAdapter`：任何 LIVE 请求稳定 fail closed；未配置真实 Provider 时零订单状态/额度/佣金副作用。
- RechargeOrder 创建：Actor 必须是目标 Tenant 的 active `tenant_admin`；服务端解析/必要时幂等创建该 Tenant Wallet，客户端不得选择其他 Wallet、金额、额度或 Attribution。
- Rule 选择：只允许显式指定且已 ACTIVE 的 TEST Rule；Repository 在事务内锁定 Rule 和 Wallet，并把金额/币种/额度转换事实冻结到订单。
- 订单幂等：同 Tenant + key + digest replay；不同 digest 409；digest 使用独立 Secret，不复用 Registration/Session Secret。
- Payment Event Inbox：先验证 Provider，再按 provider identity 加 advisory lock；同 digest replay，不同 digest冲突；写入 `received` 事实。
- 03.1B 只接收并持久化事件，不把订单标记 paid、不发行 Credit、不计提 Commission；这三项必须在 03.2 原子处理器内同时决定，避免“支付已完成但额度未入账”的半状态被误报为完整到账。

### A-BIZ-03.1C · HTTP API / Bootstrap（独立共享提交）

冻结并实现最小路由：

- `POST /api/v1/tenants/:tenantId/recharge-orders`
- `GET /api/v1/tenants/:tenantId/recharge-orders`
- `POST /api/v1/internal/payments/test/events`
- `GET /api/v1/platform/payment-events`

边界：

- Tenant 路由复用 Active Membership / Tenant Scope；跨 Tenant 404、范围内无动作 403。
- Internal TEST Event 使用独立内部服务鉴权，不接受浏览器 Session 冒充 Provider。
- 所有 TEST 订单/事件响应包含明确 `paymentMode: TEST`，不得出现“真实到账”“已收款”等表述。
- LIVE 路由/Adapter 未配置时 503 fail closed；不使用 TEST Adapter 兜底 LIVE。
- Router/Bootstrap 修改 `apps/control-api/src/app.ts`、`server.ts`、`config.ts` 时独立提交并通知 B。

## 4. 明确不做

A-BIZ-03.1 不实现：

- 真实微信/支付宝/银行卡支付、真实商户配置或原始回调持久化；
- 正式 SKU、价格、促销、币种范围、订单超时或退款周期；
- Credit Ledger 发行、赠送额度批次、到期和退款回收；
- Commission Rule、Accrual、Reversal、Settlement；
- 自动退款、提现、KYC、税务、开票或自动打款；
- Demo/LocalStorage 钱包迁移；
- B 的 StoryCanvas/Script/Storyboard/Production 页面和 Provider 代码。

## 5. 安全与日志

- 金额只用整数 minor unit；禁止 JavaScript 浮点金额进入 Domain。
- Provider 密钥、签名、原始敏感回调、卡号、支付凭据不得进入普通日志、错误响应或 PaymentEvent 表。
- request/event digest 只对 canonical 安全字段计算；使用独立 Secret 的 digest 与普通 SHA-256 event evidence 分开。
- 未知数据库/Provider 错误统一安全 500/503，不反射 SQL constraint、Secret 或原始 payload。
- TEST 和 LIVE 从 Schema、Adapter、Config、API、响应到页面全链路显式分离。

## 6. Git 与协作纪律

建议独立提交：

1. `docs(business-plane): freeze recharge payment foundation plan`
2. `feat(control-api): add recharge payment foundation schema`
3. `feat(control-api): add test payment foundation service`
4. `feat(control-api): expose test recharge payment api`

每个切片显式 `git add <A files>`，禁止 `git add .`。B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 始终排除。03.1A/03.1B 不修改共享 Bootstrap；03.1C 修改共享文件后通知 B 同步。

## 7. Gate

每切片至少执行：

```bash
npm --prefix apps/control-api run typecheck
npm --prefix apps/control-api run build
npm --prefix apps/control-api test -- --pool=forks --maxWorkers=1
npm run validate:governance
git diff --check
```

PostgreSQL 测试只允许专用 `_test` 数据库，并使用单 worker 避免共享 schema 并发竞争。Root 前端只在 03.1C/前端接线时运行；03.1A/03.1B 不因无关重页面并发超时修改 B 测试。

## 8. 下一步

提交本计划后进入 A-BIZ-03.1A：新增空 `014_recharge_payment_foundation.ts` 与 PostgreSQL 合同测试，先证明缺表/缺约束 RED，再实现最小 Schema。不得在 RED 阶段 seed TEST Rule、写支付成功逻辑、追加 Credit Ledger 或创建 Commission 表。
