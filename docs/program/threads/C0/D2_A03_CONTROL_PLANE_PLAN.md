# D2 A-03 控制平面业务收口计划

> Owner：A（SaaS 控制平面 / 公共合同 / 主分支集成）  
> 日期：2026-07-31  
> 状态：`A03_1_COMPLETE / A03_2_READY`
> 分支：`dev/control-plane`  
> 前置提交：`e8c252a feat(authz): align menus and workbench access`

## 1. 目标

在不扩真实认证、支付、结算、服务端 RBAC 或多级渠道继承的前提下，把 D2 的平台、固定一级渠道和企业经营视角收口为可解释、可测试的前端 + Mock 演示闭环。

本阶段必须保持：

- 平台只看全局治理、组织、目录、商业摘要和生产回执元数据，不看企业生产正文。
- 渠道只看自身及授权子树的商业摘要，不看平台上游成本、其他渠道数据或客户品牌/脚本/素材事实。
- 企业只看自身已购能力、额度、项目和生产结果，不进入平台或渠道治理。
- 内容运营继续遵守 A-02 冻结权限：品牌大脑只读，不获得企业商业配置、渠道利益或平台治理权限。
- StoryCanvas 不读取客户价格、钱包或结算数据；A 不修改 B 独占目录。

## 2. 已审计基线

### 2.1 已有合同与数据

现有 `src/domain/controlPlane.ts`、`src/mocks/controlPlaneDemo.ts` 和 `src/stores/controlPlaneStore.ts` 已提供：

- Platform、三级 ChannelOrganization、canonical Tenant、Membership 和 DataScope。
- Capability、Product、SKU、Entitlement 和 Demo RateCard。
- Tenant Wallet、CreditLot、append-only CreditLedger、成功/失败额度场景。
- ProjectProductionPackage、Grant、GenerationTaskReceipt、AssetReceipt 和 ExportReceipt。
- 固定渠道身份：`channel-demo-level-1` + `CHANNEL_SUBTREE_COMMERCIAL`。

### 2.2 已有页面

- 平台：`/platform/overview`、`/platform/organizations`、`/platform/catalog`、`/platform/production-receipts`。
- 渠道：`/channel/overview`、`/channel/products`、`/channel/customers`、`/channel/customers/:tenantId/usage`。
- 企业：`/enterprise/products`、`/dashboard`、canonical 品牌大脑和生产链。

### 2.3 已确认缺口

1. `WorkbenchHomePage` 同时承载平台与渠道多条路由，overview、organizations、customers、usage 缺少稳定的路由级语义差异。
2. 页面内部仍有 `requireCanonicalRoute`，与 Router 已统一的 canonical Scope Guard 重复。
3. 平台缺少明确的运营风险、异常和审计入口摘要；回执页只展示任务回执与钱包投影。
4. 渠道缺少额度库存、直接客户价格、订单 Mock 状态、销售净额和订单毛差；现有合同也没有这些商业只读投影。
5. 同一 `ProductCatalog` 对 platform/channel/tenant 基本展示相同集合，未区分平台目录、渠道可售范围和企业 Entitlement。
6. 企业产品的“开始使用”落到 `/dashboard`，与 A-02 冻结的企业 canonical 品牌入口不一致。
7. 企业 Dashboard 已有额度、已购能力、项目和待办，但生产结果与 Receipt/Asset/Export 摘要不足。
8. 除 Dashboard 和 App Smoke 外，控制平面页面缺少稳定的专用组件测试。

## 3. 模型边界

### 3.1 本阶段允许新增

新增独立的 **Demo 商业只读投影**，用于固定一级渠道与四工作台展示，可包含：

- 渠道额度库存摘要。
- 当前渠道的直接取得价、客户零售价、活动成交价。
- 一条或少量演示订单摘要。
- 销售净额、取得成本、订单毛差和对账状态。
- 平台风险/异常计数和审计入口摘要。

所有金额必须：

- 使用 `amountMinor + CNY`；
- 标记 `DEMO / NON_QUOTE / 演示数据 · 非正式报价`；
- 与额度数量分字段保存；
- 仅作为只读 Mock，不声称真实支付、利润或可提现余额。

### 3.2 本阶段禁止新增

- 真实 Payment、Invoice、Tax、Payout、Settlement 引擎。
- 可写订单状态机、真实 PriceBook 管理或正式报价。
- 真实渠道多级继承、自动分佣、按招募人数收益。
- 把金额写入 CreditLedger，或把客户价格、Wallet 写入 ProjectProductionPackage。
- 平台/渠道读取企业脚本、提示词、素材正文、品牌事实正文。
- 修改 B 独占目录：
  - `src/pages/production/`
  - `src/pages/script-editor/`
  - `src/pages/storyboard/`
  - `src/pages/rough-cut/`
  - `src/features/storycanvas/`
  - `apps/storycanvas/src/`

## 4. 分步实施与独立提交

### A-03.1 商业只读投影与可见性 selector

目标：先冻结数据和可见性，不先重做 UI。

工作项：

