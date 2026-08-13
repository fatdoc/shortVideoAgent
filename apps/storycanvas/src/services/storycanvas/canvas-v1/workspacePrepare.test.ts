import assert from "node:assert/strict";
import test from "node:test";
import knex, { type Knex } from "knex";

import canvasV1Migration from "../../../../migrations/005_canvas_v1_asset_command";
import type { EntityBindingV01, ProviderAssetBindingV01 } from "@/contracts/canvas-v1";
import { deriveCanvasTargetEntityId } from "@/contracts/canvas-v1/workspaceMaterialization";
import type { CanvasWorkspaceAuthorityV01 } from "@/contracts/canvas-v1/workspaceMaterialization";
import type { CanvasProductionScope } from "../assets-v1";
import { CanvasV1WorkspacePreparer } from "./workspacePrepare";

const scope: CanvasProductionScope = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  packageId: "33333333-3333-4333-8333-333333333333",
  canvasSessionId: "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678",
  actorId: "12121212-1212-4212-8212-121212121212",
  localProjectId: 42,
};
const occurredAt = "2026-08-14T02:03:00.000Z";
const shotId = "66666666-6666-4666-8666-666666666666";
const assetId = "88888888-8888-4888-8888-888888888888";
const oldSessionId = scope.canvasSessionId;
const rotatedScope: CanvasProductionScope = {
  ...scope,
  canvasSessionId: "pcs_ZYXWVUTSRQPONMLKJIHGFEDC87654321",
};

function asset(id = assetId) {
  return {
    objectType: "AssetRecord" as const,
    contractVersion: "0.1" as const,
    tenantId: scope.tenantId,
    projectId: scope.projectId,
    packageId: scope.packageId,
    canvasSessionId: scope.canvasSessionId,
    assetId: id,
    category: "virtual_character" as const,
    displayName: "门店讲解员",
    provenance: { kind: "customer_upload" as const, sourceAssetId: null, declaredByActorId: scope.actorId, declaredAt: occurredAt },
    rights: { status: "authorized" as const, basis: "customer_owned" as const, validFrom: occurredAt, validUntil: null, reviewedAt: occurredAt },
    approval: { status: "approved" as const, reviewedByActorId: scope.actorId, reviewedAt: occurredAt },
    controlledPreviewUrl: `/api/canvas-v1/assets/${id}/preview`,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    occurredAt,
  };
}

function authority(assets = [asset()]): CanvasWorkspaceAuthorityV01 {
  return {
    objectType: "CanvasWorkspaceAuthority",
    contractVersion: "0.1",
    tenantId: scope.tenantId,
    projectId: scope.projectId,
    packageId: scope.packageId,
    canvasSessionId: scope.canvasSessionId,
    project: { projectName: "门店探店获客视频" },
    approvedScript: { scriptId: "44444444-4444-4444-8444-444444444444", version: 3 },
    approvedStoryboard: { storyboardId: "55555555-5555-4555-8555-555555555555", version: 2 },
    assets,
    completeness: { project: true, approvedScript: true, approvedStoryboard: true, assets: true },
    requestId: "req-authority",
    occurredAt,
  };
}

function authorityFor(
  targetScope: CanvasProductionScope,
  options: { assetId?: string; rightsStatus?: "authorized" | "revoked" | "expired"; validUntil?: string | null } = {},
): CanvasWorkspaceAuthorityV01 {
  const selectedAssetId = options.assetId ?? assetId;
  return {
    ...authority(),
    tenantId: targetScope.tenantId,
    projectId: targetScope.projectId,
    packageId: targetScope.packageId,
    canvasSessionId: targetScope.canvasSessionId,
    assets: [{
      ...asset(selectedAssetId),
      tenantId: targetScope.tenantId,
      projectId: targetScope.projectId,
      packageId: targetScope.packageId,
      canvasSessionId: targetScope.canvasSessionId,
      provenance: { ...asset(selectedAssetId).provenance, declaredByActorId: targetScope.actorId },
      rights: {
        ...asset(selectedAssetId).rights,
        status: options.rightsStatus ?? "authorized",
        validUntil: options.validUntil ?? null,
      },
    }],
  };
}

