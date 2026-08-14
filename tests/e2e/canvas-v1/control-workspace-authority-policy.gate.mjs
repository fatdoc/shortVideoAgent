import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");
const ownerCommit = "ace4819";
const expectedProductPaths = [
  "apps/control-api/src/app.ts",
  "apps/control-api/src/assets/internalWorkspaceAuthorityRoutes.test.ts",
  "apps/control-api/src/assets/internalWorkspaceAuthorityRoutes.ts",
  "apps/control-api/src/assets/workspaceAuthorityErrors.ts",
  "apps/control-api/src/assets/workspaceAuthorityParser.test.ts",
  "apps/control-api/src/assets/workspaceAuthorityParser.ts",
  "apps/control-api/src/assets/workspaceAuthorityService.test.ts",
  "apps/control-api/src/assets/workspaceAuthorityService.ts",
  "apps/control-api/src/assets/workspaceAuthorityTypes.ts",
  "apps/control-api/src/production/workspaceAuthorityRepository.ts",
  "apps/control-api/src/server.ts",
];

test("Control Workspace Authority product write set is the exact integrated eleven paths", async () => {
  const { execFileSync } = await import("node:child_process");
  const actual = execFileSync("git", ["diff", "--name-only", `${ownerCommit}^`, ownerCommit], {
    cwd: rootDir,
    encoding: "utf8",
  }).trim().split("\n").filter(Boolean).sort();
  assert.deepEqual(actual, [...expectedProductPaths].sort());
  for (const relativePath of expectedProductPaths) assert.equal(fs.existsSync(path.join(rootDir, relativePath)), true, relativePath);
});

test("internal route authenticates before its private 16 KiB parser and emits fixed no-store envelopes", () => {
  const source = read("apps/control-api/src/assets/internalWorkspaceAuthorityRoutes.ts");
  const auth = source.indexOf("sameToken(");
  const parser = source.indexOf("json({ limit: CANVAS_WORKSPACE_AUTHORITY_MAX_REQUEST_BYTES");
  assert.ok(auth >= 0 && parser > auth, "token authentication must be registered before JSON parsing");
  assert.match(source, /CANVAS_WORKSPACE_AUTHORITY_MAX_REQUEST_BYTES/);
  assert.match(source, /cache-control', 'no-store'/);
  assert.match(source, /CANVAS_WORKSPACE_AUTHORITY_INTERNAL_AUTH_INVALID/);
  assert.doesNotMatch(source, /console\.|logger\.|morgan\(|pino\(/i);
});

test("repository uses exact Package-bound IDs in a read-only transaction and has no latest selector", () => {
  const source = read("apps/control-api/src/production/workspaceAuthorityRepository.ts");
  assert.match(source, /script_version_id:\s*verified\.scriptVersionId/);
  assert.match(source, /storyboard_version_id:\s*verified\.storyboardVersionId/);
  assert.match(source, /isolationLevel:\s*'repeatable read'/);
  assert.match(source, /readOnly:\s*true/);
  assert.doesNotMatch(source, /orderBy|orderByRaw|latest|current_version/i);
  assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(|\.del\(/);
});

test("service is read-only, sorts the complete safe asset projection and never projects storage authority", () => {
  const source = read("apps/control-api/src/assets/workspaceAuthorityService.ts");
  assert.match(source, /assets\.sort/);
  assert.match(source, /PRIMARY_VIRTUAL_CHARACTER_MISSING/);
  assert.match(source, /PRIMARY_VIRTUAL_CHARACTER_AMBIGUOUS/);
  assert.match(source, /projectName:\s*authority\.projectName/);
  assert.match(source, /scriptId:\s*authority\.scriptId/);
  assert.match(source, /storyboardId:\s*authority\.storyboardId/);
  assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(|\.del\(/);
  const projection = source.slice(source.indexOf("function projectAsset"), source.indexOf("function mapLookupError"));
  assert.doesNotMatch(projection, /storageReference|checksum|providerAsset|assetUri|contentBase64|internalToken/);
});

test("required independent tests contain no skip, only or todo", () => {
  for (const relativePath of [
    "tests/e2e/canvas-v1/control-workspace-authority.gate.test.ts",
    "tests/e2e/canvas-v1/control-workspace-authority-postgres.gate.test.ts",
  ]) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /\.(?:skip|only)\s*\(|\btodo\s*\(/);
  }
});