- 新增最小 Demo 商业只读类型与 fixture，明确固定一级渠道视角。
- 新增 platform/channel/tenant selector 或 view model。
- 平台 selector 可看到全局组织、目录、演示价格层摘要、风险和回执计数。
- 渠道 selector 只看到自身、直接下级/客户、可售产品、库存、允许价格层、订单和毛差。
- 企业 selector 只看到自身 Entitlement、Wallet、项目和 Receipt/Asset/Export 元数据。
- 增加纯函数单测，冻结敏感字段不跨工作台泄漏。

建议提交：

```text
feat(control-plane): add scoped commercial demo projections
```

验收：定向单测、相关 ESLint、Governance、`git diff --check`、B 独占目录检查。

执行结果（2026-07-31）：

- 已把带 `DEMO / NON_QUOTE` 语义的价格快照、演示订单、渠道库存、对账和平台风险摘要纳入 canonical fixture、digest 与运行时 schema。
- 已新增 platform/channel/tenant 三套纯函数 view model，固定一级渠道 ID 不合法时明确抛错，不静默回退。
- 已用 7 条单测冻结五层价格、订单/库存/毛差计算与跨工作台敏感字段隔离。
- 定向测试 12/12、相关 ESLint、Governance、`git diff --check` 和 B 独占目录检查通过。
- TypeScript 的 A-03.1 新增错误已清零；全量检查仍受 B 侧 Grant prop 和根 `vite.config.ts` 缺少 Node 类型声明的既有基线阻塞。
- 下一步进入 A-03.2 平台路由语义分离。

### A-03.2 平台路由语义分离

目标：平台 overview、organizations、catalog、receipts 各自承担单一职责。

工作项：

- overview：租户/渠道/企业客户/额度、运营指标、异常风险和审计入口。
- organizations：组织树、状态、Tenant 边界和演示查看入口。
- catalog：平台 Product/Capability/SKU/RateCard 目录语义。
- production-receipts：任务、资产、导出回执摘要与异常解释，不展示正文。
- 删除页面内重复 canonical 校验，继续由 Router 统一授权。
- 新增平台页面专用测试。

建议提交：

```text
feat(control-plane): separate platform management views
```

### A-03.3 渠道商业视角收口

目标：稳定固定 `channel-demo-level-1` 视角，不提前实现真实层级继承。

工作项：

- overview：当前组织、客户数、直接下级、额度库存、销售净额、订单毛差。
- products：只显示当前渠道可售范围和允许价格层，不显示平台上游成本。
- customers：企业客户商业状态、已购能力和用量摘要。
- usage：canonical Tenant 的额度、订单、消费/释放和回执数量，不展示品牌/脚本/素材事实。
- 明示订单、价格和收益均为 Mock 管理口径，不是正式报价或法定利润。
- 新增渠道页面和越界字段测试。

建议提交：

```text
feat(control-plane): close channel commercial demo views
```

### A-03.4 企业经营概览与产品语义

目标：补齐企业经营摘要，同时保持默认入口为 canonical 品牌大脑。

工作项：

- 企业产品页区分已购 Entitlement、说明态和锁定态，不把平台目录伪装成企业已购。
- “开始使用”进入 `/projects/demo-local-001/brand`，不回退到旧默认 `/dashboard`。
- Dashboard 补团队/项目、额度、已购能力和生产结果摘要。
- 生产结果只消费 GenerationTaskReceipt、AssetReceipt、ExportReceipt 元数据，不读取或修改 B 页面正文。
- 保持内容运营对 `/dashboard`、`/enterprise/products` 的 A-02 拒绝合同。
- 扩充 Dashboard / ProductCatalog 专用测试。

建议提交：

```text
feat(control-plane): align enterprise commercial overview
```

### A-03.5 回归、视觉与文档

工作项：

- 四身份定向 Smoke 与直接 URL 越权回归。
- 1440×900 关键平台、渠道、企业页面检查；必要时补 1280×800。
- 运行相关 ESLint、Governance、`git diff --check`。
- 运行 TypeScript/Build 并把 B 侧既有错误与 A 新增错误分开记录。
- 更新 C0 STATUS/HANDOFF/CHANGELOG、桌面知识库和提交清单。

建议提交：

```text
docs(control-plane): record A-03 closure evidence
```

## 5. 测试策略

优先使用轻量测试，避免每个切片都依赖完整 App Smoke：

1. 纯函数 selector/view-model 测试：数据范围、价格层可见性、敏感字段隔离。
2. 页面组件测试：路由语义、关键指标、按钮目的地和空/错状态。
3. App Smoke：只覆盖四身份主路径、工作台切换和越权拒绝。
4. 最终再做视觉与完整回归。

若命令长时间无输出、测试异常挂起或无法判断进度，立即停止并向用户说明卡点，不盲目等待。

## 6. 完成定义

A-03 完成必须同时满足：

- 三类控制平面工作台的页面语义和数据边界可被测试证明。
- 渠道展示库存、价格、订单和毛差 Mock，但不形成真实交易/结算承诺。
- 平台与渠道均不泄漏企业生产正文；企业不进入平台/渠道治理。
- Product/SKU/Entitlement/RateCard 的展示语义按 audience 区分。
- 企业默认入口和“开始使用”均与 canonical 品牌大脑一致。
- 每个切片独立 commit，提交前验证，提交后工作区 clean。
- B 独占目录无 A 侧变更。
