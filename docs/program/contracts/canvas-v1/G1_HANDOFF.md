# T0-CV1-01 G1 contract handoff

> Owner: CV1 Contract Architect
>
> Branch: `codex/t0-cv1-contract`
>
> Status: `READY_FOR_GATE` — CV0/CV6 acceptance is still required

## Baseline and atomic commits

Baseline received after G0:

```text
9432c54574cac9eb7f3d8e952d158b46c22f0c64
```

Atomic slices:

```text
CV1-A 9690885765b2ffeb308e06e3a17b416439996578
      docs(contracts): inventory canvas v1 authorities

CV1-B 1f2b2abd47e9b0a92730f61cf8d1ca63e7a60e96
      test(contracts): freeze canvas v1 conformance vectors

CV1-C 898b3067f4d82e302e67fa735baf80e61c7fabe7
      feat(contracts): add strict canvas v1 parsers
```

The CV1-D commit is the commit that adds this handoff and `README.md`; its full
SHA is reported to CV0 immediately after the atomic commit because a commit
cannot truthfully contain its own final hash.

## Exact changed paths

CV1-A:

```text
docs/program/contracts/canvas-v1/AUTHORITY_INVENTORY.md
```

CV1-B:

```text
docs/program/contracts/canvas-v1/canvas-v1.schema.json
docs/program/contracts/canvas-v1/schema-index.json
docs/program/contracts/canvas-v1/negative-vectors.json
docs/program/contracts/canvas-v1/validate-contract.mjs
docs/program/contracts/canvas-v1/fixtures/asset-record.json
docs/program/contracts/canvas-v1/fixtures/canvas-bootstrap.json
docs/program/contracts/canvas-v1/fixtures/canvas-command.json
docs/program/contracts/canvas-v1/fixtures/canvas-document.json
docs/program/contracts/canvas-v1/fixtures/canvas-event.json
docs/program/contracts/canvas-v1/fixtures/entity-binding.json
docs/program/contracts/canvas-v1/fixtures/provider-asset-binding.json
docs/program/contracts/canvas-v1/fixtures/shot-asset-requirement.json
docs/program/contracts/canvas-v1/fixtures/shot-readiness.json
apps/storycanvas/src/contracts/canvas-v1/contracts.test.ts
src/features/canvas-v1/model/contracts.test.ts
```

CV1-C:

```text
apps/storycanvas/src/contracts/canvas-v1/index.ts
apps/storycanvas/src/contracts/canvas-v1/contracts.test.ts
src/features/canvas-v1/model/contracts.ts
src/features/canvas-v1/model/contracts.test.ts
```

CV1-D:

```text
docs/program/contracts/canvas-v1/README.md
docs/program/contracts/canvas-v1/G1_HANDOFF.md
```

No file outside the CV1 exact write set changed. In particular, this task did
not modify Master Plan, `handoffs/**`, Control API authority, Router/Bridge,
runtime services, migrations, historical v0.2, Shared RED, or protected
`apps/storycanvas/data/vendor/byteplus.ts`.

## Implemented contract evidence

- Exactly nine objects are registered in JSON Schema and schema index.
- Every object has a canonical success fixture.
- All object and nested object parsers reject unknown fields.
- Backend and frontend accept the same fixtures without transformation.
- Backend and frontend execute the same negative vector matrix and return the
  same stable conformance code.
- ProviderAssetBinding is server-only; all other registered projections pass
  the browser safety scanner.
- UUID/`pcs_*`, canonical timestamp, exact scope, rights/approval/provider/
  entity/capability readiness, high-cost `approvalId`, command payload shape,
  replay/conflict, optimistic document version, new-session recovery and event
  fact ordering are executable invariants.
- Historical Pilot v0.2 remains unchanged.

## Test commands and exact results

Dependency-free facts/schema coverage:

```text
node docs/program/contracts/canvas-v1/validate-contract.mjs
5 tests / 5 pass / 0 fail
```

StoryCanvas backend conformance:

```text
apps/storycanvas/node_modules/.bin/tsx --test \
  apps/storycanvas/src/contracts/canvas-v1/contracts.test.ts
4 tests / 4 pass / 0 fail
```

Frontend conformance:

```text
node_modules/.bin/vitest run \
  src/features/canvas-v1/model/contracts.test.ts
1 file / 4 tests / 4 pass / 0 fail
```

Root TypeScript:

```text
node_modules/.bin/tsc -b --pretty false
PASS / exit 0
```

Targeted StoryCanvas strict TypeScript:

```text
cd apps/storycanvas
node node_modules/typescript/bin/tsc --noEmit \
  --target ESNext --module CommonJS --moduleResolution Node \
  --esModuleInterop --strict --skipLibCheck \
  src/contracts/canvas-v1/index.ts \
  src/contracts/canvas-v1/contracts.test.ts
PASS / exit 0
```

The independent CV1 worktree initially had no installed `node_modules`.
Validation used temporary symlinks to the user workspace's already-installed
dependency directories; both symlinks were removed before staging. No package,
lockfile or dependency directory changed.

Full StoryCanvas `tsc --noEmit` with that mixed dependency installation remains
red on pre-existing `productionAgent`/Zod JSONSchema type incompatibilities. The
same run initially also identified the new test's CommonJS `import.meta`; CV1
removed `import.meta` and the targeted new files now pass strict TypeScript.
The remaining full-project diagnostics are outside CV1's write set and are an
already-known baseline/dependency noise, not reported as GREEN.

Before every commit:

