# CV6 · G0 Baseline Handoff

> Task: `T0-CV1-06 / CV6-A`
> Recorded: `2026-08-14T01:29:55+08:00`
> Recommendation: `ACCEPT_WITH_KNOWN_BASELINE_FAILURES`

## 1. Identity, configuration, and boundary

```text
employee: CV6
model: gpt-5.6-sol
reasoning: high
actual speed: client speed setting not exposed; no 1.5x claim made
repository/worktree: /Users/docfat/.codex/worktrees/t0-cv1-qa
branch: codex/t0-cv1-qa
frozen baseline: 413322708b35da7a158f45bdb329416b39238e52
upstream main baseline: 19582cbf16e1414f884f9864f7c0d372640cb26a
master plan: T0_CANVAS_V1_MASTER_PLAN.md v0.1, read in full
rules read in full: EMPLOYEE_RULES.md, AUTONOMY_PROTOCOL.md, CV6_QA_GATE_TASK.md
```

CV6's G0 write set was limited to this report under
`docs/program/t0-canvas-v1/handoffs/CV6_*.md`. Product code, the Master Plan,
Shared Green, Canvas V1 implementation, historical RED tests, and all protected
user paths were explicit no-write/no-stage/no-commit scope.

## 2. Git baseline and isolation proof

Fresh fetch:

```bash
git fetch origin main
git rev-parse origin/main
git rev-parse FETCH_HEAD
```

Result: **PASS**. Both refs resolved to
`19582cbf16e1414f884f9864f7c0d372640cb26a`.

Ancestor and frozen delta:

```bash
git merge-base 19582cbf16e1414f884f9864f7c0d372640cb26a 413322708b35da7a158f45bdb329416b39238e52
git merge-base --is-ancestor 19582cbf16e1414f884f9864f7c0d372640cb26a 413322708b35da7a158f45bdb329416b39238e52
git rev-list --count 19582cbf16e1414f884f9864f7c0d372640cb26a..413322708b35da7a158f45bdb329416b39238e52
git diff --name-status 19582cbf16e1414f884f9864f7c0d372640cb26a..413322708b35da7a158f45bdb329416b39238e52
git diff --check 19582cbf16e1414f884f9864f7c0d372640cb26a..413322708b35da7a158f45bdb329416b39238e52
```

Result: **PASS**. The merge base is the upstream SHA, `--is-ancestor` exits 0,
and the range is one direct child commit. Its exact delta is eight added docs,
zero product paths:

```text
docs/program/t0-canvas-v1/T0_CANVAS_V1_MASTER_PLAN.md
docs/program/t0-canvas-v1/tasks/CV0_MASTER_INTEGRATION_TASK.md
docs/program/t0-canvas-v1/tasks/CV1_CONTRACT_ARCHITECT_TASK.md
docs/program/t0-canvas-v1/tasks/CV2_ASSET_PRODUCTION_BACKEND_TASK.md
docs/program/t0-canvas-v1/tasks/CV3_CANVAS_AGENT_TASK.md
docs/program/t0-canvas-v1/tasks/CV4_CANVAS_UI_TASK.md
docs/program/t0-canvas-v1/tasks/CV5_BUSINESS_INTEGRATION_TASK.md
docs/program/t0-canvas-v1/tasks/CV6_QA_GATE_TASK.md
```

Worktree isolation:

```bash
git rev-parse --show-toplevel
git branch --show-current
git rev-parse --git-common-dir
git rev-parse --git-dir
git worktree list --porcelain
```

Result: **PASS**. The QA top level is the dedicated path above; its private Git
directory is `.git/worktrees/t0-cv1-qa`, its branch is unique, and it is not the
main user workspace.

## 3. Environment preparation and classification

Observed runtimes:

```text
default node: v22.22.3
canonical compatibility rerun node: v20.19.6
StoryCanvas Electron: 40.8.5, embedded Node ABI 143
Hermes node: v22.22.3, ABI 127
```

Dependency preparation was local to this worktree:

```bash
npm ci
npm ci --prefix apps/control-api
cd apps/storycanvas && yarn install --frozen-lockfile
cd apps/storycanvas && ./node_modules/.bin/electron-rebuild --force --only better-sqlite3
```

- Root and Control API install: **PASS**.
- First StoryCanvas install: **ENVIRONMENT FAILURE**. Electron download ended in
  `socket hang up` / `ETIMEDOUT 20.205.243.166:443`.
- Bounded recovery: the already present local Electron 40.8.5 archive had the
  exact SHA-256 listed in Electron's checked-in checksums; using that cache made
  frozen-lockfile install **PASS**. No dependency or lock file was edited.
- The first Electron test run exposed a native ABI 127/143 mismatch. The declared
  `electron-rebuild` tool rebuilt only the ignored worktree dependency, after
  which the prescribed StoryCanvas suite passed. This is an environment repair,
  not a product change.

## 4. G0 matrix

