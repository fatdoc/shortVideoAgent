# Pilot Cross-plane Contract · v0.2

> Status: `FROZEN / READY_FOR_GATE`
>
> Contract version: `0.2`
>
> Scope: controlled real pilot; coexists with Demo contract `v0.1`

This directory is the machine-readable boundary between the SaaS control plane (A) and StoryCanvas production plane (B). It contains no customer-specific identifiers, provider credentials, wallets, rate cards, or customer prices.

## Canonical artifacts

- `pilot-contract-v0.2.schema.json`: JSON Schema 2020-12 definitions for every cross-plane object.
- `schema-index.json`: stable object name to schema pointer mapping.
- `TRANSPORT_AND_REPLAY.md`: HTTP headers, digest, idempotency, replay, ACK, and settlement semantics.
- `fixtures/*.json`: one valid fixture per contract object.
- `negative-vectors.json`: schema, scope, grant, idempotency, provider, storage, timeout, cancellation, replay, and settlement failures.
- `validate-contract.mjs`: dependency-free positive/negative fixture and invariant test.

## Ownership boundary

Control plane is authoritative for tenant/project identity, approved content, grants, reservations, customer rate cards, wallet ledger, and settlement. Production plane is authoritative for provider execution, task attempts, generated media, exports, meter quantities, and provider cost observations.

Provider cost and customer settlement are deliberately separate. `TaskReceipt.providerExecution.providerCost` and `UsageReceipt.providerCost` are production observations. They never contain customer credits or price. Only the control plane can convert accepted usage into append-only wallet actions.

## Lifecycle

```text
ProjectProductionPackage + ProjectGrant
  -> GenerationTaskCommand
  -> TaskReceipt(succeeded)
  -> AssetReceipt(deliverable=true) or ExportReceipt(deliverable=true)
  -> UsageReceipt(eligible)
  -> ReceiptAck(durably recorded)
  -> control-plane settlement
```

Task success is not credit consumption. If no deliverable asset exists, usage is `not_eligible` and the reservation must be released according to the control-plane ledger policy.

## Validation

From the repository root:

```bash
node --test docs/program/contracts/v0.2/validate-contract.mjs
```

The validator parses the JSON Schema and every fixture, verifies all envelope digests and cross-object scopes/references, rejects forbidden secret/commercial fields, and proves the canonical negative vectors return their expected standard errors. It adds no runtime dependency.

## Standards used

- JSON Schema 2020-12 for payload shape.
- RFC 8785 canonical JSON semantics for `payloadDigest`.
- RFC 9530 `Content-Digest` for exact HTTP bytes.
- HTTP `Idempotency-Key` draft semantics: same key/same payload replays; same key/different payload conflicts.

No external source code was copied and no dependency was added.
