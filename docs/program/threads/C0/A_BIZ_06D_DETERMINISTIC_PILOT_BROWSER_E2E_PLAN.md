# A-BIZ-06D · Deterministic Pilot Browser E2E Harness 计划

- 日期：2026-08-10
- 负责人：工程师 A（业务平台）
- 分支：`dev/business-plane`
- 状态：`A_BIZ_06D_COMPLETE / PILOT_BROWSER_PHASE_READY / FULL_JOINT_GATE_STILL_BLOCKED`
- 上游计划：`A_BIZ_06_OPERATIONAL_CLOSURE_JOINT_GATE_PLAN.md`
- 前置提交：`1b3af9c docs(business-plane): close pilot operations ui`
- 共享同步基线：Pilot Router/Layout `26400fa`

## 1. 本节点目标

A-BIZ-06D 只建立可重复、fail-closed 的真实 Pilot 浏览器 E2E 环境和 Wave 4 最低矩阵，不扩张到 A/B Canvas 黄金路径、Migration/Rollback Final Gate 或 LIVE Operations。

完成后必须具备：

1. 只接受专用 `_test` PostgreSQL 的环境合同；
2. 可重复 reset → migrate → seed → verify 的确定性测试数据；
3. 真实 Control API、真实 `videoagent_session` HttpOnly Cookie、同源 Vite proxy 和真实 Pilot Router；
4. 不注入 Pilot localStorage，不把 Demo/Mock 当成功数据源；
5. 串行、可诊断、可清理的 Playwright 运行器；
6. 登录/路由、Terms/Invitation/Registration、Member、TEST 商业页、跨组织和敏感信息最低矩阵；
7. 06D 完成后再把 Joint Gate 的 `pilot-browser-e2e` phase 从 `planned` 激活为 `ready`。

## 2. 源码审计结论

### 2.1 当前 Playwright 只有 Demo smoke

- `playwright.config.ts` 只启动根 Vite，`tests/e2e/smoke.spec.ts` 只覆盖 Demo Dashboard 与 localStorage Brief → Brand → Script。
- 当前配置 `fullyParallel: true`，不适合共享 PostgreSQL 的有状态 Pilot 生命周期。
- 尚无 `tests/e2e/pilot/pilot-operational.spec.ts`、Pilot 专用 config、Control API lifecycle、数据库 reset/seed 或失败清理。
- Demo smoke 必须保留，不能改写成 Pilot Gate，也不能用 localStorage Session 绕过登录。

### 2.2 当前数据库入口不构成确定性 Harness

- `compose.pilot.yaml` 只有开发库 `videoagent_control`，没有 `_test` service。
- PostgreSQL suites 依赖 `CONTROL_API_TEST_DATABASE_URL`，缺失时大量 `describe.runIf` 静默 SKIP；06A Joint Gate preflight 已能拒绝缺失或非 `_test` URL，但还没有 06D reset/seed runner。
- `db:migrate` / `db:rollback` 直接使用 `DATABASE_URL`，没有 E2E 专用的 schema reset、post-seed assertion 或凭据隔离。
- 当前机器可发现本地 PostgreSQL 16 与 `videoagent_control_test`，但该事实不是仓库合同；Harness 仍必须只依赖显式环境变量，并支持其他合法专用 `_test` PostgreSQL。
- 当前机器没有可调用的 Docker CLI，因此 06D 不以 Docker 为唯一执行路径；可选 test compose 只能作为补充，不能替代显式 `_test` guard。

### 2.3 现有 bootstrap 不能覆盖三类 Organization

- `apps/control-api/src/auth/bootstrap.ts` 只创建单 Tenant legacy membership，不创建 PLATFORM、CHANNEL、第二组织、Project、Terms、Invitation 或 TEST 商业事实。
- Auth 对一个用户存在多个 active Membership 会 fail closed；E2E 必须为 Platform Admin、Channel Admin、Tenant Admin、Content Operator、无权角色和第二组织探测者使用独立用户。
- Test seed 必须直接走数据库约束和现有密码哈希，不得复用生产 bootstrap，也不得写默认生产账号/密码。

### 2.4 浏览器与 Control API 当前没有同源测试接线

