#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const phases = [
  {
    name: "CV1 contract authority self-check",
    command: [process.execPath, "--test", "docs/program/contracts/canvas-v1/validate-contract.mjs"],
  },
  {
    name: "CV6 independent contract facts and security gate",
    command: [process.execPath, "--test", "tests/e2e/canvas-v1/contract-facts.gate.mjs"],
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
    env: childEnv,
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
