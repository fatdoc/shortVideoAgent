# 租户与渠道模型 v0.1

> - Owner：C1 商业模式与租户渠道架构师
> - 状态：`PROPOSED · READY_FOR_C0_REVIEW`
> - 日期：2026-07-30
> - 目标 Gate：Program Gate T1
> - 适用范围：商业 SaaS 控制平面的组织、成员、角色、数据范围与渠道关系语义
> - 不包含：钱包/账本算法、真实价格/佣金/结算公式、StoryCanvas 实现、公共集成合同修改

## 1. 结论摘要

1. **Tenant 是购买并使用平台能力的数据隔离边界；ChannelOrganization 是销售或分销平台产品的组织节点。两者不得混用。**
2. **Brand、Store、Project 都是 Tenant 内业务对象，不是租户，也不进入渠道组织树。**
3. 首版渠道树最多三层渠道节点：`总代理 → 一级代理 → 二级代理`。Tenant 是客户叶子，不计入渠道层级；二级代理下不得再挂渠道组织。
4. 平台直销 Tenant 不强行挂到任何 ChannelOrganization；渠道客户通过有生效期的商业挂靠关系连接到唯一当前销售渠道。
5. 用户通过 Membership 加入 Platform、ChannelOrganization 或 Tenant；对 Brand、Store、Project 的权限通过 Membership 的数据范围表达，不再创建对象级“伪成员”。
6. 渠道祖先关系只自动带来**必要的商业可见性**，不自动获得客户脚本、素材、品牌事实等生产内容。代运营访问必须取得该 Tenant 的独立成员授权。
7. API 客户仍是 Tenant；平台 API Key 是受限机器凭证，不是新的租户类型，也不暴露上游供应商密钥。
8. 白标经营方建模为特殊 ChannelOrganization；其下游企业仍各自是 Tenant。换 Logo、域名或运营主体展示不产生额外代理层级，也不取消数据隔离和法定披露。
9. 渠道利益只能来自真实销售或使用。招募数量、无限层级和脱离交易的层级奖励均禁止。
10. 转移只改变生效期关系，不搬迁或重建 Tenant 数据；历史订单、用量与审计归属必须保留原快照。

## 2. 依据、优先级与事实/提案边界

### 2.1 权威依据

- `docs/program/PROJECT_CHARTER.md`
- `docs/program/COMMON_MEMORY.md`
- `docs/program/GLOSSARY.md`
- `docs/program/ARCHITECTURE.md`
- `docs/program/ROLE_BOUNDARIES.md`
- `docs/program/ROLE_WORKBENCHES.md`
- `docs/program/EMPLOYEE_RULES.md`
- `docs/program/REPOSITORY_MAP.md`
- `docs/program/INTEGRATION_CONTRACT.md`
- 原始 PRD v1.0 中的用户角色、FR-001 多租户与项目、FR-002 角色权限、FR-036 开放 API/Webhook
- 当前 SaaS Demo Gate 0—2 与统一项目 `demo-local-001`

### 2.2 已冻结事实

- 核心商品是“AI 视频额度”，不是上游 token。
- 品牌、门店、项目不是 Tenant。
- 首版最多支持总代理、一级代理、二级代理。
- 渠道收益来自真实销售或使用，不来自招募数量。
- StoryCanvas 不承担租户、渠道、钱包、套餐和结算。
- 上游 API Key 永不下发客户。
- 同一用户可以加入多个组织；切换组织后工作台、角色和数据范围同步变化。

### 2.3 本文提案

除上节已冻结事实外，本文的字段、状态、角色名、挂靠流程、白标边界和审批规则均为 `PROPOSED`，需 C0 审批，并由 C3/C4 会签后才能成为实现合同。

## 3. 概念模型

### 3.1 五个必须区分的对象

