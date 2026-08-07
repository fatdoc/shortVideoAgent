# ADR-A-BIZ-00.3 · 注册归因、用户须知与充值佣金账

- 状态：ACCEPTED / IMPLEMENTATION_AUTHORIZED_WITH_FAIL_CLOSED_COMMERCIAL_GATES
- 日期：2026-08-06
- 提案人：工程师 A（业务平台）
- 会签结果：C0 / 产品业务口径已批准；财务法务真实上线资料延期并保持 fail closed；工程师 B 按跨平面边界知会
- 决策人：C0
- 接受日期：2026-08-06
- 决策依据：`docs/collaboration/A_ENGINEER_WAVE0_BOSS_DECISION_REPLY_2026-08-06.md`、`docs/collaboration/A_ENGINEER_BUSINESS_DECISION_CORRECTION_2026-08-06.md`
- 前置 ADR：`A_BIZ_00_2_MULTI_ORG_RBAC_ADR.md`
- 适用范围：Terms、Invitation、Registration、Referral Attribution、Recharge、Payment Event、Credit Issuance、Commission Ledger
- 不适用范围：正式协议正文、真实支付渠道接入、开票/税务/KYC/自动打款、B 侧媒体任务实现

## 1. 背景

2026-08-06 最新共创决策要求业务平台支持：

1. 平台邀请注册；
2. 代理商邀请和分享链接注册；
3. 用户不带邀请直接注册，并在同一事务中创建单人普通 Tenant；
4. 注册时主动勾选当前已发布用户须知，并保存版本化同意证据；
5. 注册时冻结获客来源和代理归因，不允许客户端任意改绑；
6. 充值到账后增加 AI 额度，并按冻结规则产生代理佣金；
7. 退款、撤单和拒付通过追加冲正表达，历史不可覆盖。

当前仓库没有正式服务端 Terms、Invitation、Registration、Referral、Recharge、Payment 或 Commission 模型。已有能力主要是：

- Pilot 白名单登录，不支持公开注册；
- Tenant Wallet、Credit Reservation 和 append-only Credit Ledger；
- 幂等记录、payload digest 和跨平面 Receipt Inbox；
- Demo 商业投影和 C3 v0.1 额度/价格提案，但全部是演示或待会签语义。

因此不能直接把 Demo 价格、旧渠道差价算例或测试支付写入生产规则。本 ADR 已冻结安全状态机、事实边界、事务顺序、错误语义和审计证据；老板未提供的正式正文、真实支付资料、SKU 售价、佣金比例和结算合规参数继续保持 `TBD` 或 fail closed。

## 2. 已发现的规则冲突

`C3_CREDIT_PRICING_SETTLEMENT_V0_1.md` 的旧提案主张：

- 渠道逐级买入/卖出额度；
- 收益来自直接销售边的批发差价；
- 不默认从终端订单向所有上级自动抽佣。

2026-08-06 最新决策要求：

- 代理商通过邀请形成用户归因；
- 归因用户充值后产生代理提成。

老板已书面选择：**首版充值佣金替代旧批发差价**。

冻结规则：

- 一笔订单只能进入一种代理收益模型；
- 首版不启用旧批发差价正式账，历史 Demo 数据保持 `NON_QUOTE`，不迁入正式佣金账；
- 首版只有直接归因代理受益，不做多级分佣；
- Schema 使用版本化 Commission Rule 和快照；
- 佣金具体比例、舍入和退款观察期未授权前，正式 Rule 保持未发布，不得用 Demo 数字替代；
- 不允许同一充值既按差价又按佣金重复收益。

## 3. 设计原则

1. **须知先于邀请和注册。** 没有可用 PUBLISHED Terms 时，公开注册 fail closed。
2. **邀请是激活凭据，不是密码分配。** 平台/代理不得设置、查看或保存用户明文密码。
3. **归因是服务端事实。** 客户端参数只能提交 Token，不能直接指定 `referrerChannelId`。
4. **注册是单事务。** User、组织/Membership、Consent、Invitation Usage、Attribution 和幂等结果必须共同成功或共同回滚。
5. **三账分离。** 现金充值、AI 额度、代理佣金是三种事实，禁止以一个余额字段替代。
6. **事件与账本只追加。** 退款、拒付、人工修正使用 Reversal/Adjustment，不改写历史。
7. **外部事件至少一次，内部副作用恰好一次。** 同一支付事件重放不得重复加额度或计提佣金。
8. **测试支付不冒充真实收款。** Adapter、页面、审计和导出必须明确标记 `TEST`。
9. **最小化敏感数据。** Token 只存 digest；密码只存强哈希；支付签名/原始敏感体不进普通日志。
10. **未冻结规则不以默认值落库。** 已书面批准的试点期限和状态机可以版本化落库；正式金额、SKU 售价、佣金比例、退款观察期、支付商户资料和正式文案仍为 `TBD`。

