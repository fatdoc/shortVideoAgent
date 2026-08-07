# A-BIZ-01.1 · 009 Project Assignment / Pilot 显式回填实施计划

日期：2026-08-07
状态：`PLAN_FROZEN / READY_FOR_TEST_FIRST_RED`
基线：`dev/business-plane@f6459e9`

## 1. 目标

在不提前切换 Auth Session 和现有 Project HTTP Policy 的前提下，建立以 Organization Membership 为主体的 Project Assignment 授权事实，并为白名单 Pilot 工作人员提供显式、可审计、可重复验证的回填路径。

本切片完成后：

- Schema 能表达一个 TENANT Membership 对一个 Project 的 `viewer` 或 `editor` 授权；
- Assignment 无法跨 Tenant/Organization；
- `content_operator` 后续可从 Tenant 全项目权限收紧到 active Assignment；
- Tenant Admin 的全项目权限仍来自服务端 Tenant 管理 Policy，不通过伪造 Assignment 表达；
- 历史工作人员不会因为 migration 被自动授予 Tenant 全部项目；
- 白名单 Pilot 回填必须来自显式 manifest，结果与 manifest digest 可审计；
- 当前 Auth Repository、Session、Project Repository 和 HTTP Router 尚不切换到新 Assignment。

## 2. 审计结论

当前实现仍是单 Tenant Pilot 权限路径：

- `SessionActor` 只有 `userId + tenantId + roles`，没有 Membership ID、Organization ID 或 Membership version；
- Project Repository 的列表、读取和写入只使用 `actor.tenantId` 过滤；
- Router 对 POST/PATCH 统一允许 `tenant_admin` 和 `content_operator`，因此 `content_operator` 当前仍能创建项目、管理项目并写入 Tenant 全部项目内容；
- 现有 bootstrap 只创建一个白名单 `tenant_admin`，没有工作人员 Project allowlist，也没有可以安全推断 Assignment 的历史字段；
- 现有 Project、Brief、Script、Approval、Package 和 Grant 都依赖原 Tenant/Project UUID，009 不得改动这些 ID 或跨平面合同；
- migration 无法从角色、`created_by`、UUID 顺序或“同 Tenant 全部项目”推导真实工作人员授权。

因此 009 采用**增量 Assignment Schema + 独立显式 Pilot backfill runner**。migration 不执行宽泛数据授权，Project Policy 切流保留到 A-BIZ-01.3。

## 3. 冻结的数据模型

### 3.1 `control_plane.project_assignments`

```text
project_assignment_id uuid primary key
project_id uuid not null
membership_id uuid not null
tenant_id uuid not null
organization_id uuid not null
access_level viewer | editor
status active | suspended | revoked
assignment_source manual | pilot_backfill
backfill_run_id uuid nullable
created_by uuid not null FK users
created_at timestamptz not null
updated_at timestamptz not null
revoked_at timestamptz nullable
unique (project_id, membership_id)
```

字段语义：

- `viewer`：后续 Policy 只允许项目及创作内容读取，不允许 Brief/Script/Storyboard/Canvas 写入；
- `editor`：后续 Policy 允许创作内容读写，但仍不允许 `content_operator` 创建项目、修改 Project 管理字段、审批高权限动作或访问商业/成员能力；
- `active` 才产生项目 Scope；`suspended` 和 `revoked` 一律不产生访问；
- `revoked` 为终态，不允许恢复；重新授权仍复用同一唯一行并修改回 active 会破坏审计，因此首版禁止 revoked → active；如未来需要重新授权，必须另行评审历史模型；
- `assignment_source` 和 scope 字段创建后不可修改；`access_level` 可由后续授权服务升降级，状态按冻结状态机变化；
- `created_by` 是审计主体，不等价于数据库授权证明；后续 Service 必须验证操作者为目标 Tenant 的合法管理员。

### 3.2 `control_plane.project_assignment_backfill_runs`

```text
backfill_run_id uuid primary key
manifest_id text not null unique
manifest_digest text not null unique
manifest_version integer not null
assignment_count integer not null > 0
tenant_id uuid not null
organization_id uuid not null
approved_by uuid not null FK users
created_at timestamptz not null
```

用途：