| 对象 | 定义 | 是否组织/隔离边界 | 上级关系 | 能否拥有成员 | 典型数据 |
|---|---|---|---|---|---|
| Tenant | 购买并使用平台能力的企业隔离组织 | 是；客户数据隔离边界 | 直销时关联 Platform；分销时关联一个当前 ChannelOrganization | 是 | Brand、Store、Project、成员、使用策略 |
| ChannelOrganization | 销售或分销平台产品的组织节点 | 是；渠道经营边界，但不是客户生产数据边界 | Platform 或上级 ChannelOrganization | 是 | 下级渠道、客户挂靠、销售关系、渠道成员 |
| Brand | Tenant 内的品牌/商家事实与规则集合 | 否 | 必须属于一个 Tenant | 否；由 Tenant Membership 的 scope 授权 | 品牌语调、事实、禁用词、视觉规则 |
| Store | Tenant 内的门店/经营地点 | 否 | 必须属于同一 Tenant 的一个 Brand | 否；由 Tenant Membership 的 scope 授权 | 地址、门店资料、门店运营人员范围 |
| Project | 一次视频生产工作的聚合根 | 否 | 必须属于一个 Tenant，引用同 Tenant 的 Brand，可引用零到多个 Store | 否；由 Tenant Membership 的 scope 授权 | Brief、脚本、分镜、任务、素材、成片 |

### 3.2 语义关系

```text
Platform
├── ChannelOrganization (0..n)
│   ├── child ChannelOrganization (0..n, depth <= 3)
│   └── current Tenant affiliation (0..n)
└── direct Tenant (0..n)

Tenant
├── Brand (1..n)
│   └── Store (0..n)
├── Project (0..n)
│   ├── exactly one Brand
│   └── zero to many Stores, all in the same Tenant
└── Membership (1..n)
```

### 3.3 核心不变量

1. 每个 Brand、Store、Project 必须且只能有一个 `tenantId`。
2. Store 的 Brand 与 Store 必须属于同一 Tenant。
3. Project 引用的 Brand、Store 必须与 Project 属于同一 Tenant。
4. Tenant 不得成为另一个 Tenant 的子节点；企业集团隔离方案见待决问题。
5. ChannelOrganization 不得持有客户生产内容。若渠道商自己使用生产能力，应建立与其法律主体关联但 ID 独立的 Tenant。
6. ChannelOrganization 只能有一个当前父节点；Tenant 只能有一个当前商业挂靠来源。
7. 历史父子关系和 Tenant 挂靠关系只追加有效期记录，不覆盖旧归属。
8. 用户跨组织的权限不合并；每次请求必须绑定一个明确的 active organization context。
9. 渠道祖先不能仅凭树关系读取 Tenant 生产内容。
10. API 机器身份不能替代人类 Membership 执行组织管理、合同转移或高风险审批。

## 4. 组织树与层级上限

### 4.1 标准分销树

```text
Platform
└── 总代理 ChannelOrganization · depth 1
    ├── 企业 Tenant（总代理直客）
    └── 一级代理 ChannelOrganization · depth 2
        ├── 企业 Tenant（一级代理直客）
        └── 二级代理 ChannelOrganization · depth 3
            └── 企业 Tenant（二级代理直客）
```

### 4.2 平台直销树

```text
Platform
└── 企业 Tenant（DIRECT，无 ChannelOrganization 挂靠）
    ├── Brand
    │   └── Store
    └── Project
```

### 4.3 白标树

```text
Platform
└── 白标经营方 ChannelOrganization
    ├── 可选下级渠道（仍受总层级 <= 3 约束）
    └── 下游企业 Tenant A / B / C（彼此隔离）
```

白标是渠道展示与运营模式，不是第四级渠道。白标经营方若已处于 depth 2 或 3，不能借白标身份突破深度上限。

### 4.4 层级校验规则

- ChannelOrganization 的 `depth` 只允许 `1..3`。
- `depth 1 = 总代理`，父级为 Platform。
- `depth 2 = 一级代理`，父级必须是 depth 1。
- `depth 3 = 二级代理`，父级必须是 depth 2。
- 首版不允许跳级创建、不允许同一节点多父、不允许跨树镜像节点。
- 新父节点不能是当前节点或其任何后代，禁止循环挂靠。
- 重挂后节点及其全部后代的最大 depth 仍必须小于等于 3。
- Tenant 是客户叶子，不计入渠道深度，不得再发展下级渠道。

## 5. 场景目录：六类场景、七条具名路径

任务书称“六类”但列出七个名称。为不遗漏需求，本文将 API 客户与白标归为第六类“外部交付”，并作为两个独立子模式描述。

### S1 · 平台直销

```text
Platform -> Tenant -> Brand -> Store -> Project
```

- 客户来源为 `DIRECT`，不存在当前渠道挂靠。
- 平台负责签约、开通、客户成功和商业关系。
- Tenant 数据仍按 Tenant 隔离；平台普通运营默认只看必要元数据。
- 后续转入渠道必须走 Tenant 挂靠转移，不新建 Tenant、不复制数据。

