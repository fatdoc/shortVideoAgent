# A-BIZ-06B · Member Directory / Deactivation 合同计划

- 日期：2026-08-09
- 负责人：工程师 A（业务平台）
- 分支：`dev/business-plane`
- 状态：`A_BIZ_06B_COMPLETE / MEMBER_OPERATIONS_API_READY`
- 上游：`A_BIZ_06_OPERATIONAL_CLOSURE_JOINT_GATE_PLAN.md`
- 实现基线：`93c7392 test(operations): add deterministic joint gate runner`

## 1. 本切片目标

A-BIZ-06B 只补齐当前活动 Organization 的最小 Member Directory 与安全停用合同，为 06C 的真实 Pilot Member 运营页提供服务端事实。它不是完整 IAM 控制台，也不扩展注册、邀请或角色管理能力。

交付目标：

1. 用真实 Session Cookie 读取当前 Organization 的 bounded Member Directory；
2. 仅允许当前 Organization 的明确管理员停用同 Organization 的 Membership；
3. 在 PostgreSQL 事务中保护 self-suspend、last-admin、stale version、跨 Organization 和重复请求；
4. 依赖现有 Membership version 与 Auth Session 校验，使被停用成员的旧 Session 在下一次 resolve 时失效；
5. 只返回运营所需最小投影，不泄露 User、Session、Invitation 或数据库内部字段。

## 2. 源码审计结论

### 2.1 现有 canonical Schema 足够，但 legacy shadow trigger 必须先加固

migration `008_organization_membership` 已提供：

- `organization_memberships`：Membership identity、User、Organization、`active | suspended | expired`、primary role、version 和 timestamps；
- `organization_membership_roles`：Membership 的多角色集合；
- User + Organization 唯一约束、角色/Organization Type guard 和 primary role 外键。

migration `010_session_active_context` 已提供：

- Session 的 `active_membership_id`、`active_organization_id` 和 `membership_version`；
- Membership status、Organization status、User status 与 version 一致性校验；
- Membership status、primary role 或 role set 改变时自动递增 version；
- Auth Repository resolve 只接受 active Membership 且要求 Session version 等于当前 Membership version。

因此 06B 不新增 Session revoke 表，也不新增显式 Session 扫表更新。成功 suspend 后，旧 Session 在下一次认证请求中因 Membership 非 active/version 不一致而返回 invalid。

但 migration `010_session_active_context` 的 legacy shadow UPDATE 分支会在任何 legacy Membership UPDATE 时删除所有不等于 `new.role_code` 的 canonical secondary roles。status-only suspend 因此会误删 secondary roles，并由 role set trigger 产生额外 version bump，违反“只改 status、角色不变、version 恰好 +1”的冻结合同。

修正决定：先新增 migration `019_harden_legacy_membership_shadow`，以 `create or replace function` 加固 legacy trigger；不新增业务表或 Session revoke 机制。

### 2.2 Migration 019 legacy shadow 加固合同

Migration 019 必须：

- identity/scope immutable guard 保持不变；
- legacy status-only UPDATE 只推进 canonical status，不触碰 `organization_membership_roles`；
- 仅当 `new.role_code IS DISTINCT FROM old.role_code` 时，才执行既有单角色兼容语义：删除非新 primary role、插入新 role；
- legacy status-only `active → suspended` 后 secondary roles 全部保留，canonical version 恰好 `+1`；
- legacy role change 仍保持 migration 010 的既有兼容行为；
- rollback 恢复 migration 010 的上一版 `shadow_legacy_membership()` 函数。

### 2.3 TENANT legacy shadow 是单向兼容写路径

现有触发器只把 `control_plane.memberships` 的 INSERT/UPDATE/DELETE shadow 到 canonical `organization_memberships`，没有 canonical → legacy 的反向触发器。Bootstrap 与 Registration 仍会写 legacy 表。

冻结决定：

- Directory 一律读取 canonical Organization Membership；
- PLATFORM / CHANNEL 或不存在 legacy shadow 的 TENANT Membership，直接更新 canonical Membership；
- TENANT Membership 若存在同 identity/scope 的 legacy 行，Repository 必须更新 legacy 行，由既有 trigger 原子推进 canonical status/version；
- 不允许先写 canonical、再无条件写 legacy 的双重状态变更；
- 06B 不改变 Bootstrap 的显式白名单恢复语义。人工再次运行 Bootstrap 可能把其受管 Pilot Membership 恢复为 active，必须作为明确运营动作记录，不得描述为普通 HTTP 自动恢复。

### 2.4 当前 HTTP 模式可直接复用

现有 Terms、Invitation、Commercial Channel、Commission 与 Settlement Route 已冻结：

