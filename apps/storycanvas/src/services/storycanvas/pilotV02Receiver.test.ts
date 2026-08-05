import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import knex, { type Knex } from "knex";
import migration from "../../../migrations/004_pilot_contract_v02_receiver";
import { contractPayloadDigest, tokenDigest } from "@/contracts/v0.2/runtime";
import {
  GrantSecurityError,
  type ActiveGrantContextV02,
  type ActiveGrantIntrospector,
} from "@/contracts/v0.2/security";
import { PilotV02Receiver, PilotV02ReceiverError } from "./pilotV02Receiver";

const fixtureDirectory = path.resolve(__dirname, "../../../../../docs/program/contracts/v0.2/fixtures");
const token = "opaque-control-plane-project-grant";
const now = new Date("2026-08-05T01:05:00.000Z");

function fixture(name: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(path.join(fixtureDirectory, `${name}.json`), "utf8")) as Record<string, any>;
}

function refresh(value: Record<string, any>): Record<string, any> {
  value.payloadDigest = contractPayloadDigest(value);
  return value;
}

function active(overrides: Partial<ActiveGrantContextV02> = {}): ActiveGrantContextV02 {
  return {
    active: true,
    grantId: "grant-project-pilot-01-v1",
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
    ...overrides,
  };
}

async function setup(
  introspector: ActiveGrantIntrospector = { introspect: async () => active() },
  nowFn: () => Date = () => now,
) {
  const database = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  await migration.up(database);
  const receiver = new PilotV02Receiver({ database, introspector, now: nowFn, randomId: () => "fixed-id" });
  return { database, receiver };
}

async function seed(receiver: PilotV02Receiver) {
  const productionPackage = fixture("project-production-package");
  const grant = fixture("project-grant");
  grant.tokenDigest = tokenDigest(token);
  refresh(grant);
  const command = fixture("generation-task-command");
  await receiver.receivePackage(productionPackage, token);
  await receiver.receiveGrant(grant, token);
  await receiver.receiveCommand(command, token);
  return { productionPackage, grant, command };
}

test("package -> grant -> command succeeds, persists durably, and never submits a provider", async (context) => {
  const { database, receiver } = await setup();
  context.after(() => database.destroy());
  const { command } = await seed(receiver);
  const replay = await receiver.receiveCommand(command, token);
  assert.equal(replay.replayed, true);
  assert.equal(replay.httpStatus, 202);
  assert.equal(replay.value.providerSubmitted, false);
  assert.equal((await database("sc_v02_packages")).length, 1);
  assert.equal((await database("sc_v02_grants")).length, 1);
  assert.equal((await database("sc_v02_generation_commands")).length, 1);
});

test("scope, capability, expiry, payload tamper, and introspection failures reject before side effects", async (context) => {
  const { database, receiver } = await setup();
  context.after(() => database.destroy());

  const wrongTenant = refresh({ ...fixture("project-production-package"), tenantId: "tenant-other-01" });
  await assert.rejects(() => receiver.receivePackage(wrongTenant, token), (error: unknown) => error instanceof PilotV02ReceiverError && error.code === "TENANT_SCOPE_MISMATCH");

  const deniedContext = { introspect: async () => active({ capabilities: ["image.generate"] }) };
  const denied = await setup(deniedContext);
  context.after(() => denied.database.destroy());
  const productionPackage = fixture("project-production-package");
  const grant = refresh({ ...fixture("project-grant"), tokenDigest: tokenDigest(token), capabilities: ["image.generate"] });
  await denied.receiver.receivePackage(productionPackage, token);
  await denied.receiver.receiveGrant(grant, token);
  await assert.rejects(() => denied.receiver.receiveCommand(fixture("generation-task-command"), token), (error: unknown) => error instanceof GrantSecurityError && error.code === "CAPABILITY_SCOPE_DENIED");

  const expired = fixture("project-production-package");
  expired.expiresAt = "2026-08-05T01:04:59.000Z";
  refresh(expired);
  await assert.rejects(() => receiver.receivePackage(expired, token), (error: unknown) => error instanceof PilotV02ReceiverError && error.code === "GRANT_EXPIRED");

  const tampered = fixture("project-production-package");
  tampered.approvedScript.content = "tampered without digest refresh";
  await assert.rejects(() => receiver.receivePackage(tampered, token), (error: unknown) => error instanceof PilotV02ReceiverError && error.code === "SCHEMA_INVALID");

  const unavailable = await setup({ introspect: async () => { throw new GrantSecurityError("GRANT_INVALID", 401); } });
  context.after(() => unavailable.database.destroy());
  await assert.rejects(() => unavailable.receiver.receivePackage(fixture("project-production-package"), token), (error: unknown) => error instanceof PilotV02ReceiverError && error.code === "GRANT_INVALID");
  assert.equal((await unavailable.database("sc_v02_packages")).length, 0);

  const forgedGrant = fixture("project-grant");
  forgedGrant.grantId = "grant-forged";
  forgedGrant.tokenDigest = tokenDigest(token);
  refresh(forgedGrant);
  await receiver.receivePackage(fixture("project-production-package"), token);
  await assert.rejects(() => receiver.receiveGrant(forgedGrant, token), (error: unknown) => error instanceof PilotV02ReceiverError && error.code === "GRANT_INVALID");
  assert.equal((await database("sc_v02_grants")).length, 0);
});

