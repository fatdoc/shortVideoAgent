# CV6 G2 Asset/Command independent gate

> Task: `T0-CV1-06`
>
> Baseline: `af6e21ca2cc88dacf70c1b39c4d110332d569c1e`
>
> Gate result: `BLOCKED`

## Blocking product findings

### 1. Control mint endpoints accept browser package/session authority

Control authenticates the tenant session, enforces exact Origin/CSRF and checks
project production policy. It does not resolve the frozen Canvas Entry,
Production Package and Canvas Session authority before calling either
`createAsset` or `createHighCostApproval`. Both service methods persist the
request body's `packageId` and `canvasSessionId` directly.

The PostgreSQL package foreign key proves only that a package belongs to the
tenant/project. It does not prove that the submitted session is active or bound
to that package/Canvas Entry.

Atomic independent RED:

```text
891c1772477a22263092fe8b354b4232329662ff
test(gate): expose control canvas scope bypass
```

Exact paths:

```text
tests/e2e/canvas-v1/control-authority-scope.gate.test.ts
scripts/t0-canvas-v1-gate/vitest.g2-control.config.mjs
```

Reproduction:

```bash
CANVAS_V1_VERIFIED_DEPS_ROOT=/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent2/videoagent \
  node_modules/.bin/vitest run \
  --config scripts/t0-canvas-v1-gate/vitest.g2-control.config.mjs
```

Exact result:

```text
3 tests: 1 pass / 2 fail
asset with other same-project package/session: expected 403, received 201
approval with other same-project package/session: expected 403, received 201
```

This is a product authority blocker, not an environment blocker.

### 2. Production high-cost approval and Provider execution are not wired

`apps/storycanvas/src/app.ts` constructs the production runtime without
`validateApproval` and without `startShotProduction`. The runtime defaults are
correctly fail-closed (`validateApproval => false`; Provider start throws
`CANVAS_CAPABILITY_UNAVAILABLE`), but that is only a safe default. It is not a
completed Control approval consumption path or real Provider command path.

The Control approval consumer exists only at service/repository level; no
production server channel was found that lets StoryCanvas validate/consume it.
The runtime has readers for readiness/asset/provider rows, but no production
writer/synchronizer was found for Control AssetRecord, requirements or
readiness. These facts keep the Active-binding-to-real-task path incomplete.

## Passing evidence

Control browser authority suite:

```bash
apps/control-api/node_modules/.bin/vitest run --root apps/control-api \
  --config vitest.config.ts \
  src/assets/parser.test.ts src/assets/service.test.ts \
  src/assets/routes.test.ts src/assets/appRegistration.test.ts
```

```text
4 files / 49 tests PASS
```

This covers strict browser projections, authentication, tenant/project policy,
Origin/CSRF, lifecycle, approval actor/action fingerprint, consume replay and
conflict. It does not cover the missing Canvas Entry/package/session resolver.

StoryCanvas targeted command/readiness/runtime/migration suite:

```bash
cd apps/storycanvas
NODE_PATH=node_modules node node_modules/tsx/dist/cli.mjs --test \
  src/services/storycanvas/assets-v1/readiness.test.ts \
  src/services/storycanvas/canvas-v1/canvasCommandService.test.ts \
  src/services/storycanvas/canvas-v1/runtime.test.ts \
  src/routes/production/pilot/canvas/commands/index.test.ts \
  src/lib/storycanvasMigrations.test.ts \
  src/services/storycanvas/pilotCanvasCapability.test.ts
```

```text
27/27 PASS
```

Covered facts include exact runtime scope, Origin/session actor binding, four
readiness layers, null/missing amendment behavior, active virtual binding and
continuity increment, server-only `asset://`, same-content replay, changed
payload conflict, optimistic document save/new-session restore, persistence,
safe errors, migration registration and Pilot capability/startup boundaries.

## PostgreSQL classification

The configured Control database is not `_test`. Local PostgreSQL is reachable,
but a read-only catalog query found zero databases ending in `_test`:

```text
DEDICATED_TEST_DATABASES count=0
```

Therefore the dedicated PostgreSQL migration/repository execution is precisely:

```text
ENVIRONMENT_BLOCKED: no dedicated PostgreSQL database ending _test
```

No non-test database was used and no database was created or mutated. This
environment blocker is separate from, and does not excuse, the reproduced
Control authority product blocker.

## Build/regression evidence

```text
npm run build                                      PASS (root)
cd apps/control-api && npm run build                PASS
cd apps/storycanvas && npm run build                PASS
npm run validate:governance                        PASS
git diff --check                                    PASS
```

StoryCanvas build regenerated a tracked bundle during verification; that
known build output was restored to the received HEAD and is not in the write
set or commits.

## Gate conclusion

G2 remains `BLOCKED`. Required remediation is an exact authenticated
actor/tenant/project/Canvas Entry/package/session validator on both Control mint
paths, plus a real server-only approval consumption and Provider wiring path.
The current default fail-closed behavior must remain while those dependencies
are absent. This report does not modify product code or claim `ACCEPTED`.

