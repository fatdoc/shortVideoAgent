# A-BIZ-01.3 · Membership-bound Project Scope / Action Policy 实施计划

> 日期：2026-08-07
> 负责人：工程师 A（业务平台）
> 分支：`dev/business-plane`
> 前置完成：A-BIZ-01.1 Organization/Membership/Project Assignment、A-BIZ-01.2 Active Membership Context
> 状态：`PLAN_FROZEN / READY_FOR_RED`

## 1. 目标

将 Project、Brief、Script、Approval 和 Production HTTP 路径从旧的 Tenant-only 粗粒度角色判断，原子切换到可信 Active Membership Context + Project Assignment Scope + 动作级权限。

完成后必须满足：

- `tenant_admin` 可访问和管理当前 Tenant 的全部项目，不依赖 Project Assignment；
- `content_operator` 只能看到 active Assignment 授权的项目；
- `viewer` 只读项目内容与生产结果；
- `editor` 可写 Brief/Script/Approval 及创建 Production Package/Grant，但不能创建项目或修改 Project 管理字段；
- Membership、Role 或 Assignment 状态变化在下一次请求即时生效，不把 Assignment 缓存或固化进 Session；
- PLATFORM、CHANNEL、`pilot_support` 和其他非 TENANT Context 继续 fail closed；
- 跨 Tenant、未知项目、未分配项目和失效 Assignment 对工作人员统一返回 `404 PROJECT_NOT_FOUND`，不泄漏资源存在性；
- 已经处于可见 Project Scope、但动作级权限不足时返回 `403 PERMISSION_DENIED`；
- Policy 拒绝必须发生在领域 Store 写操作之前，禁止产生部分写入、幂等记录或 Production 副作用。

## 2. 已冻结的业务边界

### 2.1 可信 Actor Context

Tenant Router 只能从服务端已验证的 `PublicSession.activeContext` 构造 Actor，目标结构为：

```ts
type SessionActor = {
  userId: string;
  membershipId: string;
  organizationId: string;
  organizationType: 'TENANT';
  tenantId: string;
  membershipVersion: number;
  primaryRole: RoleCode;
  roles: RoleCode[];
};
```

要求：

1. `tenant.id === activeContext.tenantId`；
2. `activeContext.organizationId`、Membership、Version、Role 均来自 Auth resolve 后的当前数据库事实；
3. Router 不接受客户端提供的 Membership、Organization、Role 或 Assignment；
4. Assignment 不写入 Session，避免暂停、撤销或降级后继续沿用旧授权。

### 2.2 Project Assignment 实时有效条件

`content_operator` 的 Project Scope 必须同时满足：

- Project 属于 `actor.tenantId`；
- Assignment 的 `membership_id = actor.membershipId`；
- Assignment 的 `tenant_id = actor.tenantId`；
- Assignment 的 `organization_id = actor.organizationId`；
- Assignment `status = active`；
- 当前 Membership `status = active`；
- 当前 Membership Role 仍包含 `content_operator`；
- Organization 类型仍为 `TENANT`，且 Tenant 仍绑定该 Organization。

虽然 Auth resolve 已校验 Session Context，本切片仍在 Project Scope 查询中保留 Membership/Role/Organization 条件，避免未来非 HTTP 调用或错误复用绕过授权事实。

### 2.3 首版动作矩阵

| Actor / Scope                           |   List / Read Project | Create Project | Manage Project Metadata | Read Brief/Script/Approval/Eligibility | Write Brief/Script/Approval | Read Production Package | Create Package / Issue Grant |
| --------------------------------------- | --------------------: | -------------: | ----------------------: | -------------------------------------: | --------------------------: | ----------------------: | ---------------------------: |
| `tenant_admin`                          |  允许，本 Tenant 全部 |           允许 |                    允许 |                                   允许 |                        允许 |                    允许 |                         允许 |
| `content_operator` + active `viewer`    | 仅 Assignment Project |           拒绝 |                    拒绝 |                                   允许 |                        拒绝 |                    允许 |                         拒绝 |
| `content_operator` + active `editor`    | 仅 Assignment Project |           拒绝 |                    拒绝 |                                   允许 |                        允许 |                    允许 |                         允许 |
| `content_operator` + 无/失效 Assignment |          空列表 / 404 |           拒绝 |                     404 |                                    404 |                         404 |                     404 |                          404 |
| PLATFORM / CHANNEL / `pilot_support`    |  非 TENANT Router 403 |           拒绝 |                    拒绝 |                                   拒绝 |                        拒绝 |                    拒绝 |                         拒绝 |

