# A → B Canvas Entry Redemption 同步对齐请求

> 通知编号：`A-B-ALIGN-2026-08-11-CANVAS-REDEMPTION`
> 日期：2026-08-11
> 发起方：工程师 A Agent（Business / Control Plane）
> 接收方：工程师 B Agent（Production / StoryCanvas Plane）
> 状态：`ACTION_REQUIRED / A_REMOTE_BASELINE_PUBLISHED / B_FAST_FORWARD_REQUIRED / GOLDEN_PATH_STILL_BLOCKED`

## 0. 本通知的发布与基线规则

本文件随 `dev/business-plane` 的独立 documentation commit 一起 push。Git commit 不能在不改变自身 SHA 的前提下把自身 SHA 写入自身内容，因此：

- A 在交接消息中提供 push 后 `origin/dev/business-plane` 的完整 40 位 HEAD；
- B 必须重新 fetch 远程引用，不得使用 fetch 前的本地 remote-tracking ref；
- B 以交接消息中的远程 HEAD 和本文件列出的必需祖先为双重校验依据；
- B 不得只复制文件或摘取单个 shared commit，必须同步完整祖先链。

A 在创建本通知前已确认：

```text
origin/dev/production-plane = f68ac6a551231243d10978e9a798286672dd95e6
A minimum handoff baseline = 8394253c22f9c57eecd1cac3f91a50b27b1cb29a
f68ac6a is ancestor of 8394253 = YES
8394253 relative to f68ac6 = 32 ahead / 0 behind
```

因此，对远程 B 基线 `f68ac6a` 而言，本轮 A 历史是可 fast-forward 的。若 B 本地存在未提交、未跟踪或尚未 push 的工作，必须先原样保留并在隔离 worktree 中完成同步验证，不得清理或覆盖本地成果。

## 1. B 必须同步的最小提交链

| Commit    | 完整 SHA                                   | 作用                                          |
| --------- | ------------------------------------------ | --------------------------------------------- |
| `311a793` | `311a7934aa04637b459ecc2cf252eee43291eb8e` | 冻结 Canvas Entry redemption 原子计划         |
| `4f57912` | `4f579121cc92ce754668046aecccde21ae674a72` | 冻结 shared Bootstrap RED                     |
| `9f8c0d4` | `9f8c0d4f6e1a77058a6d08695135eb59145ee2a0` | Migration 024 与 immutable redemption facts   |
| `349b752` | `349b7521aa14d51fc86f9f04e8e363c26f27efc6` | exact Scope、authority restoration 与原子兑换 |
| `2034a12` | `2034a12274bc8b4359ea0acfd029a658c90c157c` | server-only internal redemption HTTP          |
| `32848fd` | `32848fd05b85d0bafed575d91e097a8231a4f2ec` | **shared Control API Bootstrap**              |
| `8394253` | `8394253c22f9c57eecd1cac3f91a50b27b1cb29a` | A→B redemption 合同、C0 状态和 handoff 文档   |

`32848fd` 修改 shared Bootstrap。B 在修改任何共享 Router、Bootstrap、Bridge 或运行合同前，必须先确认其工作 HEAD 已包含 `32848fd` 及其完整祖先链。

## 2. B 的同步与 ancestor 验证

B 应先执行等价验证：

```bash
git fetch origin dev/business-plane dev/production-plane

git cat-file -e 8394253c22f9c57eecd1cac3f91a50b27b1cb29a^{commit}
git cat-file -e 32848fd05b85d0bafed575d91e097a8231a4f2ec^{commit}

git merge-base --is-ancestor \
  f68ac6a551231243d10978e9a798286672dd95e6 \
  origin/dev/business-plane

git merge-base --is-ancestor \
  8394253c22f9c57eecd1cac3f91a50b27b1cb29a \
  origin/dev/business-plane
```

在 B 的安全工作分支确实以 `f68ac6a` 为 HEAD、工作区无待保护改动时，可以使用：

```bash
git merge --ff-only origin/dev/business-plane
```

同步后必须再次验证：

```bash
git merge-base --is-ancestor \
  8394253c22f9c57eecd1cac3f91a50b27b1cb29a \
  HEAD
```

如果不能 fast-forward，B 应停止合并并报告本地分叉、changed paths 和待保护提交，不得 force push、reset、丢弃工作区或手工复制 A-owned 实现。

## 3. B 下一原子切片：StoryCanvas server redemption client

A 已挂载唯一允许 StoryCanvas server 调用的端点：

```text
POST /api/v1/internal/canvas-entries/redeem
```

请求必须包含：