```text
git diff --cached --check
PASS

git diff --cached --name-only
matched the exact slice paths
```

## Security evidence

- Canonical browser fixtures contain no forbidden key/value markers.
- Negative network projections explicitly cover the old workspace provider
  identifiers, `asset://`, signed preview URL, Package digest and ProjectGrant.
- Browser parsers scan before parsing, so an unknown forbidden field returns
  `CANVAS_BROWSER_PROJECTION_UNSAFE` instead of being stripped.
- ProviderAssetBinding is rejected as a browser object even when structurally
  valid server-side.
- Bare `userConfirmed`, raw `idempotencyKey`, package digest and grant material
  are frozen negative vectors.
- Public event errors have a closed code list, bounded message and secret marker
  rejection. Provider raw body/message is not part of any public type.
- Accepted events cannot claim provider submission; tasks need task IDs; output
  must precede receipt.
- Same command/same semantic payload replays; changed semantic payload in the
  exact scope conflicts without authorizing another side effect.

Machine facts SHA-256 at CV1-C:

```text
53cefc3691f0d52807ae1fba7ef0b9e21d1cbaf06bff63ba4f49ec3568141ac0  canvas-v1.schema.json
8bb395814beed3dee036df61e1045cbe43f49455c87c014d9e77403c847889cf  schema-index.json
d315defffd096f5c268f94d95fa5270021258f15582e03c27c88e8ad445a6b7f  negative-vectors.json
820075eeafdd2731ffd190fd3d40798b0b974fc7ad8f12eb6722a140d5dcd8be  fixtures/asset-record.json
6e5cd60f4362a3b511ae0d93f2d7f7af7bf071e3d3af19ac6f6c3d1570f430db  fixtures/canvas-bootstrap.json
751683947e14ca62c5c64e59e6233da6e322a2229bb2fa9a1d4bf1e6ff3ef9a4  fixtures/canvas-command.json
d51428c1a77243e3dc91157e2bf426809045759523c00acb3f9edd698f62d23a  fixtures/canvas-document.json
997e12bd5815aaf53c556d728b82ba4b463b5011c7c40efdb728d63eb47539eb  fixtures/canvas-event.json
abc31573ba8fcdf4c046e7645f297216898b5337e7bd1197e58d1db936061c6e  fixtures/entity-binding.json
4e1055b1aa29a3a133afdbbac265aefb70dd88f39820cad991e4f4a5d74c43b3  fixtures/provider-asset-binding.json
0f7c79afdef1165e06461e93a8036369fac11e2bb51822a27715a5107284eb42  fixtures/shot-asset-requirement.json
e8d45bff46d3e63e733534aa74cf2253f29484bdca5e6dc20a2617228c6044f5  fixtures/shot-readiness.json
```

## Known risks and explicit non-claims

- JSON Schema is the portable documentation/facts schema; conformance is
  additionally enforced by the stricter semantic runtime parsers. A downstream
  implementation must not rely on structural JSON Schema alone for readiness,
  event or command payload semantics.
- StoryCanvas and frontend maintain separate runtime implementations by design.
  Their shared fixture/vector tests are mandatory drift protection.
- `approvalId` validation, provider normalization, durable idempotency records,
  migrations, APIs, UI, Agent and Control approval persistence are not
  implemented by CV1.
- `EXPORT_PLAYLIST` is a frozen optional-capability command, not proof that MP4
  export exists.
- Passing contract conformance does not mean a real editor, real Provider task,
  business integration, Golden Path or Joint Gate exists.
- This handoff is `READY_FOR_GATE`; only CV0 can mark G1 `ACCEPTED`.

## Rollback

CV0 may revert the four CV1 commits in reverse order without rewriting history:

```text
git revert <CV1-D-full-SHA>
git revert 898b3067f4d82e302e67fa735baf80e61c7fabe7
git revert 1f2b2abd47e9b0a92730f61cf8d1ca63e7a60e96
git revert 9690885765b2ffeb308e06e3a17b416439996578
```

No database migration, external service, remote branch or user data needs
rollback.

## Downstream first steps after G1 acceptance

CV2 StoryCanvas asset/command backend:

1. Import the StoryCanvas parser/types and load canonical fixtures in its RED.
2. Add persistent V1 records/adapters that resolve the current `pcs_*` authority
   to exact tenant/project/package/session/actor scope.
3. Implement four-layer readiness and durable command/provider idempotency
   before connecting paid Provider calls.

CV3 Canvas Agent:

1. Generate the tool allowlist from `CANVAS_V1_COMMAND_TYPES`.
2. Emit the same CanvasCommand fixture shape as UI and require server-issued
   `approvalId`; do not accept scope authority, provider data or raw keys from
   the Agent.

CV4 Canvas UI:

1. Use only `parseCanvasV1BrowserContract` and canonical browser fixtures.
2. Render ordered ShotReadiness reason codes and explicit blocked/failure facts.
3. Never import ProviderAssetBinding or infer task/output/receipt progress.

CV5 Control/business integration:

1. Build a new safe CanvasBootstrap adapter/route instead of reusing public
   Package/Grant DTOs.
2. Persist Control AssetRecord rights/approval and HighCostCommandApproval under
   authenticated actor context; expose only safe projections/`approvalId`.
3. Keep existing A-owned authority unchanged and use a trusted server channel
   for StoryCanvas validation.

CV6 QA/Gate:

1. Independently run the dependency-free validator and both runtime suites.
2. Compare negative-vector code parity, scan browser/network/DOM/log fixtures
   for forbidden markers, and verify exact write set/protected path evidence.
