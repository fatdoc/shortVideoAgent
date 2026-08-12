# A → B Agent · Golden Path Harness Alignment

- 日期：2026-08-11
- A 分支：`dev/business-plane`
- A 本地实现 HEAD：`963c85f`
- A/B 共同同步 baseline：`a7f8021b80f540c69e4c45718b335ba2c0fca539`
- 状态：`A_BIZ_06E_5B_RUNNER_SKELETON_COMPLETE / B_REDEMPTION_CONSUMER_IMPLEMENTATION_REQUIRED / AB_GOLDEN_PATH_NOT_IMPLEMENTED`

## 1. 对齐目的

A 已完成 06E.5A fixture lifecycle、06E.5B runner prerequisites、fail-closed runner skeleton 与 Joint Gate wiring。当前真实 CLI 在 B consumer/page/bootstrap/readiness capability 未证明时，于 reset 数据库、启动服务或启动 Chrome 前返回 `AB_GOLDEN_PATH_B_CONSUMER_REQUIRED`；Joint Gate phase 仍为 `external`，`AB_GOLDEN_PATH_NOT_IMPLEMENTED` 未移除。

请 B 在继续修改 Joint Gate、StoryCanvas Pilot consumer 或页面前，同步本文件列出的 shared Gate 基线，并回传可验证的 B capability commit 与合同。

## 2. A 已提供能力与提交

| 能力                              | RED       | GREEN     | 已冻结事实                                                                                |
| --------------------------------- | --------- | --------- | ----------------------------------------------------------------------------------------- |
| 完整 migration lifecycle          | `6ca5d78` | `45b3563` | migration `001—024`，`migrationCount=24` 从权威列表派生                                   |
| deterministic Golden Path fixture | `3881b4c` | `d7f4c75` | `fixtureVersion=2`，固定时钟 `2026-08-11T00:00:00.000Z`，零成功事实                       |
| artifact security Oracle          | `d50a0ed` | `5d5040d` | 扫描 token、grantId、digest、DB secret、临时路径、SQL、stack、provider/internal logs      |
| fail-closed Golden Path preflight | `3988fcf` | `b91de9f` | Pilot flags、Chrome、dedicated `_test` DB、B baseline SHA/ancestor、B consumer capability |
| Playwright JSON zero-SKIP Oracle  | `0ec63b9` | `7c5a7f3` | 非空测试，failed/unexpected/skipped/fixme/flaky/interrupted 全为零                        |
| bounded process harness           | `7134192` | `3c4a2ae` | bounded readiness/logs、逆序 teardown、SIGTERM 后 bounded SIGKILL                         |
| shared baseline validator         | `d141faa` | `6e37dc9` | 可复用 commit object + HEAD ancestor 校验，安全错误码保持不变                             |
| dedicated Golden Path config      | `186dd42` | `96dd0be` | `channel=chrome`、single worker、zero retry、JSON report、独立 artifacts                  |
| static no-skip policy             | `aad90da` | `32d70ac` | 拒绝 `.only/.skip/.fixme`、空 spec、超限 spec；最终事实仍以 JSON report 为准              |
| Joint Gate runner wiring          | `cad93d9` | `ed7adee` | root script/manifest 委托 fail-closed runner；phase 保持 `external` 与 slice blocker      |
| fail-closed runner skeleton       | `2b5154c` | `37aab02` | preflight-first；缺 B capability 时 reset/spawn/readiness 前固定阻断                      |
| strict report/process typing      | —         | `963c85f` | `da47830` + `963c85f` 通过 strict compile，不改变 zero-SKIP 或 process lifecycle 语义     |

A 还已提供并保持：

- `A_CANVAS_ENTRY_REDEMPTION_READY`；
- server-only `POST /api/v1/internal/canvas-entries/redeem`；
- browser-safe Canvas Entry handle；
- strict Package v0.3 / Grant v0.2 / `CanvasEntryRedemption/0.1` A-side contracts；
- 真实 Session Cookie、Request ID、no-store 与 fail-closed error envelope。

## 3. Shared Gate 同步要求

`6e37dc9` 是 shared Joint Gate 改动：它将 baseline commit 验证从 `scripts/run-joint-gate.mjs` 提取为复用 precondition，并保持以下错误码：

```text
JOINT_GATE_B_BASELINE_ATTESTATION_REQUIRED
JOINT_GATE_B_BASELINE_COMMIT_INVALID
JOINT_GATE_B_BASELINE_COMMIT_NOT_ANCESTOR
```

B 在修改 Joint Gate manifest、runner 或 baseline precondition 前必须：

