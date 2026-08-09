# C0 HANDOFF

## 单前端集成交接（2026-07-30）

StoryCanvas 已迁入根 SaaS 前端并由 `/production/canvas/:projectId` 直接渲染。控制平面通过 React prop 将当前 project-scoped grant 保留在内存中注入画布；`apps/storycanvas/src/` 继续提供 `/api/*`、任务、资产、回执和媒体生产能力，不再托管用户 UI。后续画布 UI 修改进入 `src/features/storycanvas/`，后端修改进入 `apps/storycanvas/src/`。

- 状态：D1 内部 Demo 已闭环；D2 规格就绪、实现待开发
- 基线：SaaS `98b07e9`
- D1 门禁：`GO_FOR_INTERNAL_DEMO`
- 已完成：C1-C8 首轮规格、共同治理库、跨仓 v0.1 fixtures、四角色工作台、显式脚本批准、current grant、Package/Receipt transport、ACK-first 额度入账、真实 active organization、原子 reset、安全错误路由、StoryCanvas canonical adapter、纯合成可播放 FALLBACK 与 16 步 Demo Pack。
- 商业口径：售卖 AI 视频额度；Agent 是增值工作流包装；不暴露上游 Key，不把演示数字当正式报价。
- 角色口径：Platform、Channel level-1、Enterprise Tenant、Tenant 内 Production operator；Production 不是第四类 Tenant 或 Organization。
- 媒体口径：FALLBACK 为 `SELF_GENERATED_SYNTHETIC / DEMO_ONLY`；technical QA passed，editorial not evaluated，brand not approved；非 FireRed、非真实 AI 成片。
- D2 目标：补齐平台管理员、渠道代理、企业管理员、内容运营四身份的统一登录、Mock 会话、受保护路由、差异化工作台和越权拒绝演示闭环。
- D2 权威规格：`docs/program/specs/C0_D2_IDENTITY_ROLE_WORKBENCHES.md`
- D2 实施口径：只做前端 + Mock；所有身份与允许/拒绝结果用于老板演示，不得宣称真实认证、真实 RBAC 或生产租户隔离。
- D2 验收重点：四身份默认落点、刷新恢复、退出失效、过期/损坏会话、直接 URL 越权、跨租户拒绝、两档视口和 D1 主链回归。
- D2 后端边界：真实 IdP、安全 Session、Membership/Role/Permission 数据模型、API 服务端授权、租户数据隔离、代理继承/分佣权限、审计和安全评审均为后续独立阶段。
- 权威 SaaS：`/Users/docfat/.codex/worktrees/4506/videoagent`
- 权威 StoryCanvas：`apps/storycanvas/`，来源提交 `46fc8d0`
- 权威静态报告：`docs/program/specs/C7_D1_STATIC_GATE_REVIEW.md`
- 主持材料：`docs/program/specs/C8_D1_DEMO_PACK_V0_1.md`
- 未完成：D2 前端实现、定向测试、lint/build/governance、四身份与越权视觉证据、D2 Demo Pack 增补和最终 Gate。
- 下游接手：先阅读 D2 权威规格，再按 P0/P1 清单实施与取证；保留 D1 业务事实和交互，不扩张真实后端基础设施。

## A/B Stage 0 交接（2026-07-31）

- A 分支：`dev/control-plane`；基线提交：`f48c210`。
- 环境和双服务已可运行，详见 `D2_STAGE0_BASELINE.md`。
- A 进入 A-01：会话合同、过期/损坏处理、安全站内回跳和对应测试。
- B 待处理：`StoryCanvasApp` Grant prop 类型导致的 Build 阻塞、ScriptEditor 失败测试、StoryCanvas 独立 lint/install Gate、vendor 换行符重写。
- 默认 Gate 当前状态：Governance PASS；Test/Lint/Build FAIL。任何一方不得把当前状态描述为 D2 Gate 已通过。
- 共享文件变更继续由 A 审核；B 的共享修复需独立 commit 并说明验收命令。

## A-01 完成交接（2026-07-31）

- A 已完成完整 DemoSession 合同、8 小时过期、损坏清理、身份元数据校验和 LocalStorage 安全失败。
- Router 已保存 pathname/query/hash，并按当前身份工作台与 canonical Project 执行站内白名单回跳。
- 定向证据：33 tests PASS，`npx eslint src`、Governance 和 `git diff --check` PASS。
- 详细报告：`D2_A01_AUTH_SESSION.md`。
- 本次没有修改 B 独占文件；B 可继续按 Stage 0 交接修复 Grant prop 类型和 ScriptEditor 测试。
- A-02 身份权限矩阵已冻结；下一步由 A 在共享 Router 实现统一权限和 Scope Guard。

## A-02 权限矩阵冻结（2026-07-31）

- A 已冻结 D2 前端授权为“工作台 + 具体路由/动作 + canonical scope”三层模型。
- 企业管理员拥有企业与生产工作台；内容运营拥有生产工作台和限定企业生产链入口，品牌大脑仅只读。
- 内容运营不得进入企业工作台、已购能力、新建 Brief，也不得修改品牌高权限配置。
- Tenant 固定为 `tenant-demo-hdl`，Project 固定为 `demo-local-001`；错误参数必须明确 403，不得自动映射。
- B 独占生产页面本轮不需修改；A 将在共享 Router 接入统一权限和 scope guard。
- 权威实现矩阵：`docs/program/threads/C0/D2_A02_PERMISSION_MATRIX.md`。

## A-02 权限模型第一切片（2026-07-31）

- A 已在 `src/domain/demoIdentity.ts` 落地具体路由/动作权限合同和四身份权限集合。
- 新权限模型目前尚未扩大旧 `allowedWorkbenches`，避免 Router 接线前产生临时越权。
- 下一步由 A 原子修改共享 Router、Sidebar、WorkbenchSwitcher 和安全回跳，再启用企业管理员/内容运营的企业 + 生产双工作台。
- 定向权限/Auth 测试 40 PASS；A 侧 TypeScript 错误为 0。
- B 侧仍只需处理 `IntegratedStoryCanvasPage.tsx` 的 Grant prop 类型，不需要修改 A 的权限合同。

## A-02 canonical 路由授权内核（第二切片，2026-07-31）

- A 已新增 `src/domain/demoRouteAccess.ts`，把 Router 当前 24 条业务路由统一登记为 permission、workbench、target label 和 scope。
- canonical Tenant 为 `tenant-demo-hdl`，canonical Project 为 `demo-local-001`；错误 ID 在身份权限之前返回 `scope-denied`。
- 授权内核只处理纯路径和身份，不依赖 React Router，可被 Router、Sidebar 和安全回跳共同复用。
- 定向验证：权限/路由/Demo Auth/Auth Store 66 tests PASS；相关 ESLint、Governance、`git diff --check` PASS。
- TypeScript 仍只被 B 侧 `IntegratedStoryCanvasPage.tsx` Grant prop 既有错误阻塞；A 未修改 B 独占文件。
- 本切片没有扩大 `allowedWorkbenches`，也没有改变 Router 运行行为。
- A 下一步接入共享 Router、安全回跳、canonical Scope Guard 和统一 403；Sidebar、WorkbenchSwitcher、双工作台和品牌只读保留到后续原子切片。

## A-02 Router 与统一拒绝合同（第三切片，2026-07-31）

- A 已将 Router 当前 24 条业务路由统一接入 `authorizeDemoNavigationRoute`，不再由各工作台单独维护粗粒度守卫。
- Router 与登录安全回跳现在共同复用路由登记、canonical Tenant/Project、具体权限和当前启用工作台四层判断。
- 新增统一 403：权限拒绝使用 `ROUTE_PERMISSION_DENIED`，错误 Tenant/Project 使用 `ROUTE_ID_REJECTED`，并展示身份、角色、组织、目标、返回、退出切换和 Demo 安全声明。
- 错误 Project 入口不再在页面内自动处理；Scope Guard 会在业务页面渲染前明确拒绝。
- 定向验证：5 个测试文件、79 tests PASS；相关 ESLint、Governance、`git diff --check` 和 B 独占目录检查 PASS。
- TypeScript 仍只被 B 侧 `IntegratedStoryCanvasPage.tsx` Grant prop 既有错误阻塞；A 未修改 B 独占文件。
- 为避免内容运营在品牌大脑只读能力完成前获得编辑页面，本切片没有提前扩大 `allowedWorkbenches`。
- A 下一步必须原子完成 Sidebar 权限过滤、WorkbenchSwitcher 合法落点、企业管理员/内容运营双工作台和品牌大脑只读，然后更新本切片的跨工作台暂拒测试。

## A-02 菜单、双工作台与品牌只读（第四切片，2026-07-31）

- A 已将企业管理员和内容运营的 `allowedWorkbenches` 原子扩为 `tenant + production`；平台管理员和渠道代理仍为单工作台。
- 企业工作台统一落到 `/projects/demo-local-001/brand`，生产工作台统一落到 `/production/overview`；WorkbenchSwitcher 还会用 canonical 导航授权过滤无合法入口的选项。
- Sidebar 已由工作台粗粒度展示改为逐菜单具体权限过滤。内容运营企业侧仅显示品牌大脑、脚本、分镜和任务/交付，不显示企业工作台、已购能力和新建 Brief。
- 品牌大脑已按 `enterprise.brand-manage` 区分管理与只读：内容运营不能编辑资料、改变事实状态或保存配置，但保留查看、导出和进入脚本的能力。
- 登录安全回跳与 Router 已允许冻结矩阵中的合法跨工作台路径，同时继续拒绝平台/渠道越权、内容运营 `/dashboard` 和错误 canonical 资源。
- 验证证据：权限/路由/Auth/品牌 71 tests PASS，App Smoke 11 tests PASS；相关 ESLint、Governance、`git diff --check` 和 B 独占目录检查 PASS。
- TypeScript 仍只被 B 侧 `IntegratedStoryCanvasPage.tsx:76` Grant prop 既有错误阻塞；A 未修改 B 独占文件。
- A-02 前端权限、路由、菜单和只读动作合同已完成定向收口。A 下一步进入 A-03 控制平面业务收口；最终 D2 Gate 仍需等待 B 基线缺口、视觉证据和完整回归。

## A-03 控制平面业务收口计划（2026-07-31）

- A 已完成平台、固定一级渠道和企业控制平面的只读审计；当前未修改业务代码。
- 现有合同已具备组织、产品、SKU、Entitlement、RateCard、Tenant Wallet、CreditLedger 和三类 Receipt，但没有渠道库存、价格、订单或收益只读投影。
- A-03 将先新增带 `DEMO / NON_QUOTE` 标识的 scoped commercial projection 与 selector 测试，再依次收口平台、渠道和企业页面。
- 渠道固定使用 `channel-demo-level-1` + `CHANNEL_SUBTREE_COMMERCIAL`，不提前实现真实多级继承、自动分佣、支付或结算引擎。
- 金额与额度严格分离；金额不进入 CreditLedger，客户价格和 Wallet 不进入 ProjectProductionPackage。
- A 不修改 B 独占生产目录；企业生产结果只消费 Receipt/Asset/Export 元数据。
- 详细计划：`docs/program/threads/C0/D2_A03_CONTROL_PLANE_PLAN.md`。
- 下一切片：A-03.1 商业只读投影与工作台可见性 selector，独立测试并独立提交。

## A-03.1 商业只读投影交接（2026-07-31）

- A 已在 `ControlPlaneCommercialFixture.demoBusiness` 落地 canonical Demo 商业只读投影，数据参与 fixture digest、运行时校验和 reset 重建。
- 投影包含五层价格、两条订单、固定一级渠道库存与对账、平台风险摘要；金额全部为 `amountMinor + CNY`，并保留 `DEMO / NON_QUOTE` 声明。
- `src/domain/controlPlaneViewModels.ts` 已提供 platform/channel/tenant 三类可见性 selector；平台/渠道不获得企业生产正文，企业不获得价格、订单、库存、对账或平台风险。
- 渠道视角固定为 `channel-demo-level-1`，只暴露 Master→Level 1 直接取得价和 Level 1 直接售出价格；上游 Provider 成本与 Platform→Master 结算价不可见。
- 定向测试与 storage/mock adapter 合计 12/12 PASS；相关 ESLint、Governance、diff 和 B 独占目录检查 PASS。
- 全量 TypeScript 未发现 A-03.1 新增错误；仍有 B 侧 StoryCanvas Grant prop 和根 Vite Node 类型声明基线缺口。
- 下一步由 A 进入 A-03.2，只改共享平台控制平面页面和测试，不修改 B 独占目录。

## A-03.2 平台路由语义分离交接（2026-07-31）

