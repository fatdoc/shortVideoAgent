import assert from "node:assert/strict";
import test from "node:test";
import knex from "knex";

import canvasV1Migration from "../../../../migrations/005_canvas_v1_asset_command";
import type { CanvasEventV01 } from "@/contracts/canvas-v1";
import type { CanvasWorkspaceAuthorityV01 } from "@/contracts/canvas-v1/workspaceMaterialization";
import type { CanvasProductionScope } from "../assets-v1";
import { CanvasV1WorkspacePreparer } from "./workspacePrepare";
import { CanvasV1WorkspaceReader } from "./workspaceProjection";

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
const outputAssetId = "13131313-1313-4313-8313-131313131313";
const taskId = "18181818-1818-4818-8818-181818181818";
const commandId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const authority: CanvasWorkspaceAuthorityV01 = {
  objectType: "CanvasWorkspaceAuthority",
  contractVersion: "0.1",
  tenantId: scope.tenantId,
  projectId: scope.projectId,
  packageId: scope.packageId,
  canvasSessionId: scope.canvasSessionId,
  project: { projectName: "门店探店获客视频" },
  approvedScript: { scriptId: "44444444-4444-4444-8444-444444444444", version: 3 },
  approvedStoryboard: { storyboardId: "55555555-5555-4555-8555-555555555555", version: 2 },
  assets: [{
    objectType: "AssetRecord",
    contractVersion: "0.1",
    tenantId: scope.tenantId,
    projectId: scope.projectId,
    packageId: scope.packageId,
    canvasSessionId: scope.canvasSessionId,
    assetId,
    category: "virtual_character",
    displayName: "门店讲解员",
    provenance: { kind: "customer_upload", sourceAssetId: null, declaredByActorId: scope.actorId, declaredAt: occurredAt },
    rights: { status: "authorized", basis: "customer_owned", validFrom: occurredAt, validUntil: null, reviewedAt: occurredAt },
    approval: { status: "approved", reviewedByActorId: scope.actorId, reviewedAt: occurredAt },
    controlledPreviewUrl: `/api/canvas-v1/assets/${assetId}/preview`,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    occurredAt,
  }],
  completeness: { project: true, approvedScript: true, approvedStoryboard: true, assets: true },
  requestId: "req-authority",
  occurredAt,
};
const approvedPackage = {
  scriptVersionId: authority.approvedScript.scriptId,
  storyboardVersionId: authority.approvedStoryboard.storyboardId,
  approvedScript: { content: "欢迎来到门店，今天介绍招牌套餐。" },
  storyboard: [{ shotId, sequence: 1, description: "门店入口讲解招牌套餐", durationSeconds: 6, sourceMode: "generated" }],
};

async function createDatabase() {
  const database = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  await canvasV1Migration.up(database);
  await database.schema.createTable("sc_external_mappings", (table) => {
    table.string("id"); table.string("system"); table.string("entityType"); table.string("externalId"); table.string("localId"); table.text("metadataJson"); table.text("createdAt");
  });
  await database.schema.createTable("sc_media_assets", (table) => {
    table.string("id"); table.integer("projectId"); table.string("type"); table.string("source"); table.string("localPath"); table.string("mimeType"); table.integer("byteSize"); table.string("sha256"); table.text("metadataJson"); table.text("createdAt");
  });
  await database.schema.createTable("sc_tasks", (table) => {
    table.string("id"); table.integer("projectId"); table.string("status"); table.text("outputJson");
  });
  return database;
}

