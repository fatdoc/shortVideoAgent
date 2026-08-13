import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

import * as migrationNamespace from "../../../apps/storycanvas/migrations/005_canvas_v1_asset_command.js";
import * as workspaceContractNamespace from "../../../apps/storycanvas/src/contracts/canvas-v1/workspaceMaterialization.js";
import * as workspacePrepareNamespace from "../../../apps/storycanvas/src/services/storycanvas/canvas-v1/workspacePrepare.js";
import type { CanvasWorkspaceAuthorityV01 } from "../../../apps/storycanvas/src/contracts/canvas-v1/workspaceMaterialization.js";
import type {
  EntityBindingV01,
  ProviderAssetBindingV01,
} from "../../../apps/storycanvas/src/contracts/canvas-v1/index.js";
import type { CanvasProductionScope } from "../../../apps/storycanvas/src/services/storycanvas/assets-v1/index.js";

type Knex = any;
const rootDir = process.cwd();
const verifiedDepsRoot = process.env.CANVAS_V1_VERIFIED_DEPS_ROOT;
if (!verifiedDepsRoot) throw new Error("CANVAS_V1_VERIFIED_DEPS_ROOT_REQUIRED");
const requireFromStory = createRequire(path.join(verifiedDepsRoot, "apps/storycanvas/package.json"));
const knex = requireFromStory("knex") as (configuration: Record<string, unknown>) => Knex;
const canvasV1Migration = ((migrationNamespace as any).default?.default
  ?? (migrationNamespace as any).default
  ?? migrationNamespace) as { up(database: Knex): Promise<void> };
const workspaceContract = ((workspaceContractNamespace as any).default
  ?? workspaceContractNamespace) as typeof workspaceContractNamespace;
const workspacePrepare = ((workspacePrepareNamespace as any).default
  ?? workspacePrepareNamespace) as typeof workspacePrepareNamespace;
const { deriveCanvasTargetEntityId } = workspaceContract;
const { CanvasV1WorkspacePreparer } = workspacePrepare;

const occurredAt = "2026-08-14T02:03:00.000Z";
const oldSessionId = "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678";
const newSessionId = "pcs_ZYXWVUTSRQPONMLKJIHGFEDC87654321";
const assetId = "88888888-8888-4888-8888-888888888888";
const shotId = "66666666-6666-4666-8666-666666666666";

const baseScope: CanvasProductionScope = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  packageId: "33333333-3333-4333-8333-333333333333",
  canvasSessionId: newSessionId,
  actorId: "12121212-1212-4212-8212-121212121212",
  localProjectId: 42,
};

const approvedPackage = {
  scriptVersionId: "44444444-4444-4444-8444-444444444444",
  storyboardVersionId: "55555555-5555-4555-8555-555555555555",
  approvedScript: { content: "欢迎来到门店，今天介绍招牌套餐。" },
  storyboard: [
    {
      shotId,
      sequence: 1,
      description: "门店入口讲解招牌套餐",
      durationSeconds: 6,
      sourceMode: "generated",
    },
  ],
};

function authority(
  scope: CanvasProductionScope,
  options: {
    assetId?: string;
    rightsStatus?: "authorized" | "pending" | "revoked" | "expired";
    validUntil?: string | null;
  } = {},
): CanvasWorkspaceAuthorityV01 {
  const selectedAssetId = options.assetId ?? assetId;
  return {
    objectType: "CanvasWorkspaceAuthority",
    contractVersion: "0.1",
    tenantId: scope.tenantId,
    projectId: scope.projectId,
    packageId: scope.packageId,
    canvasSessionId: scope.canvasSessionId,
    project: { projectName: "G6 无 Provider 安全门店视频" },
    approvedScript: { scriptId: approvedPackage.scriptVersionId, version: 1 },
    approvedStoryboard: { storyboardId: approvedPackage.storyboardVersionId, version: 1 },
    assets: [
      {
        objectType: "AssetRecord",
        contractVersion: "0.1",
        tenantId: scope.tenantId,
        projectId: scope.projectId,
        packageId: scope.packageId,
        canvasSessionId: scope.canvasSessionId,
        assetId: selectedAssetId,
        category: "virtual_character",
        displayName: "G6 安全虚拟讲解员",
        provenance: {
          kind: "customer_upload",
          sourceAssetId: null,
          declaredByActorId: scope.actorId,
          declaredAt: occurredAt,
        },
        rights: {
          status: options.rightsStatus ?? "authorized",
          basis: "customer_owned",
          validFrom: occurredAt,
          validUntil: options.validUntil ?? null,
          reviewedAt: occurredAt,
        },
        approval: {
          status: "approved",
          reviewedByActorId: scope.actorId,
          reviewedAt: occurredAt,
        },
        controlledPreviewUrl: `/api/canvas-v1/assets/${selectedAssetId}/preview`,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        occurredAt,
      },
    ],
    completeness: { project: true, approvedScript: true, approvedStoryboard: true, assets: true },
    requestId: "req-g6-session-recovery",
    occurredAt,
  };
}

async function database(): Promise<Knex> {
  const value = knex({
    client: "better-sqlite3",
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
  });
  await canvasV1Migration.up(value);
  return value;
}

