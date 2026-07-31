# C0 STATUS

- 岗位：总项目负责人 / 总架构师
- 当前阶段：D2 身份与角色工作台
- 当前状态：D1 `GO_FOR_INTERNAL_DEMO` / D2 `A03_CONTROL_PLANE_READY_FOR_INTEGRATION_WITH_BASELINE_GAPS`
- 当前任务：负责人 A 已完成 A-03 控制平面业务、权限、四身份回归和关键视口视觉收口；下一步推送 `dev/control-plane`、审查 B 的 `dev/production-plane`，并创建短期集成分支执行 D2 全仓 Gate
- 顶层设计：T0 已完成
- 领域冻结：T1 已完成，C1-C8 首轮规格已交付
- D1 Gate：静态与运行证据已通过，结论 `GO_FOR_INTERNAL_DEMO`
- D2 当前基线：`f48c210`；Stage 0 报告：`D2_STAGE0_BASELINE.md`
- D2 规格：`docs/program/specs/C0_D2_IDENTITY_ROLE_WORKBENCHES.md`
- D2 范围：四身份、统一登录、Mock 会话、路由保护、差异化工作台、越权拒绝
- D2 边界：前端 + Mock；不是生产认证，不是服务端 RBAC，不承诺真实租户安全隔离
- SaaS 当前工作树：本仓库根目录；A 分支：`dev/control-plane`
- StoryCanvas 已并入：`apps/storycanvas/`，来源提交 `46fc8d0`
- 演示材料：`docs/program/specs/C8_D1_DEMO_PACK_V0_1.md`
- 阻塞：A 控制平面定向 Gate 已通过；D2 全量 Test 为 132/141 PASS、9 项并发超时，Build 有 3 个既有类型错误，Lint 为 702 problems；B 分支尚待远端交付与集成核验
- 最近更新：2026-07-31

## 2026-07-30 单前端收口

- 用户唯一入口：`http://127.0.0.1:5173/`
- StoryCanvas 画布入口：`/production/canvas/demo-local-001`
- 画布前端位置：`src/features/storycanvas/`
- 媒体生产 API：`apps/storycanvas/src/`，`10588` 仅作内部 API
- 已移除独立 `50188` 前端和 `apps/storycanvas/data/web/` 编译副本

## 2026-07-31 A 端 Stage 0 基线

- A 已从 `f48c210` 建立独立分支 `dev/control-plane`。
- FireRed 子模块、根依赖和 StoryCanvas 依赖已完成初始化。
- 根前端 5173、集成画布路由和 StoryCanvas API 10588 已启动并验证可达。
- Governance：PASS；根 `src + vite.config.ts` 定向 ESLint：PASS。
- 默认 Test：38/45 PASS，7 FAIL。
- 默认 Lint：FAIL，主要为根 ESLint 扫描 StoryCanvas 存量源码产生 697 errors。
- Build：FAIL，包含根 Node 类型缺失和 B 侧 StoryCanvas Grant prop 类型边界。
- 完整分级与 A/B 请求见 `D2_STAGE0_BASELINE.md`。

## 2026-07-31 A-01 Mock 会话与安全回跳

- DemoSession 已补齐 version、sessionId、identityId、role、organization、defaultWorkbench、issuedAt 和 expiresAt。
- 四身份会话有效期统一为 8 小时；刷新恢复前严格校验版本、字段、时间和 canonical identity 元数据。
- 过期、损坏、字段缺失、错版本、未知账号/组织和身份元数据不匹配时清理会话并回到匿名状态。
- 身份切换生成全新 sessionId；失败切换不保留上一身份的内存状态或持久化会话。
- 安全回跳只接受当前身份允许的站内白名单路径；外部 URL、跨角色路径和未知 Project 回到身份默认工作台。
- 定向测试：33 PASS；`npx eslint src`、Governance、`git diff --check` PASS。
- 详细验收：`D2_A01_AUTH_SESSION.md`。

## 2026-07-31 A-02 权限矩阵冻结

- 已冻结四身份的工作台、具体路由/动作和 canonical Tenant/Project 三层权限模型。
- 企业管理员允许进入企业与 canonical Project 生产工作台；默认仍进入海底捞品牌大脑。
- 内容运营允许进入生产工作台及限定企业生产链入口；品牌大脑只读，拒绝企业工作台、已购能力和新建 Brief。
- Router、Sidebar、WorkbenchSwitcher 和安全回跳必须复用统一权限键，禁止分别维护角色判断。
- canonical 范围固定为 Tenant `tenant-demo-hdl`、Project `demo-local-001`。
- 详细矩阵：`D2_A02_PERMISSION_MATRIX.md`；下一步实现统一权限判断和 Router scope guard。