- A 已将 `/platform/overview`、`/platform/organizations`、`/platform/catalog` 和 `/platform/production-receipts` 拆成四个独立平台管理页面。
- 四页面统一使用 `selectPlatformCommercialView`；selector 新增 Capability 与 RateCard 投影，平台页面不再直接读取 Tenant `creditState.ledger`、ScriptApproval、ProductionPackage 或生产正文。
- overview 负责全局指标与入口，organizations 负责组织树和 Tenant 内容边界，catalog 负责 Product/Capability/SKU/RateCard 与五层非正式价格，receipts 负责 GenerationTask/Asset/Export 状态和异常计数。
- 旧 `WorkbenchHomePage` 平台分支和旧 Wallet/ledger 回执投影已删除；渠道页面仍保持原实现，A-03.3 再按固定一级渠道 selector 收口。
- 验证证据：平台页面 4/4、selector 7/7、App Smoke 11/11 PASS；相关 ESLint、Governance、diff 和 B 独占目录检查 PASS。
- TypeScript 未新增 A 侧错误；剩余三个错误仍为 B 侧 Grant prop 与根 Vite Node 类型声明既有基线。
- 下一步由 A 进入 A-03.3；B 独占目录本切片无变更。

## A-03.3 渠道商业视角收口交接（2026-07-31）

- A 已将 `/channel/overview`、`/channel/products`、`/channel/customers` 和 `/channel/customers/:tenantId/usage` 拆成四个独立渠道商业页面。
- 四页面统一使用 `selectChannelCommercialView`，固定视角为 `channel-demo-level-1` + `CHANNEL_SUBTREE_COMMERCIAL`；Router 继续统一拒绝错误 canonical Tenant。
- overview 展示当前一级渠道、直接下级、企业客户、额度库存、销售净额和订单毛差；products 仅展示非锁定产品及当前渠道直接参与的价格快照，上游 Provider 成本与 Platform→Master 结算价不可见。
- customers 展示 Tenant 商业状态、Entitlement 数量和汇总用量；usage 展示 Wallet、客户订单、消费/释放聚合与三类回执数量，不展开生产正文或原始 CreditLedger。
- `TenantCommercialSummary.creditUsage` 由 canonical `creditScenarios` 聚合 consumed/released 数量，仅作为 Demo 商业摘要。
- 无路由引用的旧 `WorkbenchHomePage` 已删除；A 未修改 B 独占目录。
- 验证证据：渠道页面 4/4、selector 7/7、App Smoke 11/11 PASS；相关 ESLint、Prettier、Governance、diff 和 B 独占目录检查 PASS。
- TypeScript 未新增 A 侧错误；剩余三个错误仍为 B 侧 Grant prop 与根 Vite Node 类型声明既有基线。
- 下一步由 A 进入 A-03.4 企业经营概览与产品语义。

## A-03.4 企业经营概览与产品语义交接（2026-07-31）

- `/enterprise/products` 已从通用 platform/channel/tenant 目录组件收口为企业专用产品语义，唯一数据入口为 `selectTenantCommercialView`。
- 企业产品状态由当前 Tenant Entitlement 决定：2 项已购、2 项说明态、2 项锁定；平台目录 `availability` 不再直接代表企业已购。
- `TenantProductView` 提供 Product、Capability、SKU、Entitlement 关联投影，不暴露价格、订单、渠道库存、结算、平台风险或 CreditLedger。
- 企业产品页不再展示平台式演示 RateCard；“开始使用”固定进入 `/projects/demo-local-001/brand`，说明态不执行，锁定态按钮禁用。
- Dashboard 通过 tenant selector 展示团队、项目、Wallet、已购能力和三类回执状态计数；Receipt 聚合按 canonical Tenant 过滤，且不返回 input digest、storage reference、output asset IDs 等载荷字段。
- A-02 内容运营拒绝 `/dashboard`、`/enterprise/products` 的合同未修改，并由 `demoRouteAccess.test.ts` 回归覆盖。
- 验证：ProductCatalog 3/3、Dashboard 3/3、selector 8/8、route access 28/28、App Smoke 11/11，合计 53/53 PASS；ESLint、Prettier、Governance、`git diff --check`、B 独占目录检查 PASS。
- TypeScript 未新增 A-03.4 错误；仍复现三个既有错误：B 侧 `IntegratedStoryCanvasPage.tsx:76` Grant prop，以及根 `vite.config.ts` 缺少 `node:path` / `__dirname` 类型。
- A 下一步进入 A-03.5；B 独占目录本切片无变更。

## A-03 控制平面集成交接（2026-07-31）

- 状态：A-01 Mock 会话、A-02 路由/动作/canonical Scope 授权、A-03 平台/渠道/企业商业视图均已完成；A 控制平面标记为 `READY_FOR_INTEGRATION`，不代表 D2 全仓 Gate 已通过。
- 分支与范围：`dev/control-plane`，基线 `f48c210`，交付头提交 `e4d70ff`；本次文档收口提交完成后以新的分支头为准。
- A-03 提交顺序：`d99e9b7` 计划 → `5a9cf52` 商业投影 → `33e6b90` 平台页面 → `351a368` 渠道页面 → `3a04748` 企业页面 → `e4d70ff` 顶栏视觉修复。
- 定向证据：四身份/越权/App Smoke 合计 49/49 PASS；A-03.4 页面、Selector、权限与 Smoke 合计 53/53 PASS；Governance、相关 ESLint/Prettier、`git diff --check` 和 B 独占目录检查 PASS。
- 视觉证据：完成 1440×900 平台、渠道、企业关键页面检查和 1280 宽度补充检查；顶栏上下文选择器已保持在 56px 顶栏内，较窄视口下退出操作保持可见。
- A 未修改 B 独占目录：`src/pages/production/`、`src/pages/script-editor/`、`src/pages/storyboard/`、`src/pages/rough-cut/`、`src/features/storycanvas/`、`apps/storycanvas/src/`。
- 全量 Test 基线：132/141 PASS、9 项超时失败、1 个环境卸载后的 MutationObserver 异常；失败文件单独复跑 BrandBrain 5/5、Brief 2/2、ScriptEditor 8/8、App Smoke 11/11 PASS。完整 Test Gate 仍为 FAIL，集成阶段需处理并发资源或超时配置，不能用定向通过替代全量 Gate。
- 全量 Build 基线：3 个既有错误，分别为 B 侧 `IntegratedStoryCanvasPage.tsx:76` Grant prop 类型，以及根 `vite.config.ts` 缺少 `node:path` / `__dirname` 类型。
- 全量 Lint 基线：702 problems（697 errors、5 warnings），主要位于 `apps/storycanvas/src/` 等 StoryCanvas 存量代码。
- B 交付要求：推送 `dev/production-plane`；提供提交清单、共享文件改动、验证命令和已知问题；共享文件修改必须独立 commit，禁止强推或覆盖 A 成果。
- 集成方式：不要把 B 分支直接合入 `dev/control-plane`。从最新 `main` 创建短期 `integration/d2-a03-b03`，依次合并 A、B，逐段审查 Router/layout/design/contracts/store 等共享冲突。
- 集成 Gate：`npm test`、`npm run lint`、`npm run build`、`npm run validate:governance`、`git diff --check`，并回归四身份、直接 URL 越权、D1 生产主链和 1440×900/1280×800 关键视口。

## A-04.0 控制平面生产交付投影计划（2026-08-03）

- A-01～A-03 与第一轮 A/B 集成已进入 `main@8594e21`；`dev/control-plane` 已 fast-forward 到该基线。
- `integration/d2-phase1-production-loop` 保持干净并留给未来正式集成；`origin/codex/*` 已确认为 B 临时分支，不 merge、不 cherry-pick，也不作为 A 的设计输入。
- A-04 目标是在现有 v0.1 Package / Grant / Receipt / Credit 合同上，形成 Tenant/Project scoped 的生产交付只读投影、Store/Adapter 可靠性证据和企业 Dashboard 状态解释。
- 审计发现当前商业 selector 只提供 Receipt 数量；Dashboard 没有消费 last dispatch/sync/transport/error；任务按 Receipt 记录计数而不是唯一 task 归并；Adapter、Store、Bridge 边界和原子 reset 缺少直接测试。
- A 边界：允许修改 controlPlane domain/view model、controlPlane Adapter/Store、reset、Dashboard 和 A 文档；不得修改 `storyCanvasBridge.ts`、生产页面/组件、StoryCanvas 或 `apps/storycanvas/src/`。Bridge 问题必须交给 B。
- 基线验证：相关 4 个测试文件 16/16 PASS。
- 详细计划：`docs/program/threads/C0/D2_A04_DELIVERY_EVIDENCE_PLAN.md`。
- 下一切片：A-04.1 `feat(control-plane): add tenant delivery evidence projection`。

## A-04.2 控制平面交付可靠性交接（2026-08-03）

- 状态：A-04.1 Tenant/Project 交付只读投影与 A-04.2 Store/Adapter/Reset 可靠性已完成，标记为 `A04_2_RELIABILITY_READY`。
- ViewModel 只输出安全交付证据：Package、Grant、transport、sync、唯一任务、Asset/Export 数量、运行时额度、错误和可恢复动作；禁止生产正文、Provider/存储内部字段、商业价格和跨租户数据。
- Adapter 覆盖命令幂等、Receipt duplicate、冲突终态、成功/失败额度时序与 preflight 零副作用。
- Store 覆盖 dispatch/retry、ACK 失败零入账、duplicate 不重复结算、部分/整体同步失败映射。
- Reset 覆盖成功清理、普通 rollback、rollback 自身失败、旧 activeOrganization 拒绝和失败时旧运行证据保留；成功 Reset 已清除 `lastPackageDispatch` / `lastReceiptSync`。
- 验证：A-04.1 + A-04.2 共 6 个 Test Files、28 个 Tests PASS；相关 ESLint、Prettier、`git diff --check` PASS；生产 Build PASS。
- A 未修改 `src/services/storyCanvasBridge.ts`、生产页面/组件、StoryCanvas 或 `apps/storycanvas/src/`。
- 下一步：A-04.3 由 Dashboard 消费安全 ViewModel，保持企业管理员可见、内容运营拒绝合同，并完成页面 Reset 状态与两档视口验收。

## A-04 控制平面交付状态完成交接（2026-08-03）

- 状态：`A04_READY_FOR_INTEGRATION`；A-04.1～A-04.4 已完成。
- 企业 Dashboard 只消费安全 Tenant/Project ViewModel，展示 Package、Grant、transport、receipt sync、唯一任务、Asset/Export、额度 reserved/consumed/released 和安全错误，不泄漏 Receipt payload、存储引用、Provider 内部字段、商业价格或跨租户数据。
- 功能提交：`47e74b0` Delivery View → `85f4251` Adapter 测试 → `3cf56fd` Store 同步测试 → `926fa06` Reset 清理 → `9a224be` Dashboard UI；中间边界测试提交见分支日志。
- 定向回归：4 Files / 51 Tests PASS；全量串行回归：26 Files / 181 Tests PASS。
- Build PASS，Governance PASS，`git diff --check` PASS；A-04 文件定向 ESLint PASS。
- 视觉证据：`docs/program/evidence/a04-dashboard-delivery-1440x900.png`、`docs/program/evidence/a04-dashboard-delivery-1280x800.png`；两档均无横向溢出。
- 全仓 `npm run lint` 仍被 B 的 StoryCanvas 存量代码阻塞：702 problems（697 errors、5 warnings）。A 不修改 `src/features/storycanvas/`、生产页面/组件、`storyCanvasBridge.ts` 或 `apps/storycanvas/src/` 来消除此债务。
- StoryCanvas API 启动后产生的未跟踪空文件 `apps/storycanvas/data/vendor/byteplus.ts` 属于 B 范围，A 提交必须排除。
- 集成建议：推送 `dev/control-plane` 后，从最新 `main` 建立短期集成分支；全仓 Lint 由 B 修复或在集成验收中作为明确阻塞处理。

## A-04 集成接受交接（2026-08-04）

- 状态：`A04_INTEGRATION_ACCEPTED`。A-04 已从 `origin/main@8594e21` 建立 `integration/d2-a04-control-plane`，并以 `03bc566` 显式合入 `dev/control-plane@2fe1ec5`。
- 边界审查：B 独占目录和共享集成文件相对 `main` 无跟踪文件变化；合并无冲突；集成分支文件树与 A 正式交付头一致。
- Gate：A-04 定向 4 Files / 51 Tests PASS；全量串行 26 Files / 181 Tests PASS；A-04 定向 ESLint、Build、Governance、`git diff --check` 全部 PASS。
- 例外：全仓 Lint 维持既有 702 problems（697 errors、5 warnings），集中于 B/StoryCanvas 范围。用户已明确接受该既有例外，不阻止本轮 A-04 合入；债务继续归 B 或后续专项治理。
- 运行时文件：未跟踪的 `apps/storycanvas/data/vendor/byteplus.ts` 未暂存、未提交、未删除或修改。
- 权威记录：`docs/collaboration/integration/D2_A04_INTEGRATION_2026-08-04.md`。
- 最终结果：推送前确认 `origin/main@8594e21` 未前移；本地 `main` 已以 `--ff-only` 快进并推送，核对 `main == origin/main@1df2bd1`。下一轮 A 任务尚未立项。

## A 业务平台线重规划交接（2026-08-06）

