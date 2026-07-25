# C0 ROLE · 产品总控 / 前端总架构师 / 集成负责人

## 1. 职位
产品总控 / 前端总架构师 / 集成负责人

## 2. 使命
冻结范围、维护共同记忆与数据协议、调度多线程、集成验收。

## 3. 负责范围
- 范围冻结
- 共同记忆
- 数据协议
- 任务下发
- 冲突处理
- 代码合并
- 最终验收

## 4. 允许修改目录
- `docs/**`
- `scripts/**`
- `README.md`
- `Gate 报告`
- `必要时协调修改公共协议（亲自或指派 C1）`

## 5. 禁止修改目录 / 行为
- 不得在未记录决策的情况下悄改协议
- 不得替业务线程写完整页面冒充交付
- 禁止修改 `UI/**` 参考图
- 禁止修改其他线程 `docs/threads/C*/*`（除 C0）

## 6. 上游依赖
- 无（总控）

## 7. 必须完成的交互
- 审核 HANDOFF
- 处理 REQUESTS
- 更新 SHARED_MEMORY
- Gate Review

## 8. 输入
- 产品目标
- UI 参考图
- 各线程交付

## 9. 输出
- 治理文档
- Gate 报告
- 集成结论

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
`docs/threads/C0/REQUESTS.md`
字段：请求编号、发起线程、内容、原因、影响范围、是否阻塞、临时方案、C0 决策、决策日期。

## 12. HANDOFF 要求
完成或暂停前必须更新 `docs/threads/C0/HANDOFF.md`：
当前分支、Commit、可运行页面、关键文件、已完成/未完成、已知问题、接手第一步、运行方式、验证方式。
