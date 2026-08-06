# A 业务平台线 · 最新 Main 重规划（2026-08-06）

> 基线：`main@705a134`（与 `origin/main` 一致）
> 当前执行依据：`docs/collaboration/A_B_CO_CREATION_SPLIT_2026-08-06.md`
> 负责人：工程师 A（业务平台）
> 计划状态：`IN_PROGRESS / WAVE_0_ADRS_PROPOSED / WAITING_FOR_BUSINESS_SIGN_OFF`
> 推荐开发分支：`dev/business-plane`

## 1. 为什么必须重规划

相对 A-04 旧基线，本次上游已引入真实 Pilot 控制平面、PostgreSQL、真实白名单认证、内容审批、Production Package/Grant、StoryCanvas v0.2 Receiver 和跨平面 Gate。A 的职责也已由“D2 Mock 控制平面”升级为“业务平台事实源”。

新的 A 范围包括：

- 统一企业创作工作台；
- 多组织、成员、角色和服务端授权；
- 平台邀请、代理邀请和 C 端直接注册；
- 版本化用户须知与同意证据；
- 充值、支付事件、代理归因、佣金计提/冲正；
- 对应前端、审计、运营和安全 E2E。

因此旧 A-05 中“公开注册、支付、渠道分销、复杂 RBAC 暂不做”的范围，已被 2026-08-06 最新老板决策更新。不能直接沿用旧 A-05 实施顺序，也不能从 migration `006` 直接写死尚未冻结的业务规则。

## 2. 最新代码基线审计

### 2.1 已具备

- `apps/control-api/`：Express + TypeScript + Knex + PostgreSQL；
- 白名单登录、scrypt 密码哈希、HttpOnly/SameSite Session、轮换与撤销；
- 当前角色：`tenant_admin`、`content_operator`、`pilot_support`；
- Project / BriefVersion / ScriptVersion / Approval；
- Production Package、ProjectGrant、签名、撤销、过期和内部 introspection；
- 根前端 Demo/Pilot 显式模式与 Pilot 登录 Adapter/Store；
- StoryCanvas v0.2 Package/Grant/Command/Receipt 持久化 Receiver；
- v0.2 合同、fixture、错误码与跨平面 Gate。

### 2.2 仍缺失

当前 Control API 仍是单 Tenant 登录身份：

- `LoginIdentity` 只包含一个 `tenantId`；
- 一个用户跨 Tenant 时，当前 `groupIdentity()` 无法形成有效身份；
- 没有 Organization/Channel 多上下文选择；
- 没有 registrations、invitations、terms、billing、commissions、members API；
- 前端除 Pilot 登录外，项目和商业页面仍大量依赖 Demo Mock/LocalStorage；
- 统一工作台目前主要是 Demo 权限体验，尚未成为真实 Pilot 服务端授权闭环。

结论：A-BIZ-01 不能只改菜单。必须先冻结并实现多组织 Session/RBAC，再让 Router、Sidebar、默认路由和服务端权限使用同一份授权语义。

## 3. 2026-08-06 本机 Gate 结果

| Gate | 结果 | 说明 |
| --- | --- | --- |
| Root Test（单 worker） | `30 files / 195 tests PASS` | 标准并发全量曾出现 16 个超时/交互失败；同一批定向 26/26、全量单 worker 195/195 通过，属于并发负载问题 |
| Root Build | PASS | 仅既有 Vite 大 chunk warning |
| Governance | PASS | 无治理缺口 |
| `git diff --check` | PASS | 工作树只有 B 运行时未跟踪文件 |
| Control API typecheck/build | PASS | 安装锁定依赖后通过 |
| Control API Test | `14 files / 57 tests PASS / 0 SKIP` | 已使用 PostgreSQL 16.14 和专用 `_test` 数据库恢复完整 Gate；两个 PostgreSQL suite 共用 schema，当前本机基线使用单 worker 串行执行 |
| Q1 canonical runner | `9/10 PASS` | StoryCanvas 自带 `tsx 4.21.0` + 当前 Node 22 的 `--test` 命名导出兼容问题 |
| Q1 临时兼容 runner | `10/10 PASS` | 仅改用 `tsx 4.23.6`，不改业务代码；证明合同与 A/B 实现本身通过 |

### 当前环境/集成事项

1. 统一 Root Gate 应使用单 worker，或由共享测试维护者调整并发/timeout，避免把机器负载误报为功能回归。
2. Q1 runner 应由共享 Gate/B 负责人独立修复：升级 StoryCanvas `tsx` 或让 runner 显式选择兼容版本。A 不直接修改 `apps/storycanvas/**`。
3. 专用 PostgreSQL 测试库已就绪并取得 Control API 57/57；后续数据库切片继续使用 `_test` 数据库和单 worker Gate，不把并发重建同一 schema 的竞争误报为业务回归。
4. `apps/storycanvas/data/vendor/byteplus.ts` 是 B 运行时生成的未跟踪文件；A 不修改、不删除、不暂存、不提交。

## 4. 总体实施原则

