# StoryCanvas Phase1 Runtime Adapter

> 状态：Phase1 Mock Runtime 已实现并通过定向验收  
> 日期：2026-08-03  
> 口径：本文描述当前共享分支的实际实现，不把 Mock Fixture、FALLBACK 或接口预留表述为正式模型生产能力。

## 1. 目标与职责边界

Runtime Adapter 位于 canonical Production Domain 与现有模型适配能力之间：

```text
Approved Production Package
-> Stable ProductionShot
-> GenerationPlan
-> sc_tasks Runtime Task
-> RuntimeProviderAdapter
-> Provider Task ID
-> Poll / Cancel
-> Media Asset Validation
-> sc_media_assets
-> ShotAttempt
-> canonical Task / Asset Receipt
-> Credit Settlement
```

各层职责如下：

| 层 | 负责 | 不负责 |
|---|---|---|
| Canonical Production Domain | Package、Grant、审批、Receipt、额度、来源链和商业状态 | 直接调用供应商、轮询任务或执行 FFprobe |
| StoryCanvas Runtime | 生成任务、Provider Task ID、进度、Attempt、媒体资产、验证和失败原因 | 修改已审批品牌事实、价格、CTA 或免责声明 |
| Legacy MVP | 提供既有模型适配能力和旧数据兼容来源 | 作为 Phase1 最终商业事实源 |
| Runtime Adapter | 把统一生成请求转换成 Provider submit/poll/cancel | 自动批准脚本、自动选择版本或自动确认最终交付 |

Phase1 继续复用：

- `sc_tasks`：Runtime Task 单一事实记录；
- `sc_media_assets`：生成及导出媒体资产；
- `sc_export_artifacts`：导出产物和来源链；
- `sc_receipt_outbox`：Task、Asset、Export Receipt 投递；
- `sc_external_mappings`：canonical 外部 ID 与内部 ID 映射。

没有新增第四套同义任务表。

## 2. Runtime Adapter 合同

实现位置：

- `apps/storycanvas/src/services/storycanvas/phase1RuntimeAdapter.ts`
- `apps/storycanvas/src/services/storycanvas/phase1Runtime.ts`

### 2.1 请求

`RuntimeProviderRequest`包含：

| 字段 | 含义 |
|---|---|
| `taskId` | `sc_tasks.id`，同时作为 Runtime 幂等和追踪主键 |
| `attemptId` | 本次独立 ShotAttempt |
| `projectId` | StoryCanvas 内部项目 ID |
| `shotId` | 稳定 ProductionShot ID |
| `taskType` | `image-generation`或`video-generation` |
| `model` | 制作人员确认的模型 |
| `resolvedPrompt` | 品牌事实、Shot Contract、连续性和创意输入编译后的 Prompt |
| `negativePrompt` | 负向 Prompt |
| `inputAssetIds` | 已持久化参考素材 ID |
| `parameters` | 模型参数快照 |

### 2.2 Provider 操作

统一接口只暴露：

```text
submit(request) -> providerTaskId
poll(providerTaskId, request) -> running | failed | succeeded
cancel(providerTaskId, request)
```

Provider 成功输出至少包含：

- `localPath`或`remoteUrl`；
- `playableUrl`；
- `mimeType`；
- 尺寸和时长元数据；
- `providerTaskId`；
- 实际额度；
- 实际发送给 Provider 的 Prompt；
- Provider 元数据。

Provider 返回 succeeded 只表示供应商阶段结束，不代表 Runtime Task 已成功。Task 仍必须进入资产验证阶段。

## 3. DEMO 与 REAL 模式

| 模式 | Adapter | 当前状态 | 是否产生付费调用 |
|---|---|---|---|
| `DEMO` | `DemoFixtureRuntimeAdapter` | 已实现并用于自动化测试 | 否 |
| `REAL` | `RealRuntimeAdapterDisabled` | 显式禁用 | 否 |

### 3.1 REAL 默认禁用

`RealRuntimeAdapterDisabled`的`submit`、`poll`和`cancel`都会返回`REAL_PROVIDER_DISABLED`。当前共享分支没有从 canonical Runtime 自动调用 GPT Image、Seedream、Seedance、Kling、Vidu、MiniMax 或其他付费 Provider。

这不删除旧 MVP 的真实模型适配代码，也不代表旧 Provider 不存在；只是 Phase1 canonical Runtime 尚未获准执行真实付费任务。

### 3.2 Mock Fixture

DEMO Adapter 要求配置一个非空本地视频 Fixture：

| 环境变量 | 作用 |
|---|---|
| `STORYCANVAS_RUNTIME_MODE` | `DEMO`或`REAL`；非`REAL`时使用 DEMO Adapter |
| `STORYCANVAS_DEMO_VIDEO_FIXTURE` | 本地 MP4 Fixture 路径 |
| `STORYCANVAS_DEMO_OUTPUT_DIR` | 每次 Attempt 的输出目录 |
| `STORYCANVAS_DEMO_PLAYABLE_BASE_URL` | 输出文件对应的可访问基础 URL，可选 |

DEMO 执行行为：

1. 只接受`video-generation`；
2. 检查 Fixture 存在、为文件且非空；
3. 以`taskId`生成确定性`providerTaskId`；
4. 为每个 Task 复制独立 MP4；
5. 追加确定性 Attempt 标记，避免同一 Fixture 触发项目级 SHA 去重冲突；
6. 返回`MOCK`真值标记；
7. 默认额度为 100 个`AI_VIDEO_CREDIT`；
8. 不访问任何外部模型服务。

