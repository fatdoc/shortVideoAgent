# CV6 G6 Safe Browser Gate

Date: 2026-08-14 (Asia/Shanghai)

## Decision

The real, non-paid G6 browser safety slice is `PASS` at integration
`9cb7b1f9f1e37636b116e510fff175a52fcf0938`.

Overall G6 remains `PARTIAL / BLOCKED` because no real paid Seedance task was
authorized or executed. This handoff does **not** claim
`CANVAS_V1_GOLDEN_PATH_PASS`, AB Golden Path completion, Canvas V1 completion,
or Joint Gate acceptance.

## Git identity

```text
worktree: /Users/docfat/.codex/worktrees/t0-cv1-cv6-g5-shared-gate
branch:   codex/t0-cv1-cv6-g5-shared-gate
baseline product: e747111d281170ccc061a600a908c0fdf12bf4ed
tested integration: 9cb7b1f9f1e37636b116e510fff175a52fcf0938
final QA merge: 1c4bd645bad5c42ae2db2fc9a273b6456b15350a
merge parents: 17c24e464e8e982ac1006e8717fd38504a4a0ffc
               9cb7b1f9f1e37636b116e510fff175a52fcf0938
GREEN evidence commit: 549ede070747550f4c4898ad22fe46c5f6852f1a
```

The integration was incorporated by normal `--no-ff` merge. CV6 did not
rebase, reset, cherry-pick, manually copy product files, or include the merge
diff in its write set.

## Real environment and sequence

The coordinator used only the dedicated PostgreSQL database
`videoagent_control_test`, real Control API at `127.0.0.1:10601`, real
StoryCanvas at `127.0.0.1:10588`, Vite at `127.0.0.1:5177`, and Playwright's
bundled Chromium. Ports 5175 and 5176 were intentionally not used.

The browser executed:

```text
real login/session
→ exact project + explicit Package canonical URL
→ Control activation
→ Story legacy open
→ formal bootstrap
→ formal workspace hydration
→ blocked no-Provider readiness
→ reload with a new page-memory activation attempt
→ identical workspace recovery
```

The final canonical URL is recorded in
`docs/program/t0-canvas-v1/evidence/g6-safe-browser/summary.json`.

No ARK, Seedance, BytePlus or Volcengine environment value was available to
the child services. The generation button remained disabled; the browser made
zero approval requests and zero command requests. PostgreSQL post-run evidence
also contained zero `high_cost_command_approvals` and zero `production_tasks`.
No paid Provider endpoint was called.

## Corrected test-environment finding

The initial real run exposed 502 `CANVAS_PROVIDER_FAILED` before formal
hydration. Fixed-stage diagnostics proved that Control workspace authority
returned HTTP 200 JSON and the frozen Story parser accepted and exact-matched
it. The cause was the CV6 fresh temporary Story root: pilot startup applies
only migration 005, while formal runtime authority/materialization also needs
the legacy project skeleton and migrations 001-004.

The test-only coordinator now creates a fresh temporary SQLite root, the five
minimal foreign-key anchor tables, one local project, full migrations 001-005,
and exactly one `saas-control-plane/project` mapping for the seeded Control
project before Story starts. It never reads or writes the user's normal Story
database. With that correction, both real viewports pass without a product
change. A diagnostic failed-run postcondition had already shown one document,
asset, requirement, readiness and local media row plus the exact project and
asset mappings.

## Independent security and behavior evidence

- formal browser GET provenance accepts the Chromium no-Origin tuple only with
  exact same-origin `Sec-Fetch-Site` and Referer;
- legacy open and formal bootstrap exact concurrent calls share in-flight work;
- session rotation restores only exact actor/tenant/project/package/asset
  continuity; cross-scope, revoked rights and provider drift remain blocked;
- formal bootstrap and workspace are real server projections, not Demo or
  default hydration;
- the visible UI names the actual project, shows the approved Script and
  Storyboard shot, reports Provider/entity readiness blockers, and disables
  generation;
- reload creates a new logical activation attempt while React StrictMode exact
  duplicate calls retain the same page-memory attempt;
- DOM, URL/query/hash, browser storage, IndexedDB, console, network evidence,
  screenshots and bounded service logs contain no raw token, Cookie, CSRF,
  Grant, Package snapshot/digest, idempotency key, Provider body/ID, signed URL,
  local path, raw bytes, `asset://`, or data-root secret;
- all network traffic observed by the browser was loopback and same-origin;
- the session Cookie was HttpOnly;
- services terminated and the temporary Story/asset root was removed after
  each run.

## Screenshots

