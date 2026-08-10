# C0 CHANGELOG

| 日期       | 变更                                                                                                                                                                                                                                                      | 状态                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 2026-07-30 | 初始化项目级员工线程记忆                                                                                                                                                                                                                                  | CREATED                                 |
| 2026-07-30 | 正式启动 C0-C8，完成 T0 顶层设计与 T1 首轮领域规格                                                                                                                                                                                                        | COMPLETE                                |
| 2026-07-30 | 建立 SaaS/StoryCanvas v0.1 跨仓合同与 D1 海底捞黄金路径                                                                                                                                                                                                   | COMPLETE                                |
| 2026-07-30 | 完成三轮 P0 修复与 C7 Round 3.1 静态复核                                                                                                                                                                                                                  | STATIC_GO                               |
| 2026-07-30 | 交付纯合成可播放 FALLBACK 与 11 分 30 秒 D1 Demo Pack                                                                                                                                                                                                     | COMPLETE                                |
| 2026-07-30 | 保留运行、视觉、彩排和双仓提交为下一 Gate                                                                                                                                                                                                                 | OPEN                                    |
| 2026-07-30 | D1 双仓运行闭环完成，SaaS 基线进入 `98b07e9`                                                                                                                                                                                                              | GO_FOR_INTERNAL_DEMO                    |
| 2026-07-30 | 将 StoryCanvas `46fc8d0` 完整跟踪源码并入 `apps/storycanvas/`，项目转为单仓双应用                                                                                                                                                                         | MONOREPO_ACTIVE                         |
| 2026-07-30 | 冻结 D2 为前端 + Mock 身份与角色工作台，不扩真实认证或后端 RBAC                                                                                                                                                                                           | SCOPE_FROZEN                            |
| 2026-07-30 | StoryCanvas 画布并入根 SaaS 唯一前端，删除独立 50188 Web 与 data/web 构建副本                                                                                                                                                                             | SINGLE_FRONTEND_ACTIVE                  |
| 2026-07-30 | 清理独立前端构建脚本并将生产深链统一到 5173；确认 SQLite 由启动迁移本地创建且不入库                                                                                                                                                                       | REMOTE_RUNTIME_ALIGNED                  |
| 2026-07-30 | 新增 D2 四身份、登录、会话、路由保护、工作台差异、越权拒绝及验收规格                                                                                                                                                                                      | SPEC_READY                              |
| 2026-07-30 | 明确真实 IdP、服务端授权、租户隔离、代理继承/分佣权限与安全审计为后续边界                                                                                                                                                                                 | DEFERRED                                |
| 2026-07-31 | 建立 A 独立分支 `dev/control-plane`，完成子模块、依赖与双服务运行基线                                                                                                                                                                                     | STAGE0_RUNTIME_READY                    |
| 2026-07-31 | 记录 D2 Stage 0：Governance 与根定向 ESLint 通过，Test/Lint/Build 存在分级缺口                                                                                                                                                                            | BASELINE_GAPS_RECORDED                  |
| 2026-07-31 | 冻结 A/B 修复边界：A 进入 A-01，B 接收 StoryCanvas Build/Test/Lint 交接项                                                                                                                                                                                 | HANDOFF_READY                           |
| 2026-07-31 | 完成 A-01 完整 Mock 会话、过期/损坏清理、身份切换和安全站内回跳，33 项定向测试通过                                                                                                                                                                        | A01_TARGETED_PASS                       |
| 2026-07-31 | 冻结 A-02 四身份工作台、具体路由/动作及 canonical Tenant/Project 三层权限矩阵                                                                                                                                                                             | A02_PERMISSION_MATRIX_FROZEN            |
| 2026-07-31 | 实现 A-02 四身份路由/动作权限合同与轻量矩阵测试，40 项定向测试通过                                                                                                                                                                                        | A02_PERMISSION_MODEL_TARGETED_PASS      |
| 2026-07-31 | 新增 A-02 24 路由 canonical 授权内核及 Scope/路径安全测试，66 项定向测试通过                                                                                                                                                                              | A02_CANONICAL_ROUTE_AUTHZ_TARGETED_PASS |
| 2026-07-31 | Router 与安全回跳统一接入 24 路由授权、canonical Scope Guard 和统一 403，79 项定向测试通过                                                                                                                                                                | A02_ROUTE_GUARDS_TARGETED_PASS          |
| 2026-07-31 | 原子启用企业/内容运营双工作台，完成 Sidebar 权限过滤、合法工作台落点和品牌大脑只读，82 项定向/Smoke 测试通过                                                                                                                                              | A02_WORKBENCH_ACCESS_TARGETED_PASS      |
| 2026-07-31 | 完成 A-03 控制平面业务审计，冻结 scoped commercial projection、平台/渠道/企业页面收口和五切片实施计划                                                                                                                                                     | A03_PLAN_READY                          |
| 2026-07-31 | 完成 A-03.1 Demo 商业投影、运行时不变量校验及平台/渠道/企业可见性 Selector，11 项定向测试通过                                                                                                                                                             | A03_COMMERCIAL_PROJECTION_TARGETED_PASS |
| 2026-07-31 | 拆分平台 overview/organizations/catalog/receipts 四条路由语义，统一消费平台 Selector，22 项页面/Selector/Smoke 测试通过                                                                                                                                   | A03_PLATFORM_VIEWS_TARGETED_PASS        |
| 2026-07-31 | 拆分渠道 overview/products/customers/usage 四条商业路由，固定一级渠道可见性并完成 22 项页面/Selector/Smoke 回归                                                                                                                                           | A03_CHANNEL_VIEWS_TARGETED_PASS         |
| 2026-07-31 | 收口企业 Entitlement 产品语义、canonical 品牌入口、团队/Wallet/回执摘要，并完成 53 项 Selector/页面/权限/Smoke 回归                                                                                                                                       | A03_ENTERPRISE_OVERVIEW_TARGETED_PASS   |
| 2026-07-31 | 完成 A-03 四身份/越权/Smoke 与两档视口收口，修复 Workbench 顶栏越界并准备控制平面集成交付                                                                                                                                                                 | A03_CONTROL_PLANE_READY_FOR_INTEGRATION |
| 2026-07-31 | 复核集成前全仓基线：定向测试通过；全量 Test 132/141、Build 3 个错误、Lint 702 个问题，保留到集成 Gate 处理                                                                                                                                                | A03_INTEGRATION_BASELINE_RECORDED       |
| 2026-08-02 | 向 B 发出 D2 生产平面进度对齐与集成阻塞解除请求，要求修复 Grant/Build、推送干净 `dev/production-plane` 并逐项回传 B-01～B-05                                                                                                                              | B_INTEGRATION_UNBLOCK_REQUESTED         |
| 2026-08-03 | A 分支快进至已验收 `main@8594e21`，完成 A-04 生产交付投影审计，冻结 Tenant/Project ViewModel、Store/Adapter 测试、Dashboard 与 B 只读边界                                                                                                                 | A04_PLAN_READY                          |
| 2026-08-03 | 完成 Tenant/Project 交付只读投影，唯一任务、双范围、运行额度和安全字段 6 项测试通过                                                                                                                                                                       | A04_DELIVERY_VIEW_READY                 |
| 2026-08-03 | 完成 Adapter/Store/Reset 可靠性，修复 Reset 旧证据残留，A-04.1～2 联合 28 项测试通过                                                                                                                                                                      | A04_2_RELIABILITY_READY                 |
| 2026-08-03 | 企业 Dashboard 接入安全交付 ViewModel，覆盖空状态、成功、部分同步与 Reset，完成 1440×900 / 1280×800 视觉验收                                                                                                                                              | A04_3_DASHBOARD_READY                   |
| 2026-08-03 | A-04 定向 51 项、全量串行 181 项测试、Build、Governance 和 A 范围 ESLint 通过；记录 B StoryCanvas 全仓 Lint 存量阻塞                                                                                                                                      | A04_READY_FOR_INTEGRATION               |
| 2026-08-04 | A-04 在短期集成分支完成 51 项定向、181 项全量测试、Build、Governance 和边界审查；接受既有 StoryCanvas Lint 例外                                                                                                                                           | A04_INTEGRATION_ACCEPTED                |
| 2026-08-04 | A-04 已通过 `--ff-only` 进入并推送远端 `main`，核对本地与远端一致；下一轮 A 任务待立项                                                                                                                                                                    | A04_MERGED_TO_MAIN                      |
| 2026-08-05 | A-05 Wave 1 完成集成验收：A03 项目/Brief/脚本审批、B02 远程存储、F01 Pilot Auth 接线进入接受态；根应用 30 文件 195 项全量测试通过                                                                                                                         | A05_WAVE1_ACCEPTED                      |
| 2026-08-05 | 冻结海外 BytePlus/ARK 视频链路、海底捞三里屯内部白名单案例与独立 TTS 凭据边界；启动 C01 合同冻结和 B05 TTS Adapter                                                                                                                                        | A05_WAVE2_RUNNING                       |
| 2026-08-05 | 接受 C01 Pilot Contract v0.2：9 类对象、9 个正向 fixture、13 个负向向量及幂等/replay/ACK 规则通过零依赖机器校验                                                                                                                                           | C01_ACCEPTED                            |
| 2026-08-05 | B05 独立 TTS 安全 Adapter 通过 13 项定向测试；真实 Transport 因尚无已核验协议与独立凭据保持阻断                                                                                                                                                           | B05_ADAPTER_READY_ENV_BLOCKED           |
| 2026-08-05 | C01.1 收紧 StandardError 安全目录并冻结未知任务回执拒绝语义；合同机器校验 6/6 通过                                                                                                                                                                        | C01_SECURITY_ACCEPTED                   |
| 2026-08-05 | A05 Production Package/Grant 完成两轮安全复核与修复；专用 PostgreSQL 13 文件 50/50、合同 6/6、类型与构建全部通过                                                                                                                                          | A05_ACCEPTED                            |
| 2026-08-05 | Q1 跨平面 Gate 完成 34 个逻辑检查；唯一跳过为 StoryCanvas B3 v0.2 receiver，启动 B3.1 关闭该缺口                                                                                                                                                          | Q1_BLOCKED_ON_B3_RECEIVER               |
| 2026-08-05 | A05.3/A05.4 增加双重服务鉴权的 Grant introspection 与权威 grantId 绑定；专用 PostgreSQL Control API 57/57 通过                                                                                                                                            | A05_INTROSPECTION_ACCEPTED              |
| 2026-08-05 | B3.1/B3.2 完成 StoryCanvas v0.2 Package/Grant/Command/Receipt receiver、在线授权、过期写保护与安全错误边界；定向 51/51 通过                                                                                                                               | B3_RECEIVER_ACCEPTED                    |
| 2026-08-05 | Q1 最终跨平面 Gate 10/10、0 skip，展开 48 项合同检查；Root 195/195、Control PostgreSQL 57/57、StoryCanvas 定向 29/29                                                                                                                                      | Q1_CONTRACT_GATE_ACCEPTED               |
| 2026-08-06 | 审计最新 `main@705a134`，确认 A 升级为业务平台线；完成 Root 195/195、Build、Governance、Control API 基线与 Q1 runner 兼容性定位，并提出 Wave 0～4 新计划                                                                                                  | A_BIZ_PLAN_PROPOSED                     |
| 2026-08-06 | 初始化本机 PostgreSQL 16.14 与专用 `_test` 数据库；Control API 单 worker 完整 Gate 14 files / 57 tests、0 skip 通过                                                                                                                                       | A_BIZ_POSTGRES_GATE_READY               |
| 2026-08-06 | 完成多组织 Auth/RBAC 审计并提出 A-BIZ-00.2 ADR：Organization 授权根、Active Membership Session、项目级 Assignment、稳定拒绝语义与 migration 006+ 草图；待业务会签                                                                                         | A_BIZ_00_2_ADR_PROPOSED                 |
| 2026-08-06 | 提出 A-BIZ-00.3 ADR，冻结 Terms→邀请→三路注册顺序、不可伪造归因、充值/额度/佣金三账、幂等与冲正；暴露旧批发差价和新充值佣金冲突，待业务/财务/法务会签                                                                                                     | A_BIZ_00_3_ADR_PROPOSED                 |
| 2026-08-07 | 接受老板 Wave 0 完整业务决策，更新多组织/RBAC 与注册/账务两份 ADR；统一 Tenant、单一活动 Membership、项目 Assignment、TEST Payment 和单级佣金获准进入实现                                                                                                 | A_BIZ_WAVE0_DECISIONS_ACCEPTED          |
| 2026-08-07 | A-BIZ-01.1 首个 test-first 切片完成：migration 006 建立 Organization 授权根、Tenant 同 UUID 回填、双向类型保护与可回滚边界；定向 PostgreSQL 4/4 通过                                                                                                      | A_BIZ_01_1_006A_READY                   |
| 2026-08-07 | A-BIZ-01.1 migration 007 建立 Channel 一对一 Organization 扩展与双向类型保护；不写死层级、价格或佣金；完整 PostgreSQL Gate 16 files / 65 tests 通过                                                                                                       | A_BIZ_01_1_007_COMPLETE                 |
| 2026-08-07 | 冻结 A-BIZ-01.1 migration 008：新增 Organization Membership/Role、单一主角色、多角色 Schema、旧表单向 Shadow 同步与歧义回填拒绝                                                                                                                           | A_BIZ_01_1_008_PLAN_FROZEN              |
| 2026-08-07 | A-BIZ-01.1 migration 008 建立 Organization Membership/Role、多角色单主角色约束、旧 Membership 单向 Shadow 与歧义回填拒绝；完整 PostgreSQL Gate 17 files / 72 tests 通过                                                                                   | A_BIZ_01_1_008_COMPLETE                 |
| 2026-08-07 | 冻结 A-BIZ-01.1 migration 009：Project Assignment 跨 Tenant 约束、viewer/editor、可审计生命周期及显式 Pilot manifest backfill；不提前切换 Session/Project Policy                                                                                          | A_BIZ_01_1_009_PLAN_FROZEN              |
| 2026-08-07 | A-BIZ-01.1 009A 建立 Project Assignment 7 项 PostgreSQL 合同测试与无 Schema 副作用 migration 骨架；单 worker 7/7 因新表不存在按预期 RED                                                                                                                   | A_BIZ_01_1_009A_RED_CONFIRMED           |
| 2026-08-07 | A-BIZ-01.1 009A 建立 Project Assignment/backfill evidence Schema、跨 Tenant 复合约束、active content_operator eligibility 与不可变生命周期；完整 PostgreSQL Gate 18 files / 79 tests 通过                                                                 | A_BIZ_01_1_009A_COMPLETE                |
| 2026-08-07 | 冻结 A-BIZ-01.1 009B 显式 Project Assignment manifest runner：严格 Schema、排除 manifestId 的 canonical digest、active 管理员/工作人员/Project 校验、原子写入与安全 replay                                                                                | A_BIZ_01_1_009B_PLAN_FROZEN             |
| 2026-08-07 | A-BIZ-01.1 009B 建立显式 Project Assignment manifest runner 骨架与 8 项 PostgreSQL 合同测试；单 worker 8/8 因 parser/digest/runner 未实现按预期 RED                                                                                                       | A_BIZ_01_1_009B_RED_CONFIRMED           |
| 2026-08-07 | A-BIZ-01.1 009B 核心 runner 实现严格 manifest、canonical digest、事务 advisory locks、授权范围校验与原子 replay；定向 PostgreSQL 8/8 通过                                                                                                                 | A_BIZ_01_1_009B_CORE_GREEN              |
| 2026-08-07 | A-BIZ-01.1 009B 完成显式 Project Assignment manifest runner、CLI、安全日志与并发 replay；Control API 完整单 worker Gate 20 files / 93 tests 通过                                                                                                          | A_BIZ_01_1_009B_COMPLETE                |
| 2026-08-07 | A-BIZ-01.1 通过真实 Knex loader 从空 `_test` 数据库完成 001～009 迁移链收口；9 个 migration、11 张核心表及重复 latest no-op 验证通过                                                                                                                      | A_BIZ_01_1_COMPLETE                     |
| 2026-08-07 | 冻结 A-BIZ-01.2 Active Membership Context：migration 010、Membership Version、唯一上下文登录、最小 Public Session 与非 TENANT Router fail-closed 边界                                                                                                     | A_BIZ_01_2_PLAN_FROZEN                  |
| 2026-08-07 | A-BIZ-01.2 010A 完成 Session Membership/Organization/Version Schema、安全回填、Version Trigger、Shadow 兼容与非 TENANT 回滚保护；Control API 22 files / 99 tests 通过                                                                                     | A_BIZ_01_2_010A_COMPLETE                |
| 2026-08-07 | A-BIZ-01.2 010B 将登录、resolve、rotation 和 Public Session 切到唯一 Membership Context；非 TENANT Project/Production Router fail closed；Control API 24 files / 106 tests 通过                                                                           | A_BIZ_01_2_COMPLETE                     |
| 2026-08-07 | 冻结 A-BIZ-01.3 Membership-bound Project Scope：完整 Actor、实时 Assignment、viewer/editor 动作矩阵及 401/403/404 防泄漏语义                                                                                                                              | A_BIZ_01_3_PLAN_FROZEN                  |
| 2026-08-07 | A-BIZ-01.3 完成 Membership-bound Project Policy、Assignment 实时 Scope 与 viewer/editor 动作切流；Control API 25 files / 116 tests 通过                                                                                                                   | A_BIZ_01_3_COMPLETE                     |
| 2026-08-07 | 冻结 A-BIZ-01.4 统一企业创作工作台：单一 Tenant 创作导航、Pilot Project Context、角色菜单、默认路由及 B 页面安全接线边界                                                                                                                                  | A_BIZ_01_4_PLAN_FROZEN                  |
| 2026-08-07 | A-BIZ-01.4A 完成统一 Tenant Route Manifest/Policy、单一工作台、角色菜单、Demo/Pilot 默认路由和 Project 可见性 fail-closed；Root 串行 209/209 通过                                                                                                         | A_BIZ_01_4A_COMPLETE                    |
| 2026-08-07 | A-BIZ-01.4B 完成 Pilot 完整 Active Context、真实 Project list/read、内存 Project Context 与登录/hydrate Scope 刷新；Root 串行 225/225 通过；Router nullable 兼容独立提交 `00355c1`                                                                        | A_BIZ_01_4B_COMPLETE                    |
| 2026-08-07 | A-BIZ-01.4C 将 Demo Tenant/Production UI 合并为单一创作工作台，并把 Pilot 接入真实 Project Scope、统一 Shell、Manifest 路由、安全 returnTo 与明确拒绝/空/服务错误状态；Root 串行 233/233 通过                                                             | A_BIZ_01_4C_COMPLETE                    |
| 2026-08-07 | 冻结 A-BIZ-01.4D B 页面接线合同：六字段 Pilot Context、fail-closed resolver、无 Secret/Assignment/Demo fallback、正式 handoff 与联合回归边界                                                                                                              | A_BIZ_01_4D_PLAN_FROZEN                 |
| 2026-08-07 | A-BIZ-01.4D 完成六字段 Pilot 页面 Context、15 项 fail-closed 合同测试和给 B 的正式 Handoff；Root 串行 34 files / 248 tests 通过，A-BIZ-01.4 收口                                                                                                          | A_BIZ_01_4_COMPLETE                     |
| 2026-08-07 | 冻结 A-BIZ-02.1 Terms 版本与发布：migration 011、SHA-256 正文一致性、发布状态机、Public current、append-only Consent、平台管理员 API 与 fail-closed 回滚边界                                                                                              | A_BIZ_02_1_PLAN_FROZEN                  |
| 2026-08-07 | A-BIZ-02.1A 完成 migration 011 TermsDocument/Version/UserConsent、SHA-256 正文约束、发布状态机、supersedes Scope、append-only Consent 与 fail-closed 回滚；Control API 124/124 通过                                                                       | A_BIZ_02_1A_COMPLETE                    |
| 2026-08-07 | A-BIZ-02.1B 完成 Terms Repository/Service、平台管理员写权限、事务发布与稳定 replay/conflict、Public current fail-closed、current Consent 校验和最小 evidence 白名单；Control API 28 files / 134 tests 通过                                                | A_BIZ_02_1B_COMPLETE                    |
| 2026-08-07 | A-BIZ-02.1C 完成 Public current 与 PLATFORM Terms 管理 API、Session 权限/轮换、严格输入白名单、稳定 401/403/404/409/503 和独立 Bootstrap；Control API 29 files / 144 tests 通过                                                                           | A_BIZ_02_1_COMPLETE                     |
| 2026-08-07 | 冻结 A-BIZ-02.2 Invitation 生命周期：三类可信邀请、7 天单次/30 天 100 次、版本化 Token digest、Scope 隔离、Public Preview、防枚举、原子 Usage 与注册内部消费合同                                                                                          | A_BIZ_02_2_PLAN_FROZEN                  |
| 2026-08-07 | A-BIZ-02.2A 完成 migration 012 Invitation/Usage Schema、三类 Scope 与时限约束、Token digest、不可逆生命周期、append-only 原子 Usage、并发末位名额和 fail-closed rollback；Control API 30 files / 153 tests 通过                                           | A_BIZ_02_2A_COMPLETE                    |
| 2026-08-07 | A-BIZ-02.2B 完成 Invitation Token/Domain/Service/PostgreSQL Repository、三 Scope 服务端派生、首次明文 Token、安全创建/撤销/消费 replay、Public unavailable 与原子 Usage 合同；Control API 32 files / 167 tests 通过                                       | A_BIZ_02_2B_COMPLETE                    |
| 2026-08-07 | A-BIZ-02.2C 完成 body Token Public Preview、不可逆键限流、三 Scope 创建/列表、issuer 撤销、Session/路径 Scope fail-closed 与独立 Bootstrap；Control API 34 files / 181 tests 通过                                                                         | A_BIZ_02_2_COMPLETE                     |
| 2026-08-08 | 冻结 A-BIZ-02.3 单一注册事务：四种服务端来源、Registration/Consent/Invitation Usage/Attribution 原子写入、12 个月归因快照、keyed HMAC 幂等、邮箱验证 fail closed 与 Public API 边界                                                                       | A_BIZ_02_3_PLAN_FROZEN                  |
| 2026-08-08 | A-BIZ-02.3A 完成 migration 013 Registration/首次 Attribution/append-only Event、Consent/Usage 正式 FK、孤立事实迁移拒绝与审计型回滚保护；Control API 35 files / 191 tests 通过                                                                            | A_BIZ_02_3A_COMPLETE                    |
| 2026-08-08 | A-BIZ-02.3B 完成 Registration Domain/Service 与统一 PostgreSQL Unit of Work，原子写入 User/Tenant/Membership/Registration/Consent/Usage/Attribution，支持安全 replay、邮箱验证 fail closed 与 12 个月 Channel 保护；Control API 37 files / 202 tests 通过 | A_BIZ_02_3B_COMPLETE                    |
| 2026-08-08 | A-BIZ-02.3C 完成唯一 Public Registration API、严格输入/安全响应、不可逆组合键限流、独立 HMAC Secret 与默认 Email Verification fail-closed Bootstrap；Control API 39 files / 220 tests 通过，A-BIZ-02.3 收口                                               | A_BIZ_02_3_COMPLETE                     |
| 2026-08-08 | 冻结 A-BIZ-02.4 注册/邀请/须知前端：真实 Public API Client、统一注册页、Terms/Invitation fail-closed、敏感 Token 内存边界、无自动登录与 Router 独立接线                                                                                                   | A_BIZ_02_4_PLAN_FROZEN                  |
| 2026-08-08 | A-BIZ-02.4A 完成严格 Public Registration API Client：Terms/Invitation/Registration、安全错误映射、201/200 replay、敏感字段不落盘；定向 8/8、Build/Static PASS，既有 3 个重测试文件单独复跑全 PASS                                                         | A_BIZ_02_4A_COMPLETE                    |
| 2026-08-08 | A-BIZ-02.4B 完成统一 fail-closed 注册页：Terms/Invitation 状态、严格表单、默认 Evidence unavailable、幂等重试、stale reload、201/replay 与无自动登录；定向联合 21/21、Build/Static PASS                                                                   | A_BIZ_02_4B_COMPLETE                    |
| 2026-08-08 | A-BIZ-02.4C 完成 Pilot 公开 `/register`、Invitation 查询 Token 一次性读取与 replace 清理、Login 注册入口、已登录默认路由及注册完成返回登录；联合 34/34、Build/Static PASS，A-BIZ-02.4 收口                                                                | A_BIZ_02_4_COMPLETE                     |
| 2026-08-08 | 冻结 A-BIZ-03.1 TEST Recharge/Payment Foundation：migration 014、Tenant Wallet/Order Scope、版本化转换 Rule、Payment Inbox、TEST/LIVE 隔离及先 received 后 03.2 原子到账边界                                                                              | A_BIZ_03_1_PLAN_FROZEN                  |
| 2026-08-08 | A-BIZ-03.1A 完成 migration 014 Recharge/Payment Schema：版本化 Rule、Tenant/Wallet/Buyer Scope、冻结订单转换事实、append-only Order Event、Payment Inbox、TEST/LIVE 隔离与 fail-closed rollback；Control API 40 files / 229 tests 通过                    | A_BIZ_03_1A_COMPLETE                    |
| 2026-08-08 | A-BIZ-03.1B 完成 TEST Payment Service/Provider/PostgreSQL Repository、双幂等与 LIVE fail closed；Control API 42 files / 249 tests 通过                                                                                                                    | A_BIZ_03_1B_COMPLETE                    |
| 2026-08-08 | A-BIZ-03.1C 完成 TEST Recharge/Payment HTTP API、Tenant/Platform Scope、独立 Internal Token、双 Secret fail-closed Config 与共享 Bootstrap；Payment Event 仍仅 received，无 paid/Credit/Commission；Control API 43 files / 268 tests 通过                 | A_BIZ_03_1_COMPLETE                     |
| 2026-08-08 | 冻结 A-BIZ-03.2 原子到账与额度发行计划：TEST succeeded 单事务应用 Payment/Order/Credit Lot/Ledger，replay/并发零重复，unsupported/退款事件暂时安全拒绝，LIVE/Commission/真实商业数字继续 fail closed                                                      | A_BIZ_03_2_PLAN_FROZEN                  |
| 2026-08-08 | A-BIZ-03.2A 完成 migration 015：Credit Lot、Ledger Lot 关联、Payment processed evidence、来源一致性与 fail-closed rollback；Control API 44 files / 273 tests 通过                                                                                         | A_BIZ_03_2A_COMPLETE                    |
| 2026-08-08 | A-BIZ-03.2B 完成 TEST Payment 单事务原子应用：Event applied、Order paid、purchased/bonus Lot 与 Ledger issue；并发 replay/同 Order 竞争、unsupported、冻结 Wallet 和完整回滚合同通过；Control API 44 files / 277 tests                                    | A_BIZ_03_2B_COMPLETE                    |
| 2026-08-08 | A-BIZ-03.2C 完成 TEST Payment HTTP 终态收口：首次 applied/rejected 与 replay 均为 200 并显式 replay header；Tenant RechargeOrder 安全展示 paid 与购买/赠送额度摘要；Control API 44 files / 278 tests 通过，A-BIZ-03.2 收口                                | A_BIZ_03_2_COMPLETE                     |
| 2026-08-08 | 冻结 A-BIZ-03.3 佣金影子账、TEST 全额安全冲正与结算草稿：版本化 Rule/Outcome/Accrual/Reversal，真实比例、部分退款和 paid 继续 fail closed                                                                                                                 | A_BIZ_03_3_PLAN_FROZEN                  |
| 2026-08-08 | A-BIZ-03.3A 完成 Migration 016 Commission Shadow Ledger：六张空审计表、Platform Rule/Settlement 审批、Rule 窗口、整数计提、append-only 冲正、自然月 Settlement 与 fail-closed rollback；Control API 45 files / 285 tests 通过                             | A_BIZ_03_3A_COMPLETE                    |
| 2026-08-08 | A-BIZ-03.3E 完成 TEST Settlement Draft、Migration 018 Reversal Item validator 修复、幂等/并发/跨月净额与共享 HTTP Bootstrap；Control API 54 files / 363 tests 全 Gate 通过                                                                                | A_BIZ_03_3_COMPLETE                     |
| 2026-08-08 | 冻结 A-BIZ-03.4 商业前端与审计：先补 canonical Channel Reference/active Directory，再按 Organization 分流 Pilot，交付真实 Commission Audit、TEST Settlement Draft 与 Tenant Recharge 只读审计；Demo/Pilot 严格隔离                                        | A_BIZ_03_4_PLAN_FROZEN                  |
| 2026-08-09 | A-BIZ-03.4A 完成 canonical Channel Reference、Platform active Channel Directory、共享 Bootstrap 与严格 Pilot 商业 API Client；TEST-only、真实 Cookie/no-store、Request ID 与 fail-closed 解析边界已落地，未接 UI/Router/Layout                            | A_BIZ_03_4A_COMPLETE                    |
| 2026-08-09 | A-BIZ-03.4B 完成纯 Organization Commercial Route Policy：四路 Manifest、PLATFORM/CHANNEL/TENANT 默认路由、跨 Scope 404 语义、同 Scope 403、Tenant Recharge 角色限制与安全 returnTo；未修改共享 Router/Layout                                              | A_BIZ_03_4B_COMPLETE                    |
| 2026-08-09 | A-BIZ-03.4C 完成 Platform/Channel Commission Audit 真实只读页：canonical Channel 两段加载、bounded TEST 安全投影、loading/empty/retry 与 401/403/404/5xx/invalid response；Demo/Router/Layout 保持不变                                                    | A_BIZ_03_4C_COMPLETE                    |
| 2026-08-09 | A-BIZ-03.4A～03.4F 完整收口：真实商业 Client、Organization Policy、Commission/Recharge Audit、TEST Settlement Draft 与共享 Pilot Router/Layout 全部接通；前端 330/330 tests 与全工程 Gate 通过                                                            | A_BIZ_03_4_COMPLETE                     |
| 2026-08-09 | 冻结 A-BIZ-06 运营收口与 A/B 联合 Gate：06A～06F 覆盖确定性 Gate runner、Member 合同、真实 Pilot 运营 UI/E2E、A/B 黄金路径、迁移回滚和文档；full 模式缺专用 PostgreSQL 或 B 基线必须 fail closed                                                          | A_BIZ_06_PLAN_FROZEN                    |
| 2026-08-09 | A-BIZ-06A 完成 12-phase 确定性 Joint Gate manifest/runner：plan 只报 NOT_RUN，full 缺专用 PostgreSQL、B 基线或 06D/06E/06F 时 fail closed；StoryCanvas v0.2 定向 13/13 PASS                                                                               | A_BIZ_06A_COMPLETE                      |
| 2026-08-09 | A-BIZ-06B 完成 Migration 019、Member Directory/Deactivation Repository/Service、真实 Cookie HTTP Route 与共享 Bootstrap；Control API 61 files / 414 tests PASS，旧 Session 下一次 resolve 失效                                                            | A_BIZ_06B_COMPLETE                      |
| 2026-08-10 | 冻结 A-BIZ-06C Pilot Operations UI：先补 Terms Document/Version bounded reads 与 Invitation bounded list，再交付 strict Client、Terms/Invitation/Member 页面和单独 Router/Layout 激活；Token/Scope/Terms 正文 fail closed                                 | A_BIZ_06C_PLAN_FROZEN                   |