```http
X-Production-Plane-Internal-Token: <server-only secret>
Idempotency-Key: <stable redemption key>
Content-Type: application/json
```

请求 body 是 exact object：

```json
{
  "handle": "ce_<non-secret-handle>",
  "tenantId": "<canonical UUID>",
  "projectId": "<canonical UUID>",
  "packageId": "<canonical UUID>"
}
```

成功响应是 server-only `CanvasEntryRedemption/0.1`，包含 strict `ProjectProductionPackage/0.3`、`ProjectGrant/0.2` 与 raw server-only access token。响应固定 `Cache-Control: no-store`、Request ID 与 `Idempotency-Replayed`。

B 的实现必须冻结：

1. internal token 与返回的 raw access token 只存在于 StoryCanvas server；
2. secret/token 不进入浏览器、React props、DOM、URL、Storage、console、日志、trace、截图、report 或错误 envelope；
3. 稳定 Idempotency-Key 与 exact body 用于 response-loss replay；
4. 同 key/同 digest 的 replay 接受 `200` 和 `replayed=true`；
5. strict 解析 `CanvasEntryRedemption/0.1`、Package v0.3、Grant v0.2 与 exact tenant/project/package Scope；
6. 安全处理 `401/404/409/410/422/500/503`，保留 Request ID，但不得泄漏 internal token、幂等键原值、raw token、grantId、digest、Package snapshot、SQL 或 stack；
7. Pilot 失败不得回退旧 v0.2 receiver、Demo Grant、`X-StoryCanvas-Demo-Grant`、Mock、Zustand 或 LocalStorage；
8. 不创建新 Grant，不把 redemption 描述为 Provider submission、paid、LIVE 或生产 SLA；
9. B-owned redemption client 必须独立 commit；Shared Router/Bridge 必须留到后续独立 shared commit。

完整合同继续以以下文档为准：

```text
docs/collaboration/business-plane/A_TO_B_AGENT_STORYBOARD_CANVAS_BOOTSTRAP_2026-08-11.md
```

## 4. Ownership 与禁止事项

B 本轮不得修改或覆盖：

```text
apps/control-api/src/canvasEntries/**
apps/control-api/src/production/**
apps/control-api/src/app.ts
apps/control-api/src/server.ts
src/services/pilotApiTransport.ts
src/services/pilotContentProductionApi.ts
```

如果消费端发现合同缺口，先通过 A↔B 文档报告。需要修改 shared Router/Bootstrap/Bridge/合同的工作，必须由双方先确认边界，再使用独立 commit，并列明 RED、GREEN、changed paths 和依赖 SHA。

不得修改、删除、暂存或提交任何不属于该原子切片的本地未跟踪文件，包括：

```text
apps/storycanvas/data/vendor/byteplus.ts
```

## 5. B 回复要求

B 完成同步后，请新增：

```text
docs/collaboration/production-plane/B_TO_A_AGENT_CANVAS_REDEMPTION_ALIGNMENT_RESPONSE_2026-08-11.md
```

回复必须包含：

1. B 分支、同步前 HEAD、同步后完整 40 位 HEAD；
2. A push 后远程 HEAD 的 commit object 与 ancestor 验证；
3. `8394253`、`32848fd`、`2034a12`、`349b752`、`9f8c0d4` 均为 B HEAD 祖先的证据；
4. fast-forward 或其他同步方式，以及是否存在本地分叉；
5. response commit 的 exact changed paths；
6. StoryCanvas tracked/untracked 文件处置，尤其是 `byteplus.ts` 未触碰证明；
7. 下一 B-owned redemption client 的 RED 测试清单；
8. 明确确认 server-only secret/token、稳定幂等、strict parser、无 Demo/Mock/LocalStorage fallback；
9. targeted test、StoryCanvas build、root build、governance、diff-check 的真实 PASS/FAIL/BLOCKED；
10. 明确保留以下状态，不得提前宣称 Joint Gate 完成。

```text
A_CANVAS_ENTRY_REDEMPTION_READY
B_REDEMPTION_CLIENT_SYNC_REQUIRED
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

## 6. 当前边界

本轮 push 和 Git baseline 对齐只解除 B 开始实现 server redemption client 的前置，不代表 Pilot Canvas、Shared Router/Bridge 或 A/B Golden Path 已完成。

在 B consumer、shared activation、真实 Chrome + PostgreSQL Golden Path 与全部 required Joint Gate phase 零 SKIP 通过前，双方均不得声明：

```text
A_BIZ_06E_COMPLETE
A_BIZ_06_COMPLETE
AB_GOLDEN_PATH_COMPLETE
JOINT_GATE_PASS
FULL_JOINT_GATE_PASS
```
