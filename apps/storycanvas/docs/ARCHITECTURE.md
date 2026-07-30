# StoryCanvas AI Architecture

## 目标架构

StoryCanvas 采用“主应用 + 独立剪辑服务 + 明确协议”结构。

```text
Toonflow Electron / prebuilt Web UI
        |
        | REST + Socket.IO/SSE (StoryCanvas contract)
        v
Toonflow Express API + SQLite (business source of truth)
        |
        | OpenStoryline Adapter
        | HTTP REST + WebSocket, timeout/retry/idempotency
        v
FireRed FastAPI Web (session/media/chat)
        |
        | MCP streamable HTTP
        v
FireRed node runtime -> FFmpeg / ASR / timeline / render
```

## 责任边界

### Toonflow 主应用

- 唯一业务数据源：项目、Brief、脚本版本、分镜、资产、任务、编辑会话、时间线版本和导出记录。
- 连续性同样以主应用为事实源：实体记忆、世界事件和镜头契约在服务端编译，不依赖模型自行回忆上一个镜头。
- 负责 Electron 生命周期、用户交互、画布、模型配置、生成任务和本地资产索引。
- API Key 仅存在于主进程安全存储/服务端配置，不进入渲染进程和日志。
- 对 FireRed 不可用进行降级，不让主应用崩溃。

### OpenStoryline Adapter

- 只暴露 StoryCanvas 领域接口，屏蔽 FireRed session、WebSocket 事件和 Artifact 的内部格式。
- 建立 `projectId/editSessionId/assetId/taskId` 与 `session_id/media_id/artifact_id` 的映射。
- 统一错误、超时、重试、幂等、取消、任务进度和版本产物。
- 当前阶段只实现健康检查；任务、素材和时间线映射在下一阶段添加。

### FireRed 独立服务

- 负责素材理解、镜头切分、ASR、口播粗剪、字幕、BGM、重排、时间线和渲染。
- 只维护技术性会话/Artifact，不维护 StoryCanvas 业务项目。
- 产出的预览、字幕、时间线和 MP4 必须登记回 Toonflow，形成新版本。

## 数据与版本原则

- 原始素材不可覆盖。
- 每次 AI 操作创建新的 `GenerationTask` 或 `EditCommand`。
- 每次剪辑结果创建新的 `TimelineVersion` 和预览资产。
- 接受结果只移动“当前版本指针”，不删除旧版本。
- 所有跨服务响应先经 Zod 校验再进入数据库。
- 世界状态只通过有序事件推进；镜头生成前必须满足契约声明的开始状态。
- 切镜负责叙事衔接，人物/物品/场景记忆负责身份衔接；上一尾帧只作为连续动作的可选参考。

## 推荐目录结构

```text
StoryCanvas-AI/
├── src/                              # Toonflow 主应用
│   ├── integrations/openstoryline/   # 类型、Schema、Client、Mapper、轮询器
│   ├── domain/storycanvas/           # 统一领域模型与服务
│   └── routes/                       # StoryCanvas 统一 API
├── data/                             # Toonflow 运行数据与预构建 UI
├── migrations/                       # 新增的显式、可回滚 Migration
├── integrations/openstoryline/       # Python 约束、启动/诊断脚本
├── upstream/
│   └── FireRed-OpenStoryline/        # 固定 Commit 的 Git submodule
├── docs/
└── README.md
```

UI 阶段建议将已固定版本的 `Toonflow-web` 作为单独 submodule 或 fork 引入 `upstream/Toonflow-web`，构建产物再复制到 `data/web`。不得直接修改压缩后的 `data/web` 文件。

## 可靠性

- HTTP 默认 2 秒健康检查、业务请求按任务类型单独设置超时。
- 查询重试使用指数退避和 jitter；创建类请求必须带幂等键。
- 大文件走流式/分片上传；Hash 去重后只登记映射。
- 应用重启时从 Toonflow 任务表恢复非终态任务，再查询外部状态。
- SSE 用于 Toonflow UI 任务进度；Adapter 内部可消费 FireRed WebSocket。

## 安全

- 服务默认只监听 `127.0.0.1`。
- 所有本地路径通过 `path.resolve`、项目根校验和随机存储名防路径穿越。
- 媒体读取只允许项目隔离目录和显式白名单。
- API Key 使用 Electron `safeStorage` 或操作系统钥匙串；SQLite 只存密钥引用。
- 日志对 Authorization、API Key、JWT 和上传原文件名做脱敏。
