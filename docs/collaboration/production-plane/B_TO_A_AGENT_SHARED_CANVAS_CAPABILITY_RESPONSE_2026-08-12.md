# B → A：Shared Canvas capability 对齐回执（2026-08-12）

## 1. 结论与停止线

B 已安全接收 A 冻结的 Shared RED，并完成 **B-owned capability**：StoryCanvas server redemption consumer、browser-safe bootstrap、Pilot Script/Storyboard/Canvas 页面边界及确定性 runtime capability。B **没有**实现或修改 Shared Router/Bridge Green；真实 Chrome + PostgreSQL Golden Path 和 Joint Gate 仍未执行。

当前继续保持：

```text
A_CANVAS_ENTRY_REDEMPTION_READY
A_BIZ_06E_5A_COMPLETE
A_BIZ_06E_5B_RUNNER_SKELETON_COMPLETE
A_BIZ_06E_4P_ROUTER_RED_FROZEN
A_BIZ_06E_4P_BRIDGE_ISOLATION_RED_FROZEN
B_REDEMPTION_CONSUMER_IMPLEMENTATION_REQUIRED
SHARED_ACTIVATION_GREEN_BLOCKED
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

其中 `B_REDEMPTION_CONSUMER_IMPLEMENTATION_REQUIRED` 仅在 A 完成本回执第 8 节验收后，才可由双方共同更新。不得据此宣称 `A_BIZ_06E_COMPLETE`、`A_BIZ_06_COMPLETE`、`AB_GOLDEN_PATH_COMPLETE`、`JOINT_GATE_PASS` 或 `FULL_JOINT_GATE_PASS`。

## 2. Fetch、同步和 HEAD 证据

2026-08-12 最后一次执行：

```bash
git fetch origin dev/business-plane dev/production-plane
```

结果：

```text
fetch 后 A remote HEAD: c015823aeec18db95990e6fd3a1037f973fc5264
首次 fetch 后 B remote HEAD: a7f8021b80f540c69e4c45718b335ba2c0fca539
B 同步前 HEAD:             a7f8021b80f540c69e4c45718b335ba2c0fca539
B 同步后 HEAD:             c015823aeec18db95990e6fd3a1037f973fc5264
最后复核时 B remote HEAD:  c015823aeec18db95990e6fd3a1037f973fc5264
B capability 最终 HEAD:    ec48e764415e71101a0b8c9b9fdba60202fab195
```

同步在隔离 worktree 中执行 `git merge --ff-only origin/dev/business-plane`。Reflog 明确记录 `merge origin/dev/business-plane: Fast-forward`；未使用 merge commit、rebase、reset、force push 或手工复制 A 文件。

```text
merge-base(a7f8021, c015823) = a7f8021b80f540c69e4c45718b335ba2c0fca539
git merge-base --is-ancestor a7f8021... c015823... = 0
git merge-base --is-ancestor c015823... ec48e76... = 0
git merge-base --is-ancestor origin/dev/production-plane ec48e76... = 0
```

要求的 ancestor 链全部返回 `0 / YES`：

```text
0f056f3662955dcf38432c307d2aa0a4d18d1699
6e37dc965f8bf69833995bd26888cc9196a3f70e
ed7adee7b4b2ab55890586dc2a8ada31dba19458
37aab02db18013506957495088d490102ad50094
c8c02e77de679651d81ec4cdcf509f6876209f96
582150f161ac941de903e6a20a6374cc67c1efe5
7c7ff8a76af65f2ac201d69f009c4d38ea03653a
4b244666326a1e48f19341f700c1ca28ab2647c0
fbc9157ba4ea0db1a06e201ec1fb978a6949dc9a
c015823aeec18db95990e6fd3a1037f973fc5264
```

## 3. B-owned 原子提交

```text
RED   7afd692e2ef25972f7dd09d9b2aa698c67cdd293
      test(storycanvas): freeze pilot canvas capability red

GREEN ec48e764415e71101a0b8c9b9fdba60202fab195
      feat(storycanvas): add pilot canvas capability
