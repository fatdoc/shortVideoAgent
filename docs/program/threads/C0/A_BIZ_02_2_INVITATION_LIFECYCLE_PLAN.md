# A-BIZ-02.2 · Invitation 生命周期计划

> 日期：2026-08-07
> 状态：`FROZEN / READY_FOR_TEST_FIRST_RED`
> 前置提交：`7de07dd feat(control-api): expose terms management api`
> 顺序：`Terms → Invitation → Registration`

## 1. 目标

在不开放公开注册的前提下，建立可审计、不可伪造、可撤销、可过期、可限次且支持安全重放的 Invitation 事实源，为 A-BIZ-02.3 单一注册事务提供可信 Token 与原子 Usage 能力。

本节点必须交付：

- PLATFORM 定向获客邀请；
- CHANNEL 分享邀请；
- TENANT_MEMBER 定向成员邀请；
- Token 生成、版本化 digest、一次性明文返回；
- 创建、范围内列表、Public Preview、撤销；
- active / revoked / expired / exhausted 生命周期；
- 供后续 Registration 事务调用的锁定、校验和 Usage 写入合同；
- 管理权限、范围隔离、防枚举、限流、幂等、审计与回滚保护。

## 2. 已冻结输入

以下决策已经批准，不再作为阻塞：

- 企业和个人统一使用 Tenant；PLATFORM/CHANNEL 获客邀请注册后创建单人 Tenant，TENANT_MEMBER 加入既有 Tenant。
- 注册来源只允许 `DIRECT`、`PLATFORM_INVITATION`、`CHANNEL_INVITATION`、`TENANT_MEMBER_INVITATION`。
- 7 天单次定向邀请与 30 天/默认 100 次代理分享链接。
- Token 只保存 digest；平台、代理和企业管理员不得设置、查看或保存用户密码。
- 代理归因必须来自服务端 Invitation，客户端不能覆盖 Channel、目标 Tenant 或目标 Role。
- 撤销只阻止未来使用；历史 Usage 不删除。
- 同一注册重放不重复增加使用次数；并发最后一个名额不能超卖。

仍为 TBD、但不阻塞本节点：

- 正式 Terms 正文与发布审批；
- 公开注册、邮箱验证、密码策略接线；
- 生产验证码/风控供应商与最终限流阈值；
- 归因保护期落库与佣金规则；
- TENANT_MEMBER 首版 `content_operator` 以外的可邀请角色。

## 3. 范围与非范围

### 3.1 本节点包含

- migration `012_invitation_lifecycle.ts`；
- `invitations` 与 `invitation_usages`；
- Invitation token/domain/repository/service；
- PLATFORM、CHANNEL、TENANT_MEMBER 管理 API；
- Public Preview；
- Preview 速率限制与统一无效响应；
- Session resolve/rotation 和共享 Bootstrap 接线；
- PostgreSQL、Service、Router、Bootstrap 与 migration-chain Gate。

### 3.2 本节点不包含

- `POST /api/v1/public/registrations`；
- 创建 User、Tenant、Membership、Consent 或 ReferralAttribution；
- 邮件/SMS 发送、验证码、邀请消息模板或真实通知 Provider；
- 正式 Terms seed 或占位正文；
- 前端邀请、注册或成员管理页面；
- 渠道层级、佣金、充值和支付；
- B 的 StoryCanvas/脚本/分镜/画布页面。

Public Registration 在 02.3 前继续 fail closed，不新增半成品注册路由。

## 4. Invitation 类型与服务端派生规则

### 4.1 PLATFORM

- 只有有效 PLATFORM Context 的 `platform_admin` 可创建。
- 属于 7 天、单次、定向获客邀请；必须绑定规范化目标邮箱。
- `attributionChannelId` 可为空，表示平台直营；非空时必须由服务端验证为 active CHANNEL。
- 客户端不能提交 issuer Organization/Membership、有效期、使用次数或来源类型。

### 4.2 CHANNEL

- 只有目标 Channel 自身有效 Context 的 `channel_admin` 可创建和查看。
- 属于分享邀请；服务端默认 30 天、100 次。
- `attributionChannelId` 永远由当前 Channel 派生，客户端不能覆盖。
- 首版 Channel 管理员不能延长有效期或提高次数；平台未来可通过独立合同降低限制，不在 02.2 首次实现中混入隐式 override。

### 4.3 TENANT_MEMBER