## 2026-08-08 · A-BIZ-03.3B Atomic Commission Accrual Plan

- 新增 `A_BIZ_03_3B_ATOMIC_COMMISSION_ACCRUAL_PLAN.md`，冻结 TEST succeeded Payment 同事务 Calculation Outcome/Accrual 的事务顺序、决策矩阵、整数计算、RED 合同与 Gate。
- 明确无默认佣金比例、多 Rule fail closed、Commission 写入失败全事务回滚，以及 LIVE/refund/HTTP/Settlement 排除边界。
- 更新 03.3 总计划状态为 `03_3B_PLAN_FROZEN`。

## 2026-08-08 · A-BIZ-03.3B Atomic TEST Commission Accrual

- 新增 Commission 纯计算模块与单元合同，支持 canonical snapshot/digest、BigInt 整数比例、FLOOR/CEILING/HALF_UP 和退款观察期 eligibleAt。
- Payment Repository 在 TEST succeeded 原子到账事务中追加 Calculation Outcome，并在唯一合法 Rule 时追加 Commission Accrual。
- 新增 PostgreSQL 合同覆盖 accrued、无归因、过期、Channel/Rule 不可用、replay、并发、Commission 故障回滚与多个 Rule fail closed。
- Control API 全量 46 files / 300 tests 通过；共享 Bootstrap、HTTP 与 StoryCanvas 未变更。

