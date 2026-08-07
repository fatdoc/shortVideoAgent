# C0 STATUS

- 岗位：总项目负责人 / 总架构师
- 当前阶段：A 业务平台 Wave 1 · 多组织与真实 RBAC 底座
- 当前状态：Wave 0 `BUSINESS_DECISIONS_APPROVED` / A-BIZ-00.2～00.3 `ACCEPTED` / A-BIZ-01.1 `READY_TO_START`
- 当前任务：A-BIZ-01.1 test-first migration `006+`，实现 Organization、Channel/Tenant 扩展、Organization Membership/Role、Project Assignment 与白名单 Pilot 显式回填
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
- 最近更新：2026-08-07

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
