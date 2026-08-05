# Q1 Package / Grant / Task Cross-plane Contract Gate

> Date: 2026-08-05
>
> Branch: `codex/pilot-v0-control-plane`
>
> Gate state: `READY_FOR_GATE / ACCEPTED candidate`

## Scope and truth boundary

Q1 executes only test-owned runners, fixtures, and this report. It invokes the canonical C01 validator and actual A/B validators or public APIs. It does not alter business schemas, migrations, production configuration, wallet truth, or provider behavior. All provider credentials are cleared by the runner and no paid provider is called.

## Executable matrix

| Boundary | Evidence | Current result |
| --- | --- | --- |
| C01 v0.2 schema/index/fixtures/digests/negative vectors | `docs/program/contracts/v0.2/validate-contract.mjs` | PASS, 6/6 |
| StandardError credential field and sensitive value disclosure | Canonical validator against isolated mutated fixtures | PASS; forbidden key, signed URL, script and cross-tenant disclosure rejected |
| Semantic tamper with unchanged payload digest | Canonical validator against isolated mutated command | PASS; rejected |
| Package mismatch in ProjectGrant | Canonical validator against isolated mutated grant | PASS; rejected |
| StoryCanvas Demo compatibility boundary | Actual v0.1 `assertPackageContract`, `assertGrantScope`, and `demoProjectGrantSchema` | PASS, 8/8 |
| v0.2 command replay and conflict | Test-only transport oracle over canonical validated fixtures | PASS |
| Receipt accepted/duplicate/digest conflict | Test-only transport oracle over canonical validated fixtures | PASS |
| Unknown task receipt | C01.1 decision + transport oracle | PASS; `RECEIPT_TASK_NOT_FOUND`, rejected, non-durable, no credit action |
| Success without deliverable | Settlement oracle | PASS; remains reserved, consumes only after deliverable + eligible usage |
| Failure without deliverable | Settlement oracle | PASS; reservation released and consumption remains zero |
| A3 Control API package/grant HTTP and signed token | Real route handlers, token verifier, least-privilege policy and C01 validator | PASS, 10/10 |
| StoryCanvas v0.2 runtime/security contract | Actual embedded C01 schema/policy and grant introspection tests | PASS, 6/6 |
| StoryCanvas v0.2 package/grant/task/receipt receiver | Actual public HTTP routes and durable receiver tests | PASS, 7/7 |
| Receipt durability and unknown-task behavior | StoryCanvas receiver database assertions | PASS; accepted/duplicate/conflict, unknown task rejected and non-durable |

## Findings and responsibility

1. C01.1 commit `965d340` closes the original StandardError disclosure gap and freezes unknown-task semantics. The preserved mutation tests now require rejection.
2. A3 commits `8a59470`, `e9f6685`, `37f37ab`, A05.3 `553f075`, and A05.4 `7d38def` pass the real HTTP/token Gate. Q1 verifies project-scoped idempotency, independent Grant signing secret/kid, an independent test-only production-plane internal token, signed-claim `grantId` introspection context, tamper/expiry, least privilege, cross-tenant opacity, approval/revocation responses, and actual StandardError bodies against the canonical C01 validator.
3. The structural C01 fixture validator accepts a ProjectGrant that omits `production.task.write` while a GenerationTaskCommand exists in the fixture chain. This is recorded as a boundary, not authorization: A3 runtime policy rejects capability/scope expansion and B3 must enforce the required operation scope.
4. B3.1 `90627d2` and B3.2 `54e467a` expose the real StoryCanvas v0.2 runtime/security validator, public HTTP routes, and durable receiver. Q1 executes package, grant, command, replay/conflict, receipt ACK, byte tamper, fail-closed introspection, expiry immediately before writes with zero side effects, and unknown-task non-durable rejection through those implementations.
5. The existing v0.1 Demo validators remain isolated and reject v0.2 objects instead of silently treating Pilot truth as Demo truth.

## Final verification

| Gate | Result |
| --- | --- |
| Q1 top-level Gate | 10 PASS, 0 FAIL, 0 SKIP |
| Expanded Q1 logical tests | 48 PASS: C01 6, StoryCanvas v0.1 8, protocol oracle 6, mutation checks 5, A3 HTTP/security 10, B3 v0.2 runtime/receiver 13 |
| Root tests | 30 files / 195 tests PASS |
| Root build | PASS; existing Vite chunk-size warning only |
| Control API with temporary dedicated PostgreSQL | 14 files / 57 tests PASS, including A05 PostgreSQL 4/4 |
| Control API typecheck/build | PASS |
| StoryCanvas v0.2 + provider/readiness directed tests | 29/29 PASS without paid calls |
| Governance | PASS |
| `git diff --check` | PASS |

## Environment exception

The Q1 runner selects a local Node runtime compatible with StoryCanvas native SQLite modules for the v0.2 receiver tests. The repository's complete Electron-driven StoryCanvas suite remains outside this Gate because the Electron installation is not healthy in this workspace. Q1 claims only the explicit 29/29 v0.2/provider/readiness directed tests and its 8/8 v0.1 validator boundary, not StoryCanvas full-suite PASS.

## Reproduction

```bash
node tests/e2e/pilot/run-contract-gate.mjs
```

No production provider was called. The internal token used by Q1 is a test-only independent value and is not reused as a Session or Grant signing secret. Real paid image/video calls, independent TTS provisioning/smoke, and the complete Electron suite are explicitly outside this contract Gate.
