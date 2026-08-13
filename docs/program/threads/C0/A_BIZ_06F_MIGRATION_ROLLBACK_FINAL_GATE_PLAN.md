# A-BIZ-06F · Migration/Rollback、Ops Docs 与 Final Joint Gate 计划

- 日期：2026-08-10
- 负责人：工程师 A（业务平台）
- 分支：`dev/business-plane`
- 状态：`A_BIZ_06F_PLAN_FROZEN / READY_FOR_MIGRATION_GATE_RED / FULL_JOINT_GATE_STILL_BLOCKED`
- 上游计划：`A_BIZ_06_OPERATIONAL_CLOSURE_JOINT_GATE_PLAN.md`
- 并行依赖：`A_BIZ_06E_A_B_GOLDEN_PATH_JOINT_GATE_PLAN.md`
- 前置提交：`2e7c7f0 docs(business-plane): close b baseline attestation`

## 1. 本节点目标

A-BIZ-06F 只负责 Wave 4 的迁移可恢复性、运营文档和最终 Joint Gate 收口，不扩张新的商业或生产能力：

1. 对一个显式、专用、空的 PostgreSQL `_test` 数据库执行 fresh migrate → rollback one batch → deterministic reapply；
2. 在任何 destructive SQL 或 migration operation 前验证 Pilot E2E 模式、测试库 URL 和连接后的 `current_database()` identity；
3. 冻结 connection、migration、rollback、reapply、verification 与 cleanup 的稳定失败语义和脱敏日志；
4. 激活 Joint Gate 的 `migration-rollback-reapply` phase，但只有真实数据库 Gate 零 SKIP、零降级通过后才移除 06F slice blocker；
5. 更新 Root README、Control API README、Pilot E2E/Ops 文档和最终 Joint Gate 报告合同；
6. 只有 06E A/B Golden Path、B baseline attestation 与全部 required phases 都真实通过后，才允许宣称 `A_BIZ_06_COMPLETE / JOINT_GATE_PASS`。

当前 B-owned Wave 4 baseline 尚未交付，06E 仍为 `WAITING_FOR_B_BASELINE`。这不阻塞 06F 的 A-owned migration/README 工作，但阻塞最终 Full Joint Gate。

## 2. 源码与合同审计结论

### 2.1 Joint Gate 已预留 phase，但 runner 不存在

`scripts/joint-gate-manifest.mjs` 已声明：

```text
migration-rollback-reapply
```

当前命令为：

```text
node scripts/run-control-api-migration-gate.mjs
```

但 runner 文件尚不存在，phase 仍为 `planned`，并保留：

```text
MIGRATION_ROLLBACK_GATE_NOT_IMPLEMENTED
```

因此当前 Full Gate 必须继续 BLOCKED，不得把普通 migration CLI 或单次 `migrate.latest()` 结果当作 06F PASS。

### 2.2 普通 migration CLI 不能直接承担 destructive Gate

现有：

- `apps/control-api/src/db/migrate.ts`
- `apps/control-api/src/db/rollback.ts`
- `apps/control-api/src/db/migrationConfig.ts`

这些命令面向普通运行环境并读取常规配置；它们没有强制：

- `PILOT_E2E=true`；
- 只接受 `CONTROL_API_TEST_DATABASE_URL`；
- 禁止 `DATABASE_URL` fallback；
- 数据库名必须以 `_test` 结尾；
- 显式拒绝开发主库 `videoagent_control`；
- 建连后用 `current_database()` 做 identity 二次核对；
- destructive operation 前的稳定安全错误码与凭据脱敏。

06F 不修改普通生产/开发 migration CLI 语义，也不直接复用它们作为 Joint Gate 入口。

### 2.3 已有 Pilot E2E 数据库 guard 应复用

`apps/control-api/src/e2e/environment.ts` 已提供：

- `parsePilotE2eEnvironment()`；
- `safePilotE2eEnvironmentSummary()`；
- `assertPilotE2eDatabaseIdentity()`；
- `runWithVerifiedPilotE2eDatabase()`。

已有 guard 能验证 Pilot 模式、专用 PostgreSQL `_test` URL、开发主库拒绝、端口边界和 `current_database()` identity。06F 应复用该权威逻辑，不再复制一套可能漂移的 URL/parser 规则。

### 2.4 当前 migration chain 为 001～019

权威目录为：

```text
apps/control-api/src/db/migrations/
```

当前共 19 个 migration：

```text
001_pilot_core.ts
...
019_harden_legacy_membership_shadow.ts
```

`migrationChain.postgres.test.ts` 已验证 empty DB → latest、顺序、核心表和 replay no-op，但尚未验证 rollback one batch → empty state → reapply。