1. 同步 `6e37dc9` 的完整祖先链；
2. 验证 commit object 可解析且为 B HEAD ancestor；
3. 不恢复仅检查 non-empty 的旧逻辑；
4. 不回显 baseline 值或 Git 内部错误；
5. 保持 preflight 失败时不执行 required commands。

## 4. B 下一 handoff 必须提供

### 4.1 Server-side redemption consumer

- 只能由 StoryCanvas server 调用 internal redemption；
- 使用 server-only internal token 与稳定 `Idempotency-Key`；
- strict parse `CanvasEntryRedemption/0.1`、Package v0.3 与 Grant v0.2；
- response-loss replay、expired、conflict 与 provider unavailable 均 fail closed；
- 不把 raw token、grantId、digest 或 server DTO转发到浏览器。

### 4.2 Browser-safe bootstrap

请冻结 exact：

- browser-facing URL、method 与 request DTO；
- response status 与 browser-safe response DTO；
- canonical tenant/project/package/entry binding；
- Session Cookie、CSRF、CORS 与 Origin 策略；
- Request ID；
- `401/403/404/409/410/422/500/503` 映射；
- retry/idempotency 行为；
- no-store 与敏感字段投影。

浏览器只能提交 non-secret Canvas Entry handle 和 canonical scope reference；不得直接调用 internal redemption。

### 4.3 Pilot Canvas 页面

- 给出稳定 export 与 canonical route integration point；
- 给出 deterministic selectors，至少覆盖 loading、ready、empty/error、retry、runtime-ready 与安全拒绝；
- Pilot 成功事实不得来自 Demo Store、Mock、LocalStorage、`DEMO_PROJECT_ID`、`DemoProjectGrant` 或 `X-StoryCanvas-Demo-Grant`；
- 页面不得在 props、DOM、URL、Storage、console 或 network error 中暴露 server-only 数据。

### 4.4 Deterministic process/readiness/capability contract

请给出：

- StoryCanvas E2E deterministic start command；
- 所需环境变量与专用临时 data root；
- readiness URL、method、成功 status 与 exact response contract；
- consumer capability URL/marker、method、成功 status 与 exact response contract；
- 启动超时、readiness 超时与正常 teardown 预期；
- provider unavailable 时的固定安全状态；
- 可验证 capability marker 对应的 commit 与 targeted tests。

### 4.5 Security evidence markers

请给出 B-side 需要纳入扫描的：

- internal token/header 名称；
- raw Grant/access token 与 grantId marker；
- Package/Grant/Entry/Script/Storyboard digest marker；
- StoryCanvas 临时路径前缀；
- provider/upstream body marker；
- SQL/PostgreSQL/stack diagnostic marker；
- StoryCanvas stdout/stderr 中的其他秘密或内部实现 marker。

### 4.6 B capability acceptance checklist

A 只根据 B 回执中可复核的实现、测试与运行合同验收 consumer capability，不根据文档声明、旧页面形状或通用服务可启动性进行推断。验收必须同时满足：

- `implementation commit` 必须包含 B-owned consumer 能力的实现或测试变更；仅修改文档的 commit 不得满足 capability；
- server consumer、browser bootstrap、Pilot Canvas page、稳定 selectors 与 targeted tests 的回执路径必须逐项存在，并且能够在所声明的 implementation commit 中验证；
- 既有 `GET /api/production/v0.1/readiness` 只代表既有媒体运行依赖检查，不等同于 redemption consumer readiness；
- 通用 `npm start` 或服务当前可监听不等同于 deterministic Golden Path start contract；
- 旧 Demo Canvas 页面、Demo Grant 链路或 Mock capability 不等同于 Pilot Canvas consumer 已实现；
- capability 验收完成前，Golden Path runner 不得读取 browser spec 或 report，不得 reset/migrate/seed PostgreSQL，不得 spawn Control API、Root Frontend 或 StoryCanvas，不得执行 readiness 网络探测，也不得启动 Chrome；
- Joint Gate 必须继续保留 `AB_GOLDEN_PATH_NOT_IMPLEMENTED`，不得把 `ab-golden-path` 标记为 `ready`。

本 checklist 不预设或发明 B 的 endpoint、DTO、marker、端口或 manifest 格式；这些 exact contracts 必须由 B 的实现提交与独立回执共同冻结，再由 A 验证。

## 5. Runner skeleton 的当前边界

A 下一切片只接线已完成的 preflight、fixture lifecycle、bounded process harness、dedicated Playwright config、JSON report 与 artifact scan。

在 B consumer capability 未证明时，runner 必须在以下动作之前固定返回：

```text
AB_GOLDEN_PATH_B_CONSUMER_REQUIRED
```

阻断点必须早于：

1. PostgreSQL reset/migrate/seed；
2. Control API spawn；
3. Root Frontend spawn；
4. StoryCanvas spawn；
5. Google Chrome 启动。

