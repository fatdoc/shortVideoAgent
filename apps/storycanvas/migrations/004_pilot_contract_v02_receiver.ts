import crypto from "node:crypto";
import type { Knex } from "knex";
import type { StoryCanvasMigration } from "./types";

const definition = `
sc_v02_packages:v1
sc_v02_grants:v1
sc_v02_generation_commands:v1
sc_v02_receipt_inbox:v1
sc_v02_idempotency:v1
`;

async function up(knex: Knex) {
  await knex.schema.createTable("sc_v02_packages", (table) => {
    table.string("packageId", 200).primary();
    table.string("tenantId", 200).notNullable();
    table.string("projectId", 200).notNullable();
    table.string("payloadDigest", 71).notNullable();
    table.text("payloadJson").notNullable();
    table.text("acceptedAt").notNullable();
    table.unique(["tenantId", "projectId", "packageId"], { indexName: "sc_v02_packages_scope_uq" });
  });

  await knex.schema.createTable("sc_v02_grants", (table) => {
    table.string("grantId", 200).primary();
    table.string("tenantId", 200).notNullable();
    table.string("projectId", 200).notNullable();
    table.string("packageId", 200).notNullable();
    table.string("tokenDigest", 71).notNullable();
    table.string("payloadDigest", 71).notNullable();
    table.text("payloadJson").notNullable();
    table.text("verifiedAt").notNullable();
    table.index(["tenantId", "projectId", "packageId"], "sc_v02_grants_scope_idx");
  });

  await knex.schema.createTable("sc_v02_generation_commands", (table) => {
    table.string("generationTaskId", 200).primary();
    table.string("tenantId", 200).notNullable();
    table.string("projectId", 200).notNullable();
    table.string("packageId", 200).notNullable();
    table.string("grantId", 200).notNullable();
    table.string("capability", 64).notNullable();
    table.string("reservationReference", 200).notNullable();
    table.string("payloadDigest", 71).notNullable();
    table.text("payloadJson").notNullable();
    table.string("status", 32).notNullable().defaultTo("accepted");
    table.text("acceptedAt").notNullable();
    table.index(["tenantId", "projectId", "status"], "sc_v02_commands_scope_status_idx");
  });

  await knex.schema.createTable("sc_v02_receipt_inbox", (table) => {
    table.string("receiptId", 200).primary();
    table.string("receiptType", 32).notNullable();
    table.string("generationTaskId", 200);
    table.string("tenantId", 200).notNullable();
    table.string("projectId", 200).notNullable();
    table.string("payloadDigest", 71).notNullable();
    table.text("payloadJson").notNullable();
    table.text("ackJson").notNullable();
    table.text("receivedAt").notNullable();
    table.index(["tenantId", "projectId", "generationTaskId"], "sc_v02_receipts_task_scope_idx");
  });

  await knex.schema.createTable("sc_v02_idempotency", (table) => {
    table.string("tenantId", 200).notNullable();
    table.string("operation", 80).notNullable();
    table.string("idempotencyKey", 200).notNullable();
    table.string("payloadDigest", 71).notNullable();
    table.integer("httpStatus").notNullable();
    table.text("resultJson").notNullable();
    table.text("createdAt").notNullable();
    table.primary(["tenantId", "operation", "idempotencyKey"], "sc_v02_idempotency_pk");
  });
}

async function down(knex: Knex) {
  await knex.schema.dropTableIfExists("sc_v02_idempotency");
  await knex.schema.dropTableIfExists("sc_v02_receipt_inbox");
  await knex.schema.dropTableIfExists("sc_v02_generation_commands");
  await knex.schema.dropTableIfExists("sc_v02_grants");
  await knex.schema.dropTableIfExists("sc_v02_packages");
}

const migration: StoryCanvasMigration = {
  version: "004_pilot_contract_v02_receiver",
  checksum: crypto.createHash("sha256").update(definition).digest("hex"),
  up,
  down,
};

export default migration;
