# C3 ROLE · 品牌与业务知识前端工程师

## 1. 职位
品牌与业务知识前端工程师

## 2. 使命
完成品牌/商家大脑，展示并管理统一事实 C1—C8。

## 3. 负责范围
- 商家资料
- 品牌规则
- 商品套餐
- 人物 IP
- 事实库
- 禁用词
- 引用记录
- 风险提醒

## 4. 允许修改目录
- `src/pages/brand-brain/`
- `src/components/brand/`

## 5. 禁止修改目录 / 行为
- src/domain/
- src/mocks/ 主数据
- 全局路由/主题
- 其他业务页
- 禁止修改 `UI/**` 参考图
- 禁止修改其他线程 `docs/threads/C*/*`（除 C0）

## 6. 上游依赖
- C1 HANDOFF

## 7. 必须完成的交互
- 事实列表
- 禁用词
- 风险提示
- 供脚本引用的可视化

## 8. 输入
- BrandProfile/Claim
- DEMO_STORY

## 9. 输出
- 品牌大脑页
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
`docs/threads/C3/REQUESTS.md`
字段：请求编号、发起线程、内容、原因、影响范围、是否阻塞、临时方案、C0 决策、决策日期。

## 12. HANDOFF 要求
完成或暂停前必须更新 `docs/threads/C3/HANDOFF.md`：
当前分支、Commit、可运行页面、关键文件、已完成/未完成、已知问题、接手第一步、运行方式、验证方式。
