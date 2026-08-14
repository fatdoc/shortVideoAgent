# G1 additive amendment · REQ-T0CV1-CV2-002

> Owner: CV1 Contract Architect
>
> Baseline: `12619c5062db2f218e5f635b306636c5cd4ef329`
>
> Status: `READY_FOR_GATE_REVALIDATION`

## Defect and accepted decision

The accepted G1 reason catalog included `ENTITY_BINDING_MISSING`, but
`ShotReadiness.requirements[].entityBindingStatus` required a non-null
EntityBinding status. A conforming payload could therefore not represent the
valid state "the required asset has no EntityBinding record" without pretending
that a binding existed.

CV0 accepted this additive repair:

```text
ReadinessRequirement.entityBindingStatus = EntityBindingStatus | null

null     → no binding exists       → ENTITY_BINDING_MISSING
pending  → binding exists, pending → ENTITY_BINDING_PENDING
approved → binding exists, passes the entity dimension
rejected → binding exists          → ENTITY_BINDING_REJECTED
revoked  → binding exists          → ENTITY_BINDING_REVOKED
```

The nullable field applies only to a ShotReadiness requirement. EntityBinding
records and CanvasBootstrap asset summaries retain the original non-null closed
status set.

## Version and compatibility

`contractVersion` remains `0.1`. CV0 classified the change as a G1 freeze-defect
repair before downstream publication rather than a post-release semantic
version change.

Compatibility effects:

- Every previously valid `ShotReadiness/0.1` payload remains valid and has the
  same meaning.
- A new additive payload state with `entityBindingStatus: null` is accepted only
  when deterministic readiness reasons include `ENTITY_BINDING_MISSING` in the
  frozen order.
- `pending` does not alias missing and continues to produce
  `ENTITY_BINDING_PENDING`.
- Old consumers compiled against a non-null type must update before consuming
  amended readiness responses. This is the explicit downstream action that
  motivated the amendment before product integration advances.
- CanvasBootstrap, EntityBinding and all other Canvas V1 object shapes are
  unchanged.

## Atomic commits

Amendment A — schema, positive fixture, 38th negative vector and RED tests:

```text
26d457c3990a6dae66870877d06d0d2772abed61
test(contracts): freeze missing entity binding readiness
```

Amendment B — backend/frontend runtime and type GREEN:

```text
461e25cf57c3f182b71df4470fd48eb5c30405dc
fix(contracts): represent missing entity binding
```

Amendment C adds this note plus inventory/README clarifications. Its full SHA is
reported after commit because a commit cannot contain its own truthful SHA.

## Exact paths

Amendment A:

```text
docs/program/contracts/canvas-v1/canvas-v1.schema.json
docs/program/contracts/canvas-v1/fixtures/shot-readiness-binding-missing.json
docs/program/contracts/canvas-v1/negative-vectors.json
docs/program/contracts/canvas-v1/validate-contract.mjs
apps/storycanvas/src/contracts/canvas-v1/contracts.test.ts
src/features/canvas-v1/model/contracts.test.ts
```

Amendment B:

```text
apps/storycanvas/src/contracts/canvas-v1/index.ts
src/features/canvas-v1/model/contracts.ts
```

Amendment C:

```text
docs/program/contracts/canvas-v1/AUTHORITY_INVENTORY.md
docs/program/contracts/canvas-v1/README.md
docs/program/contracts/canvas-v1/G1_AMENDMENT_REQ_T0CV1_CV2_002.md
```

No Master Plan, central `handoffs/**`, CV2/CV4/CV5/Shared implementation or
protected file is part of this amendment.

## RED and GREEN evidence

Amendment A dependency-free facts/schema validation:

```text
node docs/program/contracts/canvas-v1/validate-contract.mjs
6 tests / 6 pass / 0 fail
```

Expected RED before runtime changes:

```text
StoryCanvas backend: 3 pass / 2 fail
Frontend:            3 pass / 2 fail
```

Both failures were on the new contract surface: the old runtime rejected null
as `CANVAS_SCHEMA_INVALID`, and therefore could not reach the new deterministic
reason inconsistency code.

Amendment B GREEN:

```text
StoryCanvas backend conformance: 5 tests / 5 pass / 0 fail
Frontend conformance:            5 tests / 5 pass / 0 fail
Negative-vector stable parity:   38 / 38
Root TypeScript tsc -b:          PASS
StoryCanvas new contract tsc:    PASS
Dependency-free schema/facts:    6 tests / 6 pass / 0 fail
```

The StoryCanvas TypeScript check targeted the two Canvas V1 contract files.
Full StoryCanvas TypeScript retains the previously documented unrelated
productionAgent/Zod JSONSchema dependency noise.

Machine fact hashes after Amendment B:

```text
73c57a34cd937e4dbcf345ab8e3d9f433476c88e0446a0c87a934877cfdaaec1  canvas-v1.schema.json
1426a7c2533bb4617b44bc6b817bb4e37251578be55f9dce7cc0ad1dfacae8d5  negative-vectors.json
117294556c733c09d5f491866baef2439240a184fe1dfbf947c477b49f4b45ba  fixtures/shot-readiness-binding-missing.json
```

## Security and semantic evidence

- The added value is `null`; it exposes no provider, grant, token, digest,
  storage or internal ID data.
- The positive fixture remains browser-safe and exact scope-bound.
- A missing binding cannot pass readiness: both requirement and aggregate are
  `ready=false` with the exact ordered missing reason.
- The new negative vector replaces the missing reason with pending and both
  runtime parsers reject it as `CANVAS_READINESS_INCONSISTENT`.
- Unknown/local provider, rights, approval, scope, command, document, event and
  forbidden-marker vectors remain unchanged and passing.

## Downstream required action

CV2:

1. Update readiness construction to emit `entityBindingStatus: null` only when
   the exact-scope EntityBinding lookup returns no record.
2. Emit `pending` only when a record exists with that status.
3. Rebase/fast-forward to the amended contract before completing G2 readiness
   RED/GREEN.

CV4:

1. Treat `null` as missing and render `ENTITY_BINDING_MISSING`; do not display
   it as pending or unknown.
2. Consume the ordered reason list as authority rather than deriving a different
   label from a truthy/falsy status check.

CV5:

1. No CanvasBootstrap summary or Control AssetRecord shape change is required.
2. Preserve absence versus pending when its safe aggregation participates in
   downstream readiness.

CV6:

1. Re-run dependency-free, backend and frontend conformance.
2. Require 38/38 stable-code negative parity and the blocked null/missing
   positive fixture.
3. Recheck exact paths, diff-check and protected-path exclusion before CV0
   revalidates the G1 amendment.

## Rollback

CV0 can revert in reverse order without rewriting history:

```text
git revert <amendment-C-full-SHA>
git revert 461e25cf57c3f182b71df4470fd48eb5c30405dc
git revert 26d457c3990a6dae66870877d06d0d2772abed61
```

There is no database, provider, remote branch or user-data rollback. Reverting
would restore the known inability to represent a missing EntityBinding and must
therefore also stop downstream readiness integration.
