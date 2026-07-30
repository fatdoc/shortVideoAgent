# C7 REQUESTS

> 使用 `docs/program/templates/REQUEST_TEMPLATE.md`。

## REQ-C7-001 · 冻结可执行跨仓合同套件

- 发起人：C7
- 目标 Owner：C4 / C5；公共合同变更由 C0 批准
- 请求内容：联合交付 `INTEGRATION_CONTRACT.md v0.1` 的可执行 Schema、canonical fixtures、项目令牌 claims/校验向量、ProjectProductionPackage/GenerationTaskReceipt/AssetReceipt 正反例、ID 映射、幂等/冲突/标准错误和回执传输方式。
- 请求原因：当前公共合同定义语义字段，但尚不能支撑稳定的 producer/consumer 合同测试。
- 影响领域/文件：控制平面 Adapter、StoryCanvas Adapter、合同测试、双仓版本清单；如需修改公共合同必须由 C4/C5 联合提案、C0 写入。
- 是否阻塞：是；阻塞 D1 双仓 Gate。
- 临时方案：C7 v0.1 只定义测试意图，不编写依赖未冻结字段的脆弱实现测试。
- 期望完成 Gate：D1 集成实现开始前
- C0 决策：待定
- 决策日期：待定
- 状态：`BLOCKED_RUNTIME_EVIDENCE`
- D1 Static Gate 第二轮复核：Schema、canonical fixtures 与 negative vectors 已出现，C5 duplicate 已改为 grant-first；但没有可执行合同测试，Package response wrapper 及 Receipt Header/Envelope/status 仍未对齐。
- D1 Static Gate Round 3.1：Package、Grant、GenerationTask/Asset/Export receipt 的静态 producer/consumer 接缝已对齐；可执行合同套件和实际正反例转入运行证据，不再阻塞 Static Gate。

## REQ-C7-002 · 交付唯一 D1 商业与额度 fixture

- 发起人：C7
- 目标 Owner：C2 / C3 / C4
- 请求内容：交付唯一 `demo-local-001` Product/Capability/Entitlement/演示 RateCard/Wallet/CreditLedger fixture，并给出成功任务“冻结 120、消费 100、释放 20”和失败任务“冻结 80、消费 0、释放 80”的 reservation、posting group、幂等和余额重建预期。
- 请求原因：没有单一预期值时，四工作台和跨平面回执可能各造一套状态，无法完成商业对账。
- 影响领域/文件：D1 Demo Adapter、平台/企业额度页、任务/资产回执、C7 额度测试。
- 是否阻塞：是；阻塞 D1 商业闭环。
- 临时方案：只使用 C0 批准的演示样例，所有数字标记“演示数据 · 非正式报价”，不推导真实价格。
- 期望完成 Gate：D1
- C0 决策：待定
- 决策日期：待定
- 状态：`CLOSED_STATIC`
- D1 Static Gate 复核：权威 fixture、C4 append-only Ledger 及 120/100/20、80/0/80 预期均可静态确认；仍须运行证据，不能记为 Gate PASS。

## REQ-C7-003 · 交付确定性生产、资产与导出证据接口

- 发起人：C7
- 目标 Owner：C5
- 请求内容：提供同一海底捞项目的确定性成功/失败任务、统一 MediaAsset 登记、GenerationTaskReceipt/AssetReceipt Outbox、基础合并 ExportArtifact、checksum、权利/审核状态和 Capability Truth Manifest。
- 请求原因：没有媒体事实，额度变化、QA 和可播放交付无法形成证据闭环。
- 影响领域/文件：StoryCanvas 任务/资产/导出、C7 双仓/E2E/失败场景验收。
- 是否阻塞：是；阻塞 D1。
- 临时方案：允许明确标识的 Demo Provider + FFmpeg 基础合并；不得冒充完整 FireRed AI 剪辑。
- 期望完成 Gate：D1
- C0 决策：待定
- 决策日期：待定
- 状态：`CLOSED_STATIC / BLOCKED_RUNTIME_EVIDENCE`
- D1 Static Gate 第二轮复核：Task/Asset/Outbox/FALLBACK 静态接口和 C5 `pending → delivered → acknowledged/retry` 已存在；但 C4/C5 transport 不兼容，且可播放 ExportArtifact、shot-05 补拍、权利证据和 QA passed 未关闭。
- D1 Static Gate Round 3：可播放 Synthetic FALLBACK、shot-05 repair、权利声明、technical QA 和 Export Outbox 已实现；但 Export Outbox payload 不符合 C4 ExportReceipt 合同，故 Request 总体保持 OPEN。实现部分不再是“不可播放”P0。
- D1 Static Gate Round 3.1：ExportReceipt payload 已对齐，Request 静态关闭；实际播放、Outbox delivery/ack 和来源链转入运行证据。

