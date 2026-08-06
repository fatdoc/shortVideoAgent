# ADR-A-BIZ-00.2 · 多组织身份、活动上下文与项目级授权

- 状态：PROPOSED / WAITING_FOR_C0_AND_PRODUCT_SIGN_OFF
- 日期：2026-08-06
- 提案人：工程师 A（业务平台）
- 会签人：工程师 B（剪辑画布）、产品/业务负责人（TBD）
- 决策人：C0
- 适用范围：A-BIZ-00.2；后续 migration `006+`、Auth、RBAC、Project Scope 与统一工作台
- 不适用范围：注册归因、用户须知正文、充值、佣金、支付和 B 侧画布运行时

## 1. 背景

最新 `main@705a134` 已具备 PostgreSQL Pilot 控制平面、白名单认证、Tenant 项目、脚本审批以及 Production Package/Grant，但服务端权限模型仍是单 Tenant Pilot 形态：

- `LoginIdentity`、`StoredSession`、`PublicSession` 和 `SessionActor` 都只携带一个 `tenantId`；
- `memberships` 直接绑定 `tenant_id`，角色只有 `tenant_admin`、`content_operator`、`pilot_support`；
- 同一用户一旦查询到多个 Tenant Membership，`groupIdentity()` 会返回 `null`，无法登录；
- 项目 Repository 以 `actor.tenantId` 做 Tenant Scope，但 `content_operator` 当前默认可写该 Tenant 的全部项目；
- `production_packages` / `project_grants` 中的 `organizationId` 是跨平面合同与审计字段，不是服务端 Membership 授权事实；
- Demo 前端已有 `PLATFORM / CHANNEL / TENANT` 和四身份语义，但它只适用于 Mock/LocalStorage，不可直接当作 Pilot 权限事实源。

新业务要求 A 成为 User、Organization、Tenant、Membership、Referral、Terms、Recharge、Commission 和 Script Approval 的事实源，并支持平台、代理商、企业老板和内容工作人员。统一工作台只合并使用体验，不得取消服务端边界。

本 ADR 的目标是在写 migration `006` 之前冻结可安全实现的组织与授权骨架，同时保留尚未确认的业务规则为 `TBD`。

## 2. 当前缺口与约束

### 2.1 已确认缺口

1. 没有正式 `organizations` / `channels` 服务端模型。
2. Membership 只能属于 Tenant，不能表达平台和代理商身份。
3. Session 无法表达或切换活动组织上下文。
4. `content_operator` 没有项目授权表，权限被放大到整个 Tenant。
5. 路由只做粗粒度角色判断，没有统一 Policy/Permission manifest。
6. 多组织、停用 Membership、伪造组织参数和跨项目负向 fixture 不完整。

### 2.2 必须维持的兼容与安全约束

- 现有 Pilot 白名单 Tenant、项目、脚本、Package 和 Grant 必须可原地回填，不改现有 UUID。
- Migration 只能增量演进；兼容阶段不得要求一次性重写所有调用方。
- 客户端传入的 `organizationId`、`tenantId` 或 `projectId` 只是资源定位输入，不能成为授权事实。
- 每个请求必须以服务端 Session、活动 Membership 状态和资源归属重新判定。
- B 只消费冻结后的 Project/Grant 上下文，不直接读取或修改 A 的 Membership 事实。
- 尚未冻结的业务值不得以“临时默认值”写进 Schema 或生产代码。

## 3. 备选方案

### 方案 A：继续以 Tenant 为唯一组织

在 `tenants` 增加类型和父级字段，让平台、代理商和企业都伪装成 Tenant。

**优点：** 改动最少，现有 Session 和 Repository 可快速复用。

**缺点：** 平台、渠道和企业语义混淆；现有大量 `tenant_id` 会同时承担授权域、商业归属和组织节点，后续邀请、归因、佣金与审计容易产生不可逆耦合。

**结论：** 拒绝。

