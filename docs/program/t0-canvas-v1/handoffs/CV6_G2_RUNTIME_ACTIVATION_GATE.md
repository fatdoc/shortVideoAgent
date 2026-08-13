# CV6 G2 Runtime Activation independent gate

> Task: `T0-CV1-06`
>
> Original integration baseline: `e32c4c56a2627157db41b7332b23b8072a0cf6f8`
>
> Revalidated integration head: `c5fcb88f9b82722d7dba5ebdd5ee21c8eeee250f`
>
> QA evidence head before this handoff: `bd96a0ffee14190d4c6833f633be0fed53a65426`
>
> CV6 recommendation: `READY_FOR_GATE`

This is an independent G2 recommendation. It does not edit the Master Plan or
declare G2 accepted. CV0 alone owns the program Gate decision.

## Configuration, branch and merge provenance

CV6 ran with `gpt-5.6-sol` and `high` reasoning. The client speed setting was
not observable, so no `1.5x` claim is made.

```text
worktree: /Users/docfat/.codex/worktrees/t0-cv1-cv6-g2-runtime-activation-gate
branch:   codex/t0-cv1-cv6-g2-runtime-activation-gate
```

CV6 first committed the independent RED on the requested original integration
baseline, then used only normal merges for the descendant remediation heads:

```text
17779146a674b44d513fb8bab11cbaf70fc485c0
  parent 1: ed5d3d7d8c0ed16e019acbc4ed79779f05eea8ae
  parent 2: a8311c275c7a1de2e2dc63d8757bb66f48cc70a6

935fabc4cfdc9559267db793fb45e50f74a0e0af
  parent 1: 17779146a674b44d513fb8bab11cbaf70fc485c0
  parent 2: c5fcb88f9b82722d7dba5ebdd5ee21c8eeee250f
```

No rebase, reset, cherry-pick or manual product copy was used. The product
files introduced by those merge parents are explicitly not part of the CV6
write set.

## Independent runtime result

The initial Gate reproduced twelve product REDs: non-exact Control actions,
top-level/action command ID drift, browser-selected approval TTLs, generic
approval minting, GENERATE-specific checks applied to other high-cost commands,
and missing SYNC/BIND/SELECT runtime adapters. The two owner remediation heads
closed every reproduced RED.

Final independent suites:

```bash
CANVAS_V1_VERIFIED_DEPS_ROOT=/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent2/videoagent \
  node_modules/.bin/vitest run \
  --config scripts/t0-canvas-v1-gate/vitest.g2-runtime-approval-boundary.config.mjs \
  --reporter=dot
```

```text
3 files / 23 tests PASS / 0 FAIL / 0 SKIP / 0 TODO
```

```bash
CANVAS_V1_VERIFIED_DEPS_ROOT=/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent2/videoagent \
  node_modules/.bin/vitest run \
  --config scripts/t0-canvas-v1-gate/vitest.g2-runtime-provider.config.mjs \
  --reporter=dot
```

```text
3 files / 18 tests PASS / 0 FAIL / 0 SKIP / 0 TODO
```

The combined matrix proves:

- internal Control consume authenticates before parsing, uses strict bounded
  JSON at 64 KiB, and returns only a fixed safe envelope/projection;
- browser prepare and internal consume require exact
  `action={commandId,payload}`, literal browser TTL `60`, exact active Canvas
  session, same-command replay and changed-command conflict;
- the Story client sends exact scope/action, retries one exact response-loss
  consume, and rejects status/shape/body drift;
- runtime authority accepts only exact ready ProjectProductionPackage `0.3`
  under one unique canonical project mapping;
- all five high-cost commands consume Control approval, while
  `SYNC_PROVIDER_ASSET` with `approvalId=null` reaches the adapter without an
  approval consume;
- readiness and Package authority run before paid Provider submission;
- same command response-loss recovery never repeats Provider start; an unknown
  queued task fails closed without a second submission;
- local task persistence precedes Provider submission, the real external task
  ID is durable before `task_created`, same hook ID is idempotent, changed hook
  ID poisons the task, missing hook fails bounded, and returned external ID
  drift is rejected before output registration;
