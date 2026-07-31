# C0 CHANGELOG

| 日期 | 变更 | 状态 |
|---|---|---|
| 2026-07-30 | 初始化项目级员工线程记忆 | CREATED |
| 2026-07-30 | 正式启动 C0-C8，完成 T0 顶层设计与 T1 首轮领域规格 | COMPLETE |
| 2026-07-30 | 建立 SaaS/StoryCanvas v0.1 跨仓合同与 D1 海底捞黄金路径 | COMPLETE |
| 2026-07-30 | 完成三轮 P0 修复与 C7 Round 3.1 静态复核 | STATIC_GO |
| 2026-07-30 | 交付纯合成可播放 FALLBACK 与 11 分 30 秒 D1 Demo Pack | COMPLETE |
| 2026-07-30 | 保留运行、视觉、彩排和双仓提交为下一 Gate | OPEN |
| 2026-07-30 | D1 双仓运行闭环完成，SaaS 基线进入 `98b07e9` | GO_FOR_INTERNAL_DEMO |
| 2026-07-30 | 将 StoryCanvas `46fc8d0` 完整跟踪源码并入 `apps/storycanvas/`，项目转为单仓双应用 | MONOREPO_ACTIVE |
| 2026-07-30 | 冻结 D2 为前端 + Mock 身份与角色工作台，不扩真实认证或后端 RBAC | SCOPE_FROZEN |
| 2026-07-30 | StoryCanvas 画布并入根 SaaS 唯一前端，删除独立 50188 Web 与 data/web 构建副本 | SINGLE_FRONTEND_ACTIVE |
| 2026-07-30 | 清理独立前端构建脚本并将生产深链统一到 5173；确认 SQLite 由启动迁移本地创建且不入库 | REMOTE_RUNTIME_ALIGNED |
| 2026-07-30 | 新增 D2 四身份、登录、会话、路由保护、工作台差异、越权拒绝及验收规格 | SPEC_READY |
| 2026-07-30 | 明确真实 IdP、服务端授权、租户隔离、代理继承/分佣权限与安全审计为后续边界 | DEFERRED |
| 2026-07-31 | 建立 A 独立分支 `dev/control-plane`，完成子模块、依赖与双服务运行基线 | STAGE0_RUNTIME_READY |
| 2026-07-31 | 记录 D2 Stage 0：Governance 与根定向 ESLint 通过，Test/Lint/Build 存在分级缺口 | BASELINE_GAPS_RECORDED |
| 2026-07-31 | 冻结 A/B 修复边界：A 进入 A-01，B 接收 StoryCanvas Build/Test/Lint 交接项 | HANDOFF_READY |
| 2026-07-31 | 完成 A-01 完整 Mock 会话、过期/损坏清理、身份切换和安全站内回跳，33 项定向测试通过 | A01_TARGETED_PASS |
| 2026-07-31 | 冻结 A-02 四身份工作台、具体路由/动作及 canonical Tenant/Project 三层权限矩阵 | A02_PERMISSION_MATRIX_FROZEN |
| 2026-07-31 | 实现 A-02 四身份路由/动作权限合同与轻量矩阵测试，40 项定向测试通过 | A02_PERMISSION_MODEL_TARGETED_PASS |
| 2026-07-31 | 新增 A-02 24 路由 canonical 授权内核及 Scope/路径安全测试，66 项定向测试通过 | A02_CANONICAL_ROUTE_AUTHZ_TARGETED_PASS |
| 2026-07-31 | Router 与安全回跳统一接入 24 路由授权、canonical Scope Guard 和统一 403，79 项定向测试通过 | A02_ROUTE_GUARDS_TARGETED_PASS |
| 2026-07-31 | 原子启用企业/内容运营双工作台，完成 Sidebar 权限过滤、合法工作台落点和品牌大脑只读，82 项定向/Smoke 测试通过 | A02_WORKBENCH_ACCESS_TARGETED_PASS |
| 2026-07-31 | 完成 A-03 控制平面业务审计，冻结 scoped commercial projection、平台/渠道/企业页面收口和五切片实施计划 | A03_PLAN_READY |
| 2026-07-31 | 完成 A-03.1 Demo 商业投影、运行时不变量校验及平台/渠道/企业可见性 Selector，11 项定向测试通过 | A03_COMMERCIAL_PROJECTION_TARGETED_PASS |