DEMO Provider 的内存任务结果不会被描述为真实 Provider 回调。持久事实仍以`sc_tasks`、`sc_media_assets`和`sc_shot_attempts`为准。

## 4. FFprobe 与可播放验证

默认验证器为`defaultPlayableAssetValidator`。

验证顺序：

```text
Provider Output
-> 必须存在 localPath 或 remoteUrl
-> 本地文件必须存在且非空
-> ffprobe 读取 format.duration 与 video stream
-> 必须存在视频流
-> duration 必须为正数
-> 写入 validationStatus / validationJson / validatedAt
```

验证状态：

- `valid`；
- `invalid`；
- `missing`；
- `inaccessible`。

视频 Task 只有同时满足以下条件才能进入`succeeded`：

1. Provider 返回输出；
2. 资产已持久化；
3. `validationStatus=valid`；
4. FFprobe 证明存在可播放视频流和有效时长；
5. 存在本地、远程或可播放引用；
6. 已绑定 ShotAttempt。

缺少`mediaUrl/playableUrl`、文件不存在、FFprobe 失败或视频流无效时：

- Task 不得进入`succeeded`；
- 不生成成功 Asset Receipt；
- 不消费额度；
- 已冻结额度全部释放；
- 错误和验证证据写入 Runtime 状态。

## 5. Task、Attempt 与额度状态

主要状态链：

```text
queued
-> running
-> validating
-> succeeded
```

失败与取消：

```text
queued/running/validating -> failed
queued/running -> cancelled
```

额度规则：

```text
create Task -> reserve
valid playable Asset -> consume actual + release remainder
failed/cancelled/invalid Asset -> release all
```

每个额度操作使用：

```text
phase1-credit:<taskId>:<operation>
```

作为幂等键，并由`taskId + operation`唯一约束阻止重复结算。Retry 创建新的 Task 和 Attempt，不覆盖历史任务、资产、Receipt 或 Provenance。

## 6. Runtime API

路由前缀：

```text
/api/production/v0.1/runtime
```

当前接口：

| 方法 | 路径 | 作用 |
|---|---|---|
| `POST` | `/projects/:projectId/sync` | 从 accepted Package 幂等投影 8 个稳定 ProductionShot |
| `GET` | `/projects/:projectId/state` | 恢复 Shot、Plan、Task、Attempt、Asset、RoughCut 和额度状态 |
| `PUT` | `/projects/:projectId/shots/:shotId/creative` | 保存允许制作人员修改的创意字段 |
| `PUT` | `/projects/:projectId/shots/:shotId/references` | 保存镜头参考素材及 Reference Role |
| `POST` | `/projects/:projectId/shots/:shotId/plans` | 保存 GenerationPlan 和人工确认状态 |
| `POST` | `/projects/:projectId/shots/:shotId/tasks` | 创建独立 Runtime Task、Attempt 并冻结额度 |
| `POST` | `/projects/:projectId/tasks/:taskId/run` | 启动 DEMO Task |
| `POST` | `/projects/:projectId/tasks/:taskId/poll` | 查询 Provider 进度并执行资产验证 |
| `POST` | `/projects/:projectId/tasks/:taskId/cancel` | 取消任务并释放额度 |
| `POST` | `/projects/:projectId/tasks/:taskId/retry` | 创建新的重试 Attempt |
| `PUT` | `/projects/:projectId/shots/:shotId/attempts/:attemptId/decision` | 标记 selected、alternative 或 rejected |
| `POST` | `/projects/:projectId/rough-cuts` | 八镜均有 valid Selected Attempt 后创建 RoughCut |
| `POST` | `/projects/:projectId/rough-cuts/:roughCutId/approve` | 仅`tenant.owner`确认粗剪 |
| `POST` | `/projects/:projectId/rough-cuts/:roughCutId/export` | 基于已确认 RoughCut 登记 ExportArtifact、Receipt 和 Provenance |

接口继续使用现有 Package、Grant 和 Scope 校验，不为方便演示绕过租户与生产工作台边界。

## 7. 已验收事实

- `phase1Runtime.test.ts`：4/4 PASS；
- 稳定 Shot ID 和重复同步通过；
- Prompt、Reference 和模型参数持久化通过；
- Task、Receipt 和额度幂等通过；
- Mock Fixture 形成独立 Attempt 资产通过；
- valid/playable Gate 通过；
- 缺失或无效媒体不得 succeeded 通过；
- 多 Attempt 唯一 Selected 通过；
- failure/cancel 全额释放通过；
- 八镜 RoughCut Gate 和 tenant.owner Approval Gate 通过；
- Export/Provenance 数据链通过；
- 没有运行真实付费模型。

## 8. 当前边界与未完成项

以下能力尚未完成，不得对外宣称已经具备：

1. canonical REAL Provider submit/poll/callback；
2. 正式图片生成 Runtime；
3. 供应商回调恢复、跨进程 DEMO Provider 状态恢复；
4. 正式远程对象存储、CDN 和跨设备可访问 URL；
5. 八镜正式 FFmpeg 粗剪合成；
6. 独立 Export Runtime Task；
7. 正式主成片重新编码、音频、字幕、转场和质量审核；
8. Export 独立额度；
9. 真实钱包、RateCard、人民币成本和渠道结算；
10. 正式内容安全、版权、品牌和人工审核。

当前 Export 能建立 Gate、Artifact、Receipt 和 Provenance，但仍依赖传入一个已经验证的导出资产。它不是“八镜正式合成已完成”的证明。
