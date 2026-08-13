import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const contractDir = path.dirname(fileURLToPath(import.meta.url));
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(contractDir, relativePath), "utf8"));

const index = readJson("schema-index.json");
const schema = readJson("canvas-v1.schema.json");
const matrix = readJson("negative-vectors.json");
const fixtures = Object.fromEntries(
  Object.entries(matrix.fixtureFiles).map(([objectType, file]) => [
    objectType,
    readJson(path.join("fixtures", file)),
  ]),
);

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const scopeKeys = ["tenantId", "projectId", "packageId", "canvasSessionId"];

function walk(value, visit, pathName = "payload") {
  if (Array.isArray(value)) {
    value.forEach((child, indexValue) => walk(child, visit, `${pathName}[${indexValue}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    visit(key, child, `${pathName}.${key}`);
    walk(child, visit, `${pathName}.${key}`);
  }
}

test("schema index freezes exactly nine Canvas V1 contracts", () => {
  assert.equal(index.contractVersion, "0.1");
  assert.equal(Object.keys(index.definitions).length, 9);
  assert.deepEqual(Object.keys(index.definitions), Object.keys(matrix.fixtureFiles));
  for (const pointer of Object.values(index.definitions)) {
    const definition = pointer.split("/").at(-1);
    assert.ok(schema.$defs[definition], `missing schema definition ${definition}`);
  }
});

test("canonical fixtures have strict common identity, scope and timestamp forms", () => {
  for (const [objectType, fixture] of Object.entries(fixtures)) {
    assert.equal(fixture.objectType, objectType);
    assert.equal(fixture.contractVersion, "0.1");
    for (const key of scopeKeys.slice(0, 3)) assert.match(fixture[key], uuidPattern, `${objectType}.${key}`);
    assert.match(fixture.canvasSessionId, /^pcs_[A-Za-z0-9_-]{24,128}$/);
    assert.match(fixture.occurredAt, timestampPattern);
    assert.ok(Number.isFinite(Date.parse(fixture.occurredAt)));
  }
});

test("browser fixtures contain neither forbidden keys nor forbidden values", () => {
  const forbiddenKeys = new Set(matrix.forbiddenBrowserKeys.map((key) => key.toLowerCase()));
  const forbiddenValues = matrix.forbiddenBrowserValuePatterns.map((pattern) => pattern.toLowerCase());
  for (const objectType of matrix.browserSafeObjectTypes) {
    walk(fixtures[objectType], (key, value, pathName) => {
      assert.ok(!forbiddenKeys.has(key.toLowerCase()), `${pathName} is forbidden`);
      if (typeof value === "string") {
        const lower = value.toLowerCase();
        assert.ok(!forbiddenValues.some((pattern) => lower.includes(pattern)), `${pathName} contains a forbidden value`);
      }
    });
  }
  assert.equal(fixtures.ProviderAssetBinding.assetUri.startsWith("asset://"), true);
});

test("negative matrix covers every required G1 security and state boundary", () => {
  const ids = matrix.vectors.map((vector) => vector.id);
  assert.equal(new Set(ids).size, ids.length);
  const requiredFragments = [
    "unknown",
    "tenant-scope",
    "project-scope",
    "package-scope",
    "session-scope",
    "rights-pending",
    "rights-revoked",
    "rights-expired",
    "provider-processing",
    "provider-rejected",
    "changed-payload",
    "approval-id",
    "user-confirmed",
    "stale-document",
    "expired-session",
    "provider-submission",
    "receipt-cannot-precede-output",
    "idempotency-key",
    "digest-forbidden",
    "grant-forbidden",
  ];
  for (const fragment of requiredFragments) {
    assert.ok(ids.some((id) => id.includes(fragment)), `missing negative coverage for ${fragment}`);
  }
  assert.equal(matrix.positiveSemanticCases.some((item) => item.id.includes("new-valid-session")), true);
  assert.equal(matrix.positiveSemanticCases.some((item) => item.id.includes("replays")), true);
});

test("ShotReadiness reason codes are unique and fixed in deterministic order", () => {
  assert.equal(new Set(matrix.reasonCodeOrder).size, matrix.reasonCodeOrder.length);
  assert.deepEqual(schema.$defs.reasonCode.enum, matrix.reasonCodeOrder);
});
