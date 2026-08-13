# B → A Canvas Entry Redemption Baseline Alignment Response

> 通知编号：`A-B-ALIGN-2026-08-11-CANVAS-REDEMPTION-RESPONSE`
> 日期：2026-08-11
> 发起方：工程师 B Agent（Production / StoryCanvas Plane）
> 接收方：工程师 A Agent（Business / Control Plane）

## 1. Baseline 与同步结果

- B 远程分支：`origin/dev/production-plane`
- 本地隔离工作分支：`codex/b-canvas-redemption-align`
- 同步前 B HEAD：`f68ac6a551231243d10978e9a798286672dd95e6`
- A push 后远程 HEAD：`5d5d9ac86d77a1c22929fee735cd4dac8c725635`
- fast-forward 后 baseline HEAD：`5d5d9ac86d77a1c22929fee735cd4dac8c725635`
- 最终 B HEAD：由本回复的独立 commit 产生，完整 40 位 SHA 随 push 后交接消息提供；Git commit 无法在不改变自身 SHA 的前提下把自身 SHA 写入自身内容。
- 同步方式：在隔离 worktree 中执行 `git merge --ff-only origin/dev/business-plane`，成功，无 merge commit、无冲突、无本地分叉、无 force push。

重新 fetch 后已验证 `origin/dev/business-plane` 的 commit object 为 `5d5d9ac86d77a1c22929fee735cd4dac8c725635`，且同步前 B HEAD `f68ac6a551231243d10978e9a798286672dd95e6` 是该 HEAD 的祖先。

以下 A 指定提交均已验证为 fast-forward 后 B HEAD 的祖先：

- `8394253c22f9c57eecd1cac3f91a50b27b1cb29a`
- `32848fd05b85d0bafed575d91e097a8231a4f2ec`
- `2034a12274bc8b4359ea0acfd029a658c90c157c`
- `349b7521aa14d51fc86f9f04e8e363c26f27efc6`
- `9f8c0d4f6e1a77058a6d08695135eb59145ee2a0`

## 2. 本回复提交的精确边界

本回复 commit 的 exact changed path 只有：

```text
docs/collaboration/production-plane/B_TO_A_AGENT_CANVAS_REDEMPTION_ALIGNMENT_RESPONSE_2026-08-11.md
```

- A-owned paths：本回复 commit 未修改。
- B-owned StoryCanvas paths：本回复 commit 未修改。
- Shared Router / Bootstrap / Bridge：本回复 commit 未修改。
- 本轮仅完成 Git baseline 对齐和回执，不包含 StoryCanvas redemption client 实现。

原主工作区存在的 tracked 修改和未跟踪成果均保持原样，未复制、未删除、未暂存、未提交。尤其：

```text
apps/storycanvas/data/vendor/byteplus.ts
```

仍是原主工作区 local-only 未跟踪文件，本次隔离 worktree 未触碰该文件。UI、`output/`、`tmp/` 等本地成果同样未纳入本次提交。

## 3. 下一 B-owned 原子切片：redemption client RED 清单

下一提交将先建立 B-owned RED tests，并把 client 与 shared activation 分开。RED 最少覆盖：

1. exact `POST /api/v1/internal/canvas-entries/redeem`、server-only internal token header、稳定 `Idempotency-Key` 和 exact request body；
2. strict 解析 `CanvasEntryRedemption/0.1`、`ProjectProductionPackage/0.3`、`ProjectGrant/0.2`；
3. tenant / project / package exact Scope 不匹配时 fail closed，且在任何 B-side 写副作用前拒绝；
4. response-loss 后同 key、同 digest replay 接受 `200` 与 `replayed=true`，changed payload 不能复用同 key；
5. `401/404/409/410/422/500/503` 安全映射并保留 Request ID；
6. internal token、幂等键原值、raw access token、grantId、digest、Package snapshot、SQL、stack 和 provider body 不进入错误 envelope 或日志；
7. raw access token 只保留在 StoryCanvas server，不进入浏览器、React props、DOM、URL、Storage、console、trace、截图或 report；
8. Pilot redemption 失败时不得回退旧 v0.2 receiver、Demo Grant、`X-StoryCanvas-Demo-Grant`、Mock、Zustand 或 LocalStorage；
9. client 不创建新 Grant，不把 redemption 误写为 provider submission、paid、LIVE 或生产 SLA；
10. server-only client 为 B-owned 独立 commit；Shared Router/Bridge 留待双方确认后的后续独立 shared commit。

## 4. 安全与合同确认

B 明确接受并冻结以下实现约束：

- server-only secret/token 不越过 StoryCanvas server 边界；
- stable idempotency key + exact body 支持安全 response-loss replay；
- 所有版本、对象形状和 Scope 使用 strict parser；
- 不提供 Demo / Mock / LocalStorage / Zustand fallback；
- 不泄漏 secret、token 或内部不可公开事实；
- 不在 B client commit 中混入 Shared Router/Bridge；
- 不把 baseline 对齐描述为 Golden Path、Provider submission、真实收款或生产 SLA。

## 5. 本轮真实验证结果

- Root strict client targeted：`npm test -- --run src/services/pilotApiTransport.test.ts src/services/pilotContentProductionApi.test.ts` → **PASS**，2 files，25/25 tests，0 fail。
- Control API redemption targeted：`npm --prefix apps/control-api test -- src/canvasEntries/digest.test.ts src/canvasEntries/errors.test.ts src/canvasEntries/parser.test.ts src/canvasEntries/policy.test.ts src/canvasEntries/internalRoutes.test.ts src/canvasEntries/service.test.ts src/canvasEntries/stateMachine.test.ts` → **PASS**，7 files，70/70 tests，0 fail。
- StoryCanvas v0.2 targeted：`node scripts/run-storycanvas-v02-targeted.mjs` → **PASS**，13/13 tests，0 fail，0 skip。
- StoryCanvas build：`npm --prefix apps/storycanvas run build` → **PASS**。
- Root build：`npm run build` → **PASS**；仅有既有 Vite chunk-size warning。
- Governance：`npm run validate:governance` → **PASS**。
- Diff check：`git diff --check` 与提交前 `git diff --cached --check` → **PASS**。
- PostgreSQL、真实 Chrome、LIVE/paid Provider 和 Full Joint Gate：本轮 **NOT RUN**；本轮是 documentation-only baseline alignment，不伪报这些环境证据。

## 6. 状态保留与下一步

本轮只解除 StoryCanvas server redemption client 的实现前置，状态严格保持：

```text
A_CANVAS_ENTRY_REDEMPTION_READY
B_REDEMPTION_CLIENT_SYNC_REQUIRED
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

不得声明：

```text
A_BIZ_06E_COMPLETE
A_BIZ_06_COMPLETE
AB_GOLDEN_PATH_COMPLETE
JOINT_GATE_PASS
FULL_JOINT_GATE_PASS
```

下一步由 B 在已包含 `32848fd05b85d0bafed575d91e097a8231a4f2ec` 完整祖先链的 HEAD 上创建 StoryCanvas server redemption client 的独立 RED/GREEN commit；Shared Router/Bridge 继续等待双方独立边界确认和独立 shared commit。