- `videoagent_session` HttpOnly Cookie；
- Session rotation Cookie；
- `cache-control: no-store`；
- `x-request-id` 回传与安全错误 envelope；
- strict Zod path/query/body；
- Organization Scope 不存在/跨 Scope 使用 404，同 Scope 缺角色使用 403；
- Domain 原因不得把 SQL、stack 或内部错误文本直接返回。

## 3. 冻结的 HTTP 合同

### 3.1 当前 Organization Member Directory

```http
GET /api/v1/organizations/current/members?status=all&limit=100
Cookie: videoagent_session=...
```

Query：

- `status`：`all | active | suspended | expired`，默认 `all`；
- `limit`：整数 `1..100`，默认 `100`；
- 额外 query key、非法枚举、NaN、越界 limit：HTTP 422。

成功：HTTP 200。

```json
{
  "members": [
    {
      "membershipId": "uuid",
      "displayName": "Member Name",
      "email": "member@example.com",
      "status": "active",
      "primaryRole": "tenant_admin",
      "roles": ["tenant_admin"],
      "version": 3,
      "createdAt": "2026-08-01T00:00:00.000Z",
      "updatedAt": "2026-08-09T00:00:00.000Z",
      "isCurrentActor": false
    }
  ]
}
```

排序固定为：

1. `lower(displayName)` ascending；
2. `lower(email)` ascending；
3. `membershipId` ascending。

`roles` 去重并按 role code ascending；`primaryRole` 必须包含在 `roles` 中。列表只返回当前 Session canonical `organizationId` 下的记录，不接受 URL、query 或 body 覆盖 Organization。

### 3.2 Suspend Membership

```http
POST /api/v1/organizations/current/members/:membershipId/suspend
Content-Type: application/json
Cookie: videoagent_session=...

{
  "expectedVersion": 3
}
```

Path：

- `membershipId` 必须是 UUID；否则 HTTP 422。

Body：

- 只允许 `expectedVersion`；
- 必须为正整数；
- 缺失或有额外字段时 HTTP 422。

首次成功：HTTP 200，`idempotency-replayed: false`，body 为：

```json
{
  "member": {
    "membershipId": "uuid",
    "displayName": "Member Name",
    "email": "member@example.com",
    "status": "suspended",
    "primaryRole": "content_operator",
    "roles": ["content_operator"],
    "version": 4,
    "createdAt": "2026-08-01T00:00:00.000Z",
    "updatedAt": "2026-08-09T00:00:00.000Z",
    "isCurrentActor": false
  }
}
```

重复 suspend：目标已是 `suspended` 时返回当前安全投影、HTTP 200、`idempotency-replayed: true`；不再次递增 version。该资源状态重放不要求旧 `expectedVersion` 等于新 version。

## 4. 授权矩阵

| 当前 Organization | 允许 list/suspend | 明确拒绝                   |
| ----------------- | ----------------- | -------------------------- |
| PLATFORM          | `platform_admin`  | `pilot_support` 及其他角色 |
| CHANNEL           | `channel_admin`   | 非 `channel_admin`         |
| TENANT            | `tenant_admin`    | `content_operator`         |

规则：

- 缺 Cookie：401 `AUTHENTICATION_REQUIRED`；
- Cookie 无效、Membership/Organization/User inactive 或 version stale：401 `SESSION_INVALID`；
- Session 是合法当前 Scope 但缺管理员角色：403 `MEMBER_PERMISSION_DENIED`；
- path Membership 不属于当前 Organization 或不存在：404 `MEMBER_NOT_FOUND`；
- API 不提供任意 Organization ID，因此前端不得猜测或传入 Organization/Channel/Tenant scope。

`pilot_support` 不自动获得成员目录或停用权限；未来 Support Grant 必须单独冻结，不能借 06B 扩权。

## 5. Suspend 事务与并发语义

Repository 必须在单一 PostgreSQL 事务内：

1. 以当前 Session canonical `organizationId` 查询目标，并锁定目标及同 Organization 的 active 管理员集合；锁顺序按 `membership_id`，避免并发停用管理员时反向加锁；
2. 目标不在当前 Organization 时返回安全 404，不查询或返回外部 Organization 信息；
3. 目标已 `suspended` 时返回 replay，不修改任何行；
4. 目标为 `expired` 时返回稳定 409，不把历史失效状态改写成 suspended；
5. 目标是当前 actor Membership 时返回稳定 409，禁止 self-suspend；
6. active 目标的 `version` 与 `expectedVersion` 不一致时返回稳定 409；
7. 若目标包含当前 Organization 的管理员角色，停用后必须仍至少有一个 active 管理员；否则返回稳定 409；
8. 根据 2.2～2.3 的 migration/canonical/legacy 兼容规则执行一次状态更新；
9. 重新读取 canonical Membership + User + roles，验证 status 为 suspended、version 已递增，并返回安全投影；
10. 任一步失败时事务整体回滚，不允许出现 legacy/canonical 状态分叉或半更新。

