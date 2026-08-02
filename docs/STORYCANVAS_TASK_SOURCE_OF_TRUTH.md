# StoryCanvas 任务单一事实源

> 状态：Phase1 根控制面边界说明  
> 基线：`533b4702751f5f8c779a259a9105de050ccac3eb`  
> 口径：本文区分“已实现投影”“现有兼容链”和“目标责任边界”，不把 Mock、Fixture 或 FALLBACK 描述为真实生成。

## 1. 结论

Phase1 的目标事实链为：

```text
Approved Script
-> Storyboard Shot
-> Production Package
-> Stable Production Shot
-> Generation Plan
-> Runtime Task
-> Valid Playable Asset
-> Shot Attempt
-> Selected Attempt
-> Rough Cut
-> Export Artifact
-> Export Receipt
-> Credit Settlement
-> Provenance
```

当前根控制面已经以 additive 方式建立 `ProductionShot / Handoff / RuntimeTask / ShotAttempt / MediaAsset / RoughCut / ExportArtifact / Credit` 投影，但尚未替代 StoryCanvas 后端中的旧任务与资产表，也尚未接通真实 Provider Runtime。

## 2. 三层责任边界

| 层 | 应负责 | 不应负责 | 当前事实 |
|---|---|---|---|
| Canonical Production Domain | Package、Grant、Approval、Receipt、Credit、Provenance、商业状态 | 直接执行供应商轮询、下载媒体或 FFprobe | 根 SaaS 已有 Mock 合同与 Receipt/账本；Phase1 增加持久化投影 |
| StoryCanvas Runtime | Provider 任务、进度、重试、取消、媒体持久化、资产验证、版本 | 决定价格、CTA、品牌事实或企业审批 | 旧 MVP 有真实生成代码；canonical Runtime Adapter 尚未完成 |
| Legacy MVP Adapter | 复用现有 `u.Ai.*` 与供应商适配，兼容旧数据 | 成为新商业状态或最终结算事实源 | 仍存在，当前 canonical 默认禁用 legacy 生成 |

## 3. 当前事实源

### 3.1 商业事实

以下事实仍由 canonical 根控制面拥有：

- `demo-local-001` 项目身份；
- C1-C8 品牌事实；
- `script-a` 审批状态；
- `ProjectProductionPackage` 及其 `digest`、`idempotencyKey` 和版本；
- `DemoProjectGrant` 的 tenant、project、package、scope 和有效期；
- Task、Asset、Export Receipt；
- `AI_VIDEO_CREDIT` 的 reserve、consume、release 语义。

### 3.2 Phase1 根控制面投影

实现位置：

- `src/domain/phase1Production.ts`
- `src/stores/controlPlaneStore.ts`

Store 使用以下 LocalStorage Key 保存投影：

```text
videoagent:control-plane:phase1:v1
```

当前可恢复对象：

- Stable Production Shot；
- Package/Grant Handoff；
- Runtime Task 投影；
- Shot Attempt；
- Media Asset 投影；
- Selected Attempt；
- RoughCut 投影；
- ExportArtifact 投影；
- Phase1 Credit Allocation 与 Credit Entry；
- 已处理额度幂等命令。

这只是根前端持久化，不等同于服务端数据库事实源，也不支持跨设备恢复。

### 3.3 现有后端事实

当前后端仍并存：

- `o_tasks`：旧任务记录；
- `sc_tasks`：StoryCanvas 新任务表；
- canonical Receipt/Outbox：商业回执；
- `o_assets/o_image/o_video`：旧媒体事实；
- `sc_media_assets`：新媒体资产；
- `sc_export_artifacts`：canonical 导出登记。

Phase1 根控制面没有迁移或删除这些数据，也没有让它们自动双写到同一个最终事实源。

## 4. Stable Shot 身份

当前根控制面稳定 Shot ID 规则：

```text
${projectId}:shot:${externalStoryboardShotId}
```

例如：

```text
demo-local-001:shot:shot-01
```

约束：

- Package 首次 accepted 后投影八个 Shot；
- Package duplicate 重投不会创建第二组 Shot；
- Shot 顺序来自 `StoryboardShot.order`；
- 视觉卡片拖动不改变 Shot 身份或顺序；
- 删除视觉对象不应删除商业 Shot；
- 当前规则不依赖 Package ID，因此同一项目、同一外部分镜 ID 可稳定映射。

