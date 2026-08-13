# B → A：Shared Canvas capability 安全整改回执（2026-08-13）

## 1. 结论和停止线

B 已基于 A 修正后的 Shared Canvas baseline 完成 B-owned capability remediation：Pilot malformed/oversized JSON 安全 envelope、legacy `tokenKey` bypass 顺序、authority registry 有界生命周期、HTTP/Socket.IO/WebSocket 5000ms bounded shutdown，以及 Pilot runtime log containment。

本回执只申请 A 复验 `B_REMEDIATION_ACCEPTED`，不表示 Shared Green 已开放。继续保持：

```text
A_CANVAS_ENTRY_REDEMPTION_READY
A_BIZ_06E_4P_ROUTER_RED_FROZEN
A_BIZ_06E_4P_BRIDGE_ISOLATION_RED_FROZEN
B_REDEMPTION_CONSUMER_REMEDIATION_REQUIRED
SHARED_ACTIVATION_GREEN_BLOCKED
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

不得将本轮解释为 `REAL_EDITOR_LOADED`、`A_BIZ_06E_COMPLETE`、`A_BIZ_06_COMPLETE`、`AB_GOLDEN_PATH_COMPLETE`、`JOINT_GATE_PASS` 或 `FULL_JOINT_GATE_PASS`。

## 2. Fetch、fast-forward 和 ancestor 证明

隔离 worktree：`/tmp/videoagent-shared-canvas.OC4Rto`。主工作区及其未提交、未跟踪文件未被修改、删除、暂存或提交。

```text
fetch 后 A remote HEAD: 49b9b5e3f738f65f3b88a2f513d06a4c1d3348f9
fetch 后 B remote HEAD: 6fd901f56c1bd8aa37d04740e02e7c14e93f304b
B 同步前 HEAD:          6fd901f56c1bd8aa37d04740e02e7c14e93f304b
B 同步后 HEAD:          49b9b5e3f738f65f3b88a2f513d06a4c1d3348f9
baseline merge commit:   228c211accc33e886aa851af20ef4a0a16bfc9db
实现复核 HEAD:           27cb0bf11db8e7dfa00b3a8af3b60f91f675a168
```

执行并通过：

```bash
git fetch origin --prune
git fetch origin refs/heads/dev/business-plane:refs/remotes/origin/dev/business-plane
git fetch origin refs/heads/dev/production-plane:refs/remotes/origin/dev/production-plane
git merge-base --is-ancestor 6fd901f56c1bd8aa37d04740e02e7c14e93f304b origin/dev/business-plane
git merge --ff-only origin/dev/business-plane
git merge-base --is-ancestor 49b9b5e3f738f65f3b88a2f513d06a4c1d3348f9 HEAD
```

两个 `merge-base --is-ancestor` 均为 exit `0`；fast-forward 前 `HEAD...origin/dev/business-plane` 为 `0 31`。未使用 rebase、reset、cherry-pick、merge commit、force push 或手工复制 A 文件。

## 3. 原子提交和 exact changed paths

初始 RED：

```text
b49c1befddfd2a7ec32145331374019372ff3080
test(storycanvas): freeze pilot parser and lifecycle safety
A apps/storycanvas/src/services/storycanvas/pilotCanvasRemediation.test.ts
```

实现提交：

```text
a50898fea5dcd6b2461880f9a89a6df2bcacb6a6
fix(storycanvas): contain pilot parser and legacy auth bypass
M apps/storycanvas/src/app.ts
M apps/storycanvas/src/routes/production/pilot/canvas/bootstrap.ts
M apps/storycanvas/src/services/storycanvas/pilotCanvasCapability.ts
M apps/storycanvas/src/services/storycanvas/pilotCanvasRemediation.test.ts

b9e9daad5683634702c3588dc892855c9108fd80
fix(storycanvas): bound pilot authority lifecycle
M apps/storycanvas/src/app.ts
M apps/storycanvas/src/routes/production/pilot/canvas/bootstrap.ts
M apps/storycanvas/src/services/storycanvas/pilotCanvasCapability.ts
M apps/storycanvas/src/services/storycanvas/pilotCanvasRemediation.test.ts

