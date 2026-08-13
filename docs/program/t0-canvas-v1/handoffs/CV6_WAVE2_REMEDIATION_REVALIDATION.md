# CV6 Wave 2 remediation revalidation

> Task: `T0-CV1-06`
>
> Required product baseline: `37703ecb86c64a75d62292533b9e1e50aacb2811`
>
> Revalidation baseline: `1e6d0848e0142ff5aeac508057ad383d098ecad2`
>
> CV6 recommendation: `G1 ACCEPT / G2 BLOCK / G3 ACCEPT`

`1e6d0848e0142ff5aeac508057ad383d098ecad2` is the direct child of the
required product baseline. It changes only deterministic PostgreSQL tests
(`resetSeed` migration count 24 to 26 and a legacy session clock to 2099).
The QA branch was transparently rebased onto that commit before the final
database and build runs. CV6 did not create or count those two corrections in
its write set.

These are independent gate recommendations. This handoff does not edit the
Master Plan and does not declare any program gate `ACCEPTED`.

## G1 amendment revalidation — recommend ACCEPT

```bash
CANVAS_V1_VERIFIED_DEPS_ROOT=/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent2/videoagent \
  node scripts/t0-canvas-v1-gate/run-contract-gate.mjs
```

Result: `CANVAS_V1_CONTRACT_GATE_PASS`, 66 tests passed. The gate catalogues
the nine canonical aggregate fixtures plus the additive
`shot-readiness-binding-missing` fixture (10 fixture files), and both the
StoryCanvas and frontend parsers preserve all 38 frozen negative vectors with
the same stable codes. Backend 5/5, frontend 5/5 and independent parser parity
43/43 all passed.

## G2 Asset/Command revalidation — recommend BLOCK

### Canvas session authority remediation is green

The original CV6 router-only spoof test still reports 1 pass / 2 failures:
the injected fake route service returns 201 for both forged browser requests.
That test predates the session verifier and replaces the complete
`CanvasAssetAuthorityService`; it therefore bypasses the remediated production
service by construction. It is retained as stale-harness evidence and is not
reported as a product result.

CV6 added a production-wired revalidation gate using the real service:

```bash
CANVAS_V1_VERIFIED_DEPS_ROOT=/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent2/videoagent \
  node_modules/.bin/vitest run \
  --config scripts/t0-canvas-v1-gate/vitest.g2-wave2-revalidation.config.mjs
```

Result: 3/3 passed. Forged package/session asset creation and high-cost
approval minting both return 403 `CANVAS_SESSION_INVALID`; absence of a
session verifier also returns 403. The observed call order is project policy,
then exact session authority, then persistence. The first two stages run and
both persistence methods remain at zero calls.

Production wiring in `apps/control-api/src/server.ts` constructs
`CanvasAssetSessionAuthorityService` over the PostgreSQL repository and injects
it into `CanvasAssetAuthorityService`. The service derives tenant and actor
from the authenticated session and checks tenant/project/package/session/actor
exactly before either write. The internal registrar is separately mounted at
`/api/v1/internal`, uses constant-time internal-token authentication, bounded
strict JSON, stable exact replay, changed-scope conflict, safe errors and no
authority-bearing response projection.

Control targeted suite:

```bash
apps/control-api/node_modules/.bin/vitest run --root apps/control-api \
  --config vitest.config.ts \
  src/assets/parser.test.ts src/assets/routes.test.ts \
  src/assets/service.test.ts src/assets/sessionAuthority.test.ts \
  src/assets/appRegistration.test.ts
```

Result: 5 files / 54 tests passed. This includes authentication, project
policy, Origin/CSRF, safe projection, exact approval fingerprint/actor scope,
replay/conflict, registrar isolation and missing/forged session fail-closed.

StoryCanvas targeted suite:

```bash
cd apps/storycanvas
NODE_PATH=node_modules node node_modules/tsx/dist/cli.mjs --test \
  src/services/storycanvas/assets-v1/readiness.test.ts \
  src/services/storycanvas/canvas-v1/canvasCommandService.test.ts \
  src/services/storycanvas/canvas-v1/runtime.test.ts \
  src/routes/production/pilot/canvas/commands/index.test.ts \
  src/services/storycanvas/pilotCanvasCapability.test.ts \
  src/services/storycanvas/pilotCanvasRemediation.test.ts \
  src/lib/storycanvasMigrations.test.ts
```