- 只有目标 Tenant 自身有效 Context 的 `tenant_admin` 可创建和查看。
- 属于 7 天、单次、定向成员邀请；必须绑定规范化目标邮箱。
- `targetOrganizationId` 永远由当前 Tenant Context 派生。
- 首版 `targetRoleCode` 固定为 `content_operator`；客户端不能借 Invitation 获得 `tenant_admin`、Channel 或 Platform Role。
- 激活后加入已有 Tenant，不创建新 Tenant；实际 Membership 创建属于 02.3。

### 4.4 明确拒绝

- `content_operator`、`pilot_support`、错误组织类型或停用 Context 创建/查看/撤销 Invitation；
- Channel A 操作 Channel B Invitation；
- Tenant A 操作 Tenant B Invitation；
- 客户端提交 `issuerMembershipId`、`issuerOrganizationId`、`attributionChannelId`、`targetOrganizationId`、`usedCount`、Token digest 或状态；
- 平台/代理/企业管理员提交或获得用户密码。

## 5. Migration 012

### 5.1 `control_plane.invitations`

建议字段：

```text
invitation_id uuid PK
issuer_membership_id uuid NOT NULL
issuer_organization_id uuid NOT NULL
invitation_type PLATFORM | CHANNEL | TENANT_MEMBER
target_organization_id uuid nullable
target_role_code text nullable
target_email_normalized text nullable
attribution_channel_id uuid nullable
token_digest text NOT NULL UNIQUE
status active | revoked | exhausted | expired
valid_from timestamptz NOT NULL
expires_at timestamptz NOT NULL
max_uses integer NOT NULL
used_count integer NOT NULL DEFAULT 0
created_at / updated_at
revoked_at nullable
revoked_by_membership_id nullable
```

数据库约束：

- issuer Membership 必须真实属于 issuer Organization；
- issuer、target、attribution 的 Organization/Channel 类型必须匹配 Invitation 类型；
- PLATFORM：目标邮箱必填，目标 Organization/Role 为空，使用次数为 1，有效期不超过 7 天；
- CHANNEL：attribution Channel 必填，目标邮箱/Organization/Role 为空，`1 <= maxUses <= 100`，有效期不超过 30 天；
- TENANT_MEMBER：目标 Tenant、目标邮箱与 `content_operator` 必填，attribution Channel 为空，使用次数为 1，有效期不超过 7 天；
- `validFrom < expiresAt`，`0 <= usedCount <= maxUses`；
- Token digest 格式固定为 `sha256:v1:<64 lowercase hex>`，数据库不出现明文 Token；
- scope、Token、时间窗和上限创建后不可修改；
- revoke/exhausted/expired 为终态，不允许恢复 active；
- `usedCount` 只能由 Usage 插入触发器单调增加。

过期判断始终以 `expiresAt <= asOf` 为权威；Repository 可懒更新 `active → expired`，但不能只信任缓存状态。

### 5.2 `control_plane.invitation_usages`

建议字段：

```text
invitation_usage_id uuid PK
invitation_id uuid NOT NULL FK
registration_id uuid NOT NULL UNIQUE
user_id uuid NOT NULL FK
used_at timestamptz NOT NULL
idempotency_key text NOT NULL
request_digest text NOT NULL
created_at
```

约束：

- `(invitation_id, idempotency_key)` 唯一；
- `(invitation_id, registration_id)` 唯一；
- request digest 使用 64 位 lowercase SHA-256；
- Usage append-only，禁止 update/delete；
- 插入 Usage 时锁定 Invitation，重新验证 active、时间窗和剩余次数；
- 插入成功后原子增加 `usedCount`，达到上限时置为 exhausted；
- 并发最后一个名额只能成功一次；
- 相同 key + 相同 digest 由 Repository 返回原 Usage，不执行第二次插入；相同 key + 不同 digest 返回稳定冲突。

`registration_id` 在 012 中先作为不可空、唯一的业务 UUID；02.3 创建 `registrations` 后通过独立 migration 增加 FK，避免 02.2 提前创建半成品 Registration 表。

### 5.3 回滚

- 空表允许回滚；
- 只要存在 Invitation 或 Usage，down migration fail closed，避免删除仍可能有效的凭据或审计证据；
- 必须先回滚后续 Registration FK/migration，再回滚 012；
- migration 不 seed 正式、Demo 或占位 Invitation。

## 6. Token 合同