## REQ-C7-004 · 冻结 D1 真实性标识与视觉基线

- 发起人：C7
- 目标 Owner：C6；C4/C5 提供能力事实
- 请求内容：冻结全局状态条、按钮级标识、结果/导出说明、1440×900 与 1280×720 关键页面基线，以及 HYBRID 模式对 UI/transport/provider/persistence/billing 的分解字段。
- 请求原因：页面文案不足以保证四工作台和生产平面对真实/Mock 能力的表达一致。
- 影响领域/文件：D1 Shell、产品/任务/资产/导出页面、Capability Truth Manifest、视觉证据。
- 是否阻塞：是；阻塞 D1 真实性和视觉 Gate。
- 临时方案：采用 C7 v0.1 的 Truth Manifest 结构，不由 C7 创造能力事实。
- 期望完成 Gate：D1
- C0 决策：待定
- 决策日期：待定
- 状态：`BLOCKED_RUNTIME_EVIDENCE`
- D1 Static Gate 复核：Truth Manifest、全局状态条和部分按钮标识存在；1440×900、1280×720 视觉、交互与结果真实性证据尚未执行。

## REQ-C7-005 · 裁决 C4 早期组织表述与已批准语义冲突

- 发起人：C7
- 目标 Owner：C0 / C4；C1 会签
- 请求内容：在 C4 下一版或批准记录中明确 Platform、ChannelOrganization、Tenant 的独立关系，废止“Organization 必须属于一个 Tenant”的早期表述，并明确项目令牌中 `organizationId` 的 D1 含义。
- 请求原因：该表述与 C1 规格及 C0 会签冲突，若进入实现会造成渠道与 Tenant 边界错误。
- 影响领域/文件：控制平面 Schema、权限、Package 上下文、项目令牌和四工作台。
- 是否阻塞：不阻塞 C7 文档评审；阻塞相关控制平面实现和 D1 正式合同证据。
- 临时方案：验收按 C1 + C0 会签执行；旧 C4 表述不得作为通过依据。
- 期望完成 Gate：D1 集成实现开始前
- C0 决策：待定
- 决策日期：待定
- 状态：`CLOSED_STATIC`
- D1 Static Gate 复核：COMMON_MEMORY 第 14 条及当前 C4/C5 Schema 已按 Platform、ChannelOrganization、Tenant 独立语义实现；运行权限证据仍另行验收。

## REQ-C7-006 · 禁止生产包自行伪造脚本批准态

- 发起人：C7
- 目标 Owner：C2 / C4 / C6
- 请求内容：建立可持久、可审计的脚本批准动作和批准版本引用；保存失败、风险阻断或未批准脚本不得发包。`buildProjectProductionPackage()` 不得自行写入批准状态、批准人或批准时间。
- 请求原因：当前 SaaS 从活动脚本构包时无条件盖章 `approved`，而脚本页没有批准态持久化，可能把未批准或阻断脚本包装成 canonical approved script。
- 影响领域/文件：脚本状态、分镜发包、ProjectProductionPackage、黄金路径第 7—9 步。
- 是否阻塞：是；P0，阻塞 D1 商业语义和合同 Gate。
- 临时方案：无；不得用主持人口径替代批准证据。
- 期望完成 Gate：D1 Static Gate 重审前
- C0 决策：待定
- 决策日期：待定
- 状态：`CLOSED_STATIC`
- D1 Static Gate 第二轮复核：`buildProjectProductionPackage()` 必须接收并校验 ScriptApproval；approve/revoke/block 持久化、script digest、blocked/未批准/事实风险门禁和显式 UI 均可静态确认。仍需运行证据，不代表 Gate PASS。

## REQ-C7-007 · 原子重置 DemoWorkspace 与 C4 Store

