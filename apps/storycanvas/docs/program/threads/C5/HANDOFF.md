# C5 HANDOFF · D1 STORYCANVAS ADAPTER WAVE

> 2026-07-30 D1 P0 Fix Wave 收口：第 8 节是 transport、权限与 canonical/legacy 门禁说明；第 9 节是 Round 3 可播放纯合成 FALLBACK 的最新权威说明。

## 1. 基线与边界

- 工作树：`/Users/docfat/.codex/worktrees/19f7/短视频agent`
- Git：detached HEAD `b4295471825427fab248c10dd41884fdea31993d`
- 运行配置：`gpt-5.6-sol / high / 1.5x`
- 合同版本：`0.1`
- canonical fixture：`demo-local-001`
- source suite digest：`sha256:ecb4856cbceb568b931360335822e3beb590b6a8feefa07e773f3813d2552823`
- package embedded digest：`sha256:113bf8ae7b01c5b6328a59afd4d9d0b3c20b8f8978901b1ab2c74e3a2b75d645`
- Commit / merge：无；本轮未提交、未合并。
- 验证限制：按 C0 指令未运行 test、build、lint 或 governance。
- 明确未实现：Tenant、Wallet、CreditLedger、RateCard、渠道、客户价格、SaaS 公共代码、真实 Provider credential。

## 2. 已完成

1. `ProjectProductionPackage v0.1`
   - 严格 top/nested Schema、`contractVersion=0.1`、C1—C8、script-a、8 镜、禁止字段和 canonical digest。
   - 相同 key + 相同 payload 返回 `duplicate=true`。
   - 相同 key + 不同 payload 返回 `IDEMPOTENCY_CONFLICT`。
   - 未知合同、digest、tenant/project/capability/scope 不一致进入 `rejected` attempt。
   - accepted package 快照不可变；accepted/duplicate/rejected attempt 均可查询。
2. Mock grant
   - 只接受 canonical `mock-handle:grant-demo-local-001-v1` 与最小 capability/scope。
   - 明确不是签名 credential；不进入 URL 或 LocalStorage。
3. 稳定 ID
   - 使用 `sc_external_mappings` 映射 control-plane 外部字符串与 Toonflow/sc 内部 ID。
   - 未修改历史整数主键。
4. 生产投影
   - 创建独立 D1 项目、script-a、Scene、八个 `o_storyboard/sc_shot_metadata`。
   - 创建海底捞品牌、三里屯门店、会员权益结构化实体、八镜 ShotContract 与七条 relation。
   - 普通切镜 `usePreviousEndFrame=false`，未推翻现有连续性模型。
5. Deterministic Demo Provider / Outbox
   - `task-demo-success` + `asset-demo-generated-shot-07`。
   - `task-demo-failure` 无 output asset，错误 `DEMO_PROVIDER_FAILURE`。
   - 任务、资产和 Outbox 重放不重复；不同 payload/终态由 conflict guard 拒绝。
   - 不写钱包或商业账本。
6. 资产与导出
   - 包输入素材、回执引用、生成资产统一登记 `sc_media_assets`。
   - 基础合并登记 `ExportArtifact` 与 Package → ScriptVersion → Shots → Task → Assets → Export 来源链。
   - Round 3 新增完全自生成的本地 MP4，作为 shot-05 FALLBACK 修复引用与 8-shot/basic-merge Demo Artifact；可播放但始终是 `FALLBACK / DEMO_ONLY / 非 REAL`，不宣称完整 FireRed AI 剪辑或正式品牌成片。
7. 前端
   - canonical 页面不再自举生产包；等待控制平面通过内存 `postMessage` bridge 提交当前 grant 后，只读 accepted 包。
   - 展示海底捞三里屯、script-a、8 镜、C1—C8、规则、package/version/digest 和 canonical Truth mode。
   - 镜头 07 可重放成功 Demo；镜头 05 可展示失败且不生成假资产。
   - 提供可见“返回企业项目”链接。

## 3. 精确入口

### StoryCanvas

- 开发预览 deep link：`http://localhost:50188/storycanvas/demo-local-001`
- StoryCanvas path：`/storycanvas/demo-local-001`
- 默认返回企业项目：`http://localhost:5173/enterprise/projects/demo-local-001`
- 可用 `VITE_CONTROL_PLANE_URL` 替换控制平面 host；路径保持 `/enterprise/projects/demo-local-001`。
- 共享前端 client 当前仍可能执行本地 StoryCanvas JWT 登录；URL 不携带 grant/token。该登录是旧页面兼容行为，不是 `/api/production/v0.1/` 的服务端授权依据。

