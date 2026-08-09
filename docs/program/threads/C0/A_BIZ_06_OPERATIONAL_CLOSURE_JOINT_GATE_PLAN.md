# A-BIZ-06 · Operational Closure & A/B Joint Gate 计划

- 日期：2026-08-09
- 负责人：工程师 A（业务平台）
- 分支：`dev/business-plane`
- 状态：`06B_COMPLETE / READY_FOR_06C_PLANNING`
- 上游计划：`A_BIZ_LATEST_MAIN_PLAN_2026-08-06.md`、`A_B_CO_CREATION_SPLIT_2026-08-06.md`
- 前置提交：`69b8181 docs(business-plane): close commercial frontend audit`
- 共享同步基线：Control API Bootstrap `856757b`；Pilot Router/Layout `b80e9ef`

## 1. 本节点目标

A-BIZ-06 是 Wave 4 的运营收口与 A/B 联合 Gate，不是新商业能力扩张。目标是把已经存在的真实 Pilot 能力变成可重复验证、可安全运营、可交接的完整基线：

1. 冻结并实现确定性的 Root Joint Gate，明确必跑阶段、外部前置条件、A/B 所有权和 fail-closed 语义；
2. 补齐最小 Member Directory / Deactivation 合同，再接入 Terms、Invitation、Member 的真实 Pilot 运营页面；
3. 建立专用 PostgreSQL、确定性 bootstrap/seed 和真实 Session Cookie 的浏览器 E2E；
4. 在 B 提供可同步的干净提交后，验证 Project Context → Approved Script → Storyboard Draft → Canvas 的 A/B 黄金路径；
5. 验证 fresh database migrate → rollback → reapply，并更新 README、运营说明与 C0 交接文档；
6. 最终执行 Root、Control API PostgreSQL、跨平面合同、StoryCanvas 定向、Pilot Playwright、Build、Governance 与 diff-check 联合 Gate。

本计划不把已有 TEST 商业事实描述为正式上线，也不允许用缺少 PostgreSQL、浏览器、B 基线或外部运行条件的 `SKIP` 冒充最终 PASS。

## 2. 源码、测试与合同审计结论

### 2.1 Wave 4 权威验收范围

权威计划要求覆盖：

- 成员、邀请、须知、注册、充值、佣金的 loading、empty、error、expired、duplicate、inactive 和恢复状态；
- 未登录、越权、跨组织、幂等冲突、敏感信息泄漏和失败恢复 E2E；
- 与 B 的项目上下文、批准脚本、分镜草案和画布入口接线；
- 海底捞白名单黄金路径；
- 数据迁移/回滚、运营说明、README、STATUS、HANDOFF、CHANGELOG；
- Root、Control API PostgreSQL、合同、StoryCanvas 定向、Build、Governance、diff-check 联合 Gate。

### 2.2 当前浏览器 E2E 仍是 Demo 路径

`tests/e2e/smoke.spec.ts` 当前只验证 Demo Dashboard 和 localStorage Brief → Brand → Script 路径，没有：

- 真实 `/api/v1/auth/*` Session Cookie；
- PLATFORM / CHANNEL / TENANT 默认路由和 direct URL；
- Public Terms / Invitation Preview / Registration；
- Terms、Invitation、Member 运营页面；
- Recharge、Commission、Settlement 的 TEST-only 浏览器证据；
- 未登录、403、404、409、422、5xx、Request ID、重试和敏感字段检查。

因此 Demo smoke 不能作为 Pilot Wave 4 的替代证据，Pilot E2E 也不得以 localStorage 或 Mock Session 绕过真实认证。

### 2.3 当前 PostgreSQL 测试可静默 SKIP

Control API PostgreSQL suites 依赖 `CONTROL_API_TEST_DATABASE_URL`，并要求数据库名以 `_test` 结尾。环境变量缺失或不是专用测试库时，多数 suite 使用 `describe.runIf` / `skipIf`，默认 `npm --prefix apps/control-api test` 仍可能退出 0。

冻结决定：