### S2 · 总代理直客

```text
Platform -> 总代理 -> Tenant
```

- 总代理是销售节点，Tenant 是使用节点。
- 总代理可看客户商业状态、已授权产品、汇总用量和服务状态；默认不能看脚本、素材、品牌事实。
- 总代理若代运营，相关人员还必须加入该 Tenant，并获得明确的 Brand/Store/Project scope。

### S3 · 一级代理直客

```text
Platform -> 总代理 -> 一级代理 -> Tenant
```

- 一级代理是 Tenant 的当前 seller/service channel。
- 总代理对下级商业数据具有汇总可见性，但不自动获得 Tenant 内容访问权。
- 订单/关系应保存 seller 与祖先路径快照，具体差价、结算由 C3 定义。

### S4 · 二级代理直客

```text
Platform -> 总代理 -> 一级代理 -> 二级代理 -> Tenant
```

- 二级代理可以服务企业客户，但默认不得创建下级 ChannelOrganization。
- Tenant 仍不是“三级代理的子账号”；它是独立隔离组织。
- 二级代理退出时，客户可转给一级代理、同级二级代理或平台直销，需保留历史归属。

### S5 · 企业内部分配

```text
Tenant
├── Owner/Admin（企业全局）
├── 市场/内容团队（Brand/Project scope）
├── 门店运营（Store scope）
└── 财务查看（usage/statement read-only）
```

- 企业分配是 Tenant 内的成员、角色、数据范围和业务使用权限分配，不创建子 Tenant。
- Tenant Owner/Admin 可把成员限定到 Brand、Store 或 Project。
- “部门”首版可作为成员分组/标签，不作为 ChannelOrganization。
- 企业额度分配只在本文定义“谁可申请、谁可批准、目标范围是什么”；余额变化、冻结、扣减和账本写法由 C3 定义。
- 独立法人子公司若需要法律、合同或数据隔离，应另建 Tenant；是否支持企业集团容器为待决问题。

### S6A · API 客户

```text
Platform/Channel -> Tenant(API enabled) -> Platform API Key -> scoped Project/Capability
```

- API 客户首先是 Tenant，API 只是交付渠道。
- 人类管理员通过 Tenant Membership 管理凭证；程序调用使用独立机器身份。
- Platform API Key 至少限定 tenant、capability、environment、expiry；按需再限定 project、IP allowlist、rate limit。
- API Key 永不包含上游供应商密钥，也不能读取其他 Tenant 数据。
- 服务多家无关联终端客户的 API 集成商不得把所有客户塞进一个共享 Tenant；应为每家客户建 Tenant，或转为 S6B 白标模式。

### S6B · 白标

```text
Platform -> WhiteLabel ChannelOrganization -> downstream Tenant(s)
```

- 白标经营方是带白标配置的 ChannelOrganization，不是超级 Tenant。
- 每个下游企业客户仍是独立 Tenant，拥有独立成员、数据、项目和凭证。
- 白标配置可影响域名、Logo、主题、客服入口和部分文案；不得隐藏法律要求的 AI 标识、隐私主体、服务责任或审计信息。
- 白标运营方默认只见渠道商业数据。访问下游客户生产内容仍需 Tenant 授权。
- 白标退出不得导致下游 Tenant 数据丢失；品牌切换、域名迁移、凭证轮换和客户通知必须有过渡方案。

## 6. 建议语义实体（供 C4 落模，不是公共合同）

### 6.1 ChannelOrganization

建议最小语义：

- `id`
- `legalEntityRef`
- `displayName`
- `tier`: `MASTER | LEVEL_1 | LEVEL_2`
- `parentChannelOrganizationId`（depth 1 为空）
- `depth`
- `status`
- `contractRef`
- `regionScope`
- `whiteLabelMode`
- `createdAt / activatedAt / suspendedAt / exitedAt`

### 6.2 Tenant

建议最小语义：

- `id`
- `legalEntityRef`
- `displayName`
- `acquisitionMode`: `DIRECT | CHANNEL | API_DIRECT | API_CHANNEL`
- `status`
- `dataRegion`
- `contractRef`
- `createdAt / activatedAt / suspendedAt / exitedAt`

`API` 与 `WHITE_LABEL` 不应成为破坏 Tenant 本质的组织类型：API 是能力/交付模式；白标是渠道经营模式。

### 6.3 TenantChannelAffiliation

