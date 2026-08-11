# C0 STATUS

- 岗位：总项目负责人 / 总架构师
- 当前阶段：A 业务平台 Wave 4 · 运营收口与 A/B 联合 Gate
- 当前状态：Wave 0 `BUSINESS_DECISIONS_APPROVED` / A-BIZ-01～03.4 `COMPLETE` / A-BIZ-06A～06D `COMPLETE` / A-BIZ-06E `A_CANVAS_ENTRY_REDEMPTION_READY / A_BIZ_06E_4P_PLAN_FROZEN / READY_FOR_06E_5A_RED / B_REDEMPTION_CONSUMER_IMPLEMENTATION_REQUIRED / SHARED_ACTIVATION_GREEN_BLOCKED` / A-BIZ-06F.1～06F.5 `COMPLETE` / `AB_GOLDEN_PATH_NOT_IMPLEMENTED / FULL_JOINT_GATE_STILL_BLOCKED`
- 当前任务：从 `a7f8021` 冻结基线进入 A-BIZ-06E.5A migration 024 fixture RED；并行等待 B 实现 06E.4A redemption consumer、browser-safe bootstrap 与 Pilot pages，验收后再执行 shared Bridge/Router Green
- 顶层设计：T0 已完成
- 领域冻结：T1 已完成，C1-C8 首轮规格已交付
- D1 Gate：静态与运行证据已通过，结论 `GO_FOR_INTERNAL_DEMO`
- D2 当前基线：A-04 已进入远端 `main`，集成接受头为 `1df2bd1`；历史 Stage 0 报告：`D2_STAGE0_BASELINE.md`
- D2 规格：`docs/program/specs/C0_D2_IDENTITY_ROLE_WORKBENCHES.md`
- D2 范围：四身份、统一登录、Mock 会话、路由保护、差异化工作台、越权拒绝
- D2 边界：前端 + Mock；不是生产认证，不是服务端 RBAC，不承诺真实租户安全隔离
- SaaS 当前工作树：本仓库根目录；A 分支：`dev/business-plane`
- StoryCanvas 已并入：`apps/storycanvas/`，来源提交 `46fc8d0`
- 演示材料：`docs/program/specs/C8_D1_DEMO_PACK_V0_1.md`
- 阻塞：A-BIZ-01.1 无业务会签阻塞；正式 Terms、真实支付、真实 SKU/佣金比例、税务/KYC/提现仅阻塞对应能力上线并保持 fail closed。B 的真实媒体/TTS 环境阻塞不阻止 A 的 Schema/RBAC 开发。
- A-05 计划：`docs/program/threads/C0/A05_PILOT_V0_CONTROL_API_PLAN.md`
- A/B 双线职责：`docs/program/threads/C0/A05_TWO_PERSON_EXECUTION_SPLIT.md`
- A-05 多窗口任务顶层设计：`docs/program/A05_MULTI_WINDOW_TOP_LEVEL_DESIGN.md`
- 最近更新：2026-08-11

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

## 2026-08-02 向 B 发出生产平面集成阻塞解除请求

- A 分支 `dev/control-plane` 已推送，头提交为 `ac9a959`，状态 `READY_FOR_INTEGRATION`。
- 本地缓存远端目前只见 `origin/codex/archive-legacy-white-workbench-20260730`，未见正式 `origin/dev/production-plane`；旧归档分支与当前 `main` 分叉且夹带 A/共享改动，禁止整体合并。
- 复跑 `npx tsc -b --pretty false`，确认三个 Build 阻塞仍存在：B 侧 `IntegratedStoryCanvasPage.tsx:76` Grant prop 类型错误，以及根 `vite.config.ts` 的 `node:path` / `__dirname` 类型声明。
- 已要求 B 从最新 `origin/main` 建立并推送 `dev/production-plane`，只迁移 B 负责范围，逐项报告 B-01～B-05 进度，并提供提交、共享文件、测试和风险清单。
- 根 Vite/TS 配置属于共享面，要求 B 以独立 commit 或最小补丁交接，禁止夹带在生产页面重构中。
- 正式请求：`docs/collaboration/DEVELOPER_B_INTEGRATION_UNBLOCK_REQUEST_2026-08-02.md`。
- A 下一步：等待 B 分支达到最低交付标准后，从最新 `main` 创建 `integration/d2-a03-b03`，按 A → B 顺序合并并执行完整 Gate。

## 2026-08-03 A-04.0 生产交付投影审计与计划

- `dev/control-plane` 已从旧头 `3b99dbf` 安全 fast-forward 到已验收的 `main@8594e21`；当前与 main 文件树一致，A-04 尚未修改功能代码。
- 已确认 `origin/codex/*` 是 B 的临时工作分支，不作为 A-04 需求、实现或集成来源；历史 Phase1 审查文档已加“当前口径已取代”提示。
- 审计确认 canonical Package、Grant、三类 Receipt、CreditLedger、Store dispatch/retry/sync 和 Bridge ACK 时序已经存在。
- 当前主要缺口：企业视图只有 Receipt 条数；Store 运行状态未进入 Dashboard；任务未按唯一 task/project 归并；运行额度解释不足；Adapter/Store/reset 缺少直接测试；reset 可能保留上次 dispatch/sync UI 证据。
- 文件边界已冻结：A 可修改 controlPlane domain/view model、controlPlane Adapter/Store、reset、Dashboard 和 A 文档；Bridge、production 页面/组件、StoryCanvas 与 `apps/storycanvas/src/` 继续只读。
- 审计基线测试：ViewModel、Dashboard、ProductionControlSurface、IntegratedStoryCanvasPage 合计 4 files / 16 tests PASS；仅有既有 Ant Design Spin warning。
- 详细计划：`D2_A04_DELIVERY_EVIDENCE_PLAN.md`。
- 下一步：A-04.1 先写 Tenant/Project scoped 交付投影测试，再实现纯函数 ViewModel。

## 2026-08-03 A-04.1～A-04.2 交付投影与可靠性收口

- 已完成 Tenant/Project scoped 的 `selectTenantProjectDeliveryView()`，输出 Package、Grant、transport、sync、唯一任务、Asset/Export 证据、运行时额度、错误和安全动作，不返回生产正文、Provider/存储内部字段、商业价格或跨租户数据。
- Adapter 直接测试覆盖 Package/额度幂等、Receipt duplicate、冲突终态、成功/失败额度结算与 preflight 零副作用。
- Store 直接测试覆盖 dispatch/retry、ACK 失败零入账、重复同步不重复结算和 transport 失败映射。
- Reset 直接测试覆盖成功 Demo 基线清理、普通 rollback、rollback 自身失败、旧 activeOrganization 拒绝和失败时旧证据保留。
- 已最小修复成功 Reset 后 `lastPackageDispatch` / `lastReceiptSync` 残留；A 未修改 B 独占 Bridge、生产页面或 StoryCanvas 实现。
- 联合验证：6 个 Test Files、28 个 Tests PASS；相关 ESLint、Prettier、`git diff --check` PASS；A-04.2c 生产 Build PASS，仅有既有的大 chunk 警告。
- 当前状态：`A04_2_RELIABILITY_READY`；下一步 A-04.3 企业 Dashboard 交付状态 UI。

## 2026-08-03 A-04.3～A-04.4 企业交付状态与收口

- 企业 Dashboard 已消费 `selectTenantProjectDeliveryView()`，展示 Package、Grant、transport、receipt sync、唯一任务、Asset/Export、运行额度和安全错误；不读取或展示 Bridge/Receipt 原始 payload。
- 页面测试覆盖安全空状态、canonical success、partial sync 和 Reset 后旧证据清理；功能提交为 `9a224be feat(control-plane): surface tenant delivery evidence`。
- 定向回归：Dashboard、Delivery View、Route Access、App Smoke 合计 4 Files / 51 Tests PASS。
- 全量串行测试：26 Files / 181 Tests PASS。
- 视觉验收：1440×900 与 1280×800 均无横向溢出，交付状态卡片完整可读；证据见 `docs/program/evidence/a04-dashboard-delivery-1440x900.png` 与 `a04-dashboard-delivery-1280x800.png`。
- A-04 变更文件定向 ESLint PASS；Build PASS（仅既有大 chunk warning）；Governance PASS；`git diff --check` PASS。
- 全仓 Lint 仍为 702 problems（697 errors、5 warnings），集中于 B 独占的 `apps/storycanvas/src/`、`apps/storycanvas/data/vendor/` 与生成文件，不由 A 越界修复。
- StoryCanvas API 运行时生成的未跟踪空文件 `apps/storycanvas/data/vendor/byteplus.ts` 属于 B 范围，不纳入 A 提交。
- 当前状态：`A04_READY_FOR_INTEGRATION`。

## 2026-08-06 · A 业务平台线最新 Main 重规划

- 最新基线：`main == origin/main == 705a134`。
- 当前执行依据：`docs/collaboration/A_B_CO_CREATION_SPLIT_2026-08-06.md`。
- A 职责已升级为业务平台事实源；旧 D2/A-05 Mock 控制平面计划不能直接继续。
- 本机复验：Root 单 worker 30 files / 195 tests PASS；Build、Governance、diff-check、Control API typecheck/build PASS；Control API 51 PASS / 6 PostgreSQL SKIP。
- Q1 canonical runner 因 StoryCanvas `tsx 4.21.0` 与当前 Node 22 测试模式兼容问题为 9/10；不改业务代码、改用 `tsx 4.23.6` 的临时 runner 为 10/10。
- 当前建议状态：`A_BIZ_PLAN_PROPOSED / WAITING_FOR_WAVE_0_FREEZE`。
- 详细计划：`docs/program/threads/C0/A_BIZ_LATEST_MAIN_PLAN_2026-08-06.md`。
- 下一步：用户确认后从最新 main 创建 `dev/business-plane`，先完成 Gate/PostgreSQL 基线和权限/组织 ADR，不直接写死 migration 006 业务规则。

## 2026-08-06 A-BIZ-00.1 PostgreSQL 完整 Gate 恢复

- 本机已安装并初始化 PostgreSQL 16.14，Homebrew 服务正常监听 `127.0.0.1:5432`。
- 已创建仅供测试使用、名称以 `_test` 结尾的隔离数据库；本地凭据未写入仓库。
- 沙箱内首次执行因本地 socket/listen 权限返回 `EPERM`，属于执行环境限制，不是代码失败。
- 沙箱外并发执行出现两个 PostgreSQL suite 同时重建 `control_plane` schema 的竞争，结果为 53 PASS / 4 SKIP；错误为 `pg_namespace_nspname_index` 唯一键冲突。
- 改为单 worker 串行执行后，Control API 达到 14 files / 57 tests PASS / 0 SKIP。
- 当前状态：`A_BIZ_POSTGRES_GATE_READY`；下一步进入 A-BIZ-00.2 多组织权限与组织模型 ADR，不直接实现 migration `006`。

## 2026-08-06 A-BIZ-00.2 多组织权限 ADR 草案

- 已完成现有 Pilot Auth、Membership、Session、Project Repository、migrations 001～005 和 Demo 权限模型审计。
- 已确认当前服务端仍为单 Tenant Session；多 Tenant Membership 会导致登录身份聚合失败；`content_operator` 当前被放大为 Tenant 全项目写权限。
- 新增 `A_BIZ_00_2_MULTI_ORG_RBAC_ADR.md`，推荐采用 Organization 授权根 + Tenant/Channel 类型扩展，Session 绑定单一 Active Membership Context，并以 Project Assignment 收紧工作人员范围。
- ADR 已包含权限矩阵、401/403/404、Route Manifest、正反 fixture、migration `006+` 草图、渐进发布和回滚条件。
- 一人多组织/多角色、`pilot_support`、工作人员创建项目、历史项目授权回填、平台唯一性和代理层级均保持 `TBD`，等待 C0/产品/B 会签。
- 当前状态：`A_BIZ_00_2_ADR_PROPOSED / WAITING_FOR_SCOPE_SIGN_OFF`；未创建 migration `006`，未修改业务代码或 B 独占目录。

## 2026-08-06 A-BIZ-00.3 注册、须知与账务 ADR 草案

- 已完成现有 Pilot 白名单注册边界、Terms 缺口、Wallet/Credit Ledger、C3 v0.1 价格结算提案和支付幂等模式审计。
- 新增 `A_BIZ_00_3_REGISTRATION_TERMS_BILLING_ADR.md`，覆盖版本化 Terms、邀请生命周期、三路注册、不可伪造归因、充值/支付事件、AI 额度和佣金三账、正反 fixture、API manifest、migration `006+` 顺序与回滚。
- 识别并显式记录规则冲突：旧 C3 采用逐级额度批发差价且不默认抽佣，最新老板决策要求归因用户充值产生代理提成；必须由产品/财务决定替代、并存或按产品区分，禁止重复收益。
- 正式须知正文、C 端 Tenant 归属、邀请期限/次数/改绑、支付渠道/金额/退款、额度换算、佣金比例/基数/周期、税务/KYC/提现均保持 `TBD`。
- 当前状态：`WAVE_0_ADRS_PROPOSED / WAITING_FOR_BUSINESS_SIGN_OFF`；未创建 migration、未实现注册/支付、未修改 B 独占目录。

## 2026-08-07 Wave 0 业务决策会签收口

- `origin/main@3f74c76` 已合入企业/个人统一 Tenant 纠偏和老板 Wave 0 完整决策；A 分支已无冲突 rebase 到该基线。
- A-BIZ-00.2 已接受：Organization 为授权根，Tenant/Channel 为类型扩展；Schema 支持多组织/多角色，首版单一活动 Membership/主角色；Content Operator 仅 Assignment 项目且不能创建项目。
- A-BIZ-00.3 已接受：单一注册流程、单人普通 Tenant、定向邀请与代理分享链接、12 个月归因、TEST Payment、版本化额度 SKU、单级直接归因佣金和 append-only 冲正。
- 旧批发差价首版停用，充值佣金成为唯一代理收益模型；正式佣金比例未发布前不得计提真实商业结果。
- 正式 Terms、真实支付、真实 SKU/佣金、税务/KYC/提现继续 fail closed，但不阻塞多组织 Schema/RBAC 底座。
- 下一步：A-BIZ-01.1 先写 PostgreSQL migration 失败测试，再实现 migration `006+`；每个切片独立提交，继续排除 B 未跟踪文件。

## 2026-08-07 A-BIZ-01.1 006A Organization Foundation

- 新增 `006_organization_foundation.ts`，建立 `control_plane.organizations` 授权根，类型冻结为 `PLATFORM / CHANNEL / TENANT`，状态冻结为 `active / suspended / archived`。
- `parent_organization_id` 只建立组织树外键，并拒绝组织自指；本切片不从父子关系推导任何权限。
- 现有每个 Tenant 使用原 `tenant_id` 作为 Organization UUID 显式回填，`tenants.organization_id` 在审计通过后收紧为 NOT NULL、UNIQUE 和 FK，不修改任何既有 Tenant UUID。
- 新增双向类型保护：Tenant 只能引用 `TENANT` Organization，已被 Tenant 扩展的 Organization 不允许改成其他类型。
- 不自动创建 Platform 商业数据，不建立 active Platform 全局唯一约束；首版单 active Platform 仍由后续 bootstrap/config fail closed 保证。
- down migration 只移除 Organization Foundation，保留既有 Tenant 行；migration 测试文件放在 `src/db/`，避免被 Knex migration loader 误扫描。
- Test-first 证据：空 migration 时 4/4 按预期 RED；最小实现后定向 PostgreSQL 4/4 PASS。
- 验证：Control API typecheck、build、定向 ESLint、Governance、`git diff --check` PASS；完整 PostgreSQL Gate 15 files / 61 tests PASS / 0 SKIP。
- B 边界：未修改、未暂存 `apps/storycanvas/data/vendor/byteplus.ts`，未触碰 StoryCanvas tracked 文件。
- 下一步：进入 007 Channel Organization 扩展，不写死代理层级、价格或佣金规则。

## 2026-08-07 A-BIZ-01.1 007 Channel Foundation

- 新增 `007_channel_foundation.ts`，建立 `control_plane.channels`，作为 `CHANNEL` Organization 的最小一对一类型扩展。
- Channel 仅保存 `channel_id`、唯一 `organization_id` 和时间戳；未写死总代理/一级/二级、层级深度、价格或佣金字段。
- 新增双向类型保护：Channel 只能引用 `CHANNEL` Organization，已被 Channel 扩展的 Organization 不得改为其他类型。
- Organization 的 `parent_organization_id` 可表达任意深度组织树，但父子关系本身不自动授予权限；首版固定三级仍是产品开放规则，不进入 Schema。
- 不伪造历史 Channel 数据；down migration 只移除 Channel 扩展，保留 Organization 和 Tenant。
- Test-first 证据：空实现时 4/4 按预期 RED；最小实现后定向 PostgreSQL 4/4 PASS。
- 验证：Control API 完整 PostgreSQL Gate 16 files / 65 tests PASS / 0 SKIP；typecheck、build、007 定向 ESLint、Governance、`git diff --check` PASS。
- B 边界：StoryCanvas tracked diff 为零；未修改、未暂存 `apps/storycanvas/data/vendor/byteplus.ts`。
- 当前状态：`A_BIZ_01_1_007_COMPLETE`；下一切片先冻结 Organization Membership/Role 的兼容与回填合同，再进入 migration `008`，不提前修改 Session Active Context。

## 2026-08-07 A-BIZ-01.1 008 Organization Membership / Role 计划冻结

- 已审计旧 `memberships`、Auth Repository、bootstrap、Session 和 PostgreSQL fixture；旧表仍是 Tenant-only 运行时事实，不能在本切片直接替换。
- 008 选择新增 `organization_memberships` 与 `organization_membership_roles`，保留旧 Membership UUID，并用一个明确 `primary_role_code` + 多角色集合表达首版主角色和未来多角色。
- 角色类型冻结：`platform_admin` / `pilot_support` 仅 PLATFORM，`channel_admin` 仅 CHANNEL，`tenant_admin` / `content_operator` 仅 TENANT。
- 迁移前对旧同 User/Tenant 多角色和 Tenant `pilot_support` fail closed，不用排序或 Demo 规则猜测主角色。
- 兼容期保留旧表读写；数据库只做旧表到新表的单向 Shadow 同步，不提前切换 Auth/Session，也不允许生产代码只写新表。
- 008 不修改 Session Active Context、Project Assignment、Support Grant、代理层级、价格或佣金。
- 详细计划：`A_BIZ_01_1_008_ORGANIZATION_MEMBERSHIP_PLAN.md`。
- 当前状态：`A_BIZ_01_1_008_PLAN_FROZEN / READY_FOR_TEST_FIRST_RED`。

## 2026-08-07 A-BIZ-01.1 008 Organization Membership / Role 完成

- 新增 `control_plane.organization_memberships` 与 `control_plane.organization_membership_roles`，以 `user_id + organization_id` 保证同一用户在同一组织仅有一个 Membership，并以可延迟复合外键保证明确主角色属于角色集合。
- 角色与组织类型矩阵已由数据库双向保护：`platform_admin` / `pilot_support` 仅 PLATFORM，`channel_admin` 仅 CHANNEL，`tenant_admin` / `content_operator` 仅 TENANT；Organization 反向改型也会 fail closed。
- 旧 Tenant Membership 保留 UUID、状态和时间戳并显式回填；旧同 User/Tenant 多角色、Tenant `pilot_support` 和非法 Tenant→Organization 映射会在建表前拒绝，不做隐式角色推断。
- 兼容期继续以旧 `control_plane.memberships` 作为当前 Auth/bootstrap 写入口；insert/update/delete 通过数据库 trigger 单向 Shadow 到新模型，旧表第二角色行由新唯一约束拒绝。
- Test-first 证据：有效 RED 7/7；最小实现后定向 Green 7/7；完整 Control API PostgreSQL 单 worker Gate 17 files / 72 tests PASS / 0 SKIP。
- 工程 Gate：Control API typecheck、build、008 定向 ESLint、Governance、`git diff --check` 全部 PASS。
- 复核结论：旧表 update 的 delete + reinsert 位于同一 PostgreSQL statement/transaction，延迟主角色 FK 在提交时校验；失败写入整体回滚；Organization 类型保护与 006/007 triggers 可共存；down 先移除 trigger/function 和复合 FK，再删除新表，保留旧 Membership/User/Tenant/Organization/Channel。
- 边界：未切换 Auth Repository、Session Active Context 或项目授权；未实现 Project Assignment、Support Grant、代理层级、价格或佣金；`version` 仅初始化为 1。
- B 边界：StoryCanvas tracked diff 为零；`apps/storycanvas/data/vendor/byteplus.ts` 未修改、未删除、未暂存。
- 当前状态：`A_BIZ_01_1_008_COMPLETE / READY_TO_COMMIT`。
- 下一步：008 独立提交后，先冻结 migration 009 的 Project Assignment 与 Pilot 显式回填合同；A-BIZ-01.2 Session Active Context 不提前切流。

## 2026-08-07 A-BIZ-01.1 009 Project Assignment / Pilot 回填计划冻结

- 当前 Project Router/Repository 仍只使用 `actor.tenantId + roles`；`content_operator` 可创建/管理项目并写入 Tenant 全部项目，尚未满足 active Assignment Scope。
- 现有 bootstrap 只创建白名单 `tenant_admin`，数据库没有可安全推断的工作人员→项目映射；009 禁止按同 Tenant 全项目、`created_by`、邮箱、名称或 Demo ID 自动授权。
- 009A 将新增 Project Assignment 与跨 Tenant/Organization 复合约束，冻结 viewer/editor、active/suspended/revoked、不可变 scope 和 revoked 终态。
- Assignment 首版只服务 active `content_operator`；Tenant Admin 全项目权限继续来自后续服务端 Policy，不写伪 Assignment。
- 009B 使用独立显式 JSON manifest runner；记录 manifest ID、canonical digest、批准人、Tenant 和写入数量，同一事务写入 backfill run 与 Assignment。
- 当前仓库不提交真实客户 UUID、邮箱或项目清单；未提供受控 manifest 时零回填、fail closed。
- 兼容边界：009 不修改 Auth Session、SessionActor、Project/Production Repository 或 Router；A-BIZ-01.2 完成 Active Membership Context 后，A-BIZ-01.3 再原子切换 Project Policy。
- 详细计划：`A_BIZ_01_1_009_PROJECT_ASSIGNMENT_PLAN.md`。
- 当前状态：`A_BIZ_01_1_009_PLAN_FROZEN / READY_FOR_TEST_FIRST_RED`。

