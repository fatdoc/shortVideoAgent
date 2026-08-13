# CV6 G4 Canvas Agent independent gate

> Task: `T0-CV1-06 / G4 Agent`
>
> Master baseline: `T0 Canvas V1 Master Plan v0.6`
>
> Revalidated integration head: `93f26d8af1ed4d37f43540c0b7cbe139e217923c`
>
> CV6 recommendation: `READY_FOR_GATE`

This is an independent G4 recommendation. It does not edit the Master Plan or
declare G4 accepted. CV0 alone owns the Gate decision.

## Configuration and isolated branch

CV6 ran with `gpt-5.6-sol` and `high` reasoning. The client speed setting was
not observable, so no `1.5x` claim is made.

```text
worktree: /Users/docfat/.codex/worktrees/t0-cv1-cv6-g4-agent-gate
branch:   codex/t0-cv1-cv6-g4-agent-gate
```

CV6 read the full Master v0.6, CV3 task, Canvas V1 domain and activation
contracts, all 38 negative vectors, EMPLOYEE_RULES/AUTONOMY, CV6 task and the
G2 runtime handoff before freezing the independent RED.

## Merge provenance

The QA branch used normal merge commits only. No rebase, reset, cherry-pick or
manual product copy was used.

```text
c4a6614c96820056333f289a10d2936299fb9d3d
  parent 1: 076c16442b5167fc076a8ce9ad40f143da583423
  parent 2: c782be95bb9a9cb846458ac99c25e500cb96ac97

cd208d28a58f963c2811674b84e340a6814daac4
  parent 1: 016118383a23b6c9bfe9d08ce4d5246f8c903128
  parent 2: ec8e6a50807c6741ab9e46225218aa1131dfd40c

4ed1f55760e5f46803cfa256f712d4054594b6cc
  parent 1: 658d789761b9bc0b9528e584ae9ec782ff067bcc
  parent 2: 93f26d8af1ed4d37f43540c0b7cbe139e217923c
```

The middle merge consumed CV3's frozen branch product for early independent
reproduction. The final required merge aligned the QA branch with the exact
integrated descendant. Product files introduced by these merge parents are not
part of the CV6 write set.

## RED to GREEN evidence

Before CV3 implementation existed, the policy gate produced exactly:

```text
2 PASS
2 EXPECTED_RED: Canvas V1 Agent source and skill surface absent
```

The dynamic gate separately failed at module load because the frozen
`apps/storycanvas/src/agents/canvas-v1/index.ts` surface was absent. Contract
self-checks were already green. No test was skipped or weakened to obtain this
RED.

After the integrated CV3 product merge:

```bash
CANVAS_V1_VERIFIED_DEPS_ROOT=/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent2/videoagent \
  node scripts/t0-canvas-v1-gate/run-g4-agent-gate.mjs
```

```text
static policy/isolation: 4 PASS
dynamic runtime:         7 PASS
G4_AGENT_GATE_PASS
```

The independent matrix proves:

- exactly twelve allowlisted tools and no unknown tool execution;
- every tool rejects host-bound tenant/project/package/session/actor/approval
  fields, provider identifiers, unknown fields and batch/multi-shot shapes
  before any port call;
- all read ports receive the exact host authority and accept only strict,
  browser-safe, exact-scope projections;
- the only write port is `ports.executeCanvasCommand`, which is the injected
  adapter to the accepted `CanvasCommandService.execute` authority;
- missing assets, `ready=false`, readiness identity drift and incomplete
  reference assets return a bounded plan/block with zero dispatch;
- all five high-cost commands return `confirmation_required`, cannot accept or
  mint `approvalId`, and dispatch only after the exact two-field host resume;
- `SYNC_PROVIDER_ASSET` and `SAVE_CANVAS_DOCUMENT` remain low-cost but still
  use strict `requestSource=agent` CanvasCommand objects through the common
  service port;
- UI, Story and Agent preserve the same strict eight-command enum and command
  parser shape;
- generation accepts one `shotId` only; batch and `shotIds` inputs fail before
  reads or writes;
- response-loss retry preserves the complete command byte-for-data, including
  command ID, scope, actor, approval and payload; the already accepted common
  service evidence proves one paid-provider start;
