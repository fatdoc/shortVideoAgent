# 00 · 先读这里（任何新窗口第一入口）

## 权威入口

2026-07-30 起，项目已从单一前端 Demo 治理升级为 C0—C8、单仓双平面协作的项目级治理。

新窗口首先阅读：`docs/program/README.md`。

## 两套资料的关系

- `docs/program/**`：当前顶层设计、共同记忆、员工招聘说明书和首轮任务书，具有项目级权威。
- 2026-08-06 起，`docs/collaboration/A_B_CO_CREATION_SPLIT_2026-08-06.md` 和 `docs/collaboration/A_ENGINEER_BUSINESS_DECISION_CORRECTION_2026-08-06.md` 是 A/B 共创的最新业务执行依据。
- `docs/memory/**`、`docs/agents/**`、`docs/prompts/**`、`docs/threads/**`、`docs/tasks/GATE_*`：原前端 Demo Gate 0—2 的历史治理和交付证据，继续保留。
- 历史文档与项目级共同记忆冲突时，以 `docs/program/COMMON_MEMORY.md`、上述 2026-08-06 纠偏决策和 C0 最新决策为准。历史“四类工作台”“企业/C 端分开”“三路注册”描述不得指导新开发。

## 当前项目

商业 SaaS 控制平面 + StoryCanvas 媒体生产平面。核心商品是 AI 视频额度，场景 Agent 是产品包装和溢价来源。

## 当前状态

- 历史前端 Gate 2：PASS。
- A-05 受控真实试点 v0 已进入真实 Control API、PostgreSQL 和 StoryCanvas 双平面开发，不再是纯前端交互 Demo。
- 当前目标：打通可真实登录、持久化、生成、导出和计量的受控黄金链路；未完成能力必须明确标记，不得用 Mock 冒充上线。

## 最新业务冻结（2026-08-06）

- 企业用户和个人用户共用一个 Tenant 模型、一套注册 API 和一个统一创作工作台。
- 直接注册自动创建单人 Tenant 和 `tenant_admin` Membership；增加企业资料或成员后原地成长，不迁移账号或数据。
- 平台邀请、代理邀请/分享和用户直接注册是三种获客来源，不是三个产品端。
- StoryCanvas 是统一创作工作台内部能力，不是独立用户端。

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
