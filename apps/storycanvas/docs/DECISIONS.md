# Architecture Decisions

## ADR-001：Toonflow 作为 Git 主工作树

决定：当前仓库保留 Toonflow 历史和目录，集成分支为 `feat/storycanvas-phase0`。

原因：用户要求第一阶段保留 Toonflow 技术结构，且当前目录初始为空。

## ADR-002：FireRed 使用固定 submodule

决定：FireRed 位于 `upstream/FireRed-OpenStoryline`，不复制进 Node 进程。

原因：明确升级边界、许可证归属和 Commit 固定。

## ADR-003：阶段 0 不修改预构建前端

决定：不直接编辑 `data/web`。

原因：它是压缩构建产物；画布源码实际位于未审计的 `Toonflow-web`。

## ADR-004：健康状态是组件化三态

决定：Web 与 MCP 分别探测，总状态为 `online/degraded/offline`，接口始终以安全结构返回。

原因：FireRed Web 可以在 MCP/权重不可用时单独运行；二值健康会误报能力。

## ADR-005：本轮不下载 FireRed 大型资源

决定：按用户要求跳过 `download.sh`。

后果：FastAPI Web 可运行，MCP 在 `SplitShotsNode` 初始化时因缺 TransNet 权重失败；记录为已知降级而非代码缺陷修复。

## ADR-006：固定 `langgraph-prebuilt==1.0.8`

决定：约束放在 `integrations/openstoryline/requirements.constraints.txt`，不改 FireRed requirements。

原因：上游解析到 1.0.9/1.0.10 后会导入不存在的 `langgraph.runtime.ExecutionInfo`；1.0.8 可导入且 `pip check` 通过。

## ADR-007：Toonflow 是唯一业务数据源

决定：FireRed session/Artifact 只作为外部执行映射；业务项目、版本、任务和资产都登记回 SQLite。

原因：避免两套项目状态冲突，支持回滚和应用重启恢复。

## ADR-008：数据库采用新增表 + 显式 Migration

决定：不把所有字段塞进 `o_project`/`o_tasks`，新增 StoryCanvas 领域表并用外键/映射关联旧表。

原因：当前旧表字段不足，直接改写会破坏上游兼容性和现有短剧功能。

