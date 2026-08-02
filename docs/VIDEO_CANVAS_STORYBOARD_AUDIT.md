# 当前分镜功能审计

## 1. 根 SaaS 分镜

- 来源：已批准的 `script-a`和固定 Demo Workspace。
- 数量：8 镜，总时长 30s。
- 状态：6 个 upload 已匹配、1 个 shoot 待补拍、1 个 ai 缺镜。
- 粒度：一个 `StoryboardShot`就是一个镜头，不是场景集合。
- ID：`shot-01`至`shot-08`稳定外部 ID。
- 绑定：包含脚本内容、口播、字幕、机位、来源策略、assetId和 matchStatus。
- 当前 UI：以查看和创建 Package 为主，没有完整新增、编辑、排序、删除、批量生成或版本管理。

证据：`src/pages/storyboard/StoryboardPage.tsx`、`src/mocks/demoWorkspace.ts`、`src/domain/types.ts:132`。

## 2. 后端分镜对象

`o_storyboard`虽然命名为 storyboard，实际每一行是一个镜头：

```text
o_script
-> o_storyboard[]
-> trackId 聚合为 o_videoTrack
-> o_videoTrack 可有多个 o_video
-> o_videoTrack.videoId 选择采用版本
```

重要字段：`id, scriptId, prompt, filePath, duration, state, trackId, videoDesc, projectId, flowId, index`。

## 3. 完整链路

### 根 SaaS canonical

```text
Brief + C1-C8
-> A/B/C ScriptVersion
-> 人工批准 script-a
-> 固定 8 镜 StoryboardShot[]
-> ProjectProductionPackage 快照
-> sc_external_mappings
-> o_storyboard + sc_shot_metadata
-> StoryCanvas ShotNode
-> Demo Task/Asset/Export Receipt
-> 最终采用结果由 approved Asset + ExportReceipt 判定
```

### 旧真实生成

```text
o_script.content
-> extractAssets LLM
-> o_assets
-> 分镜结构
-> batchAddStoryboardInfo
-> o_storyboard
-> batchGenerateImage
-> o_storyboard.filePath
-> trackId 聚合
-> generateVideoPrompt
-> generateVideo / batchGenerateVideo
-> o_video
-> selectVideo
-> o_videoTrack.videoId
```

### MVP Continuity

```text
shotId + 用户提示
-> resolveShotContext
-> resolvedPrompt
-> sc_tasks
-> 图片/视频 Provider
-> 本地 OSS
-> mvpExport FFmpeg
```

## 4. 十五个分镜问题

| 问题 | 结论 |
|---|---|
| 从哪里生成 | 根 SaaS为固定 Demo；旧链可由 Agent/结构化输入写入；未找到 canonical 动态分镜生成 |
| 输入 | Script、Claims、资产、风格、镜头 Prompt |
| 文本还是图片 | 先有文本镜头，旧 API可生成分镜图 |
| 场景还是镜头 | 一个分镜记录对应镜头 |
| 稳定 ID | canonical 外部 ID稳定；旧内部 ID为整数；本地新增不稳定 |
| 与剧本绑定 | `scriptId`和 Package approvedScript绑定 |
| 与角色绑定 | `o_assets2Storyboard`及 Continuity Entity/Reference绑定 |
| 与最终视频绑定 | 通过 trackId、videoTrackId、Asset/Receipt间接绑定，不是一一对应 |
| 修改后同步 | 根 Storyboard UI缺少完整修改；旧 API修改 Prompt；画布 React 修改不落库 |
| 删除影响 | 旧删除会清部分关系，但可能遗留文件、视频和 Continuity孤儿 |
| 顺序保存 | `o_storyboard.index`；旧 flow保存可更新排序；画布拖动不更新 |
| 批量生成 | 旧图片/视频 API支持；canonical 禁用 |
| 单镜重生成 | 旧链支持多个 video；canonical 只开放固定案例 |
| 多版本 | `o_videoTrack`下多个 `o_video`，`videoId`选择采用版本 |
| 画布断点 | canonical API离线时只有占位镜；成功 Receipt也可能缺 `mediaUrl` |

## 5. 删除风险

- 删除镜头会删 `o_storyboard`、`o_assets2Storyboard`、`o_imageFlow`部分记录。
- 批量删除不保证删除分镜物理文件。
- 已生成 `o_video`可能残留。
- Continuity 表部分缺少镜头外键，可能形成孤儿。
- 前端画布删除只改 React State，刷新恢复，不影响数据库。

## 6. 是否形成稳定一一对应

没有。一个镜头可对应多个图片/视频任务和多个视频版本；一个 Track可聚合多个镜头；最终采用由 `o_videoTrack.videoId`或 canonical approved Asset/Export Receipt决定。当前 D1成功案例是确定性 Demo，不足以证明真实生成分镜和最终视频稳定一一对应。

