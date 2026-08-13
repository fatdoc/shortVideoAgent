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
    process.stderr.write(
      `[canvas-v1-gate] ENVIRONMENT_FAILURE missing ${relativePath}; install repository dependencies or set CANVAS_V1_VERIFIED_DEPS_ROOT\n`,
    );
    process.exit(2);
  }
  return resolved;
}

const tsxCli = resolveDependency("apps/storycanvas/node_modules/tsx/dist/cli.mjs");
const storyCanvasNodeModules = path.resolve(path.dirname(tsxCli), "../..");
const electron = resolveDependency("apps/storycanvas/node_modules/.bin/electron");
const vitest = resolveDependency("node_modules/.bin/vitest");
const phases = [
  {
    name: "CV1 contract authority self-check",
    command: [process.execPath, "--test", "docs/program/contracts/canvas-v1/validate-contract.mjs"],
  },
  {
    name: "CV6 independent contract facts and security gate",
    command: [process.execPath, "--test", "tests/e2e/canvas-v1/contract-facts.gate.mjs"],
  },
  {
    name: "StoryCanvas backend contract conformance",
    command: [electron, tsxCli, "--test", "apps/storycanvas/src/contracts/canvas-v1/contracts.test.ts"],
    env: { ELECTRON_RUN_AS_NODE: "1", NODE_PATH: storyCanvasNodeModules },
  },
  {
    name: "frontend contract conformance",
    command: [
      vitest,
      "run",
      "--root",
      rootDir,
      "--config",
      "scripts/t0-canvas-v1-gate/vitest.contract.config.mjs",
    ],
  },
  {
    name: "CV6 independent 37-vector parser parity",
    command: [electron, tsxCli, "--test", "tests/e2e/canvas-v1/parser-parity.gate.ts"],
    env: { ELECTRON_RUN_AS_NODE: "1", NODE_PATH: storyCanvasNodeModules },
  },
];

const childEnv = { ...process.env };
delete childEnv.NODE_OPTIONS;
delete childEnv.NODE_PATH;

let failed = false;
for (const phase of phases) {
  process.stdout.write(`\n[canvas-v1-gate] ${phase.name}\n`);
  const result = spawnSync(phase.command[0], phase.command.slice(1), {
    cwd: rootDir,
    env: { ...childEnv, ...phase.env },
    shell: false,
    stdio: "inherit",
  });
  if (result.error) {
    failed = true;
    process.stderr.write(`[canvas-v1-gate] ENVIRONMENT_FAILURE ${phase.name}: ${result.error.message}\n`);
    continue;
  }
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(`[canvas-v1-gate] PRODUCT_RED ${phase.name}: exit ${result.status ?? "signal"}\n`);
  }
}

if (failed) {
  process.stderr.write("\n[canvas-v1-gate] CANVAS_V1_CONTRACT_GATE_RED\n");
  process.exitCode = 1;
} else {
  process.stdout.write("\n[canvas-v1-gate] CANVAS_V1_CONTRACT_GATE_PASS\n");
}