- 使用 Node `crypto.randomBytes(32)` 生成 base64url 明文 Token；不新增第三方依赖。
- 使用版本化 SHA-256 digest：`sha256:v1:<hex>`；复用仓库现有 opaque token + digest 模式。
- 明文 Token 只在创建成功响应中返回一次；列表、Preview、撤销、错误、日志和普通审计均不返回。
- 不使用 Invitation ID、邮箱、组织 ID 或时间戳生成 Token。
- Preview 接收 body 中的 Token，避免 Token 出现在 URL、浏览历史和常规 access log：

```text
POST /api/v1/public/invitations/preview
```

不实现旧建议中的 `GET /api/v1/invitations/:token/preview`。

## 7. Repository / Service 合同

### 7.1 创建

- Service 在调用 Store 前校验 Actor/Context、类型和允许字段；
- 服务端派生 issuer、scope、默认时间窗、maxUses、归因 Channel 与目标 Tenant/Role；
- Repository 事务中重新锁定并验证 Membership、Organization、Channel/Tenant 状态；
- 返回 `{ invitation, token }`，持久层只保存 digest；
- 创建请求通过调用方提供的 idempotency key + request digest 安全重放；同 key 不同 digest 返回 `INVITATION_IDEMPOTENCY_CONFLICT`。

### 7.2 Preview

- 不依赖登录；
- 只返回最小展示字段：邀请用途、邀请方展示名、目标组织展示名（仅成员邀请）、到期时间；
- 不返回目标完整邮箱、内部 Role、Channel 层级、佣金、用户列表、Token digest、使用计数或审计字段；
- Token 不存在、格式错误、撤销、过期、耗尽、issuer/target Organization 停用统一返回 `INVITATION_UNAVAILABLE`；
- 统一状态、消息和响应形状，不帮助调用方枚举生命周期；
- Preview 不声称 Terms 可用；02.3 Registration 在事务中独立校验 current Terms。

### 7.3 列表与撤销

- 列表只能读取当前 Context 自身范围，采用稳定分页；不返回明文 Token 或 digest；
- 撤销必须重新校验当前 Actor 对 Invitation scope 的权限；
- active Invitation 首次撤销成功；相同撤销命令安全 replay；
- exhausted/expired 不恢复、不改写历史 Usage；
- 跨范围统一 404，避免泄漏资源存在性；权限角色本身不满足时 403。

### 7.4 供 02.3 使用的内部消费合同

- 02.2 建立 `resolveForRegistration(token, normalizedEmail, asOf)` 与事务内 `recordUsage(...)` Store 合同；
- 定向 Invitation 必须匹配注册邮箱；CHANNEL 分享邀请不绑定邮箱；
- 返回的 acquisition source、attribution Channel、target Tenant 与 target Role 全部来自锁定后的数据库事实；
- 不开放独立 Public consume endpoint；Usage 只能由 02.3 Registration 同一事务写入。

## 8. HTTP API（02.2C）

```text
POST /api/v1/platform/invitations
GET  /api/v1/platform/invitations
POST /api/v1/channels/:channelId/invitations
GET  /api/v1/channels/:channelId/invitations
POST /api/v1/tenants/:tenantId/invitations
GET  /api/v1/tenants/:tenantId/invitations
POST /api/v1/invitations/:invitationId/revoke
POST /api/v1/public/invitations/preview
```

HTTP 边界：

- 管理 API：无 Session 401、无效 Session 401、角色不足 403、跨范围/资源不存在 404；
- 非法输入 400；幂等 payload 冲突或状态冲突 409；Preview 频率超限 429；
- Public 无效 Token 统一 404 `INVITATION_UNAVAILABLE`，不区分不存在、撤销、过期和耗尽；
- 所有响应 `cache-control: no-store`；
- Session rotation 保持现有 Cookie 合同；
- Zod `.strict()` 拒绝未知字段和客户端伪造服务端事实；
- 未知异常交给全局 500 Handler，生产响应不泄漏错误文本。

Preview 限流器必须可注入、可测试；生产阈值未批准前由显式环境配置决定，不把开发默认值描述为正式安全参数。不得记录 Token 作为 limiter key，使用 Token digest + 来源地址的不可逆组合。

## 9. 稳定错误