## 2026-08-08 · A-BIZ-03.3C Full TEST Reversal Plan

- 新增 `A_BIZ_03_3C_FULL_TEST_REVERSAL_PLAN.md`，冻结 TEST 全额 refund/chargeback 的最保守 Credit 可回收证明、Migration 017、原子事务顺序、稳定拒绝语义与 RED/Gate。
- 明确只在 Wallet 无任何非 issue Ledger、无任何历史 Reservation、Lot/issue 完整且未 reclaim 时允许全额冲正；部分退款和无法证明的余额状态继续 fail closed。
- 原 Accrual 存在时全额 append-only Reversal；不存在时沿用原 Calculation Outcome，不创建虚假佣金事实。

## 2026-08-08 · A-BIZ-03.3C Atomic Full TEST Refund/Chargeback Reversal

- Migration 017 增加 Lot-linked `reclaim`、独立 issue/reclaim 唯一性、全额 TEST reversal PaymentEvent 审计码，并要求 Commission Reversal 引用 applied TEST 全额来源 Event。
- Payment Repository 在单事务内完成 Event applied、完整 Credit reclaim、可选全额 Commission Reversal、Order refunded/disputed 与 RechargeOrderEvent。
- 保守安全证明拒绝部分退款、非 issue Wallet Ledger、任何历史 Reservation、Lot/issue 不完整、既有 applied reversal 和 Commission Reversal 冲突。
- replay、refund/chargeback 竞争与中途 ID 故障回滚合同通过；Control API 全量 47 files / 314 tests，全部工程 Gate PASS。
- 状态：`A_BIZ_03_3C_COMPLETE / COMMITTED`；无共享 Bootstrap/HTTP/StoryCanvas 变更。