- 发起人：C7
- 目标 Owner：C4 / C6
- 请求内容：让统一项目、生产包、grant、任务/资产回执、Wallet/Ledger 和 Truth 状态原子恢复 `DEMO_READY`；任一部分失败时必须显示失败，不得提示重置成功。
- 请求原因：第二轮已建立带 checkpoint/rollback 的统一 reset transaction；但 `projectStore.reset()` 不传播 `DemoExperienceResetResult`，Topbar await 后仍固定提示两边已恢复，失败可被 success toast 粉饰。
- 影响领域/文件：项目 Store、C4 Store、Topbar、一键重置和 15 秒恢复证据。
- 是否阻塞：是；P0，阻塞现场稳定性 Gate。
- 临时方案：无；手工刷新不能作为一键重置证据。
- 期望完成 Gate：D1 Static Gate 重审前
- C0 决策：待定
- 决策日期：待定
- 状态：`CLOSED_STATIC / BLOCKED_RUNTIME_EVIDENCE`
- D1 Static Gate 第二轮复核：事务 reset 静态实现已关闭；全局错误提示与 15 秒运行证据仍开放。
- D1 Static Gate Round 3：Project Store 已返回 `DemoExperienceResetResult`；Topbar 只在 `result.ok` 时 success，失败显示 error/rollback 状态。静态问题关闭；失败注入和 15 秒恢复待运行证据。

## REQ-C7-008 · 接通单一跨仓发包与回执传输

- 发起人：C7
- 目标 Owner：C4 / C5 / C6
- 请求内容：保持已对齐的 Package Envelope、current grant、GenerationTask/Asset ACK-first；收敛剩余两个接缝：grant request/grant/ready 三类 postMessage 的 project/package identity，以及 C5 Export Outbox 与 C4 ExportReceipt payload。
- 请求原因：Round 3 已关闭 Package 解包、单 Header、delivered Envelope 和 ACK 失败零入账；但 C4 grant 消息缺 project/package，C5 Export payload 又缺 C4 必需字段，双仓仍不能完成完整 handoff + Export receipt。
- 影响领域/文件：C4/C5 Adapter、C6 StoryCanvas 入口、Package attempts、Receipt Outbox、CreditLedger。
- 是否阻塞：是；P0，阻塞 P0-05、P0-06 和双仓闭环。
- 临时方案：包检查器可用于解释断点，但不得宣称已接线。
- 期望完成 Gate：D1 Static Gate 重审前
- C0 决策：待定
- 决策日期：待定
- 状态：`CLOSED_STATIC / BLOCKED_RUNTIME_EVIDENCE`
- D1 Static Gate 第二轮复核：C5 Outbox 状态机已存在；上述四个接缝均可从静态代码直接确认不兼容。
- D1 Static Gate Round 3：Request 收敛为 `REQ-C7-013` 与 `REQ-C7-014` 两个 OPEN P0。
- D1 Static Gate Round 3.1：REQ-C7-013/014 均静态关闭；实际 HTTP、postMessage、ACK 和 apply 转入运行证据。

## REQ-C7-009 · 对齐双仓 current grant 与显式授权校验

- 发起人：C7
- 目标 Owner：C4 / C5；C6 配合
- 请求内容：重复 package、Demo Provider 成功/失败、Receipt 和 FALLBACK export 都必须校验调用方显式提供的 grant、当前时间 expiry、tenant/organization/project/package/capability/scope；C4 必须按当前时间签发新的 15 分钟 Demo grant，并做与 C5 一致的发送前预检；过期 package/grant 不得启动新动作。
- 请求原因：C5 第二轮已完成 grant-first 和 current-time 校验；但 C4 每次仍生成固定 `2026-07-30T00:04Z—00:19Z` Grant，且发送前只比较 tenant/project/package。固定窗口外必然被 C5 拒绝。
- 影响领域/文件：C5 v0.1 路由、Package Adapter、授权负例和审计证据。
- 是否阻塞：是；P0，阻塞权限 Gate。
- 临时方案：无；本地登录 token 不能替代项目 grant。
- 期望完成 Gate：D1 Static Gate 重审前
- C0 决策：待定
- 决策日期：待定
- 状态：`CLOSED_STATIC / BLOCKED_RUNTIME_EVIDENCE`
- D1 Static Gate 第二轮复核：`C5=CLOSED_STATIC`；`C4=OPEN`，所以 Request 总体保持 OPEN。
- D1 Static Gate Round 3：C4 按当前时刻签发 15 分钟 Grant，dispatch/retry/receipt/handoff 前均校验 expiry、tenant/org/project/package/capability/scope。静态问题关闭；正反例待运行证据。

