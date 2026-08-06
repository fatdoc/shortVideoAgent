# C0 CHANGELOG

| 日期       | 变更                                                                                                                                      | 状态                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 2026-07-30 | 初始化项目级员工线程记忆                                                                                                                  | CREATED                                 |
| 2026-07-30 | 正式启动 C0-C8，完成 T0 顶层设计与 T1 首轮领域规格                                                                                        | COMPLETE                                |
| 2026-07-30 | 建立 SaaS/StoryCanvas v0.1 跨仓合同与 D1 海底捞黄金路径                                                                                   | COMPLETE                                |
| 2026-07-30 | 完成三轮 P0 修复与 C7 Round 3.1 静态复核                                                                                                  | STATIC_GO                               |
| 2026-07-30 | 交付纯合成可播放 FALLBACK 与 11 分 30 秒 D1 Demo Pack                                                                                     | COMPLETE                                |
| 2026-07-30 | 保留运行、视觉、彩排和双仓提交为下一 Gate                                                                                                 | OPEN                                    |
| 2026-07-30 | D1 双仓运行闭环完成，SaaS 基线进入 `98b07e9`                                                                                              | GO_FOR_INTERNAL_DEMO                    |
| 2026-07-30 | 将 StoryCanvas `46fc8d0` 完整跟踪源码并入 `apps/storycanvas/`，项目转为单仓双应用                                                         | MONOREPO_ACTIVE                         |
| 2026-07-30 | 冻结 D2 为前端 + Mock 身份与角色工作台，不扩真实认证或后端 RBAC                                                                           | SCOPE_FROZEN                            |
| 2026-07-30 | StoryCanvas 画布并入根 SaaS 唯一前端，删除独立 50188 Web 与 data/web 构建副本                                                             | SINGLE_FRONTEND_ACTIVE                  |
| 2026-07-30 | 清理独立前端构建脚本并将生产深链统一到 5173；确认 SQLite 由启动迁移本地创建且不入库                                                       | REMOTE_RUNTIME_ALIGNED                  |
| 2026-07-30 | 新增 D2 四身份、登录、会话、路由保护、工作台差异、越权拒绝及验收规格                                                                      | SPEC_READY                              |
| 2026-07-30 | 明确真实 IdP、服务端授权、租户隔离、代理继承/分佣权限与安全审计为后续边界                                                                 | DEFERRED                                |
| 2026-07-31 | 建立 A 独立分支 `dev/control-plane`，完成子模块、依赖与双服务运行基线                                                                     | STAGE0_RUNTIME_READY                    |
| 2026-07-31 | 记录 D2 Stage 0：Governance 与根定向 ESLint 通过，Test/Lint/Build 存在分级缺口                                                            | BASELINE_GAPS_RECORDED                  |
| 2026-07-31 | 冻结 A/B 修复边界：A 进入 A-01，B 接收 StoryCanvas Build/Test/Lint 交接项                                                                 | HANDOFF_READY                           |
| 2026-07-31 | 完成 A-01 完整 Mock 会话、过期/损坏清理、身份切换和安全站内回跳，33 项定向测试通过                                                        | A01_TARGETED_PASS                       |
| 2026-07-31 | 冻结 A-02 四身份工作台、具体路由/动作及 canonical Tenant/Project 三层权限矩阵                                                             | A02_PERMISSION_MATRIX_FROZEN            |
| 2026-07-31 | 实现 A-02 四身份路由/动作权限合同与轻量矩阵测试，40 项定向测试通过                                                                        | A02_PERMISSION_MODEL_TARGETED_PASS      |
| 2026-07-31 | 新增 A-02 24 路由 canonical 授权内核及 Scope/路径安全测试，66 项定向测试通过                                                              | A02_CANONICAL_ROUTE_AUTHZ_TARGETED_PASS |
| 2026-07-31 | Router 与安全回跳统一接入 24 路由授权、canonical Scope Guard 和统一 403，79 项定向测试通过                                                | A02_ROUTE_GUARDS_TARGETED_PASS          |
| 2026-07-31 | 原子启用企业/内容运营双工作台，完成 Sidebar 权限过滤、合法工作台落点和品牌大脑只读，82 项定向/Smoke 测试通过                              | A02_WORKBENCH_ACCESS_TARGETED_PASS      |
| 2026-07-31 | 完成 A-03 控制平面业务审计，冻结 scoped commercial projection、平台/渠道/企业页面收口和五切片实施计划                                     | A03_PLAN_READY                          |
| 2026-07-31 | 完成 A-03.1 Demo 商业投影、运行时不变量校验及平台/渠道/企业可见性 Selector，11 项定向测试通过                                             | A03_COMMERCIAL_PROJECTION_TARGETED_PASS |
| 2026-07-31 | 拆分平台 overview/organizations/catalog/receipts 四条路由语义，统一消费平台 Selector，22 项页面/Selector/Smoke 测试通过                   | A03_PLATFORM_VIEWS_TARGETED_PASS        |
| 2026-07-31 | 拆分渠道 overview/products/customers/usage 四条商业路由，固定一级渠道可见性并完成 22 项页面/Selector/Smoke 回归                           | A03_CHANNEL_VIEWS_TARGETED_PASS         |
| 2026-07-31 | 收口企业 Entitlement 产品语义、canonical 品牌入口、团队/Wallet/回执摘要，并完成 53 项 Selector/页面/权限/Smoke 回归                       | A03_ENTERPRISE_OVERVIEW_TARGETED_PASS   |
| 2026-07-31 | 完成 A-03 四身份/越权/Smoke 与两档视口收口，修复 Workbench 顶栏越界并准备控制平面集成交付                                                 | A03_CONTROL_PLANE_READY_FOR_INTEGRATION |
| 2026-07-31 | 复核集成前全仓基线：定向测试通过；全量 Test 132/141、Build 3 个错误、Lint 702 个问题，保留到集成 Gate 处理                                | A03_INTEGRATION_BASELINE_RECORDED       |
| 2026-08-02 | 向 B 发出 D2 生产平面进度对齐与集成阻塞解除请求，要求修复 Grant/Build、推送干净 `dev/production-plane` 并逐项回传 B-01～B-05              | B_INTEGRATION_UNBLOCK_REQUESTED         |
| 2026-08-03 | A 分支快进至已验收 `main@8594e21`，完成 A-04 生产交付投影审计，冻结 Tenant/Project ViewModel、Store/Adapter 测试、Dashboard 与 B 只读边界 | A04_PLAN_READY                          |
| 2026-08-03 | 完成 Tenant/Project 交付只读投影，唯一任务、双范围、运行额度和安全字段 6 项测试通过                                                       | A04_DELIVERY_VIEW_READY                 |
| 2026-08-03 | 完成 Adapter/Store/Reset 可靠性，修复 Reset 旧证据残留，A-04.1～2 联合 28 项测试通过                                                      | A04_2_RELIABILITY_READY                 |
| 2026-08-03 | 企业 Dashboard 接入安全交付 ViewModel，覆盖空状态、成功、部分同步与 Reset，完成 1440×900 / 1280×800 视觉验收                              | A04_3_DASHBOARD_READY                   |
| 2026-08-03 | A-04 定向 51 项、全量串行 181 项测试、Build、Governance 和 A 范围 ESLint 通过；记录 B StoryCanvas 全仓 Lint 存量阻塞                      | A04_READY_FOR_INTEGRATION               |
| 2026-08-04 | A-04 在短期集成分支完成 51 项定向、181 项全量测试、Build、Governance 和边界审查；接受既有 StoryCanvas Lint 例外                           | A04_INTEGRATION_ACCEPTED                |
| 2026-08-04 | A-04 已通过 `--ff-only` 进入并推送远端 `main`，核对本地与远端一致；下一轮 A 任务待立项                                                    | A04_MERGED_TO_MAIN                      |
| 2026-08-05 | A-05 Wave 1 完成集成验收：A03 项目/Brief/脚本审批、B02 远程存储、F01 Pilot Auth 接线进入接受态；根应用 30 文件 195 项全量测试通过          | A05_WAVE1_ACCEPTED                      |
| 2026-08-05 | 冻结海外 BytePlus/ARK 视频链路、海底捞三里屯内部白名单案例与独立 TTS 凭据边界；启动 C01 合同冻结和 B05 TTS Adapter                       | A05_WAVE2_RUNNING                       |
| 2026-08-05 | 接受 C01 Pilot Contract v0.2：9 类对象、9 个正向 fixture、13 个负向向量及幂等/replay/ACK 规则通过零依赖机器校验                         | C01_ACCEPTED                            |
| 2026-08-05 | B05 独立 TTS 安全 Adapter 通过 13 项定向测试；真实 Transport 因尚无已核验协议与独立凭据保持阻断                                           | B05_ADAPTER_READY_ENV_BLOCKED           |
| 2026-08-05 | C01.1 收紧 StandardError 安全目录并冻结未知任务回执拒绝语义；合同机器校验 6/6 通过                                                       | C01_SECURITY_ACCEPTED                   |
| 2026-08-05 | A05 Production Package/Grant 完成两轮安全复核与修复；专用 PostgreSQL 13 文件 50/50、合同 6/6、类型与构建全部通过                         | A05_ACCEPTED                            |
| 2026-08-05 | Q1 跨平面 Gate 完成 34 个逻辑检查；唯一跳过为 StoryCanvas B3 v0.2 receiver，启动 B3.1 关闭该缺口                                         | Q1_BLOCKED_ON_B3_RECEIVER               |
| 2026-08-05 | A05.3/A05.4 增加双重服务鉴权的 Grant introspection 与权威 grantId 绑定；专用 PostgreSQL Control API 57/57 通过                           | A05_INTROSPECTION_ACCEPTED              |
| 2026-08-05 | B3.1/B3.2 完成 StoryCanvas v0.2 Package/Grant/Command/Receipt receiver、在线授权、过期写保护与安全错误边界；定向 51/51 通过              | B3_RECEIVER_ACCEPTED                    |
| 2026-08-05 | Q1 最终跨平面 Gate 10/10、0 skip，展开 48 项合同检查；Root 195/195、Control PostgreSQL 57/57、StoryCanvas 定向 29/29                     | Q1_CONTRACT_GATE_ACCEPTED               |
| 2026-08-06 | 审计最新 `main@705a134`，确认 A 升级为业务平台线；完成 Root 195/195、Build、Governance、Control API 基线与 Q1 runner 兼容性定位，并提出 Wave 0～4 新计划 | A_BIZ_PLAN_PROPOSED |
| 2026-08-06 | 初始化本机 PostgreSQL 16.14 与专用 `_test` 数据库；Control API 单 worker 完整 Gate 14 files / 57 tests、0 skip 通过 | A_BIZ_POSTGRES_GATE_READY |
| 2026-08-06 | 完成多组织 Auth/RBAC 审计并提出 A-BIZ-00.2 ADR：Organization 授权根、Active Membership Session、项目级 Assignment、稳定拒绝语义与 migration 006+ 草图；待业务会签 | A_BIZ_00_2_ADR_PROPOSED |