## 2026-08-08 · A-BIZ-03.3D Scoped Commission Read APIs

- 新增 Commission Audit Repository/Service/Router，为 Platform Admin 提供全局 Calculation/Accrual/Reversal/manual-review，为 Channel Admin 提供 canonical 自身 Channel 查询。
- 冻结 404/403 Scope 语义、1～100 bounded list、稳定倒序和最小安全响应投影。
- 核心提交 `957c080`，共享 Bootstrap 提交 `93c48aa`；B 需同步后再修改 `app.ts` / `server.ts`。
- Control API 全量 50 files / 334 tests 通过；全部工程 Gate PASS，StoryCanvas 未变更。

## 2026-08-08 · A-BIZ-03.3E TEST Commission Settlement Draft

- Migration 018 提交 `9b252ee` 修复 Reversal Settlement Item validator 的 PL/pgSQL record/alias 重名，保留历史 migration 不变并为有证据 rollback 设置 fail-closed guard。
- 核心提交 `499dcbb` 实现 TEST-only Settlement Draft、HMAC 幂等事实、advisory lock、eligibleAt/cutoff、fully-reversed skip、cross-month negative Reversal、零额 Draft 和最小安全投影。
- 共享 Bootstrap 提交 `0433fdb` 挂载 Platform Admin POST Route；B 后续修改共享 App/Server 前必须同步。
- 定向 Gate 9 + 26 + 19 tests；Control API 全量 54 files / 363 tests；typecheck/build/ESLint/Prettier/Governance/diff-check 全 PASS。
- 03.3A～03.3E 全部完成；LIVE、真实比例、paid、提现、KYC、税务和自动打款继续排除。

