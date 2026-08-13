import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const dependencyRoot = process.env.CANVAS_V1_VERIFIED_DEPS_ROOT ?? root;
const tsx = path.join(dependencyRoot, "apps/storycanvas/node_modules/tsx/dist/cli.mjs");

if (!fs.existsSync(tsx)) {
  process.stderr.write("[canvas-v1-g4-agent] ENVIRONMENT_FAILURE missing StoryCanvas tsx; set CANVAS_V1_VERIFIED_DEPS_ROOT\n");
  process.exit(2);
}

const phases = [
  ["static policy and isolation", process.execPath, ["--test", "tests/e2e/canvas-v1/agent-policy.gate.test.mjs"]],
  ["dynamic runtime boundary", process.execPath, [tsx, "--tsconfig", "apps/storycanvas/tsconfig.json", "--test", "tests/e2e/canvas-v1/agent-runtime.gate.test.ts"]],
];
let failed = false;
for (const [name, command, args] of phases) {
  process.stdout.write(`\n[canvas-v1-g4-agent] ${name}\n`);
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: "inherit", env: { ...process.env, NODE_PATH: path.join(dependencyRoot, "apps/storycanvas/node_modules") } });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(`[canvas-v1-g4-agent] EXPECTED_RED ${name}: exit ${result.status ?? "signal"}\n`);
  }
}
process.stdout.write(`\n[canvas-v1-g4-agent] ${failed ? "G4_AGENT_GATE_EXPECTED_RED" : "G4_AGENT_GATE_PASS"}\n`);
process.exitCode = failed ? 1 : 0;
