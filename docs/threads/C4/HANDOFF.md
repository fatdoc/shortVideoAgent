# C4 HANDOFF

- 当前分支：`feat/c4-script-editor`
- 当前 Commit：`6f1cf3e0b5a68f328ef137896f15680a865e654a`（功能提交；若其后有 docs pin 提交，以 `git log -1` 为准）
- 可运行页面：
  - `/projects/demo-local-001/script`（完整脚本编辑器）
- 关键文件：
  - `src/pages/script-editor/ScriptEditorPage.tsx`
  - `src/pages/script-editor/ScriptEditorPage.test.tsx`
  - `src/components/script/*`（VersionTabs / BlockEditor / ClaimPanel / ScorePanel / RiskPanel / helpers / css）
- 已完成功能：
  - 左栏 A/B/C 版本切换，写入 `activeScriptId`
  - 中栏五段脚本编辑（文案 / 时长 / 引用 / 评论）
  - 右栏可说性评分、风险列表、事实库 C1—C8
  - Mock 生成（约 900ms loading）后进入未保存草稿
  - 保存走 `updateScript`，持久化 LocalStorage
  - 「进入分镜」若有脏数据先保存再跳转 `/projects/demo-local-001/storyboard`
- 未完成功能：
  - 真实大模型生成（明确不做）
  - 与 C5 分镜页的深度字段映射（C5 范围）
  - 最终视觉精修（非阻塞）
- 已知问题：
  - 可说性评分 / 风险为前端启发式，非后端合规引擎
  - 切换版本时若有未保存修改会 `window.confirm` 丢弃草稿
  - 并行线程若共享同一工作区目录，可能互相覆盖未提交文件（已只提交 C4 目录）
- 接手后的第一步：
  1. `git checkout feat/c4-script-editor && npm install && npm run dev`
  2. 打开 `/projects/demo-local-001/script`，切换 A/B/C，编辑并保存，Mock 生成，点进入分镜
  3. C0 做 Gate Review 后合入 `integration`
- 运行方式：`npm install && npm run dev`
- 验证方式：`npm run lint && npm run build && npm run test && npm run validate:governance`

## Commit Hash

- feature：`6f1cf3e0b5a68f328ef137896f15680a865e654a`