Result: 35/35 passed. This covers migration 005, strict runtime scope,
authenticated actor/tenant/project/package/session binding, four ordered
readiness layers, readiness amendment behavior, Asset/Command/Document
persistence, same-content replay, changed-content conflict, safe errors,
bootstrap response-loss replay and Control registrar failure/expiry
fail-closed.

### Dedicated PostgreSQL evidence

Only this explicit URL was used:

```text
CONTROL_API_TEST_DATABASE_URL=postgresql://localhost/videoagent_control_test
```

Before any destructive suite, URL parsing returned
`parsed_database=videoagent_control_test` and `dedicated_suffix=true`; an
independent server query returned `current_database() = videoagent_control_test`.
No `videoagent_control` or other database was touched. Suites that drop
`control_plane` were run serially with one worker.

```bash
CONTROL_API_TEST_DATABASE_URL=postgresql://localhost/videoagent_control_test \
  apps/control-api/node_modules/.bin/vitest run --root apps/control-api \
  --config vitest.config.ts --maxWorkers=1 --fileParallelism=false \
  src/assets/repository.postgres.test.ts
# 3 passed; inverse no-dedicated-database guard skipped

# Same command shape, run separately and serially:
# src/assets/sessionRepository.postgres.test.ts  2 passed; inverse guard skipped
# src/db/migrationChain.postgres.test.ts          1 passed
# src/e2e/resetSeed.test.ts                       3 passed
# src/members/repository.postgres.test.ts         7 passed
```

Migrations 025 and 026, exact active scope, immutable same/same replay,
changed actor/package conflict, revoked Grant fail-closed and full 26-migration
reset all passed. The two corrected full-gate PostgreSQL files passed 10/10.
There is no PostgreSQL environment blocker.

### Remaining product blocker

The production StoryCanvas mount passes database, Origin, session verifier and
server authority into `createCanvasV1RuntimeRouter`, but does not pass
`validateApproval` or `startShotProduction`. The runtime defaults safely reject
approval (`false`) and Provider start (`CANVAS_CAPABILITY_UNAVAILABLE`). That is
correct fail-closed behavior, not a completed Control approval consumption
channel or real Provider task path. Consequently active high-cost execution
cannot complete, and overall G2 remains `BLOCK` despite the scope remediation.

## G3 UI remediation revalidation — recommend ACCEPT

The original independent three-case gate now passes:

```bash
node_modules/.bin/vitest run \
  --config scripts/t0-canvas-v1-gate/vitest.g3-ui.config.mjs
```

Result: 3/3 passed. Both generation and binding high-cost actions fail closed
without approval; a newer authoritative document version restores the prompt;
and unsafe `asset://` media is absent from DOM sinks.

```bash
node_modules/.bin/vitest run \
  src/features/canvas-v1/pages/CanvasV1Page.test.tsx \
  src/features/canvas-v1/model/contracts.test.ts
```

Result: 2 files / 31 tests passed. The owner suite exercises component states,
frozen commands, both approval paths, refreshed prompt authority, keyboard
focus and all five media sinks. Eight unsafe URI classes are rejected, while
only unsigned same-origin absolute paths render. Static inspection found no
legacy `/api/mvp/*`, `localStorage` or `sessionStorage` dependency in the
Canvas V1 implementation. This is targeted a11y/security evidence, not a claim
of a complete accessibility certification.

The already integrated independent visual evidence remains applicable:

```text
docs/program/t0-canvas-v1/evidence/CV6_G3_REUSED_CV4_1440x900.png
docs/program/t0-canvas-v1/evidence/CV6_G3_REUSED_CV4_1672x941.png
```

## Build and repository checks

```text
npm run build                               PASS (root)
cd apps/control-api && npm run build         PASS
cd apps/storycanvas && npm run build         PASS
npm run validate:governance                 PASS
git diff --check                            PASS
```

The StoryCanvas build regenerated `apps/storycanvas/data/serve/app.js`; CV6
restored that generated file byte-for-byte to HEAD before committing. Final
checks cover the required ancestor, exact CV6 write set, a clean worktree and
no diff to `apps/storycanvas/data/vendor/byteplus.ts`, Master Plan or historical
RED evidence.

## CV6-owned Wave 2 write set

```text
tests/e2e/canvas-v1/control-authority-scope.revalidation.test.ts
scripts/t0-canvas-v1-gate/vitest.g2-wave2-revalidation.config.mjs
docs/program/t0-canvas-v1/handoffs/CV6_WAVE2_REMEDIATION_REVALIDATION.md
```
