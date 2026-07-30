import assert from "node:assert/strict";
import { test } from "node:test";
import knex, { type Knex } from "knex";
import { runStoryCanvasMigrations } from "@/lib/storycanvasMigrations";
import {
  getMvpContinuityWorkspace,
  resolveMvpShotContext,
  updateMvpShotContinuity,
} from "./continuityMemory";

async function createDatabase(): Promise<Knex> {
  const database = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  await database.raw("PRAGMA foreign_keys = ON");
  for (const tableName of ["o_project", "o_script", "o_storyboard", "o_image", "o_video"]) {
    await database.schema.createTable(tableName, (table) => table.integer("id").primary());
  }
  await database("o_project").insert({ id: 1 });
  await runStoryCanvasMigrations(database);
  return database;
}

test("seeds entity memory and resolves shot state from the event ledger", async (context) => {
  const database = await createDatabase();
  context.after(() => database.destroy());
  const workspace = await getMvpContinuityWorkspace(1, database);

  assert.equal(workspace.profile.revision, 1);
  assert.equal(workspace.entities.length, 6);
  assert.equal(Object.keys(workspace.shots).length, 5);
  assert.equal(workspace.shots["4"].stateAtStart["coffee-cup-a.fillLevel"], 0.9);
  assert.deepEqual(workspace.shots["4"].errors, []);
  assert.deepEqual(
    workspace.shots["4"].entities.map((entity) => entity?.slug),
    ["customer", "cafe-interior", "coffee-cup-a"],
  );

  const resolved = await resolveMvpShotContext(1, 4, "女生端起咖啡轻抿后微笑", database);
  assert.match(resolved.resolvedPrompt, /咖啡杯 A/);
  assert.match(resolved.resolvedPrompt, /same-scene-cut/);
  assert.equal(resolved.references.length, 3);
});

test("updates shot inheritance and cut policy with a new world revision", async (context) => {
  const database = await createDatabase();
  context.after(() => database.destroy());
  const workspace = await updateMvpShotContinuity(1, 4, {
    entitySlugs: ["customer", "coffee-cup-a"],
    relationType: "continuous-action",
    preserve: ["人物姿态", "杯子状态"],
    matchOn: "action",
    usePreviousEndFrame: true,
  }, database);

  assert.equal(workspace.profile.revision, 2);
  assert.deepEqual(workspace.shots["4"].contract.entitySlugs, ["customer", "coffee-cup-a"]);
  assert.equal(workspace.shots["4"].relation?.relationType, "continuous-action");
  assert.equal(workspace.shots["4"].relation?.usePreviousEndFrame, true);
  await assert.rejects(
    () => updateMvpShotContinuity(1, 4, { entitySlugs: ["missing-memory"] }, database),
    /不存在/,
  );
  await assert.rejects(
    () => updateMvpShotContinuity(1, 4, {
      relationType: "same-scene-cut",
      usePreviousEndFrame: true,
    }, database),
    /只有连续动作镜头/,
  );
});

test("seeds project-scoped memory without cross-project identifier collisions", async (context) => {
  const database = await createDatabase();
  context.after(() => database.destroy());
  await database("o_project").insert({ id: 2 });

  const first = await getMvpContinuityWorkspace(1, database);
  const second = await getMvpContinuityWorkspace(2, database);

  assert.notEqual(first.profile.id, second.profile.id);
  assert.notEqual(first.entities[0].id, second.entities[0].id);
  assert.equal((await database("sc_entities")).length, 12);
});
