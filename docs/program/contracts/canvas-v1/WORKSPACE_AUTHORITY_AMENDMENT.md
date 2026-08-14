# Canvas V1 workspace authority amendment

> Contract slice: `T0-CV1 / G5 workspace authority`
>
> Version: `CanvasWorkspaceAuthority/0.1`
>
> Status: `FROZEN BY CV1 / READY_FOR_CV0_GATE`
>
> Parent contract: `WORKSPACE_MATERIALIZATION_CONTRACT.md`

## 1. Purpose and non-claims

The existing Story session has the accepted immutable Production Package, but
it does not own the real project name, exact approved numeric Script and
Storyboard versions or Control business assets. This amendment freezes the
small server-only transport needed to acquire those facts before Story creates
Canvas workspace facts.

It does not implement the Control route, trusted prepare transaction, formal
workspace endpoint, Shared Bridge, provider sync or G5. It does not add a tenth
Canvas domain object: `CanvasWorkspaceAuthority/0.1` is a transport aggregate
whose asset members are the existing browser-safe `AssetRecord/0.1`.

The response content is browser-safe so the same strict parser can be checked
on both sides. The route and response remain server-only and must never be
called, cached or logged by the browser.

## 2. Internal HTTP contract

Story calls Control only from the trusted server activation/prepare phase:

```http
POST /api/v1/internal/canvas-workspace-authorities
X-Production-Plane-Internal-Token: <independent >=32-byte server secret>
X-Request-ID: <safe request id>
Content-Type: application/json
```

The fixed processing order is:

```text
constant-time internal token authentication
→ 16 KiB request body limit
→ safe JSON parser
→ strict CanvasWorkspaceAuthorityRequest/0.1 parser
→ active immutable Canvas session lookup
→ exact actor/tenant/project/package validation
→ exact Package authority query
```

Every response and error uses `Cache-Control: no-store`. Authentication failure,
malformed or oversized JSON and dependency errors use fixed safe envelopes.
Neither request/response bodies, internal tokens, Package facts nor raw errors
are logged.

The strict request contains exactly:

```json
{
  "objectType": "CanvasWorkspaceAuthorityRequest",
  "contractVersion": "0.1",
  "tenantId": "<uuid>",
  "projectId": "<uuid>",
  "packageId": "<uuid>",
  "canvasSessionId": "pcs_*",
  "actorId": "<uuid>",
  "requestId": "req-*",
  "occurredAt": "<canonical UTC timestamp>"
}
```

Control treats every selector as untrusted. It resolves the active immutable
session and accepted Package again and exact-checks actor, tenant, project and
package. There is no `latest`, name, creation-time or update-time selection.

## 3. Authority response

The strict `CanvasWorkspaceAuthority/0.1` response contains only:

```text
exact tenant/project/package/canvasSession scope
project { projectName }
approvedScript { scriptId, version }
approvedStoryboard { storyboardId, version }
browser-safe AssetRecord/0.1[]
completeness { project:true, approvedScript:true,
               approvedStoryboard:true, assets:true }
requestId + canonical occurredAt
```

Script and Storyboard IDs come from the accepted Package. Their numeric
versions are queried by those exact IDs in Control authority; the route must not
read the current or latest version.

Assets are all exact-scope Control business records, ordered by the frozen
category order below and then lowercase asset UUID ascending:

```text
human, virtual_character, store, product, brand, prop, voice, image, video
```

Every member passes the existing browser-safe `AssetRecord/0.1` parser. The
aggregate rejects Package snapshots, digests, storage references, checksums,
bytes, provider IDs/URIs, internal IDs, signed URLs, tokens and credentials.
Incomplete queries do not return a partial successful response.

## 4. Deterministic first-day casting

The complete asset list must contain exactly one `virtual_character`:

| Count | Trusted prepare result |
|---:|---|
| 0 | blocked with `PRIMARY_VIRTUAL_CHARACTER_MISSING` |
| 1 | select that exact asset |
| >1 | blocked with `PRIMARY_VIRTUAL_CHARACTER_AMBIGUOUS` |

No first, sorted-first, latest, display-name or approval-state heuristic is
allowed. The unique asset remains the deterministic casting choice when rights
or approval is pending. In that case the requirement is still created, but
`ShotReadiness/0.1` remains false through its existing ordered reason facts.

With zero or multiple candidates the trusted prepare transaction creates no
CanvasDocument, ShotAssetRequirement or ShotReadiness. Formal bootstrap reports
the capability blocked. Formal workspace GET returns HTTP 409 with the fixed
safe error code and no partial `CanvasWorkspace/0.1`:

```text
PRIMARY_VIRTUAL_CHARACTER_MISSING
PRIMARY_VIRTUAL_CHARACTER_AMBIGUOUS
```

