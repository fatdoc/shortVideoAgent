import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const schema = read("workspace-materialization.schema.json");
const fixture = read("fixtures/workspace-materialization.json");
const negative = read("workspace-materialization-negative-vectors.json");

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sessionId = /^pcs_[A-Za-z0-9_-]{24,128}$/;
const controlledMedia = /^\/(?:api\/canvas-v1|api\/production\/pilot\/canvas\/v1\/media)\/[A-Za-z0-9_./%-]+$/;

function exact(value, keys) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
}

function walk(value, visit, location = "payload") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    visit(key, child, `${location}.${key}`);
    walk(child, visit, `${location}.${key}`);
  }
}

function commonScope(value, expected) {
  for (const key of ["tenantId", "projectId", "packageId", "canvasSessionId"]) {
    assert.equal(value[key], expected[key], `${key} scope mismatch`);
  }
}

function magicMime(content) {
  if (content.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "image/png";
  if (content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) return "image/jpeg";
  if (content.length >= 12 && content.toString("ascii", 0, 4) === "RIFF" && content.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

test("additive schema references the frozen nine-object Canvas V1 domain instead of redefining it", () => {
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(Object.keys(schema.properties).sort(), [
    "materializationError",
    "materializationRequest",
    "materializationResponse",
    "workspaceResponse",
  ]);
  assert.equal(
    schema.$defs.canvasWorkspace.properties.bootstrap.$ref,
    "canvas-v1.schema.json#/$defs/canvasBootstrap",
  );
  assert.equal(
    schema.$defs.canvasWorkspace.properties.document.$ref,
    "canvas-v1.schema.json#/$defs/canvasDocument",
  );
  assert.equal(
    schema.$defs.shotView.properties.requirements.items.$ref,
    "canvas-v1.schema.json#/$defs/shotAssetRequirement",
  );
  assert.equal(
    schema.$defs.shotView.properties.readiness.$ref,
    "canvas-v1.schema.json#/$defs/shotReadiness",
  );
  assert.equal(
    schema.$defs.shotView.properties.event.oneOf[0].$ref,
    "canvas-v1.schema.json#/$defs/canvasEvent",
  );
});

test("CanvasWorkspace/0.1 is a complete, browser-safe CanvasV1Page hydration envelope", () => {
  const workspace = fixture.workspaceResponse;
  exact(workspace, [
    "objectType", "contractVersion", "tenantId", "projectId", "packageId",
    "canvasSessionId", "status", "reasonCodes", "completeness", "project",
    "bootstrap", "document", "shots", "assets", "saveState", "requestId", "occurredAt",
  ]);
  assert.equal(workspace.objectType, "CanvasWorkspace");
  assert.equal(workspace.contractVersion, "0.1");
  assert.match(workspace.tenantId, uuid);
  assert.match(workspace.projectId, uuid);
  assert.match(workspace.packageId, uuid);
  assert.match(workspace.canvasSessionId, sessionId);
  assert.equal(workspace.status, "ready");
  assert.deepEqual(workspace.reasonCodes, []);
  assert.equal(Object.values(workspace.completeness).every(Boolean), true);
  assert.equal(workspace.saveState, "saved");
  assert.match(workspace.project.requestedByActorId, uuid);
  commonScope(workspace.bootstrap, workspace);
  commonScope(workspace.document, workspace);
  assert.equal(workspace.bootstrap.objectType, "CanvasBootstrap");
  assert.equal(workspace.document.objectType, "CanvasDocument");
  assert.equal(workspace.bootstrap.document.documentId, workspace.document.documentId);
  assert.equal(workspace.bootstrap.document.version, workspace.document.version);
});

test("workspace shot views are deterministic projections of approved and persisted facts", () => {
  const workspace = fixture.workspaceResponse;
  assert.equal(workspace.shots.length, workspace.document.shots.length);
  const fullScript = workspace.shots[0].scriptText;
  for (const [index, shot] of workspace.shots.entries()) {
    const documentShot = workspace.document.shots[index];
    assert.equal(shot.shotId, documentShot.shotId);
    assert.equal(shot.sequence, index + 1);
    assert.equal(shot.title, `镜头 ${String(index + 1).padStart(2, "0")}`);
    assert.equal(shot.scriptText, fullScript);
    assert.ok(shot.storyboardText.length > 0);
    assert.ok(shot.durationSeconds > 0);
    for (const requirement of shot.requirements) {
      commonScope(requirement, workspace);
      assert.equal(requirement.shotId, shot.shotId);
      assert.equal(requirement.source.scriptId, workspace.bootstrap.approvedScript.scriptId);
      assert.equal(requirement.source.scriptVersion, workspace.bootstrap.approvedScript.version);
      assert.equal(requirement.source.storyboardId, workspace.bootstrap.approvedStoryboard.storyboardId);
      assert.equal(requirement.source.storyboardVersion, workspace.bootstrap.approvedStoryboard.version);
    }
    commonScope(shot.readiness, workspace);
    assert.equal(shot.readiness.shotId, shot.shotId);
    assert.deepEqual(
      shot.readiness.requirements.map(({ requirementId }) => requirementId),
      shot.requirements.map(({ requirementId }) => requirementId),
    );
    assert.deepEqual(
      shot.requiredAssetLabels,
      [...new Set(shot.requirements.map(({ assetCategory }) => negative.categoryLabels[assetCategory]))],
    );
    const selected = shot.outputs.filter(({ selected }) => selected);
    assert.equal(selected.length, documentShot.selectedOutputAssetId ? 1 : 0);
    assert.equal(selected[0]?.assetId ?? null, documentShot.selectedOutputAssetId);
    assert.equal(shot.thumbnailUrl, selected[0]?.previewUrl ?? null);
    if (shot.thumbnailUrl) assert.match(shot.thumbnailUrl, controlledMedia);
    for (const output of shot.outputs) assert.match(output.previewUrl, controlledMedia);
    if (shot.event) {
      commonScope(shot.event, workspace);
      assert.equal(shot.event.objectType, "CanvasEvent");
      assert.equal(shot.event.commandType, "GENERATE_SHOT");
    }
  }
});

test("workspace assets are the exact safe aggregate and do not overclaim first-day materialization", () => {
  const workspace = fixture.workspaceResponse;
  assert.equal(workspace.assets.length, workspace.bootstrap.assetSummaries.length);
  for (const [index, asset] of workspace.assets.entries()) {
    const summary = workspace.bootstrap.assetSummaries[index];
    for (const key of [
      "assetId", "category", "displayName", "rightsStatus", "approvalStatus",
      "providerStatus", "entityBindingStatus", "controlledPreviewUrl",
    ]) assert.equal(asset[key], summary[key]);
    if (asset.controlledPreviewUrl) assert.match(asset.controlledPreviewUrl, controlledMedia);
    if (asset.category !== "virtual_character") {
      assert.equal(asset.materialization.status, "unsupported");
      assert.equal(asset.materialization.reasonCode, "CATEGORY_UNSUPPORTED");
    }
    if (asset.materialization.status === "ready") {
      assert.equal(asset.category, "virtual_character");
      assert.equal(asset.rightsStatus, "authorized");
      assert.equal(asset.approvalStatus, "approved");
      assert.equal(asset.materialization.reasonCode, null);
    }
  }
});

test("workspace projection contains no server-only materialization or provider authority", () => {
  const forbiddenKeys = new Set(negative.forbiddenWorkspaceKeys.map((value) => value.toLowerCase()));
  const forbiddenValues = negative.forbiddenWorkspaceValuePatterns.map((value) => value.toLowerCase());
  walk(fixture.workspaceResponse, (key, value, location) => {
    assert.equal(forbiddenKeys.has(key.toLowerCase()), false, `${location} is server-only`);
    if (typeof value === "string") {
      assert.equal(
        forbiddenValues.some((pattern) => value.toLowerCase().includes(pattern)),
        false,
        `${location} contains server-only authority`,
      );
    }
  });
});

test("CanvasAssetMaterialization/0.1 carries exact server-only bytes with verified facts", () => {
  const request = fixture.materializationRequest;
  exact(request, [
    "objectType", "contractVersion", "tenantId", "projectId", "packageId",
    "canvasSessionId", "assetId", "actorId", "materializationAttemptId", "requestId", "occurredAt",
  ]);
  assert.equal(request.objectType, "CanvasAssetMaterializationRequest");
  assert.equal(Buffer.byteLength(JSON.stringify(request), "utf8") <= 16 * 1024, true);

  const response = fixture.materializationResponse;
  exact(response, [
    "objectType", "contractVersion", "tenantId", "projectId", "packageId",
    "canvasSessionId", "assetId", "materializationAttemptId", "materializationId",
    "category", "mimeType", "byteSize", "checksum", "contentEncoding", "contentBase64",
    "replayed", "requestId", "occurredAt",
  ]);
  commonScope(response, request);
  assert.equal(response.assetId, request.assetId);
  assert.equal(response.materializationAttemptId, request.materializationAttemptId);
  assert.equal(response.category, "virtual_character");
  assert.equal(response.contentEncoding, "base64");
  const bytes = Buffer.from(response.contentBase64, "base64");
  assert.ok(bytes.length > 0 && bytes.length <= 8 * 1024 * 1024);
  assert.equal(response.byteSize, bytes.length);
  assert.equal(response.mimeType, magicMime(bytes));
  assert.equal(response.checksum, `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`);
});

test("materialization error envelope is fixed and contains no raw authority", () => {
  exact(fixture.materializationError, ["error"]);
  exact(fixture.materializationError.error, ["code", "message", "retryable", "requestId"]);
  const serialized = JSON.stringify(fixture.materializationError).toLowerCase();
  for (const marker of [
    "storagereference", "x-production-plane-internal-token", "authorization", "signedurl",
    "x-tos-", "x-amz-", "packagesnapshot", "contentbase64",
  ]) assert.equal(serialized.includes(marker), false, marker);
});

test("negative vectors freeze workspace, transport, content integrity and persistence boundaries", () => {
  assert.equal(negative.schemaVersion, "canvas-v1-workspace-materialization-negative-vectors.v1");
  const ids = negative.vectors.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  const required = [
    "unknown-top-level", "canonical-timestamp", "calendar-rollover-timestamp",
    "offset-timestamp-drift", "legacy-open-bootstrap", "package-scope-mismatch",
    "document-reference", "shot-sequence", "script-is-not-empty", "requirement-must-bind",
    "readiness-must-bind", "required-labels", "asset-aggregate", "nonvirtual-asset",
    "selected-output", "thumbnail", "signed-url", "event-must-be", "incomplete-assets",
    "package-snapshot", "storage-reference", "materialization-bytes", "request-requires-exact-active-session",
    "same-attempt-changed-project", "internal-auth-runs-before", "body-limit-is-16kib",
    "response-scope", "first-day-only", "must-not-be-empty", "hard-limit-8mib",
    "mime-first-day", "magic-bytes", "byte-size", "checksum", "base64",
    "one-byte-codec", "minimal-three-byte-jpeg", "exact-eight-mib", "eight-mib-plus-one",
    "noncanonical-padding", "preview-url",
    "same-request-replays", "response-loss", "unreadable-source", "checksum-drift",
    "never-echoes", "no-store", "unique-control-asset-mapping", "does-not-overwrite",
    "changed-content-never-overwrites",
  ];
  for (const fragment of required) {
    assert.ok(ids.some((id) => id.includes(fragment)), `missing negative coverage: ${fragment}`);
  }
  assert.ok(negative.vectors.length >= 50);
});
