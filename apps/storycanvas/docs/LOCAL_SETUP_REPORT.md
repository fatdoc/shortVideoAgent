# Local Setup Report

验证日期：2026-07-19。平台：macOS 26.5（Darwin 25.5.0），Apple Silicon arm64。

## 工具链

| 工具 | 初始状态 | 本轮最终状态 |
| --- | --- | --- |
| Node.js | 20.19.6，不满足 Toonflow README | 24.18.0 |
| Yarn | 1.22.22 | 1.22.22 |
| Python | 系统 3.10.11；另有 3.11 | 使用 3.11.15 创建仓库内 `.venv` |
| FFmpeg | 缺失 | 8.1.2，Homebrew 安装 |
| wget | 缺失 | 1.25.0，Homebrew 安装 |
| Git | 2.50.1 | 2.50.1 |
| Docker | 28.4.0 | 未用于本轮启动 |

## Toonflow 验证

执行：

```bash
nvm use 24
yarn install --frozen-lockfile
yarn lint
yarn build
NODE_ENV=dev yarn dev
```

结果：

- 依赖安装通过；Electron 下载使用 npmmirror 镜像后完成。
- `tsc --noEmit` 通过。
- `build/app.js` 与 `build/main.js` 构建通过。
- 后端真实监听 `http://localhost:10588`。
- 默认 `admin/admin123` 登录 API 返回 200。
- 本轮没有收费模型调用。

注意：当前验证的是 Toonflow 后端、Electron 主进程构建和登录链路；没有做 Electron 窗口级人工 UI 验收。阶段 2 修改前端时必须引入并审计 `Toonflow-web` 后再做桌面端视觉验证。

## FireRed 验证

执行：

```bash
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m pip install -c ../../integrations/openstoryline/requirements.constraints.txt \
  langgraph-prebuilt==1.0.8
.venv/bin/pip check
PYTHONPATH=src .venv/bin/python -c "import agent_fastapi"
PYTHONPATH=src .venv/bin/python -m uvicorn agent_fastapi:app --host 127.0.0.1 --port 7860
```

结果：

- requirements 安装完成，`pip check` 通过。
- 原始解析会安装 `langgraph-prebuilt 1.0.10`，与 `langgraph 1.0.10` 运行时不兼容；固定 `langgraph-prebuilt==1.0.8` 后导入成功。
- FastAPI Web 服务真实监听 `127.0.0.1:7860`；主页 200；`POST /api/sessions` 成功。
- MCP 启动会在实例化 `SplitShotsNode` 时因缺少 `.storyline/models/transnetv2-pytorch-weights.pth` 失败。
- 按任务要求没有执行 `download.sh`，因此 TransNet 权重、BGM、字体等大型资源包未下载。
- LLM/VLM API Key 为空；服务可启动和建会话，但不能执行收费/模型驱动编辑。

结论：FireRed Web 是 **可启动**；完整 MCP 剪辑能力是 **degraded**，阻塞条件为有意跳过的大型资源包和模型配置，不应标记为完整可用。

## 集成健康检查

- FireRed Web 在线、MCP 离线时：Toonflow 返回 `status=degraded`，Web `online`、MCP `offline`。
- FireRed Web 停止时：Toonflow 返回 `status=offline`，主服务与登录仍正常。
- 健康检查不创建收费任务、不读取 API Key、不让上游错误导致 Toonflow 崩溃。

