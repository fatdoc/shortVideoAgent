import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import knex from "knex";

import { resolveProjectMediaPath } from "../projectMedia";
import type { CanvasProductionScope } from "../assets-v1";
import {
  CanvasV1LocalOutputError,
  persistLocalCanvasOutput,
} from "./localOutputStorage";

const scope: CanvasProductionScope = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  packageId: "33333333-3333-4333-8333-333333333333",
  canvasSessionId: "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678",
  actorId: "12121212-1212-4212-8212-121212121212",
  localProjectId: 42,
};
const taskId = "18181818-1818-4818-8818-181818181818";
const assetId = "19191919-1919-4919-8919-191919191919";

async function database() {
  const db = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  await db.schema.createTable("sc_tasks", (table) => {
    table.string("id").primary();
    table.integer("projectId").notNullable();
  });
  await db.schema.createTable("sc_media_assets", (table) => {
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
  return db;
}

test("persists a generated Canvas output under the controlled project root and replays exactly", async (context) => {
  const db = await database();
  const projectsRoot = await mkdtemp(path.join(os.tmpdir(), "canvas-v1-local-output-"));
  context.after(async () => { await db.destroy(); await rm(projectsRoot, { recursive: true, force: true }); });
  await db("sc_tasks").insert({ id: taskId, projectId: scope.localProjectId });
  const content = Buffer.from("platform-generated-video");
  const input = {
    database: db,
    scope,
    taskId,
    assetId,
    content,
    mimeType: "video/mp4" as const,
    projectsRoot,
    now: () => new Date("2026-08-14T12:00:00.000Z"),
  };

  const first = await persistLocalCanvasOutput(input);
  const expectedPath = resolveProjectMediaPath(scope.localProjectId, "videos", assetId, "mp4", projectsRoot);
  assert.deepEqual(first, { outputAssetId: assetId, duplicate: false, localPath: expectedPath });
  assert.deepEqual(await readFile(expectedPath), content);
  assert.equal((await stat(expectedPath)).mode & 0o777, 0o600);

  const row = await db("sc_media_assets").where({ id: assetId }).first();
  assert.equal(row.localPath, expectedPath);
  assert.equal(row.remoteUrl, null);
  assert.equal(row.mimeType, "video/mp4");
  assert.equal(row.byteSize, content.byteLength);
  assert.equal(JSON.parse(row.metadataJson).storage.provider, "storycanvas-local");
  assert.equal(String(row.metadataJson).includes(projectsRoot), false);

  assert.deepEqual(await persistLocalCanvasOutput(input), {
    outputAssetId: assetId,
    duplicate: true,
    localPath: expectedPath,
  });
  await assert.rejects(
    () => persistLocalCanvasOutput({ ...input, content: Buffer.from("changed-payload") }),
    (error: unknown) => error instanceof CanvasV1LocalOutputError && error.code === "LOCAL_OUTPUT_CONFLICT",
  );
  assert.deepEqual(await readFile(expectedPath), content);
});

test("rejects task scope drift before creating a local file", async (context) => {
  const db = await database();
  const projectsRoot = await mkdtemp(path.join(os.tmpdir(), "canvas-v1-local-output-scope-"));
  context.after(async () => { await db.destroy(); await rm(projectsRoot, { recursive: true, force: true }); });
  await db("sc_tasks").insert({ id: taskId, projectId: 999 });
  await assert.rejects(
    () => persistLocalCanvasOutput({
      database: db,
      scope,
      taskId,
      assetId,
      content: Buffer.from("video"),
      mimeType: "video/mp4",
      projectsRoot,
    }),
    (error: unknown) => error instanceof CanvasV1LocalOutputError && error.code === "LOCAL_OUTPUT_TASK_SCOPE_MISMATCH",
  );
  await assert.rejects(() => stat(resolveProjectMediaPath(scope.localProjectId, "videos", assetId, "mp4", projectsRoot)));
});
