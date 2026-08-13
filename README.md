# 短视频营销 Agent

企业级 AI 短视频营销与媒体生产系统。当前仓库采用单仓、单一用户前端、双平面架构：

- 根目录：唯一 SaaS 前端，包含登录、角色、渠道、品牌、额度和内嵌 StoryCanvas。
- `apps/control-api/`：真实 Pilot 控制平面，包含 PostgreSQL、白名单认证、项目/脚本审批、Production Package 和 ProjectGrant。
- `apps/storycanvas/`：媒体生产平面，包含 v0.2 Package/Grant/Command/Receipt Receiver、任务、资产、时间线和导出运行时。

当前阶段是单客户、白名单、受控真实试点 v0，不是公开商业 SaaS。真实邀请、注册、用户须知以及 TEST 充值、Payment Inbox、佣金审计和 Settlement Draft 已进入受控 Pilot；LIVE 支付、真实佣金比例、paid Settlement、提现、KYC、税务、自动打款与完整媒体 Provider 执行仍未实现，未完成能力不得用 Mock 冒充上线。

## 项目介绍

短视频营销 Agent 是一个面向平台运营方、渠道代理商、个人创作者和企业内容团队的 AI 短视频营销系统。个人与企业不拆成两个产品端，统一使用 Tenant、Membership 和创作工作台。

项目的核心商业产品不是单一的视频编辑器，而是可销售、可分配、可计量的 AI 生成能力和使用额度。品牌大脑、本地生活营销、脚本策划、分镜生产和 StoryCanvas 画布共同组成业务场景，让通用模型 Token 变成个人或企业可以购买、代理商可以销售、平台可以运营的标准化产品。

### 解决的问题

- 平台需要统一管理 AI 产品、套餐、客户价格、额度和生产能力。
- 总代理、一级代理和二级代理需要发展客户、销售套餐并核算分佣。
- 企业客户需要沉淀品牌事实、门店资料、禁用词和内容规则，减少 AI 幻觉。
- 内容团队需要把 Brief、脚本、分镜、素材、视频任务和导出物串成完整生产流程。
- 财务与运营需要知道每次生成消耗了多少额度，失败任务是否释放，最终形成了哪些资产和回执。

### 三类工作台

| 工作台         | 主要用户                                             | 核心能力                                                                                           |
| -------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 平台管理工作台 | 平台管理员、运营、产品、财务、风控                   | 组织与渠道、产品套餐、能力配置、价格、额度和生产回执                                               |
| 渠道代理工作台 | 总代理、一级代理、二级代理、渠道销售                 | 邀请与分享、归因用户、渠道层级、佣金和客户服务状态                                                 |
| 统一创作工作台 | 个人创作者、企业老板、市场、内容、门店运营和剪辑人员 | 品牌大脑、Brief、脚本、分镜、StoryCanvas、任务、资产、时间线和导出；按 Membership 权限显示管理功能 |

终端用户只有一套账号、注册 API 和创作工作台。直接注册的用户自动获得一个单人 Tenant 和 `tenant_admin` Membership；完善企业资料或增加成员后，该 Tenant 原地成长为多人企业 Tenant，不迁移账号、不切换产品端。平台邀请、代理邀请/分享和直接注册只是三种获客来源，不是三个注册系统或三个用户端。StoryCanvas 是统一创作工作台内部的媒体生产能力，不是独立用户端。

### 核心业务流程

```text
平台配置产品、能力、价格和额度
          ↓
渠道代理获客、服务归因用户并销售产品
          ↓
个人或企业 Tenant 建立品牌事实、套餐、禁用词和人物 IP
          ↓
创建 Brief → 生成脚本 → 确认分镜生产单
          ↓
控制平面预留额度并签发项目级生产授权
          ↓
StoryCanvas 执行画布编排、生成任务、资产管理和导出
          ↓
任务与资产回执返回控制平面
          ↓
成功任务消费额度，失败任务释放额度
```

### 当前受控试点与演示资料

当前白名单开发和内部演示继续使用 `demo-local-001`，业务主体是海底捞火锅北京三里屯店。该资料只用于内部试点，不代表品牌对外授权。

当前已具备：

- 海底捞品牌资料、套餐、C1—C8 事实、禁用词、老板 IP、引用和风险提醒。
- 真实白名单登录、HttpOnly Session、Tenant/Project 隔离、Brief、版本化脚本和审批。
- PostgreSQL Production Package、短时 ProjectGrant、在线撤销/过期 introspection。
- StoryCanvas v0.2 Package/Grant/Command/Receipt 持久化接收、幂等和安全错误边界。
- 平台、渠道和统一创作工作台的 Demo 只读投影，以及海底捞黄金路径资料。
- 可播放的 `DEMO_ONLY FALLBACK` 视频，用于内部流程演示。

### 技术与产品边界

白名单认证、项目/脚本审批、Package/Grant、v0.2 Receiver、公开注册安全边界和 TEST 商业审计已进入真实服务端与数据库。所有 Payment/Commission/Settlement 事实仍只属于 TEST Pilot；Settlement 只允许 `TEST / draft / NON_QUOTE`，不是到账、paid、提现或自动打款。真实媒体 Provider smoke、完整 FFmpeg 成片、额度结算、云端监控和法律授权必须按各自 Gate 验收，不能从合同或 TEST 证据推导为已经上线。

