import crypto from "node:crypto";
import type { Knex } from "knex";
import type { StoryCanvasMigration } from "./types";

const definition = `
sc_production_shots:v1
sc_generation_plans:v1
sc_shot_references:v1
sc_shot_attempts:v1
sc_rough_cuts:v1
sc_runtime_credit_entries:v1
sc_tasks:phase1-runtime-v1
sc_media_assets:phase1-runtime-v1
sc_export_artifacts:phase1-runtime-v1
`;

async function up(knex: Knex) {
  await knex.schema.createTable("sc_production_shots", (table) => {
    table.string("id", 36).primary();
    table.integer("projectId").notNullable().references("id").inTable("o_project").onDelete("CASCADE");
    table.integer("storyboardId").notNullable().references("id").inTable("o_storyboard").onDelete("RESTRICT");
    table.string("externalProjectId", 200).notNullable();
    table.string("externalStoryboardShotId", 300).notNullable();
    table.string("productionPackageId", 36).notNullable().references("id").inTable("sc_production_packages").onDelete("RESTRICT");
    table.integer("sequence").notNullable();
    table.string("title", 300).notNullable();
    table.float("duration").notNullable();
    table.text("approvedScriptSegmentJson").notNullable();
    table.text("claimIdsJson").notNullable().defaultTo("[]");
    table.text("brandFactIdsJson").notNullable().defaultTo("[]");
    table.text("lockedBusinessFieldsJson").notNullable().defaultTo("{}");
    table.text("editableCreativeFieldsJson").notNullable().defaultTo("{}");
    table.text("shotContractJson").notNullable().defaultTo("{}");
    table.string("status", 40).notNullable().defaultTo("planning");
    table.string("selectedAttemptId", 36);
    table.text("createdAt").notNullable();
    table.text("updatedAt").notNullable();
    table.unique(["externalProjectId", "externalStoryboardShotId"], { indexName: "sc_production_shots_external_uq" });
    table.unique(["productionPackageId", "storyboardId"], { indexName: "sc_production_shots_package_storyboard_uq" });
    table.index(["projectId", "sequence"], "sc_production_shots_project_sequence_idx");
  });

  await knex.schema.createTable("sc_generation_plans", (table) => {
    table.string("id", 36).primary();
    table.string("productionShotId", 36).notNullable().references("id").inTable("sc_production_shots").onDelete("CASCADE");
    table.integer("planVersion").notNullable();
    table.text("imagePrompt").notNullable();
    table.text("videoPrompt").notNullable();
    table.text("negativePrompt").notNullable().defaultTo("");
    table.string("recommendedImageModel", 300);
    table.string("recommendedVideoModel", 300);
    table.text("referenceAssetIdsJson").notNullable().defaultTo("[]");
    table.text("continuityEntityIdsJson").notNullable().defaultTo("[]");
    table.text("cameraPlanJson").notNullable().defaultTo("{}");
    table.decimal("estimatedCredit", 18, 8).notNullable().defaultTo(0);
    table.string("generatedBy", 200).notNullable();
    table.string("status", 40).notNullable().defaultTo("awaiting_confirmation");
    table.string("approvedByOperator", 200);
    table.text("approvedAt");
    table.string("idempotencyKey", 300).notNullable().unique();
    table.text("createdAt").notNullable();
    table.text("updatedAt").notNullable();
    table.unique(["productionShotId", "planVersion"], { indexName: "sc_generation_plans_shot_version_uq" });
  });

  await knex.schema.createTable("sc_shot_references", (table) => {
    table.string("id", 36).primary();
    table.string("productionShotId", 36).notNullable().references("id").inTable("sc_production_shots").onDelete("CASCADE");
    table.string("assetId", 36).references("id").inTable("sc_media_assets").onDelete("RESTRICT");
    table.string("referenceRole", 60).notNullable();
    table.text("sourceUri");
    table.integer("sortOrder").notNullable().defaultTo(0);
    table.text("metadataJson").notNullable().defaultTo("{}");
    table.text("createdAt").notNullable();
    table.unique(["productionShotId", "referenceRole", "sortOrder"], { indexName: "sc_shot_references_shot_role_order_uq" });
  });

  await knex.schema.alterTable("sc_tasks", (table) => {
    table.string("productionShotId", 36);
    table.string("attemptId", 36);
    table.string("model", 300);
    table.string("modelVersion", 300);
    table.text("requestedPrompt");
    table.text("resolvedPrompt");
    table.text("negativePrompt");
    table.text("inputAssetIdsJson").defaultTo("[]");
    table.text("outputAssetIdsJson").defaultTo("[]");
    table.string("errorCode", 200);
    table.text("errorMessage");
    table.decimal("reservedCredit", 18, 8).notNullable().defaultTo(0);
    table.decimal("consumedCredit", 18, 8).notNullable().defaultTo(0);
    table.decimal("releasedCredit", 18, 8).notNullable().defaultTo(0);
    table.string("runtimeMode", 20).notNullable().defaultTo("DEMO");
    table.text("startedAt");
    table.text("completedAt");
    table.text("cancelledAt");
    table.text("timeoutAt");
    table.index(["productionShotId", "createdAt"], "sc_tasks_production_shot_created_idx");
    table.index(["attemptId"], "sc_tasks_attempt_idx");
  });

  await knex.schema.alterTable("sc_media_assets", (table) => {
    table.string("productionShotId", 36);
    table.string("attemptId", 36);
    table.text("playableUrl");
    table.text("thumbnailUrl");
    table.string("validationStatus", 32).notNullable().defaultTo("pending");
    table.text("validationJson").notNullable().defaultTo("{}");
    table.text("validatedAt");
    table.index(["productionShotId", "createdAt"], "sc_media_assets_production_shot_created_idx");
    table.index(["attemptId"], "sc_media_assets_attempt_idx");
  });

  await knex.schema.createTable("sc_shot_attempts", (table) => {
    table.string("id", 36).primary();
    table.string("productionShotId", 36).notNullable().references("id").inTable("sc_production_shots").onDelete("RESTRICT");
    table.string("generationTaskId", 36).notNullable().unique().references("id").inTable("sc_tasks").onDelete("RESTRICT");
    table.integer("attemptNumber").notNullable();
    table.string("parentAttemptId", 36).references("id").inTable("sc_shot_attempts").onDelete("SET NULL");
    table.string("assetId", 36).references("id").inTable("sc_media_assets").onDelete("RESTRICT");
    table.string("thumbnailAssetId", 36).references("id").inTable("sc_media_assets").onDelete("SET NULL");
    table.text("promptSnapshotJson").notNullable();
    table.text("modelSnapshotJson").notNullable();
    table.text("parameterSnapshotJson").notNullable().defaultTo("{}");
    table.text("referenceSnapshotJson").notNullable().defaultTo("[]");
    table.string("qualityStatus", 32).notNullable().defaultTo("pending");
    table.string("operatorDecision", 32).notNullable().defaultTo("undecided");
    table.boolean("isSelected").notNullable().defaultTo(false);
    table.text("createdAt").notNullable();
    table.text("updatedAt").notNullable();
    table.unique(["productionShotId", "attemptNumber"], { indexName: "sc_shot_attempts_shot_number_uq" });
    table.index(["productionShotId", "operatorDecision"], "sc_shot_attempts_shot_decision_idx");
  });
  await knex.raw("CREATE UNIQUE INDEX sc_shot_attempts_selected_uq ON sc_shot_attempts(productionShotId) WHERE isSelected = 1");

  await knex.schema.createTable("sc_rough_cuts", (table) => {
    table.string("id", 36).primary();
    table.integer("projectId").notNullable().references("id").inTable("o_project").onDelete("CASCADE");
    table.string("externalProjectId", 200).notNullable();
    table.string("productionPackageId", 36).notNullable().references("id").inTable("sc_production_packages").onDelete("RESTRICT");
    table.text("orderedShotSelectionsJson").notNullable();
    table.float("totalDuration").notNullable();
    table.string("aspectRatio", 40).notNullable();
    table.string("previewAssetId", 36).references("id").inTable("sc_media_assets").onDelete("SET NULL");
    table.string("approvalStatus", 40).notNullable().defaultTo("awaiting_tenant_approval");
    table.string("approvedBy", 200);
    table.text("approvedAt");
    table.string("idempotencyKey", 300).notNullable().unique();
    table.text("createdAt").notNullable();
    table.text("updatedAt").notNullable();
    table.index(["externalProjectId", "createdAt"], "sc_rough_cuts_external_project_idx");
  });

  await knex.schema.createTable("sc_runtime_credit_entries", (table) => {
    table.string("id", 36).primary();
    table.integer("projectId").notNullable().references("id").inTable("o_project").onDelete("CASCADE");
    table.string("taskId", 36).notNullable().references("id").inTable("sc_tasks").onDelete("RESTRICT");
    table.string("attemptId", 36).notNullable().references("id").inTable("sc_shot_attempts").onDelete("RESTRICT");
    table.string("operation", 20).notNullable();
    table.decimal("amount", 18, 8).notNullable();
    table.string("unit", 40).notNullable().defaultTo("AI_VIDEO_CREDIT");
    table.string("idempotencyKey", 300).notNullable().unique();
    table.text("metadataJson").notNullable().defaultTo("{}");
    table.text("createdAt").notNullable();
    table.unique(["taskId", "operation"], { indexName: "sc_runtime_credit_task_operation_uq" });
    table.index(["projectId", "createdAt"], "sc_runtime_credit_project_created_idx");
  });

  await knex.schema.alterTable("sc_export_artifacts", (table) => {
    table.string("roughCutId", 36);
    table.string("exportType", 40).notNullable().defaultTo("main");
    table.string("platformVariant", 80).notNullable().defaultTo("primary");
    table.text("manifestJson").notNullable().defaultTo("{}");
    table.text("provenanceJson").notNullable().defaultTo("{}");
    table.text("approvedAt");
    table.index(["roughCutId"], "sc_export_artifacts_rough_cut_idx");
  });
}

