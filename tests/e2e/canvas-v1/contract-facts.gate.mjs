import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const contractDir = path.join(rootDir, "docs/program/contracts/canvas-v1");
const fixtureDir = path.join(contractDir, "fixtures");
const amendmentFixtureFile = "shot-readiness-binding-missing.json";
const independentTransportFixtureFile = "activation-transport.json";
const additiveWorkspaceFixtureFile = "workspace-materialization.json";

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const schema = readJson(path.join(contractDir, "canvas-v1.schema.json"));
const schemaIndex = readJson(path.join(contractDir, "schema-index.json"));
const matrix = readJson(path.join(contractDir, "negative-vectors.json"));

const expectedDefinitions = [
  "CanvasBootstrap",
  "CanvasDocument",
  "AssetRecord",
  "ProviderAssetBinding",
  "EntityBinding",
  "ShotAssetRequirement",
  "ShotReadiness",
  "CanvasCommand",
  "CanvasEvent",
];
const expectedBrowserSafe = expectedDefinitions.filter((name) => name !== "ProviderAssetBinding");
const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const canonicalTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const canvasSessionId = /^pcs_[A-Za-z0-9_-]{24,128}$/;

function resolveJsonPointer(document, pointer) {
  assert.match(pointer, /^#\//, `JSON pointer must be local: ${pointer}`);
  return pointer
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((value, part) => value?.[part], document);
}

function loadFixture(fileName) {
  return readJson(path.join(fixtureDir, fileName));
}

function walk(value, visitor, currentPath = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, `${currentPath}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      visitor(key, child, `${currentPath}.${key}`);
      walk(child, visitor, `${currentPath}.${key}`);
    }
  }
}

function pointerParts(pointer) {
  assert.match(pointer, /^\/(?:[^/]+(?:\/[^/]+)*)?$/, `invalid mutation pointer ${pointer}`);
  return pointer
    .slice(1)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function applyMutations(source, mutations = []) {
  const output = structuredClone(source);
  for (const mutation of mutations) {
    assert.ok(["add", "replace", "remove"].includes(mutation.op), `unsupported mutation op ${mutation.op}`);
    const parts = pointerParts(mutation.path);
    const leaf = parts.pop();
    let parent = output;
    for (const part of parts) {
      assert.ok(parent !== null && typeof parent === "object" && part in parent, `missing mutation parent ${mutation.path}`);
      parent = parent[part];
    }
    assert.ok(parent !== null && typeof parent === "object", `non-object mutation parent ${mutation.path}`);
    if (mutation.op === "add") {
      assert.ok(!(leaf in parent), `add mutation overwrites existing value ${mutation.path}`);
      parent[leaf] = structuredClone(mutation.value);
    } else if (mutation.op === "replace") {
      assert.ok(leaf in parent, `replace mutation target is absent ${mutation.path}`);
      parent[leaf] = structuredClone(mutation.value);
    } else {
      assert.ok(leaf in parent, `remove mutation target is absent ${mutation.path}`);
      delete parent[leaf];
    }
  }
  return output;
}

test("schema index and aggregate schema resolve the same nine frozen authorities", () => {
  assert.equal(schemaIndex.contractFamily, "Canvas V1");
  assert.equal(schemaIndex.contractVersion, "0.1");
  assert.equal(schemaIndex.schema, "canvas-v1.schema.json");
  assert.deepEqual(Object.keys(schemaIndex.definitions), expectedDefinitions);
  assert.deepEqual(schemaIndex.classification.browserSafe, expectedBrowserSafe);
  assert.deepEqual(schemaIndex.classification.serverOnly, ["ProviderAssetBinding", "HighCostCommandApproval"]);

  const indexedPointers = Object.values(schemaIndex.definitions);
  assert.deepEqual(schema.oneOf.map((entry) => entry.$ref), indexedPointers);
  for (const [objectType, pointer] of Object.entries(schemaIndex.definitions)) {
    const definition = resolveJsonPointer(schema, pointer);
    assert.ok(definition && typeof definition === "object", `${objectType} pointer does not resolve`);
    const declaredType = definition.allOf?.find((entry) => entry?.properties?.objectType)?.properties?.objectType?.const;
    assert.equal(declaredType, objectType, `${objectType} schema does not freeze objectType`);
  }
});

test("nine aggregate fixtures plus the additive amendment fixture are exhaustively catalogued", () => {
  assert.deepEqual(Object.keys(matrix.fixtureFiles), expectedDefinitions);
  const expectedFixtureFiles = [...Object.values(matrix.fixtureFiles), amendmentFixtureFile].sort();
  assert.deepEqual(
    fs.readdirSync(fixtureDir)
      .filter((name) => name.endsWith(".json")
        && name !== independentTransportFixtureFile
        && name !== additiveWorkspaceFixtureFile)
      .sort(),
    expectedFixtureFiles,
  );

  for (const [objectType, fileName] of Object.entries(matrix.fixtureFiles)) {
    const fixture = loadFixture(fileName);
    assert.equal(fixture.objectType, objectType, fileName);
    assert.equal(fixture.contractVersion, schemaIndex.contractVersion, fileName);
    assert.match(fixture.tenantId, canonicalUuid, `${fileName}: tenantId`);
    assert.match(fixture.projectId, canonicalUuid, `${fileName}: projectId`);
    assert.match(fixture.packageId, canonicalUuid, `${fileName}: packageId`);
    assert.match(fixture.canvasSessionId, canvasSessionId, `${fileName}: canvasSessionId`);
    assert.match(fixture.occurredAt, canonicalTimestamp, `${fileName}: occurredAt`);
    assert.ok(resolveJsonPointer(schema, schemaIndex.definitions[objectType]), `${fileName}: missing schema definition`);
  }
});

test("browser-safe fixtures contain no recursively nested authority key or secret-bearing value", () => {
  assert.deepEqual(matrix.browserSafeObjectTypes, expectedBrowserSafe);
  assert.deepEqual(matrix.serverOnlyObjectTypes, ["ProviderAssetBinding"]);
  assert.equal(new Set(matrix.forbiddenBrowserKeys).size, matrix.forbiddenBrowserKeys.length);
  assert.equal(new Set(matrix.forbiddenBrowserValuePatterns).size, matrix.forbiddenBrowserValuePatterns.length);

  const forbiddenKeys = new Set(matrix.forbiddenBrowserKeys.map((key) => key.toLowerCase()));
  const forbiddenValues = matrix.forbiddenBrowserValuePatterns.map((pattern) => pattern.toLowerCase());
  for (const objectType of matrix.browserSafeObjectTypes) {
    walk(loadFixture(matrix.fixtureFiles[objectType]), (key, value, valuePath) => {
      assert.ok(!forbiddenKeys.has(key.toLowerCase()), `${objectType} exposes forbidden key at ${valuePath}`);
      if (typeof value === "string") {
        const normalized = value.toLowerCase();
        for (const marker of forbiddenValues) {
          assert.ok(!normalized.includes(marker), `${objectType} exposes forbidden value at ${valuePath}`);
        }
      }
    });
  }
});

test("all frozen negative vectors are unique, executable mutations with stable fail-closed codes", () => {
  assert.equal(matrix.schemaVersion, "canvas-v1-negative-vectors.v1");
  assert.equal(matrix.vectors.length, 38);
  assert.equal(new Set(matrix.vectors.map((vector) => vector.id)).size, matrix.vectors.length);
  const allowedOperations = new Set([
    "parse",
    "parseBrowser",
    "assertScope",
    "decideReplay",
    "assertDocumentVersion",
    "assertSessionActive",
  ]);

  for (const vector of matrix.vectors) {
    assert.match(vector.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(allowedOperations.has(vector.operation), `${vector.id}: unknown operation`);
    assert.ok(
      [...Object.values(matrix.fixtureFiles), amendmentFixtureFile].includes(vector.fixture),
      `${vector.id}: unknown fixture`,
    );
    assert.match(vector.expectedCode, /^CANVAS_[A-Z0-9_]+$/);

    const mutations = vector.mutations ?? [];
    const original = loadFixture(vector.fixture);
    const mutated = applyMutations(original, mutations);
    if (mutations.length > 0) assert.notDeepEqual(mutated, original, `${vector.id}: mutation is a no-op`);

    if (vector.operation === "parseBrowser") {
      assert.equal(vector.expectedCode, "CANVAS_BROWSER_PROJECTION_UNSAFE", vector.id);
    }
    if (vector.operation === "decideReplay") {
      assert.ok(Array.isArray(vector.relatedMutations) && vector.relatedMutations.length > 0, vector.id);
      assert.notDeepEqual(applyMutations(original, vector.relatedMutations), original, vector.id);
    }
  }
});

test("missing-binding amendment fixture is blocked with the frozen deterministic reason", () => {
  const fixture = loadFixture(amendmentFixtureFile);
  assert.equal(fixture.objectType, "ShotReadiness");
  assert.equal(fixture.ready, false);
  assert.equal(fixture.requirements.length, 1);
  assert.equal(fixture.requirements[0].entityBindingStatus, null);
  assert.deepEqual(fixture.requirements[0].reasonCodes, ["ENTITY_BINDING_MISSING"]);
  assert.deepEqual(fixture.reasonCodes, ["ENTITY_BINDING_MISSING"]);
});

test("readiness reason precedence and positive recovery cases are deterministic", () => {
  assert.equal(matrix.reasonCodeOrder.length, 20);
  assert.equal(new Set(matrix.reasonCodeOrder).size, matrix.reasonCodeOrder.length);
  assert.deepEqual(schema.$defs.reasonCode.enum, matrix.reasonCodeOrder);
  assert.deepEqual(
    matrix.positiveSemanticCases.map(({ id, operation, expected }) => ({ id, operation, expected })),
    [
      {
        id: "same-command-replays-without-provider-side-effect",
        operation: "decideReplay",
        expected: "replay",
      },
      {
        id: "new-valid-session-restores-stable-document",
        operation: "restoreDocument",
        expected: "allowed",
      },
    ],
  );
});

test("CV1-C execution-plane artifacts remain mandatory for behavioral conformance", () => {
  const requiredArtifacts = [
    "apps/storycanvas/src/contracts/canvas-v1/index.ts",
    "src/features/canvas-v1/model/contracts.ts",
  ];
  const missing = requiredArtifacts.filter((relativePath) => !fs.existsSync(path.join(rootDir, relativePath)));
  assert.deepEqual(missing, [], `CANVAS_V1_EXECUTION_PLANES_NOT_IMPLEMENTED: ${missing.join(", ")}`);
});
