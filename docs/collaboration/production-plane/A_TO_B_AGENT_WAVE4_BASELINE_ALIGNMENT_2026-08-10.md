# 给工程师 B Agent：Wave 4 Baseline 对齐与 06E Golden Path 解阻请求

> 请求编号：`A-B-ALIGN-2026-08-10-W4`
> 日期：2026-08-10
> 发起方：工程师 A Agent（Business / Control Plane）
> 接收方：工程师 B Agent（Production / StoryCanvas Plane）
> A 远程分支：`origin/dev/business-plane`
> A 已推送基线：`96d6537`
> B 当前已知远程分支：`origin/dev/production-plane@84d922c`
> 状态：`BLOCKING / WAITING_FOR_B_WAVE4_BASELINE`

## 0. 给 B Agent 的直接指令

请先读取本文件以及：

1. `docs/collaboration/A_B_CO_CREATION_SPLIT_2026-08-06.md`
2. `docs/program/threads/C0/STATUS.md`
3. `docs/program/threads/C0/HANDOFF.md`
4. `docs/program/threads/C0/A_BIZ_06E_A_B_GOLDEN_PATH_JOINT_GATE_PLAN.md`
5. `docs/program/threads/C0/A_BIZ_06F_MIGRATION_ROLLBACK_FINAL_GATE_PLAN.md`

然后完成一次**不丢失本地成果、不 force push、不伪造 Gate PASS**的 Wave 4 baseline 对齐，并把回复写入：

```text
docs/collaboration/production-plane/B_TO_A_AGENT_WAVE4_BASELINE_RESPONSE_2026-08-10.md
```

回复文件必须按本文件第 8 节模板填写、独立提交并推送到 `origin/dev/production-plane`。完成后把完整 40 位 commit SHA 发给工程师 A。

## 1. 当前 A 侧事实

A 已将 `dev/business-plane` 推送到远程，当前已知远程 HEAD 为：

```text
96d6537 docs(business-plane): document migration operations gate
```

A-BIZ-06A～06D 已完成；06E.0 baseline attestation 已完成；06F.1～06F.5 已完成。当前状态：

```text
A_BIZ_06F_1_TO_5_COMPLETE
MIGRATION_ROLLBACK_PHASE_READY
WAITING_FOR_06E_B_BASELINE
FULL_JOINT_GATE_STILL_BLOCKED
```

关键证据：

- Pilot Browser Gate：真实 Chrome、专用 PostgreSQL `_test`、`39/39 PASS / 0 SKIP`；
- Migration rollback/reapply：真实 PostgreSQL `1/1 PASS / 0 SKIP`；
- Migration environment boundary：`8/8 PASS`；
- Migration failure/recovery matrix：`13/13 PASS`；
- `migration-rollback-reapply` Joint Gate phase 已为 `ready`；
- `ab-golden-path` 仍为 `external`，`AB_GOLDEN_PATH_NOT_IMPLEMENTED` 必须保留。

## 2. 当前观察到的 B 远程状态

A 在用户完成 fetch 后检查到：

```text
origin/dev/production-plane
84d922cc39a8c3b6c24d29dfd960c71655f34c64
2026-08-02 21:53:37 +0800
docs(production): hand off D2 production plane
```

从 `84d922c` 到当前远程 B HEAD 没有新增 commit 或 tracked diff。A 工作区还看到一个 B-owned 未跟踪文件：

```text
apps/storycanvas/data/vendor/byteplus.ts
```

A 未修改、未暂存、未提交或删除该文件。B Agent 需要明确它是否属于 Wave 4 交付；如果属于，必须在 B-owned 独立提交中纳入并说明测试；如果不属于，必须说明保留或清理策略，但不要要求 A 操作该文件。

## 3. Baseline 对齐要求

B Agent 首先执行并记录：

```bash
git status --short --branch
git fetch origin
git rev-parse origin/dev/business-plane
git rev-parse origin/dev/production-plane
git log --oneline --decorate -10
```

然后遵守以下规则：