async function seedOldSessionBindings(database: Knex, mutate?: {
  provider?: (value: ProviderAssetBindingV01) => Record<string, unknown>;
  entity?: (value: EntityBindingV01) => Record<string, unknown>;
}) {
  const oldScope = { ...rotatedScope, canvasSessionId: oldSessionId };
  const oldAuthority = authorityFor(oldScope);
  const entityId = deriveCanvasTargetEntityId(oldAuthority, assetId);
  const provider: ProviderAssetBindingV01 = {
    objectType: "ProviderAssetBinding", contractVersion: "0.1", tenantId: oldScope.tenantId,
    projectId: oldScope.projectId, packageId: oldScope.packageId, canvasSessionId: oldScope.canvasSessionId,
    bindingId: "99999999-9999-4999-8999-999999999999", assetId, provider: "byteplus", providerStatus: "active",
    providerAssetId: "trusted-provider-asset", providerGroupId: "trusted-provider-group",
    assetUri: "asset://trusted-provider-asset", registeredAt: occurredAt, updatedAt: occurredAt, occurredAt,
  };
  const entity: EntityBindingV01 = {
    objectType: "EntityBinding", contractVersion: "0.1", tenantId: oldScope.tenantId,
    projectId: oldScope.projectId, packageId: oldScope.packageId, canvasSessionId: oldScope.canvasSessionId,
    bindingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", assetId, entityId, entityType: "virtual_character",
    status: "approved", approvedByActorId: oldScope.actorId, approvedAt: occurredAt, continuityRevision: 1,
    createdAt: occurredAt, updatedAt: occurredAt, occurredAt,
  };
  await database("sc_canvas_v1_provider_bindings").insert({
    bindingId: provider.bindingId, assetId, tenantId: oldScope.tenantId, projectId: oldScope.projectId,
    packageId: oldScope.packageId, authorityJson: JSON.stringify(mutate?.provider?.(provider) ?? provider), updatedAt: occurredAt,
  });
  await database("sc_canvas_v1_entity_bindings").insert({
    bindingId: entity.bindingId, assetId, entityId, tenantId: oldScope.tenantId, projectId: oldScope.projectId,
    packageId: oldScope.packageId, projectionJson: JSON.stringify(mutate?.entity?.(entity) ?? entity), updatedAt: occurredAt,
  });
}

const approvedPackage = {
  scriptVersionId: "44444444-4444-4444-8444-444444444444",
  storyboardVersionId: "55555555-5555-4555-8555-555555555555",
  approvedScript: { content: "欢迎来到门店，今天介绍招牌套餐。" },
  storyboard: [{ shotId, sequence: 1, description: "门店入口讲解招牌套餐", durationSeconds: 6, sourceMode: "generated" }],
};

test("trusted prepare creates document, asset, requirement and readiness atomically and replays", async (context) => {
  const database = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  context.after(() => database.destroy());
  await canvasV1Migration.up(database);
  const preparer = new CanvasV1WorkspacePreparer({
    database,
    authorityClient: { fetch: async () => authority() },
    now: () => new Date(occurredAt),
    capabilityAvailable: () => false,
  });

  const first = await preparer.prepare({ scope, approvedPackage, requestId: "req-prepare" });
  const replay = await preparer.prepare({ scope, approvedPackage, requestId: "req-prepare-replay" });
  assert.equal(first.document.documentId, replay.document.documentId);
  assert.equal(first.document.shots[0]?.prompt, approvedPackage.storyboard[0].description);
  assert.equal((await database("sc_canvas_v1_documents")).length, 1);
  assert.equal((await database("sc_canvas_v1_asset_records")).length, 1);
  assert.equal((await database("sc_canvas_v1_requirements")).length, 1);
  assert.equal((await database("sc_canvas_v1_readiness")).length, 1);
  const requirement = JSON.parse((await database("sc_canvas_v1_requirements").first()).projectionJson);
  assert.equal(requirement.requirementId, "a1795f30-1ab9-5faf-8c6a-14533f30b29f");
  assert.equal(requirement.entityId, "c1d64353-4315-535e-aa18-9948be4a5d25");
  assert.equal(requirement.source.scriptVersion, 3);
  const readiness = JSON.parse((await database("sc_canvas_v1_readiness").first()).projectionJson);
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.reasonCodes, ["PROVIDER_UNAVAILABLE", "ENTITY_BINDING_MISSING", "CAPABILITY_UNAVAILABLE"]);
});

