# Canvas V1 aggregate contracts

> Contract family: Canvas V1
>
> Version: `0.1`
>
> Task: `T0-CV1-01`
>
> Status: `G1 ACCEPTED` including the additive missing-binding amendment

Canvas V1 adds nine strict aggregate contracts without modifying
ProjectProductionPackage/0.3, ProjectGrant/0.2,
CanvasEntryRedemption/0.1 or Pilot Production Contract/0.2.

## Machine-readable sources

- `canvas-v1.schema.json`: Draft 2020-12 closed schema for all nine objects.
- `schema-index.json`: object definition and browser/server classification index.
- `fixtures/*.json`: one canonical success fixture for each object.
- `negative-vectors.json`: shared backend/frontend security and semantic matrix.
- `validate-contract.mjs`: dependency-free facts/schema-coverage validator.
- `ACTIVATION_TRANSPORT_CONTRACT.md`: proposed G5 browser/Control/Story
  activation, bootstrap layering and high-cost confirmation transport.
- `activation-transport.schema.json`: strict HTTP payload composition that
  references the existing CanvasBootstrap and CanvasCommand definitions.
- `fixtures/activation-transport.json`: canonical activation/open/bootstrap/
  approval/dispatch sequence.
- `activation-transport-negative-vectors.json`: G5 transport RED matrix.
- `validate-activation-transport.mjs`: dependency-free transport facts
  validator.
- `BROWSER_PROVENANCE_AND_LEGACY_OPEN_REPLAY_AMENDMENT.md`: G6 additive
  correction for real-Chrome bodyless GET provenance and identical concurrent
  legacy-open replay; mutations retain exact Origin and CSRF.
- `browser-provenance-replay-vectors.json`: pinned G6 RED facts plus formal
  read, mutation and StrictMode/replay vectors.
- `validate-browser-provenance-replay.mjs`: dependency-free validator for the
  additive provenance and replay policy.
- `WORKSPACE_MATERIALIZATION_CONTRACT.md`: proposed G5 formal workspace
  hydration and server-only Control-to-Story asset-byte transport.
- `WORKSPACE_AUTHORITY_AMENDMENT.md`: exact Control workspace authority,
  deterministic first-day casting, public UUIDv5 IDs and trusted prepare split.
- `workspace-authority.schema.json`: strict server-only authority request,
  browser-safe-content response and fixed safe errors.
- `fixtures/workspace-authority.json`: canonical exact-Package authority facts.
- `workspace-authority-negative-vectors.json`: 30 authority, casting, UUIDv5,
  transaction and containment vectors.
- `validate-workspace-authority.mjs`: dependency-free authority validator.
- `workspace-materialization.schema.json`: additive strict
  `CanvasWorkspace/0.1` and `CanvasAssetMaterialization/0.1` transport schema;
  it references, rather than expands, the nine accepted domain definitions.
- `fixtures/workspace-materialization.json`: canonical workspace,
  materialization request/response and safe error fixtures.
- `workspace-materialization-negative-vectors.json`: 69 workspace, byte
  integrity, replay, containment and persistence RED vectors.
- `validate-workspace-materialization.mjs`: dependency-free additive transport
  facts validator.
- `apps/storycanvas/src/contracts/canvas-v1/index.ts`: StoryCanvas strict runtime
  parser, types and semantic helpers.
- `src/features/canvas-v1/model/contracts.ts`: browser/frontend strict parser,
  types and the same semantic helpers.
- `apps/storycanvas/src/contracts/canvas-v1/workspaceMaterialization.ts`:
  Story workspace and server-only materialization parser/integrity helpers.
- `src/features/canvas-v1/model/workspaceContract.ts`: browser-only strict
  workspace parser; it rejects the materialization envelope.

The JSON Schema, canonical fixtures and negative vectors are the cross-project
facts source. Runtime implementations must pass the same fixtures byte-for-byte
and reject every vector with the frozen stable code.

## Frozen contract surface

