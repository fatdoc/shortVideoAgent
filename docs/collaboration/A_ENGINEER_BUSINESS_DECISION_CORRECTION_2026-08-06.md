# 给工程师 A：企业/个人统一模型纠偏决策

> 日期：2026-08-06
> 状态：`APPROVED / EFFECTIVE_IMMEDIATELY`
> 适用任务：A-BIZ-01、A-BIZ-02、A-BIZ-03 及 Wave 0 ADR/migration `006+`
> 决策优先级：高于此前文档中“四类工作台”“三路注册”“C 端 Tenant 待决策”等冲突描述

> Wave 0 全部 P0/P1/P2 决策见 `A_ENGINEER_WAVE0_BOSS_DECISION_REPLY_2026-08-06.md`；本文只保留企业/个人统一模型的专项纠偏。

## 1. 纠偏结论

`P1-1 · C 端直接注册后属于什么组织` 正式选择原问题的 **A：自动创建个人 Tenant**；这里的“个人 Tenant”只是成员数为一的普通 Tenant，不是独立产品类型。该问题不再开放，也不得继续阻塞开发：

- 不存在独立的企业端用户模型和 C 端用户模型。
- 所有终端创作者统一使用 `User + Tenant + Membership + 统一创作工作台`。
- 直接注册成功时，在同一数据库事务中创建 User、单人 Tenant 和本人 `tenant_admin` Membership。
- 平台邀请和代理获客邀请默认也创建上述单人 Tenant；邀请信息只决定获客归因。
- 企业管理员邀请工作人员时，邀请绑定目标 Tenant；激活后加入该 Tenant 并获得指定 Membership，不再创建 Tenant。
- 单人 Tenant 后续补充企业/品牌资料或添加成员时，原地成长为多人企业 Tenant；不迁移账号、项目、品牌、素材、钱包或账本。
- 不新增 `consumer` Organization/Tenant 类型、C 端角色、C 端工作台、C 端 Router 或 C 端注册 API。
- 老板与 `content_operator` 共用统一创作工作台；权限仍由服务端 Membership、Role 和 Project Assignment 控制。

## 2. 注册与归因模型

公开端只有一个注册端点：

```text
POST /api/v1/public/registrations
```

注册来源只有以下枚举语义：

```text
DIRECT
PLATFORM_INVITATION
CHANNEL_INVITATION
TENANT_MEMBER_INVITATION
```

前三项是新 Tenant 获客来源；最后一项是加入已有 Tenant。它们不得被实现成企业版/C 端版两套注册流程。

## 3. Schema 与服务端约束

建议按以下不可变约束实现并测试：

1. 终端用户的生产数据隔离边界始终是 Tenant，不因是否填写企业资料而变化。
2. `Tenant` 不设置 `consumer`/`enterprise` 互斥产品类型；企业资料使用可选 Profile/字段表达。
3. 新 Tenant 创建者必须有且只有一个初始 `tenant_admin` Membership。
4. 直接注册的 User、Tenant、Membership、Consent 和 Attribution 必须同事务成功或同事务回滚。
5. `TENANT_MEMBER_INVITATION` 必须携带服务端可信的目标 Tenant，客户端提交的 tenantId 不能成为授权事实。
6. 邀请来源、直接来源一旦冻结，不允许通过前端参数改绑；纠错只能追加审计事件。
7. API、路由、数据库迁移和前端文案不得再出现“选择进入个人端或企业端”的分叉。

## 4. A 的立即执行项

- 从 Wave 0 ADR 中删除 `P1-1` 阻塞，并引用本决策。
- 将“企业 Tenant/个人 Tenant”统一成一个 Tenant Schema。
- 将“三路注册”改为“单一注册流程 + 三种获客来源 + 企业成员邀请”。
- 将企业客户工作台和媒体生产工作台合并为统一创作工作台。
- 开始 migration `006+`、Session/Membership Context 和注册事务设计；该项不再等待老板确认。

## 5. 验收标准

- 直接注册后无需第二次选择身份或组织即可进入统一创作工作台并创建项目。
- 注册事务可证明同时落库 User、Tenant、`tenant_admin` Membership、用户须知同意和来源归因。
- 添加企业资料和成员前后 Tenant ID、User ID、Project ID、资产及账本均不变化。
- 企业管理员邀请 `content_operator` 后，对方加入指定 Tenant；不能访问其他 Tenant，也不能获得成员、充值或佣金管理权限。
- 代码和对外页面中不存在独立 C 端注册 API、C 端工作台、`consumer` 角色或 `consumer` Tenant 类型。
- 直接、平台邀请、代理邀请三种获客来源走同一注册服务，归因不可由客户端伪造。

## 6. 仍需老板确认但不影响本决策的事项

多组织开放策略、Membership 多角色策略、`pilot_support`、工作人员能否创建项目、历史项目授权回填、邀请有效期、佣金比例、支付规则和正式用户须知文案仍按各自 Wave 处理；不得再用企业/C 端归属问题阻塞统一 Tenant 底座开发。
