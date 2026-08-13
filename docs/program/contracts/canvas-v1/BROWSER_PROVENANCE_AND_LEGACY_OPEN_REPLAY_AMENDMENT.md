# Canvas V1 browser provenance and legacy open replay amendment

> Contract slice: `T0-CV1 / G6 real-browser transport correction`
>
> Version: `BrowserRequestProvenance/0.1` and
> `LegacyCanvasOpenReplay/0.1`
>
> Status: `FROZEN BY CV1 / READY_FOR_CV0_GATE`
>
> Parents: `ACTIVATION_TRANSPORT_CONTRACT.md` and
> `WORKSPACE_MATERIALIZATION_CONTRACT.md`

## 1. Purpose and authority

This is a minimal additive transport correction. A real Chrome same-origin
`fetch()` GET does not have to emit an `Origin` header. Requiring exact Origin
on every formal GET therefore rejected a legitimate authenticated browser
before it could read the Canvas workspace. React StrictMode can also invoke the
legacy open effect twice while the first request is still in-flight; two
identical opens must converge on one server authority instead of racing into a
409.

This amendment supersedes only:

1. the exact-Origin requirement for these two bodyless browser GETs;
2. the previously unstated concurrent/retry semantics of the existing
   four-field legacy open.

```text
GET /api/production/pilot/canvas/v1/bootstrap
GET /api/production/pilot/canvas/v1/workspace
POST /api/production/pilot/canvas/bootstrap
```

It does not add or change a Canvas V1 domain object, response DTO, route,
Session, CSRF token, `pcs_*` authority, Package selection, approval, command or
Provider contract. It does not authorize Demo/Mock/Storage fallback.

## 2. Independent RED facts

The independent G6 real-browser evidence is pinned to:

```text
coordinator/test commit:
8d2d3215d9af39006b4d5fde128484e314b7ae73

RED evidence commit:
155777d5a1f654306a6fcd82856ac4b3d327dca0
```

The observed request sequence was:

```text
Control activation:          201, then exact replay 200
Story legacy open:           200, then identical concurrent 409
Story formal bootstrap GET:  401
approval/command/provider:    0 / 0 / 0
```

The 401 was produced because the real same-origin Chrome GET omitted Origin.
The 409 was produced by two identical StrictMode legacy opens. These facts do
not prove a Golden Path, real editor load or Provider execution.

## 3. Formal browser GET provenance

### 3.1 Required authority and headers

Both formal GET routes are same-origin browser subresource reads. They require
all of the following:

```http
Cookie: <valid HttpOnly Session>
X-Canvas-Session-ID: <exact active pcs_* authority>
Sec-Fetch-Site: same-origin
Sec-Fetch-Mode: cors
Sec-Fetch-Dest: empty
Referer: <absolute URL whose parsed origin is the exact configured SaaS origin>
Origin: <optional; when present it must equal the exact configured SaaS origin>
```

`Origin` may be absent only for these two GETs. If Origin present, its single
serialized value must equal the configured origin byte-for-byte. `null`, a
list, a trailing slash, credentials, another port, another scheme or another
host is a mismatch.

`Referer` is required even when Origin is present. It must parse as one
absolute HTTP(S) URL, contain no username/password, and its parsed `.origin`
must equal the configured origin. Its path and canonical Canvas query may
vary; Referer exact origin means equality of the parsed origin, not equality
of the full page URL.

The Fetch Metadata tuple is exact and mandatory:

```text
Sec-Fetch-Site = same-origin
Sec-Fetch-Mode = cors
Sec-Fetch-Dest = empty
```

`same-site` is not accepted as `same-origin`. Missing, duplicate, comma-joined
or unknown values fail closed.

### 3.2 Fixed evaluation order

The server evaluates each formal GET in this order:

```text
safe Request ID + Cache-Control: no-store
→ exact bodyless GET route/method
→ optional Origin is absent or exact
→ exact Fetch Metadata tuple
→ exact-origin Referer
→ valid HttpOnly Session
→ exact X-Canvas-Session-ID syntax
→ exact active `pcs_*` server authority
→ actor/tenant/project/package binding
→ existing formal bootstrap or read-only workspace operation
```

Selectors and headers never create authority. A browser-supplied `pcs_*` is
accepted only after the server registry and HttpOnly Session exact-check the
same actor, tenant, project and Package.

Provenance failure returns the existing fixed safe `CANVAS_SESSION_INVALID`
envelope with HTTP 401, a safe Request ID and `Cache-Control: no-store`. It
does not disclose which header, Session or scope check failed and does not
reflect any request header. Existing later scope errors remain unchanged.

### 3.3 Navigation and automated clients

Top-level navigation is not an API read. `Sec-Fetch-Site: none`,
`Sec-Fetch-Mode: navigate`, `Sec-Fetch-Dest: document`, a non-empty
destination or an address-bar request is rejected even if it carries a valid
Session.

An automated or server-side client with missing Fetch Metadata or Referer must
fail closed. `Origin` by itself is not a substitute. There is no User-Agent,
loopback, test-mode, proxy or IP allowlist bypass. A future server consumer
must use a separately frozen internal authenticated transport; it must not
spoof browser headers to call these routes.

Cross-site, same-site, `none`, Origin mismatch, Referer mismatch and any
missing provenance member are rejected before Session or `pcs_*` facts are
revealed.

