# Upstream Audit

## 结论

两个项目不能直接“代码合并”。Toonflow 是 Electron/Express/SQLite 主应用，FireRed 是 FastAPI Web 会话层加本地 MCP 节点执行器。二者状态、任务和 API 语义不一致，必须由 StoryCanvas Adapter 做协议转换。

另一个关键事实是：当前 `Toonflow-app` 只包含预构建前端 `data/web`，无限画布的可编辑前端源码位于独立的 `Toonflow-web` 仓库。阶段 0 不改预构建产物；进入 UI 阶段前必须单独审计并固定 `Toonflow-web`。

## Toonflow 真实结构

### 技术栈与启动

- Node.js：README 要求 23.11.1+，本轮使用 24.18.0；`package.json.engines` 的 `>=1.0.0` 不可信。
- TypeScript 5.9，`strict: true`、`noImplicitAny: true`。
- Express 5.2、Socket.IO 4.8、SQLite（Knex + better-sqlite3）、Electron 40。
- `yarn dev` 启动后端 10588；`yarn dev:gui` 启动 Electron；`yarn build` 生成 `build/app.js`、`build/main.js`。
- `src/app.ts` 当前把非 Electron 后端端口写死为 10588，README 中的 `PORT` 并未在该路径生效。

### 核心目录

- `src/agents/scriptAgent`：剧本 Agent。
- `src/agents/productionAgent`：生产/分镜 Agent 与 Zod 工具模型。
- `data/skills`：文件化 Skill 与导演、风格提示词。
- `src/routes/project`、`script`、`production`、`assetsGenerate`、`task`：主业务 API。
- `src/socket`：Agent 实时通道。
- `src/lib/initDB.ts`：SQLite 初始结构；`src/lib/fixDB.ts`：历史修复式迁移。
- `data/vendor`、`src/utils/vendor.ts`：可编程模型供应商机制。
- `data/web`：预构建前端，不是可维护的画布源码。

### 数据库和画布

当前数据库有 26 张业务/系统表。与 StoryCanvas 最相关的是：

- `o_project`：项目和默认图片/视频模型。
- `o_script`：脚本文本；没有版本表。
- `o_storyboard`：分镜、提示词、图片路径、时长、轨道和状态。
- `o_image`、`o_video`、`o_videoTrack`：生成结果与视频轨道。
- `o_assets` 及关联表：角色、场景、道具等资产。
- `o_agentWorkData`：画布/Agent 结构化数据的 JSON 持久化入口。
- `o_tasks`：已有任务表，但状态、成本、幂等和任务输入输出不足以直接满足 StoryCanvas。
- `o_vendorConfig`：供应商配置 JSON。

画布数据经 `production/getFlowData.ts` 和 `saveFlowData.ts` 在 `o_agentWorkData`、`o_storyboard` 等表之间映射。必须沿用此入口，而不是建立第二套画布数据库。

### 图片、视频与导出

- 图片生成路径：`src/routes/assetsGenerate`、`src/routes/production/storyboard`、`src/utils/ai.ts`。
- 视频生成路径：`src/routes/production/workbench/generateVideo.ts` 及批量、轮询接口。
- 供应商通过 `data/vendor/*.ts` 和统一模型工具加载，不应在新 UI 中直接调用第三方 API。
- 当前工作台提供视频轨道、片段选择和生成入口，但不是 FireRed 式自然语言剪辑任务模型。

## FireRed-OpenStoryline 真实结构

### 技术栈与启动

- Python >=3.11；本轮使用 3.11.15。
- FastAPI 0.128、Uvicorn 0.40、LangChain/LangGraph、MCP 1.26。
- FFmpeg/MoviePy/PyAV 负责渲染；FunASR/Torch/Torchaudio 负责本地 ASR；TransNetV2 负责镜头切分。
- Web 默认 7860；本地 MCP 默认 8001 `/mcp`。
- `run.sh` 同时启动 MCP 与 FastAPI。

### 核心目录

- `agent_fastapi.py`：Web、REST、WebSocket、会话与素材上传。
- `src/open_storyline/agent.py`：LangChain Agent。
- `src/open_storyline/mcp`：MCP Server、工具注册、采样与拦截器。
- `src/open_storyline/nodes/core_nodes`：素材加载、切镜、理解、筛选、分组、脚本、配音、BGM、时间线、转场、渲染。
- `src/open_storyline/storage`：会话/Artifact 文件存储，不是业务项目数据库。
- `.storyline/skills`：默认剪辑、口播粗剪、转场、字幕仿写等 Skill。
- `web`：原生演示 UI。

### 原生 API

已有 REST/WS 能力：

- `POST /api/sessions`、`GET /api/sessions/{id}`。
- 会话清理与取消。
- 普通和分片素材上传、待处理素材、素材文件/缩略图。
- 安全的本地预览文件读取。
- `WS /ws/sessions/{id}/chat` 多轮自然语言编辑。

缺失的 StoryCanvas 统一 API：

- 没有专用 `/health`。
- 没有稳定的 `edit-session/job/task/timeline/export` REST 资源模型。
- 没有 Toonflow `projectId/assetId/taskId` 语义。
- 没有供业务 UI 直接订阅的统一任务事件契约。

因此 UI 不得依赖 FireRed 内部会话 JSON 或 MCP 节点输出。

## 可直接复用与必须适配

### Toonflow 直接复用

- Electron 生命周期、本地服务启动、SQLite、登录和静态资源服务。
- 项目、脚本、资产、分镜、图片、视频、轨道和画布持久化入口。
- ScriptAgent/ProductionAgent、Skill 管理、供应商配置、Socket.IO。
- 现有图片/视频生成和任务轮询能力。

### FireRed 通过 API 使用

- 会话创建/恢复、素材注册与上传、WebSocket 对话。
- 素材理解、口播粗剪、字幕、BGM、时间线、渲染和自然语言二次编辑。
- Artifact 与渲染结果只作为服务输出，随后登记回 Toonflow 资产表。

### 必须由 Adapter 解决

- Toonflow 项目/资产 ID 到 FireRed session/media ID 的映射。
- REST + WebSocket 到统一任务状态/SSE 的映射。
- FireRed 节点/Artifact 输出到 `TimelineVersion`、字幕和预览资产。
- 超时、重试、幂等、取消、错误脱敏和服务降级。
- 项目隔离目录、Hash 去重、跨平台路径与文件访问边界。

