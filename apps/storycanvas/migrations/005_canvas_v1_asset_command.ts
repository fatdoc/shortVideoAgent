import crypto from "node:crypto";
import type { Knex } from "knex";
import type { StoryCanvasMigration } from "./types";

const definition = `
sc_canvas_v1_asset_records:v1
sc_canvas_v1_provider_bindings:v1
sc_canvas_v1_entity_bindings:v1
sc_canvas_v1_requirements:v1
sc_canvas_v1_readiness:v1
sc_canvas_v1_documents:v1
sc_canvas_v1_commands:v1
sc_canvas_v1_events:v1
`;

async function up(knex: Knex) {
  await knex.schema.createTable("sc_canvas_v1_asset_records", (table) => {
    table.string("assetId", 36).primary();
    table.string("tenantId", 36).notNullable();
    table.string("projectId", 36).notNullable();
    table.string("packageId", 36).notNullable();
    table.text("projectionJson").notNullable();
    table.text("updatedAt").notNullable();
    table.index(["tenantId", "projectId", "packageId"], "sc_canvas_v1_assets_scope_idx");
  });
  await knex.schema.createTable("sc_canvas_v1_provider_bindings", (table) => {
    table.string("bindingId", 36).primary();
    table.string("assetId", 36).notNullable();
    table.string("tenantId", 36).notNullable();
    table.string("projectId", 36).notNullable();
    table.string("packageId", 36).notNullable();
    table.text("authorityJson").notNullable();
    table.text("updatedAt").notNullable();
    table.unique(["tenantId", "projectId", "packageId", "assetId"], { indexName: "sc_canvas_v1_provider_asset_uq" });
  });
  await knex.schema.createTable("sc_canvas_v1_entity_bindings", (table) => {
    table.string("bindingId", 36).primary();
    table.string("assetId", 36).notNullable();
    table.string("entityId", 36).notNullable();
    table.string("tenantId", 36).notNullable();
    table.string("projectId", 36).notNullable();
    table.string("packageId", 36).notNullable();
    table.text("projectionJson").notNullable();
    table.text("updatedAt").notNullable();
    table.unique(["tenantId", "projectId", "packageId", "entityId"], { indexName: "sc_canvas_v1_entity_scope_uq" });
  });
  await knex.schema.createTable("sc_canvas_v1_requirements", (table) => {
    table.string("requirementId", 36).primary();
    table.string("shotId", 36).notNullable();
    table.string("tenantId", 36).notNullable();
    table.string("projectId", 36).notNullable();
    table.string("packageId", 36).notNullable();
    table.text("projectionJson").notNullable();
    table.text("updatedAt").notNullable();
    table.index(["tenantId", "projectId", "packageId", "shotId"], "sc_canvas_v1_requirement_shot_idx");
  });
  await knex.schema.createTable("sc_canvas_v1_readiness", (table) => {
    table.string("readinessId", 36).primary();
    table.string("shotId", 36).notNullable();
    table.string("tenantId", 36).notNullable();
    table.string("projectId", 36).notNullable();
    table.string("packageId", 36).notNullable();
    table.text("projectionJson").notNullable();
    table.text("evaluatedAt").notNullable();
    table.index(["tenantId", "projectId", "packageId", "shotId"], "sc_canvas_v1_readiness_shot_idx");
  });
  await knex.schema.createTable("sc_canvas_v1_documents", (table) => {
    table.string("documentId", 36).notNullable();
    table.string("tenantId", 36).notNullable();
    table.string("projectId", 36).notNullable();
    table.string("packageId", 36).notNullable();
    table.string("currentCanvasSessionId", 132).notNullable();
    table.string("status", 32).notNullable();
    table.integer("version").notNullable();
    table.text("shotsJson").notNullable();
    table.text("playlistJson").notNullable();
    table.text("createdAt").notNullable();
    table.text("updatedAt").notNullable();
    table.primary(["tenantId", "projectId", "packageId", "documentId"], "sc_canvas_v1_documents_pk");
  });
  await knex.schema.createTable("sc_canvas_v1_commands", (table) => {
    table.string("commandId", 36).primary();
    table.string("tenantId", 36).notNullable();
    table.string("projectId", 36).notNullable();
    table.string("packageId", 36).notNullable();
    table.string("canvasSessionId", 132).notNullable();
    table.string("commandType", 64).notNullable();
    table.string("payloadDigest", 64).notNullable();
    table.text("commandJson").notNullable();
    table.text("resultEventJson");
    table.text("createdAt").notNullable();
    table.text("updatedAt").notNullable();
    table.unique(["tenantId", "projectId", "packageId", "canvasSessionId", "commandType"], { indexName: "sc_canvas_v1_command_scope_type_uq" });
  });
  await knex.schema.createTable("sc_canvas_v1_events", (table) => {
    table.string("eventId", 36).primary();
    table.string("commandId", 36).notNullable();
    table.string("tenantId", 36).notNullable();
    table.string("projectId", 36).notNullable();
    table.string("packageId", 36).notNullable();
    table.string("canvasSessionId", 132).notNullable();
    table.string("status", 32).notNullable();
    table.text("eventJson").notNullable();
    table.text("createdAt").notNullable();
    table.index(["tenantId", "projectId", "packageId", "commandId"], "sc_canvas_v1_events_command_idx");
  });
}

async function down(knex: Knex) {
  for (const table of [
    "sc_canvas_v1_events",
    "sc_canvas_v1_commands",
    "sc_canvas_v1_documents",
    "sc_canvas_v1_readiness",
    "sc_canvas_v1_requirements",
    "sc_canvas_v1_entity_bindings",
    "sc_canvas_v1_provider_bindings",
    "sc_canvas_v1_asset_records",
  ]) await knex.schema.dropTableIfExists(table);
}

const migration: StoryCanvasMigration = {
  version: "005_canvas_v1_asset_command",
  checksum: crypto.createHash("sha256").update(definition).digest("hex"),
  up,
  down,
};

export default migration;
