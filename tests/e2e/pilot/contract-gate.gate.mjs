import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = process.cwd();
const contractDirectory = path.join(repositoryRoot, "docs/program/contracts/v0.2");
const canonicalValidator = path.join(contractDirectory, "validate-contract.mjs");
const storycanvasTsx = path.join(repositoryRoot, "apps/storycanvas/node_modules/.bin/tsx");
const storycanvasBoundaryGate = path.join(
  repositoryRoot,
  "tests/e2e/pilot/storycanvas-v01-boundary.gate.ts",
);
const protocolOracleGate = path.join(
  repositoryRoot,
  "tests/e2e/pilot/pilot-contract-oracle.gate.mjs",
);
const controlApiA3Gate = path.join(
  repositoryRoot,
  "tests/e2e/pilot/control-api-a3-http.gate.ts",
);
const controlApiTsx = path.join(repositoryRoot, "apps/control-api/node_modules/.bin/tsx");
const storycanvasRoot = path.join(repositoryRoot, "apps/storycanvas");
const storycanvasTsxCli = path.join(storycanvasRoot, "node_modules/tsx/dist/cli.mjs");
const storycanvasNativeTestNode = [
  process.env.STORYCANVAS_TEST_NODE,
  path.join(os.homedir(), ".hermes/node/bin/node"),
  process.execPath,
].find((candidate) => candidate && fs.existsSync(candidate));
const storycanvasV02HttpGate = path.join(
  storycanvasRoot,
  "src/routes/production/v0.2/index.test.ts",
);
const storycanvasV02ReceiverGate = path.join(
  storycanvasRoot,
  "src/services/storycanvas/pilotV02Receiver.test.ts",
);
const storycanvasV02RuntimeGate = path.join(
  storycanvasRoot,
  "src/contracts/v0.2/runtime.test.ts",
);
const storycanvasV02SecurityGate = path.join(
  storycanvasRoot,
  "src/contracts/v0.2/security.test.ts",
);
const q1ProductionPlaneInternalToken =
  "q1-production-plane-internal-token-independent-20260805";

function run(command, args, options = {}) {
  const environment = {
    ...process.env,
    NODE_ENV: "test",
    ARK_API_KEY: "",
    BYTEPLUS_TTS_ACCESS_TOKEN: "",
    BYTEPLUS_TTS_APP_ID: "",
    PRODUCTION_PLANE_INTERNAL_TOKEN: q1ProductionPlaneInternalToken,
  };
  delete environment.NODE_TEST_CONTEXT;
  return spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: environment,
    ...options,
  });
}

function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .filter((key) => value[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(",")}}`;
}

function refreshPayloadDigest(value) {
  const unsigned = structuredClone(value);
  delete unsigned.payloadDigest;
  value.payloadDigest = `sha256:${crypto
    .createHash("sha256")
    .update(canonicalize(unsigned))
    .digest("hex")}`;
}

function runValidatorAgainstMutatedFixture(fileName, mutate, { refreshDigest = true } = {}) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "videoagent-q1-contract-"));
  const temporaryContract = path.join(temporaryRoot, "v0.2");
  fs.cpSync(contractDirectory, temporaryContract, { recursive: true });
  try {
    const fixturePath = path.join(temporaryContract, "fixtures", fileName);
    const value = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    mutate(value);
    if (refreshDigest) refreshPayloadDigest(value);
    fs.writeFileSync(fixturePath, `${JSON.stringify(value, null, 2)}\n`);
    return run(process.execPath, ["--test", path.join(temporaryContract, "validate-contract.mjs")]);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

test("C01 canonical v0.2 validator passes its frozen fixture and negative-vector suite", () => {
  const result = run(process.execPath, ["--test", canonicalValidator]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /# pass 6/);
  assert.match(result.stdout, /# fail 0/);
});

test("existing StoryCanvas v0.1 boundary remains executable without provider calls", () => {
  assert.ok(fs.existsSync(storycanvasTsx), "StoryCanvas local tsx runner is required");
  const result = run(storycanvasTsx, ["--test", storycanvasBoundaryGate]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /# pass 8/);
  assert.match(result.stdout, /# fail 0/);
});

test("frozen v0.2 replay, ACK, and settlement oracle remains executable", () => {
  const result = run(process.execPath, ["--test", protocolOracleGate]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /# pass 6/);
  assert.match(result.stdout, /# fail 0/);
});

test("C01 validator rejects a forbidden credential field in StandardError details", () => {
  const result = runValidatorAgainstMutatedFixture("standard-error.json", (standardError) => {
    standardError.error.details.authorization = "Bearer REDACTED_TEST_VALUE";
  });
  assert.notEqual(result.status, 0, "credential-shaped field unexpectedly passed");
  assert.match(`${result.stdout}\n${result.stderr}`, /authorization is forbidden/);
});

test("C01 validator rejects sensitive StandardError string content", () => {
  const result = runValidatorAgainstMutatedFixture("standard-error.json", (standardError) => {
    standardError.error.message =
      "Fetch failed at https://object.invalid/output.mp4?X-Amz-Credential=FAKE&X-Amz-Signature=FAKE";
    standardError.error.details.script = "FULL APPROVED SCRIPT CONTENT";
    standardError.error.details.otherTenantExists = true;
  });

  assert.notEqual(result.status, 0, "sensitive StandardError content unexpectedly passed");
  assert.match(`${result.stdout}\n${result.stderr}`, /StandardError|forbidden|signed_amz_url/);
});

test("C01 validator rejects semantic tampering when payloadDigest is unchanged", () => {
  const result = runValidatorAgainstMutatedFixture(
    "generation-task-command.json",
    (command) => {
      command.input.prompt = "tampered semantic prompt";
    },
    { refreshDigest: false },
  );
  assert.notEqual(result.status, 0, "payload tampering unexpectedly passed");
  assert.match(`${result.stdout}\n${result.stderr}`, /payloadDigest mismatch/);
});

test("C01 validator rejects a grant bound to the wrong package", () => {
  const result = runValidatorAgainstMutatedFixture("project-grant.json", (grant) => {
    grant.packageId = "package-other";
  });
  assert.notEqual(result.status, 0, "wrong package scope unexpectedly passed");
  assert.match(`${result.stdout}\n${result.stderr}`, /package-other/);
});

test("C01 structural validator leaves operation-specific Grant scope to runtime policy", () => {
  const result = runValidatorAgainstMutatedFixture("project-grant.json", (grant) => {
    grant.scopes = ["production.package.read", "production.receipt.write"];
  });
  assert.equal(
    result.status,
    0,
    "The known grant-scope coverage gap changed; update this evidence test and rerun the Gate.",
  );
});

test("A3 live package/grant HTTP and token matrix remains executable", () => {
  assert.ok(fs.existsSync(controlApiTsx), "Control API local tsx runner is required");
  const result = run(controlApiTsx, ["--test", controlApiA3Gate]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /# pass 10/);
  assert.match(result.stdout, /# fail 0/);
});

test("B3 live v0.2 public HTTP and durable receiver matrix remains executable", () => {
  assert.ok(storycanvasNativeTestNode, "A StoryCanvas native-module compatible Node runtime is required");
  const result = run(
    storycanvasNativeTestNode,
    [
      storycanvasTsxCli,
      "--test",
      storycanvasV02RuntimeGate,
      storycanvasV02SecurityGate,
      storycanvasV02HttpGate,
      storycanvasV02ReceiverGate,
    ],
    { cwd: storycanvasRoot },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /# pass 13/);
  assert.match(result.stdout, /# fail 0/);
  assert.match(result.stdout, /# skipped 0/);
});
