# 短视频营销 Agent · 项目级治理入口

> 本目录是 2026-07-30 起 C0—C8 的权威顶层设计与共同记忆。旧的 `docs/agents`、`docs/prompts`、`docs/threads` 和 Gate 0—2 报告继续作为前端 Demo 历史证据，不删除、不覆盖。

## 新窗口必读顺序

1. `docs/program/PROJECT_CHARTER.md`
2. `docs/program/COMMON_MEMORY.md`
3. `docs/program/GLOSSARY.md`
4. `docs/program/ARCHITECTURE.md`
5. `docs/program/ROLE_BOUNDARIES.md`
6. `docs/program/ROLE_WORKBENCHES.md`
7. `docs/program/EMPLOYEE_RULES.md`
8. `docs/program/AUTONOMY_PROTOCOL.md`
9. `docs/program/REPOSITORY_MAP.md`
10. `docs/program/INTEGRATION_CONTRACT.md`
11. `docs/program/A05_MULTI_WINDOW_TOP_LEVEL_DESIGN.md`
12. `docs/program/A05_OPEN_SOURCE_FIRST_POLICY.md`
13. 自己的 `docs/program/employees/C{n}_RECRUITMENT.md`
14. 自己的 `docs/program/missions/C{n}_FIRST_MISSION.md`
15. 自己的 `docs/program/threads/C{n}/STATUS.md` 与上游 HANDOFF

## 新窗口强制运行配置

- 模型：`gpt-5.6-sol`
- 推理强度：`high`
- 运行速度：`1.5x`

所有 C0—C8 新窗口都必须使用这套配置。C0 下发启动提示词时必须再次声明；员工开始工作前必须在首次状态报告中确认。未经 C0 或用户明确批准，不得自行变更。

## 权威性

- `COMMON_MEMORY.md`：项目事实源，仅 C0 修改。
- `DECISION_RIGHTS.md`：决策权限和升级路径。
- `ROLE_BOUNDARIES.md`：C0—C8 边界与 RACI。
- `ROLE_WORKBENCHES.md`：不同组织和角色对应的工作台、菜单和数据范围。
- `AUTONOMY_PROTOCOL.md`：正式启动后 C0 的自主调度权限和必须向用户升级的事项。
- `INTEGRATION_CONTRACT.md`：SaaS 控制平面与 StoryCanvas 生产平面的共同合同。
- `threads/C{n}`：该员工自己的执行记忆；其他员工只读。
- 发生冲突时：C0 最新决策 > 项目级共同记忆 > 集成合同 > 员工任务书 > 历史 Gate 文档 > 聊天上下文。

## 当前阶段

`A-05：单客户白名单真实试点 v0 已启动，按多窗口任务 DAG 执行。`

同时最多运行 P0 + 一个 A 窗口 + 一个 B 窗口 + 一个 F/Q 窗口。具体节点、依赖、文件所有权和 Gate 以 `A05_MULTI_WINDOW_TOP_LEVEL_DESIGN.md` 为准。
