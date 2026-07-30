# 00 · 先读这里（任何新窗口第一入口）

## 权威入口

2026-07-30 起，项目已从单一前端 Demo 治理升级为 C0—C8、双仓协作的项目级治理。

新窗口首先阅读：`docs/program/README.md`。

## 两套资料的关系

- `docs/program/**`：当前顶层设计、共同记忆、员工招聘说明书和首轮任务书，具有项目级权威。
- `docs/memory/**`、`docs/agents/**`、`docs/prompts/**`、`docs/threads/**`、`docs/tasks/GATE_*`：原前端 Demo Gate 0—2 的历史治理和交付证据，继续保留。
- 历史文档与项目级共同记忆冲突时，以 `docs/program/COMMON_MEMORY.md` 和 C0 最新决策为准。

## 当前项目

商业 SaaS 控制平面 + StoryCanvas 媒体生产平面。核心商品是 AI 视频额度，场景 Agent 是产品包装和溢价来源。

## 当前状态

- 历史前端 Gate 2：PASS。
- 项目级 Program Gate T0：已建立治理骨架，等待分批启动 C1—C8。
- 当前目标：先完成老板可顺畅演示的端到端 Demo，再进入商业 MVP。

## 新窗口强制运行配置

每一个新开的 C0—C8 数字员工窗口统一使用：

- 模型：`gpt-5.6-sol`
- 推理强度：`high`
- 运行速度：`1.5x`

启动窗口时必须在任务提示词中明确写出以上配置。未经 C0 或用户明确批准，不得自行更换模型、调整推理强度或改变运行速度。

## 严禁

- 删除或重建既有成果。
- 直接物理合并两个仓库。
- 将上游 API Key 下发给客户或前端。
- 跨员工边界直接修改。
- 只依赖聊天上下文，不更新共同记忆。

## 旧前端本地命令

```bash
npm install
npm run dev
npm run lint
npm run build
npm run test
npm run validate:governance
```