```

GREEN 的 exact changed paths：

```text
apps/storycanvas/.env.example
apps/storycanvas/package.json
apps/storycanvas/src/app.ts
apps/storycanvas/src/core.ts
apps/storycanvas/src/router.ts
apps/storycanvas/src/routes/production/pilot/canvas/bootstrap.ts
apps/storycanvas/src/routes/production/pilot/canvas/capability.ts
apps/storycanvas/src/services/storycanvas/pilotCanvasCapability.test.ts
apps/storycanvas/src/services/storycanvas/pilotCanvasCapability.ts
apps/storycanvas/src/utils/getPath.ts
src/pages/pilot-production/PilotProductionBoundaryPages.test.tsx
src/pages/pilot-production/PilotProductionBoundaryPages.tsx
```

未修改 A-owned `apps/control-api/**`、`src/services/pilotContentProductionApi.ts`、Shared `src/app/Router.tsx` 或待建的 `src/services/pilotStoryCanvasBridge.ts`。

## 4. Redemption consumer 合同

- server-only：`POST /api/v1/internal/canvas-entries/redeem`；body 严格为 `{ handle, tenantId, projectId, packageId }`。
- server-only headers：`X-Production-Plane-Internal-Token`、派生的稳定 `Idempotency-Key`、`Content-Type: application/json`；密钥不进入浏览器。
- 稳定 key 由 exact Entry canonical JSON 的 SHA-256 派生；网络丢失或第一次 `503` 只重试一次，第二次复用 exact body 与 exact key。
- 同一 handle 的 changed binding 在发网前返回安全 `409`；不复用 key，不产生副作用。
- strict parser：`CanvasEntryRedemption/0.1`、`ProjectProductionPackage/0.3`、`ProjectGrant/0.2` 均拒绝未知字段，并验证 digest、token digest、时效、approved Script/Storyboard、shot sequence、capability 和 exact tenant/project/package binding。
- 不创建 Grant，不调用或 fallback 到 legacy v0.2 receiver、Demo Grant、Mock、Zustand、LocalStorage 或 SessionStorage。
- server authority 只存在于进程内 registry，以随机 `pcs_*` session handle 投影给浏览器；到期读取失败，shutdown 可清空 registry。

## 5. Bootstrap、页面与 Package selection 合同

Browser endpoint：

```text
POST /api/production/pilot/canvas/bootstrap
Content-Type: application/json
X-StoryCanvas-CSRF: pilot-canvas-bootstrap-v1
Cookie: videoagent_session=<HttpOnly Session>
Origin: <exact STORYCANVAS_PILOT_ALLOWED_ORIGIN>
```

- CORS 仅对本路径允许 exact Origin、credentials、`GET/POST/OPTIONS` 和冻结 headers；其他 StoryCanvas 旧路由保持原行为。
- StoryCanvas server 将 Cookie server-to-server 转发到 `GET /api/v1/auth/session`；仅接受 `TENANT`、exact tenant、且具有 `tenant_admin` 或 `content_operator` 的 active context。
- 缺失/失效 Session 为 `401`；Origin/CSRF/角色拒绝为 `403`；跨 tenant 隐藏为 `404`；consumer 保留 `409/410/422/500/503`。所有错误仅返回安全 code、固定 message、retryable 和校验后的 Request ID。
- 成功 DTO exact keys：`schemaVersion/status/projectId/packageId/canvasSessionId/expiresAt/requestId`；无 raw token、internal token、Idempotency-Key、grantId、digest 或 Package snapshot。
- Package selection 唯一来源是 A 已冻结的 exact `CanvasEntry` reference；B 页面必须由调用方显式注入 `{ handle, tenantId, projectId, packageId }`，不得列表取首项、读 URL/DOM/Storage 或回退 Demo。
- 本提交只提供 stable exports，未接 Shared Router：`PilotScriptBoundaryPage`、`PilotStoryboardBoundaryPage`、`PilotCanvasBoundaryPage`、`createPilotCanvasEntryConsumer`。

Stable selectors：

```text
pilot-script-boundary
pilot-storyboard-boundary
pilot-storycanvas-boundary-blocked
pilot-storycanvas-boundary-loading
pilot-storycanvas-boundary-ready
pilot-storycanvas-boundary-error
pilot-storycanvas-request-id
pilot-storycanvas-retry
```

## 6. Runtime capability 合同

```text
唯一 start command: npm --prefix apps/storycanvas run start:pilot-canvas
capability probe:    GET /api/production/pilot/canvas/capability
bootstrap endpoint:  POST /api/production/pilot/canvas/bootstrap
bind address:        127.0.0.1:${STORYCANVAS_PORT:-10588}
shutdown bound:      5000 ms，超时 closeAllConnections
```

环境变量：

```text
STORYCANVAS_PILOT_CANVAS_ENABLED=true
CONTROL_API_BASE_URL=<HTTPS origin；仅 loopback 可 HTTP>
PRODUCTION_PLANE_INTERNAL_TOKEN=<server-only，至少 32 bytes>
STORYCANVAS_PILOT_ALLOWED_ORIGIN=<exact origin>
STORYCANVAS_DATA_ROOT=<非根绝对路径、可读写>
STORYCANVAS_PORT=<1..65535，可选>
```

capability response 只包含每个检查项的 boolean，不回显任何配置值。数据根由操作者为每次 gate 建立独立临时目录；`getPath` 将所有 StoryCanvas 数据限制在该根内，进程 bounded shutdown 后由 gate owner 删除该明确目录，不自动递归删除未知路径。

允许的固定日志 markers：

```text
PILOT_CANVAS_RUNTIME_READY
PILOT_CANVAS_RUNTIME_BLOCKED
PILOT_CANVAS_RUNTIME_STOPPED
```

禁止日志内容：raw access/internal token、Idempotency-Key 原值、grantId、digest、Package snapshot、Cookie、SQL、provider body 和 stack。

## 7. 真实验证结果

| 验证 | 命令摘要 | 结果 |
|---|---|---|
| B consumer/parser/bootstrap/runtime | Node targeted `pilotCanvasCapability.test.ts` | **5 PASS / 0 FAIL / 0 SKIP** |
| B Pilot pages | Vitest `PilotProductionBoundaryPages.test.tsx` | **4 PASS / 0 FAIL / 0 SKIP** |
| StoryCanvas v0.2 | `node scripts/run-storycanvas-v02-targeted.mjs` | **13 PASS / 0 FAIL / 0 SKIP** |
| Media/TTS/Storage | 三个 targeted suites | **17 PASS / 0 FAIL / 0 SKIP** |
| StoryCanvas build | `npm --prefix apps/storycanvas run build` | **PASS** |
| Root build | `npm run build` | **PASS**；仅 Vite chunk-size warning |
| Governance | `npm run validate:governance` | **PASS** |
| diff check | `git diff --check` | **PASS** |
| StoryCanvas tracked status | `git status --short apps/storycanvas`（写回执前） | **clean** |

额外诊断：`npm --prefix apps/storycanvas run lint` 仍因既有 AI SDK/Zod `JSONSchema7` 类型兼容问题失败，报错路径为既有 `agents/**`、`routes/**`、`utils/**`；本轮新增 capability 文件没有出现在错误列表。该结果没有被描述为 PASS。

两个 Shared RED 保持原样：

```text
Router RED: 28 PASS / 1 expected FAIL
  缺少 shared pilot-storycanvas blocked route wiring；仍显示 pilot-route-handoff。

Bridge RED: 2 PASS / 1 expected FAIL
  PILOT_STORYCANVAS_BRIDGE_IMPLEMENTATION_REQUIRED
```

## 8. byteplus 与 A 验收请求

- 隔离 worktree 中 `apps/storycanvas/data/vendor/byteplus.ts` 不存在，未创建、修改、删除、暂存或提交。
- 主工作区的同名文件仍保持用户原有 `??` 未跟踪状态；本轮从未对它执行 add/restore/clean。
- `git diff --name-only c015823...ec48e76` 不包含该文件。
- StoryCanvas build 生成的 `apps/storycanvas/data/serve/app.js` 已恢复为 HEAD，未混入实现提交。

请 A 在开始任何 Shared Green 前 fetch 并验证：commit object、ancestor chain、上述 exact write set、endpoint/DTO、Session/CSRF/CORS/Origin、Package selection、secret containment、targeted tests 与 runtime capability。A 验收完成前，Shared Router/Bridge Green、Golden Path 与 Joint Gate 均继续阻塞。
