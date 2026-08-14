# CV6 Story G5 workspace independent gate

> Task: `T0-CV1 / Story formal workspace, materialization and controlled media`
>
> Final integrated product head: `a408ad63e43629a54b6c826bff05e3a2b011d0a3`
>
> CV6 recommendation: `ACCEPT / READY_FOR_GATE`

This is an independent QA recommendation. It does not edit the Master Plan or
contracts and does not declare G5 accepted; CV0 owns the Gate decision.

## Isolation and merge provenance

```text
worktree: /Users/docfat/.codex/worktrees/t0-cv1-cv6-story-g5-workspace-gate
branch:   codex/t0-cv1-cv6-story-g5-workspace-gate
baseline: 311859cf64073fc208384cfe9224668a3b0f3a14
```

CV6 used normal merges only. No rebase, reset, cherry-pick or manual product
copy was used. Product merge commits and exact parents are:

```text
295f3a3e8768ed6189d1c47c93831cd3bd0eccac
  9cde431571548925aa9e1bca7368f66b4eaf2637
  4daf27ced981360e9a21d73fcbbc992ae381e53f

6449ed34eafbc71373a2e16fc1bff88d1abe4ad1
  6adbbffc8cdd01250cb4411c482724472cb6be79
  75679833b9e7465134fe145ac2173b81a5fc9fd7

ffbc8547c1665e75c70cd7c777de59f25ed421c7
  6449ed34eafbc71373a2e16fc1bff88d1abe4ad1
  dafee8e34b7881480380932758b760ee6504b864

180421eed5fb1cf9dd0c8334ccd2c76e158eb88e
  21f5b6d33447eee422db5efa10f3518f6127d533
  3cea0b2263ea60fc1ac3f8845bb1ecf273306e11

9576634f172cc753ccea0479215399c43a21617a
  86a06269b03da1ce6048413860753c1d3ed49140
  210e79348807ad596d9482468f024de04972e47d

2d055e173e083ec4ed6d7c064408b25165fa8982
  fd090e568ebe761acead9651c220fd6d6c5f625a
  a408ad63e43629a54b6c826bff05e3a2b011d0a3
```

Merge diffs are upstream integration content and are excluded from the CV6
write set.

## Independent blockers and remediation

CV6 reproduced two product blockers after the initial controlled-media slice:

1. `CanvasV1ControlledMediaService` selected rows by exact database columns but
   did not exact-check the parsed persisted `CanvasEvent` and `CanvasCommand`
   authority. A poisoned event JSON project or command JSON actor still reached
   URL signing/object storage. Independent RED
   `e06e74800a7a77e02a1edf7c65ca305d44fd3690` froze both variants. Owner fix
   `b7a78866b6151d7f15a9db2f6f6995a51d5c0cee` now rejects event/command scope,
   identity, type and actor drift before target resolution, signing or fetch.
2. Runtime passed `media: controlledMedia` to an aggregate contract requiring
   `media: { media: controlledMedia }`. The real formal media route therefore
   lacked its `open` port; Story strict TypeScript independently reported
   `runtime.ts(271)` as TS2741. RED
   `fd090e568ebe761acead9651c220fd6d6c5f625a` froze the exact nested port.
   Owner fix `6e789123b8c435f22adba970eeb90d1e7b9b91f2` corrected wiring, added a real
   aggregate HTTP preview test, and separated route-only errors from the frozen
   command-event error union.

CV6 did not modify product code. Both REDs pass after their integrated fixes.

## Independent Story product evidence

```bash
CANVAS_V1_VERIFIED_DEPS_ROOT=/Users/docfat/Desktop/个人/智能体社区/项目/短视频agent2/videoagent \
  node scripts/t0-canvas-v1-gate/run-story-workspace-product-gate.mjs
```

```text
Workspace/materialization validator:           69 vectors / 9 groups PASS
Workspace Authority validator:                 30 vectors / 6 groups PASS
CV6 static public/security/wiring policy:       6/6 PASS
CV6 public dynamic runtime:                     10/10 PASS
STORY_WORKSPACE_PRODUCT_POLICY_PASS
```

The independent gate establishes:

