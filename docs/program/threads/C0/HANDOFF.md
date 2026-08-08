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
