# A-BIZ-06E G5 / G6-Safe Shared Canvas Integration Record

- 日期：2026-08-14（Asia/Shanghai）
- 集成负责人：工程师 A Agent
- 集成分支：`integration/a-biz-06e-shared-canvas`
- 冻结接受 candidate：`49af8a39b82213fbc13ebcf841c4c00b78962787`（`docs(program): record G6 safe browser gate`）
- A Business Plane HEAD：`26f1611955baed37276397708f9c46b1718e76bd`（`docs(collaboration): hand off canvas package orchestration`）
- Integration merge：`85247ed5a299543c973696643359c947f50ac0b5`（`merge(business-plane): integrate G6-safe commercial canvas work`）
- 明确排除 candidate：`61b3de7c6226ea20dc80a5ffd5ac9747f1ae5d75`（`docs(program): record paid local Seedance smoke`）

## 1. 验收决定

本轮只接受以下状态：

```text
G5_ACCEPTED
G6_SAFE_NO_PROVIDER_BROWSER_SLICE_ACCEPTED
```

本轮继续保持：

```text
G6_OVERALL_BLOCKED
PAID_PROVIDER_GATE_NOT_ACCEPTED
AB_GOLDEN_PATH_NOT_COMPLETE
JOINT_GATE_NOT_PASS
```

`61b3de7` 记录的付费 Provider smoke 未纳入本次 integration。该 smoke 无法在本轮使用相同受控配置、付费授权和外部 Provider 条件独立复验，因此不得作为本次 Main PR 的验收事实。本记录不声明真实媒体生成、完整 Canvas V1 Golden Path、A/B Golden Path、Joint Gate 或 Full Joint Gate 通过。

## 2. Git 拓扑

Integration merge 使用普通 `--no-ff` merge，双 parent 保持为：

```text
85247ed5a299543c973696643359c947f50ac0b5
parent 1: 49af8a39b82213fbc13ebcf841c4c00b78962787
parent 2: 26f1611955baed37276397708f9c46b1718e76bd
```

本轮没有 reset、rebase、cherry-pick、force push 或改写 merge parents。

Merge 后另有两个独立的 integration-only 测试兼容提交：

```text
967dbc5 test(integration): preserve shared G5 historical attestation
59552e8 test(integration): stabilize historical G5 router attestation
```

`967dbc5` 仅恢复历史 G5 Gate 要求的 Router 测试精确名称，测试内部仍验证正式 Canvas V1 fail-closed 行为。`59552e8` 仅为 historical Gate 的 Router Vitest 子进程增加 `--testTimeout=20000`；默认 5 秒在当前机器上导致 3 个已知慢 Router 测试发生环境性超时，而同一矩阵在 20 秒上限下全部通过。该修复不放宽产品断言，也不修改运行时代码。

## 3. 冲突处理决策

### 3.1 Router

- 保留 A 的 Script / Storyboard 正式 Pilot boundary 路由；
- 对 `production-canvas` 使用 G5 正式 `CanvasV1RouteContainer`；
- 删除旧 `PilotCanvasBoundaryPage` 的 `entry=null` / consumer 占位接法；
- canonical Canvas route 在缺少合法 Project / Package 引用时继续 fail closed，不回退 Demo、generic Canvas 或旧 bridge。

### 3.2 Proxy

- 保留两个显式 Gate：基础 `PILOT_E2E` 与 A/B Golden Path 专用 `PILOT_E2E_AB_GOLDEN_PATH`；
- Control API 与 StoryCanvas 目标都只允许固定 loopback 端口；
- 保持 `changeOrigin: false`，不允许浏览器同源语义被代理重写；
- 非 test、未显式启用或端口非法时 fail closed。

### 3.3 Bridge

- 采用 G5 正式 activation transport：Control activation → legacy open → formal bootstrap → formal workspace；
- 保留 A 所需的严格 tenant / project / package scope 验证和安全错误归一化；
- 浏览器面只接收非秘密选择和 session-bound 安全投影，不暴露原始 Grant、CSRF、Cookie、idempotency key 或 Provider authority；
- approval 与 dispatch 保持 exact command equality，refresh 继续读取正式 workspace / document / assets / readiness。

### 3.4 Canvas Bootstrap Orchestrator

- 保留 A 的 eligibility → exact approved Script / Storyboard → canonical Package 创建和 deterministic bootstrap-cycle 去重；
- 将旧 `storyCanvasBridge.open(...)` 合并为正式 `storyCanvasBridge.activate(...)`；
- activation attempt 由受控 UUID factory 创建，并校验返回 selection、workspace、canvas session 与 tenant / project / package exact match；
- scope poison、非法 attempt、stale Package 或 Bridge 错误继续安全 fail closed，不创建替代 Package，不切换 Demo / Mock / Storage。

## 4. 自动化 Gate 与定向测试

### 4.1 Shared G5

```text
Activation Transport validator       6/6 PASS
Shared G5 static policy               7/7 PASS
Shared G5 public runtime              7/7 PASS
External-browser harness policy       3/3 PASS
Historical real-product attestation  41/41 PASS
Final marker                         SHARED_G5_GATE_PASS
```

### 4.2 G6-safe

```text
Session recovery                      3/3 PASS
Final marker                         SESSION_RECOVERY_PASS
Browser provenance / replay           6/6 PASS
```

G6-safe 只证明 no-provider browser safety、session recovery 和 provenance/replay 合同。它没有执行或接受付费 Seedance / BytePlus / TOS Provider smoke。

### 4.3 Integration targeted tests

```text
pilotCanvasBootstrapOrchestrator     17/17 PASS
pilotStoryCanvasBridge                5/5 PASS
pilotE2eProxy                         5/5 PASS
pilotContentProductionApi            13/13 PASS
unifiedTenantWorkbench               15/15 PASS
Router Pilot                         31/31 PASS
CanvasV1RouteContainer                3/3 PASS
Total                                89/89 PASS
```

Router suite 使用 `--testTimeout=20000`，与此前 A 验收方式一致。

## 5. Build、治理与格式

```text
npm run build                         PASS
npm --prefix apps/control-api build   PASS
npm --prefix apps/storycanvas build   PASS
npm run validate:governance           PASS
npx tsc -b --pretty false             PASS
Prettier changed-file check           PASS
git diff --check                      PASS
```

StoryCanvas build 仅生成 tracked artifact：

```text
apps/storycanvas/data/serve/app.js
```

该生成物已单独恢复，未纳入提交。未读取、修改、删除、暂存或提交 A 主工作区中的未跟踪文件：

```text
apps/storycanvas/data/vendor/byteplus.ts
```

## 6. 数据库后置零事实

在本机现有 `videoagent_control_test` 数据库中，显式使用 `control_plane` schema 查询并确认两张表存在：

```text
control_plane.high_cost_command_approvals = 0
control_plane.production_tasks            = 0
```

因此本轮验收没有产生高成本命令批准事实，也没有产生生产任务事实。

## 7. Main PR 边界

面向 `main` 的 PR 只能描述：

- G5 Shared Canvas 已接受；
- G6 safe / no-provider browser slice 已接受；
- paid Seedance smoke 明确排除且未接受；
- 完整 G6、真实媒体生成、Canvas V1 Golden Path、A/B Golden Path 与 Joint Gate 仍阻塞。

禁止使用以下声明：

```text
G6_COMPLETE
PAID_PROVIDER_GATE_PASS
REAL_MEDIA_GENERATION_PASS
CANVAS_V1_GOLDEN_PATH_PASS
AB_GOLDEN_PATH_COMPLETE
JOINT_GATE_PASS
FULL_JOINT_GATE_PASS
```
