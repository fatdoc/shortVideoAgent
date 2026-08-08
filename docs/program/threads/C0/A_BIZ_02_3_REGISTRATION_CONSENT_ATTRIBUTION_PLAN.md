# A-BIZ-02.3 · 单一注册、Consent 与冻结归因计划

> 日期：2026-08-08
> 分支：`dev/business-plane`
> 基线：`74d58f1 feat(control-api): expose invitation management api`
> 状态：`A_BIZ_02_3_PLAN_FROZEN / READY_FOR_TEST_FIRST_RED`

## 1. 目标与顺序

A-BIZ-02 已按 `Terms → Invitation → Registration` 完成前两层事实源。本节点把现有 Terms、Invitation、User、Organization、Tenant 与 Membership 能力组合为一个服务端原子注册事务。

本节点完成：

- 唯一公开注册端点 `POST /api/v1/public/registrations`；
- DIRECT、PLATFORM_INVITATION、CHANNEL_INVITATION、TENANT_MEMBER_INVITATION 四种服务端派生路径；
- Registration、ReferralAttribution、ReferralAttributionEvent Schema；
- User、单人 Tenant 或目标 Tenant Membership、Consent、Invitation Usage、Attribution 的单事务落库；
- 密码慢哈希、邮箱验证 Port、幂等、限流、防枚举和稳定错误；
- 注册结果安全 replay，且不同 payload 使用同一 idempotency key 时稳定冲突；
- 02.1/02.2 预留 `registration_id` 的正式 FK 收口。

本节点不完成：

- 注册页面和邀请激活 UI（A-BIZ-02.4）；
- 自动登录、注册后自动签发 Session 或组织切换 UI；
- 既有账号接受新的 Tenant Membership；既有账号加入组织需后续建立已认证接受流程；
- 邮件发送、短信、验证码供应商或自建邮箱验证服务；
- 正式用户须知正文、真实公开注册放量；
- 充值、支付、额度发行、佣金计提或归因纠错管理 API；
- 独立 `consumer` User/Tenant/Role/Workbench；
- B 的 StoryCanvas、脚本、分镜或媒体生产实现。

正式 Terms 和邮箱验证 Provider 未配置时，公开注册必须明确 `503` fail closed。测试通过注入 Fake Port 验证事务能力，不把 Fake 描述为真实注册可用。

## 2. 冻结公开输入与可信事实

### 2.1 唯一请求合同

```text
POST /api/v1/public/registrations

email
password
displayName
tenantDisplayName?       # 新 Tenant 路径必填，成员邀请路径禁止
invitationToken?         # 仅作为凭据，不作为 Scope 事实
termsVersionId
locale
accepted                 # 必须严格等于 true
emailVerificationToken   # 只交给服务端 Verifier Port
idempotencyKey
```

严格拒绝未知字段。客户端不得提交：

```text
registrationPath
acquisitionSource
referrerChannelId
organizationId
tenantId
membershipId
roleCode
status
protectedUntil
commissionRule
```

### 2.2 服务端派生路径

| 输入/Invitation | registrationPath           | Tenant 结果                 | Membership 结果                                    | 商业归因                                  |
| --------------- | -------------------------- | --------------------------- | -------------------------------------------------- | ----------------------------------------- |
| 无 Token        | `DIRECT`                   | 创建普通单人 Tenant         | 本人 `tenant_admin`                                | 平台直营，无 referrer Channel             |
| `PLATFORM`      | `PLATFORM_INVITATION`      | 创建普通单人 Tenant         | 本人 `tenant_admin`                                | 仅使用 Invitation 冻结的可选 Channel      |
| `CHANNEL`       | `CHANNEL_INVITATION`       | 创建普通单人 Tenant         | 本人 `tenant_admin`                                | Invitation 对应 Channel，保护 12 个日历月 |
| `TENANT_MEMBER` | `TENANT_MEMBER_INVITATION` | 使用 Invitation 目标 Tenant | 创建 Invitation 指定 `content_operator` Membership | 不由客户端建立佣金归因                    |

规则：