## 2026-08-07 A-BIZ-01.1 009A Project Assignment Test-first RED

- 新增空 migration 骨架 `apps/control-api/src/db/migrations/009_project_assignment.ts`；当前仅执行无 Schema 副作用的 `select 1`。
- 新增 `apps/control-api/src/db/projectAssignment.postgres.test.ts`，固定 7 个 PostgreSQL 合同用例：合法 viewer/editor、跨 Tenant/错误 Role/非 active 拒绝、枚举与唯一范围、manual/backfill 一致性、状态机与不可变字段、Membership 生命周期不删除审计行、009 down 边界。
- 每个用例先显式断言 `project_assignment_backfill_runs` 与 `project_assignments` 存在，避免“表不存在也满足 rejects”的假通过。
- 专用 `videoagent_control_test`、单 worker 定向结果：1 file / 7 tests 全部按预期 RED；7 个失败均因为 `project_assignment_backfill_runs` 尚不存在。
- Control API typecheck PASS；009 两个新增文件定向 ESLint PASS；Prettier 与 `git diff --check` PASS。
- B 边界保持：`apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存。
- 当前状态：`A_BIZ_01_1_009A_RED_CONFIRMED`。
- 下一步：实现 009A 最小 Project Assignment/backfill evidence Schema、复合约束和生命周期 trigger，使 7 项定向测试转绿；Green 前不提交功能代码，也不提前实现 009B runner 或 Session/Project Policy 切流。

## 2026-08-07 A-BIZ-01.1 009A Project Assignment Schema 完成

- 新增 `control_plane.project_assignment_backfill_runs`，记录 manifest ID/digest/version、Assignment 数量、Tenant/Organization、批准人与创建时间；digest、version、正数数量和 Tenant/Organization 一致性由数据库约束。
- 新增 `control_plane.project_assignments`，冻结 viewer/editor、active/suspended/revoked、manual/pilot_backfill、审计创建人与唯一 Project/Membership 范围。
- 为 Project/Tenant、Tenant/Organization、Membership/Organization 和 BackfillRun/Tenant/Organization 建立复合唯一键与复合 FK，跨 Tenant/Organization Assignment fail closed。
- insert trigger 只接受 active TENANT `content_operator` Membership；Tenant Admin、Platform/Channel Role、inactive Membership 和跨 Tenant 组合均拒绝。
- lifecycle trigger 保证 scope/source/creator 不可变、revoked 为终态、revoked 后 access/revoked_at 不可修改、允许的 update 自动刷新 `updated_at`，业务 delete 拒绝。
- Backfill evidence 行 update/delete 拒绝；manual 必须无 run，pilot_backfill 必须绑定同 Tenant/Organization run。
- Membership 后续 suspended 或移除 `content_operator` Role 时 Assignment 审计行保留；运行时授权切流仍留给 A-BIZ-01.2/01.3。
- Test-first 证据：空 migration 有效 RED 7/7；最小实现后定向 Green 7/7；完整 Control API 单 worker Gate 18 files / 79 tests PASS / 0 SKIP。
- 工程 Gate：Control API typecheck、build、009 定向 ESLint、Governance、`git diff --check` 全部 PASS。
- B 边界：StoryCanvas tracked diff 为零；`apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存。
- 当前状态：`A_BIZ_01_1_009A_COMPLETE / READY_TO_COMMIT`。
- 下一步：009A 独立提交后进入 009B 显式 Pilot manifest backfill runner；不提前切换 SessionActor 或 Project Policy。

## 2026-08-07 A-BIZ-01.1 009B 显式回填 Runner 计划冻结

- 009B 文件边界冻结为核心 runner、独立 CLI、PostgreSQL 合同测试和一个 Control API npm script，不新增依赖。
- CLI 只接受 `PROJECT_ASSIGNMENT_MANIFEST_PATH` 指向的显式 UTF-8 JSON；缺失、非法或未知字段均 fail closed，不从数据库或 Demo 数据推断授权。
- digest 对排序后的业务载荷计算并排除 `manifestId`；同 ID/同 payload replay，同 ID/不同 payload 和不同 ID/同 digest 均拒绝。
- Runner 在单一事务内验证 active TENANT、active tenant_admin 批准人、同 Tenant active content_operator Membership 和 Project，再写入 run + assignments。
- 成功结果和日志只包含 manifest ID、digest、数量、replay；失败日志不包含原始 manifest、Zod issues、SQL、连接串或客户内容。
- 详细计划：`A_BIZ_01_1_009B_PROJECT_ASSIGNMENT_BACKFILL_PLAN.md`。
- 当前状态：`A_BIZ_01_1_009B_PLAN_FROZEN / READY_FOR_TEST_FIRST_RED`。
- 下一步：先创建 runner PostgreSQL 合同测试，确认 module/行为缺失时有效 RED，再实现最小 runner。

## 2026-08-07 A-BIZ-01.1 009B Project Assignment Backfill Test-first RED

- 新增可编译但明确未实现的核心骨架 `apps/control-api/src/projects/projectAssignmentBackfill.ts`，冻结 manifest/result/logger 类型与三个公开 API。
- 新增 `apps/control-api/src/projects/projectAssignmentBackfill.postgres.test.ts`，固定 8 项合同：原子写入、canonical digest/replay、ID/digest/schema/重复 pair 冲突、批准人拒绝、Membership/Project 范围拒绝、Tenant/非法输入 fail closed、安全日志和并发 replay。
- 专用 `videoagent_control_test`、单 worker 定向结果：1 file / 8 tests 全部按预期 RED；失败点均为 runner/parser/digest 明确未实现，不是 fixture、migration 或数据库连接故障。
- Control API typecheck PASS；009B 两个新增文件定向 ESLint、Prettier 与 `git diff --check` PASS。
- B 边界保持：`apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存。
- 当前状态：`A_BIZ_01_1_009B_RED_CONFIRMED`。
- 下一步：实现严格 Zod Schema、canonical SHA-256、稳定安全错误、事务级幂等保护、批准人/目标/Project 校验及原子写入，使 8 项测试转绿；Green 前不提交。

## 2026-08-07 A-BIZ-01.1 009B Project Assignment Backfill 核心 Green

- `projectAssignmentBackfill.ts` 已实现严格 Zod Schema、UUID/manifest ID 规范化、重复 pair 拒绝及不携带原始输入的稳定错误码。
- canonical SHA-256 排除 `manifestId`，Assignments 按 Membership、Project、Access Level 排序并对对象键排序。
- 单事务 runner 使用排序后的双事务级 advisory lock 串行保护 manifest ID 与 digest；同 ID/同 payload replay，同 ID/不同 payload及不同 ID/同 payload分别稳定拒绝。
- 事务内验证 active TENANT/Organization、active User + Membership + tenant_admin 批准人、active User + Membership + content_operator 目标以及同 Tenant Project，失败零部分写入。
- run evidence 与全部 `pilot_backfill` Assignment 在同一事务写入，UUID 由 `node:crypto.randomUUID` 生成；日志只接收固定 event 和安全结果字段。
- 定向 PostgreSQL：1 file / 8 tests PASS。首次 Green 运行的唯一失败来自当前 Vitest/Chai 不支持 `toHaveSize`，改用 `Set.size` 后通过，不是业务实现故障。
- 当前状态：`A_BIZ_01_1_009B_CORE_GREEN / CLI_AND_FULL_GATE_PENDING`。
- 下一步：补齐只读显式文件的 CLI 与 npm script，新增 CLI 安全边界测试，然后运行完整 Gate；完整转绿前不提交。

## 2026-08-07 A-BIZ-01.1 009B Project Assignment Backfill 完成

- 新增 `projectAssignmentBackfillCli.ts`：只读取 `PROJECT_ASSIGNMENT_MANIFEST_PATH` 指向的 UTF-8 JSON，不接受 stdin、默认路径或数据库扫描；缺少路径、空文件、非法 JSON、配置/数据库/runner 失败统一返回通用消息和非零退出码。
- CLI 成功只输出固定 completed/replayed event 与 manifest ID、digest、数量、replay；失败不输出路径、原始 manifest、Error、Zod issues、SQL、连接串、邮箱、Token、密码或内容正文，并始终释放已打开数据库连接。
- `apps/control-api/package.json` 新增 `project-assignment:backfill` script，不新增依赖，也未产生 package-lock 变更。
- CLI 安全边界测试 1 file / 6 tests PASS；009B PostgreSQL 合同 1 file / 8 tests PASS。
- Control API 完整单 worker Gate：20 files / 93 tests PASS / 0 SKIP；typecheck、build、009B 定向 ESLint、Prettier、Governance、`git diff --check` PASS。
- StoryCanvas tracked diff 为零；B 的 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存。
- 当前状态：`A_BIZ_01_1_009B_COMPLETE / READY_TO_COMMIT`。
- 下一步：形成 009B 独立 `feat(control-api)` 提交；随后回到 A-BIZ-01.1 收口检查，再规划 A-BIZ-01.2 Active Membership Context，不能直接在本提交切 Session/Auth/Project Policy。

## 2026-08-07 A-BIZ-01.1 迁移链正式收口

- 新增 `apps/control-api/src/db/migrationChain.postgres.test.ts`，通过真实 Knex migration loader 从空 `_test` 数据库按文件顺序执行 `001`～`009`。
- 验证 9 个 migration 全部登记、Organization/Membership/Project Assignment 等 11 张核心表存在，并确认再次 `migrate.latest()` 不重复执行。
- 专用 `videoagent_control_test`、单 worker 定向结果：1 file / 1 test PASS；Prettier 与 `git diff --check` PASS。
- 测试清理只允许数据库名以 `_test` 结尾，并在前后删除专用 `control_plane` Schema 与 migration metadata，不触碰非测试库。
- B 边界保持：`apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存。
- 当前状态：`A_BIZ_01_1_COMPLETE / A_BIZ_01_2_PLAN_PENDING`。
- 下一步：冻结 A-BIZ-01.2 Active Membership Context 计划，再建立 migration 010 与 Auth Repository/Service 的行为级 RED。

## 2026-08-07 A-BIZ-01.2 Active Membership Context 计划冻结

- 冻结 migration 010：Session 增加 Membership/Organization/Version Context，Tenant 字段只用于 TENANT 兼容；安全回填失败的历史 Session 撤销而不猜测。
- 冻结 Membership Version：状态、主角色、Role 集合及旧 Membership Shadow 的安全事实变化必须使 version 严格增加。
- 登录只接受服务端唯一 active Membership；零个、多个或不一致候选统一按无效凭据 fail closed。
- Public Session 新增最小 `activeContext`，保留顶层 roles 与 TENANT tenant 兼容字段；不返回 `availableContexts`。
- PLATFORM/CHANNEL Context 不伪造 Tenant；旧 Project/Production Router 只做明确拒绝，正式 Project Assignment Policy 留在 A-BIZ-01.3。
- 计划拆分为 010A Schema/Version 与 010B Auth Repository/Service 两个独立 test-first 功能提交。
- 计划文件：`A_BIZ_01_2_ACTIVE_MEMBERSHIP_CONTEXT_PLAN.md`。
- 当前状态：`A_BIZ_01_2_PLAN_FROZEN / READY_FOR_010A_RED`。

## 2026-08-07 A-BIZ-01.2 010A Session Context Schema 与 Version 完成

- 新增 migration `010_session_active_context.ts`：Auth Session 增加 Membership/Organization/Version Context，`tenant_id` 改为仅 TENANT Context 使用的 nullable 兼容字段。
- 唯一 active TENANT Membership 可安全回填；无法回填的历史 Session 被撤销且不猜测上下文。
- 数据库约束校验 Context 全有或全无、Session User/Membership/Organization 一致、Membership Version 一致及 TENANT 扩展匹配；PLATFORM/CHANNEL Context 禁止携带 Tenant。
- Membership status/主角色及 Role 集合变化会使 version 严格增加；旧 Membership Shadow 更新改为保留 Membership ID 和 version 的受控更新。
- 回滚仅允许 TENANT-only Session；存在非 TENANT Session 时在任何 Schema 修改前 fail closed。
- Test-first RED 已确认；Green 后定向 PostgreSQL 2 files / 6 tests PASS。
- Control API 完整单 worker Gate：22 files / 99 tests PASS / 0 SKIP；typecheck、build、定向 ESLint、Prettier、Governance、`git diff --check` PASS。
- StoryCanvas tracked diff 为零；B 的 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存。
- 当前状态：`A_BIZ_01_2_010A_COMPLETE / READY_FOR_010B_RED`。
- 下一步：建立 Auth Repository/Service PostgreSQL 与 HTTP 行为 RED，再实现唯一 Membership 登录、Version resolve、Public activeContext 和非 TENANT Router fail closed。

## 2026-08-07 A-BIZ-01.2 010B Membership-bound Auth 完成

- Auth Repository 已从旧 Tenant Membership 切到唯一 active Organization Membership；登录候选为零个、多个或上下文不一致时统一 fail closed。
- 新 Session 固化 Membership、Organization 与 Membership Version；每次 resolve 重新验证 active User、Organization、Membership、Role 集合、主角色、Tenant 扩展和 Version。
- Session rotation 保持刚验证的 Membership Context；同一 User + Membership 的旧登录 Session 会被撤销，旧 Token 立即失效。
- Public Session 新增最小 `activeContext`，保留顶层 `roles` 和 TENANT `tenant` 兼容；PLATFORM/CHANNEL 返回 `tenant: null`，不返回 `availableContexts`。
- Project/Production Router 对非 TENANT Context 在构造 Actor、调用 Store 前返回 `403 TENANT_CONTEXT_REQUIRED`，不把 Organization ID 伪装成 Tenant ID。
- 新增 PostgreSQL Auth Repository 合同测试、PLATFORM HTTP Session 测试及 Project/Production 非 TENANT 边界测试；Test-first RED 的 5 个预期失败均已转绿。
- Control API 完整单 worker Gate：24 files / 106 tests PASS / 0 SKIP；typecheck、build、定向 ESLint、Prettier、Governance、`git diff --check` PASS。
- StoryCanvas tracked diff 为零；B 的 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存。
- 当前状态：`A_BIZ_01_2_COMPLETE / COMMITTED`。
- 下一步：010B 独立提交后冻结 A-BIZ-01.3 服务端 RBAC/Project Scope 计划；Project Assignment Policy 必须作为后续原子切流，不混入本提交。

## 2026-08-07 A-BIZ-01.3 Project Scope Policy 计划冻结

- 已完成 Project/Brief/Script/Approval/Production 现有 Tenant-only 授权路径与 009 Project Assignment Schema 审计。
- 已冻结完整 SessionActor、Project Visibility 与动作权限分层、viewer/editor 行为矩阵及 401/403/404 稳定语义。
- `content_operator` 首版只能访问 active Assignment 项目；viewer 只读，editor 可写内容与生产，但两者均不能创建或管理 Project 元数据。
- Assignment 不进入 Session，每次 Project 请求实时验证 Membership、Role、Organization 和 Assignment；失效或未授权 Project 对工作人员统一隐藏为 404。
- PLATFORM/CHANNEL/`pilot_support` 继续 fail closed；Support Grant、成员、账务和渠道 API 不混入本切片。
- 当前状态：`A_BIZ_01_3_PLAN_FROZEN / READY_FOR_RED`；下一步建立 Router + PostgreSQL 行为级 RED，再执行 Content/Production 原子切流。

## 2026-08-07 A-BIZ-01.3 Membership-bound Project Scope 完成

- 新增共享 `PostgresProjectPolicy`，以当前 Membership、Role、Organization、Tenant、Membership Version 与 active Project Assignment 实时解析 Project 可见范围和 `viewer` / `editor` / `manager` access；Assignment 不进入 Session。
- `tenant_admin` 无需 Assignment 即可管理当前 Tenant 全部项目；`content_operator + viewer` 只读已分配项目；`content_operator + editor` 可写 Brief/Script/Approval 与 Production，但不能创建或管理 Project 元数据。
- Content Router 从已验证 `activeContext` 构造完整 Membership-bound Actor；项目列表在 SQL 查询前应用可见 ID Scope，空 Scope 不加载 Tenant 全项目。
- 未分配、跨 Tenant、失效 Assignment、Membership/Role/Organization/Version 不一致均 fail closed；Content 路径返回 `404 PROJECT_NOT_FOUND`，已可见但动作不足返回 `403 PERMISSION_DENIED`，Policy 拒绝时不调用领域 Store。
- Production Router 使用同一 Policy：Package GET 需要 `project.production.read`，Package 创建和 Grant 签发需要 `project.production.write`，拒绝发生在 Production Store、签名和幂等副作用之前。
- Production v0.2 合同兼容例外：为避免修改 B 已冻结的 StandardError Schema/安全目录，生产路径对不可见项目继续返回 `403 PROJECT_SCOPE_MISMATCH`，viewer 写入继续返回 `403 CAPABILITY_SCOPE_DENIED`；Content 路径维持冻结的 404/403 语义。
- 新增 PostgreSQL 与 HTTP 回归，覆盖 Tenant Admin 无 Assignment、viewer/editor 动作矩阵、Assignment/Membership/Role/Organization/Version 即时失效、同用户其他 Membership 不扩张当前 Context、跨 Tenant 隐藏、editor Project 元数据拒绝和 viewer Production 读取。
- 定向 Gate：HTTP 2 files / 13 tests PASS；PostgreSQL 3 files / 10 tests PASS。
- 完整 Control API 单 worker Gate：25 files / 116 tests PASS / 0 SKIP；typecheck、build、定向 ESLint、Prettier、Governance、`git diff --check` 全部 PASS。
- StoryCanvas tracked diff 为零；B 的 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交。
- 当前状态：`A_BIZ_01_3_COMPLETE / COMMITTED`。
- 功能切片按 `feat(control-api): enforce membership-bound project policy` 独立提交；下一步按最新业务平台主计划冻结后续切片，不直接扩大 A-BIZ-01.3 范围。

## 2026-08-07 A-BIZ-01.4 统一企业创作工作台计划冻结

- 依据 `docs/collaboration/A_B_CO_CREATION_SPLIT_2026-08-06.md`，冻结 Tenant 用户使用单一统一创作工作台：企业老板、单人创作者和内容工作人员不再在 `tenant` / `production` 两个产品工作台间切换。
- 冻结角色菜单边界：`tenant_admin` 可见项目与企业管理入口；`content_operator` 只见服务端 Project Scope 内的创作与生产入口，不展示 Dashboard、产品购买和项目创建/管理入口。
- Demo 保持 canonical 海底捞默认项目与 Mock/LocalStorage 黄金路径；Pilot 默认项目只来自 `/api/v1/projects` 的服务端可见列表，空 Scope 进入 `/projects`，禁止硬编码客户 Project、Tenant、邮箱或 Demo fixture。
- Pilot Project Context 只由已验证 `activeContext` 与服务端 Project list/read 构成；Assignment 不固化进 Session，刷新、Membership/Role/Assignment 变化后重新收口，未知 Role 和非 TENANT Context fail closed。
- B 独占的脚本、分镜与 StoryCanvas 页面不在本切片修改；真实 Pilot 数据合同未接通前只能展示明确 unavailable/handoff 状态，不得伪装 Demo success。
- 实施顺序冻结为：01.4A 纯函数 Route Manifest/Policy → 01.4B Pilot Session/Project Context → 01.4C 统一 Router/Sidebar/Shell → 01.4D B 接线合同与回归。
- 详细计划：`A_BIZ_01_4_UNIFIED_CREATION_WORKBENCH_PLAN.md`。
- 当前状态：`A_BIZ_01_4_PLAN_FROZEN / READY_FOR_TEST_FIRST_RED`。
- 下一步：先为统一 Tenant 菜单、角色过滤、Demo/Pilot 默认路由、Project 可见性和 fail-closed 边界建立纯函数测试并确认 RED；不直接修改共享 Router/Sidebar。

## 2026-08-07 A-BIZ-01.4A 统一 Tenant Route Manifest / Policy 完成

- 新增运行模式无关的 `TENANT_ROUTE_MANIFEST`，在单一有序菜单中描述企业、项目创作和生产路由、唯一 capability、角色可见性、Project 依赖及 Pilot 接线状态。
- `tenant_admin` 与 `content_operator` 均只生成一个“统一创作工作台”选项，不再为 Tenant 生成独立 `production` WorkbenchSwitcher；内容运营不获得 Dashboard、已购能力和项目创建入口。
- Demo 默认路由保持 canonical `/projects/demo-local-001/brand`；Pilot 只从当前 Tenant 的服务端可见 Project 列表稳定选择默认项目，空 Scope 进入 `/projects`，不会回退 Demo Project。
- 统一纯函数授权对未知 Role、空 Tenant Context、未注册/不安全路径 fail closed；Project 路由必须命中当前 Tenant 的可见 Project，否则返回 `project-not-found`，角色能力不足返回 `permission-denied`。
- Test-first RED 已由缺失模块确认；最小实现后新增 14 项测试全部通过，相关 Demo Identity / Route Access 联合回归 51/51 PASS。
- Root 串行完整 Gate：31 files / 209 tests PASS；typecheck、build、定向 ESLint、Prettier、Governance 与 `git diff --check` PASS。
- 并行全量首次运行出现 5 项历史 UI 慢测超时/串扰；App Smoke、Brief、B ScriptEditor 单文件复跑均通过，串行完整 Gate 进一步确认 209/209，通过后未修改 B 页面。
- StoryCanvas/B 独占 tracked diff 为零；`apps/storycanvas/data/vendor/byteplus.ts` 继续保持 B 的未跟踪文件，未修改、未暂存。
- 当前状态：`A_BIZ_01_4A_COMPLETE / READY_TO_COMMIT`。
- 下一步：01.4A 独立提交后进入 01.4B Pilot Session / Project Context；先写 Session activeContext 与 Project list/read 合同 RED，不提前修改共享 Router/Sidebar。

