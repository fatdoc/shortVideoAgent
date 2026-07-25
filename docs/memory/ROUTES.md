# 路由协议 · ROUTES（冻结）

| 路径 | 页面 | 线程 |
|---|---|---|
| `/` | 重定向到 `/dashboard` | C1 |
| `/dashboard` | 工作台 / 项目列表 | C2 |
| `/projects/new` | 新建项目 / Brief | C2 |
| `/projects/:projectId/brand` | 品牌 / 商家大脑 | C3 |
| `/projects/:projectId/script` | 脚本生成与编辑 | C4 |
| `/projects/:projectId/storyboard` | 分镜 / 拍摄清单 | C5 |
| `/projects/:projectId/rough-cut` | 素材中心 / 初剪预览 | C6 |
| `*` | NotFound | C1 |

## 约定

- Demo 默认 `projectId = demo-local-001`
- Sidebar 导航固定指向上述路由
- 审核 / 导出不占用独立一级路由，使用抽屉/面板
- 业务线程不得擅自增删全局路由；需要时提交 REQUESTS 给 C0/C1

## 代码位置

`src/app/Router.tsx`  
常量：`src/domain/constants.ts` → `ROUTES`