## 2026-07-31 A-02 权限模型第一切片

- `DemoIdentity` 已加入 24 个路由权限、1 个品牌动作权限及完整路由到工作台映射。
- 四身份权限集合已按冻结矩阵实现；内容运营具备限定企业生产链权限，但没有品牌管理动作权限。
- 新增轻量权限矩阵单测，并与 Demo Auth、Auth Store 合计 40 项通过。
- 相关 ESLint、Governance、`git diff --check` 通过。
- TypeScript 的 A 侧错误已清零；当前仍只剩 B 侧 StoryCanvas Grant prop 既有阻塞。
- 为防止旧工作台守卫临时放大权限，双工作台尚未启用；下一步原子接入 Router、Sidebar、WorkbenchSwitcher 和安全回跳。

## 2026-07-31 A-02 canonical 路由授权内核（第二切片）

- 新增 canonical Tenant 常量 `DEMO_TENANT_ID`，与既有 Project 常量共同作为前端 Demo scope 真相。
- 新增 `src/domain/demoRouteAccess.ts`，登记 Router 当前 24 条业务路由及 permission、workbench、目标标签和 scope。
- 授权顺序固定为“已登记路由 → canonical Tenant/Project → 身份具体权限”，返回 `allowed`、`permission-denied`、`scope-denied` 或 `unregistered`。
- 纯 segment matcher 忽略 query/hash，但拒绝外部 URL、双斜杠、反斜杠、额外路径段、错误资源 ID 和 encoded slash 绕过。
- 权限、路由、Demo Auth、Auth Store 共 66 项定向测试通过；相关 ESLint、Governance、`git diff --check` 通过。
- TypeScript 未新增 A 侧错误，仍仅剩 B 侧 `IntegratedStoryCanvasPage.tsx` Grant prop 既有错误。
- 本切片没有修改 Router、Sidebar、WorkbenchSwitcher、品牌页面或 `allowedWorkbenches`，因此没有改变现有运行时权限。
- 下一切片：Router + 安全回跳 + canonical Scope Guard + 统一 403。

## 2026-07-31 A-02 Router 与统一拒绝合同（第三切片）

- Router 当前 24 条业务路由已统一接入 `authorizeDemoNavigationRoute`，按“路由登记 → canonical scope → 具体权限 → 当前启用工作台”拒绝越权。
- 非 canonical Tenant/Project 统一返回 `ROUTE_ID_REJECTED`；无权限或工作台尚未启用统一返回 `ROUTE_PERMISSION_DENIED`；未登记地址继续进入 404。
- 新增统一 403 页面，展示目标、身份、角色、Active Organization、返回入口、退出切换身份和前端 Demo 安全声明。
- 登录安全回跳已删除独立路径集合，改为复用与 Router 相同的导航授权函数，并保留 pathname/query/hash。
- 为避免内容运营在品牌只读接线前临时获得编辑能力，本切片继续保持企业管理员和内容运营的跨工作台入口关闭。
- 权限、路由、Demo Auth、Auth Store、应用 Smoke 共 79 项定向测试通过；相关 ESLint、Governance、`git diff --check` 和 B 独占目录检查通过。
- TypeScript 未新增 A 侧错误，仍仅剩 B 侧 `IntegratedStoryCanvasPage.tsx` Grant prop 既有错误。
- 下一切片：Sidebar + WorkbenchSwitcher + 双工作台 + 品牌大脑只读。

## 2026-07-31 A-02 菜单、双工作台与品牌只读（第四切片）

- 企业管理员和内容运营的 `allowedWorkbenches` 已统一启用 `tenant + production`；平台管理员和渠道代理继续保持单工作台。
- 企业工作台切换入口统一为 canonical 品牌大脑 `/projects/demo-local-001/brand`，生产工作台入口为 `/production/overview`。
- WorkbenchSwitcher 同时校验身份工作台声明和 canonical 路由授权，只展示具有合法入口的工作台。
- Sidebar 按每个菜单项的具体路由权限过滤；内容运营在企业工作台只看到品牌大脑、脚本编辑、分镜生产单和任务/交付。
- 品牌大脑按 `enterprise.brand-manage` 收口：内容运营可查看、导出并进入脚本，但不能编辑资料、修改事实状态或保存品牌配置。
- 跨工作台安全回跳、路由授权、菜单可见性和品牌只读测试已更新为最终冻结矩阵。
- 定向验证：权限/路由/Auth/品牌 71 tests PASS，App Smoke 11 tests PASS，合计 82/82 PASS。
- 相关 ESLint、Governance、`git diff --check` 和 B 独占目录检查 PASS。
- TypeScript 仍只剩 B 侧 `IntegratedStoryCanvasPage.tsx:76` Grant prop 既有错误；A 侧无新增类型错误。