## 2026-08-07 A-BIZ-01.4B Pilot Membership-bound Project Context 完成

- 根前端 Pilot Session 已严格解析完整 `activeContext`，支持 TENANT Session 和 `tenant: null` 的 PLATFORM/CHANNEL Session；顶层 Role、主角色、Membership Version、Organization/Tenant 一致性不满足时 fail closed。
- 新增真实 Pilot Project list/read API 解析，不接受无效 Project ID、状态、时长或日期；未引入 Demo/硬编码客户回退。
- 新增纯内存 `pilotProjectContextStore`：TENANT Context 才加载服务端可见项目，按 ID 稳定选择默认 Project；非 TENANT、空 Scope、401/403/404/5xx 均进入明确状态。
- Pilot 登录与 hydrate 成功后自动刷新 Project Scope；Project API 401 清理 Session，403/404/5xx 保留已认证 Session；logout 同时清理 Auth 与 Project Context。
- Assignment 不进入 Session，Project Context 不写入 LocalStorage；Project 切换只允许当前服务端可见列表，并在切换前通过 read API 再确认。
- 共享 `src/app/Router.tsx` 的 nullable tenant 兼容已独立提交：`00355c1 fix(pilot-shell): support nullable tenant session`；仅调整 null-safe 组织文案与 Prettier 格式，需要通知 B。
- 定向 Gate：5 files / 30 tests PASS；定向 ESLint、Prettier、TypeScript PASS。
- Root 串行完整 Gate：32 files / 225 tests PASS；build、Governance、`git diff --check` PASS。
- B 独占目录 tracked diff 为零；B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存。
- 当前状态：`A_BIZ_01_4B_COMPLETE / READY_TO_COMMIT`。
- 下一步：独立提交 Pilot API/Auth/Project Context 与本次项目记忆；随后进入 01.4C，共享 Router/Sidebar/Shell 接入统一 Route Manifest，继续按共享文件独立提交并通知 B。

## 2026-08-07 A-BIZ-01.4C 统一 Router / Sidebar / Shell 接入完成

- Test-first 从旧 `/pilot` 成功卡片出发确认 6/6 RED；最终新增 `src/app/Router.pilot.test.tsx`，以 8 项测试覆盖统一 Shell、服务端默认 Project、空 Scope、非 Tenant fail closed、角色拒绝、Project 404/5xx、安全 returnTo 与无 Demo 回退。
- Pilot `/pilot`、登录恢复和直接 URL 现统一经过 `TENANT_ROUTE_MANIFEST` 与 `authorizeTenantWorkbenchRoute()`；默认 Project 只取服务端可见 Scope，外部、不安全、越权或未分配 returnTo 均安全回退，非 Tenant Context 明确拒绝。
- `AppShell` 已拆分 Demo/Pilot：Pilot 使用统一 Sidebar/Topbar，但不 hydrate Demo Store、不显示 Demo Truth Bar；未接真实 Pilot 数据的已授权页面只展示 handoff/unavailable，不渲染 Demo 页面或伪造成功。
- Demo Tenant 与历史 Production URL 在 UI 中合并为单一“统一创作工作台”；`tenant_admin` 同一菜单可访问企业、创作和生产入口，`content_operator` 隐藏 Dashboard、已购能力和项目创建入口。Platform/Channel Demo 行为保持兼容。
- Pilot Topbar 使用真实组织、角色和服务端 Project Select；切换 Project 通过 read API 复核，退出清理真实 Session。Project 5xx 保留已认证 Session，401 仍回到登录。
- Gate：Pilot 8/8 PASS；联合定向 7 files / 87 tests PASS；Root 串行完整测试 33 files / 233 tests PASS；TypeScript/build、定向 ESLint、Prettier、Governance、`git diff --check` 全部 PASS。Build 仅保留既有大 chunk 警告。
- B 独占目录 tracked diff 为零；B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交。
- 本切片修改共享 `Router`、`AppShell`、`Sidebar`、`Topbar`，必须作为独立共享 Shell 提交通知 B。
- 当前状态：`A_BIZ_01_4C_COMPLETE / READY_TO_COMMIT`。
- 下一步：完成 01.4C 独立提交并通知 B；随后进入 01.4D，只做 B 页面接线合同、handoff 边界和跨平面回归，不直接修改 B 独占页面源码。

## 2026-08-07 A-BIZ-01.4D B 页面 Context 接线计划冻结

- 冻结 B 页面最小 Pilot Context：`projectId`、`tenantId`、`sessionMembershipId`、`roleCodes`、`runtimeMode`、`controlApiBaseUrl`。
- Context 只来自已验证 Session、内存 Project Context 与已校验 Pilot Runtime；不包含 Secret、Assignment、access level、用户/组织展示信息、Demo Store 或虚构 Task/Asset/Export 状态。
- 冻结 fail-closed resolver：非 Pilot、Control API 配置缺失、非 Tenant、Project/Membership/Role 不一致、未知 Role 均返回明确 unavailable，不猜测、不回退 Demo。
- A 只提供纯合同、必要的共享接线、联合回归和正式 handoff；不修改 B 独占脚本、分镜、StoryCanvas 页面源码。
- 详细计划：`A_BIZ_01_4D_B_PAGE_HANDOFF_PLAN.md`。
- 当前状态：`A_BIZ_01_4D_PLAN_FROZEN / READY_FOR_TEST_FIRST_RED`。
- 下一步：独立提交计划，然后先新增 12 项纯函数合同测试并确认有效 RED，再实现最小 resolver。

## 2026-08-07 A-BIZ-01.4D B 页面 Context 合同与 Handoff 完成

- 新增 `src/domain/tenantPageHandoff.ts`，冻结六字段 Pilot 页面 Context：`projectId`、`tenantId`、`sessionMembershipId`、`roleCodes`、`runtimeMode`、`controlApiBaseUrl`。
- Resolver 对非 Pilot、Control API 配置缺失或不安全、非 Tenant、Project Context 缺失、Project/Tenant/Membership/Role 不一致及未知 Role 全部返回明确 `unavailable`；不读 Demo Store/LocalStorage，不发网络请求，不缓存权限结论。
- Ready Context 只包含六个冻结字段，Role 按稳定顺序去重；Context 与 Role 数组均克隆并冻结，后续输入变化不能扩大已生成 Scope。合同不携带 Secret、Assignment、access level、用户/组织展示信息或虚构 Task/Asset/Export 状态。
- Test-first RED：模块缺失导致合同套件有效失败；最小实现后 15/15 GREEN。与 Pilot Router 联合定向 2 files / 23 tests PASS。
- 新增给 B 的正式交接：`docs/collaboration/A_BIZ_01_4D_B_PAGE_HANDOFF.md`，写明字段来源、resolver 示例、unavailable 行为、401/403/404/409/5xx 边界、Demo/Pilot 硬边界、文件所有权和 B 回传清单。
- Root 串行完整 Gate：34 files / 248 tests PASS；TypeScript/build、定向 ESLint、Prettier、Governance、`git diff --check` 全部 PASS。Build 仅保留既有大 chunk 警告。
- 本切片未修改共享 Router/Layout，也未修改 B 独占源码；B 边界 tracked diff 为零，`apps/storycanvas/data/vendor/byteplus.ts` 仍未修改、未暂存。
- 当前状态：`A_BIZ_01_4D_COMPLETE / A_BIZ_01_4_COMPLETE / READY_TO_COMMIT`。
- 下一步：独立提交 01.4D；通知 B 同步共享 Shell `ade3e54` 与本 Context/Handoff 提交后，按一个页面一个切片回传测试和 commit。A 随后依据最新业务平台主计划冻结下一业务节点。

## 2026-08-07 A-BIZ-02.1 Terms 版本与发布计划冻结

- 确认最新业务顺序为 `Terms → Invitation → Registration`；A-BIZ-01.4 已收口后，下一业务节点进入 A-BIZ-02.1。
- 冻结 migration 011 的 TermsDocument、TermsVersion、UserConsent 模型，明确 SHA-256 正文一致性、DRAFT/PUBLISHED/RETIRED 状态机、PUBLISHED immutable、同 Document/locale current 选择和 supersedes Scope。
- Public current 只选择 active Document 下已生效的 PUBLISHED Version；无 current 返回稳定 `TERMS_NOT_AVAILABLE`，禁止回退 DRAFT、RETIRED、旧 locale、Demo 或硬编码正文。
- UserConsent append-only，保存 Version 与 digest snapshot；Registration 尚未创建前只保留 nullable registration UUID，后续独立 migration 增加 FK。
- 正式正文、document code/locale、发布人与法务审批继续为 TBD；TBD 只阻塞正式发布和注册放量，不阻塞通用 Schema、Service、API 与测试底座。
- 详细计划：`A_BIZ_02_1_TERMS_VERSIONING_PLAN.md`。
- 当前状态：`A_BIZ_02_1_PLAN_FROZEN / READY_FOR_TEST_FIRST_RED`。
- 下一步：独立提交计划；随后先新增 migration 011 PostgreSQL 合同测试并确认有效 RED，再实现最小 Schema。

## 2026-08-07 A-BIZ-02.1A Terms migration 011 完成

- Test-first RED 已确认：`termsVersioning.postgres.test.ts` 首次因 `011_terms_versioning` 模块不存在而失败，随后才实现 Schema。
- 新增 `terms_documents`、`terms_versions`、`user_consents` 三张表；migration 不 seed 正式或占位 Terms Document/正文。
- Document code 大小写不敏感唯一且创建后不可修改；Document retirement 为单向状态，有 Version 时由 FK 阻止删除。
- Version 强制非空正文与 UTF-8 SHA-256 digest 一致，状态只允许 `DRAFT → PUBLISHED → RETIRED`；发布证据完整性、PUBLISHED/RETIRED immutable、已发布版本禁止删除均由数据库保护。
- 同 Document + locale 的 version label 唯一；同 effectiveAt 的 PUBLISHED Version 唯一，允许未来生效版本与当前发布版本共存，并为后续 Public current 查询建立稳定索引。
- supersedes 使用同 Document/locale 的复合 FK 和 Trigger 双层保护，只能指向已发布或已退休版本，禁止跨 Document、跨 locale、自引用或引用 DRAFT。
- UserConsent 只接受 PUBLISHED/RETIRED Version 与完全匹配的 digest snapshot；evidence 必须为非空 JSON object，Consent 由 Trigger 强制 append-only。
- down migration 在存在 Consent 或 PUBLISHED/RETIRED 审计事实时 fail closed；只有未形成发布/同意事实的空底座或 DRAFT 数据允许回滚。
- 本机 PostgreSQL 实际监听 `5432`，旧 Gate 地址 `54329` 已失效；同时仅修正隔离 `_test` 库 `control_plane` Schema owner 后完成验证，未修改正式数据库。
- Gate：Terms 定向 8/8 PASS；migration 001～011 chain 联合 2 files / 9 tests PASS；Control API 全量单 worker 26 files / 124 tests PASS；typecheck、build、定向 ESLint、Prettier、Governance、`git diff --check` PASS。
- B 独占目录 tracked diff 为零；`apps/storycanvas/data/vendor/byteplus.ts` 继续未修改、未暂存。
- 当前状态：`A_BIZ_02_1A_COMPLETE / READY_TO_COMMIT`。
- 下一步：独立提交 migration 011；随后进入 02.1B Terms Repository / Service，先冻结纯领域错误、current 选择、发布事务与 Consent 写入测试。

## 2026-08-07 A-BIZ-02.1B Terms Repository / Service 完成

- Test-first RED 已确认：`service.test.ts` 与 `repository.postgres.test.ts` 首次因 `errors.js`、`repository.js` 等领域模块不存在而按预期失败，随后才补最小实现。
- 新增 Terms 领域类型、稳定错误、UTF-8 SHA-256 摘要、`TermsService` 与 `PostgresTermsRepository`；不接收客户端 digest、发布人或发布时间等服务端事实。
- 所有 Terms 写操作使用事务和统一 Document→Version 锁顺序；发布支持相同命令安全 replay，不同发布事实或同 Document/locale/effectiveAt 竞争统一返回 `409 TERMS_PUBLISH_CONFLICT`。
- 只有 PLATFORM Context 的 `platform_admin` 可以创建、编辑、发布和退休 Terms；CHANNEL、TENANT 及其他角色在调用 Store 前 fail closed。
- Public current 严格选择 active Document、精确 locale、已生效 PUBLISHED Version，并按 effectiveAt/publishedAt/version ID 稳定排序；无 current 由 Service 返回 `503 TERMS_NOT_AVAILABLE`，不回退 DRAFT、RETIRED、旧 locale 或硬编码正文。
- Consent 必须显式接受，只允许 `web/admin/api + explicitAccepted + optional requestId` 最小 evidence；Repository 在事务中锁定 Document、重新选择 current 并校验 Version/digest，过期或伪造快照返回 `409 TERMS_VERSION_STALE`。
- 修正 test-only SHA-256 夹具和按 entity 分配的 UUID 注入器；生产摘要继续使用标准 UTF-8 SHA-256，未为错误 fixture 修改算法。
- Gate：Terms 定向 2 files / 10 tests PASS；Control API 全量单 worker 28 files / 134 tests PASS；typecheck、build、定向 ESLint、Prettier、Governance、`git diff --check` PASS。
- B 独占目录 tracked diff 为零；`apps/storycanvas/data/vendor/byteplus.ts` 继续未修改、未暂存、未提交。
- 当前状态：`A_BIZ_02_1B_COMPLETE / READY_TO_COMMIT`。
- 下一步：02.1B 独立提交后进入 02.1C HTTP API；`apps/control-api/src/app.ts` 作为共享 bootstrap 只在独立小提交中修改，并通知 B 同步。

## 2026-08-07 A-BIZ-02.1C Terms HTTP API / Bootstrap 完成

- Test-first RED 已确认：`routes.test.ts` 首次因 `./routes.js` 不存在而失败；共享 Bootstrap 测试在接线前稳定返回 404，随后才实现 Router 与挂载。
- 新增 Public current API：无需登录，严格要求 `documentCode` 与 `locale`，只返回冻结的注册展示字段并设置 `cache-control: no-store`；不返回发布人、发布时间、内部审计或 Consent 统计。
- 新增 PLATFORM Terms 管理 API：创建 Document、创建/更新 DRAFT、发布与退休 Version；未知字段和客户端提交的 digest、发布人、发布时间等服务端事实统一以 `400 INVALID_TERMS_REQUEST` 拒绝。
- 管理 API 复用真实 Session resolve/rotation；无 Cookie 返回 401、失效 Session 返回 401，非 PLATFORM 或无 `platform_admin` 在调用 Terms Service 前返回 403。
- 冻结错误边界：非法输入 400、资源不存在 404、状态/发布冲突 409、无 current 503；未知异常继续交给全局 500 Handler，不向客户端泄漏内部错误文本。
- 发布首次返回 201，安全 replay 返回 200；发布和退休均通过 `idempotency-replayed` 暴露稳定 replay 事实。
- `server.ts` 完成 `PostgresTermsRepository → TermsService → createTermsRouter → createApp` 组装；Terms Router 独立挂载在 `/api/v1`，不复用 Tenant Project Scope。
- Gate：Router/Bootstrap 定向 2 files / 14 tests PASS；Control API 全量单 worker 29 files / 144 tests PASS；typecheck、build、定向 ESLint、Prettier、Governance、`git diff --check` 全部 PASS。
- B 独占目录 tracked diff 为零；`apps/storycanvas/data/vendor/byteplus.ts` 继续未修改、未暂存、未提交。
- 本切片修改共享 `apps/control-api/src/app.ts` 与 `apps/control-api/src/server.ts`，提交后必须通知 B 同步对应 commit。
- 当前状态：`A_BIZ_02_1C_COMPLETE / A_BIZ_02_1_COMPLETE / READY_TO_COMMIT`。
- 下一步：独立提交 02.1C；业务/法务提供正式正文并完成发布审批前，正式 Terms 发布和公开注册继续 fail closed。

## 2026-08-07 A-BIZ-02.2 Invitation 生命周期计划冻结

- A-BIZ-02.1 Terms 已收口，按 `Terms → Invitation → Registration` 进入 A-BIZ-02.2。
- 冻结 PLATFORM 7 天单次定向邀请、CHANNEL 30 天/默认 100 次分享邀请、TENANT_MEMBER 7 天单次 `content_operator` 定向成员邀请。
- 冻结 migration 012 的 Invitation/Usage、版本化 Token digest、服务端 Scope、撤销/过期/耗尽、append-only Usage、并发最后名额和 fail-closed rollback。
- Public Preview 改用 body Token 的 POST 路由，避免 Token 进入 URL/浏览历史/常规 access log；所有无效状态统一 `INVITATION_UNAVAILABLE`。
- 02.2 只建立 Invitation 生命周期和供 Registration 使用的内部消费合同，不开放半成品注册，不创建 User/Tenant/Membership/Consent/Attribution。
- 不新增第三方依赖，复用 Node crypto、PostgreSQL 行锁、现有 Session 与 limiter 模式。
- 详细计划：`A_BIZ_02_2_INVITATION_LIFECYCLE_PLAN.md`。
- B 独占目录继续不修改；`apps/storycanvas/data/vendor/byteplus.ts` 保持未跟踪且不暂存。
- 当前状态：`A_BIZ_02_2_PLAN_FROZEN / READY_FOR_TEST_FIRST_RED`。
- 下一步：独立提交计划；随后新增 migration 012 PostgreSQL 合同测试并确认模块缺失 RED。

## 2026-08-07 A-BIZ-02.2A Invitation Schema 完成

- Test-first RED 已确认：PostgreSQL 合同测试首次因 `012_invitation_lifecycle.js` 模块不存在而按预期失败，随后才实现 migration。
- 新增 `control_plane.invitations` 与 `control_plane.invitation_usages`；不 seed Token、邀请或注册凭据，`registration_id` 暂保留为 02.3 建表前的跨切片事实 ID。
- 数据库双层约束三类邀请：PLATFORM 7 天单次定向邮箱、CHANNEL 30 天且最多 100 次并绑定自身 Channel、TENANT_MEMBER 7 天单次且目标 Role 固定 `content_operator`。
- Token 仅允许 `sha256:v1:<64 lowercase hex>` digest；创建幂等按 issuer Organization 隔离，Invitation identity/scope/time/token 不可变，revoked/exhausted/expired 为不可逆终态。
- Usage 为 append-only 审计事实；插入时行锁 Invitation，重新验证 active/有效期/剩余次数，原子递增 `used_count`，最后名额转为 exhausted，并发竞争只能成功一次。
- rollback 只允许空表；存在 Invitation 或 Usage 事实时 fail closed，避免删除审计证据。
- Gate：Invitation 定向 1 file / 9 tests PASS；与 migration 001～012 chain 联合 2 files / 10 tests PASS；Control API 全量单 worker 30 files / 153 tests PASS / 0 SKIP；typecheck、build、定向 ESLint、Prettier、Governance、`git diff --check` 全部 PASS。
- B 独占目录 tracked diff 为零；`apps/storycanvas/data/vendor/byteplus.ts` 保持未修改、未暂存、未提交。
- 当前状态：`A_BIZ_02_2A_COMPLETE / READY_TO_COMMIT`。
- 下一步：独立提交 02.2A；随后进入 02.2B Domain / Repository / Service，先冻结服务层调用合同并完成 Test-first RED，不提前修改共享 Bootstrap。

## 2026-08-07 A-BIZ-02.2B Invitation Domain / Repository / Service 完成

- Test-first RED 已确认：Service 与 PostgreSQL Repository 合同测试首次均因 `invitations/errors.js` 等领域模块不存在而按预期失败，随后才实现最小闭环。
- 新增 32-byte CSPRNG base64url Token、`sha256:v1` digest 和稳定创建请求摘要；数据库与领域对象不暴露明文 Token，首次创建返回一次，安全 replay 返回 `token: null`。
- Service 分别冻结 PLATFORM、CHANNEL、TENANT_MEMBER 创建入口；issuer Membership/Organization、期限、次数、目标 Tenant/Role 均由可信 Actor 派生，邮箱、UUID、幂等键和请求摘要在 Store 前规范化验证。
- 权限严格限制为当前 Scope 的 `platform_admin`、`channel_admin`、`tenant_admin`；列表、撤销均绑定当前 issuer Organization，错误角色在调用 Repository 前 fail closed。
- Repository 在事务内实现创建 replay/conflict；CHANNEL attribution Channel 由当前 Organization 反查派生，客户端不能覆盖。列表对已过期但尚未物化状态的记录安全投影为 expired。
- Public Preview 只以原始 Token 进入 Service；畸形、不存在、撤销、过期或耗尽统一为 `INVITATION_UNAVAILABLE`，Store 和返回对象均不暴露 Token digest。
- Registration 内部消费合同在同一事务锁定 Invitation，先处理安全 replay，再复核目标邮箱、active、有效期和剩余次数，最后写入 append-only Usage；相同命令不重复计数，不同事实复用幂等键返回稳定冲突。
- Gate：02.2B 定向 2 files / 14 tests PASS；Control API 全量单 worker 32 files / 167 tests PASS / 0 SKIP；typecheck、build、定向 ESLint、Prettier、Governance、`git diff --check` 全部 PASS。
- B 独占目录 tracked diff 为零；`apps/storycanvas/data/vendor/byteplus.ts` 保持未修改、未暂存、未提交。
- 当前状态：`A_BIZ_02_2B_COMPLETE / READY_TO_COMMIT`。
- 下一步：独立提交 02.2B；随后进入 02.2C HTTP API / Bootstrap，先写 Public Preview、三 Scope 管理路由、Session/限流/错误映射和 Bootstrap 合同测试，再单独修改共享 `app.ts` / `server.ts` 并通知 B。

## 2026-08-07 A-BIZ-02.2C Invitation HTTP API / Bootstrap 完成

