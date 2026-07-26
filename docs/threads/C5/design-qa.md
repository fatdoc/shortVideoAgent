# C5 Storyboard Design QA

- source: `UI/ChatGPT Image Jul 23, 2026, 12_32_30 PM (5).png`
- implementation: `docs/threads/C5/artifacts/storyboard-1672x941.png`
- viewport: `1672×941`
- responsive evidence: `docs/threads/C5/artifacts/storyboard-1440x900.png`
- comparison evidence: `storyboard-1672x941-side-by-side.png`、`storyboard-header-side-by-side.png`、`storyboard-expanded-row-side-by-side.png`、`storyboard-right-panels-side-by-side.png`

## 验收方法

以相同 `1672×941` 尺寸对照参考图，复核首屏构图、信息密度、颜色、镜头行、展开详情和右侧统计；再以 `1440×900` 检查双栏与 8 镜首屏完整性。最后一次浏览器工具异常未触发新一轮截图，按用户要求使用当前已有证据收口。

## 两轮问题记录

- 第一轮 P1：没有默认展开详情；真实照片与镜头业务语义错配。
- 第一轮 P2：统计信息重复；右栏存在参考图外的额外按钮；镜头角标与版本信息重复。
- 第二轮 P2：列表缺少底部添加镜头/镜头数/总时长汇总；任务与素材统计圆环缺少分段色彩层次。

## 已修复

- 用 8 张真实餐饮/门店缩略图替换蓝色文字占位，并按门店外景、进店服务、锅底、毛肚、虾滑、环境、会员、夜景 CTA 重新映射。
- 补齐 breadcrumb、项目标题、执行状态、时长、画面数、版本、更新时间。
- 补齐拖拽排序、批量指派、生成拍摄清单、进入初剪四个顶部操作。
- 压缩为 8 条横向多列镜头行，保持浅色紧凑工作台密度。
- 默认展开 `shot-02`，详情覆盖拍摄建议、时段、设备、指派、状态与素材匹配。
- 右栏拆分为拍摄任务、漏拍提醒、素材状态三个统计区。
- 增加拍摄清单 tab、8 条任务、添加镜头入口及镜头/时长汇总。
- 1672×941 下第 8 行底部约 `898px`，footer 位于 `903–931px`；1440×900 下 8 行全部可见，footer 从折叠线开始。

## 受约束 P3

- 全局壳层侧栏宽度和导航项与参考图存在差异，但不在 C5 允许修改范围内。
- 统一 Demo 数据为 8 镜，因此统计忠实消费当前 workspace，不照抄参考图中的 `16`/`42`，也不新增案例 schema 或第二套 Mock。

## 结论

C0 二次验收点名的 P0/P1/P2 已在允许范围内逐项处理；剩余差异仅为全局壳层和统一数据约束，不影响老板演示。

final result: passed
