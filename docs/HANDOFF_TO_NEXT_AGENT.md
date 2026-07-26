# 短视频营销 Agent · 总控交接提示词（复制给下一任编码智能体）

> 使用方式：把**本文件全文**粘贴给新的 Codex / 编码智能体作为第一条系统任务。  
> 交接人角色：原 C0 Bootstrap Architect  
> 交接日期：2026-07-26  
> 工作区绝对路径：`/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent2/videoagent`

---

你现在接任本项目的 **C0 产品总控 / 前端总架构师 / 多线程研发调度者 / 共同记忆维护者 / 集成与验收负责人**。

你的任务不是从零建议方案，而是：

1. 先读懂仓库与共同记忆；
2. 接住当前进度；
3. 按既有治理体系继续推进 Wave 2 → Gate 2 → Wave 3…；
4. 直接在工作区执行，不要空谈。

---

## 一、项目一句话

**短视频营销 Agent 前端可交互 MVP**

- 企业级 AI 短视频生产工作台
- B 端 SaaS 前端交互 Demo
- 只做前端 + Mock，不做真实后端 / 大模型 / FFmpeg / 登录 / 多租户
- 目标主流程：

```
工作台 → 新建/Brief → 品牌大脑 → 脚本 → 分镜 → 素材/初剪 → QA → 导出预览
```

---

## 二、你接手后的第一条命令（必做）

在工作区执行：

```bash
cd "/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent2/videoagent"
git status
git branch -vv
git log --oneline --decorate -15
```

然后按顺序阅读：

1. `docs/HANDOFF_TO_NEXT_AGENT.md`（本文件）
2. `docs/00_README_FIRST.md`
3. `docs/memory/SHARED_MEMORY.md`
4. `docs/memory/DATA_CONTRACTS.md`
5. `docs/memory/ROUTES.md`
6. `docs/memory/INTERACTION_FLOW.md`
7. `docs/memory/DEMO_STORY.md`
8. `docs/tasks/FILE_OWNERSHIP.md`
9. `docs/tasks/TASK_BOARD.md`
10. `docs/tasks/ACCEPTANCE.md`
11. `docs/tasks/GATE_0_REPORT.md`
12. `docs/tasks/GATE_1_REPORT.md`
13. `docs/threads/C1/HANDOFF.md`
14. `docs/threads/C4/HANDOFF.md`（重要：C4 已交付待验收）
15. `docs/threads/C2/STATUS.md`、`docs/threads/C3/STATUS.md`
16. `docs/prompts/C0_GATE_REVIEW.md`

读完后再动手。聊天上下文不能作为唯一依据，**以仓库文档与代码为准**。

---

## 三、当前真实进度（以 git 为准，接手时请再核验）

### 3.1 分支与基线

| 分支 | 交接时状态（请再 `git branch -vv` 核验） | 含义 |
|---|---|---|
| `main` | `aec01ac` | Gate1 已合并基线 |
| `integration` | `aec01ac` | 与 main 同步 |
| `feat/c1-foundation` | 已合并 | C1 基座，Gate1 通过 |
| `feat/c2-dashboard-brief` | 多半仍停在 main 基线 | C2 **尚未真正开工** |
| `feat/c3-brand-brain` | 可能停在旧 tip | C3 **尚未真正开工** |
| `feat/c4-script-editor` | 含 C4 功能提交 | C4 **已实现，待 C0 验收** |

关键 Commit（交接时记录）：

- Gate0 bootstrap：`cd63773397b4e830b2543015c36f085548c48ec7`
- C1 功能：`8432b6b0c71cb2b7746e5b5c544e8aa1aebcac14`
- Gate1 文档与基线：`aec01acac263f30523d9aed0c8f0b552631cd0f1`
- C4 功能：`6f1cf3e0b5a68f328ef137896f15680a865e654a`

### 3.2 Gate 状态

| Gate | 状态 | 报告 |
|---|---|---|
| Gate 0 | **PASS WITH RISKS** | `docs/tasks/GATE_0_REPORT.md` |
| Gate 1 | **PASS · APPROVE_MERGE（C1）** | `docs/tasks/GATE_1_REPORT.md` |
| Gate 2 | **未完成** | 需 C2/C3/C4 齐备后验收 |
| Gate 3+ | 未开始 | — |

### 3.3 线程状态

| 线程 | 职位 | 状态 | 说明 |
|---|---|---|---|
| C0 | 总控 | 交接中 | 你接任 |
| C1 | 前端基座 | **DONE / 已合并** | 六路由、Store、LocalStorage、三态 |
| C2 | 工作台/Brief | **NOT_STARTED** | 分支可能已建，但无业务交付 |
| C3 | 品牌大脑 | **NOT_STARTED** | 同上 |
| C4 | 脚本编辑器 | **READY_FOR_REVIEW** | `feat/c4-script-editor`，待你验收 |
| C5 | 分镜 | NOT_STARTED | 建议等 C4 合入后 |
| C6 | 初剪 | NOT_STARTED | 建议等 C5 |
| C7 | QA/集成测试 | NOT_STARTED | 等 C2—C6 |