- 平台/代理获客邀请改变来源和归因，不改变终端产品模型；
- 新 Tenant 路径必须创建 `TENANT` Organization、Tenant、legacy Membership；现有 008 trigger 负责生成 canonical Organization Membership 与 Role，禁止业务层双写两套 Membership；
- 成员邀请不创建第二个 Tenant，且目标 Tenant、Role、目标邮箱全部来自锁定后的 Invitation；
- 当前公开注册只接受新 User。邮箱已存在时不通过公开端点追加 Membership，也不泄漏账号状态；
- 单人 Tenant 后续原地成长为企业 Tenant，不迁移 User、Tenant、Project、资产或账本。

## 3. Migration 013 与数据模型（02.3A）

新增：

```text
apps/control-api/src/db/migrations/013_registration_attribution.ts
apps/control-api/src/db/registrationAttribution.postgres.test.ts
```

### 3.1 registrations

```text
registration_id uuid PK
normalized_email text
status completed
registration_path DIRECT | PLATFORM_INVITATION | CHANNEL_INVITATION | TENANT_MEMBER_INVITATION
invitation_id uuid nullable FK invitations
user_id uuid FK users
tenant_id uuid FK tenants
membership_id uuid FK organization_memberships
terms_version_id uuid FK terms_versions
idempotency_key text
request_digest text
completed_at timestamptz
created_at timestamptz
```

约束：

- `normalized_email` 必须已 trim/lowercase，大小写不敏感唯一；
- `user_id`、`idempotency_key` 唯一；同 key 只能代表一个注册结果；
- DIRECT 必须无 Invitation；其余路径必须有 Invitation；
- Registration 是完成事实，不持久化可被误解为成功的半成品 `processing`；失败事务不留 User/Tenant/Membership；
- 已完成 Registration 不允许 UPDATE/DELETE；状态扩展需新 ADR，不在本节点开放拒绝记录改写。

### 3.2 referral_attributions

```text
referral_attribution_id uuid PK
registration_id uuid unique FK registrations
user_id uuid unique FK users
tenant_id uuid FK tenants
acquisition_source DIRECT | PLATFORM_INVITATION | CHANNEL_INVITATION | TENANT_MEMBER_INVITATION
invitation_id uuid nullable FK invitations
referrer_channel_id uuid nullable FK channels
effective_from timestamptz
protected_until timestamptz nullable
protection_rule_version text
evidence_digest text
status active | ended
created_at timestamptz
```

规则：

- 首次 Attribution 每个 User 只有一条，不允许原地覆盖；
- DIRECT 与 TENANT_MEMBER_INVITATION 不得由客户端生成 referrer Channel；
- CHANNEL_INVITATION 必须引用 Invitation 冻结的 Channel；
- PLATFORM_INVITATION 只有 Invitation 本身带经授权 Channel 时才能建立该 referrer；
- 有 referrer Channel 的首版保护期固定为 `effective_from + interval '12 months'`，按日历月计算，不使用 365 天近似；
- `protection_rule_version` 保存本轮已批准规则版本标识，不保存佣金比例；
- `evidence_digest` 只摘要服务端冻结事实，不包含密码、明文 Invitation Token 或邮箱验证 Token。

### 3.3 referral_attribution_events

```text
event_id uuid PK
referral_attribution_id uuid FK referral_attributions
event_type created | corrected | ended
reason_code text
acted_by uuid nullable FK users
occurred_at timestamptz
evidence_digest text
created_at timestamptz
```

本节点只创建首条 `created` 事件。`corrected` / `ended` 仅冻结 append-only Schema，不提供公开或管理 API；未来纠错必须有授权 Actor、原因和独立业务切片。

### 3.4 既有审计表 FK 收口

Migration 013 为以下列增加正式 FK：

```text
control_plane.user_consents.registration_id
  -> control_plane.registrations.registration_id

control_plane.invitation_usages.registration_id
  -> control_plane.registrations.registration_id
```

由于 02.1/02.2 上线前没有真实 Registration，migration 在加 FK 前必须 fail closed 检查既有非空 Consent Registration 引用和 Invitation Usage。若发现孤立审计事实，迁移直接失败并要求人工核对，不删除、不伪造、不自动生成 Registration。