### HTTP API

Base：`http://localhost:10588/api/production/v0.1`

| Method | Path | 用途 |
|---|---|---|
| `GET` | `/demo/fixture` | 读取 canonical 生产侧 fixture 与 source digest |
| `POST` | `/demo/bootstrap` | 已禁用，返回 `410 LEGACY_BOOTSTRAP_DISABLED` |
| `POST` | `/packages` | SaaS 发包；body `{ package, grant, requestedCapabilityId? }` |
| `GET` | `/packages/package-demo-local-001-v1` | accepted 包、snapshot 与该 package attempts |
| `GET` | `/package-attempts?projectId=demo-local-001` | accepted/duplicate/rejected attempt |
| `GET` | `/projects/demo-local-001` | 画布 bootstrap：项目、包、脚本、Claims、规则、8 镜、Truth、映射、链接 |
| `GET` | `/projects/demo-local-001/entry` | SaaS deep link、返回路径、package/version/digest |
| `POST` | `/projects/demo-local-001/demo-provider/success` | 重放 shot-07 成功任务与资产回执 |
| `POST` | `/projects/demo-local-001/demo-provider/failure` | 重放 shot-05 失败任务；无输出资产 |
| `GET` | `/projects/demo-local-001/tasks` | 查询生产任务状态 |
| `GET` | `/projects/demo-local-001/assets` | 查询受控 MediaAsset、checksum、rights/review |
| `GET` | `/projects/demo-local-001/receipts` | 查询 Receipt Outbox 与 payload |
| `POST` | `/projects/demo-local-001/fallback-export` | 成功/失败任务证据齐备后登记可播放 DEMO_ONLY FALLBACK 与 Export receipt |
| `GET` | `/projects/demo-local-001/artifacts` | 查询 FALLBACK ExportArtifact 与来源链 |

旧 `/api/*` 业务接口继续位于 StoryCanvas 现有本地 JWT middleware 后；`/api/production/v0.1/` 明确跳过旧 JWT middleware，只使用 project-scoped Mock grant 授权。生产合同 GET 必须显式提交 `X-StoryCanvas-Demo-Grant`，生产动作 POST 必须显式提交 `body.grant`；服务端只接受当前有效、与 accepted package 完全同 scope 的 grant。

## 4. 状态机

```text
PackageAttempt:
  received -> accepted
           -> duplicate (same key + same payload)
           -> rejected  (schema/version/digest/scope/conflict)

ProductionProject:
  package accepted -> canvas_ready

DeterministicTask:
  task-demo-success -> succeeded -> Asset registered -> Outbox pending
  task-demo-failure -> failed -> no output asset -> Outbox pending

ExportArtifact:
  success/failure evidence -> demo_only (FALLBACK, playable, technical QA passed)
                           -> editorial not_evaluated / brand not_approved
```

Outbox `pending` 只表示等待 SaaS transport/ack；StoryCanvas 不据此推断或修改客户额度。

## 5. 关键文件

- `migrations/003_storycanvas_production_contract.ts`
- `src/domain/productionContract/v01.ts`
- `src/fixtures/production-contract/v0.1/*`
- `src/services/storycanvas/productionContractAdapter.ts`
- `src/routes/production/v0.1/index.ts`
- `src/lib/storycanvasMigrations.ts`
- `src/router.ts`
- `src/services/storycanvas/mvpGeneration.ts`
- `frontend/src/mvpApi.js`
- `frontend/src/App.jsx`
- `docs/program/threads/C5/*`

六个 canonical JSON 已与权威目录逐文件 `cmp`，结果全部相同。`commercial-credit-fixture.json` 按边界明确未复制、未读取到运行时。

## 6. 未完成 / C6、C7 注意

