# CV6 G1 additive amendment revalidation

> Task: `T0-CV1-06`
>
> Baseline: `af6e21ca2cc88dacf70c1b39c4d110332d569c1e`
>
> Branch: `codex/t0-cv1-wave2-qa`
>
> Recommendation: `READY_FOR_GATE_REVALIDATION` (CV0 acceptance is still required)

## Amendment ancestry and independent RED

Both amendment implementation commits are ancestors of the received baseline:

```text
26d457c3990a6dae66870877d06d0d2772abed61  ANCESTOR
461e25cf57c3f182b71df4470fd48eb5c30405dc  ANCESTOR
```

The pre-fix CV6 runner reproduced the stale QA assumptions without changing
contract or product code:

```text
CV1 dependency-free facts: 6 pass
CV6 independent facts:      4 pass / 2 fail
  - tenth additive fixture was rejected by the nine-fixture directory equality
  - 38 vectors were rejected by the hard-coded 37 count
frontend conformance:        5 pass
```

The original runner also selected a broken optional Electron installation from
the dependency source. This was an environment/runner defect, not a product
failure. The runner now executes `tsx` with Node, as the backend tests do not
require Electron APIs.

## Atomic QA commits

```text
71ac4605c4fa7d2b6b123e678da078a13b897611
test(gate): freeze canvas amendment revalidation

5710b829840bef9780e7853e83a3db288032909e
fix(gate): accept additive canvas fixture catalog
```

Exact changed paths:

```text
tests/e2e/canvas-v1/contract-facts.gate.mjs
tests/e2e/canvas-v1/parser-parity.gate.ts
scripts/t0-canvas-v1-gate/run-contract-gate.mjs
```

No contract, runtime parser, product implementation, Master Plan, historical RED
or protected path was changed.

## GREEN command and result

```bash
CANVAS_V1_VERIFIED_DEPS_ROOT=/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent2/videoagent \
  node scripts/t0-canvas-v1-gate/run-contract-gate.mjs
```

Exact result:

```text
CV1 dependency-free facts/schema:       6/6 PASS
CV6 independent facts/security:         7/7 PASS
StoryCanvas backend conformance:        5/5 PASS
frontend conformance:                   5/5 PASS
CV6 frontend/backend parser parity:    43/43 PASS
frozen negative vectors:              38/38 on both planes with expected code
aggregate result:                     CANVAS_V1_CONTRACT_GATE_PASS
```

The additive `shot-readiness-binding-missing.json` fixture is independently
accepted byte-for-data on both planes. Its requirement has
`entityBindingStatus: null`, both readiness levels remain blocked, and both use
only `ENTITY_BINDING_MISSING`. The new mutation that substitutes the pending
reason is rejected as `CANVAS_READINESS_INCONSISTENT` on both planes.

## Gate recommendation

The G1 amendment is independently `READY_FOR_GATE_REVALIDATION`. This report
does not change the Master Plan and does not claim `ACCEPTED`.