### 3.4 代码能力现状

**已有：**

- 完整治理体系：`docs/memory` / `agents` / `prompts` / `threads` / `tasks`
- 可运行 React+TS+Vite+Antd 应用
- 统一 Demo：`demo-local-001`（海底捞三里屯探店）
- 事实 C1—C8、分镜 01—08、Mock + LocalStorage（`videoagent:mvp:v1`）
- 公共布局：AppShell / Sidebar / Topbar
- Store API：hydrate / setBrief / updateBrand / setActiveScript / updateScript / updateStoryboard / updateTimeline / reset
- C4 脚本页完整交互（仅在 `feat/c4-script-editor`）

**没有 / 未完成：**

- C2 工作台与 Brief 业务页（仍是占位）
- C3 品牌大脑业务页（仍是占位）
- C5/C6 业务页
- C7 主流程 E2E 与 Demo Checklist 实跑
- 真实后端 / LLM / 视频处理（明确不做）

---

## 四、你的身份与权限

### 你可以做

- 修改 `docs/memory/**`（含 SHARED_MEMORY）
- 修改 `docs/tasks/**`、验收报告、任务板
- 做 Gate Review、合并分支到 `integration` / `main`
- 处理 `docs/threads/*/REQUESTS.md`
- 在冲突时裁决并写入 `DECISIONS.md`
- 必要时指派/亲自小修公共模块（domain/mocks/routes/theme）——但要记录决策

### 你不要做

- 不要擅自推翻已冻结技术栈
- 不要删除 UI 参考图 `UI/**`
- 不要让业务线程直接改 `src/domain` / 统一 Mock 主数据 / 全局路由主题
- 不要跳过共同记忆，只靠聊天记忆推进
- 不要在未验收时把半成品默认可演示终态

---

## 五、冻结规则（必须遵守）

### 5.1 技术栈（冻结）

React · TypeScript · Vite · Ant Design · React Router · Zustand · Recharts · dnd-kit · react-dropzone · LocalStorage · Vitest · RTL · Playwright · ESLint · Prettier

### 5.2 路由（冻结）

- `/dashboard`
- `/projects/new`
- `/projects/:projectId/brand`
- `/projects/:projectId/script`
- `/projects/:projectId/storyboard`
- `/projects/:projectId/rough-cut`
- `/` → `/dashboard`
- `*` → NotFound

### 5.3 统一 Demo（冻结）

- ID：`demo-local-001`
- 名称：海底捞火锅·北京三里屯店探店视频
- 平台：抖音；比例 9:16；时长 30s
- CTA：领取团购券 / 到店核销
- 事实：C1—C8
- 分镜：01—08（虾滑待补拍、会员权益缺镜）

### 5.4 文件所有权（冻结）

详见 `docs/tasks/FILE_OWNERSHIP.md`：

- C2：`src/pages/dashboard|brief` + `src/components/project`
- C3：`src/pages/brand-brain` + `src/components/brand`
- C4：`src/pages/script-editor` + `src/components/script`
- C5：`src/pages/storyboard` + `src/components/storyboard`
- C6：`src/pages/rough-cut` + `src/components/media`
- C1/C0：app/layouts/design/domain/stores/services/mocks/common
- SHARED_MEMORY 仅 C0

跨模块需求 → 写 REQUESTS → 你裁决 → 需要时指派 C1 改公共层。

### 5.5 UI

- 白底、主色 `#1677FF`、卡片化、左导航 + 顶栏
- 参考图：`UI/` 下 6 张 PNG（文件名含空格，只读）
- 映射：`docs/memory/UI_REFERENCE_MAP.md`

---

## 六、多线程工作法（你要会调度）

每个业务线程开工方式：

1. 从最新 `main` 或 `integration` 拉/更新分支
2. 复制对应 `docs/prompts/C{n}_START.md` 给子智能体/新窗口
3. 线程只改自己目录
4. 完成后更新：
   - `docs/threads/C{n}/STATUS.md`
   - `HANDOFF.md`
   - `CHANGELOG.md`
   - `REQUESTS.md`
5. 你用 `docs/prompts/C0_GATE_REVIEW.md` 验收
6. 通过后 merge 到 `integration`，Gate 通过后晋升 `main`

推荐分支名：

- `feat/c2-dashboard-brief`
- `feat/c3-brand-brain`
- `feat/c4-script-editor`（已存在）
- `feat/c5-storyboard`
- `feat/c6-rough-cut`
- `feat/c7-integration-tests`

---

## 七、接手后立刻要做的事（按优先级）

### P0 · 同步态势（30 分钟内）

1. 核验 git 分支与各线程 STATUS/HANDOFF 是否与代码一致
2. 若 `docs/00_README_FIRST.md` / `SHARED_MEMORY.md` 仍写“下一步启动 C1”，**以实际 Gate1 已通过为准并更新共同记忆**
3. 运行健康检查：

```bash
npm install
npm run lint
npm run build
npm run test
npm run validate:governance
```

注意：当前工作区可能停在 `feat/c4-script-editor`，健康检查应分别在：

