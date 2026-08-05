import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { test } from "node:test";
import express from "express";
import knex, { type Knex } from "knex";
import migration from "../../../../migrations/004_pilot_contract_v02_receiver";
import { assertContractObject, contractPayloadDigest, tokenDigest } from "@/contracts/v0.2/runtime";
import { GrantSecurityError, type ActiveGrantContextV02 } from "@/contracts/v0.2/security";
import { capturePilotV02RawBody, createProductionV02Router } from ".";

const fixtureDirectory = path.resolve(__dirname, "../../../../../../docs/program/contracts/v0.2/fixtures");
const token = "opaque-control-plane-project-grant";
const fixedNow = new Date("2026-08-05T01:05:00.000Z");

function fixture(name: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(path.join(fixtureDirectory, `${name}.json`), "utf8")) as Record<string, any>;
}

function active(): ActiveGrantContextV02 {
  return {
    active: true,
    tenantId: "tenant-pilot-01",
    projectId: "project-pilot-01",
    packageId: "package-project-pilot-01-v1",
    capabilities: ["image.generate", "video.generate", "audio.tts", "media.export"],
    scopes: [
      "production.package.read",
      "production.task.write",
      "production.receipt.write",
      "production.asset.write",
      "production.export.write",
    ],
    exp: Math.floor(Date.parse("2026-08-05T01:10:01.000Z") / 1000),
  };
}

async function createServer(database: Knex, failClosed = false) {
  const app = express();
  app.use(express.json({ verify: capturePilotV02RawBody }));
  app.use("/api/production/v0.2", createProductionV02Router({
    database,
    introspector: failClosed
      ? { introspect: async () => { throw new GrantSecurityError("GRANT_INVALID", 401); } }
      : { introspect: async () => active() },
    now: () => fixedNow,
  }));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("ephemeral HTTP server did not bind");
  return { server, baseUrl: `http://127.0.0.1:${address.port}/api/production/v0.2` };
}

async function post(baseUrl: string, endpoint: string, value: Record<string, any>, options: { digest?: string; authorization?: string } = {}) {
  const body = JSON.stringify(value);
  const digest = options.digest ?? `sha-256=:${crypto.createHash("sha256").update(body).digest("base64")}:`;
  const response = await fetch(`${baseUrl}/${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-contract-version": "0.2",
      "idempotency-key": value.idempotencyKey,
      "content-digest": digest,
      authorization: options.authorization ?? `Bearer ${token}`,
    },
    body,
  });
  return { response, body: await response.json() as Record<string, any> };
}

test("public v0.2 HTTP routes receive package/grant/command and return non-durable unknown-task ACK", async (context) => {
  const database = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  await migration.up(database);
  const { server, baseUrl } = await createServer(database);
  context.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await database.destroy();
  });

  const productionPackage = fixture("project-production-package");
  const grant = fixture("project-grant");
  grant.tokenDigest = tokenDigest(token);
  grant.payloadDigest = contractPayloadDigest(grant);
  const command = fixture("generation-task-command");
  assert.equal((await post(baseUrl, "packages", productionPackage)).response.status, 202);
  assert.equal((await post(baseUrl, "grants", grant)).response.status, 202);
  const acceptedCommand = await post(baseUrl, "commands", command);
  assert.equal(acceptedCommand.response.status, 202);
  assert.equal(acceptedCommand.body.providerSubmitted, false);
  const replay = await post(baseUrl, "commands", command);
  assert.equal(replay.response.status, 200);
  assert.equal(replay.response.headers.get("idempotency-replayed"), "true");

  const unknown = fixture("task-receipt");
  unknown.receiptId = "receipt-task-unknown-http";
  unknown.idempotencyKey = "task-receipt-unknown-http";
  unknown.generationTaskId = "task-unknown-http";
  unknown.payloadDigest = contractPayloadDigest(unknown);
  const rejected = await post(baseUrl, "receipts", unknown);
  assert.equal(rejected.response.status, 404);
  assert.equal(rejected.body.objectType, "ReceiptAck");
  assert.equal(rejected.body.status, "rejected");
  assert.equal(rejected.body.durablyRecorded, false);
  assert.equal(rejected.body.error.code, "RECEIPT_TASK_NOT_FOUND");
  assertContractObject(rejected.body, "ReceiptAck");
  assert.equal((await database("sc_v02_receipt_inbox")).length, 0);
});

test("public v0.2 HTTP routes reject byte tamper and fail closed with safe C01 StandardError", async (context) => {
  const database = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  await migration.up(database);
  const { server, baseUrl } = await createServer(database, true);
  context.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await database.destroy();
  });
  const productionPackage = fixture("project-production-package");
  const tampered = await post(baseUrl, "packages", productionPackage, { digest: `sha-256=:${Buffer.alloc(32).toString("base64")}:` });
  assert.equal(tampered.response.status, 422);
  assert.equal(tampered.body.error.code, "SCHEMA_INVALID");
  assertContractObject(tampered.body, "StandardError");

  const unavailable = await post(baseUrl, "packages", productionPackage);
  assert.equal(unavailable.response.status, 401);
  assert.equal(unavailable.body.error.code, "GRANT_INVALID");
  assert.equal(unavailable.body.error.message, "Project authorization is invalid.");
  assertContractObject(unavailable.body, "StandardError");
  assert.equal((await database("sc_v02_packages")).length, 0);
});