## REQ-C7-010 · 合同化或隔离旧真实生成与导出通道

- 发起人：C7
- 目标 Owner：C4 / C5 / C6
- 请求内容：D1 中所有真实生成/FFmpeg 导出必须纳入 project grant、GenerationTaskReceipt、AssetReceipt、Credit reservation 和 ExportArtifact/来源链；无法纳入的旧 `/mvp/generation` 与 `/mvp/export` 必须从 D1 路径隔离。Mock success 不得统计为“真实生成”。
- 请求原因：首轮 D1 UI 可走旧真实通道且把 Mock completed 统一计为真实；第二轮已通过默认 legacy 隔离、canonical client 禁用和 Truth 分开计数消除该旁路。
- 影响领域/文件：StoryCanvas UI、MVP generation/export、C4 Ledger、Truth Manifest、导出证据。
- 是否阻塞：是；P0，阻塞真实性、额度和交付 Gate。
- 临时方案：只允许明确标识 `FALLBACK / DEMO_ONLY / 非 REAL` 的纯合成可播放 Demo；technical QA 不得冒充 editorial/brand QA 或正式营销成片。
- 期望完成 Gate：D1 Static Gate 重审前
- C0 决策：待定
- 决策日期：待定
- 状态：`CLOSED_STATIC`
- D1 Static Gate 第二轮复核：legacy generation/export 默认要求显式 `X-StoryCanvas-Mode: legacy`；canonical client 不再调用旧入口，导航不暴露 legacy 模块；MOCK-CONTRACT/REAL-CAP/FALLBACK 已分开统计。仍需运行负例和视觉证据。

## REQ-C7-011 · 安全拒绝错误深链并隔离历史第二数据旁路

- 发起人：C7
- 目标 Owner：C4 / C5 / C6
- 请求内容：参数化渠道、企业和生产路由必须验证 tenant/project ID，错误 ID 返回安全错误而非渲染 canonical 数据或静默重定向；D1 入口不得允许旧 MVP 服务在 canonical bootstrap 外创建“南城咖啡”项目。
- 请求原因：C5 canonical 深链和 accepted mapping 第二轮已安全拒绝错误 ID，南城咖啡只留在显式 legacy 模式；但 SaaS generic `/projects/:projectId` 仍把任意 ID 静默重定向 canonical 项目。
- 影响领域/文件：SaaS Router/Workbench、C5 MVP bootstrap、AUTH-007 和第二数据检查。
- 是否阻塞：是；P1，默认阻塞 D1，除非 C0 给出有期限的单次豁免。
- 临时方案：主持人只使用 canonical 深链；这不能替代安全拒绝证据。
- 期望完成 Gate：D1 Static Gate 重审前
- C0 决策：待定
- 决策日期：待定
- 状态：`CLOSED_STATIC / BLOCKED_RUNTIME_EVIDENCE`
- D1 Static Gate 第二轮复核：`C5=CLOSED_STATIC`；SaaS generic project route 仍开放，Request 保持 P1 OPEN。
- D1 Static Gate Round 3：SaaS generic project route 只对 canonical ID 重定向，其他 ID 返回 `ROUTE_ID_REJECTED`。P1 静态关闭；浏览器负例待运行证据。

## REQ-C7-012 · 建立真实 active organization 上下文