## 4. 备选方案

### 方案 A：注册、充值、额度和佣金写在一个宽表

**优点：** 初期页面查询简单。

**缺点：** 无法正确处理异步支付、重放、部分退款、拒付、额度已消费、佣金冲正和审计；任何字段更新都会破坏历史。

**结论：** 拒绝。

### 方案 B：完全事件溯源，所有业务都由通用 Event Store 重建

**优点：** 理论上可完整审计。

**缺点：** 当前团队和 Pilot 规模下复杂度过高；会迫使 Auth、Terms、Registration 与 Billing 同时重写，扩大风险。

**结论：** 当前阶段拒绝。

### 方案 C：领域状态表 + append-only 证据/账本（推荐）

- Terms/Invitation/Registration Order 使用受约束状态表；
- Consent、Invitation Usage、Attribution Event、Payment Event、Credit Ledger、Commission Accrual/Reversal 使用不可覆盖证据；
- 每个外部/客户端命令通过业务范围内的幂等键和 payload digest 去重；
- 状态表仅保存可重建摘要，账本/事件为事实源。

**结论：** 接受。按方案 C 实施；真实资金、正式报价、提现和自动出款继续受独立 fail-closed Gate 约束。

## 5. 用户须知模型

### 5.1 建议实体

```text
TermsDocument
- termsDocumentId
- documentCode
- title
- status: active | retired
- createdAt / updatedAt

TermsVersion
- termsVersionId
- termsDocumentId
- versionLabel
- status: DRAFT | PUBLISHED | RETIRED
- content
- contentDigest
- locale
- publishedAt
- effectiveAt
- publishedBy
- supersedesTermsVersionId
- createdAt

UserConsent
- userConsentId
- userId
- termsVersionId
- contentDigestSnapshot
- acceptedAt
- acceptanceContext
- registrationId
- evidence metadata
```

### 5.2 冻结规则

- DRAFT 可编辑；PUBLISHED 后正文、digest、locale、版本号和生效时间不可原地修改。
- 正文任何变化必须创建新版本。
- Public current endpoint 只返回当前场景可用的 PUBLISHED 版本。
- 当前版本选择必须由服务端按 document code、locale、生效时间和发布状态决定。
- 注册请求必须同时提交 `termsVersionId` 与显式 `accepted=true`；仅打开页面、预勾选或隐式继续不算同意。
- 事务内重新读取当前版本并比较 digest，不能信任客户端缓存的正文或版本状态。
- 无当前发布版本、版本已替换或 `accepted != true` 时注册失败，不创建半成品账号。
- UserConsent append-only；撤回、再次同意或版本升级另建事件，不更新原记录。
- 版本发布时由业务设置 `mustReaccept`；重大版本要求再次同意后才能继续受限操作。正式正文、document code/locale、发布人和法务审批仍为 `TBD`。
- 工程提交不得用空字符串、Lorem Ipsum 或自拟条款冒充正式协议。

### 5.3 同意证据最小集

必须保存：

- `userId`、`termsVersionId`、`contentDigestSnapshot`；
- `acceptedAt`、注册/邀请场景；
- 服务端 request/audit id；
- 必要的网络/客户端证据是否保存及保存期限：由法务/隐私负责人 `TBD`。

不得将完整密码、Invitation Token、支付签名或不必要的设备指纹写入 Consent。

## 6. Invitation 生命周期

### 6.1 建议实体

