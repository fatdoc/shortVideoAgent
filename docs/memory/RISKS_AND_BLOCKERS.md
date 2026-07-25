# 风险与阻塞 · RISKS AND BLOCKERS

更新时间：2026-07-26

## 阻塞（Blockers）

无。Gate 0 可继续。

## 风险（Risks）

| ID | 等级 | 描述 | 缓解 |
|---|---|---|---|
| R-001 | 中 | UI 参考图文件名含空格/括号，路径引用易错 | 文档映射；代码中慎用直接路径 |
| R-002 | 中 | 多线程并行可能越权改公共模块 | FILE_OWNERSHIP + REQUESTS + 治理脚本 |
| R-003 | 低 | Playwright 浏览器未安装时 e2e 失败 | C7 负责安装；Gate0 不强制 e2e |
| R-004 | 低 | Antd/React 大版本 API 差异 | 锁定 package.json；C1 统一封装 |
| R-005 | 低 | LocalStorage 结构升级导致旧数据不兼容 | key 带版本；提供 reset |
| R-008 | 低 | `PROJECT_STATUS_LABEL` 与 `ProjectStatus` 枚举未完全对齐 | C1 后续小修；不阻塞业务并行 |

## 观察项

- 参考图与最终信息架构若有差异，以 C0 决策与 DATA_CONTRACTS 为准
- 业务页实现时需统一空/载/错三态，避免各自发挥
