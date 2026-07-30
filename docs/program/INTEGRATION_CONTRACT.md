# INTEGRATION CONTRACT · SaaS 与 StoryCanvas v0.1

> 本文件定义语义合同，不承诺当前代码已经全部实现。合同变更必须由 C4/C5 联合提案、C0 批准。

## 共同标识

`tenantId`、`organizationId`、`brandId`、`storeId`、`campaignId`、`projectId`、`scriptVersionId`、`sceneId`、`shotId`、`assetId`、`generationTaskId`、`timelineVersionId`、`usageRecordId`。

## ProjectProductionPackage

必须包含：

- 项目与租户上下文。
- 场景 Agent 类型。
- Creative Brief。
- 品牌事实、禁用词、引用和风险规则快照。
- 已批准脚本版本。
- 镜头初稿与目标比例、时长、平台。
- 可用能力与短期授权，不包含上游 API Key。
- 合同版本和幂等键。

## GenerationTaskReceipt

必须回传：

- 任务 ID、项目 ID、镜头 ID。
- 任务类型、供应商、模型。
- 状态和进度。
- 输入摘要和引用资产 ID，不回传密钥。
- 估算成本、实际成本、计量单位。
- 输出资产 ID 或标准化错误。
- 创建、开始、完成时间和幂等键。

## AssetReceipt

必须回传：

- 资产 ID、项目 ID、镜头 ID。
- 类型、MIME、尺寸、时长和校验值。
- 来源、模型、任务 ID、提示词摘要。
- 本地或远程存储引用。
- 权利说明、审核状态和版本。

## 额度状态机

```text
requested -> reserved -> consumed
                     \-> released
```

- 创建可计费任务前由控制平面 `reserved`。
- 成功并形成可交付资产后 `consumed`。
- 提交失败、供应商失败或取消后 `released`。
- 超额费用必须创建新的账本动作，不得覆盖旧流水。

## 授权

- 控制平面签发短期项目令牌，至少限定 tenant、project、capability、expiry。
- StoryCanvas 验证项目令牌，不信任前端传入的客户价格。
- 上游 API Key 只存在于服务端供应商适配层。

## Demo Adapter

Demo 可以在 LocalStorage/Mock 中模拟上述合同，但字段名、状态机和错误语义不得另起一套。
