# StoryCanvas Phase 1 实施计划

> 分支：`codex/storycanvas-phase1-production-loop`  
> 基线：`84d922c`  
> 审计基线提交：`5de3efd`  
> 默认模式：`DEMO`  
> REAL Provider：只保留显式接口，自动化测试和验收不调用

## 1. 唯一目标

打通并持久化以下单一事实链：

```text
Approved Script
-> Storyboard Shot
-> Production Package
-> Stable ProductionShot
-> GenerationPlan
-> GenerationTask
-> Playable MediaAsset
-> ShotAttempt
-> Selected Attempt
-> RoughCut
-> ExportArtifact
-> ExportReceipt
-> Credit Settlement
-> Provenance
```

## 2. 不变边界

- 保留平台、渠道、企业、生产四个工作台。
- 保留 `demo-local-001`、C1-C8、`script-a`审批兼容。
- Package、Grant、Receipt和reserve/consume/release语义只做additive扩展。
- production.operator只修改创意参数，不修改品牌事实、价格、CTA、禁用词和免责声明。
- 不增加自由连线、条件、循环或通用节点图。
- 不删除legacy真实Provider代码；legacy只作为Runtime Adapter的兼容来源。
- Fixture和FALLBACK必须显式标记，不能产生REAL成功声明。
- `mediaUrl`为空、不可访问或不可播放时，Task不能succeeded，额度不能consume。

## 3. P0安全基线

| 项目 | 状态 |
|---|---|
| 独立分支 | 完成：`codex/storycanvas-phase1-production-loop` |
| 基线HEAD | `84d922cc39a8c3b6c24d29dfd960c71655f34c64` |
| 审计产物提交 | `5de3efd` |
| Repo SQLite备份 | `apps/storycanvas/data/backups/db2-before-storycanvas-phase1-20260802.sqlite`，git忽略 |
| Electron SQLite备份 | `~/Library/Application Support/Electron/data/backups/db2-before-storycanvas-phase1-20260802.sqlite` |
| 根Build | PASS |
| 根Test | 56/57；登录页旧“欢迎登录”断言失败 |
| StoryCanvas Test | 环境阻塞；Electron解析到旧worktree且安装损坏 |
| 付费调用 | 禁止，默认未调用 |

## 4. 实施阶段

| 阶段 | 交付 | Gate |
|---|---|---|
| P1目标模型 | ProductionShot、ShotContract、Plan、Task、Attempt、MediaAsset、RoughCut、Export、3D预留 | Schema解析、稳定ID和旧数据兼容测试 |
| P2单一事实链 | canonical拥有商业事实，Runtime拥有生成事实，legacy只经Adapter | 不新增第四套Task/Asset事实；Receipt只由validated Runtime结果生成 |
| P3生成桥接 | DEMO Mock Provider、REAL disabled Adapter、轮询/取消/重试/超时/幂等、资产验证 | 无付费调用；缺URL/不可播放必失败 |
| P4镜头生产台 | 8镜、锁定事实、创意参数、Prompt、Reference、Model、Task、Attempt、Selection | 刷新恢复；顺序来自ProductionShot.sequence |
| P5 Agent规划 | 八镜GenerationPlan、人工确认、单镜/已确认批量生成 | 状态先`awaiting_confirmation`；Agent不审批、不选择版本 |
| P6粗剪导出 | 8镜Selected Gate、RoughCut、企业确认、Artifact、Receipt、Provenance | 无Artifact不得交付；production.operator不得代企业确认 |
| P7额度 | reserve、consume、release、failure、cancel、retry幂等 | valid playable Asset之前不得consume |
| P8回归 | 四工作台、Demo Reset、LocalStorage、legacy兼容 | 根Build/Test、后端测试、迁移测试、浏览器证据 |

## 5. 数据策略

- 优先扩展现有`sc_tasks`、`sc_media_assets`、`sc_export_artifacts`。
- 新增`sc_production_shots`、`sc_generation_plans`、`sc_shot_attempts`、`sc_rough_cuts`、`sc_rough_cut_items`和Task关联的Credit settlement。
- 通过`sc_external_mappings`保持StoryboardShot外部ID与内部Shot稳定映射。
- Migration只能additive，不删除旧表、不改写历史Receipt、不自动迁移线上数据。
- 实际Demo DB迁移前先在临时副本运行并验证幂等、回滚和数据计数。

## 6. 任务所有权

| 责任 | Owner |
|---|---|
| Package、Grant、Approval、Receipt、Credit、Provenance | canonical Production Domain |
| Provider任务、进度、Attempt、Asset持久化和验证 | StoryCanvas Runtime |
| 模型调用 | 现有`u.Ai.*` Provider Adapter |
| 重试/取消/超时 | Runtime Task Service |
| Receipt生成 | Runtime valid结果触发canonical Adapter |
| 额度结算 | canonical在validated Asset Receipt后幂等执行 |

## 7. Prompt编译

```text
Brand Compliance Memory（只读、有来源）
+ Shot Contract（锁定商业字段）
+ Visual Continuity Memory
+ Operator Creative Input
+ Model Adapter Formatting
= resolvedPrompt
```

必须分别保存operator Prompt、Agent Plan Prompt、resolvedPrompt和Provider Prompt。

## 8. 审核Gate

| Gate | 审核人 | 进入下一阶段条件 |
|---|---|---|
| Gate 1脚本 | tenant.owner | `script-a=approved`且事实风险清除 |
| Gate 2分镜 | tenant.owner | 8镜ProductionShot合同冻结 |
| Gate 3逐镜采用 | production.operator | 每镜唯一Selected Attempt且Asset valid/playable |
| Gate 4粗剪 | tenant.owner | RoughCut完整、时长和风险通过 |
| Gate 5最终导出 | tenant.owner | ExportArtifact真实存在并可访问 |

## 9. 提交策略

1. 审计与P0计划。
2. 领域模型和additive migration。
3. Runtime任务/资产/额度服务及测试。
4. Control Plane交接和投影。
5. StoryCanvas镜头生产台和API Client。
6. RoughCut、Export、Provenance。
7. 文档、截图和最终测试报告。

每个提交必须可独立回退，不允许中间提交破坏根Build。

## 10. 停止条件

遇到以下情况停止扩张并保留已完成工作：

- 必须修改Package、Grant、Receipt或额度公开契约才能继续。
- additive migration无法安全表达或旧数据无法无损映射。
- 需要生产密钥、真实付费任务或线上数据库确认。
- 需要删除已有真实数据。
- 需要把Fixture/FALLBACK声明为REAL才能通过验收。

## 11. 最终验收

- 使用`demo-local-001`覆盖用户列出的44个场景。
- 默认Mock Provider产生本地、可验证、可播放测试资产。
- Shot、Plan、Task、Attempt、Asset、Selection刷新可恢复。
- 重复Package/Task/Receipt/Credit操作幂等。
- 8镜Selected后才可RoughCut，企业确认后才可Export。
- 完整Provenance可追溯到Brief、Script、Shot、Task、Provider、Prompt、Reference、Asset和Ledger。
- 自动化测试不调用真实付费Provider。
