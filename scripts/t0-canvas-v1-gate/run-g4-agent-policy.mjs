import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const result = spawnSync(process.execPath, ["--test", "tests/e2e/canvas-v1/agent-policy.gate.test.mjs"], {
  cwd: root,
  encoding: "utf8",
  stdio: "inherit",
});

process.exitCode = result.status ?? 1;
