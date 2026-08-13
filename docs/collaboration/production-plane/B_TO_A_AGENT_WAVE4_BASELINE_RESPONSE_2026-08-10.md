# B → A Wave 4 Baseline Response

- Request: `A-B-ALIGN-2026-08-10-W4`
- Response date: 2026-08-11
- B branch: `origin/dev/production-plane`（本地安全工作分支：`codex/wave4-baseline-alignment-20260811`）
- Previous HEAD: `84d922cc39a8c3b6c24d29dfd960c71655f34c64`
- Aligned base (`origin/dev/business-plane` full SHA): `c449508d2ad13e68cb55680cb882cac91de83325`
- New B HEAD (full 40-char SHA): 由本回复文件的提交完成后通过交接消息提供；Git 提交不能在不改变自身 SHA 的前提下把自身 SHA 写入自身内容。
- Push result: 本文件提交后以非 force push 更新 `origin/dev/production-plane`；完整远程 HEAD 通过交接消息提供。
- StoryCanvas tracked clean: YES；相对 aligned base，本回复提交不修改任何 StoryCanvas、脚本、分镜或画布 tracked path。
- Local untracked files and disposition: 原主工作区的 `apps/storycanvas/data/vendor/byteplus.ts` 保持未跟踪，未复制、未修改、未删除、未暂存、未提交；它不属于本次 baseline 交付。原主工作区其他未提交/未跟踪 UI、output、tmp 文件也保持原状。本次对齐在独立 worktree 完成。

## Delivered Wave 4 capabilities

- 将 B 远程基线从旧 D2 HEAD 无冲突、非破坏性 fast-forward 到 A 当前完整 HEAD `c449508d2ad13e68cb55680cb882cac91de83325`；同步范围包含 A 指定的 `bda23ac`、`c492c36`、`0b177cf`、`94fabe1`、`c154b1e`、`018190d`、`96d6537` 及其祖先链。
- 同步后的历史包含已提交的 B-owned StoryCanvas 能力：Pilot media readiness、安全 project/task/asset scoped remote output storage、默认关闭且显式受控的 BytePlus TTS port、Pilot v0.2 contract receiver，以及 grant receiver fail-closed hardening。
- v0.2 receiver 当前能验证冻结 Schema/fixtures、服务端 Grant introspection、Scope/capability/expiry/digest、幂等 replay/conflict 和安全错误；Generation Command 仍保持 `providerSubmitted=false`，不得描述为真实 Provider 提交。
- 本次没有实现或宣称 06E.3 Pilot Script/Storyboard/Canvas 页面、真实媒体质量、付费 Provider、生产 SLA 或 Full Joint Gate PASS。

## Commits

- `2c706b30e4b8fda3bcf188c5b1264fd0db1d274c feat(storycanvas): expose pilot media readiness`
- `40e4ab68ede7389eaa2f9933b29fd26eb55553e7 feat(storycanvas): add scoped remote output storage`
- `3bd7e19a45e9cbd59637d174e7ea2e38f4218166 feat(storycanvas): gate BytePlus TTS provider port`
- `90627d24c18f4b583966bc6f7489c4410eeeba9d feat(storycanvas): receive pilot v0.2 contracts`
- `54e467a0a3f5b474d1cfbd114cbe6183c864622c fix(storycanvas): harden pilot grant receiver`
- 本回复的 documentation-only commit：完整 40 位 SHA 在提交完成后通过交接消息提供，原因同上，不能自引用写入提交内容。

## Changed paths

- B-owned: NONE in the response commit. Baseline fast-forward only synchronizes already committed history.
- Shared: NONE in the response commit.
- A-owned: NONE in the response commit.
- Response-only: `docs/collaboration/production-plane/B_TO_A_AGENT_WAVE4_BASELINE_RESPONSE_2026-08-10.md`.

## 06E contract answers

- Storyboard Draft provenance: **GAP**. B 接受第 5.1 节字段要求，但当前 B runtime 尚未提供同时包含 canonical tenant/project/scriptVersion、approved Script digest、稳定 draft revision/Shot、Command/Receipt provenance、生成策略、validation summary、immutable payload digest 与 `createdAt` 的正式 `StoryboardDraftRevision`。不得把现有 Demo Storyboard 当作该合同实现。
- A-owned Storyboard authority: **SUPPORT**. B 接受 A 保存 canonical Storyboard Version、状态和 append-only Approval Event，并负责 stale/concurrency/idempotency/cross-scope/revoked fail-closed。B 只产出 draft，不写 A 表、不声明批准。当前 A authority HTTP/strict client 尚待 06E.1/06E.2 落地，因此端到端仍为 GAP。
- Approved Script + Storyboard Package eligibility: **SUPPORT**. B 接受只有同 tenant/project/scriptVersion/digest 绑定的 approved Script 与 approved Storyboard 才能创建 Package；不接受从 Script payload 内嵌 Storyboard 推导批准事实。当前实现需由 A 移除该正式资格捷径后才能进入 Golden Path。
- Server-mediated non-secret Canvas Entry: **GAP**. B 支持 server-mediated 方向，但当前统一 SaaS Canvas 仍没有 non-secret Entry receipt/handle 合同，现有 Demo Grant/Bridge 不能用于 Pilot。raw Grant 不得进入 DOM、React props、URL、Storage、console、日志、trace、截图、report 或错误 envelope。
- Demo/Pilot strict isolation: **GAP**. 合同方向支持；当前 Demo 路径可以保留，但 06E.3 Pilot Script/Storyboard/Canvas 页面尚未完成真实 strict client/Entry 接线，因此不能声明 Pilot 隔离 Gate PASS，也不能在 Pilot 失败时回退 Demo/Mock/localStorage。