| Object | Classification | Key semantics |
|---|---|---|
| CanvasBootstrap/0.1 | browser-safe | Approved script/storyboard IDs and versions, safe asset summaries and capabilities only. |
| CanvasDocument/0.1 | browser-safe | Stable tenant/project/package/document identity, optimistic version and current temporary session. |
| AssetRecord/0.1 | browser-safe business projection | Control-owned provenance, rights and approval; controlled preview only. |
| ProviderAssetBinding/0.1 | server-only | StoryCanvas provider identifiers, `asset://` URI and normalized technical status. |
| EntityBinding/0.1 | browser-safe projection | Explicit approval and continuity revision; bind never implies approval. |
| ShotAssetRequirement/0.1 | browser-safe | Approved script/storyboard derivative and required capabilities. |
| ShotReadiness/0.1 | browser-safe | Deterministic AND gate and ordered stable reason codes. |
| CanvasCommand/0.1 | browser-safe | UI/Agent common command; safe command/approval/request IDs; no transport key or digest. |
| CanvasEvent/0.1 | browser-safe | Persisted acceptance/submission/task/output/receipt facts; no inferred progress. |

Additive transport aggregates do not expand this nine-object domain set:

| Transport | Classification | Key semantics |
|---|---|---|
| CanvasWorkspace/0.1 | browser-safe aggregate | Formal bootstrap, document, real shot/readiness/asset/output/event facts and explicit completeness. |
| CanvasAssetMaterialization/0.1 | server-only transport | Verified first-day virtual-character image bytes; magic MIME, exact size/checksum and response-loss replay. |
| CanvasWorkspaceAuthority/0.1 | server-only transport; browser-safe content | Exact project/version/assets authority used only by trusted prepare. |

`HighCostCommandApproval` remains a server-only Control Plane authority. A
CanvasCommand carries only the safe UUID `approvalId`; a naked
`userConfirmed=true` is rejected.

## Identifier and timestamp format

- External business IDs and Document/Asset/Binding/Requirement/Readiness/
  Command/Event IDs: canonical lowercase RFC 4122 UUID.
- Existing Canvas Entry handle: `ce_*` (outside the nine aggregate fixtures).
- Current StoryCanvas authorization session: `pcs_[A-Za-z0-9_-]{24,128}`.
- Provider/local/database identifiers: server-only.
- Timestamp: UTC RFC 3339 with exactly millisecond precision and `Z`, for
  example `2026-08-14T02:00:00.000Z`.

Every object carries tenant/project/package/session. The server must resolve
the `pcs_*` authority and exact-check all four values; browser values never
grant authority. CanvasDocument ownership is stable tenant/project/package/
document scope. A newly authorized `pcs_*` may restore it; the raw authority is
not a permanent ownership key.

## Frozen enums

Rights:

```text
pending | authorized | rejected | revoked | expired
```

Business approval and entity binding:

```text
pending | approved | rejected | revoked
```

For an EntityBinding record and a CanvasBootstrap asset summary, the status is
always one of that non-null closed set. For a ShotReadiness requirement only,
`entityBindingStatus` is `EntityBindingStatus | null`: `null` means no binding
exists and maps only to `ENTITY_BINDING_MISSING`; `pending` means a binding
exists but awaits approval and maps to `ENTITY_BINDING_PENDING`.

Provider status:

```text
processing | active | rejected | failed | unavailable
```

Unknown/local provider values must be normalized server-side to an unavailable
or failing fact and never satisfy readiness.

Command types:

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

Event progression:

```text
accepted
provider_submitted
task_created
output_registered
receipt_recorded
failed
```

Each successful progression requires its exact persisted fact and associated
safe UUID. Acceptance never means submission; a receipt cannot precede a real
registered output.

## ShotReadiness ordered reason catalog

