# A-BIZ-01.2 · Active Membership Context 实施计划

- 状态：`PLAN_FROZEN / IMPLEMENTATION_READY`
- 日期：2026-08-07
- 负责人：工程师 A（业务平台）
- 前置基线：`A-BIZ-01.1 COMPLETE`，migration `001`～`009` 已通过真实 Knex loader 空库迁移链验证
- 依据：`A_BIZ_00_2_MULTI_ORG_RBAC_ADR.md`、`A_ENGINEER_WAVE0_BOSS_DECISION_REPLY_2026-08-06.md`

## 1. 目标

把现有仅绑定 `user_id + tenant_id` 的 Pilot Session 升级为服务端可信的单一活动 Organization Membership Context：

- 登录只在服务端能够唯一确定一个 active Membership 时成功；
- Session 固化并校验 Membership、Organization 和 Membership Version；
- 每次 Session resolve 都重新读取 User、Organization、Membership 和 Role 事实；
- Membership、Role、User 或 Organization 状态变化后旧 Session fail closed；
- 保留现有 Tenant Pilot 登录、Cookie、轮换和公开 Session 的兼容路径；
- 为 A-BIZ-01.3 Project Assignment Policy 切流提供可信 Actor Context，但本切片不实施项目授权切流。

## 2. 本切片明确不做

- 不返回完整 `availableContexts`；
- 不新增组织选择或组织切换 UI/API；
- 不允许客户端通过 `organizationId`、`tenantId` 或 `membershipId` 选择活动上下文；
- 不修改 Project Repository 的 Tenant/Assignment Scope，不把 `content_operator` 正式切到 Assignment Policy；
- 不实现 Support Grant、注册、邀请、Terms、支付、额度或佣金；
- 不修改 B/StoryCanvas 独占目录；
- 不写死真实客户 UUID、邮箱、组织清单或商业数值。

## 3. 冻结的数据合同

### 3.1 migration 010：Session Active Context

新增：

```text
auth_sessions.active_membership_id uuid nullable
auth_sessions.active_organization_id uuid nullable
auth_sessions.membership_version integer nullable
auth_sessions.tenant_id 改为 nullable，仅 TENANT Context 使用
```

约束：

1. 三个 Active Context 字段必须全有或全无，禁止部分上下文。
2. 有 Active Context 时，`user_id + active_membership_id + active_organization_id` 必须对应同一 Organization Membership。
3. TENANT Context 必须携带与 Organization 一致的 `tenant_id`。
4. PLATFORM/CHANNEL Context 的 `tenant_id` 必须为 `null`。
5. migration 使用现有 `user_id + tenant_id` 回填唯一 active TENANT Membership。
6. 无法安全回填的历史 Session 不猜测上下文；将其撤销并保持 Context 字段为空。
7. 新代码写入 Session 时必须同时写新字段；旧字段仅用于兼容和一致性校验。
8. 新增以 `user_id + active_membership_id` 为主的 active Session 索引；旧 Tenant 索引暂不删除。

### 3.2 Membership Version

以下安全相关事实变化必须使 Membership Version 单调递增并令旧 Session 失效：

- Membership status、primary role、user 或 organization 改变；
- Membership Role 新增、删除或 role code 改变；
- 旧 `memberships` Shadow 写入导致的新模型 status/role 变化。

兼容 Shadow 必须从“删除再插入并重置 version”改为保留 Membership Identity 的受控更新。Role 变更可在一个事务内导致 version 增加一次以上；合同只要求严格增加，不依赖精确步长。

### 3.3 登录唯一选择

`findLoginIdentity(email)` 只接受：

- User active；
- 恰好一个 active Organization Membership；
- Organization active；
- Role 集合非空且包含 `primary_role_code`；
- Organization 类型与角色集合兼容；
- TENANT Organization 有唯一 active Tenant 扩展。

零个、多个或不一致候选统一返回不可登录；HTTP 仍使用 `INVALID_CREDENTIALS`，不泄漏账号、Membership 数量或组织状态。

### 3.4 Stored/Public Session

内部 Session/Identity 至少携带：

```text
membershipId
organizationId
organizationType
organizationDisplayName
membershipVersion
primaryRole
roles
tenantId / tenantDisplayName（仅 TENANT）
```

公开 Session 新增：

```text
activeContext {
  membershipId
  organizationId
  organizationType
  organizationDisplayName
  membershipVersion
  primaryRole
  roles
  tenantId?          // 仅 TENANT
}
```

兼容规则：

- 顶层 `roles` 暂时保留，值必须与 `activeContext.roles` 一致；
- 顶层 `tenant` 在 TENANT Context 保留原对象，在 PLATFORM/CHANNEL Context 为 `null`；
- 不返回 `availableContexts`、其他 Membership ID、其他组织名称或数量。

