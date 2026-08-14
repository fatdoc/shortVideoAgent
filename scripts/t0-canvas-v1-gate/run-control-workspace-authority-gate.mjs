#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const expectedDatabase = "postgresql://localhost/videoagent_control_test";
if (process.env.CONTROL_API_TEST_DATABASE_URL !== expectedDatabase) {
  process.stderr.write("[control-workspace-authority-gate] BLOCKED exact dedicated videoagent_control_test URL required\n");
  process.exit(2);
}
const verifiedDepsRoot = process.env.CANVAS_V1_VERIFIED_DEPS_ROOT;
const roots = [rootDir, verifiedDepsRoot].filter(Boolean);
const resolveDependency = (relativePath) => roots
  .map((base) => path.join(base, relativePath))
  .find((candidate) => fs.existsSync(candidate));
const vitest = resolveDependency("apps/control-api/node_modules/.bin/vitest");
if (!vitest) {
  process.stderr.write("[control-workspace-authority-gate] ENVIRONMENT_FAILURE missing Control vitest\n");
  process.exit(2);
}

const phases = [
  ["CV1 Workspace Authority 30-vector validator", process.execPath, [
    "--test", "docs/program/contracts/canvas-v1/validate-workspace-authority.mjs",
  ]],
  ["CV6 static Control authority policy", process.execPath, [
    "--test", "tests/e2e/canvas-v1/control-workspace-authority-policy.gate.mjs",
  ]],
  ["CV6 independent HTTP/service/PostgreSQL authority gate", vitest, [
    "run", "--root", rootDir, "--config", "scripts/t0-canvas-v1-gate/vitest.control-workspace-authority.config.mjs",
  ]],
  ["CV5 owner Workspace Authority targeted", vitest, [
    "run", "--root", "apps/control-api", "--config", "vitest.config.ts", "--maxWorkers=1", "--fileParallelism=false",
    "src/assets/workspaceAuthorityParser.test.ts", "src/assets/workspaceAuthorityService.test.ts",
    "src/assets/internalWorkspaceAuthorityRoutes.test.ts", "src/assets/appRegistration.test.ts",
  ]],
  ["CV5 owner Workspace Authority PostgreSQL", vitest, [
    "run", "--root", "apps/control-api", "--config", "vitest.config.ts", "--maxWorkers=1", "--fileParallelism=false",
    "src/assets/workspaceAuthorityRepository.postgres.test.ts",
  ]],
];

let failed = false;
for (const [name, executable, args] of phases) {
  process.stdout.write(`\n[control-workspace-authority-gate] ${name}\n`);
  const result = spawnSync(executable, args, { cwd: rootDir, env: process.env, shell: false, stdio: "inherit" });
  if (result.error || result.status !== 0) {
    failed = true;
    process.stderr.write(`[control-workspace-authority-gate] PRODUCT_RED ${name}: ${result.error?.message ?? `exit ${result.status}`}\n`);
  }
}
if (failed) {
  process.stderr.write("\n[control-workspace-authority-gate] CONTROL_WORKSPACE_AUTHORITY_GATE_RED\n");
  process.exitCode = 1;
} else {
  process.stdout.write("\n[control-workspace-authority-gate] CONTROL_WORKSPACE_AUTHORITY_GATE_PASS\n");
}
