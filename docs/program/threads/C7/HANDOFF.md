# C7 HANDOFF · D1 STATIC GATE ROUND 3.1

- 状态：`STATIC_GATE_GO / RUNTIME_EVIDENCE_PENDING`
- 运行配置：`gpt-5.6-sol / high / 1.5x`
- SaaS：`/Users/docfat/.codex/worktrees/4506/videoagent`
- StoryCanvas：`apps/storycanvas/`，来源提交 `46fc8d0`
- 报告：`docs/program/specs/C7_D1_STATIC_GATE_REVIEW.md`

## Gate

```text
P0=0
P1=0
P2=0
D1 STATIC GATE=GO
```

## REQ-C7-013

`CLOSED_STATIC`：

- grant-request 强制校验 canonical project/package。
- grant 响应显式携带同一 project/package。
- ready 强制校验同一 project/package；缺失或错值进入 error。
- origin/source/child window/current grant/内存传递边界保持。
- C5 同时校验顶层 identity 与 grant 内 identity。

## REQ-C7-014

`CLOSED_STATIC`：

- C5 Export payload 包含 C4 所需的 export/task/status/output/checksum/error/truth/tenant/project/package/idempotency/createdAt。
- `businessId=exportId=exportArtifactId`。
- payload 全部字段构造完成后才计算 digest 并 canonicalize 入 Outbox。
- FALLBACK、DEMO_ONLY、QA、rights 和媒体元数据扩展保留。
- C4 envelope 校验和 preflight 可以消费该 payload。

## BLOCKED_RUNTIME_EVIDENCE

仍需实际 HTTP、postMessage、错误 identity、Outbox delivery/ack、ACK failure 零入账和浏览器播放证据。这些不影响 Static GO，也不等同于运行 PASS。

本轮仅更新 C7 文档；未运行验证，未修改业务代码、公共合同、共同记忆或 StoryCanvas，未提交、合并或推送。
