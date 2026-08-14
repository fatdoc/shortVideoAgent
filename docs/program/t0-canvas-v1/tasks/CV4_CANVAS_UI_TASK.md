# CV4 · Canvas UI 工程师任务书

> 员工：`CV4`
> 任务 ID：`T0-CV1-04`
> 前置：`G1 ACCEPTED`
> 目标 Gate：`G3 UI`
> 初始状态：`NOT_STARTED`

## 1. 任务目标

实现简约、受控、面向门店探店视频生产的 Canvas V1。UI 基于冻结合同和 canonical fixtures 开发，不等待后端完成，但不得自行发明接口语义。

## 2. 视觉论点

```text
暖白工作台、真实门店素材主导、单一橙色操作；信息密度高但不炫技。
```
交互论点：

1. 切换镜头时生产链和检查器同步切换；
2. 任务状态只做克制的进度和节点状态过渡；
3. 资产从 Asset Dock 绑定到镜头时提供清晰反馈。

## 3. 独占写集

```text
src/features/canvas-v1/components/**
src/features/canvas-v1/pages/**
src/features/canvas-v1/hooks/**                 # 仅 UI hooks，不实现 transport
src/features/canvas-v1/model/viewState.ts
src/features/canvas-v1/canvas-v1.css
src/features/canvas-v1/**/*.test.tsx
```

合同类型由 CV1 独占；API transport、Router、Bridge、Vite 由 CV5 独占。

## 4. 页面组成

```text
CanvasV1Page
CanvasHeader
ShotRail
ProductionCanvas
ScriptNode
AssetNode
ImageNode
VideoNode
NodeInspector
AssetDock
AssetReadinessPanel
PlaylistStrip
TaskStatusBar
```

## 5. 首日交互

- 切换镜头；
- 查看脚本/分镜事实；
- 查看镜头所需资产；
- 区分真人/虚拟人物；
- 查看授权、批准、Provider、项目绑定状态；
- 打开人物绑定 Drawer；
- 修改允许编辑的提示词、时长和镜头顺序；
- 触发注入的 command handler；
- 展示 queued/running/succeeded/failed；
- 选择候选图片/视频；
- 展示 saving/saved/conflict/offline；
- 刷新后由外部 Bootstrap 恢复。

## 6. 失败体验

未就绪时不能只把按钮变灰，必须显示具体原因，例如：

```text
探店主持人：等待真人授权
店员小王：尚未绑定虚拟人物资产
门店外景：素材已上传，尚未审批
Seedance：Provider capability unavailable
```

UI 不解释技术 Secret，不显示 `asset://`、Grant、Digest、内部 Token、Provider raw body。

## 7. 技术限制

首日使用现有：

```text
React
Zustand（只管理内存 UI view state）
@dnd-kit（镜头顺序）
Framer Motion（克制状态过渡）
原生 img/video
```

首日不引入 React Flow、Konva、PixiJS、Remotion、WebCodecs 或完整时间线 SDK。不得使用 Zustand/LocalStorage 保存业务事实。

## 8. 测试

至少覆盖：

1. canonical fixture 正确渲染；
2. 镜头切换；
3. 未认证人物阻断和原因；
4. ready 状态允许生成；
5. command payload 符合 CV1 fixture；
6. 任务失败不产生资产节点；
7. stale document conflict；
8. keyboard/focus 和基本可访问性；
9. DOM/URL/Storage/console 无 forbidden markers；
10. 不引用旧 `StoryCanvasApp.jsx`/`mvpApi.js` 作为正式 transport。

## 9. 原子提交

```text
CV4-A test(ui): freeze canvas v1 workspace states
CV4-B feat(ui): add canvas v1 shell and shot production chain
CV4-C feat(ui): add asset dock, readiness and playlist strip
CV4-D test(ui): cover command and failure interactions
CV4-E docs(ui): publish G3 evidence
```

## 10. G3 验收

- 关键页面在 1440×900 和 1672×941 可用；
- 一屏可看懂当前镜头、资产缺口、任务和主操作；
- 没有卡片堆砌和炫酷装饰；
- 真实/失败/空/加载/冲突状态齐全；
- component tests 和 root build PASS；
- 不修改 Shared 文件和旧 Demo 实现。

## 11. 启动提示词

```text
你是 CV4，T0-CV1 Canvas UI 工程师。G1 未 ACCEPTED 前只做只读调查。
开工时报告配置、worktree、branch、baseline、Master Plan 版本、exact write set/
no-write set 和计划 RED。先写视觉论点、内容结构和交互论点，再实现。

基于 CV1 canonical fixtures 实现受控门店视频生产画布：镜头列表、当前镜头
生产链、Asset Dock、Readiness、检查器和简单 Playlist。使用 React/Zustand 内存
view state/dnd-kit/Framer Motion，不引入大型画布或时间线引擎。未就绪必须显示
具体原因，不能只禁用按钮。

不实现 transport，不修改 contracts、Router、Bridge、Vite、Control API、
StoryCanvas 后端或 byteplus.ts，不调用旧 /api/mvp/*。按 RED→GREEN→视觉 QA→
回归形成原子提交并申请 G3。
```