冻结说明：

- `editor` 不等于 Project 管理员；首版不能创建 Project，也不能修改名称、状态、平台、画幅或目标时长；
- `viewer` 可以读取已授权项目的 Production Package，但不得创建 Package 或签发 Grant；
- Approval 暂按“项目内容写入”处理，允许 `editor`，不在本切片引入新的审批角色；
- 成员、充值、提成、渠道、平台 API 不在本切片实现，且不得因 Project Assignment 获得访问权；
- `pilot_support` Support Grant Schema 尚不存在，因此默认无客户内容权限。

## 3. Policy 设计

### 3.1 动作枚举

统一冻结以下动作：

```text
project.list
project.read
project.create
project.manage
project.content.read
project.content.write
project.production.read
project.production.write
```

### 3.2 可见性与动作权限分离

Policy 分成两层：

1. **Project Visibility Scope**：决定列表中出现哪些项目、具体 Project 是否可见以及 Assignment access level；
2. **Action Permission**：在 Project 已可见后，根据角色和 access level 判定具体动作。

稳定拒绝语义：

| 场景                                                  | HTTP | Code                      |
| ----------------------------------------------------- | ---: | ------------------------- |
| 无 Session                                            |  401 | `AUTHENTICATION_REQUIRED` |
| Session/Context 已失效                                |  401 | `SESSION_INVALID`         |
| 非 TENANT Context                                     |  403 | `TENANT_CONTEXT_REQUIRED` |
| 当前角色不能创建 Project                              |  403 | `PERMISSION_DENIED`       |
| 可见 Project，但 viewer 尝试写入                      |  403 | `PERMISSION_DENIED`       |
| 跨 Tenant / 未分配 / Assignment 失效 / Project 不存在 |  404 | `PROJECT_NOT_FOUND`       |
| 已知资源状态冲突                                      |  409 | 既有领域稳定码            |

对 `content_operator` 的资源写入必须先确认可见性，再判断 access level：未分配时返回 404；已分配 viewer 写入时返回 403。

### 3.3 实现落点

新增独立 Project Policy/Scope 模块，避免 Router、Content Repository 和 Production Repository 各自复制角色逻辑。首版建议接口：

```ts
type ProjectAccess = 'viewer' | 'editor' | 'manager';

type ProjectAction =
  | 'project.read'
  | 'project.manage'
  | 'project.content.read'
  | 'project.content.write'
  | 'project.production.read'
  | 'project.production.write';

interface ProjectPolicyStore {
  listVisibleProjectIds(actor: SessionActor): Promise<string[] | 'all'>;
  resolveProjectAccess(actor: SessionActor, projectId: string): Promise<ProjectAccess | null>;
}
```

实现时可以将 Scope SQL 下沉到 PostgreSQL Store，但必须保留一个共享动作判定函数，并保证 Content 与 Production 使用同一套语义。

### 3.4 Router 与 Repository 职责

Router：

- 构造完整可信 Actor；
- 在无 Project 资源的创建动作上直接判定角色；
- 将具体 Project 动作交给统一 Policy；
- 将 Policy 结果映射为稳定 403/404；
- 在拒绝时不调用领域 Store。

Repository/Policy Store：

- 以当前数据库事实解析 Project Visibility 与 Assignment access level；
- list 查询按 Scope 限制，不先加载 Tenant 全量再在内存过滤；
- 所有 Project/Brief/Script/Approval/Production 读取和写入使用相同 Project Scope；
- `tenant_admin` 使用 Tenant Scope，不创建或伪造 Assignment；
- 数据库写入仍保留 `tenant_id = actor.tenantId` 防线。

