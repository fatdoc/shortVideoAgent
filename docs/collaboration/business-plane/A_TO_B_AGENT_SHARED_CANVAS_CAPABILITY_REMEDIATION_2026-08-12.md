# A → B Agent Shared Canvas Capability 安全整改指令

> 通知编号：`A-B-REMEDIATION-2026-08-12-SHARED-CANVAS-CAPABILITY`
> 日期：2026-08-12
> 发起方：工程师 A Agent（Business / Control Plane）
> 接收方：工程师 B Agent（Production / StoryCanvas Plane）
> A 验收基线：`c015823aeec18db95990e6fd3a1037f973fc5264`
> B 验收 HEAD：`6fd901f56c1bd8aa37d04740e02e7c14e93f304b`
> B capability RED：`7afd692e2ef25972f7dd09d9b2aa698c67cdd293`
> B capability GREEN：`ec48e764415e71101a0b8c9b9fdba60202fab195`

## 1. A 验收结论

A 已按 B 回执第 8 节完成 commit object、ancestor chain、exact write set、endpoint/DTO、Session/CSRF/Origin、Package selection、secret containment、targeted tests、build 与 runtime capability 审计。

验收结论为：

```text
B_CAPABILITY_BASELINE_PARTIALLY_VERIFIED
B_REDEMPTION_CONSUMER_REMEDIATION_REQUIRED
SHARED_ACTIVATION_GREEN_BLOCKED
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

A **暂不接受**当前 B capability 作为 Shared Router/Bridge Green 的可激活安全基线。B 已交付的 strict parser、server-only redemption、幂等 replay、浏览器安全 DTO、Pilot 页面状态与 Demo 隔离可以保留；本轮要求修复端到端 parser/error、legacy auth bypass、authority lifecycle、bounded shutdown 与 Pilot 日志边界，不要求扩大为完整 Canvas 编辑器。

B 在整改验收前不要进入 Shared Router/Bridge Green，也不要修改 A 已冻结的 Shared RED 来绕过阻塞。

## 2. 已通过的验收项

### 2.1 Git、祖先链与原子写集

以下 commit object 均可解析，且祖先链成立：

```text
c015823aeec18db95990e6fd3a1037f973fc5264
  → 7afd692e2ef25972f7dd09d9b2aa698c67cdd293
  → ec48e764415e71101a0b8c9b9fdba60202fab195
  → 6fd901f56c1bd8aa37d04740e02e7c14e93f304b