## 2026-08-08 · A-BIZ-03.4 Commercial Frontend & Audit Plan

- 新增 `A_BIZ_03_4_COMMERCIAL_FRONTEND_AUDIT_PLAN.md`，冻结六个原子切片和共享提交边界。
- 先补 `GET /api/v1/channels/current` 与 Platform active Channel Directory，禁止前端把 Organization ID 猜成 Channel ID，也禁止从 Commission 记录反推 Channel。
- Pilot 按 PLATFORM/CHANNEL/TENANT 使用统一 Route Policy；Platform/Channel 脱离 Tenant Project Boundary，Demo Router/Store 保持不变。
- Platform/Channel Commission Audit 为真实只读页；Platform Settlement 仅创建 `TEST / draft / NON_QUOTE`；Tenant Recharge 仅 `tenant_admin` 只读，不开放创建。
- 冻结 401/403/404、Request ID、loading/empty/service error/retry 和敏感信息不泄漏；Pilot 失败绝不回退 Mock。
- LIVE、真实佣金比例、paid、提现、KYC、税务、自动打款、未规划 review/approve HTTP、客户端完整导出和 StoryCanvas 继续排除。
- 首个 RED 为 Current Channel canonical ID 合同；共享 Control API Bootstrap 与 Pilot Router/Layout 后续必须分别独立提交并通知 B。

