#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tsxCli = path.join(rootDir, "apps/storycanvas/node_modules/tsx/dist/cli.mjs");
if (!fs.existsSync(tsxCli)) {
  process.stderr.write("[g6-session-recovery] ENVIRONMENT_FAILURE StoryCanvas tsx runtime missing\n");
  process.exit(2);
}
const result = spawnSync(
  process.execPath,
  [
    tsxCli,
    "--tsconfig",
    path.join(rootDir, "apps/storycanvas/tsconfig.json"),
    "--test",
    "tests/e2e/canvas-v1/g6-session-recovery.gate.test.ts",
  ],
  {
    cwd: rootDir,
    env: {
      ...process.env,
      NODE_OPTIONS: "",
      CANVAS_V1_VERIFIED_DEPS_ROOT: rootDir,
    },
    shell: false,
    stdio: "inherit",
  },
);
if (result.error || result.status !== 0) {
  process.stderr.write("[g6-session-recovery] EXPECTED_PRODUCT_RED\n");
  process.exit(1);
}
process.stdout.write("[g6-session-recovery] SESSION_RECOVERY_PASS\n");
