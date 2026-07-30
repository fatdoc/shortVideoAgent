import crypto from "node:crypto";
import type { Knex } from "knex";
import type { StoryCanvasMigration } from "./types";

const definition = `
sc_project_profile:v1
sc_script_versions:v1
sc_scenes:v1
sc_shot_metadata:v1
sc_media_assets:v1
sc_tasks:v1
sc_edit_sessions:v1
sc_edit_commands:v1
sc_timeline_versions:v1
sc_external_mappings:v1
`;

async function up(knex: Knex) {
  await knex.schema.createTable("sc_project_profile", (table) => {
    table.integer("projectId").primary().references("id").inTable("o_project").onDelete("CASCADE");
    table.string("category", 80).notNullable();
    table.string("status", 32).notNullable().defaultTo("draft");
    table.text("briefJson");
    table.string("currentScriptVersionId", 36);
    table.string("currentTimelineVersionId", 36);
    table.text("createdAt").notNullable();
    table.text("updatedAt").notNullable();
    table.index(["status", "updatedAt"], "sc_project_profile_status_updated_idx");
  });

  await knex.schema.createTable("sc_script_versions", (table) => {
    table.string("id", 36).primary();
    table.integer("projectId").notNullable().references("id").inTable("o_project").onDelete("CASCADE");
    table.integer("scriptId").references("id").inTable("o_script").onDelete("SET NULL");
    table.integer("version").notNullable();
    table.text("structuredJson").notNullable();
    table.string("source", 32).notNullable();
    table.text("createdAt").notNullable();
    table.unique(["projectId", "version"], { indexName: "sc_script_versions_project_version_uq" });
    table.index(["projectId", "createdAt"], "sc_script_versions_project_created_idx");
  });

  await knex.schema.createTable("sc_scenes", (table) => {
    table.string("id", 36).primary();
    table.integer("projectId").notNullable().references("id").inTable("o_project").onDelete("CASCADE");
    table.string("title", 200).notNullable();
    table.text("description").notNullable().defaultTo("");
    table.string("location", 300).notNullable().defaultTo("");
    table.integer("sortOrder").notNullable();
    table.unique(["projectId", "sortOrder"], { indexName: "sc_scenes_project_order_uq" });
  });

  await knex.schema.createTable("sc_shot_metadata", (table) => {
    table.integer("storyboardId").primary().references("id").inTable("o_storyboard").onDelete("CASCADE");
    table.string("sceneId", 36).notNullable().references("id").inTable("sc_scenes").onDelete("CASCADE");
    table.string("shotType", 80).notNullable();
    table.string("cameraMovement", 120).notNullable();
    table.text("visualDescription").notNullable();
    table.text("imagePrompt").notNullable();
    table.text("videoPrompt").notNullable();
    table.text("narration").notNullable().defaultTo("");
    table.text("onScreenText").notNullable().defaultTo("");
    table.string("transitionName", 100).notNullable().defaultTo("cut");
    table.string("materialStrategy", 32).notNullable();
    table.float("durationSeconds").notNullable();
    table.boolean("locked").notNullable().defaultTo(false);
    table.integer("sortOrder").notNullable();
    table.string("generationStatus", 32).notNullable().defaultTo("queued");
    table.index(["sceneId", "sortOrder"], "sc_shot_metadata_scene_order_idx");
  });

  await knex.schema.createTable("sc_media_assets", (table) => {
    table.string("id", 36).primary();
    table.integer("projectId").notNullable().references("id").inTable("o_project").onDelete("CASCADE");
    table.integer("imageId").references("id").inTable("o_image").onDelete("SET NULL");
    table.integer("videoId").references("id").inTable("o_video").onDelete("SET NULL");
    table.string("type", 32).notNullable();
    table.string("source", 32).notNullable();
    table.string("originalName", 500);
    table.string("mimeType", 200).notNullable();
    table.bigInteger("byteSize").notNullable();
    table.text("localPath").notNullable();
    table.text("remoteUrl");
    table.text("thumbnailPath");
    table.integer("durationMs");
    table.integer("width");
    table.integer("height");
    table.float("fps");
    table.string("provider", 100);
    table.text("prompt");
    table.string("sha256", 64).notNullable();
    table.text("rightsNote");
    table.text("metadataJson").notNullable().defaultTo("{}");
    table.text("createdAt").notNullable();
    table.unique(["projectId", "sha256"], { indexName: "sc_media_assets_project_hash_uq" });
    table.index(["projectId", "type", "createdAt"], "sc_media_assets_project_type_idx");
  });

  await knex.schema.createTable("sc_tasks", (table) => {
    table.string("id", 36).primary();
    table.integer("projectId").notNullable().references("id").inTable("o_project").onDelete("CASCADE");
    table.integer("storyboardId").references("id").inTable("o_storyboard").onDelete("SET NULL");
    table.string("taskType", 64).notNullable();
    table.string("provider", 100).notNullable();
    table.string("status", 32).notNullable();
    table.float("progress").notNullable().defaultTo(0);
    table.text("inputJson").notNullable().defaultTo("{}");
    table.text("outputJson");
    table.text("errorJson");
    table.string("idempotencyKey", 300).notNullable().unique();
    table.string("externalTaskId", 300);
    table.decimal("estimatedCost", 18, 8);
    table.decimal("actualCost", 18, 8);
    table.text("createdAt").notNullable();
    table.text("updatedAt").notNullable();
    table.index(["status", "updatedAt"], "sc_tasks_status_updated_idx");
    table.index(["projectId", "taskType"], "sc_tasks_project_type_idx");
  });

  await knex.schema.createTable("sc_edit_sessions", (table) => {
    table.string("id", 36).primary();
    table.integer("projectId").notNullable().references("id").inTable("o_project").onDelete("CASCADE");
    table.string("status", 32).notNullable();
    table.string("openStorylineSessionId", 300);
    table.string("currentTimelineVersionId", 36);
    table.string("previewAssetId", 36);
    table.string("outputAssetId", 36);
    table.text("createdAt").notNullable();
    table.text("updatedAt").notNullable();
    table.index(["projectId", "updatedAt"], "sc_edit_sessions_project_updated_idx");
  });

  await knex.schema.createTable("sc_edit_commands", (table) => {
    table.string("id", 36).primary();
    table.string("editSessionId", 36).notNullable().references("id").inTable("sc_edit_sessions").onDelete("CASCADE");
    table.text("instruction").notNullable();
    table.string("status", 32).notNullable();
    table.string("taskId", 36).references("id").inTable("sc_tasks").onDelete("SET NULL");
    table.text("createdAt").notNullable();
    table.index(["editSessionId", "createdAt"], "sc_edit_commands_session_created_idx");
  });

  await knex.schema.createTable("sc_timeline_versions", (table) => {
    table.string("id", 36).primary();
    table.integer("projectId").notNullable().references("id").inTable("o_project").onDelete("CASCADE");
    table.string("editSessionId", 36).notNullable().references("id").inTable("sc_edit_sessions").onDelete("CASCADE");
    table.integer("version").notNullable();
    table.string("source", 32).notNullable();
    table.text("tracksJson").notNullable();
    table.text("createdAt").notNullable();
    table.unique(["projectId", "version"], { indexName: "sc_timeline_versions_project_version_uq" });
  });

  await knex.schema.createTable("sc_external_mappings", (table) => {
    table.string("id", 36).primary();
    table.string("system", 100).notNullable();
    table.string("entityType", 100).notNullable();
    table.string("localId", 300).notNullable();
    table.string("externalId", 300).notNullable();
    table.text("metadataJson").notNullable().defaultTo("{}");
    table.text("createdAt").notNullable();
    table.unique(["system", "entityType", "localId"], { indexName: "sc_external_mappings_local_uq" });
    table.index(["system", "entityType", "externalId"], "sc_external_mappings_external_idx");
  });
}

async function down(knex: Knex) {
  for (const tableName of [
    "sc_external_mappings",
    "sc_timeline_versions",
    "sc_edit_commands",
    "sc_edit_sessions",
    "sc_tasks",
    "sc_media_assets",
    "sc_shot_metadata",
    "sc_scenes",
    "sc_script_versions",
    "sc_project_profile",
  ]) {
    await knex.schema.dropTableIfExists(tableName);
  }
}

const migration: StoryCanvasMigration = {
  version: "001_storycanvas_core",
  checksum: crypto.createHash("sha256").update(definition).digest("hex"),
  up,
  down,
};

export default migration;
