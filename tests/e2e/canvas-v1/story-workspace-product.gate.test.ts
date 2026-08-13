import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
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

test("Control materialization client sends and validates the exact stable attempt envelope", async () => {
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
      return new Response(JSON.stringify(materializationFixture.materializationResponse), {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    },
  });
  assert.deepEqual(
    await client.materialize(materializationFixture.materializationRequest),
    materializationFixture.materializationResponse,
  );
  assert.equal(calls.length, 1);
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
