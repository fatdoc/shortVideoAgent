import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import knex, { type Knex } from "knex";
import {
  buildRemoteOutputKey,
  registerRemoteOutputAsset,
  RemoteOutputStorageError,
  uploadRemoteOutput,
  type RemoteOutputUpload,
} from "./remoteOutputStorage";

const target = {
  accessKey: "storage-access-secret",
  secretKey: "storage-signing-secret",
  region: "ap-southeast-1",
  bucket: "pilot-output",
  endpoint: "tos.example.test",
  prefix: "tenant-1",
  groupId: "group-1",
};
const scope = {
  projectId: 101,
  taskId: "00000000-0000-4000-8000-000000000001",
  assetId: "00000000-0000-4000-8000-000000000002",
};

let database: Knex | undefined;
afterEach(async () => {
  await database?.destroy();
  database = undefined;
});

async function createDatabase() {
  database = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  await database.schema.createTable("sc_tasks", (table) => {
    table.string("id").primary();
    table.integer("projectId").notNullable();
  });
  await database.schema.createTable("sc_media_assets", (table) => {
    table.string("id").primary();
    table.integer("projectId").notNullable();
    table.string("type").notNullable();
    table.string("source").notNullable();
    table.string("originalName");
    table.string("mimeType").notNullable();
    table.integer("byteSize").notNullable();
    table.string("localPath").notNullable();
    table.string("remoteUrl");
    table.string("provider");
    table.string("prompt");
    table.string("sha256").notNullable();
    table.string("rightsNote");
    table.text("metadataJson").notNullable();
    table.string("createdAt").notNullable();
  });
  return database;
}

test("builds a project/task/asset-scoped key and rejects path traversal", () => {
  assert.equal(
    buildRemoteOutputKey(scope, "image/png", "tenant-1"),
    "tenant-1/storycanvas/projects/101/tasks/00000000-0000-4000-8000-000000000001/assets/00000000-0000-4000-8000-000000000002.png",
  );
  for (const unsafe of [
    { ...scope, projectId: "../other-project" },
    { ...scope, taskId: "/absolute" },
    { ...scope, assetId: "other/asset" },
  ]) {
    assert.throws(
      () => buildRemoteOutputKey(unsafe, "image/png"),
      (error: unknown) => error instanceof RemoteOutputStorageError && error.code === "REMOTE_STORAGE_SCOPE_INVALID",
    );
  }
  assert.throws(() => buildRemoteOutputKey(scope, "image/png", "safe/../escape"), /prefix 不合法/);
});

test("uploads with checksum and retries transient provider failures", async () => {
  let calls = 0;
  const result = await uploadRemoteOutput(scope, Buffer.from("real-image"), "image/png", {
    resolveTarget: async () => target,
    fetch: (async () => {
      calls += 1;
      return new Response("", { status: calls < 3 ? 503 : 200 });
    }) as typeof fetch,
    now: () => new Date("2026-08-05T09:00:00.000Z"),
  });
  assert.equal(calls, 3);
  assert.equal(result.provider, "byteplus-tos");
  assert.equal(result.bucket, "pilot-output");
  assert.equal(result.byteSize, 10);
  assert.equal(result.checksum, "sha256:96e08b6e0f3c0cf23209a9d178b5295fbd29bf3742bd4f893b47f5667d2cc36b");
  assert.equal(result.storageReference, `tos://pilot-output/${result.key}`);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes(target.accessKey), false);
  assert.equal(serialized.includes(target.secretKey), false);
  assert.equal(serialized.includes("X-Tos-Signature"), false);
});

test("sanitizes missing-config and provider errors without leaking credentials or response bodies", async () => {
  await assert.rejects(
    uploadRemoteOutput(scope, Buffer.from("image"), "image/png", {
      resolveTarget: async () => { throw new Error(`missing ${target.secretKey}`); },
    }),
    (error: unknown) => {
      assert.ok(error instanceof RemoteOutputStorageError);
      assert.equal(error.code, "REMOTE_STORAGE_CONFIG_MISSING");
      assert.equal(error.message.includes(target.secretKey), false);
      return true;
    },
  );
  await assert.rejects(
    uploadRemoteOutput(scope, Buffer.from("image"), "image/png", {
      resolveTarget: async () => target,
      fetch: (async () => new Response(`signed-url=${target.secretKey}`, { status: 403 })) as typeof fetch,
    }),
    (error: unknown) => {
      assert.ok(error instanceof RemoteOutputStorageError);
      assert.equal(error.code, "REMOTE_STORAGE_UPLOAD_FAILED");
      assert.equal(error.message.includes(target.secretKey), false);
      return true;
    },
  );
});

test("keeps upload and asset registration independently retryable and enforces task project scope", async () => {
  const db = await createDatabase();
  const upload: RemoteOutputUpload = {
    provider: "byteplus-tos",
    bucket: target.bucket,
    key: buildRemoteOutputKey(scope, "image/png", target.prefix),
    storageReference: `tos://${target.bucket}/${buildRemoteOutputKey(scope, "image/png", target.prefix)}`,
    checksum: "sha256:96e08b6e0f3c0cf23209a9d178b5295fbd29bf3742bd4f893b47f5667d2cc36b",
    mimeType: "image/png",
    byteSize: 10,
    uploadedAt: "2026-08-05T09:00:00.000Z",
  };
  const registration = {
    scope,
    upload,
    type: "image" as const,
    source: "generated" as const,
    provider: "byteplus-seedream",
    model: "seedream-test",
    promptDigest: "sha256:prompt",
  };

  await assert.rejects(
    registerRemoteOutputAsset(db, registration),
    (error: unknown) => error instanceof RemoteOutputStorageError && error.code === "REMOTE_STORAGE_TASK_SCOPE_MISMATCH",
  );
  await db("sc_tasks").insert({ id: scope.taskId, projectId: 999 });
  await assert.rejects(
    registerRemoteOutputAsset(db, registration),
    (error: unknown) => error instanceof RemoteOutputStorageError && error.code === "REMOTE_STORAGE_TASK_SCOPE_MISMATCH",
  );
  await db("sc_tasks").where({ id: scope.taskId }).update({ projectId: scope.projectId });
  assert.deepEqual(await registerRemoteOutputAsset(db, registration), {
    assetId: scope.assetId,
    duplicate: false,
    storageReference: upload.storageReference,
  });
  assert.equal((await registerRemoteOutputAsset(db, registration)).duplicate, true);
  const row = await db("sc_media_assets").where({ id: scope.assetId }).first();
  assert.equal(row.localPath, upload.storageReference);
  assert.equal(row.remoteUrl, null);
  assert.equal(row.sha256, upload.checksum.slice(7));
  const metadata = JSON.parse(row.metadataJson);
  assert.deepEqual(metadata.storage, { provider: "byteplus-tos", bucket: target.bucket, key: upload.key });
});
