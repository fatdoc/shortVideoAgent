# StoryCanvas 源码并入记录

## 来源

- 原工作区：`/Users/docfat/.codex/worktrees/19f7/短视频agent`
- 来源提交：`46fc8d02197e639dbf5bc73f8d0b97210fcbd25d`
- 提交说明：`feat: complete D1 canonical production runtime`
- 并入日期：2026-07-30
- 目标目录：`apps/storycanvas/`

## 导入方式

使用来源提交的 `git archive` 导入全部跟踪文件。以下内容没有导入：

- 原仓库 `.git` 历史和工作树元数据
- `node_modules`
- 本地 SQLite 和运行时临时数据
- 来源工作树中未提交的构建伴生改动
- 本地环境变量和真实 Provider Key

来源提交中的 FireRed gitlink 已在根 `.gitmodules` 重新注册，固定为：

```text
FireRed-OpenStoryline 04297707e7607dd398e906262235d0797068e7b4
```

原工作区当时未初始化该 submodule，因此没有伪装成已导入的普通源码；克隆时使用 `--recurse-submodules` 获取。

## 完整性与许可证

- `LICENSE`、`NOTICES.txt`、上游标识和第三方声明原样保留。
- 源码并入本仓库不等于获得 Toonflow 对外商业分发授权。
- 商业上线、白标、对外分发或移除上游标识前，必须完成书面授权和法律复核。
- 后续修改必须保留适用的版权、商标、NOTICE 和修改声明。

## 架构边界

物理上采用单仓，逻辑上继续保持双平面：

```text
根目录 SaaS 控制平面
        |
        | ProjectProductionPackage v0.1 + project-scoped grant
        v
apps/storycanvas 媒体生产平面
```

StoryCanvas 不写客户钱包、不定义客户价格、不创建 Tenant 或渠道组织。SaaS 不直接读取 StoryCanvas SQLite。
