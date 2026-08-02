# StoryCanvas Phase1 数据迁移

> Migration：`004_storycanvas_phase1_runtime`  
> 状态：已注册、已通过临时数据库往返验收、Repo Demo DB 已应用  
> 日期：2026-08-03

## 1. 迁移目标

`004_storycanvas_phase1_runtime`以 additive 方式补齐第一条镜头生产闭环的数据对象：

```text
ProductionShot
-> GenerationPlan
-> sc_tasks
-> ShotAttempt
-> sc_media_assets
-> Selected Attempt
-> RoughCut
-> sc_export_artifacts
-> sc_receipt_outbox
-> sc_runtime_credit_entries
```

迁移不删除旧 MVP，不改变现有 Package、Grant 或 Receipt 的公开字段，也不把`o_tasks`升级为新的商业事实源。

## 2. 注册顺序

迁移已注册到：

```text
apps/storycanvas/src/lib/storycanvasMigrations.ts
```

执行顺序：

```text
001_storycanvas_core
-> 002_storycanvas_continuity_memory
-> 003_storycanvas_production_contract
-> 004_storycanvas_phase1_runtime
```

Migration Runner 使用`sc_migrations`记录：

- `version`；
- `appliedAt`；
- `checksum`。

再次运行时，如果版本和 Checksum 一致则跳过；如果同版本 Checksum 漂移则拒绝继续。因此“幂等 up”指通过`runStoryCanvasMigrations()`重复执行，不是直接绕过 Registry 重复调用 raw `migration.up()`。

## 3. 新增表

### 3.1 `sc_production_shots`

稳定镜头生产对象，主要保存：

- canonical 外部 Project/Storyboard Shot ID；
- 内部`o_storyboard`映射；
- Package 记录；
- 固定顺序和时长；
- 已批准脚本片段；
- Claim/Brand Fact ID；
- 锁定商业字段；
- 可编辑创意字段；
- Shot Contract；
- 当前 Selected Attempt。

唯一约束：

- `externalProjectId + externalStoryboardShotId`；
- `productionPackageId + storyboardId`。

重复投递同一 Package 或重复同步不会产生无法关联的新 Shot 身份。

### 3.2 `sc_generation_plans`

保存 Agent 或制作计划：

- 图片/视频/负向 Prompt；
- 推荐模型；
- Reference Asset；
- Continuity Entity；
- CameraPlan；
- 预计额度；
- 生成者和制作人员确认；
- 计划版本和幂等键。

同一 Shot 可以有多个 Plan Version，但生成任务只能使用已确认计划。

### 3.3 `sc_shot_references`

保存 Shot 与参考素材关系，支持：

- 图片、视频、角色、地点、风格和产品参考；
- Depth、Normal、Mask；
- Previs、Camera；
- 3D Asset。

这些字段是后续 3D 白模输入预留，当前生成流程不依赖它们。

### 3.4 `sc_shot_attempts`

每次生成尝试独立保存：

- Task；
- Attempt Number；
- Parent Attempt；
- Asset/Thumbnail；
- Prompt、Model、Parameter、Reference Snapshot；
- Quality Status；
- Operator Decision；
- Selected 状态。

部分唯一索引：

```sql
CREATE UNIQUE INDEX sc_shot_attempts_selected_uq
ON sc_shot_attempts(productionShotId)
WHERE isSelected = 1;
```

保证一个 Shot 同一时刻最多只有一个 Selected Attempt。

### 3.5 `sc_rough_cuts`

保存：

- 8 镜有序 Selection；
- 总时长；
- 画幅；
- Preview Asset；
- tenant.owner 审批状态；
- 幂等键。

RoughCut 不通过拖动画布坐标决定顺序，固定使用 ProductionShot.sequence。

### 3.6 `sc_runtime_credit_entries`

保存 Runtime Task 级额度操作：

- `reserve`；
- `consume`；
- `release`。

以`taskId + operation`唯一，并保留`attemptId`、额度单位和幂等键。失败、取消和资产验证失败必须释放未消费额度。

## 4. 扩展现有表

### 4.1 `sc_tasks`

继续作为 Runtime Task 事实源，新增：

- ProductionShot/Attempt；
- Model/Model Version；
- requested/resolved/negative Prompt；
- 输入/输出 Asset ID；
- Error Code/Message；
- reserved/consumed/released Credit；
- Runtime Mode；
- started/completed/cancelled/timeout 时间。

没有新增同义`runtime_tasks`表。

### 4.2 `sc_media_assets`

新增：

- ProductionShot/Attempt；
- playable/thumbnail URL；
- Validation Status；
- Validation JSON；
- validatedAt。

任务状态与媒体资产状态分离。只有`validationStatus=valid`且视频通过可播放验证，Task 才能成功。

### 4.3 `sc_export_artifacts`

新增：

- RoughCut；
- Export Type；
- Platform Variant；
- Manifest；
- Provenance；
- approvedAt。

保留原有 Artifact、Asset、Script Version、Package 和 Source Chain 关系。

## 5. Up 行为

`up`按以下顺序执行：