## 2026-08-09 · A-BIZ-03.4A Commercial Channel Reference / Strict Client

- 核心提交 `461f494` 新增 Current Channel Reference 与 Platform active Channel Directory；canonical Channel ID 由服务端 Repository mapping 解析，禁止猜测 Organization ID 等于 Channel ID。
- 共享 Bootstrap 提交 `856757b` 挂载新 Router；B 修改 `apps/control-api/src/app.ts`、`app.test.ts`、`server.ts` 前必须同步。
- 前端提交 `671fe3e` 增加严格 Pilot 商业 Client，覆盖 Channel/Directory、Platform/Channel Commission Audit、Platform TEST Settlement Draft 与 Tenant RechargeOrder。
- 冻结真实 Cookie、`no-store`、401/403/404/409/422/5xx、Request ID、严格 runtime parser、TEST-only 与敏感字段最小投影；LIVE 或 malformed response fail closed，绝不回退 Demo/Mock/localStorage。
- Control API 定向/全量、typecheck/build 与前端 Client/build Gate 通过；默认无 dedicated test DB 时 PostgreSQL suites SKIP。StoryCanvas 未修改，B 的未跟踪 vendor 文件未纳入。
- 下一 RED 为 03.4B 纯 Route Policy：PLATFORM 默认 `/platform/commission-audit` 且不得进入 Tenant Project Boundary；共享 Router/Layout 仍留待 03.4F。

## 2026-08-09 · A-BIZ-03.4B Pilot Organization Commercial Route Policy

- 新增纯 Domain Policy 与 15 项测试，冻结四条商业路由 Manifest、Scope/Role/Capability、菜单和 Project Context。
- PLATFORM/CHANNEL 默认进入各自 Commission Audit 且不依赖 Tenant Project；TENANT 保留现有首个可见 Project/空 Project 列表策略。
- 跨 Organization route probe 为 not-found 语义，同 Scope 缺角色为 permission denied；`pilot_support` 不继承权限，Tenant Recharge 仅 `tenant_admin`。
- returnTo 只保留当前 Policy 允许的站内路径；外部、未知、跨 Scope 与 malformed 候选回安全默认路由，缺角色不通过 fallback 获权。
- 未修改 Router/Sidebar/Topbar、页面、Control API 或 StoryCanvas；全量唯一 5 秒 UI timeout 的文件定向 11/11 PASS，其余工程 Gate 全 PASS。
- 下一 RED：03.4C Platform Commission Audit 页面只调用真实 `pilotControlApi` 并覆盖 loading/empty，不读取 Demo Store。

## 2026-08-09 · A-BIZ-03.4C Platform/Channel Commission Audit

- 新增独立 Pilot Platform/Channel Commission Audit 页面与 11 项测试；Demo 页面与 Demo Store 保持不变，首个 RED 因页面模块不存在按预期失败。
- Platform 加载 Payment Event、Calculation、Accrual、Reversal、Manual Review；Channel 严格先解析 canonical Channel，再读取该 Channel 三类审计事实。
- 冻结 loading/empty/ready/retrying、401/403/404、network/5xx、invalid response 与 Request ID；Retry 清空旧投影且不回退 Mock，401 清 Session。
- UI 仅显示 bounded TEST 安全投影，显著声明非到账、非提现、非 paid、非自动打款；不提供真实比例或 review/approve 操作。
- 定向 11/11 PASS；全量单 worker 为 37/38 files、306/307 tests PASS，唯一既有 5 秒 UI timeout 用例隔离复跑 1/1 PASS；TypeScript、ESLint、Build、Prettier、Governance、diff-check 全 PASS；Router/Layout、Control API、StoryCanvas 未修改。
- 下一 RED：03.4D beneficiary 只从真实 active Channel Directory 选择，并显示 `TEST / draft / NON_QUOTE`，不允许手工 UUID 或伪造历史列表。

## 2026-08-09 · A-BIZ-03.4D Platform TEST Settlement Draft

- 新增独立 Pilot TEST Settlement Draft 页面与 8 项测试；首个 RED 因页面模块缺失按预期失败，Router/Layout 激活继续留到 03.4F。
- beneficiary 只来自真实 active Channel Directory，使用 canonical Channel ID；无手工 UUID、Commission 反推、Demo Store 或 Mock fallback。
- 创建合同固定 `TEST / draft / NON_QUOTE`、CNY、UTC 自然月与安全 cutoff；同事实重试复用幂等 key，事实变化才轮换，409 不自动换 key。
- 成功仅显示当前 API Draft，零候选/零额是合法结果；不伪造服务端记录或本地可恢复数据，并明确非到账、非提现、非 paid、非自动打款。
- 定向 8/8 PASS；全量单 worker 311/315 PASS，4 个既有 5 秒 UI timeout 用例隔离 13/13 PASS；TypeScript、ESLint、Build、Prettier、Governance、diff-check PASS。
- 未修改共享 Router/Sidebar/Topbar、Control API 或 StoryCanvas；下一 RED 为 03.4E Tenant Recharge Audit 真实 scoped GET 与 tenant_admin-only 页面能力。

## 2026-08-09 · A-BIZ-03.4E Tenant TEST RechargeOrder Audit

- 新增独立 Pilot Tenant RechargeOrder 只读审计页与 7 项测试；只使用 Session canonical tenantId 调用真实 bounded 50 GET。
- 严格限定 TENANT `tenant_admin`；content operator 在调用 API 前拒绝，缺 Tenant Context fail closed，不接受 URL/Project/手工 Scope 覆盖。
- 安全展示 TEST 金额、购买/赠送额度、赠送到期、短引用、UTC 时间及退款/争议状态；不暴露敏感 ID、Provider、Rule、Attribution、Buyer 或 Wallet。
- 显著声明 `TEST · READ ONLY · NON_QUOTE`，状态不代表真实收款、到账、可用余额或退款完成；无 POST、支付模拟、退款动作或 Mock fallback。
- 定向 7/7、全量 40 files / 322 tests PASS；TypeScript、ESLint、Build、Prettier、Governance、diff-check PASS；共享 Router/Layout 与 StoryCanvas 未修改。
- 下一 RED 为 03.4F 共享 Pilot Router/Layout 四 Scope 激活；该共享提交完成后必须通知 B 同步。

## 2026-08-09 · A-BIZ-03.4F Pilot Organization Commercial Workbenches

- 共享 Router 改为 PLATFORM/CHANNEL/TENANT 组织级分流，并统一复用 03.4B Policy 处理默认路由、安全 returnTo、direct URL、403/404 与菜单能力。
- PLATFORM/CHANNEL 脱离 Tenant Project Boundary，分别接入真实 Commission Audit；Platform 同时接入 `TEST Settlement Draft`。TENANT 保留 Project Context，并为 `tenant_admin` 接入 RechargeOrder 只读审计。
- Sidebar/Topbar 按 Organization Scope 显示商业菜单、home 和工作台名称；Platform/Channel 不显示 Project Selector，Content Operator 不显示 Tenant Recharge。
- Pilot 跨 Scope 路由使用安全 404、同 Scope 缺角色使用 403，且 Pilot 404 不提供 Demo 链接；Demo Router/Store/UI 保持不变。
- 首个 Router RED 按预期证明旧全局 Tenant Boundary 阻断 Platform；最终定向 20/20、全量 40 files / 330 tests PASS，TypeScript、ESLint、Build、Prettier、Governance、diff-check PASS。
- StoryCanvas 未修改；本共享 Router/Layout 切片必须独立提交并通知 B 先同步后再修改共享导航。