async function seedOldBindings(db: Knex, sourceScope = baseScope): Promise<void> {
  const oldScope = { ...sourceScope, canvasSessionId: oldSessionId };
  const oldAuthority = authority(oldScope);
  const entityId = deriveCanvasTargetEntityId(oldAuthority, assetId);
  const provider: ProviderAssetBindingV01 = {
    objectType: "ProviderAssetBinding",
    contractVersion: "0.1",
    tenantId: oldScope.tenantId,
    projectId: oldScope.projectId,
    packageId: oldScope.packageId,
    canvasSessionId: oldSessionId,
    bindingId: "99999999-9999-4999-8999-999999999999",
    assetId,
    provider: "byteplus",
    providerStatus: "active",
    providerAssetId: "g6-server-only-provider-asset",
    providerGroupId: "g6-server-only-provider-group",
    assetUri: "asset://g6-server-only-provider-asset",
    registeredAt: occurredAt,
    updatedAt: occurredAt,
    occurredAt,
  };
  const entity: EntityBindingV01 = {
    objectType: "EntityBinding",
    contractVersion: "0.1",
    tenantId: oldScope.tenantId,
    projectId: oldScope.projectId,
    packageId: oldScope.packageId,
    canvasSessionId: oldSessionId,
    bindingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    assetId,
    entityId,
    entityType: "virtual_character",
    status: "approved",
    approvedByActorId: oldScope.actorId,
    approvedAt: occurredAt,
    continuityRevision: 1,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    occurredAt,
  };
  await db("sc_canvas_v1_provider_bindings").insert({
    bindingId: provider.bindingId,
    assetId,
    tenantId: oldScope.tenantId,
    projectId: oldScope.projectId,
    packageId: oldScope.packageId,
    authorityJson: JSON.stringify(provider),
    updatedAt: occurredAt,
  });
  await db("sc_canvas_v1_entity_bindings").insert({
    bindingId: entity.bindingId,
    assetId,
    entityId,
    tenantId: oldScope.tenantId,
    projectId: oldScope.projectId,
    packageId: oldScope.packageId,
    projectionJson: JSON.stringify(entity),
    updatedAt: occurredAt,
  });
}

async function prepare(
  db: Knex,
  scope: CanvasProductionScope,
  currentAuthority = authority(scope),
) {
  return new CanvasV1WorkspacePreparer({
    database: db,
    authorityClient: { fetch: async () => currentAuthority },
    now: () => new Date("2026-08-14T02:04:00.000Z"),
    capabilityAvailable: () => true,
  }).prepare({ scope, approvedPackage, requestId: "req-g6-session-recovery" });
}

function readiness(result: Awaited<ReturnType<typeof prepare>>) {
  return result.bootstrap.capabilities.find(({ capability }) => capability === "video_generation");
}

test("same actor and exact scope safely recover approved Provider/Entity continuity after a legal pcs rotation", async (context) => {
  const db = await database();
  context.after(() => db.destroy());
  await seedOldBindings(db);

  const result = await prepare(db, baseScope);
  assert.equal(result.bootstrap.status, "ready");
  assert.deepEqual(readiness(result), {
    capability: "video_generation",
    available: true,
    reasonCode: null,
  });

  const provider = JSON.parse((await db("sc_canvas_v1_provider_bindings").first()).authorityJson);
  const entity = JSON.parse((await db("sc_canvas_v1_entity_bindings").first()).projectionJson);
  assert.equal(provider.canvasSessionId, newSessionId);
  assert.equal(entity.canvasSessionId, newSessionId);
  assert.equal(provider.providerAssetId, "g6-server-only-provider-asset");
  assert.equal(entity.continuityRevision, 2);
});

test("cross actor, tenant, project or package never inherits old session authority", async (context) => {
  const variants: CanvasProductionScope[] = [
    { ...baseScope, actorId: "13131313-1313-4313-8313-131313131313" },
    { ...baseScope, tenantId: "14141414-1414-4414-8414-141414141414" },
    { ...baseScope, projectId: "15151515-1515-4515-8515-151515151515" },
    { ...baseScope, packageId: "16161616-1616-4616-8616-161616161616" },
  ];
  for (const [index, variant] of variants.entries()) {
    const db = await database();
    context.after(() => db.destroy());
    await seedOldBindings(db);
    const result = await prepare(db, variant, authority(variant));
    assert.equal(result.bootstrap.status, "blocked", `variant ${index}`);
    assert.equal(readiness(result)?.available, false, `variant ${index}`);
    const provider = JSON.parse((await db("sc_canvas_v1_provider_bindings").first()).authorityJson);
    assert.equal(provider.canvasSessionId, oldSessionId, `variant ${index}`);
  }
});

test("revoked or expired rights and asset/provider identity drift remain blocked with zero continuity copy", async (context) => {
  const cases = [
    { name: "revoked", current: authority(baseScope, { rightsStatus: "revoked" }) },
    {
      name: "expired",
      current: authority(baseScope, { validUntil: "2026-08-14T02:03:30.000Z" }),
    },
    {
      name: "asset-drift",
      current: authority(baseScope, { assetId: "abababab-abab-4bab-8bab-abababababab" }),
    },
  ];
  for (const value of cases) {
    const db = await database();
    context.after(() => db.destroy());
    await seedOldBindings(db);
    const result = await prepare(db, baseScope, value.current);
    assert.equal(result.bootstrap.status, "blocked", value.name);
    assert.equal(readiness(result)?.available, false, value.name);
    const provider = JSON.parse((await db("sc_canvas_v1_provider_bindings").first()).authorityJson);
    assert.equal(provider.canvasSessionId, oldSessionId, value.name);
  }
});
