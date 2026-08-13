# Canvas V1 workspace and asset materialization contract

> Contract slice: `T0-CV1 / G5 workspace + asset bytes transport`
>
> Version: `CanvasWorkspace/0.1` and `CanvasAssetMaterialization/0.1`
>
> Status: `FROZEN BY CV1 / READY_FOR_CV0_GATE`
>
> Baseline audited: `93f26d8af1ed4d37f43540c0b7cbe139e217923c`

## 1. Purpose and non-claims

This additive slice closes two implementation gaps without changing the nine
accepted Canvas V1 domain objects:

1. one formal browser-safe response can hydrate every server-sourced
   `CanvasV1Page` prop without Demo values, UI defaults or a Package snapshot;
2. StoryCanvas can obtain an approved virtual-character source from Control as
   verified bytes before it creates the existing local media/mapping facts.

It does not implement either route, the Shared Bridge, Control object storage,
Story persistence, provider sync, Golden Path or G5. The legacy
`pilot-canvas-bootstrap.v1` open result remains only a session-open response;
it is never a formal workspace or `CanvasBootstrap/0.1`.

The current Control implementation persists `storageReference`, checksum,
rights and approval but has no storage reader, byte size, MIME fact or
materialization route. This is a known fail-closed implementation dependency,
not permission to return a preview URL, signed URL, empty file or fabricated
metadata.

## 2. Formal workspace read

### 2.1 HTTP contract

After successful legacy open and formal bootstrap, the browser reads:

```http
GET /api/production/pilot/canvas/v1/workspace
Cookie: <HttpOnly same-origin Session>
Origin: <exact configured SaaS origin>
X-Canvas-Session-ID: pcs_*
Accept: application/json
```

This read has no request body and no CSRF header. It still requires, in order:

1. exact Origin;
2. valid HttpOnly Session;
3. valid `X-Canvas-Session-ID` syntax;
4. active server-side Canvas authority;
5. exact actor/tenant/project/package binding;
6. exact accepted Package authority.

The route returns only `CanvasWorkspace/0.1`, uses `Cache-Control: no-store`
and carries the current safe Request ID. It does not return the legacy open
response, Package, Grant, digest or provider authority.

Every transport `occurredAt` is canonical UTC ISO with exactly millisecond
precision (`YYYY-MM-DDTHH:mm:ss.sssZ`). Both parsers must parse the value and
require `new Date(parsed).toISOString()` to equal the original bytes. Invalid
calendar values, JavaScript date rollover, offsets (including `+00:00`) and
missing or excess fractional precision fail with the transport's stable schema
error.

### 2.2 Page hydration mapping

The response maps to `CanvasV1Page` without implicit values:

| Page prop | Workspace fact |
|---|---|
| `projectName` | `project.projectName` from the exact mapped real project |
| `loadState` | `loaded` only after the strict workspace parser passes |
| `bootstrap` | formal nested `CanvasBootstrap/0.1` |
| `document` | persisted nested `CanvasDocument/0.1` |
| `shots` | `shots[]` exact projections described below |
| `assets` | `assets[]`; never `undefined` and never an implicit bootstrap fallback |
| `taskEvents[shotId]` | each shot's persisted `event`, omitting only explicit `null` |
| `saveState` | literal server load fact `saved` |
| `commandContext.requestedByActorId` | `project.requestedByActorId` |

`loadState=failed` is a client reaction to a failed HTTP/parser result, not a
field inside a successful workspace. Client-only mutation states `saving`,
`conflict` and `offline` are not invented by this server response.

### 2.3 Deterministic shot projection

The accepted `ProjectProductionPackage/0.3` is the only script/storyboard
source. No latest query or creative inference is allowed.

For every approved storyboard shot, in authoritative order:

```text
shotId            = exact approved storyboard shotId (must already be UUID)
sequence          = exact approved sequence, contiguous from 1
title             = deterministic presentation label "镜头 NN"
durationSeconds   = exact approved storyboard durationSeconds
storyboardText    = exact approved storyboard description
scriptText        = exact full approvedScript.content in v0.1
```

The current Package has no approved per-shot script segment or creative shot
title. Therefore v0.1 repeats the real full approved script for every shot and
uses a sequence label. It must not split the script heuristically or ask an AI
to invent a title. A future Package contract may add approved shot-level script
facts under a new version. `镜头 NN` is a derived display label, not a business
authority fact, and must never be written back into Script, Storyboard or
Package authority.