### 3.5 数据库合同

PostgreSQL 测试至少覆盖：

1. Migration 001～013 完整链与 replay；
2. Registration path 与 Invitation nullable 组合；
3. normalized email、User、idempotency key 唯一；
4. Registration completed 事实不可更新/删除；
5. Attribution source、Invitation、Channel、保护期组合约束；
6. 每 User/Registration 只能有一个首次 Attribution；
7. Attribution 不可覆盖，Event append-only；
8. Consent/Usage 必须引用真实 Registration；
9. 既有孤立 Consent/Usage 时 migration fail closed；
10. down 在 Registration/Attribution/Consent/Usage 审计事实存在时拒绝破坏性回滚。

## 4. 单事务编排（02.3B）

新增目录：

```text
apps/control-api/src/registrations/
  errors.ts
  digest.ts
  types.ts
  repository.ts
  repository.postgres.test.ts
  service.ts
  service.test.ts
  emailVerification.ts
```

### 4.1 原子性边界

现有 `PostgresTermsRepository.recordConsent()` 与 `PostgresInvitationRepository.consume()` 各自开启事务，不能直接依次调用后宣称注册原子性。

02.3 必须建立一个 PostgreSQL Registration Unit of Work，在同一个 `Knex.Transaction` 中执行所有写入，并为 Terms/Invitation 提供 transaction-bound 内部操作。禁止：

- 嵌套多个独立事务；
- 先提交 User/Tenant，再单独提交 Consent/Usage；
- 用补偿删除模拟原子注册；
- 绕过 Invitation 行锁、Usage trigger 或 Terms current 选择规则；
- 在 Service 中直接信任客户端派生 Scope。

### 4.2 事务顺序

1. 严格校验请求、密码策略、`accepted === true` 和 idempotency key；
2. 归一化 email，生成不可逆 limiter key；
3. 通过 EmailVerification Port 验证服务端可信凭据；未配置或验证失败均不创建数据；
4. 计算 canonical request digest，锁定 idempotency key；
5. 若已完成且 digest 相同，返回原结果；digest 不同返回稳定 409；
6. 对 email 加事务 advisory lock，并执行不泄漏状态的 User 存在性检查；
7. 若有 Token，计算现有版本化 Token digest，锁定并验证 Invitation、期限、次数、状态、目标邮箱及 issuer/target Scope；
8. 锁定并重新选择当前 PUBLISHED Terms；校验 `termsVersionId`、locale 与 digest，不信任页面缓存；
9. 使用现有 scrypt `hashPassword()` 在写 User 前生成慢哈希；日志和异常不得包含密码；
10. 创建 User；
11. 新 Tenant 路径创建 Organization、Tenant 和 legacy `tenant_admin` Membership；成员邀请路径在目标 Tenant 创建指定 Membership；
12. 创建 completed Registration；
13. 写入 append-only UserConsent；
14. 如有 Invitation，写入 InvitationUsage，由现有原子 trigger 消耗名额；
15. 写入首次 ReferralAttribution 与 `created` Event；
16. 提交事务后返回安全 Registration 结果。

任一步失败全部回滚，包括 User、Organization、Tenant、Membership、Consent、Usage、usedCount 和 Attribution。

### 4.3 密码、幂等与摘要

- 密码策略首版：长度 12～1024，不 trim、不回显；慢哈希复用现有 scrypt；
- 为请求幂等新增独立 `REGISTRATION_IDEMPOTENCY_SECRET`，至少 32 bytes，production 必须显式配置；
- request digest 使用 keyed HMAC-SHA-256 和 canonical JSON，覆盖 email、密码、displayName、tenantDisplayName、Invitation Token digest、termsVersionId、locale、accepted、邮箱验证凭据摘要；
- 数据库只保存最终 HMAC，不保存原始密码、密码普通 SHA、Invitation Token 或邮箱验证 Token；
- 幂等 Secret 必须稳定；轮换策略不在本切片实现，部署不得随意更换后破坏 replay；
- replay 不重新写密码、不重复消耗 Invitation、不重复创建 Consent/Attribution，也不自动签发 Session。

