# Integration Plan

## 总体策略

以 Toonflow 为主工作树，FireRed 作为固定 submodule 和独立进程。新增代码优先放在 `src/integrations/openstoryline`、领域服务和新路由中；不向 Electron 渲染进程嵌入 Python，不让 UI 读取 FireRed 文件系统。

## 阶段 0 已完成

- 固定两个上游 Commit 和开发分支。
- Toonflow 安装、类型检查、构建、后端启动与登录验证。
- FireRed requirements、导入、Web 服务、会话 API 验证。
- 记录 FireRed MCP 因跳过大型权重而降级。
- 新增 `GET /api/integrations/openstoryline/health`。
- 证明 FireRed 下线时 Toonflow 不崩溃。

## 下一阶段 Adapter 分解

1. `schemas.ts/types.ts`：统一请求、响应和任务事件。
2. `client.ts`：REST、分片上传、WebSocket 会话。
3. `mapper.ts`：项目/资产/会话/Artifact/时间线映射。
4. `task-poller.ts`：把 FireRed 流式事件转换为统一任务进度。
5. `idempotency.ts`：创建会话、上传、命令和导出的幂等键。
6. `error-mapper.ts`：网络、配置、模型、渲染和用户输入错误。
7. `service-manager.ts`：Electron 启停、端口探测和退出清理。

## 统一 API 计划

- `GET /api/integrations/openstoryline/health`：已完成。
- `POST /api/edit-sessions`：创建 Toonflow 记录并懒创建 FireRed session。
- `GET /api/edit-sessions/:id`：返回 Toonflow 状态和最新版本。
- `POST /api/edit-sessions/:id/assets`：Hash 去重后分片上传/登记。
- `POST /api/edit-sessions/:id/commands`：保存指令并发往同一 FireRed session。
- `POST /api/edit-sessions/:id/render-preview`：创建非破坏式预览任务。
- `POST /api/edit-sessions/:id/export`：创建导出任务和最终资产。
- `POST /api/edit-sessions/:id/cancel`：取消当前外部 turn/任务。
- `GET /api/tasks/:id`、`GET /api/tasks/:id/events`：统一查询与 SSE。

## Toonflow 复用模块

- `src/app.ts`、`scripts/main.ts`：服务与 Electron 生命周期。
- `src/lib/initDB.ts`、`src/utils/db.ts`：SQLite 初始化/访问。
- `src/routes/project`、`script`、`production`：项目、脚本、分镜、画布和轨道。
- `src/routes/assets`、`assetsGenerate`：素材登记和生成任务。
- `src/agents`、`data/skills`：Agent/Skill。
- `src/utils/vendor.ts`、`data/vendor`：供应商抽象。
- `src/socket`：现有实时通信，后续统一到任务事件服务。

## 第一阶段建议修改/新增文件

当前已新增：

- `src/integrations/openstoryline/{client,types,schemas,error-mapper,index}.ts`
- `src/routes/integrations/openstoryline/health.ts`
- `src/integrations/openstoryline/client.test.ts`
- `integrations/openstoryline/requirements.constraints.txt`
- `.gitmodules`、`.env.example` 和阶段 0 文档。

阶段 1 预计新增/修改：

- `src/integrations/openstoryline/{mapper,task-poller,service-manager,idempotency}.ts`
- `src/domain/storycanvas/{project,asset,task,edit-session,timeline}.ts`
- `src/routes/edit-sessions/**`、`src/routes/tasks/[id]/**`
- `migrations/001_storycanvas_core.ts`
- `scripts/openstoryline/{install,start,doctor}.ts`
- `scripts/main.ts`（只增加独立服务生命周期，不嵌入 Python）。
- `package.json`（开发/测试/服务诊断脚本）。

阶段 2 UI 文件在固定 `Toonflow-web` 后另列，当前不修改预构建 `data/web`。

## 验收门槛

- FireRed Web/MCP 在线时返回 `online`；任一组件故障时返回 `degraded`；均不可达时返回 `offline`。
- 任何 FireRed 网络/协议错误均不会终止 Toonflow。
- 模拟编辑任务进度可在重启后恢复。
- 所有跨服务 JSON 均经 Zod 校验。
- 不调用收费模型即可运行单元和集成测试。

