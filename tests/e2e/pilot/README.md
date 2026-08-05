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
- B3 StoryCanvas v0.2 task/receipt public API: pending B3 implementation.

The StandardError mutation tests preserve the original Q1 reproduction and now require the C01.1 machine-readable policy to reject signed URLs, scripts, credentials, and cross-tenant existence disclosures.

The unknown-task oracle requires the C01.1 `RECEIPT_TASK_NOT_FOUND` decision: HTTP 404, rejected ACK, no durable Inbox write, no credit action, and no resource-existence disclosure.

The grant-scope evidence proves that the canonical fixture suite currently accepts a ProjectGrant that omits `production.task.write` while the fixture chain still contains a GenerationTaskCommand. The A3/B3 authorization layer must enforce the operation-specific scope even if C01 keeps structural and runtime authorization checks separate.