1. **先冻结业务口径，再写不可逆 Schema。**
2. **先服务端授权，再统一前端体验。** 前端隐藏菜单不是权限控制。
3. **先用户须知，再开放注册。** 没有已发布版本时注册必须 fail closed。
4. **充值、佣金、AI 额度三账分离。** 金额用整数分和明确币种，历史只追加不覆盖。
5. **跨平面先合同后实现。** ADR、Schema、正反 fixture、错误码、幂等语义先行。
6. **Demo/Pilot 继续隔离。** 不允许 LocalStorage 冒充 Pilot 事实源。
7. **一个切片一个提交。** 禁止 `git add .`；共享文件必须独立提交并通知 B。
8. **A 严守文件边界。** 不修改 StoryCanvas、Storyboard、Script Editor 等 B 独占目录。

## 5. 分阶段计划

## Wave 0 · 基线稳定与业务冻结

目标：在不写死业务规则的前提下，把 A 线的模型、权限和联合接口冻结到可开发状态。

### A-BIZ-00.1 · 开发基线与 Gate 固化

- 从最新 `main@705a134` 创建 `dev/business-plane`；
- 保持 B 未跟踪运行时文件完全排除；
- 配置专用 PostgreSQL 测试库，恢复 Control API 57/57；
- 记录 Root 单 worker 195/195、Build、Governance、diff-check；
- 将 Q1 `tsx` 兼容问题提交给共享 Gate/B 负责人，不夹带 A 业务代码修复。

建议提交：

```text
docs(business-plane): establish latest main baseline
```

### A-BIZ-00.2 · 权限与组织 ADR

冻结：

- Platform、Channel、Tenant、个人 Tenant、User、Membership、Role、Permission；
- 一个自然人是否允许多组织、多角色；
- Session 中保存“全部成员关系”还是“当前活动组织上下文”；
- 上下文切换、默认组织、安全回跳、跨组织 404/403 语义；
- `tenant_admin` 与 `content_operator` 的项目级读写矩阵。

产物：权限矩阵、正反 fixture、API route manifest、迁移 `006+` 草图、回滚策略。

### A-BIZ-00.3 · 注册、归因、须知和账务 ADR

冻结：

- C 端注册后创建个人 Tenant，还是加入企业 Tenant；
- 邀请有效期、次数、撤销、重放、改绑和归因保护期；
- 用户须知发布人、生效时间、再次同意策略；
- 支付渠道、最低金额、退款周期、额度换算；
- 佣金比例、计算基数、规则版本、冲正、结算、税务/KYC 边界。

未冻结字段只写为 `TBD` 决策项，不写占位业务规则、不伪造正式用户须知。

**Wave 0 验收：** ADR 会签；权限矩阵、Schema 草图、fixture、错误码、幂等表和测试计划齐全；无业务代码越界。

## Wave 1 · A-BIZ-02 + A-BIZ-01：真实权限底座与统一工作台

建议先后端后前端，按以下切片推进：

### A-BIZ-01.1 · 多组织模型测试与 migrations 006+

- Test-first 定义 Organization/Channel/Tenant/Membership/Role；
- 迁移只增加，不破坏现有 Pilot 单 Tenant 数据；
- 提供旧白名单账号的可回滚数据迁移；
- 唯一约束、外键、状态机和跨组织隔离测试。

### A-BIZ-01.2 · 多上下文 Session 与认证

- 登录返回可授权的组织上下文集合；
- Session 保存当前活动上下文及可验证的 Membership 版本；
- 组织切换必须重新校验 Membership 状态；
- 停用用户/成员、撤销 Session、轮换、并发请求全部 fail closed；
- 跨组织资源不泄漏存在性。

### A-BIZ-01.3 · 服务端 RBAC/Project Scope

- 平台、代理、企业老板、内容工作人员的中间件和策略测试；
- `content_operator` 只能访问被授权项目；
- 成员、充值、提成、渠道和平台 API 返回稳定拒绝；
- Project/Brief/Script/Approval 迁移到统一 Actor/Context。

### A-BIZ-01.4 · 统一企业创作工作台

- 统一 Router、Sidebar、WorkbenchSwitcher、默认路由、安全回跳、403；
- `tenant_admin`：业务管理 + 内容生产；
- `content_operator`：内容生产 + 被授权项目，不显示/不可直达高权限入口；
- 企业老板默认仍进入海底捞品牌大脑；
- 共享 `Router.tsx`、`layouts/**` 改动单独提交并通知 B；
- 不修改 B 的 StoryCanvas/Storyboard/Script Editor 页面，只提供 route manifest 和项目上下文。

### A-BIZ-01.5 · 权限联合 E2E

覆盖：未登录、合法登录、多组织切换、停用成员、错误 Tenant/Project、直接 URL 越权、Session 过期、工作台默认落点和同账号进入脚本/分镜/画布。

**Wave 1 验收：** 同一老板账号无需退出/换身份即可进入业务与创作；工作人员可创作但服务端拒绝商业/管理权限；Demo/Pilot 不串数据。

## Wave 2 · A-BIZ-04 + A-BIZ-03：须知、邀请与三路注册

