# 前端架构 · ARCHITECTURE

## 总览

```
UI (Ant Design)
  └── pages/*（业务页面，C2—C6）
        └── components/{domain}（页面专用组件）
              └── components/common（公共组件，C1）
                    └── stores + services + mocks（状态与 Mock，C1）
                          └── domain（类型与常量，C0/C1 冻结）
```

## 目录职责

| 目录 | 职责 | 所有者 |
|---|---|---|
| `src/app` | App / Router / Providers | C1 |
| `src/layouts` | AppShell / Sidebar / Topbar | C1 |
| `src/design` | tokens / theme / global css | C1 |
| `src/domain` | 类型与常量 | C0/C1 |
| `src/stores` | Zustand | C1 |
| `src/services` | Mock API / storage | C1 |
| `src/mocks` | 统一 Demo 数据 | C1 |
| `src/components/common` | 公共 UI 状态组件 | C1 |
| `src/pages/*` | 业务页 | C2—C6 |
| `src/tests` | 单测 | C1/C7 |
| `tests/e2e` | E2E | C7 |

## 状态策略

- 单一 `DemoWorkspace` 作为工作区快照
- Zustand 内存态 + LocalStorage 持久化
- 所有写操作经 `mockApi` 延迟模拟

## 路由策略

- React Router v7
- AppShell 布局路由
- 业务路由见 `ROUTES.md`

## 样式策略

- Ant Design ConfigProvider 主题
- Design tokens 在 `src/design/tokens.ts`
- 页面级少写自定义 CSS，优先 Antd 组件

## 测试策略

- Vitest + RTL：domain / smoke
- Playwright：主流程（Wave 4 / C7）

## 扩展原则

1. 先协议，后页面
2. 先公共，后业务
3. 业务不复制 Mock 主数据
4. 跨模块只提 REQUESTS，不直接改公共层
