# C2 HANDOFF

- 当前分支：`feat/c2-dashboard-brief`
- 当前 Commit：`7360286e4a3282d721dc23b0c2cd462d657b24f6`
- 功能 Commit：`7360286e4a3282d721dc23b0c2cd462d657b24f6`
- 可运行页面：
  - `/dashboard`
  - `/projects/new`
- 关键文件：
  - `src/pages/dashboard/DashboardPage.tsx`
  - `src/pages/brief/BriefPage.tsx`
  - `src/components/project/*`
  - 两页同目录测试
- 已完成功能：
  - Dashboard：统一 Demo KPI、项目搜索/筛选、进度、负责人、待办、生产流程
  - Brief：业务类型、商家/地址、平台/规格、受众、CTA、素材与内容约束
  - Mock 素材上传 + AI 建议 + 缺失项实时提醒
  - 保存走 `setBrief`，写入 LocalStorage；可进入品牌大脑或脚本
  - loading / empty / error / disabled 与保存失败不跳页
- 未完成功能：
  - 多项目真实列表与真实素材上传（明确不做）
  - 公共 `src/tests/app.smoke.test.tsx` 升级由 C0 在 integration 处理（REQ-C2-001）
- 已知问题：
  - 全量测试中的 4 个 Gate1 placeholder smoke 断言需随业务页升级；C2 自有 4 项测试通过
  - 主包约 1.06MB，延续 R-006，不阻塞 Gate2
- 接手后的第一步：
  1. 打开 `/dashboard` 检查项目行、筛选、待办和生产流程
  2. 打开 `/projects/new` 编辑 CTA / 素材 / AI 建议并保存
  3. C0 合入 integration 后更新公共 smoke，再执行 Gate2 全量
- 运行方式：`npm install && npm run dev`
- 验证方式：`npm run lint && npm run build && npm run test -- src/pages/dashboard/DashboardPage.test.tsx src/pages/brief/BriefPage.test.tsx`

## Commit Hash

- `7360286e4a3282d721dc23b0c2cd462d657b24f6`
