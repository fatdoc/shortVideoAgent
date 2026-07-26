# 风险与阻塞 · RISKS AND BLOCKERS

更新时间：2026-07-26

## 阻塞（Blockers）

无。Gate 2 已通过，可启动 C5 / C6。

## 风险（Risks）

| ID | 等级 | 描述 | 缓解 |
|---|---|---|---|
| R-001 | 中 | UI 参考图文件名含空格/括号，路径引用易错 | 文档映射；代码中慎用直接路径 |
| R-002 | 中 | 多线程并行可能越权改公共模块 | FILE_OWNERSHIP + REQUESTS + 治理脚本 |
| R-003 | 低 | 新机器未安装 Playwright 浏览器时 e2e 失败 | 本机 Chromium 已安装；CI / 新机器执行 `npx playwright install chromium` |
| R-004 | 低 | Antd v5 / React 19 兼容差异 | 已按官方方案接入 `@ant-design/v5-patch-for-react-19` |
| R-005 | 低 | LocalStorage 结构升级导致旧数据不兼容 | key 带版本；提供 reset |
| R-006 | 中 | 生产构建主 JS 约 1.29MB（gzip 约 406kB），超过 Vite 500kB 提示线 | Gate 3 / Final 评估路由懒加载与 manualChunks |
| R-008 | 低 | `PROJECT_STATUS_LABEL` 与 `ProjectStatus` 枚举未完全对齐 | C1 后续小修；不阻塞业务并行 |
| R-009 | 中 | `npm audit` 有 7 个 high；production 2 个来自 React Router RSC advisory | 当前 SPA Mock 未使用 RSC action，Gate 2 不阻塞；升级依赖前单列回归 |
| R-010 | 高 | Gate 2 功能通过，但 C1—C4 与原始 UI 图存在结构性视觉偏差 | 插入 Wave 2.5；1672×941 同尺寸对照 + 1440×900 复核后再进入 Gate 3 |

## 观察项

- 参考图与最终信息架构若有差异，以 C0 决策与 DATA_CONTRACTS 为准
- C5 / C6 必须复用统一 `activeScript`、storyboard、assets 与 timeline，禁止私有主数据
