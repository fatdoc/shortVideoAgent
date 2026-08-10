# Q1 Pilot Cross-plane Contract Gate

This directory is a test-only boundary owned by the Q1 digital employee. It invokes the frozen C01 validator and the actual StoryCanvas v0.1 Zod validators; it does not duplicate either production schema and never calls a paid provider.

Run from the repository root:

```bash
node tests/e2e/pilot/run-contract-gate.mjs
```

Current phases:

- C01 v0.2 fixture, digest, chain, negative-vector and forbidden-field checks: executable.
- StoryCanvas v0.1 package/grant compatibility and rejection boundary: executable.
- Test-only transport oracle for command replay, receipt ACK/replay, and reservation settlement: executable.
- A3 Control API package/grant public API, signed token, and least-privilege policy: executable.
- B3 StoryCanvas v0.2 runtime/security validators, public HTTP routes, and durable task/receipt receiver: executable.

The StandardError mutation tests preserve the original Q1 reproduction and now require the C01.1 machine-readable policy to reject signed URLs, scripts, credentials, and cross-tenant existence disclosures.

The unknown-task oracle requires the C01.1 `RECEIPT_TASK_NOT_FOUND` decision: HTTP 404, rejected ACK, no durable Inbox write, no credit action, and no resource-existence disclosure.

The grant-scope evidence proves that the canonical fixture suite currently accepts a ProjectGrant that omits `production.task.write` while the fixture chain still contains a GenerationTaskCommand. The A3/B3 authorization layer must enforce the operation-specific scope even if C01 keeps structural and runtime authorization checks separate.

## Wave 4 deterministic Joint Gate

A-BIZ-06A adds a root manifest and runner without claiming that the future full Gate has already passed.

```bash
npm run test:joint-gate:manifest
npm run test:joint-gate:plan
npm run test:joint-gate:full
```

Semantics:

- `test:joint-gate:manifest` validates the machine-readable phase contract and fail-closed preflight.
- `test:joint-gate:plan` prints every required phase as `NOT_RUN`; it does not execute commands and is not a pass report.
- `pilot-browser-e2e` is now `ready` and delegates to the deterministic lifecycle runner `npm run test:e2e:pilot`; the full runner injects `PILOT_E2E=true` and freezes the browser channel to real Google Chrome.
- `test:joint-gate:full` executes required phases only after all preconditions are satisfied. A-BIZ-06D is complete, but until 06E/06F and the B-owned clean baseline are available it must still exit non-zero with `JOINT_GATE_BLOCKED`.
- `CONTROL_API_TEST_DATABASE_URL` must be a dedicated PostgreSQL database whose name ends in `_test`. Missing or development database URLs block the full Gate before tests, so PostgreSQL suites cannot silently skip and still be reported as passed.
- StoryCanvas v0.2 runtime, security, public route, and durable receiver tests are listed explicitly because the package default `npm test` script does not cover all of them.
- Provider secrets are cleared for child processes. The runner does not start LIVE payment, settlement, media generation, or paid provider calls.
- `JOINT_GATE_B_BASELINE_COMMIT` is an external synchronization assertion, not an instruction for A to edit StoryCanvas. It must be a full 40-character commit SHA that resolves to a commit and is already an ancestor of the current integration `HEAD`; missing, invalid, or unsynchronized values block the full Gate before any required command runs.

### Pilot browser phase evidence

The activated phase requires an explicit dedicated PostgreSQL URL and never accepts the development database:

```bash
PILOT_E2E=true \
PILOT_E2E_BROWSER_CHANNEL=chrome \
CONTROL_API_TEST_DATABASE_URL='<dedicated PostgreSQL database ending in _test>' \
npm run test:e2e:pilot
```

A-BIZ-06D closure evidence used real Google Chrome `150.0.7871.125`, a dedicated `videoagent_control_test` PostgreSQL database, and a single Playwright worker. The complete matrix passed `39/39` with `0 SKIP`, including the post-run artifact scanner. This activates only the Pilot browser phase; it does not make the A/B golden path, migration rollback/reapply phase, B-owned baseline, or Full Joint Gate pass.
