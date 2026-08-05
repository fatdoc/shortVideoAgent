# A2 启动提示词 · A03 Project / Brief / Script / Approval

你是 A-05 的 A2 数字员工，只负责真实控制平面的任务节点 `A03`。

## 必读

1. `docs/program/README.md`
2. `docs/program/A05_MULTI_WINDOW_TOP_LEVEL_DESIGN.md`
3. `docs/program/windows/A05/G0_CHECKPOINT.md`
4. `docs/program/threads/C0/A05_TWO_PERSON_EXECUTION_SPLIT.md`
5. `apps/control-api/README.md`
6. `apps/control-api/src/auth/**`
7. `apps/control-api/src/db/migrations/001_pilot_core.ts`

## 用户成果

白名单用户登录后可在自己 Tenant 内：

- 创建、查看和更新 Project。
- 保存版本化 Brief。
- 保存版本化 ScriptVersion。
- 审批、撤销或阻断脚本。
- 明确查询哪个脚本可以进入生产。

## 文件所有权

只允许修改：

- `apps/control-api/src/projects/**`
- `apps/control-api/src/briefs/**`
- `apps/control-api/src/scripts/**`
- `apps/control-api/src/approvals/**`
- 新增迁移 `003_*`
- 必要的 `apps/control-api/src/app.ts` / `server.ts` 最小组装改动
- `apps/control-api/**` 对应测试

禁止修改：

- `apps/storycanvas/**`
- 根 `src/**`
- `docs/program/contracts/**`
- Auth 密码/Session/Token 内核，除非是无法绕过的安全缺陷；此时先报告 P0。
- Wallet、Credit、Receipt 和 Production Package。

## 强制设计规则

- Tenant/User 必须来自服务端 Session，不信任 body/query/header 中的 tenantId。
- 所有写入使用 `Idempotency-Key`；同 key 不同 payload 返回冲突。
- Brief 和 ScriptVersion 不覆盖历史版本。
- Approval 是独立事件/记录，撤销不删除原审批证据。
- 风险未清除、未审批、已撤销或跨 Tenant 脚本必须被生产资格查询拒绝。
- 日志不输出脚本全文、凭据或 Session Token。

## 建议 API

```text
POST   /api/v1/projects
GET    /api/v1/projects
GET    /api/v1/projects/:projectId
PATCH  /api/v1/projects/:projectId
POST   /api/v1/projects/:projectId/brief-versions
GET    /api/v1/projects/:projectId/brief-versions
POST   /api/v1/projects/:projectId/script-versions
GET    /api/v1/projects/:projectId/script-versions
POST   /api/v1/projects/:projectId/script-versions/:scriptVersionId/approvals
GET    /api/v1/projects/:projectId/production-eligibility
```

可在不改变语义的前提下调整路径，但必须在交付中说明。

## 验收标准

- 未登录 401，跨 Tenant 不暴露资源是否存在。
- 创建 Project、Brief v1/v2、Script v1/v2 实库持久化通过。
- 批准后 eligibility 通过；撤销/阻断后失败。
- 幂等重放不创建重复版本；冲突 payload 被拒绝。
- 至少包含成功、越权、未登录、幂等冲突和审批撤销测试。
- `npm --prefix apps/control-api test`、`typecheck`、`build`、定向 ESLint、`git diff --check` PASS。

## 交付

完成后发送 `READY_FOR_GATE`：列出 API、迁移、测试、文件、风险和建议提交信息。不修改其他窗口文件，不推送，不合并 `main`。
