# Unified Data Model

## 领域模型

StoryCanvas 领域层使用 UUID、ISO 8601 时间和 Zod 校验。核心对象：

- `VideoProject`：关联 Toonflow `o_project`，包含状态和本地生活 Brief。
- `ScriptVersion`：不可变脚本版本，包含标题、钩子、旁白和分段。
- `Scene`、`Shot`：场景与分镜；Shot 包含素材策略、提示词、锁定和生成状态。
- `MediaAsset`：统一上传/生成/FireRed 输出及 Hash、版权、技术元数据。
- `GenerationTask`：统一异步任务、状态、输入输出、成本和幂等键。
- `EditSession`、`EditCommand`：FireRed 会话映射和所有自然语言修改历史。
- `TimelineVersion`：不可变时间线版本和当前版本指针。
- `ContinuityProfile`：项目级视觉规则与单调递增的世界版本。
- `ContinuityEntity`：人物、物品、场景和品牌的稳定身份、外观版本与初始状态。
- `WorldEvent`：按镜头顺序记录前置条件和状态变化。
- `ShotContract`：声明镜头读取的实体、开始状态、状态变化、摄影和切镜关系。

枚举：

```ts
type ProjectStatus =
  | "draft" | "planning" | "storyboarding" | "generating"
  | "editing" | "reviewing" | "exported" | "failed";

type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

type MaterialStrategy = "real-footage" | "ai-image" | "ai-video" | "stock" | "mixed";
```

关键规则：

- `CreativeBrief.platform` 仅允许 `douyin/xiaohongshu/kuaishou/wechat-video`。
- `durationSeconds` 第一阶段 5-180 秒；Shot 时长之和由领域服务校验。
- `MediaAsset.localPath` 不能直接接受用户路径，必须由资产服务生成并验证。
- AI 画面必须保留 `source/provider/prompt`，真实素材不能被自动替换为 AI 画面而不提示。
- 所有跨服务 JSON 使用 `strict` Zod Schema；附加供应商字段进入 `metadata`。

## 与 Toonflow 现有表的组合

- `o_project` 继续保存主项目记录；新增一对一 `sc_project_profile`。
- 每个脚本版本创建新的 `o_script` 行；`sc_script_versions` 记录版本号和结构化 JSON。
- `o_storyboard` 继续作为画板分镜核心；`sc_shot_metadata.storyboardId` 扩展本地生活/素材策略字段。
- `o_image/o_video/o_assets` 继续保留上游生成结果；`sc_media_assets` 提供统一资产协议和外键映射。
- StoryCanvas 新任务以 `sc_tasks` 为准；必要时通过 `legacyTaskId` 关联 `o_tasks`。
- FireRed session/media/artifact ID 只存在于 `sc_external_mappings` 和编辑会话表。

## Migration 实现

已通过 `001_storycanvas_core` 新增前缀 `sc_`，避免与上游表冲突：

1. `sc_migrations(version, appliedAt, checksum)`。
2. `sc_project_profile(projectId PK/FK, category, status, briefJson, currentScriptVersionId, currentTimelineVersionId, createdAt, updatedAt)`。
3. `sc_script_versions(id PK, projectId, scriptId, version, structuredJson, source, createdAt)`，唯一 `(projectId, version)`。
4. `sc_scenes(id PK, projectId, title, description, location, sortOrder)`。
5. `sc_shot_metadata(storyboardId PK/FK, sceneId, shotType, cameraMovement, visualDescription, imagePrompt, videoPrompt, narration, onScreenText, transitionName, materialStrategy, locked, sortOrder)`。
6. `sc_media_assets(id PK, projectId, imageId, videoId, type, source, originalName, mimeType, byteSize, localPath, remoteUrl, thumbnailPath, durationMs, width, height, fps, provider, prompt, sha256, rightsNote, metadataJson, createdAt)`；唯一 `(projectId, sha256)`。
7. `sc_tasks(id PK, projectId, storyboardId, taskType, provider, status, progress, inputJson, outputJson, errorJson, idempotencyKey, externalTaskId, estimatedCost, actualCost, createdAt, updatedAt)`；唯一 `idempotencyKey`。
8. `sc_edit_sessions(id PK, projectId, status, openStorylineSessionId, currentTimelineVersionId, previewAssetId, outputAssetId, createdAt, updatedAt)`。
9. `sc_edit_commands(id PK, editSessionId, instruction, status, taskId, createdAt)`。
10. `sc_timeline_versions(id PK, projectId, editSessionId, version, source, tracksJson, createdAt)`；唯一 `(projectId, version)`。
11. `sc_external_mappings(id PK, system, entityType, localId, externalId, metadataJson, createdAt)`；唯一 `(system, entityType, localId)`。

`002_storycanvas_continuity_memory` 新增：

12. `sc_continuity_profiles`：项目级视觉风格、禁止变化规则和世界版本。
13. `sc_entities`：人物、物品、场景、品牌的稳定标识与 canonical memory。
14. `sc_entity_versions`：获批外观和初始状态的版本记录。
15. `sc_world_events`：镜头之间发生的状态事件；通过 `afterShotId + sortOrder` 重建任意镜头的开始状态。
16. `sc_shot_contracts`：每镜头读取的实体、必保项、前置状态、状态变化、动作和摄影契约。
17. `sc_shot_relations`：相邻镜头的切镜类型、需保持内容和可选尾帧策略。
18. `sc_reference_bindings`：实体或镜头绑定的获批参考图及用途、视角和优先级。
19. `sc_continuity_reviews`：生成后连续性检查结果和观测状态。

生成上下文由服务端确定性编译：

```text
项目视觉规则
+ 镜头绑定的实体标准
+ 镜头开始时的世界状态
+ 镜头契约
+ 切镜关系
+ 用户局部提示词
```

生成前会拒绝不存在的实体、缺失的开始状态或与事件账本矛盾的状态。普通切镜不传递上一尾帧；只有 `continuous-action` 可显式开启该策略。

Migration 在事务中执行并登记 checksum；支持幂等重复执行、中途失败回滚和显式回滚。阶段 2 没有删除、重命名或修改任何 `o_*` 表或列。

## 媒体目录

```text
data/projects/{projectId}/
├── uploads/
├── images/
├── videos/
├── audio/
├── subtitles/
├── previews/
├── exports/
└── metadata/
```

实际写入路径由 `projectId + assetId + 安全扩展名` 构造。原始文件名只保存为元数据；写入时计算 SHA-256，命中同项目 Hash 时复用资产记录。