### 方案 B：Organization 统一单表，废弃 Tenant

所有平台、渠道、企业都写入 `organizations`，现有 `tenants` 和所有 `tenant_id` 立即迁移为 `organization_id`。

**优点：** 长期概念统一。

**缺点：** 对现有 Pilot、项目链、Package/Grant 合同和跨平面实现破坏过大；回滚复杂，不符合增量演进要求。

**结论：** 当前阶段拒绝；可作为长期重构候选。

### 方案 C：Organization 为授权根，Tenant/Channel 为类型扩展（推荐）

新增统一 `organizations` 作为 Membership 与组织层级的授权根；保留 `tenants` 作为企业业务域和现有项目外键，新增 `channels` 作为代理业务扩展。Tenant/Channel 与 Organization 一对一关联。

**优点：** 能表达平台、代理、企业统一 Membership；保留现有 Pilot 和跨平面 Tenant 合同；支持分阶段回填和双读验证；回滚边界清晰。

**代价：** 兼容期需要同时维护 `organization_id` 与 `tenant_id` 的一致性；Repository 必须通过 Policy 层消除调用方自行拼 Scope 的风险。

**结论：** 推荐，待 C0/产品会签后接受。

## 4. 推荐决策

### 4.1 组织模型

采用“授权根 + 类型扩展”模型：

```text
Organization
- organizationId
- organizationType: PLATFORM | CHANNEL | TENANT
- displayName
- status: active | suspended | archived
- parentOrganizationId: nullable
- createdAt / updatedAt

Channel（Organization type = CHANNEL 的扩展）
- channelId
- organizationId
- business metadata: TBD

Tenant（保留现有业务实体）
- tenantId
- organizationId
- displayName
- status
- existing business fields
```

冻结规则：

1. 每个 Tenant 对应且只对应一个 `TENANT` Organization。
2. 每个 Channel 对应且只对应一个 `CHANNEL` Organization。
3. Platform Organization 是否数据库层强制唯一：`TBD`；在确认前由 bootstrap/config fail closed，不写死不可逆唯一规则。
4. `parentOrganizationId` 只表达组织树，不自动授予访问权限。
5. Channel 层级深度、总代理/一级/二级代理的编码和价格差异：`TBD`；本 ADR 不将层级数量写死为角色码或列。
6. Tenant 与 Channel 的服务/归因关系应由版本化关系或归因域表达，不能只依赖可任意改写的 `parentOrganizationId`；具体模型在 A-BIZ-00.3 冻结。

### 4.2 Membership 与角色

Membership 改为绑定 Organization：

```text
Membership
- membershipId
- userId
- organizationId
- status: active | suspended | expired
- version
- createdAt / updatedAt

MembershipRole
- membershipId
- roleCode
```

推荐角色语义：

| Role | 组织类型 | 能力边界 |
|---|---|---|
| `platform_admin` | PLATFORM | 平台级组织、渠道和全局运营能力；具体敏感动作仍需 Permission |
| `channel_admin` | CHANNEL | 管理自身 Channel 业务范围；不得自动读取其他 Channel |
| `tenant_admin` | TENANT | 管理本 Tenant 成员、业务资料、项目与被授予的商业能力 |
| `content_operator` | TENANT | 使用统一创作工作台，只访问被授权项目；无成员、充值、佣金、渠道管理权限 |
| `pilot_support` | TBD | 现有 Pilot 兼容/内部支持；是否保留及具体组织范围必须单独会签 |

冻结的安全规则：

- Permission 由服务端 Role/Policy 映射产生，前端菜单不能定义权限。
- 组织树关系本身不等于 Membership，也不自动产生 Permission。
- 一名自然人是否允许同时拥有多个 Organization Membership：`TBD`。
- 一个 Membership 是否允许多个 Role：`TBD`。Schema 草图应可支持多角色，但首轮 API 可在会签后施加更窄约束。
- 未知角色、停用/过期 Membership、角色集合为空均 fail closed。