If a Package shot ID is not a canonical UUID, the workspace fails closed. It
must not hash or substitute a new ID because requirements, readiness,
documents, commands, tasks and outputs bind the original business shot.

Each shot additionally contains:

- all exact-scope `ShotAssetRequirement/0.1` objects for that shot;
- one current exact-scope `ShotReadiness/0.1`;
- deterministic `requiredAssetLabels` derived from requirement category using
  the frozen category-label map in the negative-vector matrix;
- persisted controlled outputs tied to real successful tasks for that shot;
- the latest persisted `GENERATE_SHOT` `CanvasEvent/0.1` or explicit `null`.

Requirement source script/storyboard IDs and versions must match the formal
bootstrap. Readiness must have the same requirement IDs, current approved
versions, exact active `pcs_*` and shot ID. Missing/stale data cannot be
silently removed.

### 2.4 Output, thumbnail and event selection

An output is browser-visible only when all facts join exactly:

```text
accepted Package scope
  + persisted GENERATE_SHOT command payload shotId
  + persisted real generation task
  + registered sc_media_assets output
  + application-owned controlled media path
```

The workspace exposes only `{assetId, kind, previewUrl, selected}`. It never
exposes TOS/OSS key, remote URL, signed URL, `localPath`, provider task ID or
checksum. `previewUrl` is a same-origin application route under
`/api/production/pilot/canvas/v1/media/**`.

At most one output is selected. Its `assetId` must equal the document shot's
`selectedOutputAssetId`; the shot thumbnail is exactly that selected output's
controlled preview. Without a selected output the thumbnail is `null`, not a
placeholder URL.

The event is selected by persisted command/event facts, ordered by event
`occurredAt`, then `eventId`, descending, where the persisted command is
`GENERATE_SHOT` and its payload has the exact shot ID. A task row, progress
number or media row alone must not synthesize an event.

### 2.5 Safe asset aggregate

`assets[]` is the exact join of:

- Control-owned business asset, rights and approval;
- Story-owned provider status;
- Story-owned entity binding and safe target business entity ID;
- Story-owned materialization mapping status;
- an application-controlled preview path.

The common fields must equal `bootstrap.assetSummaries[]` exactly and in the
same deterministic asset order. The workspace adds only:

```text
targetEntityId: UUID | null
materialization: { status, reasonCode }
```

First-day materialization support is deliberately narrow:

```text
category: virtual_character
MIME: image/jpeg | image/png | image/webp
decoded bytes: 1..8 MiB
```

Other categories can appear with their real rights/provider/entity status but
must use:

```json
{"status":"unsupported","reasonCode":"CATEGORY_UNSUPPORTED"}
```

They are not materialized, cannot satisfy a virtual-character provider input
and cannot be reported as ready merely because a preview exists.

### 2.6 Completeness and workspace status

Completeness records whether each authoritative query completed, not whether
an array happens to be non-empty:

```text
assets
requirements
readiness
outputs
events
controlledMedia
```

An empty array is valid only when its source query completed and the trusted
facts truly contain zero rows. Incomplete data is returned only as a blocked
safe projection with the corresponding ordered reason:

```text
WORKSPACE_CAPABILITY_BLOCKED
WORKSPACE_SHOT_BLOCKED
WORKSPACE_ASSET_AGGREGATE_INCOMPLETE
WORKSPACE_REQUIREMENTS_INCOMPLETE
WORKSPACE_READINESS_INCOMPLETE
WORKSPACE_OUTPUTS_INCOMPLETE
WORKSPACE_EVENTS_INCOMPLETE
WORKSPACE_CONTROLLED_MEDIA_INCOMPLETE
```

`status=ready` requires no reasons, formal bootstrap ready, every shot ready
and all completeness flags true. `status=blocked` requires the exact ordered
non-empty reason list. A blocked workspace can still render trustworthy facts;
it cannot enable the affected action.

## 3. Server-only asset materialization

### 3.1 Route, authentication and parser order

Story calls Control over the existing server network:

```http
POST /api/v1/internal/canvas-assets/materializations
X-Production-Plane-Internal-Token: <independent >=32-byte server secret>
X-Request-ID: <safe request id>
Content-Type: application/json
```

Rules:

