# StoryCanvas 前端设计 QA

- 设计基准：`docs/design/storycanvas-canvas-image2.png`（用户选择的 Image2 第 2 套方案）
- 最终实现：`docs/design/storycanvas-canvas-implementation-v5.png`
- 实机窗口：`docs/design/storycanvas-canvas-implementation-real-final.png`
- 紧凑视口：`docs/design/storycanvas-canvas-implementation-compact.png`
- 基准状态：镜头 03 选中、未锁定、生成进度 65%、完成 3 个、待生成 2 个
- 同视口对照：Image2 原图与实现均按 1487 × 1058 CSS 内容视口检查；实现 PNG 为 Retina 2× 像素输出。

## 对照修正记录

| 轮次 | 发现 | 严重度 | 修正 | 结果 |
| --- | --- | --- | --- | --- |
| 1 | 初始生成计时器会在截图前从 65% 自动走到 100%，状态与设计基准不一致 | P2 | 初始状态保持 65%；点击“生成选中镜头”后才进入真实进度 | 已修复 |
| 2 | Framer Motion 的 transform 覆盖参考节点的水平居中 transform，人物/场景参考偏向右侧 | P2 | 改用确定宽度和 `calc()` 几何居中，不再与动画 transform 竞争 | 已修复 |
| 3 | 镜头图卡被二次缩小，画面比例和横向密度低于 Image2 原型 | P2 | 以 84% 为画布基准比例，调整 9:16 图卡、选中卡尺寸和节点间距 | 已修复 |
| 4 | 脚本大纲、检查器起始位置和提示词输入区高度略低于原型 | P3 | 调整顶部留白、输入区高度，并将检查器标题改为“手冲特写” | 已修复 |

## 最终检查

- 布局：顶部工具栏、双左栏、空间镜头画布、右侧检查器和底部状态栏的结构、边界与层级一致；没有元素重叠或越界。
- 字体与色彩：使用系统中文无衬线字体；除成功/删除等语义色外，保持单一钴蓝强调色；没有渐变或装饰性 CSS 图形。
- 图片与图标：5 张镜头图、2 张参考图和品牌图均为独立 Image2/真实位图资源；界面图标统一使用 Tabler 图标库。
- 状态与交互：镜头选择、提示词编辑、模型/时长选择、锁定、重新生成、删除、缩放、自动编排、导航反馈和拖动节点均已实现。
- 可访问性：控件使用语义化 button、select、textarea、switch；图片有 alt；交互有 focus 样式；支持 reduced-motion。
- 视口韧性：1487 × 1058 与 1100 × 720 均完成截图检查。紧凑视口会隐藏次要状态和自动编排按钮，检查器可滚动，核心流程保持可用。
- 自动验证：Vitest 3/3 通过；TypeScript lint 通过；Vite、后端和 Electron 主进程构建通过。
- 残余差异：Image2 原型属于生成式视觉稿，局部文字行长及人物/场景内容与实现使用的独立生成素材不完全逐像素一致，不影响布局、交互或视觉意图。

final result: passed