### 4.3 Session 与活动组织上下文

采用“身份 Session + 单一活动 Membership 上下文”：

```text
AuthSession
- sessionId
- userId
- activeMembershipId
- activeOrganizationId（可冗余校验）
- membershipVersion
- expiresAt / rotationDueAt / revokedAt

PublicSession
- user
- activeContext { membershipId, organizationId, organizationType, roles }
- availableContexts: 摘要是否返回 TBD
```

请求授权流程：

1. Cookie Token 解析为服务端 Session。
2. 根据 `activeMembershipId` 重新读取 User、Organization、Membership 和 Role 状态。
3. 校验 Session 中的 `userId`、`activeOrganizationId`、`membershipVersion` 与数据库事实一致。
4. 生成只在本请求有效的 `ActorContext`，客户端字段不得覆盖它。
5. 任一步缺失、停用、过期、版本不一致或组织类型不匹配，Session/Context 失效并 fail closed。

组织切换约束：

- 切换目标必须来自当前用户可用且 active 的 Membership，不能只接受任意 `organizationId`。
- 切换成功时必须创建或轮换 Session Token，旧上下文不得继续用于写请求。
- 是否允许多组织和如何选择默认组织，取决于“一人多组织”业务结论，当前为 `TBD`。
- 默认组织只能由服务端稳定策略决定；客户端 `returnTo` 仍需通过目标 Context 的 route/scope 校验。

### 4.4 Actor 与授权 Policy

后端统一生成：

```text
ActorContext
- userId
- sessionId
- membershipId
- organizationId
- organizationType
- roles
- tenantId: 仅 TENANT Context 可有
- membershipVersion
```

Repository 不再接受调用方自行构造的宽泛 `tenantId + roles`。Route/Service 先调用统一 Policy，再将受限 Scope 传给 Repository。

推荐 Policy 判断顺序：

1. Authentication：Session 是否有效。
2. Active Context：User、Organization、Membership 是否 active 且一致。
3. Permission：角色是否具备目标动作。
4. Resource Scope：目标 Organization/Tenant/Project 是否属于该 Actor 可见范围。
5. Resource State：资源业务状态是否允许该动作。

### 4.5 Project Scope

引入项目授权事实，具体表名可在 migration 评审时确定：

```text
ProjectAssignment（草图）
- projectAssignmentId
- projectId
- membershipId
- accessLevel: viewer | editor（最终枚举 TBD）
- status
- createdBy
- createdAt / updatedAt
```

冻结矩阵：

| Actor | Project 列表/读取 | Project 创建/管理 | Brief/Script/Storyboard/Canvas | 成员/充值/佣金 |
|---|---|---|---|---|
| `tenant_admin` | 本 Tenant 全部项目 | 本 Tenant，允许 | 本 Tenant 全部项目，允许 | 按对应 Permission 允许 |
| `content_operator` | 仅 active Assignment 项目 | 默认拒绝；是否可创建项目 `TBD` | 仅 active Assignment 且满足动作级别 | 始终拒绝 |
| `channel_admin` | 仅经显式业务 Permission 和 Scope 授予；默认拒绝内容正文 | 默认拒绝 | 默认拒绝 | 仅自身 Channel 商业范围 |
| `platform_admin` | 管理面默认只读元数据；读取内容正文需独立高敏 Permission | 默认拒绝代替 Tenant 创作 | 默认拒绝 | 平台运营 Permission 范围 |
| `pilot_support` | `TBD`，默认无跨 Tenant 内容权限 | 默认拒绝 | 默认拒绝 | 默认拒绝 |

额外规则：

- `content_operator` 不得继续因角色码而获得 Tenant 全项目权限。
- Assignment 不得跨 Tenant：Project 所属 Tenant Organization 必须与 Membership Organization 一致。
- Tenant Admin 的“全项目”来自 Tenant 管理 Permission，不通过伪造 Assignment 实现。
- B 侧拿到的 Project/Grant 上下文必须来自 A 已授权结果，不能以画布路由参数扩大 Scope。

