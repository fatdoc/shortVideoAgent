# 素材管理审计

## 1. 素材类型

| 类型 | 旧数据对象 | 新数据对象 | 当前业务状态 |
|---|---|---|---|
| 用户图片 | `o_assets` + `o_image` | `sc_media_assets` | legacy 可上传，根 Brief 上传为 Mock |
| AI 图片 | `o_image` | `sc_media_assets` + `sc_tasks` | legacy 可生成，canonical Fixture |
| 用户视频 | `o_video`或资产路由 | `sc_media_assets` | 代码存在，当前 Demo无实际上传证据 |
| AI 视频 | `o_video` | `sc_tasks` + `sc_media_assets` | legacy 可生成，canonical 固定失败案例 |
| 音频 | `o_assets`/音频绑定表 | Media Asset Schema可表达 | 独立 TTS未闭环 |
| 角色参考 | `o_assets(type=role)` | Entity/Reference/Character Asset | 组件存在但导航不可达 |
| 场景参考 | `o_assets(type=scene)` | Reference Binding | legacy/Continuity存在 |
| 道具参考 | `o_assets(type=props)` | Entity/Reference | legacy存在 |
| 风格参考 | Project artStyle/Visual Manual | Continuity Profile | 存在配置结构 |
| 成片 | `o_video`/MVP Export | `sc_export_artifacts` | 三套导出事实未统一 |
| 临时文件 | OSS temp/export temp | 本地临时目录 | 清理策略不完整 |

## 2. 文件存储

本地 OSS根目录：`<data>/oss/`。

```text
/<projectId>/role/*.jpg
/<projectId>/scene/*.jpg
/<projectId>/props/*.jpg
/<projectId>/assets/*
/<projectId>/video/*.mp4
/mvp/<projectId>/images/<taskId>.jpg
/mvp/<projectId>/videos/<taskId>.mp4
/mvp/<projectId>/exports/<exportId>.mp4
```

核心：`apps/storycanvas/src/utils/oss.ts`。

## 3. 数据库存储

`sc_media_assets`保存：

```text
id, projectId, imageId, videoId, type, source, originalName,
mimeType, byteSize, localPath, remoteUrl, thumbnailPath,
durationMs, width, height, fps, provider, prompt, sha256,
rightsNote, metadataJson, createdAt
```

同项目 `sha256`唯一，可用于去重；旧 `o_assets/o_image`没有同等统一去重保证。

## 4. 项目、用户和公共素材

- 旧素材和新素材均可按 projectId区分。
- 旧路由普遍直接信任请求 projectId，未发现严格项目所有权检查。
- 根 SaaS租户隔离只是前端 Demo身份。
- 没有证据证明存在真正公共素材库和跨租户复用策略。
- 资产来源可通过 source/provider/prompt/sha256/rightsNote/Receipt追踪，但旧资产字段不统一。

## 5. 删除影响

| 操作 | 实际行为 | 风险 |
|---|---|---|
| `assets/batchDelete` | 只删 `o_assets` | 遗留 `o_image`、文件和关联表 |
| `assets/delAssets` | 删除部分 image和文件 | 不清理所有 script/storyboard/audio关联 |
| `assets/delImage` | 先删 DB 后查路径 | 物理文件大概率无法删除 |
| 删除分镜 | 删 storyboard和部分关联 | 文件、视频、Continuity可能残留 |
| 删除项目 | 手工删旧数据和整个项目 OSS | 无事务，中途失败可产生半删除状态 |
| 前端删除节点 | 只改 React State | 不删除任何业务资产 |

## 6. 素材能力回答

| 问题 | 结论 |
|---|---|
| 文件位置 | 本地 OSS，也支持 remoteUrl字段 |
| 数据库保存 | 元数据、路径、Provider、Prompt、hash、rights |
| 区分项目 | 是 |
| 区分用户 | 数据结构不足以证明严格用户隔离 |
| 公共素材库 | 无法确认 |
| 素材复用 | 旧关联表和 Reference Binding可复用 |
| 来源追踪 | 新资产较完整，旧资产不一致 |
| 删除影响节点 | 关系清理不完整，可能孤立或失效 |
| 孤立素材 | 存在明确风险 |
| 文件失效 | 本地路径、未清理文件、remoteUrl都可能失效 |
| 缩略图 | `thumbnailPath`字段存在，生成覆盖无法确认 |
| 标签与搜索 | 旧类型/名称查询存在；统一标签搜索不完整 |
| 重复上传 | 新资产同项目 sha256可去重；旧链可能重复 |

## 7. 最终交付素材

- MVP Export真实执行 FFmpeg，但不登记正式 Artifact/Receipt。
- D1 FALLBACK登记 `/media/d1/demo-local-001-fallback-synthetic-v1.mp4`，不在请求时合成。
- FALLBACK标记 `DEMO_ONLY`、`brandQa=not_approved`、`editorialQa=not_evaluated`。
- 根 SaaS要求 ExportReceipt和 approved Asset 才将 `playable`视为真。
- 本次运行没有得到可验证成片 URL。

