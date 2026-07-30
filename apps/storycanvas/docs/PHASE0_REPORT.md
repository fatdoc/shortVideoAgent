# StoryCanvas AI Phase 0 Report

## 一、两个项目当前运行状态

- Toonflow：依赖安装、严格类型检查、构建、10588 后端启动、默认登录均通过。
- FireRed：依赖安装和 FastAPI 7860 启动通过，可创建 session；MCP 因有意跳过大型 TransNet 权重处于降级状态。
- 集成：Toonflow 能读取 FireRed Web/MCP 组件状态；FireRed 停止时 Toonflow 不崩溃。

## 二、核验到的真实技术结构

- Toonflow：Electron 40 + TypeScript 5.9 + Express 5 + SQLite/Knex + Socket.IO；Agent/Skill/供应商/生成任务均在 Node 主应用。
- Toonflow 当前仓库只有预构建 Web，画布源代码在独立 Toonflow-web。
- FireRed：FastAPI REST/WS + LangChain Agent + MCP 节点服务 + FFmpeg/MoviePy/ASR；无统一 job/timeline REST 模型。

## 三、最终集成架构

Toonflow 是业务数据源和 UI 主应用；OpenStoryline Adapter 将项目、资产、命令和任务映射到 FireRed session/media/WebSocket/Artifact；FireRed 只做 AI 剪辑执行，结果登记回 Toonflow 并形成新版本。

## 四、已创建和修改的文件

- 新增健康 Adapter、Zod Schema、错误映射、路由和 3 个单元测试。
- FireRed 作为固定 submodule 加入。
- 新增 Python 兼容约束、环境变量示例、14 份规定文档及本报告。
- `package.json` 新增 `yarn test`；自动路由表加入健康端点。
- 没有修改 FireRed 核心代码和预构建前端。

## 五、构建与测试结果

- `yarn lint`：通过。
- `yarn test`：3/3 通过。
- `yarn build`：通过。
- `pip check`：通过。
- Toonflow 登录、FireRed session、健康降级/离线演练：通过。

## 六、当前存在的问题

- FireRed 大型资源未下载，MCP 不可启动。
- FireRed 需要 `langgraph-prebuilt==1.0.8` 临时约束。
- LLM/VLM 未配置，无法真实编辑。
- Toonflow-web 尚未固定，暂不能安全开发画布 UI。
- Toonflow 商业补充条款需要在对外产品化前解决。

## 七、下一阶段准备开发的功能

- 显式 Migration 和统一领域 Repository。
- Mock Provider 与可恢复任务中心。
- OpenStoryline 会话、素材、命令、取消、进度和时间线 Adapter。
- 最小服务管理器和模拟编辑任务，不进入完整业务 UI。

## 八、需要配置的环境变量

```bash
OPENSTORYLINE_BASE_URL=http://127.0.0.1:7860
OPENSTORYLINE_MCP_URL=http://127.0.0.1:8001/mcp
OPENSTORYLINE_TIMEOUT_MS=2000
```

真实 FireRed 剪辑另需 `OPENSTORYLINE_LLM_*` 和 `OPENSTORYLINE_VLM_*` 各自的 model/base_url/api_key。

## 九、许可证和商业风险

- Toonflow 并非无附加条件的纯 Apache-2.0；向两个及以上独立第三方提供产品通常要求书面商业授权。
- FireRed 代码为 Apache-2.0，但模型、字体、音乐、素材和第三方 API 条款独立生效。
- 保留两个上游许可证、来源、版权和修改记录。

## 十、下一次建议执行的任务

执行阶段 1 的“领域模型 + Migration + Mock 编辑任务 + FireRed session Adapter”，并在开始 UI 开发前单独固定和审计 Toonflow-web。仍不调用收费模型，先让任务恢复、幂等和错误处理在 Mock 模式完整通过。