## 5. Package 与 Handoff 幂等

`accepted` 和 `duplicate` 都表示 Package 已被 StoryCanvas 接收。

Handoff 只有同时满足以下条件才为 ready：

```text
status in [accepted, duplicate]
AND grantStatus = valid
```

Grant 错误不会被统一包装成模糊错误。当前保留例如：

- `GRANT_EXPIRED`；
- `GRANT_SCOPE_MISMATCH`；
- 其他 Bridge 返回的具体错误码与消息。

`deepLink` 只在 Package accepted/duplicate 时记录。Grant 无效时不能通过 handoff ready 门禁。

## 6. Runtime Task 与 Receipt 投影规则

canonical Receipt 同步后，根控制面执行 additive 投影：

| canonical 数据 | Phase1 投影 |
|---|---|
| `GenerationTaskReceipt` | `Phase1RuntimeTask` + deterministic `ShotAttempt` |
| `AssetReceipt` | `Phase1MediaAsset` |
| `ExportReceipt` | `Phase1ExportArtifact` |

关键安全规则：

- canonical `succeeded` Task Receipt 投影为 `validating`，不直接投影为 Runtime `succeeded`；
- `AssetReceipt.storageReference` 可以记录为 local 或 remote reference；
- Receipt 投影不会把 `storageReference` 复制成 `playableUrl`；
- 未经过资产验证的 Receipt Asset 状态为 `pending`；
- canonical succeeded Export Receipt 在没有已批准 RoughCut 和有效可播放导出资产时投影为 `blocked`；
- 不伪造 Provider Task ID；当前 canonical Receipt 投影的 `providerTaskId` 为 `null`。

## 7. Attempt 与重试

每次生成必须有独立 `taskId` 和 `attemptId`。

约束：

- 一个 GenerationTask 只能属于一个 ShotAttempt；
- 同一 Shot 可以有多个 Attempt；
- retry 必须创建新 Attempt 和新 Task；
- parent Attempt 可通过 `parentAttemptId` 追踪；
- 每个 Shot 只能有一个 `selected` Attempt；
- 旧 selected Attempt 在选择新版本后降为 `alternative`，已 rejected Attempt 保持 rejected；
- 历史 Attempt、Task、Receipt 和 Credit Entry 不因重新选择而删除。

canonical Receipt 的兼容 Attempt ID 当前为：

```text
attempt:${generationTaskId}
```

## 8. 最终状态所有权

| 状态 | 最终判定者 |
|---|---|
| Provider 已接受任务 | StoryCanvas Runtime |
| Provider 处理中/失败/取消 | StoryCanvas Runtime |
| 媒体文件可访问、可播放、校验通过 | StoryCanvas Runtime Asset Validator |
| Runtime Task succeeded | Runtime，在 valid playable Asset 后 |
| Shot Attempt selected | production.operator |
| RoughCut 业务确认 | tenant.owner |
| ExportArtifact succeeded | Export Runtime，在真实导出资产验证后 |
| ExportReceipt accepted | Canonical Production Domain |
| Credit consumed/released | Canonical Credit Domain |

根控制面当前只实现上述对象的前端投影和门禁，不代表 Runtime Validator、企业 RoughCut 确认和真实 Export Runtime 已完成。

## 9. Known 未完成项

1. canonical Runtime Adapter 尚未接到 `u.Ai.Image/Video`。
2. `o_tasks`、`sc_tasks` 和 Receipt 尚未完成服务端迁移与统一。
3. Phase1 投影仍为 LocalStorage，不是跨设备服务端事实源。
4. Provider Task ID、轮询、取消、超时和统一重试尚未接入 canonical。
5. Asset 下载、远程可访问性验证和 FFprobe 验证尚未接入根控制面。
6. canonical Receipt 投影不会自动创建可播放资产，因此会停在 validating/blocked。
7. RoughCut 当前领域函数校验传入选择项，但尚未强制要求完整八镜集合。
8. Export Receipt 尚未绑定真实可访问导出资产。
9. Provenance Manifest 尚未形成完整服务端不可变记录。
10. Legacy 数据尚未迁移，不允许据此宣称三套事实源已经统一。