- 上游已在 A-04 之后引入 27 个提交和真实 Pilot 控制平面；A 由旧 Demo 控制平面升级为业务平台负责人。
- 最新权威分工为 `docs/collaboration/A_B_CO_CREATION_SPLIT_2026-08-06.md`，推荐 A 分支改为 `dev/business-plane`。
- 当前真实 Auth 仍是单 Tenant `LoginIdentity`；organizations/channels/registrations/invitations/terms/billing/commissions 尚未实现。
- 实施必须先完成 Wave 0：权限矩阵、多组织 Session、注册归因、Terms、支付/佣金口径 ADR 和 fixture，再进入 migration 006+。
- Root 单 worker 195/195、Build、Governance、Control API typecheck/build 已通过；Control API 6 个 PostgreSQL 测试待专用数据库恢复；Q1 canonical runner 存在 StoryCanvas tsx 版本兼容问题，业务合同用兼容 runner 复验 10/10。
- A 必须继续排除未跟踪 `apps/storycanvas/data/vendor/byteplus.ts`，禁止修改、删除或提交。
- 详细切片、验收和 Git 纪律见 `docs/program/threads/C0/A_BIZ_LATEST_MAIN_PLAN_2026-08-06.md`。

## A-BIZ-00.1 PostgreSQL Gate 交接（2026-08-06）

- PostgreSQL 16.14 已在本机完成初始化并作为 Homebrew 服务运行；专用数据库必须保持 `_test` 后缀，因为测试会删除并重建 `control_plane` schema。
- 完整 Gate 命令需要通过临时 `CONTROL_API_TEST_DATABASE_URL` 指向隔离测试库，不向仓库提交数据库密码或本地环境文件。
- 当前稳定验证命令：`npm --prefix apps/control-api test -- --pool=forks --maxWorkers=1`，结果为 14 files / 57 tests PASS / 0 SKIP。
- 不建议直接并发运行两个 PostgreSQL suite：它们共享同一测试 schema，并发初始化可触发 `pg_namespace_nspname_index` 竞争；该现象不代表业务合同失败。
- A 仍须排除 B 运行时文件 `apps/storycanvas/data/vendor/byteplus.ts`。
- 下一交付：A-BIZ-00.2 权限/组织 ADR、老板/工作人员矩阵、多组织 Session 上下文和跨组织拒绝语义；未冻结字段保持 `TBD`。

## A-BIZ-00.2 多组织权限 ADR 交接（2026-08-06）

- 提案文档：`docs/program/threads/C0/A_BIZ_00_2_MULTI_ORG_RBAC_ADR.md`。
- 推荐方向：新增 Organization 授权根，保留 Tenant 业务实体并增加 Channel 扩展；Membership 绑定 Organization；Session 绑定单一 Active Membership Context；Content Operator 必须按 Project Assignment 收口。
- 外部拒绝语义：未认证/Context 失效为 401；已知资源类别但缺动作权限为 403；跨组织、跨 Tenant、未授权项目和伪造 Scope 统一 404；业务状态/幂等冲突为 409。
- 兼容策略：migration `006+` 仅允许增量加表/nullable 字段、Pilot 回填、双写/Shadow Policy 和独立清理 migration，不允许立即替换现有 Tenant/Package/Grant 合同。
- 必须会签：一人多组织/多角色、`pilot_support`、工作人员是否创建项目、历史 Content Operator Assignment 回填、Platform 唯一性和代理层级表达。
- 对 B 的边界：B 继续只消费 A 已授权的 Project/Grant Context，不读取或修改 Membership；本切片没有触碰 StoryCanvas。
- 下一步：C0/产品/B 审阅并接受或修订 ADR；完成范围冻结前不实现 migration `006`。

## A-BIZ-00.3 注册、须知与账务 ADR 交接（2026-08-06）

- 提案文档：`docs/program/threads/C0/A_BIZ_00_3_REGISTRATION_TERMS_BILLING_ADR.md`。
- 推荐顺序：Terms 发布能力 → Invitation → 三路 Registration/Attribution → TEST Recharge/Payment Inbox → Credit Issuance → Commission Shadow/Accrual。
- 注册事务必须共同写入 User、Organization/Membership、Consent、Invitation Usage、Referral Attribution、审计与幂等结果；缺 PUBLISHED Terms 或 C 端组织归属未冻结时 fail closed。
- 三账分离：Payment/Recharge 使用钱的最小单位与币种；AI Credit 使用 append-only Credit Ledger；Commission 使用 Accrual/Reversal/Settlement，任一事件重放不得重复副作用。
- 规则冲突：旧 C3 的逐边批发差价与最新充值佣金要求不是同一模型，必须书面决定二者关系并防止重复收益。
- 未冻结边界：正式须知、邀请/归因保护、真实支付、退款、额度换算、佣金、税务、KYC、提现和自动打款全部 `TBD`。
- 下一步：C0、产品/业务、财务/法务和 B 审阅两份 Wave 0 ADR；会签前不写 migration `006+` 和公开注册/资金代码。

## Wave 0 业务决策接受交接（2026-08-07）

- 权威决策：`docs/collaboration/A_ENGINEER_WAVE0_BOSS_DECISION_REPLY_2026-08-06.md`；企业/个人统一模型补充：`docs/collaboration/A_ENGINEER_BUSINESS_DECISION_CORRECTION_2026-08-06.md`。
- 两份 ADR 已从 `PROPOSED` 更新为 `ACCEPTED / IMPLEMENTATION_AUTHORIZED`：`A_BIZ_00_2_MULTI_ORG_RBAC_ADR.md`、`A_BIZ_00_3_REGISTRATION_TERMS_BILLING_ADR.md`。
- A-BIZ-01.1 已解除业务阻塞：允许开始 migration `006+`、Organization/Membership/Role、Project Assignment 和 Pilot 白名单回填。
- 统一模型：个人与企业共用普通 Tenant、Membership 和统一创作工作台；直接/平台邀请/代理邀请创建单人 Tenant，企业成员邀请加入既有 Tenant。
- 权限模型：Schema 支持多组织/多角色，首版单一活动 Membership/一个主角色；`content_operator` 不创建项目，只访问 active Assignment；`pilot_support` 跨 Tenant 必须显式限时 Support Grant。
- 商业模型：首版充值佣金替代旧批发差价，只做直接归因单级佣金；TEST Payment、额度 SKU、Accrual/Reversal 和 Settlement Draft 可建底座。
- 仍 fail closed：正式 Terms 正文、真实支付商户、真实 SKU 售价/额度、佣金比例/观察期、税务/KYC/提现/出款。不得用 Demo 数字补缺。
- Git/边界：当前 A 分支 `dev/business-plane`；继续禁止暂存或修改 `apps/storycanvas/data/vendor/byteplus.ts`，禁止 `git add .`。
- 下一交付：A-BIZ-01.1 test-first PostgreSQL migration；先失败测试，再最小实现和显式回填，独立 commit。

## A-BIZ-01.1 006A Organization Foundation 交接（2026-08-07）

- 实现文件：`apps/control-api/src/db/migrations/006_organization_foundation.ts`。
- 测试文件：`apps/control-api/src/db/organizationFoundation.postgres.test.ts`；特意不放入 migrations 目录，避免 Knex 将测试当作 migration 加载。
- 兼容策略：每个历史 Tenant 使用同 UUID 创建 `TENANT` Organization，并写入 NOT NULL/UNIQUE/FK 的 `tenants.organization_id`；旧 Tenant ID、Project 外键和跨平面 Tenant 合同均不改变。
- 数据库约束：Organization type/status、parent FK、自指拒绝、Tenant 一对一映射、Tenant 扩展类型双向保护。
- 明确未做：Channel 扩展、Membership/Role、Session Active Context、Project Assignment、Platform bootstrap、真实商业规则。
- Platform 策略：migration 不写入品牌/商业名称，不建立数据库全局唯一 active Platform 约束；运行时唯一性留给后续 bootstrap/config。
- 回滚：先移除类型保护触发器与 Tenant 新列，再删除 organizations；历史 tenants 保留。
- 测试证据：RED 4/4；Green 定向 PostgreSQL 4/4；Control API 完整单 worker Gate 15 files / 61 tests PASS / 0 SKIP，typecheck/build/定向 ESLint/Governance/`git diff --check` PASS；本切片使用独立 `feat(control-api)` 提交交付。
- B 边界：StoryCanvas tracked diff 为零；`apps/storycanvas/data/vendor/byteplus.ts` 继续作为 B 的未跟踪运行时文件排除。
- 下一切片：007 Channel 扩展表及其 Organization 类型一致性，不写死总代理/一级/二级层级，也不写死价格和佣金。

## A-BIZ-01.1 007 Channel Foundation 交接（2026-08-07）

- 实现文件：`apps/control-api/src/db/migrations/007_channel_foundation.ts`。
- 测试文件：`apps/control-api/src/db/channelFoundation.postgres.test.ts`；继续放在 `src/db/`，避免 Knex migration loader 将测试文件误识别为 migration。
- 数据模型：`control_plane.channels` 是 `CHANNEL` Organization 的一对一类型扩展，只包含 Channel UUID、唯一 Organization UUID 和时间戳。
- 类型约束：写入 Channel 时必须引用现存 `CHANNEL` Organization；Organization 已有关联 Channel 后不得改成 `PLATFORM` 或 `TENANT`。
- 层级边界：组织父子树支持任意深度，但不自动产生授权；Schema 不包含固定总代理/一级/二级、tier、depth、price 或 commission。
- 商业边界：首版固定三级属于产品开放规则；价格、佣金和真实代理关系版本属于后续 Channel Relationship/商业规则切片。
- 数据与回滚：无历史 Channel 数据，不做伪造回填；down 只删除 Channel 表、触发器和函数，保留 Organization/Tenant。
- 测试证据：RED 4/4；Green 定向 PostgreSQL 4/4；完整 Control API 单 worker Gate 16 files / 65 tests PASS / 0 SKIP。
- 工程 Gate：typecheck、build、007 定向 ESLint、Governance、`git diff --check` 全部 PASS。
- B 边界：StoryCanvas tracked diff 为零；`apps/storycanvas/data/vendor/byteplus.ts` 仍是 B 的未跟踪运行时文件，禁止纳入 A 提交。
- 下一切片：先审计并冻结 Organization Membership/Role 的演进路径、旧 Tenant Membership 兼容/回填、多角色表和组织类型约束，再 test-first 实现 migration `008`；Session Active Context 与 Project Assignment 保持后续独立切片。

## A-BIZ-01.1 008 Organization Membership / Role 计划交接（2026-08-07）

- 技术选择：不原地替换旧 `control_plane.memberships`；新增 canonical Organization Membership/Role 表，降低对当前 Auth、bootstrap、fixture 和 rollback 的影响。
- 新 Membership 以 `user_id + organization_id` 唯一，保留原 Membership UUID、状态和时间戳；`version` 从 1 开始。
- `primary_role_code` 使用可延迟复合外键保证主角色属于角色集合；Role 表支持未来多角色。
- 迁移回填只接受无歧义的单角色 Tenant Membership；旧多角色和 Tenant `pilot_support` 必须先人工审计，migration fail closed。
- 兼容策略：旧表继续承接当前运行时写入，并通过触发器单向同步新表；新表写入与 Auth/Session 切流属于后续服务切片。
- 类型矩阵和 Organization 反向类型保护必须由数据库验证，组织父子树不产生授权。
- Test-first 至少覆盖回填、类型矩阵、多角色/单主角色、旧表同步、歧义拒绝、反向类型保护和 down 保留旧数据。
- 详细计划：`docs/program/threads/C0/A_BIZ_01_1_008_ORGANIZATION_MEMBERSHIP_PLAN.md`。
- 下一步：创建 `organizationMembership.postgres.test.ts`，先确认 migration 缺失时按预期 RED，再实现 `008_organization_membership.ts`。

## A-BIZ-01.1 008 Organization Membership / Role 交接（2026-08-07）

- 实现文件：`apps/control-api/src/db/migrations/008_organization_membership.ts`。
- 测试文件：`apps/control-api/src/db/organizationMembership.postgres.test.ts`；继续位于 `src/db/`，避免被 Knex migration loader 误扫描。
- 数据模型：新增 canonical `organization_memberships` 与 `organization_membership_roles`；同一 User/Organization 唯一，Membership 支持多角色且只有一个明确 `primary_role_code`。
- 一致性约束：可延迟复合 FK 保证主角色属于角色集合；Role/Organization 类型矩阵和 Organization 反向改型均由数据库 trigger fail closed。
- 历史回填：保留旧 Tenant Membership UUID、状态和时间戳，version 初始化为 1；旧多角色、Tenant `pilot_support` 或非法 Organization 映射在创建新表前拒绝。
- 兼容策略：当前 Auth Repository、bootstrap 和 Session 继续读写旧 `memberships`；旧表 insert/update/delete 单向 Shadow 到新表；新表到旧表反向写入尚未开放。
- 更新与回滚：legacy update 使用同一 statement 内 delete + reinsert，失败时 PostgreSQL 整体回滚；down 移除 008 trigger/function、复合 FK 和两张新表，保留 001/006/007 模型与历史数据。
- 测试证据：有效 RED 7/7；定向 Green 7/7；完整 PostgreSQL 单 worker Gate 17 files / 72 tests PASS / 0 SKIP。
- 工程 Gate：Control API typecheck、build、008 定向 ESLint、Governance、`git diff --check` 全部 PASS。
- 明确未做：Auth/Session 切流、Membership version 自动递增、Project Assignment、Support Grant、组织切换 UI、代理层级、价格和佣金。
- B 边界：StoryCanvas tracked diff 为零；`apps/storycanvas/data/vendor/byteplus.ts` 仍是 B 的未跟踪运行时文件，禁止纳入 A 提交。
- 当前状态：`A_BIZ_01_1_008_COMPLETE / READY_TO_COMMIT`。
- 下一切片：先冻结 migration 009 的 Project Assignment 与 Pilot 显式回填合同；完成 A-BIZ-01.1 剩余 Schema 后再进入 A-BIZ-01.2 多上下文 Session。