1. 创建 ProductionShot、GenerationPlan 和 ShotReference；
2. 扩展`sc_tasks`；
3. 扩展`sc_media_assets`；
4. 创建 ShotAttempt 和唯一 Selected 索引；
5. 创建 RoughCut；
6. 创建 Runtime Credit Entry；
7. 扩展`sc_export_artifacts`；
8. Migration Runner 在同一事务中写入`sc_migrations`。

外键策略强调历史可追溯性：

- Package、Shot、Task、Attempt、Selected Asset 和 Export 关键关系使用`RESTRICT`；
- 项目删除仍遵循既有 Project Cascade；
- 可选 Thumbnail、Parent Attempt 等允许`SET NULL`；
- 删除画布视觉对象不会删除 ProductionShot。

## 6. Idempotent Up

验收执行：

```text
run migrations up
-> repeat run migrations up
```

结果：PASS。

第二次执行由`sc_migrations.version + checksum`识别为已应用，返回空 applied 列表，不重复创建表、列、索引或业务记录。

如果 Checksum 与已登记版本不一致，Runner 会报错并停止，而不是继续修改数据库。

## 7. Down 行为

`down`按依赖逆序执行：

1. 移除`sc_export_artifacts`的 Phase1 字段和索引；
2. 删除`sc_runtime_credit_entries`；
3. 删除`sc_rough_cuts`；
4. 删除 Selected Attempt 唯一索引；
5. 删除`sc_shot_attempts`；
6. 移除`sc_media_assets`的 Phase1 字段和索引；
7. 移除`sc_tasks`的 Phase1 字段和索引；
8. 删除`sc_shot_references`；
9. 删除`sc_generation_plans`；
10. 删除`sc_production_shots`；
11. Runner 删除对应`sc_migrations`记录。

`down`不会删除：

- `o_project`、`o_script`、`o_storyboard`、`o_videoTrack`、`o_video`；
- `001`至`003`建立的核心、连续性和合同表；
- 旧 MVP 生成代码；
- Package/Grant/Receipt 公开 Schema。

但是`down`会删除 Phase1 Shot、Plan、Attempt、RoughCut、Runtime Credit 数据，并移除 Phase1 Task/Asset/Export 扩展字段。任何真实环境回滚前必须先备份并确认这些数据允许丢弃。

## 8. 已完成验收

### 8.1 临时数据库

以下往返已通过：

```text
004 up
-> idempotent up
-> 004 down
-> 004 up
```

结果：PASS。

该验收证明：

- 表、列和索引可以创建；
- Runner 重复执行不会重复迁移；
- `down`能够解除 Phase1 Schema；
- 回滚后可以重新执行`up`；
- 上游`001`至`003`表仍然存在。

### 8.2 Repo Demo DB

Repo Demo DB 已应用：

```text
004_storycanvas_phase1_runtime
```

普通 Node 模式下，数据库路径由`getPath("db2.sqlite")`决定；从`apps/storycanvas`启动时对应仓库 Demo 数据目录下的`data/db2.sqlite`。本结论是已知验收事实，本次文档提交没有再次运行迁移或写入数据库。

### 8.3 Runtime 验收

`phase1Runtime.test.ts`：4/4 PASS，覆盖：

- Stable Shot Mapping；
- Prompt/Reference 持久化；
- Task/Credit/Receipt 幂等；
- Mock Fixture Asset；
- valid/playable Gate；
- 多 Attempt 唯一 Selected；
- failure/cancel release；
- 八镜 RoughCut；
- tenant.owner Approval；
- Export/Provenance。

## 9. 兼容性边界

必须继续保留：

- `demo-local-001`；
- C1-C8；
- `script-a`审批；
- Package digest、version 和 idempotencyKey；
- Grant tenant/project/package/scope；
- `sc_external_mappings`；
- `o_storyboard`内部 Shot ID；
- `sc_tasks`、`sc_media_assets`、`sc_export_artifacts`；
- `sc_receipt_outbox`的 Receipt 唯一性；
- reserve/consume/release 语义。

禁止：

- 用新表替代或删除旧 MVP 数据；
- 让 legacy 和 canonical 长期双写同一个最终事实；
- 把聊天摘要写入锁定商业事实；
- production.operator 修改价格、CTA、地址、营业时间、Claim 或 Disclaimer；
- 缺少 valid Asset 时消费额度；
- 缺少 ExportArtifact 时生成已交付状态。

## 10. 当前未完成项

Migration 和 Runtime 数据链通过，不代表以下能力已经完成：

1. 正式八镜 FFmpeg 粗剪合成；
2. 正式 Export Runtime Task；
3. 独立导出资产生成和重新编码；
4. 正式音频、字幕、转场和平台变体合成；
5. REAL Provider 调用；
6. 真实对象存储和跨设备访问；
7. 正式钱包、RateCard、模型成本和渠道结算；
8. Export 独立额度；
9. 线上数据库数据量、锁表时间和备份恢复演练；
10. 生产级 Schema 演进工具和零停机迁移。

当前结论只能表述为：Phase1 Mock Runtime Schema、状态恢复、资产门禁、额度记录和来源链已经形成可验证基础；正式视频合成与真实模型生产仍未完成。