1. C6 仍需在 SaaS 仓库接发包按钮、StoryCanvas host 和返回 host；见 `REQ-C5-006`。
2. C7 尚未运行验收；本轮不能运行 test/build/lint/governance。见 `REQ-C5-007`。
3. D1 grant 是 deterministic Mock，不验证正式签名、iss/aud/nbf/revocation/refresh；不能用于生产安全声明。
4. Outbox 已提供显式领取、重投计数和 ack transport，但没有后台主动推送 worker。
5. package 原始输入素材仍是受控引用；Round 3 Export 已有纯合成真实 MP4 字节，但只验证播放与来源链，不是正式营销内容。
6. FireRed 会话/时间线 Adapter、真实 Provider 成片、CanvasVersion 保存、editorial QA 与 brand QA 尚未实现。
7. 真实 Provider/FireRed 不可用时必须留在同一 `demo-local-001` 项目并显示 `FALLBACK`，不得换项目、截图或宣称完整 AI 剪辑。

## 7. 静态核验结论

- 工作树未发现非本轮或非既有 C5 文档的意外改动。
- 前端 D1 主路径检索不到“南城咖啡”。
- canonical 六文件与权威 source 字节一致。
- 未触碰 SaaS、公共合同、商业 fixture、钱包/费率/渠道或他人目录。

## 8. D1 P0 Fix Wave 收口（C4/C6/C7 执行此节）

### 8.1 发包、grant 与 deep link

1. 发包：

   ```http
   POST http://localhost:10588/api/production/v0.1/packages
   Content-Type: application/json

   {
     "package": { "...": "ProjectProductionPackage v0.1" },
     "grant": { "...": "current DemoProjectGrant" }
   }
   ```

   返回 `data.result = accepted | duplicate`、`data.status`、`data.deepLink`。拒绝返回 `data.result = rejected`、`data.deepLink = null`。同幂等键同 payload 为 duplicate；同键不同 payload 为 `IDEMPOTENCY_CONFLICT`。

2. 权限顺序已固定：每次 create/replay 都先校验显式 grant 的 Schema、15 分钟 TTL、当前有效期、tenant、organization、project、package/version、capability 与 scope，再查幂等记录。duplicate 不得绕过 grant；过期 package/grant 不允许新动作。

3. accepted/duplicate 的默认 deep link：

   `http://localhost:50188/storycanvas/demo-local-001`

   可通过 `STORYCANVAS_FRONTEND_URL` 改 host，path 固定为 `/storycanvas/demo-local-001`。任何非 `demo-local-001` 深链或 package mismatch 均安全拒绝，不回退 canonical。

4. grant 不进入 URL、LocalStorage 或 sessionStorage。控制平面打开 deep link 后，响应 StoryCanvas 的：

   ```js
   {
     type: "storycanvas:d1-grant-request",
     projectId: "demo-local-001",
     packageId: "package-demo-local-001-v1"
   }
   ```

   并向 StoryCanvas window 发送：

   ```js
   child.postMessage({
     type: "storycanvas:d1-grant",
     projectId: "demo-local-001",
     packageId: "package-demo-local-001-v1",
     grant
   }, "http://localhost:50188")
   ```

   StoryCanvas 校验 sender、origin、project/package/grant 一致性，只在 JS 内存保存 grant；读取成功后回：

   ```js
   {
     type: "storycanvas:d1-ready",
     projectId: "demo-local-001",
     packageId: "package-demo-local-001-v1"
   }
   ```

### 8.2 精确查询与动作 API

生产合同 GET 不要求本地 JWT，必须提交：

```http
X-StoryCanvas-Demo-Grant: base64url(JSON.stringify(grant))
```

| Method | Path | grant 提交 | 说明 |
|---|---|---|---|
| `GET` | `/projects/demo-local-001` | header | canonical 项目、8 镜、连续性、Truth、链接 |
| `GET` | `/projects/demo-local-001/tasks` | header | Demo task；`truthMode=MOCK-CONTRACT` |
| `GET` | `/projects/demo-local-001/assets` | header | MediaAsset、checksum、rights/review |
| `GET` | `/projects/demo-local-001/artifacts` | header | FALLBACK Artifact 与来源链 |
| `GET` | `/packages/package-demo-local-001-v1` | header | accepted snapshot 与 attempts |
| `GET` | `/package-attempts?projectId=demo-local-001` | header | accepted/duplicate/rejected attempts |
| `POST` | `/projects/demo-local-001/demo-provider/success` | body `{ grant }` | shot-07 MOCK-CONTRACT success task + controlled asset |
| `POST` | `/projects/demo-local-001/demo-provider/failure` | body `{ grant }` | shot-05 MOCK-CONTRACT failed task，无假资产 |
| `POST` | `/projects/demo-local-001/fallback-export` | body `{ grant }` | 登记同项目可播放 FALLBACK Demo 与 Export receipt |