建议用有生效期的关系对象表达，而不是把渠道 ID 永久写死在 Tenant：

- `tenantId`
- `channelOrganizationId`（直销时为空）
- `relationType`: `SELLER_OF_RECORD | SERVICE_CHANNEL`
- `effectiveFrom / effectiveTo`
- `status`
- `changeRequestId`
- `approvedBy`
- `reasonCode`

同一 Tenant 同一 relationType 在任一时刻最多一个 ACTIVE 关系。销售归属与服务归属是否允许分离，见待决问题。

### 6.4 Membership

```text
Membership
  userId
  organizationType = PLATFORM | CHANNEL | TENANT
  organizationId
  roleSet[]
  scopeSet[]
  status
  validFrom / validTo
  invitedBy / approvedBy
```

规则：

- 一个 User 可以有多个 Membership。
- Brand、Store、Project 不单独创建 Membership；由 Tenant Membership 的 scopeSet 引用。
- active organization context 切换后重新计算菜单、动作、数据范围和敏感字段。
- Membership 禁用后立即停止新访问；历史审计记录保留。
- 所有者退出前必须先转移 Owner 职责，避免孤儿 Tenant/ChannelOrganization。

### 6.5 机器身份

API Key/Service Principal 与 User/Membership 分开：

- 人类身份负责创建、轮换、禁用和审批。
- 机器身份只执行明确 scope 内动作。
- 机器身份不拥有渠道关系，不参与组织树，也不能成为 Tenant Owner。

## 7. 角色与权限模型

### 7.1 权限计算

```text
有效权限
= active organization context
∩ organization membership status
∩ role actions
∩ data scope
∩ purchased capability / entitlement
∩ object tenant boundary
- explicit deny / suspension / risk hold
```

执行顺序：先判 Tenant 边界，再判角色动作，再判 scope；任何祖先关系都不能绕过 Tenant 边界。显式拒绝、安全冻结和法律保全优先。

### 7.2 平台角色矩阵

图例：`M` 管理，`A` 审批/高风险动作，`E` 日常执行，`V` 只读，`—` 默认无权。

| 权限域 | 超级管理员 | 平台运营 | 产品管理员 | 平台财务 | 平台风控/审计 |
|---|---:|---:|---:|---:|---:|
| Platform 配置与平台成员 | M/A | — | — | — | V |
| ChannelOrganization 创建/停用/转移 | M/A | E | — | V | A/V |
| Tenant 开通/停用/转移 | M/A | E | — | V | A/V |
| 角色模板与权限策略 | M/A | V | — | — | A/V |
| 产品/Capability 配置 | A/V | V | M/E | V | V |
| 商业订单/对账元数据 | A/V | V | V | M/E | V |
| 客户生产内容 | break-glass | — | — | — | 仅合规调查、审计 |
| 上游供应商密钥 | 受限管理 | — | — | — | 仅审计元数据 |
| 全局审计与风险冻结 | A/V | V | V | V | M/A |

平台访问客户生产内容必须使用单独的 break-glass/support grant，说明原因、时限、范围并完整审计；超级管理员身份本身不等于日常内容可见。

### 7.3 渠道角色矩阵

| 权限域 | 渠道 Owner | 渠道 Admin | 渠道销售/客户成功 | 渠道财务查看 | 渠道分析员 |
|---|---:|---:|---:|---:|---:|
| 本组织资料与成员 | M/A | M/E | V | V | V |
| 创建允许层级内的下级渠道 | A | E | — | — | — |
| 下级渠道成员管理 | — | — | — | — | — |
| 企业客户邀约/开通申请 | A | E | E | — | — |
| Tenant 挂靠转移申请 | A | E | E | — | — |
| 渠道树商业汇总 | V | V | scope V | V | V |
| 客户订单/用量汇总 | V | V | scope V | V | V |
| 客户脚本/素材/品牌事实 | — | — | — | — | — |
| 可售产品/已分配 PriceBook | V | V | V | V | V |
| 上游成本/供应商密钥 | — | — | — | — | — |
| 白标外观配置（白标经营方） | A | E | — | — | — |

渠道成员不得直接管理下级渠道的成员；如需协作，应由下级渠道 Owner 邀请或通过平台审批的临时支持授权。

### 7.4 企业 Tenant 角色矩阵

