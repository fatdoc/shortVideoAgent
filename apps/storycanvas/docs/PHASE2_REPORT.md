# StoryCanvas AI 阶段 2 开发报告

执行日期：2026-07-20  
阶段：统一数据层  
状态：完成

## 交付结果

- 新增 StoryCanvas 领域层严格 Zod Schema。
- 新增 `001_storycanvas_core` 事务型 Migration。
- 真实 SQLite 已创建并登记 11 张 `sc_*` 表。
- 新增 Migration checksum、幂等执行、失败回滚和显式回滚机制。
- 应用启动时自动等待数据库初始化并执行 Migration。
- 新增 `db:migrate`、`db:status`、`db:rollback` 命令。
- 新增项目媒体八类隔离目录、安全路径构造和流式 SHA-256。
- 数据库 TypeScript 声明已包含全部 `sc_*` 表。

## 兼容性边界

- 没有删除、重命名或修改任何 `o_*` 表和字段。
- `projectId/scriptId/storyboardId/imageId/videoId` 继续关联上游整数 ID。
- StoryCanvas 新实体使用 UUID。
- FireRed 外部 ID 只进入编辑会话或外部映射表。
- 原始素材和历史版本不覆盖。

## 数据表

1. `sc_migrations`
2. `sc_project_profile`
3. `sc_script_versions`
4. `sc_scenes`
5. `sc_shot_metadata`
6. `sc_media_assets`
7. `sc_tasks`
8. `sc_edit_sessions`
9. `sc_edit_commands`
10. `sc_timeline_versions`
11. `sc_external_mappings`

## 验证结果

| 验证 | 结果 |
| --- | --- |
| `yarn test` | 17/17 通过 |
| `yarn lint` | 通过 |
| `yarn build` | 通过 |
| `yarn db:status` | `APPLIED 001_storycanvas_core` |
| 真实数据库 `sc_*` 表 | 11 张 |
| Migration 重复执行 | 跳过，不重复建表 |
| checksum 漂移 | 拒绝启动/回滚 |
| 失败事务回滚 | 通过 |
| 上游 `o_*` 表保留 | 通过 |
| 生产启动 + 登录 | 通过，HTTP 200 |

## 下一步

阶段 3 实现 `sc_tasks` Repository、重启恢复、MockText/Image/Video Provider 和任务 SSE。所有阶段 3 自动测试继续禁止调用收费模型。