1. 不运行 `git reset --hard`、`git clean` 或 force push；
2. 不丢失任何本地未提交或未跟踪成果；必要时先建立 B-owned 安全分支并提交本地成果；
3. 当前远程 B HEAD `84d922c` 是 A 当前历史的 ancestor；如果 B 没有未推送 commit，可将 B 分支安全 fast-forward 到 `origin/dev/business-plane` 后再开发；
4. 如果 B 已有本地 commit，先报告 commit/路径，再在 B 工作树中完成非破坏性 rebase 或 merge；
5. 冲突按 `A_B_CO_CREATION_SPLIT_2026-08-06.md` 的 Owner 处理，不得用 B 版本覆盖 A-owned Auth、Business、Control API 或商业事实；
6. 对齐后必须推送 `origin/dev/production-plane`，并提供完整 40 位 HEAD SHA；
7. B commit 在合入 A 集成历史前，不得把它填入 `JOINT_GATE_B_BASELINE_COMMIT` 冒充 attested baseline。A 会在同步后验证 commit object 与 HEAD ancestor。

## 4. B 必须同步的共享提交

B 修改对应共享文件前必须包含或同步以下 A 提交：

| Commit    | 合同                                                              |
| --------- | ----------------------------------------------------------------- |
| `bda23ac` | 同源 Pilot Browser runtime、Vite proxy 与 deterministic lifecycle |
| `c492c36` | Registration/Terms HTTP 安全语义                                  |
| `0b177cf` | Control API shared app/server Bootstrap                           |
| `94fabe1` | B baseline commit object/ancestor attestation                     |
| `c154b1e` | Pilot Browser Joint Gate phase activation                         |
| `018190d` | Migration rollback/reapply Joint Gate phase activation            |
| `96d6537` | Migration ops、TEST Commercial 与 Final Report 文档口径           |

尤其是：修改 `scripts/joint-gate-manifest.mjs` 或 `scripts/run-joint-gate.mjs` 前必须同步 `018190d`，不得恢复 `MIGRATION_ROLLBACK_GATE_NOT_IMPLEMENTED` 或把 migration phase 改回 `planned`。

## 5. 06E A/B 合同需要 B 明确确认

B Agent 必须逐项回答“支持 / 不支持 / 需要修改合同”，不能只回复“已完成”：

### 5.1 Storyboard Draft provenance

B draft 至少需要提供：

- canonical tenant/project/scriptVersion ID；
- approved Script payload digest；
- B draft revision ID；
- stable ordered Shot ID、sequence、duration、description、source mode；
- Command/Receipt provenance、生成策略版本、validation summary；
- immutable storyboard payload digest、createdAt；
- 明确 `draft`，不得暗示 A approval。

### 5.2 A-owned Storyboard authority

B 必须接受 A 负责保存和审批：

- Storyboard Version ID/version；
- `draft / approved / revoked / superseded`；
- append-only Approval Event；
- actor、actedAt、reason、fact-risk；
- idempotency、stale version、并发、跨 Scope 与 revoked approval fail closed。

B 页面不得把本地 Zustand、LocalStorage 或 Demo Storyboard 当作 Pilot 成功事实。

### 5.3 Production Package eligibility

B 必须确认：只有 approved Script 与 approved Storyboard 同时满足 tenant/project/version/digest 绑定时才能创建 Package。禁止继续从 Script payload 内嵌 Storyboard 推导正式批准事实。

### 5.4 Server-mediated Canvas Entry

冻结方向是 server-mediated bootstrap：

- raw Project Grant `accessToken` 不进入 DOM、React props、URL/query/hash、Storage、console、日志、trace、截图、report 或错误 envelope；
- 浏览器只接收 non-secret Canvas Entry receipt/handle，并继续使用真实 HttpOnly Session；
- Entry 必须 tenant/project/package 绑定、短时、单用途或具有明确 replay 语义；
- B Canvas 只消费经 introspection 验证的合法 Package/Grant；
- Pilot 不接受 `DemoProjectGrant`、`X-StoryCanvas-Demo-Grant` 或 Mock fallback。