## 5. HTTP 拒绝语义

| 场景 | 状态 | 推荐错误码 | 说明 |
|---|---:|---|---|
| 无 Session Cookie | 401 | `AUTHENTICATION_REQUIRED` | 未认证 |
| Token 无效、过期、撤销或活动 Membership 失效 | 401 | `SESSION_INVALID` / `ACTIVE_CONTEXT_INVALID` | 清理 Cookie，重新登录/选上下文 |
| 已认证且资源属于当前可见 Scope，但缺少动作 Permission | 403 | `PERMISSION_DENIED` | 可安全确认资源类别时返回 |
| 请求资源不在活动 Organization/Tenant/Project Scope | 404 | 资源统一 Not Found | 避免泄漏资源是否存在 |
| Project Assignment 不存在或停用 | 404 | `PROJECT_NOT_FOUND` | 对工作人员隐藏未授权项目 |
| 客户端组织参数与活动上下文不一致 | 404 | 资源统一 Not Found | 不接受客户端切换 Scope |
| 切换到不存在/停用/不属于当前用户的 Membership | 404 | `CONTEXT_NOT_FOUND` | 防 Membership 枚举 |
| 已知动作因资源状态冲突 | 409 | 领域稳定错误码 | 例如已撤销审批、幂等 payload 冲突 |

不得通过不同响应时间、错误正文或资源计数泄漏其他组织数据。日志可记录内部判定原因，但面向客户端的错误必须稳定且不包含敏感标识。

## 6. API Route Manifest 草案

以下仅冻结授权类型，不承诺本切片立即实现路由：

| Route 类别 | 允许角色/Policy | Scope | 预期拒绝 |
|---|---|---|---|
| `POST /auth/login` | 匿名 | 账号可用上下文 | 401/429 |
| `GET /auth/session` | 有效 Session | Active Membership | 401 |
| `POST /auth/context/switch` | 已认证 | 目标 Membership 属于当前 User 且 active | 404/409 |
| `/platform/**` | `platform_admin` + 具体 Permission | Platform | 403/404 |
| `/channels/:channelId/**` | `channel_admin` 或平台显式 Permission | Active Channel/被授权范围 | 403/404 |
| `/tenants/:tenantId/members/**` | `tenant_admin` | Active Tenant | 403/404 |
| `/projects/**` | Tenant 项目 Permission | Active Tenant + Project Scope | 403/404 |
| `/projects/:projectId/briefs/**` | 项目读写 Permission | Project Scope | 403/404/409 |
| `/projects/:projectId/scripts/**` | 项目读写/审批 Permission | Project Scope | 403/404/409 |
| `/projects/:projectId/production/**` | 项目生产 Permission + Grant Policy | Project Scope | 403/404/409 |
| `/billing/**` | 独立商业 Permission | Active Organization/Owner | 403/404 |
| `/commissions/**` | 独立代理/平台 Permission | Attribution Scope | 403/404 |

正式实现时 Router、Service、Policy、Repository 和前端 route manifest 必须共享稳定 Permission key；不得在各层复制角色判断。

## 7. 正反 Fixture 与测试矩阵

### 7.1 正向 Fixture

1. `platform-admin-active`：平台管理员进入 Platform Context，只读取平台授权范围。
2. `channel-admin-own-channel`：代理管理员进入自己的 Channel，读取自身业务范围。
3. `tenant-admin-own-tenant`：企业老板进入自己的 Tenant，读取并管理 Tenant 全项目。
4. `content-operator-assigned-project`：工作人员只读取/编辑已授权项目并进入脚本、分镜和画布。
5. `same-user-context-switch`：若业务确认一人多组织，切换后旧 Token/旧 Context 不可继续写入。
6. `pilot-tenant-backfill`：现有白名单账号和 Tenant 回填后，登录、项目、审批、Package/Grant Gate 不回归。