test("workspace reader is SQL read-only and projects exact Package facts with blocked readiness", async (context) => {
  const database = await createDatabase();
  context.after(() => database.destroy());
  await new CanvasV1WorkspacePreparer({
    database,
    authorityClient: { fetch: async () => authority },
    now: () => new Date(occurredAt),
  }).prepare({ scope, approvedPackage, requestId: "req-prepare" });
  const statements: string[] = [];
  database.on("query", (query) => statements.push(query.sql));
  const workspace = await new CanvasV1WorkspaceReader({ database, now: () => new Date(occurredAt) })
    .read({ scope, approvedPackage, authority, requestId: "req-workspace" });
  assert.equal(workspace.status, "blocked");
  assert.deepEqual(workspace.reasonCodes, ["WORKSPACE_CAPABILITY_BLOCKED", "WORKSPACE_SHOT_BLOCKED"]);
  assert.equal(workspace.shots[0].title, "镜头 01");
  assert.equal(workspace.shots[0].scriptText, approvedPackage.approvedScript.content);
  assert.equal(workspace.shots[0].storyboardText, approvedPackage.storyboard[0].description);
  assert.equal(workspace.assets[0].materialization.status, "not_started");
  assert.equal(statements.some((sql) => /^\s*(?:insert|update|delete|replace)\b/iu.test(sql)), false);
});

test("workspace output requires exact command to shot to succeeded task to registered media join", async (context) => {
  const database = await createDatabase();
  context.after(() => database.destroy());
  await new CanvasV1WorkspacePreparer({
    database,
    authorityClient: { fetch: async () => authority },
    now: () => new Date(occurredAt),
  }).prepare({ scope, approvedPackage, requestId: "req-prepare" });
  const command = {
    objectType: "CanvasCommand", contractVersion: "0.1", tenantId: scope.tenantId, projectId: scope.projectId,
    packageId: scope.packageId, canvasSessionId: scope.canvasSessionId, commandId, commandType: "GENERATE_SHOT",
    requestedByActorId: scope.actorId, requestSource: "user", approvalId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    payload: { shotId, readinessId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", prompt: "门店入口", referenceAssetIds: [assetId] },
    requestId: "req-command", occurredAt,
  };
  const event: CanvasEventV01 = {
    objectType: "CanvasEvent", contractVersion: "0.1", tenantId: scope.tenantId, projectId: scope.projectId,
    packageId: scope.packageId, canvasSessionId: scope.canvasSessionId, eventId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    commandId, commandType: "GENERATE_SHOT", status: "task_created", providerSubmitted: true, taskCreated: true,
    outputRegistered: false, receiptRecorded: false, taskId, outputAssetId: null, receiptId: null, replayed: false,
    error: null, requestId: "req-command", occurredAt,
  };
  await database("sc_canvas_v1_commands").insert({ commandId, tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId, canvasSessionId: scope.canvasSessionId, commandType: "GENERATE_SHOT", payloadDigest: "digest", commandJson: JSON.stringify(command), resultEventJson: JSON.stringify(event), createdAt: occurredAt, updatedAt: occurredAt });
  await database("sc_canvas_v1_events").insert({ eventId: event.eventId, commandId, tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId, canvasSessionId: scope.canvasSessionId, status: event.status, eventJson: JSON.stringify(event), createdAt: occurredAt });
  await database("sc_tasks").insert({ id: taskId, projectId: scope.localProjectId, status: "succeeded", outputJson: JSON.stringify({ outputAssetId }) });
  await database("sc_media_assets").insert({ id: outputAssetId, projectId: scope.localProjectId, type: "video", source: "generated", localPath: "tos://bucket/key", mimeType: "video/mp4", byteSize: 10, sha256: "a".repeat(64), metadataJson: JSON.stringify({ taskId }), createdAt: occurredAt });
  const reader = new CanvasV1WorkspaceReader({ database, now: () => new Date(occurredAt) });
  const joined = await reader.read({ scope, approvedPackage, authority, requestId: "req-workspace-output" });
  assert.deepEqual(joined.shots[0].outputs, [{ assetId: outputAssetId, kind: "video", previewUrl: `/api/production/pilot/canvas/v1/media/${outputAssetId}/preview`, selected: false }]);
  assert.equal(joined.shots[0].event?.eventId, event.eventId);
  await database("sc_media_assets").where({ id: outputAssetId }).update({ metadataJson: JSON.stringify({ taskId: "99999999-9999-4999-8999-999999999999" }) });
  const drifted = await reader.read({ scope, approvedPackage, authority, requestId: "req-workspace-drift" });
  assert.deepEqual(drifted.shots[0].outputs, []);
});
