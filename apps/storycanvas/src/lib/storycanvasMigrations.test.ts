import assert from "node:assert/strict";
import { test } from "node:test";
import knex, { type Knex } from "knex";
import coreMigration from "../../migrations/001_storycanvas_core";
import { rollbackLatestStoryCanvasMigration, runStoryCanvasMigrations } from "./storycanvasMigrations";

async function createDatabase(): Promise<Knex> {
  const database = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  await database.raw("PRAGMA foreign_keys = ON");
  for (const tableName of ["o_project", "o_script", "o_storyboard", "o_image", "o_video"]) {
    await database.schema.createTable(tableName, (table) => table.integer("id").primary());
  }
  return database;
}

async function storyCanvasTables(database: Knex): Promise<string[]> {
  const result = await database.raw("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'sc_%' ORDER BY name");
  return result.map((row: { name: string }) => row.name);
}

test("StoryCanvas migrations create the core and continuity tables idempotently", async (context) => {
  const database = await createDatabase();
  context.after(() => database.destroy());
  assert.deepEqual(await runStoryCanvasMigrations(database), [
    "001_storycanvas_core",
    "002_storycanvas_continuity_memory",
    "003_storycanvas_production_contract",
  ]);
  assert.equal((await storyCanvasTables(database)).length, 23);
  assert.deepEqual(await runStoryCanvasMigrations(database), []);
  assert.equal((await database("sc_migrations")).length, 3);
});

test("checksum drift is rejected", async (context) => {
  const database = await createDatabase();
  context.after(() => database.destroy());
  await runStoryCanvasMigrations(database);
  await assert.rejects(
    () => runStoryCanvasMigrations(database, [{ ...coreMigration, checksum: "0".repeat(64) }]),
    /checksum 不一致/,
  );
});

test("rollback removes StoryCanvas domain tables without touching upstream tables", async (context) => {
  const database = await createDatabase();
  context.after(() => database.destroy());
  await runStoryCanvasMigrations(database);
  assert.equal(await rollbackLatestStoryCanvasMigration(database), "003_storycanvas_production_contract");
  assert.equal((await storyCanvasTables(database)).length, 19);
  assert.equal(await rollbackLatestStoryCanvasMigration(database), "002_storycanvas_continuity_memory");
  assert.equal((await storyCanvasTables(database)).length, 11);
  assert.equal(await rollbackLatestStoryCanvasMigration(database), "001_storycanvas_core");
  assert.deepEqual(await storyCanvasTables(database), ["sc_migrations"]);
  for (const tableName of ["o_project", "o_script", "o_storyboard", "o_image", "o_video"]) {
    assert.equal(await database.schema.hasTable(tableName), true);
  }
});

test("failed migrations roll back their schema and registry row", async (context) => {
  const database = await createDatabase();
  context.after(() => database.destroy());
  const failingMigration = {
    version: "999_failure_probe",
    checksum: "f".repeat(64),
    up: async (transaction: Knex) => {
      await transaction.schema.createTable("sc_failure_probe", (table) => table.string("id"));
      throw new Error("probe failure");
    },
    down: async (transaction: Knex) => transaction.schema.dropTableIfExists("sc_failure_probe"),
  };
  await assert.rejects(() => runStoryCanvasMigrations(database, [failingMigration]), /probe failure/);
  assert.equal(await database.schema.hasTable("sc_failure_probe"), false);
  assert.equal((await database("sc_migrations").where({ version: failingMigration.version })).length, 0);
});
