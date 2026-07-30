# API Contract

所有 StoryCanvas API 位于 Toonflow `/api` 下，使用现有 Bearer JWT。业务 UI 不直接调用 FireRed。

## 已实现：健康检查

`GET /api/integrations/openstoryline/health`

响应始终为 HTTP 200；上游不可用是可观察业务状态，不是 Toonflow 进程错误。

```json
{
  "code": 200,
  "data": {
    "service": "openstoryline",
    "status": "degraded",
    "checkedAt": "2026-07-19T14:51:26.076Z",
    "latencyMs": 16,
    "version": "1.0.0",
    "components": {
      "web": { "status": "online", "latencyMs": 16 },
      "mcp": {
        "status": "offline",
        "latencyMs": 10,
        "detail": "connection failed (ECONNREFUSED)"
      }
    }
  },
  "message": "成功"
}
```

语义：

- `online`：FireRed Web 与 MCP 均可达。
- `degraded`：至少一个组件可达，但能力不完整。
- `offline`：两个组件均不可达。

## 已实现：MVP 世界记忆与生成

`GET /api/mvp/generation`

返回生成能力、近期任务和完整 `continuity` 工作区。工作区包含项目记忆版本、实体、事件、切镜关系，以及按 `shotId` 索引的已解析镜头上下文。

`GET /api/mvp/continuity`

单独刷新世界记忆工作区。

`PUT /api/mvp/continuity/shots/:shotId`

更新镜头读取的实体和切镜策略。请求体仅接受：

```json
{
  "entitySlugs": ["barista", "cafe-interior", "coffee-cup-a"],
  "relationType": "same-scene-cut",
  "preserve": ["室内布局", "咖啡杯状态"],
  "matchOn": "object",
  "usePreviousEndFrame": false
}
```

每次成功更新都会递增项目世界版本，并返回重新编译的工作区。

`POST /api/mvp/generation`

除原有生成参数外支持：

```json
{
  "referenceImages": ["data:image/png;base64,..."],
  "contextRevision": 7
}
```

- `referenceImages` 最多 6 张，用于当前镜头绑定的人物、物品、场景和品牌参考。
- `contextRevision` 是客户端最后确认的世界版本；版本已变化时拒绝生成，避免使用过期上下文。
- 服务端在调用模型前重建世界状态、校验镜头契约，并将解析后的上下文写入 `sc_tasks.inputJson` 供审计。
- Base64 参考图不会写入任务 JSON；只记录首帧是否存在和记忆参考图数量。
- 普通切镜默认不使用上一尾帧；`usePreviousEndFrame` 只适用于 `continuous-action`。

## 计划接口

### 编辑会话

- `POST /api/edit-sessions`：需要 `projectId/sourceAssetIds/instruction/idempotencyKey`。
- `GET /api/edit-sessions/:id`：返回当前状态、版本和外部映射摘要。
- `POST /api/edit-sessions/:id/assets`：流式/分片上传或 Hash 登记。
- `POST /api/edit-sessions/:id/commands`：保存并发送自然语言指令。
- `POST /api/edit-sessions/:id/render-preview`：创建预览任务。
- `POST /api/edit-sessions/:id/export`：创建导出任务。
- `POST /api/edit-sessions/:id/cancel`：幂等取消。

### 任务

- `GET /api/tasks/:id`：统一任务快照。
- `POST /api/tasks/:id/retry`：使用原始幂等上下文重试。
- `POST /api/tasks/:id/cancel`：取消外部任务并同步状态。
- `GET /api/tasks/:id/events`：SSE，事件类型 `snapshot/progress/succeeded/failed/cancelled`。

## FireRed 映射

| StoryCanvas | FireRed |
| --- | --- |
| `EditSession.id` | `session_id` |
| `MediaAsset.id` | `media_id` |
| `EditCommand.instruction` | WebSocket `chat.send` |
| `GenerationTask.cancel` | `POST /api/sessions/{id}/cancel` |
| 预览/输出资产 | Tool summary/Artifact + `/api/sessions/{id}/preview` |

FireRed 内部字段不得原样泄露给 UI；Adapter 先校验、映射、脱敏后返回。
