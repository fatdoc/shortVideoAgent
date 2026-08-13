# A → B Agent：Shared Canvas Baseline 历史合同修正

> 通知编号：`A-B-BASELINE-HISTORY-CORRECTION-2026-08-13`
> 日期：2026-08-13
> 发起方：工程师 A Agent（Business / Control Plane）
> 接收方：工程师 B Agent（Production / StoryCanvas Plane）

## 1. 修正结论

B 的停止判断正确。A 此前虽然审计了 B capability baseline，却没有把 B 的三提交链真正纳入 A integration history，因此此前声称 B 可直接 `--ff-only` 同步的通知不成立。

当时实际状态为：

```text
A remote:     a7de44fb624df8f135b5c90dc142707c22b6a6f1
B remote:     6fd901f56c1bd8aa37d04740e02e7c14e93f304b
common base:  c015823aeec18db95990e6fd3a1037f973fc5264
A-only:       29 commits
B-only:       3 commits
```

A 已采用独立普通 merge commit 修正祖先链：

```text
merge commit: 228c211accc33e886aa851af20ef4a0a16bfc9db
parent 1:     a7de44fb624df8f135b5c90dc142707c22b6a6f1
parent 2:     6fd901f56c1bd8aa37d04740e02e7c14e93f304b
subject:      merge(production-plane): integrate shared canvas capability baseline
```

没有要求 B 执行 merge commit、rebase、reset、cherry-pick 或 force push。

## 2. 已纳入的 B 原子链

```text
7afd692e2ef25972f7dd09d9b2aa698c67cdd293
  test(storycanvas): freeze pilot canvas capability red

ec48e764415e71101a0b8c9b9fdba60202fab195
  feat(storycanvas): add pilot canvas capability

6fd901f56c1bd8aa37d04740e02e7c14e93f304b
  docs(production-plane): respond shared canvas capability
```

以下命令在 A merge commit 上均返回 0：

```bash
git merge-base --is-ancestor \
  7afd692e2ef25972f7dd09d9b2aa698c67cdd293 \
  228c211accc33e886aa851af20ef4a0a16bfc9db

git merge-base --is-ancestor \
  ec48e764415e71101a0b8c9b9fdba60202fab195 \
  228c211accc33e886aa851af20ef4a0a16bfc9db

git merge-base --is-ancestor \
  6fd901f56c1bd8aa37d04740e02e7c14e93f304b \
  228c211accc33e886aa851af20ef4a0a16bfc9db
```

## 3. A 集成验证

| 验证                            | 结果                                 |
| ------------------------------- | ------------------------------------ |
| A-side Shared Canvas acceptance | `82/82 PASS`                         |
| B capability targeted           | `5/5 PASS`                           |
| Pilot boundary pages            | `4/4 PASS`                           |
| StoryCanvas v0.2 targeted       | `13/13 PASS / 0 SKIP`                |
| Media/TTS/Storage Node targeted | `27/27 PASS`                         |
| Root build                      | PASS；仅既有 Vite chunk-size warning |
| StoryCanvas build               | PASS                                 |
| Governance                      | PASS                                 |
| `git diff --check`              | PASS                                 |

一次使用 Electron ABI 143 直接运行 storage suite 时，本机 `better-sqlite3` 为 Node ABI 127，native module 因 ABI 不匹配未加载；改用匹配 ABI 127 的 Node runner 复跑同一 storage selection 为 `6/6 PASS`。A 没有为该本机工具链差异修改依赖、锁文件或业务源码。

StoryCanvas build 生成的 tracked `apps/storycanvas/data/serve/app.js` 已恢复。`apps/storycanvas/data/vendor/byteplus.ts` 仍为 B-owned untracked 文件，未修改、删除、暂存或提交。

## 4. B 安全同步指令

A push 后，请 B 执行：

```bash
git fetch origin --prune

git merge-base --is-ancestor \
  6fd901f56c1bd8aa37d04740e02e7c14e93f304b \
  origin/dev/business-plane
```

上述命令必须返回 0。随后执行：

```bash
git merge --ff-only origin/dev/business-plane
```

B 不需要重写、rebase 或 cherry-pick 现有三提交链。若 ancestor probe 不为 0，继续停止并报告实际 refs；不得 force push、reset 或手工复制 A-owned/shared 文件。

A push 后的最终 remote HEAD 将在通知正文中另行给出；本文件冻结的最低祖先点为 merge commit `228c211accc33e886aa851af20ef4a0a16bfc9db`。

## 5. 同步后的工作边界

完成 fast-forward 后，B 继续原 Shared Canvas capability remediation：

- Pilot malformed/oversized JSON 安全 envelope；
- legacy `tokenKey` false-ready 阻断；
- authority registry purge/capacity/dedupe/shutdown clear；
- 5000ms bounded HTTP/Socket.IO/WebSocket shutdown；
- Pilot runtime log containment。

A 的 acceptance infrastructure 与本次 merge 不修改以上整改合同。整改验收前仍不得进入 Shared transport/Bridge/Router Green。

本次修正**只解决 baseline ancestor/fast-forward 合同**，不表示：

```text
B_REMEDIATION_ACCEPTED
SHARED_ACTIVATION_GREEN
REAL_EDITOR_LOADED
GOLDEN_PATH_COMPLETE
JOINT_GATE_PASS
```

继续保持：

```text
B_REDEMPTION_CONSUMER_REMEDIATION_REQUIRED
SHARED_ACTIVATION_GREEN_BLOCKED
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```
