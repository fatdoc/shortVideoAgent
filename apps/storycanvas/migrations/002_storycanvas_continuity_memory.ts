import crypto from "node:crypto";
import type { Knex } from "knex";
import type { StoryCanvasMigration } from "./types";

const definition = `
sc_continuity_profiles:v1
sc_entities:v1
sc_entity_versions:v1
sc_world_events:v1
sc_shot_contracts:v1
sc_shot_relations:v1
sc_reference_bindings:v1
sc_continuity_reviews:v1
`;

async function up(knex: Knex) {
  await knex.schema.createTable("sc_continuity_profiles", (table) => {
    table.string("id", 36).primary();
    table.integer("projectId").notNullable().references("id").inTable("o_project").onDelete("CASCADE");
    table.integer("revision").notNullable().defaultTo(1);
    table.text("styleJson").notNullable().defaultTo("{}");
    table.text("rulesJson").notNullable().defaultTo("[]");
    table.text("createdAt").notNullable();
    table.text("updatedAt").notNullable();
    table.unique(["projectId"], { indexName: "sc_continuity_profiles_project_uq" });
  });

  await knex.schema.createTable("sc_entities", (table) => {
    table.string("id", 36).primary();
    table.integer("projectId").notNullable().references("id").inTable("o_project").onDelete("CASCADE");
    table.string("slug", 100).notNullable();
    table.string("entityType", 32).notNullable();
    table.string("name", 200).notNullable();
    table.text("canonicalJson").notNullable().defaultTo("{}");
    table.boolean("locked").notNullable().defaultTo(true);
    table.text("createdAt").notNullable();
    table.text("updatedAt").notNullable();
    table.unique(["projectId", "slug"], { indexName: "sc_entities_project_slug_uq" });
    table.index(["projectId", "entityType"], "sc_entities_project_type_idx");
  });

  await knex.schema.createTable("sc_entity_versions", (table) => {
    table.string("id", 36).primary();
    table.string("entityId", 36).notNullable().references("id").inTable("sc_entities").onDelete("CASCADE");
    table.integer("version").notNullable();
    table.text("appearanceJson").notNullable().defaultTo("{}");
    table.text("stateJson").notNullable().defaultTo("{}");
    table.boolean("approved").notNullable().defaultTo(false);
    table.text("createdAt").notNullable();
    table.unique(["entityId", "version"], { indexName: "sc_entity_versions_entity_version_uq" });
  });

  await knex.schema.createTable("sc_world_events", (table) => {
    table.string("id", 36).primary();
    table.integer("projectId").notNullable().references("id").inTable("o_project").onDelete("CASCADE");
    table.integer("afterShotId");
    table.integer("sortOrder").notNullable();
    table.string("eventType", 80).notNullable();
    table.string("title", 200).notNullable();
    table.text("preconditionsJson").notNullable().defaultTo("{}");
    table.text("statePatchJson").notNullable().defaultTo("{}");
    table.text("createdAt").notNullable();
    table.unique(["projectId", "sortOrder"], { indexName: "sc_world_events_project_order_uq" });
  });

  await knex.schema.createTable("sc_shot_contracts", (table) => {
    table.integer("projectId").notNullable().references("id").inTable("o_project").onDelete("CASCADE");
    table.integer("shotId").notNullable();
    table.integer("worldRevision").notNullable();
    table.text("entitySlugsJson").notNullable().defaultTo("[]");
    table.text("mustPreserveJson").notNullable().defaultTo("[]");
    table.text("requiredStateJson").notNullable().defaultTo("{}");
    table.text("statePatchJson").notNullable().defaultTo("{}");
    table.text("actionJson").notNullable().defaultTo("{}");
    table.text("cameraJson").notNullable().defaultTo("{}");
    table.text("transitionJson").notNullable().defaultTo("{}");
    table.text("updatedAt").notNullable();
    table.primary(["projectId", "shotId"], "sc_shot_contracts_pk");
  });

  await knex.schema.createTable("sc_shot_relations", (table) => {
    table.string("id", 36).primary();
    table.integer("projectId").notNullable().references("id").inTable("o_project").onDelete("CASCADE");
    table.integer("fromShotId").notNullable();
    table.integer("toShotId").notNullable();
    table.string("relationType", 40).notNullable();
    table.text("preserveJson").notNullable().defaultTo("[]");
    table.string("matchOn", 40);
    table.boolean("usePreviousEndFrame").notNullable().defaultTo(false);
    table.text("createdAt").notNullable();
    table.text("updatedAt").notNullable();
    table.unique(["projectId", "fromShotId", "toShotId"], { indexName: "sc_shot_relations_edge_uq" });
  });

  await knex.schema.createTable("sc_reference_bindings", (table) => {
    table.string("id", 36).primary();
    table.integer("projectId").notNullable().references("id").inTable("o_project").onDelete("CASCADE");
    table.string("entityId", 36).references("id").inTable("sc_entities").onDelete("CASCADE");
    table.integer("shotId");
    table.string("assetId", 36).references("id").inTable("sc_media_assets").onDelete("SET NULL");
    table.text("sourceUri");
    table.string("role", 40).notNullable();
    table.string("view", 40).notNullable().defaultTo("canonical");
    table.integer("priority").notNullable().defaultTo(0);
    table.boolean("approved").notNullable().defaultTo(true);
    table.text("createdAt").notNullable();
    table.index(["projectId", "shotId"], "sc_reference_bindings_project_shot_idx");
    table.index(["entityId", "role"], "sc_reference_bindings_entity_role_idx");
  });

  await knex.schema.createTable("sc_continuity_reviews", (table) => {
    table.string("id", 36).primary();
    table.integer("projectId").notNullable().references("id").inTable("o_project").onDelete("CASCADE");
    table.integer("shotId").notNullable();
    table.string("taskId", 36).references("id").inTable("sc_tasks").onDelete("SET NULL");
    table.string("status", 32).notNullable();
    table.text("issuesJson").notNullable().defaultTo("[]");
    table.text("observedStateJson").notNullable().defaultTo("{}");
    table.text("createdAt").notNullable();
    table.index(["projectId", "shotId", "createdAt"], "sc_continuity_reviews_project_shot_idx");
  });
}

async function down(knex: Knex) {
  for (const tableName of [
    "sc_continuity_reviews",
    "sc_reference_bindings",
    "sc_shot_relations",
    "sc_shot_contracts",
    "sc_world_events",
    "sc_entity_versions",
    "sc_entities",
    "sc_continuity_profiles",
  ]) {
    await knex.schema.dropTableIfExists(tableName);
  }
}

const migration: StoryCanvasMigration = {
  version: "002_storycanvas_continuity_memory",
  checksum: crypto.createHash("sha256").update(definition).digest("hex"),
  up,
  down,
};

export default migration;