| 权限域 | 企业 Owner | 企业 Admin | 市场负责人 | 内容运营 | 门店运营 | 财务查看 | 企业审核员 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tenant 资料/所有权 | M/A | E | V | V | scope V | V | V |
| 成员、角色与 scope | A | M/E | — | — | — | — | V |
| 套餐/剩余额度查看 | V | V | V | V | scope V | V | V |
| 额度分配申请/审批权限 | A | E | 申请 | 申请 | 申请 | V | V |
| Brand/Store 管理 | A | M/E | M/E | scope E | scope E | — | V |
| Project/Campaign 创建 | A | M/E | M/E | E | scope E | — | V |
| 脚本/分镜/素材/生成 | V/A | V/A | E/A | E | scope E | — | V |
| 成片业务审批/导出 | A | A | A | 提交 | 提交 | — | A/阻断 |
| 使用明细/对账 | V | V | scope V | own/scope V | own/scope V | V | V |
| Platform API Key 管理 | A | M/E | — | — | — | V | V |
| Tenant 挂靠转移同意 | A | — | — | — | — | V | V |

“额度分配”仅表示业务授权边界；任何账本动作、冻结扣减和金额/额度算法不在本规格内。

### 7.5 媒体生产角色矩阵

这些角色是 Tenant Membership 上的业务角色，不是 StoryCanvas 内另建组织。

| 动作 | 内容策划 | 脚本编辑 | 分镜师 | AI 视频操作员 | 剪辑师 | 内容审核员 |
|---|---:|---:|---:|---:|---:|---:|
| 读取 Brief/品牌规则 | V | V | V | V | V | V |
| 编辑 Brief/策略 | E | V | — | — | — | V |
| 编辑脚本 | E | E | V | V | V | V |
| 编辑分镜/引用 | V | V | E | E | V | V |
| 发起生成任务 | — | — | scope E | E | scope E | — |
| 编辑时间线/成片 | — | — | V | V | E | V |
| 内容 QA/阻断 | — | — | — | — | 提交 | A/E |
| 最终业务批准 | — | — | — | — | — | 仅在 Tenant 授权时 A |

最终业务批准仍由 Tenant Owner/Admin/市场负责人授予；媒体角色名称本身不自动获得企业级审批权。

### 7.6 API 机器身份矩阵

| 动作 | 默认 |
|---|---|
| 读取自身 Tenant 范围内允许的 Project/Task/Asset | scope 允许 |
| 创建 Project/生成任务 | 需 capability + action scope |
| 接收 Webhook/读取调用日志 | 需独立 scope |
| 创建下级 Tenant/ChannelOrganization | 禁止 |
| 管理人类成员/角色 | 禁止 |
| 转移 Tenant 挂靠 | 禁止 |
| 查看上游密钥、供应商成本、其他 Tenant 数据 | 禁止 |
| 绕过额度、风险或审批门禁 | 禁止 |

## 8. 数据可见范围

### 8.1 标准 scope

- `PLATFORM_GLOBAL`：平台全局；仅特定平台角色。
- `CHANNEL_SELF`：当前渠道组织。
- `CHANNEL_SUBTREE_COMMERCIAL`：当前渠道及后代的商业元数据。
- `TENANT_WIDE`：单个 Tenant 全部业务对象。
- `BRAND_SET`：指定 Brand 及其 Store/Project。
- `STORE_SET`：指定 Store 及关联 Project。
- `PROJECT_SET`：指定 Project。
- `OWN_RECORDS`：本人创建/负责记录。
- `SUPPORT_GRANT`：有时限、有原因、有审计的临时支持范围。

### 8.2 数据分类与默认可见性

| 数据类别 | 平台角色 | 渠道祖先 | 当前服务渠道 | Tenant 成员 | 白标经营方 |
|---|---|---|---|---|---|
| 组织目录/状态 | 按角色全局 | subtree | subtree | 本 Tenant | subtree |
| 客户商业状态/已购能力 | 运营/财务/风控 | 汇总 | 必要明细 | 本 Tenant | 按合同 |
| 汇总用量/服务状态 | 按角色 | 汇总 | 客户级汇总 | 按 scope | 按合同汇总 |
| Brand/Store/Project 元数据 | 默认最小化 | 不可见 | 仅受托服务时 | 按 scope | 默认不可见 |
| 脚本/素材/提示词/成片 | break-glass | 不可见 | 需 Tenant Membership | 按 scope | 需 Tenant Membership |
| 账单/对账 | 财务范围 | 自身与授权下级 | 自身客户范围 | Owner/Admin/Finance | 按合同 |
| 个人信息/授权证据 | 风控/授权人员 | 不可见 | 需专门授权 | 按职责最小化 | 默认不可见 |
| 上游密钥/供应商秘密 | 极少数平台角色 | 不可见 | 不可见 | 不可见 | 不可见 |

