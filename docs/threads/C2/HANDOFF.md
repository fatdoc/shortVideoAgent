# C2 HANDOFF

- 当前分支：`codex/c2-visual-polish-dashboard-brief`
- 当前 Commit：本轮提交后回填
- 功能 Commit：本轮提交后回填
- 验收结论：`QA_PASSED / READY_FOR_C0_REVIEW`
- Merge Commit：待入`integration`后补充
- 可运行页面：
  - `/dashboard`
  - `/projects/new`
- 关键文件：
  - `src/pages/dashboard/DashboardPage.tsx`
  - `src/pages/brief/BriefPage.tsx`
  - `src/components/project/*`
  - 两页同目录测试与 `src/components/project/project-workflow.css`
- 已完成功能：
  - Dashboard：5 个 KPI、5 行本地演示项目、待办、七步流程、本周数据、生成记录与类型分布完成参考图密度对齐
  - Brief：五步步骤条、图片业务卡、双列表单、平台/比例、3x2 真实缩略图、摘要/缺失项/AI 建议和主 CTA 同屏
  - Brief 顶部与底部主 CTA 均进入脚本；品牌/商家大脑不再是 Brief 的下一步
  - Dashboard 流程为 `Brief → 脚本 → 分镜 → 素材 → 初剪 → 审核 → 导出`
  - 保持 mock 素材上传 + AI 建议 + 缺失项提醒，原交互不变
  - 保存走 `setBrief`，写入 LocalStorage；可进入品牌大脑或脚本
  - loading / empty / error / disabled 与保存失败不跳页
- 不在本阶段范围：
  - 真实后端多项目列表与真实素材上传（明确不做；本轮使用明确标注的本地演示案例）
  - 公共 `src/tests/app.smoke.test.tsx` 已由 C0 升级（REQ-C2-001 已关闭）
- 已知问题：
  - 主包体积仍较大（延续 R-006）
  - `1440x900` 允许纵向滚动；Dashboard 与 Brief 均无横向溢出，Brief 主 CTA 首屏可见
- 接手后的第一步：
  1. 以 `integration` 复核本轮视觉改造与截图要求
  2. 若后续引入真实素材来源，接入 Brief `simulateUpload` 可复用候选素材映射
- 运行方式：`npm install && npm run dev`
- 验证方式：`npm run lint && npm run build && npm run test -- --maxWorkers=1 && npm run validate:governance`
- 视觉 QA：`docs/threads/C2/DESIGN_QA.md`
- 证据目录：`docs/threads/C2/evidence/`

## Commit Hash

- 本轮提交后回填
