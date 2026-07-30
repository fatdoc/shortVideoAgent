# C8 REQUESTS

> 使用 `docs/program/templates/REQUEST_TEMPLATE.md`。

## REQ-C8-001 · D1 能力状态与对外声明证据包

- 请求内容：请 C0 指定 C6/C7 在受控运行 Gate 提供逐页面、逐能力运行状态清单，并绑定 HTTP、真实消息序列、Outbox/ACK、browser playback、reset/wrong route 和 16 步彩排证据。
- 原因：C7 Round 3.1 已提供 Static evidence 并给出 `D1 STATIC GO`，但明确将运行证据标为 `BLOCKED_RUNTIME_EVIDENCE`；Static GO 不能证明完整黄金路径已经运行。
- 影响范围：演示讲稿、白皮书、招商材料、操作手册、版本说明和对外能力声明。
- 阻塞性：不阻塞内部 D1 Demo Pack 审阅；阻塞 Runtime PASS 和任何对外“已完整跑通/可交付”声明。
- 临时方案：内部材料并列展示 `D1 STATIC GO` 与 `BLOCKED_RUNTIME_EVIDENCE`；FALLBACK 使用 DEMO_ONLY 完整声明。
- 期望 Owner：C0 决策；C6 执行主持彩排；C7 提供运行验收；C4/C5 提供跨仓运行证据；C8 更新声明台账。
- 已收到：C7 Round 3.1 Static Gate；C5 canonical package/grant/task/asset/Outbox/FALLBACK 静态与既有媒体证据。
- 待补：实际 HTTP、request→grant→ready、wrong identity 拒绝、Outbox pending→delivered→ack、ACK-first apply、FALLBACK browser playback、reset/wrong route、16 步彩排。
- 状态：`PARTIALLY_RESOLVED_STATIC / BLOCKED_RUNTIME_EVIDENCE`
