# Pilot Contract v0.2 · Transport / Idempotency / Replay / ACK

## HTTP envelope

All control-plane/production-plane writes use JSON over HTTPS and send:

- `Content-Type: application/json`
- `X-Contract-Version: 0.2`
- `Idempotency-Key: <body.idempotencyKey>`
- `Content-Digest: sha-256=:<base64 SHA-256 of the exact HTTP body bytes>:` (RFC 9530)
- `Authorization: Bearer <short-lived project token>` when a project grant is required

The body `payloadDigest` is `sha256:<lowercase hex>` over RFC 8785 canonical JSON after removing the top-level `payloadDigest` property. It is stable across harmless JSON whitespace or property-order changes. `Content-Digest` protects the transported bytes; `payloadDigest` identifies the semantic payload.

The `Idempotency-Key` header and body value MUST match. Tokens and upstream provider keys MUST NOT appear in payloads, logs, errors, fixtures, receipts, or ACKs.

## Idempotency and replay

The receiver persists `(tenantId, operation/objectType, idempotencyKey, payloadDigest, result)` in the same transaction as its Inbox side effect.

| Observation | Required result | Side effect |
| --- | --- | --- |
| New key | Process and persist result | Exactly once |
| Same key + same payload digest | Return the persisted result; receipt endpoint returns `duplicate` ACK | None |
| Same key + different payload digest | HTTP `409`, `IDEMPOTENCY_CONFLICT` | None |
| Same receipt ID + different payload digest | HTTP `409`, `RECEIPT_REPLAY_CONFLICT` | None |

Idempotency records live at least as long as the pilot data retention period. A timeout at the caller is an unknown outcome: retry the exact payload with the same key, never mint a new key merely because the response was lost.

## Receipt ACK

- HTTP `200` with `ReceiptAck.status=accepted` means the receipt is durably present in the control-plane Inbox.
- `duplicate` means the identical receipt was already durably present.
- `rejected` means no Inbox record or domain side effect was committed.
- An ACK is not proof that a media task succeeded, an asset passed review, or customer credits were consumed.
- A `TaskReceipt(status=succeeded)` never authorizes customer consumption by itself.
- Customer consumption becomes eligible only after a deliverable `AssetReceipt` or successful deliverable `ExportReceipt` is durably recorded and a matching `UsageReceipt.customerSettlement.eligibility=eligible` is accepted.
- The control plane owns rate cards, wallet mutations, and final settlement. The production plane reports meter quantities and optional provider cost only.

## HTTP status mapping

| Status | Meaning |
| --- | --- |
| `200` | Receipt accepted/duplicate; read success |
| `202` | New command/package accepted for asynchronous work |
| `400` | Malformed JSON/header/digest |
| `401` | Missing or invalid project token |
| `403` | Tenant/project/capability scope denied |
| `409` | Idempotency or receipt replay conflict |
| `410` | Grant expired |
| `422` | Schema or semantic validation failed |
| `429` | Provider/control throttling; retry policy applies |
| `500/502/503/504` | Internal/provider/timeout failure with `StandardError` |

Every non-2xx body uses `StandardError`. Retry behavior comes from `error.retryable`; HTTP status alone is insufficient.
