import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import express from "express";

import type { AssetRecordV01, CanvasDocumentV01, CanvasEventV01, ShotReadinessV01 } from "@/contracts/canvas-v1";
import type { CanvasProductionScope } from "@/services/storycanvas/assets-v1";
import { CanvasCommandServiceError } from "@/services/storycanvas/canvas-v1";
import { createCanvasV1ProductionRouter } from ".";

const scope: CanvasProductionScope = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  packageId: "33333333-3333-4333-8333-333333333333",
  canvasSessionId: "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678",
  actorId: "12121212-1212-4212-8212-121212121212",
  localProjectId: 42,
};
const contractScope = {
  tenantId: scope.tenantId,
  projectId: scope.projectId,
  packageId: scope.packageId,
  canvasSessionId: scope.canvasSessionId,
};
const occurredAt = "2026-08-14T02:02:00.000Z";
const assetId = "88888888-8888-4888-8888-888888888888";
const documentId = "77777777-7777-4777-8777-777777777777";
const shotId = "66666666-6666-4666-8666-666666666666";
let server: http.Server;
let baseUrl: string;
let executed = 0;

const asset: AssetRecordV01 = {
  objectType: "AssetRecord", contractVersion: "0.1", ...contractScope,
  assetId, category: "virtual_character", displayName: "讲解员",
  provenance: { kind: "provider_generated", sourceAssetId: null, declaredByActorId: scope.actorId, declaredAt: occurredAt },
  rights: { status: "authorized", basis: "provider_generated", validFrom: occurredAt, validUntil: null, reviewedAt: occurredAt },
  approval: { status: "approved", reviewedByActorId: scope.actorId, reviewedAt: occurredAt },
  controlledPreviewUrl: `/api/canvas-v1/assets/${assetId}/preview`, createdAt: occurredAt, updatedAt: occurredAt, occurredAt,
};
const document: CanvasDocumentV01 = {
  objectType: "CanvasDocument", contractVersion: "0.1", ...contractScope, documentId, status: "active", version: 1,
  shots: [{ shotId, position: 0, selectedOutputAssetId: null, prompt: "prompt", updatedAt: occurredAt }],
  playlist: { shotIds: [shotId] }, createdAt: occurredAt, updatedAt: occurredAt, occurredAt,
};
const readiness: ShotReadinessV01 = {
  objectType: "ShotReadiness", contractVersion: "0.1", ...contractScope,
  readinessId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", shotId, ready: true, reasonCodes: [],
  script: { scriptId: "44444444-4444-4444-8444-444444444444", version: 3, current: true },
  storyboard: { storyboardId: "55555555-5555-4555-8555-555555555555", version: 2, current: true },
  requirements: [{ requirementId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", assetId, scopeMatched: true, rightsStatus: "authorized", approvalStatus: "approved", providerStatus: "active", entityBindingStatus: "approved", capabilityAvailable: true, ready: true, reasonCodes: [] }],
  evaluatedAt: occurredAt, occurredAt,
};
const event: CanvasEventV01 = {
  objectType: "CanvasEvent", contractVersion: "0.1", ...contractScope,
  eventId: "ffffffff-ffff-4fff-8fff-ffffffffffff", commandId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  commandType: "GENERATE_SHOT", status: "accepted", providerSubmitted: false, taskCreated: false,
  outputRegistered: false, receiptRecorded: false, taskId: null, outputAssetId: null, receiptId: null,
  replayed: false, error: null, requestId: "req-route", occurredAt,
};

before(async () => {
  const app = express();
  app.use("/api/production/pilot/canvas/v1", createCanvasV1ProductionRouter({
    resolveRequestScope: async (request) => {
      if (request.header("x-canvas-session-id") !== scope.canvasSessionId) throw new CanvasCommandServiceError("CANVAS_SESSION_INVALID");
      return scope;
    },
    commandService: { execute: async () => { executed += 1; return event; } },
    assets: { list: async () => [asset], getReadiness: async () => readiness },
    documents: { read: async () => document, create: async () => document },
    bodyLimit: "1kb",
  }));
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/api/production/pilot/canvas/v1`;
});

after(async () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

test("aggregate routes expose only browser-safe assets/readiness/documents with request IDs", async () => {
  for (const path of ["/assets", `/assets/readiness/${shotId}`, `/documents/${documentId}`]) {
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-canvas-session-id": scope.canvasSessionId, "x-request-id": "req-safe-route" } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-request-id"), "req-safe-route");
    const serialized = JSON.stringify(await response.json());
    assert.equal(serialized.includes("asset://"), false);
    assert.equal(/providerAssetId|payloadDigest|ProjectGrant|accessToken/iu.test(serialized), false);
  }
});

test("commands require CSRF and use the common command service", async () => {
  const denied = await fetch(`${baseUrl}/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(denied.status, 401);
  assert.equal(executed, 0);
  const accepted = await fetch(`${baseUrl}/commands`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-storycanvas-csrf": "pilot-canvas-v1",
      "x-canvas-session-id": scope.canvasSessionId,
    },
    body: JSON.stringify({ safe: true }),
  });
  assert.equal(accepted.status, 202);
  assert.equal(executed, 1);
});

test("the dedicated parser rejects oversized bodies with a bounded safe envelope", async () => {
  const response = await fetch(`${baseUrl}/commands`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-storycanvas-csrf": "pilot-canvas-v1", "x-request-id": "req-too-large" },
    body: JSON.stringify({ value: "x".repeat(2048), secret: "asset://must-not-reflect" }),
  });
  assert.equal(response.status, 422);
  const body = await response.json() as Record<string, any>;
  assert.equal(body.error.code, "CANVAS_SCHEMA_INVALID");
  assert.equal(body.error.requestId, "req-too-large");
  assert.equal(JSON.stringify(body).includes("asset://"), false);
  assert.equal(executed, 1);
});

test("browser request bodies reject server-only provider and transport material before services", async () => {
  const response = await fetch(`${baseUrl}/commands`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-storycanvas-csrf": "pilot-canvas-v1" },
    body: JSON.stringify({ idempotencyKey: "raw-key", nested: { value: "asset://private" } }),
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json() as Record<string, any>).error.code, "CANVAS_SCHEMA_INVALID");
  assert.equal(executed, 1);
});

test("a default aggregate router fails closed when runtime dependencies are not wired", async () => {
  const app = express();
  app.use(createCanvasV1ProductionRouter());
  const local = http.createServer(app);
  await new Promise<void>((resolve) => local.listen(0, "127.0.0.1", resolve));
  try {
    const address = local.address();
    const response = await fetch(`http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/assets`);
    assert.equal(response.status, 503);
    assert.equal((await response.json() as Record<string, any>).error.code, "CANVAS_CAPABILITY_UNAVAILABLE");
    const media = await fetch(`http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/media/${assetId}/preview`);
    assert.equal(media.status, 503);
    assert.equal((await media.json() as Record<string, any>).error.code, "CANVAS_CAPABILITY_UNAVAILABLE");
  } finally {
    await new Promise<void>((resolve, reject) => local.close((error) => error ? reject(error) : resolve()));
  }
});
