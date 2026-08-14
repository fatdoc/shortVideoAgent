# CV6 · G1 Contract Gate Handoff

> Task: `T0-CV1-06 / CV6-B`
> Recorded: `2026-08-14T01:53:00+08:00`
> CV6 status: `READY_FOR_GATE`
> Recommendation to CV0: `G1 ACCEPTED`

## 1. Identity and tested chain

```text
employee: CV6
model: gpt-5.6-sol
reasoning: high
actual speed: client speed setting not exposed; no 1.5x claim made
worktree: /Users/docfat/.codex/worktrees/t0-cv1-contract-qa
branch: codex/t0-cv1-contract-qa
G1 QA baseline: 9432c54574cac9eb7f3d8e952d158b46c22f0c64
CV1-B fixtures/vectors: 1f2b2abd47e9b0a92730f61cf8d1ca63e7a60e96
CV6 initial RED: a5b3ac79ac35ce8bff463f8b5525d4e8588df3f0
CV1-C parser implementation: 898b3067f4d82e302e67fa735baf80e61c7fabe7
transparent merge: f37aa41f756feb0ed9f9440e1c32f90c8435d67b
tested CV6 GREEN head: a03432891d440c51d0906948adb84db6593fa50b
master plan: T0_CANVAS_V1_MASTER_PLAN.md v0.2, read in full
rules read in full: EMPLOYEE_RULES.md, AUTONOMY_PROTOCOL.md, CV6_QA_GATE_TASK.md
```

The transparent merge has the exact parents below. Both CV6's RED and CV1-C are
ancestors of the tested head; no reset, rebase, or force operation was used.

```text
f37aa41f756feb0ed9f9440e1c32f90c8435d67b
parents:
  a5b3ac79ac35ce8bff463f8b5525d4e8588df3f0
  898b3067f4d82e302e67fa735baf80e61c7fabe7
```

Verification:

```bash
git merge-base --is-ancestor a5b3ac79ac35ce8bff463f8b5525d4e8588df3f0 a03432891d440c51d0906948adb84db6593fa50b
git merge-base --is-ancestor 898b3067f4d82e302e67fa735baf80e61c7fabe7 a03432891d440c51d0906948adb84db6593fa50b
git show -s --format='%H%n%P%n%s' f37aa41f756feb0ed9f9440e1c32f90c8435d67b
git diff --check 1f2b2abd47e9b0a92730f61cf8d1ca63e7a60e96..a03432891d440c51d0906948adb84db6593fa50b
```

Result: **PASS** for both ancestor checks, exact merge parents, and diff-check.

## 2. CV6 scope and atomic commits

CV6 modified only its exclusive Gate/test/report write set. Product parsers,
schema, fixtures, vectors, Master Plan, historical v0.2/A3 tests, Shared RED,
and protected user paths remained read-only.

Initial fail-closed RED:

```text
a5b3ac79ac35ce8bff463f8b5525d4e8588df3f0
  scripts/t0-canvas-v1-gate/run-contract-gate.mjs
  tests/e2e/canvas-v1/contract-facts.gate.mjs
```

Execution-plane GREEN and independent parity:

```text
a03432891d440c51d0906948adb84db6593fa50b
  scripts/t0-canvas-v1-gate/run-contract-gate.mjs
  scripts/t0-canvas-v1-gate/vitest.contract.config.mjs
  tests/e2e/canvas-v1/contract-facts.gate.mjs
  tests/e2e/canvas-v1/parser-parity.gate.ts
```

The initial gate was 5 PASS / 1 RED with the exact reason
`CANVAS_V1_EXECUTION_PLANES_NOT_IMPLEMENTED`. After CV1-C arrived, the unchanged
mandatory-artifact assertion became GREEN. CV6 then added real execution of both
product planes and a separate per-vector parity test; the RED was not removed,
skipped, weakened, or rewritten into a tautology.

## 3. Environment and reproducible command

```text
host Node: v22.22.3
verified StoryCanvas Electron: v40.8.5
verified Vitest: 3.2.7
current QA worktree node_modules: intentionally absent
verified dependency source: /Users/docfat/.codex/worktrees/t0-cv1-qa
lock/dependency edits: none
```

The runner prefers dependencies installed in its own worktree. When they are
absent, `CANVAS_V1_VERIFIED_DEPS_ROOT` may identify the already validated G0 QA
dependency tree. It fails with exit 2 and `ENVIRONMENT_FAILURE` if neither source
is available. It does not install packages or edit lock files.

Full G1 command:

```bash
CANVAS_V1_VERIFIED_DEPS_ROOT=/Users/docfat/.codex/worktrees/t0-cv1-qa \
  node scripts/t0-canvas-v1-gate/run-contract-gate.mjs
```

Result:

| Phase | PASS | FAIL | SKIP/TODO | Result |
|---|---:|---:|---:|---|
| CV1 authority self-check | 5 | 0 | 0 | PASS |
| CV6 schema/fixture/matrix/security facts | 6 | 0 | 0 | PASS |
| StoryCanvas backend conformance | 4 | 0 | 0 | PASS |
| Frontend conformance | 4 | 0 | 0 | PASS |
| CV6 independent parser parity | 41 | 0 | 0 | PASS |
| **Total** | **60** | **0** | **0** | **CANVAS_V1_CONTRACT_GATE_PASS** |

Direct execution-plane commands used by the runner:

