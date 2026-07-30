# Test Report

执行日期：2026-07-20。

## 自动测试

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| TypeScript 严格检查 | `yarn lint` | 通过 |
| 配置层 + 领域层 + Migration + Adapter 单元测试 | `yarn test` | 17/17 通过 |
| 模型供应商与 Agent 同步 | `yarn models:seed` | 2 个供应商、16 个 Agent，通过 |
| 模型安全诊断 | `yarn models:doctor` | 通过；缺 Key 项安全跳过 |
| 后端/Electron 构建 | `yarn build` | 通过 |
| Migration 状态 | `yarn db:status` | `APPLIED 001_storycanvas_core` |
| FireRed Python 依赖 | `.venv/bin/pip check` | 通过 |
| FireRed 配置加载 | `load_settings('config.toml')` | 通过 |
| FireRed Web 导入 | `import agent_fastapi` | 固定约束后通过 |

Adapter 单元测试覆盖：

1. Web + MCP 可达 => `online`。
2. Web 可达、MCP 不可达 => `degraded` 且不抛错。
3. Web + MCP 不可达 => `offline` 且不抛错。

阶段 1 新增测试覆盖：

1. `config/models.json` 严格 Zod 校验和未知字段拒绝。
2. 同一 OpenAI 供应商按文本/图片角色注入不同环境变量。
3. 供应商种子和 16 个 Agent 绑定。
4. 环境变量中的 API Key 值不会写入 SQLite。
5. `gpt-image-2` 竖图请求路径、模型、尺寸、质量和输出格式契约。
6. 图片 Adapter 日志不包含 API Key。

所有图片契约测试均使用本地模拟响应，没有向 OpenAI 或火山引擎提交生成任务。

阶段 2 新增测试覆盖：

1. CreativeBrief 本地生活字段、平台枚举和 strict 未知字段拒绝。
2. AI/Mock 素材必须保留 `provider/prompt`。
3. 分镜总时长领域校验。
4. 11 张 `sc_*` 表创建与幂等重复执行。
5. Migration checksum 漂移拒绝。
6. Migration 回滚不影响任何 `o_*` 上游表。
7. Migration 中途失败时 Schema 和登记行全部事务回滚。
8. 项目媒体八类隔离目录创建。
9. UUID/扩展名白名单与路径穿越拒绝。
10. 文件 SHA-256 稳定计算。

## 运行验证

- Toonflow 后端在 10588 启动成功。
- 默认登录 API 返回 200。
- FireRed FastAPI 在 7860 启动成功，主页返回 200。
- FireRed `POST /api/sessions` 成功创建会话。
- Toonflow 健康接口在 FireRed Web 在线/MCP 离线时返回 `degraded`。
- 关闭 FireRed 后同一接口返回 `offline`，Toonflow 登录仍成功。
- 阶段 1 修改后，生产入口重新启动成功，登录 API 返回 200。
- 生产入口的 OpenStoryline 健康接口返回 HTTP 200；FireRed 未启动时业务状态为 `offline`。

## 已知未通过/未执行

- FireRed MCP 因本轮不下载 TransNet 大型权重而启动失败，错误为缺少 `.storyline/models/transnetv2-pytorch-weights.pth`。
- 未配置 LLM/VLM API Key，未执行真实 AI 编辑。
- 未执行收费图片/视频模型调用。
- 未做完整 Electron 窗口人工 UI 验收。
- 阶段 3-4 的 Mock 生成、任务 SSE 和端到端测试尚未开发，符合当前进度。

## 下一阶段测试增量

- 任务幂等、重试、取消、恢复和成本计算单测。
- Mock Provider 图片/视频产物验证。
- Adapter 会话、素材、命令、取消和失败恢复集成测试。
- Mock Provider 从 Brief 到测试 MP4 的端到端测试。
