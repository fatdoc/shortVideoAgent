# PROGRAM ARCHITECTURE · 双平面架构

## 总体结构

```text
商业 SaaS 控制平面
  租户 / 渠道 / 用户 / 权限
  产品 / SKU / 价格 / 套餐
  钱包 / 额度 / 订单 / 结算
  品牌 / 门店 / 事实 / 规则
  场景 Agent / Campaign / Brief
              |
              | Versioned Production Contract
              v
StoryCanvas 媒体生产平面
  Script / Scene / Shot / Canvas
  Character / World Memory / Reference
  Generation Task / Provider Adapter
  Media Asset / Edit Session / Timeline
  Preview / Export Artifact
              |
              v
上游模型与媒体服务
```

## 控制平面职责

- 确认“谁有权做什么”。
- 确认“客户买了什么、还有多少额度”。
- 保存品牌事实、禁用词、引用要求和营销目标。
- 创建生产项目并签发短期生产授权。
- 对生成任务做预冻结、结算和失败释放。
- 接收任务、资产、成本和成片回执。

## 生产平面职责

- 把 Brief 和脚本组织为场景与镜头。
- 管理镜头画布、角色、场景和连续性。
- 调度图片、视频和后续剪辑任务。
- 管理生成资产、版本、时间线和导出物。
- 回传用量事实，不自行定义客户价格。

## 禁止的耦合

- StoryCanvas 不直接写钱包余额。
- SaaS 不直接读 StoryCanvas SQLite。
- 前端不持有上游模型密钥。
- Agent 不绕过项目和任务直接扣减额度。
- 两个仓库不通过复制对象形成两套事实源。

## 当前实现策略

- Demo：使用 Mock Adapter 串联两个平面，可通过路由跳转或轻量 API 模拟。
- 商业 MVP：增加项目授权、用量计量和额度预冻结。
- 完整生产：引入可靠任务队列、供应商路由、对象存储和可观测性。
