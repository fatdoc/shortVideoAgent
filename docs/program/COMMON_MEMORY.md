# COMMON MEMORY · 权威共同记忆

> 所有员工只读，仅 C0 修改。更新时间：2026-07-30。

## 已确认事实

1. 原始 PRD 是战略与能力蓝图，不是可直接实施的完整商业 PRD；原文有 38 项功能要求，其中 30 项标为 P0，MVP 范围过载。
2. 平台商业核心是销售 AI 视频生产额度，场景 Agent 用于包装能力、降低使用门槛并提高客单价。
3. 租户与品牌、门店、项目必须分开。品牌、门店、项目是企业租户内部业务对象，不是独立租户。
4. 上游 API Key 永不直接下发客户；平台需记录供应商成本、结算价格、零售价格和活动价格。
5. 渠道层级可配置，首版最多支持总代理、一级代理、二级代理，收益必须来自真实销售或使用，不来自招募数量。
6. 当前 `videoagent` 仓库已完成前端 Demo Gate 2，品牌大脑和脚本等成果必须保留。
7. 现有 StoryCanvas 项目基于 Electron、React、Express、SQLite 和 FireRed-OpenStoryline，已经具备分镜画布、生成任务、连续性记忆、角色引用、素材和时间线基础。
8. StoryCanvas 是媒体生产平面，不承担租户、钱包、套餐、渠道和结算。
9. 当前目标优先级是老板演示闭环，不是真实后端和真实 AI 全量上线。
10. 两个仓库暂不直接物理合并，先通过版本化合同连接。
11. 系统采用四类核心工作台：平台管理、渠道代理、企业客户、媒体生产；API 开发者控制台后置。
12. 工作台功能由组织类型、成员角色、已购能力和数据权限共同决定，不为每个代理层级复制独立应用。
13. 用户正式发出启动指令后，C0 可按 `AUTONOMY_PROTOCOL.md` 自主创建和调度 C1—C8，无需用户逐项跟进。
14. Platform、ChannelOrganization 与企业 Tenant 独立；Tenant 是生产内容隔离边界。项目令牌中的 organizationId 只表示当前操作主体，不能绕过 tenantId 和 Membership。

## 权威业务对象

- 商业组织：Platform、ChannelOrganization、Tenant、User、Role、Membership。
- 产品交易：Capability、Product、SKU、PriceBook、Package、Order、Wallet、CreditLedger、Settlement。
- 业务场景：Brand、Store、AgentTemplate、Campaign、Project、CreativeBrief、Claim、Rule。
- 媒体生产：ScriptVersion、Scene、Shot、ReferenceBinding、GenerationTask、MediaAsset、EditSession、TimelineVersion、ExportArtifact。

## 首轮统一 Demo

- 项目 ID：`demo-local-001`。
- 品牌案例：海底捞火锅，北京三里屯门店。
- 平台：抖音。
- 比例：9:16。
- 事实：沿用 C1—C8。
- 主 CTA：领取团购券 / 到店核销。
- 演示数据必须从一个工作区传播，不复制第二套“看起来相似”的主数据。

## 冻结原则

- 内部统一称“AI 视频额度”，不在客户界面使用“上游 token”。
- 额度账本只追加，不直接修改历史余额。
- 生成任务先预冻结，成功后结算，失败后释放。
- 连续性是结构化世界记忆，不默认把上一镜尾帧传给下一镜。
- 只有连续动作镜头可选择上一镜尾帧；其他剪辑使用批准的角色/世界状态重新构图。
- 所有素材必须保留来源、权利说明、模型和任务链路。

## 当前状态

- 历史前端 Gate：Gate 2 已通过。
- 新项目级 Gate：T0 已完成；C1—C5 首轮提案已完成。
- C0 会签：`T1_C0_SYNTHESIS_V0_1.md` 已批准用于 D1 老板 Demo 设计。
- D1 暂定冻结：四类工作台、基础生成 + 本地生活主产品、海底捞三里屯统一案例、额度预冻结/消费/释放、模块化单体控制平面、StoryCanvas 最小合同适配层。
- 未启动真实商业 MVP。
- 未决定生产部署形态和最终授权方案。

## 主要风险

- Toonflow 商业使用需要确认授权。
- StoryCanvas 当前偏本地单用户，尚无 SaaS 租户上下文。
- FireRed 服务的完整剪辑、时间线和导出接口仍不充分。
- 上游模型成本和可用性存在波动。
- 多级渠道、分润、充值和资金处理需要法务与财务审查。