- Test-first RED 已确认：`routes.test.ts` 与 `previewRateLimiter.test.ts` 首次因 Router/Limiter 模块不存在而失败，Config/Bootstrap 合同也在字段与挂载实现前失败，随后才实现最小闭环。
- 新增 Public Preview：`POST /api/v1/public/invitations/preview` 只从严格 body 接收 Token，统一设置 `cache-control: no-store`；不把 Token 放入 URL，不返回目标邮箱、issuer Membership、撤销人、幂等事实或 Token digest。
- Preview 对畸形、不存在、撤销、过期和耗尽继续统一返回 `404 INVITATION_UNAVAILABLE`；按来源地址与 Token 的 SHA-256 不可逆组合键执行可注入内存限流，稳定返回 `429 INVITATION_RATE_LIMITED` 与 `retry-after`。
- 新增 PLATFORM、CHANNEL、TENANT 三 Scope 的创建/列表 API 和 issuer Scope 撤销 API；所有 body 使用严格白名单，客户端不能提交 issuer、期限、次数、Role、状态、digest 或审计事实。
- 管理 API 复用真实 Session resolve/rotation；无 Cookie/失效 Session 返回稳定 401，错误角色返回 403。CHANNEL 路径 ID 由当前 Organization 服务端反查后比对，TENANT 路径同时匹配 Organization/Tenant，无法解析或不匹配均 fail closed。
- 创建首次返回 201 与一次性明文 Token，安全 replay 返回 200、`token: null`；创建和撤销均使用 `idempotency-replayed` 暴露稳定 replay 事实。
- 稳定映射 Invitation 400/403/404/409，未知异常交给全局 500 Handler；Public 与管理响应均使用显式字段白名单，不泄漏数据库 constraint 或内部身份事实。
- Bootstrap 完成 `PostgresInvitationRepository → InvitationService → InvitationPreviewRateLimiter → createInvitationRouter → createApp`；新增三项显式 Preview 限流环境变量，默认值仅用于本地试点，不表述为正式公网安全参数。
- Gate：02.2C 定向 4 files / 27 tests PASS；Control API 全量单 worker 34 files / 181 tests PASS / 0 SKIP；typecheck、build、定向 ESLint、Prettier、Governance、`git diff --check` 全部 PASS。
- B 独占文件 `apps/storycanvas/data/vendor/byteplus.ts` 保持未修改、未暂存、未提交。
- 本切片修改共享 `apps/control-api/src/app.ts` 与 `apps/control-api/src/server.ts`，提交后必须通知 B 同步对应 commit。
- 当前状态：`A_BIZ_02_2C_COMPLETE / A_BIZ_02_2_COMPLETE / COMMITTED`。
- 下一步：通知 B 同步本切片的共享 Bootstrap 提交；随后单独冻结 A-BIZ-02.3 Registration/Consent/Attribution 计划，不在本切片开放半成品注册或真实支付能力。

## 2026-08-08 A-BIZ-02.3 Registration / Consent / Attribution 计划冻结

- 计划文件：`A_BIZ_02_3_REGISTRATION_CONSENT_ATTRIBUTION_PLAN.md`。
- 冻结唯一公开注册端点和 DIRECT、PLATFORM_INVITATION、CHANNEL_INVITATION、TENANT_MEMBER_INVITATION 四种服务端派生路径；不建立独立 C 端 API、Role、Tenant 类型或工作台。
- 冻结 Migration 013：Registration、首次 ReferralAttribution、append-only Attribution Event，并为 02.1 UserConsent 与 02.2 InvitationUsage 的 `registration_id` 收口正式 FK。
- 现有 Terms/Invitation Repository 各自事务不能直接拼接；02.3B 必须建立统一 PostgreSQL Unit of Work，使 User、Organization/Tenant、Membership、Registration、Consent、Usage 与 Attribution 同事务提交或回滚。
- 注册 request digest 使用独立 Secret 的 keyed HMAC，不持久化密码普通摘要、Invitation Token 或邮箱验证 Token；密码继续使用现有 scrypt。
- 邮箱验证只冻结可注入 Port，默认 Bootstrap fail closed；真实 Provider 和正式 Terms 未配置时不宣称公开注册已开放。
- 本节点不自动签发 Session；成功后复用现有登录端点，避免注册事务与 Cookie 生命周期耦合。
- B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 继续不修改、不暂存、不提交；02.3A/02.3B 不碰共享 Bootstrap，02.3C 共享提交再通知 B。
- 当前状态：`A_BIZ_02_3_PLAN_FROZEN / READY_FOR_TEST_FIRST_RED`。
- 下一步：先写 Migration 013 PostgreSQL 合同并确认 RED，再实现最小 Schema；计划独立提交后执行。

## 2026-08-08 A-BIZ-02.3A Registration / Attribution Schema 完成

- Test-first RED 已确认：新增 PostgreSQL 合同首次因缺少 `013_registration_attribution` 模块失败，随后才实现最小 Schema。
- Migration 013 新增 completed-only `registrations`、首次 `referral_attributions` 与 append-only `referral_attribution_events`，不保存失败注册半成品。
- Registration 强制 normalized email、User、idempotency key 唯一，四种 Path 与 Invitation 类型一致，并验证 User/Membership/Tenant 和 released Terms 事实。
- Attribution 必须与 Registration 的 User、Tenant、来源、Invitation 和完成时间一致；Channel 来源必须使用 Invitation 冻结 Channel，保护期严格为 PostgreSQL `interval '12 months'`。
- Registration 与 Attribution 不可更新/删除，Attribution Event 不可更新/删除；每个 User/Registration 仅允许一条首次 Attribution，每条 Attribution 仅允许一个 `created` Event。
- `user_consents.registration_id` 与 `invitation_usages.registration_id` 已收口正式 FK；迁移前存在孤立 Consent/Usage 时 fail closed，不删除、不伪造 Registration。
- 013 down 只允许空事实回滚；存在 Registration、Attribution、Event 或关联 Consent/Usage 审计事实时拒绝破坏性回滚。
- 定向 Gate：Migration 013 + chain 2 files / 11 tests PASS；完整 Control API 单 worker 35 files / 191 tests PASS / 0 SKIP。
- Control API typecheck/build、定向 ESLint、Prettier、Governance、`git diff --check` 全部 PASS。
- B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 保持未修改、未暂存、未提交。
- 当前状态：`A_BIZ_02_3A_COMPLETE / READY_TO_COMMIT`。
- 下一步：独立提交 `feat(control-api): add registration attribution schema`，随后进入 02.3B；先冻结统一事务 Repository/Unit of Work 的 RED，不修改共享 `app.ts` / `server.ts`。

## 2026-08-08 A-BIZ-02.3B Atomic Registration Transaction 完成

- Test-first RED 已确认：Registration Service 首次因领域模块缺失失败，PostgreSQL Repository 首次因 `repository.js` 缺失失败，随后才补最小实现。
- 新增 Registration Domain/Service：email 规范化、12～1024 字符密码边界、显式 Terms 接受、四种路径输入约束、可注入 Email Verification Port 与默认 fail-closed Adapter。
- Invitation Token 复用现有版本化 digest；注册 request digest 使用独立 Secret 的 HMAC-SHA-256，Secret 少于 32 bytes 拒绝启动；Store 不接收明文密码、邮箱验证 Token 或 Invitation Token。
- 新增统一 PostgreSQL Registration Unit of Work：按幂等键和 normalized email 加事务级 advisory lock，并在单事务内完成 User、Organization/Tenant、Membership、Registration、Consent、Invitation Usage、首次 Attribution 与 created Event。
- DIRECT、PLATFORM、CHANNEL 创建独立 Tenant 和 legacy tenant_admin Membership；TENANT_MEMBER 只加入邀请目标 Tenant，不创建第二个 Tenant。
- Terms 与 Invitation 新增 transaction-bound helper，由 Registration Repository 在同一 Knex Transaction 中锁定 current Terms、Invitation 并写 Consent/Usage，未嵌套原 Repository 的独立事务。
- 相同幂等键和相同 request digest 安全 replay；不同 digest、已有 User、stale Terms、不可用 Invitation 和数据库约束冲突稳定 fail closed，不泄漏数据库细节。
- Channel Attribution 使用 Invitation 冻结 Channel，`protected_until` 严格由 PostgreSQL `completedAt + interval '12 months'` 计算；晚期 Attribution 失败会回滚 Invitation Usage、usedCount 及所有前置写入。
- 定向 Gate：Registration Repository 6/6 PASS；Service/Registration/Terms/Invitation 相邻回归 4 files / 23 tests PASS。
- 完整 Gate：Control API 单 worker 37 files / 202 tests PASS；typecheck、build、定向 ESLint、Prettier、Governance、`git diff --check` 全部 PASS。
- 本切片未修改共享 `apps/control-api/src/app.ts` / `server.ts`，未开放 Public Registration API，也未自动签发 Session。
- B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 保持未修改、未暂存、未提交。
- 当前状态：`A_BIZ_02_3B_COMPLETE / READY_TO_COMMIT`。
- 下一步：独立提交 `feat(control-api): add atomic registration transaction`；随后进入 02.3C Public Registration API / Bootstrap，先写 Router 与 Bootstrap RED，并在修改共享文件前确认 B 同步边界。

## 2026-08-08 A-BIZ-02.3C Public Registration API / Bootstrap 完成

- Test-first RED 已确认：Registration Router/RateLimiter 首次因模块缺失失败；Config/App Bootstrap 测试首次因注册配置与 Router 挂载不存在失败，随后才补最小实现。
- 新增唯一公开端点 `POST /api/v1/public/registrations`，不依赖 Session Cookie；严格白名单拒绝未知字段，并继续受 Control API `1mb` JSON limit 约束。
- 所有 Registration 响应设置 `cache-control: no-store`；首次完成返回 201，安全 replay 返回 200 和 `idempotency-replayed: true`，响应只包含 Registration 安全结果且不签发 Session。
- 稳定映射注册 400/404/409/503、限流 429；未知异常交给全局 500 Handler，不回显密码、邮箱、Token、SQL constraint 或内部错误文本。
- 限流键使用来源地址与 normalized email 的 SHA-256 不可逆组合，不把 email、密码或 Token 直接放入 Map key；单机参数由三项 Registration 环境变量显式配置，多实例正式部署仍需共享限流设施。
- Config 新增独立 `REGISTRATION_IDEMPOTENCY_SECRET`：development/test 使用独立本地默认值，production 必须显式配置且不得复用 Session、ProjectGrant 或 production-plane internal Secret。
- Bootstrap 完成 `PostgresRegistrationRepository → RegistrationService → RegistrationRateLimiter → createRegistrationRouter → createApp`；默认注入 `UnavailableEmailVerification`，正式 Provider 未接入时端点稳定 503、零数据写入，不宣称公网注册已开放。
- `.env.example` 与 Control API README 已同步 Public Registration、Secret、限流、无自动登录和 fail-closed Provider 边界。
- 定向 Gate：Router/RateLimiter 2 files / 15 tests PASS；Router/Config/App/Service 5 files / 38 tests PASS。
- 完整 Gate：Control API 单 worker 39 files / 220 tests PASS；typecheck、build、定向 ESLint、Prettier、Governance、`git diff --check` 全部 PASS。
- 本切片修改共享 `apps/control-api/src/app.ts` / `server.ts`；提交后必须通知 B 同步对应 commit。
- B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 保持未修改、未暂存、未提交。
- 当前状态：`A_BIZ_02_3C_COMPLETE / A_BIZ_02_3_COMPLETE / READY_TO_COMMIT`。
- 下一步：独立提交 `feat(control-api): expose public registration api` 并通知 B 同步；随后重新基于最新任务文档规划 A-BIZ-02.4，不提前实现真实邮箱 Provider、注册页面、自动登录或支付。

## 2026-08-08 A-BIZ-02.4 注册/邀请/须知前端计划冻结

- 基于 `fe76f0c` 与当前 A/B 共创文档，冻结 02.4 为 `Public API Client → Registration State/UI → Router/Login 接线 → 联合 Gate` 四个切片。
- 唯一前端注册入口为 `/register`，直接、PLATFORM、CHANNEL、TENANT_MEMBER 四种来源继续只调用 `POST /api/v1/public/registrations`；客户端不得提交 Role/Tenant/Channel/Attribution 事实。
- 正式 Terms 和 Email Verification Provider 缺失不阻塞前端底座开发，但真实页面必须 fail closed；禁止占位条款、Fake Provider、手工 Token 输入或 Demo fallback 冒充已开放注册。
- Invitation Token 首次从查询参数读取后必须清理地址栏，只保存在组件内存并仅发送给 Preview/Registration；密码、验证 Token、幂等键不得进入 URL、Storage 或日志。
- 02.4A 先新增严格 Public Registration API Client 与 RED/Green 测试，不修改共享 Router；02.4C 修改 `src/app/Router.tsx` 时独立提交并通知 B。
- B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 继续保持未修改、未暂存、未提交。
- 当前状态：`A_BIZ_02_4_PLAN_FROZEN / READY_FOR_02_4A_RED`。

## 2026-08-08 A-BIZ-02.4A Public Registration API Client 完成

- Test-first RED 已确认：首次运行因 `./publicRegistrationApi` 模块不存在而失败，随后才补最小 Client 实现。
- 新增严格 Public Terms、Invitation Preview 与 Registration Client；仅在合法 Pilot Runtime 下访问 Control API，所有请求使用 `credentials: include`，但不读取或依赖 Session Cookie。
- 成功响应严格校验字段白名单、UUID、日期、SHA-256、枚举与计数；畸形或过宽响应统一 fail closed 为 `INVALID_API_RESPONSE`。
- Registration 请求只发送白名单字段；可选字段为 undefined 时不发送；Invitation Token 仅放 Preview/Registration JSON body，不进入 URL、LocalStorage、SessionStorage 或日志。
- 错误只保留安全 code/status/requestId/retry-after；服务端原始错误文本不得反射密码、邮箱、Invitation Token 或其他敏感内容。
- 201 首次成功与 200 幂等 replay 均已覆盖；Client 不自动登录、不写 Session、不伪造 Terms 或 Email Verification 成功。
- 定向 Gate：`src/services/publicRegistrationApi.test.ts` 1 file / 8 tests PASS；ESLint、Prettier、Governance、`git diff --check`、Root build PASS。
- Root 全量串行结果为 32 files PASS、3 files 首轮失败，249/256 tests PASS；失败集中于既有 BrandBrain、ScriptEditor 与 app smoke 超时/时序。三个失败文件随后逐一串行复跑全部通过：5/5、8/8、11/11，确认与本切片独立 Service 无功能回归关联。
- 本切片未修改共享 Router，也未修改、暂存或提交 B 的 `apps/storycanvas/data/vendor/byteplus.ts`。
- 当前状态：`A_BIZ_02_4A_COMPLETE / READY_TO_COMMIT`。
- 下一步：独立提交 `feat(web): add public registration api client`；随后进入 02.4B Registration State/UI，先写 Terms、Invitation、校验、提交与成功/失败状态测试并确认 RED，Router 接线继续保留到 02.4C。

## 2026-08-08 A-BIZ-02.4B Registration State / Page 完成

- Test-first RED 已确认：`RegistrationPage.test.tsx` 首次因目标页面模块不存在而失败，随后才补最小页面与状态实现。
- 新增可注入 Public Registration API 与 Email Verification Evidence Port 的统一注册页；生产默认 Evidence Port 明确 unavailable，不生成 Fake Token、不调用 Registration API。
- 页面覆盖 Terms loading/unavailable/reload、Invitation preview/loading/unavailable/显式切换直接注册、字段与密码确认、明确勾选、提交禁用和安全错误展示。
- DIRECT、PLATFORM/CHANNEL 与 TENANT_MEMBER 继续进入同一页面/同一提交函数；成员邀请不渲染或提交 Tenant 名称，客户端不提交 Role/Organization/Channel 事实。
- 同一未变更注册意图的重试复用内存幂等键；影响事实的字段变化会生成新意图；进行中重复点击被禁止，201 与 200 replay 进入同一成功页。
- Terms stale 会重新读取当前版本、清除接受勾选和密码字段并要求重新确认；通用冲突不枚举邮箱存在/停用，429 展示 retry-after，503 Verification 保持失败状态。
- 成功页不写 Session、不自动登录、不展示敏感 Token，只通过注入的 `onLogin` 显式进入现有登录入口。
- 定向联合 Gate：Registration 12/12、Public Client 8/8、Pilot Login 1/1，共 3 files / 21 tests PASS；TypeScript/Vite build、ESLint、TS/TSX Prettier、Governance、diff-check PASS。
- Root 全量串行并发：33 files PASS / 3 files FAIL，264/268 tests PASS；本切片 Registration 12/12 全部通过。剩余 4 项为既有 app smoke 1 项、Pilot Login 1 项和 B ScriptEditor 2 项的 5 秒超时；对应文件此前定向/联合运行通过，未发现功能回归。
- 本切片未修改共享 Router、LoginPage 或 B 文件；`apps/storycanvas/data/vendor/byteplus.ts` 继续未修改、未暂存、未提交。
- 当前状态：`A_BIZ_02_4B_COMPLETE / READY_TO_COMMIT`。
- 下一步：独立提交 `feat(web): add fail-closed registration page`；随后进入 02.4C，先写 Router/Login RED，再以独立共享提交接入 `/register`、清理 Invitation 查询 Token 并通知 B。

## 2026-08-08 A-BIZ-02.4C Public Registration Router / Login 接线完成

- Test-first RED 已确认：Pilot Router 首次没有 `/register` 路由，LoginPage 也没有注册入口；新增合同测试在实现前按预期失败。
- Pilot 新增公开 `/register`，位于 `PilotRequireSession` 外；Demo 四身份登录与 Demo Router 保持原样，不展示注册入口。
- Router 仅在首次挂载时读取 `?invitation=<token>`，随后使用 replace 从地址栏删除该参数；Token 继续只存在 `PilotRegistrationEntry → RegistrationPage` 的组件内存，不进入 Storage、日志或后续 URL。
- 匿名用户可从 Pilot Login 的“创建账号”进入注册页；注册成功只通过 `onLogin` replace 返回 `/login`，不自动签发或伪造 Session。
- 已登录用户访问 `/register` 时等待真实 Project Context，并通过现有 `pilotDefaultPath` 跳转到合法默认 Project；不进入注册页、不回退 Demo。
- Router/Login 定向 2 files / 14 tests PASS；与 Registration Page/Public Client 联合 4 files / 34 tests PASS。
- Root build、定向 ESLint、Prettier、Governance、`git diff --check` PASS。Root 全量为 34 files PASS / 2 files FAIL、269/273 tests PASS；4 项失败均为既有 app smoke/ScriptEditor 5 秒并发超时，两文件随后单独复跑 11/11、8/8 PASS。
- 本切片修改共享 `src/app/Router.tsx` 与 `src/pages/auth/LoginPage.tsx`；提交后 B 必须同步该独立提交再继续改共享 Router/Login。
- B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 保持未修改、未暂存、未提交。
- 当前状态：`A_BIZ_02_4C_COMPLETE / A_BIZ_02_4_COMPLETE / READY_TO_COMMIT`。
- 下一步：独立提交 `feat(web): wire public registration route`，通知 B 同步；正式 Terms 与 Email Verification Provider 仍未交付，真实注册继续 fail closed，不宣称已开放公网注册。

## 2026-08-08 A-BIZ-03.1 TEST Recharge / Payment Foundation 计划冻结

- 基于已接受的 A-BIZ-00.3 ADR 和已完成的 A-BIZ-02，下一节点进入 TEST Recharge/Payment，不接真实支付。
- 基线确认：migration 001 已有 Tenant Wallet、Reservation 与 append-only Credit Ledger，但没有 RechargeOrder、PaymentEvent、转换 Rule、Provider Port 或充值发行链路；注册事务也不自动创建 Wallet。
- 计划拆为 03.1A migration 014 Schema、03.1B Domain/Repository/TEST Adapter、03.1C HTTP API/Bootstrap 三个独立提交。
- 03.1 只建立现金事实和 Payment Inbox；Payment Event 在本节点仅持久化为 `received`，订单 paid、Credit issuance 与 Commission 必须留给 03.2 原子处理，避免半到账。
- 无正式 SKU/金额/币种/退款周期时不 seed Rule；测试 fixture 必须显式 `TEST`，LIVE Adapter 默认 unavailable 且不回退 TEST。
- Migration 必须保护 Order/Wallet/Tenant、Buyer Membership、Rule 金额币种、Provider identity、TEST/LIVE 隔离、append-only evidence 和 fail-closed rollback。
- 计划文件：`A_BIZ_03_1_RECHARGE_PAYMENT_FOUNDATION_PLAN.md`。
- B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 继续不修改、不暂存、不提交；03.1A/03.1B 不碰共享 Bootstrap。
- 当前状态：`A_BIZ_03_1_PLAN_FROZEN / READY_FOR_03_1A_RED`。
- 下一步：独立提交计划，然后新增空 migration 014 与 PostgreSQL 合同测试，确认有效 RED 后再实现最小 Schema。

## 2026-08-08 A-BIZ-03.1A Recharge / Payment Schema 完成

