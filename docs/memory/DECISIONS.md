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

## D-011 · 2026-07-26 · 插入 Wave 2.5 UI 忠实度纠偏

- 决策：Gate 3 前先完成 C1—C4 视觉纠偏，C5/C6 从一开始按原始图 5—6 实现
- 原因：用户指出现有 UI 与原始参考图不相符；C0 同尺寸审计确认是壳层、信息架构、密度和素材的结构性偏差
- 影响：C1-UI、C2-UI、C3-UI、C4-UI 六个独立 Codex 工作树任务；Gate 3 增加参考图对照验收
- 决策人：C0
- 证据：`docs/audits/ui-alignment-2026-07-26/AUDIT.md`

## D-012 · 2026-07-26 · 案例数据扩展顺序

- 决策：先冻结案例 / 项目视觉容器，再由 C0/C1 以 `CaseCatalog + DemoWorkspace` 扩展多案例数据
- 原因：避免 UI 结构和 Store 协议同时重构；业务页面不得各自创建案例 Mock
- 影响：后续 Dashboard、Brief、Brand、Script、Storyboard、Rough Cut 全部读取统一 activeCase
- 决策人：C0
- 证据：`docs/tasks/CASE_DATA_PLAN.md`
