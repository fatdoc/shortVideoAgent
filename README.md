# 短视频营销 Agent

企业级 AI 短视频营销与媒体生产 Demo。当前仓库采用单仓双应用：

- 根目录：SaaS 控制平面、登录、角色、渠道、品牌和额度演示。
- `apps/storycanvas/`：StoryCanvas 画布、任务、资产、时间线和导出。

当前仍以内部 Demo 为目标，不宣称生产级认证、真实 AI、正式计费或商业发布。

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

安装和启动 SaaS：

```bash
npm install
npm run dev
```

安装 StoryCanvas：

```bash
npm run storycanvas:install
```

分别启动 StoryCanvas API 和画布前端：

```bash
npm run storycanvas:api
npm run storycanvas:web
```

建议使用三个终端分别运行 SaaS、StoryCanvas API 和 StoryCanvas Web。

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
- `src/` 前端源码
- `apps/storycanvas/` 完整 StoryCanvas 画布与媒体生产源码
- `UI/` UI 参考图（只读）
- `scripts/validate-governance.mjs` 治理完整性检查

StoryCanvas 来源、许可证和导入边界见：

- [StoryCanvas 源码并入记录](./apps/storycanvas/SOURCE_INTEGRATION.md)
- [单仓双应用整合决策](./docs/program/specs/C0_MONOREPO_INTEGRATION.md)
