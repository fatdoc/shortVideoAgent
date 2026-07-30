# C6 HANDOFF

- 状态：ROUND_3_UI_IMPLEMENTED / C7_STATIC_REVIEW_REQUIRED
- 基线：17ce 工作树 detached `HEAD` `8d847adaa4f25b3531f882c7c3a9453e58dff8ba`
- 分支/提交：detached `HEAD`；按任务要求未提交、未合并、未推送
- 已完成：`docs/program/specs/C6_D1_DEMO_EXPERIENCE_IMPLEMENTATION.md`
- 已完成内容：保留既有 C6 UI；Round 3 增量完成真实 active organization ID、Store handoff waiting/ready/timeout/error、Topbar reset result、generic project 安全拒绝、ACK 后 apply/零入账说明
- 未完成：C4 MASTER/LEVEL_2 actor Membership、C5 可播放 ExportArtifact 与双仓运行证据
- 合同版本：`INTEGRATION_CONTRACT.md` v0.1；本文不修改公共合同
- 影响范围：D1 SaaS Demo UI 与 C7 验收入口；未修改 StoryCanvas
- 风险：未运行 build/typecheck；当前 C4 fixture 对 MASTER/LEVEL_2 organization 没有有效 Membership，因此 Select 诚实禁用；真实 handoff/receipt 未运行
- 验证证据：静态路由/Store 调用/Truth 来源审计；未运行 test/build/lint/governance/browser
- Requests：`REQ-C6-001`—`REQ-C6-005`
- 下游第一步：C7 复核 active organization → dispatch → handoff ready → receipt ACK → wallet；C4 处理 `REQ-C6-005`
