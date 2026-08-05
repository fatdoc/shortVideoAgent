import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const contractDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(contractDir, "fixtures");
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const objectTypes = [
  "ProjectProductionPackage",
  "ProjectGrant",
  "GenerationTaskCommand",
  "TaskReceipt",
  "AssetReceipt",
  "ExportReceipt",
  "UsageReceipt",
  "StandardError",
  "ReceiptAck",
];
const fixtureFiles = {
  ProjectProductionPackage: "project-production-package.json",
  ProjectGrant: "project-grant.json",
  GenerationTaskCommand: "generation-task-command.json",
  TaskReceipt: "task-receipt.json",
  AssetReceipt: "asset-receipt.json",
  ExportReceipt: "export-receipt.json",
  UsageReceipt: "usage-receipt.json",
  StandardError: "standard-error.json",
  ReceiptAck: "receipt-ack.json",
};
const standardErrorCodes = new Set([
  "SCHEMA_INVALID",
  "TENANT_SCOPE_MISMATCH",
  "PROJECT_SCOPE_MISMATCH",
  "CAPABILITY_SCOPE_DENIED",
  "GRANT_INVALID",
  "GRANT_EXPIRED",
  "IDEMPOTENCY_CONFLICT",
  "PROVIDER_FAILED",
  "STORAGE_FAILED",
  "TASK_TIMEOUT",
  "TASK_CANCELLED",
  "RECEIPT_REPLAY_CONFLICT",
  "CREDIT_SETTLEMENT_FAILED",
]);

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(contractDir, relativePath), "utf8"));
}

function loadFixture(fileName) {
  return loadJson(path.join("fixtures", fileName));
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

function digestPayload(value) {
  const unsigned = structuredClone(value);
  delete unsigned.payloadDigest;
  return `sha256:${crypto.createHash("sha256").update(canonicalize(unsigned)).digest("hex")}`;
}

function requireString(value, field) {
  assert.equal(typeof value, "string", `${field} must be a string`);
  assert.ok(value.length > 0, `${field} must not be empty`);
}

function requireTimestamp(value, field) {
  requireString(value, field);
  assert.match(value, timestampPattern, `${field} must be an UTC ISO timestamp`);
  assert.ok(Number.isFinite(Date.parse(value)), `${field} must parse as a date`);
}

function validateStandardErrorValue(error) {
  assert.ok(error && typeof error === "object", "error must be an object");
  assert.ok(standardErrorCodes.has(error.code), `unknown StandardError code ${error.code}`);
  requireString(error.message, "error.message");
  assert.equal(typeof error.retryable, "boolean", "error.retryable must be boolean");
  requireString(error.category, "error.category");
  assert.ok(error.details && typeof error.details === "object" && !Array.isArray(error.details));
}

function assertNoForbiddenData(value, pathName = "payload") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenData(item, `${pathName}[${index}]`));
    return;
  }
  const forbidden = new Set([
    "apikey",
    "upstreamapikey",
    "providerkey",
    "accesstoken",
    "authorization",
    "credential",
    "wallet",
    "creditledger",
    "ratecard",
    "customerprice",
    "customercredits",
  ]);
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!forbidden.has(key.toLowerCase()), `${pathName}.${key} is forbidden`);
    assertNoForbiddenData(child, `${pathName}.${key}`);
  }
}

function validateEnvelope(value, { verifyDigest = true } = {}) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "payload must be an object");
  assert.ok(objectTypes.includes(value.objectType), "objectType must be registered");
  assert.equal(value.contractVersion, "0.2", "contractVersion must be 0.2");
  for (const key of ["tenantId", "projectId", "idempotencyKey"]) requireString(value[key], key);
  requireTimestamp(value.occurredAt, "occurredAt");
  assert.match(value.payloadDigest, digestPattern, "payloadDigest must be sha256 hex");
  if (verifyDigest) assert.equal(value.payloadDigest, digestPayload(value), "payloadDigest mismatch");
  assertNoForbiddenData(value);
}