```bash
env ELECTRON_RUN_AS_NODE=1 \
  NODE_PATH=/Users/docfat/.codex/worktrees/t0-cv1-qa/apps/storycanvas/node_modules \
  /Users/docfat/.codex/worktrees/t0-cv1-qa/apps/storycanvas/node_modules/.bin/electron \
  /Users/docfat/.codex/worktrees/t0-cv1-qa/apps/storycanvas/node_modules/tsx/dist/cli.mjs \
  --test apps/storycanvas/src/contracts/canvas-v1/contracts.test.ts

/Users/docfat/.codex/worktrees/t0-cv1-qa/node_modules/.bin/vitest run \
  --root /Users/docfat/.codex/worktrees/t0-cv1-contract-qa \
  --config scripts/t0-canvas-v1-gate/vitest.contract.config.mjs

env ELECTRON_RUN_AS_NODE=1 \
  NODE_PATH=/Users/docfat/.codex/worktrees/t0-cv1-qa/apps/storycanvas/node_modules \
  /Users/docfat/.codex/worktrees/t0-cv1-qa/apps/storycanvas/node_modules/.bin/electron \
  /Users/docfat/.codex/worktrees/t0-cv1-qa/apps/storycanvas/node_modules/tsx/dist/cli.mjs \
  --test tests/e2e/canvas-v1/parser-parity.gate.ts
```

Direct results: backend **4/4 PASS**, frontend **4/4 PASS**, independent parity
**41/41 PASS**. An initial frontend launch against the repository's normal Vite
config could not resolve dependencies from this intentionally dependency-free
worktree. This was an environment resolution failure, not a product failure.
The committed isolated config disables unrelated browser setup and the verified
dependency source then produced the result above.

## 4. Independent conformance and security evidence

The 41 independent parity cases consist of:

```text
1 canonical fixture parity case: all 9 object types, both planes, no transformation
1 browser/server boundary case: 8 browser-safe + ProviderAssetBinding server-only
37 negative-vector cases: exact expected stable code on frontend and backend
2 positive semantics: same-command replay + stable document recovery under new session
```

All 37 vectors were executed independently against both parser implementations,
not merely counted. Each rejection was required to be an Error named
`CanvasV1ContractError`, and frontend code, backend code, and the frozen
`expectedCode` were required to be equal. Coverage includes:

- strict top-level/nested schema, UUID, timestamp, session, and provider states;
- tenant/project/package/session scope mismatch;
- recursive forbidden browser keys and values, server-only Provider binding,
  `asset://`, signed provider URL, grant/digest, bare confirmation, and raw
  idempotency authority;
- readiness AND-gate, deterministic reason ordering, entity binding, and
  high-cost approval;
- command payload matching, replay/idempotency conflict;
- document optimistic version conflict and expired-session rejection;
- accepted/task/output/receipt/failed event fact consistency.

The separate facts gate recursively walks every browser-safe canonical fixture.
No forbidden key or value marker was found. Test output contains case names and
stable safe error codes only; mutation values, credentials, grants, Provider raw
bodies, absolute data roots, and raw authority were not printed.

## 5. Historical failure isolation and protected paths

The G0 classifications remain unchanged and were not folded into G1:

```text
KNOWN_BASELINE_FAILURE-01: historical Shared RED, root 431 PASS / 4 FAIL
KNOWN_BASELINE_FAILURE-02: historical stale A3 outer 9/10, child 4/10
ENVIRONMENT_BLOCKED-01: dedicated _test PostgreSQL absent for full Control API/joint gate
```

Verification:

```bash
git diff --name-only \
  1f2b2abd47e9b0a92730f61cf8d1ca63e7a60e96..a03432891d440c51d0906948adb84db6593fa50b \
  -- tests/e2e/pilot apps/storycanvas/src/contracts/v0.2 scripts/run-joint-gate.mjs
```

Result: empty. No historical RED/A3/v0.2 file changed. Those known failures are
not attributed to Canvas V1 and were not rerun as a prerequisite for this
targeted G1 recommendation.

Protected main-workspace evidence after the final G1 run:

```text
path: apps/storycanvas/data/vendor/byteplus.ts
git status: ?? (user-owned, still untracked)
size: 0
mtime epoch: 1786203378
inode: 155151110
```

The protected file is absent from every CV6 commit and was not modified,
deleted, staged, or committed.

## 6. G1 recommendation, rollback, and unfinished work

CV6 recommendation to CV0:

```text
G1: READY_FOR_GATE
recommended CV0 decision: ACCEPTED
```

Rationale: schema/index/fixtures/matrix are internally consistent; all canonical
fixtures remain unchanged; all 37 negative vectors return the frozen stable code
on both execution planes; browser/server authority containment passes; readiness,
approval, idempotency, document, and event semantics pass; and the independent
Gate is fail-closed with zero skip/todo.

CV6 does **not** edit the Master Plan and does not itself mark G1 `ACCEPTED` or
claim `CANVAS_V1_CONTRACT_FROZEN`. CV0 owns that decision and state update.

Rollback:

```text
revert a03432891d440c51d0906948adb84db6593fa50b to remove GREEN runner/parity wiring
revert a5b3ac79ac35ce8bff463f8b5525d4e8588df3f0 to remove the original CV6 RED/facts gate
CV1 parser and contract files require no CV6 rollback because CV6 never edited them
```

Unfinished and still prohibited claims:

```text
G2-G6 are not accepted by this handoff
dedicated PostgreSQL, real browser, paid Provider, MP4, Golden Path, and full Joint Gate remain unfinished
historical Shared RED and stale A3 remain preserved
AB_GOLDEN_PATH_NOT_IMPLEMENTED
FULL_JOINT_GATE_STILL_BLOCKED
```

Downstream first step: CV0 independently verifies the commit objects, exact paths,
targeted Gate result, protected-file evidence, and then alone records the G1
decision before allowing G1-dependent product work.
