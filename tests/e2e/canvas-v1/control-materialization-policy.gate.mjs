import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (name) => fs.readFileSync(path.join(rootDir, name), "utf8");

const productPaths = [
  "apps/control-api/.env.example",
  "apps/control-api/src/app.ts",
  "apps/control-api/src/assets/appRegistration.test.ts",
  "apps/control-api/src/assets/internalMaterializationRoutes.test.ts",
  "apps/control-api/src/assets/internalMaterializationRoutes.ts",
  "apps/control-api/src/assets/materializationErrors.ts",
  "apps/control-api/src/assets/materializationParser.test.ts",
  "apps/control-api/src/assets/materializationParser.ts",
  "apps/control-api/src/assets/materializationRepository.postgres.test.ts",
  "apps/control-api/src/assets/materializationRepository.ts",
  "apps/control-api/src/assets/materializationService.test.ts",
  "apps/control-api/src/assets/materializationService.ts",
  "apps/control-api/src/assets/materializationStorage.test.ts",
  "apps/control-api/src/assets/materializationStorage.ts",
  "apps/control-api/src/assets/materializationTypes.ts",
  "apps/control-api/src/config.test.ts",
  "apps/control-api/src/config.ts",
  "apps/control-api/src/db/migrationChain.postgres.test.ts",
  "apps/control-api/src/db/migrationContract.ts",
  "apps/control-api/src/db/migrations/027_canvas_asset_materialization.ts",
  "apps/control-api/src/server.ts",
];

test("CV5 Control materialization product write set is exact and present", () => {
  assert.deepEqual(productPaths, [...productPaths].sort());
  assert.deepEqual(productPaths.filter((name) => !fs.existsSync(path.join(rootDir, name))), []);
  assert.equal(productPaths.length, 21);
  assert.equal(productPaths.some((name) => name.includes("byteplus")), false);
});

test("migration 027 is registered, scoped, immutable and persists no raw bytes, storage or token", () => {
  const contract = read("apps/control-api/src/db/migrationContract.ts");
  const migration = read("apps/control-api/src/db/migrations/027_canvas_asset_materialization.ts");
  assert.match(contract, /'027_canvas_asset_materialization\.ts'/);
  assert.match(contract, /'canvas_asset_materialization_attempts'/);
  for (const fragment of [
    "materialization_attempt_id uuid primary key",
    "materialization_id uuid not null unique",
    "foreign key (tenant_id, project_id, package_id, canvas_session_id, actor_id)",
    "foreign key (asset_id, tenant_id, project_id, package_id)",
    "byte_size integer not null check (byte_size between 1 and 8388608)",
    "before update or delete",
    "canvas asset materialization authority is immutable",
  ]) assert.ok(migration.includes(fragment), fragment);
  for (const forbiddenColumn of ["content_base64", "content_bytes", "storage_reference", "internal_token", "access_token"]) {
    assert.equal(migration.toLowerCase().includes(forbiddenColumn), false, forbiddenColumn);
  }
});

test("internal route authenticates before its private JSON parser and exposes fixed safe errors only", () => {
  const route = read("apps/control-api/src/assets/internalMaterializationRoutes.ts");
  const authIndex = route.indexOf("!sameToken(");
  const parserIndex = route.indexOf("json({ limit: CANVAS_MATERIALIZATION_MAX_REQUEST_BYTES");
  assert.ok(authIndex >= 0 && parserIndex > authIndex);
  assert.match(route, /cache-control', 'no-store'/);
  assert.doesNotMatch(route, /console\.|storageReference|contentBase64/);
  const errorPolicy = read("apps/control-api/src/assets/materializationErrors.ts");
  assert.doesNotMatch(errorPolicy, /storageReference|contentBase64|x-production-plane-internal-token/i);
});

test("local reader rejects schemes, traversal and symlinks before reading and uses no-follow", () => {
  const storage = read("apps/control-api/src/assets/materializationStorage.ts");
  for (const fragment of [
    "isAbsolute(reference)",
    "segment === '..'",
    "stat.isSymbolicLink()",
    "constants.O_NOFOLLOW",
    "isContained(root, target)",
  ]) assert.ok(storage.includes(fragment), fragment);
  assert.doesNotMatch(storage, /fetch\(|axios|https?\.request/);
});

test("required independent tests contain no skip, only or todo", () => {
  const files = [
    "tests/e2e/canvas-v1/control-materialization.gate.test.ts",
    "tests/e2e/canvas-v1/control-materialization-postgres.gate.test.ts",
    "tests/e2e/canvas-v1/control-materialization-policy.gate.mjs",
  ];
  for (const file of files) assert.doesNotMatch(read(file), /\.(?:skip|only|todo)\s*\(/, file);
});
