# CV2 · 资产与生产后端工程师任务书

> 员工：`CV2`
> 任务 ID：`T0-CV1-02`
> 前置：`G1 ACCEPTED`
> 目标 Gate：`G2 Asset/Command`
> 初始状态：`NOT_STARTED`

## 1. 任务目标

把原 StoryCanvas 人物资产、可信资产、连续性和 Seedance 能力适配为正式租户/项目 Canvas V1 服务，并建立 UI/Agent 共用的 Canvas Command Service。

## 2. 必须复用的现有能力

优先通过 Adapter 复用：

```text
apps/storycanvas/src/services/storycanvas/characterAssets.ts
apps/storycanvas/src/services/storycanvas/characterAssetBinding.ts
apps/storycanvas/src/services/storycanvas/continuityMemory.ts
apps/storycanvas/src/services/storycanvas/byteplusAssets.ts
apps/storycanvas/src/services/storycanvas/byteplusTos.ts
apps/storycanvas/src/services/storycanvas/byteplusVideo.ts
apps/storycanvas/src/services/storycanvas/mvpGeneration.ts 中可抽取的纯生产能力
```
不在首日重写 Provider SDK、视频下载和已有可信资产签名实现。

## 3. 独占写集

```text
apps/storycanvas/src/services/storycanvas/assets-v1/**
apps/storycanvas/src/services/storycanvas/canvas-v1/**
apps/storycanvas/src/routes/production/pilot/canvas/assets/**
apps/storycanvas/src/routes/production/pilot/canvas/commands/**
apps/storycanvas/src/routes/production/pilot/canvas/documents/**
apps/storycanvas/migrations/005_canvas_v1_*.ts       # 如合同证明必须
```

修改现有 Provider 文件必须先提交 Request，由 CV0 指定唯一写入人。禁止修改 `apps/storycanvas/data/vendor/byteplus.ts`。

## 4. 必须实现

### 4.1 Production Scope Adapter

所有入口从服务端 Canvas Session 解析：

```text
tenantId
projectId
packageId
canvasSessionId
actorId
```

不得再调用 `ensureMvpProject()` 获取固定项目。

### 4.2 Asset Readiness

读取并组合：

- 业务权利/批准投影；
- Provider asset 状态；
- Entity binding；
- Shot contract requirements；
- capability/readiness。

返回严格 `ShotReadiness/0.1`。

### 4.3 Virtual Character

- 复用 Image 2/Seedream 角色设定板；
- 注册 BytePlus 可信资产；
- 查询/等待 Provider 状态；
- 只有 Active 才能绑定到项目人物实体；
- 更新 reference binding 与 continuity revision。

### 4.4 Canvas Command Service

至少实现：

```text
SYNC_PROVIDER_ASSET
BIND_ASSET_TO_ENTITY
GENERATE_SHOT
SELECT_SHOT_OUTPUT
SAVE_CANVAS_DOCUMENT
```

要求：

- stable idempotency；
- response-loss replay；
- changed-payload rejection；
- tenant/project/package/session exact binding；
- 未批准/未认证/Provider 未 Active fail-closed；
- 任务和输出持久化；
- 不记录 reference raw payload/secret。

### 4.5 Canvas Document

- 创建/读取/保存；
- `version` 乐观锁；
- 镜头顺序、选中输出和提示词修改持久化；
- 重启/刷新可恢复；
- 原始/候选资产不覆盖。

## 5. 测试优先级

先写 RED：

1. 未绑定人物拒绝视频任务；
2. rights pending/revoked/expired 拒绝；
3. Provider processing/rejected 拒绝；
4. cross-tenant/project/package/session 拒绝；
5. 同 key 同 payload replay；
6. 同 key 改 payload conflict；
7. Active 虚拟人物绑定推进 continuity revision；
8. 生成命令只在服务端解析 `asset://`；
9. Canvas Document stale version conflict；
10. 日志/错误无 token、digest、Grant、Package、provider body。

## 6. 禁止项

- 不实现 Control Plane 资产权利；
- 不修改 Router/Bridge/Vite；
- 不实现 Canvas React UI；
- 不实现 Agent；
- 不回退 `/api/mvp/*`；
- 不使用 Demo Grant、Storage 或固定项目；
- 不让浏览器传入/获取 `asset://`；
- 不伪造成功资产或 Receipt。

## 7. 原子提交

```text
CV2-A test(storycanvas): freeze canvas asset readiness
CV2-B feat(storycanvas): adapt production-scoped asset registry
CV2-C feat(storycanvas): add canvas command service and persistence
CV2-D feat(storycanvas): expose production canvas asset/command routes
CV2-E docs(production): hand off G2 evidence
```

## 8. G2 验收

- targeted RED/GREEN PASS；
- 旧 StoryCanvas v0.2 回归 PASS；
- Media/TTS/Storage 回归 PASS；
- StoryCanvas build PASS；
- 无 Demo/Mock/Storage fallback；
- `byteplus.ts` 未触碰；
- 真实 Provider smoke 只在凭据和用户确认存在时执行。

## 9. 启动提示词

```text
你是 CV2，T0-CV1 资产与生产后端工程师。G1 未被 CV0 标记 ACCEPTED 前只做
只读调查，不写实现。开工时报告配置、worktree、branch、baseline、Master Plan
版本、exact write set/no-write set 和计划 RED。

复用原 Character Assets、BytePlus Assets、Continuity、Seedance、Task 和媒体能力，
通过生产 Scope Adapter 去除 ensureMvpProject/demo-local-001。实现 Asset Readiness、
虚拟人物注册/绑定、Canvas Document 和 UI/Agent 共用 Canvas Command Service。
未认证人物、权利未批准、Provider 未 Active 或 Scope 不匹配必须 fail-closed。

你不修改 Control API、Router、Bridge、Vite、React UI、Agent 和 byteplus.ts。
严格遵守 Master Plan 通用提示词，按 RED→GREEN→回归形成原子提交并申请 G2。
```