### 8.3 代运营例外

渠道商承担代运营时，使用“双身份”而不是扩大渠道树权限：

1. 渠道成员在 ChannelOrganization context 处理销售和客户成功。
2. 客户 Tenant Owner 邀请该人员加入 Tenant。
3. Tenant Membership 只授予约定 Brand/Store/Project 与有效期。
4. 合同结束即停用 Tenant Membership；渠道商业关系可继续存在。

这样可避免“能卖给客户”被错误等同于“能看客户全部内容”。

## 9. 渠道利益与归属边界

本节只定义归属原则，不定义钱包算法或真实结算公式。

1. 每笔订单/用量归属应保存下单时的 seller、渠道路径和合同快照。
2. 收益只能基于真实销售、采购差价或已确认使用，不基于招募人数、团队人头或无限代际。
3. Tenant 转移后：
   - 生效日前的历史交易保持原归属；
   - 生效日后的新交易使用新归属；
   - 在途订单、退款、续费和已预付额度如何切割由 C3 定义。
4. 上级渠道可见自身被授权的价格表与下游经营结果，不得看到平台供应商秘密。
5. 渠道层级深度与收益层级必须一致受限，不允许通过白标、API 客户、部门或“服务商”名称伪造额外层级。
6. 是否允许渠道既做 seller of record 又仅做 service channel，需 C0/C3/法务确认。

## 10. 挂靠、转移与退出规则

### 10.1 生命周期

建议 ChannelOrganization 与 Tenant 使用：

```text
DRAFT -> PENDING_REVIEW -> ACTIVE -> SUSPENDED
                                  \-> EXIT_PENDING -> EXITED
```

- `SUSPENDED`：停止新增高风险操作，但保留必要读取、导出、对账和申诉通道。
- `EXIT_PENDING`：禁止新发展下级/新开客户，处理转移、对账、数据导出和凭证轮换。
- `EXITED`：撤销在线权限，不物理删除历史关系、订单与审计。

### 10.2 新挂靠

- 校验法律主体、合同、渠道 tier、父级状态、区域/排他规则和层级上限。
- 同一法律主体重复创建 ChannelOrganization/Tenant 必须触发人工审查。
- Tenant 接受渠道挂靠前必须明确 seller/service 关系、数据可见性和服务责任。
- 新关系以 `effectiveFrom` 生效，禁止回填覆盖历史。

### 10.3 Tenant 转移

1. 由 Tenant Owner、当前渠道或平台发起。
2. 校验新渠道 ACTIVE、层级合法、区域/合同允许。
3. 获取 Tenant Owner 同意；争议/违约场景由平台与法务处理。
4. 设定未来生效时间和在途业务临时方案。
5. 关闭旧 affiliation，创建新 affiliation。
6. 保留 `tenantId`、成员、Brand、Store、Project 和生产数据不变。
7. 渠道代运营人员的 Tenant Membership 单独复核，不能随商业挂靠自动迁移。
8. 轮换相关 API Key、Webhook secret 和白标域名配置（如适用）。

### 10.4 ChannelOrganization 重挂

- 首版默认只允许 Platform 高权限角色执行。
- 禁止把节点挂到自身或后代。
- 必须连同完整子树做深度校验，重挂后最大 depth 不得超过 3。
- 子渠道和 Tenant 商业路径变更前必须完成通知、合同和在途交易评估。
- 为降低批量纠纷风险，商业 MVP 可先禁用“整棵子树转移”，仅支持逐节点审批。

### 10.5 渠道退出

- 进入 EXIT_PENDING 后停止新增下级、新开客户和新签长期承诺。
- 必须先处理所有子渠道与 Tenant：转上级、转同级合法节点或转平台直销。
- 完成对账、退款/争议清单、客户通知、代运营权限撤销和凭证轮换。
- 历史关系与审计保留，退出节点不可被新主体复用同一 ID。
- 如因风控立即停用，客户最小业务连续性由平台托管方案保障。

### 10.6 Tenant 退出