1. constant-time internal-token authentication runs before JSON parsing;
2. malformed JSON gets a fixed safe error;
3. strict request body limit is `16 KiB`;
4. the parser rejects unknown fields;
5. response and every error use `Cache-Control: no-store`;
6. request/response bodies, token, storage reference and raw errors are not
   logged.

The strict request is `CanvasAssetMaterializationRequest/0.1`:

```json
{
  "objectType": "CanvasAssetMaterializationRequest",
  "contractVersion": "0.1",
  "tenantId": "<uuid>",
  "projectId": "<uuid>",
  "packageId": "<uuid>",
  "canvasSessionId": "pcs_*",
  "assetId": "<uuid>",
  "actorId": "<uuid>",
  "materializationAttemptId": "<uuid>",
  "requestId": "req-*",
  "occurredAt": "<timestamp>"
}
```

Control does not trust these selectors. It re-resolves the active immutable
Canvas session, Package and asset authority and exact-checks tenant, project,
package, actor and asset. The asset must be `virtual_character`, have effective
authorized rights and be business-approved.

### 3.2 Storage reader and byte facts

Only Control interprets its persisted `storageReference`. A CV5-owned storage
reader retrieves bytes directly from an allowlisted application storage root
or object bucket using server credentials. It must reject path traversal,
unknown scheme/bucket/prefix, redirects and provider/browser URLs.

Control then derives facts from the actual bytes:

1. reject unreadable or empty content;
2. stop reading and reject once decoded bytes exceed `8 MiB`;
3. detect MIME from magic bytes, allowing only JPEG, PNG and WebP;
4. compute actual byte length;
5. compute SHA-256 and exact-compare it to immutable asset authority checksum;
6. only after every check succeeds, build the response in memory;
7. run a final response parser/integrity check before sending.

Browser-declared MIME/size, filename extension, HTTP `Content-Type`, preview
URL and signed URL are not byte authority.

The response is strict `CanvasAssetMaterialization/0.1` and includes exact
scope, attempt/materialization IDs, literal category, derived MIME/byte size,
verified checksum, canonical base64 bytes, replay fact, Request ID and
timestamp. It is server-only. Its maximum base64 field is `11,184,812` bytes,
the canonical encoding ceiling for an 8 MiB decoded payload.

### 3.3 Idempotency and response-loss replay

`materializationAttemptId` is generated by Story and stable for one logical
fetch. Control persists or transactionally resolves one semantic attempt over:

```text
tenantId + projectId + packageId + canvasSessionId + actorId + assetId
```

Same attempt and same semantic scope re-reads the same immutable asset
authority and returns the same `materializationId` and verified authority
facts with `replayed=true`. Request ID and response timestamp may describe the
current retry. Response loss is recovered by sending the exact attempt again.

Same attempt with changed actor/scope/asset is
`CANVAS_MATERIALIZATION_IDEMPOTENCY_CONFLICT`. If the bytes behind the immutable
storage reference drift from the authority checksum, every attempt fails
`CANVAS_MATERIALIZATION_CONTENT_INTEGRITY_FAILED`; stale bytes are never
returned as a replay.

### 3.4 Story persistence and unique mapping

CV2 owns the receiving side. Before persistence it re-parses the response,
exact-checks it against the request, decodes canonical base64, repeats
magic-MIME/length/SHA-256 checks and enforces the 8 MiB limit.

It then:

1. writes to an application-created temporary file below the configured data
   root, never a response-provided path;
2. fsyncs and atomically renames to a deterministic scoped media path;
3. registers one `sc_media_assets` character row with real MIME, byte size and
   checksum;
4. registers exactly one existing mapping identity:

   ```text
   system     = saas-control-plane
   entityType = canvas-v1-asset
   externalId = Control assetId
   localId    = local media UUID
   ```

5. verifies any existing mapping/media facts before returning replay success.

Same asset/same checksum/MIME/size/path is replay. A second mapping, changed
content, changed project or changed local fact is conflict and never overwrites
the file or database row. Provider sync starts only after this mapping exists.

## 4. Error contract

Errors are fixed `{error:{code,message,retryable,requestId}}` envelopes. The
minimum catalog is:

