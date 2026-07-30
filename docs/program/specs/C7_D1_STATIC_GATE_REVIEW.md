# C7 D1 Static Gate Review · Round 3.1

> 评审人：C7 · 集成、质量与交付  
> 日期：2026-07-30  
> 复核范围：仅 `REQ-C7-013` 与 `REQ-C7-014`  
> 方法：只读静态复核；未运行任何验证、test、build、lint 或 browser  
> 结论：`D1 STATIC GATE = GO`

## 1. Gate 结论

Round 3 遗留的两个 P0 均已静态关闭：

| 严重级别 | OPEN |
|---|---:|
| P0 | 0 |
| P1 | 0 |
| P2 | 0 |

**D1 STATIC GATE = GO。**

`GO` 只表示当前约定的静态 Gate 清零。运行证据仍为 `BLOCKED_RUNTIME_EVIDENCE`，不反向重开静态 Gate。

## 2. REQ-C7-013 · handoff identity

状态：`CLOSED_STATIC / BLOCKED_RUNTIME_EVIDENCE`

### 2.1 三类消息

三类消息均显式携带 canonical identity：

```text
storycanvas:d1-grant-request
  projectId = demo-local-001
  packageId = package-demo-local-001-v1

storycanvas:d1-grant
  projectId = demo-local-001
  packageId = package-demo-local-001-v1
  grant.projectId/packageId 与顶层一致

storycanvas:d1-ready
  projectId = demo-local-001
  packageId = package-demo-local-001-v1
```

### 2.2 C4 校验

`src/services/storyCanvasBridge.ts:687-750`：

- request 缺失或错误 project/package → `HANDOFF_IDENTITY_MISMATCH`，停止 handoff。
- grant 消息带顶层 project/package 和内存 grant。
- ready 缺失或错误 project/package → `HANDOFF_IDENTITY_MISMATCH`，不得进入 ready。
- 只有 identity 完整匹配后才设置：
  - `handoff.status=ready`
  - `transport.phase=handoff_ready`

原有边界保持：

- deepLink origin 白名单：`http://localhost:50188`
- `event.origin` 必须匹配
- `event.source` 必须是当前 child window
- Grant 不进入 URL、LocalStorage 或 sessionStorage
- 发送前再次执行 current grant expiry/scope 校验
- timeout/error 不表述为 ready

### 2.3 C5 校验

`frontend/src/App.jsx:1719-1803`：

- 只接受 opener/parent 的消息。
- 非 file 模式要求 control plane origin。
- grant 消息必须同时匹配顶层 project/package 和 grant 内 project/package。
- bootstrap 成功后才回 ready，且 ready 带相同 project/package。

因此缺失、错 project、错 package、错 source 或错 origin 均不能进入 ready。

## 3. REQ-C7-014 · ExportReceipt payload

状态：`CLOSED_STATIC / BLOCKED_RUNTIME_EVIDENCE`

### 3.1 C5 最终 payload

`src/services/storycanvas/productionContractAdapter.ts:1182-1223` 已包含：

| C4 preflight 字段 | C5 值 |
|---|---|
| `exportId` | `export-demo-local-001-fallback-v1` |
| `generationTaskId` | `task-demo-success` |
| `tenantId` | accepted package tenant |
| `projectId` | `demo-local-001` |
| `packageId` | accepted package ID |
| `status` | `succeeded` |
| `outputAssetIds` | shot-05 synthetic repair asset |
| `checksum` | 固定 MP4 SHA-256 |
| `error` | `null` |
| `truthMode` | `FALLBACK` |
| `idempotencyKey` | `receipt-${exportId}` |
| `createdAt` | canonical package timestamp |

扩展字段保留：

- `exportArtifactId`
- `FALLBACK / DEMO_ONLY`
- `playable=true`
- technical QA `passed`
- editorial QA `not_evaluated`
- brand QA `not_approved`
- media path/URL、byte size、duration、dimensions、codecs
- `SELF_GENERATED_SYNTHETIC`
- `thirdPartyAssets=false`

### 3.2 business ID 与 digest

`productionContractAdapter.ts:780-820,1215-1223`：

- `enqueueReceipt(..., "export", externalArtifactId, ..., exportReceipt)`。
- `businessId = externalArtifactId = exportReceipt.exportId`。
- `payloadDigest = digestValue(payload)` 在完整 `exportReceipt` 构造完成后计算。
- `payloadJson = canonicalize(payload)` 保存同一最终 payload。
- 幂等重放同时比较最终 payload digest 和 idempotency key。

### 3.3 C4 envelope/preflight

`src/services/storyCanvasBridge.ts:872-968`：

- Export business ID 必须等于 `payload.exportId`。
- `generationTaskId` 必须是 canonical 已知任务。
- envelope/payload digest、tenant、project、package、deliveryId 必须匹配。
- `preflightExportReceipt()` 先执行 C4 ExportReceipt Schema 和本地接收预演。
- 只有预校验通过并 ACK success 后才 apply。

C5 字段现已满足该路径。额外 QA/rights/DEMO_ONLY 字段随 JSON payload 保存并由 C4 clone 接收，不被 C5 Outbox digest 丢弃。

## 4. Round 3.1 清零表

| Request | Round 3 | Round 3.1 |
|---|---|---|
| REQ-C7-013 handoff identity | `OPEN P0` | `CLOSED_STATIC` |
| REQ-C7-014 ExportReceipt payload | `OPEN P0` | `CLOSED_STATIC` |

Round 3 其他已关闭项未重审，状态不变。

## 5. BLOCKED_RUNTIME_EVIDENCE

以下继续单列，不影响 Static GO：

1. accepted/duplicate/rejected 实际 HTTP。
2. request → grant → ready 的真实 opener/origin/source 消息序列。
3. 缺失/错误 project/package 不进入 ready。
4. Export Outbox pending → delivered → acknowledged。
5. ACK 失败零入账；ACK 成功后 ExportReceipt apply。
6. Synthetic FALLBACK HTTP 加载、浏览器 controls 播放和来源链。
7. current grant、active organization、reset、wrong route 的既定运行证据。

## 6. 发布建议

Static Gate 已满足：

```text
P0=0 / P1=0 / P2=0
D1 STATIC GATE=GO
```

下一阶段应进入受控运行 Gate，收集第 5 节证据。不得把 Static GO 外推为运行 PASS、正式品牌 QA、生产安全或发布完成。
