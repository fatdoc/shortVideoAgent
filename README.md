# 短视频营销 Agent 前端可交互 MVP

企业级 AI 短视频生产工作台的前端可交互 Demo。  
当前阶段只做前端 + Mock 数据，不接入真实后端与大模型。

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

```bash
npm install
npm run dev
```

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
- `UI/` UI 参考图（只读）
- `scripts/validate-governance.mjs` 治理完整性检查