| Matrix item | Exact result | Classification |
|---|---:|---|
| Root unit suite | 431 PASS / 4 FAIL / 0 SKIP; 47 files PASS / 3 files FAIL | **KNOWN BASELINE FAILURE** |
| Cross-plane contract gate | 9 PASS / 1 FAIL / 0 SKIP at outer gate; A3 child 4 PASS / 6 FAIL | **KNOWN BASELINE FAILURE** |
| StoryCanvas package suite | 69 PASS / 0 FAIL / 0 SKIP | **PASS** |
| StoryCanvas v0.2 four-suite matrix | 13 PASS / 0 FAIL / 0 SKIP through ABI-compatible Electron Node | **PASS** |
| Media/TTS/Storage | 17 PASS / 0 FAIL / 0 SKIP | **PASS** |
| Control API suite without PostgreSQL | 447 PASS / 0 FAIL / 236 SKIP; 51 files PASS / 33 SKIP | **ENVIRONMENT_BLOCKED / PARTIAL**, not full PASS |
| Root build | PASS; existing Vite chunk-size warning only | **PASS** |
| Control API build + typecheck | PASS / PASS | **PASS** |
| StoryCanvas build | PASS | **PASS** |
| Governance | PASS | **PASS** |
| Repository diff-check | PASS for unstaged, staged, and StoryCanvas tracked checks | **PASS** |
| Full Joint Gate runner | exit 2, no phases executed | **BLOCKED as designed** |
| Real browser / paid Provider / G6 | NOT RUN in Wave 0 G0 | **NOT REQUIRED FOR G0** |

### 4.1 Exact commands

Root and contract:

```bash
npm test
env PATH='/Users/docfat/.nvm/versions/node/v20.19.6/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' \
  node tests/e2e/pilot/run-contract-gate.mjs
```

StoryCanvas:

```bash
env PATH='/Users/docfat/.nvm/versions/node/v20.19.6/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' \
  ARK_API_KEY='' BYTEPLUS_TTS_ACCESS_TOKEN='' BYTEPLUS_TTS_APP_ID='' \
  npm --prefix apps/storycanvas test

cd apps/storycanvas && \
env ELECTRON_RUN_AS_NODE=1 NODE_ENV=test ARK_API_KEY='' \
  BYTEPLUS_TTS_ACCESS_TOKEN='' BYTEPLUS_TTS_APP_ID='' \
  ./node_modules/.bin/electron node_modules/tsx/dist/cli.mjs --test \
  src/contracts/v0.2/runtime.test.ts \
  src/contracts/v0.2/security.test.ts \
  src/routes/production/v0.2/index.test.ts \
  src/services/storycanvas/pilotV02Receiver.test.ts

cd apps/storycanvas && \
env ELECTRON_RUN_AS_NODE=1 NODE_ENV=test ARK_API_KEY='' \
  BYTEPLUS_TTS_APP_ID='' BYTEPLUS_TTS_ACCESS_TOKEN='' \
  BYTEPLUS_TTS_SECRET_KEY='' BYTEPLUS_TTS_API_KEY='' \
  STORYCANVAS_REMOTE_OUTPUT_ENDPOINT='' \
  STORYCANVAS_REMOTE_OUTPUT_ACCESS_KEY_ID='' \
  STORYCANVAS_REMOTE_OUTPUT_SECRET_ACCESS_KEY='' \
  ./node_modules/.bin/electron node_modules/tsx/dist/cli.mjs --test \
  src/services/storycanvas/pilotMediaReadiness.test.ts \
  src/services/storycanvas/remoteOutputStorage.test.ts \
  src/services/storycanvas/byteplusTts.test.ts
```

The checked-in `node scripts/run-storycanvas-v02-targeted.mjs` chose Hermes ABI
127 after the Electron ABI rebuild and therefore produced 6 PASS / 7 FAIL with
`ERR_DLOPEN_FAILED`. The four exact suites were then run, without skip or test
changes, through the installed Electron Node ABI 143 and passed 13/13. The runner
failure is retained as **ENVIRONMENT FAILURE**; the equivalent suite result is
the executable product evidence.

Control, builds, and governance:

```bash
env -u CONTROL_API_TEST_DATABASE_URL npm --prefix apps/control-api test
npm run build
npm --prefix apps/control-api run build
npm --prefix apps/control-api run typecheck
npm --prefix apps/storycanvas run build
npm run validate:governance
git diff --check
git diff --cached --check
git diff --quiet -- apps/storycanvas
git diff --cached --quiet -- apps/storycanvas
node scripts/run-joint-gate.mjs --plan
node scripts/run-joint-gate.mjs --full
```

StoryCanvas build regenerates tracked `apps/storycanvas/data/serve/app.js`.
After validating the build, that generated worktree artifact was restored to its
exact frozen `HEAD` content. Final StoryCanvas staged and unstaged diffs are both
zero; no product code enters the CV6 commit.

## 5. Real failure classification

### KNOWN_BASELINE_FAILURE-01 · historical Shared RED remains red

`npm test` retains the existing required RED contract and does not skip or weaken
it:

