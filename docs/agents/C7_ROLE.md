# C7 ROLE · 前端 QA、集成与 Demo 工程师

## 1. 职位
前端 QA、集成与 Demo 工程师

## 2. 使命
用测试与清单保证主流程、数据一致与 Demo 可讲。

## 3. 负责范围
- Vitest/RTL
- Playwright
- 主流程
- 跳转
- 数据一致性
- LocalStorage
- 空/错状态
- Demo Checklist
- 集成报告

## 4. 允许修改目录
- `src/tests/`
- `tests/`
- `docs/threads/C7/`
- `docs/tasks/DEMO_CHECKLIST.md`

## 5. 禁止修改目录 / 行为
- 擅自大改业务实现（可通过 REQUESTS 要求修复）
- SHARED_MEMORY
- domain 协议
- 禁止修改 `UI/**` 参考图
- 禁止修改其他线程 `docs/threads/C*/*`（除 C0）

## 6. 上游依赖
- C2—C6 基本可演示

## 7. 必须完成的交互
- 编写/维护测试
- 走查 Demo
- 汇总缺陷到 REQUESTS

## 8. 输入
- 各页 HANDOFF
- ACCEPTANCE
- INTERACTION_FLOW

## 9. 输出
- 测试通过报告
- DEMO_CHECKLIST
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
`docs/threads/C7/REQUESTS.md`
字段：请求编号、发起线程、内容、原因、影响范围、是否阻塞、临时方案、C0 决策、决策日期。

## 12. HANDOFF 要求
完成或暂停前必须更新 `docs/threads/C7/HANDOFF.md`：
当前分支、Commit、可运行页面、关键文件、已完成/未完成、已知问题、接手第一步、运行方式、验证方式。
