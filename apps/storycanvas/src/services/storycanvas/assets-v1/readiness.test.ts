import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  AssetRecordV01,
  EntityBindingV01,
  ProviderAssetBindingV01,
  ShotAssetRequirementV01,
} from "@/contracts/canvas-v1";
import {
  CanvasAssetProductionError,
  bindActiveVirtualCharacter,
} from "./productionAssetAdapter";
import {
  evaluateShotReadiness,
  normalizeProviderAssetStatus,
} from "./readiness";
import {
  CanvasProductionScopeError,
  ProductionScopeAdapter,
} from "./scope";

const scope = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  packageId: "33333333-3333-4333-8333-333333333333",
  canvasSessionId: "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678",
} as const;
const actorId = "12121212-1212-4212-8212-121212121212";
const assetId = "88888888-8888-4888-8888-888888888888";
const entityId = "16161616-1616-4616-8616-161616161616";
const requirementId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const shotId = "66666666-6666-4666-8666-666666666666";
const occurredAt = "2026-08-14T02:00:00.000Z";

function asset(overrides: Partial<AssetRecordV01> = {}): AssetRecordV01 {
  return {
    objectType: "AssetRecord",
    contractVersion: "0.1",
    ...scope,
    assetId,
    category: "virtual_character",
    displayName: "门店讲解员",
    provenance: {
      kind: "provider_generated",
      sourceAssetId: null,
      declaredByActorId: actorId,
      declaredAt: occurredAt,
    },
    rights: {
      status: "authorized",
      basis: "provider_generated",
      validFrom: occurredAt,
      validUntil: "2027-08-14T02:00:00.000Z",
      reviewedAt: occurredAt,
    },
    approval: { status: "approved", reviewedByActorId: actorId, reviewedAt: occurredAt },
    controlledPreviewUrl: `/api/canvas-v1/assets/${assetId}/preview`,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    occurredAt,
    ...overrides,
  };
}

function provider(overrides: Partial<ProviderAssetBindingV01> = {}): ProviderAssetBindingV01 {
  return {
    objectType: "ProviderAssetBinding",
    contractVersion: "0.1",
    ...scope,
    bindingId: "99999999-9999-4999-8999-999999999999",
    assetId,
    provider: "byteplus",
    providerStatus: "active",
    providerAssetId: "provider-asset-server-only-001",
    providerGroupId: "provider-group-server-only-001",
    assetUri: "asset://provider-asset-server-only-001",
    registeredAt: occurredAt,
    updatedAt: occurredAt,
    occurredAt,
    ...overrides,
  };
}

function entity(overrides: Partial<EntityBindingV01> = {}): EntityBindingV01 {
  return {
    objectType: "EntityBinding",
    contractVersion: "0.1",
    ...scope,
    bindingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    assetId,
    entityId,
    entityType: "virtual_character",
    status: "approved",
    approvedByActorId: actorId,
    approvedAt: occurredAt,
    continuityRevision: 5,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    occurredAt,
    ...overrides,
  };
}

function requirement(overrides: Partial<ShotAssetRequirementV01> = {}): ShotAssetRequirementV01 {
  return {
    objectType: "ShotAssetRequirement",
    contractVersion: "0.1",
    ...scope,
    requirementId,
    shotId,
    assetCategory: "virtual_character",
    entityId,
    status: "satisfied",
    source: {
      scriptId: "44444444-4444-4444-8444-444444444444",
      scriptVersion: 3,
      storyboardId: "55555555-5555-4555-8555-555555555555",
      storyboardVersion: 2,
    },
    requiredCapabilities: ["video_generation"],
    createdAt: occurredAt,
    updatedAt: occurredAt,
    occurredAt,
    ...overrides,
  };
}

