# CV5 · 业务融合工程师任务书

> 员工：`CV5`
> 任务 ID：`T0-CV1-05A / T0-CV1-05B`
> 前置：`G1 ACCEPTED`；Shared activation 依赖 `G2/G3/G4`
> 目标 Gate：`G5 Business Integration`
> 初始状态：`NOT_STARTED`

## 1. 任务目标

把 Control Plane 的真实 Tenant/Project/批准/资产权利与 StoryCanvas Canvas V1 安全连接，并让正式路由进入新画布而不是旧 Demo。

## 2. 独占写集

业务资产：

```text
apps/control-api/src/assets/**
apps/control-api/src/db/migrations/0*_canvas_asset_*.ts   # 只新增，不改历史迁移
apps/control-api/src/app.ts                              # 仅路由注册切片
```
Shared 集成：

```text
src/services/pilotStoryCanvasBridge.ts
src/services/pilotStoryCanvasBridge.test.ts
src/config/pilotE2eProxy.ts
src/config/pilotE2eProxy.test.ts
src/app/Router.tsx
src/app/Router*.test.tsx
src/features/canvas-v1/api/**
vite.config.ts
```

如 `apps/control-api/src/app.ts` 与其他工作同时变更，CV0 指定合并顺序。CV5 不修改 StoryCanvas Provider/Agent/UI 组件。

## 3. T0-CV1-05A · Control Plane Asset Authority

实现业务资产：

- tenant/project 归属；
- category：真人、虚拟人物、门店、商品、品牌、道具、声音、图片、视频；
- rights status；
- approval status；
- storage reference/checksum/provenance 安全记录；
- 项目/企业复用范围；
- 到期、撤销和拒绝；
- 安全 browser projection。

不得在 Control Plane 保存 Provider Token 或把 StoryCanvas SQLite 当集成引用。

## 4. T0-CV1-05B · Shared Activation

只有 G2/G3/G4 通过后才能开始：

### Proxy

- `/api/production/pilot/canvas/*` 只在明确 Pilot/Golden Path 模式代理到 StoryCanvas；
- 非法/缺失端口 fail-closed；
- 不影响 `/api/v1` Control API；
- 不硬编码跨源 URL 绕过 transport。

### Bridge

- 浏览器使用 Session/CSRF/Origin；
- 从 A 创建/读取唯一非秘密 Canvas Entry；
- 将 Entry 交给 B server consumer；
- 浏览器只得到 `CanvasBootstrap/0.1` 安全投影；
- response-loss replay 和 changed-payload rejection；
- 不存在 Demo bridge、Mock Grant 或 Storage fallback。

### Router

正式项目 Canvas 路由进入 Canvas V1 boundary/page；

```text
/projects/:projectId/canvas
```

或现有 canonical 路由映射必须唯一确定。不得进入：

```text
IntegratedStoryCanvasPage
StoryCanvasApp demo
generic handoff-required
```

### Receipt/Project Return

- 任务/资产结果显示在正确项目；
- 不跨租户泄漏；
- 使用量/Receipt 只登记真实事实；
- 首日不扩展真实支付。

## 5. 测试

先保持并扩展 Shared RED：

1. Proxy fail-closed；
2. Bridge 无 Demo/Storage/secret；
3. Router 不渲染旧 Demo；
4. tenant/project/package/session mismatch；
5. Session/CSRF/Origin/CORS；
6. browser bootstrap 无 forbidden markers；
7. rights revoked 后 readiness 失效；
8. Asset authority 跨租户 404/拒绝；
9. Task/Asset 回到正确项目；
10. Control API/Root build 回归。

## 6. 禁止项

- 不猜测未冻结 endpoint/DTO；
- 不修改 CV2 Provider/Canvas Command 实现；
- 不修改 CV3 Agent；
- 不修改 CV4 UI 组件；
- 不删除、skip 或弱化历史 Shared RED；
- 不把 bootstrap ready 描述为 real editor loaded；
- 不触碰 `byteplus.ts`。

## 7. 原子提交

```text
CV5-A test(control-api): freeze canvas asset authority
CV5-B feat(control-api): add tenant-scoped asset authority
CV5-C test(shared): freeze canvas v1 proxy bridge router activation
CV5-D feat(shared): activate pilot canvas transport and bridge
CV5-E feat(shared): route canonical project to canvas v1
CV5-F docs(integration): publish G5 handoff
```

业务资产与 Shared Green 不得混在同一个提交。

## 8. G5 验收

- G2/G3/G4 已 ACCEPTED；
- 三个 Shared RED 全部按合同转绿；
- 真实 Session/CSRF/Origin；
- Package selection 唯一；
- 正式路由加载 Canvas V1；
- 浏览器无 secret；
- Control API、Root build、Shared targeted tests PASS；
- `AB_GOLDEN_PATH_NOT_IMPLEMENTED` 在 G6 前保留。

## 9. 启动提示词

```text
你是 CV5，T0-CV1 业务融合工程师。G1 未 ACCEPTED 前只做只读调查。
开工时报告配置、worktree、branch、baseline、Master Plan 版本、exact write set/
no-write set 和计划 RED。

先完成 Control Plane tenant-scoped Asset Authority；G2/G3/G4 全部 ACCEPTED 后，
再独立实现 Shared Proxy、browser-safe Bridge 和 Router Green。你是 Router.tsx、
pilotStoryCanvasBridge.ts、pilotE2eProxy.ts 和 vite.config.ts 的唯一写入人。

正式路由必须进入 Canvas V1，不进入 IntegratedStoryCanvasPage、Demo Bridge 或
generic handoff。浏览器不得得到 Grant、Token、Digest、Package、asset:// 或
Provider 内部标识。保留历史 Shared RED 和 AB_GOLDEN_PATH_NOT_IMPLEMENTED。

严格遵守 Master Plan 通用提示词，不修改 CV2/CV3/CV4 独占文件或 byteplus.ts，
业务资产与 Shared 激活分原子提交，完成后申请 G5。
```