- `full` Joint Gate 缺少合法专用 PostgreSQL URL 必须在执行测试前失败；
- 不得把 PostgreSQL suite 的 SKIP 计作最终 PASS；
- `--list` / `--plan` 只展示阶段与依赖，不宣称 Gate 已通过；
- 快速本地模式可以跳过外部阶段，但输出必须明确 `NOT_FULL_GATE`。

### 2.4 当前缺统一 Joint Gate 入口

根 `package.json` 有 `test`、`test:e2e`、`build` 和 `validate:governance`，但没有机器可读的 Joint Gate manifest，也没有统一 runner。现有 `tests/e2e/pilot/run-contract-gate.mjs` 只负责跨平面合同 Gate。

另外，`apps/storycanvas/package.json` 的 `test` 脚本没有覆盖全部 v0.2 runtime/security/public route 测试；联合 Gate 必须显式列出 B 已冻结的定向测试，不能错误地把普通 StoryCanvas `npm test` 当作全部 v0.2 证据。

### 2.5 已有 Terms / Invitation / Registration 合同可复用

Control API 已有：

- Public current Terms；
- Platform Terms document/version/publish/retire；
- Platform、Channel、Tenant Invitation create/list；
- Public Invitation preview 与 Invitation revoke；
- Public Registration；
- 真实 Auth Session Cookie、Organization Scope 和 Project Context。

前端尚无真实 Terms / Invitation 运营页。实现时必须扩展严格 Pilot Client，使用 `credentials: 'include'`、`cache: 'no-store'`、运行时 DTO 校验、固定安全错误文案和 Request ID；失败不得回退 Demo Store、Mock 或 localStorage。

### 2.6 Member 运营合同缺口必须先补

数据库已有 `organization_memberships`、`organization_membership_roles`、`status`、`version`，Auth Session 也会校验 active Membership 和版本，但没有冻结的 Member Directory / Deactivation HTTP。

前端不得直接推导或伪造成员目录。06B 必须先冻结并 test-first 实现最小合同：

- 当前 Organization 的 bounded Member Directory；
- 安全状态投影：active / suspended / expired；
- 当前主角色和已有角色只读投影；
- 仅允许把其他 active Membership 停用为 suspended；
- 停用时递增 Membership version，使现存 Session 在下一次校验时失效；
- 同组织授权、跨组织安全 404、同 Scope 缺角色 403、重复停用稳定幂等/冲突语义；
- 禁止删除成员、任意改角色、批量操作、重设密码、显示密码或邀请 Token。

具体 route shape、repository transaction、最后一个管理员保护和自停用策略必须在 06B 子计划中先冻结，不能由 UI 临时决定。

### 2.7 Audit Log 与“完整导出”尚无真实合同

现有业务表保留 append-only 或可审计事实，但没有统一 Audit Log / Export HTTP。冻结决定：

- 不伪造全局 Audit Log 页面；
- 不把 bounded list、浏览器内 CSV 或本地成功记录描述成“完整导出”；
- 已有 Commission Manual Review 继续只读，不新增未规划 review/approve HTTP；
- 若后续确需 Audit / Export，必须独立冻结数据范围、脱敏、分页、授权、保留期和下载审计合同。

### 2.8 A/B 黄金路径依赖 B 的可同步提交

现有合同 Gate 已覆盖 C01 v0.2、StoryCanvas v0.1/v0.2 runtime/security/receiver 边界，但没有真实浏览器黄金路径证明：

```text
Pilot Project Context
→ Approved Script Snapshot
→ Storyboard Draft / Revision
→ Production Package / Grant
→ StoryCanvas Canvas Entry
```

A 不修改 `apps/storycanvas/**`、`src/features/storycanvas/**`、Storyboard 或 Script Editor 的 B 所有文件。只有 B 提供已提交、工作树干净、可同步的基线后，06E 才能执行最终 A/B 接线和 Gate；否则状态必须保持 `WAITING_FOR_B_BASELINE`，不得宣称最终联合 Gate 通过。

### 2.9 迁移与 README 存在收口缺口