## A-BIZ-01.1 009 Project Assignment / Pilot 回填计划交接（2026-08-07）

- 审计结果：当前 `SessionActor` 无 Membership/Organization Context，Project Router 允许 `tenant_admin` 和 `content_operator` 的全部 POST/PATCH，Repository 只按 Tenant 过滤。
- 风险结论：现有数据没有工作人员项目 allowlist，不能从角色、Project `created_by`、邮箱、UUID 或同 Tenant 关系推断合法 Assignment。
- 009A Schema：Project Assignment 绑定 Project、Tenant Organization 和 Organization Membership，使用复合 FK 拒绝跨 Tenant；access level 为 viewer/editor，状态为 active/suspended/revoked。
- 生命周期：scope/source/creator 不可变，revoked 为终态，业务 delete 拒绝；Membership 停用或移除 Role 时保留 Assignment 审计行，但运行时不得产生访问。
- Role 边界：首版仅 active `content_operator` 可创建 Assignment；Tenant Admin 全项目能力不通过 Assignment 表达；Platform/Channel/`pilot_support` 不得借此访问客户内容。
- 009B 回填：独立 manifest runner 验证 active tenant_admin 批准人、active content_operator Membership、同 Tenant Project，并以 canonical digest + backfill run 保证审计、幂等和原子性。
- 兼容策略：本轮不切换 Auth/Session、Project/Production Router 或 Repository；Assignment 先作为 Shadow 授权事实，正式 Policy 切流属于 A-BIZ-01.3。
- 详细计划：`docs/program/threads/C0/A_BIZ_01_1_009_PROJECT_ASSIGNMENT_PLAN.md`。
- 下一步：计划提交后创建空 `009_project_assignment.ts` 与 `projectAssignment.postgres.test.ts`，先确认有效 RED。

## A-BIZ-01.1 009A Project Assignment RED 交接（2026-08-07）

- 空 migration：`apps/control-api/src/db/migrations/009_project_assignment.ts`，当前只执行 `select 1`，不创建数据库对象。
- 合同测试：`apps/control-api/src/db/projectAssignment.postgres.test.ts`，位于 `src/db/` 而非 migrations 目录。
- 测试共 7 项，覆盖合法 Assignment、跨 Tenant/Organization 与 Membership/Role/status 拒绝、枚举/唯一/source、不可变生命周期、审计保留和 down 边界。
- 防假通过：所有测试在执行 rejection 断言前先验证两张 009 表真实存在。
- RED 证据：专用 `_test` 数据库单 worker 运行 1 file / 7 tests，7 项均因 `project_assignment_backfill_runs` 不存在而失败，fixture 和 001/006/008 前置迁移均正常。
- 静态证据：Control API typecheck、009 定向 ESLint、Prettier、`git diff --check` 均通过。
- 下一步只实现 009A migration 最小 Schema/constraint/trigger；不实现 manifest runner，不修改 SessionActor、Auth、Project Router/Repository 或 StoryCanvas。
- 版本策略：RED 文件暂不独立提交；009A 转绿并完成完整 Gate 后，与最小 migration 一起形成单独 `feat(control-api)` 提交。

## A-BIZ-01.1 009A Project Assignment Schema 交接（2026-08-07）

- migration：`apps/control-api/src/db/migrations/009_project_assignment.ts`。
- 测试：`apps/control-api/src/db/projectAssignment.postgres.test.ts`。
- 新表：`project_assignment_backfill_runs` 与 `project_assignments`；真实 Pilot manifest 内容不在 migration 或测试中硬编码。
- 一致性：Project/Tenant、Tenant/Organization、Membership/Organization、BackfillRun/Tenant/Organization 全部使用复合 FK，不依赖应用层猜测。
- eligibility：仅插入时验证 active TENANT `content_operator`；后续 Membership 生命周期变化保留 Assignment 历史，运行时必须在 A-BIZ-01.3 联合检查 Membership/Role/Assignment。
- lifecycle：active ↔ suspended，二者可进入 revoked；revoked 终态；scope/source/creator 不可变；revoked 后 access/timestamp 不可改；业务 delete 拒绝。
- source：manual/run-null 与 pilot_backfill/run-not-null 由 check + FK 保证；backfill evidence update/delete 拒绝。
- down：先移除 009 trigger/function 和两张表，再移除 009 新增复合唯一约束；保留 Project、Membership、Tenant、Organization 和内容数据。
- 验证：定向 7/7；完整 PostgreSQL 18 files / 79 tests；typecheck、build、009 ESLint、Governance、diff-check 全 PASS。
- 兼容边界：Auth Session、Project Router/Repository、Production、009B runner 和 StoryCanvas 均未修改。
- 下一步：009B 实现严格 manifest schema、canonical digest、批准人/目标/Project 验证、单事务写入和 replay 幂等。

## A-BIZ-01.1 009B 显式回填 Runner 计划交接（2026-08-07）

- 计划文件：`docs/program/threads/C0/A_BIZ_01_1_009B_PROJECT_ASSIGNMENT_BACKFILL_PLAN.md`。
- 核心模块负责严格 Zod Schema、重复 pair 拒绝、canonical digest、事务验证、幂等 replay 和安全结果。
- digest 排除独立 `manifestId`，Assignments 按 Membership/Project/access 排序；这使 ID 冲突与 digest 复用冲突可以分别识别。
- CLI 只读 `PROJECT_ASSIGNMENT_MANIFEST_PATH`，不接受隐式默认或自动扫描；成功输出安全摘要，失败输出通用消息。
- 009A Schema/FK/trigger 保持第二层 fail-closed 保护，009B 不改 migration 历史。
- 下一步 Test-first 覆盖原子写入、replay、ID/digest 冲突、批准人/目标/Project 拒绝、零部分写入和日志不泄漏。

## A-BIZ-01.1 009B Project Assignment Backfill RED 交接（2026-08-07）

- 骨架：`apps/control-api/src/projects/projectAssignmentBackfill.ts`；当前公开类型和 API 可编译，但 parser、digest、runner 都明确抛出未实现错误。
- 合同测试：`apps/control-api/src/projects/projectAssignmentBackfill.postgres.test.ts`，共 8 项，覆盖原子写入、顺序无关 digest/replay、冲突与严格 Schema、授权范围、零部分写入、安全日志和并发序列化。
- RED 证据：专用 `_test` PostgreSQL 单 worker 运行 1 file / 8 tests，8 项均因对应行为未实现而失败；001/006/008/009 fixture 正常完成。
- 静态证据：Control API typecheck、009B 定向 ESLint、Prettier、`git diff --check` 均通过。
- 下一步只实现 009B 最小核心 runner，再补 CLI 与 npm script；不修改 migration 009A、SessionActor、Auth、Project Router/Repository、Production 或 StoryCanvas。
- 版本策略：RED 文件暂不独立提交；009B 转绿并完成完整 Gate 后，与 CLI、script 和 C0 记忆一起形成单独 `feat(control-api)` 提交。

## A-BIZ-01.1 009B Project Assignment Backfill 核心 Green 交接（2026-08-07）

- 核心 runner 已从明确未实现骨架转绿：严格 manifest、canonical digest、安全错误、事务 advisory locks、授权/范围校验、run + assignments 原子写入和 replay 均已实现。
- advisory lock 同时覆盖 manifest ID 与 digest，并按 lock key 排序，避免同 ID 不同 digest 或不同 ID 同 digest 的并发竞态与锁顺序死锁。
- replay 按冻结算法在既有 run 检查阶段返回，不重复验证或写入；失败路径在 evidence 写入前完成，009A FK/trigger 仍作为第二层保护。
- 定向 PostgreSQL 8/8 PASS；Control API typecheck、009B 定向 ESLint、Prettier、`git diff --check` PASS。
- 尚未完成：`projectAssignmentBackfillCli.ts`、Control API npm script、CLI 安全测试、完整 PostgreSQL Gate、build/governance 和最终提交。

## A-BIZ-01.1 009B Project Assignment Backfill 完成交接（2026-08-07）

- 核心：`apps/control-api/src/projects/projectAssignmentBackfill.ts`；测试：`projectAssignmentBackfill.postgres.test.ts`。
- CLI：`apps/control-api/src/projects/projectAssignmentBackfillCli.ts`；安全测试：`projectAssignmentBackfillCli.test.ts`；调用 script：`npm --prefix apps/control-api run project-assignment:backfill`。
- 运维必须显式设置 `PROJECT_ASSIGNMENT_MANIFEST_PATH`；仓库不包含真实 manifest，CLI 不从 stdin、数据库、邮箱、项目名或 Demo 默认值推断 Assignment。
- 核心合同：严格 manifest、排除 manifest ID 的 canonical digest、双 advisory lock、稳定冲突码、active Tenant/Admin/Operator 与同 Tenant Project 校验、run + assignments 单事务写入、安全 replay。
- CLI 合同：成功只打印安全摘要；任何失败只打印 `项目授权回填失败。` 并返回 1，已打开数据库始终 destroy。
- Gate：009B PostgreSQL 8/8、CLI 6/6、Control API 全量 20 files / 93 tests、typecheck、build、定向 ESLint、Prettier、Governance 和 diff-check 全 PASS。
- 明确未做：真实 manifest、Session Active Membership、Auth 切流、Project Policy/Repository 切流、一般 Assignment CRUD、Production 或 StoryCanvas 修改。

## 2026-08-08 A-BIZ-02.3C Shared Bootstrap Handoff

- A-BIZ-02.3 已完成：Migration 013、统一 Registration Transaction、Public Registration Router 与 fail-closed Bootstrap 均已转绿。
- 本切片共享修改：`apps/control-api/src/app.ts`、`apps/control-api/src/server.ts`、`apps/control-api/src/config.ts` 及对应测试/环境示例。
- B 在继续修改 Control API 共享 Bootstrap 前，应同步 `feat(control-api): expose public registration api` 对应提交；B 的 StoryCanvas 独占页面和 `apps/storycanvas/data/vendor/byteplus.ts` 未被 A 修改。
- Public Registration 已有稳定 HTTP 合同，但默认 Email Verification Port 明确 unavailable；未接入正式 Provider 和正式 Terms 前，不应把该端点描述为已开放公网注册。
- 本节点不签发 Session、不增加 consumer Role/Tenant/Workbench、不实现邮件发送、注册 UI、支付或归因纠错 API。
- Gate：Control API 39 files / 220 tests，typecheck、build、ESLint、Prettier、Governance、diff check 全部通过。

## 2026-08-08 A-BIZ-02.4A Public Registration API Client Handoff

- 新增 `src/services/publicRegistrationApi.ts` 及 8 项合同测试，覆盖 Public current Terms、Invitation Preview、Registration 201/200 replay、安全 Error Envelope、request ID、retry-after、网络/配置失败和严格响应解析。
- Client 不修改 Router、登录页或 B 的页面；不会把 Invitation Token、密码、邮箱验证 Token 或幂等键写入 URL、Storage 或日志。
- 当前正式 Terms 与 Email Verification Provider 仍未就绪；Client 能表达对应 fail-closed 错误，但不把测试 Evidence 或占位正文描述为真实注册能力。
- Root 全量曾因既有重页面并发/时序出现 7 项失败；对应 app smoke、BrandBrain、ScriptEditor 三文件逐一串行复跑分别 11/11、5/5、8/8 通过。
- 本提交没有共享 Router/Bootstrap 改动，B 无需为 02.4A 做代码同步；B 的 `apps/storycanvas/data/vendor/byteplus.ts` 保持未触碰。
- 下一切片 02.4B 只实现 Registration State/UI；`src/app/Router.tsx` 与 Login 入口留到 02.4C 独立共享提交并届时通知 B。

## 2026-08-08 A-BIZ-02.4B Registration Page Handoff

- 新增 `src/pages/auth/RegistrationPage.tsx`、12 项页面合同测试和 `src/design/d2-auth.css` 注册页样式。
- 页面通过 props 注入 API、Email Verification Evidence 和登录动作；生产默认 Evidence unavailable，因此未接入真实 Provider 时会明确 503/fail closed，不会伪造验证成功。
- Invitation Token 只存在于组件 props/内存并提交给 Preview/Registration；页面不显示 Token、不写 Storage。URL 读取与立即清理留给 02.4C Router。
- 02.4B 没有修改共享 Router/LoginPage，B 现在不需要同步共享代码；B 的 StoryCanvas 与未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 均未触碰。
- 下一步 02.4C 将独立修改 `src/app/Router.tsx`、Router Pilot 测试、`LoginPage.tsx` 与 Pilot Login 测试；该提交完成后需要通知 B 同步。

