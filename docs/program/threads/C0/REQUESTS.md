# C0 REQUESTS

> 使用 `docs/program/templates/REQUEST_TEMPLATE.md`。

## REQ-C0-001 · 授权 D1 运行证据 Gate

- 发起人：C0
- 目标 Owner：用户 / C0 / C7
- 请求内容：明确授权执行定向 test、build、lint、双仓本地服务、浏览器、1440x900/1280x720 视觉检查与 16 步彩排。
- 请求原因：当前只完成静态 Gate；运行事实不得由静态代码推断或冒充。
- 影响领域/文件：SaaS、StoryCanvas、C7 运行证据包与 Demo Pack。
- 是否阻塞：不阻塞 Static GO；阻塞 D1 最终运行 Gate。
- 临时方案：使用 C8 Demo Pack 讲解静态闭环，所有运行状态保持 `BLOCKED_RUNTIME_EVIDENCE`。
- 期望完成 Gate：D1 Runtime Gate
- C0 决策：待用户明确授权
- 决策日期：待定
- 状态：`OPEN`

## REQ-C0-002 · 冻结双仓可寻址候选

- 发起人：C0
- 目标 Owner：用户 / C0
- 请求内容：在运行 Gate 通过后，分别提交 SaaS 与 StoryCanvas 候选并记录完整 SHA、合同 digest 和版本对应。
- 请求原因：当前两个候选均为 detached 工作树加未提交增量，不能作为可复现发布版本。
- 影响领域/文件：两个仓库的 Git 历史与发布清单。
- 是否阻塞：不阻塞开发；阻塞可复现交付。
- 临时方案：以绝对路径和合同 digest 标识候选，不宣称已合并。
- 期望完成 Gate：D1 Release Candidate
- C0 决策：待运行 Gate 后执行
- 决策日期：待定
- 状态：`OPEN`
