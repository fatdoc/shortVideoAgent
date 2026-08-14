# CV0 G6 Platform Local Output Slice

Date: 2026-08-14 (Asia/Shanghai)

## Outcome

The user redirected execution from a direct Provider smoke back to the real
platform. The ignored local StoryCanvas configuration now enables Seedance
audio and selects the explicit local Canvas output backend. Existing TOS
configuration is retained for a later permission fix.

No Provider task was created by this slice. It implements and verifies the
platform path that must receive the next real browser-originated generation:

```text
dynamic approval
→ CanvasCommand/0.1
→ persisted task/provider submission
→ controlled local MP4 persistence
→ sc_media_assets registration
→ CanvasEvent output_registered
→ authoritative workspace polling
→ authenticated controlled-media preview
```

## Local configuration

The following non-secret behavior is active in the ignored mode-0600 local
environment files:

```text
SEEDANCE_GENERATE_AUDIO=true
CANVAS_V1_OUTPUT_STORAGE=local
```

The repository example retains safe defaults (`generate audio=false`, output
storage=`tos`) and documents the explicit local mode. No credential or local
absolute output path is committed.

## Atomic commits

```text
0ff2bdc21b99f2d2e95556e4fac633ef1887d3db  RED local output storage
db5a52a740b3b4ca31b9833bdcb4426f4c709914  GREEN local output + controlled media
c6c454e5d2177ce6d36121ef763eee74c641f089  RED output completion facts
31ad3d1e8ecb55700fedebe50e51082a3cfb55c6  GREEN output_registered advancement
482625d93e531fa49ee816753abb18c9f842217a  RED authoritative UI polling
1dca807e0ff82576f83ac9165ef05d8b656afa72  GREEN bounded workspace polling
```

## Product facts

- local output mode is explicit; TOS errors never silently fall back;
- TOS mode still requires bucket and endpoint readiness;
- local files are atomically published under the controlled project media
  root with mode 0600;
- task/project scope is checked before file creation;
- same asset/same bytes replay; changed bytes or scope conflict fail closed;
- the browser receives only the existing controlled media route, never a
  filesystem path;
- local streaming requires exact command, actor, tenant, project, package,
  session, event, task, media, checksum and file-size facts;
- only a registered output advances the event to `output_registered`;
- completion failures persist a fixed safe `CANVAS_PROVIDER_FAILED` event;
- the route container polls only while authoritative events are non-terminal,
  is bounded, and stops at success or failure.

## Verification

```text
Canvas/Story route/service tests: 58/58 PASS
Root tests:                       522/522 PASS
Canvas UI/API tests:               59/59 PASS
Root build:                             PASS
StoryCanvas build:                      PASS
Target ESLint:                          PASS
Governance:                             PASS
diff-check:                             PASS
protected byteplus.ts diff:             empty
paid Provider POSTs in this slice:      0
```

## Remaining gate

G6 remains `BLOCKED`. The prior paid task was a direct controlled Provider
smoke and did not traverse the browser platform. The next evidence must start
from the real canonical Canvas route and prove unchanged dynamic approval,
CanvasCommand persistence, one newly authorized paid Seedance task with audio,
local output registration, `output_registered`, workspace refresh, and
controlled media playback. A new paid task requires new explicit user
authorization.

TOS signed access remains HTTP 403 and is not reclassified as fixed. Switching
back to `CANVAS_V1_OUTPUT_STORAGE=tos` must wait for real bucket permission
preflight.