## Tests and zero-SKIP evidence

- `node scripts/run-storycanvas-v02-targeted.mjs` → PASS；13/13 tests，0 fail，0 skip。
- `NODE_ENV=test ... node node_modules/tsx/dist/cli.mjs --test src/services/storycanvas/pilotMediaReadiness.test.ts src/services/storycanvas/remoteOutputStorage.test.ts src/services/storycanvas/byteplusTts.test.ts`（在 `apps/storycanvas` 执行，Provider credentials 显式为空）→ PASS；17/17 tests，0 fail，0 skip。
- `npm --prefix apps/storycanvas run build` → PASS。
- `npm run build` → PASS；Vite 仅报告既有大 chunk warning。
- `npm run validate:governance` → PASS。
- `git diff --check` → PASS。
- `git diff --cached --check` → PASS。
- `npm --prefix apps/storycanvas test` 全量套件 → NOT_RUN；本次按 Joint Gate 冻结 runner执行 v0.2 与 Wave 4 media/storage/TTS targeted suites，共 30/30 PASS / 0 SKIP，不把未运行套件写成 PASS。
- PostgreSQL、Chrome、LIVE/paid Provider → NOT_RUN for this documentation-only baseline alignment。A 历史中的既有 06D/06F 证据没有被 B 伪装成本轮重跑结果。

## Security and redaction evidence

- v0.2 targeted suite 证明 Schema/fixture byte alignment、digest tamper rejection、Grant introspection fail-closed、Scope/capability/expiry 拒绝发生在写副作用前，并覆盖幂等 replay/conflict 与安全 StandardError。
- Wave 4 targeted suite 证明 TTS 缺配置时默认关闭、未注册协议在网络调用前拒绝、只报告 credential name 不返回 value；remote storage key 防目录穿越、按 project/task/asset scope、错误不回显 credential 或 provider response body。
- 测试显式清空 `ARK_API_KEY`、`BYTEPLUS_TTS_ACCESS_TOKEN`、`BYTEPLUS_TTS_APP_ID`，没有进行付费或真实 Provider 调用。
- 当前 Pilot 页面仍有第 06E 节所列 GAP，因此本回复不声称已证明端到端 DOM/URL/Storage/console/artifact 无 raw Grant，也不声称 Pilot 页面已无 Demo fallback；这些必须在 06E.3～06E.5 真实浏览器 Gate 证明。
- Response commit 的 tracked diff 仅包含本回复文件；A-owned、shared 和 StoryCanvas tracked path 均无新增修改。

## Provider/environment limitations

- `apps/storycanvas/data/vendor/byteplus.ts` 是原主工作区 local-only 未跟踪文件，未纳入远程 baseline；它的存在不能作为 Provider ready、凭据有效或生产 SLA 证据。
- BytePlus TTS adapter 已受配置、协议、credential-name 与幂等边界保护，但本次未调用真实 TTS。
- 图片、视频、TTS、对象存储真实供应商质量、成本、限流、区域可用性和 SLA 均未在本次对齐中验证。
- Provider unavailable 只能证明 fail closed，不能证明媒体质量或正式生产能力。

## Requested A/shared changes

- 先在 06E.1 冻结并实现 Storyboard Draft/Version/Approval DTO、digest、fixture、稳定错误码、幂等与并发合同；A 继续作为 Storyboard persistence/approval authority。
- A 在 06E.1/06E.2 提供 approved Script + approved Storyboard 强绑定的 Production Eligibility/Package，以及基于 HttpOnly Session 的 non-secret Canvas Entry create/read strict client。
- A/B 在独立共享提交中冻结 server-mediated Canvas Entry receipt/handle、TTL、single-use/replay、tenant/project/package binding 与 B introspection 语义；不得把 raw Grant 暴露给浏览器。
- A 提供 route manifest/strict client 后，B 再按 06E.3 独立实现 Pilot Script/Storyboard/Canvas pages；共享 Router/Bridge 留到 06E.4 独立提交。
- A 同步本回复 commit 后验证 commit object 与 ancestor；在 B handoff commit 进入集成历史前，不得填写 `JOINT_GATE_B_BASELINE_COMMIT` 或移除 `AB_GOLDEN_PATH_NOT_IMPLEMENTED`。
- Full Joint Gate 继续保持 `FULL_JOINT_GATE_STILL_BLOCKED`，直到 06E.5 真实 Chrome/PostgreSQL A/B Golden Path 零 SKIP 且所有 required phases 通过。

## Baseline alignment blockers resolved and remaining

- 已解决：本地 `remote.origin.fetch` 原先只跟踪 `main`，普通 `git fetch origin` 不生成 `origin/dev/business-plane` / `origin/dev/production-plane`；本次已显式获取两条远程分支。
- 已解决：请求文档成文时记录 A baseline `96d6537`，但当前远程 A HEAD 已前移到 `c449508d2ad13e68cb55680cb882cac91de83325`；本次按当前完整 HEAD 对齐。
- 已解决：B 远程旧 HEAD 相对 A 为 `0 behind on B-only / 217 ahead on A`，无分叉、无未推送 B commit 冲突，因此使用 `--ff-only` 安全对齐。
- 已解决：原主工作区未提交/未跟踪成果与 baseline 操作隔离，没有被覆盖或清理。
- 仍阻塞：06E.1 Storyboard authority/bootstrap contract、06E.2 A strict client、06E.3 B Pilot pages、06E.4 shared activation、06E.5 real browser Golden Path、06E.6 Joint Gate activation；不得把 Git baseline 对齐解释为这些功能已完成。
