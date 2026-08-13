import assert from "node:assert/strict";
import { test } from "node:test";
import knex, { type Knex } from "knex";

import type { CanvasCommandV01, ShotReadinessV01 } from "@/contracts/canvas-v1";
import migration from "../../../../migrations/005_canvas_v1_asset_command";
import {
  CanvasCommandService,
  CanvasCommandServiceError,
  type CanvasCommandServiceOptions,
} from "./canvasCommandService";
import { CanvasDocumentStore } from "./documentStore";

const scope = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  packageId: "33333333-3333-4333-8333-333333333333",
  canvasSessionId: "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678",
  actorId: "12121212-1212-4212-8212-121212121212",
  localProjectId: 42,
} as const;
const occurredAt = "2026-08-14T02:02:00.000Z";
const documentId = "77777777-7777-4777-8777-777777777777";
const shotId = "66666666-6666-4666-8666-666666666666";
const assetId = "88888888-8888-4888-8888-888888888888";

async function database(): Promise<Knex> {
  const value = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  await migration.up(value);
  return value;
}

function command(overrides: Partial<CanvasCommandV01> = {}): CanvasCommandV01 {
  return {
    objectType: "CanvasCommand",
    contractVersion: "0.1",
    tenantId: scope.tenantId,
    projectId: scope.projectId,
    packageId: scope.packageId,
    canvasSessionId: scope.canvasSessionId,
    commandId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    commandType: "GENERATE_SHOT",
    requestedByActorId: scope.actorId,
    requestSource: "user",
    approvalId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    payload: {
      shotId,
      readinessId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      prompt: "店员在门店入口介绍招牌套餐，镜头稳定。",
      referenceAssetIds: [assetId],
    },
    requestId: "req-canvas-command-001",
    occurredAt,
    ...overrides,
  };
}

function readiness(overrides: Partial<ShotReadinessV01> = {}): ShotReadinessV01 {
  return {
    objectType: "ShotReadiness",
    contractVersion: "0.1",
    tenantId: scope.tenantId,
    projectId: scope.projectId,
    packageId: scope.packageId,
    canvasSessionId: scope.canvasSessionId,
    readinessId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
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
    ...overrides,
  };
}

function options(db: Knex, overrides: Partial<CanvasCommandServiceOptions> = {}): CanvasCommandServiceOptions {
  return {
    database: db,
    resolveScope: async () => scope,
    validateApproval: async () => true,
    getReadiness: async () => readiness(),
    resolveProviderAssetUris: async () => ["asset://provider-asset-server-only-001"],
    startShotProduction: async () => ({ taskId: "18181818-1818-4818-8818-181818181818" }),
    now: () => new Date(occurredAt),
    randomId: (() => {
      const ids = [
        "ffffffff-ffff-4fff-8fff-ffffffffffff",
        "18181818-1818-4818-8818-181818181818",
        "19191919-1919-4919-8919-191919191919",
      ];
      return () => ids.shift() ?? "20202020-2020-4020-8020-202020202020";
    })(),
    ...overrides,
  };
}

test("same scope/same payload replays persisted truth; changed payload conflicts before a provider side effect", async (context) => {
  const db = await database();
  context.after(() => db.destroy());
  let starts = 0;
  const service = new CanvasCommandService(options(db, {
    startShotProduction: async (input) => {
      starts += 1;
      assert.deepEqual(input.referenceAssetUris, ["asset://provider-asset-server-only-001"]);
      assert.equal(JSON.stringify(input).includes("asset://"), true);
      return { taskId: "18181818-1818-4818-8818-181818181818" };
    },
  }));

  const first = await service.execute(command());
  const replay = await service.execute(command({
    commandId: "21212121-2121-4121-8121-212121212121",
    requestId: "req-canvas-command-replay",
    occurredAt: "2026-08-14T02:02:01.000Z",
  }));
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.eventId, first.eventId);
  assert.equal(starts, 1);

  const changed = command({
    commandId: "22222222-2222-4222-8222-222222222222",
    payload: { ...(command().payload as Extract<CanvasCommandV01["payload"], { prompt: string }>), prompt: "changed prompt" },
  });
  await assert.rejects(
    () => service.execute(changed),
    (error: unknown) => error instanceof CanvasCommandServiceError && error.code === "CANVAS_COMMAND_IDEMPOTENCY_CONFLICT",
  );
  assert.equal(starts, 1);
});

