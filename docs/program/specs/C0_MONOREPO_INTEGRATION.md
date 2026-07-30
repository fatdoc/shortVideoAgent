# C0 单仓单前端双平面整合决策

> 状态：ACTIVE
> 日期：2026-07-30
> GitHub：`fatdoc/shortVideoAgent`

## 决策

项目从“双工作区、双仓候选”调整为“单 Git 仓库、单一用户前端、双平面”：

```text
/
├── src/                    唯一 SaaS 前端（含 StoryCanvas 画布模块）
├── docs/program/           项目共同记忆与公共合同
└── apps/storycanvas/src/   StoryCanvas 媒体生产 API 与引擎
```

StoryCanvas 来源固定为提交：

```text
46fc8d02197e639dbf5bc73f8d0b97210fcbd25d
```

## 保留的边界

- 控制平面拥有身份、租户、渠道、产品、价格、额度和品牌事实。
- StoryCanvas 拥有画布、任务、媒体资产、时间线和导出。
- 两个平面继续通过 `ProjectProductionPackage v0.1`、project-scoped grant 和 receipts 连接。
- 用户只访问根前端 `5173`；`10588` 仅提供内部 API，不再托管独立 Web。
- 物理合并不允许跨平面直接读写数据库或复制主数据。

## 合并收益

- 两位开发者只需克隆一个仓库。
- 合同与两端实现可以在同一 PR 中完成原子版本管理。
- GitHub 能保存完整 Demo，而不是只有 StoryCanvas 入口。
- C7 可以用一个 commit SHA 固定两端源码，同时继续分别记录应用级测试结果。

## 风险

- StoryCanvas 依赖较重，首次安装和构建时间明显增加。
- 仓库包含约 130 MB StoryCanvas 跟踪资产。
- FireRed-OpenStoryline 继续作为固定提交的 Git submodule，克隆时需使用 `--recurse-submodules`。
- Toonflow 商业授权、标识和 NOTICE 仍是对外商业化硬 Gate。
- 不允许把浏览器前端与 `apps/storycanvas/src/` 的后端 Store 或数据库直接混合。

## 开发规则

- 负责人 A 默认不改 `apps/storycanvas/`。
- 负责人 B 默认不改根控制平面独占目录。
- 公共合同修改必须由双方确认。
- StoryCanvas 的生成产物、数据库、密钥和本地缓存不得提交。
- 历史 D1 文档中的“双仓”术语保留，代表当时真实验收环境。