Control API 已有 migration `001`～`018`、`db:migrate` 与 `db:rollback`，但缺少 Wave 4 独立的 fresh DB forward → rollback → reapply 运营验证和安全说明。

根 README 与 `apps/control-api/README.md` 仍含部分早期描述，必须在最终收口时改成真实、审慎的 Pilot / TEST-only 状态，明确哪些能力已实现、哪些仍 fail closed，不能写成 LIVE 支付或正式结算上线。

## 3. 冻结的原子切片

### 3.1 A-BIZ-06A · Deterministic Joint Gate Contract / Manifest / Runner

交付：

- 机器可读 Gate manifest，包含稳定 phase id、owner、command、mode、precondition 和说明；
- Root CLI runner，支持 `--list` / `--plan`、快速模式和 `--full`；
- full 模式对专用 PostgreSQL URL、必要本地依赖和 B-owned phase fail closed；
- 明确 Root、Control PostgreSQL、C01 Contract、StoryCanvas v0.2 定向、Pilot Playwright、Build、Governance、diff-check；
- 根 `package.json` 增加明确脚本；
- `tests/e2e/pilot/README.md` 记录使用方式和“不等于正式上线”的语义。

边界：

- runner 不启动或修改 StoryCanvas 数据，不写 Provider 配置；
- 06A 不伪造 PostgreSQL、Playwright 或 B Gate PASS；
- 06A 不要求当前机器立即满足 full Gate 的所有外部前置条件；
- manifest/runner 自身测试通过只表示 Gate 编排合同可执行。

首个 RED：

> Joint Gate Manifest 必须包含 Root、Control PostgreSQL、C01 Contract、StoryCanvas v0.2 定向、Pilot Playwright、Build、Governance 和 diff-check；`--full` 缺少合法 `CONTROL_API_TEST_DATABASE_URL` 时必须非零退出，不能让 PostgreSQL suites 静默 SKIP 后仍宣称 PASS。

建议提交：

```text
test(operations): add deterministic joint gate runner
```

### 3.2 A-BIZ-06B · Minimal Member Directory / Deactivation Contract

先写独立子计划，再按 Migration 019 legacy shadow 加固、Repository/Service、Route、共享 Bootstrap 的顺序 test-first 实现。

必须冻结：

- Member list 的 bounded、排序、最小 DTO、状态和角色投影；
- PLATFORM / CHANNEL / TENANT 的可见范围与管理员角色；
- suspension 的事务、version bump、Session 失效、幂等和并发语义；
- legacy status-only update 必须保留 secondary roles，version 恰好 +1；
- self-suspend、last-admin、inactive Organization/Membership 的 fail-closed 行为；
- 401/403/404/409/422 与 Request ID；
- 不泄露 password hash、Session token/digest、Invitation token/digest、内部 SQL 或完整 User 认证数据。

共享 `apps/control-api/src/app.ts` / Bootstrap 改动必须独立提交并通知 B。

### 3.3 A-BIZ-06C · Terms / Invitation / Member Pilot Operations UI

按真实 Organization Scope 接入：

- Platform Terms 版本运营；
- Platform / Channel / Tenant Invitation list/create/revoke；
- 当前 Organization Member list / suspend；
- Public Invitation Preview + Registration 的真实状态闭环。

必须覆盖 loading、empty、ready、retrying、expired、revoked、exhausted、duplicate、inactive、401、403、404、409、422、5xx、invalid response 和 Request ID。

安全边界：

- Session Cookie + `no-store`；
- Pilot 失败不回退 Demo/Mock/localStorage；
- Invitation Token 只在用户明确生成后的最小一次性结果中展示，不进入日志、错误、列表或持久化；
- 正式 Terms 正文由业务/法务提供，工程师不撰写正式条款；
- 不新增伪造 Audit/Export，不实现任意角色编辑或密码管理；
- Router/Sidebar/Topbar 若需共享修改，必须独立提交并通知 B。

### 3.4 A-BIZ-06D · Deterministic Pilot Browser E2E Harness

交付专用、可重置的 Pilot E2E 运行环境：

