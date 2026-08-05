# Q1 Package / Grant / Task Cross-plane Contract Gate

> Date: 2026-08-05
>
> Branch: `codex/pilot-v0-control-plane`
>
> Gate state: `BLOCKED` on StoryCanvas v0.2 receiver; Q1-owned tests are complete

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
| A3 Control API package/grant HTTP and signed token | Real route handlers, token verifier, least-privilege policy and C01 validator | PASS, 9/9 |
| StoryCanvas v0.2 package/grant/task/receipt receiver | No public v0.2 implementation is present | BLOCKED on B3 |
| PostgreSQL durable Inbox/ACK/ledger side effects | No v0.2 receipt receiver is present | BLOCKED on A/B implementation |

## Findings and responsibility

1. C01.1 commit `965d340` closes the original StandardError disclosure gap and freezes unknown-task semantics. The preserved mutation tests now require rejection.
2. A3 commits `8a59470`, `e9f6685`, and `37f37ab` pass the real HTTP/token Gate. Q1 verifies project-scoped idempotency, independent Grant signing secret/kid, tamper/expiry, least privilege, cross-tenant opacity, approval/revocation responses, and actual StandardError bodies against the canonical C01 validator.
3. The structural C01 fixture validator accepts a ProjectGrant that omits `production.task.write` while a GenerationTaskCommand exists in the fixture chain. This is recorded as a boundary, not authorization: A3 runtime policy rejects capability/scope expansion and B3 must enforce the required operation scope.
4. StoryCanvas currently exposes the real v0.1 Demo validators only. They correctly reject v0.2 objects instead of silently treating Pilot truth as Demo truth, but this is not v0.2 interoperability.
5. Durable receipt ordering, Inbox ACK, unknown-task rejection, and settlement side effects cannot be claimed against production code until a public v0.2 receipt receiver exists.

## Final verification

| Gate | Result |
| --- | --- |
| Q1 top-level Gate | 9 PASS, 0 FAIL, 1 SKIP (B3 v0.2 receiver) |
| Expanded Q1 logical tests | 34 PASS: C01 6, StoryCanvas v0.1 8, protocol oracle 6, mutation checks 5, A3 HTTP/security 9 |
| Root tests | 30 files / 195 tests PASS |
| Root build | PASS; existing Vite chunk-size warning only |
| Control API with temporary dedicated PostgreSQL | 13 files / 50 tests PASS, including A05 PostgreSQL 4/4 |
| Control API typecheck/build | PASS |
| StoryCanvas provider/readiness directed tests | 16/16 PASS without paid calls |
| Governance | PASS |
| `git diff --check` | PASS |

## Environment exception

The StoryCanvas default Electron-driven suite is still not a valid full-suite signal in this workspace. A direct root-Node run of `remoteOutputStorage.test.ts` reaches a `better-sqlite3` ABI mismatch (`NODE_MODULE_VERSION 127` versus Node 20 module 115); running readiness from the repository root also misses the StoryCanvas `@/` path mapping. These are separated from the successful Q1 contract result. Q1 therefore claims only the explicit 16/16 provider/readiness directed tests and its own 8/8 v0.1 validator boundary, not StoryCanvas full-suite PASS.

## Reproduction

```bash
node tests/e2e/pilot/run-contract-gate.mjs
```

No production provider was called. The remaining blocker belongs to B3: expose StoryCanvas v0.2 package/grant/task/receipt validators and public receiver APIs, then replace the final skipped test with durable cross-plane assertions.