## 2026-08-09 · A-BIZ-03.4 Commercial Frontend & Audit Closure

- 03.4A～03.4F 已完成并独立提交，最终实现基线 `b80e9ef`；Pilot 现按 PLATFORM/CHANNEL/TENANT 严格分流，Demo/Pilot 数据与导航保持隔离。
- canonical Channel Reference、active Channel Directory、严格 Session Cookie Client、Organization Route Policy、Platform/Channel Commission Audit、Platform TEST Settlement Draft 与 Tenant Recharge Audit 已全部接通。
- 统一冻结 401/403/404/409/422/5xx、Request ID、loading/empty/retry、invalid response 与敏感信息最小投影；失败不回退 Demo/Mock/localStorage。
- Settlement 仍只为 `TEST / draft / NON_QUOTE`，不实现 LIVE、真实佣金比例、paid、提现、KYC、税务、自动打款或未规划 review/approve HTTP。
- 最终 Gate：Router 20/20、前端全量 40 files / 330 tests PASS；TypeScript、ESLint、Build、Prettier、Governance、diff-check PASS。
- 共享同步点为 Control API Bootstrap `856757b` 与 Router/Layout `b80e9ef`；B 修改对应共享文件前必须同步。StoryCanvas tracked diff 为零，未跟踪 vendor 文件继续排除。
- 下一步只规划 Wave 4 / A-BIZ-06 运营收口与 A/B 联合 Gate，不直接扩大实现。

## 2026-08-09 · A-BIZ-06 Operational Closure & A/B Joint Gate Plan

- 新增 `A_BIZ_06_OPERATIONAL_CLOSURE_JOINT_GATE_PLAN.md`，冻结 06A～06F 原子切片、A/B 所有权、共享提交边界和最终 Gate 语义。
- 审计确认现有 Playwright 只覆盖 Demo/localStorage，Control API PostgreSQL suites 缺 `CONTROL_API_TEST_DATABASE_URL` 时可能 SKIP，根目录也没有统一 Joint Gate manifest/runner。
- full Gate 缺合法 `_test` PostgreSQL、B 可同步干净基线或 required phase 时必须非零退出；`--list`/`--plan` 及快速模式不得汇总为最终 PASS。
- Member 管理先冻结最小 Directory/Deactivation HTTP，再实现真实 Pilot UI；不实现任意角色编辑、删除成员、密码管理、伪造 Audit/Export 或未规划 review/approve。
- 商业能力继续为 `TEST / NON_QUOTE`，Settlement 为 `TEST + draft`；不实现 LIVE、paid、提现、KYC、税务或自动打款。
- 首个 06A RED：manifest 必须列全 Root、Control PostgreSQL、C01、StoryCanvas v0.2、Pilot Playwright、Build、Governance、diff-check，且 full 模式缺专用数据库必须 fail closed。

## 2026-08-09 · A-BIZ-06A Deterministic Joint Gate Runner

- 先写 manifest/runner RED，确认因模块缺失失败；随后新增 12-phase 机器可读 manifest、fail-closed Root runner 和 StoryCanvas v0.2 显式定向 wrapper。
- 增加 Root manifest/plan/full scripts；`--list`/`--plan` 只输出 `NOT_RUN`，full 缺 dedicated PostgreSQL、B baseline 或未来 required slice 时退出 2。
- Provider Secret 在 child process 环境中清空，日志不输出数据库 URL/密码；runner 不执行 LIVE 商业或付费媒体调用。
- Gate：manifest 7/7、Root Build、Control API typecheck/build、StoryCanvas v0.2 targeted 13/13、ESLint、Prettier、Governance、diff-check PASS。
- Root 默认全量测试在并发压力下存在两个既有 smoke timeout；cross-plane Gate 暴露 v0.1 TS export 与 A3 HTTP 500 存量缺口，均被如实保留为最终 Gate 风险而非伪造 PASS。
- StoryCanvas tracked diff 为零；本根 package/Joint Gate 共享提交需通知 B 先同步。下一步冻结 06B Member Directory/Deactivation 子计划。

## 2026-08-09 · A-BIZ-06B Member Directory / Deactivation Contract

- 新增 `A_BIZ_06B_MEMBER_DIRECTORY_DEACTIVATION_PLAN.md`，冻结 current Organization Member Directory 与 suspend HTTP、DTO、授权、事务、并发和安全错误合同。
- PLATFORM/CHANNEL/TENANT 仅对应管理员可操作；`pilot_support`、`content_operator` 不扩权；跨 Organization Membership 安全 404。
- suspend 使用 strict `expectedVersion`，保护 replay、self-suspend、last-admin、expired 与 stale version；成功依赖既有 Membership version + Auth resolve 让旧 Session 下一请求失效。
- 审计确认无需新增 Migration；TENANT legacy shadow 为单向兼容写路径，存在 legacy row 时必须通过 legacy 更新推进 canonical，不做无规则双写。
- Repository/Service、Route、共享 App/Server wiring 分开提交；共享 wiring 完成后通知 B。StoryCanvas 保持排除。
- 首个 RED：Service 授权与 canonical Scope；随后补 PostgreSQL 事务、并发、Session 失效和 legacy 一致性合同。

## 2026-08-09 · A-BIZ-06B Legacy Membership Trigger Plan Correction

- 撤回“无需新增 Migration”结论：migration 010 legacy shadow UPDATE 会在 status-only suspend 时误删 secondary roles，并导致 version 不止 `+1`。
- 冻结独立 Migration 019：status-only update 不触碰 role set；只有 legacy primary role 真正变化时才执行既有角色兼容逻辑；rollback 恢复旧函数。
- Member Repository/Service 在 Migration 019 PostgreSQL RED/Green 与独立提交后继续；缺 `_test` database 时不得把 SKIP 记为 PASS。
- StoryCanvas 与 B 的未跟踪 vendor 文件保持排除。

## 2026-08-09 · A-BIZ-06B Member Operations API Closure

- Migration 019 已修复 legacy status-only Membership 更新误删 secondary roles 和额外 version bump；rollback/reapply 与 legacy role-change 兼容合同通过。
- Repository/Service 已交付 current Organization bounded Member Directory 与事务化 suspend，覆盖管理员 Scope、跨 Organization 404、self、last-admin、expired、stale version、replay、并发、Session invalidation 与失败回滚。
- HTTP 已交付 `GET /api/v1/organizations/current/members`、`POST /api/v1/organizations/current/members/:membershipId/suspend`，使用真实 Cookie/rotation、`no-store`、strict validation、Request ID 与安全错误 envelope。
- 共享 Bootstrap 以 `0b177cf` 独立接线；B 后续修改 `apps/control-api/src/app.ts`、`app.test.ts`、`server.ts` 前必须先同步。
- Gate：Migration 2/4、Repository/Service 2/14、Route/Service 2/19、App/Route 2/24、Control API 全量 61 files / 414 tests PASS；typecheck、build、ESLint、Prettier、Governance、diff-check PASS。
- StoryCanvas tracked diff 为零；B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 保持排除。
- 状态：`A_BIZ_06B_COMPLETE / MEMBER_OPERATIONS_API_READY / READY_FOR_06C_PLANNING`；未宣称 A-BIZ-06、Full Joint Gate、完整 IAM 或 LIVE Operations 完成。

