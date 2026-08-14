import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import knex from "knex";

import canvasV1Migration from "../../../../migrations/005_canvas_v1_asset_command";
import { buildRemoteOutputKey } from "../remoteOutputStorage";
import type { CanvasProductionScope } from "../assets-v1";
import { resolveProjectMediaPath } from "../projectMedia";
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
  await db.schema.createTable("sc_media_assets", (table) => { table.string("id"); table.integer("projectId"); table.string("type"); table.string("source"); table.string("mimeType"); table.integer("byteSize"); table.string("sha256"); table.string("localPath"); table.text("metadataJson"); });
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
  await db("sc_media_assets").insert({ id: assetId, projectId: scope.localProjectId, type: "video", source: "generated", mimeType: "video/mp4", byteSize: 5, sha256: "a".repeat(64), localPath: `tos://${target.bucket}/${key}`, metadataJson: JSON.stringify({ taskId, storage: { provider: "byteplus-tos", bucket: target.bucket, key } }) });
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

test("controlled media streams an exact local output range without exposing its filesystem path", async (context) => {
  const db = await database();
  const projectsRoot = await mkdtemp(path.join(os.tmpdir(), "canvas-v1-controlled-local-"));
  context.after(async () => { await db.destroy(); await rm(projectsRoot, { recursive: true, force: true }); });
  const bytes = Buffer.from("local-video");
  const localPath = resolveProjectMediaPath(scope.localProjectId, "videos", assetId, "mp4", projectsRoot);
  await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(localPath), { recursive: true }));
  await writeFile(localPath, bytes, { mode: 0o600 });
  const digest = await import("node:crypto").then(({ default: crypto }) => crypto.createHash("sha256").update(bytes).digest("hex"));
  await db("sc_media_assets").where({ id: assetId }).update({
    localPath,
    byteSize: bytes.byteLength,
    sha256: digest,
    metadataJson: JSON.stringify({ taskId, storage: { provider: "storycanvas-local" } }),
  });
  let storageCalls = 0;
  const service = new CanvasV1ControlledMediaService({
    database: db,
    projectsRoot,
    resolveTarget: async () => { storageCalls += 1; return target; },
    signGet: () => { storageCalls += 1; return "https://should-not-run.invalid"; },
    fetch: async () => { storageCalls += 1; return new Response(); },
  });
  const output = await service.open({ scope, assetId, range: "bytes=1-5" });
  assert.equal(output.status, 206);
  assert.equal(output.contentRange, `bytes 1-5/${bytes.byteLength}`);
  assert.equal(output.contentLength, 5);
  assert.equal(Buffer.from(await new Response(output.body).arrayBuffer()).toString(), "ocal-");
  assert.equal(storageCalls, 0);
  assert.equal(JSON.stringify(output).includes(projectsRoot), false);
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

test("controlled media rejects every persisted event or command JSON authority poison before target resolution", async (context) => {
  const other = "99999999-9999-4999-8999-999999999999";
  const poisons: Array<{ table: "sc_canvas_v1_events" | "sc_canvas_v1_commands"; column: "eventJson" | "commandJson"; field: string; value?: string }> = [
    { table: "sc_canvas_v1_events", column: "eventJson", field: "tenantId" },
    { table: "sc_canvas_v1_events", column: "eventJson", field: "projectId" },
    { table: "sc_canvas_v1_events", column: "eventJson", field: "packageId" },
    { table: "sc_canvas_v1_events", column: "eventJson", field: "canvasSessionId" },
    { table: "sc_canvas_v1_events", column: "eventJson", field: "eventId" },
    { table: "sc_canvas_v1_events", column: "eventJson", field: "commandId" },
    { table: "sc_canvas_v1_events", column: "eventJson", field: "commandType", value: "SELECT_SHOT_OUTPUT" },
    { table: "sc_canvas_v1_events", column: "eventJson", field: "taskId" },
    { table: "sc_canvas_v1_events", column: "eventJson", field: "outputAssetId" },
    { table: "sc_canvas_v1_commands", column: "commandJson", field: "tenantId" },
    { table: "sc_canvas_v1_commands", column: "commandJson", field: "projectId" },
    { table: "sc_canvas_v1_commands", column: "commandJson", field: "packageId" },
    { table: "sc_canvas_v1_commands", column: "commandJson", field: "canvasSessionId" },
    { table: "sc_canvas_v1_commands", column: "commandJson", field: "requestedByActorId" },
    { table: "sc_canvas_v1_commands", column: "commandJson", field: "commandId" },
    { table: "sc_canvas_v1_commands", column: "commandJson", field: "commandType", value: "SELECT_SHOT_OUTPUT" },
  ];
  for (const poison of poisons) {
    const db = await database();
    context.after(() => db.destroy());
    const row = await db(poison.table).first();
    await db(poison.table).update({
      [poison.column]: JSON.stringify({ ...JSON.parse(String(row[poison.column])), [poison.field]: poison.value ?? other }),
    });
    let resolved = 0;
    let signed = 0;
    let fetched = 0;
    const service = new CanvasV1ControlledMediaService({
      database: db,
      resolveTarget: async () => { resolved += 1; return target; },
      signGet: () => { signed += 1; return "https://example.test/private"; },
      fetch: async () => { fetched += 1; return new Response(); },
    });
    await assert.rejects(
      () => service.open({ scope, assetId }),
      (error: unknown) => (error as { code?: unknown }).code === "CANVAS_MEDIA_NOT_FOUND",
      `${poison.table}.${poison.field}`,
    );
    assert.deepEqual({ resolved, signed, fetched }, { resolved: 0, signed: 0, fetched: 0 }, `${poison.table}.${poison.field}`);
  }
});
