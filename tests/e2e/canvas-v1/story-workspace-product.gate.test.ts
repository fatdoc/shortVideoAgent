import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { CanvasWorkspaceAuthorityRequestV01 } from "../../../apps/storycanvas/src/contracts/canvas-v1/workspaceMaterialization.js";
import * as migrationNamespace from "../../../apps/storycanvas/migrations/005_canvas_v1_asset_command.js";
import * as pilotNamespace from "../../../apps/storycanvas/src/services/storycanvas/pilotCanvasCapability.js";

const pilot = ((pilotNamespace as any).default ?? pilotNamespace) as typeof pilotNamespace;
const canvasV1Migration = ((migrationNamespace as any).default?.default
  ?? (migrationNamespace as any).default
  ?? migrationNamespace) as { up(database: any): Promise<void> };

const rootDir = process.cwd();
const verifiedDepsRoot = process.env.CANVAS_V1_VERIFIED_DEPS_ROOT;
if (!verifiedDepsRoot) throw new Error("CANVAS_V1_VERIFIED_DEPS_ROOT is required");
const requireFromStory = createRequire(path.join(verifiedDepsRoot, "apps/storycanvas/package.json"));
const knex = requireFromStory("knex") as (configuration: Record<string, unknown>) => any;
const contractDir = path.join(rootDir, "docs/program/contracts/canvas-v1");
const authorityFixture = JSON.parse(fs.readFileSync(
  path.join(contractDir, "fixtures/workspace-authority.json"),
  "utf8",
));
const request = authorityFixture.authorityRequest as CanvasWorkspaceAuthorityRequestV01;
const materializationFixture = JSON.parse(fs.readFileSync(
  path.join(contractDir, "fixtures/workspace-materialization.json"),
  "utf8",
));

