# CV6 G5 additive contract compatibility gate

> Task: `T0-CV1 / G5 additive Workspace, Materialization and Workspace Authority contracts`
>
> Master baseline: `T0 Canvas V1 Master Plan v0.7`
>
> Revalidated integration head: `0cc3b3613c86e8b5a17e62727d2f7d3ca3c32392`
>
> CV6 compatibility recommendation: `ACCEPT / READY_FOR_GATE`

This is an independent compatibility recommendation for the frozen additive
contracts and parsers. It does not edit the Master Plan, declare G5 accepted or
accept parser/docs evidence as the G5 product implementation. CV0 alone owns
the Gate decision.

## Configuration and isolated branch

CV6 ran with `gpt-5.6-sol` and `high` reasoning in:

```text
worktree: /Users/docfat/.codex/worktrees/t0-cv1-cv6-g5-additive-contract-gate
branch:   codex/t0-cv1-cv6-g5-additive-contract-gate
baseline: ae73b4f64e6c3a516b24413e67b7ca4c06b86f50
```

CV6 read Master v0.7, Activation Transport, Canvas V1 domain and additive
contracts/vectors, CV5 and CV6 tasks and the G4 handoff before freezing the
independent Gate.

## Merge provenance

All upstream product/contract intake used normal merge commits. No rebase,
reset, cherry-pick or manual product copy was used.

```text
9cb476a59b800da745a56487243815ae0eafeeec
  parent 1: ae73b4f64e6c3a516b24413e67b7ca4c06b86f50
  parent 2: 72ccb20b4701791a309d4713818d21f22854830c

cc773b46f42d015eb5b6f75d174369c9b4cdd159
  parent 1: 5bb98a45c88bbd06be8d62fcc7570452ae267b01
  parent 2: f412e5e6cb5781d4dc6343ab8da31e640c978e19

0f7e64d08d0894b3cb2275c53988e5f8c7b9fc0b
  parent 1: 82f6a0852a5d0d178d82947fc6b2a803f7bbf226
  parent 2: 0cc3b3613c86e8b5a17e62727d2f7d3ca3c32392
```

The merge diffs are upstream integration content and are excluded from the CV6
write set.

## Independent RED and remediation evidence

CV6 found two independent compatibility REDs outside the original fixed
vectors:

1. Story rejected a regex-shaped impossible workspace timestamp while the
   browser parser accepted it.
2. Story materialization parsing of an exactly allowed 8 MiB JPEG raised an
   uncaught `RangeError` from the large base64 regular expression.

CV1 froze and integrated the canonical timestamp and bounded base64
remediations. The final independent boundary now proves:

```text
1 decoded byte canonical base64, no image magic -> CANVAS_MATERIALIZATION_MIME_UNSUPPORTED
minimum JPEG FF D8 FF + exact facts           -> PASS
exact valid 8 MiB JPEG + exact facts          -> PASS
8 MiB + 1 declared/encoded boundary           -> CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE
malformed/noncanonical base64                  -> CANVAS_MATERIALIZATION_RESPONSE_INVALID
uncaught parser errors                         -> none
```

Story and browser also reject impossible calendar dates, timestamp rollover
and non-UTC offset forms with the same fixed code.

## Compatibility evidence

The final additive runner:

```bash
CANVAS_V1_VERIFIED_DEPS_ROOT=/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent2/videoagent \
  node scripts/t0-canvas-v1-gate/run-g5-additive-contract-gate.mjs
```

passed all phases:

```text
Workspace/Materialization contract validator:  9/9 PASS
Workspace Authority amendment validator:        6/6 PASS
CV6 independent additive facts/security:        7/7 PASS
Story owner additive parser suite:               7/7 PASS
CV6 Story/browser parity and boundaries:        11/11 PASS
Browser owner parser + real UI hydration:        6/6 PASS
G5_ADDITIVE_CONTRACT_GATE_PASS
```

The matrix coverage is exact:

