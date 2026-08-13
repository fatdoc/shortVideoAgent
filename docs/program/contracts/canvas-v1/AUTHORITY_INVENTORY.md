# Canvas V1 contract authority inventory

> Task: `T0-CV1-01` / slice `CV1-A`
>
> Status: frozen input for G1 implementation
>
> Master Plan: `T0_CANVAS_V1_MASTER_PLAN.md` v0.2
>
> Baseline: `9432c54574cac9eb7f3d8e952d158b46c22f0c64`

This inventory preserves the existing contract authorities and records the eight
Wave 0 decisions accepted by CV0. Canvas V1 is an additive aggregate contract;
it does not silently upgrade or reinterpret the historical contracts.

## 1. Existing authorities that remain unchanged

| Contract/capability | Version | Authority | Canvas V1 use |
|---|---:|---|---|
| ProjectProductionPackage | 0.3 | Control Plane | Server-only source for approved script/storyboard facts and exact package scope. A new safe projection is required. |
| ProjectGrant | 0.2 | Control Plane | Server-to-server authorization only. The grant, token, scopes snapshot and digest never enter Canvas V1 browser DTOs. |
| CanvasEntry | 0.2 | Control Plane | Browser-safe, non-bearer `ce_*` entry handle. It is not a raw access token. |
| CanvasEntryRedemption | 0.1 | Control Plane | Server-only package/grant redemption. StoryCanvas may consume it over the trusted channel. |
| Pilot Production Contract | 0.2 | Historical cross-plane contract | Reuse canonical JSON, receipt, safe-error and replay semantics. Do not use its generic ID fixtures as Canvas V1 validators. |
| Pilot canvas authority | `pilot-canvas-bootstrap.v1` | StoryCanvas | Reuse the bounded server-only redemption registry and opaque `pcs_*` session handle. It is not the Canvas V1 aggregate bootstrap. |
| StoryCanvas asset/provider/task/media services | existing internal models | StoryCanvas | Reuse only behind Canvas V1 adapters. Integer IDs, provider identifiers, internal URIs and raw errors remain server-only. |
| Production package/grant public routes | existing public DTOs | Control Plane | Forbidden as Canvas V1 bootstrap sources because the network payload exposes digest, token or package snapshot material. |
| MVP/demo production routes and v0.1 fixtures | historical demo | none for production | Negative examples only. No fallback to Demo Grant, Mock success, local storage, fixed project or `/api/mvp/*`. |

The frozen Pilot v0.2 schema and its StoryCanvas copy are byte-identical at this
baseline. Its transport rules remain useful: canonical semantic digest,
same-key/same-payload replay, same-key/changed-payload conflict, exact retry
after an unknown outcome, durable receipt acknowledgment, and no inference from
task acceptance to asset deliverability.

## 2. Canvas V1 additive surface

| Contract | Classification | Authority | Primary consumer |
|---|---|---|---|
| CanvasBootstrap/0.1 | browser-safe aggregate projection | Control facts adapted by CV5; StoryCanvas session facts | Browser UI and Agent tools |
| CanvasDocument/0.1 | browser-safe document with server persistence | StoryCanvas | UI and Agent through the command service |
| AssetRecord/0.1 | browser-safe business projection; full record is server authority | Control Plane | Readiness adapter, UI and Agent |
| ProviderAssetBinding/0.1 | server-only authority; safe status projection is embeddable | StoryCanvas | Readiness and production adapters |
| EntityBinding/0.1 | browser-safe approval/status projection; technical mapping is server-only | StoryCanvas, constrained by Control approval facts | Readiness, UI and Agent |
| ShotAssetRequirement/0.1 | browser-safe approved-storyboard derivative | Control facts adapted by StoryCanvas | Readiness, UI and Agent |
| ShotReadiness/0.1 | browser-safe deterministic AND aggregate | StoryCanvas | UI, Agent and command gate |
| CanvasCommand/0.1 | browser-safe canonical command; idempotency record is server-only | StoryCanvas command service | UI and Agent, byte/semantic equivalent |
| CanvasEvent/0.1 | browser-safe fact event; provider detail is server-only | StoryCanvas | UI and Agent status refresh |

`HighCostCommandApproval` is a server-only Control Plane authority referenced by
the browser-safe UUID `approvalId`. It is not one of the nine public aggregate
contracts and must never be synthesized by an Agent.

## 3. Identifier and scope rules

- External business IDs and all Document, Command, Event, Asset, Binding and
  Requirement IDs are canonical lowercase RFC 4122 UUID strings.
- Existing `ce_*` Canvas Entry handles and opaque `pcs_*` StoryCanvas session
  handles retain their current formats.
- Database integers, local filesystem identifiers, provider task/asset/group
  identifiers and provider URIs are server-only.
- Every Canvas V1 object carries `tenantId`, `projectId`, `packageId` and
  `canvasSessionId`. The server resolves the session authority and rejects any
  mismatch; browser values never establish authority.
- CanvasDocument has stable ownership scope
  `tenantId + projectId + packageId + documentId`. `canvasSessionId` is the
  current request/session binding, not the permanent ownership key. A newly
  authorized session may restore the same document after restart or expiry.
- All timestamps are UTC RFC 3339 strings in canonical millisecond `Z` form.
- All schema objects are closed. Unknown fields, wrong casing, implicit number
  coercion and unknown enum values are rejected.

## 4. Four-layer asset model and status ownership

The layers are distinct records and no layer creates or upgrades another:

1. `AssetRecord`: business provenance, rights and approval facts from Control.
2. `ProviderAssetBinding`: StoryCanvas provider registration and normalized
   technical status.
3. `EntityBinding`: explicit project entity association and approval; bind does
   not imply approval.
