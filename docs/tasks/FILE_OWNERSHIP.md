# 文件所有权 · FILE OWNERSHIP

## 强制规则

1. C2—C6 不得直接修改 `src/domain`
2. C2—C6 不得直接修改统一 Mock 主数据
3. C2—C6 不得直接修改全局路由
4. C2—C6 不得直接修改全局主题
5. 业务模块需要公共能力时，提交 REQUESTS
6. C0 指派 C1 修改公共模块
7. 禁止多个线程同时重构同一文件
8. 页面内专用组件放在自己的 components 目录
9. 公共组件只有确认会被两个以上模块使用时才进入 common
10. SHARED_MEMORY 只允许 C0 修改

## 目录所有权矩阵

| 路径 | 所有者 | 其他人 |
|---|---|---|
| `docs/memory/SHARED_MEMORY.md` | C0 | 只读 |
| `docs/memory/*` | C0 | 只读（可提 REQUESTS） |
| `docs/agents/*` | C0 | 只读 |
| `docs/prompts/*` | C0 | 只读 |
| `docs/threads/C{n}/*` | C{n} | 只读 |
| `docs/tasks/*` | C0（DEMO_CHECKLIST 可由 C7 更新） | 限制写 |
| `src/app` `src/layouts` `src/design` | C1 | REQUESTS |
| `src/domain` `src/stores` `src/services` `src/mocks` | C1 / C0 | REQUESTS |
| `src/components/common` | C1 | REQUESTS |
| `src/pages/dashboard` `brief` + `components/project` | C2 | 禁止 |
| `src/pages/brand-brain` + `components/brand` | C3 | 禁止 |
| `src/pages/script-editor` + `components/script` | C4 | 禁止 |
| `src/pages/storyboard` + `components/storyboard` | C5 | 禁止 |
| `src/pages/rough-cut` + `components/media` | C6 | 禁止 |
| `src/tests` `tests` | C1/C7 | 协同 |
| `UI/**` | 资产只读 | 禁止修改 |

## 冲突处理

1. 发现冲突 → 停手
2. 写 REQUESTS
3. C0 裁决
4. 记录到 DECISIONS
