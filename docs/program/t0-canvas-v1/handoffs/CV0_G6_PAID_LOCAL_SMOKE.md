# CV0 G6 Paid Seedance Local Smoke

Date: 2026-08-14 (Asia/Shanghai)

## Decision

The user explicitly authorized exactly one controlled paid Seedance smoke.
CV0 executed one Provider task creation attempt and the task reached
`succeeded`. Because the configured TOS credentials failed the signed object
read preflight with HTTP 403 `AccessDenied`, the user explicitly selected a
local-output fallback. The generated MP4 was downloaded and verified locally;
no TOS write was attempted.

This evidence proves the real Seedance credential, selected model, one Active
reference asset and local download path can complete a minimal paid task. It
does **not** prove the Canvas browser command/approval chain, TOS persistence,
controlled-media projection, Golden Path completion or Joint Gate acceptance.

## Source identity and containment

```text
tested integration HEAD: 49af8a39b82213fbc13ebcf841c4c00b78962787
provider task POST attempts: 1
automatic paid POST retries: 0
task fingerprint: 7136fb91e6fd2598
raw Provider task ID: local state only, mode 0600
local MP4 and state: outside repository, mode 0600
TOS configuration: retained unchanged in ignored local .env
apps/storycanvas/data/vendor/byteplus.ts: untouched
```

No raw API key, TOS secret, internal token, Provider task ID, `asset://` value,
signed URL or Provider response body is included in this handoff.

## Non-paid preflight

```text
Asset Group read:                 PASS
Active Image assets:              2
configured TOS host match:        PASS
configured TOS prefix match:      PASS
existing Provider asset URL read: HTTP 206
AK/SK signed TOS object read:     HTTP 403 AccessDenied
```

The 403 was treated as a paid-before-write blocker. CV0 did not submit a task
until the user explicitly chose the local-output fallback.

## Paid task facts

```text
Provider create attempts: 1
terminal Provider status: succeeded
duration requested:       4 seconds
resolution requested:     480p
aspect ratio requested:   9:16
audio generation:         false
reference assets:         1 Active Image asset
```

No Provider create retry occurred after response loss or transport failure.
All subsequent requests were read-only status polling and output download.

## Local output verification

```text
container:  MP4
codec:      H.264
dimensions: 496 × 864
frame rate: 24 fps
duration:   4.041667 seconds
byte size:  493718
SHA-256:    22e020e0a38923137066020269efffe242914b79fc83528717a6d4ad40a911c7
```

CV0 extracted and visually inspected a frame at 1.5 seconds. It contains the
authorized virtual presenter in a restrained warm-white store doorway, facing
the camera and waving, with no visible subtitle or brand mark.

## Remaining blockers and non-claims

- signed TOS GetObject access remains denied; PutObject was not attempted;
- the output is not registered in StoryCanvas or projected through controlled
  media;
- this smoke did not traverse browser dynamic approval and CanvasCommand;
- no second paid task is authorized by this run;
- `CANVAS_V1_GOLDEN_PATH_PASS`, `AB_GOLDEN_PATH_COMPLETE`,
  `JOINT_GATE_PASS` and `FULL_JOINT_GATE_PASS` remain false.

G6 therefore remains `BLOCKED` while the paid Provider smoke sub-slice is
recorded as successful.