## 2026-07-31 A-03 控制平面业务审计与计划

- 已核对 D2、C1、C2、C3、C4、C6 与现有平台/渠道/企业页面。
- 当前合同已有组织、产品、SKU、Entitlement、RateCard、Tenant Wallet、CreditLedger 和 Receipt；渠道库存、价格、订单、销售净额和毛差仍缺少独立只读投影。
- 冻结五切片顺序：商业只读投影与 selector → 平台视图 → 渠道视图 → 企业视图 → 回归/视觉/文档。
- 所有商业金额继续标记 `DEMO / NON_QUOTE`，与额度分字段保存；不实现真实支付、正式报价、自动分佣或结算引擎。
- 详细计划：`D2_A03_CONTROL_PLANE_PLAN.md`。
- 下一步：A-03.1 `feat(control-plane): add scoped commercial demo projections`。

## 2026-07-31 A-03.1 商业只读投影与可见性 Selector

- canonical ControlPlane fixture 已新增独立 `demoBusiness` 投影，并参与 fixture digest、reset 重建和运行时 schema 校验。
- 演示数据覆盖五层价格快照、两条已履约订单、固定一级渠道额度库存、月度对账摘要和平台风险摘要。
- 所有商业金额使用 `amountMinor + CNY`，金额与额度分字段保存，并保留 `DEMO / NON_QUOTE / 演示数据 · 非正式报价`。
- 新增 platform/channel/tenant 三套纯函数 view model：平台获得全局商业摘要；渠道只获得直接交易和固定子树；企业只获得自身 Entitlement、Wallet 与 Receipt 数量状态。
- selector 不返回 ScriptApproval、ProductionPackage、品牌/脚本/素材正文或原始 CreditLedger；非法固定渠道 ID 明确抛错。
- 定向验证：商业 selector 与 storage/mock adapter 共 11 tests PASS；相关 ESLint、Governance、`git diff --check` 和 B 独占目录检查 PASS。
- TypeScript 的 A-03.1 新增错误为 0；全量检查仍受 B 侧 `IntegratedStoryCanvasPage.tsx:76` Grant prop 与根 `vite.config.ts` Node 类型声明既有缺口阻塞。
- 下一步：A-03.2 平台 overview / organizations / catalog / receipts 路由语义分离。

## 2026-07-31 A-03.2 平台路由语义分离

- `/platform/overview`、`/platform/organizations`、`/platform/catalog`、`/platform/production-receipts` 已分别切换到独立平台页面，不再复用 `WorkbenchHomePage` 或通用 ProductCatalog 页面。
- 四页面统一消费 `selectPlatformCommercialView`；selector 已补齐 Capability 和 RateCard，不读取 ScriptApproval、ProductionPackage、品牌/脚本/素材正文或原始 Tenant CreditLedger。
- overview 只展示平台全局指标、风险和管理入口；organizations 展示完整渠道树、canonical Tenant 商业摘要及 `PRODUCTION_CONTENT` 边界；catalog 展示 Product/Capability/SKU/RateCard 与五层非正式价格；receipts 只展示三类回执状态、失败和未匹配计数。
- 已移除旧平台回执页的 Wallet/ledger 投影和旧 Workbench 平台分支；渠道工作台未提前重构。
- 验证证据：平台页面 4 tests、selector 7 tests、App Smoke 11 tests，合计 22/22 PASS；相关 ESLint、Governance、`git diff --check` 和 B 独占目录检查 PASS。
- TypeScript 的 A-03.2 新增错误为 0；全量检查仍只剩 B 侧 `IntegratedStoryCanvasPage.tsx:76` Grant prop，以及根 `vite.config.ts` 缺少 `node:path` / `__dirname` 类型声明三个既有错误。
- 下一步：A-03.3 固定 `channel-demo-level-1` 渠道商业视角收口。

## 2026-07-31 A-03.3 渠道商业视角收口