These are transport error codes, not additions to the frozen
`ShotReadiness/0.1` or successful workspace reason arrays.

## 5. Public deterministic IDs

All implementations use RFC 4122 UUIDv5 with this fixed public namespace:

```text
0f88cfb6-eef3-5961-8e78-c6f5aa24af6c
```

That namespace is itself UUIDv5 of URL namespace
`6ba7b811-9dad-11d1-80b4-00c04fd430c8` and exact UTF-8 name:

```text
https://videoagent.local/canvas-v1/workspace-authority/0.1
```

The target entity ID name is the following exact lowercase ASCII template with
canonical lowercase UUIDs and no whitespace or escaping:

```text
target-entity|tenant=<tenantId>|project=<projectId>|package=<packageId>|asset=<assetId>|category=virtual_character
```

Each shot requirement ID name is:

```text
shot-requirement|tenant=<tenantId>|project=<projectId>|package=<packageId>|shot=<shotId>|asset=<assetId>|capability=video_generation
```

The requirement is always:

```text
assetCategory = virtual_character
entityId = derived target entity ID
status = required
requiredCapabilities = [video_generation]
source = exact authority Script/Storyboard IDs and numeric versions
```

Deriving a target ID is not an EntityBinding approval. Prepare may preserve an
existing exact binding or leave binding authority missing/pending; it must never
create an approved binding automatically.

## 6. Trusted prepare transaction and read-only workspace

After a unique casting decision, one idempotent transaction synchronizes the
authority and creates or resolves:

```text
stable CanvasDocument
one ShotAssetRequirement per accepted Package shot
one deterministic ShotReadiness per accepted Package shot
```

The initial document has Package storyboard order. Each document shot prompt is
the exact approved Package storyboard description for that shot. It is not the
global Script text, an AI rewrite, a split or a fallback. `镜头 NN` remains only
a derived workspace display title and is never written to authority.

The formal workspace GET is strictly read-only. It cannot create or repair a
document, requirement, readiness or EntityBinding. Therefore every successful
first-day `CanvasWorkspace/0.1` has exactly one virtual-character requirement
for every Package shot. Empty requirements cannot be interpreted as ready.

## 7. Fixed authority errors

Authority errors use `{error:{code,message,retryable,requestId}}`:

| Code | HTTP | Retryable |
|---|---:|---:|
| `CANVAS_WORKSPACE_AUTHORITY_INTERNAL_AUTH_INVALID` | 401 | false |
| `CANVAS_WORKSPACE_AUTHORITY_REQUEST_INVALID` | 400/422 | false |
| `CANVAS_WORKSPACE_AUTHORITY_REQUEST_TOO_LARGE` | 413 | false |
| `CANVAS_WORKSPACE_AUTHORITY_SESSION_INVALID` | 401 | false |
| `CANVAS_WORKSPACE_AUTHORITY_SCOPE_MISMATCH` | 404 | false |
| `CANVAS_WORKSPACE_AUTHORITY_PACKAGE_NOT_FOUND` | 404 | false |
| `CANVAS_WORKSPACE_AUTHORITY_PROJECT_UNAVAILABLE` | 503 | true |
| `CANVAS_WORKSPACE_AUTHORITY_SCRIPT_UNAVAILABLE` | 409/503 | false/true |
| `CANVAS_WORKSPACE_AUTHORITY_STORYBOARD_UNAVAILABLE` | 409/503 | false/true |
| `CANVAS_WORKSPACE_AUTHORITY_ASSETS_INCOMPLETE` | 503 | true |
| `CANVAS_WORKSPACE_AUTHORITY_DEPENDENCY_UNAVAILABLE` | 503 | true |

Messages never reflect selectors, Package facts, storage/provider authority,
filesystem paths, raw errors or credentials.

## 8. Owner boundary and Gate stop

| Owner | Required Green | Forbidden |
|---|---|---|
| CV5 / Control | internal route, exact Package/version/assets authority, fixed errors | latest lookup, Package snapshot, storage/provider authority response |
| CV2 / Story | authority client, casting, UUIDv5, atomic prepare, read-only workspace projection | heuristic casting, auto-approved binding, GET-time writes |
| CV5 / Shared | proxy only the formal browser-safe workspace/error | calling the internal authority route from browser |
| CV6 | auth/parser order, 16 KiB, log containment, casting and transaction evidence | accepting parser/docs as product completion |

Machine evidence is in `workspace-authority.schema.json`, its canonical fixture,
30 negative vectors, dependency-free validator and the two strict parsers. This
amendment is `READY_FOR_CV0_GATE`; it is not product implementation or G5.