```text
Invitation
- invitationId
- issuerMembershipId
- issuerOrganizationId
- invitationType: PLATFORM | CHANNEL | TENANT_MEMBER
- targetOrganizationId: nullable
- targetRoleCode: nullable / constrained
- attributionChannelId: nullable
- tokenDigest
- status: active | revoked | exhausted | expired
- validFrom / expiresAt
- maxUses
- usedCount（缓存；Usage 为事实源）
- createdAt / revokedAt

InvitationUsage
- invitationUsageId
- invitationId
- registrationId
- userId
- usedAt
- idempotencyKey
```

### 6.2 Token 与预览

- 链接只在创建响应中返回一次明文 Token；数据库只存带版本前缀的强 digest。
- 日志、错误、分析埋点和普通审计不得保存完整 Token。
- Token 至少具备足够随机性；不能用 Invitation ID、邮箱或可枚举字段生成。
- Preview 返回最小安全信息，例如邀请方展示名、目标组织类别、到期提示和 Terms 要求；不得泄漏用户列表、内部角色、佣金规则或完整组织树。
- 不存在、撤销、过期、超限的 Token 对外使用统一无效响应，避免枚举生命周期。

### 6.3 生命周期规则

- 只有服务端 Policy 允许的平台/代理/企业成员可创建对应类型 Invitation。
- 代理只能创建自身授权范围内且归因到自身 Channel 的邀请；客户端不能覆盖归因。
- 平台可创建平台直营邀请，或在具有权限时创建指定 Channel 归因邀请。
- 撤销只影响未发生的使用；历史 Usage 和 Attribution 不删除。
- 使用次数必须通过行锁/原子更新或约束保证，并发不能超卖。
- 同一注册重放返回原结果，不重复增加 `usedCount`。
- 定向成员邀请绑定邮箱、7 天有效、单次使用；代理分享链接 30 天有效、默认最多 100 次，平台可降低次数或提前撤销。撤销后不能恢复，必须重新发新邀请。
- 邀请不得保存或返回用户密码；受邀用户必须自己设置凭据并通过密码策略。

## 7. 单一注册流程与归因

### 7.1 注册来源

公开端只有一个注册端点和一套注册事务。企业与个人不拆分 User、Tenant、Membership、API、Router 或工作台。

| 来源 | 可信输入 | 服务端冻结来源 | 注册结果 |
|---|---|---|---|
| 直接注册 | 无 Invitation Token | `DIRECT` | 创建 User、单人普通 Tenant 和本人 `tenant_admin` Membership |
| 平台获客邀请 | Invitation Token | `PLATFORM_INVITATION` | 创建单人普通 Tenant；归因平台直营或经授权指定 Channel |
| 代理获客邀请 | Invitation Token | `CHANNEL_INVITATION` + Token 对应 Channel | 创建单人普通 Tenant；归因 Token 对应 Channel |
| 企业成员邀请 | Invitation Token | `TENANT_MEMBER_INVITATION` + 服务端可信目标 Tenant/Role | 加入已有 Tenant，不创建新 Tenant |

客户端不得提交或覆盖可信的 `acquisitionSource`、`referrerChannelId`、目标 Tenant 或目标 Role。

### 7.2 建议实体

```text
Registration
- registrationId
- normalizedEmail
- status: processing | completed | rejected
- registrationPath
- invitationId: nullable
- termsVersionId
- idempotencyKey
- requestDigest
- userId: nullable
- resultingOrganizationId / membershipId: nullable
- createdAt / completedAt

ReferralAttribution
- referralAttributionId
- subjectUserId
- subjectOrganizationId: nullable
- acquisitionSource
- referrerChannelId: nullable
- invitationId: nullable
- effectiveFrom
- protectedUntil: nullable
- status
- evidenceDigest
- createdAt

ReferralAttributionEvent
- eventId
- referralAttributionId
- eventType: created | corrected | ended
- reasonCode
- actedBy
- occurredAt
```

### 7.3 注册事务

推荐顺序：

1. 验证限流、请求格式和幂等键。
2. 对 normalized email 做防枚举的存在性处理。
3. 若有 Token，锁定并验证 Invitation active/有效期/次数/Scope。
4. 锁定并验证当前 PUBLISHED Terms；校验显式同意和版本/digest。
5. 完成邮箱验证、密码强度与慢哈希；平台管理员注册/激活还必须满足 MFA Gate。
6. 创建 User。
7. 对 DIRECT/PLATFORM_INVITATION/CHANNEL_INVITATION 创建单人普通 Tenant、本人 `tenant_admin` Membership；对 TENANT_MEMBER_INVITATION 加入 Token 指定 Tenant 并创建指定 Membership。
8. 写入 UserConsent。
9. 写入 InvitationUsage（如适用）。
10. 写入不可由客户端覆盖的 ReferralAttribution 与创建事件。
11. 写入审计和幂等结果，提交事务。
12. 会话签发应在事务结果可见后进行；失败重试不得重复创建 User/Tenant/Membership。