## 多线程开发入口

**任何新窗口 / 新线程开工前，请先阅读：**

➡️ [docs/00_README_FIRST.md](./docs/00_README_FIRST.md)

## 两人协作入口

- [2026-08-06 A/B 共创开发分工（当前执行依据）](./docs/collaboration/A_B_CO_CREATION_SPLIT_2026-08-06.md)
- [给工程师 A：Wave 0 老板完整决策回复（实施依据）](./docs/collaboration/A_ENGINEER_WAVE0_BOSS_DECISION_REPLY_2026-08-06.md)
- [给工程师 A：企业/个人统一模型纠偏决策（立即生效）](./docs/collaboration/A_ENGINEER_BUSINESS_DECISION_CORRECTION_2026-08-06.md)
- [两人开发拆分方案](./docs/collaboration/TWO_PERSON_DEVELOPMENT_SPLIT.md)
- [媒体生产负责人交接手册](./docs/collaboration/DEVELOPER_B_HANDOFF_MANUAL.md)
- [媒体生产负责人首轮任务书](./docs/collaboration/DEVELOPER_B_FIRST_TASKS.md)

下一轮共创：工程师 A 负责企业/个人统一的创作工作台、真实 Tenant 与权限、单一注册流程、三种获客来源、邀请归因、用户须知、充值和代理提成；工程师 B 负责爆款合规复刻、批准脚本解析、分镜草案、画布持久化和真实媒体任务。

## 智能体总控交接

若需把整个项目交接给新的编码智能体，复制：

➡️ [docs/HANDOFF_TO_NEXT_AGENT.md](./docs/HANDOFF_TO_NEXT_AGENT.md)

## 快速启动

克隆完整仓库及 FireRed 子模块：

```bash
git clone --recurse-submodules https://github.com/fatdoc/shortVideoAgent.git
cd shortVideoAgent
```

安装和启动 SaaS：

```bash
npm install
npm run dev
```

`npm run dev` 已固定使用本地 `demo` 运行模式，不需要手工设置
`VITE_APP_MODE`。工程师 B 开发 StoryCanvas 时使用：

```bash
npm run dev:storycanvas
```

该命令仍只启动同一个 `5173` 根前端，并让现有
`/production/canvas/:projectId` 路由在开发环境直接挂载 StoryCanvas 编辑器；
不会额外启动第二套前端，也不会改变生产环境的授权校验。

安装 StoryCanvas 内部 API：

```bash
npm run storycanvas:install
```

启动 StoryCanvas 内部 API：

```bash
npm run storycanvas:api
```

使用两个终端分别运行 SaaS 和 StoryCanvas API。用户只访问 `http://127.0.0.1:5173/`；画布路由为 `/production/canvas/demo-local-001`，`10588` 不再提供独立用户界面。

常用命令：

```bash
npm run lint
npm run build
npm run test
npm run validate:governance
```

Wave 4 Joint Gate 入口：

```bash
npm run test:joint-gate:manifest
npm run test:joint-gate:plan
PILOT_E2E=true \
CONTROL_API_TEST_DATABASE_URL='<dedicated PostgreSQL database ending in _test>' \
node scripts/run-control-api-migration-gate.mjs
```

Migration rollback/reapply Gate 只允许 fresh、empty、专用 `_test` PostgreSQL，禁止回退到
`DATABASE_URL`，并在任何 destructive SQL 前校验 `current_database()`。它执行 001—019 fresh
forward、同批 rollback 和 deterministic reapply，结束后清理 Gate schema。缺少专用 PostgreSQL、真实浏览器、06E Golden Path 或已同步 B baseline 时，Full Joint Gate 必须报告 `BLOCKED`，不得以 SKIP 或 plan 输出冒充 PASS；日志和报告不得记录完整数据库 URL、用户名、密码、Token、Secret、SQL、stack 或内部 payload。

## 技术栈

React · TypeScript · Vite · Ant Design · React Router · Zustand · Node.js · Express · PostgreSQL · Knex · Zod · SQLite · FFmpeg · Vitest · Playwright · ESLint · Prettier

## 当前阶段

A-05 白名单真实试点 v0：跨平面合同 Gate 已通过；下一阶段进入业务平台注册/代理提成/用户须知与画布爆款复刻/脚本解析/分镜共创。公开商业发布、正式支付结算和真实 Provider 成片仍未完成。

## 统一 Demo 项目

- ID：`demo-local-001`
- 名称：海底捞火锅·北京三里屯店探店视频

## 目录速览

- `docs/` 共同记忆、职责、提示词、任务板
- `src/` 唯一前端源码，含 `src/features/storycanvas/` 画布模块
- `apps/storycanvas/` StoryCanvas 媒体生产 API 与引擎源码
- `UI/` UI 参考图（只读）
- `scripts/validate-governance.mjs` 治理完整性检查

StoryCanvas 来源、许可证和导入边界见：

- [StoryCanvas 源码并入记录](./apps/storycanvas/SOURCE_INTEGRATION.md)
- [单前端双平面整合决策](./docs/program/specs/C0_MONOREPO_INTEGRATION.md)