顺序必须是“须知 → 邀请 → 注册”。

### A-BIZ-02.1 · Terms 版本与发布

- `TermsDocument`、`TermsVersion`、`UserConsent`；
- DRAFT 可编辑，PUBLISHED 不可原地修改；
- Public current terms 只返回当前发布版本；
- 没有 PUBLISHED 版本时注册 fail closed；
- 同意证据保存版本、正文 digest、时间、场景和必要审计字段。

### A-BIZ-02.2 · 邀请生命周期

- 平台邀请、代理邀请、分享链接；
- Token 只存 digest；
- 创建、预览、使用、撤销、过期、限次和冲突；
- 不允许平台/代理设置或查看用户密码；
- 防枚举、限流、审计和幂等。

### A-BIZ-02.3 · 三路注册与冻结归因

- 平台邀请注册；
- 代理邀请注册；
- C 端直接注册；
- 单事务写入 User、Tenant/Membership、Consent、Invitation usage 和 ReferralAttribution；
- 同 payload 重放返回原结果，不同 payload 冲突；
- 归因不可由前端参数任意改绑。

### A-BIZ-02.4 · 注册/邀请/须知前端

覆盖正常、无条款、未勾选、版本过期、Token 过期/撤销/超限、重复提交、账号已存在和账号停用状态。

**Wave 2 验收：** 三条注册路径归因正确且不可伪造；须知证据可审计；敏感 Token/密码不进入日志或响应。

## Wave 3 · A-BIZ-05：充值、支付事件与佣金账

### A-BIZ-03.1 · 三账模型与测试支付 Adapter

- RechargeOrder、PaymentEvent、Credit Ledger、CommissionRuleVersion；
- 真实支付未冻结前只启用明确标记的测试 Adapter；
- 金额使用整数分 + currency；
- 支付事件签名/原始敏感字段不进入普通日志。

### A-BIZ-03.2 · 幂等到账与额度

- 支付成功事件重放不重复到账、不重复加额度；
- 订单状态与 PaymentEvent append-only；
- 失败、超时、重复、乱序事件有稳定语义。

### A-BIZ-03.3 · 佣金计提、冲正与结算快照

- 归因和规则版本冻结到 Accrual 快照；
- 退款、撤单、拒付使用 Reversal，不删除历史；
- 平台看全局、代理只看归因范围、用户只看自己的充值结果；
- 未冻结提现/KYC 前不自动打款。

### A-BIZ-03.4 · 商业前端与审计

- 充值记录、退款状态、佣金明细、冲正、结算状态；
- 人工处理入口、导出和审计说明；
- 所有金额页面与 AI 额度页面明确分离。

**Wave 3 验收：** 重放零重复、退款可审计冲正、跨代理/跨 Tenant 数据隔离、测试支付不冒充真实到账。

## Wave 4 · A-BIZ-06：运营收口与 A/B 联合 Gate

- 成员、邀请、须知、注册、充值、佣金完整空/错/停用状态；
- 与 B 的项目上下文、批准脚本、分镜草案和画布入口接线；
- 海底捞白名单黄金路径；
- 未登录、越权、跨组织、幂等冲突、敏感信息泄漏和失败恢复 E2E；
- 数据迁移/回滚、运营说明、README、STATUS/HANDOFF/CHANGELOG；
- Root、Control API PostgreSQL、合同、StoryCanvas 定向、Build、Governance、diff-check 联合 Gate。

## 6. 每步 Git 纪律

推荐长期分支：

```text
main
├── dev/business-plane
└── dev/canvas-plane
```

执行规则：

1. 每个切片先写失败测试，再做最小实现，转绿后提交；
2. Migration、Repository/Service、API、前端、共享 Router、文档尽量分开提交；
3. 共享文件提交必须小而独立，并在提交前通知 B；
4. 显式 `git add <A 范围文件>`，禁止 `git add .`；
5. 每次提交前检查：

```bash
git status --short
git diff --check
npm run validate:governance
```

6. 数据库切片必须额外执行 Control API PostgreSQL 全量测试；
7. 集成前以最新 `origin/main` 建短期集成分支，不把 B 分支直接合入 A 长期分支。

## 7. 开工前必须由会议/负责人确认的六项

1. 老板与工作人员权限矩阵；是否一人多组织、多角色；
2. C 端注册后的 Tenant 归属；
3. 邀请有效期、次数、改绑和归因保护期；
4. 支付渠道、最低金额、退款周期和额度换算；
5. 佣金比例、基数、周期、冲正、税务、提现、KYC；
6. 用户须知正文、发布人、生效和再次同意策略。

## 8. 建议立即执行的下一步

现在不要直接写 migration `006`。建议下一步只做：

1. 用户确认本计划；
2. 从 `main@705a134` 创建 `dev/business-plane`；
3. 完成 A-BIZ-00.1 基线提交；
4. 产出 A-BIZ-00.2 权限/组织 ADR 与矩阵草案；
5. 带六项待冻结问题参加共创会议；
6. 冻结后再进入真实 Schema 和 Session 改造。
