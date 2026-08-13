import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import express from "express";
import knex from "knex";

import storyCanvasCoreMigration from "../../../../migrations/001_storycanvas_core";
import canvasV1Migration from "../../../../migrations/005_canvas_v1_asset_command";
import type {
  AssetRecordV01,
  CanvasCommandV01,
  ProviderAssetBindingV01,
  ShotReadinessV01,
} from "@/contracts/canvas-v1";
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

test("runtime accepts Chromium same-origin GET provenance without Origin and rejects ambiguous or contradictory provenance", async (context) => {
  const database = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  context.after(() => database.destroy());
  await canvasV1Migration.up(database);
  const authority = {
    actorId,
    redemption: { tenantId, projectId, packageId },
    expiresAt: "2099-08-14T03:00:00.000Z",
  } as unknown as PilotCanvasServerAuthority;
  const application = express();
  application.use("/api/production/pilot/canvas/v1", createCanvasV1RuntimeRouter({
    database,
    allowedOrigin: origin,
    verifySession: async (cookie) => cookie === "videoagent_session=valid"
      ? { actorId, tenantId, organizationType: "TENANT", roles: ["content_operator"] }
      : null,
    readAuthority: (id) => id === canvasSessionId ? authority : null,
    acceptAuthority: async () => 42,
  }));
  const server = http.createServer(application);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api/production/pilot/canvas/v1/assets`;
  const authorityHeaders = {
    cookie: "videoagent_session=valid",
    "x-canvas-session-id": canvasSessionId,
  };

  const chromiumGet = await fetch(url, {
    headers: {
      ...authorityHeaders,
      referer: `${origin}/canvas/${projectId}`,
      "sec-fetch-site": "same-origin",
    },
  });
  assert.equal(chromiumGet.status, 200);

  for (const headers of [
    authorityHeaders,
    { ...authorityHeaders, referer: `${origin}/canvas/${projectId}` },
    { ...authorityHeaders, "sec-fetch-site": "same-origin" },
    { ...authorityHeaders, referer: "https://attacker.example.test/canvas", "sec-fetch-site": "same-origin" },
    { ...authorityHeaders, referer: `${origin}/canvas/${projectId}`, "sec-fetch-site": "cross-site" },
    {
      ...authorityHeaders,
      origin: "https://attacker.example.test",
      referer: `${origin}/canvas/${projectId}`,
      "sec-fetch-site": "same-origin",
    },
  ]) {
    const blocked = await fetch(url, { headers });
    assert.equal(blocked.status, 401);
    assert.equal((await blocked.json() as { error: { code: string } }).error.code, "CANVAS_SESSION_INVALID");
  }
});

test("runtime aggregate wires controlled media into the formal preview route", async (context) => {
  const database = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  context.after(() => database.destroy());
  const authority = {
    actorId,
    redemption: { tenantId, projectId, packageId },
    expiresAt: "2099-08-14T03:00:00.000Z",
  } as unknown as PilotCanvasServerAuthority;
  let opened = 0;
  const application = express();
  application.use("/api/production/pilot/canvas/v1", createCanvasV1RuntimeRouter({
    database,
    allowedOrigin: origin,
    verifySession: async () => ({ actorId, tenantId, organizationType: "TENANT", roles: ["content_operator"] }),
    readAuthority: (id) => id === canvasSessionId ? authority : null,
    acceptAuthority: async () => 42,
    controlledMedia: { open: async (input) => {
      opened += 1;
      assert.equal(input.scope.canvasSessionId, canvasSessionId);
      assert.equal(input.assetId, assetId);
      assert.equal(input.range, "bytes=0-4");
      return {
        status: 206,
        contentType: "video/mp4",
        contentLength: 5,
        contentRange: "bytes 0-4/5",
        acceptRanges: "bytes",
        body: new Response(Buffer.from("video")).body!,
      };
    } },
  }));
  const server = http.createServer(application);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}/api/production/pilot/canvas/v1/media/${assetId}/preview`, {
    headers: { origin, cookie: "videoagent_session=valid", "x-canvas-session-id": canvasSessionId, range: "bytes=0-4" },
  });
  assert.equal(response.status, 206);
  assert.equal(await response.text(), "video");
  assert.equal(response.headers.get("content-range"), "bytes 0-4/5");
  assert.equal(opened, 1);
});

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

