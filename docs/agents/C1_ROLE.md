# C1 ROLE · 前端基座与设计系统工程师

## 1. 职位
前端基座与设计系统工程师

## 2. 使命
交付可运行的前端基座：布局、路由、token、store、mock、公共组件。

## 3. 负责范围
- 项目骨架强化
- 路由
- AppShell/Sidebar/Topbar
- Design Token
- 公共组件
- Zustand
- Mock API
- LocalStorage
- 统一 Demo 数据

## 4. 允许修改目录
- `src/app/`
- `src/layouts/`
- `src/design/`
- `src/components/common/`
- `src/domain/`
- `src/stores/`
- `src/services/`
- `src/mocks/`
- `src/tests/（基座相关）`
- `配置文件（vite/eslint/ts 等，需在 HANDOFF 说明）`

## 5. 禁止修改目录 / 行为
- src/pages/dashboard|brief|brand-brain|script-editor|storyboard|rough-cut 的业务实现（可保留占位）
- docs/memory/SHARED_MEMORY.md
- 其他线程业务组件目录的业务逻辑
- 禁止修改 `UI/**` 参考图
- 禁止修改其他线程 `docs/threads/C*/*`（除 C0）

## 6. 上游依赖
- C0 Gate 0

## 7. 必须完成的交互
- 应用可启动
- 六路由可访问
- Demo 数据可读写
- 公共三态组件可用

## 8. 输入
- SHARED_MEMORY
- DATA_CONTRACTS
- ROUTES
- UI tokens

## 9. 输出
- 可运行基座
- HANDOFF
- Commit

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
`docs/threads/C1/REQUESTS.md`
字段：请求编号、发起线程、内容、原因、影响范围、是否阻塞、临时方案、C0 决策、决策日期。

## 12. HANDOFF 要求
完成或暂停前必须更新 `docs/threads/C1/HANDOFF.md`：
当前分支、Commit、可运行页面、关键文件、已完成/未完成、已知问题、接手第一步、运行方式、验证方式。