- 独立 `_test` PostgreSQL database 或专用 compose service；
- 确定性 migrate / reset / bootstrap / seed；
- 不在仓库写默认生产密码，不把测试凭据复用于非测试环境；
- Playwright 使用真实 HTTP Session Cookie，不注入 Pilot localStorage；
- 测试失败后可诊断、可清理，不污染开发主库。

最低 E2E 矩阵：

1. 未登录访问 Pilot 受保护页；
2. PLATFORM / CHANNEL / TENANT 默认路由、direct URL、403/404 和 returnTo；
3. Terms 未发布/版本过期/digest 不匹配；
4. Invitation valid/expired/revoked/exhausted/replay；
5. Registration idempotency/duplicate/失败恢复；
6. Member suspended 后旧 Session 失效；
7. Recharge / Commission / Settlement 的 TEST-only 声明、empty/error/retry；
8. 跨组织探测不泄露资源存在性；
9. UI 不渲染 Session、Token、digest、Provider payload、Grant、SQL、stack 或完整敏感 DTO。

### 3.5 A-BIZ-06E · A/B Golden Path Joint Gate

前置：B 提供已提交、可同步且 StoryCanvas tracked clean 的基线。

验证：

- 海底捞白名单 Tenant/Project 使用 canonical Project Context；
- A 只签发已批准且 digest 匹配的 Script / Storyboard / Production Package；
- B 只消费合法 Package / Grant，并保持 replay、scope、expiry、tenant/project 绑定；
- 从统一 SaaS 入口进入 Script、Storyboard 和 Canvas，不切换产品端或伪造 Session；
- Provider 不可用时保持安全失败和可恢复状态，不从合同测试外推媒体质量或正式生产能力。

A 不修改 StoryCanvas。B 基线未到时允许执行 06A～06D，但 06E 与最终 full Gate 必须保持未完成。

### 3.6 A-BIZ-06F · Migration/Rollback、Ops Docs 与 Final Joint Gate

交付：

- fresh DB migrate → rollback one batch → reapply 的确定性 Gate；
- migration 失败、回滚失败、错误数据库名和连接失败的安全说明；
- 根 README、Control API README、Pilot E2E/运营说明；
- STATUS、HANDOFF、CHANGELOG 和桌面知识库收口；
- 最终 full Joint Gate 报告，逐 phase 记录命令、前置条件、PASS/FAIL、时间和责任归属。

最终 Gate 只有在所有 required phase 真实执行且零 SKIP 后才可标记 `A_BIZ_06_COMPLETE / JOINT_GATE_PASS`。

## 4. Joint Gate 合同

### 4.1 必需阶段

| Phase                         | Owner | Full Gate 要求                                                                  |
| ----------------------------- | ----- | ------------------------------------------------------------------------------- |
| `root-unit`                   | A     | 根 Vitest 全量通过                                                              |
| `control-api-postgres`        | A     | 使用合法 `_test` URL；Control API 全量通过且 PostgreSQL suites 零 SKIP          |
| `cross-plane-contract-v02`    | A/B   | C01、A3、B3 v0.1/v0.2 合同与安全 Oracle 通过                                    |
| `storycanvas-v02-targeted`    | B     | 显式 runtime/security/routes/receiver 定向测试通过                              |
| `pilot-browser-e2e`           | A     | 真实 Session Cookie + 专用数据库的 Wave 4 Playwright 矩阵通过                   |
| `ab-golden-path`              | A/B   | B 可同步基线上的 Project → Script → Storyboard → Canvas 黄金路径通过            |
| `root-build`                  | A/B   | 根 TypeScript/Vite Build 通过                                                   |
| `control-api-build-typecheck` | A     | Control API build 与 typecheck 通过                                             |
| `storycanvas-build-targeted`  | B     | B 冻结的 Build/类型 Gate 通过；不得用 Provider LIVE 调用替代                    |
| `governance`                  | A/B   | `npm run validate:governance` 通过                                              |
| `repository-diff-check`       | A/B   | `git diff --check`、无意外 staged 文件、StoryCanvas tracked diff 符合所有权边界 |
| `migration-rollback-reapply`  | A     | fresh DB forward → rollback → reapply 通过                                      |