## 2026-08-08 A-BIZ-02.4C Shared Router / Login Handoff

- A 已在 Pilot Router 接入公开 `/register`，该路由不经过 `PilotRequireSession`；Demo Router 和四身份登录保持不变。
- `?invitation=<token>` 只在 Router 首次挂载时读取，随即 replace 清理地址栏，之后仅以内存 prop 交给 `RegistrationPage`；不得在 B 页面、日志或 Storage 中复制该 Token。
- Pilot Login 新增“创建账号”入口；注册成功仅导航回 `/login`。已登录用户访问 `/register` 会按真实 Session + Project Context 跳到合法默认 Project。
- 共享修改文件为 `src/app/Router.tsx`、`src/app/Router.pilot.test.tsx`、`src/pages/auth/LoginPage.tsx`、`src/pages/auth/LoginPage.pilot.test.tsx`。B 在继续修改 Router/Login 前必须同步本独立提交。
- 联合 Gate：Router/Login/Registration/API Client 4 files / 34 tests PASS；build、ESLint、Prettier、Governance、diff check PASS。Root 并发仅剩既有 app smoke/ScriptEditor 4 个 5 秒超时，两文件单独运行分别 11/11、8/8 PASS。
- 正式 Terms 和 Email Verification Provider 仍未就绪；当前页面必须继续明确 fail closed，不得增加 Fake Evidence、占位条款、自动登录或 Demo fallback。
- B 的 StoryCanvas 与未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未被 A 修改、暂存或提交。

## 2026-08-08 A-BIZ-03.1 Recharge / Payment Plan Handoff

- A-BIZ-02.4 已由 `f266901` 收口；B 继续共享 Router/Login 开发前应先同步该提交。
- A 下一节点为 A-BIZ-03.1，只做明确 TEST 的 Recharge/Payment 基础，不接真实收款、不发行 Credit、不计提 Commission。
- 03.1A/03.1B 将限定在 Control API 新 migration、payment/recharge Domain/Repository/Adapter 与测试，不修改 B 独占目录或共享 Bootstrap。
- 03.1C 才会独立修改 `apps/control-api/src/app.ts`、`server.ts`、`config.ts` 并通知 B；LIVE Adapter 未配置时必须 503 fail closed，不能用 TEST Adapter 兜底。
- 当前正式 SKU 售价、额度数量、币种范围、订单时限、退款周期、佣金比例仍未提供；Migration 不 seed 商业 Rule，测试数据必须显式 `TEST`。

## 2026-08-08 A-BIZ-03.1A Recharge / Payment Schema Handoff

- Migration 014 已新增版本化 Credit Conversion Rule、Tenant Recharge Order、append-only Order Event 与 Payment Event Inbox；Migration 无商业 Rule seed，TEST/LIVE 必须显式区分。
- Order 通过 Wallet/Tenant 复合 FK 和 Buyer Membership/User/Tenant Organization 校验阻止跨 Scope；金额、币种、购买额度、赠送额度和赠送到期事实必须与 ACTIVE Rule 完全一致。
- ACTIVE/RETIRED Rule 只接受 active PLATFORM `platform_admin` 审批；Rule 转换事实、Order 冻结事实和 Payment 原始事实均不可重写。
- Payment Event Provider identity 唯一，必须与 Order 的 mode/amount/currency 一致；Schema 只建立 `received/applied/rejected` Inbox 状态机，03.1A/03.1B 不把 Order 标记 paid、不写 Credit Ledger、不计提 Commission。
- Order Event 为 append-only；Order 与 Payment processing 状态只允许单向合法迁移。存在任一充值/支付审计事实时 Migration down fail closed。
- Gate：Migration/chain 10/10，Control API 40 files / 229 tests；typecheck、build、ESLint、Prettier、Governance、diff check 全 PASS。
- 03.1A 没有共享 Bootstrap 或前端改动，B 无需同步本提交来继续 StoryCanvas 独占开发；B 的 `apps/storycanvas/data/vendor/byteplus.ts` 仍未触碰。
- A 下一步进入 03.1B Domain / Repository / TEST Adapter。LIVE Adapter 必须默认 unavailable，TEST Adapter 不得作为 LIVE fallback；Payment Event 在 03.1 只持久化为 `received`。

## 2026-08-08 A-BIZ-03.1B TEST Payment Domain / Repository Handoff

- A 已新增 `apps/control-api/src/payments/`：领域类型/错误、独立 digest、Provider Port、TEST Adapter、LIVE unavailable Adapter、Service 与 PostgreSQL Repository。
- RechargeOrder 只允许 active Tenant Context 的 `tenant_admin` 发起；服务端从 Context 派生 Tenant、User、Membership，并只接受显式 TEST Rule Version 与幂等键。Wallet、金额、币种、额度和 Attribution 均由事务内 Repository 解析/冻结。
- Repository 对 order idempotency、Tenant Wallet 和 Provider identity 使用 PostgreSQL advisory lock；相同 digest replay、不同 digest 409。ACTIVE TEST Rule、Wallet、Membership 和目标 Order 均在事务内锁定/校验。
- TestPaymentAdapter 只规范化 provider event id、event type、order id、integer minor amount、currency 与 occurred time；原始签名、密钥、卡数据或任意额外 payload 不进入 PaymentEvent Store。
- LIVE Adapter 默认 503 unavailable，且 Provider mode 错配在调用 verify 前拒绝，不能调用 TEST Adapter 兜底。
- 03.1B 只写 RechargeOrder `created` + append-only created Event，以及 PaymentEvent `received`；没有 paid、Credit issuance 或 Commission side effect，这些必须留给 03.2 原子处理。
- Gate：定向 2 files / 20 tests，Control API 单 worker 42 files / 249 tests；typecheck/build/ESLint/Prettier/Governance/diff check 全 PASS。
- 本切片没有共享 Bootstrap 或前端改动，B 不需要为 StoryCanvas 独占工作同步本提交；若 B 开始充值/支付服务工作，则必须先同步 03.1A 与 03.1B。
- 03.1B 已通过独立提交 `feat(control-api): add test payment foundation service` 收口。
- A 下一步进入 03.1C，届时会独立修改 `apps/control-api/src/app.ts`、`server.ts`、`config.ts` 并通知 B 同步；当前不要把 TEST Adapter 描述为真实收款能力。

## 2026-08-08 A-BIZ-03.1C Shared Payment Bootstrap Handoff

- A-BIZ-03.1 已收口到 HTTP/Bootstrap：Tenant Admin RechargeOrder 创建/查询、独立内部 Token 的 TEST Payment Event Inbox、Platform Admin Payment Event 查询均已转绿。
- 共享修改文件包括 `apps/control-api/src/app.ts`、`apps/control-api/src/server.ts`、`apps/control-api/src/config.ts`、对应测试、`.env.example` 与 README；B 在继续修改 Control API 共享 Bootstrap 前必须同步本独立提交。
- 新配置 `RECHARGE_PAYMENT_DIGEST_SECRET` 与 `TEST_PAYMENT_INTERNAL_TOKEN` 在 production 必须显式且至少 32 bytes；不得与 Session、ProjectGrant、production-plane、Registration Secret 或彼此复用。
- Tenant API 复用真实 Session Active Membership；跨 Tenant 返回 404，同 Scope 缺 `tenant_admin` 返回 403。Platform Payment Event 查询仅允许 `platform_admin`，Tenant 探测返回 404。
- Internal TEST Event 只接受 `X-Test-Payment-Internal-Token`；浏览器 Session 不能冒充 Provider。TEST 首次接收 202、安全 replay 200、冲突 409；LIVE 仍由 unavailable Adapter 返回 503，绝不回退 TEST。
- Payment Event 仍只落 `received`；本提交没有 Order paid、Credit Ledger、额度发行、Commission、真实支付 Provider 或前端支付 UI。
- Gate：Control API 全量 43 files / 268 tests，typecheck、build、ESLint、Prettier、Governance、diff check 全部通过。
- B 的 `apps/storycanvas/data/vendor/byteplus.ts` 未被 A 修改、暂存或提交。
- 下一步 A 在 A-BIZ-03.2 开始前必须先冻结原子处理合同和商业输入；B 不应把当前 TEST API 描述为真实收款或可用余额能力。

## A-BIZ-03.2 原子到账与额度发行计划交接（2026-08-08）

- 前置：A-BIZ-03.1 已在 `main@baae8ef` 完成 TEST RechargeOrder、PaymentEvent Inbox 与 HTTP Bootstrap。
- 03.2 将 TEST succeeded 原子应用为 Event applied、Order paid、purchased/bonus Credit Lot 与 append-only Ledger issue；同 identity replay 和同 Order 并发不得重复副作用。
- migration 015 增加 Credit Lot、Ledger Lot FK 和 Payment processed evidence；历史 Pilot Ledger 保持兼容。
- Commission、refund/chargeback 冲正、LIVE Provider、真实 SKU/佣金数字均不在本节点；unsupported 事件保持安全 rejected。
- 详细计划：`docs/program/threads/C0/A_BIZ_03_2_ATOMIC_CREDIT_ISSUANCE_PLAN.md`。
- B 边界：不修改 StoryCanvas；`apps/storycanvas/data/vendor/byteplus.ts` 继续排除。
- 下一步：test-first 创建 migration 015 PostgreSQL 合同测试并确认缺失 Schema RED。

## A-BIZ-03.2A Atomic Credit Issuance Schema 交接（2026-08-08）

- 新增 migration `015_atomic_credit_issuance.ts` 与 `atomicCreditIssuance.postgres.test.ts`。
- Credit Lot 绑定 RechargeOrder、PaymentEvent、Rule、Tenant 和 Wallet；PURCHASED 无到期，BONUS 到期由订单冻结天数计算。
- `credit_ledger_entries.credit_lot_id` 对历史分录可空；充值发行分录一旦关联 Lot，必须完整匹配 Provider、Order、posting group、delta、reason 和 occurredAt。
- PaymentEvent 新增 processed evidence：received 无 processedAt，applied/rejected 必须有 processedAt，terminal evidence 不可变。
- Gate：Control API 44 files / 273 tests PASS；工程检查全部 PASS。
- B 文件无修改；未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未暂存。
- 下一步 03.2B 原子应用；当前 migration 本身不会自动把既有 received Event 标记 applied。

## A-BIZ-03.2B Atomic TEST Payment Application 交接（2026-08-08）

- `PostgresPaymentFoundationRepository.receivePaymentEvent()` 已不再只写 received Inbox；TEST succeeded 会在同一事务内形成 applied Event、paid Order、purchased/bonus Lot 与匹配 Ledger issue。
- Provider identity advisory lock 保证相同 Event 并发只有一次应用、另一次 replay；Order row lock 保证不同 succeeded Event 并发只有一个 applied，后到者 rejected / `invalid_order_state`。
- unsupported Event 与冻结 Wallet 会保留 terminal rejected evidence，但不会写 Order pending/paid、Lot 或 Ledger；未知中途错误则整个事务回滚，不保留 received 半状态。
- PaymentEvent API 类型新增 `processedAt`；现有 Service/Route 测试 fixture 已同步 applied terminal 结果，但 HTTP 首次状态码仍保持 202，留给 03.2C 明确收口。
- Gate：Repository PostgreSQL 13/13、Service/Route 27/27、Control API 全量 44 files / 277 tests；typecheck/build/ESLint/Prettier/Governance/diff check 全 PASS。
- 本切片只修改 `apps/control-api/src/payments/**` 与 C0 文档，没有修改共享 `app.ts` / `server.ts` / `config.ts`，B 不需要等待；StoryCanvas 未触碰。
- 下一步 03.2C：决定首次 terminal Event 的 HTTP 200/202 语义，并增加 Tenant scoped 的安全发行结果投影；不实现真实余额消耗、LIVE Provider、Commission 或退款冲正。

## A-BIZ-03.2C TEST Payment HTTP Closure 交接（2026-08-08）

- `POST /api/v1/internal/payments/test/events` 现在把同步 terminal `applied/rejected` 结果统一映射为 HTTP 200；同 identity/digest replay 继续为 200，并设置 `Idempotency-Replayed: true`。
- 首次请求设置 `Idempotency-Replayed: false`；响应提供 `processingStatus`、`errorCode`、`processedAt`，且始终保留 `paymentMode: TEST`。
- Tenant 继续通过 `GET /api/v1/tenants/:tenantId/recharge-orders?limit=...` 查看 paid 与购买/赠送额度摘要；沿用 Tenant Scope、tenant_admin 权限和 bounded limit，不新增 Provider 敏感字段或独立余额接口。
- 本切片没有修改 `apps/control-api/src/app.ts`、`server.ts`、`config.ts`，B 不需要等待共享 Bootstrap 同步；StoryCanvas 未触碰。
- Gate：Route 13/13；Control API 全量 44 files / 278 tests；typecheck/build/定向 ESLint/Prettier/Governance/diff check 全 PASS。
- A-BIZ-03.2 至此完整收口；LIVE Provider、Commission、refund/chargeback 冲正、Reservation 消耗和真实商业数字仍不在当前能力范围。

