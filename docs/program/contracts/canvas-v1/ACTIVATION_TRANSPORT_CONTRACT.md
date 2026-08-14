# Canvas V1 activation and command transport contract

> Contract slice: `T0-CV1 / G5 activation transport`
>
> Status: `PROPOSED / READY_FOR_CV0_DECISION`
>
> Domain contracts reused unchanged: `CanvasEntry/0.2`,
> `CanvasBootstrap/0.1`, `CanvasCommand/0.1`,
> `HighCostCommandApproval`

## 1. Scope and authority

This slice freezes how an authenticated browser enters Canvas V1 and how an
explicit user confirmation is bound to one high-cost command. It does not add
a tenth Canvas V1 domain object and does not change the meaning of any frozen
G1 schema.

Authority remains split as follows:

```text
Browser route + Control Session
  -> explicit projectId/packageId selection
  -> Control activation facade creates CanvasEntry/0.2
  -> Story legacy open consumes the entry and creates pcs_* server authority
  -> Story formal bootstrap projects CanvasBootstrap/0.1
  -> Control confirmation fingerprints one exact CanvasCommand
  -> Story dispatch consumes that approval and executes the same command
```

The browser-supplied IDs are selectors, never authority. Every server hop must
resolve the HttpOnly Session/server registry and exact-check tenant, actor,
project, package and `pcs_*` session before returning or mutating facts.

## 2. Canonical browser route and package selection

The only formal browser entry is:

```text
/production/canvas/:projectId?packageId=<uuid>
```

Rules:

1. `projectId` and `packageId` are canonical UUIDs.
2. The upstream production workflow must provide the exact `packageId`.
3. Missing, malformed, unauthorized, expired or project-mismatched package
   selection fails closed before Canvas activation.
4. The browser, Control API and StoryCanvas must not query or infer `latest`,
   first, most recent, highest version or last used Package.
5. A legacy `/projects/:projectId/canvas` route may only redirect when it
   already holds an explicit valid `packageId`; it must not select one.
6. `activationAttemptId` must not appear in the URL, history state, query,
   fragment, LocalStorage, SessionStorage, IndexedDB or public logs.

## 3. Control activation facade

### 3.1 HTTP contract

```http
POST /api/v1/projects/:projectId/production-packages/:packageId/canvas-activation
Cookie: <HttpOnly Control Session>
Origin: <exact configured SaaS origin>
X-CSRF-Token: <session-bound Control CSRF token>
Content-Type: application/json

{"activationAttemptId":"<uuid>"}
```

The request body is strict. It accepts only `activationAttemptId`. The browser
does not send a TTL, `Idempotency-Key`, digest, tenant ID, actor ID, Grant,
Package snapshot or access token.

The response is strict and has one replay authority:

```json
{
  "entry": { "objectType": "CanvasEntry", "contractVersion": "0.2" },
  "replayed": false,
  "requestId": "req-canvas-activation-001"
}
```

`entry` is the complete existing browser-safe `CanvasEntry/0.2` projection.
`replayed` exists only in the JSON body. The facade must not also emit an
`Idempotency-Replayed` header because two replay facts could drift.

### 3.2 Attempt lifecycle and server idempotency

The page creates one cryptographically random UUID when a Canvas activation
workflow instance opens. It keeps that value only in component memory and
reuses it for transport retry and response-loss recovery. A full reload or a
new explicit open creates a new attempt.

Control derives the existing Canvas Entry idempotency key server-side:

```text
canonical facts:
  version = canvas-entry-activation-v1
  actorId
  tenantId
  projectId
  packageId
  activationAttemptId

raw internal key:
  cva1.<base64url(HMAC-SHA-256(secret, canonical facts))>
```

The raw derived key and HMAC input must not be returned or logged. Control may
persist only the existing internal Canvas Entry idempotency key/digest required
by its authority repository; it must not persist a separate browser attempt
record. Repeating the same attempt under the same exact authenticated scope
returns the same active Entry with `replayed=true`. Changed project/package/
actor/tenant facts do not replay across scope.

