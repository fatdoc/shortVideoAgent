import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import * as storyNamespace from "../../../apps/storycanvas/src/contracts/canvas-v1/workspaceMaterialization.js";
import { parseCanvasWorkspaceV01 as parseBrowserWorkspace } from "../../../src/features/canvas-v1/model/workspaceContract.js";

type Mutation = { op: "add" | "replace" | "remove"; path: string; value?: unknown };
type Vector = {
  id: string;
  operation: string;
  mutations?: Mutation[];
  expectedCode?: string;
  expectedOutcome?: string;
};

const contractDir = path.resolve(process.cwd(), "docs/program/contracts/canvas-v1");
const fixture = JSON.parse(fs.readFileSync(path.join(contractDir, "fixtures/workspace-materialization.json"), "utf8"));
const matrix = JSON.parse(fs.readFileSync(path.join(contractDir, "workspace-materialization-negative-vectors.json"), "utf8")) as { vectors: Vector[] };
const story = ((storyNamespace as any).default ?? storyNamespace) as typeof storyNamespace;
const {
  assertCanvasAssetMaterializationMatchesRequest,
  decideCanvasAssetMaterializationReplay,
  parseCanvasAssetMaterializationRequestV01,
  parseCanvasAssetMaterializationV01,
  parseCanvasWorkspaceV01: parseStoryWorkspace,
} = story;

function mutate<T>(source: T, mutations: Mutation[] = []): T {
  const output = structuredClone(source) as unknown;
  for (const mutation of mutations) {
    const parts = mutation.path.split("/").slice(1).map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
    let parent = output as Record<string, unknown> | unknown[];
    for (const part of parts.slice(0, -1)) parent = (parent as Record<string, unknown>)[part] as Record<string, unknown> | unknown[];
    const key = parts.at(-1)!;
    if (mutation.op === "remove") {
      if (Array.isArray(parent)) parent.splice(Number(key), 1);
      else delete (parent as Record<string, unknown>)[key];
    } else if (Array.isArray(parent)) {
      if (mutation.op === "add" && Number(key) >= parent.length) parent.push(structuredClone(mutation.value));
      else parent[Number(key)] = structuredClone(mutation.value);
    } else {
      (parent as Record<string, unknown>)[key] = structuredClone(mutation.value);
    }
  }
  return output as T;
}

function codeOf(action: () => unknown): string | null {
  try {
    action();
    return null;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) return String(error.code);
    return String(error);
  }
}

test("Story and browser parsers preserve the canonical workspace exactly", () => {
  assert.deepEqual(parseStoryWorkspace(fixture.workspaceResponse), fixture.workspaceResponse);
  assert.deepEqual(parseBrowserWorkspace(fixture.workspaceResponse), fixture.workspaceResponse);
});

test("Story and browser return the same stable code for every workspace vector", () => {
  for (const vector of matrix.vectors.filter(({ operation }) => operation === "parse-workspace")) {
    const input = mutate(fixture.workspaceResponse, vector.mutations);
    assert.equal(codeOf(() => parseStoryWorkspace(input)), vector.expectedCode, `${vector.id}: Story`);
    assert.equal(codeOf(() => parseBrowserWorkspace(input)), vector.expectedCode, `${vector.id}: browser`);
  }
});

