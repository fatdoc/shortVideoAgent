#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const expectedDatabase = "postgresql://localhost/videoagent_control_test";
if (process.env.CONTROL_API_TEST_DATABASE_URL !== expectedDatabase) {
  process.stderr.write("[control-materialization-gate] BLOCKED exact dedicated videoagent_control_test URL required\n");
  process.exit(2);
}
const verifiedDepsRoot = process.env.CANVAS_V1_VERIFIED_DEPS_ROOT;
const dependencyRoots = [rootDir, verifiedDepsRoot].filter(Boolean);
function resolveDependency(relativePath) {
  const found = dependencyRoots.map((base) => path.join(base, relativePath)).find((value) => fs.existsSync(value));
  if (!found) throw new Error(`missing verified dependency ${relativePath}`);
  return found;
}
const vitest = resolveDependency("apps/control-api/node_modules/.bin/vitest");
const phases = [
  ["CV6 static product/migration/security policy", process.execPath, ["--test", "tests/e2e/canvas-v1/control-materialization-policy.gate.mjs"]],
  ["CV6 independent unit, HTTP, storage, service and PostgreSQL gate", vitest, [
    "run", "--root", rootDir, "--config", "scripts/t0-canvas-v1-gate/vitest.control-materialization.config.mjs",
  ]],
  ["CV5 owner materialization targeted", vitest, [
    "run", "--root", "apps/control-api", "--config", "vitest.config.ts", "--maxWorkers=1", "--fileParallelism=false",
    "src/assets/materializationParser.test.ts", "src/assets/materializationStorage.test.ts",
    "src/assets/materializationService.test.ts", "src/assets/internalMaterializationRoutes.test.ts",
    "src/assets/appRegistration.test.ts", "src/config.test.ts",
  ]],
  ["CV5 owner PostgreSQL repository", vitest, [
    "run", "--root", "apps/control-api", "--config", "vitest.config.ts", "--maxWorkers=1", "--fileParallelism=false",
    "src/assets/materializationRepository.postgres.test.ts",
  ]],
  ["Control migration chain through 027", vitest, [
    "run", "--root", "apps/control-api", "--config", "vitest.config.ts", "--maxWorkers=1", "--fileParallelism=false",
    "src/db/migrationChain.postgres.test.ts",
  ]],
];

let failed = false;
for (const [name, executable, args] of phases) {
  process.stdout.write(`\n[control-materialization-gate] ${name}\n`);
  const result = spawnSync(executable, args, { cwd: rootDir, env: process.env, shell: false, stdio: "inherit" });
  if (result.error || result.status !== 0) {
    failed = true;
    process.stderr.write(`[control-materialization-gate] PRODUCT_RED ${name}: ${result.error?.message ?? `exit ${result.status}`}\n`);
  }
}
if (failed) {
  process.stderr.write("\n[control-materialization-gate] CONTROL_MATERIALIZATION_GATE_RED\n");
  process.exitCode = 1;
} else {
  process.stdout.write("\n[control-materialization-gate] CONTROL_MATERIALIZATION_GATE_PASS\n");
}
