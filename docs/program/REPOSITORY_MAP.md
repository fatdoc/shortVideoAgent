# REPOSITORY MAP · 单仓双应用地图

## GitHub 仓库

- 地址：`https://github.com/fatdoc/shortVideoAgent`
- 权威分支：`main`
- 权威治理资料：`docs/program/`

## 应用 A：商业 SaaS 控制平面

- 路径：仓库根目录。
- 源码：`src/`
- 负责领域：身份、租户、渠道、产品、品牌、场景 Agent、钱包、订单、结算和老板演示入口。
- 主要负责人：A / C0、C1、C2、C3、C4、C6、C7。

## 应用 B：StoryCanvas 媒体生产平面

- 路径：`apps/storycanvas/`
- 来源提交：`46fc8d02197e639dbf5bc73f8d0b97210fcbd25d`
- 负责领域：脚本、分镜、画布、引用、连续性、生成任务、素材、时间线和导出。
- 主要负责人：B / C5。
- 来源和许可证记录：`apps/storycanvas/SOURCE_INTEGRATION.md`

## 单仓策略

- 物理上在同一个 Git 仓库中版本管理。
- 逻辑上保持控制平面与生产平面隔离。
- 不把 StoryCanvas 源码塞进根 `src/`。
- 不把商业钱包、租户或客户价格塞进 StoryCanvas。
- 跨应用接口先更新 `docs/program/INTEGRATION_CONTRACT.md` 和 fixtures。
- 一个 commit 可以固定两端版本，但测试、构建和运行证据仍按应用分别记录。

## 历史资料

D1 运行验收时使用两个独立工作树，因此历史报告中的“双仓”“版本对”和旧绝对路径代表当时真实证据，不做追溯性篡改。D2 之后的新任务和交接统一使用当前单仓路径。