test("production scope is derived from the server authority and exact-checks all claims", async () => {
  const adapter = new ProductionScopeAdapter({
    readAuthority: async (sessionId) => sessionId === scope.canvasSessionId ? {
      ...scope,
      actorId,
      localProjectId: 42,
      expiresAt: "2026-08-14T03:00:00.000Z",
    } : null,
    now: () => new Date("2026-08-14T02:00:00.000Z"),
  });

  assert.deepEqual(await adapter.resolve(scope.canvasSessionId, { ...scope, actorId }), {
    ...scope,
    actorId,
    localProjectId: 42,
  });
  await assert.rejects(
    () => adapter.resolve(scope.canvasSessionId, { ...scope, projectId: "20202020-2020-4020-8020-202020202020", actorId }),
    (error: unknown) => error instanceof CanvasProductionScopeError && error.code === "CANVAS_SCOPE_MISMATCH",
  );
  await assert.rejects(
    () => adapter.resolve("pcs_ZYXWVUTSRQPONMLKJIHGFEDC87654321", { ...scope, canvasSessionId: "pcs_ZYXWVUTSRQPONMLKJIHGFEDC87654321", actorId }),
    (error: unknown) => error instanceof CanvasProductionScopeError && error.code === "CANVAS_SESSION_INVALID",
  );
});

test("four-layer readiness is ordered and fails closed for rights, provider, binding, scope and capability", () => {
  const cases = [
    { asset: asset({ rights: { ...asset().rights, status: "pending" } }), reasons: ["RIGHTS_PENDING"] },
    { asset: asset({ rights: { ...asset().rights, status: "revoked" } }), reasons: ["RIGHTS_REVOKED"] },
    { asset: asset({ rights: { ...asset().rights, status: "expired" } }), reasons: ["RIGHTS_EXPIRED"] },
    { provider: provider({ providerStatus: "processing", providerAssetId: null, providerGroupId: null, assetUri: null, registeredAt: null }), reasons: ["PROVIDER_PROCESSING"] },
    { provider: provider({ providerStatus: "rejected", providerAssetId: null, providerGroupId: null, assetUri: null, registeredAt: null }), reasons: ["PROVIDER_REJECTED"] },
    { entity: null, reasons: ["ENTITY_BINDING_MISSING"] },
    { entity: entity({ status: "pending", approvedByActorId: null, approvedAt: null, continuityRevision: null }), reasons: ["ENTITY_BINDING_PENDING"] },
    { capabilities: new Set<string>(), reasons: ["CAPABILITY_UNAVAILABLE"] },
    { asset: asset({ projectId: "20202020-2020-4020-8020-202020202020" }), reasons: ["SCOPE_MISMATCH"] },
  ] as const;

  for (const value of cases) {
    const readiness = evaluateShotReadiness({
      scope,
      requirement: requirement(),
      asset: "asset" in value ? value.asset : asset(),
      providerBinding: "provider" in value ? value.provider : provider(),
      entityBinding: "entity" in value ? value.entity : entity(),
      availableCapabilities: "capabilities" in value ? value.capabilities : new Set(["video_generation"]),
      approvedScript: { scriptId: requirement().source.scriptId, version: 3 },
      approvedStoryboard: { storyboardId: requirement().source.storyboardId, version: 2 },
      readinessId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      evaluatedAt: occurredAt,
    });
    assert.equal(readiness.ready, false);
    assert.deepEqual(readiness.reasonCodes, value.reasons);
  }

  assert.equal(normalizeProviderAssetStatus("Active"), "active");
  assert.equal(normalizeProviderAssetStatus("local"), "unavailable");
  assert.equal(normalizeProviderAssetStatus(undefined), "unavailable");
});

test("only an active approved virtual character can bind and continuity advances atomically", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const bound = await bindActiveVirtualCharacter({
    scope: { ...scope, actorId, localProjectId: 42 },
    asset: asset(),
    providerBinding: provider(),
    entityId,
    persistBinding: async (input) => {
      calls.push(input);
      return 8;
    },
    bindingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    occurredAt,
  });
  assert.equal(bound.status, "approved");
  assert.equal(bound.continuityRevision, 8);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].assetUri, "asset://provider-asset-server-only-001");

  await assert.rejects(
    () => bindActiveVirtualCharacter({
      scope: { ...scope, actorId, localProjectId: 42 },
      asset: asset(),
      providerBinding: provider({ providerStatus: "processing", providerAssetId: null, providerGroupId: null, assetUri: null, registeredAt: null }),
      entityId,
      persistBinding: async () => 9,
      bindingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      occurredAt,
    }),
    (error: unknown) => error instanceof CanvasAssetProductionError && error.code === "CANVAS_PROVIDER_NOT_ACTIVE",
  );
});