function codeOf(error: unknown): string | null {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code)
    : null;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
    .join(",")}}`;
}

function approvedPackage() {
  const tenantId = request.tenantId;
  const packageValue: Record<string, unknown> = {
    objectType: "ProjectProductionPackage",
    contractVersion: "0.3",
    status: "ready",
    tenantId,
    projectId: request.projectId,
    packageId: request.packageId,
    idempotencyKey: "cv6-story-workspace-package",
    occurredAt: "2026-08-14T02:00:00.000Z",
    payloadDigest: `sha256:${"0".repeat(64)}`,
    packageVersion: 1,
    organizationId: tenantId,
    scriptVersionId: authorityFixture.authorityResponse.approvedScript.scriptId,
    storyboardVersionId: authorityFixture.authorityResponse.approvedStoryboard.storyboardId,
    approvedScriptDigest: `sha256:${"1".repeat(64)}`,
    approvedStoryboardDigest: `sha256:${"2".repeat(64)}`,
    briefSnapshot: {
      briefVersionId: "10101010-1010-4010-8010-101010101010",
      objective: "门店获客",
      audience: ["附近顾客"],
      platforms: ["douyin"],
    },
    brandPolicySnapshot: {
      facts: [{ factId: "fact-1", text: "真实套餐", sourceReference: "source-1", approved: true }],
      prohibitedTerms: [],
      requiredDisclosures: ["以门店实际为准"],
      sourceDigest: `sha256:${"3".repeat(64)}`,
    },
    approvedScript: {
      scriptVersionId: authorityFixture.authorityResponse.approvedScript.scriptId,
      payloadDigest: `sha256:${"1".repeat(64)}`,
      content: "今天带你探一家适合朋友聚餐的门店，先看招牌套餐。",
      approvedAt: "2026-08-14T01:00:00.000Z",
      approvedBy: request.actorId,
    },
    approvedStoryboard: {
      storyboardVersionId: authorityFixture.authorityResponse.approvedStoryboard.storyboardId,
      scriptVersionId: authorityFixture.authorityResponse.approvedScript.scriptId,
      scriptPayloadDigest: `sha256:${"1".repeat(64)}`,
      payloadDigest: `sha256:${"2".repeat(64)}`,
      approvedAt: "2026-08-14T01:10:00.000Z",
      approvedBy: request.actorId,
    },
    storyboard: [
      {
        shotId: "66666666-6666-4666-8666-666666666666",
        sequence: 1,
        description: "门店讲解员站在明亮入口，向镜头介绍招牌套餐。",
        durationSeconds: 6,
        sourceMode: "uploaded",
      },
      {
        shotId: "67676767-6767-4767-8767-676767676767",
        sequence: 2,
        description: "讲解员展示套餐细节并给出到店提示。",
        durationSeconds: 5,
        sourceMode: "uploaded",
      },
    ],
    target: { aspectRatio: "9:16", durationSeconds: 30, container: "mp4", videoCodec: "h264" },
    capabilityRequirements: ["video.generate", "media.export"],
    createdAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-08-15T00:00:00.000Z",
  };
  packageValue.payloadDigest = `sha256:${crypto.createHash("sha256").update(canonicalJson({
    ...packageValue,
    payloadDigest: undefined,
  })).digest("hex")}`;
  return pilot.parseProjectProductionPackageV03(packageValue);
}

async function database(): Promise<any> {
  const value = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  await canvasV1Migration.up(value);
  await value.schema.createTable("sc_external_mappings", (table: any) => {
    table.string("id").primary(); table.string("system"); table.string("entityType"); table.string("externalId");
    table.string("localId"); table.text("metadataJson"); table.string("createdAt");
  });
  await value.schema.createTable("sc_media_assets", (table: any) => {
    table.string("id").primary(); table.integer("projectId"); table.string("type"); table.string("source");
    table.string("originalName"); table.string("mimeType"); table.integer("byteSize"); table.string("localPath");
    table.string("remoteUrl"); table.string("provider"); table.string("sha256"); table.string("rightsNote");
    table.text("metadataJson"); table.string("createdAt");
  });
  await value.schema.createTable("sc_tasks", (table: any) => {
    table.string("id").primary(); table.integer("projectId"); table.string("status"); table.text("outputJson");
  });
  return value;
}

const scope = {
  tenantId: request.tenantId,
  projectId: request.projectId,
  packageId: request.packageId,
  canvasSessionId: request.canvasSessionId,
  actorId: request.actorId,
  localProjectId: 42,
};

test("Control workspace authority client sends one exact server-only request and rejects response scope drift", async () => {
  const module = await import(
    "../../../apps/storycanvas/src/services/storycanvas/canvas-v1/controlWorkspaceAuthorityClient.js"
  );
  const Client = module.ControlCanvasWorkspaceAuthorityClient;
  assert.equal(typeof Client, "function");

  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new Client({
    controlApiBaseUrl: "https://control.example.test/",
    internalToken: "i".repeat(48),
    fetch: async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(authorityFixture.authorityResponse), {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    },
  });

  assert.deepEqual(await client.fetch(request), authorityFixture.authorityResponse);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://control.example.test/api/v1/internal/canvas-workspace-authorities");
  assert.equal(calls[0]?.init?.method, "POST");
  const headers = new Headers(calls[0]?.init?.headers);
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(headers.get("x-production-plane-internal-token"), "i".repeat(48));
  assert.equal(headers.get("x-request-id"), request.requestId);
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), request);

  const drifted = structuredClone(authorityFixture.authorityResponse);
  drifted.canvasSessionId = "pcs_ZYXWVUTSRQPONMLKJIHGFEDC87654321";
  const rejectingClient = new Client({
    controlApiBaseUrl: "https://control.example.test",
    internalToken: "i".repeat(48),
    fetch: async () => new Response(JSON.stringify(drifted), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    }),
  });
  await assert.rejects(
    () => rejectingClient.fetch(request),
    (error: unknown) => codeOf(error) === "CANVAS_WORKSPACE_AUTHORITY_INVALID_RESPONSE",
  );
});

test("workspace authority dependency failure is fixed and cannot echo internal authority", async () => {
  const module = await import(
    "../../../apps/storycanvas/src/services/storycanvas/canvas-v1/controlWorkspaceAuthorityClient.js"
  );
  const Client = module.ControlCanvasWorkspaceAuthorityClient;
  const marker = "storageReference=/private/root/person.png token=never-echo";
  const client = new Client({
    controlApiBaseUrl: "https://control.example.test",
    internalToken: "i".repeat(48),
    fetch: async () => new Response(marker, {
      status: 503,
      headers: { "content-type": "text/plain", "cache-control": "no-store" },
    }),
  });
  await assert.rejects(async () => client.fetch(request), (error: unknown) => {
    const serialized = `${String(error)} ${JSON.stringify(error)}`.toLowerCase();
    assert.equal(serialized.includes("storagereference"), false);
    assert.equal(serialized.includes("never-echo"), false);
    assert.equal(serialized.includes("/private/root"), false);
    return codeOf(error) === "CANVAS_WORKSPACE_AUTHORITY_DEPENDENCY_UNAVAILABLE";
  });
});

test("Control materialization client retries response loss with the exact stable attempt envelope", async () => {
  const module = await import(
    "../../../apps/storycanvas/src/services/storycanvas/canvas-v1/controlAssetMaterializationClient.js"
  );
  const Client = module.ControlCanvasAssetMaterializationClient;
  assert.equal(typeof Client, "function");
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new Client({
    controlApiBaseUrl: "https://control.example.test/",
    internalToken: "m".repeat(48),
    fetch: async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (calls.length === 1) throw new Error("response lost after dispatch");
      return new Response(JSON.stringify({ ...materializationFixture.materializationResponse, replayed: true }), {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    },
  });
  const replayed = await client.materialize(materializationFixture.materializationRequest);
  assert.equal(replayed.replayed, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.init?.body, calls[1]?.init?.body);
  assert.equal(calls[0]?.url, "https://control.example.test/api/v1/internal/canvas-assets/materializations");
  assert.equal(calls[0]?.init?.method, "POST");
  const headers = new Headers(calls[0]?.init?.headers);
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(headers.get("x-production-plane-internal-token"), "m".repeat(48));
  assert.equal(headers.get("x-request-id"), materializationFixture.materializationRequest.requestId);
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), materializationFixture.materializationRequest);

  const drift = structuredClone(materializationFixture.materializationResponse);
  drift.materializationAttemptId = "20202020-2020-4020-8020-202020202020";
  const rejecting = new Client({
    controlApiBaseUrl: "https://control.example.test",
    internalToken: "m".repeat(48),
    fetch: async () => new Response(JSON.stringify(drift), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    }),
  });
  await assert.rejects(() => rejecting.materialize(materializationFixture.materializationRequest), (error: unknown) => {
    assert.notEqual(codeOf(error), null);
    return true;
  });
});

test("workspace projection is SELECT-only and derives every shot from exact prepared Package facts", async (context) => {
  const [{ CanvasV1WorkspacePreparer }, { CanvasV1WorkspaceReader }] = await Promise.all([
    import("../../../apps/storycanvas/src/services/storycanvas/canvas-v1/workspacePrepare.js"),
    import("../../../apps/storycanvas/src/services/storycanvas/canvas-v1/workspaceProjection.js"),
  ]);
  const db = await database();
  context.after(() => db.destroy());
  const packageValue = approvedPackage();
  const prepared = await new CanvasV1WorkspacePreparer({
    database: db,
    authorityClient: { fetch: async () => structuredClone(authorityFixture.authorityResponse) },
    now: () => new Date("2026-08-14T02:03:00.000Z"),
  }).prepare({ scope, approvedPackage: packageValue, requestId: "req-cv6-projection-prepare" });
  const statements: string[] = [];
  db.on("query", ({ sql }: { sql: string }) => statements.push(sql));
  const workspace = await new CanvasV1WorkspaceReader({
    database: db,
    now: () => new Date("2026-08-14T02:04:00.000Z"),
  }).read({
    scope,
    approvedPackage: packageValue,
    authority: prepared.authority,
    requestId: "req-cv6-workspace-read",
  });
  assert.equal(statements.some((sql) => /^\s*(?:insert|update|delete|replace|alter|drop|create)\b/iu.test(sql)), false);
  assert.deepEqual(workspace.shots.map(({ shotId, sequence, storyboardText }: any) => ({ shotId, sequence, storyboardText })),
    (packageValue.storyboard as any[]).map(({ shotId, sequence, description }) => ({ shotId, sequence, storyboardText: description })));
  assert.equal(workspace.shots.every(({ scriptText }: any) => scriptText === packageValue.approvedScript.content), true);
  assert.equal(workspace.assets.length, prepared.authority.assets.length);
  assert.equal(JSON.stringify(workspace).match(/asset:\/\/|contentBase64|storageReference|providerAssetId|localPath|signedUrl/iu), null);
});

test("formal bootstrap and workspace GET routes authenticate before data and reject request bodies without mutation", async (context) => {
  const express = requireFromStory("express");
  const { createCanvasV1ProductionRouter } = await import(
    "../../../apps/storycanvas/src/routes/production/pilot/canvas/commands/index.js"
  );
  const calls: string[] = [];
  const app = express();
  app.use("/api/production/pilot/canvas/v1", createCanvasV1ProductionRouter({
    resolveRequestScope: async (request: any) => {
      calls.push(`auth:${request.path}`);
      assert.equal(request.header("origin"), "https://story.example.test");
      assert.equal(request.header("cookie"), "session=trusted");
      assert.equal(request.header("x-canvas-session-id"), scope.canvasSessionId);
      return scope;
    },
    commandService: { execute: async () => { throw new Error("not reached"); } },
    assets: { list: async () => [], getReadiness: async () => null },
    documents: { read: async () => null, create: async () => { throw new Error("not reached"); } },
    formalBootstrap: {
      prepare: async () => { calls.push("prepare"); return materializationFixture.workspaceResponse.bootstrap; },
    },
    workspace: {
      read: async () => { calls.push("read"); return materializationFixture.workspaceResponse; },
    },
  }));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/production/pilot/canvas/v1`;
  const headers = {
    origin: "https://story.example.test",
    cookie: "session=trusted",
    "x-canvas-session-id": scope.canvasSessionId,
    "x-request-id": "req-cv6-formal-read",
  };
  for (const endpoint of ["bootstrap", "workspace"] as const) {
    const response = await fetch(`${base}/${endpoint}`, { headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.deepEqual(calls, ["auth:/", "prepare", "auth:/", "read"]);
  const denied = await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const request = http.request(`${base}/workspace`, {
      method: "GET",
      headers: { ...headers, "content-type": "application/json", "content-length": "2" },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => resolve({
        status: response.statusCode ?? 0,
        body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
      }));
    });
    request.on("error", reject);
    request.end("{}");
  });
  assert.equal(denied.status, 422);
  assert.equal(denied.body.error.code, "CANVAS_SCHEMA_INVALID");
  assert.deepEqual(calls, ["auth:/", "prepare", "auth:/", "read"]);
});