## 4. 原子切流顺序

### 4.1 01.3A · 行为级 RED

先补充 Router + PostgreSQL Policy 测试，并确认旧实现失败，至少覆盖：

1. Router 从 `activeContext` 构造完整 Actor；
2. `tenant_admin` 不依赖 Assignment，能列出、读取、创建、管理本 Tenant 项目；
3. `content_operator` list 只返回 active Assignment 项目；
4. 未分配、suspended/revoked Assignment、跨 Tenant Project 统一 404；
5. viewer 可读 Project/Brief/Script/Eligibility/Package，但内容写入与 Production 写入为 403；
6. editor 可写 Brief/Script/Approval、创建 Package/Grant，但创建/管理 Project 为 403；
7. Membership suspended、Organization inactive 或移除 `content_operator` Role 后访问即时失效；
8. 同一用户其他 Membership 的 Assignment 不得扩张当前 Context；
9. Policy 拒绝后 Content Store / Production Store 不被调用；
10. 错误正文、资源数量和状态码不泄漏其他 Tenant/Project 是否存在。

### 4.2 01.3B · Actor / Policy 最小 Green

- 扩展 `SessionActor`；
- 新增 Project Action Policy 与 PostgreSQL Scope 查询；
- Content Router 删除全局 `POST/PATCH => tenant_admin || content_operator` 粗粒度判断；
- 按 route 映射 `project.create/manage/content.read/content.write`；
- Content Store list/get/lock 与子资源查询切到统一可见 Scope。

### 4.3 01.3C · Production 原子切流

- Production Router 使用同一个完整 Actor；
- Package GET 使用 `project.production.read`；
- Package 创建和 Grant 签发使用 `project.production.write`；
- Policy 拒绝发生在 Production Store 及签名/幂等处理之前；
- 保持 StoryCanvas 合同、Package/Grant Schema 和错误签名格式不变。

### 4.4 01.3D · 完整 Gate 与收口

- 定向 Router/Policy/PostgreSQL 测试；
- Control API PostgreSQL 单 worker 全量测试；
- Control API typecheck/build；
- 新增/修改文件定向 ESLint、Prettier；
- Root Governance；
- `git diff --check`；
- StoryCanvas tracked diff 必须为零；
- 更新 C0 STATUS/CHANGELOG 与桌面知识库；
- 功能切片独立 commit。

## 5. 回滚与兼容

- 本切片不新增不可逆 Schema；回滚代码即可恢复上一版本；
- 不删除 Project Assignment 或旧 Tenant 外键；
- 不修改 Public Session 对外字段，只扩展内部 Actor；
- StoryCanvas 继续只消费已签发 Package/Grant，不读取 Membership/Assignment；
- 若 Policy 查询出现未知状态、缺失上下文或数据不一致，统一 fail closed；
- 禁止通过回退到 Tenant 全项目 Scope 来“保证可用性”。

## 6. 明确不做

- 不实现多 Context 切换 UI 或 `availableContexts`；
- 不实现 Support Grant；
- 不新增成员、充值、佣金、渠道或平台商业 API；
- 不修改 B 的 `apps/storycanvas/**`；
- 不改变 Package/Grant v0.2 合同；
- 不硬编码真实客户 UUID、邮箱、项目、价格、代理层级或佣金；
- 不把 Project Assignment 写入 Session；
- 不允许 `content_operator` 创建或管理 Project 元数据。

## 7. 提交策略

1. 本计划、C0 进度和知识库同步形成独立提交：
   `docs(business-plane): freeze project scope policy plan`；
2. RED 测试可以独立记录，但不得以失败测试提交到可集成分支；
3. Content Policy Green 与 Production Policy Green 若能保持完整 Gate，可分别提交；否则合并为一个原子功能提交；
4. 每次只显式暂存本切片文件，禁止 `git add .`；
5. 始终排除 `apps/storycanvas/data/vendor/byteplus.ts`。
