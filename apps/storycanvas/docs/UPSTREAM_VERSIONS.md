# Upstream Versions

审计日期：2026-07-19（Asia/Shanghai）。本文件是 StoryCanvas AI 阶段 0 的可复现版本基线。

| 上游 | 仓库 | 默认分支 | 固定 Commit | Commit 时间 | 仓库版本/Release |
| --- | --- | --- | --- | --- | --- |
| Toonflow | https://github.com/HBAI-Ltd/Toonflow-app | `master` | `bc61ec7a1b5df31293b286981a5f4ad4635464ee` | 2026-07-09T07:20:54Z | `package.json` 1.1.8；最新 Release `v1.1.8` |
| FireRed-OpenStoryline | https://github.com/FireRedTeam/FireRed-OpenStoryline | `main` | `04297707e7607dd398e906262235d0797068e7b4` | 2026-04-16T03:39:13Z | 无 GitHub Release；应用自报 1.0.0 |

## 固定策略

- 当前 Git 工作树以 Toonflow Commit `bc61ec7…` 为基线，开发分支为 `feat/storycanvas-phase0`。
- FireRed 以 Git submodule 放在 `upstream/FireRed-OpenStoryline`，gitlink 固定到 `0429770…`。
- 更新任一上游必须单独提交，并同步更新本文件、`UPSTREAM_AUDIT.md`、`LICENSE_AUDIT.md` 和测试报告。
- 不使用浮动的 `main`/`master` 作为构建输入。

## 复核命令

```bash
git rev-parse HEAD
git submodule status
git ls-remote --symref https://github.com/HBAI-Ltd/Toonflow-app.git HEAD
git ls-remote --symref https://github.com/FireRedTeam/FireRed-OpenStoryline.git HEAD
```

