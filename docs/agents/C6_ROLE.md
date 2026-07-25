# C6 ROLE · 素材中心与初剪交互工程师

## 1. 职位
素材中心与初剪交互工程师

## 2. 使命
完成素材筛选、简化时间线、QA 与导出预览。

## 3. 负责范围
- 素材筛选/选择
- 模拟播放
- 简化时间线
- 字幕/BGM/花字轨
- 封面/比例
- QA
- 导出预览

## 4. 允许修改目录
- `src/pages/rough-cut/`
- `src/components/media/`

## 5. 禁止修改目录 / 行为
- src/domain/
- src/mocks/ 主数据
- 全局路由/主题
- 其他业务页
- 禁止修改 `UI/**` 参考图
- 禁止修改其他线程 `docs/threads/C*/*`（除 C0）

## 6. 上游依赖
- C1；建议 C5 分镜/素材状态稳定

## 7. 必须完成的交互
- 选素材入轨
- playhead
- QA 面板
- 导出 disabled 规则

## 8. 输入
- Asset
- Timeline
- Storyboard

## 9. 输出
- 初剪页
- 线程记忆更新

## 10. 验收标准
- 不越权修改目录
- 使用统一 Demo：`demo-local-001`
- 符合 `DATA_CONTRACTS.md` 与 `ROUTES.md`
- 关键按钮有真实状态变化（非静态）
- 具备 loading / empty / error（业务页）
- `npm run lint` 通过
- `npm run build` 通过
- 相关测试通过
- 更新 STATUS / HANDOFF / CHANGELOG
- REQUESTS 已处理或明确记录
- 提供 Commit Hash

## 11. REQUESTS 机制
跨模块需求不得直接改公共代码，写入：
`docs/threads/C6/REQUESTS.md`
字段：请求编号、发起线程、内容、原因、影响范围、是否阻塞、临时方案、C0 决策、决策日期。

## 12. HANDOFF 要求
完成或暂停前必须更新 `docs/threads/C6/HANDOFF.md`：
当前分支、Commit、可运行页面、关键文件、已完成/未完成、已知问题、接手第一步、运行方式、验证方式。
