# 短视频营销 Agent

企业级 AI 短视频营销与媒体生产 Demo。当前仓库采用单仓、单一用户前端、双平面架构：

- 根目录：唯一 SaaS 前端，包含登录、角色、渠道、品牌、额度和内嵌 StoryCanvas。
- `apps/storycanvas/`：内部媒体生产 API、任务、资产、时间线和导出运行时。

当前仍以内部 Demo 为目标，不宣称生产级认证、真实 AI、正式计费或商业发布。

## 项目介绍

短视频营销 Agent 是一个面向平台运营方、渠道代理商、企业客户和内容制作团队的 AI 短视频营销系统。

项目的核心商业产品不是单一的视频编辑器，而是可销售、可分配、可计量的 AI 生成能力和使用额度。品牌大脑、本地生活营销、脚本策划、分镜生产和 StoryCanvas 画布共同组成业务场景，让通用模型 Token 变成企业可以购买、代理商可以销售、平台可以运营的标准化产品。

### 解决的问题

- 平台需要统一管理 AI 产品、套餐、客户价格、额度和生产能力。
- 总代理、一级代理和二级代理需要发展客户、销售套餐并核算分佣。
- 企业客户需要沉淀品牌事实、门店资料、禁用词和内容规则，减少 AI 幻觉。
- 内容团队需要把 Brief、脚本、分镜、素材、视频任务和导出物串成完整生产流程。
- 财务与运营需要知道每次生成消耗了多少额度，失败任务是否释放，最终形成了哪些资产和回执。

### 四类工作台

| 工作台 | 主要用户 | 核心能力 |
|---|---|---|
| 平台管理工作台 | 平台管理员、运营、产品、财务、风控 | 组织与渠道、产品套餐、能力配置、价格、额度和生产回执 |
| 渠道代理工作台 | 总代理、一级代理、二级代理、渠道销售 | 可售产品、企业客户、渠道层级、客户用量和服务状态 |
| 企业客户工作台 | 企业老板、市场、内容和门店运营 | 品牌大脑、Brief、脚本、分镜、任务、资产和交付 |
| 媒体生产工作台 | 策划、分镜师、视频制作和审核人员 | 生产包、StoryCanvas、生成任务、媒体资产、时间线和导出 |

### 核心业务流程

```text
平台配置产品、能力、价格和额度
          ↓
渠道代理销售产品并服务企业客户
          ↓
企业建立品牌事实、套餐、禁用词和人物 IP
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

### 当前统一 Demo

当前演示项目为 `demo-local-001`，业务主体是海底捞火锅北京三里屯店。Demo 覆盖：

- 海底捞品牌资料、套餐、C1—C8 事实、禁用词、老板 IP、引用和风险提醒。
- 平台、渠道、企业和媒体生产四种登录身份。
- Brief、脚本、分镜、生产交接、成功任务、失败任务、资产和导出。
- 额度预留、成功消费、失败释放和回执确认。
- SaaS 与 StoryCanvas 之间的 package、project-scoped grant 和 receipt 合同。
- 可播放的 `DEMO_ONLY FALLBACK` 视频，用于内部流程演示。

### 技术与产品边界

当前版本采用前端 + Mock + LocalStorage 完成老板演示闭环。登录、角色、额度、价格和生产状态可以演示，但不能作为真实资金、正式认证或生产安全证据。

真实商业上线仍需要补充服务端身份认证、RBAC、多租户隔离、数据库、支付结算、供应商密钥管理、任务队列、对象存储、监控和法律授权。

## 多线程开发入口

**任何新窗口 / 新线程开工前，请先阅读：**

➡️ [docs/00_README_FIRST.md](./docs/00_README_FIRST.md)

## 两人协作入口

- [两人开发拆分方案](./docs/collaboration/TWO_PERSON_DEVELOPMENT_SPLIT.md)
- [媒体生产负责人交接手册](./docs/collaboration/DEVELOPER_B_HANDOFF_MANUAL.md)
- [媒体生产负责人首轮任务书](./docs/collaboration/DEVELOPER_B_FIRST_TASKS.md)

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

## 技术栈

React · TypeScript · Vite · Ant Design · React Router · Zustand · Recharts · dnd-kit · react-dropzone · LocalStorage · Vitest · Playwright · ESLint · Prettier

## 当前阶段

D2：内部 Demo 的登录、角色工作台、控制平面与媒体生产闭环。当前仍为前端 + Mock，不代表生产级认证、真实 AI 或正式结算。

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
