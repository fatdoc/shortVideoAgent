# CV6 G3 UI independent gate

> Task: `T0-CV1-06`
>
> Integrated CV4 final: `f2783ad0ee89a7804b89092b74f411d81a883d8e` (`ANCESTOR`)
>
> Baseline: `af6e21ca2cc88dacf70c1b39c4d110332d569c1e`
>
> Gate result: `BLOCKED`

## Owner regression and visual evidence

```bash
node_modules/.bin/vitest run \
  src/features/canvas-v1/pages/CanvasV1Page.test.tsx \
  src/features/canvas-v1/model/contracts.test.ts
```

```text
2 files / 20 tests PASS
```

The passing owner suite covers loading, empty, blocked, ready, running, failed
and conflict states; GENERATE_SHOT shape; edited prompt; missing generation
approval; failure without candidate fabrication; keyboard focus; and safe
browser fixture/negative-vector parsing.

CV6 independently inspected the CV4 screenshots and copied them into the
allowed evidence set without changing image bytes:

```text
docs/program/t0-canvas-v1/evidence/CV6_G3_REUSED_CV4_1440x900.png
sha256 4655a50c0dbec0159ec84cb0b3a4a03f5dc8b0c9768df49d118aa8bb4525e1f1

docs/program/t0-canvas-v1/evidence/CV6_G3_REUSED_CV4_1672x941.png
sha256 de6278c038e5786ab917a4b8fe5d4a6895d7f18aa086521093827043126861a7
```

Both viewports show the intended restrained warm workspace, readable shot rail,
production chain, Asset Dock, inspector and Playlist without clipping. Visual
evidence does not override security or state-recovery RED.

## Independent blocking RED

Atomic commit:

```text
acf2904f043e1af312db94ec8e5f8e16578c50f2
test(gate): expose canvas ui fail-open paths
```

Exact paths:

```text
tests/e2e/canvas-v1/ui-contract.gate.test.tsx
scripts/t0-canvas-v1-gate/vitest.g3-ui.config.mjs
```

Reproduction:

```bash
node_modules/.bin/vitest run \
  --config scripts/t0-canvas-v1-gate/vitest.g3-ui.config.mjs
```

Exact result:

```text
3 tests / 3 PRODUCT RED
```

1. `BIND_ASSET_TO_ENTITY` is high-cost, but the Asset Binding drawer remains
   enabled when `approvalId` is null. The generation button is fail-closed; the
   binding path is not.
2. When a refreshed document supplies a newer version/prompt for the same shot,
   `NodeInspector` retains its stale local textarea state because its key is
   only the shot ID. Refresh recovery is therefore not authoritative.
3. `thumbnailUrl` and output `previewUrl` are unvalidated UI strings. Injected
   server-only `asset://` values are rendered into DOM `img src` attributes.

These are independently reproducible product failures. They are not missing
browser or Provider environment failures.

## Security, a11y and legacy checks

- The owner keyboard test passes for shot selection and the primary action.
- The drawer has a labelled modal role and Playlist provides keyboard DnD
  instructions. No claim of a full accessibility audit is made.
- Static search found no `/api/mvp/*`, LocalStorage or SessionStorage use in the
  CV4 component/page/view-state implementation.
- The owner safe-input test reports no storage writes or console output.
- The independent unsafe-input test proves DOM containment is incomplete and
  is the authoritative G3 security result.

Build/regression:

```text
npm run build                       PASS
npm run validate:governance         PASS
git diff --check                     PASS
```

## Gate conclusion

G3 remains `BLOCKED`. CV4 remediation must gate every high-cost command on the
correct approval, replace stale local prompt state when a newer authoritative
document arrives, and validate all media view URLs before rendering. This
report does not change the Master Plan and does not claim `ACCEPTED`.
