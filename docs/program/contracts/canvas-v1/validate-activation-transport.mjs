import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const schema = read("activation-transport.schema.json");
const fixture = read("fixtures/activation-transport.json");
const negative = read("activation-transport-negative-vectors.json");

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const requestId = /^[A-Za-z0-9._:-]{1,128}$/;
const sessionId = /^pcs_[A-Za-z0-9_-]{24,128}$/;
const handle = /^ce_[A-Za-z0-9_-]{32,64}$/;

function exact(value, keys) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
}

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

function walk(value, visit) {
  if (Array.isArray(value)) return value.forEach((item) => walk(item, visit));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    visit(key, child);
    walk(child, visit);
  }
}

test("activation facade freezes explicit package and one in-memory attempt", () => {
  exact(fixture.activationRequest, ["activationAttemptId"]);
  assert.match(fixture.activationRequest.activationAttemptId, uuid);
  exact(fixture.activationResponse, ["entry", "replayed", "requestId"]);
  assert.equal(typeof fixture.activationResponse.replayed, "boolean");
  assert.match(fixture.activationResponse.requestId, requestId);
  exact(fixture.activationResponse.entry, [
    "objectType", "contractVersion", "handle", "tenantId", "projectId",
    "packageId", "state", "issuedAt", "expiresAt",
  ]);
  assert.equal(fixture.activationResponse.entry.objectType, "CanvasEntry");
  assert.equal(fixture.activationResponse.entry.contractVersion, "0.2");
  assert.match(fixture.activationResponse.entry.handle, handle);
  assert.equal(
    Date.parse(fixture.activationResponse.entry.expiresAt)
      - Date.parse(fixture.activationResponse.entry.issuedAt),
    120_000,
  );
});

test("legacy open is distinct from formal CanvasBootstrap/0.1", () => {
  exact(fixture.legacyOpenRequest, ["handle", "tenantId", "projectId", "packageId"]);
  for (const key of ["handle", "tenantId", "projectId", "packageId"]) {
    assert.equal(fixture.legacyOpenRequest[key], fixture.activationResponse.entry[key]);
  }
  exact(fixture.legacyOpenResponse, [
    "schemaVersion", "status", "projectId", "packageId", "canvasSessionId",
    "expiresAt", "requestId",
  ]);
  assert.equal(fixture.legacyOpenResponse.schemaVersion, "pilot-canvas-bootstrap.v1");
  assert.notEqual(fixture.legacyOpenResponse.schemaVersion, "CanvasBootstrap/0.1");
  assert.match(fixture.legacyOpenResponse.canvasSessionId, sessionId);
  assert.equal(fixture.formalBootstrapResponse.objectType, "CanvasBootstrap");
  assert.equal(fixture.formalBootstrapResponse.contractVersion, "0.1");
  assert.equal(
    fixture.formalBootstrapResponse.canvasSessionId,
    fixture.legacyOpenResponse.canvasSessionId,
  );
  for (const key of ["projectId", "packageId"]) {
    assert.equal(fixture.formalBootstrapResponse[key], fixture.legacyOpenResponse[key]);
  }
});

test("approval prepare fingerprints the exact command submission", () => {
  const prepare = fixture.approvalPrepareRequest;
  const command = fixture.commandDispatchRequest;
  exact(prepare.action, ["commandId", "payload"]);
  assert.equal(prepare.commandType, command.commandType);
  assert.equal(prepare.action.commandId, command.commandId);
  assert.equal(canonical(prepare.action.payload), canonical(command.payload));
  assert.equal(prepare.packageId, command.packageId);
  assert.equal(prepare.canvasSessionId, command.canvasSessionId);
  assert.equal(fixture.approvalPrepareResponse.approvalId, command.approvalId);
  assert.equal(prepare.replayPolicy, "single_use_replay_same_command");
});

test("browser surfaces contain no raw idempotency or server authority fields", () => {
  const forbidden = new Set([
    "idempotencykey", "derivedidempotencykey", "grant", "projectgrant",
    "productionpackage", "packagesnapshot", "accesstoken", "authorization",
    "internaltoken", "payloaddigest", "asseturi", "providerresponse",
  ]);
  for (const surface of [
    fixture.activationRequest,
    fixture.activationResponse,
    fixture.legacyOpenRequest,
    fixture.legacyOpenResponse,
    fixture.formalBootstrapResponse,
    fixture.approvalPrepareRequest,
    fixture.approvalPrepareResponse,
    fixture.commandDispatchRequest,
  ]) {
    walk(surface, (key) => assert.ok(!forbidden.has(key.toLowerCase()), `forbidden ${key}`));
  }
});

test("transport RED matrix freezes every activation and approval boundary", () => {
  assert.equal(negative.schemaVersion, "canvas-v1-activation-transport-negative-vectors.v1");
  assert.equal(negative.fixture, "fixtures/activation-transport.json");
  const ids = negative.vectors.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  const required = [
    "package-query-required",
    "package-selection-never-uses-latest",
    "activation-attempt-not-in-url",
    "activation-attempt-not-in-storage",
    "activation-attempt-not-in-log",
    "raw-idempotency-key-forbidden",
    "idempotency-header-forbidden",
    "one-replay-authority",
    "exact-scope",
    "legacy-open-request-rejects-full-entry-fields",
    "legacy-open-result-is-not-formal-bootstrap",
    "formal-bootstrap-rejects-legacy",
    "explicit-session-header",
    "exact-origin",
    "no-latest-script",
    "no-latest-storyboard",
    "unsynchronized-assets",
    "requires-command-id-and-payload",
    "command-type-must-match",
    "command-id-must-match",
    "payload-must-match",
    "static-generic-approval-forbidden",
  ];
  for (const fragment of required) {
    assert.ok(ids.some((id) => id.includes(fragment)), `missing ${fragment}`);
  }
  assert.equal(negative.vectors.length, 25);
});

test("schema references existing domain contracts without redefining them", () => {
  assert.equal(
    schema.properties.formalBootstrapResponse.$ref,
    "canvas-v1.schema.json#/$defs/canvasBootstrap",
  );
  assert.equal(
    schema.properties.commandDispatchRequest.$ref,
    "canvas-v1.schema.json#/$defs/canvasCommand",
  );
  assert.equal(schema.$defs.activationRequest.additionalProperties, false);
  assert.equal(schema.$defs.activationResponse.additionalProperties, false);
  assert.equal(schema.$defs.approvalPrepareRequest.properties.action.additionalProperties, false);
});