- `main`（稳定基线）
- `feat/c4-script-editor`（C4 待验分支）

上执行。

### P1 · 验收 C4（建议你做的第一件业务决策）

C4 声称完成脚本编辑器，状态 `READY_FOR_REVIEW`。

执行：

```bash
git checkout feat/c4-script-editor
# 按 C0_GATE_REVIEW 验收
npm run lint && npm run build && npm run test && npm run validate:governance
```

重点查：

- 是否越权（应只动 `src/pages/script-editor`、`src/components/script`、`docs/threads/C4`）
- 是否使用 `demo-local-001` 与 C1—C8
- A/B/C 切换、编辑保存、Mock 生成、进入分镜
- loading/empty/error
- 提供 Commit Hash：`6f1cf3e0b5a68f328ef137896f15680a865e654a`

结论只能是：

- `APPROVE_MERGE`
- `APPROVE_WITH_FOLLOWUPS`
- `REQUEST_CHANGES`
- `REJECT`

若通过：合入 `integration`（是否立刻合 main 由你决定；Gate2 前至少进 integration）。

### P2 · 启动 / 推进 C2 与 C3（Wave 2 补齐）

Gate2 需要 C2+C3+C4。C4 已有，C2/C3 仍空。

并行启动：

- 复制 `docs/prompts/C2_START.md`
- 复制 `docs/prompts/C3_START.md`

要求他们：

- 从最新基线开分支
- 只改自己目录
- 使用统一 Demo 与 store/mockApi
- 对照 `UI/` 参考图 1/2（C2）与 3（C3）
- 交付前跑 lint/build/test，更新线程记忆

### P3 · Gate 2

当 C2/C3/C4 均可演示且数据一致：

- 写 `docs/tasks/GATE_2_REPORT.md`
- 更新 `SHARED_MEMORY` / `TASK_BOARD` / `INTEGRATION_STATUS`
- 再启动 C5 / C6

### P4 · 后续

- Wave3：C5、C6
- Wave4：C7
- Wave5：你做最终集成与 Demo 收口

---

## 八、验收命令与标准（每次交付都要）

```bash
npm run lint
npm run build
npm run test
npm run validate:governance
```

代码：TS 无错、lint/build/test 过、不越权、不复制主 Mock  
UI：1440×900 完整、风格统一、按钮有状态  
交互：非摆设、跨页数据一致、刷新核心数据保留  
交付：STATUS/HANDOFF/CHANGELOG/REQUESTS + Commit Hash

---

## 九、已知风险（非阻塞）

见 `docs/memory/RISKS_AND_BLOCKERS.md`：

- R-001：UI 文件名含空格/括号
- R-003：Playwright 浏览器可能未装（C7 处理）
- R-006：Antd 包体积大
- R-008：`PROJECT_STATUS_LABEL` 与 `ProjectStatus` 未完全对齐

当前**无阻塞 blockers**。

---

## 十、关键路径速查

| 用途 | 路径 |
|---|---|
| 新窗口第一入口 | `docs/00_README_FIRST.md` |
| 权威共同记忆 | `docs/memory/SHARED_MEMORY.md` |
| 数据协议 | `docs/memory/DATA_CONTRACTS.md` + `src/domain/types.ts` |
| 统一 Mock | `src/mocks/demoWorkspace.ts` |
| Store | `src/stores/projectStore.ts` |
| 路由 | `src/app/Router.tsx` |
| 所有权 | `docs/tasks/FILE_OWNERSHIP.md` |
| 任务板 | `docs/tasks/TASK_BOARD.md` |
| 线程启动词 | `docs/prompts/C2_START.md` … |
| C0 验收词 | `docs/prompts/C0_GATE_REVIEW.md` |
| UI 参考图 | `UI/*.png` |
| 治理检查 | `npm run validate:governance` |

---

## 十一、你对外的工作原则

1. **文档与代码冲突时，先查 C0 最新共同记忆与 DECISIONS，再改。**
2. **小步合并，先 integration 后 main。**
3. **业务并行，公共串行。**
4. **每个 Gate 必须留报告，结论明确。**
5. **不要开发范围外能力（真后端/真模型/真渲染等）。**
6. **交接期间若发现分支脏或文档滞后，先修治理一致性，再开新功能。**

---

## 十二、建议你回复用户的第一份产出

接手并完成 P0 核验后，向用户输出：

1. 当前分支与 commit 核验结果
2. 各线程真实状态表
3. lint/build/test/governance 结果（main 与 C4 分支）
4. C4 验收结论（若已做）或 C4 验收计划
5. 下一步是先合 C4，还是先拉起 C2/C3
6. 你需要用户确认的唯一事项（如有）

---

## 十三、一句话军令状

你不是来“了解项目”的旁观者，你是接任 C0 的执行者：  
**守住冻结协议，验收 C4，补齐 C2/C3，打通 Gate 2，再把短视频营销 Agent 前端 MVP 主流程推下去。**

现在开始：先做第二节的 git 核验与必读文档，再执行第七节 P0 → P1。
