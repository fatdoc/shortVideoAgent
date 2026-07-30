# REPOSITORY MAP · 双仓地图

## 仓库 A：商业 SaaS 控制平面

- 路径：当前 `videoagent` 仓库。
- 现状：前端 Demo Gate 2 已完成，保留既有页面、Mock、Store、LocalStorage 和测试。
- 负责领域：租户、渠道、产品、品牌、场景 Agent、钱包、订单、结算、老板演示入口。
- 主要员工：C1、C2、C3、C4、C6、C7。

## 仓库 B：StoryCanvas 媒体生产平面

- 路径：`/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent`。
- 当前分支基线：`feat/storycanvas-phase0`，已有成果不得 reset、checkout 丢弃或整体重建。
- 负责领域：脚本、分镜、画布、引用、连续性、生成任务、素材、时间线和导出。
- 主要员工：C5。

## 项目级治理资料库

- 权威位置：仓库 A 的 `docs/program/`。
- C0 维护共同记忆和公共合同。
- C5 在仓库 B 开发时，通过 HANDOFF/REQUEST 向 C0 提交变更提案；C0 将批准结果写回权威资料库。
- 任何跨仓接口先更新 `INTEGRATION_CONTRACT.md`，再分别实现。

## 仓库策略

- 现在不做代码仓库物理合并。
- 不把 StoryCanvas 复制进 SaaS 的 `src`。
- 不把商业钱包和租户逻辑塞进 StoryCanvas。
- 是否最终使用单体仓库、子模块、独立服务或桌面端，由商业 MVP 架构评审决定。