### 2.5 rollback 必须在 fresh、empty、dedicated DB 上执行

多个 migration 的 `down()` 对已有业务事实采用 fail-closed rollback guard，例如 Production Package/Grant、非 Tenant Session、Consent/Usage/Registration/Attribution、商业 Ledger/Settlement 证据。

因此 06F Gate 的数据库必须是：

- 显式配置的 dedicated `_test` database；
- identity 校验后由 runner 清为空状态；
- 不与 Pilot Browser fixture 或人工开发数据共用；
- 不在已有真实/演示业务事实上尝试破坏性 rollback。

Gate 不负责迁移、修复或删除开发主库数据；任何 identity 不确定性都必须在 destructive operation 前失败。

### 2.6 Knex one-batch 语义必须由测试证明

`database.migrate.rollback(config)` 默认目标是最后一个 migration batch。06F 不凭文档或记忆假定它会回滚 19 个 migration，而是以真实专用 PostgreSQL RED/GREEN 断言：

- fresh latest 的 batch 是 `1`；
- batch `1` 包含冻结的 001～019；
- rollback 返回且仅返回该 batch 的全部 migration；
- migration tables 与 `control_plane` schema 回到冻结的空状态；
- reapply 再次以 batch `1` 应用完全相同的 migration 集合。

## 3. 统一安全合同

### 3.1 运行前置

06F runner 必须同时满足：

1. `PILOT_E2E=true`；
2. `CONTROL_API_TEST_DATABASE_URL` 显式存在；
3. 协议只允许 `postgres:` / `postgresql:`；
4. database name 可安全 decode、不含额外 path、以 `_test` 结尾；
5. database name 不是 `videoagent_control`；
6. 不从 `DATABASE_URL`、`.env` 的普通开发连接或默认值回退；
7. 建连成功后 `current_database()` 必须等于 URL 中的 database name。

缺少任一条件时，runner 必须在 `DROP`、`migrate.latest()` 或 `migrate.rollback()` 前非零退出。

### 3.2 destructive boundary

只有通过 environment parse 和 database identity check 后，才允许进入：

```text
RUNNING_MIGRATION_GATE
```

随后 destructive reset 仅限：

- `control_plane` schema；
- `public.control_api_migrations`；
- `public.control_api_migrations_lock`。

禁止：

- DROP database；
- 修改其他 schema；
- 自动创建或切换数据库；
- 连接失败后 fallback 到本地/开发库；
- 复用含业务事实的浏览器 E2E database 而不显式 reset。

### 3.3 日志与错误

日志最多允许输出：

- 稳定 stage/code；
- database name；
- host category（`loopback` / `remote`）；
- migration count、batch、阶段耗时；
- PASS/FAIL/CLEANUP_FAILED。

禁止输出：

- 完整 database URL；
- username/password/query string；
- Session/Invitation/Grant/Provider Secret；
- SQL payload、stack trace、Knex connection object；
- 原始环境变量值。

冻结错误族：

```text
MIGRATION_GATE_ENVIRONMENT_REJECTED
MIGRATION_GATE_CONNECTION_FAILED
MIGRATION_GATE_DATABASE_IDENTITY_REJECTED
MIGRATION_GATE_RESET_FAILED
MIGRATION_GATE_FORWARD_FAILED
MIGRATION_GATE_FORWARD_VERIFICATION_FAILED
MIGRATION_GATE_ROLLBACK_FAILED
MIGRATION_GATE_ROLLBACK_VERIFICATION_FAILED
MIGRATION_GATE_REAPPLY_FAILED
MIGRATION_GATE_REAPPLY_VERIFICATION_FAILED
MIGRATION_GATE_CLEANUP_FAILED
```

底层 `PILOT_E2E_*` code 可作为安全 reason code 输出，但不得附带原始异常信息。

### 3.4 失败与 cleanup

- forward、rollback、reapply 或 verification 任一步失败，主结果必须为 FAIL；
- runner 应在 identity 已验证的同一连接上尝试 cleanup；
- cleanup 失败不能覆盖原始失败，也不能返回 0；
- cleanup 失败必须额外记录 `MIGRATION_GATE_CLEANUP_FAILED`；
- identity 未验证时禁止执行 cleanup SQL；
- 所有失败都禁止自动重试到另一数据库。

## 4. 冻结的 migration Gate 执行顺序

真实 Green runner 固定执行：