## 4. Mutations keep exact Origin and CSRF

This amendment does not relax browser mutations. They continue to require an
exact configured Origin, a valid HttpOnly Session, their exact CSRF protection
and exact server authority before any side effect:

| Mutation | Required CSRF |
|---|---|
| Control activation facade | session-bound `X-CSRF-Token` |
| Story legacy open | literal `X-StoryCanvas-CSRF: pilot-canvas-bootstrap-v1` |
| Control high-cost approval prepare | session-bound `X-CSRF-Token` |
| Story Canvas command dispatch | existing command transport protection |

Missing Origin is rejected for mutations. Fetch Metadata and Referer cannot
replace CSRF, and this GET-only correction must not be generalized to POST,
PUT, PATCH or DELETE.

## 5. Legacy open concurrency and response-loss replay

### 5.1 Semantic identity

The existing legacy open body remains exactly:

```json
{
  "handle": "ce_*",
  "tenantId": "<uuid>",
  "projectId": "<uuid>",
  "packageId": "<uuid>"
}
```

After authenticating the Session, the server derives one semantic identity
from the authenticated `actorId` plus exact body tenant/project/package and
entry handle. It derives a server-only canonical digest; the browser sends no
`Idempotency-Key`, digest or attempt field.

The handle is safe and non-bearer, but it remains bound to exactly one payload.
The request body and Session-derived actor are selectors until the redemption
and registry checks succeed.

### 5.2 Identical in-flight dedupe

If a request with the same semantic identity is already in-flight, every
identical concurrent caller joins that single Promise. Exactly one redemption,
one Control session registration and one Story authority issue may occur.

All successful callers receive the same `pcs_*`, project, Package and expiry.
The safe response `requestId` may identify the current HTTP retry, but it
cannot change authority facts. No new response field or replay header is
added to the existing strict `pilot-canvas-bootstrap.v1` DTO.

This rule is server-owned. React or the browser may also suppress duplicate
effects, but client timing, component identity and StrictMode behavior are not
idempotency authority.

### 5.3 Successful response replay

After success, the replay record is co-located with the active authority
lifecycle. An exact retry, including response-loss recovery, returns the same
`pcs_*` without a second redemption, registration or authority issue. It is
valid only until that authority expires, is evicted or is cleared at shutdown.

The replay record is bounded by the existing authority registry capacity and
is removed by the same expiry, eviction and shutdown-clear paths. It stores
only the canonical digest, exact safe scope and browser-safe open result. It
must not retain the Cookie, CSRF, request headers/body, raw access token,
Grant, Package snapshot, internal token, Idempotency-Key, digest input or any
other raw secret. The existing server authority registry remains the sole
owner of redemption authority.

### 5.4 Conflict and failure behavior

The same handle with changed tenant, project, Package or any changed body
field returns HTTP 409 with the existing fixed `PILOT_CANVAS_CONFLICT` before
redemption, registration, registry mutation or downstream side effects. It
never joins an in-flight request for a different digest.

Failures are never cached. Concurrent callers joined to a failed in-flight
operation receive its fixed safe error; the in-flight record is removed in a
`finally` path. A later exact retry executes a new attempt and may succeed.
Failures never mint or replay a partial `pcs_*`.

Different entry handles are different logical opens even when actor and scope
match. An expired or evicted success cannot replay its stale `pcs_*`; the
caller must use currently valid activation/Entry authority.

## 6. Security and observability

The provenance and replay coordinator must not log or expose:

```text
Cookie or CSRF value
raw request headers or body
raw access token, Grant or Package snapshot
internal token or Provider secret/body
raw Idempotency-Key or canonical digest input/value
activationAttemptId
```

Allowlisted evidence is limited to fixed lifecycle markers, safe Request ID,
HTTP status, endpoint class and non-secret counts. DOM, URL, Storage, console,
trace and screenshots retain the existing Canvas V1 forbidden-marker policy.

## 7. Machine evidence, owner boundary and stop condition

Machine-readable RED and validator:

```text
browser-provenance-replay-vectors.json
validate-browser-provenance-replay.mjs
```

The vectors cover real-browser evidence, Chrome Origin omission, exact Fetch
Metadata/Referer, navigation and automated-client rejection, Session/`pcs_*`
authority, mutation non-regression, StrictMode concurrency, response-loss
replay, changed-payload conflict, lifecycle bounds and secret containment.

| Owner | Required Green | Forbidden |
|---|---|---|
| Story owner | shared provenance guard for the two formal GETs; bounded legacy-open in-flight/replay coordinator | relaxing mutations, browser-supplied idempotency, new DTO field |
| Shared/browser owner | continue relative same-origin fetch with HttpOnly credentials and page-memory activation | custom forbidden headers, client-only idempotency authority, Demo fallback |
| CV6 | real Chrome request capture, identical-concurrency and response-loss tests, forbidden-marker checks | header-injection mocks as browser proof, paid Provider call before transport Green |

Passing the validator means only that this additive correction is internally
consistent. Product owners must turn the real HTTP RED Green and CV6 must rerun
the external browser Gate. It does not claim `REAL_EDITOR_LOADED`, paid
Provider execution, Golden Path completion or Joint Gate acceptance.