## 2026-08-10 · A-BIZ-06C Pilot Operations UI Plan

- 新增 `A_BIZ_06C_PILOT_OPERATIONS_UI_PLAN.md`，冻结 06C.1～06C.6 原子切片、页面路由、默认路由、Scope、Session、错误、敏感信息和测试边界。
- 审计确认 Invitation management list 当前无服务端上限；Terms management 缺 Document/Version read，必须先补 bounded 后端事实，禁止前端截断或本地 state 伪造恢复能力。
- Member 使用 06B canonical current Organization API；Channel 使用 canonical current channelId；Tenant 使用 Session tenantId；Pilot 失败不回退 Demo/Mock/localStorage。
- Invitation Token 只在首次 create 当前内存态最小展示；Terms 正文只由授权管理员录入业务/法务提供内容，工程师不 seed、不代写、不自动发布。
- Shared Router/Sidebar/Topbar 只在 06C.6 独立提交并通知 B；StoryCanvas 保持排除。
- 状态：`A_BIZ_06C_PLAN_FROZEN / READY_FOR_06C_1_RED`；未宣称 06C、A-BIZ-06、完整 IAM、正式 Terms、Full Joint Gate 或 LIVE Operations 完成。

## 2026-08-10 · A-BIZ-06C.1 Bounded Operations Reads

- Terms 增加 bounded Platform Document/Version management directories，冻结 status、limit、稳定排序、缺 Document 404、真实 Cookie/rotation、no-store、strict 422 与 Request ID。
- Invitation 三类 management list 增加 status/limit；Repository 二次 clamp，expired 按服务端 asOf，active/revoked/exhausted/expired 过滤均有 PostgreSQL 证据。
- Repository/Service 与 HTTP 分成四个原子提交：`8feda7f`、`1f4d768`、`7c31089`、`b6ff3db`。
- Terms 32/32、Invitation 37/37 PASS；Control API typecheck/build、ESLint、Prettier、Governance、diff-check PASS。
- StoryCanvas 未修改；下一步为 06C.2 strict Terms/Invitation Pilot Client，禁止 Demo/Mock fallback 与 Invitation Token 持久化。

## 2026-08-10 · A-BIZ-06C.2 Strict Pilot Operations Client

- Member、Terms、Invitation 严格 Pilot Client 已分别以 `9ac03d8`、`310920e`、`5c3617a` 交付，保持原子提交。
- Terms Client 支持 bounded Document/Version directories 与 create document、create/update DRAFT、publish、retire；只发送冻结字段并严格解析 replay 证据。
- Invitation Client 支持 Platform/Channel/Tenant bounded list/create/revoke；canonical Channel/Tenant ID 必须显式传入，禁止由 Organization ID 猜测。
- 精确 DTO 与敏感字段 fail-closed 已覆盖 UUID、enum、count、email、digest、timestamp、nullable facts、Token replay；首次 Token 只存在当前调用方内存，replay 不恢复。
- 真实 Cookie、management `no-store`、安全错误 status/code/Request ID、Demo/Pilot 隔离保持不变；无 Mock/localStorage fallback。
- Pilot Client 定向 30/30、Root Build、ESLint、Prettier、Governance、diff-check PASS；StoryCanvas 与未跟踪 `byteplus.ts` 未修改。
- 状态推进到 `A_BIZ_06C_2_COMPLETE / READY_FOR_06C_3_TERMS_PAGE_RED`。

## 2026-08-10 · A-BIZ-06C Pilot Operations UI Closure

- 06C.3～06C.5 分别以 `226d1a8`、`649b3f6`、`ec3cb40` 交付 Terms、Invitation、Member 真实 Pilot 运营页；无 Demo/Mock/localStorage fallback。
- 06C.6 以共享提交 `26400fa` 激活 Terms、三类 Invitation、三类 Member 路由；Manifest/Policy 同时驱动 direct URL、returnTo、Sidebar、Router authorization 与 Topbar Project selector。
- Platform/Channel 默认继续 Commission Audit；Tenant 默认继续首个可见 Project Workbench。06C 运营页不要求 Project Context，跨 Scope 404、同 Scope缺角色 403、未认证回登录、未知路径 404。
- Terms 保持业务/法务正文边界；Invitation Token 仅首次当前内存态可见；Member 只实现 current Organization bounded list 与安全 suspend，不扩大角色/账号管理范围。
- 共享通知：B 修改 Route Policy、Router、Sidebar、Topbar 前必须先同步 `26400fa`。
- Gate：页面 37/37、Policy/Router 45/45、Build、ESLint、Prettier、Governance、diff-check PASS；并行全量 Vitest/Build 产生的既有 Demo timeout 已由受影响 4 files / 26 tests 串行 PASS 排除回归，但正式 full Gate 留在 06F。
- StoryCanvas tracked diff 为零，B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 未修改或暂存。
- 状态：`A_BIZ_06C_COMPLETE / PILOT_OPERATIONS_UI_READY / READY_FOR_06D_HARNESS_AUDIT`；未宣称 A-BIZ-06、Full Joint Gate、完整 IAM、正式 Terms 或 LIVE Operations 完成。

## 2026-08-10 · A-BIZ-06D Deterministic Pilot Browser E2E Plan Frozen

- 新增 `A_BIZ_06D_DETERMINISTIC_PILOT_BROWSER_E2E_PLAN.md`，冻结 06D.1～06D.7 原子顺序与首个数据库 guard RED。
- 源码审计确认现有 Playwright 仅为 Demo/localStorage smoke，缺真实 Session Cookie、Control API lifecycle、专用 PostgreSQL reset/seed 和 Pilot operations matrix。
- 冻结显式 `_test` database identity guard、每轮临时 Secret/账号、同源 Vite proxy、单 worker Playwright、失败诊断与安全 cleanup。
- Registration 只允许显式 test-only verification adapter；Terms digest mismatch 必须通过浏览器 RED 推动真实 SHA-256 重算；均不得外推为正式 Provider/Terms 上线。
- 06D 最低矩阵覆盖 Auth/Router、Terms/Invitation/Registration、Member、TEST Recharge/Commission/Settlement、跨组织 404 与敏感信息不泄漏。
- Joint Gate `pilot-browser-e2e` 仍保持 planned/BLOCKED，直到 06D.4～06D.6 真实 PASS；06E/06F 与 B external baseline 未推进。
- StoryCanvas tracked 文件与 B 的未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 继续排除；不 push。

## 2026-08-10 · A-BIZ-06D.1～06D.2 Dedicated DB Harness Complete

- `2f5131e` 完成 Pilot E2E 环境合同：显式 Harness flag、唯一 `_test` PostgreSQL 输入、开发库拒绝、实际 database identity 核对、loopback 端口与安全摘要。
- `4c05157` 完成 guarded reset、完整 19 migration、固定 Scope/业务 fixture、每轮临时凭据和 postcondition verify；CLI 不输出密码或 Token。
- 专用 `videoagent_control_test` 定向验证 `2 files / 14 tests PASS / 0 SKIP`；连续两轮 fingerprint 一致，`liveFactCount: 0`、`activeSessionCount: 0`。
- 未 seed LIVE、paid/提现、KYC、税务、发票或自动打款；Joint Gate `pilot-browser-e2e` 继续 `planned`/BLOCKED。
- StoryCanvas tracked diff 为零，B 的未跟踪 `byteplus.ts` 未修改或暂存；下一 RED 为 Public Terms digest mismatch fail-closed。
