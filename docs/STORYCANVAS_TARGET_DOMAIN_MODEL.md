# StoryCanvas Phase1 目标领域模型

> 状态：目标模型、当前实现及兼容边界  
> 原则：以 Shot 为最小生产单元，不抽象为通用节点图。

## 1. 聚合边界

```text
Project
└── ProductionPackage
    ├── ApprovedScriptSnapshot
    ├── BrandComplianceSnapshot
    └── ProductionShot[]
        ├── ShotContract
        ├── GenerationPlan[]
        ├── ShotAttempt[]
        │   ├── GenerationTask
        │   └── MediaAsset
        └── SelectedAttempt

RoughCut
└── ordered Shot selections

ExportArtifact
└── RoughCut + export Asset + Provenance
```

## 2. ProductionShot

目标字段：

- id；
- externalStoryboardShotId；
- productionPackageId；
- projectId；
- sequence；
- title/description；
- duration；
- approvedScriptSegment；
- claimIds；
- brandFactIds；
- lockedBusinessFields；
- editableCreativeFields；
- shotContract；
- status；
- selectedAttemptId；
- createdAt；
- updatedAt。

当前根控制面已实现子集：

- 稳定 ID；
- externalStoryboardShotId；
- Package/Project ID；
- sequence；
- description；
- durationSeconds；
- status；
- selectedAttemptId。

稳定 ID：

```text
${projectId}:shot:${externalStoryboardShotId}
```

当前未在 Phase1 根模型内实现 approvedScriptSegment、Claim/Fact 来源、锁定/可编辑字段和时间戳。

## 3. ShotContract

目标字段：

- narrativePurpose；
- requiredFacts；
- requiredClaims；
- requiredCTA；
- requiredDisclaimer；
- prohibitedTerms；
- subjects；
- location；
- action；
- framing；
- cameraAngle；
- cameraMovement；
- startState；
- endState；
- continuityRequirements；
- duration；
- aspectRatio。

锁定字段来自企业审批结果。视觉表达、构图、机位、运镜和模型参数可由制作人员调整。

当前后端已有 `sc_shot_contracts` 和 Continuity 结构，但 Phase1 根控制面尚未建立完整 ShotContract 投影。

## 4. GenerationPlan

目标字段：

- shotId；
- planVersion；
- imagePrompt；
- videoPrompt；
- negativePrompt；
- recommendedImageModel；
- recommendedVideoModel；
- referenceAssetIds；
- continuityEntityIds；
- cameraPlan；
- estimatedCredit；
- generatedBy；
- approvedByOperator；
- approvedAt。

状态边界：Agent 输出后必须为 `awaiting_confirmation`，制作人员确认后才能创建生成 Task。

当前 Phase1 根控制面尚未实现 GenerationPlan。

## 5. GenerationTask

目标状态：

```text
draft
-> awaiting_confirmation
-> queued
-> running
-> validating
-> succeeded | failed | cancelled
```

当前 `Phase1RuntimeTask` 已实现：

- id；
- shotId；
- attemptId；
- taskType；
- provider；
- model；
- providerTaskId；
- status；
- progress；
- outputAssetIds；
- idempotencyKey；
- error；
- createdAt；
- completedAt。

当前缺少：

- modelVersion；
- requestedPrompt；
- resolvedPrompt；
- negativePrompt；
- inputAssetIds；
- startedAt；
- reserved/consumed/releasedCredit 快照；
- Provider 参数快照。

canonical succeeded Receipt 会被投影为 `validating`，只有 valid playable Asset 才能通过 Phase1 额度结算进入 `succeeded`。

## 6. ShotAttempt

当前已实现：

- id；
- shotId；
- generationTaskId；
- attemptNumber；
- parentAttemptId；
- assetId；
- operatorDecision；
- createdAt。

`operatorDecision`：

- undecided；
- selected；
- alternative；
- rejected。

约束：

- 一个 Task 只能属于一个 Attempt；
- 一个 Shot 可有多个 Attempt；
- 一个 Shot 只能有一个 selected Attempt；
- retry 新建 Attempt，不改写旧 Attempt；
- Selection 变化不删除历史。

当前缺少 Prompt、Model、Parameter、Reference Snapshot、thumbnailAssetId 和 qualityStatus。

## 7. MediaAsset

当前已实现：