### 4.4 EmailVerification Port

冻结接口语义：

```text
verify(normalizedEmail, verificationToken, asOf)
  -> verified evidence id / unavailable / invalid
```

- Service 只接受验证 Port 返回的可信 evidence ID；客户端 boolean 不算验证；
- 默认 Bootstrap 使用 fail-closed unavailable Port；
- 测试使用显式 Fake Port；
- 真实邮件发送、验证码生成/存储、重试策略和 Provider 配置另立切片；
- Consent evidence 只保存 `requestId`、注册场景和必要的 verification evidence ID，不保存 Token、IP/User-Agent 或设备指纹，除非法务/隐私另行批准。

## 5. HTTP API、限流与错误（02.3C）

新增：

```text
apps/control-api/src/registrations/routes.ts
apps/control-api/src/registrations/routes.test.ts
apps/control-api/src/registrations/rateLimiter.ts
apps/control-api/src/registrations/rateLimiter.test.ts
```

Bootstrap：

```text
PostgresRegistrationRepository
  -> RegistrationService
  -> RegistrationRateLimiter
  -> createRegistrationRouter
  -> createApp
```

HTTP 边界：

- `POST /api/v1/public/registrations` 不依赖登录 Cookie；
- 所有响应 `cache-control: no-store`；
- body 严格白名单，最大长度继续受 Control API JSON limit；
- 限流按来源地址 + normalized email 的不可逆组合键，禁止把 email、密码或 Token 直接作为 Map/log key；
- production 默认 EmailVerification unavailable，因此不把本节点描述为已开放公网注册；
- 成功返回 `201`；安全 replay 返回 `200` 并设置 `idempotency-replayed: true`；
- 响应只包含 Registration ID、User ID、Tenant ID、Membership ID、registrationPath 和 completedAt；不返回 password hash、Token digest、内部 Attribution evidence 或邀请审计字段；
- 本节点不设置 Session Cookie。用户在注册提交后通过现有 `/api/v1/auth/login` 登录，避免把事务结果与会话签发耦合。

稳定错误：

```text
INVALID_REGISTRATION_REQUEST          400
REGISTRATION_TERMS_NOT_ACCEPTED       400
INVITATION_UNAVAILABLE                404
REGISTRATION_CONFLICT                 409  # 已存在账号等公开统一冲突
REGISTRATION_IDEMPOTENCY_CONFLICT     409
TERMS_NOT_AVAILABLE                   503
EMAIL_VERIFICATION_UNAVAILABLE        503
EMAIL_VERIFICATION_FAILED             400
REGISTRATION_RATE_LIMITED             429
INTERNAL_ERROR                        500
```

- 已存在 active/suspended User 不返回不同错误，不确认账号状态；
- 无效、撤销、过期、耗尽或 Scope 失效 Invitation 继续统一 `INVITATION_UNAVAILABLE`；
- Terms stale 与无 current 统一 fail closed，不创建任何半成品；
- production 500 不泄漏 SQL constraint、email、Token、密码或内部错误文本。

## 6. Test-first 与提交切片

### Commit 1：计划冻结

```text
docs(business-plane): freeze registration transaction plan
```

### Commit 2：02.3A Schema

```text
feat(control-api): add registration attribution schema
```

先写 PostgreSQL 合同并确认 RED，再实现 migration 013。Gate：013 定向、migration chain、Control API PostgreSQL 全量、typecheck、build、ESLint、Prettier、Governance、`git diff --check`。

### Commit 3：02.3B Transaction / Domain / Repository

```text
feat(control-api): add atomic registration transaction
```

Gate 至少覆盖：

- 四种服务端路径；
- DIRECT/PLATFORM/CHANNEL 创建单人 Tenant；
- TENANT_MEMBER 只加入目标 Tenant；
- current Terms + Consent digest；
- Invitation resolve/Usage 与并发末位名额；
- 12 个日历月 Attribution 快照；
- 同 payload replay、不同 payload conflict；
- 已存在 User 防枚举冲突；
- Terms/Invitation/Verification/密码/DB 任一步失败零部分写入；
- 日志、错误和结果不泄漏敏感输入。

