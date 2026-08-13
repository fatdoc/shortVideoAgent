import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";
import express from "express";
import knex from "knex";

import canvasV1Migration from "../../../../migrations/005_canvas_v1_asset_command";
import type { AssetRecordV01, CanvasCommandV01 } from "@/contracts/canvas-v1";
import type { PilotCanvasServerAuthority } from "../pilotCanvasCapability";
import { createCanvasV1RuntimeRouter } from "./runtime";

const tenantId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const packageId = "33333333-3333-4333-8333-333333333333";
const actorId = "12121212-1212-4212-8212-121212121212";
const canvasSessionId = "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678";
const assetId = "88888888-8888-4888-8888-888888888888";
const shotId = "66666666-6666-4666-8666-666666666666";
const occurredAt = "2026-08-14T02:00:00.000Z";
const origin = "https://pilot.example.test";

const asset: AssetRecordV01 = {
  objectType: "AssetRecord",
  contractVersion: "0.1",
  tenantId,
  projectId,
  packageId,
  canvasSessionId,
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
    validUntil: null,
    reviewedAt: occurredAt,
  },
  approval: { status: "approved", reviewedByActorId: actorId, reviewedAt: occurredAt },
  controlledPreviewUrl: `/api/canvas-v1/assets/${assetId}/preview`,
  createdAt: occurredAt,
  updatedAt: occurredAt,
  occurredAt,
};

const generateCommand: CanvasCommandV01 = {
  objectType: "CanvasCommand",
  contractVersion: "0.1",
  tenantId,
  projectId,
  packageId,
  canvasSessionId,
  commandId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  commandType: "GENERATE_SHOT",
  requestedByActorId: actorId,
  requestSource: "user",
  approvalId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  payload: {
    shotId,
    readinessId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    prompt: "门店入口讲解招牌套餐",
    referenceAssetIds: [assetId],
  },
  requestId: "req-runtime-command",
  occurredAt,
};

test("runtime binds Origin, Control Session actor and server-only canvas authority before data or commands", async (context) => {
  const database = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  context.after(() => database.destroy());
  await database.schema.createTable("sc_production_packages", (table) => {
    table.increments("recordId");
    table.string("tenantId");
    table.string("externalProjectId");
    table.string("packageId");
    table.integer("internalProjectId");
    table.string("status");
    table.string("acceptedAt");
  });
  await canvasV1Migration.up(database);
  await database("sc_production_packages").insert({
    tenantId,
    externalProjectId: projectId,
    packageId,
    internalProjectId: 42,
    status: "accepted",
    acceptedAt: occurredAt,
  });
  await database("sc_canvas_v1_asset_records").insert({
    assetId,
    tenantId,
    projectId,
    packageId,
    projectionJson: JSON.stringify(asset),
    updatedAt: occurredAt,
  });

  const authority = {
    actorId,
    redemption: { tenantId, projectId, packageId },
    expiresAt: "2099-08-14T03:00:00.000Z",
  } as unknown as PilotCanvasServerAuthority;
  let sessionActorId = actorId;
  const application = express();
  application.use("/api/production/pilot/canvas/v1", createCanvasV1RuntimeRouter({
    database,
    allowedOrigin: origin,
    verifySession: async (cookie) => cookie === "videoagent_session=valid"
      ? {
        actorId: sessionActorId,
        tenantId,
        organizationType: "TENANT",
        roles: ["content_operator"],
        setCookie: "videoagent_session=rotated; Path=/; HttpOnly; SameSite=Lax",
      }
      : null,
    readAuthority: (id) => id === canvasSessionId ? authority : null,
  }));
  const server = http.createServer(application);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api/production/pilot/canvas/v1`;

  const allowed = await fetch(`${baseUrl}/assets`, {
    headers: {
      origin,
      cookie: "videoagent_session=valid",
      "x-canvas-session-id": canvasSessionId,
    },
  });
  assert.equal(allowed.status, 200);
  assert.match(allowed.headers.get("set-cookie") ?? "", /^videoagent_session=rotated;/);
  const allowedText = await allowed.text();
  assert.equal(allowedText.includes("门店讲解员"), true);
  assert.equal(/asset:\/\/|payloadDigest|accessToken|productionPackage/u.test(allowedText), false);

  sessionActorId = "99999999-9999-4999-8999-999999999999";
  const wrongActor = await fetch(`${baseUrl}/assets`, {
    headers: { origin, cookie: "videoagent_session=valid", "x-canvas-session-id": canvasSessionId },
  });
  assert.equal(wrongActor.status, 403);
  assert.equal((await wrongActor.json() as { error: { code: string } }).error.code, "CANVAS_SCOPE_MISMATCH");

  sessionActorId = actorId;
  const wrongOrigin = await fetch(`${baseUrl}/assets`, {
    headers: {
      origin: "https://attacker.example.test",
      cookie: "videoagent_session=valid",
      "x-canvas-session-id": canvasSessionId,
    },
  });
  assert.equal(wrongOrigin.status, 401);

  const blockedHighCost = await fetch(`${baseUrl}/commands`, {
    method: "POST",
    headers: {
      origin,
      cookie: "videoagent_session=valid",
      "content-type": "application/json",
      "x-storycanvas-csrf": "pilot-canvas-v1",
    },
    body: JSON.stringify(generateCommand),
  });
  assert.equal(blockedHighCost.status, 403);
  assert.equal(
    (await blockedHighCost.json() as { error: { code: string } }).error.code,
    "CANVAS_APPROVAL_INVALID",
  );
  assert.equal((await database("sc_canvas_v1_commands")).length, 0);
  assert.equal((await database("sc_canvas_v1_events")).length, 0);
});
