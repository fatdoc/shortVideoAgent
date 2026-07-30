import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import knex, { type Knex } from "knex";
import { assertImageReplacementAuthorized } from "./imageReplacementGuard";

let database: Knex;

before(async () => {
  database = knex({
    client: "better-sqlite3",
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
  });
  await database.schema.createTable("sc_tasks", (table) => {
    table.string("id").primary();
    table.integer("projectId").notNullable();
    table.string("taskType").notNullable();
    table.string("status").notNullable();
    table.text("inputJson").notNullable();
    table.text("createdAt").notNullable();
  });
});

after(async () => {
  await database.destroy();
});

test("allows first image generation when the shot has no successful generated image", async () => {
  await assert.doesNotReject(
    assertImageReplacementAuthorized(1, 4, undefined, database),
  );
});

test("requires the latest image task id before replacing an existing image", async () => {
  await database("sc_tasks").insert([
    {
      id: "image-old",
      projectId: 1,
      taskType: "mvp_image_generation",
      status: "succeeded",
      inputJson: JSON.stringify({ kind: "image", shotId: 4 }),
      createdAt: "2026-07-27T08:00:00.000Z",
    },
    {
      id: "image-current",
      projectId: 1,
      taskType: "mvp_image_generation",
      status: "succeeded",
      inputJson: JSON.stringify({ kind: "image", shotId: 4 }),
      createdAt: "2026-07-27T08:10:00.000Z",
    },
  ]);

  await assert.rejects(
    assertImageReplacementAuthorized(1, 4, undefined, database),
    /已有生成图片/,
  );
  await assert.rejects(
    assertImageReplacementAuthorized(1, 4, "image-old", database),
    /确认覆盖并重新生成/,
  );
  await assert.doesNotReject(
    assertImageReplacementAuthorized(1, 4, "image-current", database),
  );
});
