# Git 工作流 · GIT WORKFLOW

## 基本原则

- 两个仓库分别管理历史和发布，不直接拼接提交记录。
- 一名员工一个任务分支/Worktree。
- 稳定 `main` 只接收通过 C0 Gate 的提交。
- C5 不得重置 StoryCanvas 当前 `feat/storycanvas-phase0` 成果。

## 推荐分支

```text
codex/c1-tenant-channel
codex/c2-product-agents
codex/c3-credit-settlement
codex/c4-saas-platform
codex/c5-storycanvas-engine
codex/c6-demo-experience
codex/c7-integration-quality
codex/c8-product-materials
```

## 提交流程

1. 开工前报告仓库、分支、状态和范围。
2. 只提交本员工所有权内变更。
3. 更新项目级 STATUS/HANDOFF/CHANGELOG/REQUESTS。
4. C7 检查所需证据。
5. C0 决定合并顺序和目标分支。
6. 跨仓发布记录必须注明两个 commit/version 的对应关系。

## 禁止

- 未经批准直接修改稳定 `main`。
- `git reset --hard`、覆盖式 checkout 或删除他人分支成果。
- 将两个仓库未审核地变成子模块或单体仓库。