同 key + 同 digest 返回原结果；同 key + 不同 digest 返回 409。账号已存在、Token 无效等公开响应不得帮助攻击者确认邮箱是否注册。

### 7.4 统一 Tenant 归属

- “单人 Tenant”只是当前只有一个成员的普通 Tenant，不是独立 `consumer` 类型。
- 直接、平台邀请和代理邀请注册均创建 User、Tenant、本人 `tenant_admin` Membership、Consent 和 Attribution，并在一个数据库事务中共同成功或回滚。
- 单人 Tenant 后续补充企业/品牌资料或增加成员时原地成长为多人企业 Tenant，不迁移账号、项目、资产、钱包或账本。
- 企业成员邀请绑定服务端可信目标 Tenant；激活后加入该 Tenant，不再创建 Tenant。
- 不新增 C 端角色、C 端工作台、C 端 Router 或 C 端注册 API。

### 7.5 归因保护与纠错

- 首次 Attribution 是不可覆盖事实；默认保护期为注册成功后 12 个月，规则版本和到期时间写入归因快照。
- “服务代理商”“账单卖方”“佣金受益方”“最初获客方”可能不同，不能都压缩为一个 `currentChannelId`。
- 首次归因不可覆盖；纠错只能追加带原因、操作人和生效时间的事件。
- 改绑不追溯修改历史充值、历史额度或历史佣金。
- 保护期后的续期、转直营或重新签约必须使用新版本化商业规则；规则未发布时 fail closed。

## 8. 三账模型

### 8.1 现金充值账

```text
RechargeOrder
- rechargeOrderId
- buyerUserId
- beneficiaryOrganizationId / walletId
- amountMinor
- currency
- status: created | pending | paid | partially_refunded | refunded | cancelled | disputed
- paymentMode: TEST | LIVE
- price/creditConversionSnapshotId
- attributionSnapshotId
- idempotencyKey / requestDigest
- createdAt / updatedAt

PaymentEvent
- paymentEventId
- providerCode
- providerEventId
- eventType
- eventDigest
- rechargeOrderId
- amountMinor / currency
- occurredAt / receivedAt
- processingStatus
- sanitizedPayloadReference: optional
```

规则：

- 金额只用整数最小货币单位和明确 currency，不使用浮点数。
- Provider Event 的唯一键至少包含 provider + providerEventId；同事件重放返回已处理结果。
- PaymentEvent 是接收事实，RechargeOrder 是业务摘要；原始事件不得因订单状态更新而删除。
- 签名、卡号、支付凭据和不必要原始体不进入普通日志；是否加密保存原始回调由支付合规 `TBD`。
- 首版只提供明确标记的 TEST Payment Adapter 和管理员人工充值；真实支付渠道、币种、最低/最高金额、订单有效期和退款周期继续 `TBD` 并 fail closed。

### 8.2 AI 额度账

继续复用并扩展现有 Wallet / append-only Credit Ledger，不以 RechargeOrder 的状态字段代替额度事实：

- 支付成功且满足到账条件时，生成一组 `issue`/purchase issuance 分录；
- 每次发行保存 RechargeOrder、PaymentEvent、额度换算规则版本和快照引用；
- 重放同一 PaymentEvent 不产生第二组 posting group；
- 退款时通过追加退款/回收/调整分录处理，不删除发行分录；
- 充值订单购买版本化额度 SKU，不保存可提现人民币余额；具体 SKU 售价和额度数量未确认前只允许测试 SKU。
- 购买额度默认不过期，赠送额度默认 90 天到期，按最早到期批次优先消耗。
- 退款只冲正原订单尚未消费的额度；已消费导致不足时进入人工处理，不制造负余额绕过。

### 8.3 代理佣金账

