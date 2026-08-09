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
- `test:joint-gate:full` executes required phases only after all preconditions are satisfied. Until 06D/06E/06F and the B-owned clean baseline are available, it must exit non-zero with `JOINT_GATE_BLOCKED`.
- `CONTROL_API_TEST_DATABASE_URL` must be a dedicated PostgreSQL database whose name ends in `_test`. Missing or development database URLs block the full Gate before tests, so PostgreSQL suites cannot silently skip and still be reported as passed.
- StoryCanvas v0.2 runtime, security, public route, and durable receiver tests are listed explicitly because the package default `npm test` script does not cover all of them.
- Provider secrets are cleared for child processes. The runner does not start LIVE payment, settlement, media generation, or paid provider calls.
- `JOINT_GATE_B_BASELINE_COMMIT` is an external synchronization assertion, not an instruction for A to edit StoryCanvas.