## A-BIZ-03.3 Commission Shadow Ledger 计划交接（2026-08-08）

- A-BIZ-03.2 已在 `857c2cf` 收口：TEST PaymentEvent、RechargeOrder、Credit Lot/Ledger 原子到账以及 HTTP terminal 结果均已完成；该提交当前尚未 push。
- 下一节点冻结为 A-BIZ-03.3，权威计划：`docs/program/threads/C0/A_BIZ_03_3_COMMISSION_REVERSAL_SETTLEMENT_PLAN.md`。
- 03.3A 先以 migration 016 建立版本化 Commission Rule、Calculation Outcome、Accrual、Reversal、Settlement Draft/Item，并以 PostgreSQL RED 合同保护 append-only、Scope、金额币种、审批证据、规则窗口和 rollback。
- succeeded Payment 无归因/归因过期时不计提但保留 Outcome；Channel 或 Rule 不可用进入平台 `manual_review`，不硬编码默认比例；多个 ACTIVE Rule 冲突时事务 fail closed。
- refund/chargeback 只规划 TEST 全额且所有原订单 Lot 可完整回收的安全子集；部分退款、已冻结/消费额度和无法证明 Lot 状态时不得实现近似算法。
- Settlement 仅有 `draft/reviewed/approved`，禁止 `paid`，不开放提现、KYC、税务或自动打款。
- 03.3A 不修改共享 `app.ts` / `server.ts` / `config.ts`，因此 B 无需等待本切片的 Bootstrap 同步；B 的 `apps/storycanvas/data/vendor/byteplus.ts` 继续排除。
- 下一动作：只写 03.3A PostgreSQL RED 测试，确认按预期因 migration 016 缺失失败后，再实现最小 Schema。

## A-BIZ-03.3A Commission Shadow Ledger Schema 交接（2026-08-08）