```text
docs/program/t0-canvas-v1/evidence/g6-safe-browser/playwright/
  g6-no-provider-browser-G6--86a40-contained-and-zero-dispatch-g6-safe-1440x900/
    g6-no-provider-g6-safe-1440x900.png     1440 × 900
  g6-no-provider-browser-G6--86a40-contained-and-zero-dispatch-g6-safe-1672x941/
    g6-no-provider-g6-safe-1672x941.png     1672 × 941
```

Both screenshots were opened and visually inspected by CV6. They show the
real hydrated workspace and explicit disabled/blocked production state.

## Reproducible commands and results

```bash
node scripts/t0-canvas-v1-gate/run-g6-session-recovery-red.mjs
# 3/3 PASS

PILOT_E2E=true \
CONTROL_API_TEST_DATABASE_URL='postgresql://127.0.0.1:5432/videoagent_control_test' \
apps/control-api/node_modules/.bin/tsx \
scripts/t0-canvas-v1-gate/run-g6-safe-browser-gate.ts
# 2/2 PASS; SAFE_NO_PROVIDER_BROWSER_PASS

node --test docs/program/contracts/canvas-v1/validate-browser-provenance-replay.mjs
# 6/6 PASS

node scripts/t0-canvas-v1-gate/run-contract-gate.mjs
# CANVAS_V1_CONTRACT_GATE_PASS; independent 43/43 PASS

node scripts/t0-canvas-v1-gate/run-g5-additive-contract-gate.mjs
# G5_ADDITIVE_CONTRACT_GATE_PASS

CANVAS_V1_VERIFIED_DEPS_ROOT=/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent2/videoagent \
node scripts/t0-canvas-v1-gate/run-story-workspace-product-gate.mjs
# 69 + 30 vectors; policy 6/6; runtime 10/10 PASS

node scripts/t0-canvas-v1-gate/run-g4-agent-gate.mjs
# policy 4/4; runtime 7/7 PASS

node scripts/t0-canvas-v1-gate/run-shared-g5-gate.mjs
# static 7/7; runtime 7/7; browser policy 3/3; historical Shared PASS

npm test -- --run
# root 521/521 PASS

# Story canvas-v1 service and formal route test files via Story tsx
# 52/52 PASS

# Control workspace authority/materialization five-file target
# 17 PASS; one mutually exclusive environment-attestation case skipped

npm run build
# root TypeScript/Vite PASS

npm --prefix apps/control-api run build
npm --prefix apps/control-api run typecheck
# PASS / PASS

npm --prefix apps/storycanvas run build
# Story backend and Electron main build PASS

npm run validate:governance
git diff --check
# PASS / PASS
```

The first Story owner-test invocation attempted a broken symlinked Electron
binary in this QA worktree. The identical 52 Canvas V1 service/route tests were
rerun through Story's `tsx` runtime and all passed; this was an invocation
environment issue, not a product failure. The Story build-generated tracked
bundle was mechanically restored to exact HEAD content and is absent from the
CV6 diff.

## Exact CV6 G6 commits and owned paths

```text
1a3dfad6f94e599ff4bd89ae2f6bcd367719e5b4  session recovery matrix
8d2d3215d9af39006b4d5fde128484e314b7ae73  real safe-browser coordinator/spec
155777d5a1f654306a6fcd82856ac4b3d327dca0  first external RED evidence
0e743a361d309175b4e1183179f5b443d98a148a  formal bootstrap RED evidence
549ede070747550f4c4898ad22fe46c5f6852f1a  corrected coordinator + GREEN evidence
```

Owned G6 paths:

```text
tests/e2e/canvas-v1/g6-session-recovery.gate.test.ts
tests/e2e/canvas-v1/g6-no-provider-browser.spec.ts
scripts/t0-canvas-v1-gate/run-g6-session-recovery-red.mjs
scripts/t0-canvas-v1-gate/run-g6-safe-browser-gate.ts
scripts/t0-canvas-v1-gate/playwright.g6-no-provider.config.ts
docs/program/t0-canvas-v1/evidence/g6-safe-browser/**
docs/program/t0-canvas-v1/handoffs/CV6_G6_SAFE_BROWSER_GATE.md
```

CV6 did not modify product, Master, contracts, Shared historical RED, or
`apps/storycanvas/data/vendor/byteplus.ts`.

## Recommendation

CV6 recommends accepting the `G6 SAFE NO-PROVIDER BROWSER` slice and records it
`READY_FOR_GATE`. CV0 must keep overall G6 `PARTIAL / BLOCKED` until an
explicitly authorized real paid Provider task reaches a safe terminal result,
the exact output ownership chain is verified, and the remaining Golden Path /
Joint Gate requirements are completed.