```text
src/services/pilotStoryCanvasBridge.test.ts        1 FAIL
src/app/Router.pilot.test.tsx                      1 FAIL
src/config/pilotE2eProxy.test.ts                   2 FAIL
```

The failures are the already documented missing Shared bridge, fail-closed
Router state, and Golden Path StoryCanvas proxy behavior. They are not caused by
the docs-only T0-CV1 delta and must not be blamed on later Canvas V1 changes.

### KNOWN_BASELINE_FAILURE-02 · historical A3 contract gate is stale

At the frozen baseline, `run-contract-gate.mjs` passes 9/10 outer tests. Its A3
child passes 4/10 and fails 6/10 because the frozen gate constructs the older
PublicSession/Package v0.2 test shape, while current product code requires
`activeContext`, a `ProjectPolicy`, `storyboardVersionId`, `expiresInSeconds`,
and Package v0.3. The stale fixture reaches safe 500 responses rather than the
old expected 201/403/422 values.

This is a real baseline test failure. G1 must add independent Canvas V1
conformance; it must not rewrite or weaken this historical frozen v0.2 gate.

### ENVIRONMENT_BLOCKED-01 · dedicated PostgreSQL absent

`CONTROL_API_TEST_DATABASE_URL` was absent, so the Control API command reported
236 explicit skips. The full Joint Gate correctly refused execution with:

```text
CONTROL_API_TEST_DATABASE_URL_REQUIRED
JOINT_GATE_B_BASELINE_ATTESTATION_REQUIRED
AB_GOLDEN_PATH_NOT_IMPLEMENTED
```

No `_test` database was invented, and the partial Control API exit 0 is not
reported as full database PASS.

### PRODUCT_REGRESSION

**None attributable to T0-CV1.** The frozen delta is docs-only and no Canvas V1
product implementation exists in this G0 slice. This does not turn any known RED
or missing Golden Path into PASS.

## 6. Protected user-file attestation

Before and after the matrix, the main workspace reported the protected files as
untracked. For the specifically protected file:

```text
path: apps/storycanvas/data/vendor/byteplus.ts
tracked/staged entry: none
size: 0
sha256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
mtime_epoch: 1786203378
inode: 155151110
mode: -rw-r--r--
```

All values were identical before and after. Main-workspace unstaged and staged
diffs for that path were empty. The file is absent from the QA worktree, and no
CV6 add/commit command targeted it. The other protected docs/UI/assets/output/tmp
paths remained untracked in the main workspace; CV6 did not write, delete, move,
stage, or commit them.

Reproducible protection probe:

```bash
git -C '/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent2/videoagent' \
  status --short --untracked-files=all -- \
  apps/storycanvas/data/vendor/byteplus.ts \
  docs/ui/VIDEOAGENT_STORE_SIMPLE_UI_V3.md \
  docs/ui/VIDEOAGENT_UI_SUITE_V2.md docs/ui/assets output tmp
git -C '/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent2/videoagent' \
  ls-files --stage -- apps/storycanvas/data/vendor/byteplus.ts
shasum -a 256 \
  '/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent2/videoagent/apps/storycanvas/data/vendor/byteplus.ts'
stat -f 'size=%z mtime_epoch=%m inode=%i mode=%Sp' \
  '/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent2/videoagent/apps/storycanvas/data/vendor/byteplus.ts'
```

## 7. G0 recommendation and downstream stop line

Recommendation to CV0:

```text
G0: ACCEPT_WITH_KNOWN_BASELINE_FAILURES
```

Rationale: fetch/SHA, ancestor chain, exact docs-only delta, worktree isolation,
protected paths, runnable StoryCanvas matrices, builds, governance, and diff
checks are proven. The known Shared RED and stale A3 gate are precisely frozen,
and the missing dedicated PostgreSQL environment is explicit.

This recommendation only permits dependency-disciplined Wave 1 work. It does
not enter Shared Green, does not accept G1-G6, and does not permit any of:

```text
REAL_EDITOR_LOADED
CANVAS_V1_COMPLETE
AB_GOLDEN_PATH_COMPLETE
JOINT_GATE_PASS
FULL_JOINT_GATE_PASS
```

G1's first QA action must be a new Canvas V1 conformance suite against the
frozen Canvas V1 contracts, while preserving the baseline classifications above.

## 8. Commit, rollback, and handoff

```text
baseline SHA: 413322708b35da7a158f45bdb329416b39238e52
final SHA: the atomic report commit containing this file; supplied in CV6's external handoff message
atomic commit: CV6-A test(gate): record t0-cv1 baseline matrix
exact changed path: docs/program/t0-canvas-v1/handoffs/CV6_G0_BASELINE_HANDOFF.md
implemented product contracts: none (G0 read-only product baseline)
unfinished: G1-G6; dedicated PostgreSQL/browser/Provider Golden Path; all known Shared RED
rollback: revert the single CV6-A report commit; no product rollback is required
downstream first step: CV0 records the G0 decision, then CV1/CV6 establish independent Canvas V1 conformance for G1
```