- Test-first RED 已确认：空 Migration 014 下 9 项 PostgreSQL 合同中 8 项因四张目标表不存在稳定失败；Fixture 和 001～013 基线可正常建立，不是测试环境或依赖故障。
- 新增 `credit_conversion_rule_versions`、`recharge_orders`、append-only `recharge_order_events` 和 `payment_events` Inbox；Migration 不 seed TEST/LIVE Rule，不开放真实支付。
- Wallet 增加 `(wallet_id, tenant_id)` 复合唯一键，Order 使用复合 FK；数据库同时校验 Buyer Membership/User/Tenant Organization，拒绝跨 Tenant Wallet 和身份组合。
- Rule 使用整数 minor amount、三位大写 currency、purchased/bonus credit 与 bonus expiry 约束；ACTIVE/RETIRED Rule 必须由 active PLATFORM `platform_admin` 审批，转换事实不可变。
- Order 冻结 Rule 的 mode、金额、币种、购买额度、赠送额度和到期天数；幂等键按 Tenant 唯一，request digest 只接受 64 位小写十六进制。
- Payment Event 强制 Provider identity 唯一、与 Order 的 TEST/LIVE、金额和币种一致；原始事实不可更新/删除，处理状态只允许 `received → applied|rejected`。
- Order 状态只允许单向合法迁移；Order Event 为 append-only，并要求事件类型对应当前 Order 状态、支付驱动事件引用同一 Order 的 Payment Event。
- 空事实允许 rollback；存在 Rule/Order/Payment/Event 任一审计事实时 fail closed。Migration chain 已扩展为 001～014，重复 latest 为 no-op。
- Gate：Migration 014 + chain 2 files / 10 tests PASS；Control API 全量单 worker 40 files / 229 tests PASS；typecheck、build、ESLint、Prettier、Governance、`git diff --check` 全部 PASS。
- 本切片未修改共享 Bootstrap、前端或 B 独占源码；`apps/storycanvas/data/vendor/byteplus.ts` 保持未修改、未暂存、未提交。
- 当前状态：`A_BIZ_03_1A_COMPLETE / COMMITTED`。
- 下一步：独立提交 `feat(control-api): add recharge payment foundation schema`，随后进入 03.1B，先冻结 Domain/Repository/TEST Adapter 合同并完成 Test-first RED。

## 2026-08-08 A-BIZ-03.1B TEST Payment Domain / Repository 完成

- Test-first RED 已确认：Service 合同首次因 `payments/errors.js` 等领域模块缺失失败；PostgreSQL Repository 合同首次因 `payments/repository.js` 缺失失败，随后才补最小实现。
- 新增 `PaymentFoundationService`：仅 active Tenant Context 的 `tenant_admin` 可创建订单；Tenant/User/Membership/Rule/idempotency 事实规范化后使用独立、至少 32 bytes Secret 的 HMAC-SHA-256 计算 request digest。
- 客户端只能选择显式 `TEST` 的 Rule Version 和 idempotency key，不能传 Wallet、金额、币种、额度或 Attribution；LIVE 订单创建默认 503 fail closed。
- 新增 `PaymentProvider` Port、`TestPaymentAdapter` 与 `UnavailableLivePaymentAdapter`；TEST Adapter 只输出 allowlist 安全字段，签名、密钥和原始敏感 payload 不进入 Store，LIVE 不回退 TEST，Provider mode 错配在验证前拒绝。
- PostgreSQL Repository 使用事务级 advisory lock 串行化 Tenant order key、Tenant Wallet 与 Provider event identity；锁定 active Tenant Membership、ACTIVE TEST Rule、Wallet 和 RechargeOrder。
- Tenant 尚无 Wallet 时在事务内安全创建 active `AI_VIDEO_CREDIT` Wallet；Rule 的 amount/currency/purchased/bonus facts 冻结到 RechargeOrder，并同步追加唯一 `created` Order Event。
- 同 Tenant + idempotency key + digest 安全 replay，不同 digest 稳定 409；同 Provider identity + event digest 安全 replay，不同 digest 稳定 409。
- Payment Event 先经 Provider 规范化，再只以 `received` 写入 Inbox；Repository 明确不更新 Order paid、不追加 Credit Ledger、不建立或计提 Commission。
- RED 后定向 Gate 为 2 files / 20 tests PASS；最终 Control API 单 worker 42 files / 249 tests PASS。typecheck、build、定向 ESLint、Prettier、Governance、`git diff --check` PASS。
- 本切片未修改共享 `app.ts` / `server.ts` / `config.ts`、前端或 B 独占源码；B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 保持未修改、未暂存、未提交。
- 当前状态：`A_BIZ_03_1B_COMPLETE / COMMITTED / READY_FOR_03_1C_RED`。
- 下一步：进入 03.1C HTTP API / Bootstrap，先建立 Router/Bootstrap RED；共享接线必须独立提交并通知 B。

## 2026-08-08 A-BIZ-03.1C TEST Recharge / Payment HTTP API 完成

- Test-first RED 已确认：`payments/routes.test.ts` 首次因 `./routes.js` 不存在稳定失败，随后才实现 Router 与 Bootstrap。
- 新增 `POST/GET /api/v1/tenants/:tenantId/recharge-orders`：只允许当前 Tenant 的 `tenant_admin` 创建和查询明确 TEST 的 RechargeOrder；跨 Tenant 返回 404，同 Tenant 缺角色返回 403。
- 创建 body 严格只接受 `paymentMode=TEST`、`conversionRuleVersionId`、`idempotencyKey`；Wallet、金额、币种、额度与 Attribution 继续由服务端冻结。首次创建 201、安全 replay 200，不同 digest 409。
- 新增 `POST /api/v1/internal/payments/test/events`：只接受独立 `X-Test-Payment-Internal-Token`，浏览器 Session 不能冒充 Provider；首次 Inbox 写入 202、安全 replay 200、identity 冲突 409，LIVE 继续 503 fail closed。
- 新增 `GET /api/v1/platform/payment-events`：只允许 Platform `platform_admin` 查询安全 allowlist Inbox；Tenant 探测返回 404。所有 Payment 响应使用 `cache-control: no-store`。
- Repository 新增按 Tenant 隔离的 RechargeOrder bounded list 与 Platform PaymentEvent bounded list，均按时间/ID newest-first；PostgreSQL 合同覆盖跨 Tenant 不泄漏和 limit。
- Bootstrap 新增独立 `RECHARGE_PAYMENT_DIGEST_SECRET`、`TEST_PAYMENT_INTERNAL_TOKEN`；production 必须显式配置且至少 32 bytes，并与 Session、ProjectGrant、production-plane、Registration Secret 及彼此独立。
- 当前仍只创建 `created` Order 和 `received` PaymentEvent；不标记 paid、不写 Credit Ledger、不发行额度、不计算 Commission。
- Gate：Router/Service 2 files / 27 tests；Repository PostgreSQL 1 file / 9 tests；Control API 全量 43 files / 268 tests PASS；typecheck、build、ESLint、Prettier、Governance、`git diff --check` 全 PASS。
- 共享 `apps/control-api/src/app.ts`、`server.ts`、`config.ts` 已修改；本切片提交后 B 在继续共享 Control API Bootstrap 前必须同步。B 的 `apps/storycanvas/data/vendor/byteplus.ts` 保持未修改、未暂存、未提交。
- 当前状态：`A_BIZ_03_1C_COMPLETE / COMMITTED`。
- 提交：`feat(control-api): expose test recharge payment api`。下一步先冻结 A-BIZ-03.2 Payment Event 原子应用、Order paid、Credit issuance 与 Commission 边界。

## 2026-08-08 A-BIZ-03.2 原子到账与额度发行计划

- 已确认 A-BIZ-03.1A～03.1C 合入并推送 `main@baae8ef`；B Production Plane 既有合并保持不变。
- 下一节点冻结为 A-BIZ-03.2：TEST `payment_succeeded` 在单一 PostgreSQL 事务中完成 PaymentEvent applied、RechargeOrder paid、Credit Lot 和 Credit Ledger issue。
- migration 015 将增加 Credit Lot、Ledger Lot 关联与 PaymentEvent processed evidence；购买额度不过期，赠送额度使用订单冻结天数计算到期。
- 本节点不实现 LIVE Provider、Commission、退款/拒付冲正、真实 SKU 数字或前端真实收款表述。
- `payment_failed`、`refund_succeeded`、`chargeback_succeeded` 在对应状态机完成前稳定 rejected，不猜测、不发行负额度。
- 下一步：先写 migration 015 PostgreSQL RED 合同测试，再实现 Schema。

## 2026-08-08 A-BIZ-03.2A Atomic Credit Issuance Schema

- migration 015 已新增 Credit Lot、Credit Ledger Lot FK、PaymentEvent processedAt 与 terminal evidence 约束。
- Lot/发行 Ledger 必须匹配冻结 Order、Payment Event、Tenant、Wallet、Rule、额度、Provider 与时间；来源事实 append-only。
- 购买额度批次不过期；赠送额度批次严格使用订单冻结 `bonusExpiresInDays`，没有在工程代码中写真实 SKU 数字。
- rollback 在存在发行证据时 fail closed；历史无 Lot 的 Pilot Ledger 保持兼容。
- Gate：015 定向 5/5；migration chain + 015 6/6；Control API 全量 44 files / 273 tests PASS；typecheck、build、定向 ESLint、Governance、diff check PASS。
- 下一步：03.2B Repository/Service 原子应用，先写 succeeded/replay/concurrency/unsupported/rollback RED。

## 2026-08-08 A-BIZ-03.2B TEST Payment 原子应用完成

- Repository 已把 TEST `payment_succeeded` 在单一 PostgreSQL 事务内应用为 PaymentEvent `applied`、RechargeOrder `pending → paid`、purchased/bonus Credit Lot 与逐 Lot append-only Ledger issue。
- 同 Provider identity 串行/并发 replay 不重复；同 Order 的不同 succeeded Event 只允许一个 applied，另一个稳定 rejected / `invalid_order_state`。
- `payment_failed`、refund、chargeback 等未支持事件稳定 rejected / `unsupported_event_type`；冻结 Wallet 稳定 rejected / `wallet_unavailable`，不改变 Order、不发行额度。
- 中途 Ledger ID 失败合同证明 Event、Order、Order Event、Lot 与 Ledger 全部回滚，无半到账。
- PaymentEvent 安全投影新增 `processedAt`；Service 与既有 Route mock 已同步 terminal Store 结果，LIVE 仍 503 fail closed。
- RED：新增原子行为 6 项全部按旧 Inbox-only 行为失败；Green：Repository PostgreSQL 13/13、Service/Route 27/27、Control API 全量 44 files / 277 tests PASS。
- typecheck、build、定向 ESLint、Prettier、Governance、`git diff --check` 全 PASS。
- B 的 `apps/storycanvas/data/vendor/byteplus.ts` 保持未修改、未暂存、未提交；本切片未修改共享 Bootstrap。
- 当前状态：`A_BIZ_03_2B_COMPLETE / READY_TO_COMMIT`。
- 下一步：独立提交 `feat(control-api): apply test payments atomically`，随后进入 03.2C HTTP terminal 语义与安全发行摘要。

## 2026-08-08 A-BIZ-03.2C HTTP 终态与安全发行摘要完成

- Internal TEST Payment Event endpoint 现在同步返回 Repository 的 terminal 结果：首次 `applied` 或 `rejected` 均为 HTTP 200；安全 replay 仍为 200，并通过 `Idempotency-Replayed` 区分。
- 响应明确包含 `paymentMode: TEST`、`processingStatus`、`errorCode` 与 `processedAt`，不再使用暗示异步 Inbox 的首次 202，也不把 TEST Event 描述为真实收款。
- Tenant RechargeOrder bounded list 已用 paid 合同验证可安全展示购买额度、赠送额度和赠送到期天数；未暴露 Provider Event identity、digest 或原始 payload，未增加不必要的独立 Credit endpoint。
- RED：新增首次 applied/rejected 两项终态 HTTP 合同，旧实现均因返回 202 按预期失败；Green：Payment Route 13/13。
- Gate：Control API 全量 44 files / 278 tests PASS；typecheck、build、定向 ESLint、Prettier、Governance、`git diff --check` 全 PASS。
- 本切片只修改 Payment Route、Route Test 与 C0 文档；未修改共享 App/Config/Server，B 无需等待同步共享 Bootstrap。
- B 的 `apps/storycanvas/data/vendor/byteplus.ts` 保持未修改、未暂存、未提交。
- 当前状态：`A_BIZ_03_2C_COMPLETE / A_BIZ_03_2_COMPLETE / READY_TO_COMMIT`。
- 下一步：独立提交 `feat(control-api): expose test credit issuance results`；随后先冻结 A-BIZ-03.3 或下一业务节点合同。

## 2026-08-08 A-BIZ-03.3 佣金影子账、冲正与结算草稿计划冻结

- 计划依据：Wave 0 已批准单级直接归因佣金、实际支付净额、版本化 Rule、append-only Reversal、自然月 Settlement Draft，以及不提现、不自动打款。
- 实施顺序：03.3A Migration 016 Schema → 03.3B TEST succeeded 原子计提 → 03.3C TEST 全额安全退款/拒付冲正 → 03.3D Channel/Platform scoped 只读 API → 03.3E TEST Settlement Draft。
- 无归因或归因过期不计提但写 Calculation Outcome；Channel/Rule 不可用进入 `manual_review`，不得套默认佣金比例；多个 ACTIVE Rule 匹配时整个事务 fail closed。
- 退款首版只允许能证明原订单 purchased/bonus Lot 全部未冻结、未消费、未回收的 TEST 全额安全子集；部分退款或额度已使用继续稳定拒绝，等待 A-06 Lot 分摊合同和商业决策。
- Settlement 状态只允许 `draft/reviewed/approved`，数据库禁止 `paid`；不实现 KYC、税务、提现、出款或真实资金承诺。
- 03.3A 只新增 Commission Schema 与 PostgreSQL 合同，不修改共享 App/Config/Server，B 无需为这一切片同步 Bootstrap。
- 权威计划：`A_BIZ_03_3_COMMISSION_REVERSAL_SETTLEMENT_PLAN.md`；当前基线：`857c2cf`。
- 当前状态：`A_BIZ_03_3_PLAN_FROZEN / READY_FOR_03_3A_RED`。

## 2026-08-08 A-BIZ-03.3A Commission Shadow Ledger Schema 完成

- Migration 016 已建立版本化 Commission Rule、Calculation Outcome、Accrual、Reversal、Settlement 与 Settlement Item 六张空表，不 seed 任何 TEST/LIVE Rule。
- Rule 审批、生命周期、有效窗口不重叠与核心计算事实不可变由 PostgreSQL trigger 保护；佣金金额使用整数比例和显式舍入。
- Outcome/Accrual/Reversal/Settlement Item append-only；数据库校验 Payment/Order/Attribution/Channel/Rule、金额、币种、事件时间、观察期和累计冲正一致性。
- Settlement 只允许 `draft/reviewed/approved`，Platform Admin 才能创建/审核/批准，数据库禁止 `paid`；空 Schema 可回滚，存在审计事实时 rollback fail closed。
- RED 证据：Migration 016 空骨架下 7/7 因表不存在失败；Green：016 定向 7/7、migration chain 联合 8/8、Control API 全量 45 files / 285 tests PASS。
- typecheck、build、定向 ESLint、Prettier、Governance、`git diff --check` 全 PASS。
- 本切片未修改 Payment Repository、HTTP 或共享 Bootstrap；B 无需为 03.3A 同步共享入口，`apps/storycanvas/data/vendor/byteplus.ts` 继续排除。
- 当前状态：`A_BIZ_03_3A_COMPLETE / READY_FOR_03_3B_PLANNING`。
- 下一步：先冻结 03.3B succeeded Payment 原子佣金计提的 Repository/事务/失败语义，再写 RED；真实比例继续未授权。

## 2026-08-08 A-BIZ-03.3B TEST Payment 原子佣金计提计划冻结

- 权威细化计划：`A_BIZ_03_3B_ATOMIC_COMMISSION_ACCRUAL_PLAN.md`。
- 成功路径将在现有 Payment/Order/Credit 同一事务内，先把 Order/PaymentEvent 更新为 `paid/applied`，再追加 Calculation Outcome，并在唯一合法 Rule 时追加 Accrual；Commission 写入失败必须回滚全部事实。
- 无 Attribution 写 `not_attributed`；过期写 `attribution_expired`；Attribution/Channel/Rule 不可用写 `manual_review`；任何场景都不使用默认佣金比例。
- LIVE、unsupported Event、refund/chargeback、HTTP 佣金查询与 Settlement 不在 03.3B 范围。
- 下一动作：新增独立 PostgreSQL RED 合同，覆盖 accrued、无归因、过期、Channel/Rule 不可用、replay、并发、多 Rule 冲突和 Commission 中途失败。

## 2026-08-08 A-BIZ-03.3B TEST Payment 原子佣金计提完成

- 新增 `payments/commissionCalculation.ts`：使用 canonical JSON + SHA-256 冻结计算证据，并以 BigInt 执行 FLOOR/CEILING/HALF_UP 整数 minor-unit 计算。
- TEST `payment_succeeded` 现在在现有 Payment/Order/Credit 同一事务内先完成 `paid/applied`，再为每个 applied Event 追加唯一 Calculation Outcome；仅在冻结直接 Attribution、active Channel Organization 与唯一 ACTIVE TEST Rule 同时成立时追加 Accrual。
- 无归因写 `not_attributed`；过期写 `attribution_expired`；Attribution、Channel 或 Rule 不可用写 `manual_review`；多个匹配 Rule 明确 fail closed，任何 Commission 写入失败回滚 Payment、Order、Lot、Ledger 与 Commission 全部事实。
- RED→Green：9 个新 PostgreSQL 场景先按实现缺失失败，Repository 最终 22/22；纯计算 6/6。
- 完整 Gate：Control API 46 files / 300 tests；typecheck、build、ESLint、Prettier、Governance、diff check 全 PASS。
- 本切片未修改共享 Bootstrap/HTTP，也未触碰 StoryCanvas；下一步先规划 A-BIZ-03.3C，只处理能证明 Credit Lot 可完整回收的 TEST 全额 refund/chargeback 冲正安全子集。

## 2026-08-08 A-BIZ-03.3C TEST 全额退款/拒付原子冲正计划冻结

- 权威细化计划：`A_BIZ_03_3C_FULL_TEST_REVERSAL_PLAN.md`；实现基线 `61e8b67`。
- 03.3C 只支持 TEST 全额 refund/chargeback：PaymentEvent、全 Lot reclaim、可选 Commission Reversal、Order 与 OrderEvent 必须处于单一事务。
- 可回收证明采用最保守边界：Lot/issue 完整匹配，Wallet 不得存在任何非 issue Ledger 或任何历史 Reservation，Lot 不得已 reclaim，Accrual 不得已 reversal。
- 部分退款保存为 `rejected / partial_refund_unsupported`；无法证明额度安全时为 `credit_reclaim_unsafe`；Commission 冲突为 `commission_reversal_conflict`，不实现近似冲正。
- Migration 017 将增加 `reclaim` Ledger operation、Lot-linked reclaim 约束、PaymentEvent 审计码并补强 Reversal 必须引用 applied TEST 全额 Event。
- 本切片不涉及 LIVE、真实 Provider 退款、负余额、跨 Lot 分摊、HTTP 新接口、Settlement 或 StoryCanvas。
- 当前状态：`A_BIZ_03_3C_PLAN_FROZEN / READY_FOR_03_3C_RED`。
- 下一步：先新增 migration 017 空骨架与 PostgreSQL RED 合同，确认因 reclaim/原子 reversal 实现缺失而失败，再进入最小 Green。

## 2026-08-08 A-BIZ-03.3C TEST 全额退款/拒付原子冲正完成