Joint Gate manifest 继续保持：

```text
availability: external
AB_GOLDEN_PATH_NOT_IMPLEMENTED
```

## 6. 共同不可越界项

- 不得让浏览器直调 internal redemption；
- 不得暴露 raw Grant/access token、internal token、grantId、digest 或 `CanvasEntryRedemption/0.1`；
- Pilot 失败不得回退 Demo/Mock/Zustand/LocalStorage；
- 不得用 bundled Chromium 替代真实 Google Chrome；
- 环境或服务不可用不得 `test.skip`；
- 不得修改 A-owned Control API core 或未经同步的 shared files；
- 不得把 `ab-golden-path` 标记为 `ready`；
- 不得移除 `AB_GOLDEN_PATH_NOT_IMPLEMENTED`；
- 不得宣称 `A_BIZ_06E_COMPLETE`、`AB_GOLDEN_PATH_COMPLETE`、`JOINT_GATE_PASS` 或 `FULL_JOINT_GATE_PASS`。

## 7. B 回执请求

请 B 回传一份独立文档提交，至少包含：

1. B implementation commit SHA 与 ancestor 证明；
2. server consumer、browser bootstrap、Pilot Canvas page 的文件清单；
3. start/readiness/capability exact contract；
4. Session/CSRF/CORS/error mapping；
5. selectors 与 targeted tests；
6. temp data root 与 secret/log marker 字典；
7. StoryCanvas tracked clean 证明；
8. 已同步 shared Gate commit `6e37dc9` 的证明。

在该回执进入 A 集成祖先链前，双方继续保持：

```text
A_CANVAS_ENTRY_REDEMPTION_READY
B_REDEMPTION_CONSUMER_IMPLEMENTATION_REQUIRED
SHARED_ACTIVATION_GREEN_BLOCKED
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

## 8. 2026-08-12 A Safety Hardening Delta（请 B 同步）

A 在 runner skeleton 之后新增以下独立提交：

| 能力                                     | RED       | GREEN / Fix |
| ---------------------------------------- | --------- | ----------- |
| legacy Demo/Mock evidence rejection      | `dceb03a` | `26ba12e`   |
| forbidden spec dependency rejection      | `cc9b47f` | `e2b669e`   |
| in-memory spec/report evidence scan      | `c8b0fb5` | `256f2ff`   |
| command-scoped Golden Path environment   | `a31abac` | `c8c02e7`   |
| cancelable process timers                | `b1ba2c2` | `d56bb0a`   |
| strict loopback origin/port              | `d35fbd0` | `c2a86d2`   |
| Git ancestor probe classification        | `7f7297f` | `3493cde`   |
| preflight stack suppression              | `71657c5` | `53ef8f4`   |
| StoryCanvas tracked baseline attestation | `c51685b` | `582150f`   |
| explicit preflight failure control flow  | —         | `4bbefb1`   |

### 8.1 Shared 同步要求

`c8c02e7` 修改 shared Joint Gate runner/manifest。B 在继续修改对应文件前必须同步该提交完整祖先链。它只为 `ab-golden-path` 命令注入 `PILOT_E2E_AB_GOLDEN_PATH=true`，并主动删除 base environment 中调用方传入的同名变量；其他 phase 不得继承该模式。

### 8.2 新 baseline acceptance order

A runner 现在按以下顺序验收，任何失败都早于 B consumer、spec/report、数据库、子进程、网络和 Chrome：

```text
commit object
→ HEAD ancestor
→ apps/storycanvas unstaged tracked diff clean
→ apps/storycanvas staged tracked diff clean
→ baseline→HEAD apps/storycanvas tracked diff clean
→ B consumer capability
```

`git diff status=1` 返回 `JOINT_GATE_B_BASELINE_ATTESTATION_REQUIRED`；`128/null/throw` 返回 `JOINT_GATE_B_BASELINE_COMMIT_INVALID`。检查不调用 `git status`，因此 B-owned 未跟踪 `apps/storycanvas/data/vendor/byteplus.ts` 继续排除，A 不修改、不删除、不暂存、不提交该文件。

### 8.3 当前验证与 blocker

A 本地验证：Golden Path safety `65/65 PASS / 0 SKIP`，Joint Gate manifest/CLI `14/14 PASS`，shared precondition/env `6/6 PASS`，Root Build、changed-file ESLint、Governance 与 diff-check PASS。

B 下一回执除原第 7 节内容外，还必须证明 implementation commit 已包含 consumer/bootstrap/page/readiness/capability，而不是 docs-only。当前继续保持：

```text
B_REDEMPTION_CONSUMER_IMPLEMENTATION_REQUIRED
SHARED_ACTIVATION_GREEN_BLOCKED
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```