test("asset materializer publishes verified bytes atomically and fails changed content without overwriting mapping", async (context) => {
  const { CanvasV1AssetMaterializer } = await import(
    "../../../apps/storycanvas/src/services/storycanvas/canvas-v1/assetMaterialization.js"
  );
  const db = await database();
  const projectsRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "cv6-story-materialization-"));
  context.after(async () => { await db.destroy(); await fs.promises.rm(projectsRoot, { recursive: true, force: true }); });
  const asset = structuredClone(authorityFixture.authorityResponse.assets[0]);
  let changed = false;
  const materializer = new CanvasV1AssetMaterializer({
    database: db,
    projectsRoot,
    now: () => new Date(materializationFixture.materializationRequest.occurredAt),
    client: {
      materialize: async () => changed
        ? { ...structuredClone(materializationFixture.materializationResponse), contentBase64: "/9j/", byteSize: 3,
          mimeType: "image/jpeg", checksum: `sha256:${crypto.createHash("sha256").update(Buffer.from([0xff, 0xd8, 0xff])).digest("hex")}` }
        : structuredClone(materializationFixture.materializationResponse),
    },
  });
  const input = {
    scope,
    asset,
    requestId: materializationFixture.materializationRequest.requestId,
    materializationAttemptId: materializationFixture.materializationRequest.materializationAttemptId,
  };
  const first = await materializer.materialize(input);
  assert.deepEqual(await fs.promises.readFile(first.localPath), Buffer.from(materializationFixture.materializationResponse.contentBase64, "base64"));
  assert.equal((await db("sc_media_assets")).length, 1);
  assert.equal((await db("sc_external_mappings")).length, 1);
  const replay = await materializer.materialize(input);
  assert.equal(replay.localMediaId, first.localMediaId);
  assert.equal(replay.replayed, true);
  changed = true;
  await assert.rejects(() => materializer.materialize(input), (error: unknown) =>
    codeOf(error) === "CANVAS_MATERIALIZATION_CONFLICT");
  assert.deepEqual(await fs.promises.readFile(first.localPath), Buffer.from(materializationFixture.materializationResponse.contentBase64, "base64"));
  assert.equal((await db("sc_media_assets")).length, 1);
  assert.equal((await db("sc_external_mappings")).length, 1);
});