管理员角色定义：

- PLATFORM：`platform_admin`；
- CHANNEL：`channel_admin`；
- TENANT：`tenant_admin`。

检查使用 roles 集合而非只看 primary role，防止多角色 Membership 绕过 last-admin 保护。

## 6. 稳定错误合同

| HTTP | Code                            | 语义                                             |
| ---- | ------------------------------- | ------------------------------------------------ |
| 401  | `AUTHENTICATION_REQUIRED`       | 未提供 Cookie                                    |
| 401  | `SESSION_INVALID`               | Session、Membership、Organization 或 User 已失效 |
| 403  | `MEMBER_PERMISSION_DENIED`      | 当前 Scope 合法但缺管理员角色                    |
| 404  | `MEMBER_NOT_FOUND`              | Membership 不存在或不属于当前 Organization       |
| 409  | `MEMBER_SELF_SUSPEND_FORBIDDEN` | 禁止停用当前 actor Membership                    |
| 409  | `MEMBER_LAST_ADMIN_CONFLICT`    | 停用后将没有 active 管理员                       |
| 409  | `MEMBER_VERSION_CONFLICT`       | active 目标 version 与 expectedVersion 不一致    |
| 409  | `MEMBER_STATUS_CONFLICT`        | 目标为 expired 或其他不可停用状态                |
| 422  | `MEMBER_QUERY_INVALID`          | Directory query 非法                             |
| 422  | `MEMBER_REQUEST_INVALID`        | path/body 非法                                   |

所有错误：

- 返回 `error.code`、固定安全 `message`、`requestId`；
- `cache-control: no-store`；
- 不返回目标 Organization ID、User ID、SQL、constraint、stack、原始 Repository message 或目标是否存在于其他 Organization。

## 7. 最小 DTO 与敏感信息边界

允许返回：

- Membership ID；
- display name、normalized operational email；
- Membership status、primary role、roles、version；
- createdAt、updatedAt；
- `isCurrentActor`。

禁止返回：

- User ID、Organization ID、Tenant ID、Channel ID；
- password hash 或密码状态细节；
- Session ID、Cookie、token、digest、rotation/expiry internals；
- Invitation token/digest、Registration evidence；
- Provider payload、Payment/Commission/Settlement 内部事实；
- SQL、constraint、stack 或数据库连接信息。

06B 不新增导出、搜索、任意分页 cursor 或全局 User Directory。

## 8. 原子实施切片

### 06B.1 · Contract Freeze

文件：本计划、父计划、STATUS、HANDOFF、CHANGELOG、桌面知识库。

提交：

```text
docs(business-plane): freeze member deactivation contract
```

### 06B.1A · Migration 019 Legacy Membership Shadow Hardening

交付：

- `019_harden_legacy_membership_shadow.ts`；
- PostgreSQL RED/Green：status-only update 保留 secondary roles，status suspended，version 恰好 `+1`；
- legacy role change 兼容回归；
- migration chain `001..019` 与 rollback/reapply。

不修改 `members/**`、`app.ts`、`server.ts` 或 StoryCanvas。

建议提交：

```text
fix(control-api): preserve membership roles on legacy status updates
```

### 06B.2 · Repository / Service

交付：

- `members/types.ts`、`members/errors.ts`；
- canonical Directory Repository；
- suspend transaction、legacy compatibility、version/replay/last-admin/self-suspend；
- Service 授权与 Scope 策略；
- Service unit tests 与 PostgreSQL Repository tests。

不修改 `app.ts` / `server.ts`。

建议提交：

```text
feat(control-api): add member directory deactivation service
```

### 06B.3 · HTTP Route

交付：

- Cookie/rotation、`no-store`、strict query/path/body；
- list/suspend response；
- 401/403/404/409/422、Request ID 与安全错误文案；
- Route tests。

不修改共享 Bootstrap。

建议提交：

```text
feat(control-api): expose current organization members
```

### 06B.4 · Shared Bootstrap Wiring

只接线：

- `apps/control-api/src/app.ts`；
- `apps/control-api/src/server.ts`；
- 对应 App/bootstrap test。

必须独立提交并明确通知 B 同步，提交中不得夹带 Repository、Route、前端或 StoryCanvas 改动。

建议提交：

```text
feat(control-api): wire member operations routes
```

## 9. Test-first 首个 RED

首个 RED 放在 Service 单元测试，先导入尚不存在的 `MemberDirectoryService`，冻结：

1. PLATFORM/CHANNEL/TENANT 只有对应管理员可 list/suspend；
2. `pilot_support` 与 `content_operator` 在调用 Repository 前 403；
3. Service 只把 actor canonical Organization/Membership 传给 Repository，不接受调用者覆盖 Scope；
4. suspend 返回 Repository 的 replay 与安全投影，不在 Service 伪造 version/status。

