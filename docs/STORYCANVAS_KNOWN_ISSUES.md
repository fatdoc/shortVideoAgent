# StoryCanvas Phase1 Known Issues

> 日期：2026-08-03  
> 原则：此清单用于阻止把 Phase1 Mock 闭环误报为正式生产完成。未列为 PASS 的能力不得在演示或文档中宣称已经完成。

## 1. 摘要

Phase1 已完成 Mock 模式下的 Shot、Task、Attempt、valid Asset、Selection、RoughCut、Export、Credit 和 Provenance 验证，但正式主成片、独立导出资产、真实模型、真实钱包和全量遗留质量问题仍未完成。

## 2. Known Issues

| ID | 严重度 | 问题 | 当前事实 | 影响 |
|---|---|---|---|---|
| KI-01 | P0 | 正式八镜 FFmpeg 粗剪未实现 | 当前没有把八个 selected 视频镜头正式合成为独立粗剪资产 | 不能把 RoughCut approved 等同于已有正式粗剪视频 |
| KI-02 | P0 | 30 秒主成片未实现 | Package 镜头合同合计 30s，但 Mock 视频资产为 `8 * 6s = 48s`，RoughCut API 实测 `totalDuration = 48s` | Mock 资产与目标时长不一致，当前不能交付符合合同的 30 秒主成片 |
| KI-03 | P0 | Export 不是独立合成资产 | 当前 Export 复用 valid 镜头资产，而不是新生成的独立 FFmpeg 合成资产 | Export 记录存在不等于正式成片文件存在 |
| KI-04 | P1 | 图片 Mock/REAL 生成禁用 | 当前 Phase1 没有开放图片 Mock 或 REAL 生成链 | 图片 Attempt、图生视频前置图和真实图片版本链不能验收 |
| KI-05 | P1 | 真实钱包 ACK 未接 | 当前额度链为本地/Mock 投影，未接正式钱包 ACK | 不能用于真实扣费、退款、对账或渠道结算 |
| KI-07 | P1 | 全量 App TypeScript 存在既有 Agent/Zod 风险 | 定向测试与构建通过，但全量 App TS 仍有既有 Agent/Zod 类型风险 | 后续修改可能暴露旧类型漂移，不能宣称类型风险清零 |
| KI-11 | P1 | 仓库全量 Lint 未清零 | 最终验证仍有 702 个既有问题（697 errors、5 warnings）；Phase1 新增文件为 0 error | 不能宣称仓库静态质量门禁全部通过 |
| KI-08 | P2 | Playwright CLI 缺少 Chrome | CLI 浏览器验证无法执行；In-App Browser 截图成功 | 有可视化证据，但缺少标准 Playwright CLI 自动化浏览器回归 |
| KI-09 | P2 | 旧 LocalStorage 首次产生幂等冲突 | 首次使用旧 LocalStorage 状态发生冲突；Demo Reset 后恢复，重复 Package 返回 duplicate | 旧本地状态可能影响首次演示，需要明确 Reset 恢复路径 |
| KI-10 | P1 | 真实模型未验证 | 本轮没有调用真实图片或视频模型 | 不能证明 Provider 账号、质量、耗时、成本和成功率 |

## 3. KI-01/KI-02：粗剪和时长

目标交付：

```text
9:16
30 秒
8 个镜头
正式主成片
```

当前事实：

```text
Package Shot Contract total = 30s
Mock video assets = 8 * 6s
RoughCut API totalDuration = 48s
```

准确表述应为：

> Mock 资产与目标时长不一致。当前 API 可以形成 approved RoughCut 业务记录，但尚未完成八镜时长校正和正式 FFmpeg 粗剪，因此不能宣称已生成 30 秒主成片。

禁止表述：

- “30 秒成片已经生成”；
- “八镜已经完成正式合成”；
- “RoughCut approved 证明视频符合 30 秒合同”。

## 4. KI-03：Export 资产

当前 Export 记录复用已有 valid 镜头资产。它证明 Export/Provenance 数据路径可以形成，不证明产生了新的合成视频文件。

正式完成条件至少包括：

- 独立 Export Task；
- 按 selected Attempt 顺序合成；
- 独立 Export Asset ID；
- 独立文件路径或远程 URL；
- 视频可访问与可播放验证；
- FFprobe 基础验证；
- 30 秒目标时长校验；
- Export Receipt 引用该独立 Asset；
- Provenance 回溯八个输入 Attempt/Asset。

以上条件当前未完成。

## 5. KI-04：图片能力

当前图片 Mock/REAL 路径处于禁用状态。因此：

- 不能演示真实 image generation；
- 不能证明 image Attempt 多版本；
- 不能证明选图后进入图生视频；
- 不能证明 Seedream、GPT Image 或其他图片 Provider 已接入 canonical Runtime。

旧代码存在图片模型 Adapter，不等于 Phase1 canonical 图片链已经完成。

## 6. KI-05：钱包与结算

当前验证能够证明：

- reserve/consume/release 各有 8 条记录；
- failed/cancelled 均为 80/0/80；
- 幂等状态机阻止重复结算。

当前验证不能证明：

- 正式钱包 ACK；
- 服务端事务；
- 真实余额；
- 人民币价格；
- 模型真实成本；
- 失败退款；
- 渠道分成；
- 财务对账。

因此只能称为 Mock Credit 闭环。

## 7. KI-07/KI-11：遗留质量风险

### 7.1 app.smoke

旧登录标题断言已经对齐当前页面，Root 全量测试最终为 72/72 PASS。

### 7.2 全量 TypeScript

全量 App TypeScript 仍存在既有 Agent/Zod 风险。当前 Root Build 和 StoryCanvas Build 通过，不等同于所有遗留类型定义、Agent Schema 和 Zod 数据漂移已经治理完成。

### 7.3 全量 Lint

最终全量 Lint 仍有 702 个既有问题（697 errors、5 warnings）。本阶段新增文件定向 Lint 为 0 error，但不能据此宣称仓库全量 Lint 已通过。

## 8. KI-08：浏览器工具

- Playwright CLI：缺少 Chrome，未完成；
- In-App Browser：截图成功。

IAB 截图可作为页面可见性证据，但不能替代 CLI 浏览器自动化中的导航、断言、网络和控制台验证。

## 9. KI-09：旧 LocalStorage

首次使用旧 LocalStorage 状态时出现幂等冲突。执行 Demo Reset 后：

- 状态恢复；
- 同一 Package 重投返回 duplicate；
- 后续演示可以继续。

当前边界：

- Reset 是已验证恢复手段；
- 尚未证明所有历史 LocalStorage 版本都能自动迁移；
- 演示前应识别旧状态，但不能把人工 Reset 描述为正式数据迁移方案。

## 10. 完成标准

在以下条件满足前，不得宣称 Phase1 正式生产闭环全部完成：

1. 八个 selected 视频资产形成独立 FFmpeg RoughCut Asset；
2. RoughCut 总时长与 30 秒合同一致；
3. tenant.owner 对真实粗剪资产完成确认；
4. Export 创建独立可播放合成资产；
5. Export Receipt 引用该独立资产；
6. 真实钱包 ACK 和幂等结算接通；
7. 至少一个受控真实 Provider 路径完成非自动付费验证；
8. 图片 Mock/REAL 能力边界重新确认并验证；
9. 全量 Lint 与 Agent/Zod 遗留风险有明确处置；
10. 浏览器自动化环境补齐或形成正式替代验收记录。