- 记录一次已批准白名单 manifest 的不可变执行证据；
- `manifest_digest` 使用 canonical JSON 的 SHA-256，格式为 `sha256:<64 lowercase hex>`；
- 同一 `manifest_id` 或 digest 重复执行必须幂等返回既有结果，payload 不同必须拒绝；
- backfill run 和所有 Assignment 必须在同一数据库事务成功或回滚；
- 表不保存密码、Token、邮箱或客户内容正文。

### 3.3 必要复合键

为用 FK 而不是仅靠应用代码证明同一 Tenant/Organization，009 增加：

```text
tenants unique (tenant_id, organization_id)
organization_memberships unique (membership_id, organization_id)
project_assignment_backfill_runs unique (backfill_run_id, tenant_id, organization_id)
```

Assignment 使用复合外键：

```text
(project_id, tenant_id)
  -> projects(project_id, tenant_id)

(tenant_id, organization_id)
  -> tenants(tenant_id, organization_id)

(membership_id, organization_id)
  -> organization_memberships(membership_id, organization_id)

(backfill_run_id, tenant_id, organization_id)
  -> project_assignment_backfill_runs(backfill_run_id, tenant_id, organization_id)
```

`backfill_run_id` 为 nullable；`manual` 必须为空，`pilot_backfill` 必须非空。

这些约束保证 Project 所属 Tenant Organization 与 Membership Organization 完全一致，禁止跨 Tenant Assignment。

## 4. Membership 与 Role 约束

首版 Assignment 只用于 `content_operator`：

- 新增 Assignment 时 Membership 必须存在、状态为 `active`，且角色集合包含 `content_operator`；
- Membership 必须属于 `TENANT` Organization；该点同时由 008 Role/Organization 类型保护和 009 复合 FK 保证；
- 后续 Membership 被 suspended/expired 或移除 `content_operator` Role 时，Assignment 记录保留用于审计，但运行时必须因 Membership/Role 不再 active 而拒绝；
- 009 不级联撤销 Assignment，也不阻止 Membership 停用，避免授权记录反向绑死成员生命周期；
- `tenant_admin` 不依赖 Assignment；Platform/Channel Role 和 `pilot_support` 不得通过 Project Assignment 获得客户内容权限。

## 5. Assignment 状态与不可变边界

冻结状态转换：

```text
active -> suspended | revoked
suspended -> active | revoked
revoked -> revoked
```

数据库 trigger 必须保证：

- scope 字段 `project_id / membership_id / tenant_id / organization_id` 不可修改；
- `assignment_source / backfill_run_id / created_by / created_at` 不可修改；
- `revoked` 必须有 `revoked_at`，非 revoked 必须没有 `revoked_at`；
- revoked 行不得恢复、改 access level 或重绑资源；
- `updated_at` 在允许的 update 时自动刷新；
- 删除 Assignment 默认拒绝，保留授权历史；测试清库与 down migration 通过 truncate/drop，不依赖业务 delete。

## 6. 白名单 Pilot 显式回填

### 6.1 不允许的推断

禁止 migration 或 runner 使用以下规则生成 Assignment：

- 给所有历史 `content_operator` 授予所在 Tenant 全部项目；
- 根据 Project `created_by` 猜测持续访问权；
- 根据邮箱、显示名、UUID 排序、项目名称或 Demo 默认 ID 推断；
- 将 `tenant_admin` 的全项目能力写成 Assignment；
- 把 `pilot_support` 映射为 Tenant Project Assignment。

### 6.2 Manifest 合同

独立 backfill runner 接受显式 JSON manifest：

```text
manifestVersion: 1
manifestId: 非空稳定标识
tenantId: uuid
approvedByUserId: uuid
assignments[]:
  membershipId: uuid
  projectId: uuid
  accessLevel: viewer | editor
```

Runner 必须：

1. 严格拒绝未知字段、空 assignments、重复 Membership/Project 对；
2. 验证批准人为该 Tenant Organization 的 active `tenant_admin`；
3. 验证目标 Membership 为同 Tenant 的 active `content_operator`；
4. 验证 Project 属于 manifest Tenant；
5. 计算 canonical manifest digest；
6. 在单一事务写入 backfill run 和 Assignment；
7. 输出只包含 manifest ID、digest、写入数量和是否 replay，不输出凭证或客户内容；
8. 未提供经批准 manifest 时不执行任何回填。