| Code | HTTP | Retryable |
|---|---:|---:|
| `CANVAS_MATERIALIZATION_INTERNAL_AUTH_INVALID` | 401 | false |
| `CANVAS_MATERIALIZATION_REQUEST_INVALID` | 400/422 | false |
| `CANVAS_MATERIALIZATION_REQUEST_TOO_LARGE` | 413 | false |
| `CANVAS_MATERIALIZATION_SESSION_INVALID` | 401 | false |
| `CANVAS_MATERIALIZATION_SCOPE_MISMATCH` | 404 | false |
| `CANVAS_MATERIALIZATION_ASSET_NOT_FOUND` | 404 | false |
| `CANVAS_MATERIALIZATION_RIGHTS_NOT_AUTHORIZED` | 409 | false |
| `CANVAS_MATERIALIZATION_ASSET_NOT_APPROVED` | 409 | false |
| `CANVAS_MATERIALIZATION_CATEGORY_UNSUPPORTED` | 422 | false |
| `CANVAS_MATERIALIZATION_SOURCE_UNAVAILABLE` | 503 | true |
| `CANVAS_MATERIALIZATION_SOURCE_EMPTY` | 422 | false |
| `CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE` | 413 | false |
| `CANVAS_MATERIALIZATION_MIME_UNSUPPORTED` | 415 | false |
| `CANVAS_MATERIALIZATION_CONTENT_INTEGRITY_FAILED` | 409 | false |
| `CANVAS_MATERIALIZATION_IDEMPOTENCY_CONFLICT` | 409 | false |
| `CANVAS_MATERIALIZATION_DEPENDENCY_UNAVAILABLE` | 503 | true |

Messages do not reflect request values, storage references, filesystem paths,
object keys, response bytes, token, credential, stack or provider body.

## 5. Owner boundary and implementation order

| Owner | Required work | Forbidden work |
|---|---|---|
| CV5 / Control | storage reader, exact authority/session check, attempt replay, internal route and safe errors | provider sync, Story local path, browser bytes/signed URL |
| CV2 / Story | materialization client, response verification, atomic local media persistence and unique mapping | Control rights/approval mutation, browser exposure |
| CV5 / Shared | formal workspace API client/Bridge mapping and controlled media proxy | Demo/Storage fallback, Package snapshot in browser |
| CV2 / Story | workspace aggregation over accepted Package/doc/requirements/readiness/tasks/events/assets | latest Package/script/storyboard selection, invented shot content |
| CV0 | shared route registration and ordered integration | weakening RED or bypassing owner checks |
| CV6 | negative vectors, HTTP/log/persistence/runtime evidence | accepting docs/parser-only evidence as G5 |

Recommended Green order:

```text
1. CV5 Control storage-reader + materialization route RED/GREEN
2. CV2 Story client + atomic persistence/mapping RED/GREEN
3. CV2 Story workspace aggregate + controlled media RED/GREEN
4. CV5 Shared Bridge maps parsed workspace to CanvasV1Page
5. CV6 exact HTTP, browser, log, response-loss and persistence gate
```

## 6. Security classification

`CanvasWorkspace/0.1` is browser-safe. It must reject keys or values carrying:

```text
storageReference, checksum, contentBase64
materializationAttemptId, materializationId
providerAssetId, providerGroupId, assetUri
accessToken, authorization, internalToken, Idempotency-Key
Grant, Package snapshot, digest
localPath, signedUrl, blob:, data:, asset://
```

`CanvasAssetMaterialization/0.1` is server-only. It may contain checksum and
base64 bytes only on the authenticated internal response. It must never enter
the browser, DOM, URL, Storage, console, screenshot, trace, analytics or public
report.

## 7. Machine evidence and Gate stop

Machine sources:

```text
workspace-materialization.schema.json
fixtures/workspace-materialization.json
workspace-materialization-negative-vectors.json
validate-workspace-materialization.mjs
apps/storycanvas/src/contracts/canvas-v1/workspaceMaterialization.ts
src/features/canvas-v1/model/workspaceContract.ts
```

The matrix contains 61 vectors covering strict workspace parity, canonical UTC
timestamp validation, exact
hydration joins, browser containment, authentication/parser order, 16 KiB/8
MiB boundaries, magic-MIME/size/checksum integrity, response-loss replay and
unique Story mapping.

Passing these validators/parsers means only `READY_FOR_CV0_GATE`. Product
owners must still turn the HTTP, storage, persistence, workspace aggregation
and Shared Bridge REDs green. CV1 does not mark G5 accepted.