- `pilotRuntime` 要求绝对 `VITE_CONTROL_API_BASE_URL`。
- Control API 当前没有 CORS middleware；直接让 `5173` 页面请求另一端口会被浏览器阻断或产生跨站 Cookie 语义偏差。
- 冻结采用 **同源 Vite proxy**：浏览器只访问一个 loopback origin，`VITE_CONTROL_API_BASE_URL` 指向页面 origin，`/api/v1/*` 由仅在显式 Harness 环境启用的 proxy 转发到独立 Control API loopback port。
- 不为 06D 放宽生产 CORS，不把 Cookie 改成可由 JavaScript 读取，也不通过 Playwright `addCookies` 注入 Pilot Session。

### 2.5 Registration 成功路径有显式测试缺口

- Control API server 固定使用 `UnavailableEmailVerification`；Registration 页面默认 provider 也固定返回 `EMAIL_VERIFICATION_UNAVAILABLE`。
- 因此当前只能验证安全失败，不能验证浏览器成功、idempotent replay 或 duplicate。
- 06D 允许增加 **双端显式 test-only verification adapter**：只在 `NODE_ENV=test` 且 `PILOT_E2E` 明确启用时接受本轮进程生成的临时 Token；Token 不写仓库、不使用生产默认值、不持久化、不渲染、不记录，前后端任一 guard 不满足即继续 fail closed。
- 该 adapter 不是正式邮箱验证 Provider，不得在 development/production 生效，也不得外推为公开注册上线。

### 2.6 Public Terms 当前只校验 digest 格式

- `publicRegistrationApi` 当前只验证 `contentDigest` 是 64 位十六进制，没有重算 `content` SHA-256。
- 06D 的 digest mismatch 浏览器用例会先形成 RED；前端必须在展示/接受 Terms 前重算并 constant-value 比较，错误映射为安全 invalid-response 状态，不能显示被篡改正文或回退 Demo。

### 2.7 Joint Gate 已预留但仍正确阻断

- `scripts/joint-gate-manifest.mjs` 已定义 `pilot-browser-e2e`，当前 `availability: planned` 且带 `PILOT_BROWSER_E2E_NOT_IMPLEMENTED` slice blocker。
- 只有 06D 最低矩阵真实通过后才能移除 blocker；在此之前 `test:joint-gate:full` 必须继续非零 `BLOCKED`。
- 06E 的 `ab-golden-path` 与 06F 的 migration rollback gate 不属于本轮，B 基线未到也不阻塞 06D。

## 3. 冻结的 Harness 合同

### 3.1 数据库安全合同

- 唯一数据库输入为 `CONTROL_API_TEST_DATABASE_URL`；协议只允许 `postgres:` / `postgresql:`。
- database name 必须以 `_test` 结尾，且不得为 `videoagent_control`；URL 不得被完整打印。
- reset 前先连接并验证 `current_database()` 与 URL path 一致，再执行任何 destructive SQL。
- reset 只允许删除该专用数据库内的 `control_plane` schema 与 `public.control_api_migrations*`；不 drop database、不操作其他 schema、不连接开发主库。
- migrate 必须复用现有 migration chain；seed 后执行数量、Scope、role、Project、Terms、Invitation、TEST commercial postconditions。
- 启动失败、seed 失败或 postcondition 失败均非零退出；不允许 SKIP 后继续启动浏览器。

### 3.2 临时凭据与 Secret

- Harness 父进程每次运行生成独立 Session、ProjectGrant、Registration、Recharge、Internal Token 和账号密码；只通过 child-process environment 传递。
- 仓库只保存非敏感固定 UUID、邮箱域名和展示名称，不保存可登录默认密码或 verification token。
- 日志只能打印 fixture label、脱敏 database name、phase 和安全错误 code；不得打印 URL credentials、密码、Session Cookie、Invitation Token、verification token 或内部 Secret。
- 测试账号和 Token 只对本轮 `_test` 数据库有效；不得复用于 development、staging 或 production。

### 3.3 Seed Scope

至少创建：

- 一个 PLATFORM Organization + Platform Admin + 无权 Platform 角色；
- 两个 CHANNEL Organization、各自 canonical channelId，至少一个 Channel Admin；
- 两个 TENANT Organization，Tenant Admin、Content Operator、可 suspend Member 与 last-admin 边界；
- Tenant 可见 Project 与 canonical Project assignment；
- 当前已发布 Registration Terms，以及可形成 stale/digest mismatch 的版本事实；
- valid / expired / revoked / exhausted Invitation，明文 Token 仅在父进程内存与 Playwright child env 中存在；
- TEST RechargeOrder、Payment Event、Commission outcome/accrual/reversal，以及 active Channel Directory；
- Settlement 初始为零或 draft-only，不 seed `paid`、提现、KYC、税务或 LIVE Provider 事实。