- 新增 `apps/control-api/src/db/migrations/016_commission_shadow_ledger.ts` 与 `commissionShadowLedger.postgres.test.ts`，并把 016 和六张表接入 `migrationChain.postgres.test.ts`。
- 六类证据：Commission Rule Version、Calculation Outcome、Accrual、Reversal、Settlement、Settlement Item；Migration 不 seed Rule，测试中的 `15/100 + FLOOR + 7 days` 仅为 `TEST / NON_QUOTE` fixture。
- Rule ACTIVE/RETIRED 需要 active PLATFORM `platform_admin`；计算事实不可变，生命周期仅 DRAFT→ACTIVE→RETIRED，有效窗口按 mode/currency/direct scope 串行校验且不得重叠。
- Accrual 数据库端复核 applied succeeded Event、paid Order、冻结 Attribution、active Channel Organization、ACTIVE Rule、整数结果与 eligibleAt；Outcome、Accrual、Reversal 和 Item append-only。
- Reversal 使用 Accrual row lock 校验累计不超额；Settlement 只允许 draft/reviewed/approved，数据库明确不接受 paid，所有审批人必须为 active Platform Admin。
- Gate：016 定向 7/7；016 + migration chain 8/8；Control API 全量 45 files / 285 tests；typecheck/build/ESLint/Prettier/Governance/diff check 全 PASS。
- 03.3A 没有修改 Payment Repository、Service、Route 或共享 Bootstrap，B 无需等待；B 的 `apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交。
- 下一步 03.3B 必须先计划并写 PostgreSQL RED：把 Calculation Outcome/Accrual 加入现有 TEST succeeded Payment 同一事务，覆盖无归因、过期、Channel 不可用、无 Rule、多 Rule 冲突、replay、并发和中途失败。

## A-BIZ-03.3B Atomic Commission Accrual 计划交接（2026-08-08）

- 03.3B 细化计划已冻结在 `docs/program/threads/C0/A_BIZ_03_3B_ATOMIC_COMMISSION_ACCRUAL_PLAN.md`。
- 仅接入 TEST `payment_succeeded`；每个 applied succeeded Event 必须恰好一条 Calculation Outcome，只有冻结直接 Attribution、active Channel Organization 与唯一匹配 ACTIVE TEST Rule 同时成立时才追加 Accrual。
- PaymentEvent 必须先在事务内更新为 `applied`、Order 先更新为 `paid`，之后才能通过 migration 016 trigger 写 Commission；任何 Commission 失败仍回滚整笔 Payment/Order/Credit。
- 无 Attribution、过期、Channel/Rule 不可用都不会套默认比例；多个匹配 Rule 明确 fail closed。
- 本切片不改共享 Bootstrap 或 HTTP 合同，B 无需等待；B 的 `apps/storycanvas/data/vendor/byteplus.ts` 继续排除。
- 下一步：编写并运行 03.3B PostgreSQL RED 合同，然后实现最小计算模块与 Repository 接入。

## A-BIZ-03.3B Atomic Commission Accrual 完成交接（2026-08-08）

- TEST succeeded Payment 的 PaymentEvent、RechargeOrder、Credit Lot/Ledger、Commission Outcome/Accrual 已形成单一 PostgreSQL 原子事务；Commission 阶段失败不会留下半到账。
- 每个 applied succeeded Event 恰好一条 Outcome；合法直接归因且唯一匹配 Rule 时一条 Accrual，replay 与同 Order 并发不会重复。
- 无 Attribution、过期、Channel/Rule 不可用均使用显式安全结果，不存在默认比例；多个匹配 Rule 由 Repository 第二道防线 fail closed。
- 计算快照冻结版本、事实 ID、basis、currency、rate、rounding、观察期、amount 与 eligibleAt，digest 使用 canonical JSON 的 SHA-256；测试 Rule 继续明确 TEST / NON_QUOTE。
- Gate：Repository PostgreSQL 22/22、Calculation 6/6、Control API 46 files / 300 tests，typecheck/build/ESLint/Prettier/Governance/diff check 全 PASS。
- 未修改 `app.ts`、`server.ts`、`config.ts` 或 HTTP 合同，B 无需同步共享 Bootstrap；`apps/storycanvas/data/vendor/byteplus.ts` 未修改、未暂存、未提交。
- 下一步 A-BIZ-03.3C 必须先重新审查 Credit Lot 当前可回收证据并冻结 RED 合同；若无法证明所有原订单额度未消费/冻结，则继续 fail closed，不实现近似冲正。

## A-BIZ-03.3C Full TEST Refund/Chargeback Reversal 计划交接（2026-08-08）

- 细化计划已冻结在 `docs/program/threads/C0/A_BIZ_03_3C_FULL_TEST_REVERSAL_PLAN.md`，基线 `61e8b67`。
- 首版只接受 TEST 全额 refund/chargeback，且必须证明原订单全部 Lot 从未被 reserve/consume/release/adjust/reclaim；Wallet 只要存在非 issue Ledger 或任何历史 Reservation 就 fail closed。
- migration 017 规划增加 `reclaim` operation、每 Lot 唯一 issue/reclaim、严格的 Lot/Event/Order/Wallet/delta/idempotency 约束，并要求 Commission Reversal 来源 Event 已 applied、TEST、全额。
- 原 succeeded Payment 无 Accrual 时只做 Credit reclaim，不伪造 Reversal；原 Calculation Outcome 已提供明确佣金原因。
- 部分退款、Credit 证据不安全和 Commission 冲突分别使用稳定 rejected code；Order 与所有审计事实保持不变。
- 不改共享 Bootstrap/HTTP route，不触碰 StoryCanvas；下一步先写 migration 017 与 Repository PostgreSQL RED，确认有效 RED 后才实现。

## A-BIZ-03.3C Full TEST Refund/Chargeback Reversal 完成交接（2026-08-08）

- 实现文件：`apps/control-api/src/db/migrations/017_full_test_payment_reversal.ts`、`apps/control-api/src/payments/repository.ts`、`apps/control-api/src/payments/types.ts`。
- 测试文件：`apps/control-api/src/db/fullTestPaymentReversal.postgres.test.ts`、`apps/control-api/src/db/migrationChain.postgres.test.ts`、`apps/control-api/src/payments/repository.postgres.test.ts`。
- 只实现 TEST 全额 refund/chargeback；部分退款、LIVE、真实 Provider 退款、负余额、跨 Lot 分摊和自动结算继续 fail closed。
- 原子结果：Event applied、每个原 Lot 一条完整 reclaim、可选全额 Commission Reversal、Order refunded/disputed、对应 OrderEvent；任一步失败全部回滚。
- 可回收证明：Wallet active 且无非 issue Ledger、无任何历史 Reservation；Order paid；Lot/issue 集合和额度与订单完全一致；无既有 reclaim/applied reversal；Accrual 无既有 Reversal。
- 稳定拒绝：`partial_refund_unsupported`、`credit_reclaim_unsafe`、`commission_reversal_conflict`，并延续 `wallet_unavailable`、`invalid_order_state`、`unsupported_event_type`。
- replay 不重复追加；同 Order refund/chargeback 并发最多一个 applied；reclaim Ledger 或 Commission Reversal ID 分配失败会回滚 Event、Ledger、Commission 与 Order。
- Gate：定向 2 files / 36 tests；Control API 全量 47 files / 314 tests；typecheck/build/ESLint/Prettier/Governance/diff check 全 PASS。
- 协作边界：未修改 `app.ts`、`server.ts`、`config.ts`、HTTP route 或 StoryCanvas，B 无需同步共享 Bootstrap；`apps/storycanvas/data/vendor/byteplus.ts` 继续排除。
- 当前状态：`A_BIZ_03_3C_COMPLETE / COMMITTED / READY_FOR_NEXT_PLANNING`；未要求 push。

## A-BIZ-03.3D Scoped Commission Read APIs 完成交接（2026-08-08）

- 权威计划：`A_BIZ_03_3D_SCOPED_COMMISSION_READ_APIS_PLAN.md`；核心提交 `957c080`，共享 Bootstrap 提交 `93c48aa`。
- Platform Admin 已具备全局 Calculation/Accrual/Reversal/manual-review bounded list；Channel Admin 只能查询 canonical 自身 beneficiary Channel。
- Scope 语义冻结：Tenant/Content Operator、错误 Organization、跨 Channel 为 404；同 Scope 缺 `platform_admin` / `channel_admin` 为 403。
- 响应是最小审计投影，不包含 Commission snapshot/digest、Provider payload/secret、内部 Token、审批凭据、User/Tenant/Membership/Referral 明细。
- 全量 Gate 为 Control API 50 files / 334 tests PASS；typecheck、build、定向 ESLint、Prettier、Governance 和 diff-check 全 PASS。
- **B 同步要求**：`93c48aa` 修改共享 `apps/control-api/src/app.ts`、`app.test.ts`、`server.ts`，B 后续修改这些文件前应先同步；该提交不改变 Config 或 Secret。
- StoryCanvas 边界保持不变，未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 仍排除。
- 下一动作：A 先规划 03.3E Settlement Draft；不得提前实现 paid、提现、KYC、税务或自动打款。

## A-BIZ-03.3E TEST Commission Settlement Draft 完成交接（2026-08-08）

- 权威计划：`A_BIZ_03_3E_TEST_SETTLEMENT_DRAFT_PLAN.md`；Migration 修复 `9b252ee`，核心实现 `499dcbb`，共享 Bootstrap `0433fdb`。
- Platform Admin 可通过 `POST /api/v1/platform/commission-settlements` 显式创建 TEST 月度 Draft；非 Platform Scope 404、Platform 缺角色 403、输入错误 422、幂等/Period 冲突 409。
- Repository 使用 Scope/Period 与 idempotency advisory lock；首次创建 201/replay false，同事实 replay 200/replay true，并发只形成一个 Settlement 和一组 Item。
- 净额合同：未到 eligibleAt 排除；未结算且 cutoff 前完全冲正的组合不制造正负 Item；旧月已占用 Accrual 的跨月 Reversal 在新月形成负 Item；零候选允许零额审计 Draft。
- Migration 018 修复 016 的 Reversal Item validator alias 冲突；存在 Reversal Settlement Item 时 rollback fail closed，不修改历史 Migration 016。
- 响应只投影 draft 汇总，不泄漏 snapshot/digest、Rule 比例、Provider/审批证据，不表达 paid、已到账、可提现或真实资金动作。
- Gate：迁移定向 `3 files / 9 tests`，Settlement `3 files / 26 tests`，Bootstrap/Router `2 files / 19 tests`，Control API 全量 `54 files / 363 tests`；全部工程 Gate PASS。
- **B 同步要求**：`0433fdb` 修改共享 `apps/control-api/src/app.ts`、`app.test.ts`、`server.ts`。B 若继续修改这些文件，必须先同步该提交；未新增 Config 或 Secret。
- StoryCanvas 和 B 的 `apps/storycanvas/data/vendor/byteplus.ts` 均未修改、未暂存、未提交。
- A-BIZ-03.3 已完整收口；下一动作仅规划 A-BIZ-03.4 商业前端与审计，不直接扩大结算或资金能力。

## A-BIZ-03.4 Commercial Frontend & Audit 计划交接（2026-08-08）

- 权威计划：`A_BIZ_03_4_COMMERCIAL_FRONTEND_AUDIT_PLAN.md`；规划基线 `33b46ed`。
- 源码审计确认：PilotRouter 当前把所有真实 Session 放入 Tenant Boundary，导致 PLATFORM/CHANNEL 被阻断；Pilot Sidebar/Topbar 默认依赖 Project；现有 Platform/Channel 商业页仍读取 Demo `useControlPlaneStore`；`pilotControlApi.ts` 尚无商业 API。
- 关键合同缺口：PublicSession 只有 Organization ID，没有 canonical Channel ID；Settlement 零候选也需要独立 active Channel Directory。前端不得猜测两者相等，不得从 Commission 记录反推目录。
- 六个切片顺序：03.4A Channel Reference/Directory + Strict Client → 03.4B Organization Route Policy → 03.4C Commission Audit → 03.4D TEST Settlement Draft UI → 03.4E Tenant Recharge Audit → 03.4F 共享 Router/Sidebar/Topbar 激活。
- 03.4A 冻结新增 `GET /api/v1/channels/current` 与 `GET /api/v1/platform/channels?status=active&limit=100`；响应只含 channelId、organizationId、displayName、active status，不新增 Migration 或敏感商业字段。
- Tenant Recharge 纳入 03.4E 的只读审计，且仅 `tenant_admin`；由于缺少安全 Product/SKU/Conversion Rule Directory，不开放 POST UI，不允许人工输入 Rule UUID。
- Session/UX：真实 HttpOnly Cookie、`credentials: include`、`no-store`；401 清 Session 并安全回登录，403 保留 Session，404 隐藏 Scope，service/invalid response 显示安全 Request ID；loading、empty、retrying 和 retry 只访问真实 API。
- Demo/Pilot 严格隔离，Pilot 错误不得回退 Mock；Settlement 必须持续显示 `TEST / draft / NON_QUOTE`、非到账、非提现、非 paid、非自动打款。
- 明确排除 LIVE、真实比例、paid、提现、KYC、税务、发票、自动打款、真实 Provider、未规划 review/approve HTTP、RechargeOrder 创建、客户端“导出全部”和 StoryCanvas。
- 首个实现 RED：CHANNEL Session Organization ID 与 Channel ID 故意不同，`GET /api/v1/channels/current` 必须返回 canonical Channel ID；当前应因 Route 缺失得到 `404 ROUTE_NOT_FOUND`。
- A/B 通知：03.4A 共享 Control API Bootstrap 接线和 03.4F 共享 Router/Layout 激活必须分别独立 commit，完成后通知 B 同步；`apps/storycanvas/data/vendor/byteplus.ts` 始终不修改、不暂存、不提交。
- 当前状态：`A_BIZ_03_4_PLAN_FROZEN / READY_FOR_03_4A_RED`；本轮只提交计划，等待开始实现指令，不 push。

## A-BIZ-03.4A Commercial Channel Reference / Strict Client 完成交接（2026-08-09）

- 核心提交 `461f494` 提供 `GET /api/v1/channels/current` 与 `GET /api/v1/platform/channels?status=active&limit=100`；响应分别为 `{ channel }` 与 `{ channels }`，仅投影 channelId、organizationId、displayName、active status。
- Current Channel 由 Repository 通过 CHANNEL Organization mapping 解析 canonical Channel ID，禁止前端或服务层猜测 Organization ID 与 Channel ID 相等；mapping 缺失或 inactive 时 404。
- Platform Directory 只列 active CHANNEL Organization，默认 `status=active&limit=100`，稳定按 displayName/channelId 升序；未知或非法 query 为 422。Scope 不匹配为 404，同 Scope 缺管理员角色为 403。
- **B 同步要求**：共享 Bootstrap 提交 `856757b` 修改 `apps/control-api/src/app.ts`、`app.test.ts`、`server.ts`。B 后续修改这些文件前必须先同步；本切片未新增 Config 或 Secret。
- 前端提交 `671fe3e` 扩展 `src/services/pilotControlApi.ts`，为 03.4C～03.4E 提供严格商业 API：Channel Reference/Directory、Platform/Channel Commission Audit、Platform TEST Settlement Draft 与 Tenant RechargeOrder bounded list。
- 所有调用使用真实 Cookie Session；商业读取 `cache: no-store`；解析器严格验证 UUID、枚举、minor unit、currency 和带时区 timestamp。401/403/404/409/422/5xx、业务 code 与 Request ID 保持可判定。
- 商业 Client 只接受 TEST；LIVE、非 JSON 或 malformed success response 均 fail closed；返回给 UI 的 DTO 删除 Provider code/event ID/digest 以及 RechargeOrder 的 Buyer/Membership/Wallet/Conversion Rule/Attribution 等敏感字段。
- Demo/Pilot 保持严格隔离；未增加 Mock/localStorage fallback，未接 Router/Layout/UI，未实现 paid、提现、KYC、税务、自动打款、真实比例或 review/approve HTTP。
- 验证证据：Control API 定向与全量、typecheck/build、前端 Client 16/16 与 build 均 PASS；PostgreSQL suites 在未注入 dedicated test DB 的默认环境中 SKIP。根并发测试曾有 3 个既有重型 UI 用例因 5 秒资源超时，失败文件单独复跑全部 PASS；最终收口改用 `npm test -- --maxWorkers=1`。
- StoryCanvas tracked diff 为零；B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 保持排除。分支未 push。
- 下一切片只做 03.4B 纯 Organization Commercial Route Policy；首个 RED：PLATFORM Session 默认路由为 `/platform/commission-audit`，且 Policy 必须拒绝其进入 Tenant Project Boundary。共享 Router/Sidebar/Topbar 激活仍保留到 03.4F 独立提交并通知 B。

## A-BIZ-03.4B Pilot Organization Commercial Route Policy 完成交接（2026-08-09）

- 新增纯 Domain `pilotOrganizationRoutePolicy.ts`，冻结四条商业路由的 Organization Scope、角色、Capability、菜单顺序与 Project Context；对应测试 15/15 PASS。
- 默认路由：PLATFORM 管理员进入 `/platform/commission-audit`，CHANNEL 管理员进入 `/channel/commission-audit`，两者不读取 Tenant Project Context；TENANT 继续委托现有 Pilot Project 默认策略。
- direct URL：跨 Scope 已注册路由返回 `scope-not-found`，同 Scope 缺角色返回 `permission-denied`；Tenant Recharge 只允许 `tenant_admin`，`content_operator` 为 403 语义；`pilot_support` 没有隐式权限。
- returnTo 由同一 Policy 授权；只接受当前 Scope 允许的站内路径。外部、未知、跨 Scope、空白/控制字符、双斜杠或反斜杠候选回安全默认路由，不能通过 fallback 放大权限。
- Tenant Project Route 继续复用 `authorizeTenantWorkbenchRoute` 与 `resolveTenantDefaultRoute`，保持 Project not-found、Role denial 和无 Demo fallback 的既有合同。
- 本切片没有接入共享 `Router.tsx`、`Sidebar.tsx`、`Topbar.tsx`，也没有修改页面或 Bootstrap；因此 B 本切片无需同步共享文件。共享激活仍只允许在 03.4F 独立提交并再次通知 B。
- Gate：全量前端 295/296 PASS，唯一既有重型 UI 用例触发 5 秒 timeout；对应 `app.smoke` 文件定向复跑 11/11 PASS。Policy 15/15、TypeScript、ESLint、Build、Prettier、Governance、diff-check 全 PASS。
- StoryCanvas tracked diff 为零；B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 保持排除；分支不 push。
- 下一切片为 03.4C Platform/Channel Commission Audit 真实只读页。首个 RED 要求 Platform 页面仅使用真实 `pilotControlApi`，覆盖 loading/empty，并证明不会读取 Demo `useControlPlaneStore`；Router 激活继续延后到 03.4F。

## A-BIZ-03.4C Platform/Channel Commission Audit 完成交接（2026-08-09）

- 新增独立 Pilot `PilotCommissionAuditPages.tsx`，没有在 Demo Platform/Channel 页面内增加条件分支，也没有读取 Demo `useControlPlaneStore`；Router/Layout 接线仍保留到 03.4F。
- Platform Audit 使用严格 `pilotControlApi` 读取 Payment Events、Calculations、Accruals、Reversals、Manual Reviews，统一 bounded 50；Manual Review 只有只读“需平台人工处理”队列，不存在 review/approve 按钮或 HTTP。
- Channel Audit 的加载顺序已测试冻结：先 `GET /api/v1/channels/current`，再把返回的 canonical `channelId` 传给三类 Channel Audit API。Organization ID 与 Channel ID 不相等时仍只使用 canonical Channel ID；页面没有跨 Channel 搜索或手工输入。
- 状态合同：loading/empty/ready/retrying、401/403/404、network/5xx、invalid response 均有独立安全投影；Retry 清空旧成功数据并只请求真实 API；401 清 Session/Project Context，403 保留会话，404 不泄漏其他 Scope。
- 安全投影只显示 TEST 类型、状态、minor-unit 格式金额、安全 reason code、缩短后的引用和时间；错误仅显示固定文案与 Request ID，不渲染原始服务端消息或敏感 Provider/Rule/User/Tenant 内容。
- 页面明确 `TEST · READ ONLY`、bounded window，并声明不表示已到账、可提现、paid 或自动打款；继续排除 LIVE、真实比例、paid、提现、KYC、税务、自动打款和未规划 review/approve HTTP。
- RED/GREEN：页面模块不存在时首个 RED；最终定向 11/11 PASS。全量前端单 worker 为 37/38 files、306/307 tests PASS，唯一失败是既有 `app.smoke` 重型 UI 用例超过 5 秒，该用例隔离复跑 1/1 PASS；TypeScript、ESLint、Build、Prettier、Governance、diff-check 全 PASS，仅既有大 chunk warning。
- 本切片未修改共享 Router/Sidebar/Topbar、Control API 或 StoryCanvas，B 无需同步共享文件；`apps/storycanvas/data/vendor/byteplus.ts` 继续排除，分支不 push。
- 下一切片 03.4D：Platform TEST Settlement Draft 安全操作页。首个 RED 要求 beneficiary 只能来自真实 active Channel Directory，页面显著显示 `TEST / draft / NON_QUOTE`，且没有手工 UUID 输入或伪造历史列表。

## A-BIZ-03.4D Platform TEST Settlement Draft 完成交接（2026-08-09）

- 新增独立 Pilot `PilotSettlementDraftPage.tsx` 与 8 项测试；页面未接入共享 Router/Sidebar/Topbar，03.4F 前不会改变现有导航。
- beneficiary 只能来自真实 active Channel Directory；页面使用服务端 canonical `channelId`，不提供手工 UUID，不从 Commission 记录反推，也不读取 Demo `useControlPlaneStore`。
- 创建事实固定 `paymentMode: TEST`、`currency: CNY`、UTC 自然月起点与带时区 cutoff；cutoff 早于 period end 时前端拒绝且不调用 API。
- 同一可重试事实保持稳定幂等 key，用户修改 Channel/month/cutoff 后才轮换；409 显示安全冲突与 Request ID，并继续用原 key 重试，禁止自动换 key 绕过冲突。
- 成功区只展示当前 API 返回的严格 Draft。零候选/零额属于合法成功；不伪造服务端记录，不把本地结果描述成可恢复数据。
- 页面全程显著标记 `TEST / draft / NON_QUOTE`，明确非到账、非提现、非 paid、非自动打款；继续排除 LIVE、真实比例、KYC、税务、自动打款与 review/approve HTTP。
- 状态覆盖 Directory loading/empty/retry/error 与 Submit submitting/success/401/403/404/409/5xx/invalid response；401 清 Session/Project Context，原始错误 body 与幂等 key 不进入 UI。
- Gate：定向 8/8 PASS；全量前端 311/315 PASS，4 个既有 5 秒 UI timeout 用例对应文件隔离复跑 13/13 PASS；TypeScript、ESLint、Build、Prettier、Governance、diff-check 全 PASS。
- 本切片没有共享文件或 StoryCanvas 改动，B 无需同步共享导航；`apps/storycanvas/data/vendor/byteplus.ts` 继续排除，分支不 push。
- 下一切片 03.4E：Tenant TEST RechargeOrder 只读审计。首个 RED 要求只使用当前 Session canonical `tenantId` 调用真实 GET，严格 `tenant_admin` 页面能力，无 POST、Demo 或 Mock fallback。

## A-BIZ-03.4E Tenant TEST RechargeOrder Audit 完成交接（2026-08-09）

- 新增独立 Pilot `PilotTenantRechargeAuditPage.tsx` 与 7 项测试；页面尚未接入共享 Router/Sidebar/Topbar，最终激活仍只在 03.4F。
- 数据 Scope 只来自 Session canonical `activeContext.tenantId`，真实 GET bounded 50；不接受 URL、Project、文本框或客户端 Tenant 覆盖，也不读取 Demo Store/Mock/localStorage。
- 页面级权限继续 fail closed：仅 TENANT `tenant_admin` 调用 API；`content_operator` 在请求前拒绝且保留 Session，缺 tenantId 不猜测 Organization 或 Project。
- 安全投影包含 TEST 金额、购买/赠送额度、赠送到期、短 Order reference、UTC 时间和全部受支持状态；Tenant/完整 Order/Provider/Rule/Attribution/Buyer/Wallet 信息不进入 UI。
- paid/refunded/disputed 均明确为 TEST 只读审计状态，不表示真实收款、到账、可用余额或退款完成；没有 POST、支付模拟、退款按钮、搜索或导出。
- loading/empty/ready/retrying 与 401/403/404/5xx/invalid response 已冻结；Retry 清空旧投影且只访问真实 API，401 清 Session/Project Context，错误仅显示安全文案和 Request ID。
- Gate：定向 7/7、全量前端 40/40 files 与 322/322 tests PASS；TypeScript、ESLint、Build、Prettier、Governance、diff-check 全 PASS。
- 未修改共享 Router/Layout、Control API 或 StoryCanvas；`apps/storycanvas/data/vendor/byteplus.ts` 继续排除，分支不 push。
- 下一切片 03.4F 是共享 Pilot Router/Sidebar/Topbar 激活，必须独立提交并通知 B：PLATFORM/CHANNEL 脱离 Tenant Project Boundary，TENANT 保持既有 Project Boundary，菜单/direct URL/default/returnTo 全部复用 03.4B Policy。

## A-BIZ-03.4F 组织商业工作台激活完成交接（2026-08-09）

- 共享 `src/app/Router.tsx` 已从全局 Tenant Boundary 改为组织级分流：PLATFORM/CHANNEL 直接进入真实商业 Shell，TENANT 继续保留 Project Context、Project Selector 与既有 Tenant Manifest。
- 默认路由冻结为 PLATFORM `/platform/commission-audit`、CHANNEL `/channel/commission-audit`、TENANT 首个可见 Project/空列表 `/projects`；登录 returnTo 只接受 03.4B Policy 授权的当前 Scope 站内路径。
- Platform 菜单为佣金审计、`TEST 结算草稿`；Channel 菜单为佣金审计；Tenant Admin 增加 `TEST 充值记录`，Content Operator 不显示该菜单且 direct URL 返回 403。
- 跨 Scope 已注册商业或 Tenant 路由返回 Pilot 安全 404；同 Scope 缺角色返回 403。Pilot 404 不展示 Demo 链接，Pilot 页面/API 失败不回退 Demo、Mock 或 localStorage。
- Platform/Channel Topbar 不读取 Project Selector 作为进入条件；TENANT 保留 Selector。商业页面 title/home/workbench label 已按 Organization Scope 接通。
- Router 定向 20/20、全量前端 40 files / 330 tests PASS；TypeScript、ESLint、Build、Prettier、Governance、diff-check PASS。StoryCanvas tracked diff 为零，未跟踪 vendor 文件继续排除，不 push。
- **B 同步要求**：本切片独立提交修改共享 `src/app/Router.tsx`、`src/layouts/Sidebar.tsx`、`src/layouts/Topbar.tsx`。B 后续修改共享导航前必须先同步该提交，避免重新引入全局 Tenant Boundary 或重复维护商业权限判断。
- 下一步只做 A-BIZ-03.4 文档收口；不实现 LIVE、真实佣金比例、paid、提现、KYC、税务、自动打款或未规划 review/approve HTTP。

## A-BIZ-03.4 商业前端与审计完整收口交接（2026-08-09）

- 权威计划 `A_BIZ_03_4_COMMERCIAL_FRONTEND_AUDIT_PLAN.md` 已转为 `COMPLETE / COMMITTED / GATE_PASS`；03.4A～03.4F 全部完成。
- 提交链：`461f494` Channel Reference/Directory、`856757b` 共享 Control API Bootstrap、`671fe3e` Strict Client、`f31a0c9` Route Policy、`65e89a5` Commission Audit、`7ddc52d` TEST Settlement Draft、`fc5f5a7` Tenant Recharge Audit、`b80e9ef` 共享 Router/Layout。
- 真实 Pilot 已按 PLATFORM/CHANNEL/TENANT 分流；默认路由、Sidebar、Topbar、direct URL 与 returnTo 共用同一 Policy。跨 Scope 404、同 Scope 缺角色 403，`pilot_support` 不自动继承商业权限。
- Channel Audit 不接受任意 Channel ID，必须先由 `/api/v1/channels/current` 解析 canonical Channel；Settlement beneficiary 只来自 Platform active Channel Directory；Tenant Recharge 只使用 Session canonical tenantId。
- 页面统一覆盖 loading/empty/ready/retrying、401/403/404、network/5xx、invalid response 与 Request ID；Retry 清旧投影，Pilot 失败绝不回退 Demo/Mock/localStorage，也不泄露 Provider、digest、Rule 比例或身份关系明细。
- Settlement 始终是 `TEST / draft / NON_QUOTE`，非到账、非提现、非 paid、非自动打款；LIVE、真实比例、review/approve HTTP、KYC、税务、发票和真实 Provider 均未实现。
- Gate：Router 20/20、前端全量 330/330 PASS，TypeScript、ESLint、Build、Prettier、Governance、diff-check PASS；StoryCanvas tracked diff 为零。
- **B 同步要求**：修改 `apps/control-api/src/app.ts`、`app.test.ts`、`server.ts` 前同步 `856757b`；修改 `src/app/Router.tsx`、`src/layouts/Sidebar.tsx`、`src/layouts/Topbar.tsx` 前同步 `b80e9ef`。
- 当前仅剩 B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts`，A 不修改、不暂存、不提交；分支保持未 push。
- 下一节点只允许先规划 Wave 4 / A-BIZ-06 运营收口与 A/B 联合 Gate；在计划冻结前不直接增加 E2E、运营命令、LIVE 商业能力或审批流程。