test("authorization is rechecked immediately before writes and expiry leaves no package or receipt side effect", async (context) => {
  const expiresAt = new Date("2026-08-05T01:05:06.000Z");
  let calls = 0;
  const racingNow = () => calls++ === 0 ? now : new Date("2026-08-05T01:05:02.000Z");
  const expiring = await setup({ introspect: async () => active({ exp: Math.floor(expiresAt.getTime() / 1000) }) }, racingNow);
  context.after(() => expiring.database.destroy());
  await assert.rejects(
    () => expiring.receiver.receivePackage(fixture("project-production-package"), token),
    (error: unknown) => error instanceof PilotV02ReceiverError && error.code === "GRANT_EXPIRED",
  );
  assert.equal((await expiring.database("sc_v02_packages")).length, 0);
  assert.equal((await expiring.database("sc_v02_idempotency")).length, 0);

  let current = now;
  const receiptContext = await setup({ introspect: async () => active() }, () => current);
  context.after(() => receiptContext.database.destroy());
  await seed(receiptContext.receiver);
  current = new Date("2026-08-05T01:09:57.000Z");
  await assert.rejects(
    () => receiptContext.receiver.receiveReceipt(fixture("task-receipt"), token),
    (error: unknown) => error instanceof PilotV02ReceiverError && error.code === "GRANT_EXPIRED",
  );
  assert.equal((await receiptContext.database("sc_v02_receipt_inbox")).length, 0);
});

test("same idempotency key replays and a changed payload conflicts", async (context) => {
  const { database, receiver } = await setup();
  context.after(() => database.destroy());
  const productionPackage = fixture("project-production-package");
  const first = await receiver.receivePackage(productionPackage, token);
  const replay = await receiver.receivePackage(productionPackage, token);
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  const conflict = fixture("project-production-package");
  conflict.approvedScript.content = "A different approved snapshot.";
  refresh(conflict);
  await assert.rejects(() => receiver.receivePackage(conflict, token), (error: unknown) => error instanceof PilotV02ReceiverError && error.code === "IDEMPOTENCY_CONFLICT");
});

test("receipt Inbox returns accepted/duplicate/conflict ACKs and unknown task is non-durable", async (context) => {
  const { database, receiver } = await setup();
  context.after(() => database.destroy());
  await seed(receiver);
  const receipt = fixture("task-receipt");
  const accepted = await receiver.receiveReceipt(receipt, token);
  assert.equal(accepted.value.status, "accepted");
  assert.equal(accepted.value.durablyRecorded, true);
  const duplicate = await receiver.receiveReceipt(receipt, token);
  assert.equal(duplicate.value.status, "duplicate");
  assert.equal(duplicate.replayed, true);

  const conflict = fixture("task-receipt");
  conflict.idempotencyKey = "task-receipt-conflict";
  conflict.providerExecution.providerTaskReference = "provider-task-redacted-conflict";
  refresh(conflict);
  const rejectedConflict = await receiver.receiveReceipt(conflict, token);
  assert.equal(rejectedConflict.httpStatus, 409);
  assert.equal(rejectedConflict.value.status, "rejected");
  assert.equal(rejectedConflict.value.durablyRecorded, false);

  const unknown = fixture("task-receipt");
  unknown.receiptId = "receipt-task-unknown";
  unknown.idempotencyKey = "task-receipt-unknown";
  unknown.generationTaskId = "task-unknown";
  refresh(unknown);
  const rejected = await receiver.receiveReceipt(unknown, token);
  assert.equal(rejected.httpStatus, 404);
  assert.equal(rejected.value.status, "rejected");
  assert.equal(rejected.value.durablyRecorded, false);
  assert.equal(rejected.value.error.code, "RECEIPT_TASK_NOT_FOUND");
  assert.equal(rejected.value.error.message, "Receipt cannot be accepted.");
  assert.equal((await database("sc_v02_receipt_inbox")).length, 1);
  assert.equal((await database("sc_v02_idempotency").where({ idempotencyKey: unknown.idempotencyKey })).length, 0);
});
