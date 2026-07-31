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
- A 下一步在 A-02 冻结身份权限矩阵，届时如需调整共享 Router 将由 A 统一处理。