function validateFixture(value) {
  validateEnvelope(value);
  switch (value.objectType) {
    case "ProjectProductionPackage": {
      for (const key of ["packageId", "organizationId"]) requireString(value[key], key);
      assert.ok(Number.isInteger(value.packageVersion) && value.packageVersion > 0);
      assert.ok(value.briefSnapshot?.platforms?.length > 0);
      assert.ok(value.brandPolicySnapshot?.facts?.every((fact) => fact.approved === true));
      assert.ok(value.approvedScript?.content?.length > 0);
      assert.ok(value.storyboard?.length > 0);
      assert.equal(new Set(value.storyboard.map((shot) => shot.shotId)).size, value.storyboard.length);
      assert.ok(value.capabilityRequirements?.length > 0);
      requireTimestamp(value.createdAt, "createdAt");
      requireTimestamp(value.expiresAt, "expiresAt");
      assert.ok(Date.parse(value.createdAt) < Date.parse(value.expiresAt));
      break;
    }
    case "ProjectGrant": {
      for (const key of ["grantId", "packageId", "keyId"]) requireString(value[key], key);
      assert.ok(value.capabilities?.length > 0);
      assert.ok(value.scopes?.length > 0);
      assert.match(value.tokenDigest, digestPattern);
      requireTimestamp(value.issuedAt, "issuedAt");
      requireTimestamp(value.expiresAt, "expiresAt");
      assert.ok(Date.parse(value.issuedAt) < Date.parse(value.expiresAt));
      break;
    }
    case "GenerationTaskCommand": {
      for (const key of ["generationTaskId", "packageId", "grantId", "shotId", "reservationReference"]) requireString(value[key], key);
      assert.equal(value.taskType, value.capability);
      requireString(value.input?.prompt, "input.prompt");
      assert.ok(Array.isArray(value.input?.referenceAssetIds));
      requireTimestamp(value.createdAt, "createdAt");
      requireTimestamp(value.expiresAt, "expiresAt");
      assert.ok(Date.parse(value.createdAt) < Date.parse(value.expiresAt));
      break;
    }
    case "TaskReceipt": {
      for (const key of ["receiptId", "generationTaskId", "shotId"]) requireString(value[key], key);
      assert.ok(Number.isInteger(value.attempt) && value.attempt > 0);
      if (value.status === "succeeded") {
        assert.equal(value.progress, 100);
        assert.ok(value.outputAssetIds.length > 0);
        assert.equal(value.error, null);
        requireTimestamp(value.completedAt, "completedAt");
      } else if (["failed", "cancelled", "timed_out"].includes(value.status)) {
        assert.deepEqual(value.outputAssetIds, []);
        validateStandardErrorValue(value.error);
      }
      assert.ok(!Object.hasOwn(value, "customerCredits"));
      break;
    }
    case "AssetReceipt": {
      for (const key of ["receiptId", "assetId", "generationTaskId", "shotId", "storageReference"]) requireString(value[key], key);
      assert.match(value.checksum, digestPattern);
      if (value.deliverable) assert.equal(value.reviewStatus, "approved");
      requireTimestamp(value.createdAt, "createdAt");
      break;
    }
    case "ExportReceipt": {
      for (const key of ["receiptId", "exportId", "timelineVersionId"]) requireString(value[key], key);
      assert.ok(value.inputAssetIds.length > 0);
      if (value.status === "succeeded") {
        requireString(value.outputAssetId, "outputAssetId");
        requireString(value.storageReference, "storageReference");
        assert.match(value.checksum, digestPattern);
        assert.equal(value.deliverable, true);
        assert.equal(value.error, null);
      } else {
        assert.equal(value.deliverable, false);
        validateStandardErrorValue(value.error);
      }
      break;
    }
    case "UsageReceipt": {
      for (const key of ["receiptId", "generationTaskId", "reservationReference"]) requireString(value[key], key);
      assert.ok(value.meteredUsage.length > 0);
      assert.ok(!Object.hasOwn(value, "customerPrice"));
      assert.ok(!Object.hasOwn(value, "customerCredits"));
      if (value.customerSettlement.eligibility === "eligible") {
        assert.ok(value.deliverableAssetIds.length > 0, "eligible usage requires a deliverable asset");
        assert.equal(value.customerSettlement.reason, "deliverable_asset_registered");
      } else {
        assert.deepEqual(value.deliverableAssetIds, []);
        assert.equal(value.customerSettlement.reason, "no_deliverable_asset");
      }
      break;
    }
    case "StandardError":
      for (const key of ["errorId", "requestId"]) requireString(value[key], key);
      validateStandardErrorValue(value.error);
      break;
    case "ReceiptAck":
      for (const key of ["ackId", "receiptId"]) requireString(value[key], key);
      assert.match(value.acknowledgedPayloadDigest, digestPattern);
      if (["accepted", "duplicate"].includes(value.status)) {
        assert.equal(value.durablyRecorded, true);
        assert.equal(value.error, null);
      } else {
        assert.equal(value.durablyRecorded, false);
        validateStandardErrorValue(value.error);
      }
      break;
    default:
      assert.fail(`unhandled objectType ${value.objectType}`);
  }
}