The facade always requests the server-owned fixed TTL:

```text
120 seconds
```

The browser cannot extend it. Existing Package/Grant authority must cover that
fixed lifetime or the current Canvas Entry service rejects activation.

## 4. Legacy open and formal bootstrap are separate layers

### 4.1 Story legacy open

After activation, the browser projects only these four fields from the Entry:

```json
{
  "handle": "ce_*",
  "tenantId": "<uuid>",
  "projectId": "<uuid>",
  "packageId": "<uuid>"
}
```

It sends them to the existing route:

```http
POST /api/production/pilot/canvas/bootstrap
Cookie: <HttpOnly Control Session through the same-origin proxy>
Origin: <exact configured SaaS origin>
X-StoryCanvas-CSRF: pilot-canvas-bootstrap-v1
Content-Type: application/json
```

The route redeems the Entry over the server-only channel and returns the
existing strict `pilot-canvas-bootstrap.v1` open result containing the safe
`pcs_*` Canvas session. This result means only that server-side bootstrap
authority is open. It is not `CanvasBootstrap/0.1`, does not prove the editor
loaded and must not be parsed, named or reported as the formal aggregate.

Identical concurrent and response-loss retries of this four-field open follow
`LegacyCanvasOpenReplay/0.1` in
`BROWSER_PROVENANCE_AND_LEGACY_OPEN_REPLAY_AMENDMENT.md`: they converge on the
same active `pcs_*`; changed payload for the same handle is a fixed 409 and
failed operations are not cached.

### 4.2 Story formal bootstrap

The browser then reads:

```http
GET /api/production/pilot/canvas/v1/bootstrap
Cookie: <HttpOnly Control Session through the same-origin proxy>
Origin: <optional on this GET; exact configured SaaS origin when present>
X-Canvas-Session-ID: pcs_*
Accept: application/json
```

GET has no request body and needs no CSRF token. Real same-origin Chrome may
omit Origin, so this read follows the exact Fetch Metadata/Referer policy in
`BROWSER_PROVENANCE_AND_LEGACY_OPEN_REPLAY_AMENDMENT.md`. It still requires a
valid HttpOnly Session, actor/tenant match, active `pcs_*` authority and exact
project/package binding. The response is the already frozen strict
browser-safe `CanvasBootstrap/0.1` object. This GET-only correction does not
relax exact Origin or CSRF on any mutation.

The server authority Package supplies the exact approved script version ID and
storyboard version ID. The aggregate layer must map those IDs to the matching
approved business records and their exact numeric versions. It must not read
the latest script/storyboard. Missing, revoked, superseded, mismatched or
unavailable mappings fail closed with a safe Canvas error.

### 4.3 Initial document semantics

Canvas Document identity survives `pcs_*` rotation. When no document exists for
the exact tenant/project/package scope, StoryCanvas creates it transactionally
and idempotently before returning a formal bootstrap.

The initial identity is deterministic:

```text
UUIDv5(
  URL namespace 6ba7b811-9dad-11d1-80b4-00c04fd430c8,
  "videoagent:canvas-document:v1:<tenantId>:<projectId>:<packageId>"
)
```

The initial document has version `1`, one shot per approved storyboard shot in
the authoritative storyboard order, and a playlist containing the same shot
IDs in that order. Concurrent creates converge on the same unique document;
they never create an empty replacement or choose a different storyboard.

If the approved storyboard cannot be converted without guessing missing IDs,
order or prompt facts, bootstrap is blocked rather than fabricating a document.

### 4.4 Asset aggregation readiness

`assetSummaries` combines Control business rights/approval projections with
StoryCanvas provider and entity-binding status under exact scope. A missing
sync source, stale projection, count disagreement or scope mismatch makes
bootstrap `status=blocked` and the affected capability unavailable with the
existing `CAPABILITY_UNAVAILABLE` reason.

An empty `assetSummaries` array can accompany `status=ready` only when trusted
sources attest that aggregation is complete and the approved storyboard has no
asset requirement. Empty data must never be used as a substitute for an
unimplemented Control/Story aggregation.

