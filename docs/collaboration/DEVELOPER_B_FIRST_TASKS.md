# 负责人 B 首轮任务书

> 任务周期：D2 第一轮
> 任务目标：让媒体生产工作台可以稳定演示并讲清输入、执行、产出和回执
> 技术边界：前端 + Mock，禁止扩张真实后端

## B-01：基线接管

### 工作内容

- 克隆并启动 `fatdoc/shortVideoAgent`。
- 使用 `production / Demo@123456` 登录。
- 走通生产概览、生产包、StoryCanvas、任务、资产和导出。
- 阅读 v0.1 合同和 D1 runtime evidence。

### 产物

- 一份基线问题清单。
- 标注 P0、P1、P2。
- 不在此任务中改控制平面文件。

## B-02：生产工作台视觉收口

### 允许修改

- `src/pages/production/`
- `src/components/production/`
- 对应 CSS 和测试

### 目标

- 首屏清楚展示当前项目、package、grant、预留额度和生产状态。
- 同屏讲清输入、生成任务、媒体资产和回执。
- 减少超高卡片和大块空白。
- 保持纯白、浅灰、轻边框、高密度视觉。

### 验收

- `1440×900` 无横向裁切。
- Mock、Fallback、真实能力边界清楚。
- 成功和失败任务都可讲解。

## B-03：StoryCanvas 交接可靠性

### 允许修改

- `src/services/storyCanvasBridge.ts`
- `src/pages/production/`
- 对应测试

### 目标

- 父窗只向正确 origin 和 project/package 发送 grant。
- 子窗未 ready 时可重试请求，成功后立即停止。
- timeout、popup blocked、origin mismatch、scope mismatch 全部 fail closed。
- URL、LocalStorage 和 sessionStorage 中不得出现 grant。

### 验收

- 正确项目可进入 `handoff_ready`。
- 错项目明确拒绝。
- grant 不持久化。
- 重复消息不导致重复 package 或任务。

## B-04：任务、资产与回执闭环

### 允许修改

- `src/pages/production/`
- `src/pages/rough-cut/`
- `src/components/production/`
- 生产相关 Mock adapter 与测试

### 目标

- 成功任务：reserved → consumed。
- 失败任务：reserved → released。
- 任务回执和资产回执可轮询、投递、ack。
- 重复 ack 幂等。
- 错 project/package/grant 拒绝。

### 验收

- 成功、失败各有可复现步骤。
- 不创建失败任务的假资产。
- 四条 Demo 回执最终可为 `acknowledged`。
- UI 与账本结果一致。

## B-05：测试与交接

### 必须执行

```bash
npm run test
npm run lint
npm run build
npm run validate:governance
```

### 必须提交

- 改动说明。
- 演示步骤。
- 测试结果。
- 已知风险。
- 修改文件清单。
- 给负责人 A 的合同或公共文件请求。

## 明确不做

- 不开发真实登录后端。
- 不开发充值、支付、发票或提现。
- 不修改代理层级和客户价格。
- 不购买或接入真实模型额度。
- 不把 StoryCanvas 代码整体复制进当前仓库。
- 不宣称真实 AI、正式品牌批准或生产发布。
