import assert from "node:assert/strict";
import test from "node:test";
import knex from "knex";

import canvasV1Migration from "../../../../migrations/005_canvas_v1_asset_command";
import { buildRemoteOutputKey } from "../remoteOutputStorage";
import type { CanvasProductionScope } from "../assets-v1";
import { CanvasV1ControlledMediaService } from "./controlledMedia";

const scope: CanvasProductionScope = {
  tenantId: "11111111-1111-4111-8111-111111111111", projectId: "22222222-2222-4222-8222-222222222222",
  packageId: "33333333-3333-4333-8333-333333333333", canvasSessionId: "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678",
  actorId: "12121212-1212-4212-8212-121212121212", localProjectId: 42,
};
const shotId = "66666666-6666-4666-8666-666666666666";
const assetId = "13131313-1313-4313-8313-131313131313";
const taskId = "18181818-1818-4818-8818-181818181818";
const commandId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const eventId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const occurredAt = "2026-08-14T02:06:00.000Z";
const target = { accessKey: "key", secretKey: "secret", region: "ap-southeast-1", bucket: "bucket", endpoint: "tos.example.test", prefix: "pilot", groupId: "group" };

async function database() {
  const db = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  await canvasV1Migration.up(db);
  await db.schema.createTable("sc_tasks", (table) => { table.string("id"); table.integer("projectId"); table.string("status"); table.text("outputJson"); });
  await db.schema.createTable("sc_media_assets", (table) => { table.string("id"); table.integer("projectId"); table.string("type"); table.string("source"); table.string("mimeType"); table.string("localPath"); table.text("metadataJson"); });
  const command = {
    objectType: "CanvasCommand", contractVersion: "0.1", tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId,
    canvasSessionId: scope.canvasSessionId, commandId, commandType: "GENERATE_SHOT", requestedByActorId: scope.actorId, requestSource: "user",
    approvalId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", payload: { shotId, readinessId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", prompt: "门店入口", referenceAssetIds: ["88888888-8888-4888-8888-888888888888"] }, requestId: "req-command", occurredAt,
  };
  const event = {
    objectType: "CanvasEvent", contractVersion: "0.1", tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId,
    canvasSessionId: scope.canvasSessionId, eventId, commandId, commandType: "GENERATE_SHOT", status: "task_created", providerSubmitted: true,
    taskCreated: true, outputRegistered: false, receiptRecorded: false, taskId, outputAssetId: null, receiptId: null, replayed: false, error: null,
    requestId: "req-command", occurredAt,
  };
  const key = buildRemoteOutputKey({ projectId: scope.localProjectId, taskId, assetId }, "video/mp4", target.prefix);
  await db("sc_canvas_v1_commands").insert({ commandId, tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId, canvasSessionId: scope.canvasSessionId, commandType: "GENERATE_SHOT", payloadDigest: "digest", commandJson: JSON.stringify(command), resultEventJson: JSON.stringify(event), createdAt: occurredAt, updatedAt: occurredAt });
  await db("sc_canvas_v1_events").insert({ eventId, commandId, tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId, canvasSessionId: scope.canvasSessionId, status: "task_created", eventJson: JSON.stringify(event), createdAt: occurredAt });
  await db("sc_tasks").insert({ id: taskId, projectId: scope.localProjectId, status: "succeeded", outputJson: JSON.stringify({ outputAssetId: assetId }) });
  await db("sc_media_assets").insert({ id: assetId, projectId: scope.localProjectId, type: "video", source: "generated", mimeType: "video/mp4", localPath: `tos://${target.bucket}/${key}`, metadataJson: JSON.stringify({ taskId, storage: { provider: "byteplus-tos", bucket: target.bucket, key } }) });
  return db;
}

test("controlled media exact-joins authority facts and proxies a bounded Range without exposing the signed URL", async (context) => {
  const db = await database();
  context.after(() => db.destroy());
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const service = new CanvasV1ControlledMediaService({
    database: db, resolveTarget: async () => target, signGet: () => "https://bucket.tos.example.test/private?X-Tos-Signature=secret",
    fetch: async (url, init) => {
      capturedUrl = String(url); capturedInit = init;
      return new Response(Buffer.from("video"), { status: 206, headers: { "content-type": "video/mp4", "content-length": "5", "content-range": "bytes 0-4/5", "accept-ranges": "bytes" } });
    },
  });
  const output = await service.open({ scope, assetId, range: "bytes=0-4" });
  assert.equal(output.status, 206);
  assert.equal(output.contentType, "video/mp4");
  assert.equal(new Headers(capturedInit?.headers).get("range"), "bytes=0-4");
  assert.equal(capturedInit?.redirect, "error");
  assert.match(capturedUrl, /X-Tos-Signature=secret/u);
  assert.equal(JSON.stringify(output).includes("X-Tos-Signature"), false);
});

test("controlled media fails closed on task/media scope drift before object storage", async (context) => {
  const db = await database();
  context.after(() => db.destroy());
  await db("sc_media_assets").where({ id: assetId }).update({ metadataJson: JSON.stringify({ taskId: "99999999-9999-4999-8999-999999999999" }) });
  let fetched = 0;
  const service = new CanvasV1ControlledMediaService({ database: db, resolveTarget: async () => target, fetch: async () => { fetched += 1; return new Response(); } });
  await assert.rejects(() => service.open({ scope, assetId }), (error: unknown) => (error as { code?: unknown }).code === "CANVAS_MEDIA_NOT_FOUND");
  assert.equal(fetched, 0);
});