### 3.4 进程与网络合同

- Pilot E2E 使用专用 loopback ports，端口占用时 fail closed，不静默换端口。
- 父 runner 顺序执行 preflight → reset/migrate/seed → Control API ready → Vite ready → Playwright → cleanup。
- 浏览器只访问 Vite origin；API 请求通过显式 proxy，同源携带真实 HttpOnly Cookie。
- Playwright 使用单 worker、非 fully parallel；trace `off`、screenshot `only-on-failure`、video `off`；父 runner 在成功或失败退出前扫描 artifact，拒绝 trace/HAR/video 及明文 Secret 残留。
- 运行成功清理进程并撤销/清空测试 Session；运行失败保留数据库现场供诊断，下一次运行先 reset，另提供显式 cleanup 命令。

### 3.5 UI 与安全断言

- 未登录受保护页回 `/login` 并保留安全 `returnTo`；登录由页面表单请求真实 `/api/v1/auth/login` 获取 Cookie。
- 不使用 `page.addInitScript`、`localStorage.setItem`、Zustand state 注入或 Mock Session。
- 跨 Scope 路由返回 404，同 Scope 缺角色返回 403；Platform/Channel/Tenant 默认路由保持 06C 冻结值。
- 网络故障/安全 5xx 的 UI retry 可由 Playwright 对 **首次读取** 做一次性 abort/安全 StandardError fulfill，重试必须恢复到真实 API；成功数据不得由 route mock 提供。
- 页面正文、可访问 DOM、console、pageerror 和失败 artifact 扫描不得出现 Session、密码、Invitation/verification Token、Terms digest、Provider payload、Grant、SQL、stack 或完整敏感 DTO。
- Settlement 必须明确 `TEST`、`draft`、非到账、非提现；不出现 LIVE、真实比例、paid、提现、KYC、税务、自动打款或未规划 review/approve。

## 4. 原子切片与提交边界

### 06D.1 · Environment Contract & Dedicated DB Guard — COMPLETE (`2f5131e`)

交付：

- 复用/抽取专用 PostgreSQL URL validator；
- E2E 环境解析、端口、loopback、日志脱敏和 destructive-operation guard；
- 单元测试覆盖 missing、invalid protocol、非 `_test`、开发库、database mismatch 与 URL 不泄漏。

首个 RED：

> `parsePilotE2eEnvironment()` / `assertPilotE2eDatabaseIdentity()` 在缺少 URL、指向 `videoagent_control` 或数据库实际身份不匹配时，必须在任何 reset SQL 前非零失败，并且错误输出不包含用户名、密码或完整连接字符串。

建议提交：`test(control-api): freeze pilot e2e database guard` → `feat(control-api): enforce pilot e2e environment contract`（RED/Green 可按仓库既有 TDD 方式拆分）。

### 06D.2 · Deterministic Reset / Migrate / Seed — COMPLETE (`4c05157`)

交付：

- test-only reset/migrate/seed/verify CLI；
- 每轮生成临时账号密码和 Token；
- 固定 UUID/Scope fixture 与 seed manifest；
- seed postcondition 和显式 cleanup。

Gate：合法 `_test` PostgreSQL 零 SKIP；连续运行两次结果一致；开发库 guard 测试不执行 destructive SQL。

### 06D.3 · Test-only Verification & Same-origin Browser Runtime — COMPLETE (`fd4e3de`～`bda23ac`)

交付：

- 双端 test-only email verification adapter，非 test 环境 fail closed；
- Public Terms SHA-256 digest 重算与 mismatch RED/Green；
- Vite loopback proxy、Pilot Playwright config 和父 lifecycle runner；
- 根 `package.json` 增加独立 `test:e2e:pilot`，不改变 Demo `test:e2e` 语义。

共享通知：该切片会修改根 `vite.config.ts`、`package.json`、可能的前端 runtime/service 与 Control API server/config；必须独立提交并通知 B，B 修改共享文件前先同步该提交。

### 06D.4 · Auth / Router Browser Matrix — COMPLETE (`9bddd47`～`8480f80`)

覆盖：

- anonymous protected route；
- PLATFORM / CHANNEL / TENANT 真实登录和默认路由；
- direct URL、safe returnTo、未知路径、跨 Scope 404、同 Scope缺角色 403；
- Tenant Project Context 与 Project-independent Operations route；
- logout、刷新恢复与 suspend 后旧 Session 失效。

