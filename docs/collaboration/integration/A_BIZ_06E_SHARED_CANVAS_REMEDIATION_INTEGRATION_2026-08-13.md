# A-BIZ-06E Shared Canvas Remediation Main Integration Record

- 日期：2026-08-13
- 集成负责人：工程师 A Agent
- 集成分支：`integration/a-biz-06e-shared-canvas`
- Main 基线：`origin/main@08de08df252d03684dc763250f1bada6ae867028`
- Business Plane 来源：`dev/business-plane@6128832fedfb0f8ae9df35b3983a2f01c492ad7e`
- B remediation candidate：`b5f36f2e43e8c43a9fdc3b015ddd67e87d33297a`
- 集成 merge commit：`8a28832f23df2e2210a498877c282188c4a1f2f6`
- 状态：本地集成和自动化 Gate 已通过；远程推送与 Main PR 等待 GitHub 网络恢复

## 1. 集成范围

本轮从本地最新 `origin/main` 建立短期 integration 分支，并以普通 `--no-ff` merge 纳入已完成 B remediation 正式验收的 `dev/business-plane`。

Business Plane 内已经包含：

- A candidate acceptance runner：`5d780073a7c2ae13943d7c87854b173ad9de78ba`；
- B remediation 双父合并：`0d9319bf087639da77389eff55649b48b667c9fd`；
- A 正式验收回执：`6128832fedfb0f8ae9df35b3983a2f01c492ad7e`。

本轮不包含 Shared Router、Bridge、Proxy Green，不包含真实 Canvas editor 加载，也不包含真实 Chrome + dedicated PostgreSQL Golden Path 或 Joint Gate activation。

## 2. Git 拓扑

Integration merge commit：

```text
8a28832f23df2e2210a498877c282188c4a1f2f6
parent 1: 08de08df252d03684dc763250f1bada6ae867028
parent 2: 6128832fedfb0f8ae9df35b3983a2f01c492ad7e
```

已确认：

```text
git merge-base --is-ancestor dev/business-plane HEAD
exit 0

git merge-base --is-ancestor b5f36f2e43e8c43a9fdc3b015ddd67e87d33297a HEAD
exit 0
```

合并提交的 tree 与来源 `dev/business-plane` tree 一致，说明当前 Main 基线没有额外冲突覆盖。

## 3. Integration Gate

在 `integration/a-biz-06e-shared-canvas` 上完成：

```text
Candidate acceptance runner       PASS
A acceptance suites               68/68 PASS
B remediation targeted            12/12 PASS
Pilot pages                         4/4 PASS
StoryCanvas v0.2                   13/13 PASS, 0 SKIP
Media/TTS/Storage                  17/17 PASS, 0 SKIP
StoryCanvas build                  PASS
Root build                         PASS
Governance                         PASS
git diff --check                   PASS
```

StoryCanvas build 生成的 tracked `apps/storycanvas/data/serve/app.js` 已在 Gate 后恢复，integration worktree 保持 clean。

## 4. 状态边界

本轮最高只允许声明：

```text
B_REMEDIATION_ACCEPTED
SHARED_ACTIVATION_GREEN_READY_FOR_PLANNING
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

不得声明：

```text
SHARED_ACTIVATION_GREEN
REAL_EDITOR_LOADED
GOLDEN_PATH_COMPLETE
JOINT_GATE_PASS
FULL_JOINT_GATE_PASS
```

## 5. 远程交付状态

2026-08-13 推送 `dev/business-plane` 时，GitHub HTTPS `github.com:443` 在 75 秒连接超时；该失败属于外部网络，不是 Git 冲突或 Gate 失败。

网络恢复后按以下顺序完成：

1. fetch 并确认 `origin/main` 仍为本记录基线，或在有新 Main 提交时重新合并并复跑 Gate；
2. 推送 `dev/business-plane`；
3. 推送 `integration/a-biz-06e-shared-canvas`；
4. 创建从 integration 分支到 `main` 的 Pull Request；
5. 通过受控 PR review/merge 进入稳定 Main，不直接 force push Main。