- SYNC/BIND resolve unique server mappings, reject mapping/provider identity
  drift, and BIND advances continuity exactly once only from authorized,
  approved and active facts;
- SELECT accepts only one generated output belonging to one succeeded Canvas
  task in the exact local project;
- browser/task projections expose safe UUIDs and fixed errors, not raw Provider
  body, signed URL, `asset://`, internal mapping, credential or secret data;
- missing any required Seedance/TOS credential keeps production fail-closed.

## Owner and database evidence

Control targeted authority suite:

```text
6 files / 60 tests PASS
```

StoryCanvas runtime/readiness/command/router/migration suite:

```text
54/54 PASS
```

Dedicated PostgreSQL evidence used only:

```text
CONTROL_API_TEST_DATABASE_URL=postgresql://localhost/videoagent_control_test
current_database() = videoagent_control_test
```

Serial results:

```text
asset repository + session authority: 5 PASS / 2 inverse-guard SKIP
full migration chain:                  1 PASS
```

No connection to `videoagent_control` was made.

Dynamic UI approval composition remained green:

```text
4 files / 71 tests PASS
```

## Contract, regression and build evidence

```text
Canvas V1 aggregate/activation validators: 6/6 + 6/6 PASS
CV6 full contract Gate:                    66/66 PASS
StoryCanvas v0.2 + Media/TTS/Storage:      21/21 PASS
Control API build:                         PASS
StoryCanvas build:                         PASS
Root TypeScript/Vite build:                PASS
Governance:                                PASS
git diff --check:                          PASS
```

The root suite remains exactly classified as expected:

```text
483 PASS / 4 historical Shared RED
```

The four old Shared failures remain Router/Proxy/Bridge activation REDs. They
were not deleted, skipped, weakened or reported as G2 failures.

StoryCanvas build regenerated `apps/storycanvas/data/serve/app.js`; CV6 restored
the exact HEAD diff after build. No generated artifact is in the write set.

## CV6 exact write set and commits

Atomic commits:

```text
ed5d3d7d8c0ed16e019acbc4ed79779f05eea8ae
  test(gate): freeze canvas runtime activation

8491ebaba0f61f6a38969f1a5a84673e169d4bc6
  test(gate): revalidate runtime asset adapters

bd96a0ffee14190d4c6833f633be0fed53a65426
  fix(gate): separate activation transport fixture
```

Exact CV6 paths relative to revalidated integration head:

```text
scripts/t0-canvas-v1-gate/vitest.g2-runtime-approval-boundary.config.mjs
scripts/t0-canvas-v1-gate/vitest.g2-runtime-provider.config.mjs
tests/e2e/canvas-v1/contract-facts.gate.mjs
tests/e2e/canvas-v1/runtime-approval-boundary.gate.test.ts
tests/e2e/canvas-v1/runtime-approval-prepare.gate.test.ts
tests/e2e/canvas-v1/runtime-asset-adapters.gate.test.ts
tests/e2e/canvas-v1/runtime-command-cost-parity.gate.test.ts
tests/e2e/canvas-v1/runtime-production-wiring.gate.test.ts
tests/e2e/canvas-v1/runtime-provider-recovery.gate.test.ts
docs/program/t0-canvas-v1/handoffs/CV6_G2_RUNTIME_ACTIVATION_GATE.md
```

No required test contains skip/only/todo. Baseline-to-final checks show no diff
to Master Plan, Canvas contracts, BytePlus protected source, Shared Router,
Bridge, Proxy or Vite config except product changes inherited through the two
recorded integration merge parents.

## Non-claims, rollback and downstream step

No real paid Seedance call was made. G6 is not executed and remains incomplete;
this report does not claim a real Provider task, real browser Golden Path,
Canvas V1 completion, AB Golden Path completion or Joint Gate pass.

Rollback of CV6 work is the revert/removal of the three CV6 atomic test commits
and this handoff commit; product remediation rollback is independently owned by
CV0/CV2/CV5. Downstream first step: CV0 verifies commit objects, merge parents,
exact paths and reproduced commands, then alone decides the G2 Gate state and
whether CV3/G4 work may start.