```text
CommissionRuleVersion
- commissionRuleVersionId
- status: DRAFT | ACTIVE | RETIRED
- scope
- basisType
- rate representation
- currency
- effectiveFrom / effectiveTo
- ruleDigest
- approvedBy

CommissionAccrual
- commissionAccrualId
- beneficiaryChannelId
- rechargeOrderId
- paymentEventId
- referralAttributionId
- commissionRuleVersionId
- basisAmountMinor
- commissionAmountMinor
- currency
- calculationSnapshot
- status: accrued | reversed | eligible_for_settlement | settled
- occurredAt

CommissionReversal
- commissionReversalId
- commissionAccrualId
- sourcePaymentEventId
- amountMinor
- reasonCode
- occurredAt

CommissionSettlement
- commissionSettlementId
- beneficiaryChannelId
- period
- includedAccrualIds / reversalIds
- amountMinor / currency
- status: draft | reviewed | approved | paid（首版禁止进入 paid）
- snapshot
```

冻结规则：

- 只有被验证且满足可计提条件的 Payment Event 才能产生 Accrual。
- Accrual 必须快照保存 Attribution 和 Rule Version，后续改规则不得重算历史。
- 退款、撤单、拒付和人工纠错创建 Reversal；不得改写或删除 Accrual。
- 同一 Payment Event + Rule Scope 只能产生一次对应 Accrual。
- Commission Settlement 是对账/结算批次，不等于已经打款。
- 在提现、KYC、税务、开票和支付出款未冻结前，不启用自动打款，不向页面承诺“可提现”。
- 首版仅直接归因代理受益，基数为实际支付净额；佣金先进入 pending，超过退款观察期后才可结算，按自然月生成 Settlement 草稿。比例、舍入和退款观察期必须来自版本化 Rule；未授权前正式 Rule 保持未发布。

### 8.4 三账不可混合

| 事实 | 单位 | 事实源 | 禁止替代 |
|---|---|---|---|
| Recharge/Payment | money minor + currency | PaymentEvent + RechargeOrder | Wallet balance |
| AI Credit | integer AI_VIDEO_CREDIT | Credit Ledger | 人民币余额/Provider token |
| Commission | money minor + currency | Accrual/Reversal/Settlement | 渠道额度库存/订单毛差 |

一个支付成功处理事务可同时追加三类事实，但必须生成独立记录、独立幂等键/关联键和独立审计；任意一类不能从另一类当前余额反推并覆盖历史。

## 9. 支付事件处理与事务边界

外部支付系统与本数据库无法形成分布式单事务，因此采用：

1. 验证渠道签名和事件基础格式。
2. 以 provider event identity + digest 持久化 PaymentEvent Inbox。
3. 在同一个数据库事务中：
   - 锁定 RechargeOrder；
   - 判定合法状态迁移；
   - 追加额度 posting group；
   - 按冻结 Attribution/Rule 追加 Commission Accrual 或 Reversal；
   - 更新订单摘要和事件处理结果；
   - 保存幂等响应。
4. 事务提交后返回 ACK。
5. 同事件同 digest 重放返回原 ACK；同 identity 不同 digest 为冲突并进入人工审计。

任一步失败不得只完成额度、只完成佣金或只更新订单状态。外部 ACK 超时允许重放，但不能重复副作用。

## 10. 权限与数据范围

| Actor | Terms | Invitation | Registration | Recharge | Commission |
|---|---|---|---|---|---|
| Platform Admin | 草稿/发布/统计，需具体 Permission | 平台邀请、经授权 Channel 归因邀请 | 全局运营只读/人工处理 | 全局审计与异常处理 | 全局规则/计提/冲正/结算审计 |
| Channel Admin | 只读当前公开 Terms | 自身 Channel Scope 创建/撤销/查看 | 仅自身归因结果摘要 | 仅自身归因范围的允许视图 | 仅自身受益范围，不得看其他 Channel |
| Tenant Admin | 只读公开 Terms | 可创建绑定邮箱、7 天、单次使用的企业成员邀请 | 自身 Tenant 成员结果 | 自身 Tenant 下单/记录 | 不可查看代理佣金 |
| Content Operator | 只读公开 Terms | 禁止管理邀请 | 无管理权限 | 禁止充值管理 | 始终禁止 |
| Public | 只读 current PUBLISHED | 仅 Token Preview | 单一注册流程 | 不开放管理 API | 不开放 |