- 发起人：C7
- 目标 Owner：C4 / C6
- 请求内容：将 active organization 建模为独立、可选择、可持久的 organization ID；工作台 kind 只决定 UI 类型，不得充当 organization ID。切换后必须按 membership 重算 role、tenant/project scope、菜单、数据范围和可执行动作；同类多个渠道组织不得共享同一 Select value。
- 请求原因：第二轮 `WorkbenchChrome` 的“切换当前组织”Select 仍以 `platform/channel/tenant/production` 为 value，并与工作台 Select 执行相同导航；多个渠道选项共享 `channel`，`getActiveWorkbenchContext()` 仍取第一个 active membership。
- 影响领域/文件：Workbench Shell、Membership、四入口权限、渠道层级、16 步第 1/3/4/16 步。
- 是否阻塞：是；P0，阻塞组织、权限和演示 Gate。
- 临时方案：无；页面显示 Organization/Tenant/Project 字段不能替代真实 active context。
- 期望完成 Gate：D1 Static Gate 重审前
- C0 决策：待定
- 决策日期：待定
- 状态：`CLOSED_STATIC / BLOCKED_RUNTIME_EVIDENCE`
- D1 Static Gate Round 3：activeOrganizationId 已独立持久化；selector 使用真实 platform/channel level-1/tenant ID，并按 Membership 重算 role/scope。Production 使用 Tenant 内 `production.operator`，没有伪造生产 Organization。MASTER/LEVEL_2 非黄金路径且无 Membership，诚实禁用不计 P0。运行切换证据待补。

## REQ-C7-013 · 对齐 StoryCanvas handoff project/package identity

- 发起人：C7
- 目标 Owner：C4 / C5 / C6
- 请求内容：冻结并实现 `storycanvas:d1-grant-request`、`storycanvas:d1-grant`、`storycanvas:d1-ready` 的同一 identity：三类消息都必须显式携带并双向校验 `projectId=demo-local-001`、`packageId=package-demo-local-001-v1`；缺失或不匹配必须 error，不得进入 ready。
- 请求原因：C4 已校验 trusted origin/source 并使用内存 grant，但发出的 grant 消息只有 `{type,grant}`；C5 强制读取顶层 `projectId/packageId`，因此会确定性 scope mismatch。C4 当前也未校验 request identity，ready 对 project/package 校验不完整。
- 影响领域/文件：C4 `storyCanvasBridge.ts`、C5 `frontend/src/App.jsx`、C6 handoff 状态 UI。
- 是否阻塞：是；P0，阻塞正确 deepLink 的画布授权。
- 临时方案：包检查器和 `handoff error/timeout` 可诚实展示；不得宣称画布已授权。
- 期望完成 Gate：D1 Static Gate 最小复核前
- C0 决策：待定
- 决策日期：待定
- 状态：`CLOSED_STATIC / BLOCKED_RUNTIME_EVIDENCE`
- D1 Static Gate Round 3.1：request/grant/ready 均强制携带并校验 canonical project/package；缺失或错值不进入 ready。origin/source/内存 grant 边界保持。实际消息序列待运行证据。

## REQ-C7-014 · 冻结同一 ExportReceipt payload

- 发起人：C7
- 目标 Owner：C4 / C5
- 请求内容：让 C5 Export Outbox payload 与 C4 ExportReceipt Schema 一致；至少统一 `exportId`、`generationTaskId`、`status`、`outputAssetIds`、`checksum`、`error`、`truthMode`、tenant/project、idempotency 和 createdAt，并保持 FALLBACK/DEMO_ONLY/QA/rights 扩展字段不丢失。
- 请求原因：C5 Round 3 payload 使用 `exportArtifactId`，没有 C4 必需的 `exportId/generationTaskId/status/outputAssetIds/error/truthMode`。C4 会在 envelope/preflight 阶段拒绝，无法 ACK/apply。
- 影响领域/文件：C4 ExportReceipt domain/schema/Bridge、C5 fallback Export Outbox、来源链 UI。
- 是否阻塞：是；P0，阻塞可播放 FALLBACK 的跨仓 Export receipt 闭环；不否定 MP4 本身的 Demo 可播放静态证据。
- 临时方案：StoryCanvas canonical UI 可诚实播放 DEMO_ONLY Artifact；控制平面不得宣称 Export receipt 已 acknowledged。
- 期望完成 Gate：D1 Static Gate 最小复核前
- C0 决策：待定
- 决策日期：待定
- 状态：`CLOSED_STATIC / BLOCKED_RUNTIME_EVIDENCE`
- D1 Static Gate Round 3.1：C5 payload 已补齐 C4 Schema/preflight 字段，`businessId=exportId`，digest 基于最终 payload；FALLBACK/DEMO_ONLY/QA/rights 扩展保留。实际 Outbox 状态推进待运行证据。
