import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const vectors = JSON.parse(readFileSync(join(here, "browser-provenance-replay-vectors.json"), "utf8"));

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("RED evidence is pinned to the independent real-browser run", () => {
  assert.equal(vectors.redEvidence.coordinatorCommit, "8d2d3215d9af39006b4d5fde128484e314b7ae73");
  assert.equal(vectors.redEvidence.evidenceCommit, "155777d5a1f654306a6fcd82856ac4b3d327dca0");
  assert.deepEqual(vectors.redEvidence.observed.activationStatuses, [201, 200]);
  assert.equal(vectors.redEvidence.observed.activationReplayObserved, true);
  assert.deepEqual(vectors.redEvidence.observed.legacyOpenStatuses, [200, 409]);
  assert.deepEqual(vectors.redEvidence.observed.formalGetStatuses, [401]);
  assert.equal(vectors.redEvidence.observed.approvalRequests, 0);
  assert.equal(vectors.redEvidence.observed.commandRequests, 0);
  assert.equal(vectors.redEvidence.observed.providerRequests, 0);
});

test("formal read surface is exactly bootstrap and workspace", () => {
  assert.deepEqual(vectors.formalReadPaths, [
    "/api/production/pilot/canvas/v1/bootstrap",
    "/api/production/pilot/canvas/v1/workspace",
  ]);
});

test("browser read vectors freeze Chrome-positive and fail-closed provenance", () => {
  const ids = new Set(vectors.browserReadVectors.map(({ id }) => id));
  assert.equal(ids.size, vectors.browserReadVectors.length);
  assert.ok(vectors.browserReadVectors.length >= 18);
  assert.equal(vectors.browserReadVectors.filter(({ expected }) => expected === "allow").length, 2);
  for (const id of [
    "read-origin-omitted-chrome-same-origin-fetch",
    "read-origin-present-mismatch",
    "read-fetch-site-cross-site",
    "read-fetch-site-same-site-is-not-same-origin",
    "read-fetch-site-none-navigation",
    "read-navigation-even-with-exact-referer",
    "read-missing-fetch-site",
    "read-missing-referer",
    "read-automated-client-missing-provenance",
    "read-session-missing",
    "read-pcs-scope-mismatch",
  ]) assert.ok(ids.has(id), `missing browser provenance vector ${id}`);
});

test("mutations retain exact Origin and CSRF", () => {
  const byId = new Map(vectors.mutationVectors.map((item) => [item.id, item]));
  assert.equal(byId.get("mutation-control-exact-origin-and-session-csrf")?.expected, "allow");
  assert.equal(byId.get("mutation-story-open-exact-origin-and-fixed-csrf")?.expected, "allow");
  assert.equal(byId.get("mutation-origin-omitted")?.expected, "reject_forbidden");
  assert.equal(byId.get("mutation-csrf-missing")?.expected, "reject_forbidden");
});

test("legacy open vectors freeze in-flight dedupe, replay and conflict", () => {
  const byId = new Map(vectors.legacyOpenReplayVectors.map((item) => [item.id, item]));
  assert.equal(byId.size, vectors.legacyOpenReplayVectors.length);
  assert.equal(byId.get("open-concurrent-identical-strict-mode")?.expected, "one_execution_same_pcs_two_successes");
  assert.equal(byId.get("open-response-loss-identical-retry")?.expected, "replay_same_pcs_without_second_redemption_or_registration");
  assert.equal(byId.get("open-same-handle-changed-project")?.expected, "reject_409_conflict_before_side_effect");
  assert.equal(byId.get("open-failed-attempt-is-not-cached")?.expected, "new_execution_no_failure_replay");
  assert.equal(byId.get("open-replay-record-secret-containment")?.expected, "cache_only_safe_digest_scope_and_browser_safe_result");
});

test("additive policy and parent contracts publish one unambiguous rule", () => {
  const policy = readFileSync(join(here, "BROWSER_PROVENANCE_AND_LEGACY_OPEN_REPLAY_AMENDMENT.md"), "utf8");
  const activation = readFileSync(join(here, "ACTIVATION_TRANSPORT_CONTRACT.md"), "utf8");
  const workspace = readFileSync(join(here, "WORKSPACE_MATERIALIZATION_CONTRACT.md"), "utf8");
  const readme = readFileSync(join(here, "README.md"), "utf8");
  for (const clause of [
    "Origin present",
    "Sec-Fetch-Site: same-origin",
    "Sec-Fetch-Mode: cors",
    "Sec-Fetch-Dest: empty",
    "Referer",
    "valid HttpOnly Session",
    "exact active `pcs_*`",
    "navigation",
    "automated",
    "fail closed",
    "in-flight",
    "same `pcs_*`",
    "PILOT_CANVAS_CONFLICT",
    "Failures are never cached",
    "raw secret",
  ]) assert.ok(policy.includes(clause), `policy missing clause: ${clause}`);
  for (const parent of [activation, workspace]) {
    assert.ok(parent.includes("BROWSER_PROVENANCE_AND_LEGACY_OPEN_REPLAY_AMENDMENT.md"));
  }
  assert.ok(readme.includes("BROWSER_PROVENANCE_AND_LEGACY_OPEN_REPLAY_AMENDMENT.md"));
  assert.ok(readme.includes("validate-browser-provenance-replay.mjs"));
});

let failed = 0;
for (const { name, fn } of tests) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL ${name}`); console.error(error); }
}
console.log(`browser provenance/replay contract: ${tests.length - failed}/${tests.length} passed`);
if (failed) process.exitCode = 1;
