# 交互数据闭环 · INTERACTION FLOW

## 总链路

```
Brief → Script → Storyboard → Assets → Rough Cut → QA → Export Preview
         ↑
       Brand(C1—C8)
```

## Brief → Script

必须传递：

- platforms
- targetAudience
- cta
- duration
- aspectRatio
- merchantName / city

脚本生成（Mock）应消费 Brief，而不是写死无关文案。

## Brand → Script

- 事实 C1—C8 可被 ScriptBlock.claimIds 引用
- 禁用词命中时 riskLevel 提升
- C8 作为 disclaimer 默认出现

## Script → Storyboard

- Hook / Body / Proof / CTA 映射为镜头
- 统一 8 镜：外景→服务→锅底→毛肚→虾滑→环境→会员→夜景 CTA
- narration / screenText 来自脚本块

## Storyboard → Assets

每镜 matchStatus：

- matched 已匹配
- reshoot 待补拍
- missing 缺镜
- ai_placeholder AI 补镜占位

## Assets → Rough Cut

- 选择已匹配素材进入 timeline.clips
- 简化轨：画面 / 口播 / BGM / 字幕 / 花字

## Rough Cut → QA

检查项：

1. 画面清晰度
2. 字幕可读性
3. BGM 音量
4. 敏感词
5. 缺镜
6. 导出就绪

缺镜或敏感词失败时，导出按钮 disabled + 提示原因。

## 页面跳转建议

- Dashboard → Brief / 进入已有项目
- Brief 保存 → Brand 或 Script
- Script 确认 → Storyboard
- Storyboard 完成 → Rough Cut
- Rough Cut QA 通过 → 导出预览抽屉