### 4.2 状态与退出语义

- `PASS`：阶段真实执行且退出 0，并满足零 SKIP 或该阶段定义的附加断言；
- `FAIL`：命令失败、输出断言失败、敏感信息检查失败或测试发生未允许的 SKIP；
- `BLOCKED`：必需外部前置条件缺失；full runner 必须非零退出；
- `NOT_RUN`：`--list` / `--plan` 或快速模式未执行；不得汇总为 PASS；
- `EXTERNAL_PRECONDITION`：例如 B 干净基线、专用 PostgreSQL、浏览器运行时；只描述依赖，不自动降级；
- runner 禁止自动设置真实 Provider Secret、自动创建 LIVE 订单或发起付费调用。

### 4.3 PostgreSQL fail-closed

full Gate 至少校验：

- `CONTROL_API_TEST_DATABASE_URL` 存在；
- 协议为 PostgreSQL；
- database name 以 `_test` 结尾；
- 不是已知开发主库 `videoagent_control`；
- 连接失败时直接 BLOCKED/FAIL；
- Test summary 中 PostgreSQL suites 不得被 skip。

runner 不打印完整 URL、用户名、密码或连接字符串；日志最多显示脱敏 database name/host 类别。

## 5. 统一安全与 UX 冻结

所有 06B～06E 的真实 Pilot 页面和 E2E 必须保持：

1. 真实 HttpOnly Session Cookie，401 清 Session/Project Context；
2. 403 不泄露跨组织资源，跨 Scope/跨组织探测使用安全 404；
3. 409/422 显示稳定安全文案和 Request ID，不显示原始响应；
4. GET 使用 `cache: 'no-store'`，写操作保留稳定幂等语义；
5. loading、empty、ready、retrying、服务错误和 invalid response 均有明确状态；
6. Retry 清理可能过期的投影，只重新请求真实 API；
7. Demo 与 Pilot 严格隔离，Pilot 失败不得回退 Mock/localStorage；
8. 页面、console、trace、截图、报告不得泄露 Session、Invitation Token/digest、Provider Token/payload、Grant、密码 hash、SQL、stack 或完整敏感 DTO；
9. Commercial UI 始终标记 `TEST / NON_QUOTE`；Settlement 始终为 `TEST + draft`，非到账、非提现、非 paid；
10. 不把 bounded list 描述成完整历史，不把本地导出描述成服务端权威导出。

## 6. 明确排除项

A-BIZ-06 不实现：

- LIVE Payment、LIVE Commission、LIVE Settlement；
- 真实佣金比例、正式 SKU 定价或额度换算；
- `paid`、提现、KYC、税务、发票、自动打款；
- 未规划的 Commission / Settlement review/approve HTTP；
- 任意成员角色编辑、批量成员操作、删除成员、密码管理；
- 伪造的全局 Audit Log 或“完整导出”；
- 正式 Terms 法务正文；
- 真实 Provider 付费调用、媒体质量验收或生产 SLA；
- 修改 StoryCanvas 或 B 的 `apps/storycanvas/data/vendor/byteplus.ts`。

## 7. 依赖、阻塞与协作通知

### 7.1 当前可直接推进

- 06A Joint Gate manifest/runner；
- 06B Member 合同规划与 A-owned Control API 实现；
- 06C A-owned Pilot UI；
- 06D A-owned专用 PostgreSQL / Playwright harness；
- 06F 的 A-owned migration/README 准备工作。

### 7.2 外部依赖

- full PostgreSQL Gate：需要合法专用 `_test` database；
- 06E / final A/B Gate：需要 B 已提交、可同步、tracked clean 的基线；
- 正式 Terms 文案：需要业务/法务提供；缺失时只可测试版本生命周期，不可自行发布成正式条款；
- Provider/媒体质量：不属于本计划 Gate，不阻塞 A-owned 合同与安全测试。

### 7.3 必须通知 B 的共享提交

以下改动必须独立 commit，并在提交后明确通知 B 先同步：