- 停止新项目/新生成，保留合理期限的读取、导出、对账和申诉能力。
- 处理 Owner 转移、成员撤销、API Key 禁用、Webhook 停止和第三方授权撤销。
- 数据导出、删除、法律保全、备份传播与删除证明由 C4/法务定义。
- 不得通过“退出后重建”规避历史欠款、审计或内容责任。

### 10.7 成员退出

- 离职/撤销立即停用 Membership 和活跃会话。
- Owner 离开前必须指定新 Owner。
- 高权限成员离开时轮换其可接触的 API Key、Webhook secret 和恢复凭证。
- 个人创建的 Project/资产归 Tenant，不随个人账号迁走。

## 11. 合规与经营风险

| 风险 | 级别 | 表现 | v0.1 控制 | 待确认 Owner |
|---|---|---|---|---|
| 多层分销/传销认定 | 高 | 以招募数量、无限层级或脱离交易的收益为卖点 | 层级 <= 3；只认真实销售/使用；禁止人头奖励 | C0 + 法务 + C3 |
| 白标主体误导 | 高 | 客户不清楚实际服务、数据处理与责任主体 | 强制合同/隐私/AI 标识披露；白标不隐藏法定义务 | C0 + 法务 |
| 渠道越权读取客户内容 | 高 | 祖先渠道直接读取脚本、素材、个人信息 | 商业 scope 与生产 scope 分离；代运营需 Tenant Membership | C4 |
| 数据控制者/处理者不清 | 高 | 平台、白标方、渠道、企业对个人信息责任模糊 | 上线前明确角色、委托处理、子处理者和数据主体通道 | C0 + 法务 |
| 客户转移争议 | 高 | 渠道归属、续费、退款、客户数据发生争议 | 有生效期 affiliation；Tenant 同意；历史快照不改 | C0 + C3 |
| 跨境/地域违规 | 高 | API、白标或供应商导致数据出境 | Tenant 锁定 dataRegion；跨境另行评估 | C4 + 法务 |
| 价格与竞争限制 | 中高 | 排他、最低转售价、区域限制可能触及竞争规则 | 规则不写死；真实方案先法务评审 | C0 + 法务 + C3 |
| 税务/发票/资金责任 | 高 | seller of record 不清导致开票和退款责任不清 | 合同与订单保存 seller 快照；财务规则由 C3 | C3 + 财务/法务 |
| API 密钥泄露/转售 | 高 | 客户暴露平台 Key 或误获上游 Key | 受限平台 Key、轮换、审计、限流；上游 Key 永不下发 | C4 |
| 账号共享与权限累积 | 中高 | 用户跨组织身份叠加造成越权 | active context 隔离；deny 优先；定期复核 Membership | C4 |
| 企业内部过度授权 | 中 | 门店员工看到全企业品牌、账单或其他门店 | Brand/Store/Project scope；默认最小权限 | C4 + C6 |
| 退出后数据不可携带/删不净 | 高 | 白标/渠道退出导致数据锁定或残留 | Tenant ID 独立；导出、删除、保全流程先定义 | C4 + 法务 |
| 渠道冒名承诺 | 中高 | 渠道承诺价格、功能、SLA 或合规能力超授权 | 授权材料版本化；承诺审计；超范围需平台批准 | C0 + C8 |

本文不是法律意见；真实上线、白标签约、资金结算和对外招商前必须由适用法域的法务/财务复核。

## 12. 待决问题