test("Story parser executes every materialization parser, scope and replay vector", () => {
  for (const vector of matrix.vectors) {
    let actual: string | null | undefined;
    if (vector.operation === "parse-materialization-request") {
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

test("same complete attempt replays and changed semantic authority conflicts", () => {
  const request = parseCanvasAssetMaterializationRequestV01(fixture.materializationRequest);
  assert.deepEqual(decideCanvasAssetMaterializationReplay(request, request), { outcome: "replay", replayed: true });
  const changedActor = { ...fixture.materializationRequest, actorId: "20202020-2020-4020-8020-202020202020" };
  assert.equal(
    codeOf(() => decideCanvasAssetMaterializationReplay(request, parseCanvasAssetMaterializationRequestV01(changedActor))),
    "CANVAS_MATERIALIZATION_IDEMPOTENCY_CONFLICT",
  );
});

test("completeness can render a trustworthy blocked projection only with all exact ordered reasons", () => {
  const blocked = structuredClone(fixture.workspaceResponse);
  blocked.status = "blocked";
  for (const key of Object.keys(blocked.completeness)) blocked.completeness[key] = false;
  blocked.reasonCodes = [
    "WORKSPACE_ASSET_AGGREGATE_INCOMPLETE",
    "WORKSPACE_REQUIREMENTS_INCOMPLETE",
    "WORKSPACE_READINESS_INCOMPLETE",
    "WORKSPACE_OUTPUTS_INCOMPLETE",
    "WORKSPACE_EVENTS_INCOMPLETE",
    "WORKSPACE_CONTROLLED_MEDIA_INCOMPLETE",
  ];
  assert.deepEqual(parseStoryWorkspace(blocked), blocked);
  assert.deepEqual(parseBrowserWorkspace(blocked), blocked);
  blocked.reasonCodes.reverse();
  assert.equal(codeOf(() => parseStoryWorkspace(blocked)), "CANVAS_WORKSPACE_STATUS_INCONSISTENT");
  assert.equal(codeOf(() => parseBrowserWorkspace(blocked)), "CANVAS_WORKSPACE_STATUS_INCONSISTENT");
});

test("decoded byte range accepts one byte through exact 8 MiB and rejects 8 MiB plus one with stable codes", () => {
  const oneByte = {
    ...fixture.materializationResponse,
    mimeType: "image/png",
    byteSize: 1,
    checksum: "sha256:6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d",
    contentBase64: "AA==",
  };
  assert.equal(
    codeOf(() => parseCanvasAssetMaterializationV01(oneByte)),
    "CANVAS_MATERIALIZATION_CONTENT_INTEGRITY_FAILED",
    "one decoded byte is inside the size range but must still fail magic-byte verification",
  );
  const bytes = Buffer.alloc(8 * 1024 * 1024);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  const boundary = {
    ...fixture.materializationResponse,
    mimeType: "image/jpeg",
    byteSize: bytes.length,
    checksum: `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`,
    contentBase64: bytes.toString("base64"),
  };
  assert.equal(boundary.contentBase64.length, 11_184_812);
  assert.equal(parseCanvasAssetMaterializationV01(boundary).byteSize, 8 * 1024 * 1024);
  assert.equal(
    codeOf(() => parseCanvasAssetMaterializationV01({ ...boundary, byteSize: 8 * 1024 * 1024 + 1 })),
    "CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE",
  );
});

test("malformed and noncanonical base64 fail with fixed code and never escape an uncaught parser error", () => {
  for (const contentBase64 of ["not base64", "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwC\nAAAA"]) {
    assert.equal(
      codeOf(() => parseCanvasAssetMaterializationV01({ ...fixture.materializationResponse, contentBase64 })),
      "CANVAS_MATERIALIZATION_RESPONSE_INVALID",
      contentBase64,
    );
  }
});

test("browser parser cannot accept any server-only materialization envelope", () => {
  for (const input of [fixture.materializationRequest, fixture.materializationResponse, fixture.materializationError]) {
    assert.notEqual(codeOf(() => parseBrowserWorkspace(input)), null);
  }
  assert.equal(codeOf(() => parseBrowserWorkspace(fixture.materializationResponse)), "CANVAS_WORKSPACE_BROWSER_UNSAFE");
});

test("independent adversarial parity: regex-shaped impossible timestamps fail closed", () => {
  const impossible = structuredClone(fixture.workspaceResponse);
  impossible.occurredAt = "2026-99-99T99:99:99.999Z";
  assert.equal(codeOf(() => parseStoryWorkspace(impossible)), "CANVAS_WORKSPACE_SCHEMA_INVALID");
  assert.equal(codeOf(() => parseBrowserWorkspace(impossible)), "CANVAS_WORKSPACE_SCHEMA_INVALID");
});