c288275673f493f36ebee8808b8fde8d72764005
fix(storycanvas): contain pilot runtime logs and readiness
M apps/storycanvas/src/app.ts
M apps/storycanvas/src/utils/db.ts
```

A Git attestation 允许路径上的复验角色提交：

```text
parser role:
2738a675b44e032fd1f70394ca24d0f360b283ce
M apps/storycanvas/src/services/storycanvas/pilotCanvasCapability.test.ts

lifecycle role:
60869ba79eafaa047d5df76cb628c0a529644769
M apps/storycanvas/src/services/storycanvas/pilotCanvasCapability.test.ts

log role:
27cb0bf11db8e7dfa00b3a8af3b60f91f675a168
M apps/storycanvas/src/utils/db.ts
```

用于 A 自动验收器的角色链为：

```text
baseline = 49b9b5e3f738f65f3b88a2f513d06a4c1d3348f9
red      = b49c1befddfd2a7ec32145331374019372ff3080
parser   = 2738a675b44e032fd1f70394ca24d0f360b283ce
lifecycle= 60869ba79eafaa047d5df76cb628c0a529644769
log      = 27cb0bf11db8e7dfa00b3a8af3b60f91f675a168
requiredA= 49b9b5e3f738f65f3b88a2f513d06a4c1d3348f9
docs/candidate = 以推送回传的两个后续完整 40 位 SHA 为准
```

`baseline → red → parser → lifecycle → log` 逐边 ancestor 验证为 exit `0`。docs commit 只新增本文件；candidate 使用独立空提交冻结候选 HEAD，避免自引用 SHA。

## 4. HTTP parser、Request ID 和 legacy bypass

Pilot bootstrap 现在在全局 `100mb` parser 和 legacy auth 前安装专属 `16kb` strict JSON parser。Pilot route bypass 在查询 `o_setting.tokenKey` 之前执行，因此临时 Pilot 数据根内不存在 legacy `tokenKey` 时，真实 capability/bootstrap HTTP 路由仍可达，不会出现 false-ready 后被 `444` 阻断。

真实进程 HTTP 结果：

```text
malformed: HTTP/1.1 400 Bad Request
{"error":{"code":"PILOT_CANVAS_MALFORMED_JSON","message":"Pilot Canvas request body is invalid.","requestId":"safe-runtime-request","retryable":false}}

oversized: HTTP/1.1 413 Payload Too Large
{"error":{"code":"PILOT_CANVAS_REQUEST_TOO_LARGE","message":"Pilot Canvas request body is too large.","requestId":"safe-runtime-oversized","retryable":false}}
```

两者均为 JSON、`Cache-Control: no-store`、恰好一个安全 `x-request-id`，header/body Request ID 一致。响应、stdout 和 stderr 扫描均不包含原始 body、Cookie、CSRF、token、Grant、digest、Package、provider body、data root、stack、`entity.parse.failed`、`entity.too.large`、`SyntaxError` 或 `Unexpected token`。

## 5. Authority registry 精确语义

- 默认 capacity `64`；仅接受 `2..1024` 的安全整数。
- exact Entry canonical JSON 的 SHA-256 作为 registry 内部 dedupe key；未过期重复 Entry 复用同一 `pcs_*` authority，且不重复 redemption。
- `openEntry` 前主动 purge；`readServerAuthority` 观察到过期时立即删除；另提供确定性 `purgeExpired()`。
- Map 插入顺序作为唯一 FIFO eviction 顺序；达到 capacity 后先删除最早 authority，再写入新 authority，容量始终不超过上限。
- registry 事件只包含固定 kind 和 `activeCount`，不包含 authorityId、Entry、token、Grant 或 Package。
- `clear()` 同时清空 authority map 和 Entry dedupe map；清理后 raw authority 不可读，active count 为 `0`。

目标测试覆盖 dedupe、expiry、capacity、deterministic eviction 和 shutdown clear。

## 6. Bounded shutdown 和 runtime log containment

关闭顺序：registry clear → Socket.IO close → upgraded WebSocket close → HTTP close → SQLite/Knex destroy。单一 timer 上限 `5000ms`；超时调用 `closeAllConnections()` 并拒绝，signal handler 设置非零退出状态；成功路径清除 timer 并以 `0` 退出。

真实进程结果：

```text
SIGTERM duration=31ms exit=0 stderr_bytes=0
SIGINT  duration=28ms exit=0 stderr_bytes=0
```

两次 stdout 都严格为：

```text
PILOT_CANVAS_RUNTIME_READY http://127.0.0.1:<port>
PILOT_CANVAS_RUNTIME_STOPPED
```

Pilot 模式禁止 morgan、目录日志、数据库初始化日志和绝对 data root 输出；stdout 仅允许合法 loopback port 的 READY、单一 BLOCKED 或 STOPPED marker，stderr 为空。临时数据根不执行 legacy model/embedding seed，readiness 与真实 Pilot HTTP route 同步；正常非 Pilot 启动路径仍保留既有数据库初始化。

## 7. 可复制验证命令和真实结果

```text
B capability/remediation targeted:
node --import tsx --test src/services/storycanvas/pilotCanvasCapability.test.ts src/services/storycanvas/pilotCanvasRemediation.test.ts
PASS（最终 12/12，0 FAIL，0 SKIP）