test("concurrent exact formal bootstrap opens share prepare and materialization, while failures are evicted", async (context) => {
  const database = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  const projectsRoot = await mkdtemp(path.join(os.tmpdir(), "canvas-runtime-concurrent-bootstrap-"));
  context.after(async () => { await database.destroy(); await rm(projectsRoot, { recursive: true, force: true }); });
  await storyCanvasCoreMigration.up(database);
  await canvasV1Migration.up(database);
  const approvedPackage = {
    scriptVersionId: "44444444-4444-4444-8444-444444444444",
    storyboardVersionId: "55555555-5555-4555-8555-555555555555",
    approvedScript: { content: "欢迎来到门店。" },
    storyboard: [{ shotId, sequence: 1, description: "门店入口讲解", durationSeconds: 6, sourceMode: "generated" }],
  };
  const runtimeAuthority = {
    actorId,
    redemption: { tenantId, projectId, packageId, productionPackage: approvedPackage },
    expiresAt: "2099-08-14T03:00:00.000Z",
  } as unknown as PilotCanvasServerAuthority;
  const workspaceAuthority = {
    objectType: "CanvasWorkspaceAuthority" as const,
    contractVersion: "0.1" as const,
    tenantId,
    projectId,
    packageId,
    canvasSessionId,
    project: { projectName: "门店探店获客视频" },
    approvedScript: { scriptId: approvedPackage.scriptVersionId, version: 3 },
    approvedStoryboard: { storyboardId: approvedPackage.storyboardVersionId, version: 2 },
    assets: [asset],
    completeness: { project: true, approvedScript: true, approvedStoryboard: true, assets: true },
    requestId: "req-workspace-authority",
    occurredAt,
  };
  const materializedBytes = Buffer.from([0xff, 0xd8, 0xff]);
  const materializedChecksum = `sha256:${crypto.createHash("sha256").update(materializedBytes).digest("hex")}`;
  let authorityCalls = 0;
  let materializationCalls = 0;
  let failAuthority = true;
  let releaseAuthority!: () => void;
  let authorityStarted!: () => void;
  let authorityWait = new Promise<void>((resolve) => { releaseAuthority = resolve; });
  let started = new Promise<void>((resolve) => { authorityStarted = resolve; });
  const application = express();
  application.use("/api/production/pilot/canvas/v1", createCanvasV1RuntimeRouter({
    database,
    allowedOrigin: origin,
    verifySession: async () => ({ actorId, tenantId, organizationType: "TENANT", roles: ["content_operator"] }),
    readAuthority: (id) => id === canvasSessionId ? runtimeAuthority : null,
    acceptAuthority: async () => 42,
    now: () => new Date(occurredAt),
    capabilityAvailable: () => false,
    projectsRoot,
    workspaceAuthorityClient: { fetch: async () => {
      authorityCalls += 1;
      authorityStarted();
      await authorityWait;
      if (failAuthority) throw new Error("authority unavailable");
      return workspaceAuthority;
    } },
    assetMaterializationClient: { materialize: async (request) => {
      materializationCalls += 1;
      return {
        objectType: "CanvasAssetMaterialization", contractVersion: "0.1", tenantId, projectId, packageId,
        canvasSessionId, assetId, materializationAttemptId: request.materializationAttemptId,
        materializationId: "19191919-1919-4919-8919-191919191919", category: "virtual_character",
        mimeType: "image/jpeg", byteSize: materializedBytes.byteLength, checksum: materializedChecksum,
        contentEncoding: "base64", contentBase64: materializedBytes.toString("base64"), replayed: false,
        requestId: request.requestId, occurredAt: request.occurredAt,
      };
    } },
  }));
  const server = http.createServer(application);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api/production/pilot/canvas/v1/bootstrap`;
  const headers = {
    cookie: "videoagent_session=valid",
    "x-canvas-session-id": canvasSessionId,
    referer: `${origin}/canvas/${projectId}`,
    "sec-fetch-site": "same-origin",
  };

  const failedFirst = fetch(url, { headers });
  await started;
  const failedReplay = fetch(url, { headers });
  await new Promise<void>((resolve) => setImmediate(resolve));
  releaseAuthority();
  assert.deepEqual((await Promise.all([failedFirst, failedReplay])).map(({ status }) => status), [502, 502]);
  assert.equal(authorityCalls, 1);
  assert.equal(materializationCalls, 0);

  failAuthority = false;
  authorityWait = new Promise<void>((resolve) => { releaseAuthority = resolve; });
  started = new Promise<void>((resolve) => { authorityStarted = resolve; });
  const first = fetch(url, { headers: { ...headers, "x-request-id": "req-formal-first" } });
  await started;
  const replay = fetch(url, { headers: { ...headers, "x-request-id": "req-formal-replay" } });
  const changedScope = await fetch(url, {
    headers: { ...headers, "x-canvas-session-id": "pcs_ZYXWVUTSRQPONMLKJIHGFEDC87654321" },
  });
  assert.equal(changedScope.status, 401);
  await new Promise<void>((resolve) => setImmediate(resolve));
  releaseAuthority();
  const responses = await Promise.all([first, replay]);
  assert.deepEqual(responses.map(({ status }) => status), [200, 200]);
  assert.deepEqual(await responses[0].json(), await responses[1].json());
  assert.equal(authorityCalls, 2);
  assert.equal(materializationCalls, 1);
  for (const table of [
    "sc_canvas_v1_documents", "sc_canvas_v1_requirements", "sc_canvas_v1_readiness",
    "sc_media_assets", "sc_external_mappings",
  ]) assert.equal((await database(table)).length, 1, table);
});

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
    acceptAuthority: async () => 42,
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
  assert.equal(blockedHighCost.status, 409);
  assert.equal(
    (await blockedHighCost.json() as { error: { code: string } }).error.code,
    "CANVAS_SHOT_NOT_READY",
  );
  assert.equal((await database("sc_canvas_v1_commands")).length, 0);
  assert.equal((await database("sc_canvas_v1_events")).length, 0);

  const readiness: ShotReadinessV01 = {
    objectType: "ShotReadiness",
    contractVersion: "0.1",
    tenantId,
    projectId,
    packageId,
    canvasSessionId,
    readinessId: (generateCommand.payload as { readinessId: string }).readinessId,
    shotId,
    ready: true,
    reasonCodes: [],
    script: { scriptId: "44444444-4444-4444-8444-444444444444", version: 3, current: true },
    storyboard: { storyboardId: "55555555-5555-4555-8555-555555555555", version: 2, current: true },
    requirements: [{
      requirementId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      assetId,
      scopeMatched: true,
      rightsStatus: "authorized",
      approvalStatus: "approved",
      providerStatus: "active",
      entityBindingStatus: "approved",
      capabilityAvailable: true,
      ready: true,
      reasonCodes: [],
    }],
    evaluatedAt: occurredAt,
    occurredAt,
  };
  const provider: ProviderAssetBindingV01 = {
    objectType: "ProviderAssetBinding",
    contractVersion: "0.1",
    tenantId,
    projectId,
    packageId,
    canvasSessionId,
    bindingId: "99999999-9999-4999-8999-999999999999",
    assetId,
    provider: "byteplus",
    providerStatus: "active",
    providerAssetId: "server-only-provider-id",
    providerGroupId: "server-only-provider-group",
    assetUri: "asset://server-only-provider-id",
    registeredAt: occurredAt,
    updatedAt: occurredAt,
    occurredAt,
  };
  await database("sc_canvas_v1_readiness").insert({
    readinessId: readiness.readinessId,
    shotId,
    tenantId,
    projectId,
    packageId,
    projectionJson: JSON.stringify(readiness),
    evaluatedAt: occurredAt,
  });
  await database("sc_canvas_v1_provider_bindings").insert({
    bindingId: provider.bindingId,
    assetId,
    tenantId,
    projectId,
    packageId,
    authorityJson: JSON.stringify(provider),
    updatedAt: occurredAt,
  });

  let approvalConsumes = 0;
  let providerStarts = 0;
  const activated = express();
  activated.use("/api/production/pilot/canvas/v1", createCanvasV1RuntimeRouter({
    database,
    allowedOrigin: origin,
    verifySession: async () => ({
      actorId,
      tenantId,
      organizationType: "TENANT",
      roles: ["content_operator"],
    }),
    readAuthority: (id) => id === canvasSessionId ? authority : null,
    acceptAuthority: async () => 42,
    validateApproval: async (command, resolved) => {
      approvalConsumes += 1;
      assert.equal(command.approvalId, generateCommand.approvalId);
      assert.equal(resolved.actorId, actorId);
      return true;
    },
    startShotProduction: async (input) => {
      providerStarts += 1;
      assert.deepEqual(input.referenceAssetUris, ["asset://server-only-provider-id"]);
      return { taskId: "18181818-1818-4818-8818-181818181818" };
    },
  }));
  const activatedServer = http.createServer(activated);
  await new Promise<void>((resolve) => activatedServer.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise<void>((resolve, reject) => {
    activatedServer.close((error) => error ? reject(error) : resolve());
  }));
  const activatedAddress = activatedServer.address();
  assert.ok(activatedAddress && typeof activatedAddress !== "string");
  const activatedUrl = `http://127.0.0.1:${activatedAddress.port}/api/production/pilot/canvas/v1/commands`;
  const headers = {
    origin,
    cookie: "videoagent_session=valid",
    "content-type": "application/json",
    "x-storycanvas-csrf": "pilot-canvas-v1",
  };
  const created = await fetch(activatedUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(generateCommand),
  });
  assert.equal(created.status, 202);
  assert.equal((await created.json() as { event: { status: string } }).event.status, "task_created");
  const replay = await fetch(activatedUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...generateCommand,
      requestId: "req-runtime-command-replay",
    }),
  });
  assert.equal(replay.status, 200);
  assert.equal((await replay.json() as { event: { replayed: boolean } }).event.replayed, true);
  assert.equal(approvalConsumes, 1);
  assert.equal(providerStarts, 1);
});
