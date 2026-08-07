# A-BIZ-01.1 · 008 Organization Membership / Role 实施计划

日期：2026-08-07
状态：`PLAN_FROZEN / READY_FOR_TEST_FIRST_RED`
基线：`dev/business-plane@061dfde`

## 1. 目标

在不切换现有登录、Session 和项目授权路径的前提下，建立以 Organization 为授权根的 Membership/Role 数据底座，并把现有 Tenant Membership 安全投影到新模型。

本切片完成后：

- Schema 能表达 PLATFORM、CHANNEL、TENANT 三类 Organization Membership；
- 一个 User 在一个 Organization 中只有一个 Membership；
- 一个 Membership 可以拥有多个 Role，并有且只有一个 `primary_role_code`；
- 现有 Tenant-only `control_plane.memberships` 继续工作，现有 Membership UUID 保持不变；
- 旧表写入会单向同步到新表，避免白名单 bootstrap 和当前服务在兼容期制造数据漂移；
- Auth Repository、Session Active Context、Project Assignment 尚不切流。

## 2. 审计结论

当前 `control_plane.memberships` 同时承担“成员关系”和“角色行”两种含义：

- 直接绑定 `tenant_id`，不能表达 PLATFORM/CHANNEL 身份；
- `role_code` 位于 Membership 行中，多角色依赖同一 User/Tenant 多行；
- 当前 Auth Repository 按 `user_id + tenant_id` 聚合角色；
- bootstrap 只写旧 `memberships`；
- `auth_sessions` 尚未引用 Membership；
- 直接原地改造旧表会同时影响 Auth、bootstrap、测试 fixture 和 rollback，无法保持本切片最小且低风险。

因此 008 选择**新增 canonical Organization Membership 表并保留旧表兼容**，不在本切片原地替换旧 `memberships`。

## 3. 冻结的数据模型

### 3.1 `control_plane.organization_memberships`

```text
membership_id uuid primary key
user_id uuid not null FK users
organization_id uuid not null FK organizations
status active | suspended | expired
primary_role_code platform_admin | channel_admin | tenant_admin | content_operator | pilot_support
version integer not null default 1, version > 0
created_at timestamptz
updated_at timestamptz
unique (user_id, organization_id)
```

### 3.2 `control_plane.organization_membership_roles`

```text
membership_id uuid not null FK organization_memberships on delete cascade
role_code platform_admin | channel_admin | tenant_admin | content_operator | pilot_support
created_at timestamptz
primary key (membership_id, role_code)
```

`organization_memberships.(membership_id, primary_role_code)` 使用可延迟复合外键引用 `organization_membership_roles.(membership_id, role_code)`，保证主角色一定属于该 Membership 的角色集合。这样 Schema 支持多角色，同时始终只有一个明确主角色。

## 4. 角色与 Organization 类型矩阵

| Role               | 允许的 Organization Type |
| ------------------ | ------------------------ |
| `platform_admin`   | `PLATFORM`               |
| `pilot_support`    | `PLATFORM`               |
| `channel_admin`    | `CHANNEL`                |
| `tenant_admin`     | `TENANT`                 |
| `content_operator` | `TENANT`                 |

数据库触发器必须双向保护：

1. 新增/修改 Membership 或 Role 时拒绝类型不匹配；
2. 已有关联 Membership/Role 的 Organization 不得改成导致角色失配的类型；
3. 未知角色、空角色集合、主角色不在角色集合均 fail closed。

Organization parent 树不产生 Membership，也不继承 Role 或 Permission。

## 5. 旧 Membership 回填与兼容策略

### 5.1 迁移前 fail-closed 审计

在创建新表前拒绝以下歧义数据：

- 同一 `tenant_id + user_id` 存在多条旧 Membership；这意味着无法在没有业务确认的情况下选择主角色；
- 旧 Tenant Membership 使用 `pilot_support`；新规则要求该角色属于 PLATFORM，不能静默提升或迁移；
- Tenant 缺少已验证的 `organization_id` 映射。

迁移不得用 UUID 排序、角色优先级或 Demo 规则猜测主角色。

### 5.2 显式回填

对每条通过审计的旧 Membership：

- 保留原 `membership_id`；
- `organization_id = tenants.organization_id`；
- 原 `status` 原样保留；
- 原 `role_code` 同时写入角色集合并设为 `primary_role_code`；
- `version = 1`；
- 原时间戳原样保留。

### 5.3 兼容窗口

008 完成后，旧 `control_plane.memberships` 仍是当前运行时写入口：

- insert/update/delete 通过数据库触发器单向同步到 Organization Membership/Role；
- 旧表若尝试为同一 User/Tenant 写第二条角色行，必须拒绝，并要求未来通过新 Role 表增加次要角色；
- 当前 Auth Repository、bootstrap、Session 和 Route 不改读路径；
- 新表到旧表的反向双写不在本切片开放；在服务端双读/双写切片完成前，不允许生产代码直接创建仅存在于新表的 Membership。

该阶段用于 Shadow 数据一致性，不宣告授权事实源切换。

## 6. 索引与版本边界

最小索引：

- active user context lookup：`user_id + organization_id`，按 active 状态优化；
- organization member lookup：`organization_id + status + user_id`；
- role lookup：`role_code + membership_id`。

`version` 在本切片建立并回填为 1。版本自动递增和 Session 中的 `membership_version` 校验在 Session Active Context 切片统一实现；008 不提前修改 Session。

## 7. Test-first 验收用例

新增：

```text
apps/control-api/src/db/organizationMembership.postgres.test.ts
apps/control-api/src/db/migrations/008_organization_membership.ts
```

先写测试并确认 migration 不存在时 RED，再做最小实现。至少覆盖：

1. 单角色 Tenant Membership 保留 UUID、状态、时间戳并正确回填 Organization 与主角色；
2. PLATFORM/CHANNEL/TENANT 类型矩阵、唯一 User/Organization、未知角色和主角色复合外键；
3. Schema 支持同一 Membership 多角色，但只有一个明确主角色；
4. 旧 Membership insert/update/delete 单向同步，新旧数据一致；旧表第二角色行 fail closed；
5. 歧义旧多角色和 Tenant `pilot_support` 在迁移前被拒绝，不做静默推断；
6. Organization 类型反向修改被拒绝；
7. down 只删除新 Membership/Role、同步触发器和函数，保留旧 Membership、User、Tenant、Organization、Channel。

## 8. 验证 Gate

实现完成后必须通过：

- 008 定向 PostgreSQL 测试；
- Control API 完整 PostgreSQL 单 worker Gate；
- Control API typecheck；
- Control API build；
- 008 文件定向 ESLint；
- Governance；
- `git diff --check`；
- B/StoryCanvas tracked diff 为零。

## 9. 明确不做

- 不修改 `auth_sessions`，不建立 Active Membership Context；
- 不修改 Auth Repository、登录响应或组织切换 UI；
- 不实现 Project Assignment、Support Grant 或跨 Tenant 权限；
- 不创建 Platform 商业数据；
- 不写死代理层级、价格、佣金或 Channel Relationship；
- 不迁移 B/StoryCanvas 数据，不处理 `apps/storycanvas/data/vendor/byteplus.ts`。

## 10. 提交策略

1. 本计划独立文档提交；
2. 008 RED 测试和最小 migration 在测试转绿、完整 Gate 通过后形成独立 `feat(control-api)` 提交；
3. 禁止 `git add .`，只暂存本切片指定文件。
