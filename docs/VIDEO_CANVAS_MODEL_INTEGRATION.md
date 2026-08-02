# 模型与服务集成审计

## 1. 统一适配层

核心入口：

```ts
u.Ai.Text()
u.Ai.Image()
u.Ai.Video()
u.Ai.Audio()
```

关键代码：`apps/storycanvas/src/utils/ai.ts`、`vendor.ts`、`vm.ts`、`config/loadModels.ts`、`config/models.schema.ts`。

## 2. 默认模型配置

| 能力 | 默认模型 | 是否可配置 | 当前主流程 |
|---|---|---|---|
| 文本 | `openai:gpt-5.2` | 是 | Agent legacy 可调用，根 SaaS脚本为 Mock |
| 主图片 | `openai:gpt-image-2` | 是 | canonical 不调用 |
| 备用图片 | `volcengine:seedream-4-5-251128` | 是 | legacy MVP 可调用 |
| 视频 | `byteplus:dreamina-seedance-2-0-260128` | 是 | legacy MVP 可调用 |
| TTS | 无绑定 | 配置结构存在 | 不可确认可用 |

## 3. 服务和能力

| 服务或模型 | 能力类型 | 调用位置 | 输入 | 输出 | 是否付费 |
|---|---|---|---|---|---|
| OpenAI | LLM、GPT Image | `data/vendor`适配、`u.Ai.*` | Prompt、参考图 | 文本或图片 | 可能 |
| DeepSeek | LLM | Vendor 适配 | Prompt | 文本 | 可能 |
| Volcengine | Doubao、Seedream | Vendor 适配 | Prompt、参考图 | 文本/图片 | 可能 |
| BytePlus/VolcengineSd2 | Seedance 视频 | `byteplusVideo.ts`等 | Prompt、首图/尾图/参考 | 异步视频 Task | 可能 |
| MiniMax | 文本、图片、Hailuo 视频 | Vendor 适配 | Prompt、媒体参考 | 文本/图片/视频 | 可能 |
| KlingAI | 视频 | Vendor 适配 | Prompt、图片 | 视频 Task | 可能 |
| Vidu | 图片、视频 | Vendor 适配 | Prompt、参考 | 媒体 Task | 可能 |
| AtlasCloud | 聚合模型 | Vendor 适配 | 模型参数 | 媒体/文本 | 可能 |
| Grsai | 聚合图片/视频 | Vendor 适配 | Prompt | 媒体 | 可能 |
| Toonflow | 自定义供应商 | Dynamic Vendor | 配置化输入 | 不同能力 | 无法确认 |
| Demo Provider | 固定成功/失败 | `/production/v0.1/demo-provider/*` | shot-07/shot-05 | Fixture Receipt | 否 |
| FFmpeg | 视频合并 | `mvpExport.ts` | 成功视频文件 | 720x1280 MP4 | 本地计算 |
| OpenStoryline/FireRed | 剪辑集成 | integration/Artifact文案 | 媒体与脚本 | 无完整在线证据 | 无法确认 |

代码覆盖文生图、图生图、文生视频、单图生视频、首尾帧、多图参考、视频参考、音频参考和部分音画同生。

未发现完整独立 TTS、数字人驱动、OCR、抠图、3D 白模、3D 场景理解、相机轨迹或预演视频模型适配。

## 4. Prompt 结构

| Prompt 来源 | 作用 |
|---|---|
| `apps/storycanvas/data/skills` | Agent 决策和子 Agent 规范 |
| `data/modelPrompt/video` | 按视频模型的专用 Prompt |
| SQLite `o_prompt` | eventExtraction、scriptAssetExtraction、videoPromptGeneration、audioBindPrompt |
| SQLite `o_modelPrompt` | 模型专用覆盖，当前无记录 |
| `getPrompts.ts` | 事件提取等硬编码 Prompt |
| Continuity `resolvedPrompt` | 结构化世界记忆编译后的生成 Prompt |

视频 Prompt选择顺序：`o_modelPrompt` -> `data/modelPrompt/video/*.md` -> `o_prompt.videoPromptGeneration`。

## 5. 模型选择和参数

- 项目表 `o_project`保存 imageModel、imageQuality、videoModel、videoRatio。
- 配置文件和 SQLite Vendor配置并存。
- 用户可以通过设置路由配置 Vendor和模型绑定，但当前根 SaaS没有暴露这些设置。
- legacy 页面和 Agent存在各自封装，统一 `u.Ai.*`之上仍有重复业务包装。
- Prompt会保存到 `o_prompt`、`o_modelPrompt`、`sc_tasks.inputJson`、媒体资产 `prompt`等位置。

## 6. Task、轮询、重试和成本

| 能力 | 旧 `o_tasks` | 新 `sc_tasks` |
|---|---|---|
| 状态 | 进行中/完成/失败 | queued/running/succeeded/failed |
| 进度 | 无 | 0/10/20/45/100 |
| 外部 Task ID | 通常未持久化 | `externalTaskId` |
| 幂等 | 无统一字段 | `idempotencyKey` |
| 输入输出 | relatedObjects/describe | inputJson/outputJson/errorJson |
| 重试 | 不统一 | 网络错误最多 4 次；无统一任务 retry API |
| 轮询 | 各路由自行实现 | 视频约 5 秒，最长约 20 分钟 |
| 成本 | 无 | 字段存在，真实代码未核算 |

当前没有模型成本与 AI_VIDEO_CREDIT、代理分成、钱包扣费、失败退款的真实联动。

## 7. API Key 安全

- 新配置可走环境变量。
- 旧 `o_vendorConfig.inputValues`可明文保存 Key。
- `agentSetKey.ts`可明文写 SQLite。
- `getVendorList.ts`可能原样返回 Vendor输入配置。
- Dynamic Vendor VM暴露网络、加密和 JWT能力，执行 timeout为 0。
- 不能判定达到生产密钥安全要求。

本次没有读取或展示任何实际密钥。

