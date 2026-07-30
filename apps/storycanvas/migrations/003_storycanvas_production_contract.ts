import crypto from "node:crypto";
import type { Knex } from "knex";
import type { StoryCanvasMigration } from "./types";

const definition = `
sc_production_packages:v1
sc_production_package_attempts:v1
sc_receipt_outbox:v2
sc_export_artifacts:v1
`;

async function up(knex: Knex) {
  await knex.schema.createTable("sc_production_packages", (table) => {
    table.string("id", 36).primary();
    table.string("packageId", 200);
    table.integer("packageVersion");
    table.string("contractVersion", 32);
    table.string("tenantId", 200);
    table.string("externalProjectId", 200);
    table.integer("internalProjectId").references("id").inTable("o_project").onDelete("SET NULL");
    table.string("idempotencyKey", 300).notNullable().unique();
    table.string("payloadDigest", 71).notNullable();
    table.string("sourceSuiteDigest", 71).notNullable();
    table.text("capabilityIdsJson").notNullable().defaultTo("[]");
    table.text("snapshotJson").notNullable();
    table.string("status", 32).notNullable();
    table.string("errorCode", 100);
    table.text("errorJson");
    table.text("acceptedAt");
    table.text("createdAt").notNullable();
    table.index(["packageId", "packageVersion"], "sc_production_packages_package_version_idx");
    table.index(["externalProjectId", "status"], "sc_production_packages_project_status_idx");
  });

  await knex.schema.createTable("sc_production_package_attempts", (table) => {
    table.string("id", 36).primary();
    table.string("packageRecordId", 36).references("id").inTable("sc_production_packages").onDelete("SET NULL");
    table.string("packageId", 200);
    table.integer("packageVersion");
    table.string("contractVersion", 32);
    table.string("tenantId", 200);
    table.string("externalProjectId", 200);
    table.string("idempotencyKey", 300);
    table.string("payloadDigest", 71).notNullable();
    table.string("sourceSuiteDigest", 71).notNullable();
    table.text("snapshotJson").notNullable();
    table.string("status", 32).notNullable();
    table.string("errorCode", 100);
    table.text("errorJson");
    table.text("createdAt").notNullable();
    table.index(["idempotencyKey", "createdAt"], "sc_production_package_attempts_key_created_idx");
    table.index(["externalProjectId", "status"], "sc_production_package_attempts_project_status_idx");
  });

  await knex.schema.createTable("sc_receipt_outbox", (table) => {
    table.string("id", 36).primary();
    table.integer("projectId").notNullable().references("id").inTable("o_project").onDelete("CASCADE");
    table.string("externalProjectId", 200).notNullable();
    table.string("packageId", 200).notNullable();
    table.string("receiptType", 64).notNullable();
    table.string("businessId", 200).notNullable();
    table.string("idempotencyKey", 300).notNullable();
    table.string("payloadDigest", 71).notNullable();
    table.text("payloadJson").notNullable();
    table.string("status", 32).notNullable().defaultTo("pending");
    table.integer("retryCount").notNullable().defaultTo(0);
    table.string("deliveryId", 200);
    table.text("lastAttempt");
    table.text("deliveredAt");
    table.text("acknowledgedAt");
    table.text("lastErrorJson");
    table.text("createdAt").notNullable();
    table.text("updatedAt").notNullable();
    table.unique(["receiptType", "businessId"], { indexName: "sc_receipt_outbox_type_business_uq" });
    table.unique(["receiptType", "idempotencyKey"], { indexName: "sc_receipt_outbox_type_idempotency_uq" });
    table.index(["externalProjectId", "status"], "sc_receipt_outbox_project_status_idx");
  });

  await knex.schema.createTable("sc_export_artifacts", (table) => {
    table.string("id", 36).primary();
    table.integer("projectId").notNullable().references("id").inTable("o_project").onDelete("CASCADE");
    table.string("externalProjectId", 200).notNullable();
    table.string("packageId", 200).notNullable();
    table.string("scriptVersionId", 36).notNullable().references("id").inTable("sc_script_versions").onDelete("RESTRICT");
    table.string("taskId", 36).references("id").inTable("sc_tasks").onDelete("SET NULL");
    table.string("assetId", 36).notNullable().references("id").inTable("sc_media_assets").onDelete("RESTRICT");
    table.string("timelineVersionId", 36).references("id").inTable("sc_timeline_versions").onDelete("SET NULL");
    table.string("mode", 32).notNullable();
    table.string("status", 32).notNullable();
    table.string("storageReference", 1000).notNullable();
    table.string("checksum", 71).notNullable();
    table.text("sourceChainJson").notNullable();
    table.text("createdAt").notNullable();
    table.unique(["externalProjectId", "packageId", "mode"], { indexName: "sc_export_artifacts_project_package_mode_uq" });
  });
}

async function down(knex: Knex) {
  await knex.schema.dropTableIfExists("sc_export_artifacts");
  await knex.schema.dropTableIfExists("sc_receipt_outbox");
  await knex.schema.dropTableIfExists("sc_production_package_attempts");
  await knex.schema.dropTableIfExists("sc_production_packages");
}

const migration: StoryCanvasMigration = {
  version: "003_storycanvas_production_contract",
  checksum: crypto.createHash("sha256").update(definition).digest("hex"),
  up,
  down,
};

export default migration;