- id；
- projectId；
- shotId；
- attemptId；
- generationTaskId；
- assetType；
- localPath；
- remoteUrl；
- playableUrl；
- mimeType；
- durationSeconds；
- sha256；
- validationStatus；
- createdAt。

`validationStatus`：

- pending；
- valid；
- invalid；
- missing；
- inaccessible。

可播放判定要求：

```text
assetType in [video, export]
AND validationStatus = valid
AND playableUrl is non-empty
AND mimeType starts with video/
AND durationSeconds > 0
```

当前缺少 width、height、size、thumbnailUrl、rightsNote、provider 和 sourceType 等完整字段。

## 8. RoughCut

当前已实现投影字段：

- id；
- projectId；
- orderedShotSelections；
- previewAssetId；
- approvalStatus；
- approvedAt。

当前 Gate 已验证每个传入 Selection：

- Attempt 存在且属于对应 Shot；
- Attempt 为 selected；
- 对应 Asset valid 且可播放。

目标还要求：

- 必须覆盖全部八镜；
- 按 ProductionShot.sequence 排序；
- 校验总时长和画幅；
- 检查阻塞质量问题；
- tenant.owner 执行最终业务确认。

以上完整 Gate 尚未实现。

## 9. ExportArtifact

当前已实现投影字段：

- id；
- projectId；
- roughCutId；
- assetId；
- status；
- provenanceTaskIds；
- createdAt。

当 Artifact 状态为 succeeded 时，当前领域 Gate 要求：

- RoughCut 存在且 `approvalStatus = approved`；
- Export Asset 存在；
- Export Asset valid 且可播放。

canonical Export Receipt 在缺少上述事实时只投影为 `blocked`，不会伪装为已交付。

当前缺少 platformVariant、exportType、完整 Manifest、Truth Manifest、Provenance Manifest 和 approvedAt。

## 10. Production Handoff

当前 `Phase1HandoffProjection` 保存：

- packageId；
- projectId；
- packageDigest；
- status；
- grantStatus；
- grantId；
- deepLink；
- error；
- updatedAt。

状态：

- accepted；
- duplicate；
- rejected；
- grant_invalid。

只有 accepted/duplicate 且 Grant valid 时可进入生产画布。

## 11. Credit

当前 Phase1 以 `taskId + attemptId` 绑定 Allocation：

- reservationId；
- status；
- reservedCredit；
- consumedCredit；
- releasedCredit。

Entry 记录 reserve、consume、release。命令通过 idempotencyKey 和 payloadDigest 防止重复结算。

完整规则见 `docs/STORYCANVAS_CREDIT_STATE_MACHINE.md`。

## 12. Reference 与 Camera 目标预留

目标 Reference Role：

- image/video/character/location/style/product reference；
- depth/normal/mask reference；
- previs/camera reference；
- three_d_asset。

目标 CameraPlan：

- cameraType；
- position；
- target；
- focalLength；
- movementType；
- trajectoryAssetId；
- previsAssetId。

当前 Phase1 根模型没有实现这些字段，不应宣称已支持 3D 白模或相机轨迹。

## 13. 持久化与兼容

当前 Phase1 根投影保存在 LocalStorage：

```text
videoagent:control-plane:phase1:v1
```

Demo Reset 会清空 Phase1 投影并恢复现有演示流程。

不可破坏：

- `demo-local-001`；
- C1-C8；
- `script-a`；
- Package digest/version/idempotencyKey；
- Grant scope/expiry；
- Receipt 和额度语义；
- `sc_external_mappings`；
- 旧 `o_storyboard/track/video` 兼容关系。

## 14. Known 未完成项

1. Phase1 数据尚未迁移到 StoryCanvas 服务端数据库。
2. ShotContract 和 GenerationPlan 尚未进入根控制面完整模型。
3. Prompt、Reference、Model 参数尚未形成不可变 Attempt Snapshot。
4. Runtime Task 尚未接入真实 Provider Adapter。
5. Asset Validator 和 FFprobe 尚未接入。
6. 八镜 RoughCut 完整 Gate 尚未实现。
7. tenant.owner RoughCut 审批尚未接通。
8. Export Runtime、Truth Manifest 和完整 Provenance 尚未实现。
9. Phase1 Credit 尚未与现有 Wallet 余额统一。
10. LocalStorage 不提供跨设备、并发或服务端事务保证。
11. Legacy 数据尚未迁移；当前模型是 additive，不是完成替换。
12. 3D、白模、预演和相机轨迹仅有目标边界，尚无实现。