- Migration 017 已增加 `reclaim` Ledger operation、每 Lot 独立 issue/reclaim 唯一性、严格的 applied TEST 全额 reversal 来源校验，并补强 PaymentEvent stable rejected code 与 Commission Reversal 全额约束。
- Payment Repository 现支持 TEST 全额 `refund_succeeded` / `chargeback_succeeded`：PaymentEvent、完整 Lot reclaim、可选 Commission Reversal、Order 终态与 RechargeOrderEvent 位于同一 PostgreSQL 事务。
- refund 将 `paid → refunded`；chargeback 将 `paid → disputed`。原 succeeded Payment 没有 Accrual 时只回收 Credit，不创建虚假 Reversal。
- 安全证明保持最保守边界：Order 必须 paid、Wallet active、Lot/issue 与订单完全一致、Wallet 无任何非 issue Ledger、无任何历史 Credit Reservation、无 applied reversal、Accrual 无既有 Reversal。
- 部分退款稳定 `partial_refund_unsupported`；Credit 证据不足稳定 `credit_reclaim_unsafe`；Commission 冲突稳定 `commission_reversal_conflict`。
- 新增 replay、refund/chargeback 竞争、历史 Reservation、冻结 Wallet、非 paid Order、既有 Commission Reversal、reclaim/Reversal ID 故障全事务回滚合同。
- 定向 Gate：Migration 017 + Repository 2 files / 36 tests PASS；完整 Control API 47 files / 314 tests PASS。
- typecheck、build、ESLint、Prettier、Governance、`git diff --check` 全部 PASS。
- 未修改共享 Bootstrap/HTTP 或 StoryCanvas；`apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交。
- 当前状态：`A_BIZ_03_3C_COMPLETE / COMMITTED / READY_FOR_NEXT_PLANNING`；未收到 push 指令前不 push。

## 2026-08-08 A-BIZ-03.3D Scoped Commission Read APIs 计划冻结

- 权威计划：`A_BIZ_03_3D_SCOPED_COMMISSION_READ_APIS_PLAN.md`；实现基线 `66301c5`。
- Platform Admin 提供全局 Calculation/Accrual/Reversal 和 manual-review bounded list；Channel Admin 仅能读取 canonical 自身 beneficiary Channel。
- Tenant/Content Operator 探测返回 404；跨 Channel 返回 404；同 Scope 缺管理员角色返回 403。
- 响应只包含最小审计投影，禁止 snapshot/digest、Provider payload/secret、审批凭据、Tenant/User/Referral 明细和其他 Channel 数据。
- 03.3D 不创建 Rule、Settlement 或真实资金能力；共享 `app.ts` / `server.ts` 接线必须独立提交并通知 B 同步。
- 下一步：先写 Commission Service/Repository/Router RED，再实现最小 Green。

## 2026-08-08 A-BIZ-03.3D Scoped Commission Read APIs 完成

- 新增独立 `apps/control-api/src/commissions/**`：安全 DTO、稳定 Scope 错误、PostgreSQL 只读 Repository、Service 权限策略与 HTTP Router。
- Platform Admin 可读取全局 Calculation/Accrual/Reversal 和 `manual_review`；Channel Admin 仅能读取 canonical 自身 beneficiary Channel。
- Tenant/Content Operator、错误 Organization 和跨 Channel 统一 404；同 PLATFORM/CHANNEL Scope 缺管理员角色为 403。
- 列表默认 50、最大 100，稳定按 occurredAt 与主键倒序；响应排除 snapshot/digest、Provider payload/secret、内部 Token、审批凭据和 User/Tenant/Referral 明细。
- 核心提交：`957c080`；共享 Bootstrap 提交：`93c48aa`。B 需要在继续共享 `app.ts` / `server.ts` 开发前同步 `93c48aa`。
- 全量 Gate：Control API 50 files / 334 tests PASS；typecheck、build、ESLint、Prettier、Governance、`git diff --check` 全 PASS。
- 未修改 StoryCanvas；`apps/storycanvas/data/vendor/byteplus.ts` 未暂存、未提交。
- 下一步：先独立冻结 A-BIZ-03.3E Settlement Draft 计划；不得把 draft 描述成已到账、可提现或真实 paid。

## 2026-08-08 A-BIZ-03.3E TEST Commission Settlement Draft 完成

- 独立 Migration 018 修复 Reversal Settlement Item validator 的 PL/pgSQL record/alias 重名缺陷；提交 `9b252ee`，定向迁移链/Repository `3 files / 9 tests` PASS。
- Settlement 核心提交 `499dcbb`：Platform Admin TEST-only 月度 Draft、HMAC 幂等、Scope/Period advisory lock、证据重验、eligibleAt/cutoff、跨月负 Reversal、零额 Draft 与安全投影。
- 共享 Bootstrap 提交 `0433fdb`：挂载 `POST /api/v1/platform/commission-settlements`；首次 201、replay 200，并显式返回 `idempotency-replayed`。
- 定向 Gate：Settlement `3 files / 26 tests`，Bootstrap/Router `2 files / 19 tests`；全量 Control API `54 files / 363 tests` PASS。
- typecheck、build、ESLint、Prettier、Governance、`git diff --check` 全 PASS。
- 继续禁止 LIVE Settlement、真实佣金比例、review/approve HTTP 命令、paid、提现、KYC、税务与自动打款。
- B 同步要求：修改共享 `apps/control-api/src/app.ts`、`app.test.ts`、`server.ts` 前同步 `0433fdb`。
- StoryCanvas 未修改；`apps/storycanvas/data/vendor/byteplus.ts` 未暂存、未提交。
- 当前状态：`A_BIZ_03_3E_COMPLETE / A_BIZ_03_3_COMPLETE / READY_FOR_03_4_PLANNING`。

## 2026-08-08 A-BIZ-03.4 Commercial Frontend & Audit 计划冻结

- 权威计划：`A_BIZ_03_4_COMMERCIAL_FRONTEND_AUDIT_PLAN.md`；当前基线 `33b46ed`。
- 冻结为六个原子切片：03.4A Channel Reference/Directory + Strict Client；03.4B Organization Route Policy；03.4C Platform/Channel Commission Audit；03.4D Platform TEST Settlement Draft UI；03.4E Tenant TEST RechargeOrder Audit；03.4F 共享 Pilot Router/Sidebar/Topbar 激活。
- 关键前置合同：新增 `GET /api/v1/channels/current` 安全解析 canonical `channelId`，以及 `GET /api/v1/platform/channels?status=active&limit=100` 提供最小 active Channel Directory；前端禁止猜测 `channelId === organizationId`，也不得从 Commission 记录反推 Channel。
- Pilot 必须按 PLATFORM/CHANNEL/TENANT 分流；所有默认路由、菜单、direct URL 与 returnTo 复用同一 Policy。Platform/Channel 不进入 Tenant Boundary、不显示 Project Selector；Tenant 保留现有 Project Context。
- Demo 与 Pilot 严格隔离；Pilot 只使用 HttpOnly Session Cookie 和真实 Control API，失败时不回退 Mock。401 清 Session 并安全回登录，403 保留 Session，404 不泄漏 Scope，错误展示安全 Request ID。
- Commission 页面只读安全投影；Settlement 页面必须显著标记 `TEST / draft / NON_QUOTE`、非到账、非提现、非 paid；Tenant Recharge 仅 `tenant_admin` 只读，不开放创建或 Conversion Rule UUID 输入。
- 首个 RED：CHANNEL Session 的 `organizationId` 与 canonical `channelId` 使用不同 UUID，`GET /api/v1/channels/current` 必须返回 Repository 解析的 Channel ID；当前预期 `404 ROUTE_NOT_FOUND`。
- 共享 Control API Bootstrap 与共享 Pilot Router/Layout 都必须分别独立 commit，并明确通知 B；StoryCanvas 与 `apps/storycanvas/data/vendor/byteplus.ts` 继续排除。
- 当前状态：`A_BIZ_03_4_PLAN_FROZEN / READY_FOR_03_4A_RED`；未收到实现指令前不修改业务代码，未收到 push 指令前不 push。

## 2026-08-09 A-BIZ-03.4A Commercial Channel Reference / Strict Client 完成

- 核心提交 `461f494`：新增 `GET /api/v1/channels/current` 与 `GET /api/v1/platform/channels?status=active&limit=100`，由 Repository 解析 canonical Channel ID 并只返回 active CHANNEL Organization 的最小目录投影。
- Current Channel 禁止猜测 `organizationId === channelId`；Repository join `organizations` 重验 `organization_type = CHANNEL` 与 `status = active`。Directory 按 `displayName ASC + channelId ASC` 稳定排序，limit 在 Repository/Service 双层限制为 1～100。
- Scope/错误合同：错误 Scope、跨 Scope 与缺失 canonical mapping 为 404；同 PLATFORM/CHANNEL Scope 缺管理员角色为 403；非法或未知 query 为 422；响应保持 `cache-control: no-store`。
- 共享 Bootstrap 提交 `856757b`：修改 `apps/control-api/src/app.ts`、`app.test.ts`、`server.ts` 并挂载 Commercial Channel Router。B 修改这些共享文件前必须同步该提交。
- 前端提交 `671fe3e`：扩展严格 `pilotControlApi`，覆盖 Current Channel、active Directory、Platform/Channel Commission Audit、Platform TEST Settlement Draft 与 Tenant RechargeOrder bounded list。
- Client 全请求使用真实 Session Cookie；商业读取 `no-store`；严格解析 UUID、枚举、safe integer minor unit、currency、带时区 timestamp；保留 401/403/404/409/422/5xx、业务 code 与 Request ID。
- Client 只接受 TEST 商业事实，LIVE 与 malformed/non-JSON success fail closed；安全 DTO 排除 Provider 标识/摘要、Buyer/Membership/Wallet/Attribution 等敏感字段；Pilot 失败不回退 Demo、Mock 或 localStorage。
- 验证：Channel 定向 17 PASS / 3 PostgreSQL SKIP，App + Router 22 PASS，Control API 全量 31 files / 219 PASS / 165 PostgreSQL SKIP，typecheck/build PASS；前端 Client 16/16 PASS，build PASS。并发根测试的 3 个既有重型 UI 用例曾触发 5 秒资源超时，失败文件单独复跑 19/19 PASS；最终 Gate 使用单 worker。
- StoryCanvas tracked diff 为零；B 的 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交。未实现 UI、LIVE、真实比例、paid、提现、KYC、税务、自动打款或未规划 review/approve HTTP。
- 当前状态：`A_BIZ_03_4A_COMPLETE / READY_FOR_03_4B_RED`；下一 RED 为纯 Route Policy：PLATFORM Session 默认路由必须是 `/platform/commission-audit`，且不得进入 Tenant Project Boundary。未收到 push 指令前不 push。

## 2026-08-09 A-BIZ-03.4B Pilot Organization Commercial Route Policy 完成

- 新增 `src/domain/pilotOrganizationRoutePolicy.ts` 与 15 项权限测试；首个 RED 因目标 Policy 模块不存在按预期失败，随后最小实现转绿。
- 冻结四条商业路由 Manifest：Platform Commission Audit、Platform TEST Settlement Draft、Channel Commission Audit、Tenant TEST RechargeOrder Audit；Manifest 统一提供 Scope、Role、Capability、菜单与 Project Context 事实。
- 默认路由：PLATFORM `platform_admin` → `/platform/commission-audit`，CHANNEL `channel_admin` → `/channel/commission-audit`，均明确不需要 Tenant Project Context；TENANT 继续复用现有稳定首个可见 Project Brand，无 Project 时进入 `/projects`。
- 越权语义：跨 Organization 或探测其他 Scope 的已注册路由为 `scope-not-found`（03.4F 映射 404）；同 Scope 缺所需角色为 `permission-denied`（映射 403）；`pilot_support` 不自动继承商业权限。
- Tenant `/enterprise/recharge-orders` 仅 `tenant_admin`；`content_operator` 菜单为空且直接 URL 为 permission denied。Tenant Project 路由继续委托既有 `authorizeTenantWorkbenchRoute`，不创建 Demo Project fallback。
- 安全 returnTo 只保留当前 Session Policy 允许的站内路径；外部 URL、协议相对 URL、未知、控制字符、反斜杠与跨 Scope 候选统一回当前 Scope 安全默认路由，缺角色时不得借 fallback 获权。
- 全量前端单 worker：37 files 中 36 PASS，295/296 tests PASS；唯一失败为既有 `app.smoke` 重型 UI 用例超过 5 秒，对应文件随后 11/11 PASS。03.4B 定向 15/15、TypeScript、ESLint、Build、Prettier、Governance 与 `git diff --check` 全 PASS。
- 本切片只新增纯 Domain Policy 与测试；未修改 `Router.tsx`、`Sidebar.tsx`、`Topbar.tsx`、业务页面、Control API 或 StoryCanvas。B 的 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交。
- 当前状态：`A_BIZ_03_4B_COMPLETE / READY_FOR_03_4C_RED`。下一 RED：Platform Commission Audit 页面必须只调用真实 `pilotControlApi` 并先呈现 loading/empty 状态，不得读取 Demo `useControlPlaneStore`。未收到 push 指令前不 push。

## 2026-08-09 A-BIZ-03.4C Platform/Channel Commission Audit 完成

- 新增独立 Pilot 页面 `src/pages/pilot/PilotCommissionAuditPages.tsx` 与 11 项页面测试；Demo 的 `PlatformManagementPages.tsx`、`ChannelCommercialPages.tsx` 和 `useControlPlaneStore` 保持不变。
- 首个 RED 因目标页面模块不存在按预期失败；实现后页面测试 11/11 PASS，并证明 Platform 页面只调用真实 `pilotControlApi`、先呈现 loading、随后进入真实 empty/ready。
- Platform 页面并行读取 bounded 50 的 Payment Events、Calculations、Accruals、Reversals 与 Manual Reviews；仅显示 TEST 最小安全投影，不推导真实比例，不提供 review/approve 操作。
- Channel 页面严格先调用 `readCurrentChannel()`，再使用服务端返回的 canonical `channelId` 请求 Calculation/Accrual/Reversal；测试故意令 Organization ID 与 Channel ID 不同，且禁止 URL、文本框或下拉框覆盖 Channel Scope。
- 状态模型覆盖 loading、empty、ready、retrying、401、403、404、network/5xx 与 invalid response。Retry 会先清空旧投影，只重试真实 API；401 清除 Pilot Session 与 Project Context，403 保留 Session，404 使用通用 Scope 文案。
- 错误 UI 仅显示固定安全文案与可用 Request ID，不渲染原始 error body、Provider payload、stack、SQL、Secret 或完整敏感 DTO；Pilot 失败绝不回退 Demo、Mock 或 localStorage。
- 页面持续标记 `TEST · READ ONLY` 和 bounded window，并明确“不表示已到账、可提现、paid 或自动打款”；未实现 LIVE、真实比例、paid、提现、KYC、税务、自动打款或未规划 review/approve HTTP。
- Gate：03.4C 定向 11/11 PASS；全量前端单 worker 为 37/38 files、306/307 tests PASS，唯一失败是既有 `app.smoke` 重型 UI 用例超过 5 秒，该用例隔离复跑 1/1 PASS；TypeScript、ESLint、Build、Prettier、Governance 与 `git diff --check` 全 PASS，仅保留既有大 chunk warning。
- 本切片未修改 `Router.tsx`、`Sidebar.tsx`、`Topbar.tsx`、Control API 或 StoryCanvas；B 的 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交。
- 当前状态：`A_BIZ_03_4C_COMPLETE / READY_FOR_03_4D_RED`。下一 RED：Settlement Draft 页面必须先从真实 active Channel Directory 加载 beneficiary 选项，显著显示 `TEST / draft / NON_QUOTE`，并证明不会提供手工 Channel UUID 输入或伪造历史列表。未收到 push 指令前不 push。

## 2026-08-09 A-BIZ-03.4D Platform TEST Settlement Draft 完成

- 新增独立 Pilot 页面 `src/pages/pilot/PilotSettlementDraftPage.tsx` 与 8 项页面测试；首个 RED 因目标页面模块不存在按预期失败，Router/Layout 接线继续保留到 03.4F。
- 页面只从真实 `pilotControlApi.listActiveChannels(100)` 读取 active Channel Directory；beneficiary 使用 canonical `channelId` 下拉选择，不提供手工 UUID、Commission 反推、Demo Store、Mock 或 localStorage fallback。
- 表单把币种固定为 `CNY`，把 month 转为 UTC 自然月起点，并要求带 `Z` 的 `cutoffAt` 不早于下一 UTC 月起点；前端无效事实在调用 API 前 fail closed。
- 创建请求只能是 `paymentMode: TEST`；页面标题、表单确认、错误重试与成功区持续标记 `TEST / draft / NON_QUOTE`，并明确非到账、非提现、非 paid、非自动打款。
- 幂等合同已冻结：同一业务事实失败重试复用同一 key；beneficiary、period 或 cutoff 改变后轮换 key；409 保留 Request ID 且不自动换 key 绕过冲突；key 不展示在 UI。
- 成功后仅展示本次严格解析的 API Draft；零候选/零额 Draft 是合法审计结果。当前无 Settlement GET，因此页面不伪造服务端记录、不用本地成功结果冒充可恢复数据。
- Directory/Submit 状态覆盖 loading、empty、retrying、401、403、404、409、network/5xx 与 invalid response；401 清 Session/Project Context，错误只显示固定安全文案与 Request ID，不泄漏原始服务端 body。
- Gate：03.4D 定向 8/8 PASS；TypeScript、定向 ESLint、Build、Prettier、Governance 与 `git diff --check` PASS。全量单 worker为 37/39 files、311/315 tests PASS，4 个既有重型 UI 用例触发 5 秒 timeout；对应 Script Editor 8/8 与 Brand Brain 5/5 隔离复跑 PASS。
- 本切片未修改 `Router.tsx`、`Sidebar.tsx`、`Topbar.tsx`、Control API 或 StoryCanvas；B 的 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交。
- 当前状态：`A_BIZ_03_4D_COMPLETE / READY_FOR_03_4E_RED`。下一 RED：Tenant Recharge Audit 页面必须只使用 Session 的 canonical `tenantId` 调用真实 bounded GET，`content_operator` 不得获得页面能力，且页面不得出现 Recharge POST 或 Mock fallback。未收到 push 指令前不 push。

## 2026-08-09 A-BIZ-03.4E Tenant TEST RechargeOrder Audit 完成

- 新增独立 Pilot 页面 `src/pages/pilot/PilotTenantRechargeAuditPage.tsx` 与 7 项页面测试；首个 RED 因目标页面模块不存在按预期失败，Router/Layout 接线继续保留到 03.4F。
- 页面只使用当前 Session `activeContext.tenantId` 调用真实 `listTenantRechargeOrders(tenantId, 50)`；不接受 URL、Project 或手工 Tenant 覆盖，不读取 Demo Store、Mock 或 localStorage。
- 页面自身也 fail closed：仅 TENANT Scope 的 `tenant_admin` 可加载；`content_operator` 在调用 API 前得到 403 语义，缺 canonical Tenant Context 得到安全 404 语义。
- 只读安全投影显示 TEST 金额、购买/赠送额度、赠送到期、短 Order reference、UTC 时间和 created/pending/paid/partially_refunded/refunded/cancelled/disputed 状态；不暴露 Tenant ID、完整 Order ID、Provider、Rule、Attribution、Buyer 或 Wallet 字段。
- UI 显著标记 `TEST · READ ONLY · NON_QUOTE` 与 bounded 50；明确 paid/refunded/disputed 仅为 TEST 审计状态，不代表真实收款、到账、可用余额或退款完成。
- 页面没有 Recharge POST、支付模拟、退款动作、任意搜索或完整导出；Retry 先清空旧投影，只请求真实 API。状态覆盖 loading、empty、ready、retrying、401、403、404、network/5xx 与 invalid response。
- 401 清 Session/Project Context；403 保留 Session；错误只显示固定安全文案与 Request ID，不渲染原始 body 或敏感 DTO；Pilot 失败绝不回退 Mock。
- Gate：03.4E 定向 7/7 PASS；全量前端单 worker 40/40 files、322/322 tests PASS；TypeScript、定向 ESLint、Build、Prettier、Governance 与 `git diff --check` 全 PASS，仅保留既有大 chunk warning。
- 本切片未修改 `Router.tsx`、`Sidebar.tsx`、`Topbar.tsx`、Control API 或 StoryCanvas；B 的 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交。
- 当前状态：`A_BIZ_03_4E_COMPLETE / READY_FOR_03_4F_RED`。下一 RED：PLATFORM/CHANNEL Session 必须绕过 Tenant Project Boundary 并进入各自默认商业页，同时 Pilot Sidebar/Topbar 不得显示 Project Selector。03.4F 是共享 Router/Layout 独立提交，完成后必须通知 B 同步。未收到 push 指令前不 push。

## 2026-08-09 A-BIZ-03.4F 组织商业工作台激活完成

- 首个 RED 证明 PLATFORM Session 仍被旧 `PilotTenantBoundary` 阻断；Green 后 PLATFORM/CHANNEL 不再等待或进入 Tenant Project Boundary，分别默认进入 `/platform/commission-audit` 与 `/channel/commission-audit`。
- 共享 Router 现在统一复用 03.4B Organization Policy 处理默认路由、安全 returnTo、菜单/direct URL 和 Scope/Role 授权；跨 Scope 已注册路由返回安全 404，同 Scope 缺角色返回 403，不回退 Demo/Mock。
- Platform 菜单接入佣金审计与 `TEST 结算草稿`，Channel 菜单只接入佣金审计；Tenant Admin 增加 `TEST 充值记录`，Content Operator 菜单隐藏且 direct URL 在页面加载前拒绝。
- Platform/Channel Topbar 不显示 Project Selector，并使用各自商业工作台 home/label；TENANT 保留现有 Project Selector、Project 默认路由、空列表和 Project Scope 服务错误/Request ID 语义。
- Pilot 404 使用独立安全状态，不展示 Demo 导航；真实商业页面继续保留 loading/empty/retry、401/403/404/5xx、Request ID、敏感信息最小投影和 TEST-only 声明。
- Gate：03.4F Router 定向 20/20 PASS；全量前端 40/40 files、330/330 tests PASS；TypeScript、定向 ESLint、Build、Prettier、Governance、`git diff --check` 全 PASS，仅保留既有大 chunk warning。
- Demo Router/Store/UI 保持不变；StoryCanvas tracked diff 为零，B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交；不 push。
- 当前状态：`A_BIZ_03_4F_COMPLETE / A_BIZ_03_4_COMPLETE / READY_FOR_03_4_DOCS_CLOSE`。共享 Router/Layout 提交完成后，B 修改 `src/app/Router.tsx`、`src/layouts/Sidebar.tsx`、`src/layouts/Topbar.tsx` 前必须先同步。

## 2026-08-09 A-BIZ-03.4 商业前端与审计完整收口

- 03.4A～03.4F 已按独立原子提交完成：Channel Reference/Directory 与严格 Client、Organization Route Policy、Platform/Channel Commission Audit、Platform TEST Settlement Draft、Tenant Recharge Audit、共享 Pilot Router/Layout 激活。
- 最终实现基线为 `b80e9ef feat(pilot): activate organization commercial workbenches`；PLATFORM 默认进入 `/platform/commission-audit`，CHANNEL 默认进入 `/channel/commission-audit`，TENANT 保留首个可见 Project/空列表 `/projects`。
- Pilot 商业 API 只使用真实 Session Cookie 与 `no-store`，严格保留 401/403/404/409/422/5xx、业务 code 和 Request ID；malformed/non-JSON success fail closed，失败不回退 Demo、Mock 或 localStorage。
- Platform/Channel/Tenant 菜单、默认路由、returnTo 与 direct URL 统一复用 Organization Policy；跨 Scope 为安全 404，同 Scope 缺角色为 403，Content Operator 不获得 Tenant Recharge 能力。
- Commission/Recharge 页面只显示 bounded TEST 安全投影；Settlement 只允许 `TEST / draft / NON_QUOTE`，不表达到账、提现、paid 或自动打款。
- 最终 Gate：Router 定向 20/20、前端全量 40/40 files 与 330/330 tests PASS；TypeScript、ESLint、Build、Prettier、Governance、diff-check 全 PASS。
- 共享同步点：Control API Bootstrap 为 `856757b`；Router/Sidebar/Topbar 为 `b80e9ef`。B 修改对应共享文件前必须先同步。
- StoryCanvas tracked diff 为零；B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 继续排除；分支不 push。
- 当前状态：`A_BIZ_03_4_COMPLETE / READY_FOR_A_BIZ_06_PLANNING`。下一步先冻结 Wave 4 运营收口、联合 E2E、迁移/回滚、README 与 A/B 联合 Gate，不直接写实现。

## 2026-08-09 A-BIZ-06 Operational Closure & A/B Joint Gate 计划冻结

- 权威计划：`A_BIZ_06_OPERATIONAL_CLOSURE_JOINT_GATE_PLAN.md`；当前实现基线 `69b8181`。
- 源码审计确认：现有 Playwright 仅覆盖 Demo/localStorage；Control API PostgreSQL suites 在缺 `CONTROL_API_TEST_DATABASE_URL` 时可能 SKIP；根目录没有统一 Joint Gate manifest/runner。
- 冻结 06A～06F：确定性 Joint Gate、最小 Member Directory/Deactivation、Terms/Invitation/Member Pilot UI、专用 PostgreSQL + 真实 Session Cookie E2E、A/B 黄金路径、迁移/回滚与最终运营文档。
- full Gate 必须 fail closed：缺合法 `_test` PostgreSQL、B 可同步基线或 required phase 时非零退出；`--list`/`--plan` 和快速模式不得冒充最终 PASS。
- 统一冻结 401/403/404/409/422、Request ID、loading/empty/retry/inactive、Demo/Pilot 隔离与敏感信息最小投影；Pilot 失败不得回退 Mock/localStorage。
- Commercial 仍严格为 `TEST / NON_QUOTE`；Settlement 仍为 `TEST + draft`，非到账、非提现、非 paid；不实现 LIVE、真实比例、KYC、税务、自动打款或未规划 review/approve HTTP。
- A 不修改 StoryCanvas；B 未提供已提交且可同步的干净基线前，06E 与最终 A/B full Gate 保持未完成。`apps/storycanvas/data/vendor/byteplus.ts` 继续排除。
- 当前状态：`A_BIZ_06_PLAN_FROZEN / READY_FOR_06A_RED`。首个 RED：Joint Gate manifest 必须列全 required phases，且 `--full` 缺专用 PostgreSQL URL 必须失败，不能让 PostgreSQL suite 静默 SKIP 后宣称 PASS。

## 2026-08-09 A-BIZ-06A Deterministic Joint Gate Runner 完成

- 首个 RED 按预期因 manifest 模块缺失失败；Green 后新增 12-phase 机器可读 manifest、Root runner、StoryCanvas v0.2 显式定向 wrapper、package scripts 与 Pilot README。
- `--list`/`--plan` 只输出 `NOT_RUN`；`--full` 缺专用 `_test` PostgreSQL、06D/06E/06F 或 B 基线时退出 2，不执行 required commands，不宣称 PASS。
- runner 对 Provider 环境变量清空并保持日志脱敏；不打印 PostgreSQL URL/密码，不启动 LIVE Payment/Settlement/媒体调用，不修改 StoryCanvas。
- Gate：manifest 7/7、Root Build、Control API typecheck/build、StoryCanvas v0.2 targeted 13/13、ESLint、Prettier、Governance、diff-check PASS；full preflight 按预期 BLOCKED。
- Root 默认全量测试在并发负载下 328/330，两个既有 App smoke timeout；提高单测 timeout 后剩余逻辑通过，因此不把本次结果记为 Root full PASS。
- 现有 cross-plane contract Gate 真实暴露存量缺口：StoryCanvas v0.1 跨 package TS export 兼容失败，A3 package/grant HTTP Oracle 返回 500；最终 full Gate 继续 fail closed，06A 不掩盖或越界修改 B 文件。
- 本提交属于根共享 Gate 基线。B 后续修改联合 Gate、StoryCanvas v0.2 定向测试或根 package scripts 前必须先同步；`apps/storycanvas/data/vendor/byteplus.ts` 继续排除。
- 当前状态：`A_BIZ_06A_COMPLETE / JOINT_GATE_RUNNER_READY / READY_FOR_06B_PLANNING`；不 push。

## 2026-08-09 A-BIZ-06B Member Directory / Deactivation 合同冻结

- 权威子计划：`A_BIZ_06B_MEMBER_DIRECTORY_DEACTIVATION_PLAN.md`；当前基线 `93c7392`，不 push。
- 路由冻结为 current Organization：bounded Member Directory 与单 Membership suspend，不接受客户端覆盖 Organization/Channel/Tenant scope。
- PLATFORM/CHANNEL/TENANT 分别只允许 `platform_admin`、`channel_admin`、`tenant_admin`；`pilot_support` 与 `content_operator` 同 Scope 返回 403。
- Directory 返回 Membership ID、姓名、邮箱、status、primary role、roles、version、timestamps、isCurrentActor；不返回 User/Organization/Tenant/Channel ID、Session、Token/digest、password、Invitation 或 Provider 内部字段。
- suspend 冻结 strict `expectedVersion`、重复请求资源状态 replay、self-suspend、last-admin、expired、stale version、跨 Organization 404 与并发串行化。
- 不新增 Migration：现有 version trigger 与 Auth resolve 已让旧 Session 在下一次请求失效。TENANT 存在 legacy shadow row 时经 legacy 更新推进 canonical，禁止无规则双写。
- 实施分为 Repository/Service、HTTP Route、共享 App/Server wiring 三个独立提交；共享 wiring 提交后必须通知 B 同步。
- 首个 RED：Service 授权与 canonical Scope；随后 PostgreSQL RED 覆盖 Directory、version + 1、Session 失效、replay、last-admin、并发与 legacy 一致性。
- 当前状态：`A_BIZ_06B_PLAN_FROZEN / READY_FOR_REPOSITORY_SERVICE_RED`。

## 2026-08-09 A-BIZ-06B Legacy Membership Trigger 合同勘误

- Repository 预审发现 migration 010 的 legacy UPDATE trigger 会在 status-only 更新时删除 secondary roles，并触发额外 version bump。
- 原“无需新增 Migration”结论撤回；冻结独立 06B.1A / Migration 019，仅加固 `shadow_legacy_membership()`，不新增业务表或 Session revoke 机制。
- status-only legacy suspend 必须保留完整 canonical roles，status 变 suspended，version 恰好 `+1`；只有 legacy primary role 真正变化时才执行既有单角色兼容逻辑。
- Migration 019 必须先以 PostgreSQL RED/Green 证明并独立提交，之后才继续 Member Repository；缺合法 `_test` PostgreSQL 时不得把 SKIP 记为 PASS。
- 当前状态：`A_BIZ_06B_PLAN_CORRECTED / READY_FOR_MIGRATION_019_RED`。

## 2026-08-09 A-BIZ-06B Member Operations API 完成

- Migration 019 已加固 legacy Membership shadow：status-only 更新保留 secondary roles，canonical status 正确推进且 version 恰好 `+1`；legacy primary role 真变化仍保持既有单角色兼容语义。
- 新增 canonical current-Organization Member Repository/Service：PLATFORM、CHANNEL、TENANT 仅对应管理员可操作，bounded/sorted 最小 DTO，跨 Organization 404，self-suspend、last-admin、expired、stale version 与并发均 fail closed。
- suspend 对 TENANT legacy row 使用单向兼容写路径；duplicate replay 不二次 bump；失败事务全回滚；被停用成员的旧 Session 在下一次 Auth resolve 时失效。
- HTTP 已提供 `GET /api/v1/organizations/current/members` 与 `POST /api/v1/organizations/current/members/:membershipId/suspend`，使用真实 Cookie/rotation、`no-store`、strict Zod、Request ID、安全错误 envelope 与显式 replay header。
- 共享 Bootstrap 已在 `0b177cf` 接线；B 后续修改 `apps/control-api/src/app.ts`、`app.test.ts` 或 `server.ts` 前必须先同步。
- Gate：Migration 定向 2 files / 4 tests、Repository/Service 2 files / 14 tests、Route/Service 2 files / 19 tests、App/Route 2 files / 24 tests、Control API 全量 61 files / 414 tests PASS；typecheck、build、ESLint、Prettier、Governance、diff-check PASS。
- StoryCanvas tracked diff 为零；B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交。
- 当前状态：`A_BIZ_06B_COMPLETE / MEMBER_OPERATIONS_API_READY / READY_FOR_06C_PLANNING`。未宣称 A-BIZ-06 总体完成、完整 IAM、LIVE Operations 或 Full Joint Gate 通过。

## 2026-08-10 A-BIZ-06C Pilot Operations UI 计划冻结

- 新增 `A_BIZ_06C_PILOT_OPERATIONS_UI_PLAN.md`，冻结 Terms、Invitation、Member 真实 Pilot 运营页及其前置 bounded read 合同。
- 审计确认 Invitation GET 当前服务端无 limit；Terms 管理端缺 Document/Version Directory。两项必须先在 06C.1 补齐，前端不得靠截断或本地 state 伪造可恢复管理事实。
- 冻结 06C.1～06C.6 原子顺序：bounded backend reads、strict Client、Terms page、Invitation pages、Member pages、共享 Router/Layout 激活；每个切片独立 commit。
- Platform/Channel/Tenant 默认路由保持现状；运营页不要求 Project Context。Channel 使用 canonical current channelId，Tenant 使用 Session tenantId，跨 Scope 404、同 Scope 缺角色 403。
- Invitation Token 仅首次创建响应内存态最小展示；不持久化、不进 URL/日志/trace。Terms 正文只允许授权管理员录入业务/法务提供内容，工程师不 seed、不代写、不自动发布。
- 首个 RED：`listPilotCurrentOrganizationMembers()` 真实 Cookie、`no-store`、bounded query、strict Member DTO 与敏感字段拒绝。
- 当前状态：`A_BIZ_06C_PLAN_FROZEN / READY_FOR_06C_1_RED`。未宣称 06C、A-BIZ-06、完整 IAM、正式 Terms、Full Joint Gate 或 LIVE Operations 完成。

## 2026-08-10 A-BIZ-06C.1 Bounded Operations Reads 完成

- Terms 新增 Platform Admin bounded Document/Version directories；Repository/Service 与 HTTP 分为 `8feda7f`、`1f4d768` 两个独立提交。
- Invitation management list 新增 `all|active|revoked|exhausted|expired` 与 `limit=1..100`；Repository/Service 与 HTTP 分为 `7c31089`、`b6ff3db` 两个独立提交。
- 两类 GET 均使用真实 Session Cookie/rotation、`cache-control: no-store`、strict query/path、422 安全错误与 Request ID；expired 只按服务端 `asOf` 计算。
- PostgreSQL/Service/Route 证据：Terms 32/32、Invitation 37/37 PASS；Control API typecheck/build、ESLint、Prettier、Governance、diff-check PASS。
- StoryCanvas tracked diff 为零；B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存。
- 当前状态：`A_BIZ_06C_1_COMPLETE / BOUNDED_OPERATIONS_READS_READY / READY_FOR_06C_2_CLIENTS`。未宣称 06C、正式 Terms、完整 IAM、Full Joint Gate 或 LIVE Operations 完成。

## 2026-08-10 A-BIZ-06C.2 Strict Pilot Operations Client 完成

- Member strict Client 已由 `9ac03d8` 先行交付；本切片新增 Terms `310920e` 与 Invitation `5c3617a` 两个独立提交。
- Terms Client 覆盖 bounded Document/Version list、create document、create/update DRAFT、publish 与 retire；只发送冻结 HTTP 字段，并严格校验 UUID、status、SHA-256 digest、带时区 timestamp、nullable 发布事实与 replay header。
- Invitation Client 覆盖 Platform/Channel/Tenant bounded list/create 与 revoke；Channel 只接受显式 canonical channelId，Tenant 只接受显式 Session tenantId，不猜测 Organization ID。
- Invitation Token 仅从首次 create 调用返回给当前调用方内存；replay 必须为 `null`，不恢复历史 Token，不写 localStorage/sessionStorage/URL/log/trace。
- 所有 management GET 使用真实 Cookie 与 `cache: no-store`；成功 DTO 对未知/敏感字段 fail closed，错误保留 401/403/404/409/422/5xx、业务 code 与 Request ID，失败不回退 Demo/Mock。
- Gate：`src/services/pilotControlApi.test.ts` 30/30 PASS；Root Build、定向 ESLint、Prettier、Governance、diff-check PASS。
- StoryCanvas tracked diff 为零；B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交。
- 当前状态：`A_BIZ_06C_2_COMPLETE / STRICT_OPERATIONS_CLIENT_READY / READY_FOR_06C_3_TERMS_PAGE_RED`。下一 RED 为 Platform Terms 页面从真实 Document Directory 恢复 loading/empty/ready/error/retry，且 Pilot 失败不得读取 Demo Store。

## 2026-08-10 A-BIZ-06C Pilot Operations UI 完成

- 06C.3 `226d1a8` 已交付 Platform Terms Operations Page：真实 bounded Document/Version Directory、create Document、create/update DRAFT、publish/retire 确认与 replay/409、安全 401/403/404/422/5xx/Request ID；工程师不 seed、不代写、不自动发布正式 Terms。
- 06C.4 `649b3f6` 已交付 Platform/Channel/Tenant Invitation Operations Pages：Channel 先读取 canonical current channelId，Tenant 只用 Session tenantId；bounded list/create/revoke/replay、expired/revoked/exhausted 与首次 Token 仅本次内存可见，不持久化、不进 URL/日志/目录。
- 06C.5 `ec3cb40` 已交付 current Organization Member Operations Pages：按固定 Scope/管理员角色授权，bounded status list、self/last-admin/stale/inactive/replay、安全 suspend expectedVersion 与 401 Session 清理；不实现角色编辑、新增、恢复、删除、批量、密码、MFA、全局 User suspend 或 Support Grant。
- 06C.6 共享提交 `26400fa` 已激活 `/platform/terms`、三类 Invitation 与三类 Member 路由，并统一复用 Route Manifest/Policy 处理 direct URL、returnTo、Sidebar、Router 和 Topbar；Platform/Channel 默认仍为 Commission Audit，Tenant 默认仍为首个可见 Project Workbench。
- 06C 运营页均不要求 Project Context；Tenant 进入 Invitation/Member 时 Topbar 不伪造 Project。跨 Scope 返回 404、同 Scope 缺角色返回 403、未认证回登录、未知路径返回 404，Pilot 失败不回退 Demo/Mock。
- **共享通知给 B**：`26400fa` 修改 `src/domain/pilotOrganizationRoutePolicy.ts`、`src/app/Router.tsx`、`src/layouts/Sidebar.tsx`、`src/layouts/Topbar.tsx` 及 Router/Policy 测试；B 修改这些共享文件前必须先同步。
- Gate：Terms 18/18、Invitation 11/11、Member 8/8、Policy/Router 45/45 PASS；Root Build、定向 ESLint、Prettier、Governance、diff-check PASS。一次并行执行 Root 全量 Vitest 与 Build 时，4 个既有 Demo suite 因资源竞争出现 14 个 timeout；脱离并行负载后受影响 4 files / 26 tests 全部 PASS，不把该次并发 timeout 伪报为全量 Gate PASS。
- StoryCanvas tracked diff 为零；B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交。
- 当前状态：`A_BIZ_06C_COMPLETE / PILOT_OPERATIONS_UI_READY / READY_FOR_06D_HARNESS_AUDIT`。仍不得宣称正式 Terms 内容上线、完整 IAM、A-BIZ-06 总体完成、Full Joint Gate PASS 或 LIVE Operations Ready。

## 2026-08-10 A-BIZ-06D Deterministic Pilot Browser E2E 计划冻结

- 新增权威计划 `A_BIZ_06D_DETERMINISTIC_PILOT_BROWSER_E2E_PLAN.md`，状态 `A_BIZ_06D_PLAN_FROZEN / READY_FOR_06D_1_ENVIRONMENT_CONTRACT_RED`。
- 审计确认现有 Playwright 只覆盖 Demo localStorage smoke；没有真实 Control API lifecycle、真实 Session Cookie、专用数据库 reset/seed 或 Pilot operations spec，且 `fullyParallel: true` 不适合共享 PostgreSQL 有状态矩阵。
- `compose.pilot.yaml` 只有开发库，现有 auth bootstrap 只创建单 Tenant；06D 必须使用显式 `_test` URL、独立用户覆盖 PLATFORM/CHANNEL/TENANT、确定性 reset/migrate/seed/verify 与单 worker Playwright。
- 冻结同源 Vite proxy，不为 06D 放宽生产 CORS；浏览器只通过真实登录获得 HttpOnly `videoagent_session`，禁止 localStorage/Zustand/`addCookies` 注入。
- Registration 成功 E2E 需要双端显式 test-only verification adapter；临时 Token 每轮生成、不写仓库、不渲染、不记录，任何非 test 环境继续 fail closed，不能外推为正式邮箱验证。
- Public Terms 当前只检查 digest 格式，06D 必须先以 digest mismatch 浏览器 RED 推动 SHA-256 重算后再允许展示/接受。
- 冻结切片：06D.1 Environment Guard → 06D.2 Reset/Seed → 06D.3 Verification/Proxy/Runner → 06D.4 Auth/Router → 06D.5 Public Lifecycle → 06D.6 Operations/TEST Commercial/Security → 06D.7 Joint Gate 激活与文档收口。
- 首个 RED：数据库 URL 缺失、指向开发库或实际 `current_database()` 身份不一致时，必须在任何 destructive SQL 前失败，且日志不得泄漏完整 URL、用户名或密码。
- 06E/06F 与 B external baseline 继续保持未完成；StoryCanvas tracked diff 必须为零，`apps/storycanvas/data/vendor/byteplus.ts` 始终排除。

## 2026-08-10 A-BIZ-06D.1～06D.2 Dedicated DB Harness 完成

- 06D.1 提交 `2f5131e`：E2E 仅接受显式 `PILOT_E2E=true` 与唯一 `CONTROL_API_TEST_DATABASE_URL`；只允许 PostgreSQL、数据库名必须 `_test` 结尾、显式拒绝 `videoagent_control`，reset 前必须以 `current_database()` 核对实际身份。
- Environment 安全摘要不输出数据库 URL、用户名或密码；默认 Control API/Web 均固定 loopback，分别为 `127.0.0.1:10601` 与 `127.0.0.1:5175`。
- 06D.2 提交 `4c05157`：新增 `e2e:reset-seed`，只删除 `control_plane` schema 与 migration metadata，随后复用完整 19 migration chain 并写入固定 PLATFORM/CHANNEL/TENANT、独立用户、Project/Assignment、Terms、Invitation、Registration/Attribution 与 TEST Commercial fixture。
- 每轮账号密码、Invitation Token 与 verification Token 随机生成，只在调用模块内存返回；CLI 明确 `credentialOutput: false`，不打印凭据。
- 专用本地 PostgreSQL `videoagent_control_test` 定向 Gate：`2 files / 14 tests PASS / 0 SKIP`；连续两轮安全 fingerprint 均为 `18ca4b0a2c335500639b62a8222ca9f88229ab620ec24726da047051d30d9737`。
- Postcondition 包含 `migrationCount: 19`、`organizationCount: 5`、`userCount: 8`、`membershipCount: 8`、`liveFactCount: 0`、`activeSessionCount: 0`；未 seed LIVE、paid/提现、KYC、税务、发票或自动打款。
- Control API typecheck/build、定向 ESLint、Prettier、Governance、diff-check PASS；StoryCanvas tracked diff 为零，B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存。
- 当前状态：`A_BIZ_06D_2_COMPLETE / DEDICATED_DB_SEED_READY / READY_FOR_06D_3_DIGEST_RED`。Joint Gate `pilot-browser-e2e` 仍保持 `planned`/BLOCKED；下一 RED 为 Public Terms 正文与合法格式 digest 不匹配时 Client 必须 fail closed，不展示正文且不回退 Demo/Mock。

## 2026-08-10 A-BIZ-06D.3～06D.5 Pilot Browser Gate 进展

- 06D.3 以 `fd4e3de`～`bda23ac` 完成 Public Terms digest fail-closed、双端 test-only verification、Demo persistence 阻断、同源 Vite proxy、真实 Control API lifecycle 与单 worker Playwright runner；非 test 环境继续 fail closed。
- 06D.4 以 `9bddd47`～`8480f80` 完成 Auth/Router Browser Matrix，真实 Gate `10/10 PASS`；覆盖匿名回跳、PLATFORM/CHANNEL/TENANT 默认路由、direct URL、Project-independent Tenant Operations、403/404、刷新、logout 与 suspend Session invalidation。
- 06D.5 以 `c5f5248`、`a4ad473`、`778419e` 完成 Public Lifecycle Matrix；canonical Terms fixture code 修正为 `registration-notice`，完整 Pilot Browser Gate `22/22 PASS`。
- `c492c36` 将 stale Terms 从错误的 `503 TERMS_NOT_AVAILABLE` 修正为 canonical `409 TERMS_VERSION_STALE`；Registration HTTP/PostgreSQL 定向 `20/20 PASS`，Control API typecheck/build、Root Build、Governance、Prettier、diff-check PASS。
- Invitation Token 立即从 URL 清除，刷新不恢复，不进入 DOM、localStorage/sessionStorage、日志或 artifact；Registration 成功不自动创建 Session，replay/conflict/duplicate/verification recovery/stale/unavailable 均使用真实 API 事实。
- **共享通知给 B**：Public Registration stale Terms HTTP 合同现为 `409 TERMS_VERSION_STALE`；B 修改 Registration/Terms HTTP 合同时必须先同步 `c492c36`。共享 Pilot E2E runtime 基线为 `bda23ac`。
- StoryCanvas tracked diff 为零；B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交；根 `5173` 与 StoryCanvas `10588` 服务保持运行。
- 当前状态：`A_BIZ_06D_5_COMPLETE / PUBLIC_LIFECYCLE_BROWSER_GATE_PASS / READY_FOR_06D_6_OPERATIONS_RED`。下一个真实 RED 是 Platform Commission Audit 页面返回 403；`pilot-browser-e2e` 仍为 `planned`/BLOCKED，尚未激活 Joint Gate，尚未进入 06E/06F。

## 2026-08-10 A-BIZ-06D.6 Operations / TEST Commercial / Security 完成

- 提交链 `bf054aa`～`426103b` 完成真实 Operations/Commercial/Security Browser Matrix；修复 Commission Router fallthrough、canonical Tenant scope、Settlement period/date 投影，并加入 recovery、安全 404、敏感浏览器表面与 artifact 扫描。
- Terms、Invitation、Member、Tenant RechargeOrder、Platform/Channel Commission Audit、active Channel Directory 与 Platform TEST Settlement Draft 均覆盖 loading/empty/ready/error/retry；成功事实来自真实 Control API，不由 route mock 提供。
- Channel/Tenant 跨组织探测对“存在但无权”和“未知”返回等价 `404`、`no-store`、固定安全错误与独立 Request ID，不泄露目标 ID。
- Settlement submit 的不确定失败重试复用相同业务事实和 body `idempotencyKey`；结果保持 `TEST / draft / CNY / zero-candidate`，明确非到账、非提现、非 paid Settlement、非自动打款。
- 敏感矩阵验证 HttpOnly Session Cookie 不可由页面读取，Pilot localStorage/sessionStorage 均为空；DOM、URL、console、pageerror、requestfailed 和 artifact 不泄露密码、Session、Invitation/verification Token、Terms digest、内部 snapshot、Grant、SQL 或 stack。
- 真实 Google Chrome `150.0.7871.125`、专用 PostgreSQL `videoagent_control_test`、单 worker完整 Gate：`39/39 PASS / 0 SKIP`；artifact scanner 单测 `3/3 PASS`。
- StoryCanvas tracked diff 为零，B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交；根 `5173` 与 StoryCanvas `10588` 服务继续运行。
- 当前状态：`A_BIZ_06D_6_COMPLETE / READY_FOR_06D_7_JOINT_GATE_ACTIVATION`。尚未进入 06E/06F，不宣称 A-BIZ-06 或 Full Joint Gate 完成。

## 2026-08-10 A-BIZ-06D.7 Joint Gate 激活与阶段收口完成

- RED `346a183` 冻结 Pilot Browser phase 的 ready/runner/precondition 合同；Green `c154b1e` 修改共享 `scripts/joint-gate-manifest.mjs` 与 `scripts/run-joint-gate.mjs`。
- `pilot-browser-e2e` 已从 `planned` 激活为 `ready`，唯一命令为 `npm run test:e2e:pilot`；06D 的 `PILOT_BROWSER_E2E_NOT_IMPLEMENTED` slice blocker 已移除。
- phase 继续要求显式 dedicated PostgreSQL `_test` URL；Full runner 固定传递 `PILOT_E2E=true`、`PILOT_E2E_BROWSER_CHANNEL=chrome`，并继续清空 paid provider secrets。
- manifest `8/8 PASS`，plan 正确列出 ready phase；带 `videoagent_control_test` URL 的 full preflight 退出 `2`，只保留 06E/06F/B external blockers，不含数据库 URL/password，也不宣称 `JOINT_GATE_PASS`。
- 06D 最终浏览器证据保持为真实 Google Chrome `150.0.7871.125`、专用 PostgreSQL、单 worker `39/39 PASS / 0 SKIP`；Session/Storage/Request ID/跨组织 404/敏感 artifact 与 TEST draft 边界均已覆盖。
- Root Build、Control API typecheck/build、Governance、Prettier/diff-check PASS。Root 全仓 ESLint 仍被既有 StoryCanvas 源码、生成目录和历史测试 `any` 基线阻断（本轮未修改这些文件）；不得将其误报为本切片回归或全仓 Lint PASS。
- **共享通知给 B**：B 修改 Joint Gate manifest/runner 前必须同步 `c154b1e`；该提交改变 Full Gate 的 Pilot Browser phase 环境与执行命令。
- StoryCanvas tracked diff 为零；B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交。根 `5173` 与 StoryCanvas `10588` 服务继续运行；分支未 push。
- 当前状态：`A_BIZ_06D_COMPLETE / PILOT_BROWSER_PHASE_READY / FULL_JOINT_GATE_STILL_BLOCKED`。下一步只能审计 06E 前置与 B baseline，不得把 06D 完成外推为 A-BIZ-06 或 Full Joint Gate 完成。

## 2026-08-10 A-BIZ-06E A/B Golden Path Joint Gate 计划冻结

- 新增 `A_BIZ_06E_A_B_GOLDEN_PATH_JOINT_GATE_PLAN.md`，冻结 baseline attestation、Storyboard authority、server-mediated Canvas bootstrap、A/B 页面接线、真实浏览器 Gate 与 Joint Gate 激活顺序。
- 当前 `origin/dev/production-plane@84d922c` 仅是 2026-08-02 D2 基线，不是 Wave 4 handoff；工作区 B-owned `apps/storycanvas/data/vendor/byteplus.ts` 仍为未跟踪文件，A 不修改、不暂存、不提交。
- A 已有真实 Tenant Project Context、Script/Production API 与 Grant introspection；但 Pilot Script/Storyboard/Canvas 页面仍依赖 Demo Store、`DEMO_PROJECT_ID`、LocalStorage 和 Demo Grant/Bridge。
- 阻断性缺口为 Storyboard authority：当前 Production Package 仍从 approved Script payload 的 `storyboard` 字段构建，不能证明 B draft 已由 A 保存并人工批准。
- 冻结 B draft provenance → A-owned Storyboard Version/Approval → approved Script/Storyboard 双绑定 → Production Package 的 fail-closed 事实链。
- Canvas bootstrap 采用 server-mediated 方向；raw Grant accessToken 不进入 DOM、URL、Storage、props、日志、trace、截图、report 或错误 envelope。
- 06E.0 可在等待 B 时前置加固 Joint Gate：非空但不存在/未同步的 baseline commit 必须阻断，不执行 required commands，不移除 `AB_GOLDEN_PATH_NOT_IMPLEMENTED`。共享 manifest/runner Green 后必须通知 B。
- 06E.3～06E.6 只有 B 提供明确、可同步、tracked clean 的 Wave 4 commit 后才可执行。当前状态：`A_BIZ_06E_PLAN_FROZEN / WAITING_FOR_B_BASELINE / FULL_JOINT_GATE_STILL_BLOCKED`。

## 2026-08-10 A-BIZ-06E.0 B Baseline Attestation 完成

- RED `f29a0bd` 冻结“非空但不存在的 baseline 不能通过”合同；Green `94fabe1` 将 `ab-golden-path` 与 `storycanvas-build-targeted` 的前置从 `non-empty` 改为 `git-commit-ancestor`。
- Full preflight 现在要求完整 40 位 SHA、真实 commit object 且为当前 integration `HEAD` 的 ancestor；missing / invalid / not-ancestor 分别返回稳定安全 blocker。
- Matrix `cf6bf58` 覆盖 missing、invalid、not-ancestor、valid synchronized commit；manifest `12/12 PASS`，plan PASS。
- 非法值不回显，required commands 不执行；合法当前 HEAD 只保留 `AB_GOLDEN_PATH_NOT_IMPLEMENTED` 与 `MIGRATION_ROLLBACK_GATE_NOT_IMPLEMENTED`。
- **共享通知给 B**：B 修改 Joint Gate manifest/runner 前必须同步 `94fabe1`；后续 handoff commit 必须已同步进入当前集成祖先链，旧 D2 ref 不能解除前置。
- StoryCanvas tracked diff 为零，B-owned 未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交；分支未 push，服务继续运行。
- 当前状态：`A_BIZ_06E_0_COMPLETE / WAITING_FOR_B_BASELINE / FULL_JOINT_GATE_STILL_BLOCKED`。下一步并行审计 06F A-owned migration/README，不进入 06E.1 实现。

## 2026-08-10 A-BIZ-06F Migration/Rollback 与 Final Joint Gate 计划冻结

- 新增 `A_BIZ_06F_MIGRATION_ROLLBACK_FINAL_GATE_PLAN.md`，冻结 06F.1～06F.6：安全环境边界、fresh forward/one-batch rollback/reapply、失败与脱敏矩阵、Joint Gate phase 激活、Ops Docs/最终报告和最终 Full Gate。
- 当前 `migration-rollback-reapply` phase 仍为 `planned`，runner `scripts/run-control-api-migration-gate.mjs` 尚不存在，`MIGRATION_ROLLBACK_GATE_NOT_IMPLEMENTED` 必须保留。
- 普通 `db:migrate` / `db:rollback` 不具备 destructive Gate 所需的 `PILOT_E2E=true`、专用 `_test` URL、禁止 `DATABASE_URL` fallback 和 `current_database()` identity 二次校验，不能直接作为 Joint Gate。
- 06F 将复用 `apps/control-api/src/e2e/environment.ts` 的权威 guard；任何 environment 或 identity 失败必须在 DROP/migrate/rollback 前非零退出，且不输出完整 URL、用户名、密码、SQL 或 stack。
- migration chain 当前冻结为 001～019；rollback 必须在 fresh、empty、dedicated `_test` DB 上验证 one-batch 语义，随后 deterministic reapply 并比对最终 fingerprint。
- 首个 RED：缺失 `PILOT_E2E=true` 或 URL 缺失/非法/非 `_test`/开发主库时，migration runner 不得进入 `RUNNING_MIGRATION_GATE`，不得执行 destructive operation，也不得泄漏凭据。
- 06F.4 修改共享 Joint Gate manifest/runner 时必须独立提交并通知 B；当前计划提交不改变共享运行合同。
- 06F.6 继续等待 06E 与 B baseline；在全部 required phases 零 SKIP 前不得宣称 `A_BIZ_06_COMPLETE` 或 `JOINT_GATE_PASS`。
- 当前状态：`A_BIZ_06F_PLAN_FROZEN / READY_FOR_MIGRATION_GATE_RED / FULL_JOINT_GATE_STILL_BLOCKED`。StoryCanvas tracked diff 保持为零，B-owned 未跟踪 vendor 文件继续排除。

## 2026-08-10 A-BIZ-06F.1～06F.5 Migration Gate 与 Ops Docs 完成

- 06F.1 提交 `0753c26` / `43ba2f8` 完成 destructive environment guard：强制 `PILOT_E2E=true`，唯一数据库输入为 `CONTROL_API_TEST_DATABASE_URL`，只接受 PostgreSQL `_test`，禁止 `DATABASE_URL` fallback，并显式拒绝开发主库。
- 06F.2 提交 `6d278e9` / `2d09553` 完成真实 001—019 fresh forward → latest replay no-op → one-batch rollback → empty verification → deterministic reapply → final fingerprint → cleanup；destructive SQL 前再次校验 `current_database()`。
- 06F.3 提交 `55dd0c7` / `cd38047` 完成 13 项 failure/recovery/redaction matrix：environment、connection、identity、reset、forward、rollback、reapply、verification、cleanup 与 destroy 任一失败均非零退出，primary failure 不被 cleanup failure 覆盖，只有全部成功才输出最终 PASS。
- 真实专用 `videoagent_control_test` PostgreSQL rollback/reapply Gate `1/1 PASS / 0 SKIP`；environment boundary `8/8 PASS`；failure matrix `13/13 PASS`；Control API typecheck/build PASS。每轮 Gate 后清理 `control_plane` schema 和 migration metadata。
- 06F.4 RED `26e0819`、共享 Green `018190d` 已将 `migration-rollback-reapply` phase 从 `planned` 激活为 `ready`，保留 dedicated PostgreSQL precondition，移除 `MIGRATION_ROLLBACK_GATE_NOT_IMPLEMENTED`；Full runner 已统一注入 `PILOT_E2E=true`。
- Full preflight 使用合法 dedicated DB 与当前 ancestor attestation 时只剩 `AB_GOLDEN_PATH_NOT_IMPLEMENTED`，退出 `2` 且不执行 required commands、不输出 Secret、不宣称 `JOINT_GATE_PASS`。
- 06F.5 已同步 Root/Control API/Pilot E2E 运行说明与 Final Report Contract：逐 phase 记录 command、owner、precondition、start/end/duration、PASS/FAIL/BLOCKED、test count、zero-SKIP evidence、artifact path 和脱敏结论。
- 所有 Payment/Commission/Settlement 仍仅为 TEST Pilot；Settlement 仅 `TEST / draft / NON_QUOTE`，不是到账、paid、提现或自动打款。不实现 LIVE、真实比例、KYC、税务、发票、自动打款或未规划 review/approve HTTP。
- **共享通知给 B**：修改 `scripts/joint-gate-manifest.mjs` / `scripts/run-joint-gate.mjs` 前必须同步 `018190d`；该提交已激活 migration phase，不能恢复旧 06F slice blocker。
- StoryCanvas tracked diff 为零；B-owned 未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交；分支未 push，5173/10588 服务继续运行。
- 当前状态：`A_BIZ_06F_1_TO_5_COMPLETE / MIGRATION_ROLLBACK_PHASE_READY / WAITING_FOR_06E_B_BASELINE / FULL_JOINT_GATE_STILL_BLOCKED`。06F.6 只有 06E Golden Path、同步 B baseline 与全部 required phases 零 SKIP 后才可执行。

## 2026-08-11 A-BIZ-06E B Wave 4 Baseline 同步验收

- 已将 B 远程提交 `f68ac6a551231243d10978e9a798286672dd95e6` 以 `--ff-only` 同步到 `dev/business-plane`；其直接 parent 为 A baseline `c449508d2ad13e68cb55680cb882cac91de83325`，当前 A `HEAD` 即该 B commit。
- commit object、remote-tracking ref 与 ancestor attestation 均通过；B response commit 的 tracked diff 仅新增 `docs/collaboration/production-plane/B_TO_A_AGENT_WAVE4_BASELINE_RESPONSE_2026-08-10.md`。
- `npm run test:joint-gate:manifest` 为 `13/13 PASS`；`test:joint-gate:plan` 只列 `NOT_RUN`；以 dedicated `_test` URL 形状和已同步 B SHA 执行安全 Full preflight 时，仅返回 `AB_GOLDEN_PATH_NOT_IMPLEMENTED`，未执行 required commands，未输出 `JOINT_GATE_PASS`。
- Baseline blocker 已解除，但 Storyboard Draft/Version/Approval authority、approved Script + Storyboard Package eligibility、server-mediated non-secret Canvas Entry、B Pilot pages、共享激活与真实 Chrome/PostgreSQL Golden Path 仍未实现。
- 下一原子切片为 06E.1 A-owned Storyboard authority/bootstrap contract RED；首个 RED：缺 approved Script digest 或 source Receipt 的 Storyboard Draft provenance envelope 必须 fail closed。
- StoryCanvas tracked diff 为零；B-owned 未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未删除、未暂存、未提交。
- 当前状态：`B_WAVE4_BASELINE_SYNCED / B_BASELINE_ANCESTOR_ATTESTED / READY_FOR_06E_1_RED / AB_GOLDEN_PATH_NOT_IMPLEMENTED / FULL_JOINT_GATE_STILL_BLOCKED`。

## 2026-08-11 A-BIZ-06E A-side Dual-Authority Canvas Chain 完成

- Storyboard authority、browser-safe strict Client、Production Package v0.3、Project Grant 与 Canvas Entry 的 A 侧双权威链已完成；数据库 migration chain 已扩展至 020—023。
- Production Package 只允许绑定当前 approved Script 与当前 approved Storyboard；create/read 使用 strict v0.3 HTTP、真实 Session Cookie、`Cache-Control: no-store`、Request ID 与安全 401/403/404/409/422/500 envelope。
- Grant issue、idempotent replay 与 introspection 每次重新验证 Package v0.3、有效期及当前 Script/Storyboard 双权威；历史 v0.2 Package 和 stale authority 均不得签发或恢复 Grant。
- Canvas Entry 使用 Grant/Package/Project/Tenant 四列复合约束绑定 exact Grant；create/replay/read/consume 均复用 server-only Production Authority verifier，不复制 Script、Storyboard 或 Approval SQL。
- Storyboard authority 被 revoke、supersede 或变为 stale 后，Canvas read fail closed；replay/consume 将 Entry 持久化为 `expired` 后返回安全 `410 CANVAS_ENTRY_EXPIRED`。已 consumed Entry 继续保持 `409 CANVAS_ENTRY_REPLAYED`。
- Browser Canvas DTO 继续严格限定为 9 个字段，不暴露 raw Grant、access token、grantId、token digest、Script/Storyboard digest、authority reason、Package snapshot 或内部持久化事实。
- Authority verifier 共享提交为 `b57adc1`；Canvas runtime revalidation 提交为 `fed5580`。B 修改 Production、Grant、Canvas authority 或共享 Bootstrap 前必须先同步对应 A commits。
- 本轮主线程复验：Production/Canvas PostgreSQL `28/28 PASS`，Canvas 非 PostgreSQL `63/63 PASS`，Canvas lifecycle/migration chain `7/7 PASS`；Control API typecheck/build、Prettier 与 diff-check PASS。
- 后续源码审计确认：Browser Canvas create/read 已完成，但不存在 StoryCanvas server 可调用的 internal Canvas Entry redemption HTTP；现有 `consumeEntry` 只返回 `grantId`，不足以恢复 Package v0.3、canonical Grant 与 raw server-only token。
- 已冻结 `A_BIZ_06E_CANVAS_ENTRY_REDEMPTION_PLAN.md`：先完成 06E.R1 RED，再按 Migration 024、A-owned repository/service、shared internal HTTP/Bootstrap、B handoff 原子提交。
- 在 redemption Green 与 B 同步前，B 可继续 Script/Storyboard 页面工作，但 Canvas 接线保持 blocked；06E.4 Shared Router/Bridge、06E.5 Real Browser Golden Path 和 06E.6 Joint Gate Activation 不得开始。
- StoryCanvas tracked 文件未修改；B-owned 未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未删除、未暂存、未提交。A 新提交尚未 push。
- 当前状态：`A_SIDE_BROWSER_CONTRACT_COMPLETE / CANVAS_ENTRY_REDEMPTION_CONTRACT_REQUIRED / B_06E_3_CANVAS_BLOCKED / READY_FOR_06E_R1_RED / AB_GOLDEN_PATH_NOT_IMPLEMENTED / FULL_JOINT_GATE_STILL_BLOCKED`。

## 2026-08-11 · A-BIZ-06E.R Canvas Entry Internal Redemption Ready

- 06E.R1—R4 已完成：Bootstrap RED `4f57912`、Migration 024 `9f8c0d4`、A-owned redemption core `349b752`、Internal HTTP `2034a12`、shared Bootstrap `32848fd`。
- 正式 endpoint 为 `POST /api/v1/internal/canvas-entries/redeem`；只允许 StoryCanvas server 使用 server-only internal token 与稳定 `Idempotency-Key`，body 为 exact handle/tenant/project/package。
- Repository 使用 exact row lock 与 immutable redemption facts；同 key + 同 digest 安全 replay，不同 key 或 digest 稳定 409；恢复当前 Package v0.3、canonical Grant 与确定性重签 token，不创建新 Grant。
- legacy 应用层 `consumeEntry` 已移除，避免对 Migration 024 写入伪造 redemption evidence；纯内存 lifecycle state machine 保留。
- Internal HTTP 固定 Request ID、`Cache-Control: no-store`、`Idempotency-Replayed` 与安全 `401/404/409/410/422/500/503`；错误不泄漏 token、grantId、digest、snapshot、SQL 或 stack。
- 验证：Canvas parser/service/digest `37/37 PASS`，Canvas/Production PostgreSQL `32/32 PASS`，Bootstrap/Internal route `29/29 PASS`，Control API typecheck/build、Prettier、diff-check PASS。
- `32848fd` 是 shared Bootstrap，B 必须同步其完整祖先链后才可实现 server-side redemption client；Pilot 失败不得回退 v0.2 receiver、Demo Grant、Mock 或 LocalStorage。
- StoryCanvas tracked diff 为零；B-owned 未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未删除、未暂存、未提交。A 新提交未 push。
- 状态：`A_CANVAS_ENTRY_REDEMPTION_READY / B_REDEMPTION_CLIENT_SYNC_REQUIRED / B_06E_3_CANVAS_READY_FOR_IMPLEMENTATION / AB_GOLDEN_PATH_NOT_IMPLEMENTED / FULL_JOINT_GATE_STILL_BLOCKED`。

## 2026-08-11 · A-BIZ-06E.4P / 06E.5 Shared Activation 与 Golden Path 计划冻结

- A/B 远程 HEAD 已共同对齐到 `a7f8021b80f540c69e4c45718b335ba2c0fca539`；baseline blocker 已解除，但 B 回执明确仅完成同步，不包含 StoryCanvas redemption consumer、browser-facing bootstrap 或 Pilot Script/Storyboard/Canvas page。
- 新增 `A_BIZ_06E_4_5_SHARED_ACTIVATION_GOLDEN_PATH_PLAN.md`，冻结 06E.4P、06E.4A—C、06E.5A—C 与 06E.6 的依赖、所有权、写集、RED、提交顺序和停止条件。
- 06E.4A 冻结为 B-owned consumer/page synchronization；06E.4B 为 shared Pilot Bridge；06E.4C 为 shared Router activation/regression。B consumer/page 未同步验收前，Shared Green 保持 blocked。
- 浏览器只允许携带 non-secret Canvas Entry handle 与 canonical tenant/project/package reference；internal token、raw Grant/access token、grantId、digest 和 `CanvasEntryRedemption/0.1` server-only DTO 不得进入浏览器表面。
- 06E.5A1 可由 A 立即推进：修复 Pilot E2E seed 仍冻结 `migrationCount: 19` 的确定性缺口，并保持未改变数据形状的 `fixtureVersion: 1`。首个 RED 为 `Pilot E2E seed accepts the complete 001—024 migration chain`。
- 06E.5B/5C 冻结真实 Control API + Root Frontend + StoryCanvas lifecycle、真实 Google Chrome、专用 `_test` PostgreSQL、单 worker、零 retry、JSON report 和 `0 SKIP` 机器验收；任一服务/环境不可用必须 FAIL/BLOCKED，不得 SKIP。
- Demo/Pilot 继续严格隔离：Pilot 失败不得回退 `DEMO_PROJECT_ID`、Demo Store、`DemoProjectGrant`、`X-StoryCanvas-Demo-Grant`、Mock、Zustand 或 LocalStorage。
- 06E.6 前继续保留 `AB_GOLDEN_PATH_NOT_IMPLEMENTED`；不宣称 `A_BIZ_06E_COMPLETE`、`JOINT_GATE_PASS` 或 `FULL_JOINT_GATE_PASS`。
- 状态：`A_BIZ_06E_4P_PLAN_FROZEN / READY_FOR_06E_5A_RED / B_REDEMPTION_CONSUMER_IMPLEMENTATION_REQUIRED / SHARED_ACTIVATION_GREEN_BLOCKED / AB_GOLDEN_PATH_NOT_IMPLEMENTED / FULL_JOINT_GATE_STILL_BLOCKED`。