## A-BIZ-06 Operational Closure & A/B Joint Gate 计划交接（2026-08-09）

- 权威计划：`A_BIZ_06_OPERATIONAL_CLOSURE_JOINT_GATE_PLAN.md`；规划基线 `69b8181`。
- 06A～06F 已冻结：Joint Gate manifest/runner、Member Directory/Deactivation 合同、Terms/Invitation/Member Pilot UI、专用 PostgreSQL + 真实 Cookie E2E、A/B 黄金路径、迁移/回滚与最终运营文档。
- 当前 E2E 只有 Demo/localStorage 路径；Control API PostgreSQL suites 缺专用 URL 时可能 SKIP；最终 full Gate 必须对数据库、B 基线和 required phase fail closed。
- 06A 首个 RED 固定为：manifest 必须覆盖 Root、Control PostgreSQL、C01 Contract、StoryCanvas v0.2 定向、Pilot Playwright、Build、Governance、diff-check；`--full` 缺合法 `_test` URL 非零退出。
- Member 前端不得先行猜测合同；06B 必须先冻结 bounded Directory、status/role 最小投影、suspend 事务、Membership version bump、Session 失效、last-admin/self-suspend 和 403/404/409/422。
- Pilot UI 继续真实 Session Cookie + `no-store`，失败不回退 Demo/Mock/localStorage；错误只显示固定文案与 Request ID，不泄露 Session、Invitation Token/digest、Provider payload、Grant、SQL、stack 或完整敏感 DTO。
- TEST 商业边界不变：不实现 LIVE、真实佣金比例、paid、提现、KYC、税务、发票、自动打款或未规划 review/approve HTTP；不伪造 Audit Log 或完整导出。
- A 不修改 StoryCanvas 或 B 的 `apps/storycanvas/data/vendor/byteplus.ts`。06A 根 Joint Gate runner 属于共享协作基线，必须独立提交并通知 B 同步。
- 当前状态：`A_BIZ_06_PLAN_FROZEN / READY_FOR_06A_RED`；用户已授权无阻塞时连续推进，计划提交后直接进入 06A，不 push。

## A-BIZ-06A Deterministic Joint Gate Runner 完成交接（2026-08-09）

- 新增 `scripts/joint-gate-manifest.mjs`、`scripts/run-joint-gate.mjs`、`scripts/run-storycanvas-v02-targeted.mjs` 与 7 项 manifest/runner 测试。
- Root scripts：`test:joint-gate:manifest`、`test:joint-gate:plan`、`test:joint-gate:full`；full 当前应 fail closed，不是尚未满足前置条件时的成功入口。
- manifest 固定 12 个 required phase：Root Unit、Control PG、C01/A3/B3 Contract、StoryCanvas v0.2 targeted、Pilot E2E、A/B Golden Path、Build、Governance、diff-check、migration rollback/reapply。
- 缺 `CONTROL_API_TEST_DATABASE_URL`、B baseline 或 06D/06E/06F 实现时 full runner 退出 2 并输出脱敏 BLOCKED code；`--plan` 只列 `NOT_RUN`。
- Gate：06A 7/7、Build、Control typecheck/build、StoryCanvas v0.2 13/13、ESLint/Prettier/Governance/diff-check PASS；服务仍为 SaaS 200、StoryCanvas root 401 正常监听。
- 未宣称 Root full PASS：并发负载下两个既有 App smoke timeout；单独提高 timeout 后逻辑通过。现有 cross-plane Gate 另暴露 v0.1 TS export 与 A3 HTTP 500 存量缺口。
- 共享通知：06A 修改根 `package.json` 和联合 Gate 基线，B 必须先同步本提交再修改相关脚本/测试；A 未修改 StoryCanvas tracked 文件或 `byteplus.ts`。
- 下一步先冻结 06B Member Directory/Deactivation 子计划，明确 bounded DTO、suspend/version bump、Session 失效、last-admin/self-suspend 与 403/404/409/422，再进入 RED；不 push。

## A-BIZ-06B Member Directory / Deactivation 合同交接（2026-08-09）

- 权威计划：`docs/program/threads/C0/A_BIZ_06B_MEMBER_DIRECTORY_DEACTIVATION_PLAN.md`；实现基线 `93c7392`，分支不 push。
- canonical 路由：`GET /api/v1/organizations/current/members?status=all&limit=100`、`POST /api/v1/organizations/current/members/:membershipId/suspend`，body 仅 `{ expectedVersion }`。
- 授权：PLATFORM=`platform_admin`、CHANNEL=`channel_admin`、TENANT=`tenant_admin`；`pilot_support`/`content_operator` 不扩权。跨 Organization 或未知 Membership 安全 404。
- DTO 只含 Membership ID、displayName、email、status、primaryRole、roles、version、timestamps、isCurrentActor；禁止 User/Organization/Tenant/Channel ID、password、Session、Invitation、Provider、SQL/stack。
- suspend：active→suspended/version+1；已 suspended 返回 replay 且不再 bump；expired、self、last-admin、stale version 返回稳定 409；管理员识别使用完整 roles 集合。
- Session 失效复用 migration 010 的 active/version 校验，不新增 revoke Schema；被停用成员旧 Cookie 在下一次 resolve 时 invalid。
- TENANT legacy trigger 只有 legacy→canonical；存在 legacy row 时通过 legacy update 原子推进 canonical，避免无规则双写。Bootstrap 显式重跑仍可能恢复其受管 Pilot Membership，属于明确运营动作。
- 提交拆分：06B.2 Repository/Service、06B.3 HTTP Route、06B.4 App/Server 共享 wiring；06B.4 必须独立提交并通知 B。
- 首个 RED：`MemberDirectoryService` 授权/canonical scope；随后 PostgreSQL 事务、并发、Session invalidation 和 legacy 一致性 RED。
- 不实现角色编辑、成员新增/恢复/删除、批量操作、密码管理、Support Grant、全局 User suspend、Audit Export 或 StoryCanvas 改动。
- 当前状态：`A_BIZ_06B_PLAN_FROZEN / READY_FOR_REPOSITORY_SERVICE_RED`。

## A-BIZ-06B Legacy Membership Trigger 合同勘误交接（2026-08-09）

- 初版计划的“无需新增 Migration”已撤回：migration 010 的 `shadow_legacy_membership()` 在 legacy status-only UPDATE 时会删除所有 secondary roles，并产生额外 Membership version bump。
- 新增前置原子切片 06B.1A / Migration 019；status-only legacy update 不得触碰 role rows，必须保留 secondary roles且 canonical version 恰好 `+1`。
- 只有 `new.role_code IS DISTINCT FROM old.role_code` 时才保留既有 legacy 单角色兼容语义；rollback 恢复 migration 010 函数。
- Service 授权/canonical Scope 首个 RED 已完成且本地定向 7 tests PASS，但 `members/**` 尚未提交；先提交 Migration 019，再继续 Repository/Service。
- PostgreSQL 证据必须使用合法 `_test` database 且零 SKIP；StoryCanvas 与 B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 继续排除。
- 当前状态：`A_BIZ_06B_PLAN_CORRECTED / READY_FOR_MIGRATION_019_RED`；不 push。