### 3.5 Session resolve 与 rotation

- `findSession` 必须通过当前 Membership 重新生成 Role/Organization/Tenant 事实；
- Session 保存的 Membership Version 必须与当前版本完全相等；
- User、Membership、Organization 或 TENANT 扩展停用时返回无效 Session；
- rotation 基于刚验证过的 Context 写入新 Session，旧 Token 立即撤销；
- 登录替换同一用户、同一 Membership 的旧登录 Session，不跨 Membership 猜测或切换；
- Context 无效时不自动降级到旧 Tenant-only 授权。

## 4. 与旧 Project/Production Router 的临时边界

A-BIZ-01.2 只保证 Auth Session Context 正确：

- TENANT Context 继续生成现有 `SessionActor { userId, tenantId, roles }`，保持 Pilot 路径兼容；
- PLATFORM/CHANNEL Context 访问现有 Tenant Project/Production Router 时，在 Actor 构造前明确拒绝，不伪造 Tenant、不把 Organization 当 Tenant；
- 正式 `ActorContext`、Project Assignment、动作 Permission 和 404 Scope 隐藏在 A-BIZ-01.3 一次性切流。

## 5. Test-first 分片

### 010A · Schema、回填与 Version

文件边界：

```text
apps/control-api/src/db/migrations/010_session_active_context.ts
apps/control-api/src/db/sessionActiveContext.postgres.test.ts
apps/control-api/src/db/migrationChain.postgres.test.ts
```

RED/Green 至少覆盖：

1. 唯一 TENANT Membership Session 回填；
2. 无 Membership/停用 Membership 的历史 Session 被撤销且不猜测；
3. PLATFORM/CHANNEL Session 允许 `tenant_id = null`；
4. partial Context、用户/组织不一致、TENANT 映射不一致被数据库拒绝；
5. Membership status/primary role/Role 集合变化使 version 严格增加；
6. 旧 Membership Shadow 更新保留 ID 且 version 增加；
7. `down` 在无新 Context Session 依赖时恢复旧结构；存在非 TENANT Session 时 fail closed；
8. 完整 Knex migration chain 更新为 `001`～`010`。

### 010B · Auth Repository 与 Service

文件边界：

```text
apps/control-api/src/auth/types.ts
apps/control-api/src/auth/repository.ts
apps/control-api/src/auth/service.ts
apps/control-api/src/auth/routes.test.ts
apps/control-api/src/auth/repository.postgres.test.ts
apps/control-api/src/projects/routes.ts
apps/control-api/src/production/routes.ts
对应 Router 测试
```

RED/Green 至少覆盖：

1. 唯一 active Membership 登录并写入完整 Context；
2. 多 active Membership、空 Role、错误 primary role、inactive User/Organization/Membership 拒绝；
3. Session resolve 校验 Version 和当前 Role；
4. Membership/Role/Organization 状态变化后旧 Token 失效；
5. rotation 保持刚验证的 Context，旧 Token 立即失效；
6. TENANT 公开 Session 保持兼容；
7. PLATFORM/CHANNEL 公开 Session 不伪造 Tenant，Tenant Router 明确拒绝；
8. 响应和日志不泄漏其他 Membership、密码 Hash 或数据库错误。

## 6. Gate 与提交策略

每个分片独立提交，禁止 `git add .`：

1. 计划提交：`docs(business-plane): freeze active membership context plan`；
2. 010A：`feat(control-api): add session context migration`；
3. 010B：`feat(control-api): activate membership-bound sessions`。

每个 Green 提交前执行：

```bash
CONTROL_API_TEST_DATABASE_URL=... npm --prefix apps/control-api test -- --maxWorkers=1 --no-file-parallelism
npm --prefix apps/control-api run typecheck
npm --prefix apps/control-api run build
npx eslint <本切片文件>
npx prettier --check <本切片文件>
npm run validate:governance
git diff --check
```

完整 Gate 必须 0 skip；只使用数据库名以 `_test` 结尾的 PostgreSQL。StoryCanvas tracked diff 必须为零，B 的未跟踪文件不得暂存。

## 7. 完成定义

A-BIZ-01.2 完成需同时满足：

- migration 010 可从空库和现有 009 基线安全升级；
- 新 Session 全部绑定唯一 Membership Context；
- Context 在每次 resolve 时重新验证并受 Version 约束；
- 状态或 Role 变化可即时使旧 Session fail closed；
- Tenant Pilot 登录、Cookie、rotation、logout 和旧公开字段无回归；
- Platform/Channel Session 不伪造 Tenant，Tenant 内容 Router 明确拒绝；
- 未交付 Context 切换、Project Policy 或其他后续能力；
- 完整 PostgreSQL、类型、构建、Lint、格式、Governance 与边界检查通过。