4. `ShotAssetRequirement`: an approved script/storyboard requirement for one
   shot.

Frozen status sets:

- rights: `pending | authorized | rejected | revoked | expired`
- business approval: `pending | approved | rejected | revoked`
- provider: `processing | active | rejected | failed | unavailable`
- entity binding: `pending | approved | rejected | revoked`
- requirement: `required | satisfied | waived`

Provider adapters normalize external status strings into the lowercase closed
set. Unknown, local, processing, failed and rejected provider states all fail
closed. Only `active` can satisfy the provider gate. `waived` is an explicit
approved-business fact, not an automatic response to a missing asset.

`ShotReadiness.ready` is the only aggregate generation gate and is true only
when every required dimension is satisfied: exact scope, authorized rights,
approved business asset, active provider binding, approved entity binding,
available capability, and still-current approved script/storyboard. Its reason
codes are deterministic, ordered, stable and shared by browser, Agent and
server rejection paths.

## 5. Command, approval, idempotency and event facts

Canvas V1 freezes these command types only:

```text
ANALYZE_ASSET_REQUIREMENTS
CREATE_VIRTUAL_CHARACTER
SYNC_PROVIDER_ASSET
BIND_ASSET_TO_ENTITY
GENERATE_SHOT
SELECT_SHOT_OUTPUT
SAVE_CANVAS_DOCUMENT
EXPORT_PLAYLIST
```

- The browser and Agent submit the same `CanvasCommand/0.1` bytes/semantics.
- The client holds a non-secret UUID `commandId` and safe request correlation.
- The server derives the idempotency scope
  `tenant + project + package + canvasSession + commandType` and a canonical
  payload digest. Raw transport `Idempotency-Key` and digest never enter the
  browser, Agent arguments, DOM, URL, storage or logs.
- Same scope and same canonical payload returns the prior result with
  `replayed=true`. Same scope and changed payload returns the stable
  `CANVAS_COMMAND_IDEMPOTENCY_CONFLICT` error and performs no side effect.
- Commands that can create paid media, change identity/rights, replace a chosen
  output, batch work, export or publish require a safe `approvalId` UUID.
- Control persists the server-only approval under authenticated actor context,
  binding tenant/project/package/session, command type, action fingerprint,
  confirmation time, expiry and replay/consumption policy. StoryCanvas validates
  it over a trusted server channel. A boolean `userConfirmed` is invalid.

Command acceptance, provider submission, provider task creation, output
registration and receipt creation are separate facts:

```text
accepted
→ providerSubmitted (only after a real provider call fact)
→ taskCreated (only with a durable provider task fact)
→ outputRegistered (only with a real stored output fact)
→ receiptRecorded (only after the real output is registered)
```

CanvasEvent and receipts do not infer or skip these facts. Response-loss replay
must return persisted truth and must not repeat a paid provider call.

## 6. Browser-safe and server-only classification

Browser-safe fields are limited to non-secret business UUIDs, `ce_*`/`pcs_*`
handles in their intended endpoints, approved version IDs/status, normalized
safe status, stable reason/error codes, controlled preview URLs, optimistic
document version, command/event IDs, `approvalId`, timestamps and safe request
correlation.

The following markers and their values are server-only and forbidden from
network browser projections, Agent tool arguments/results, DOM, URL, browser
storage, console and public logs:

```text
asset://
remoteAssetId
assetUri
groupId
provider asset/group/task/internal id
provider raw URL or signed storage URL
accessToken
authorization
cookie
ProjectGrant or grant snapshot
Package snapshot
payloadDigest or approved content digest
raw Idempotency-Key
internal token
credential, secret or password
provider raw response/body/message
local path or database integer id
```

A controlled preview URL must be an application-owned HTTPS path/URL without
embedded credentials or provider/storage signing query parameters.

## 7. The eight accepted Wave 0 decisions

1. Do not reuse the old StoryCanvas workspace DTO. Provider/internal asset
   fields are server-only; freeze a separate browser-safe projection.
2. Do not reuse existing production-package or production-grant public DTOs for
   bootstrap. Freeze a safe aggregate containing approved business IDs/version
   status, without digest, token, grant or package snapshot.
3. Do not reuse the global key-only MVP idempotency interface. Use the exact
   scoped canonical-digest replay/conflict semantics in section 5.
4. Keep all four asset layers distinct. Binding never means approval;
   ShotReadiness is the only AND gate and unknown provider states fail closed.
5. Keep command acceptance separate from provider submission, task creation,
   output registration and receipt creation. Persist facts before advancing.
6. Use canonical UUIDs externally, preserve `ce_*` and `pcs_*`, and keep generic
   Pilot v0.2 IDs, integers and provider/local IDs out of V1 validation.
7. Ban bare `userConfirmed`. Use a browser-safe `approvalId` backed by the
   server-only Control `HighCostCommandApproval`; Agents cannot mint approvals.
8. Keep CanvasDocument identity stable across session rotation. A `pcs_*` is
   temporary authorization, must be exact-checked per request, and is not stored
   as the permanent document ownership key.

## 8. Error and transition policy

- Public errors use a closed stable code, safe message, retryable flag and safe
  request correlation. Provider bodies, field values and secrets are never
  reflected.
- Scope, rights, approval, provider, binding, capability and current-content
  failures are non-success facts and do not create tasks, assets, receipts or
  usage success.
- Unknown state and unavailable authority are fail-closed, never Demo/Mock/local
  fallback.
- Document saves require `expectedVersion`; a stale version produces
  `CANVAS_DOCUMENT_VERSION_CONFLICT` without partial mutation.
- Historical v0.2 errors and receipts retain their existing meanings. Canvas V1
  adds its own closed codes rather than weakening the old validator.
