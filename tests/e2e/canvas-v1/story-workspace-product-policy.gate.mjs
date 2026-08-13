import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const policy = JSON.parse(fs.readFileSync(
  path.join(rootDir, "tests/e2e/canvas-v1/story-workspace-product-policy.fixture.json"),
  "utf8",
));
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));

test("policy freezes the exact Story G5 public surface and all independent runtime obligations", () => {
  assert.equal(policy.schemaVersion, "cv6-story-workspace-product-policy.v1");
  assert.equal(policy.baseline, "311859cf64073fc208384cfe9224668a3b0f3a14");
  assert.equal(policy.publicSurfaces.length, 9);
  assert.equal(new Set(policy.publicSurfaces.map(({ path: sourcePath }) => sourcePath)).size, 9);
  assert.equal(new Set(policy.publicSurfaces.map(({ export: exportName }) => exportName)).size, 9);
  assert.ok(policy.behaviorCases.length >= 16);
  assert.deepEqual(policy.requiredVectorCounts, {
    workspaceMaterialization: 69,
    workspaceAuthority: 30,
  });
  assert.equal(policy.routePolicy.formalBootstrap.method, "GET");
  assert.equal(policy.routePolicy.formalBootstrap.requires.includes("CSRF"), false);
  assert.equal(policy.routePolicy.workspace.method, "GET");
  assert.ok(policy.routePolicy.workspace.forbids.includes("prepare"));
  assert.ok(policy.routePolicy.media.forbids.includes("redirect"));
});

test("the frozen 69 plus 30 vector catalogs remain complete and unique", () => {
  const workspace = readJson("docs/program/contracts/canvas-v1/workspace-materialization-negative-vectors.json");
  const authority = readJson("docs/program/contracts/canvas-v1/workspace-authority-negative-vectors.json");
  assert.equal(workspace.vectors.length, policy.requiredVectorCounts.workspaceMaterialization);
  assert.equal(authority.vectors.length, policy.requiredVectorCounts.workspaceAuthority);
  assert.equal(new Set(workspace.vectors.map(({ id }) => id)).size, workspace.vectors.length);
  assert.equal(new Set(authority.vectors.map(({ id }) => id)).size, authority.vectors.length);

  const ids = new Set([...workspace.vectors, ...authority.vectors].map(({ id }) => id));
  for (const required of [
    "authority-internal-auth-runs-before-json-parser",
    "casting-zero-virtual-character-is-missing",
    "casting-multiple-virtual-character-is-ambiguous",
    "trusted-prepare-is-one-transaction",
    "workspace-get-is-read-only",
    "workspace-event-must-be-generate-shot-event",
    "workspace-thumbnail-must-be-selected-controlled-output",
    "materialization-response-loss-retries-same-attempt",
    "materialization-story-persists-unique-control-asset-mapping",
    "materialization-story-changed-content-never-overwrites",
    "workspace-output-signed-url-forbidden",
  ]) assert.ok(ids.has(required), required);
});

test("Story G5 formal workspace product exposes every frozen module and export", () => {
  const missing = [];
  for (const surface of policy.publicSurfaces) {
    const absolutePath = path.join(rootDir, surface.path);
    if (!fs.existsSync(absolutePath)) {
      missing.push(`${surface.path}#${surface.export}`);
      continue;
    }
    const source = fs.readFileSync(absolutePath, "utf8");
    if (!new RegExp(`\\bexport\\s+(?:class|function|const|interface|type)\\s+${surface.export}\\b`).test(source)) {
      missing.push(`${surface.path}#${surface.export}`);
    }
  }
  assert.deepEqual(missing, [], `EXPECTED_RED missing Story G5 surfaces:\n${missing.join("\n")}`);
});

test("new Story G5 product sources contain no Demo, MVP or browser-storage fallback", () => {
  const sources = policy.publicSurfaces
    .map(({ path: relativePath }) => path.join(rootDir, relativePath))
    .filter((absolutePath) => fs.existsSync(absolutePath))
    .map((absolutePath) => fs.readFileSync(absolutePath, "utf8"))
    .join("\n");
  for (const marker of policy.forbiddenProductMarkers) {
    assert.equal(sources.includes(marker), false, marker);
  }
});

test("formal route source cannot serialize frozen server-only authority markers", () => {
  const routeSources = policy.publicSurfaces
    .filter(({ path: relativePath }) => relativePath.includes("/routes/"))
    .map(({ path: relativePath }) => path.join(rootDir, relativePath))
    .filter((absolutePath) => fs.existsSync(absolutePath))
    .map((absolutePath) => fs.readFileSync(absolutePath, "utf8"))
    .join("\n");
  for (const marker of policy.forbiddenBrowserMarkers) {
    const responseShaped = new RegExp(`(?:json|send|redirect)[\\s\\S]{0,120}${marker}`, "i");
    assert.equal(responseShaped.test(routeSources), false, marker);
  }
});

test("runtime supplies the aggregate media route its frozen nested service port", () => {
  const runtime = fs.readFileSync(path.join(
    rootDir,
    "apps/storycanvas/src/services/storycanvas/canvas-v1/runtime.ts",
  ), "utf8");
  assert.match(
    runtime,
    /media\s*:\s*\{\s*media\s*:\s*controlledMedia\s*\}/u,
    "EXPECTED_RED runtime must pass { media: controlledMedia } to CanvasV1ProductionRouter",
  );
  assert.doesNotMatch(runtime, /media\s*:\s*controlledMedia\s*[,}]/u);
});
