# CV0 G6 Persisted Task Restart Recovery Slice

Date: 2026-08-14 (Asia/Shanghai)

## Outcome

The platform no longer depends on a process-local completion promise after a
paid Provider task has been durably created. A StoryCanvas restart followed by
an authoritative Workspace refresh now resumes the exact persisted Provider
task through read-only status queries and advances the existing Canvas event
when the output is durably registered.

This slice created no Provider task and made no paid call.

## Atomic commits

```text
54d2123a370b335f55a9a8be051cbc2c609725d5  RED persisted task restart recovery
26a2ffb0af85d4586e85720f1d5937f1648d66f7  GREEN read-only Provider resume and event recovery
871a193d2eb491c94001bd1f4428a962b992ab32  strict TypeScript authority narrowing
```

## Recovery contract

```text
formal Workspace refresh
→ exact active Canvas scope
→ persisted task_created CanvasEvent + exact CanvasCommand
→ exact sc_tasks row and externalTaskId
→ Provider GET polling only
→ deterministic output asset ID for replay safety
→ existing local/TOS persistence boundary
→ sc_tasks succeeded
→ same CanvasEvent output_registered
```

Safety properties:

- recovery never calls the Provider task-creation POST;
- command, event, task, actor, tenant, project, package and session identities
  must all match before recovery;
- the semantic command digest and current server authority are revalidated;
- high-cost approval consumption is replayed only for the same command;
- concurrent Workspace polls share the active completion observer;
- a changed Provider task ID, task row, output ID or authority fails closed;
- deterministic output asset identity makes output persistence replayable after
  a process loss;
- Provider task IDs, asset URIs, tokens, signed URLs and local paths remain
  server-only.

## Verification

```text
Canvas/Story route/service tests:          55/55 PASS
Root tests:                               522/522 PASS
Story v0.2 + Media/TTS/Storage:             22/22 PASS
Root build:                                     PASS
StoryCanvas build:                              PASS
Target ESLint:                                  PASS
StoryCanvas strict tsc changed-path errors:        0
StoryCanvas strict tsc baseline errors:            28
Governance:                                     PASS
diff-check:                                     PASS
protected byteplus.ts diff:                     empty
paid Provider POSTs in this slice:                  0
```

## Remaining gate

G6 remains `BLOCKED`. The pending evidence is still a real canonical browser
flow proving dynamic approval, CanvasCommand persistence, one newly authorized
paid Seedance task with audio, local output registration, Workspace recovery
and controlled-media playback. The prior authorization was consumed by the
direct smoke; a second paid task requires explicit user authorization.