### 7.2 负向 Fixture

1. 代理 A 查询代理 B。
2. 代理查询不在其归因/服务范围内的 Tenant。
3. Tenant Admin 查询或修改其他 Tenant。
4. Content Operator 管理成员、充值、佣金或组织关系。
5. Content Operator 列出、读取或修改未授权项目。
6. 客户端伪造 `organizationId` / `tenantId` / `projectId`。
7. Membership 在 Session 存续期间被 suspended/expired。
8. User 或 Organization 在 Session 存续期间被 suspended。
9. Session Active Context 与请求 Scope 不一致。
10. Membership Role/Version 改变后重放旧 Token。
11. Assignment 跨 Tenant 或被停用后重放写请求。
12. 枚举不存在与存在但越权的资源，两者外部响应保持同类 404。

### 7.3 必须覆盖的测试层

- Migration：回填、唯一约束、外键、跨组织负例、down/rollback 条件。
- Repository：Actor Scope 不能跨 Organization/Tenant/Project。
- Policy：角色、Permission、活动状态和资源范围笛卡尔矩阵。
- Auth：Session rotation、Context switch、停用 Membership、并发旧 Token。
- Route：401/403/404/409 稳定错误合同。
- E2E：老板统一工作台、工作人员被授权项目、直接 URL 越权、安全回跳。
- Cross-plane：A 授权 Project/Grant 与 B 消费上下文一致，错误项目不得回退到 canonical 项目。

## 8. Migration `006+` 草图（仅设计，不执行）

推荐分拆，最终编号由合入时决定：

### 006A · Organization 骨架与兼容回填

- 新增 `organizations`。
- 为现有每个 `tenant` 创建同 UUID 或确定性映射的 `TENANT` Organization；具体 ID 策略在迁移评审冻结。
- `tenants` 新增 nullable `organization_id`，完成回填与一致性校验后再设 NOT NULL/UNIQUE。
- 新增 `channels` 扩展表，但不写死代理层级和价格规则。
- 创建 Platform Organization 的 bootstrap 策略；数据库唯一约束是否启用保持 `TBD`。

### 006B · Organization Membership 与角色

- 新增 organization-based Membership/Role 表，或对现有表执行可回滚演进；最终选择需以零停机和 down migration 评审决定。
- 将现有 Tenant Membership 回填到对应 Tenant Organization。
- 保留旧 `memberships.tenant_id` 双读/双写兼容窗口。
- 加入 active lookup、`user_id + organization_id`、role lookup 索引。
- 在切流前验证每条旧 Membership 恰好映射一个 Organization Membership。

### 006C · Session Active Context

- `auth_sessions` 增加 nullable `active_membership_id`、`active_organization_id`、`membership_version`。
- 用现有 `user_id + tenant_id` 回填唯一活动 Membership。
- 双读期仍保留 `tenant_id`；新 Session 必须同时写入并校验两套字段。
- 多 Membership 用户在默认策略未冻结前不得静默选取，必须 fail closed 或进入显式选择流程。

### 006D · Project Assignment 与 Policy 切流

- 新增 Project Assignment 表和跨 Tenant 一致性约束。
- Tenant Admin 继续通过管理 Permission 访问全项目；Content Operator 必须有 Assignment。
- 兼容回填策略 `TBD`：不能自动把现有所有 Content Operator 永久授权给全部项目，需由业务确认一次性回填范围。
- Policy 与 Repository 双重验证通过后，移除旧“只看 role + actor.tenantId”的写权限路径。

### 006E · 清理（后续独立 migration）

仅在以下证据齐全后执行：

- 所有 Session 已迁移或自然过期；
- 双读一致性零差异；
- 完整 PostgreSQL、Auth、Project、Production 和跨平面 Gate 通过；
- 回滚窗口关闭并经 C0 会签。

