import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  CanvasV1ContractError,
  assertCanvasDocumentVersion,
  assertCanvasScope,
  assertCanvasSessionActive,
  decideCanvasCommandReplay,
  parseCanvasV1BrowserContract,
  parseCanvasV1Contract,
  restoreCanvasDocumentForSession,
} from "./index.js";

const rootDir = process.cwd().endsWith(path.join("apps", "storycanvas"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();
const contractDir = path.join(rootDir, "docs/program/contracts/canvas-v1");
const matrix = JSON.parse(fs.readFileSync(path.join(contractDir, "negative-vectors.json"), "utf8"));
const loadFixture = (fileName: string) =>
  JSON.parse(fs.readFileSync(path.join(contractDir, "fixtures", fileName), "utf8"));

type Mutation = { op: "add" | "replace" | "remove"; path: string; value?: unknown };

function mutate(source: unknown, mutations: Mutation[] = []) {
  const output = structuredClone(source) as Record<string, unknown>;
  for (const mutation of mutations) {
    const parts = mutation.path.slice(1).split("/");
    const leaf = parts.pop()!;
    let parent: any = output;
    for (const part of parts) parent = parent[part];
    if (mutation.op === "remove") delete parent[leaf];
    else parent[leaf] = structuredClone(mutation.value);
  }
  return output;
}

function runVector(vector: any) {
  const fixture = mutate(loadFixture(vector.fixture), vector.mutations);
  switch (vector.operation) {
    case "parse":
      return parseCanvasV1Contract(fixture);
    case "parseBrowser":
      return parseCanvasV1BrowserContract(fixture);
    case "assertScope":
      return assertCanvasScope(parseCanvasV1Contract(fixture), vector.expectedScope);
    case "decideReplay":
      return decideCanvasCommandReplay(
        parseCanvasV1Contract(fixture),
        parseCanvasV1Contract(mutate(loadFixture(vector.fixture), vector.relatedMutations)),
      );
    case "assertDocumentVersion":
      return assertCanvasDocumentVersion(parseCanvasV1Contract(fixture), vector.expectedVersion);
    case "assertSessionActive":
      return assertCanvasSessionActive(vector.sessionActive);
    default:
      throw new Error(`unknown conformance operation ${vector.operation}`);
  }
}

test("backend parser accepts all nine canonical fixtures without transformation", () => {
  for (const fileName of Object.values(matrix.fixtureFiles) as string[]) {
    const fixture = loadFixture(fileName);
    assert.deepEqual(parseCanvasV1Contract(fixture), fixture, fileName);
  }
});

test("backend parser accepts the canonical blocked readiness with a missing binding", () => {
  const fileName = matrix.additionalPositiveFixtures.ShotReadinessBindingMissing;
  const fixture = loadFixture(fileName);
  assert.deepEqual(parseCanvasV1Contract(fixture), fixture);
  assert.equal(fixture.requirements[0].entityBindingStatus, null);
  assert.deepEqual(fixture.reasonCodes, ["ENTITY_BINDING_MISSING"]);
});

test("backend browser parser accepts only the eight safe projections", () => {
  for (const objectType of matrix.browserSafeObjectTypes as string[]) {
    const fixture = loadFixture(matrix.fixtureFiles[objectType]);
    assert.deepEqual(parseCanvasV1BrowserContract(fixture), fixture, objectType);
  }
  assert.throws(
    () => parseCanvasV1BrowserContract(loadFixture(matrix.fixtureFiles.ProviderAssetBinding)),
    (error: unknown) => error instanceof CanvasV1ContractError && error.code === "CANVAS_BROWSER_PROJECTION_UNSAFE",
  );
});

test("backend parser rejects every frozen negative vector with its stable code", () => {
  for (const vector of matrix.vectors) {
    assert.throws(
      () => runVector(vector),
      (error: unknown) =>
        error instanceof CanvasV1ContractError && error.code === vector.expectedCode,
      vector.id,
    );
  }
});

test("backend replay and new-session document recovery semantics are frozen", () => {
  const replayCase = matrix.positiveSemanticCases.find((item: any) => item.operation === "decideReplay");
  const command = parseCanvasV1Contract(loadFixture(replayCase.fixture));
  assert.deepEqual(decideCanvasCommandReplay(command, command), { outcome: "replay", replayed: true });

  const recoveryCase = matrix.positiveSemanticCases.find((item: any) => item.operation === "restoreDocument");
  const document = parseCanvasV1Contract(loadFixture(recoveryCase.fixture));
  if (document.objectType !== "CanvasDocument") throw new Error("document recovery fixture has wrong objectType");
  const restored = restoreCanvasDocumentForSession(document, recoveryCase.newCanvasSessionId);
  assert.equal(restored.documentId, document.documentId);
  assert.equal(restored.version, document.version);
  assert.equal(restored.canvasSessionId, recoveryCase.newCanvasSessionId);
});
