# 决策日志 · DECISIONS

## D-001 · 2026-07-26 · 技术栈冻结

- 决策：React + TS + Vite + Antd + Zustand 等统一栈
- 原因：B 端效率与一致性
- 影响：全线程
- 决策人：C0

## D-002 · 2026-07-26 · 统一 Demo 项目

- 决策：全站只使用 `demo-local-001`
- 原因：保证跨页数据闭环可演示
- 影响：Mock / 所有业务页
- 决策人：C0

## D-003 · 2026-07-26 · Gate 0 只做骨架

- 决策：六页仅占位，不提前开发完整业务
- 原因：先冻结协议与所有权，避免并行冲突
- 影响：C2—C6 开工边界
- 决策人：C0

## D-004 · 2026-07-26 · 公共协议变更流程

- 决策：domain / mock / routes / theme 变更必须 REQUESTS → C0 → C1
- 原因：防止多线程协议漂移
- 影响：全线程
- 决策人：C0

## D-005 · 2026-07-26 · UI 参考图保留原名

- 决策：`UI/` 下 6 张图不改名、不改图
- 原因：避免丢失原始资产；映射写入 UI_REFERENCE_MAP
- 影响：文档与后续对照
- 决策人：C0

## D-006 · 2026-07-26 · LocalStorage Key

- 决策：`videoagent:mvp:v1`
- 原因：版本化，便于后续迁移
- 影响：storage / 测试
- 决策人：C0


## D-007 · 2026-07-26 · Gate 1 通过并合并 C1

- 决策：C1 `feat/c1-foundation` **APPROVE_MERGE**
- 原因：六路由/Store/LocalStorage/三态/测试/治理检查全部通过，无越权
- 影响：解锁 Wave2 并行 C2/C3/C4
- 决策人：C0
- 证据：`docs/tasks/GATE_1_REPORT.md`；功能 commit `8432b6b`

## D-008 · 2026-07-26 · C4 P0→P1 验收

- 决策：C4 `feat/c4-script-editor` **APPROVE_WITH_FOLLOWUPS** 并合入 `integration`
- 原因：A/B/C、五段编辑、事实引用、Mock 生成、保存与分镜入口均通过；两个非阻塞边界由 C0 在集成分支收口
- 影响：解锁 C5 消费统一 `activeScript`
- 决策人：C0
- 证据：功能 commit `6f1cf3e`；merge commit `1fa270b`；加固 commit `4cfba82`

## D-009 · 2026-07-26 · C2 / C3 验收并合入

- 决策：C2 `feat/c2-dashboard-brief` 与 C3 `feat/c3-brand-brain` **APPROVE_MERGE**
- 原因：页面主交互、统一 Mock、Store / LocalStorage、三态、定向测试与 1440×900 真机检查通过，无协议漂移
- 影响：完成 Wave 2 的 Dashboard、Brief 与品牌事实治理
- 决策人：C0
- 证据：C2 `7360286` / merge `c61de87`；C3 `8e17a03` / merge `9725e3f`

## D-010 · 2026-07-26 · Gate 2 通过

- 决策：Gate 2 **PASS（APPROVE_MERGE）**，`integration` 晋级 `main`
- 原因：C2/C3/C4 主交互可用，Brief→Brand→Script 数据一致；lint、build、43 tests、治理检查与 Chromium E2E 全部通过
- 影响：允许并行启动 C5 / C6，进入 Wave 3
- 决策人：C0
- 证据：`docs/tasks/GATE_2_REPORT.md`

## D-011 · 2026-07-30 · 商业核心调整为 AI 视频额度

- 决策：平台核心商品定义为 AI 视频额度，场景 Agent 作为产品包装和溢价来源。
- 影响：租户、产品、价格、钱包和演示叙事。
- 决策人：C0 / 用户确认。

## D-012 · 2026-07-30 · 采用双平面、双仓边界

- 决策：`videoagent` 承担商业 SaaS 控制平面，现有 StoryCanvas 承担媒体生产平面，先通过合同集成，不物理合仓。
- 影响：C4/C5 接口、代码所有权和路线图。
- 决策人：C0 / 用户确认。

## D-013 · 2026-07-30 · 员工体系升级为 C0—C8

- 决策：建立九个窗口；新增专职 C8 材料员工，并将 C5 定义为 StoryCanvas 负责人。
- 影响：项目治理、任务分配和线程记忆。
- 决策人：C0 / 用户确认。

## D-014 · 2026-07-30 · 建立项目级共同记忆

- 决策：新增 `docs/program/**` 作为当前权威顶层治理；旧 Gate 0—2 文档只作为历史证据保留。
- 影响：所有新窗口的必读顺序和决策优先级。
- 决策人：C0。