Demo Provider success/failure、receipt poll/ack 与 FALLBACK 每次都重新校验当前 package/grant；服务端不自动代入 fixture grant。

### 8.3 Receipt Outbox transport

领取待投递：

```http
GET /api/production/v0.1/receipts?projectId=demo-local-001&status=pending
X-StoryCanvas-Demo-Grant: <base64url JSON grant>
```

首次领取把记录由 `pending` 改为 `delivered`，分配稳定 `deliveryId`，写入 `lastAttempt`、`deliveredAt`；`retryCount` 初始为 `0`。查询 `status=delivered` 表示重投，每次递增 `retryCount` 并更新 `lastAttempt`。

确认：

```http
POST /api/production/v0.1/receipts/:id/ack
Content-Type: application/json

{
  "grant": { "...": "current DemoProjectGrant" },
  "deliveryId": "delivery-<receipt-id>"
}
```

状态机：

```text
pending --GET pending--> delivered --POST ack--> acknowledged
                              |
                              +--GET delivered--> delivered (retryCount + 1)
```

相同 receipt + 相同 deliveryId 重复 ack 返回幂等 `duplicate=true`；不同 deliveryId 冲突；未 delivered、错 project/package、缺失或过期 grant 均拒绝。

### 8.4 canonical/legacy 与 Truth 门禁

- `/api/mvp/generation`、`/api/mvp/generation/:id`、`/api/mvp/export` 默认返回 `403 LEGACY_MODE_REQUIRED`；仅显式 `X-StoryCanvas-Mode: legacy` 可进入历史非 D1 路径。
- legacy 模式只选择/创建历史 `storycanvas-live-mvp` 项目；canonical 模式只使用 `sc_external_mappings` 中 accepted `demo-local-001`，映射不存在时拒绝，绝不旁路创建“南城咖啡”。
- canonical UI 隐藏角色 Provider/设置和旧批量/合并入口；连续性为只读。只有 shot-07 图片 success 与 shot-05 视频 failure 暴露确定性 Demo 动作。
- Demo task/asset 始终是 `MOCK-CONTRACT`；`REAL-CAP` 只统计真实 Provider 任务，D1 canonical 当前为 `0`；`FALLBACK` 独立显示，不计作真实生成。
- 旧真实 Provider 能力仅保留在显式非 D1 legacy mode，不影响 canonical Truth、额度或来源链。

### 8.5 Round 2 风险状态

原“无权利明确可播放素材”的 P0 已由 C0 Round 3 授权的纯合成 lavfi 媒体关闭。关闭范围只包括 Demo 导出、播放和来源链技术证明；不代表正式 editorial/brand QA，详见第 9 节。

### 8.6 本轮约束

- 未运行 test/build/lint/governance。
- 未提交、未合并。
- 未修改 SaaS、公共合同、共同记忆、Wallet/价格/RateCard/渠道。

## 9. Round 3 · Playable Synthetic FALLBACK

### 9.1 二进制与来源

- 文件：`frontend/public/media/d1/demo-local-001-fallback-synthetic-v1.mp4`
- URL：`http://localhost:50188/media/d1/demo-local-001-fallback-synthetic-v1.mp4`
- 生成器：本机 `ffmpeg 8.1.2`
- 纯合成输入：lavfi `testsrc2=size=540x960:rate=30:duration=6` + `sine=frequency=440:sample_rate=48000:duration=6`
- 未下载、未引用历史咖啡图、品牌照片、第三方音视频或截图。
- 权利声明：`SELF_GENERATED_SYNTHETIC / NO_THIRD_PARTY_ASSET`
- 尺寸/时长：540×960、6.000 秒、30 fps
- Codec：H.264 video + AAC mono audio（48 kHz）
- Byte size：2,155,679
- SHA-256：`55370297920ad6f957a3bbcdb4cbdc2ff088ba7594062a07c589b7a6db3727ef`

上述元数据来自确定生成参数及 C0 允许的单次 `ffprobe` 采集。

### 9.2 Asset、Artifact 与 QA 分层

shot-05 修复资产：