| ID | 待决问题 | 当前建议 | 决策人/会签 | 阻塞范围 |
|---|---|---|---|---|
| DQ-C1-001 | seller of record 与 service channel 是否可分离？ | 语义上允许两类关系，首版可先要求相同 | C0 / C3 / 法务 | 商业 MVP |
| DQ-C1-002 | 直销客户是否可转渠道、渠道客户是否可转直销？ | 允许，必须 Tenant 同意并未来生效 | C0 / C3 | 渠道经营 |
| DQ-C1-003 | 整棵渠道子树是否允许转移？ | 首版禁用或逐节点审批 | C0 / 法务 | 渠道经营 |
| DQ-C1-004 | 企业集团的子公司是否共享 Tenant？ | 不同法律主体默认独立 Tenant；集团容器后置 | C0 / C4 / 法务 | 商业 MVP |
| DQ-C1-005 | 渠道可见客户用量到什么粒度？ | 默认项目级汇总，不见提示词/素材/个人信息 | C1 / C3 / C4 | T1 |
| DQ-C1-006 | 白标经营方是数据控制者、共同控制者还是处理者？ | 按合同与实际处理活动逐案确认 | 用户 / C0 / 法务 | 白标上线 |
| DQ-C1-007 | 白标允许自定义哪些元素？ | Logo/域名/主题可配；法定披露、AI 标识不可隐藏 | C0 / C6 / 法务 | 白标 Demo/MVP |
| DQ-C1-008 | API 集成商能否代表客户创建 Tenant？ | 可提申请，不得无授权静默创建；需下游合同证据 | C0 / C4 / 法务 | API MVP |
| DQ-C1-009 | 渠道商自用生产能力如何建模？ | 创建独立 Tenant，与 ChannelOrganization 关联但不共用 ID | C0 / C4 | T1 |
| DQ-C1-010 | 渠道排他区域、行业和客户保护期如何定义？ | 不在 v0.1 写死，待商业与法务决策 | 用户 / C0 | B1 |
| DQ-C1-011 | 高权限角色是否强制双人复核？ | Tenant/渠道转移、Owner 更换、批量退出建议双人复核 | C0 / C4 | M1 |
| DQ-C1-012 | 退出与删除的具体保存期？ | 按数据类别、合同、审计和法律保全分别定义 | C0 / C4 / 法务 | M1 |

## 13. 跨域 Requests

### REQ-C1-001 · 控制平面组织、成员与 scope 落模

- 目标 Owner：C4
- 请求：评审并落模 Platform/ChannelOrganization/Tenant、Membership、TenantChannelAffiliation、active organization context 与 scope 校验语义。
- 原因：C1 定义业务边界，C4 负责数据模型、API、审计和权限实现。
- 影响：控制平面数据模型、认证授权、审计、平台 API Key。
- 阻塞性：不阻塞 C1 v0.1 提案；阻塞 T1 领域冻结和 M1 实现。
- 临时方案：Demo 保持单 Tenant Mock，不伪造真实隔离。

### REQ-C1-002 · 额度分配权限与转移切账边界

- 目标 Owner：C3
- 请求：定义 Channel/Tenant 角色可发起或批准的额度业务动作，以及 Tenant/渠道转移时在途订单、退款、续费、预付额度和历史归属的切账规则。
- 原因：本文只定义授权主体和归属原则，不能越权设计钱包算法。
- 影响：订单、Wallet、CreditLedger、Settlement、对账。
- 阻塞性：不阻塞 T1 组织模型；阻塞商业计量和 B1。
- 临时方案：关系按未来生效；历史交易归属不改；所有资金数字标记待定。

### REQ-C1-003 · 白标法律与经营边界决策

- 目标 Owner：C0
- 请求：组织用户/法务/财务确认白标合同主体、数据角色、客户披露、售后责任、域名与品牌退出方案。
- 原因：这些事项会形成客户承诺，C1 无权单独冻结。
- 影响：白标产品、合同、隐私、招商材料、退出流程。
- 阻塞性：不阻塞 T1 模型；阻塞真实白标签约与上线。
- 临时方案：仅保留白标结构提案，不对外承诺。

### REQ-C1-004 · 组织/身份切换与代运营双身份 UX

- 目标 Owner：C6
- 请求：在工作台信息架构中验证 active organization context、渠道身份与 Tenant 代运营身份切换、scope 提示和越权错误解释。
- 原因：同一用户多组织、多角色时，错误上下文是高概率越权来源。
- 影响：四类工作台导航、身份切换、面包屑、权限不足状态。
- 阻塞性：不阻塞 T1；影响 D1/M1 的可解释性。
- 临时方案：Demo 只展示四个入口和明确的当前组织标签。

## 14. C0 验收清单

- [ ] Tenant、ChannelOrganization、Brand、Store、Project 未混用。
- [ ] 六类场景与七条具名路径全部覆盖。
- [ ] 渠道树最多三层，二级代理不能继续发展渠道。
- [ ] 禁止循环、多父、跳级和白标绕层级。
- [ ] 渠道商业可见性与 Tenant 生产内容权限分离。
- [ ] 企业分配没有创建伪 Tenant，也没有设计钱包算法。
- [ ] API 客户和机器身份未获得组织管理越权。
- [ ] 白标下游客户保持独立 Tenant。
- [ ] 转移保留 Tenant ID、数据和历史归属。
- [ ] 收益原则不依赖招募数量。
- [ ] 所有法律、财务、白标和实现问题已登记 Request。
- [ ] 未修改 StoryCanvas、公共共同记忆或集成合同。
