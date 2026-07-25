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