### Commit 4：02.3C HTTP API / Bootstrap

```text
feat(control-api): expose public registration api
```

Gate：严格 body、400/404/409/429/503/500、`no-store`、replay header、Limiter、fail-closed Verifier、Bootstrap、Control API 全量与相关 root 回归。

### Commit 5：02.3 收口记忆（如未随切片同步）

```text
docs(business-plane): close registration transaction slice
```

每个提交只显式暂存 A 文件，禁止 `git add .`。

## 7. 文件与协作边界

A 可修改：

```text
apps/control-api/src/db/migrations/013_registration_attribution.ts
apps/control-api/src/db/registrationAttribution.postgres.test.ts
apps/control-api/src/db/migrationChain.postgres.test.ts
apps/control-api/src/registrations/**
apps/control-api/src/terms/repository.ts             # 仅 transaction-bound 内部操作
apps/control-api/src/terms/repository.postgres.test.ts
apps/control-api/src/invitations/repository.ts       # 仅 transaction-bound 内部操作
apps/control-api/src/invitations/repository.postgres.test.ts
apps/control-api/src/config.ts                       # 仅 02.3C
apps/control-api/src/config.test.ts                  # 仅 02.3C
apps/control-api/src/app.ts                          # 仅 02.3C 独立共享提交
apps/control-api/src/app.test.ts                     # 仅 02.3C
apps/control-api/src/server.ts                       # 仅 02.3C 独立共享提交
apps/control-api/.env.example
apps/control-api/README.md
docs/program/threads/C0/**
```

A 不修改：

```text
apps/storycanvas/**
src/features/storycanvas/**
src/pages/production/IntegratedStoryCanvasPage*
src/pages/script-editor/**
src/pages/storyboard/**
src/components/script/**
src/components/storyboard/**
```

`apps/storycanvas/data/vendor/byteplus.ts` 继续视为 B 的未跟踪运行时文件，不修改、不删除、不暂存、不提交。

02.3A/02.3B 不触碰共享 Bootstrap；02.3C 修改 `apps/control-api/src/app.ts` / `server.ts` 时必须形成独立小提交并通知 B。B 当前可先同步远程 `dev/business-plane@74d58f1`；后续碰共享 Bootstrap 前再同步 02.3C 对应提交。

## 8. 完成标准

A-BIZ-02.3 只有同时满足以下条件才收口：

- Migration 013 与完整 migration chain 通过；
- 四种注册来源只走一个 API 和一个事务服务；
- 新 Tenant 路径创建普通 Tenant + `tenant_admin`，成员邀请不创建第二 Tenant；
- User、Organization/Tenant、Membership、Registration、Consent、Usage 和 Attribution 全部共同提交或共同回滚；
- Terms stale、Invitation unavailable、邮箱验证不可用、账号冲突和并发名额耗尽均 fail closed；
- Attribution 完全来自服务端事实，首次记录不可覆盖，12 个月规则按日历月保存快照；
- 同命令安全 replay，不重复建账号、Tenant、Membership、Consent、Usage 或 Attribution；
- 密码只存 scrypt，Token 只存既有 digest，注册 request digest 使用 keyed HMAC；
- Public API 不泄漏邮箱是否存在、账号状态、Token 生命周期、内部 Role、Channel 树或审计事实；
- 定向、Control API 全量、PostgreSQL 全量、TypeScript、Build、Lint、Prettier、Governance 和 diff check 通过；
- C0 STATUS、HANDOFF、CHANGELOG 与桌面知识库同步；
- B 独占目录 tracked diff 为零，B 未跟踪文件保持原样。

## 9. 下一步

计划独立提交后进入 02.3A：先新增 Migration 013 PostgreSQL 合同测试并确认 RED，再实现最小 Schema。02.3A 转绿并独立提交后，连续进入 02.3B 单事务编排；只有 PostgreSQL 环境、未批准真实 Terms/邮箱 Provider 或共享 Bootstrap 冲突真正阻塞时暂停报告。