1. parse environment；
2. 建立单一 Knex PostgreSQL 连接；
3. `current_database()` identity check；
4. verified destructive reset；
5. 断言 schema/migration state empty；
6. `migrate.latest()` 应用冻结的 001～019；
7. 校验 batch、migration 顺序、migration table、核心 schema fingerprint；
8. 再次 `migrate.latest()`，断言 no-op；
9. `migrate.rollback(config)` 回滚 one batch；
10. 断言回滚集合、migration state 和 schema empty fingerprint；
11. `migrate.latest()` deterministic reapply 001～019；
12. 校验最终 fingerprint 与第一次 forward 完全一致；
13. verified cleanup；
14. 仅在所有阶段和 cleanup 全部成功后输出 `MIGRATION_ROLLBACK_REAPPLY_PASS` 并退出 0。

migration 集合与关键表 fingerprint 必须来自一个 A-owned 可测试合同，避免 runner 和 PostgreSQL test 各自维护不同列表。

## 5. 原子切片与提交边界

### 5.1 A-BIZ-06F.1 · Environment / Destructive Guard

目标：先建立 runner 的 fail-closed 外壳，不实现真实 migration 主链。

首个 RED：

> `scripts/run-control-api-migration-gate.mjs` 在 `PILOT_E2E` 缺失、`CONTROL_API_TEST_DATABASE_URL` 缺失/非法/非 `_test`/开发主库时，必须在任何 destructive 或 migration stage 前非零退出；输出只能包含稳定错误码，不得包含 URL、用户名、密码或 `RUNNING_MIGRATION_GATE`。

Green：

- 新增可单测的 06F runner/CLI 边界；
- 复用 Control API Pilot E2E environment parser；
- 禁止 `DATABASE_URL` fallback；
- environment 未通过时不加载 Knex destructive operation；
- 为后续真实 database identity check 预留注入点；
- 不移除 Joint Gate 的 06F blocker。

建议提交：

```text
test(joint-gate): guard migration rollback database
feat(joint-gate): enforce migration gate database boundary
```

### 5.2 A-BIZ-06F.2 · Fresh Forward / One-batch Rollback / Reapply

- 先写专用 PostgreSQL RED，证明 Knex one-batch 行为；
- 提取冻结 migration names 与 schema fingerprint；
- 实现 verified reset、forward、replay no-op、rollback、empty verification、reapply 和 final fingerprint；
- 测试必须显式使用 dedicated `_test` database，缺环境不能计为 PASS；
- 任何 rollback guard 失败必须 fail closed，不修补或绕过 migration `down()`。

建议提交：

```text
test(joint-gate): require migration rollback reapply
feat(joint-gate): run migration rollback reapply gate
```

### 5.3 A-BIZ-06F.3 · Failure / Recovery / Redaction Matrix

覆盖：

- missing mode / URL；
- invalid URL / protocol / encoded path；
- non-`_test` / known development database；
- connection refused；
- `current_database()` invalid/mismatch；
- reset/forward/verification/rollback/reapply/cleanup failure；
- raw URL、username、password、query、stack 与 SQL 不泄漏；
- failure 时不出现 PASS，不切换数据库，不执行后续阶段。

建议提交：

```text
test(joint-gate): cover migration gate failure matrix
```

### 5.4 A-BIZ-06F.4 · Joint Gate Phase Activation

只有 06F.2/06F.3 的真实 PostgreSQL Gate 零 SKIP 后才允许：

- `migration-rollback-reapply` 从 `planned` 改为 `ready`；
- 移除 `MIGRATION_ROLLBACK_GATE_NOT_IMPLEMENTED`；
- Joint Gate manifest/runner tests 明确验证 required command 和 dedicated DB precondition；
- Full preflight 仍保留 06E/B baseline blockers；
- 不宣称 `JOINT_GATE_PASS`。

这是共享 Joint Gate 改动，必须独立 commit 并通知 B。B 修改以下文件前必须同步该提交：

```text
scripts/joint-gate-manifest.mjs
scripts/run-joint-gate.mjs
```

建议提交：

```text
test(joint-gate): freeze migration phase activation
feat(joint-gate): activate migration rollback phase
```

### 5.5 A-BIZ-06F.5 · Ops Docs / Final Report Contract

更新：

- Root `README.md`；
- `apps/control-api/README.md`；
- `tests/e2e/pilot/README.md`；
- migration rollback/recovery 运行说明；
- C0 STATUS/HANDOFF/CHANGELOG；
- 桌面知识库。

文档必须明确：

- 所有 Payment/Commission/Settlement 仅 TEST Pilot，不是 LIVE；
- Settlement 仅 `TEST / draft / NON_QUOTE`，不是到账、paid 或提现；
- provider unavailable 只证明安全失败，不证明媒体质量或生产 SLA；
- Full Gate 需要 dedicated PostgreSQL、真实浏览器和已同步 B baseline；
- 缺外部前置时为 BLOCKED，不得用 SKIP 冒充 PASS；
- 不记录完整 DB URL、Token、Secret 或内部 payload。

