# C0 D1 Runtime Closeout

> 日期：2026-07-30
>
> 结论：`GO_FOR_INTERNAL_DEMO`
>
> 适用范围：老板内部演示、D1 deterministic Mock 闭环
>
> 不适用：生产发布、正式报价、真实 Provider/FireRed、品牌审批或生产安全认证

## 执行结论

D1 已从 `STATIC GO / RUNTIME_EVIDENCE_PENDING` 推进为可运行的内部演示闭环。SaaS 控制平面和 StoryCanvas 生产平面在真实 Chromium 中完成：

1. canonical package HTTP `201 accepted`。
2. `storycanvas:d1-grant-request → grant → ready`，父窗进入 `handoff_ready`。
3. StoryCanvas 只读加载 `demo-local-001`、script-a、C1—C8 与 8 镜。
4. shot-07 成功 Mock 形成 Task、Asset、Receipt；额度 `reserve 120 → consume 100 + release 20`。
5. shot-05 失败 Mock 无输出资产；额度 `reserve 80 → consume 0 + release 80`。
6. Task、Asset、Failure Task、Export 共 4 条回执全部 `acknowledged`。
7. wrong project 返回 `403 PROJECT_SCOPE_MISMATCH`。
8. Synthetic FALLBACK 在浏览器中实际播放，`readyState=4`、6 秒、540×960，SHA-256 与登记值一致。
9. reset 恢复 `DEMO_READY`、可用额度 1000、冻结额度 0。

## C0 决策

- D1 可用于内部老板演示。
- 继续固定 Truth：`MOCK-CONTRACT`、`FALLBACK / DEMO_ONLY / 非 REAL`。
- 不把本结论外推成真实 AI 能力、正式成片、品牌通过、生产凭证或上线批准。
- 人工 10—13 分钟主持彩排仍建议在正式会议前单独执行，但不阻塞代码提交。

## 权威证据

- `docs/program/specs/C7_D1_RUNTIME_GATE_REPORT.md`
- `docs/program/evidence/d1-runtime-evidence.json`
- `docs/program/evidence/d1-brand-1672x941.png`
- `docs/program/evidence/d1-brand-1440x900.png`
- `docs/program/evidence/d1-production-handoff-1440x900.png`
- `docs/program/evidence/d1-storycanvas-1440x900.png`
- `docs/program/evidence/d1-storycanvas-project-1280x720.png`
- `docs/program/evidence/d1-production-settled-1440x900.png`
