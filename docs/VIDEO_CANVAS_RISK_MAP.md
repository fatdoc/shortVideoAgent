# 视频画布现状风险地图

| 编号 | 类型 | 问题 | 用户影响 | 证据位置 | 严重程度 | 修改风险 |
|---|---|---|---|---|---|---|
| A-01 | 商业流程 | 企业到 production必须退出切换身份 | “进入媒体生产”后可能403，流程中断 | `StoryboardPage.tsx:101`、`Router.tsx:83` | P0 | 中 |
| A-02 | 商业流程 | 新建项目只覆盖固定 Demo | 用户误以为创建新项目 | `BriefPage.tsx:76` | P1 | 高 |
| A-03 | 商业流程 | 三级渠道没有报价、分佣和结算 | 无法证明代理商业闭环 | `controlPlaneDemo.ts:274` | P0 | 高 |
| A-04 | 商业流程 | AI额度与真实模型成本无联动 | 无法核算毛利、退款和分成 | `creditLedger.ts`、`sc_tasks` | P0 | 高 |
| A-05 | 商业流程 | 最终交付当前只是 Demo回执 | 老板无法验收真实成片 | `ProductionControlSurface.tsx` | P0 | 高 |
| B-01 | 产品逻辑 | 页面显示28套餐/128事实/23禁用词，底层Demo为2/8/5 | 数据可信度下降 | `BrandBrainPage.tsx:350`、`demoWorkspace.ts` | P1 | 中 |
| B-02 | 产品逻辑 | 分镜主要只读 | 用户不能完整修改、排序和版本化 | `StoryboardPage.tsx` | P1 | 中 |
| B-03 | 产品逻辑 | 角色资产组件不可达 | 无法完成要求中的创建角色流程 | `StoryCanvasApp.jsx:61` | P1 | 低 |
| B-04 | 产品逻辑 | 多个路由复用同一页面 | 页面名称与能力边界不清 | `Router.tsx:142` | P2 | 中 |
| B-05 | 产品逻辑 | canonical硬编码海底捞、C1-C8、script-a和八镜 | 无法支持真实多项目 | `productionContract/v01.ts:250` | P0 | 高 |
| C-01 | 画布交互 | 没有真实节点连线 | 用户看到线但线不传数据 | `storycanvas.css`、`StoryCanvasApp.jsx` | P1 | 中 |
| C-02 | 画布交互 | 拖动不改变顺序 | 用户认为已编排，实际生成顺序不变 | `ShotNode`无 `onDragEnd` | P0 | 中 |
| C-03 | 画布交互 | 撤销重做只是按钮 | 误导用户，错误操作无法恢复 | `StoryCanvasApp.jsx:1658` | P1 | 中 |
| C-04 | 画布交互 | 画布编辑、新增、删除不保存 | 刷新丢失，跨设备不可用 | `StoryCanvasApp.jsx:2134` | P0 | 高 |
| C-05 | 画布交互 | API离线只剩加载占位镜 | 主工作台无法执行 | 本次 `14-video-canvas-runtime.png` | P0 | 中 |
| C-06 | 画布交互 | 成功Receipt可能没有 mediaUrl | completed状态没有可预览媒体 | `StoryCanvasApp.jsx:1747,2054` | P0 | 高 |
| D-01 | 记忆 | 对话记忆与Continuity两套系统未统一 | “记住了”不等于生成遵守 | `memory.ts`、`continuityMemory.ts` | P1 | 高 |
| D-02 | 记忆 | shortTerm/summary/RAG可能重复 | 旧要求被重复放大、增加Token | `Memory.get/buildMemPrompt` | P1 | 中 |
| D-03 | 记忆 | 摘要不会自动失效 | 旧设定污染新镜头 | `memory.ts` | P1 | 高 |
| D-04 | 记忆 | world_events和reviews为空 | 不能证明镜头后状态和自动审查闭环 | 当前SQLite只读数据 | P1 | 高 |
| D-05 | 记忆 | canonical不调用真实生成 | 结构化记忆效果无法验证 | `/production/v0.1` | P0 | 高 |
| E-01 | 分镜 | Shot、Track、Video不是一一对应且三链语义不同 | 最终采用结果难追踪 | `o_storyboard/o_videoTrack/o_video` | P1 | 高 |
| E-02 | 分镜 | 画布本地Shot没有稳定业务ID | 无法保存或下游识别 | `createNewShot()` | P1 | 中 |
| E-03 | 分镜 | 删除会遗留文件、视频或Continuity | 孤立数据和存储泄漏 | 删除路由 | P1 | 高 |
| E-04 | 分镜 | canonical固定Demo Provider | 分镜到真实视频链未证明 | demo-provider routes | P0 | 高 |
| F-01 | 技术 | `o_tasks`、`sc_tasks`、Receipt三套任务事实 | 状态冲突、重复计费风险 | 数据表和Adapter | P0 | 极高 |
| F-02 | 技术 | `o_agentWorkData`和结构化表双事实源 | 保存恢复结果不一致 | `saveFlowData/getFlowData` | P0 | 高 |
| F-03 | 技术 | MVP Export不进入Artifact/Receipt | 真实生成无法进入商业交付 | `mvpExport.ts` | P0 | 高 |
| F-04 | 技术 | D1 FALLBACK是预登记静态产物 | 回执成功不等于实时合成 | `ensureFallbackExport()` | P1 | 中 |
| F-05 | 技术 | 素材删除不完整 | 孤立记录、失效引用和文件泄漏 | `batchDelete/delAssets/delImage` | P1 | 高 |
| F-06 | 技术 | API启动自动迁移 | 运行和审计难以保持只读 | `utils/db.ts:38` | P1 | 高 |
| F-07 | 技术 | 固定Grant有过期风险 | Demo可能突然无法进入 | Grant校验、Fixture | P1 | 中 |
| F-08 | 技术 | 权限只在前端工作台级 | 跨租户和项目数据风险 | `demoIdentity.ts:195` | P0 | 极高 |
| F-09 | 技术 | API Key可明文存在SQLite并可能返回前端 | 密钥泄露风险 | `agentSetKey.ts`、`getVendorList.ts` | P0 | 极高 |
| F-10 | 技术 | Domain Schema与DB写值存在漂移 | 运行时解析失败 | StoryCanvas Schema/Service | P0 | 高 |

## 最高风险改动区

- ID Mapping、Package Digest、Grant Scope。
- `o_storyboard/track/video`关系。
- `sc_tasks/sc_media_assets/sc_export_artifacts/sc_receipt_outbox`。
- Credit reserve/consume/release。
- LocalStorage `DemoWorkspace`结构。
- 角色工作台守卫和租户边界。

本文件只记录问题和修改风险，不给出重构方案。