清理内容可能包括旧 Tenant-only Membership 字段、旧 Session `tenant_id` 直连和兼容 Policy；具体删除项不得提前写入 006A-D。

## 9. 发布与回滚策略

### 9.1 分阶段发布

1. 仅加表/nullable 字段和索引。
2. 回填现有 Pilot 数据并运行只读一致性审计。
3. 服务端双写新旧模型，读取仍以旧模型为主。
4. Shadow Policy 对比新旧授权结果，不影响响应。
5. 对白名单启用新 Active Context 和 Project Scope。
6. 新模型成为事实源，旧字段只读。
7. 经过稳定窗口后另起 migration 清理旧结构。

### 9.2 回滚条件

出现任一情况立即停止切流并回到上一阶段：

- 现有白名单账号无法登录或项目/审批链回归；
- 新旧 Membership/Scope 判定不一致且无法解释；
- 任何跨 Tenant/Channel 数据可见或可写；
- Session 切换后旧 Context 仍可写；
- Content Operator 获得未授权项目或商业管理权限；
- Production Package/Grant 的 Tenant/Project 绑定发生变化；
- 完整 PostgreSQL Gate、合同 Gate 或 B receiver Gate 失败。

在旧字段删除前，回滚通过关闭新 Policy feature flag、恢复旧读路径并保留新表审计数据完成。旧字段删除后不再承诺在线回滚，必须走备份恢复和新 migration，因此清理必须独立会签。

## 10. 影响

### 正面影响

- 平台、代理、企业和工作人员拥有统一且可审计的服务端授权根。
- 统一工作台可以复用同一账号体验，同时保持成员、商业和项目权限隔离。
- `content_operator` 从 Tenant 全项目权限收紧到显式 Project Scope。
- 现有 Tenant/Package/Grant 合同可继续工作，减少对 B 的破坏性影响。

### 成本与风险

- 兼容期需要双写、Shadow Policy 和一致性审计。
- 多组织默认选择、角色组合和历史 Content Operator 回填未冻结前不能完成最终 Schema 约束。
- Platform/Channel 内容访问需要额外高敏 Permission 设计，不能因管理员身份自动放开。
- 组织树、邀请归因和佣金服务范围不是同一概念，后续 ADR 必须避免复用一个父子字段承载全部业务语义。

## 11. 待会签决策（TBD）

本 ADR 接受前必须明确或明确延期：

1. 是否允许一人多 Organization；若允许，登录后的默认 Context 选择顺序。
2. 一个 Membership 是否允许多角色，角色冲突如何处理。
3. `pilot_support` 是否保留、属于何种 Organization、是否允许临时提权。
4. Content Operator 是否可创建项目，以及 Assignment 的 `viewer/editor` 最终枚举。
5. 现有 Content Operator 项目授权的安全回填清单。
6. Platform Organization 是否强制全局唯一。
7. Channel 层级是否固定，以及总代理/一级/二级代理是组织属性、关系类型还是产品策略。
8. `availableContexts` 是否随 Session 响应返回；若返回，字段最小化与分页策略。

以下问题转入 A-BIZ-00.3，本 ADR 不作决定：C 端注册 Tenant 归属；邀请有效期/次数/改绑/保护期；用户须知发布与再次同意；支付、额度换算；佣金、冲正、税务、提现和 KYC。

## 12. 验收与下一步

本 ADR 的完成标准：

- C0、产品/业务负责人和 B 对组织/Session/Project Scope 边界完成会签；
- 第 11 节问题具有明确答案或明确延期及 fail-closed 行为；
- 正反 fixture、错误语义、Route Manifest 和 migration 草图被接受；
- 未创建 migration `006`，未修改业务代码，未触碰 B 独占目录。

会签后下一切片为 A-BIZ-00.3；只有 Wave 0 冻结完成后，才进入 A-BIZ-01.1 的 test-first migration `006+`。
