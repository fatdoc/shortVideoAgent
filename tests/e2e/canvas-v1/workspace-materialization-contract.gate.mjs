import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const contractDir = path.join(rootDir, "docs/program/contracts/canvas-v1");
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(contractDir, name), "utf8"));
const schema = readJson("workspace-materialization.schema.json");
const fixture = readJson("fixtures/workspace-materialization.json");
const matrix = readJson("workspace-materialization-negative-vectors.json");

const controlledMedia = /^\/(?:api\/canvas-v1|api\/production\/pilot\/canvas\/v1\/media)\/[A-Za-z0-9_./%-]+$/;

function walk(value, visitor, location = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    visitor(key, child, `${location}.${key}`);
    walk(child, visitor, `${location}.${key}`);
  }
}

function magicMime(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

test("additive schema is strict, references the nine-object domain, and classifies bytes server-only", () => {
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(Object.keys(schema.properties).sort(), [
    "materializationError",
    "materializationRequest",
    "materializationResponse",
    "workspaceResponse",
  ]);
  assert.equal(schema.$defs.canvasWorkspace.additionalProperties, false);
  assert.equal(schema.$defs.canvasWorkspace.properties.bootstrap.$ref, "canvas-v1.schema.json#/$defs/canvasBootstrap");
  assert.equal(schema.$defs.canvasWorkspace.properties.document.$ref, "canvas-v1.schema.json#/$defs/canvasDocument");
  assert.equal(schema.$defs.shotView.properties.requirements.items.$ref, "canvas-v1.schema.json#/$defs/shotAssetRequirement");
  assert.equal(schema.$defs.shotView.properties.readiness.$ref, "canvas-v1.schema.json#/$defs/shotReadiness");
  assert.equal(schema.$defs.materializationResponse.additionalProperties, false);
  assert.deepEqual(schema.$defs.materializationResponse.properties.category, { const: "virtual_character" });
  assert.deepEqual(schema.$defs.materializationResponse.properties.mimeType.enum, ["image/jpeg", "image/png", "image/webp"]);
  assert.equal(schema.$defs.materializationResponse.properties.byteSize.maximum, 8 * 1024 * 1024);
  assert.equal(schema.$defs.materializationResponse.properties.contentBase64.maxLength, 11_184_812);
});

test("canonical workspace supplies every CanvasV1Page server fact without fallback values", () => {
  const workspace = fixture.workspaceResponse;
  const taskEvents = Object.fromEntries(
    workspace.shots.flatMap((shot) => shot.event === null ? [] : [[shot.shotId, shot.event]]),
  );
  const pageFacts = {
    projectName: workspace.project.projectName,
    loadState: "loaded",
    bootstrap: workspace.bootstrap,
    document: workspace.document,
    shots: workspace.shots,
    assets: workspace.assets,
    taskEvents,
    saveState: workspace.saveState,
    commandContext: { requestedByActorId: workspace.project.requestedByActorId },
  };

  assert.equal(pageFacts.projectName, "门店探店获客视频");
  assert.notEqual(pageFacts.projectName, "门店探店视频");
  assert.equal(pageFacts.bootstrap, workspace.bootstrap);
  assert.equal(pageFacts.document, workspace.document);
  assert.equal(pageFacts.shots, workspace.shots);
  assert.equal(pageFacts.assets, workspace.assets);
  assert.equal(pageFacts.commandContext.requestedByActorId, workspace.project.requestedByActorId);
  assert.deepEqual(Object.keys(taskEvents), workspace.shots.filter(({ event }) => event !== null).map(({ shotId }) => shotId));
  for (const shot of workspace.shots) {
    assert.deepEqual(taskEvents[shot.shotId], shot.event ?? undefined, `${shot.shotId}: event must bind through its parent shot`);
  }
});

test("workspace recursively excludes provider, storage, signed URL, raw bytes and internal authority", () => {
  const forbiddenKeys = new Set(matrix.forbiddenWorkspaceKeys.map((value) => value.toLowerCase()));
  const forbiddenValues = matrix.forbiddenWorkspaceValuePatterns.map((value) => value.toLowerCase());
  walk(fixture.workspaceResponse, (key, value, location) => {
    assert.equal(forbiddenKeys.has(key.toLowerCase()), false, `${location}: forbidden key`);
    if (typeof value === "string") {
      assert.equal(forbiddenValues.some((marker) => value.toLowerCase().includes(marker)), false, `${location}: forbidden value`);
      if (key === "previewUrl" || key === "thumbnailUrl" || key === "controlledPreviewUrl") {
        if (value !== null) assert.match(value, controlledMedia, location);
      }
    }
  });
  const serialized = JSON.stringify(fixture.workspaceResponse).toLowerCase();
  for (const marker of ["asset://", "contentbase64", "storagereference", "signedurl", "x-tos-", "x-amz-"]) {
    assert.equal(serialized.includes(marker), false, marker);
  }
});

test("workspace completeness and ordered blocked reasons fail closed for every incomplete source", () => {
  const expectedOrder = [
    "WORKSPACE_CAPABILITY_BLOCKED",
    "WORKSPACE_SHOT_BLOCKED",
    "WORKSPACE_ASSET_AGGREGATE_INCOMPLETE",
    "WORKSPACE_REQUIREMENTS_INCOMPLETE",
    "WORKSPACE_READINESS_INCOMPLETE",
    "WORKSPACE_OUTPUTS_INCOMPLETE",
    "WORKSPACE_EVENTS_INCOMPLETE",
    "WORKSPACE_CONTROLLED_MEDIA_INCOMPLETE",
  ];
  assert.deepEqual(matrix.workspaceReasonCodeOrder, expectedOrder);
  assert.deepEqual(schema.$defs.workspaceReasonCode.enum, expectedOrder);
  assert.deepEqual(Object.keys(fixture.workspaceResponse.completeness), [
    "assets", "requirements", "readiness", "outputs", "events", "controlledMedia",
  ]);
  assert.equal(Object.values(fixture.workspaceResponse.completeness).every(Boolean), true);
  const completenessVectors = matrix.vectors.filter(({ id }) => id.includes("incomplete-") || id.includes("cannot-hide-reason"));
  assert.ok(completenessVectors.length >= 2);
});

test("materialization fixture derives exact magic MIME, byte size, checksum and canonical base64", () => {
  const response = fixture.materializationResponse;
  const bytes = Buffer.from(response.contentBase64, "base64");
  assert.equal(bytes.toString("base64"), response.contentBase64);
  assert.equal(bytes.length, response.byteSize);
  assert.equal(magicMime(bytes), response.mimeType);
  assert.equal(`sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`, response.checksum);
  assert.ok(bytes.length > 0 && bytes.length <= 8 * 1024 * 1024);
  assert.equal(4 * Math.ceil((8 * 1024 * 1024) / 3), 11_184_812);
  assert.equal(Buffer.byteLength(JSON.stringify(fixture.materializationRequest), "utf8") < 16 * 1024, true);
});

test("all 61 vectors uniquely freeze parser, auth ordering, bytes, replay, no-store and persistence", () => {
  assert.equal(matrix.schemaVersion, "canvas-v1-workspace-materialization-negative-vectors.v1");
  assert.equal(matrix.vectors.length, 61);
  assert.equal(new Set(matrix.vectors.map(({ id }) => id)).size, 61);
  const operations = new Set(matrix.vectors.map(({ operation }) => operation));
  assert.deepEqual(operations, new Set([
    "parse-workspace",
    "parse-materialization-request",
    "materialization-replay",
    "transport-only",
    "parse-materialization-response",
    "materialization-response-match",
    "materialization-replay-same",
    "persistence-only",
  ]));
  const byId = new Map(matrix.vectors.map((vector) => [vector.id, vector]));
  assert.equal(byId.get("materialization-internal-auth-runs-before-json-parser")?.expectedCode, "CANVAS_MATERIALIZATION_INTERNAL_AUTH_INVALID");
  assert.equal(byId.get("materialization-request-body-limit-is-16kib")?.inputBytes, 16 * 1024 + 1);
  assert.equal(byId.get("materialization-decoded-source-hard-limit-8mib")?.expectedCode, "CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE");
  assert.equal(byId.get("materialization-response-is-no-store")?.requiredHeader, "Cache-Control: no-store");
  assert.equal(byId.get("materialization-response-loss-retries-same-attempt")?.expectedOutcome, "same_authority_facts_replayed");
  assert.deepEqual(byId.get("materialization-story-persists-unique-control-asset-mapping")?.mapping, {
    system: "saas-control-plane",
    entityType: "canvas-v1-asset",
  });
  for (const marker of ["storageReference", "x-production-plane-internal-token"]) {
    assert.ok(matrix.vectors.some(({ forbiddenMarker }) => forbiddenMarker === marker));
  }
});

test("safe materialization error is fixed and cannot echo raw storage, token, provider or byte data", () => {
  assert.deepEqual(Object.keys(fixture.materializationError), ["error"]);
  assert.deepEqual(Object.keys(fixture.materializationError.error).sort(), ["code", "message", "requestId", "retryable"]);
  const serialized = JSON.stringify(fixture.materializationError).toLowerCase();
  for (const marker of [
    "storagereference", "x-production-plane-internal-token", "authorization", "signedurl",
    "contentbase64", "provider", "localpath", "stack",
  ]) assert.equal(serialized.includes(marker), false, marker);
});