```text
INVITATION_PERMISSION_DENIED          403
INVITATION_NOT_FOUND                  404（管理范围内）
INVITATION_UNAVAILABLE                404（Public 统一）
INVITATION_STATE_CONFLICT             409
INVITATION_IDEMPOTENCY_CONFLICT       409
INVITATION_SCOPE_CONFLICT             409
INVITATION_VALIDATION_FAILED          400
INVITATION_RATE_LIMITED               429
```

数据库唯一、检查和并发异常必须映射为上述稳定领域错误，不向 HTTP 泄漏 SQL constraint 名称。

## 10. Test-first 切片与提交

### Commit 1：计划冻结

```text
docs(business-plane): freeze invitation lifecycle plan
```

### Commit 2：02.2A Migration 012

```text
feat(control-api): add invitation lifecycle schema
```

先新增 PostgreSQL 合同测试并确认模块缺失 RED，再实现：

- 两张表且无 seed；
- 三种类型 scope/时限/次数；
- token digest 格式与唯一性；
- 不可变 scope 与单向状态；
- Usage append-only、原子计数和并发最后名额；
- fail-closed rollback；
- migration 001～012 chain。

### Commit 3：02.2B Domain / Repository / Service

```text
feat(control-api): add invitation lifecycle service
```

Gate：权限调用边界、Token 只返回一次、创建 replay/conflict、范围列表、Preview 统一无效、撤销 replay、注册内部 resolve/Usage 合同和 PostgreSQL 并发。

### Commit 4：02.2C HTTP API / Bootstrap

```text
feat(control-api): expose invitation management api
```

Gate：Public Preview、管理路由、401/403/404/409/429/5xx、Session rotation、敏感字段白名单、全量 Control API 与共享 Bootstrap 回归。

### Commit 5：02.2 收口记忆（如未随切片同步）

```text
docs(business-plane): close invitation lifecycle slice
```

每个提交只暂存明确文件，禁止 `git add .`。

## 11. 文件与协作边界

A 可修改：

```text
apps/control-api/src/db/migrations/012_invitation_lifecycle.ts
apps/control-api/src/db/invitationLifecycle.postgres.test.ts
apps/control-api/src/db/migrationChain.postgres.test.ts
apps/control-api/src/invitations/**
apps/control-api/src/config.ts                  # 仅 02.2C
apps/control-api/src/config.test.ts             # 仅 02.2C
apps/control-api/src/app.ts                     # 仅 02.2C 独立共享提交
apps/control-api/src/app.test.ts                # 仅 02.2C
apps/control-api/src/server.ts                  # 仅 02.2C
apps/control-api/src/auth/rateLimiter.ts         # 只有先证明通用化必要时
apps/control-api/src/auth/rateLimiter.test.ts    # 对应兼容测试
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

`apps/storycanvas/data/vendor/byteplus.ts` 继续作为 B 的未跟踪文件，不修改、不删除、不暂存、不提交。

02.2C 修改共享 `app.ts` / `server.ts` 时必须独立提交并通知 B 同步 commit。

## 12. 开源优先与依赖

- 复用当前仓库 Node `crypto`、PostgreSQL 事务/行锁、现有 Session resolve/rotation、错误包络和可注入 limiter 模式；
- 不引入新第三方包，不复制外部源码；
- 因无新增外部实现，本节点计划阶段无需新增 SOURCE_REGISTER 条目；
- 若后续决定引入邮件、验证码或分布式 Rate Limit Provider，必须先走独立来源、许可证和生产配置评审。

## 13. 完成标准

A-BIZ-02.2 只有同时满足以下条件才收口：

- migration 012 与 001～012 chain 通过；
- 三类 Invitation 的 issuer/scope/时间窗/次数由 DB 与 Service 双层保护；
- Token 只存版本化 digest，明文只创建时返回一次；
- Preview 对无效状态统一、防枚举且有可测试限流；
- 撤销终态、Usage append-only、并发不超卖、重放不重复计数；
- 管理 API 按 PLATFORM/CHANNEL/TENANT Context 隔离；
- 不开放半成品 Registration，不 seed 正式或 Demo Invitation；
- 全量测试、TypeScript、Build、Lint、Prettier、Governance、diff check 通过；
- C0 状态、CHANGELOG 和桌面知识库同步；
- B 独占目录 tracked diff 为零，B 未跟踪文件保持原样。

## 14. 下一步

计划独立提交后进入 02.2A：先新增 migration 012 PostgreSQL 合同测试并确认有效 RED，再实现最小 Schema。只有出现数据库环境、已批准合同互相冲突或共享集成冲突时暂停报告。
