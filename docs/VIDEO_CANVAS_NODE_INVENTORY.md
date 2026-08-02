# 视频画布节点清单

## 1. 结论

当前画布不是 React Flow、节点工作流或可执行拓扑。真正的画布节点只有“镜头节点”和“参考节点”；屏幕连线为 CSS 装饰，节点拖动不会改变业务顺序。

## 2. 节点表

| 节点类型 | 显示名称 | 对应代码 | 输入 | 输出 | 是否真正可用 | 是否绑定业务数据 |
|---|---|---|---|---|---|---|
| ShotNode | 镜头卡 | `src/features/storycanvas/StoryCanvasApp.jsx:388` | canonical Shot、本地 Shot、状态、Prompt、媒体 | 选择、视觉拖动、触发生成 | 部分；canonical 仅两个 Demo 案例 | 是，绑定 Shot/Task/Asset 字段 |
| ReferenceNode | 参考图 | `StoryCanvasApp.jsx:437` | Continuity Reference、Entity、sourceUri | 只读展示 | 展示可用 | 是，绑定 reference/entity |
| 加载占位 Shot | 加载 canonical production package | `StoryCanvasApp.jsx`初始化 | projectId、Grant、API 状态 | 错误或真实镜头替换 | API 离线时仅占位 | 否，临时前端对象 |

## 3. 镜头节点字段

```text
id, internalId, externalId, order, section, title, shortTitle,
duration, range, status, imagePrompt, videoPrompt, description,
screenText, sourceType, riskLevel, contractStatus, matchStatus,
assignee, assetId, progress, mediaType, mediaUrl, truthMode,
generatedImageTaskId, generatedImageUrl, error
```

canonical 映射函数：`productionShotsToCanvas()`，位于 `src/features/storycanvas/StoryCanvasApp.jsx:111`。

## 4. 业务对象关系

| 前端字段 | 后端/业务对象 | 说明 |
|---|---|---|
| `externalId` | Package Shot ID，如 `shot-07` | 确定性案例选择使用 |
| `internalId` | `o_storyboard.id`或映射后的内部 ID | 真实任务 API 优先使用 |
| `id` | `shot.order` | 前端显示顺序，不是数据库主键 |
| `assetId` | Asset Receipt/Media Asset | 可能为空或未批准 |
| `generatedImageTaskId` | `sc_tasks.id` | 旧 MVP 生成任务 |
| `mediaUrl` | 任务输出媒体 | canonical Receipt 转换当前可能缺失 |

本地“新增章节”只生成递增前端 `id`，没有稳定 `internalId/externalId`，刷新后丢失。

## 5. 画布区域和卡片

| 区域 | 真实作用 |
|---|---|
| 顶部栏 | 项目、Package、Truth Mode、API 状态、缩放、生成入口 |
| 主导航 | 项目、脚本、画布、记忆、素材 |
| 左侧脚本大纲 | 镜头选择、时间范围和本地新增章节 |
| 中央故事线 | 横向镜头卡和参考图集群 |
| 右侧检查器 | Prompt、类型、模型状态、时长、结果、错误、锁定、删除 |
| 底部状态栏 | 总时长、镜头数、Truth 统计、任务进度、视觉撤销重做 |
| Project Workspace | 项目和镜头概览 |
| Script Workspace | 镜头文字编辑，当前只同步 React State |
| Memory Workspace | 镜头契约、实体、状态和世界事件，canonical 只读 |
| Asset Workspace | 参考、Mock、Real-Cap 媒体卡与定位 |
| Character Workspace | 角色设定板代码存在，当前导航不可达 |

## 6. 连线逻辑

- `.story-line`是 CSS 横线。
- `.reference-branches`是 CSS 参考图分支线。
- 没有 Edge、Handle、source/target、`onConnect`、邻接表或拓扑排序。
- 没有分支、循环、非法连接校验或连线持久化。
- ShotNode 的 Framer Motion `drag`没有 `onDragEnd`、排序更新或保存 API。
- 拖动只改变当前视觉位置，不改变 `shots[]`顺序、`order`或生成顺序。
- Continuity Relation 表达 `continuous-action`等镜头语义，不是画布连线。

## 7. 删除、保存和历史

- `deleteSelected()`只过滤 React `shots`数组。
- 删除不调用后端，不删除素材、任务、回执或数据库镜头。
- 刷新后 canonical 镜头会重新加载。
- 无画布保存按钮，无自动保存。
- 撤销/重做按钮没有 `onClick`和历史栈，只是视觉文案。
- 保存失败没有统一提示，因为镜头布局和编辑没有真实保存链。

## 8. canonical 生成可用性

| 镜头 | 类型 | 案例 | 当前结果 |
|---|---|---|---|
| `shot-07` | image | success | 固定 Task、Asset、Export Receipt Demo |
| `shot-05` | video | failure | 固定失败 Task，不生成假 Asset |
| 其他镜头 | image/video | legacy disabled | 返回 `LEGACY_MODE_DISABLED` |

旧单镜生成、批量生成和合并导出函数仍在，但 canonical `mvpApi`明确禁用。