- external asset ID：`asset-demo-local-001-fallback-shot-05-synthetic-v1`
- `source=FALLBACK`
- `rightsSource=SELF_GENERATED_SYNTHETIC`
- `thirdPartyAssets=false`
- `technicalQa=passed`
- `editorialQa=not_evaluated`
- `brandQa=not_approved`
- `deliveryClaim=DEMO_ONLY`

ExportArtifact：

- external artifact ID：`export-demo-local-001-fallback-v1`
- `mode/truthMode=FALLBACK`
- `status=demo_only`
- `playable=true`
- `technicalQa=passed`
- `editorialQa=not_evaluated`
- `brandQa=not_approved`
- `deliveryClaim=DEMO_ONLY`
- source chain：Package → script-a → 8 shots/basic-merge → shot-05 synthetic repair → Export

technical playback QA 只证明 MP4 可解码、可由 canonical UI 访问和播放。它不等于内容质量、品牌或正式业务 QA passed。

### 9.3 Export receipt Outbox

调用 `POST /projects/demo-local-001/fallback-export` 时仍必须显式提交当前 `body.grant`。Adapter 登记或幂等重放 Artifact 后，同时产生：

- `receiptType=export`
- `exportId=export-demo-local-001-fallback-v1`
- `exportArtifactId=export-demo-local-001-fallback-v1`（扩展别名）
- envelope `businessId=exportId`
- `generationTaskId=task-demo-success`
- `status=succeeded`
- `outputAssetIds=[asset-demo-local-001-fallback-shot-05-synthetic-v1]`
- `checksum=sha256:55370297920ad6f957a3bbcdb4cbdc2ff088ba7594062a07c589b7a6db3727ef`
- `error=null`
- Outbox envelope 初始 `status=pending`（与 payload 的导出结果 `status=succeeded` 分层）
- payload 同时保留 tenant/project/package、idempotencyKey、createdAt、shot IDs、shot-05 repair asset、FALLBACK Truth、DEMO_ONLY 声明、technical/editorial/brand QA、媒体 path/URL、byte size、duration、dimensions、codecs 与权利来源扩展。
- Outbox `payloadDigest` 由上述最终完整 payload 计算；envelope `businessId` 与 payload `exportId` 始终一致。

领取、重投和 ack 继续复用第 8.3 节的显式-grant Outbox transport。

### 9.6 REQ-C7-014 对齐说明

C5 已按 C4 ExportReceipt Schema 补齐最小字段：`exportId`、`generationTaskId`、`status`、`outputAssetIds`、`checksum`、`error`、`truthMode`、`tenantId/projectId/packageId`、`idempotencyKey`、`createdAt`。原有 `exportArtifactId` 和 FALLBACK Demo 扩展字段保留，不修改 canonical 公共合同。

### 9.4 canonical UI 声明

项目页直接播放该 Artifact，并醒目标注：

“本地合成演示片，仅验证流程，不代表 AI 生成质量或正式交付。”

UI 同时显示 `FALLBACK / DEMO_ONLY / 非 REAL`、技术/编辑/品牌 QA 三层状态以及 `SELF_GENERATED_SYNTHETIC / NO_THIRD_PARTY_ASSET`。legacy Provider 路径继续隔离。

### 9.5 验证限制

- 本轮只执行 C0 明确批准的 ffmpeg 媒体生成和一次该媒体的 ffprobe 元数据采集。
- 未运行 test/build/lint/browser/governance。
- 未提交、未合并。

## 10. 2026-07-30 Runtime Gate Addendum

本节取代前文“未运行”限制，原文保留为验收前历史记录。

- Core tests：35/35 PASS。
- Frontend canonical tests：9/9 PASS。
- Typecheck、frontend build、root build：PASS。
- package：HTTP 201，`demo-local-001 / package-demo-local-001-v1`。
- grant handoff：父窗 `handoff_ready`，子窗加载 8 镜 canonical package。
- Outbox：success Task、Asset、failure Task、Export 共 4 条全部 `acknowledged`。
- wrong project：403 `PROJECT_SCOPE_MISMATCH`。
- FALLBACK：浏览器实际播放，readyState 4、6 秒、540×960、SHA-256 与登记一致。
- 结论：`RUNTIME_ACCEPTED_FOR_INTERNAL_DEMO`；不升级为真实 Provider、FireRed、editorial/brand QA 或生产发布。