- exact server-only Control authority request/response scope and fixed safe
  dependency errors;
- trusted prepare uses one transaction, deterministic UUIDv5 document/target/
  requirement IDs and exact Package storyboard order/prompts; casting count
  zero or greater than one performs zero writes;
- formal bootstrap and workspace are bodyless GETs, authenticate Origin,
  HttpOnly session, active Canvas session and exact scope before data access;
- workspace GET executes SELECT-only queries and projects exact Package shots,
  requirements, readiness, real command/event/task/media joins and no server
  authority;
- response loss retries the identical complete materialization request and
  attempt; response drift fails closed;
- verified bytes are published with an application-created temporary file and
  atomic rename; same facts replay, while changed content/mapping conflicts
  without overwriting the file or database facts;
- controlled media exact-joins persisted command, event, task, media, storage
  key and authenticated scope, proxies bounded Range with redirects disabled,
  and returns no signed URL, provider/storage/local path or token;
- poisoned event scope and poisoned command actor both stop before another
  signing operation or object-storage read;
- the real runtime aggregate supplies the nested media service port and the
  formal preview route invokes it.

## Regression, build and protected evidence

```text
Story Canvas owner service/route matrix:        48/48 PASS
CV2 owner final reported matrix:                60/60 PASS
Canvas V1 domain/parity contract gate:          PASS (6 + 7 + 5 + 5 + 43)
G5 additive contract/parser/UI hydration:       PASS (69 + 30 vectors)
G2 approval boundary:                           23/23 PASS
G2 provider recovery:                           18/18 PASS
G4 Agent policy/runtime:                        4/4 + 7/7 PASS
root TypeScript/Vite build:                     PASS
Story backend/Electron build:                   PASS
governance:                                     PASS
git diff --check:                               PASS
```

Story's repository-wide `tsc --noEmit` still reports 29 pre-existing legacy
Zod/JSONSchema incompatibility errors. CV6 classified the four G5-owned strict
paths (`runtime.ts`, `canvasCommandService.ts`, `errors.ts`, `http.ts`) and
found zero remaining G5-owned TypeScript errors. The Story build artifact was
restored to exact HEAD content after build verification.

Protected comparison against the final integration head shows only the final
CV6 assertion adjustment and this handoff. Across the complete QA lineage CV6
changed only the allowed script/test/handoff paths below; it did not change
product, Master, contracts, `byteplus.ts` or Shared files.

## Exact CV6 commits and paths

```text
df85c3c95679df78bf41bd4e440bfe96f12af88e  freeze product policy
b6215b5d744170b85875b24147d24c39ab9aa81f  add runtime harness
9cde431571548925aa9e1bca7368f66b4eaf2637  freeze trusted prepare
6adbbffc8cdd01250cb4411c482724472cb6be79  revalidate prepare slice
21f5b6d33447eee422db5efa10f3518f6127d533  extend workspace slice gate
e06e74800a7a77e02a1edf7c65ca305d44fd3690  reject authority poison RED
86a06269b03da1ce6048413860753c1d3ed49140  prove safe media proxy
fd090e568ebe761acead9651c220fd6d6c5f625a  freeze runtime media wiring RED
811732d51b01477bcd8f9c0b5416ca025bf322ce  scope corrected wiring assertion
```

Exact CV6 paths:

```text
scripts/t0-canvas-v1-gate/run-story-workspace-product-gate.mjs
tests/e2e/canvas-v1/story-workspace-product-policy.fixture.json
tests/e2e/canvas-v1/story-workspace-product-policy.gate.mjs
tests/e2e/canvas-v1/story-workspace-product.gate.test.ts
docs/program/t0-canvas-v1/handoffs/CV6_STORY_G5_WORKSPACE_GATE.md
```

## Recommendation and non-claims

CV6 recommends `ACCEPT` for the Story G5 formal workspace, materialization and
controlled-media product slice and reports `READY_FOR_GATE`. CV0 should verify
the commit objects, merge parents, commands and protected diff before recording
the Gate decision.

No paid Seedance call was made. This evidence does not claim a real Provider
task, G6 completion, browser Golden Path, Canvas V1 completion, AB Golden Path
completion or Joint Gate acceptance.
