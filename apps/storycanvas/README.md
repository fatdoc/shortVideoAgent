# StoryCanvas AI

StoryCanvas AI 是一站式 AI 短视频创作平台。当前项目以 Electron、TypeScript、Express 和 SQLite 承载项目、分镜、资产与任务数据，并通过独立的 FireRed-OpenStoryline 服务完成视频理解、粗剪和导出。

目标流程：

```text
对话需求 -> 创意/脚本 -> 分镜画板 -> 图片/视频生成
-> AI 粗剪 -> 自然语言修改 -> 非破坏式版本 -> MP4 导出
```

## 当前进度

- 阶段 0：上游审计、版本固定、健康检查与接口边界已完成。
- 阶段 1：统一模型配置、运行时密钥注入和图片模型适配已完成。
- 阶段 2：11 张 `sc_*` 业务表、迁移、领域 Schema 与媒体路径服务已完成。
- 真实媒体 MVP：导演画布已接入火山 Seedream/Seedance 服务端任务，支持真实状态轮询、SQLite 恢复、结果回填和可重试失败提示。
- 尚未完成：有效模型凭证下的成功产物验收、自动剪辑与最终 MP4 导出闭环。
- 独立 TTS：已落默认关闭的 BytePlus 协议端口、配置门禁、幂等与错误映射；真实协议和凭据未提供前不发起调用，详见 `docs/BYTEPLUS_TTS_PORT.md`。

完整状态见 `docs/当前开发内容.md`，执行顺序见 `docs/后续开发规划.md`。

## 架构

- Electron/TypeScript 主应用是项目、画布、资产和任务的唯一业务数据源。
- FireRed-OpenStoryline 作为独立的 FastAPI、MCP、FFmpeg 剪辑服务。
- `src/integrations/openstoryline` 负责协议、健康状态、错误和任务映射。
- `config/models.json` 管理模型角色；密钥仅从环境变量读取。
- `migrations` 与 `src/domain/storycanvas` 定义统一数据结构。

详细设计：

- `docs/ARCHITECTURE.md`
- `docs/INTEGRATION_PLAN.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`

## 环境要求

- Node.js 23.11.1+，推荐 Node.js 24
- Yarn 1.22.x
- Python 3.11+
- FFmpeg、wget、Git
- macOS、Linux；Windows 路径兼容会在后续阶段持续验证

## 安装与检查

```bash
nvm use 24
yarn install --frozen-lockfile
yarn models:seed
yarn models:doctor
yarn db:migrate
yarn db:status
yarn lint
yarn test
yarn build
```

## 运行桌面应用

```bash
nvm use 24
yarn dev:gui
```

`dev:gui` 会先执行 `sanitize:web`，确保仓库入口、外部推广、社群二维码和 Star 引导不会重新进入桌面界面。

### 真实图片/视频 MVP

在项目根目录创建 `.env`（该文件已被 Git 忽略）：

```bash
MODELS_CONFIG_PATH=config/models.json
MODELS_AUTO_SEED=1
ARK_BASE_URL=https://ark.ap-southeast.bytepluses.com/api/v3
ARK_API_KEY=你的海外 BytePlus ModelArk API_KEY

# 独立 TTS 与视频音轨不是同一授权；协议核验并单独开通前保持关闭
BYTEPLUS_TTS_ENABLED=false
BYTEPLUS_TTS_PROTOCOL=
```

启动后进入画布：

1. 选择镜头；
2. 在右侧选择“图片”或“视频”；
3. 编辑对应提示词并提交；
4. 任务状态会写入 `sc_tasks`，成功产物写入本地 `data/oss/mvp/`；
5. 服务端只返回密钥是否已配置，不会把密钥值发到渲染进程。

当前画布中的初始图片明确标记为“示例图”；只有服务端任务成功后才标记为“已生成”。

## FireRed 最小启动

```bash
cd upstream/FireRed-OpenStoryline
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m pip install -c ../../integrations/openstoryline/requirements.constraints.txt \
  langgraph-prebuilt==1.0.8
PYTHONPATH=src .venv/bin/python -m uvicorn agent_fastapi:app \
  --host 127.0.0.1 --port 7860
```

配置主应用：

```bash
export OPENSTORYLINE_BASE_URL=http://127.0.0.1:7860
export OPENSTORYLINE_MCP_URL=http://127.0.0.1:8001/mcp
export OPENSTORYLINE_TIMEOUT_MS=2000
```

登录后可调用：

```text
GET /api/integrations/openstoryline/health
```

状态为 `online`、`degraded` 或 `offline`；剪辑服务停止不会导致主应用崩溃。

## 隐私与密钥

- API Key 不写入新增配置、源码或 SQLite。
- `.env.example` 只保存变量名，不保存真实密钥。
- `models:doctor` 默认不联网；只有显式添加 `--live --require-keys` 才进行真实服务检查。

## 许可证

本项目保留原始许可证、补充条款和第三方声明。商业使用或对外分发前，请阅读根目录 `LICENSE`、`NOTICES.txt` 与 `docs/LICENSE_AUDIT.md`。
