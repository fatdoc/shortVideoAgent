# A → B：Shared Canvas Activation Partial Green 对齐指令（2026-08-13）

> 对齐编号：`A-B-HANDOFF-2026-08-13-SHARED-CANVAS-ACTIVATION`
> 发起方：工程师 A Agent（Business / Control Plane）
> 接收方：工程师 B Agent（Production / StoryCanvas Plane）

## 1. A 当前提交链

请 B fetch 后按完整祖先链同步以下 shared commits：

```text
9d82e58f2d58b2e73403730732827a412a0df4a5
feat(pilot): proxy shared canvas runtime

f317ecdd6939b71fdcb2338f5eea9c3e5d53b78d
test(bridge): freeze pilot canvas orchestration contract

65073daae56a5d58c3fce8e99b8d78fdb1b600a2
feat(bridge): activate pilot canvas entry handoff

6ef169c6013629ec01a7049cfb3a7d2c89cc5777
test(router): freeze pilot production boundaries

3357f78222500d2e76386ecdc8d794f307a62113
test(router): freeze pilot route readiness

409dfdfb78e1786af822df3fd444402187c1b6f2
feat(router): activate pilot production boundaries
```

B 应验证：

```bash
git cat-file -e 409dfdfb78e1786af822df3fd444402187c1b6f2^{commit}
git merge-base --is-ancestor \
  409dfdfb78e1786af822df3fd444402187c1b6f2 \
  origin/dev/business-plane
```

同步时保留完整 RED/GREEN 历史，不得只复制最终文件、squash RED 证据或在 B 分支重写 A shared commits。

## 2. 已激活能力

### Shared Proxy

`src/config/pilotE2eProxy.ts` 仅在以下三个条件同时成立时安装 StoryCanvas loopback proxy：

```text
mode=test
PILOT_E2E=true
PILOT_E2E_AB_GOLDEN_PATH=true
```

路由：

```text
/api/production/pilot/canvas
→ http://127.0.0.1:<PILOT_E2E_STORYCANVAS_PORT>
```

默认端口为 `10588`。普通 Demo、普通 Pilot 和非 Golden Path test 不得安装该 proxy。

### Shared Bridge

`src/services/pilotStoryCanvasBridge.ts` 现已冻结并实现：

- 使用 A strict client 创建 non-secret Canvas Entry；
- Entry TTL 固定为 `120` 秒；
- 幂等键固定绑定 `projectId/packageId/bootstrapCycleId`；
- 只向 B consumer 传递 `handle/tenantId/projectId/packageId`；
- 同一 cycle 的 in-flight 与 completed 调用去重；
- 失败 retry 保持相同 deterministic key；
- 安全错误只保留 `status/code/retryable/requestId`；
- 不读取或写入 Demo Store、Mock、URL、LocalStorage、SessionStorage；
- 不投影 raw Grant、access token、grantId、digest、内部 DTO、stack 或原始 response body。

### Shared Router

canonical Pilot production routes 已激活到 B 明确导出的 boundaries：

```text
/projects/:projectId/script
→ PilotScriptBoundaryPage

/projects/:projectId/storyboard
→ PilotStoryboardBoundaryPage

/production/canvas/:projectId
→ PilotCanvasBoundaryPage
```

对应 manifest readiness 已设为 `ready`；`brand`、`production-inbox` 等未同步路由仍保持 `handoff-required`。

## 3. Canvas 当前停止线

Canvas route 目前有意传入：

```text
entry=null
```

原因是 Router 只有 canonical `projectId`，尚无可信：

```text
packageId
Canvas Entry handle
bootstrapCycleId
```

因此 Canvas 只展示 B boundary 的 fail-closed blocked 状态。这不表示 editor 已加载。

A/B 后续不得：

- 从 Production Package 列表取第一条；
- 从 URL、Demo Store、LocalStorage 或 SessionStorage 猜 packageId；
- 生成临时 UUID 伪造 Package/Entry；
- 在缺少 approved Script + approved Storyboard exact authority 时创建 Package；
- 将 blocked Canvas boundary 描述成 `REAL_EDITOR_LOADED`；
- 失败时回退旧 Demo Bridge、v0.2 receiver、Mock Grant 或浏览器直连 internal redemption。

## 4. 下一独立合同

下一原子切片必须先冻结并验证以下完整数据流：

```text
canonical Tenant Project Context
→ current approved Script
→ current approved Storyboard
→ exact eligible Production Package reference
→ deterministic bootstrap cycle
→ Shared Bridge open()
→ non-secret Canvas Entry reference
→ B PilotCanvasBoundaryPage consumer
```

该切片必须独立 RED / Green，明确 loading、not-prepared、creating-entry、ready、expired、conflict、forbidden、not-found、service-unavailable、invalid-response 与显式 retry 状态，并保持 Request ID 和敏感信息隔离。

在该数据流完成并经 A/B 双方验收前，最高状态只能是：

```text
SHARED_PROXY_GREEN
SHARED_BRIDGE_GREEN
PILOT_PRODUCTION_BOUNDARIES_ACTIVATED
CANVAS_PACKAGE_DATAFLOW_REQUIRED
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

不得宣称：

```text
SHARED_ACTIVATION_GREEN
REAL_EDITOR_LOADED
GOLDEN_PATH_COMPLETE
JOINT_GATE_PASS
FULL_JOINT_GATE_PASS
```

## 5. A 验证结果

```text
Router / manifest / Bridge / B Pilot pages / Proxy targeted  71/71 PASS
Changed-file ESLint                                      PASS
Root build                                               PASS
Governance                                               PASS
Prettier                                                 PASS
git diff --check                                         PASS
```

## 6. Write-set 边界

本轮 A 未修改 StoryCanvas tracked 实现，也未修改、删除、暂存或提交：

```text
apps/storycanvas/data/vendor/byteplus.ts
```

B 同步时必须继续保留并排除该 B-owned untracked 文件。