test("controlled media rejects poisoned persisted event and command scopes before signing or fetching", async (context) => {
  const [{ CanvasV1ControlledMediaService }, { buildRemoteOutputKey }] = await Promise.all([
    import("../../../apps/storycanvas/src/services/storycanvas/canvas-v1/controlledMedia.js"),
    import("../../../apps/storycanvas/src/services/storycanvas/remoteOutputStorage.js"),
  ]);
  const target = {
    accessKey: "cv6-access",
    secretKey: "cv6-secret",
    region: "ap-southeast-1",
    bucket: "cv6-controlled-bucket",
    endpoint: "tos.example.test",
    prefix: "pilot",
    groupId: "cv6-group",
  };
  const taskId = "18181818-1818-4818-8818-181818181818";
  const outputAssetId = "13131313-1313-4313-8313-131313131313";
  const commandId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const eventId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  const shotId = "66666666-6666-4666-8666-666666666666";
  const occurredAt = "2026-08-14T02:06:00.000Z";
  const command = {
    objectType: "CanvasCommand", contractVersion: "0.1", tenantId: scope.tenantId, projectId: scope.projectId,
    packageId: scope.packageId, canvasSessionId: scope.canvasSessionId, commandId, commandType: "GENERATE_SHOT",
    requestedByActorId: scope.actorId, requestSource: "user", approvalId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    payload: { shotId, readinessId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", prompt: "门店入口", referenceAssetIds: [authorityFixture.authorityResponse.assets[0].assetId] },
    requestId: "req-cv6-controlled-command", occurredAt,
  };
  const event = {
    objectType: "CanvasEvent", contractVersion: "0.1", tenantId: scope.tenantId, projectId: scope.projectId,
    packageId: scope.packageId, canvasSessionId: scope.canvasSessionId, eventId, commandId, commandType: "GENERATE_SHOT",
    status: "task_created", providerSubmitted: true, taskCreated: true, outputRegistered: false, receiptRecorded: false,
    taskId, outputAssetId: null, receiptId: null, replayed: false, error: null,
    requestId: "req-cv6-controlled-command", occurredAt,
  };
  for (const poison of [
    { table: "sc_canvas_v1_events", column: "eventJson", value: { ...event, projectId: "99999999-9999-4999-8999-999999999999" } },
    { table: "sc_canvas_v1_commands", column: "commandJson", value: { ...command, requestedByActorId: "99999999-9999-4999-8999-999999999999" } },
  ] as const) {
    const db = await database();
    context.after(() => db.destroy());
    const key = buildRemoteOutputKey({ projectId: scope.localProjectId, taskId, assetId: outputAssetId }, "video/mp4", target.prefix);
    await db("sc_tasks").insert({ id: taskId, projectId: scope.localProjectId, status: "succeeded", outputJson: JSON.stringify({ outputAssetId }) });
    await db("sc_media_assets").insert({
      id: outputAssetId, projectId: scope.localProjectId, type: "video", source: "generated", mimeType: "video/mp4",
      localPath: `tos://${target.bucket}/${key}`, metadataJson: JSON.stringify({ taskId, storage: { provider: "byteplus-tos", bucket: target.bucket, key } }),
    });
    await db("sc_canvas_v1_commands").insert({
      commandId, tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId,
      canvasSessionId: scope.canvasSessionId, commandType: "GENERATE_SHOT", payloadDigest: "cv6-digest",
      commandJson: JSON.stringify(command), resultEventJson: JSON.stringify(event), createdAt: occurredAt, updatedAt: occurredAt,
    });
    await db("sc_canvas_v1_events").insert({
      eventId, commandId, tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId,
      canvasSessionId: scope.canvasSessionId, status: "task_created", eventJson: JSON.stringify(event), createdAt: occurredAt,
    });
    await db(poison.table).update({ [poison.column]: JSON.stringify(poison.value) });
    let signed = 0;
    let fetched = 0;
    const service = new CanvasV1ControlledMediaService({
      database: db,
      resolveTarget: async () => target,
      signGet: () => { signed += 1; return "https://bucket.example.test/private?X-Tos-Signature=secret"; },
      fetch: async () => { fetched += 1; return new Response(Buffer.from("video"), { status: 200, headers: { "content-type": "video/mp4" } }); },
    });
    await assert.rejects(() => service.open({ scope, assetId: outputAssetId }), (error: unknown) =>
      codeOf(error) === "CANVAS_MEDIA_NOT_FOUND", `${poison.table} poisoned authority must fail closed`);
    assert.equal(signed, 0, `${poison.table} must fail before signing`);
    assert.equal(fetched, 0, `${poison.table} must fail before object storage`);
  }
});

test("trusted prepare is idempotent and creates exact UUIDv5 requirements and storyboard prompts", async (context) => {
  const module = await import(
    "../../../apps/storycanvas/src/services/storycanvas/canvas-v1/workspacePrepare.js"
  );
  const db = await database();
  context.after(() => db.destroy());
  const authorityCalls: CanvasWorkspaceAuthorityRequestV01[] = [];
  const preparer = new module.CanvasV1WorkspacePreparer({
    database: db,
    authorityClient: {
      fetch: async (authorityRequest: CanvasWorkspaceAuthorityRequestV01) => {
        authorityCalls.push(structuredClone(authorityRequest));
        return structuredClone(authorityFixture.authorityResponse);
      },
    },
    now: () => new Date("2026-08-14T02:03:00.000Z"),
  });
  const input = {
    scope,
    approvedPackage: approvedPackage(),
    requestId: authorityFixture.authorityRequest.requestId,
  };
  const first = await preparer.prepare(input);
  const replay = await preparer.prepare(input);
  assert.deepEqual(replay, first);
  assert.equal(authorityCalls.length, 2);
  for (const call of authorityCalls) assert.deepEqual(call, authorityFixture.authorityRequest);
  assert.equal(first.authority.assets.filter(({ category }: { category: string }) => category === "virtual_character").length, 1);
  assert.equal(first.document.shots.length, 2);
  assert.deepEqual(first.document.shots.map(({ prompt }: { prompt: string }) => prompt), [
    "门店讲解员站在明亮入口，向镜头介绍招牌套餐。",
    "讲解员展示套餐细节并给出到店提示。",
  ]);
  assert.deepEqual(first.document.playlist.shotIds, [
    "66666666-6666-4666-8666-666666666666",
    "67676767-6767-4767-8767-676767676767",
  ]);
  assert.equal(await db("sc_canvas_v1_documents").count({ count: "*" }).first().then((row) => Number(row?.count)), 1);
  assert.equal(await db("sc_canvas_v1_requirements").count({ count: "*" }).first().then((row) => Number(row?.count)), 2);
  assert.equal(await db("sc_canvas_v1_readiness").count({ count: "*" }).first().then((row) => Number(row?.count)), 2);
  const requirements = await db("sc_canvas_v1_requirements").orderBy("shotId");
  assert.deepEqual(requirements.map(({ requirementId }) => requirementId), [
    "a1795f30-1ab9-5faf-8c6a-14533f30b29f",
    "854d0236-bed8-5153-866b-6c6368f398cd",
  ]);
});

test("casting missing or ambiguous and transactional failure leave every trusted prepare table unchanged", async (context) => {
  const module = await import(
    "../../../apps/storycanvas/src/services/storycanvas/canvas-v1/workspacePrepare.js"
  );
  const databases: any[] = [];
  context.after(async () => Promise.all(databases.map((db) => db.destroy())));
  const tables = [
    "sc_canvas_v1_asset_records",
    "sc_canvas_v1_documents",
    "sc_canvas_v1_requirements",
    "sc_canvas_v1_readiness",
    "sc_canvas_v1_entity_bindings",
  ];
  const variants = [
    { code: "PRIMARY_VIRTUAL_CHARACTER_MISSING", assets: [] },
    {
      code: "PRIMARY_VIRTUAL_CHARACTER_AMBIGUOUS",
      assets: [
        authorityFixture.authorityResponse.assets[0],
        { ...authorityFixture.authorityResponse.assets[0], assetId: "89898989-8989-4989-8989-898989898989" },
      ],
    },
  ];
  for (const variant of variants) {
    const db = await database();
    databases.push(db);
    const preparer = new module.CanvasV1WorkspacePreparer({
      database: db,
      authorityClient: {
        fetch: async () => ({ ...structuredClone(authorityFixture.authorityResponse), assets: variant.assets }),
      },
      now: () => new Date("2026-08-14T02:03:00.000Z"),
    });
    await assert.rejects(
      () => preparer.prepare({
        scope,
        approvedPackage: approvedPackage(),
        requestId: authorityFixture.authorityRequest.requestId,
      }),
      (error: unknown) => codeOf(error) === variant.code,
    );
    for (const table of tables) {
      assert.equal(await db(table).count({ count: "*" }).first().then((row) => Number(row?.count)), 0, `${variant.code}:${table}`);
    }
  }

  const rollbackDb = await database();
  databases.push(rollbackDb);
  await rollbackDb.raw(`
    CREATE TRIGGER cv6_force_readiness_failure
    BEFORE INSERT ON sc_canvas_v1_readiness
    BEGIN SELECT RAISE(ABORT, 'fixed-cv6-failure'); END
  `);
  const rollbackPreparer = new module.CanvasV1WorkspacePreparer({
    database: rollbackDb,
    authorityClient: { fetch: async () => structuredClone(authorityFixture.authorityResponse) },
    now: () => new Date("2026-08-14T02:03:00.000Z"),
  });
  await assert.rejects(() => rollbackPreparer.prepare({
    scope,
    approvedPackage: approvedPackage(),
    requestId: authorityFixture.authorityRequest.requestId,
  }));
  for (const table of tables) {
    assert.equal(await rollbackDb(table).count({ count: "*" }).first().then((row) => Number(row?.count)), 0, `rollback:${table}`);
  }
});

test("all frozen Story G5 runtime modules are importable through their public exports", async () => {
  const surfaces = [
    ["../../../apps/storycanvas/src/services/storycanvas/canvas-v1/workspacePrepare.js", "CanvasV1WorkspacePreparer"],
    ["../../../apps/storycanvas/src/services/storycanvas/canvas-v1/workspaceProjection.js", "CanvasV1WorkspaceReader"],
    ["../../../apps/storycanvas/src/services/storycanvas/canvas-v1/controlAssetMaterializationClient.js", "ControlCanvasAssetMaterializationClient"],
    ["../../../apps/storycanvas/src/services/storycanvas/canvas-v1/assetMaterialization.js", "CanvasV1AssetMaterializer"],
    ["../../../apps/storycanvas/src/services/storycanvas/canvas-v1/controlledMedia.js", "CanvasV1ControlledMediaService"],
    ["../../../apps/storycanvas/src/routes/production/pilot/canvas/bootstrap-v1/index.js", "createCanvasV1FormalBootstrapRouter"],
    ["../../../apps/storycanvas/src/routes/production/pilot/canvas/workspace/index.js", "createCanvasV1WorkspaceRouter"],
    ["../../../apps/storycanvas/src/routes/production/pilot/canvas/media/index.js", "createCanvasV1MediaRouter"],
  ] as const;
  for (const [modulePath, exportName] of surfaces) {
    const module = await import(modulePath);
    assert.equal(typeof module[exportName], "function", `${modulePath}#${exportName}`);
  }
});