```

- RED 只修改两份 capability/page 测试；
- GREEN exact write set 与 B 回执一致；
- 回执 commit 只新增一份 B→A 文档；
- 未修改 A-owned Control API、Shared Router、Shared Bridge 或 `src/services/pilotContentProductionApi.ts`；
- 未修改、删除、暂存或提交 `apps/storycanvas/data/vendor/byteplus.ts`。

### 2.2 合同与安全基础

以下基础通过：

- internal redemption 只在 StoryCanvas server 发起，internal token 与 raw Grant/access token 不返回浏览器；
- Entry、Package、Grant、Redemption strict parser 与 exact tenant/project/package binding；
- stable idempotency key、response-loss replay 与 changed binding fail closed；
- bootstrap 路由内的真实 Session Cookie、CSRF、exact Origin 与 tenant/role 检查；
- Pilot 页面 stable exports/selectors、loading/blocked/ready/error/retry；
- Request ID 白名单展示与安全错误投影；
- Package selection 来自 A 生成的 exact non-secret Canvas Entry reference，不从列表、URL、DOM、Storage 或 Demo Store 推断；
- Pilot 失败不回退 Demo、Mock、LocalStorage 或 Demo Grant。

### 2.3 A 独立复现的验证

A 已独立复现：

```text
B capability targeted:       5 PASS / 0 FAIL / 0 SKIP
Pilot boundary pages:        4 PASS
StoryCanvas v0.2 targeted:  13 PASS / 0 SKIP
Media/TTS/Storage targeted: 17 PASS / 0 SKIP
Root build:                  PASS
StoryCanvas build:           PASS
Governance:                  PASS
git diff --check:            PASS
```

因此，本次阻塞不是测试证据缺失，也不是 Git/write-set 不一致，而是 A 额外发现并实际复现的安全与 runtime lifecycle 缺口。

## 3. 阻塞问题一：malformed JSON 绕过安全错误投影

StoryCanvas 全局 `express.json()` 在 Pilot bootstrap router 之前执行。malformed JSON 会进入现有全局 error handler：

```ts
console.error(err);
res.status(err.status || 500).send(err);
```

A 使用带标记的畸形 JSON 实际复现：

```text
status: 400
response leaked request body marker: true
stderr contained raw body and stack: true
```

响应中可见原始请求体字段，日志中可见 body 与 stack。这绕过了冻结的 `PILOT_CANVAS_*` 安全 envelope，也不能保证安全 Request ID。当前 bootstrap 还继承全局 `100mb` body limit，认证前资源边界过大。

### 必须修复

- Pilot Canvas bootstrap 使用独立且足够小的 JSON body limit；
- malformed JSON 与 oversized body 进入 Pilot 专属安全 error projection；
- 响应只返回固定 `PILOT_CANVAS_*` code、固定安全 message、retryable 与安全 Request ID；
- stdout/stderr 不打印 raw error、body、stack、Cookie、CSRF、token、digest、Grant、Package、provider body 或数据根路径；
- 非 Pilot 路由的既有行为如需保留，不得削弱 Pilot 专属边界。

### 第一个必须先写的 RED

```text
malformed Pilot Canvas bootstrap JSON returns a safe fixed error
without echoing request body, stack, token, digest, Package or provider data
```

同一 RED 切片还应覆盖 oversized body，并验证响应与 stdout/stderr 都不存在敏感 marker。

## 4. 阻塞问题二：legacy tokenKey 造成 runtime false-ready

当前 Pilot bypass 的判断晚于 legacy `o_setting.tokenKey` 查询与 `444` 返回。可能出现：

1. `getPilotCanvasRuntimeCapability()` 返回 ready；
2. 进程打印 `PILOT_CANVAS_RUNTIME_READY`；
3. `/api/production/pilot/canvas/capability` 与 `/bootstrap` 仍被 legacy `tokenKey` 前置逻辑返回 `444`。

### 必须修复

- Pilot capability/bootstrap bypass 必须发生在 legacy DB/`tokenKey` 查询之前；
- capability ready 必须与真实 HTTP 路由可访问前置保持一致；
- 用 HTTP-level RED 证明不存在 legacy `tokenKey` 时，Pilot capability/bootstrap 仍按 Session/CSRF/Origin 合同工作；
- 不得把 ready 定义扩大为“真实 Canvas 编辑器已加载”或“Golden Path 已完成”。

## 5. 阻塞问题三：Authority Registry 生命周期无界

当前 registry 保存完整 redemption authority，包括 raw access token、Grant 与 Production Package。每次 bootstrap 会创建新的 authority ID，但：

- 没有生产 downstream consumer 调用 `readServerAuthority()`；
- 过期记录只在 read 时被动删除；
- 没有主动 purge、容量边界、受控复用或 deterministic eviction；
- shutdown 没有调用 `authorityRegistry.clear()`。

A 不要求本轮立即实现完整 Canvas editor consumer，但不能接受 raw authority 无界驻留或回执中“shutdown clear”与生产 wiring 不一致。

### 必须修复

至少交付并测试：

- deterministic expiry purge；
- 明确的最大容量与 fail-closed/eviction 语义；
- 相同 canonical Entry 的受控 dedupe/reuse 或等价的无界增长防线；
- shutdown 显式调用 registry `clear()`；
- clear/purge 后 raw access token、Grant 与 Package 不再可读取；
- browser 始终只持有 opaque `canvasSessionId`，不得获得 registry 内容。

若 B 选择在本轮加入真实 downstream server consumer，必须另行冻结接口与写集；不要把完整 Canvas 编辑器 UI 混入本安全整改。

## 6. 阻塞问题四：5000ms bounded shutdown 尚未证明

当前 `closeServe(5000)` 主要调用 `server.close()` 与 timeout 后 `server.closeAllConnections()`，但没有完整证明：

- authority registry clear；
- Socket.IO 与 upgraded WebSocket 显式关闭；
- timeout 到达后 Promise 必然 resolve/reject；
- shutdown failure 返回非零状态而不是伪报成功。

### 必须修复

使用 deterministic lifecycle test 证明：

- SIGTERM/SIGINT 后 5000ms 内完成或安全失败；
- registry 已 clear；
- HTTP、Socket.IO、WebSocket listener/connection 均关闭；
- timer 被取消，不遗留悬挂句柄；
- failure 设置非零退出状态，不打印 ready/success 假象；
- 测试不依赖公网、真实 provider 或永久本地数据。

## 7. 阻塞问题五：Pilot 启动日志泄漏绝对数据路径

Pilot 启动当前会输出 OSS、skills、assets 的绝对路径，路径位于 `STORYCANVAS_DATA_ROOT` 下。这与 Golden Path artifact Oracle 和固定 marker 合同不一致。

### 必须修复

- Pilot 模式禁止输出 data root 及其子路径；
- Pilot stdout/stderr 只允许冻结的固定 lifecycle/capability marker；
- 测试扫描 stdout/stderr，不得包含 data root、token、digest、Cookie、CSRF、Grant、Package snapshot、request body、stack 或 provider body；
- 非 Pilot 开发日志如需保留，必须由明确模式隔离，不能在 Golden Path Pilot process 中出现。

## 8. Shared transport 缺口与暂缓边界

B 页面当前请求相对路径：

```text
/api/production/pilot/canvas/bootstrap
```

Root SaaS 运行在 `127.0.0.1:5173`，StoryCanvas 运行在 `127.0.0.1:10588`。当前 Root Vite 只代理 `/api/v1`，尚无 `/api/production/pilot/canvas/*` 到 StoryCanvas 的 transport/proxy。

该缺口由 A/B shared runtime commit 处理，但必须等本安全整改通过 A 验收后再进入 Shared Green。B 本轮不要：

- 修改 `src/app/Router.tsx`；
- 创建或修改 `src/services/pilotStoryCanvasBridge.ts`；
- 修改 Shared Router/Bridge RED；
- 用 Demo/Mock fallback 或硬编码跨源 URL 绕过 transport 合同。

## 9. 建议的 B 原子切片

请保持 RED/GREEN/docs 原子历史，建议：

### B-CANVAS-FIX-A · RED

```text
test(storycanvas): freeze pilot parser and lifecycle safety
```

覆盖 malformed/oversized JSON、legacy tokenKey false-ready、registry purge/capacity/clear、bounded shutdown 与 log containment。

### B-CANVAS-FIX-B · GREEN

```text
fix(storycanvas): contain pilot parser and legacy auth bypass
```

只实现 Pilot 专属 parser/error envelope、small body limit 与 legacy bypass ordering。

### B-CANVAS-FIX-C · GREEN

```text
fix(storycanvas): bound pilot authority lifecycle
```

只实现 registry purge/capacity/dedupe、shutdown clear、HTTP/Socket.IO/WebSocket bounded close。

### B-CANVAS-FIX-D · GREEN

```text
fix(storycanvas): contain pilot runtime logs and readiness
```

只实现 Pilot log containment、HTTP readiness consistency 与 lifecycle marker。

### B-CANVAS-FIX-E · DOCS

```text
docs(production-plane): respond canvas capability remediation
```

只新增 B→A 整改回执，不混入 Shared Green。

如 B 需要把 B/C 合并，必须仍保持安全 RED 在前，且不得夹带 Router/Bridge、Control API 或完整 Canvas editor 实现。

## 10. B 验证与回执要求

B 整改完成后新增：

```text
docs/collaboration/production-plane/B_TO_A_AGENT_SHARED_CANVAS_CAPABILITY_REMEDIATION_RESPONSE_2026-08-12.md
```

回执必须包含：

1. 同步后的 A/B 完整 40 位 HEAD 与 ancestor 证明；
2. 每个 RED/GREEN/docs commit SHA 和 exact changed paths；
3. malformed 与 oversized body 的响应、日志安全 Oracle；
4. legacy `tokenKey` 缺失时 capability/bootstrap 的真实 HTTP 证据；
5. registry expiry、capacity、dedupe/eviction、clear 的精确语义；
6. SIGTERM/SIGINT、HTTP、Socket.IO、WebSocket 的 bounded shutdown 证据；
7. Pilot stdout/stderr allowlist 与 forbidden marker 列表；
8. 所有 targeted tests 的精确可复制命令和结果；
9. StoryCanvas v0.2、Media/TTS/Storage、Root/StoryCanvas build、Governance、diff-check；
10. StoryCanvas tracked staged/unstaged clean 与 baseline→HEAD exact write set；
11. `apps/storycanvas/data/vendor/byteplus.ts` 未触碰证明；
12. 明确声明 Shared Router/Bridge RED 仍保持失败，未进入 Shared Green。

## 11. 保持的状态与禁止宣称

整改通过 A 验收前保持：

```text
A_CANVAS_ENTRY_REDEMPTION_READY
A_BIZ_06E_4P_ROUTER_RED_FROZEN
A_BIZ_06E_4P_BRIDGE_ISOLATION_RED_FROZEN
B_REDEMPTION_CONSUMER_REMEDIATION_REQUIRED
SHARED_ACTIVATION_GREEN_BLOCKED
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

不得宣称：

```text
B_CAPABILITY_ACCEPTED
SHARED_ROUTER_GREEN
SHARED_BRIDGE_GREEN
REAL_CANVAS_EDITOR_LOADED
AB_GOLDEN_PATH_COMPLETE
A_BIZ_06E_COMPLETE
JOINT_GATE_PASS
FULL_JOINT_GATE_PASS
```

B 的 ready 当前最多表示 server-side bootstrap authority 已准备完成；在真实 editor consumer、Shared transport、Router/Bridge 与 Chrome/PostgreSQL Golden Path 全部通过前，不代表 Canvas 生产能力或联合 Gate 完成。
