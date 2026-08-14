# CV6 dynamic high-cost approval independent gate

> Task: `T0-CV1-06`
>
> Required integration baseline: `510da96e69e4fe3f5376f19d8aa190c3a4123dab`
>
> Branch: `codex/t0-cv1-cv6-dynamic-approval-gate`
>
> Recommendation: `READY_FOR_GATE`

This is an independent QA recommendation for the dynamic high-cost approval UI
slice. It does not modify the Master Plan, declare G3/G5 accepted, or change the
existing G2/G5/G6 blockers.

## Configuration and boundary

CV6 ran with the required `gpt-5.6-sol` model and `high` reasoning setting. The
client speed setting was not independently observable, so no speed claim is
made. Before writing, CV6 fully read Master Plan v0.5, Employee Rules, Autonomy
Protocol, the CV6 task, Canvas V1 domain and activation transport contracts,
fixtures and vectors, and the prior CV6 G3 handoffs.

Product code, Master, contracts, fixtures, vectors and BytePlus remained
read-only. The only changed paths are:

```text
tests/e2e/canvas-v1/dynamic-approval.gate.test.tsx
scripts/t0-canvas-v1-gate/vitest.cv6-dynamic-approval.config.mjs
docs/program/t0-canvas-v1/handoffs/CV6_DYNAMIC_APPROVAL_GATE.md
```

## Dynamic approval result

The dedicated runner composes independent tests with both owner suites and the
original three-case CV6 G3 regression:

```bash
node_modules/.bin/vitest run \
  --config scripts/t0-canvas-v1-gate/vitest.cv6-dynamic-approval.config.mjs \
  --reporter=dot
```

Exact result:

```text
4 files / 71 tests PASS / 0 FAIL / 0 SKIP / 0 TODO
```

Breakdown:

```text
CV6 independent dynamic approval: 21/21 PASS
owner approval-flow hook:          17/17 PASS
owner Canvas V1 page:              30/30 PASS
original CV6 G3 regression:          3/3 PASS
```

The matrix proves:

- all five high-cost drafts (`CREATE_VIRTUAL_CHARACTER`,
  `BIND_ASSET_TO_ENTITY`, `GENERATE_SHOT`, `SELECT_SHOT_OUTPUT`,
  `EXPORT_PLAYLIST`) prepare exact `action={commandId,payload}` only after
  explicit confirmation;
- prepare and dispatch preserve tenant, project, package, Canvas session,
  actor, command type, command ID and payload exactly; the returned active
  approval ID is the only inserted fact;
- a legacy/static `approvalId` is discarded and cannot authorize dispatch;
- all three low-cost commands dispatch without approval preparation;
- cancel, null, throw, non-active status, extra field and invalid UUID fail
  closed without dispatch or reflected upstream error;
- drift in each of tenant, project, package, Canvas session or actor drops the
  in-flight attempt;
- confirmation double-click prepares once; response-loss retry dispatches the
  same complete frozen object by identity and serialized value and never
  prepares a second approval;
- the dialog has a modal accessible name/description and confirmation focus;
  its safe copy does not expose scope IDs, command IDs or payloads;
- DOM, URL, browser storage and console checks contain no authority/secret
  markers or writes; the original prompt-refresh and unsafe-media G3 checks
  remain green.

## Contract, type, build and governance evidence

```bash
node docs/program/contracts/canvas-v1/validate-activation-transport.mjs
node docs/program/contracts/canvas-v1/validate-contract.mjs
node_modules/.bin/tsc -b --pretty false
npm run build
npm run validate:governance
git diff --check
```

Results:

```text
Activation transport validator: 6/6 PASS
Canvas V1 contract facts:        6/6 PASS
Root TypeScript build:           PASS
Root production build:           PASS
Governance validation:           PASS
Repository diff-check:           PASS
```

The Vite build emitted only the existing chunk-size advisory and completed
successfully. No generated build artifact is part of the CV6 write set.

## Protected-path attestation

The baseline-to-final diff was checked against:

```text
apps/storycanvas/data/vendor/byteplus.ts
docs/program/t0-canvas-v1/T0_CANVAS_V1_MASTER_PLAN.md
docs/program/contracts/canvas-v1/**
src/features/canvas-v1/**
```

Result: no diff. No `git add .` or `git add -A` was used. There are no required
test `skip`, `only` or `todo` markers in the new Gate files.

## Risks, unfinished work and downstream first step

No dynamic-approval product blocker was found at this baseline. This is jsdom
component/transport evidence, not a real Control/StoryCanvas/browser G5 or G6
claim. Approval consumption, Provider execution and the real three-service
Golden Path remain governed by their existing blockers.

Rollback is removal/revert of the three CV6-owned paths above; no product or
contract rollback is involved. Downstream first step: CV0 independently checks
the commit object, exact paths and command results, then alone decides whether
to record this slice in the Master Plan.
