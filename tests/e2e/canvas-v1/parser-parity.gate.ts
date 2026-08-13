import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as backendNamespace from "../../../apps/storycanvas/src/contracts/canvas-v1/index.js";
import {
  assertCanvasDocumentVersion as assertFrontendDocumentVersion,
  assertCanvasScope as assertFrontendScope,
  assertCanvasSessionActive as assertFrontendSessionActive,
  decideCanvasCommandReplay as decideFrontendReplay,
  parseCanvasV1BrowserContract as parseFrontendBrowserContract,
  parseCanvasV1Contract as parseFrontendContract,
  restoreCanvasDocumentForSession as restoreFrontendDocument,
} from "../../../src/features/canvas-v1/model/contracts.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const contractDir = path.join(rootDir, "docs/program/contracts/canvas-v1");
const matrix = JSON.parse(fs.readFileSync(path.join(contractDir, "negative-vectors.json"), "utf8"));
const loadFixture = (fileName: string) =>
  JSON.parse(fs.readFileSync(path.join(contractDir, "fixtures", fileName), "utf8"));

type Mutation = { op: "add" | "replace" | "remove"; path: string; value?: unknown };
type ContractApi = {
  parseCanvasV1Contract: (input: unknown) => any;
  parseCanvasV1BrowserContract: (input: unknown) => any;
  assertCanvasScope: (value: any, expected: any) => void;
  assertCanvasDocumentVersion: (value: any, expectedVersion: number) => void;
  assertCanvasSessionActive: (active: boolean) => void;
  decideCanvasCommandReplay: (existing: any, incoming: any) => any;
  restoreCanvasDocumentForSession: (value: any, sessionId: string) => any;
};

const backend = ((backendNamespace as any).default ?? backendNamespace) as ContractApi;
const frontend: ContractApi = {
  parseCanvasV1Contract: parseFrontendContract,
  parseCanvasV1BrowserContract: parseFrontendBrowserContract,
  assertCanvasScope: assertFrontendScope,
  assertCanvasDocumentVersion: assertFrontendDocumentVersion,
  assertCanvasSessionActive: assertFrontendSessionActive,
  decideCanvasCommandReplay: decideFrontendReplay,
  restoreCanvasDocumentForSession: restoreFrontendDocument,
};

function mutate(source: unknown, mutations: Mutation[] = []) {
  const output = structuredClone(source) as Record<string, unknown>;
  for (const mutation of mutations) {
    const parts = mutation.path
      .slice(1)
      .split("/")
      .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
    const leaf = parts.pop()!;
    let parent: any = output;
    for (const part of parts) parent = parent[part];
    if (mutation.op === "remove") delete parent[leaf];
    else parent[leaf] = structuredClone(mutation.value);
  }
  return output;
}

function runVector(api: ContractApi, vector: any) {
  const fixture = mutate(loadFixture(vector.fixture), vector.mutations);
  switch (vector.operation) {
    case "parse":
      return api.parseCanvasV1Contract(fixture);
    case "parseBrowser":
      return api.parseCanvasV1BrowserContract(fixture);
    case "assertScope":
      return api.assertCanvasScope(api.parseCanvasV1Contract(fixture), vector.expectedScope);
    case "decideReplay":
      return api.decideCanvasCommandReplay(
        api.parseCanvasV1Contract(fixture),
        api.parseCanvasV1Contract(mutate(loadFixture(vector.fixture), vector.relatedMutations)),
      );
    case "assertDocumentVersion":
      return api.assertCanvasDocumentVersion(api.parseCanvasV1Contract(fixture), vector.expectedVersion);
    case "assertSessionActive":
      return api.assertCanvasSessionActive(vector.sessionActive);
    default:
      throw new Error(`unknown conformance operation ${vector.operation}`);
  }
}

function captureStableCode(api: ContractApi, vector: any) {
  try {
    runVector(api, vector);
    return null;
  } catch (error) {
    assert.ok(error instanceof Error, `${vector.id}: non-Error rejection`);
    assert.equal(error.name, "CanvasV1ContractError", `${vector.id}: wrong error class`);
    return (error as Error & { code?: string }).code ?? null;
  }
}

