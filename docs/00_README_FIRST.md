# 00 · 先读这里（任何新窗口第一入口）

## 1. 这是什么项目

**短视频营销 Agent 前端可交互 MVP**

- 企业级 AI 短视频生产工作台
- B 端 SaaS 前端交互 Demo
- 演示完整业务流：工作台 → Brief → 品牌大脑 → 脚本 → 分镜 → 素材/初剪 → QA → 导出
- 当前只做前端 + Mock，不做真实后端 / 大模型 / 视频渲染

## 2. 当前 Gate

**Gate 2：PASS（2026-07-26）**

C2 工作台 / Brief、C3 品牌大脑、C4 脚本编辑器已完成验收并合入；统一 Demo 数据可从 Brief 贯通品牌与脚本。
下一阶段为 Wave 3：并行推进 C5 分镜与 C6 素材 / 初剪，并准备 Gate 3。

## 3. 新线程开始前必须阅读

按顺序阅读：

1. `docs/00_README_FIRST.md`（本文件）
2. `docs/memory/SHARED_MEMORY.md`
3. `docs/memory/DATA_CONTRACTS.md`
4. `docs/memory/ROUTES.md`
5. `docs/memory/FILE_OWNERSHIP.md`（见 tasks）/ `docs/tasks/FILE_OWNERSHIP.md`
6. `docs/agents/C{n}_ROLE.md`（自己的职责）
7. `docs/prompts/C{n}_START.md`（自己的启动提示词）
8. 上游线程 `docs/threads/C{x}/HANDOFF.md`
9. `docs/tasks/TASK_BOARD.md`

## 4. 共同记忆在哪里

`docs/memory/`

- `SHARED_MEMORY.md`（权威，仅 C0 可改）
- `PRODUCT_SCOPE.md`
- `DEMO_STORY.md`
- `ARCHITECTURE.md`
- `ROUTES.md`
- `DATA_CONTRACTS.md`
- `INTERACTION_FLOW.md`
- `MOCK_DATA.md`
- `UI_REFERENCE_MAP.md`
- `DECISIONS.md`
- `RISKS_AND_BLOCKERS.md`
- `INTEGRATION_STATUS.md`

## 5. 职责文件在哪里

`docs/agents/C0_ROLE.md` … `docs/agents/C7_ROLE.md`

## 6. 启动提示词在哪里

`docs/prompts/C1_START.md` … `docs/prompts/C7_START.md`  
验收提示词：`docs/prompts/C0_GATE_REVIEW.md`

## 7. 状态文件在哪里

每个线程：

- `docs/threads/C{n}/STATUS.md`
- `docs/threads/C{n}/HANDOFF.md`
- `docs/threads/C{n}/CHANGELOG.md`
- `docs/threads/C{n}/REQUESTS.md`

## 8. 哪些文件不能随便改

- `docs/memory/SHARED_MEMORY.md`：仅 C0
- `src/domain/**`：仅 C0 / C1（业务线程通过 REQUESTS）
- 统一 Mock 主数据 `src/mocks/demoWorkspace.ts`：仅 C0 / C1
- 全局路由 / 主题：仅 C0 / C1
- `UI/**` 参考图：只读，禁止修改
- 其他线程目录与代码：禁止越权

详见 `docs/tasks/FILE_OWNERSHIP.md`

## 9. 当前下一步

1. 以 Gate 2 后的 `main` / `integration` 为统一基线
2. 并行启动 C5 与 C6；C5 消费 `activeScript`，C6 消费统一 storyboard / assets / timeline
3. 完成脚本→分镜→初剪数据闭环后执行 Gate 3
4. 验收结论见 `docs/tasks/GATE_2_REPORT.md`

## 10. C0 如何验收

使用 `docs/prompts/C0_GATE_REVIEW.md`，检查：

- 是否越权
- 是否符合数据协议
- 是否使用统一 Mock
- 微交互 / loading / empty / error
- lint / typecheck / test / build
- HANDOFF / Commit Hash
- 是否允许合并

## 本地命令

```bash
npm install
npm run dev
npm run lint
npm run build
npm run test
npm run validate:governance
```
