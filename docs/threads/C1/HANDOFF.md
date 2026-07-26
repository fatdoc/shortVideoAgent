# C1 HANDOFF

- 当前分支：`HEAD (detached)`，Gate 2 基线 `1b06bf8`
- 实现 Commit：`待生成（提交后由文档闭环提交回填）`
- 可运行页面：
  - `/dashboard`
  - `/projects/new`
  - `/projects/demo-local-001/brand`
  - `/projects/demo-local-001/script`
  - `/projects/demo-local-001/storyboard`
  - `/projects/demo-local-001/rough-cut`
  - `*` NotFound
- 关键文件：
  - `src/layouts/AppShell.tsx`
  - `src/layouts/Sidebar.tsx`
  - `src/layouts/Topbar.tsx`
  - `src/design/tokens.ts`
  - `src/design/theme.ts`
  - `src/design/global.css`
  - `docs/threads/C1/screenshots/*`
- 已完成功能：
  - 正确保留此前 Spark 产出的浅色方向、token 化与壳层结构
  - `Sidebar` 对齐参考图的浅色 208px 导航、68px 品牌区、蓝色选中态
  - `Topbar` 对齐全局搜索、团队、重置、帮助、通知、用户区；移除重复页面标题与拥挤项目标签
  - `global.css / tokens / theme` 统一 16px 页面边距、10px 卡片圆角、轻边框/阴影和紧凑字号
  - 恢复 Gate 2 菜单可访问名称与 smoke 文案契约，不改变路由、Store、LocalStorage
  - 移除全局隐藏 Dashboard 项目 ID Tag 的历史规则，e2e 可见项目 ID
  - 六个主路由可连续导航，Dashboard / Brief / Brand / Script 可用于老板讲解完整前半程
- 未完成功能：
  - 参考图中的业务页具体内容、列数与模块构成不在 C1 授权范围，继续由 C2—C6 负责
- 已知问题：
  - 生产包约 1.29MB，Vite 保留 chunk size warning
  - 默认并行 Vitest 在当前资源环境曾有 5 个超时；`--maxWorkers=1` 全量 43/43 通过
- 接手后的第一步：
  1. 查看实现 Commit 与本文件截图哈希
  2. 以 1672×941 对照 `UI/` 原图检查全局壳层
  3. 以 1440×900 检查无横向裁切
- 运行方式：`npm install && npm run dev -- --host 127.0.0.1`
- 验证方式：
  - `npm run lint`
  - `npm run build`
  - `npm run test -- --maxWorkers=1`
  - `npm run validate:governance`

## 真浏览器复核

- 1672×941：四页 document `1672 / 1672`，Topbar `1464 / 1464`，内容页宽 1432
- 1440×900：四页 document `1440 / 1440`，Topbar `1232 / 1232`，内容页宽 1200
- 浏览器控制台：0 error / warning
- 与原图已对齐：浅色侧栏、顶部搜索/团队/通知/用户、紧凑信息密度、白卡轻边框/圆角/阴影
- 保留差异：业务页内部模块和案例内容仍采用 Gate 2 实现，本次未越权修改 C2—C6 页面
- 演示口径：本轮目标是前端 Demo 顺畅讲清流程，不声明真实后端、真实 AI 或真实视频生成能力

| 页面 | 视口 | 截图路径 | SHA-256 |
|---|---:|---|---|
| Dashboard | 1672×941 | `docs/threads/C1/screenshots/dashboard-1672x941.png` | `c4eae73ec017f7660fc34b9065886d69d0079a0cf6ac5be3ed694b51d1ed5022` |
| Dashboard | 1440×900 | `docs/threads/C1/screenshots/dashboard-1440x900.png` | `ca17782b65d2159256b58ba74ba4e0d77c0b74c1ce4c56942dfa56345afe6916` |
| Brief | 1672×941 | `docs/threads/C1/screenshots/brief-1672x941.png` | `2943f487f33fb6c5039249eb57813e5409cae5f65a14b6673239ef36087f5890` |
| Brief | 1440×900 | `docs/threads/C1/screenshots/brief-1440x900.png` | `5b557c6455aa6f5285c7ff907d7497d75d8f150838e7c660b1e41c6c99a7160e` |
| Brand | 1672×941 | `docs/threads/C1/screenshots/brand-1672x941.png` | `fadef8f55a3f9cf95bf2fa889a6162ba5855c019341d2d703e0b16bc47243178` |
| Brand | 1440×900 | `docs/threads/C1/screenshots/brand-1440x900.png` | `d2ee43307a71ea38ebec3173e87f70ee1999de098c2dd0cdf7eafb40fd72806c` |
| Script | 1672×941 | `docs/threads/C1/screenshots/script-1672x941.png` | `8833fe49f6b4d1b6229b164a8f77a4cd9bdfef76656c8c23d5f97881bfa550f8` |
| Script | 1440×900 | `docs/threads/C1/screenshots/script-1440x900.png` | `0275d97d4c2b454e910fd72a9cc277fffbdabcdca5a8c63832f5807a29d48cc4` |

## Commit Hash

- 实现 Commit：`待生成（提交后由文档闭环提交回填）`