- `apps/control-api/src/app.ts`、Bootstrap/Server/Config；
- `src/app/Router.tsx`；
- `src/layouts/**`；
- 根 `package.json` 或 README 中改变 A/B 共同 Gate 的提交；
- 任何跨平面合同 manifest 或 runner 的 required phase 变更。

06A 的根 Joint Gate runner 属于共享测试/协作基线，必须独立提交并通知 B，但不得包含 StoryCanvas 源码修改。

## 8. Test-first 与提交顺序

1. 06A：manifest/runner RED → 最小 Green → 独立提交；
2. 06B：先冻结子计划，再按 Repository/Service/Route/Bootstrap 原子提交；
3. 06C：严格 Client、页面、共享 Router/Layout 分开提交；
4. 06D：DB harness、seed/bootstrap、Playwright suites 分开提交；
5. 06E：只在 B 基线可同步后执行，A/B 所有权严格分离；
6. 06F：migration rollback Gate、README/Ops、C0 docs、最终报告分开提交。

每个切片提交前必须：

```bash
git status --short
git diff --check
npm run validate:governance
git diff -- apps/storycanvas
git diff --cached --name-only
git diff --cached --check
git diff --cached -- apps/storycanvas
```

始终显式 `git add <file...>`，禁止 `git add .`，不 push。

## 9. 06A 首个 RED 与完成条件

首个测试文件应先证明当前仓库没有可导入的 Joint Gate manifest/runner，并冻结以下断言：

1. 必需 phase id 全部存在且唯一；
2. 每个 phase 有 owner、command、mode/precondition 和安全说明；
3. StoryCanvas v0.2 定向测试显式列出，不依赖不完整的普通 `npm test`；
4. `--list` / `--plan` 不执行命令且输出 `NOT_RUN`；
5. `--full` 缺专用 PostgreSQL URL 非零退出并输出脱敏 BLOCKED；
6. runner 不读取或打印 Provider Secret；
7. manifest/runner 不写入 `apps/storycanvas/**`。

06A Green 后只允许宣称：

```text
JOINT_GATE_RUNNER_READY / FULL_GATE_NOT_YET_EXECUTED
```

不得宣称：

```text
A_BIZ_06_COMPLETE
JOINT_GATE_PASS
PRODUCTION_READY
LIVE_PAYMENT_READY
```

## 10. 本计划完成定义

本计划文档、STATUS、HANDOFF、CHANGELOG 与桌面知识库同步并通过 Prettier、Governance、diff-check 后，创建独立提交：

```text
docs(business-plane): freeze operational closure joint gate plan
```

提交后状态为：

```text
A_BIZ_06_PLAN_FROZEN / READY_FOR_06A_RED
```

用户已授权连续推进，因此计划提交后若无真实阻塞，直接进入 06A test-first，不在普通步骤间暂停；仍然不 push。

## 11. 2026-08-09 · 06A 实施结果

06A 已按 test-first 完成：

- RED：`scripts/joint-gate-manifest.test.mjs` 首次因 `joint-gate-manifest.mjs` 不存在而稳定失败；
- Green：新增机器可读 manifest、fail-closed runner、StoryCanvas v0.2 显式定向 wrapper、Root scripts 和 Pilot README；
- manifest 固定 12 个 required phase，并记录 owner、availability、commands、preconditions 和 StoryCanvas v0.2 evidence paths；
- `--list` / `--plan` 只输出 `NOT_RUN` 与 `FULL_GATE_NOT_YET_EXECUTED`；
- `--full` 缺专用 PostgreSQL、06D/06E/06F 或 B 基线时退出 2，并只输出脱敏 BLOCKED code；
- Provider 环境变量在 child process 中清空，不打印数据库 URL、密码或 Provider Secret；
- 06A 未修改 StoryCanvas tracked 文件，未执行 LIVE/付费动作。

Gate 证据：