function pointerParts(pointer) {
  assert.ok(pointer.startsWith("/"));
  return pointer.slice(1).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function applyMutations(source, mutations = []) {
  const value = structuredClone(source);
  for (const mutation of mutations) {
    const parts = pointerParts(mutation.path);
    const leaf = parts.pop();
    let parent = value;
    for (const part of parts) parent = parent[part];
    if (mutation.op === "remove") delete parent[leaf];
    else if (mutation.op === "replace") parent[leaf] = structuredClone(mutation.value);
    else assert.fail(`unsupported mutation ${mutation.op}`);
  }
  if (Object.hasOwn(value, "payloadDigest")) value.payloadDigest = digestPayload(value);
  return value;
}

function evaluateNegativeVector(vector) {
  const original = loadFixture(vector.subjectFixture);
  const subject = applyMutations(original, vector.mutations);
  const related = vector.relatedFixture
    ? applyMutations(loadFixture(vector.relatedFixture), vector.relatedMutations)
    : null;

  switch (vector.operation) {
    case "validateEnvelope":
      try {
        validateEnvelope(subject);
      } catch {
        return { code: "SCHEMA_INVALID", httpStatus: 422 };
      }
      assert.fail("negative envelope unexpectedly passed");
      break;
    case "authorizeCommand":
      if (subject.tenantId !== related.tenantId) return { code: "TENANT_SCOPE_MISMATCH", httpStatus: 403 };
      if (subject.projectId !== related.projectId) return { code: "PROJECT_SCOPE_MISMATCH", httpStatus: 403 };
      if (subject.grantId !== related.grantId) return { code: "GRANT_INVALID", httpStatus: 401 };
      if (!related.capabilities.includes(subject.capability)) return { code: "CAPABILITY_SCOPE_DENIED", httpStatus: 403 };
      if (Date.parse(vector.evaluatedAt) > Date.parse(related.expiresAt)) return { code: "GRANT_EXPIRED", httpStatus: 410 };
      assert.fail("negative authorization unexpectedly passed");
      break;
    case "replayCommand":
      assert.equal(subject.idempotencyKey, original.idempotencyKey);
      assert.notEqual(subject.payloadDigest, original.payloadDigest);
      return { code: "IDEMPOTENCY_CONFLICT", httpStatus: 409 };
    case "mapStandardError":
      validateFixture(subject);
      return { code: subject.error.code, httpStatus: 502 };
    case "registerAsset":
      if (!subject.storageReference) return { code: "STORAGE_FAILED", httpStatus: 503 };
      assert.fail("negative storage vector unexpectedly passed");
      break;
    case "receiveTaskReceipt":
      validateFixture(subject);
      return { code: subject.error.code, httpStatus: subject.status === "timed_out" ? 504 : 409 };
    case "replayReceipt":
      assert.equal(subject.receiptId, original.receiptId);
      assert.notEqual(subject.payloadDigest, original.payloadDigest);
      return { code: "RECEIPT_REPLAY_CONFLICT", httpStatus: 409 };
    case "settleUsage":
      if (subject.customerSettlement.eligibility === "eligible" && subject.deliverableAssetIds.length === 0) {
        return { code: "CREDIT_SETTLEMENT_FAILED", httpStatus: 422 };
      }
      assert.fail("negative settlement vector unexpectedly passed");
      break;
    default:
      assert.fail(`unhandled negative operation ${vector.operation}`);
  }
}

test("schema and index expose the complete frozen v0.2 surface", () => {
  const schema = loadJson("pilot-contract-v0.2.schema.json");
  const index = loadJson("schema-index.json");
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(index.contractVersion, "0.2");
  assert.deepEqual(Object.keys(index.objects), objectTypes);
  for (const pointer of Object.values(index.objects)) {
    const definition = pointer.split("/").at(-1);
    assert.ok(schema.$defs[definition], `missing schema definition ${definition}`);
  }
  assert.deepEqual(new Set(schema.$defs.standardErrorValue.properties.code.enum), standardErrorCodes);
});

test("all positive fixtures satisfy envelope, digest, security, and object invariants", () => {
  for (const [objectType, fileName] of Object.entries(fixtureFiles)) {
    const fixture = loadFixture(fileName);
    assert.equal(fixture.objectType, objectType);
    validateFixture(fixture);
  }
});

test("positive fixtures form one tenant/project-scoped production chain", () => {
  const fixtures = Object.fromEntries(Object.entries(fixtureFiles).map(([type, file]) => [type, loadFixture(file)]));
  const chain = Object.values(fixtures).filter((value) => value.objectType !== "StandardError");
  assert.equal(new Set(chain.map((value) => value.tenantId)).size, 1);
  assert.equal(new Set(chain.map((value) => value.projectId)).size, 1);
  assert.equal(fixtures.ProjectGrant.packageId, fixtures.ProjectProductionPackage.packageId);
  assert.equal(fixtures.GenerationTaskCommand.packageId, fixtures.ProjectProductionPackage.packageId);
  assert.equal(fixtures.GenerationTaskCommand.grantId, fixtures.ProjectGrant.grantId);
  assert.ok(fixtures.ProjectGrant.capabilities.includes(fixtures.GenerationTaskCommand.capability));
  assert.ok(Date.parse(fixtures.GenerationTaskCommand.expiresAt) <= Date.parse(fixtures.ProjectGrant.expiresAt));
  assert.equal(fixtures.TaskReceipt.generationTaskId, fixtures.GenerationTaskCommand.generationTaskId);
  assert.equal(fixtures.TaskReceipt.shotId, fixtures.GenerationTaskCommand.shotId);
  assert.ok(fixtures.TaskReceipt.outputAssetIds.includes(fixtures.AssetReceipt.assetId));
  assert.equal(fixtures.AssetReceipt.generationTaskId, fixtures.GenerationTaskCommand.generationTaskId);
  assert.ok(fixtures.UsageReceipt.deliverableAssetIds.includes(fixtures.AssetReceipt.assetId));
  assert.equal(fixtures.UsageReceipt.generationTaskId, fixtures.GenerationTaskCommand.generationTaskId);
  assert.ok(fixtures.ExportReceipt.inputAssetIds.includes(fixtures.AssetReceipt.assetId));
  assert.equal(fixtures.ReceiptAck.receiptId, fixtures.UsageReceipt.receiptId);
  assert.equal(fixtures.ReceiptAck.acknowledgedPayloadDigest, fixtures.UsageReceipt.payloadDigest);
});

test("idempotency replay is duplicate only for the same semantic payload", () => {
  const command = loadFixture("generation-task-command.json");
  const replay = structuredClone(command);
  assert.equal(replay.idempotencyKey, command.idempotencyKey);
  assert.equal(replay.payloadDigest, command.payloadDigest);
  const conflict = applyMutations(command, [
    { op: "replace", path: "/input/prompt", value: "A different semantic payload." },
  ]);
  assert.equal(conflict.idempotencyKey, command.idempotencyKey);
  assert.notEqual(conflict.payloadDigest, command.payloadDigest);
});

test("negative vectors deterministically cover every frozen StandardError code", () => {
  const suite = loadJson("negative-vectors.json");
  assert.equal(suite.contractVersion, "0.2");
  const seen = new Set();
  for (const vector of suite.vectors) {
    const actual = evaluateNegativeVector(vector);
    assert.deepEqual(actual, { code: vector.expectedCode, httpStatus: vector.expectedHttpStatus }, vector.caseId);
    seen.add(vector.expectedCode);
  }
  assert.deepEqual(seen, standardErrorCodes);
});