所有平台、Channel、Tenant 查询必须复用 A-BIZ-00.2 Active Context 和 Scope 规则。跨 Scope 资源统一 404；已知范围内缺动作 Permission 返回 403。

## 11. API Route Manifest 草案

### 11.1 Terms

```text
GET    /api/v1/public/terms/current
POST   /api/v1/platform/terms/documents
POST   /api/v1/platform/terms/:documentId/versions
POST   /api/v1/platform/terms/versions/:versionId/publish
GET    /api/v1/platform/terms/versions/:versionId/consents/summary
```

### 11.2 Invitation 与注册

```text
POST   /api/v1/platform/invitations
POST   /api/v1/channels/:channelId/invitations
GET    /api/v1/channels/:channelId/invitations
POST   /api/v1/invitations/:invitationId/revoke
GET    /api/v1/invitations/:token/preview
POST   /api/v1/public/registrations
```

### 11.3 充值与佣金

```text
POST   /api/v1/tenants/:tenantId/recharge-orders
GET    /api/v1/tenants/:tenantId/recharge-orders
POST   /api/v1/internal/payments/:provider/events
GET    /api/v1/platform/payment-events
GET    /api/v1/channels/:channelId/commission-accruals
GET    /api/v1/platform/commission-accruals
POST   /api/v1/platform/commission-rules/:ruleId/activate
POST   /api/v1/platform/commission-settlements
```

路由名是草案；正式实现前需冻结 Permission key、Request/Response Schema、分页、错误码、审计字段和幂等 header。

## 12. 错误与幂等语义

| 场景 | HTTP | 推荐错误码 |
|---|---:|---|
| 没有当前 PUBLISHED Terms | 503 或 409，最终待 API 会签 | `REGISTRATION_TERMS_UNAVAILABLE` |
| 未明确勾选 | 400 | `TERMS_ACCEPTANCE_REQUIRED` |
| Terms 版本已过期/不是当前版本 | 409 | `TERMS_VERSION_STALE` |
| Invitation Token 无效/撤销/过期/超限 | 410 或统一 400，最终待安全评审 | `INVITATION_UNAVAILABLE` |
| 同幂等键、同 digest | 200/原创建结果 | replay，不重复副作用 |
| 同幂等键、不同 digest | 409 | `IDEMPOTENCY_CONFLICT` |
| 邮箱已存在 | 防枚举统一响应 | 内部记录具体原因 |
| Payment Event 重放 | 200/原 ACK | duplicate，无副作用 |
| Payment identity 相同但 digest 不同 | 409 | `PAYMENT_EVENT_CONFLICT` |
| 退款金额超过可处理范围 | 409 | `REFUND_AMOUNT_CONFLICT` |
| Attribution/Rule 不满足计提 | 业务规则决定零计提或人工异常 | 不得静默套默认比例 |
| 跨 Channel/Tenant 查询 | 404 | 对应资源 Not Found |
| 范围内缺 Permission | 403 | `PERMISSION_DENIED` |

公开注册和 Token Preview 必须设置独立限流、防自动化和防账号枚举。具体阈值、验证码/风控方案为 `TBD`，不得在 ADR 中伪造生产参数。

## 13. 正反 Fixture

### 13.1 正向

1. 当前 PUBLISHED Terms 可获取，digest 与版本稳定。
2. 平台直营邀请注册：Consent、Usage、平台直营 Attribution 同事务落库。
3. 平台指定 Channel 归因邀请注册：权限和归因一致。
4. Channel 自身邀请注册：Token 归因不可被请求体覆盖。
5. 直接注册：无 Token，创建单人普通 Tenant 和本人 `tenant_admin` Membership，归因平台直营。
6. 同注册 key + 同 payload 重放返回同一 User/Registration。
7. TEST Recharge Payment succeeded：订单 paid、额度发行一次、佣金计提一次且均标记测试。
8. 同 Payment Event 重放：三账均无重复。
9. 全额/部分退款：追加 Credit/Commission Reversal，原发行和 Accrual 保留。
10. 规则升级：新充值使用新 Rule，历史 Accrual 快照不变。

### 13.2 负向

