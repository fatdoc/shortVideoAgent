#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const verifiedDepsRoot = process.env.CANVAS_V1_VERIFIED_DEPS_ROOT;
const dependencyRoots = [rootDir, verifiedDepsRoot].filter(Boolean);

function resolveDependency(relativePath) {
  const resolved = dependencyRoots
    .map((dependencyRoot) => path.join(dependencyRoot, relativePath))
    .find((candidate) => fs.existsSync(candidate));
  if (!resolved) {
    process.stderr.write(`[canvas-v1-g5-additive] ENVIRONMENT_FAILURE missing ${relativePath}\n`);
    process.exit(2);
  }
  return resolved;
}

const tsxCli = resolveDependency("apps/storycanvas/node_modules/tsx/dist/cli.mjs");
const storyNodeModules = path.resolve(path.dirname(tsxCli), "../..");
const vitest = resolveDependency("node_modules/.bin/vitest");
const phases = [
  {
    name: "CV1 additive contract authority self-check",
    command: [process.execPath, "--test", "docs/program/contracts/canvas-v1/validate-workspace-materialization.mjs"],
  },
  {
    name: "CV1 workspace authority amendment self-check",
    command: [process.execPath, "--test", "docs/program/contracts/canvas-v1/validate-workspace-authority.mjs"],
  },
  {
    name: "CV6 independent additive schema, fixture, security and 69-vector facts",
    command: [process.execPath, "--test", "tests/e2e/canvas-v1/workspace-materialization-contract.gate.mjs"],
  },
  {
    name: "CV1 Story owner parser vectors",
    command: [process.execPath, tsxCli, "--test", "apps/storycanvas/src/contracts/canvas-v1/workspaceMaterialization.test.ts"],
    env: { NODE_PATH: storyNodeModules },
  },
  {
    name: "CV6 independent Story/browser parity and byte boundaries",
    command: [process.execPath, tsxCli, "--test", "tests/e2e/canvas-v1/workspace-materialization-parity.gate.ts"],
    env: { NODE_PATH: storyNodeModules },
  },
  {
    name: "browser owner parser and real CanvasV1Page hydration",
    command: [vitest, "run", "--root", rootDir, "--config", "scripts/t0-canvas-v1-gate/vitest.g5-additive-contract.config.mjs"],
  },
];

const childEnv = { ...process.env };
delete childEnv.NODE_OPTIONS;
delete childEnv.NODE_PATH;
let failed = false;

for (const phase of phases) {
  process.stdout.write(`\n[canvas-v1-g5-additive] ${phase.name}\n`);
  const result = spawnSync(phase.command[0], phase.command.slice(1), {
    cwd: rootDir,
    env: { ...childEnv, ...phase.env },
    shell: false,
    stdio: "inherit",
  });
  if (result.error || result.status !== 0) {
    failed = true;
    process.stderr.write(`[canvas-v1-g5-additive] PRODUCT_RED ${phase.name}: ${result.error?.message ?? `exit ${result.status}`}\n`);
  }
}

if (failed) {
  process.stderr.write("\n[canvas-v1-g5-additive] G5_ADDITIVE_CONTRACT_GATE_RED\n");
  process.exitCode = 1;
} else {
  process.stdout.write("\n[canvas-v1-g5-additive] G5_ADDITIVE_CONTRACT_GATE_PASS\n");
}