### 06D.5 · Terms / Invitation / Registration Browser Matrix — COMPLETE (`c5f5248`～`c492c36`)

覆盖：

- Terms 未发布、stale 与 digest mismatch；
- Invitation valid、expired、revoked、exhausted、首次 Token 最小展示与 replay null；
- Registration success、相同请求 replay、变化请求 idempotency conflict、duplicate、verification unavailable/failed 与失败恢复；
- Token 从 URL 立即清除，刷新不恢复。

### 06D.6 · Operations / TEST Commercial / Security Matrix — COMPLETE (`bf054aa`～`426103b`)

覆盖：

- Terms、Invitation、Member loading/empty/error/retry；
- Member suspend 与 inactive Session；
- Tenant Recharge、Platform/Channel Commission Audit、Platform Settlement Draft 的 empty/ready/error/retry；
- TEST/draft/non-payment/non-withdrawal 文案；
- 跨组织 API 探测安全 404；
- DOM、console、pageerror、network error 和 artifact 敏感信息检查。

Gate：真实 Google Chrome `150.0.7871.125`，专用 `videoagent_control_test`，单 worker `39/39 PASS / 0 SKIP`。覆盖真实 HttpOnly Cookie、Request ID、401/403/404/409/503、安全 retry、跨组织等价 404、Pilot Storage 空、无 Demo/Mock fallback，以及 TEST Settlement `draft`/非到账/非提现/非自动打款边界。

安全收口：浏览器可读 DOM、URL、Cookie、localStorage/sessionStorage、console、pageerror 与 requestfailed 均不暴露 Session、密码、Invitation/verification Token、Terms digest、内部 calculation snapshot、Grant、SQL 或 stack；artifact scanner 额外拒绝 trace/HAR/video 和可搜索明文 Secret。

### 06D.7 · Joint Gate Activation & Documentation Closure — COMPLETE (`346a183`, `c154b1e`)

- RED `346a183` 冻结 `pilot-browser-e2e` 必须为 `ready`、只委托 `npm run test:e2e:pilot`，并拒绝继续输出 `PILOT_BROWSER_E2E_NOT_IMPLEMENTED`；
- Green `c154b1e` 将 phase 激活为 `ready`，改用真实 lifecycle runner，并以 `CONTROL_API_TEST_DATABASE_URL` 的 dedicated PostgreSQL guard 替换 06D slice blocker；
- Full runner 为子进程固定注入 `PILOT_E2E=true` 与 `PILOT_E2E_BROWSER_CHANNEL=chrome`，继续清空 paid provider secrets；
- manifest `8/8 PASS`，plan 明确列出 ready phase；带专用 `_test` URL 的 full preflight 退出 `2`，不再含 06D blocker，仍因 06E/06F/B external precondition 正确 BLOCKED；
- 已更新 Pilot E2E README、C0 STATUS/HANDOFF/CHANGELOG 与桌面知识库；不宣称 Full Joint Gate PASS。

## 5. 验证矩阵

每个切片至少执行相应定向测试，并在阶段收口执行：

```bash
npm run test:joint-gate:manifest
npm run test:joint-gate:plan
CONTROL_API_TEST_DATABASE_URL='<dedicated _test url>' npm run test:e2e:pilot
npm run build
npm --prefix apps/control-api run typecheck
npm --prefix apps/control-api run build
npm run lint
npx prettier --check <changed files>
npm run validate:governance
git diff --check
git diff -- apps/storycanvas
```

06D 阶段 PASS 还要求：

- PostgreSQL reset/seed tests 零 SKIP；
- Playwright Pilot projects 单 worker真实执行，不能只 list；
- Demo smoke 不被删除或改写；
- `test:joint-gate:full` 仍因 06E/06F/B external precondition 正确 BLOCKED；
- StoryCanvas tracked diff 为零，`apps/storycanvas/data/vendor/byteplus.ts` 不修改、不暂存、不提交。

## 6. 非目标与持续禁止