1. 没有 PUBLISHED Terms 时注册。
2. 使用 DRAFT、RETIRED 或旧 Terms Version。
3. 未勾选、伪造 digest 或同意版本在事务中被替换。
4. Token 不存在、撤销、过期、超限或并发最后一次使用。
5. 代理 A 创建/查看/撤销代理 B Invitation。
6. 请求体伪造 `referrerChannelId`、`acquisitionSource` 或目标组织。
7. 同 email 并发注册；响应不泄漏账号存在性。
8. 同 idempotency key 不同 payload。
9. Payment 签名错误、金额/币种与订单不匹配、事件乱序。
10. succeeded/failed 或 refund/chargeback 冲突事件。
11. 同 Payment identity 不同 digest。
12. 额度已消费导致可回收额度不足时进入人工异常，不制造负余额。
13. 停用 Channel 产生新邀请或新佣金。
14. Attribution 在保护期内被客户端或普通管理员改绑。
15. Channel 查询其他 Channel Accrual/Settlement。
16. Content Operator 管理充值、佣金、Terms 发布或 Invitation。
17. TEST Payment 被展示或导出为真实到账。
18. 同一充值同时按旧批发差价和新佣金重复收益。

## 14. Schema / Migration `006+` 草图（仅设计）

具体编号必须在 A-BIZ-00.2 组织迁移编号确定后分配。

### 阶段 A · Terms

- 新增 `terms_documents`、`terms_versions`、`user_consents`。
- Published Version 加不可变触发器或 Repository + DB 约束双保护。
- current version 的唯一/排他约束需支持 effective time；具体实现评审后确定。
- 未导入正式正文前不创建伪 PUBLISHED 数据。

### 阶段 B · Invitation / Registration / Attribution

- 新增 `invitations`、`invitation_usages`、`registrations`、`referral_attributions`、`referral_attribution_events`。
- Token digest 唯一；Usage 对 registration/invitation 唯一；Attribution 证据 append-only。
- 外键连接 A-BIZ-00.2 Organization/Membership。
- public registration 写路由使用统一 Tenant 模型；没有正式 PUBLISHED Terms、邮箱验证或安全 Gate 未满足时继续 fail closed。

### 阶段 C · Recharge / Payment Inbox

- 新增 `recharge_orders`、`payment_events` 和必要的转换规则快照。
- provider + providerEventId 唯一；金额/币种与订单一致性约束。
- 只提供显式 TEST Adapter；LIVE Adapter 默认未配置即 fail closed。

### 阶段 D · Credit issuance link

- 扩展现有 Credit Ledger operation/reference，不破坏现有 production reserve/consume/release。
- 发行 posting group 关联 RechargeOrder、PaymentEvent、转换规则版本。
- 退款只回收原订单尚未消费额度；不足部分进入人工异常，不制造负余额。

### 阶段 E · Commission ledger

- 新增 `commission_rule_versions`、`commission_accruals`、`commission_reversals`、`commission_settlements`。
- Rule ACTIVE 切换、快照 digest、Accrual 唯一性和 append-only Reversal 使用数据库约束保护。
- 提现/KYC/税务未冻结前，Settlement 不允许自动进入 paid。

### 阶段 F · 切流与清理

- Shadow 计算新旧 Demo/正式商业投影，不写真实资金承诺。
- 白名单 TEST 充值完成幂等、退款和审计 Gate 后再开放 UI。
- 所有清理和字段删除独立 migration、独立会签，不与新增表同批执行。

## 15. 发布、监控与回滚

### 15.1 发布顺序

1. Terms 管理能力；没有正式发布版本时注册关闭。
2. Invitation 生命周期与 Preview；注册仍可 feature flag 关闭。
3. 单一注册流程在白名单/测试环境验证四种来源、统一 Tenant 事务和枚举保护。
4. TEST Recharge Adapter 和 Payment Inbox。
5. 额度发行与退款演练。
6. Commission Shadow Calculation，只审计不结算。
7. 会签规则后启用正式计提视图。
8. 真实支付、自动结算/出款必须另立 Gate。

### 15.2 监控指标

- Registration 成功/拒绝/幂等重放/冲突计数；
- Invitation active/expired/revoked/exhausted 和并发冲突；
- Terms stale/缺失造成的 fail-closed；
- Payment duplicate/conflict/signature failure；
- RechargeOrder 与 Credit posting 不一致；
- Accrual/Reversal 与 Payment/Attribution/Rule 快照不一致；
- TEST/LIVE 模式混淆告警；
- 跨 Scope 拒绝和敏感字段日志扫描。