- unsafe read data and transport errors are reduced to fixed safe output. Agent
  source/skill/log/output checks contain no Provider raw data, internal URI,
  credential, secret or authority marker;
- Canvas V1 Agent imports neither legacy Production/Script agents nor database,
  Provider, memory or socket mutation surfaces.

## Owner and audit-point evidence

CV3 owner targeted suite, run from the StoryCanvas package root:

```text
11 PASS / 0 FAIL / 0 SKIP
```

CV0 audit points were inspected independently:

- a high-cost draft is validated as a complete strict command using a bounded
  private validation approval, then the placeholder is removed before any
  Agent-visible result;
- host authority projects to the four domain scope fields; `actorId` is bound
  only to `requestedByActorId`, and leaked `actorId` is rejected by closed
  domain parsers;
- `resumeApproved` accepts exactly `{commandId,approvalId}` and rejects missing
  or extra confirmation fields;
- the approved command is retained for response-loss recovery and each retry
  submits identical complete command data. Same command evidence reaches the
  common service replay path without a duplicate Provider start.

No blocker was found in these four points.

## Regression and build evidence

```text
Canvas V1 domain/activation validators: 6/6 + 6/6 PASS
CV6 complete contract gate:             PASS (6 + 7 + 5 + 5 + 43)
G2 approval-boundary gate:               23/23 PASS
G2 provider/recovery gate:               18/18 PASS
Control authority targeted:              60/60 PASS
StoryCanvas v0.2:                        13/13 PASS
Media/TTS/Storage:                       17/17 PASS
Control build + typecheck:               PASS / PASS
StoryCanvas build:                       PASS
Root TypeScript/Vite build:              PASS
Governance:                              PASS
git diff --check (staged + unstaged):     PASS
```

The StoryCanvas and Control targeted commands used ignored local dependency
links to the verified repository dependency roots; no lockfile or dependency
manifest changed. The installed Electron launcher was unavailable in that
dependency root, so the exact v0.2 and Media/TTS/Storage source matrices were
run through the verified `tsx` Node runner and passed 13/13 and 17/17.

StoryCanvas build regenerated `apps/storycanvas/data/serve/app.js`. CV6 restored
that tracked artifact to its exact HEAD content after the successful build.

Root suite classification remains exactly unchanged:

```text
483 PASS / 4 historical Shared RED
```

The four failures remain two Proxy assertions, one Router assertion and one
Bridge implementation RED. They were not deleted, skipped, weakened or
reported as G4 failures.

## Exact CV6 write set

Atomic CV6 commits:

```text
568b7bd0110f5a1be127a37223920970364d1897  test(gate): freeze canvas agent policy
2ee59f18a799337fe156f77c318e047ee5266c79  test(gate): add independent agent runtime matrix
016118383a23b6c9bfe9d08ce4d5246f8c903128  test(gate): close agent scope input matrix
658d789761b9bc0b9528e584ae9ec782ff067bcc  fix(gate): support story agent module shape
```

Exact CV6 paths relative to the integrated product head:

```text
scripts/t0-canvas-v1-gate/run-g4-agent-gate.mjs
scripts/t0-canvas-v1-gate/run-g4-agent-policy.mjs
tests/e2e/canvas-v1/agent-policy.fixture.json
tests/e2e/canvas-v1/agent-policy.gate.test.mjs
tests/e2e/canvas-v1/agent-runtime.gate.test.ts
docs/program/t0-canvas-v1/handoffs/CV6_G4_AGENT_GATE.md
```

Protected comparison against `93f26d8af1ed4d37f43540c0b7cbe139e217923c`
shows no CV6 diff to the eight CV3 product paths, Master Plan, Canvas contracts,
`byteplus.ts`, Shared Router, Bridge, Proxy or Vite config. Required G4 tests
contain no `skip`, `only` or `todo`.

## Non-claims and downstream step

No real paid Seedance call was made. G6 is not executed and remains incomplete.
This evidence does not claim a real Provider task, real browser Golden Path,
Canvas V1 completion, AB Golden Path completion or Joint Gate pass.

Downstream first step: CV0 verifies the commit objects, merge parents, exact
paths and reproduced commands, then alone decides whether G4 is accepted.