```text
Canvas V1 domain negative vectors:              38
Activation Transport negative vectors:          25
Workspace/Materialization negative vectors:     69
Workspace Authority negative vectors:           30
```

The independent checks establish:

- strict schema and fixture compatibility without redefining the frozen nine
  Canvas V1 domain objects;
- Story/browser exact parser preservation and stable-code parity for all
  executable Workspace and Authority vectors;
- real `CanvasV1Page` hydration from parsed workspace facts with the actual
  project name, exact shot content, exact per-shot event key, controlled media,
  saved state and no component/demo fallback;
- browser workspace containment of storage, provider, signed URL, raw bytes,
  token and internal authority;
- complete fail-closed workspace status and ordered reasons;
- materialization category/MIME allowlists, canonical base64, magic bytes,
  actual byte size, SHA-256, exact request scope and replay behavior;
- server-only materialization request/response rejection by the browser
  workspace parser;
- public RFC 4122 UUIDv5 target/requirement IDs match on Story and browser;
- zero/multiple virtual-character casting errors are fixed, while one unique
  pending asset remains the deterministic choice without auto-approval;
- invalid asset or shot UUIDv5 derivation facts fail closed with the fixed
  authority response code.

Transport-only product obligations such as internal authentication before
parsing, 16 KiB HTTP enforcement, no-store, log containment, exact authority
queries and atomic/read-only persistence remain frozen contract requirements;
this compatibility Gate does not claim their downstream product implementation.

## Regression, build and protected evidence

```text
Complete Canvas V1 contract gate:               PASS (6 + 7 + 5 + 5 + 43)
Activation Transport validator:                 6/6 PASS
Root TypeScript/Vite build:                      PASS
Control API build + typecheck:                   PASS / PASS
StoryCanvas build:                               PASS
Governance validation:                           PASS
git diff --check (staged + unstaged):            PASS
```

StoryCanvas build regenerated `apps/storycanvas/data/serve/app.js`; CV6 restored
that known generated artifact to exact HEAD content after the successful build.
Dependency links point only to the verified repository dependency roots and
are ignored; no manifest or lockfile changed.

Protected comparison against
`0cc3b3613c86e8b5a17e62727d2f7d3ca3c32392` shows no CV6 diff to product,
Master Plan, contracts, `byteplus.ts`, Shared Router/Bridge/Proxy/Vite or owner
tests. Required independent tests contain no `skip`, `only` or `todo`.

## Exact CV6 write set

Atomic CV6 commits before this handoff:

```text
5bb98a45c88bbd06be8d62fcc7570452ae267b01  test(canvas-v1): freeze g5 additive contract gate
f7626f63ec602bac24756910e8510b26359fa4ba  test(canvas-v1): extend additive boundary vectors
82f6a0852a5d0d178d82947fc6b2a803f7bbf226  test(canvas-v1): freeze codec magic boundaries
41bb3144746b4bca26c1af71831bd32ae33dd391  test(canvas-v1): revalidate workspace authority amendment
```

Exact paths:

```text
scripts/t0-canvas-v1-gate/run-g5-additive-contract-gate.mjs
scripts/t0-canvas-v1-gate/vitest.g5-additive-contract.config.mjs
tests/e2e/canvas-v1/contract-facts.gate.mjs
tests/e2e/canvas-v1/workspace-hydration.gate.test.tsx
tests/e2e/canvas-v1/workspace-materialization-contract.gate.mjs
tests/e2e/canvas-v1/workspace-materialization-parity.gate.ts
docs/program/t0-canvas-v1/handoffs/CV6_G5_ADDITIVE_CONTRACT_GATE.md
```

## Non-claims and recommendation

No real paid Seedance call was made. G6 is not complete. This evidence does not
claim the G5 Control/Story/Shared HTTP, persistence or browser Golden Path.

CV6 recommends `ACCEPT` for additive contract/parser compatibility and
`READY_FOR_GATE` for CV0 verification. CV0 should independently verify commit
objects, merge parents, exact paths and reproduced commands before making any
Master or G5 decision.