StoryCanvas direct full suite:
ELECTRON_RUN_AS_NODE=1 NODE_ENV=test node --import tsx --test src/config/*.test.ts src/domain/storycanvas/*.test.ts src/integrations/openstoryline/*.test.ts src/lib/*.test.ts src/services/storycanvas/*.test.ts
PASS（最终 69/69，0 FAIL，0 SKIP）

B Pilot pages:
npx vitest run src/pages/pilot-production/PilotProductionBoundaryPages.test.tsx
PASS（4/4）

StoryCanvas v0.2:
node scripts/run-storycanvas-v02-targeted.mjs
PASS（13/13，0 SKIP）

Media/TTS/Storage targeted:
NODE_ENV=test BYTEPLUS_TTS_APP_ID= BYTEPLUS_TTS_ACCESS_TOKEN= BYTEPLUS_TTS_SECRET_KEY= BYTEPLUS_TTS_API_KEY= STORYCANVAS_REMOTE_OUTPUT_ENDPOINT= STORYCANVAS_REMOTE_OUTPUT_ACCESS_KEY_ID= STORYCANVAS_REMOTE_OUTPUT_SECRET_ACCESS_KEY= node --import tsx --test src/services/storycanvas/pilotMediaReadiness.test.ts src/services/storycanvas/remoteOutputStorage.test.ts src/services/storycanvas/byteplusTts.test.ts
PASS（17/17，0 SKIP）

A security/lifecycle/runtime/coordinator Oracle unit suites:
apps/control-api/node_modules/.bin/tsx --test tests/e2e/pilot/sharedCanvasRemediationSecurityOracle.test.ts tests/e2e/pilot/sharedCanvasRemediationLifecycleOracle.test.ts tests/e2e/pilot/sharedCanvasNoPostgresRuntimeAcceptance.test.ts tests/e2e/pilot/sharedCanvasRemediationCandidateCoordinator.test.ts
PASS（50/50）

npm --prefix apps/storycanvas run build
PASS

npm run build
PASS（仅既有 Vite chunk-size warning）

npm run validate:governance
PASS

git diff --check
PASS
```

本机 `npm --prefix apps/storycanvas test` wrapper 因现有 Electron binary 安装状态报 `Electron failed to install correctly`；使用相同 glob 的 Node+tsx direct full suite 已真实通过。该环境问题未描述为 wrapper PASS。

## 8. Shared RED、diff-check 和 byteplus 证明

Shared RED 均未删除、skip、弱化或 Green：

```text
Router RED: 28 PASS / 1 expected FAIL
Bridge RED: 2 PASS / 1 expected FAIL
Proxy RED:  3 PASS / 2 expected FAIL
```

未修改 `src/app/Router.tsx`、`src/services/pilotStoryCanvasBridge.ts`、`src/config/pilotE2eProxy.ts`、A-owned `apps/control-api/**` 或 Golden Path browser spec。Root SaaS → StoryCanvas transport/proxy、Shared Bridge/Router Green、真实 editor、Golden Path 和 Joint Gate 均未实现。

`apps/storycanvas/data/vendor/byteplus.ts` 在隔离 worktree 中不存在且不是 tracked file；baseline→实现 HEAD diff、所有 staged set 和所有 commit changed paths 均不包含它。StoryCanvas build 生成的 `apps/storycanvas/data/serve/app.js` 已在验证后恢复为 HEAD，候选提交前 tracked worktree clean。
