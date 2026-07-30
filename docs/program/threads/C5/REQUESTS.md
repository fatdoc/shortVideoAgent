# C5 REQUESTS

## REQ-C5-001 · 冻结生产包、项目令牌、ID 映射和回执传输

- 发起人：C5
- 目标 Owner：C4
- 请求内容：与 C5 联合给出 `INTEGRATION_CONTRACT.md` v0.1 的可执行 Schema/fixture，冻结 `ProjectProductionPackage` 入站、短期项目令牌 claims、共同 ID 类型、幂等规则，以及 `GenerationTaskReceipt/AssetReceipt` 回传或拉取方式。
- 请求原因：当前 StoryCanvas 使用 Toonflow 整数主键和本地 JWT；没有 Package 入口、外部 ID 映射、项目令牌或可靠回执通道。
- 影响领域/文件：控制平面 API/数据模型；StoryCanvas 后续合同 Adapter；公共合同如需变更必须由 C0 写入。
- 是否阻塞：Demo Adapter 实现是；本轮评审否。
- 临时方案：文档中采用 `PROPOSED ProductionContractAdapterV01`，不修改公共合同、不编码。
- 期望完成 Gate：Demo 集成 Wave 开始前。
- C0 决策：待定
- 决策日期：待定
- 状态：OPEN

## REQ-C5-002 · 冻结生成任务的预冻结与计量握手

- 发起人：C5
- 目标 Owner：C3
- 请求内容：定义控制平面在任务创建前提供的预冻结/授权关联、成功/失败/取消后的消费或释放触发，以及 Provider 原始用量、估算成本、实际成本和计量单位的字段语义。
- 请求原因：StoryCanvas 只能回传媒体生产事实，不能自行定义客户价格或写钱包；当前任务成本列未被实际填充。
- 影响领域/文件：额度状态机、任务回执、C3 账本实现、C5 Provider/任务 Adapter。
- 是否阻塞：商业 MVP 是；老板 Demo 否。
- 临时方案：Demo 使用 v0.1 状态语义的 Mock reserve/consume/release，由控制平面展示，StoryCanvas 不写账本。
- 期望完成 Gate：商业 MVP 任务中心实现前。
- C0 决策：待定
- 决策日期：待定
- 状态：OPEN

## REQ-C5-003 · Toonflow 商业授权与标识条款决策

- 发起人：C5
- 目标 Owner：C0
- 请求内容：升级给用户/法律顾问，确认面向两个及以上独立第三方的书面商业授权，并复核现有 StoryCanvas 产品化改动与“不得删除或修改 Toonflow 标识/版权信息”条款的兼容性；如无法取得授权，决定替代基座路线。
- 请求原因：根许可证补充协议把书面授权设为对外产品化前提，且现有历史改动已经移除部分上游品牌/推广入口。
- 影响领域/文件：商业 MVP Gate、产品分发、UI 归属展示、潜在技术基座。
- 是否阻塞：商业 MVP 对外试点和上线是；内部 Demo 否。
- 临时方案：仅内部评审和 Demo，不对外分发、不作商业承诺。
- 期望完成 Gate：商业 MVP 开工前。
- C0 决策：待定
- 决策日期：待定
- 状态：OPEN

## REQ-C5-004 · FireRed 完整 POC 资源、凭证和费用批准

- 发起人：C5
- 目标 Owner：C0
- 请求内容：升级给用户决定是否为隔离 POC 下载 FireRed TransNet/字体/BGM 等资源，并配置真实 LLM/VLM/模型凭证和允许的费用上限；同时确认第三方模型、字体、音乐和素材的商用条款。
- 请求原因：当前 FireRed Web 可启动，但 MCP 因资源缺失处于 degraded；完整剪辑和导出能力没有真实验收。
- 影响领域/文件：FireRed 本地环境、Provider 配置、集成测试、许可证与费用。
- 是否阻塞：完整媒体管线是；Demo 和基础 FFmpeg 合并否。
- 临时方案：Demo 使用明确标记的基础合并导出，健康状态显示 degraded/offline。
- 期望完成 Gate：FireRed Adapter 全量实现前。
- C0 决策：待定
- 决策日期：待定
- 状态：OPEN

## REQ-C5-005 · 提供唯一海底捞 Demo 生产输入

- 发起人：C5
- 目标 Owner：C2
- 请求内容：提供 C0 已批准的 `demo-local-001` Creative Brief、ScriptVersion、Scene/Shot 初稿、品牌事实/禁用词/风险规则、角色/场景引用要求和 CTA；交由 C4 封装为唯一 `ProjectProductionPackage` fixture。
- 请求原因：StoryCanvas 当前固定“南城咖啡”五镜头，若继续使用会形成第二套 Demo 主数据并破坏黄金路径。
- 影响领域/文件：C2 场景 Agent 输出、C4 Package fixture、C5 Demo 数据接线、C6 演示路径。
- 是否阻塞：统一 Demo 数据接线是；本轮评审否。
- 临时方案：保留现有“南城咖啡”作为历史产品证据，不把它宣称为新项目统一 Demo。
- 期望完成 Gate：Demo 集成 Wave 开始前。
- C0 决策：待定
- 决策日期：待定
- 状态：OPEN

