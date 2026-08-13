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
- `migration-rollback-reapply` is now `ready` and delegates to `node scripts/run-control-api-migration-gate.mjs`; it preserves the dedicated PostgreSQL precondition and the full runner injects `PILOT_E2E=true`.
- `test:joint-gate:full` executes required phases only after all preconditions are satisfied. A-BIZ-06D and 06F.1—06F.5 are complete, but until 06E and the synchronized B-owned clean baseline are available it must still exit non-zero with `JOINT_GATE_BLOCKED`.
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

A-BIZ-06D closure evidence used real Google Chrome `150.0.7871.125`, a dedicated `videoagent_control_test` PostgreSQL database, and a single Playwright worker. The complete matrix passed `39/39` with `0 SKIP`, including the post-run artifact scanner. This activates only the Pilot browser phase; it does not make the A/B golden path, B-owned baseline, or Full Joint Gate pass.

### A/B Golden Path fail-closed runner skeleton

The shared runner entry is now wired, but the Joint Gate phase remains `external` and
`AB_GOLDEN_PATH_NOT_IMPLEMENTED` remains a required slice blocker:

```bash
PILOT_E2E=true \
PILOT_E2E_AB_GOLDEN_PATH=true \
PILOT_E2E_BROWSER_CHANNEL=chrome \
CONTROL_API_TEST_DATABASE_URL='<dedicated PostgreSQL database ending in _test>' \
JOINT_GATE_B_BASELINE_COMMIT='<full synchronized 40-character B commit SHA>' \
npm run test:e2e:pilot:ab-golden-path
```

The Joint Gate runner removes any caller-supplied `PILOT_E2E_AB_GOLDEN_PATH` value from its shared base
environment and restores `PILOT_E2E_AB_GOLDEN_PATH=true` only for the `ab-golden-path` command, so sibling
phases cannot inherit Golden Path mode. The Golden Path runner performs static environment validation,
local shell-free Git commit/ancestor probes, and then requires all three StoryCanvas tracked attestations to
be clean: unstaged, staged, and baseline-commit-to-`HEAD`. These checks use `git diff`, not `git status`, so
untracked B-owned runtime files remain outside A's attestation. Only after those checks pass may the runner
probe a frozen B consumer capability marker. No such marker is synchronized yet, so the current real CLI
must exit non-zero with `AB_GOLDEN_PATH_B_CONSUMER_REQUIRED` before reading a Golden Path spec, resetting
PostgreSQL, starting Control API/Root/StoryCanvas processes, probing readiness, or launching Chrome. Even a
test-only synthetic capability cannot produce PASS; it stops at `AB_GOLDEN_PATH_NOT_IMPLEMENTED`. This
skeleton does not prove the B redemption consumer, browser-safe bootstrap, Pilot Canvas page, real browser
flow, or Full Joint Gate.

### Migration rollback/reapply phase evidence

Run only against a disposable, fresh, empty PostgreSQL database dedicated to tests:

```bash
PILOT_E2E=true \
CONTROL_API_TEST_DATABASE_URL='<dedicated PostgreSQL database ending in _test>' \
node scripts/run-control-api-migration-gate.mjs
```

The runner never falls back to `DATABASE_URL`, rejects the development database, verifies
`current_database()` before destructive SQL, runs migration 001—019 forward, verifies latest replay as
a no-op, rolls back the single fresh batch, verifies an empty state, reapplies deterministically, compares
the schema fingerprint, and cleans up. Connection, identity, reset, forward, rollback, reapply,
verification, cleanup, or destroy failure blocks the phase and suppresses final PASS. Logs must not expose
the full URL, username, password, query, SQL, stack, provider secret, Session, Grant, or internal payload.

The local 06F activation evidence passed the real PostgreSQL rollback/reapply Gate with `0 SKIP`, the
environment boundary runner `8/8`, and the failure/recovery matrix `13/13`. This evidence activates only
the migration phase. Missing PostgreSQL, browser, 06E Golden Path, or synchronized B baseline is
`BLOCKED`, never a SKIP PASS.

### Final Joint Gate report contract

For every required phase, the final report must record command, owner, precondition, start/end/duration,
`PASS`/`FAIL`/`BLOCKED`, test count with zero-SKIP evidence, artifact/evidence path, and the redaction
conclusion. It must not include complete database URLs, credentials, Tokens, Secrets, SQL, stack traces, or
internal payloads. Payment/Commission/Settlement evidence remains TEST-only; Settlement remains
`TEST / draft / NON_QUOTE`, not paid, deposited, withdrawable, or automatically disbursed. Provider
unavailability proves only fail-closed behavior, not media quality or a production SLA.