test("missing or ambiguous primary virtual character performs zero writes", async (context) => {
  for (const assets of [[], [asset(), asset("99999999-9999-4999-8999-999999999999")]]) {
    const database = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
    context.after(() => database.destroy());
    await canvasV1Migration.up(database);
    const preparer = new CanvasV1WorkspacePreparer({
      database,
      authorityClient: { fetch: async () => authority(assets) },
      now: () => new Date(occurredAt),
    });
    await assert.rejects(() => preparer.prepare({ scope, approvedPackage, requestId: "req-casting" }),
      (error: unknown) => ["PRIMARY_VIRTUAL_CHARACTER_MISSING", "PRIMARY_VIRTUAL_CHARACTER_AMBIGUOUS"]
        .includes(String((error as { code?: unknown }).code)));
    for (const table of ["sc_canvas_v1_documents", "sc_canvas_v1_asset_records", "sc_canvas_v1_requirements", "sc_canvas_v1_readiness"]) {
      assert.equal((await database(table)).length, 0, table);
    }
  }
});

test("legal session rotation atomically reprojects the same trusted provider/entity facts once", async (context) => {
  const database = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  context.after(() => database.destroy());
  await canvasV1Migration.up(database);
  await seedOldSessionBindings(database);
  const preparer = new CanvasV1WorkspacePreparer({
    database,
    authorityClient: { fetch: async () => authorityFor(rotatedScope) },
    now: () => new Date("2026-08-14T02:04:00.000Z"),
    capabilityAvailable: () => true,
  });

  const first = await preparer.prepare({ scope: rotatedScope, approvedPackage, requestId: "req-rotation" });
  const replay = await preparer.prepare({ scope: rotatedScope, approvedPackage, requestId: "req-rotation-replay" });
  assert.equal(first.bootstrap.status, "ready");
  assert.equal(replay.bootstrap.status, "ready");
  const provider = JSON.parse(String((await database("sc_canvas_v1_provider_bindings").first()).authorityJson));
  const entity = JSON.parse(String((await database("sc_canvas_v1_entity_bindings").first()).projectionJson));
  assert.equal(provider.canvasSessionId, rotatedScope.canvasSessionId);
  assert.equal(provider.providerAssetId, "trusted-provider-asset");
  assert.equal(provider.providerGroupId, "trusted-provider-group");
  assert.equal(provider.assetUri, "asset://trusted-provider-asset");
  assert.equal(entity.canvasSessionId, rotatedScope.canvasSessionId);
  assert.equal(entity.continuityRevision, 2);
});

test("session reprojection rejects provider drift, server-only poison and actor drift without changing old facts", async (context) => {
  const cases = [
    { name: "provider-identity", provider: (value: ProviderAssetBindingV01) => ({ ...value, assetUri: "asset://provider-drift" }) },
    { name: "provider-poison", provider: (value: ProviderAssetBindingV01) => ({ ...value, accessToken: "must-not-copy" }) },
    { name: "actor", entity: (value: EntityBindingV01) => ({ ...value, approvedByActorId: "13131313-1313-4313-8313-131313131313" }) },
  ];
  for (const value of cases) {
    const database = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
    context.after(() => database.destroy());
    await canvasV1Migration.up(database);
    await seedOldSessionBindings(database, value);
    const beforeProvider = String((await database("sc_canvas_v1_provider_bindings").first()).authorityJson);
    const beforeEntity = String((await database("sc_canvas_v1_entity_bindings").first()).projectionJson);
    const result = await new CanvasV1WorkspacePreparer({
      database,
      authorityClient: { fetch: async () => authorityFor(rotatedScope) },
      now: () => new Date("2026-08-14T02:04:00.000Z"),
      capabilityAvailable: () => true,
    }).prepare({ scope: rotatedScope, approvedPackage, requestId: `req-${value.name}` });
    assert.equal(result.bootstrap.status, "blocked", value.name);
    assert.equal(String((await database("sc_canvas_v1_provider_bindings").first()).authorityJson), beforeProvider, value.name);
    assert.equal(String((await database("sc_canvas_v1_entity_bindings").first()).projectionJson), beforeEntity, value.name);
  }
});