test("rights/provider/entity/readiness and exact scope block generation without tasks, events or usage facts", async (context) => {
  const variants: Array<[Partial<ShotReadinessV01>, string]> = [
    [{ ready: false, reasonCodes: ["RIGHTS_REVOKED"] }, "CANVAS_RIGHTS_NOT_AUTHORIZED"],
    [{ ready: false, reasonCodes: ["PROVIDER_PROCESSING"] }, "CANVAS_PROVIDER_NOT_ACTIVE"],
    [{ ready: false, reasonCodes: ["ENTITY_BINDING_MISSING"] }, "CANVAS_ENTITY_BINDING_NOT_APPROVED"],
  ];

  for (const [readinessOverride, expected] of variants) {
    const db = await database();
    context.after(() => db.destroy());
    let starts = 0;
    const service = new CanvasCommandService(options(db, {
      getReadiness: async () => readiness(readinessOverride),
      startShotProduction: async () => { starts += 1; return { taskId: "18181818-1818-4818-8818-181818181818" }; },
    }));
    await assert.rejects(
      () => service.execute(command()),
      (error: unknown) => error instanceof CanvasCommandServiceError && error.code === expected,
    );
    assert.equal(starts, 0);
    assert.equal((await db("sc_canvas_v1_commands")).length, 0);
    assert.equal((await db("sc_canvas_v1_events")).length, 0);
  }

  const db = await database();
  context.after(() => db.destroy());
  const service = new CanvasCommandService(options(db, {
    resolveScope: async () => { throw new CanvasCommandServiceError("CANVAS_SCOPE_MISMATCH"); },
  }));
  await assert.rejects(() => service.execute(command()), (error: unknown) => error instanceof CanvasCommandServiceError && error.code === "CANVAS_SCOPE_MISMATCH");
  assert.equal((await db("sc_canvas_v1_commands")).length, 0);
});

test("document saves use stable ownership, optimistic versioning and recover through a rotated valid session", async (context) => {
  const db = await database();
  context.after(() => db.destroy());
  const store = new CanvasDocumentStore({ database: db, now: () => new Date(occurredAt) });
  const created = await store.create({
    scope,
    documentId,
    shots: [{ shotId, position: 0, selectedOutputAssetId: null, prompt: "original", updatedAt: occurredAt }],
    playlist: { shotIds: [shotId] },
  });
  assert.equal(created.version, 1);

  const saved = await store.save({
    scope,
    documentId,
    expectedVersion: 1,
    shots: [{ ...created.shots[0], prompt: "saved after refresh" }],
    playlist: created.playlist,
  });
  assert.equal(saved.version, 2);
  await assert.rejects(
    () => store.save({ ...saved, scope, documentId, expectedVersion: 1 }),
    (error: unknown) => error instanceof CanvasCommandServiceError && error.code === "CANVAS_DOCUMENT_VERSION_CONFLICT",
  );

  const rotated = await store.read({
    scope: { ...scope, canvasSessionId: "pcs_ZYXWVUTSRQPONMLKJIHGFEDC87654321" },
    documentId,
  });
  assert.equal(rotated?.version, 2);
  assert.equal(rotated?.canvasSessionId, "pcs_ZYXWVUTSRQPONMLKJIHGFEDC87654321");
  assert.equal(rotated?.shots[0].prompt, "saved after refresh");
});

test("public errors and persisted events never expose provider URI, token, digest, grant or raw provider body", async (context) => {
  const db = await database();
  context.after(() => db.destroy());
  const secret = "asset://private bearer token payloadDigest ProjectGrant provider raw body";
  const service = new CanvasCommandService(options(db, {
    startShotProduction: async () => { throw new Error(secret); },
  }));
  await assert.rejects(
    () => service.execute(command()),
    (error: unknown) => {
      assert.equal(error instanceof CanvasCommandServiceError, true);
      assert.equal(JSON.stringify(error).includes(secret), false);
      assert.equal((error as Error).message.includes("asset://"), false);
      return true;
    },
  );
  const serialized = JSON.stringify(await db("sc_canvas_v1_events"));
  assert.equal(serialized.includes("asset://"), false);
  assert.equal(/bearer|payloadDigest|ProjectGrant|provider raw/iu.test(serialized), false);
});
