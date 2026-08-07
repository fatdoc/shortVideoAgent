# A-BIZ-01.1 · 009B Project Assignment 显式回填 Runner 计划

日期：2026-08-07
状态：`PLAN_FROZEN / READY_FOR_TEST_FIRST_RED`
基线：`dev/business-plane@22736f9`
上游合同：`A_BIZ_01_1_009_PROJECT_ASSIGNMENT_PLAN.md`

## 1. 目标

在 009A 已建立的 Project Assignment Schema 上，实现一个只接受受控 JSON manifest 的运维 runner。Runner 不扫描历史用户或项目，不推断授权，不修改 Auth Session 或 Project Policy，只把已批准的显式 Membership/Project 对原子写入不可变回填证据和 Assignment。

## 2. 文件与调用边界

新增：

```text
apps/control-api/src/projects/projectAssignmentBackfill.ts
apps/control-api/src/projects/projectAssignmentBackfillCli.ts
apps/control-api/src/projects/projectAssignmentBackfill.postgres.test.ts
```

更新：

```text
apps/control-api/package.json
apps/control-api/package-lock.json（仅 npm script 元数据如实际产生变化）
```

CLI：

```text
PROJECT_ASSIGNMENT_MANIFEST_PATH=/secure/path/manifest.json \
  npm --prefix apps/control-api run project-assignment:backfill
```

边界：

- 只从显式文件路径读取 UTF-8 JSON；
- 缺少路径、空文件、非法 JSON 或 Schema 不合法时 fail closed；
- 不从 stdin、数据库、邮箱、项目名或 Demo 默认值生成 manifest；
- CLI 成功只输出安全结果；失败只输出通用错误，不打印原始 manifest、Zod issues、数据库连接或客户标识明细。

## 3. Manifest Schema

```text
manifestVersion: literal 1
manifestId: trim 后 1..200 字符
 tenantId: uuid
approvedByUserId: uuid
assignments: 非空数组
  membershipId: uuid
  projectId: uuid
  accessLevel: viewer | editor
```

顶层和 Assignment 对象均使用 Zod `.strict()`；未知字段拒绝。`membershipId + projectId` 重复 pair 拒绝，即使 accessLevel 不同也不能重复。

## 4. Canonical Digest

Digest 输入为规范化业务载荷：

```text
manifestVersion
tenantId
approvedByUserId
assignments（按 membershipId、projectId、accessLevel 排序）
```

`manifestId` 是独立幂等标识，不参与 digest。所有对象键按字典序 canonical JSON，最终格式：

```text
sha256:<64 lowercase hex>
```

因此：

- 同 ID + 同 payload：同 digest，返回 replay；
- 同 ID + 不同 payload：digest 不同，拒绝 ID 冲突；
- 不同 ID + 同 payload：digest 相同，拒绝 digest 被另一 ID 复用；
- assignments 仅顺序不同：视为同一 payload。

## 5. Runner API

核心模块导出：

```text
parseProjectAssignmentManifest(input: unknown): ProjectAssignmentManifest
projectAssignmentManifestDigest(manifest): string
runProjectAssignmentBackfill(database, input, options?): Promise<Result>
```

安全结果：

```text
manifestId
manifestDigest
assignmentCount
replay: boolean
```

可注入 logger 只接收上述结果和固定 event 名，不接收原始 manifest 或 Error 对象。

## 6. 单事务算法

1. 严格解析、规范化并拒绝重复 pair；
2. 计算 digest；
3. 开启 Knex/PostgreSQL transaction；
4. 对 manifest ID 和 digest 对应幂等键加事务级串行保护；
5. 查询既有 backfill run：
   - ID + digest 同时匹配：返回 replay，不重复写入；
   - 同 ID 不同 digest：拒绝；
   - 同 digest 不同 ID：拒绝；
6. 验证 Tenant/Organization 为 active TENANT；
7. 验证 `approvedByUserId` 在该 Organization 有 active `tenant_admin` Membership；
8. 验证每个目标 Membership 属于同 Organization、status active 且角色集合包含 `content_operator`；
9. 验证每个 Project 属于 manifest Tenant；
10. 生成一个 backfill run UUID 和每条 Assignment UUID；
11. 同事务插入 backfill run 与所有 `pilot_backfill` Assignment；
12. 返回安全结果；任一步失败则 run 与 assignments 全部回滚。

数据库 009A trigger/FK 是第二层保护，Runner 不绕过或关闭约束。

## 7. 错误与日志合同

核心错误使用稳定 code，不包含邮箱、Token、密码、内容正文或整份 manifest：

```text
MANIFEST_INVALID
MANIFEST_ID_CONFLICT
MANIFEST_DIGEST_CONFLICT
TENANT_INVALID
APPROVER_UNAUTHORIZED
ASSIGNMENT_TARGET_INVALID
PROJECT_INVALID
```

CLI：

- 成功：输出固定 event + 安全结果；
- 失败：输出固定通用中文消息并设置非零退出码；
- 不输出 Zod issue payload、SQL、连接串或堆栈。

## 8. Test-first RED

PostgreSQL 测试至少覆盖：

1. 合法 manifest 原子写入一个 run 和全部 Assignment，created_by/source/scope 正确；
2. 同 manifest replay 不新增行，assignments 顺序变化仍得到同 digest；
3. 同 ID 不同 payload、不同 ID 同 digest、未知字段和重复 pair 拒绝；
4. 非 active tenant_admin 批准人拒绝且零写入；
5. 跨 Tenant、inactive/错误 Role Membership、未知或跨 Tenant Project 拒绝且零部分写入；
6. 缺少 manifest、非法 JSON/Schema fail closed，日志与返回不泄漏邮箱、Token、密码或内容正文；
7. 并发或顺序 replay 不产生重复 Assignment。

先建立测试并以未实现 module/runner 的明确失败确认 RED；不得用跳过测试或空 catch 伪造 RED。

## 9. Gate 与提交

必须通过：

- 009B 定向 PostgreSQL；
- Control API 完整 PostgreSQL 单 worker Gate；
- Control API typecheck、build；
- 009B 新文件定向 ESLint；
- Governance；
- `git diff --check`；
- StoryCanvas tracked diff 为零。

009B 实现、测试、npm script 和 C0 记忆形成一个独立 `feat(control-api)` 提交。禁止 `git add .`，始终排除 `apps/storycanvas/data/vendor/byteplus.ts`。

## 10. 明确不做

- 不提交真实 Pilot manifest 或客户 UUID 清单；
- 不自动扫描/回填 Tenant 全项目；
- 不修改 migration 009A 的历史语义；
- 不切换 Auth、SessionActor、Project Router/Repository 或 Production；
- 不实现一般管理后台 Assignment CRUD；
- 不修改 StoryCanvas；
- 不扩真实认证、支付、价格、代理层级或佣金能力。
