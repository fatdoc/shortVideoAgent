import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const schema = read("workspace-authority.schema.json");
const fixture = read("fixtures/workspace-authority.json");
const workspaceFixture = read("fixtures/workspace-materialization.json");
const negative = read("workspace-authority-negative-vectors.json");

const scopeKeys = ["tenantId", "projectId", "packageId", "canvasSessionId"];

function exact(value, keys) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
}

function uuidBytes(value) {
  return Buffer.from(value.replaceAll("-", ""), "hex");
}

function uuidV5(namespace, name) {
  const bytes = crypto.createHash("sha1").update(uuidBytes(namespace)).update(name, "utf8").digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function canonicalName(template, values) {
  return template.replace(/\{([^}]+)\}/g, (_, key) => values[key]);
}

test("authority schema is additive, strict and references browser-safe AssetRecord/0.1", () => {
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(Object.keys(schema.properties).sort(), ["authorityError", "authorityRequest", "authorityResponse"]);
  assert.equal(schema.$defs.response.properties.assets.items.$ref, "canvas-v1.schema.json#/$defs/assetRecord");
  assert.equal(schema.$defs.request.additionalProperties, false);
  assert.equal(schema.$defs.response.additionalProperties, false);
  assert.deepEqual(schema.$defs.response.properties.completeness.properties, {
    project: { const: true },
    approvedScript: { const: true },
    approvedStoryboard: { const: true },
    assets: { const: true },
  });
});

test("authority fixture carries exact scope, package versions and complete safe assets", () => {
  const request = fixture.authorityRequest;
  exact(request, [
    "objectType", "contractVersion", "tenantId", "projectId", "packageId",
    "canvasSessionId", "actorId", "requestId", "occurredAt",
  ]);
  const response = fixture.authorityResponse;
  exact(response, [
    "objectType", "contractVersion", "tenantId", "projectId", "packageId",
    "canvasSessionId", "project", "approvedScript", "approvedStoryboard", "assets",
    "completeness", "requestId", "occurredAt",
  ]);
  for (const key of scopeKeys) assert.equal(response[key], request[key]);
  assert.deepEqual(response.approvedScript, {
    scriptId: "44444444-4444-4444-8444-444444444444",
    version: 3,
  });
  assert.deepEqual(response.approvedStoryboard, {
    storyboardId: "55555555-5555-4555-8555-555555555555",
    version: 2,
  });
  assert.equal(Object.values(response.completeness).every((value) => value === true), true);
  assert.equal(response.assets.filter(({ category }) => category === "virtual_character").length, 1);
});

test("authority assets use fixed category then asset UUID order and contain no server authority", () => {
  const rank = new Map(negative.assetCategoryOrder.map((category, index) => [category, index]));
  const order = fixture.authorityResponse.assets.map(({ category, assetId }) => `${String(rank.get(category)).padStart(2, "0")}:${assetId}`);
  assert.deepEqual(order, [...order].sort());
  const serialized = JSON.stringify(fixture.authorityResponse).toLowerCase();
  for (const key of negative.forbiddenAuthorityKeys) assert.equal(serialized.includes(key.toLowerCase()), false, key);
  for (const asset of fixture.authorityResponse.assets) {
    assert.equal(asset.objectType, "AssetRecord");
    for (const key of scopeKeys) assert.equal(asset[key], fixture.authorityResponse[key]);
  }
});

test("public UUIDv5 namespace and canonical names derive fixture target and requirement IDs", () => {
  const facts = {
    tenantId: fixture.authorityResponse.tenantId,
    projectId: fixture.authorityResponse.projectId,
    packageId: fixture.authorityResponse.packageId,
    assetId: fixture.authorityResponse.assets.find(({ category }) => category === "virtual_character").assetId,
    shotId: workspaceFixture.workspaceResponse.shots[0].shotId,
  };
  const namespace = uuidV5(
    negative.uuidV5.namespaceDerivation.parentNamespace,
    negative.uuidV5.namespaceDerivation.name,
  );
  assert.equal(namespace, negative.uuidV5.namespace);
  const target = uuidV5(namespace, canonicalName(negative.uuidV5.targetEntityCanonicalName, facts));
  const requirement = uuidV5(namespace, canonicalName(negative.uuidV5.requirementCanonicalName, facts));
  assert.equal(target, negative.uuidV5.fixtureTargetEntityId);
  assert.equal(requirement, negative.uuidV5.fixtureRequirementId);
  assert.equal(workspaceFixture.workspaceResponse.assets[0].targetEntityId, target);
  assert.equal(workspaceFixture.workspaceResponse.shots[0].requirements[0].entityId, target);
  assert.equal(workspaceFixture.workspaceResponse.shots[0].requirements[0].requirementId, requirement);
  assert.equal(workspaceFixture.workspaceResponse.shots[0].requirements[0].status, "required");
  assert.deepEqual(workspaceFixture.workspaceResponse.shots[0].requirements[0].requiredCapabilities, ["video_generation"]);
});

test("initial document prompt is exact storyboard description and the casting block is never partial success", () => {
  const workspace = workspaceFixture.workspaceResponse;
  for (const [index, shot] of workspace.shots.entries()) {
    assert.equal(workspace.document.shots[index].prompt, shot.storyboardText);
  }
  assert.deepEqual(workspaceFixture.workspaceError, {
    error: {
      code: "PRIMARY_VIRTUAL_CHARACTER_MISSING",
      message: "A primary virtual character is required.",
      retryable: false,
      requestId: "req-canvas-workspace-blocked-001",
    },
  });
});

test("authority vectors freeze transport, exact package, casting and trusted prepare boundaries", () => {
  assert.equal(negative.schemaVersion, "canvas-v1-workspace-authority-negative-vectors.v1");
  const ids = negative.vectors.map(({ id }) => id);
  assert.equal(ids.length, new Set(ids).size);
  const required = [
    "unknown-field", "canonical-timestamp", "auth-runs-before", "body-limit",
    "scope-mismatch", "project-is-minimal", "exact-id-and-version", "version-is-positive",
    "never-latest", "deterministically-ordered", "storage-reference", "checksum",
    "must-be-asset-record", "match-request-scope", "completeness", "zero-virtual-character",
    "multiple-virtual-character", "never-selects-first", "unique-pending", "target-entity-uuidv5",
    "requirement-uuidv5", "status-is-always-required", "source-uses-authority", "never-auto-approves",
    "prompt-is-exact", "one-transaction", "get-is-read-only", "fixed-409-not-partial-success",
  ];
  for (const fragment of required) assert.ok(ids.some((id) => id.includes(fragment)), fragment);
});
