import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import knex from "knex";

import type { AssetRecordV01 } from "@/contracts/canvas-v1";
import type { CanvasProductionScope } from "../assets-v1";
import { CanvasV1AssetMaterializer } from "./assetMaterialization";

const scope: CanvasProductionScope = {
  tenantId: "11111111-1111-4111-8111-111111111111", projectId: "22222222-2222-4222-8222-222222222222",
  packageId: "33333333-3333-4333-8333-333333333333", canvasSessionId: "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678",
  actorId: "12121212-1212-4212-8212-121212121212", localProjectId: 42,
};
const assetId = "88888888-8888-4888-8888-888888888888";
const attemptId = "20202020-2020-4020-8020-202020202020";
const occurredAt = "2026-08-14T02:06:00.000Z";
const bytes = Buffer.from([0xff, 0xd8, 0xff]);
const checksum = `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
const asset: AssetRecordV01 = {
  objectType: "AssetRecord", contractVersion: "0.1", tenantId: scope.tenantId, projectId: scope.projectId,
  packageId: scope.packageId, canvasSessionId: scope.canvasSessionId, assetId, category: "virtual_character",
  displayName: "门店讲解员", provenance: { kind: "customer_upload", sourceAssetId: null, declaredByActorId: scope.actorId, declaredAt: occurredAt },
  rights: { status: "authorized", basis: "customer_owned", validFrom: occurredAt, validUntil: null, reviewedAt: occurredAt },
  approval: { status: "approved", reviewedByActorId: scope.actorId, reviewedAt: occurredAt },
  controlledPreviewUrl: `/api/canvas-v1/assets/${assetId}/preview`, createdAt: occurredAt, updatedAt: occurredAt, occurredAt,
};

async function database() {
  const db = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  await db.schema.createTable("sc_media_assets", (table) => {
    table.string("id").primary(); table.integer("projectId"); table.string("type"); table.string("source"); table.string("originalName");
    table.string("mimeType"); table.integer("byteSize"); table.string("localPath"); table.string("remoteUrl"); table.string("provider");
    table.string("sha256"); table.string("rightsNote"); table.text("metadataJson"); table.string("createdAt"); table.unique(["projectId", "sha256"]);
  });
  await db.schema.createTable("sc_external_mappings", (table) => {
    table.string("id").primary(); table.string("system"); table.string("entityType"); table.string("localId"); table.string("externalId");
    table.text("metadataJson"); table.string("createdAt"); table.unique(["system", "entityType", "localId"]);
  });
  return db;
}

test("materializer atomically stores one verified character and exact mapping, then replays", async (context) => {
  const db = await database();
  const projectsRoot = await mkdtemp(path.join(os.tmpdir(), "canvas-materialization-"));
  context.after(async () => { await db.destroy(); await rm(projectsRoot, { recursive: true, force: true }); });
  let calls = 0;
  const materializer = new CanvasV1AssetMaterializer({
    database: db, projectsRoot, now: () => new Date(occurredAt),
    client: { materialize: async (request) => {
      calls += 1;
      return {
        objectType: "CanvasAssetMaterialization", contractVersion: "0.1", tenantId: request.tenantId, projectId: request.projectId,
        packageId: request.packageId, canvasSessionId: request.canvasSessionId, assetId: request.assetId,
        materializationAttemptId: request.materializationAttemptId, materializationId: "19191919-1919-4919-8919-191919191919",
        category: "virtual_character", mimeType: "image/jpeg", byteSize: bytes.length, checksum, contentEncoding: "base64",
        contentBase64: bytes.toString("base64"), replayed: calls > 1, requestId: request.requestId, occurredAt,
      };
    } },
  });
  const first = await materializer.materialize({ scope, asset, requestId: "req-first", materializationAttemptId: attemptId });
  const replay = await materializer.materialize({ scope, asset, requestId: "req-replay", materializationAttemptId: attemptId });
  assert.equal(first.localMediaId, replay.localMediaId);
  assert.equal(replay.replayed, true);
  assert.deepEqual(await readFile(first.localPath), bytes);
  assert.equal((await db("sc_media_assets")).length, 1);
  const mappings = await db("sc_external_mappings");
  assert.equal(mappings.length, 1);
  assert.deepEqual({ system: mappings[0].system, entityType: mappings[0].entityType, externalId: mappings[0].externalId, localId: mappings[0].localId }, {
    system: "saas-control-plane", entityType: "canvas-v1-asset", externalId: assetId, localId: first.localMediaId,
  });
});

test("materializer rejects an existing mapping drift without overwriting local facts", async (context) => {
  const db = await database();
  const projectsRoot = await mkdtemp(path.join(os.tmpdir(), "canvas-materialization-conflict-"));
  context.after(async () => { await db.destroy(); await rm(projectsRoot, { recursive: true, force: true }); });
  await db("sc_external_mappings").insert({ id: "99999999-9999-4999-8999-999999999999", system: "saas-control-plane", entityType: "canvas-v1-asset", externalId: assetId, localId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", metadataJson: "{}", createdAt: occurredAt });
  const materializer = new CanvasV1AssetMaterializer({
    database: db, projectsRoot,
    client: { materialize: async (request) => ({
      objectType: "CanvasAssetMaterialization", contractVersion: "0.1", tenantId: request.tenantId, projectId: request.projectId,
      packageId: request.packageId, canvasSessionId: request.canvasSessionId, assetId: request.assetId,
      materializationAttemptId: request.materializationAttemptId, materializationId: "19191919-1919-4919-8919-191919191919",
      category: "virtual_character", mimeType: "image/jpeg", byteSize: bytes.length, checksum, contentEncoding: "base64",
      contentBase64: bytes.toString("base64"), replayed: false, requestId: request.requestId, occurredAt,
    }) },
  });
  await assert.rejects(() => materializer.materialize({ scope, asset, requestId: "req-conflict", materializationAttemptId: attemptId }),
    (error: unknown) => (error as { code?: unknown }).code === "CANVAS_MATERIALIZATION_CONFLICT");
  assert.equal((await db("sc_external_mappings")).length, 1);
  assert.equal((await db("sc_media_assets")).length, 0);
});