```text
SCOPE_MISMATCH
REQUIRED_ASSET_MISSING
RIGHTS_PENDING
RIGHTS_REJECTED
RIGHTS_REVOKED
RIGHTS_EXPIRED
ASSET_APPROVAL_PENDING
ASSET_APPROVAL_REJECTED
ASSET_APPROVAL_REVOKED
PROVIDER_PROCESSING
PROVIDER_REJECTED
PROVIDER_FAILED
PROVIDER_UNAVAILABLE
ENTITY_BINDING_MISSING
ENTITY_BINDING_PENDING
ENTITY_BINDING_REJECTED
ENTITY_BINDING_REVOKED
CAPABILITY_UNAVAILABLE
SCRIPT_NOT_CURRENT
STORYBOARD_NOT_CURRENT
```

`ready=true` requires an empty reason list and every requirement to pass exact
scope, rights, approval, provider, entity and capability checks while approved
script/storyboard versions remain current.

## Public error catalog

CanvasEvent exposes only these safe errors:

```text
CANVAS_SCHEMA_INVALID
CANVAS_SCOPE_MISMATCH
CANVAS_SESSION_INVALID
CANVAS_RIGHTS_NOT_AUTHORIZED
CANVAS_ASSET_NOT_APPROVED
CANVAS_PROVIDER_NOT_ACTIVE
CANVAS_ENTITY_BINDING_NOT_APPROVED
CANVAS_SHOT_NOT_READY
CANVAS_CAPABILITY_UNAVAILABLE
CANVAS_APPROVAL_REQUIRED
CANVAS_APPROVAL_INVALID
CANVAS_COMMAND_IDEMPOTENCY_CONFLICT
CANVAS_DOCUMENT_VERSION_CONFLICT
CANVAS_PROVIDER_FAILED
CANVAS_OUTPUT_REGISTRATION_FAILED
```

Runtime conformance helpers additionally use internal parser/test codes such as
`CANVAS_BROWSER_PROJECTION_UNSAFE`, `CANVAS_READINESS_INCONSISTENT`,
`CANVAS_BINDING_INCONSISTENT`, `CANVAS_COMMAND_PAYLOAD_MISMATCH` and
`CANVAS_EVENT_FACTS_INCONSISTENT`. Public messages are bounded and may not
reflect provider bodies, identifiers, credentials or input field values.

## Idempotency and optimistic version behavior

The server derives the command idempotency scope from:

```text
tenantId + projectId + packageId + canvasSessionId + commandType
```

It hashes canonical semantic content server-side. Same scope/same content
returns the persisted outcome with `replayed=true`; same scope/changed content
returns `CANVAS_COMMAND_IDEMPOTENCY_CONFLICT` before any side effect. Raw
`Idempotency-Key` and digest are never browser/Agent fields.

Document writes include `expectedVersion`. A stale value returns
`CANVAS_DOCUMENT_VERSION_CONFLICT` without a partial mutation. Session expiry
blocks the current request, while a new valid exact-scope session may restore
the same stable document and version.

## Security classification

Browser/Agent/network/DOM/URL/storage/console/public log payloads must reject:

```text
asset://
remoteAssetId, assetUri, groupId
providerAssetId, providerGroupId, providerTaskId
provider raw or signed storage URL/body/message
accessToken, authorization, cookie
grant, ProjectGrant, productionPackage, packageSnapshot
payloadDigest, approvedScriptDigest, approvedStoryboardDigest
idempotencyKey, internalToken
credential, secret, password
localPath, database integer id
userConfirmed
```

Controlled previews are application-owned `/api/canvas-v1/**` paths or plain
HTTPS paths without query credentials. ProviderAssetBinding is rejected in its
entirety by the browser parser.

See `AUTHORITY_INVENTORY.md` for the full authority boundary and all eight
accepted Wave 0 decisions. See `G1_HANDOFF.md` for evidence and downstream
implementation starts. See `G1_AMENDMENT_REQ_T0CV1_CV2_002.md` for the additive
missing-binding repair and revalidation evidence. The G5 activation and
workspace/materialization transports are `READY_FOR_CV0_GATE`; passing their
documentation and parser validators is not product implementation or a Gate
result.