### 15.3 回滚条件

出现任一情况停止放量：

- 无同意证据仍创建账号；
- Token 被日志或数据库明文保存；
- 归因可由客户端改绑；
- 注册重放产生重复 User/Membership/Usage；
- Payment 重放重复加额度或计提；
- 三账任意两账不一致且没有异常记录；
- 退款覆盖历史或造成不可解释负余额；
- Channel 可读取其他 Channel 数据；
- TEST 收款被展示成 LIVE；
- 新佣金与旧批发差价发生重复收益。

回滚方式优先关闭 public registration/payment/commission feature flag，保留已产生的 append-only 证据供审计。已经确认的资金/额度记录不得通过删除回滚，只能追加冲正。

## 16. 已批准决策与仍需 fail closed 的商业 Gate

### 16.1 已批准、可立即实现

1. 直接、平台邀请和代理邀请统一创建单人普通 Tenant；企业成员邀请加入已有 Tenant。
2. 定向成员邀请绑定邮箱、7 天、单次使用；代理分享链接 30 天、默认最多 100 次，可提前撤销且撤销后不可恢复。
3. 归因默认保护 12 个月；纠错 append-only 且不追溯历史充值、额度和佣金。
4. Terms 由业务在发布时设置 `mustReaccept`；没有 PUBLISHED Terms 时注册 fail closed。
5. 受控试点必须包含邮箱验证、密码强度与慢哈希、找回密码、注册/登录/邀请限流、人机验证适配点、平台管理员 MFA、枚举保护和安全审计。
6. 首版只做明确标记的 TEST Payment Adapter 和管理员人工充值，不接真实收款。
7. 充值购买版本化额度 SKU；购买额度默认不过期，赠送额度默认 90 天，按最早到期优先消费。
8. 首版充值佣金替代旧批发差价，只对直接归因代理单级计提；退款/撤单/拒付使用追加冲正。
9. 佣金按实际支付净额计算，先 pending，超过退款观察期后进入可结算状态，按自然月生成 Settlement 草稿。
10. 首版不开放提现、不自动打款，Settlement 不得标记真实 paid。

### 16.2 不阻塞底座、但阻塞对应能力正式上线

- 用户须知正式正文、document code/locale、发布人和法务审批；
- 真实微信/支付宝等支付主体、商户配置、币种、金额范围、订单有效期和退款周期；
- 真实 SKU 售价、包含额度和赠送活动；
- 佣金具体百分比、舍入方式和退款观察期；
- 税务、开票、KYC、提现、出款、结算审批和失败处理；
- IP/User-Agent/设备证据的必要性、保存期限和隐私说明；
- Channel 停用、合并、转移后的新签约规则和审批流程。

上述未决项不得由工程师填写 Demo 数字或自拟正式规则。对应正式 Rule/Adapter/文案未发布时必须 fail closed。

## 17. 验收与下一步

本 ADR 已满足 Wave 0 接受条件：

- C0/产品业务负责人已书面批准统一 Tenant、邀请、归因、Terms、TEST Payment、额度和单级佣金口径；
- 新佣金与旧批发差价冲突已裁决为“首版佣金替代差价”，并禁止重复收益；
- Terms、Invitation、Registration、Payment、Credit 和 Commission 状态机、fixture、错误与幂等语义获准进入实现；
- 正式条款、真实支付、真实 SKU、佣金比例和出款合规仍明确 fail closed；
- B 继续只消费 A 已授权的 Project/Grant 和额度结果，不读取支付/佣金敏感事实。

Wave 0 已收口，实施顺序为：

1. A-BIZ-01.1 多组织 Schema、Organization Membership/Role、Project Assignment 和 Pilot 显式回填；
2. A-BIZ-01.2 Session Membership Context、项目级 RBAC 和 Support Grant；
3. Terms；
4. Invitation；
5. 统一 Registration/Attribution；
6. TEST Recharge/Payment；
7. Credit Issuance；
8. Commission Rule/Accrual/Reversal/Settlement Draft；
9. 联合安全 Gate。
