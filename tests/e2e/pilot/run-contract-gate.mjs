import { spawnSync } from "node:child_process";
import path from "node:path";

const repositoryRoot = process.cwd();
const gate = path.join(repositoryRoot, "tests/e2e/pilot/contract-gate.gate.mjs");
const result = spawnSync(process.execPath, ["--test", gate], {
  cwd: repositoryRoot,
  encoding: "utf8",
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "test",
    ARK_API_KEY: "",
    BYTEPLUS_TTS_ACCESS_TOKEN: "",
    BYTEPLUS_TTS_APP_ID: "",
  },
});

process.exitCode = result.status ?? 1;
