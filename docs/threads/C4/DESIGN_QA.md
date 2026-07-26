# C4 图 4 第二轮 Design QA

- source visual truth: `UI/ChatGPT Image Jul 23, 2026, 12_32_30 PM (4).png`
- implementation route: `/projects/demo-local-001/script`
- implementation screenshot: `/Users/docfat/.codex/visualizations/2026/07/26/019f9c05-6b2f-7692-9479-4c778514f573/c4-wave2-final-1672x941.png`
- responsive screenshot: `/Users/docfat/.codex/visualizations/2026/07/26/019f9c05-6b2f-7692-9479-4c778514f573/c4-wave2-final-1440x900.png`
- viewport: 1672×941（主对照）；1440×900（裁切检查）
- pixels / CSS / density: source 1672×941；implementation 1672×941 CSS px；density 1；无需归一化缩放
- state: Demo 项目、版本 A、无本地脏稿、五段脚本默认展开

## Full-view comparison

参考图与实现截图在同一比较输入中并排检查。最终实现保持与参考图一致的首屏层级：项目头在上，A/B/C 左栏、五段脚本文档中栏、事实/规则/风险/评分右栏同时可见。全局壳层沿用 Gate 2 基线，未越权修改。

## Focused regions

原图与实现均以 1672×941 原始分辨率检查，顶部、左栏、中栏、右栏文字和控件可直接辨读，因此未另做低清裁切。重点测量实现主布局为 x=244—1648、y=196—909，列宽 276 / 688 / 420px。

## Fidelity surfaces

- typography: 保留项目既有 Ant Design / 中文系统字体；标题 20px、区块标题 14px、小型元数据 10—11px，层级与原图接近，无异常换行。
- spacing and layout: 去除额外说明条和版本摘要卡；主布局高 713px，关键内容全部进入 941px 首屏。
- colors and tokens: 继续使用 `#1677ff` 主色、白色卡面、`#f5f7fa` 背景、轻边框与低阴影；状态色仅用于当前版本、风险和评分。
- image quality: 目标业务区无独立图片资产；图标全部来自项目现有 Ant Design Icons，未引入占位图或自制 SVG。
- copy and content: 标题、场景、受众、时长、语言、事实来源、品牌规则均改为图 4 对应业务语义；动态脚本文案继续来自统一 Demo。
- interactions: 保留 A/B/C、五段编辑、事实绑定、评论、Mock 生成、保存、保存失败保护、reset 同步和进入分镜。
- accessibility: 交互使用原生 button / Ant 控件；被视觉收起的事实说明保留为 screen-reader-only 文本。
- responsiveness: 1440×900 下 `scrollWidth = clientWidth = 1440`，主布局右边界 1416px，无横向裁切。

## Comparison history

### Baseline: `4e708d0`

- P1: 页面总高 1459px，五段脚本与右侧评分无法同时进入 941px 首屏。
- P1: 顶部拆成摘要卡、独立操作区和 Mock/Store 说明条，项目标题与业务元数据不符合图 4。
- P1: 三栏比例约 260 / 800 / 320px，中栏过宽、右栏过窄。
- P2: 版本摘要大卡、脚本块事实描述、空评论文案和事实卡片重复信息造成噪声。

### Final

- 顶部合并为 108px 项目头，移除说明条。
- 三栏调整为 276 / 688 / 420px。
- 五段编辑压缩为可滚动文档行，事实语义保留但不重复展示。
- 事实引用改为紧凑行；品牌规则、风险、评分恢复参考图的信息顺序和比例。
- 1672×941 与 1440×900 复核均无可执行 P0/P1/P2。

## Remaining P3

- 全局侧栏与顶栏的尺寸、文案和搜索框不同于参考图；属于 C0/C1 公共壳层且明确禁止 C4 修改。
- 动态 Demo 的评分与部分脚本文案不逐字等同参考图，但不改变页面比例、业务分区或老板演示路径。

## Verification

- C4 targeted tests: 2 files / 13 tests passed.
- lint: passed.
- build: passed；仅保留仓库既有 chunk size warning.

final result: passed