async function down(knex: Knex) {
  await knex.schema.alterTable("sc_export_artifacts", (table) => {
    table.dropIndex(["roughCutId"], "sc_export_artifacts_rough_cut_idx");
    table.dropColumns("roughCutId", "exportType", "platformVariant", "manifestJson", "provenanceJson", "approvedAt");
  });
  await knex.schema.dropTableIfExists("sc_runtime_credit_entries");
  await knex.schema.dropTableIfExists("sc_rough_cuts");
  await knex.raw("DROP INDEX IF EXISTS sc_shot_attempts_selected_uq");
  await knex.schema.dropTableIfExists("sc_shot_attempts");
  await knex.schema.alterTable("sc_media_assets", (table) => {
    table.dropIndex(["attemptId"], "sc_media_assets_attempt_idx");
    table.dropIndex(["productionShotId", "createdAt"], "sc_media_assets_production_shot_created_idx");
    table.dropColumns("productionShotId", "attemptId", "playableUrl", "thumbnailUrl", "validationStatus", "validationJson", "validatedAt");
  });
  await knex.schema.alterTable("sc_tasks", (table) => {
    table.dropIndex(["attemptId"], "sc_tasks_attempt_idx");
    table.dropIndex(["productionShotId", "createdAt"], "sc_tasks_production_shot_created_idx");
    table.dropColumns(
      "productionShotId", "attemptId", "model", "modelVersion", "requestedPrompt", "resolvedPrompt",
      "negativePrompt", "inputAssetIdsJson", "outputAssetIdsJson", "errorCode", "errorMessage",
      "reservedCredit", "consumedCredit", "releasedCredit", "runtimeMode", "startedAt", "completedAt",
      "cancelledAt", "timeoutAt",
    );
  });
  await knex.schema.dropTableIfExists("sc_shot_references");
  await knex.schema.dropTableIfExists("sc_generation_plans");
  await knex.schema.dropTableIfExists("sc_production_shots");
}

const migration: StoryCanvasMigration = {
  version: "004_storycanvas_phase1_runtime",
  checksum: crypto.createHash("sha256").update(definition).digest("hex"),
  up,
  down,
};

export default migration;