## 5. Exact high-cost approval prepare handshake

The user first composes the complete pending CanvasCommand in memory, including
its final `commandId`, `commandType`, `payload` and exact scope. Before any
high-cost dispatch, the UI shows the exact action and requires an explicit user
confirmation.

The browser then calls the existing Control authority route:

```http
POST /api/v1/projects/:projectId/canvas-command-approvals
Cookie: <HttpOnly Control Session>
Origin: <exact configured SaaS origin>
X-CSRF-Token: <session-bound Control CSRF token>
Content-Type: application/json
```

Body:

```json
{
  "packageId": "<uuid>",
  "canvasSessionId": "pcs_*",
  "commandType": "GENERATE_SHOT",
  "action": {
    "commandId": "<uuid>",
    "payload": {}
  },
  "expiresInSeconds": 60,
  "replayPolicy": "single_use_replay_same_command"
}
```

The confirmation TTL is transport-fixed at 60 seconds; the browser cannot
extend it.

Control binds tenant/actor from Session and project from the path. `action`
must be exactly `{commandId,payload}`. The response remains the existing safe
projection:

```json
{"approvalId":"<uuid>","status":"active"}
```

The browser inserts that `approvalId` into the already composed command and
dispatches the same `commandId`, `commandType`, `payload`, tenant, project,
package, session and actor. StoryCanvas uses the trusted server channel to
consume the Control approval. Any changed command type, ID, payload or scope
returns `CANVAS_APPROVAL_INVALID` before persistence/provider side effects.

Static approvals, approval reuse for another command, a generic `allowAny`
payload, Agent-minted approval IDs and confirmation after dispatch are
forbidden. Same exact command response-loss replay follows the existing
CanvasCommand replay facts and must not repeat the provider side effect.

## 6. Security and observability boundary

All three browser transports use same-origin relative paths. Browser-visible
request/response/DOM/URL/storage/console/trace/screenshot and public logs must
not contain:

```text
raw Idempotency-Key or derived key
HMAC secret/input/digest
Grant, Package snapshot or access token
Cookie value, internal token or provider credential
asset:// or provider internal identifiers/raw bodies
```

`activationAttemptId` is not a secret, but it is contained to the strict
activation JSON request and page memory. Request logging must use fixed markers
and safe Request ID, never headers/body/cookie/attempt values. Request IDs may
appear in safe response envelopes and allowlisted logs.

Activation, legacy open, formal bootstrap, approval prepare and command
dispatch each reject unknown fields. Their errors use fixed safe messages and
request correlation without reflecting input values.

## 7. Frozen sequence and stop conditions

```text
1. Parse canonical route and require explicit packageId.
2. Create one in-memory activationAttemptId.
3. POST Control activation facade; receive CanvasEntry/0.2.
4. POST four-field legacy open projection; receive pilot-canvas-bootstrap.v1.
5. GET formal bootstrap with pcs_* header; receive CanvasBootstrap/0.1.
6. Render Canvas V1 only from the formal bootstrap.
7. Compose a final high-cost CanvasCommand and ask the user to confirm it.
8. POST exact Control approval prepare; receive safe approvalId.
9. Dispatch the unchanged CanvasCommand with that approvalId.
```

Any failed step stops the sequence. There is no Demo, Mock Grant, Storage,
legacy v0.2 receiver or old editor fallback.

## 8. Machine-readable evidence and non-claims

Machine sources:

```text
activation-transport.schema.json
fixtures/activation-transport.json
activation-transport-negative-vectors.json
validate-activation-transport.mjs
```

The schema references existing CanvasBootstrap and CanvasCommand definitions
instead of redefining them. The vector matrix is the Shared implementation RED
for explicit package selection, attempt/key containment, bootstrap layering,
exact authority and approval/dispatch equality.

This proposal does not claim that the activation facade, formal bootstrap,
Control approval consumer, Router/Bridge/Proxy, editor load, Golden Path or
Joint Gate is implemented. CV0 and CV6 must accept the contract and its RED
before product owners turn it GREEN.
