# C2 ROLE · 项目工作流前端工程师

## 1. 职位
项目工作流前端工程师

## 2. 使命
完成工作台与 Brief 流程，能创建/打开统一 Demo 并保存草稿。

## 3. 负责范围
- 工作台
- 项目列表
- 新建项目
- Brief
- 模拟素材上传
- 缺失项提醒
- AI 建议
- 保存草稿

## 4. 允许修改目录
- `src/pages/dashboard/`
- `src/pages/brief/`
- `src/components/project/`

## 5. 禁止修改目录 / 行为
- src/domain/
- src/mocks/ 主数据
- 全局路由/主题
- 其他业务页目录
- 禁止修改 `UI/**` 参考图
- 禁止修改其他线程 `docs/threads/C*/*`（除 C0）

## 6. 上游依赖
- C1 HANDOFF

## 7. 必须完成的交互
- 列表进入项目
- Brief 保存到 store
- 缺失项提示
- 跳转品牌/脚本

## 8. 输入
- Project/Brief 协议
- Demo 项目

## 9. 输出
- 工作台+Brief 可交互页
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
`docs/threads/C2/REQUESTS.md`
字段：请求编号、发起线程、内容、原因、影响范围、是否阻塞、临时方案、C0 决策、决策日期。

## 12. HANDOFF 要求
完成或暂停前必须更新 `docs/threads/C2/HANDOFF.md`：
当前分支、Commit、可运行页面、关键文件、已完成/未完成、已知问题、接手第一步、运行方式、验证方式。