- `/channel/overview`、`/channel/products`、`/channel/customers`、`/channel/customers/:tenantId/usage` 已分别切换到独立渠道商业页面。
- 四页面统一消费 `selectChannelCommercialView`，固定 `channel-demo-level-1` + `CHANNEL_SUBTREE_COMMERCIAL`；旧 `WorkbenchHomePage` 已删除，canonical Tenant 继续由 Router Scope Guard 统一校验。
- overview 展示当前组织、直接下级、企业客户、额度库存、销售净额和订单毛差；products 只展示非锁定产品和当前渠道直接交易价格，不出现平台上游成本或平台结算价。
- customers 展示 canonical Tenant 状态、Entitlement 数量和汇总用量；usage 展示 Wallet、客户订单、消费/释放聚合和 GenerationTask/Asset/Export 数量，不读取品牌、脚本、Claim、提示词、素材或成片正文。
- Tenant 商业摘要新增从演示额度场景聚合的 consumed/released 只读统计，不暴露 append-only CreditLedger。
- 验证证据：渠道页面 4 tests、selector 7 tests、App Smoke 11 tests，合计 22/22 PASS；相关 ESLint、Prettier、Governance、`git diff --check` 和 B 独占目录检查 PASS。
- TypeScript 的 A-03.3 新增错误为 0；全量检查仍只剩 B 侧 `IntegratedStoryCanvasPage.tsx:76` Grant prop，以及根 `vite.config.ts` 缺少 `node:path` / `__dirname` 类型声明三个既有错误。
- 下一步：A-03.4 企业经营概览与产品语义。

## 2026-07-31 A-03.4 企业经营概览与产品语义

- 企业产品页已改为企业专用视角，统一消费 `selectTenantCommercialView`；已购、说明态和锁定态按 canonical Tenant Entitlement 判断，不再把平台目录可用状态伪装成企业已购。
- `TenantProductView` 现在携带关联 Capability、SKU 和 Entitlement；企业页面不获得价格、订单、渠道库存、结算、平台风险或原始 CreditLedger。
- 企业产品页已移除平台式 RateCard 轨道；已购产品“开始使用”进入 `/projects/demo-local-001/brand`，说明态只查看说明，锁定态不可执行。
- Dashboard 统一消费 tenant selector，补齐团队成员、活跃项目、Wallet 可用/冻结额度、已购能力，以及 GenerationTask/Asset/Export 回执元数据计数。
- 三类回执先按 canonical Tenant 过滤，再聚合状态；企业视图不返回 input digest、storage reference、output asset IDs 或 B 侧生产正文。
- 内容运营对 `/dashboard` 和 `/enterprise/products` 的 A-02 拒绝合同保持不变；A 未修改 B 独占目录。
- 验证证据：ProductCatalog 3/3、Dashboard 3/3、selector 8/8、route access 28/28、App Smoke 11/11，合计 53/53 PASS；相关 ESLint、Prettier、Governance、diff 和 B 独占目录检查 PASS。
- TypeScript 未新增 A 侧错误；剩余三个错误仍为 B 侧 Grant prop 与根 Vite Node 类型声明既有基线。
- 下一步：A-03.5 四身份回归、关键视口视觉检查和 A-03 最终收口。

## 2026-07-31 A-03.5 四身份回归、视觉与控制平面收口

- 四身份定向回归覆盖平台管理员、一级渠道管理员、企业管理员和内容运营；canonical Tenant/Project 越权拒绝合同保持不变。
- 验证证据：`demoIdentity` 10/10、`demoRouteAccess` 28/28、App Smoke 11/11，合计 49/49 PASS。
- 已在 1440×900 检查 `/platform/overview`、`/platform/catalog`、`/channel/overview`、`/channel/products`、`/channel/customers`、`/dashboard`、`/enterprise/products`、`/projects/demo-local-001/brand`，并补充 1280 宽度检查。
- 已修复 Workbench 顶栏选择器越界和 1440 宽度操作区挤压问题，独立提交为 `e4d70ff fix(shell): keep workbench header within viewport`。
- Governance、`git diff --check`、视觉修复定向 ESLint/Prettier 和 B 独占目录检查 PASS；A 分支工作区 clean，A-03 控制平面进入 `READY_FOR_INTEGRATION`。
- 全量测试为 132/141 PASS、9 项超时失败和 1 个环境卸载异常；单文件复跑 BrandBrain 5/5、Brief 2/2、ScriptEditor 8/8、App Smoke 11/11 PASS，完整 Test Gate 仍按 FAIL 记录。
- 全量 Build 复现 B 侧 Grant prop 与根 Vite Node 类型共 3 个既有错误；全量 Lint 复现 702 problems（697 errors、5 warnings），主要来自 StoryCanvas 存量代码。
- A 交付范围：基线 `f48c210`，当前头提交 `e4d70ff`；A-03 功能提交为 `5a9cf52`、`33e6b90`、`351a368`、`3a04748`、`e4d70ff`，计划提交为 `d99e9b7`。
- 全仓 Gate 尚未通过：仍需 B 修复生产平面 Grant prop、ScriptEditor/StoryCanvas Test/Lint/Build 交接项，并处理根 `vite.config.ts` Node 类型声明后，在短期集成分支复跑完整 Gate。
- 下一步：完成本次文档收口提交并推送 `dev/control-plane`；B 分支到位后，从最新 `main` 创建 `integration/d2-a03-b03`，按控制平面 → 生产平面顺序合并和验证。