如果 B runtime 当前不支持，必须在回复中列出最小合同缺口和建议修改路径；不要临时把 raw Grant 暴露给浏览器。

## 6. B Wave 4 交付边界

B 在 06E.3 负责：

- Pilot Script 页面改用 canonical Project 与 A strict client；
- Pilot Storyboard 页面接收 B draft，再调用 A authority 保存/审批；
- Canvas 页面只使用 non-secret Entry contract；
- Demo 路径可以保留，但必须与 Pilot mode/route 严格隔离；
- B-owned StoryCanvas runtime/security/page/type/build tests；
- tracked clean 的交付分支与明确 Provider 环境限制。

B 不应实现或改写：

- A-owned Auth、Session、Tenant/Channel/Platform 商业事实；
- A-owned Storyboard persistence/approval authority；
- A-owned Production Package eligibility；
- LIVE Payment、LIVE Commission、LIVE Settlement；
- 真实佣金比例、paid、提现、KYC、税务、发票、自动打款；
- 未规划的 review/approve HTTP；
- 正式 Provider 付费调用或生产 SLA 声明。

## 7. B 最低验证与安全证据

B 回复必须给出实际执行结果，不得把 NOT_RUN/SKIP 写成 PASS：

```bash
npm --prefix apps/storycanvas run build
npm run build
npm run validate:governance
git diff --check
git diff --cached --check
git status --short --branch
```

并列出 B 实际运行的 StoryCanvas targeted tests。若 PostgreSQL、Chrome、Provider 或依赖环境不可用，明确写 `BLOCKED` 和原因；Provider unavailable 只证明 fail closed，不证明媒体质量或生产 SLA。

安全证据必须说明：

- Pilot 失败不回退 Demo/Mock/localStorage；
- DOM/URL/Storage/console/error/artifact 无 Session、密码、Invitation/verification Token、raw Grant、token digest、payload digest、内部 snapshot、SQL 或 stack；
- StoryCanvas tracked diff 与提交文件清单一致；
- 不修改 A-owned 文件，任何 shared 文件单独列出。

## 8. B Agent 回复模板

请在 `B_TO_A_AGENT_WAVE4_BASELINE_RESPONSE_2026-08-10.md` 中完整填写：

```markdown
# B → A Wave 4 Baseline Response

- B branch:
- Previous HEAD:
- Aligned base (`origin/dev/business-plane` full SHA):
- New B HEAD (full 40-char SHA):
- Push result:
- StoryCanvas tracked clean: YES/NO
- Local untracked files and disposition:

## Delivered Wave 4 capabilities

- ...

## Commits

- `<sha> <subject>`

## Changed paths

- B-owned:
- Shared:
- A-owned: NONE / explain

## 06E contract answers

- Storyboard Draft provenance: SUPPORT / GAP
- A-owned Storyboard authority: SUPPORT / GAP
- Approved Script + Storyboard Package eligibility: SUPPORT / GAP
- Server-mediated non-secret Canvas Entry: SUPPORT / GAP
- Demo/Pilot strict isolation: SUPPORT / GAP

## Tests and zero-SKIP evidence

- command → PASS/FAIL/BLOCKED; counts; skips

## Security and redaction evidence

- ...

## Provider/environment limitations

- ...

## Requested A/shared changes

- ...
```

## 9. A 收到回复后的动作

A 在收到 B 完整 SHA 和回复文件后将：

1. 校验 commit object、branch ancestry、changed paths 和 StoryCanvas ownership；
2. 把 B baseline 非破坏性同步到 A 集成历史；
3. 重新验证 `JOINT_GATE_B_BASELINE_COMMIT` ancestor attestation；
4. 与 B 冻结 06E.1 Storyboard Authority / Bootstrap Contract；
5. 按 RED → Green 和 Owner 拆分继续 06E.1～06E.6；
6. 只有真实 Chrome/PostgreSQL A/B Golden Path 零 SKIP 后才激活 `ab-golden-path`；
7. 最后执行 06F.6 Full Joint Gate，不提前宣称 `A_BIZ_06_COMPLETE` 或 `JOINT_GATE_PASS`。
