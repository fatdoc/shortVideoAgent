# C1 HANDOFF

- 当前分支：`feat/c1-foundation`
- 当前 Commit：8432b6b0c71cb2b7746e5b5c544e8aa1aebcac14
- 可运行页面：
  - `/dashboard`
  - `/projects/new`
  - `/projects/demo-local-001/brand`
  - `/projects/demo-local-001/script`
  - `/projects/demo-local-001/storyboard`
  - `/projects/demo-local-001/rough-cut`
  - `*` NotFound
- 关键文件：
  - `src/app/*`
  - `src/layouts/*`
  - `src/design/*`
  - `src/components/common/*`
  - `src/domain/*`
  - `src/stores/projectStore.ts`
  - `src/services/mockApi.ts` / `storage.ts`
  - `src/tests/*`
- 已完成功能：
  - 前端基座可启动，六路由可访问
  - 统一 Demo：`demo-local-001`（C1—C8 / 分镜 01—08）
  - store hydrate / setBrief / updateBrand / setActiveScript / updateScript / updateStoryboard / updateTimeline / reset
  - LocalStorage key：`videoagent:mvp:v1`
  - 公共三态 + ErrorBoundary + StatusTag
  - Topbar「重置 Demo」有 loading + message 反馈
  - 占位页展示 Demo 指标，并提供跨路由与脚本切换验证按钮
- 未完成功能：
  - 六个业务页完整交互（C2—C6）
  - Antd 体积拆分优化（已知非阻塞风险 R-006）
  - Playwright e2e 实跑（C7）
- 已知问题：
  - 生产包体积较大（Antd 全量），不阻塞 Gate 1
  - 业务页仍为占位，符合 Gate 1 范围
- 接手后的第一步：
  1. `git checkout feat/c1-foundation && npm install && npm run dev`
  2. 侧栏走通六路由，确认 Demo 指标与重置按钮
  3. C0 做 Gate 1 Review 后启动 C2/C3/C4
- 运行方式：`npm install && npm run dev`
- 验证方式：`npm run lint && npm run build && npm run test && npm run validate:governance`

## Commit Hash

- 
