# 视频画布上下文汇总（供其他 AI 复审）

> 日期：2026-08-02  
> 结论来源：代码、文档、SQLite只读证据和无付费本地运行  
> 禁止误读：当前存在真实模型代码，不等于当前 canonical 商业流程已经真实生成视频。

## 1. 产品与商业场景

产品是销售和计量 AI 视频额度的多角色短视频营销平台。平台方管理产品和组织；三级代理负责分销；企业客户提交业务资料并审核内容；媒体制作人员执行生产。当前唯一完整场景是海底捞北京三里屯店的 `9:16`、30秒本地探店视频。

商业核心对象是 `AI_VIDEO_CREDIT`，当前 Demo成功支线 `120 -> consume 100 + release 20`，失败支线 `80 -> consume 0 + release 80`。没有真实人民币价格、订单、支付、分佣和结算闭环。

## 2. 目标用户

| 用户 | 工作 |
|---|---|
| platform.admin | 组织、产品、额度和回执总览 |
| channel.admin | 可售能力、客户和用量 |
| tenant.owner | Brief、品牌事实、脚本、分镜和交付 |
| production.operator | Package、StoryCanvas、Task、Asset和Export |

没有普通 C端、独立审核员、独立财务、总代理或二级代理登录身份。

## 3. 完整用户流程

```text
登录
-> 查看已购能力和额度
-> 打开 demo-local-001
-> 填 Brief
-> 维护品牌/C1-C8/套餐/禁用词/IP
-> 编辑 A/B/C 脚本
-> 批准 script-a
-> 查看 8 镜分镜
-> 创建 ProjectProductionPackage
-> 切换 production.operator
-> 接收 Package + Grant
-> 进入 StoryCanvas
-> 预冻结额度
-> 执行成功/失败任务
-> 同步 Task/Asset/Export Receipt
-> ACK和额度结算
-> 查看来源链和交付
```

## 4. 画布业务阶段

画布位于脚本审批和分镜之后、任务/资产/导出之前。它打开整个生产包，不打开空白项目、单场景或单镜头。制作人员用它查看镜头、Prompt、记忆和参考素材，并触发或登记生成任务。离开画布后还要完成回执、ACK、额度、审核和导出。

画布对制作人员是核心执行台，对整个平台只是中后段环节，不是通用AI视频工具。

## 5. 主要页面

| 工作台 | 页面 |
|---|---|
| 平台 | `/platform/overview`、organizations、catalog、production-receipts |
| 渠道 | `/channel/overview`、products、customers、usage |
| 企业 | `/dashboard`、`/projects/new`、brand、script、storyboard、rough-cut |
| 生产 | `/production/overview`、inbox、canvas、tasks、assets、export |

完整表见 `docs/VIDEO_CANVAS_PAGE_MAP.md`。

## 6. 主要数据对象

### 根 SaaS

`DemoWorkspace`、Brief、BrandProfile、C1-C8 Claim、ScriptVersion、ScriptApproval、StoryboardShot、ProjectProductionPackage、DemoProjectGrant、GenerationTaskReceipt、AssetReceipt、ExportReceipt、CreditLedger。

### 旧后端

`o_project`、`o_script`、`o_assets`、`o_image`、`o_storyboard`、`o_videoTrack`、`o_video`、`o_agentWorkData`、`o_tasks`、`memories`。

### StoryCanvas新后端

`sc_tasks`、`sc_media_assets`、`sc_external_mappings`、Continuity tables、Production Package、Receipt Outbox、Export Artifact。

## 7. 当前节点类型

真正节点只有：

| 类型 | 作用 |
|---|---|
| ShotNode | 镜头选择、Prompt、媒体和生成状态 |
| ReferenceNode | Continuity Entity参考图展示 |

没有真实Edge、分支、循环或拓扑执行。CSS线不传数据。拖动不改顺序。撤销重做无事件。画布编辑、新增、删除和锁定主要在React内存，刷新丢失。

## 8. 记忆实际实现

存在两套记忆：

- Agent Memory把消息、摘要和RAG拼入文本决策Agent，不直接进入图片/视频模型。
- Continuity Memory把视觉规则、实体、状态、镜头契约、关系和参考编译为 `resolvedPrompt`，进入legacy MVP图片/视频生成。

当前Continuity有1 Profile、3 Entity、3 EntityVersion、8 ShotContract、7 Relation、6 Reference，WorldEvent和Review均为0。实体是品牌、门店和会员权益，不是人物服装。canonical流程不调用真实模型，因此实际生成效果未闭环。

## 9. 分镜实际实现

根 SaaS固定8镜。后端 `o_storyboard`一行就是一个镜头。镜头通过trackId聚合，一个Track可有多个Video，`o_videoTrack.videoId`选择采用版本。canonical外部ID稳定，本地新增Shot没有稳定ID。

完整链：Script -> StoryboardShot -> Package -> ID Mapping -> o_storyboard/sc_shot_metadata -> ShotNode -> Task/Asset/Export Receipt。当前不是稳定一镜一视频。

## 10. 模型和接口

