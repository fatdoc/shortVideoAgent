# StoryCanvas Prompt 编译边界

> 状态：目标合同与当前实现差距说明  
> 约束：Prompt 不能覆盖已审批商业事实，聊天摘要不能成为图片或视频模型的事实源。

## 1. 目标编译公式

```text
Approved Business Facts
+ Shot Contract
+ Visual Continuity Memory
+ Operator Creative Input
+ Model Adapter Formatting
= resolvedPrompt
```

`resolvedPrompt` 是运行时编译结果，不是新的品牌事实，也不能反向修改 Approved Script、C1-C8、价格、CTA 或免责声明。

## 2. 两层记忆

### 2.1 Brand Compliance Memory

来源：

- BrandProfile；
- C1-C8；
- 套餐与价格；
- 门店地址和营业时间；
- 禁用词；
- 老板 IP；
- CTA；
- Disclaimer；
- Approved Script。

规则：

- 默认只读；
- 必须保留来源 ID；
- production.operator 不可修改；
- Agent 不可创建新事实替代已审批事实；
- 聊天摘要和 RAG 结果不可覆盖；
- 商业事实变化必须返回 tenant.owner 重新审批。

### 2.2 Visual Continuity Memory

来源：

- Continuity Profile；
- Entity 与 EntityVersion；
- Reference Binding；
- Shot Contract；
- Shot Relation；
- Previous Shot End State；
- World Event。

可表达：

- 门店环境；
- 菜品、人物、服装和道具；
- 光线、色调和空间关系；
- 镜头开始/结束状态；
- 前后镜头连续性；
- 摄影与运镜要求。

它可以被制作过程补充，但不能覆盖 Brand Compliance Memory。

## 3. Prompt 数据分层

每次生成目标上必须独立保存：

| 字段 | 内容 | 修改者 |
|---|---|---|
| `operatorPrompt` | 制作人员编辑的创意输入 | production.operator |
| `agentPlanPrompt` | Agent 为该 Shot 建议的计划 Prompt | Agent 生成，制作人员确认 |
| `resolvedPrompt` | 合规事实、Shot Contract、连续性和创意输入的编译结果 | Prompt Compiler |
| `providerPrompt` | Model Adapter 格式化后实际发送内容 | Runtime Adapter |
| `negativePrompt` | 禁止出现的视觉和文本内容 | Agent/制作人员，但不能削弱禁用规则 |
| `promptDigest` | 实际发送 Prompt 的稳定摘要 | Runtime |

不允许只保存最终文本，因为这样无法区分：

- 用户输入；
- Agent 建议；
- 系统注入事实；
- 连续性约束；
- Provider 专属格式化。

## 4. 锁定字段与可编辑字段

### 4.1 production.operator 不可修改

- requiredFacts；
- requiredClaims；
- requiredCTA；
- requiredDisclaimer；
- prohibitedTerms；
- approvedScriptSegment；
- 门店地址；
- 营业时间；
- 套餐名称和价格；
- 会员权益；
- 已审批核心商业口径。

### 4.2 production.operator 可修改

- 画面提示词；
- 视频提示词；
- 视觉表达；
- action 的执行方式；
- framing；
- cameraAngle；
- cameraMovement；
- referenceAssets；
- visualStyle；
- modelOptions；
- 生成参数。

可编辑输入只能在锁定商业合同内变化。

## 5. 推荐编译顺序

```text
1. 读取 Approved Script 和 Claim IDs
2. 解析 Brand Compliance Memory，并验证来源
3. 读取 Shot Contract 的 required/prohibited 条款
4. 解析当前 Shot 的 Visual Continuity Context
5. 合并 Agent GenerationPlan
6. 合并 production.operator 已确认的创意输入
7. 执行冲突检测
8. 生成 model-neutral resolvedPrompt
9. 由指定 Model Adapter 生成 providerPrompt
10. 保存所有 Prompt 层、摘要、引用和版本
11. 创建 GenerationTask
```

若步骤 2、3 或 7 发现冲突，应阻止任务创建，而不是静默删除商业约束。

## 6. Agent 生产规划边界

Agent 可读取：

- Brief；
- Approved Script；
- Storyboard；
- Brand Facts 和 Claims；
- 禁用规则、CTA 和 Disclaimer；
- Reference Assets；
- Continuity Memory；
- 平台、画幅和时长。

Agent 可输出：

- 画面目标；
- imagePrompt；
- videoPrompt；
- negativePrompt；
- 参考素材建议；
- 推荐模型；
- 运镜建议；
- 连续性要求；
- 风险提示；
- estimatedCredit。

Agent 输出状态必须先为 `awaiting_confirmation`。未经制作人员确认，不得自动批量消耗额度。

Agent 不可：

- 修改价格或 CTA；
- 删除 Disclaimer；
- 创建新品牌事实；
- 自动批准脚本；
- 自动选择最终 Attempt；
- 自动完成最终导出。

## 7. 3D/预演输入边界

未来 3D 白模位于：

```text
Storyboard confirmed
-> before single-shot generation
-> Reference / Camera / Previsualization input
-> Prompt Compiler and Model Adapter
```

预留的 Reference Role：

- `image_reference`；
- `video_reference`；
- `character_reference`；
- `location_reference`；
- `style_reference`；
- `product_reference`；
- `depth_reference`；
- `normal_reference`；
- `mask_reference`；
- `previs_reference`；
- `camera_reference`；
- `three_d_asset`。

预留 CameraPlan：

- cameraType；
- position；
- target；
- focalLength；
- movementType；
- trajectoryAssetId；
- previsAssetId。

这些字段不绑定 Seedance 或其他具体供应商。

## 8. 当前已实现事实

- 后端 legacy Continuity Memory 已能形成结构化 `resolvedPrompt`；
- 旧 MVP 生成可把连续性上下文送入 `u.Ai.Image/Video`；
- canonical Package 已携带 Claims、禁用词、Approved Script 和 Shot Draft；
- Phase1 根控制面已有 Stable Shot、Task、Attempt 和 Asset 投影；
- 当前 canonical 主流程仍是 Mock/Fixture，不执行真实 Provider Prompt；
- Phase1 根控制面 Task 投影当前只记录 provider、model、providerTaskId 和 idempotencyKey，没有完整 Prompt Snapshot。

## 9. Known 未完成项

1. 尚无 canonical 统一 Prompt Compiler。
2. `GenerationPlan` 尚未在根控制面 Phase1 模型中实现。
3. `operatorPrompt/agentPlanPrompt/resolvedPrompt/providerPrompt` 尚未分层持久化。
4. canonical Runtime 尚未调用 Model Adapter。
5. Brand Compliance Memory 尚未形成独立、可验证来源的运行时对象。
6. production.operator 修改商业事实的服务端拒绝尚未实现。
7. Prompt 冲突检测、禁用词 Gate 和 Claim 来源校验尚未接入任务创建。
8. World Event 当前没有实际数据，服装和镜头后状态连续性尚未闭环。
9. 聊天记忆与项目/Shot 隔离键的服务端强校验尚未确认。
10. 3D Reference 和 CameraPlan 仅为目标预留，本阶段未实现 Schema、UI 或模型调用。
