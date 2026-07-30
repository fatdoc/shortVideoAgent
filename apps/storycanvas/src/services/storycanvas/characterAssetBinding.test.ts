import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import knex, { type Knex } from "knex";
import {
  assertTrustedCharacterBindings,
  persistCharacterAssetBinding,
} from "./characterAssetBinding";

let database: Knex;

before(async () => {
  database = knex({
    client: "better-sqlite3",
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
  });
  await database.schema.createTable("sc_entities", (table) => {
    table.string("id").primary();
    table.text("canonicalJson").notNullable();
    table.text("updatedAt").notNullable();
  });
  await database.schema.createTable("sc_reference_bindings", (table) => {
    table.string("id").primary();
    table.integer("projectId").notNullable();
    table.string("entityId").notNullable();
    table.integer("shotId");
    table.string("role").notNullable();
    table.string("assetId");
    table.text("sourceUri").notNullable();
    table.string("view");
    table.integer("priority").notNullable();
    table.boolean("approved").notNullable();
    table.text("createdAt").notNullable();
  });
  await database.schema.createTable("sc_continuity_profiles", (table) => {
    table.integer("projectId").primary();
    table.integer("revision").notNullable();
    table.text("updatedAt").notNullable();
  });
  await database.schema.createTable("sc_shot_contracts", (table) => {
    table.integer("projectId").notNullable();
    table.integer("shotId").notNullable();
    table.integer("worldRevision").notNullable();
    table.text("updatedAt").notNullable();
  });
});

after(async () => {
  await database.destroy();
});

test("binds an approved character asset and advances the world revision atomically", async () => {
  await database("sc_entities").insert({
    id: "customer",
    canonicalJson: JSON.stringify({ description: "顾客女生" }),
    updatedAt: "before",
  });
  await database("sc_continuity_profiles").insert({
    projectId: 1,
    revision: 7,
    updatedAt: "before",
  });
  await database("sc_shot_contracts").insert({
    projectId: 1,
    shotId: 4,
    worldRevision: 7,
    updatedAt: "before",
  });

  await persistCharacterAssetBinding(database, {
    projectId: 1,
    entityId: "customer",
    canonical: { description: "顾客女生" },
    assetId: "character-local",
    assetLocalPath: "/characters/customer.jpg",
    remoteAssetId: "asset-approved",
    assetUri: "asset://asset-approved",
    characterProfile: { name: "王彤" },
    referenceId: "character-reference",
    timestamp: "2026-07-27T09:00:00.000Z",
  });

  const entity = await database("sc_entities").where({ id: "customer" }).first();
  const canonical = JSON.parse(entity.canonicalJson);
  assert.equal(canonical.characterAssetId, "character-local");
  assert.equal(canonical.assetUri, "asset://asset-approved");
  assert.equal(canonical.characterProfile.name, "王彤");

  const reference = await database("sc_reference_bindings").where({ entityId: "customer" }).first();
  assert.equal(reference.assetId, "character-local");
  assert.equal(reference.sourceUri, "oss:/characters/customer.jpg");
  assert.equal(reference.approved, 1);
  assert.equal(reference.priority, 120);

  assert.equal(
    (await database("sc_continuity_profiles").where({ projectId: 1 }).first()).revision,
    8,
  );
  assert.equal(
    (await database("sc_shot_contracts").where({ projectId: 1, shotId: 4 }).first()).worldRevision,
    8,
  );
});

test("blocks video submission when a shot character has no trusted asset binding", () => {
  assert.doesNotThrow(() => assertTrustedCharacterBindings(4, []));
  assert.throws(
    () => assertTrustedCharacterBindings(4, ["顾客女生"]),
    /镜头 04.*顾客女生.*绑定全局人物身份/,
  );
});
