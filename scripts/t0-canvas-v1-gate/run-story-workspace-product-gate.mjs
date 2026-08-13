#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const verifiedDepsRoot = process.env.CANVAS_V1_VERIFIED_DEPS_ROOT;
const dependencyRoots = [rootDir, verifiedDepsRoot].filter(Boolean);
const resolveDependency = (relativePath) => dependencyRoots
  .map((dependencyRoot) => path.join(dependencyRoot, relativePath))
  .find((candidate) => fs.existsSync(candidate));
const tsxCli = resolveDependency("apps/storycanvas/node_modules/tsx/dist/cli.mjs");
if (!tsxCli) {
  process.stderr.write("[story-workspace-product-gate] ENVIRONMENT_FAILURE missing StoryCanvas tsx runtime\n");
  process.exit(2);
}
const productSentinel = path.join(
  rootDir,
  "apps/storycanvas/src/services/storycanvas/canvas-v1/workspacePrepare.ts",
);
const productPresent = fs.existsSync(productSentinel);
const allowExpectedRed = process.argv.includes("--allow-expected-red") && !productPresent;

const phases = [
  {
    name: "CV1 Workspace/Materialization 69-vector validator",
    command: [process.execPath, "--test", "docs/program/contracts/canvas-v1/validate-workspace-materialization.mjs"],
    expectedRed: false,
  },
  {
    name: "CV1 Workspace Authority 30-vector validator",
    command: [process.execPath, "--test", "docs/program/contracts/canvas-v1/validate-workspace-authority.mjs"],
    expectedRed: false,
  },
  {
    name: "CV6 Story formal workspace product policy",
    command: [process.execPath, "--test", "tests/e2e/canvas-v1/story-workspace-product-policy.gate.mjs"],
    expectedRed: allowExpectedRed,
  },
  {
    name: "CV6 Story formal workspace public runtime harness",
    command: [process.execPath, tsxCli, "--test", "tests/e2e/canvas-v1/story-workspace-product.gate.test.ts"],
    expectedRed: allowExpectedRed,
  },
];

let failed = false;
let observedExpectedRed = false;
for (const phase of phases) {
  process.stdout.write(`\n[story-workspace-product-gate] ${phase.name}\n`);
  const result = spawnSync(phase.command[0], phase.command.slice(1), {
    cwd: rootDir,
    env: { ...process.env, NODE_OPTIONS: "" },
    shell: false,
    stdio: "inherit",
  });
  if (result.error || result.status !== 0) {
    if (phase.expectedRed) {
      observedExpectedRed = true;
      process.stdout.write(`[story-workspace-product-gate] EXPECTED_RED ${phase.name}\n`);
    } else {
      failed = true;
      process.stderr.write(
        `[story-workspace-product-gate] PRODUCT_RED ${phase.name}: ${result.error?.message ?? `exit ${result.status}`}\n`,
      );
    }
  }
}

if (failed) {
  process.stderr.write("\n[story-workspace-product-gate] STORY_WORKSPACE_PRODUCT_GATE_RED\n");
  process.exitCode = 1;
} else if (observedExpectedRed) {
  process.stdout.write("\n[story-workspace-product-gate] STORY_WORKSPACE_PRODUCT_EXPECTED_RED\n");
} else {
  process.stdout.write("\n[story-workspace-product-gate] STORY_WORKSPACE_PRODUCT_POLICY_PASS\n");
}