当前仓库没有真实工作人员 allowlist，因此 009 不提交或硬编码海底捞人员/项目 UUID。实际 Pilot manifest 由部署操作者在受控环境显式提供，数据库结果保留可审计证据。

## 7. 兼容窗口与切流边界

009 完成后：

- 旧 Auth/Session 继续产生 Tenant-only `SessionActor`；
- Project Repository 和 Router 暂时继续旧行为，以避免在 Active Membership Context 尚未完成时出现半切流；
- 新 Assignment 表是 Shadow 授权事实，不宣告运行时 Policy 已启用；
- A-BIZ-01.2 完成 Session Active Membership Context 后，A-BIZ-01.3 再将 Router/Policy/Repository 原子切换到 Membership + Assignment Scope；
- Policy 切流前必须运行只读 Shadow 对比，记录旧 Tenant Scope 与新 Assignment Scope 差异；
- B/StoryCanvas 仍只接收 A 已签发的 Project/Grant 上下文，不读取 Assignment 表，也不修改 B 页面。

## 8. Test-first 验收用例

### 8.1 009A Migration

新增：

```text
apps/control-api/src/db/projectAssignment.postgres.test.ts
apps/control-api/src/db/migrations/009_project_assignment.ts
```

先写测试并确认空 migration 有效 RED，至少覆盖：

1. 同 Tenant active `content_operator` 可获得 viewer/editor Assignment；
2. 跨 Tenant Project/Membership、Platform/Channel Membership、非 content_operator、inactive Membership 均拒绝；
3. 同 Project/Membership 重复 Assignment、未知 access level/status/source 拒绝；
4. manual/backfill source 与 `backfill_run_id` 一致性；
5. 状态转换、revoked 终态、scope/source 不可变和 delete 拒绝；
6. Membership 停用或移除 Role 后 Assignment 保留但不自动扩权；
7. down 只删除 Assignment/backfill 表、trigger/function 和 009 新复合约束，保留 Project、Membership、Tenant、Organization 与历史内容。

测试必须先断言新表存在，避免“表不存在也满足 rejects”造成假通过。

### 8.2 009B Backfill Runner

新增 runner、schema 与 PostgreSQL 测试，至少覆盖：

1. 合法 manifest 原子写入 run + assignments；
2. 相同 manifest ID/digest replay 不重复写入；
3. 相同 ID 不同 payload、相同 digest 不同 ID、重复 pair 拒绝；
4. 非 tenant_admin 批准人、跨 Tenant、inactive/错误 Role、未知 Project 拒绝且零部分写入；
5. 日志不泄漏邮箱、Token、密码或内容正文；
6. 未提供 manifest 时 fail closed，不做自动全量回填。

## 9. 验证 Gate

每个子切片必须通过：

- 对应定向 PostgreSQL 测试；
- Control API 完整 PostgreSQL 单 worker Gate；
- Control API typecheck；
- Control API build；
- 新增文件定向 ESLint；
- Governance；
- `git diff --check`；
- B/StoryCanvas tracked diff 为零。

009B 还必须使用专用 `_test` 数据库证明事务回滚和幂等 replay。

## 10. 明确不做

- 不修改 `auth_sessions` 或 `SessionActor`；
- 不切换 Auth Repository、Project Router、Project Repository 或 Production Repository；
- 不实现 Active Membership Context、组织切换 UI 或 availableContexts；
- 不实现 Support Grant、Platform/Channel 内容访问；
- 不修改 B 的 StoryCanvas/Storyboard/Script Editor 页面；
- 不写死真实客户 UUID、邮箱、项目名、代理层级、价格或佣金；
- 不把 Assignment 当作 Tenant Admin 全项目权限来源；
- 不删除旧 Tenant-only Scope 路径。

## 11. 提交策略

1. 本计划独立文档提交；
2. 009A RED 测试 + 最小 migration 在转绿并通过完整 Gate 后形成独立 `feat(control-api)` 提交；
3. 009B backfill runner 与测试形成另一个独立提交；
4. Session/Policy 切流不混入 009；
5. 禁止 `git add .`，只暂存对应子切片指定文件；
6. 始终排除 `apps/storycanvas/data/vendor/byteplus.ts`。
