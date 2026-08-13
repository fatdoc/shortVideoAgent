import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  assertCanvasAssetMaterializationMatchesRequest,
  CanvasWorkspaceContractError,
  decideCanvasAssetMaterializationReplay,
  parseCanvasAssetMaterializationRequestV01,
  parseCanvasAssetMaterializationV01,
  parseCanvasWorkspaceV01,
} from "./workspaceMaterialization.js";

type Mutation = { op: "add" | "replace" | "remove"; path: string; value?: unknown };
type Vector = {
  id: string;
  operation: string;
  mutations?: Mutation[];
  expectedCode?: string;
  expectedOutcome?: string;
};

const rootDir = process.cwd().endsWith(path.join("apps", "storycanvas"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();
const contractRoot = path.join(rootDir, "docs/program/contracts/canvas-v1");
const fixture = JSON.parse(fs.readFileSync(path.join(contractRoot, "fixtures/workspace-materialization.json"), "utf8"));
const matrix = JSON.parse(fs.readFileSync(path.join(contractRoot, "workspace-materialization-negative-vectors.json"), "utf8")) as { vectors: Vector[] };

function clone<T>(value: T): T {
  return structuredClone(value);
}

function mutate<T>(value: T, mutations: Mutation[] = []): T {
  const output = clone(value) as unknown;
  for (const mutation of mutations) {
    const segments = mutation.path.split("/").slice(1).map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
    let parent = output as Record<string, unknown> | unknown[];
    for (const segment of segments.slice(0, -1)) {
      parent = (parent as Record<string, unknown>)[segment] as Record<string, unknown> | unknown[];
    }
    const key = segments.at(-1)!;
    if (mutation.op === "remove") {
      if (Array.isArray(parent)) parent.splice(Number(key), 1);
      else delete (parent as Record<string, unknown>)[key];
    } else if (Array.isArray(parent)) {
      if (mutation.op === "add" && Number(key) >= parent.length) parent.push(mutation.value);
      else parent[Number(key)] = mutation.value;
    } else {
      (parent as Record<string, unknown>)[key] = mutation.value;
    }
  }
  return output as T;
}

function codeOf(action: () => unknown): string | null {
  try {
    action();
    return null;
  } catch (error) {
    return error instanceof CanvasWorkspaceContractError ? error.code : String(error);
  }
}

test("Story parser accepts canonical CanvasWorkspace and materialization fixtures", () => {
  assert.deepEqual(parseCanvasWorkspaceV01(fixture.workspaceResponse), fixture.workspaceResponse);
  const request = parseCanvasAssetMaterializationRequestV01(fixture.materializationRequest);
  const response = parseCanvasAssetMaterializationV01(fixture.materializationResponse);
  assert.doesNotThrow(() => assertCanvasAssetMaterializationMatchesRequest(response, request));
});

test("Story parser rejects every executable workspace/materialization negative vector", () => {
  for (const vector of matrix.vectors) {
    let actual: string | null = null;
    if (vector.operation === "parse-workspace") {
      actual = codeOf(() => parseCanvasWorkspaceV01(mutate(fixture.workspaceResponse, vector.mutations)));
    } else if (vector.operation === "parse-materialization-request") {
      actual = codeOf(() => parseCanvasAssetMaterializationRequestV01(mutate(fixture.materializationRequest, vector.mutations)));
    } else if (vector.operation === "parse-materialization-response") {
      actual = codeOf(() => parseCanvasAssetMaterializationV01(mutate(fixture.materializationResponse, vector.mutations)));
    } else if (vector.operation === "materialization-response-match") {
      actual = codeOf(() => assertCanvasAssetMaterializationMatchesRequest(
        parseCanvasAssetMaterializationV01(mutate(fixture.materializationResponse, vector.mutations)),
        parseCanvasAssetMaterializationRequestV01(fixture.materializationRequest),
      ));
    } else if (vector.operation === "materialization-replay") {
      actual = codeOf(() => decideCanvasAssetMaterializationReplay(
        parseCanvasAssetMaterializationRequestV01(fixture.materializationRequest),
        parseCanvasAssetMaterializationRequestV01(mutate(fixture.materializationRequest, vector.mutations)),
      ));
    } else {
      continue;
    }
    assert.equal(actual, vector.expectedCode, vector.id);
  }
});

test("same materialization attempt replays while a new attempt is new work", () => {
  const request = parseCanvasAssetMaterializationRequestV01(fixture.materializationRequest);
  assert.deepEqual(decideCanvasAssetMaterializationReplay(request, request), { outcome: "replay", replayed: true });
  const next = parseCanvasAssetMaterializationRequestV01({
    ...fixture.materializationRequest,
    materializationAttemptId: "20202020-2020-4020-8020-202020202020",
    requestId: "req-canvas-materialization-next",
    occurredAt: "2026-08-14T02:07:00.000Z",
  });
  assert.deepEqual(decideCanvasAssetMaterializationReplay(request, next), { outcome: "new", replayed: false });
});

test("browser workspace parser never accepts the server-only materialization envelope", () => {
  assert.equal(
    codeOf(() => parseCanvasWorkspaceV01(fixture.materializationResponse)),
    "CANVAS_WORKSPACE_BROWSER_UNSAFE",
  );
});