统一适配为 `u.Ai.Text/Image/Video/Audio`。默认文本GPT-5.2、图片GPT Image 2/Seedream、视频Seedance。代码还包含DeepSeek、MiniMax、Kling、Vidu、AtlasCloud、Grsai等适配。

当前 canonical `/production/v0.1`只调用Fixture Demo Provider和FALLBACK，不调用真实图片/视频模型。真实生成在要求 `X-StoryCanvas-Mode: legacy`的旧 MVP接口中。

没有完整独立TTS、数字人、OCR、抠图、3D白模、相机轨迹或预演视频适配证据。

## 11. 素材管理

文件主要在本地 `<data>/oss/`。旧链用 `o_assets/o_image/o_video`，新链用 `sc_media_assets`，字段包括project、localPath、remoteUrl、thumbnail、provider、prompt、sha256和rightsNote。新链可按项目hash去重。

删除路由存在孤立关系和物理文件泄漏风险。MVP Export会真实FFmpeg合并但不进入正式Receipt；D1 FALLBACK进入Artifact/Receipt但只是预登记Demo产物。

## 12. 十个主要问题

1. `o_tasks`、`sc_tasks`、canonical Receipt三套任务事实并存。
2. canonical硬编码海底捞、C1-C8、script-a和八镜。
3. 当前canonical不是实时AI生成，只是Fixture/FALLBACK。
4. 画布编辑、拖动、删除、锁定和历史没有持久化。
5. 拖动和可视连线没有真实业务语义。
6. 成功Receipt可能缺mediaUrl，任务成功不等于可预览。
7. 企业到production需要退出换身份，存在403交接断点。
8. 对话记忆和Continuity未统一，且旧摘要可能污染。
9. 旧素材删除可产生孤立数据和文件泄漏。
10. 权限、Key、计费和分佣仍是Demo或高风险遗留。

## 13. 不可破坏约束

- `demo-local-001`、C1-C8、`script-a`审批。
- `DemoWorkspace`和LocalStorage兼容。
- Storyboard `id/assetId/matchStatus`。
- Package `payloadDigest/idempotencyKey/version`。
- Grant `tenant/project/package/scope/expiry`。
- `sc_external_mappings`。
- `o_storyboard/track/video`关系。
- Task/Asset/Export Receipt和Outbox唯一性。
- reserve/consume/release语义。
- 工作台边界。

## 14. 关键代码路径

```text
src/app/Router.tsx
src/domain/demoIdentity.ts
src/mocks/demoWorkspace.ts
src/mocks/controlPlaneDemo.ts
src/stores/projectStore.ts
src/components/production/ProductionControlSurface.tsx
src/pages/production/IntegratedStoryCanvasPage.tsx
src/features/storycanvas/StoryCanvasApp.jsx
src/features/storycanvas/mvpApi.js
src/services/storyCanvasBridge.ts
apps/storycanvas/src/lib/initDB.ts
apps/storycanvas/src/lib/storycanvasMigrations.ts
apps/storycanvas/src/domain/storycanvas/*
apps/storycanvas/src/services/storycanvas/continuityMemory.ts
apps/storycanvas/src/services/storycanvas/mvpGeneration.ts
apps/storycanvas/src/services/storycanvas/mvpExport.ts
apps/storycanvas/src/services/storycanvas/productionContractAdapter.ts
apps/storycanvas/src/routes/production/v0.1/index.ts
apps/storycanvas/src/utils/agent/memory.ts
apps/storycanvas/src/utils/ai.ts
```

## 15. 关键截图路径

目录：`docs/video-canvas-audit/screenshots/`

```text
01-login-home.png
02-tenant-dashboard.png
03-project-dashboard.png
04-project-create-brief.png
05-script-editor.png
06-storyboard.png
07-rough-cut-output.png
08-production-workbench.png
09-production-inbox.png
10-generation-tasks.png
11-media-assets.png
12-export-provenance.png
13-package-grant-state.png
14-video-canvas-runtime.png
15-node-inspector.png
16-memory-workspace.png
17-canvas-assets.png
18-platform-admin.png
```

## 16. 仍无法确认

- 生产模型账户、余额、成本、质量和成功率。
- 真实订单、价格、分佣、退款和对账。
- 当前生产数据库和实际用户数据。
- FALLBACK视频文件是否存在和可播放。
- 线上API、对象存储、CDN和跨设备恢复。
- 真实内容审核、版权和商用授权。
- 团队协作、人工审核和剪辑工程导出。
- 3D白模、相机轨迹和预演输入的产品格式。

## 17. 第13-18关键判断

- 现状更适合继续研究垂直业务画布，而不是直接抽象通用画布。
- LibTV中镜头编排、实体一致性、参考素材、版本选择、时间线和来源链相关。
- LibTV中无业务约束的任意工作流、无限节点和与额度脱钩的自由生成不宜直接加入。
- 3D白模最可能接在分镜批准后、视频生成前，作为镜头Reference/Camera输入。
- 当前有Shot Contract、Reference、Camera语义和Asset扩展点，但没有3D Schema、坐标、轨迹、渲染器或预演任务。
- 下一步最应先研究稳定Shot ID到真实可播放Asset/Export的单一事实链，以及Continuity在真实模型请求中的效果。

这些是现状研究判断，不是实施或重构方案。