- Joint Gate manifest：7/7 PASS；
- Joint Gate plan：PASS，12 phases 全部为 `NOT_RUN`；
- full preflight：按预期 BLOCKED / exit 2；
- Root Build：PASS；Control API typecheck/build：PASS；
- StoryCanvas v0.2 targeted：13/13 PASS；ESLint、Prettier、Governance、diff-check：PASS；
- Root 全量默认测试在并发 Gate 压力下为 328/330，两个既有 App smoke 超时；单独重跑其中稳定剩余项并提高 test timeout 后逻辑通过。该性能/timeout 风险不得记作 Root full PASS；
- 现有 cross-plane contract Gate 真实暴露两项存量缺口：StoryCanvas v0.1 boundary 的跨 package TS module export 兼容失败，以及 A3 package/grant HTTP Oracle 返回 500。06A 不掩盖或越界修复，最终 full Gate 继续 fail closed。

当前状态：

```text
JOINT_GATE_RUNNER_READY / FULL_GATE_NOT_YET_EXECUTED
A_BIZ_06A_COMPLETE / READY_FOR_06B_PLANNING
```

## 12. 2026-08-09 · 06B Member Directory / Deactivation 合同冻结

权威子计划：`A_BIZ_06B_MEMBER_DIRECTORY_DEACTIVATION_PLAN.md`。

冻结结论：

- 使用 canonical-current-organization 路由：`GET /api/v1/organizations/current/members` 与 `POST /api/v1/organizations/current/members/:membershipId/suspend`；
- PLATFORM/CHANNEL/TENANT 分别只允许 `platform_admin`、`channel_admin`、`tenant_admin`；`pilot_support` 和 `content_operator` 不扩权；
- Directory bounded 100、确定性排序、最小 DTO，不返回 User/Organization/Session/Invitation/Provider 内部字段；
- suspend 使用 strict `expectedVersion`、资源状态 replay、self-suspend、last-admin、expired、stale version 与跨 Organization fail closed；
- 现有 Membership version trigger 与 Auth Session resolve 已足够实现下一请求失效，不新增 Session revoke Schema；
- TENANT legacy shadow 为单向兼容写路径：存在 legacy row 时通过 legacy 更新推进 canonical status/version，禁止无规则双写；
- Repository/Service、Route、共享 App/Server wiring 分为独立提交；共享 wiring 完成后必须通知 B 同步。

首个 RED 为 `MemberDirectoryService` 授权/Scope 单元测试，随后补 PostgreSQL 事务、并发、Session 失效与 legacy 一致性 RED。

当前状态：

```text
A_BIZ_06B_PLAN_FROZEN / READY_FOR_REPOSITORY_SERVICE_RED
```

## 13. 2026-08-09 · 06B Member Operations API 完成

06B 已按勘误后的顺序完整交付：Migration 019 → Repository/Service → HTTP Route → Shared Bootstrap。

- Migration 019 修复 legacy status-only update 删除 secondary roles 与多次 version bump 的风险；
- current Organization Member Directory 与 suspend API 已使用 canonical Scope、真实 Session Cookie、bounded 最小投影和安全错误合同；
- PLATFORM/CHANNEL/TENANT 只允许对应管理员；self、last-admin、inactive、stale version、跨 Organization、duplicate replay 与并发均 fail closed；
- TENANT legacy row 使用既有单向 shadow 写路径，事务失败无半状态；旧 Session 在下一次 resolve 时失效；
- 共享 Bootstrap 提交 `0b177cf` 已独立完成，B 修改 App/Server 共享文件前必须同步；StoryCanvas tracked diff 为零。

证据：Control API 全量 `61 files / 414 tests PASS`，并通过 typecheck、build、ESLint、Prettier、Governance 与 diff-check。

当前状态：

```text
A_BIZ_06B_COMPLETE / MEMBER_OPERATIONS_API_READY
A_BIZ_06C_NOT_STARTED / READY_FOR_06C_PLANNING
FULL_GATE_NOT_YET_EXECUTED
```

下一步先审计并冻结 06C 的严格 Pilot Client、Terms/Invitation/Member 页面和共享 Router/Layout 切片，不直接把 06B API 完成外推为完整 IAM 或 A-BIZ-06 完成。