test("frontend and backend preserve all nine canonical fixtures byte-for-data", () => {
  assert.equal(Object.keys(matrix.fixtureFiles).length, 9);
  for (const [objectType, fileName] of Object.entries(matrix.fixtureFiles) as Array<[string, string]>) {
    const fixture = loadFixture(fileName);
    assert.deepEqual(backend.parseCanvasV1Contract(fixture), fixture, `backend ${objectType}`);
    assert.deepEqual(frontend.parseCanvasV1Contract(fixture), fixture, `frontend ${objectType}`);
    assert.deepEqual(backend.parseCanvasV1Contract(fixture), frontend.parseCanvasV1Contract(fixture), objectType);
  }
});

test("frontend and backend enforce the same browser-safe/server-only boundary", () => {
  assert.equal(matrix.browserSafeObjectTypes.length, 8);
  for (const objectType of matrix.browserSafeObjectTypes as string[]) {
    const fixture = loadFixture(matrix.fixtureFiles[objectType]);
    assert.deepEqual(backend.parseCanvasV1BrowserContract(fixture), fixture, `backend ${objectType}`);
    assert.deepEqual(frontend.parseCanvasV1BrowserContract(fixture), fixture, `frontend ${objectType}`);
  }

  const serverFixture = loadFixture(matrix.fixtureFiles.ProviderAssetBinding);
  for (const [plane, api] of [["backend", backend], ["frontend", frontend]] as const) {
    assert.throws(
      () => api.parseCanvasV1BrowserContract(serverFixture),
      (error: unknown) =>
        error instanceof Error &&
        error.name === "CanvasV1ContractError" &&
        (error as Error & { code?: string }).code === "CANVAS_BROWSER_PROJECTION_UNSAFE",
      `${plane} accepted ProviderAssetBinding in a browser projection`,
    );
  }
});

for (const vector of matrix.vectors) {
  test(`stable frontend/backend code: ${vector.id}`, () => {
    const backendCode = captureStableCode(backend, vector);
    const frontendCode = captureStableCode(frontend, vector);
    assert.equal(backendCode, vector.expectedCode, `backend ${vector.id}`);
    assert.equal(frontendCode, vector.expectedCode, `frontend ${vector.id}`);
    assert.equal(frontendCode, backendCode, `plane mismatch ${vector.id}`);
  });
}

test("frontend and backend replay the same command without a provider side effect", () => {
  const replayCase = matrix.positiveSemanticCases.find((item: any) => item.operation === "decideReplay");
  const fixture = loadFixture(replayCase.fixture);
  for (const [plane, api] of [["backend", backend], ["frontend", frontend]] as const) {
    const command = api.parseCanvasV1Contract(fixture);
    assert.deepEqual(
      api.decideCanvasCommandReplay(command as never, command as never),
      { outcome: "replay", replayed: true },
      plane,
    );
  }
});

test("frontend and backend restore one stable document under the new session", () => {
  const recoveryCase = matrix.positiveSemanticCases.find((item: any) => item.operation === "restoreDocument");
  const fixture = loadFixture(recoveryCase.fixture);
  const backendDocument = backend.parseCanvasV1Contract(fixture);
  const frontendDocument = frontend.parseCanvasV1Contract(fixture);
  const backendRestored = backend.restoreCanvasDocumentForSession(backendDocument, recoveryCase.newCanvasSessionId);
  const frontendRestored = frontend.restoreCanvasDocumentForSession(frontendDocument, recoveryCase.newCanvasSessionId);
  assert.deepEqual(frontendRestored, backendRestored);
  assert.equal(backendRestored.documentId, fixture.documentId);
  assert.equal(backendRestored.version, fixture.version);
  assert.equal(backendRestored.canvasSessionId, recoveryCase.newCanvasSessionId);
});
