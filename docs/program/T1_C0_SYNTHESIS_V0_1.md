# T1 C0 SYNTHESIS v0.1 · 领域会签与 Demo 冻结

> 状态：`APPROVED_FOR_D1_DEMO_DESIGN`
>
> 日期：2026-07-30
>
> 决策人：C0
>
> 适用范围：老板 Demo 设计与 Mock 合同。本文不批准真实售价、资金结算、商业授权或生产部署。

## 1. C0 总结

C1—C5 的首轮提案方向一致，可以进入 D1 老板 Demo 设计：

- 商业模型以真实视频额度销售和使用为收益来源。
- 渠道组织树与企业租户隔离树分开。
- 产品采用共享生产能力 + 场景 Agent + 商业授权三层。
- 钱包采用 append-only 账本和 reserve/consume/release 状态机。
- 控制平面采用模块化单体，StoryCanvas 采用合同适配层。
- 现有 StoryCanvas 增量保留，不重写，不承载租户、价格和钱包。

## 2. D1 Demo 暂定冻结

### 2.1 组织与工作台

四类入口：平台管理员、代理商、企业客户、媒体生产。

Demo 渠道链路：

```text
平台
-> 总代理
-> 一级代理
-> 二级代理
-> 企业客户 Tenant
```

规则：单父、无环、不可跳级、不可通过白标突破层级。品牌、门店、项目属于企业 Tenant 内部业务对象。

组织语义裁决：

- Platform 和 ChannelOrganization 是独立商业节点，不属于企业 Tenant。
- Tenant 是 Brand、Store、Campaign、Project、Script、Asset 和生产内容的数据隔离边界。
- D1 项目令牌中的 `organizationId` 表示当前操作主体并用于审计，不能替代 `tenantId`。
- 渠道用户没有目标 Tenant 的显式 Membership/代运营授权时，不得获得生产内容项目令牌。
- C4 v0.1 中“Organization 必须属于一个 Tenant”的早期表述在 D1 实现中废止。

### 2.2 产品范围

Demo 主售组合：

- AI 视频基础生成包。
- 本地生活 Agent 包。

老板 IP、电商作为可讲解产品卡；数字人和 API 作为未购买/待授权扩展，不伪装为已完成能力。

统一案例：`demo-local-001`，海底捞北京三里屯，本地生活 Agent，9:16，30 秒，事实 C1—C8。

### 2.3 额度和价格

客户界面统一称“AI 视频额度”。Demo 使用演示 RateCard，不构成真实报价。

统一状态机：

```text
requested -> reserved -> consumed
                     \-> released
```

Demo 可使用“预计 100、最多冻结 120”的说明性样例。任务成功且形成可交付资产后消费，余量释放；任务失败且无可交付资产时全量释放。所有金额和额度数字必须标记“演示数据”。

### 2.4 控制平面

首版采用模块化单体，不提前拆微服务。控制平面负责 tenant/org/project 授权、Product/SKU/Entitlement、生产包、短期项目令牌、额度和回执接收。

LocalStorage 和现有 Zustand 仅用于 Demo，不能成为真实权限或账本事实源。

### 2.5 StoryCanvas

保留现有画布、连续性记忆、可信角色资产、真实生成任务、基础 FFmpeg 合并和本地恢复基础。

D1 最小适配概念：

- `ProjectProductionPackage` Mock Adapter。
- 外部字符串 ID 与内部整数 ID 映射。
- 统一 MediaAsset 登记。
- GenerationTaskReceipt / AssetReceipt Mock Outbox。
- 不把客户价格和钱包复制到 StoryCanvas。

StoryCanvas 当前“南城咖啡”保留为历史产品证据，但 D1 黄金路径必须消费唯一海底捞生产包，不能形成第二套主数据。

## 3. D1 黄金路径

```text
平台配置演示产品和额度
-> 代理查看可售产品与差价示意
-> 企业客户获得基础生成 + 本地生活能力
-> 选择海底捞三里屯
-> 品牌大脑事实/禁用词/引用
-> 脚本与分镜生产单
-> 进入 StoryCanvas
-> 调整镜头、角色与场景引用
-> 模拟或真实生成
-> 回传任务、资产和用量事实
-> 控制平面展示冻结/消费/释放
-> 导出成片并展示来源链路
```

## 4. Request 会签

### 已方向性解决，可进入 D1

- C1/C4：Tenant、Organization、Membership、active organization 和 scope 的分层原则一致。
- C2/C3：Product/Capability/SKU/Entitlement 分工一致；真实 meter 和价格后置。
- C2/C5：StoryCanvas 能力覆盖已完成评估，D1 缺口采用最小 Adapter。
- C3/C4：任务回执与账本动作通过 reservationReference 解耦；Demo 使用 Mock。
- C4/C5：采用生产包、短期项目令牌、ID 映射、任务/资产回执和 Outbox 方向。

### 继续开放，不阻塞 D1

- 真实价格、税务、开票、支付、退款窗口和会计确认。
- 白标合同主体、数据责任和退出机制。
- Toonflow 书面商业授权与标识条款。
- FireRed 完整 POC 所需资源、凭证、费用和第三方商用条款。
- 商业 MVP 的正式 meterCode、成本精度、令牌 TTL、错误枚举和数据库 Schema。

## 5. 下游任务

- C6：依据本文设计 10—15 分钟老板演示黄金路径、页面地图和关键状态。
- C7：依据本文建立业务、权限、额度、跨仓、视觉和演示验收矩阵。
- C8：整理资料地图、PRD 差距和顶层设计文档骨架；不得把演示价格写成正式报价。

## 6. D1 前仍需的实现输入

- 唯一海底捞 `ProjectProductionPackage` fixture。
- 四工作台角色切换和当前组织提示。
- 演示 RateCard、Wallet 和 Ledger fixture。
- StoryCanvas 入口、任务/资产回执和额度状态的 Mock 对接。
- 明确标注真实生成、Mock 生成和基础合并导出的能力状态。
