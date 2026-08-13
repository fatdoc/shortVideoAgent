# CV6 · QA/Gate 工程师任务书

> 员工：`CV6`
> 任务 ID：`T0-CV1-06`
> 前置：G0 可只读开始；最终执行依赖 `G5 ACCEPTED`
> 目标 Gate：`G0/G1/G2/G3/G4/G5 复核 + G6 Delivery`
> 初始状态：`NOT_STARTED`

## 1. 任务目标

建立不依赖 Mock 的 fail-closed 验收矩阵，独立复核所有员工证据，并运行真实三服务浏览器纵向链路。

## 2. 独占写集

```text
tests/e2e/canvas-v1/**
scripts/t0-canvas-v1-gate/**
docs/program/t0-canvas-v1/handoffs/CV6_*.md
docs/program/t0-canvas-v1/evidence/**
```

CV6 对产品代码只读。发现失败提交给原 Owner，不自行修改实现或弱化测试。

## 3. G0 基线任务

- fetch 后记录 origin/main；
- 核对 worktree 与受保护文件；
- 运行现有合同、StoryCanvas、Media/TTS/Storage、Root build、StoryCanvas build、Governance、diff-check；
- 记录已有失败、环境阻塞和耗时；
- 不把缺少真实凭据转成 PASS。

## 4. Gate 复核矩阵

### G1 Contract

- canonical fixtures；
- negative vectors；
- frontend/backend conformance；
- secret-bearing rejection。

### G2 Asset/Command

- 未认证、过期、撤销、Provider 未 Active；
- cross-scope；
- idempotency/replay/conflict；
- Canvas Document 乐观锁；
- `asset://` 只在服务端。

### G3 UI

- loading/empty/ready/blocked/running/failed/conflict；
- 镜头和资产交互；
- DOM/URL/Storage/console forbidden markers；
- 1440×900、1672×941 visual smoke；
- 基本键盘和焦点。

### G4 Agent

- Agent/UI 同一 command；
- 工具白名单；
- readiness/rights/cost 门禁；
- 无 Provider/DB 直接访问；
- Agent 输出安全。

### G5 Integration

- Proxy/Bridge/Router Shared RED；
- Session/CSRF/Origin/CORS；
- Package selection；
- 正式 Canvas route；
- Task/Asset 项目归属。

## 5. G6 真实纵向链路

环境：

```text
dedicated PostgreSQL database ending _test
Control API
StoryCanvas Pilot Canvas runtime
Vite frontend
real Chrome/Chromium
explicit Pilot/Golden Path environment
```

步骤：

```text
login
→ select real tenant/project
→ approved script/storyboard
→ Canvas Entry
→ Canvas V1 bootstrap
→ inspect missing person readiness
→ prove generation blocked
→ bind Active trusted/virtual person asset
→ prove readiness becomes true
→ submit one user-confirmed Seedance shot command
→ observe queued/running/terminal state
→ verify output belongs to exact project
→ refresh and restore document/binding/task
```

如真实 Provider 凭据或授权不可用，G6 必须 `BLOCKED`，不得用 Mock 代替。

## 6. 安全检查

禁止在以下位置出现 raw secret/authority：

```text
HTTP browser response
DOM
URL/query/hash
LocalStorage/SessionStorage/IndexedDB
console
trace
screenshot
test report
stdout/stderr
```

Forbidden markers 包括 Token、Cookie、CSRF 原值、Grant、Package snapshot、Digest、raw Idempotency-Key、Provider body、`asset://`、绝对 data root。

## 7. 回归命令要求

最终报告必须给出可复制的精确命令和真实结果：

- CV1 contract suite；
- CV2 StoryCanvas targeted；
- CV3 Agent targeted；
- CV4 UI targeted；
- CV5 Control/Shared targeted；
- StoryCanvas v0.2；
- Media/TTS/Storage；
- Root build；
- StoryCanvas build；
- Governance；
- `git diff --check`；
- real browser E2E。

## 8. 禁止项

- 不修改产品代码；
- 不 skip/only/todo required tests；
- 不删除历史 RED；
- 不伪造 Provider task/result；
- 不使用非 `_test` PostgreSQL；
- 不把 Bootstrap ready 当 Real Editor loaded；
- 不触碰 `byteplus.ts`。

## 9. 原子提交

```text
CV6-A test(gate): record t0-cv1 baseline matrix
CV6-B test(gate): add canvas contract and asset security checks
CV6-C test(e2e): add real canvas v1 browser golden path
CV6-D docs(gate): publish G6 evidence report
```

## 10. G6 判定

只有全部 required 项真实通过才能报告：

```text
CANVAS_V1_GOLDEN_PATH_PASS
```

如果任何必需项缺环境或失败，报告精确 blocker，继续保留：

```text
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

## 11. 启动提示词

```text
你是 CV6，T0-CV1 QA/Gate 工程师。你可以在 G0 只读开始，但 G6 依赖 G5。
开工时报告配置、worktree、branch、baseline、Master Plan 版本、exact write set/
no-write set 和基线验证计划。

你对产品代码只读。建立 fail-closed Gate，复核合同、资产门禁、Canvas Command、
UI、Agent、Bridge/Proxy/Router 和真实浏览器纵向链路。不得修改实现让测试通过，
不得 skip/弱化历史 RED，不得用 Mock 或非 _test PostgreSQL 冒充真实证据。

重点验证未认证人物三层阻断、Active 绑定、UI/Agent 同一命令、幂等、刷新恢复、
项目归属和所有 secret/authority containment。严格遵守 Master Plan 通用提示词，
不触碰 byteplus.ts。完成后提供精确命令、真实结果、证据路径和 G6 判定。
```