Final Gate 报告逐 phase 记录：

- command；
- owner；
- precondition；
- start/end/duration；
- PASS/FAIL/BLOCKED；
- test count 与 zero-SKIP evidence；
- artifact/evidence path；
- 安全脱敏结论。

建议提交：

```text
docs(business-plane): document migration operations gate
```

### 5.6 A-BIZ-06F.6 · Final Joint Gate

只有以下条件同时满足才执行：

1. B 提供 Wave 4 clean baseline，且 commit 已成为 integration `HEAD` ancestor；
2. 06E Storyboard authority、server-mediated Canvas bootstrap 与真实 A/B Golden Path 完成；
3. `ab-golden-path` phase 已激活并零 SKIP 通过；
4. `migration-rollback-reapply` phase 已激活并真实通过；
5. 全部 `requiredInFull` phases 都执行且零 SKIP；
6. Build、Governance、diff-check 与 StoryCanvas ownership boundary 通过；
7. 没有 paid provider secret、LIVE Payment 或未规划业务副作用。

任何条件未满足时保持：

```text
FULL_JOINT_GATE_STILL_BLOCKED
```

不得提前写入：

```text
A_BIZ_06_COMPLETE
JOINT_GATE_PASS
```

## 6. 验证矩阵

每个切片执行定向测试。06F migration phase 激活前至少要求：

```bash
npm run test:joint-gate:manifest
npm run test:joint-gate:plan
PILOT_E2E=true CONTROL_API_TEST_DATABASE_URL='<dedicated _test url>' \
  node scripts/run-control-api-migration-gate.mjs
npm --prefix apps/control-api run typecheck
npm --prefix apps/control-api run build
npm run build
npm run validate:governance
git diff --check
git diff --cached --check
git diff -- apps/storycanvas
git diff --cached -- apps/storycanvas
```

验证还必须证明：

- invalid environment 时零 destructive operation；
- dedicated PostgreSQL suite 不允许静默 SKIP；
- migration count、顺序与 fingerprint 一致；
- rollback one batch 后 empty verification 通过；
- reapply 后 fingerprint 等于首次 forward；
- cleanup 完成且失败语义正确；
- stdout/stderr 不含完整 URL、credentials、SQL、stack、Token 或 Secret；
- B-owned `apps/storycanvas/data/vendor/byteplus.ts` 不被修改、暂存或提交。

## 7. 明确排除项

A-BIZ-06F 不实现：

- LIVE Payment、LIVE Commission、LIVE Settlement；
- 真实佣金比例、paid、提现、KYC、税务、发票、自动打款；
- 未规划的 Commission/Settlement review/approve HTTP；
- 生产数据库自动 rollback；
- 自动创建/删除 PostgreSQL database；
- 跨数据库 fallback 或开发主库数据修复；
- 正式 Provider 付费调用、媒体质量验收或生产 SLA；
- A 修改 StoryCanvas 或 B-owned Script/Storyboard/Canvas 文件；
- 修改、暂存、提交或删除 `apps/storycanvas/data/vendor/byteplus.ts`；
- push 当前分支。

## 8. 协作通知规则

- 06F.1～06F.3 的 A-owned runner/test 可独立推进；
- 06F.4 修改共享 Joint Gate manifest/runner，必须独立 commit 并明确通知 B；
- 06F.5 若改变 Root 共同运行命令或 README 的 A/B Gate 口径，也必须在交接中标明同步 commit；
- 06F.6 依赖 B baseline 与 06E，当前不得执行或宣称完成；
- 全程禁止 `git add .`，只按白名单暂存本切片文件。

## 9. 冻结结论

A-BIZ-06F 按以下顺序推进：

```text
06F.1 Environment / Destructive Guard
→ 06F.2 Fresh Forward / One-batch Rollback / Reapply
→ 06F.3 Failure / Recovery / Redaction Matrix
→ 06F.4 Joint Gate Phase Activation
→ 06F.5 Ops Docs / Final Report Contract
→ 06F.6 Final Joint Gate（等待 06E 与 B baseline）
```

当前立即进入 06F.1 首个 RED。06F 可完成 migration/README 的 A-owned 前置，但最终状态继续保持：

```text
A_BIZ_06F_PLAN_FROZEN / READY_FOR_MIGRATION_GATE_RED
A_BIZ_06E_0_COMPLETE / WAITING_FOR_B_BASELINE
FULL_JOINT_GATE_STILL_BLOCKED
```
