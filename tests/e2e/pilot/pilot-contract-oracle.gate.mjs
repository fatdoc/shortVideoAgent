import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repositoryRoot = process.cwd();
const contractDirectory = path.join(repositoryRoot, "docs/program/contracts/v0.2");
const fixtureDirectory = path.join(contractDirectory, "fixtures");

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureDirectory, name), "utf8"));
}

function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .filter((key) => value[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(",")}}`;
}

function withDigest(value) {
  const result = structuredClone(value);
  delete result.payloadDigest;
  result.payloadDigest = `sha256:${crypto
    .createHash("sha256")
    .update(canonicalize(result))
    .digest("hex")}`;
  return result;
}

class PilotTransportOracle {
  commands = new Map();
  receipts = new Map();
  tasks = new Map();
  deliverableAssets = new Set();
  reservations = new Map();
  domainWrites = 0;

  reserve(command) {
    this.reservations.set(command.reservationReference, "reserved");
  }

  receiveCommand(command) {
    const key = `${command.tenantId}:GenerationTaskCommand:${command.idempotencyKey}`;
    const existing = this.commands.get(key);
    if (existing) {
      if (existing.payloadDigest !== command.payloadDigest) {
        return { status: "conflict", code: "IDEMPOTENCY_CONFLICT" };
      }
      return { ...existing.result, replay: true };
    }
    const result = { status: "accepted", replay: false };
    this.commands.set(key, { payloadDigest: command.payloadDigest, result });
    this.tasks.set(command.generationTaskId, { status: "accepted", command });
    this.reserve(command);
    this.domainWrites += 1;
    return result;
  }

  receiveReceipt(receipt) {
    const existing = this.receipts.get(receipt.receiptId);
    if (existing) {
      if (existing.payloadDigest !== receipt.payloadDigest) {
        return { status: "rejected", durablyRecorded: false, code: "RECEIPT_REPLAY_CONFLICT" };
      }
      return { status: "duplicate", durablyRecorded: true };
    }

    if (receipt.generationTaskId && !this.tasks.has(receipt.generationTaskId)) {
      return { status: "rejected", durablyRecorded: false, code: "RECEIPT_TASK_NOT_FOUND" };
    }

    this.receipts.set(receipt.receiptId, {
      payloadDigest: receipt.payloadDigest,
      objectType: receipt.objectType,
    });
    this.domainWrites += 1;

    if (receipt.objectType === "TaskReceipt") {
      const current = this.tasks.get(receipt.generationTaskId);
      const terminal = ["succeeded", "failed", "cancelled", "timed_out"];
      if (!terminal.includes(current.status)) current.status = receipt.status;
      if (["failed", "cancelled", "timed_out"].includes(receipt.status)) {
        this.reservations.set(current.command.reservationReference, "released");
      }
    }
    if (receipt.objectType === "AssetReceipt" && receipt.deliverable) {
      this.deliverableAssets.add(receipt.assetId);
    }
    if (receipt.objectType === "UsageReceipt") {
      const allDeliverable = receipt.deliverableAssetIds.every((assetId) =>
        this.deliverableAssets.has(assetId));
      if (receipt.customerSettlement.eligibility === "eligible" && allDeliverable) {
        this.reservations.set(receipt.reservationReference, "consumed");
      } else if (receipt.customerSettlement.eligibility === "not_eligible") {
        this.reservations.set(receipt.reservationReference, "released");
      }
    }
    return { status: "accepted", durablyRecorded: true };
  }
}

test("oracle: same command key and digest replays without a second side effect", () => {
  const oracle = new PilotTransportOracle();
  const command = fixture("generation-task-command.json");

  assert.deepEqual(oracle.receiveCommand(command), { status: "accepted", replay: false });
  assert.deepEqual(oracle.receiveCommand(structuredClone(command)), { status: "accepted", replay: true });
  assert.equal(oracle.domainWrites, 1);
});

test("oracle: same command key with a different digest conflicts", () => {
  const oracle = new PilotTransportOracle();
  const command = fixture("generation-task-command.json");
  const conflict = withDigest({
    ...command,
    input: { ...command.input, prompt: "different semantic prompt" },
  });

  oracle.receiveCommand(command);
  assert.deepEqual(oracle.receiveCommand(conflict), {
    status: "conflict",
    code: "IDEMPOTENCY_CONFLICT",
  });
  assert.equal(oracle.domainWrites, 1);
});

test("oracle: receipt ACK, duplicate delivery, and digest conflict are side-effect safe", () => {
  const oracle = new PilotTransportOracle();
  const command = fixture("generation-task-command.json");
  const taskReceipt = fixture("task-receipt.json");
  oracle.receiveCommand(command);

  assert.deepEqual(oracle.receiveReceipt(taskReceipt), {
    status: "accepted",
    durablyRecorded: true,
  });
  const writesAfterAccepted = oracle.domainWrites;
  assert.deepEqual(oracle.receiveReceipt(structuredClone(taskReceipt)), {
    status: "duplicate",
    durablyRecorded: true,
  });
  assert.equal(oracle.domainWrites, writesAfterAccepted);

  const conflict = withDigest({ ...taskReceipt, attempt: taskReceipt.attempt + 1 });
  assert.deepEqual(oracle.receiveReceipt(conflict), {
    status: "rejected",
    durablyRecorded: false,
    code: "RECEIPT_REPLAY_CONFLICT",
  });
  assert.equal(oracle.domainWrites, writesAfterAccepted);
});

test("oracle: task success alone keeps credits reserved until deliverable usage is accepted", () => {
  const oracle = new PilotTransportOracle();
  const command = fixture("generation-task-command.json");
  oracle.receiveCommand(command);
  oracle.receiveReceipt(fixture("task-receipt.json"));

  assert.equal(oracle.reservations.get(command.reservationReference), "reserved");
  oracle.receiveReceipt(fixture("asset-receipt.json"));
  assert.equal(oracle.reservations.get(command.reservationReference), "reserved");
  oracle.receiveReceipt(fixture("usage-receipt.json"));
  assert.equal(oracle.reservations.get(command.reservationReference), "consumed");
});

test("oracle: failed task without a deliverable releases its reservation", () => {
  const oracle = new PilotTransportOracle();
  const command = fixture("generation-task-command.json");
  const taskReceipt = fixture("task-receipt.json");
  const failed = withDigest({
    ...taskReceipt,
    status: "failed",
    outputAssetIds: [],
    error: {
      code: "PROVIDER_FAILED",
      message: "Provider failed without a deliverable.",
      retryable: true,
      category: "provider",
      details: {},
    },
  });
  oracle.receiveCommand(command);
  oracle.receiveReceipt(failed);

  assert.equal(oracle.reservations.get(command.reservationReference), "released");
  assert.equal(oracle.deliverableAssets.size, 0);
});

test("oracle: frozen unknown-task rejection is non-durable and enumeration-safe", () => {
  const schema = JSON.parse(fs.readFileSync(
    path.join(contractDirectory, "pilot-contract-v0.2.schema.json"),
    "utf8",
  ));
  const errorCodes = schema.$defs.standardErrorValue.properties.code.enum;
  assert.equal(errorCodes.includes("RECEIPT_TASK_NOT_FOUND"), true);

  const oracle = new PilotTransportOracle();
  const unknownTaskReceipt = withDigest({
    ...fixture("task-receipt.json"),
    receiptId: "receipt-task-unknown",
    generationTaskId: "task-unknown",
    idempotencyKey: "receipt-task-unknown-v1",
  });
  assert.deepEqual(oracle.receiveReceipt(unknownTaskReceipt), {
    status: "rejected",
    durablyRecorded: false,
    code: "RECEIPT_TASK_NOT_FOUND",
  });
});
