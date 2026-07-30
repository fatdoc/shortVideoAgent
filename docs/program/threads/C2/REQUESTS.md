# C2 REQUESTS

> 使用 `docs/program/templates/REQUEST_TEMPLATE.md`。

## REQ-C2-001 · 响应 REQ-C3-002 并会签商业语义

- 请求内容：C2 已提供 Capability 的客户可见范围、标准输出和阶段；请 C3 会签 Product/Capability/SKU/Entitlement 分工，并负责 meter、最大冻结系数、额度授予和账本映射。双方后续按 Capability 联合冻结成功交付条件。
- 原因：这是对 `REQ-C3-002` 的边界化响应；C2 负责产品结果，不能决定换算、冻结、扣减或账本算法。
- 影响范围：`C2_PRODUCT_AGENT_CATALOG_V0_1.md`、后续产品目录与 C3 商业计量设计。
- 阻塞性：非阻塞当前提案；阻塞商业 MVP 冻结。
- 临时方案：所有数量、价格和换算均保留为未定义，Demo 使用 Mock 状态。
- 期望 Owner：C3。
- C0 决策：待定。

## REQ-C2-002 · Entitlement 与 ProductionGrant 对象映射

- 请求内容：请 C4 确认 Entitlement → EffectiveProjectCapabilities → `ProductionGrant` 与现有 SaaS/StoryCanvas 集成合同的对象映射。
- 原因：场景 Agent 需要获得项目级 Capability 授权，但 C2 不修改公共合同或底层 API。
- 影响范围：控制平面数据模型、项目令牌、ProjectProductionPackage。
- 阻塞性：非阻塞 Demo；阻塞商业 MVP 实现。
- 临时方案：v0.1 只描述运行语义，不新增公共合同字段。
- 期望 Owner：C4；如需合同变更，由 C4/C5 联合提案。
- C0 决策：待定。

## REQ-C2-003 · StoryCanvas Capability 覆盖映射

- 请求内容：请 C5 将共享生产 Capability 标记为“已具备/需适配/缺失”，并指出最小 Demo Adapter 缺口。
- 原因：产品目录必须区分可演示、可真实生产和后续能力，不能用产品命名替代实现事实。
- 影响范围：基础生成包、StoryCanvas 集成输入、商业 MVP 范围。
- 阻塞性：非阻塞当前提案。
- 临时方案：沿用共同记忆中的 StoryCanvas 已有能力描述，不做实现承诺。
- 期望 Owner：C5。
- C0 决策：待定。

## REQ-C2-004 · 黄金案例与产品状态 UX 验证

- 请求内容：请 C6 验证海底捞 10—15 分钟产品叙事、场景 Agent 选择、已购/未购买/禁用状态和跨平面跳转。
- 原因：C6 是跨平面体验和老板 Demo Owner，也是 C2 产品包的必需会签方。
- 影响范围：Demo 黄金路径、产品卡、Entitlement 提示、异常说明。
- 阻塞性：非阻塞目录提案；阻塞 Demo 交互冻结。
- 临时方案：以文档中的九步业务脚本作为体验输入。
- 期望 Owner：C6。
- C0 决策：待定。