Service 首个 RED 已按预期因模块缺失失败，最小 Service 授权/canonical Scope 实现已在工作区定向通过；在提交 Repository/Service 前，必须先完成独立 Migration 019 切片。

Migration 019 首个 PostgreSQL RED：建立包含 `tenant_admin + content_operator` 的 TENANT canonical Membership，经 legacy status-only `active → suspended` 更新；旧函数会误删 secondary role，测试必须先失败。Green 后断言两个 roles 均保留、status 为 suspended、version 恰好 `+1`。

随后 Repository PostgreSQL RED 冻结：

- bounded/sorted canonical Directory；
- cross-Organization 404；
- active → suspended/version + 1；
- old Auth Session 下一次 resolve 失效；
- duplicate replay 不二次 bump；
- stale version、expired、self、last-admin；
- 两个管理员并发 suspend 时最多一个成功；
- TENANT legacy/canonical 一致，失败全回滚。

## 10. Gate 与完成条件

每个切片至少运行：

```bash
npm --prefix apps/control-api test -- --pool=forks --maxWorkers=1
npm --prefix apps/control-api run typecheck
npm --prefix apps/control-api run build
npx eslint apps/control-api/src/members apps/control-api/src/app.ts apps/control-api/src/server.ts
npx prettier --check <本切片文件>
npm run validate:governance
git diff --check
git diff -- apps/storycanvas
git diff --cached -- apps/storycanvas
```

PostgreSQL Repository 证据只有在合法 `_test` 数据库下实际执行且 0 SKIP 才可记 PASS；缺数据库时必须标记 `NOT_RUN/BLOCKED`，不能把 skip 当 Green。

06B 完成后只允许宣称：

```text
A_BIZ_06B_COMPLETE / MEMBER_OPERATIONS_API_READY
```

不得宣称：

```text
A_BIZ_06_COMPLETE
FULL_JOINT_GATE_PASS
COMPLETE_IAM_CONSOLE
LIVE_OPERATIONS_READY
```

## 11. 明确不实现

- 任意角色添加、删除或 primary role 修改；
- 新增成员、批量停用、删除成员、恢复成员；
- 密码重置、MFA、User 全局 suspend；
- 跨 Organization 管理、Support Grant、代理管理员；
- Member Audit Export、搜索、无限分页；
- Invitation/Registration 新逻辑；
- LIVE Payment、真实佣金比例、paid、提现、KYC、税务、发票或自动打款；
- StoryCanvas 任何代码、数据或运行时改动。

## 12. 2026-08-09 · 实施与 Gate 收口

A-BIZ-06B 已按原子切片完成：

1. `de0c08a fix(control-api): preserve membership roles on legacy status updates`：Migration 019 与 rollback/reapply 合同；
2. `8278d22 feat(control-api): add member directory deactivation service`：canonical Repository/Service、事务、并发、Session invalidation 与 legacy compatibility；
3. `3087a06 feat(control-api): expose current organization members`：真实 Cookie HTTP Route、安全错误与 replay header；
4. `0b177cf feat(control-api): wire member operations routes`：共享 App/Server Bootstrap 独立接线。

关键行为证据：

- legacy status-only RED 首次观察到 `tenant_admin + content_operator` 被错误缩减为单一 `tenant_admin`；Migration 019 Green 后 roles 全保留且 version 恰好 `+1`；
- Directory bounded、确定性排序且只返回冻结的最小 Member DTO；
- suspend 覆盖 403/404/409/422、self、last-admin、expired、stale version、duplicate replay、跨 Organization、并发串行化和事务回滚；
- 被停用 Membership 的旧 Session 在下一次 Repository resolve 时失效；
- Route 使用真实 Session Cookie/rotation、`no-store`、Request ID 与固定安全错误文案，异常路径不泄漏 SQL、password 或 stack。

最终 Gate：

```text
Migration focused:       2 files / 4 tests PASS
Repository/Service:      2 files / 14 tests PASS
Route/Service:           2 files / 19 tests PASS
App/Route wiring:        2 files / 24 tests PASS
Control API full:       61 files / 414 tests PASS
Typecheck/Build/ESLint/Prettier/Governance/diff-check: PASS
StoryCanvas tracked diff: zero
```

共享 Bootstrap 提交 `0b177cf` 已要求 B 在修改 `apps/control-api/src/app.ts`、`app.test.ts`、`server.ts` 前先同步。B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交。

本切片完成状态仅为：

```text
A_BIZ_06B_COMPLETE / MEMBER_OPERATIONS_API_READY
```

下一步为 `A_BIZ_06C` 规划；仍不得宣称 `A_BIZ_06_COMPLETE`、`FULL_JOINT_GATE_PASS`、`COMPLETE_IAM_CONSOLE` 或 `LIVE_OPERATIONS_READY`。