- 不修改 StoryCanvas；
- 不 push；
- 不新增 LIVE Payment、真实佣金比例、paid、提现、KYC、税务、发票或自动打款；
- 不实现未规划的 Commission/Settlement review/approve HTTP；
- 不把 test-only verification adapter 描述为正式邮箱验证；
- 不把 test seed 当生产 bootstrap 或业务默认数据；
- 不向浏览器暴露生产 Secret，不读取 HttpOnly Cookie 值；
- 不用 route mock 提供成功业务事实，不让 Pilot 失败回退 Demo/Mock/localStorage；
- 不在 B 基线缺失时进入 06E，不在 migration rollback gate 未完成时进入 06F Final Gate。

## 7. 冻结结论

A-BIZ-06D 按 `Environment Guard → Reset/Seed → Browser Runtime → Auth/Router → Public Lifecycle → Operations/Commercial/Security → Joint Gate Activation` 顺序推进。

当前状态：

```text
A_BIZ_06D_COMPLETE / PILOT_BROWSER_PHASE_READY / FULL_JOINT_GATE_STILL_BLOCKED
```

06D.1～06D.2 已完成唯一 `_test` PostgreSQL 输入、开发库拒绝、实际 database identity 核对、受保护 reset、19 个 migration、固定 Scope fixture、每轮临时凭据和 postcondition verify。专用 `videoagent_control_test` 定向 Gate 为 `2 files / 14 tests PASS / 0 SKIP`，连续两轮安全 fingerprint 一致，且 `liveFactCount: 0`、`activeSessionCount: 0`。

06D.3 已完成 Public Terms 正文 SHA-256 重算、双端 test-only verification adapter、Demo browser persistence 阻断、同源 Vite proxy、真实 Control API lifecycle 与单 worker Playwright runner。共享 runtime 提交为 `bda23ac`；B 修改根 `vite.config.ts`、`package.json` 或 Pilot E2E runtime 前必须先同步。

06D.4 Auth/Router Browser Gate 为 `10/10 PASS`：真实登录、HttpOnly Session 刷新恢复、三 Scope 默认路由、safe returnTo、Tenant Project-independent route、跨 Scope 404、同 Scope缺角色 403、logout 与 suspend 后旧 Session 失效均已覆盖。`5512bfe` 修复非 Tenant Scope Auth 隔离，`6a8c4be` 保留 canonical Tenant Organization Context。

06D.5 Public Lifecycle 完成后，完整 Pilot Browser Gate 为 `22/22 PASS`。fixture 的 canonical Terms document code 已由错误的 `pilot-e2e-registration` 修正为 `registration-notice`；stale Terms HTTP 语义已由错误的 `503 TERMS_NOT_AVAILABLE` 修正为 `409 TERMS_VERSION_STALE`。Invitation Token 只在当前组件内存使用，立即从 URL 清除，刷新不恢复，且不进入 DOM、Storage、日志或 artifact；Registration 覆盖 success、无自动 Session、replay、idempotency conflict、duplicate、verification unavailable/failed recovery、stale Terms 与全部 Terms retired。

06D.6 已以 `bf054aa`～`426103b` 完成真实 Operations/Commercial/Security Browser Matrix。期间修复 Commission Router 对无关 `/api/v1/*` 的错误 403 吞路由、Tenant canonical scope 与 Settlement calendar date 投影；Terms/Invitation/Member 和 TEST Recharge/Commission/Settlement 均覆盖 loading/empty/error/retry。跨组织 Channel/Tenant 探测对“存在但无权”和“未知”返回等价安全 404；Settlement retry 保持相同业务事实与 body `idempotencyKey`，最终仍仅创建 TEST draft。

完整 Pilot Browser Gate 使用真实 Google Chrome `150.0.7871.125`、专用 `videoagent_control_test` 与单 worker执行，结果 `39/39 PASS / 0 SKIP`。真实 Session Cookie 为 HttpOnly，Pilot Storage 为空，失败不回退 Demo/Mock/localStorage；DOM/URL/console/pageerror/requestfailed 与 artifact 扫描未发现 Secret、Token、digest、内部 snapshot、Grant、SQL 或 stack 泄漏。

06D.7 已以 `346a183`、`c154b1e` 激活 Joint Gate `pilot-browser-e2e` phase：真实命令为 `npm run test:e2e:pilot`，precondition 为专用 `_test` PostgreSQL，06D slice blocker 已移除。manifest `8/8 PASS`，plan 正确列为 `ready`；Full Gate preflight 在 06E/06F/B external precondition 未满足时继续退出 `2` 且不执行 required commands。A-BIZ-06D 已完成，但 A-BIZ-06、06E/06F、B baseline 与 Full Joint Gate 仍未完成。
