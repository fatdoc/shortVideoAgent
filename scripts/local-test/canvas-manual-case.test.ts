import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

import {
  parseLocalManualCaseOptions,
  runLocalManualCase,
} from "./canvas-manual-case.js";

const strongSecrets = {
  PILOT_LOCAL_ACCOUNT_PASSWORD: "Local-Case-2026!",
  PROJECT_GRANT_SIGNING_SECRET: "local-case-project-grant-signing-secret-2026",
  PROJECT_GRANT_ACTIVE_KID: "local-case-kid",
  RECHARGE_PAYMENT_DIGEST_SECRET: "local-case-entry-digest-secret-2026-value",
  CANVAS_ACTIVATION_IDEMPOTENCY_SECRET: "local-case-activation-secret-2026-value",
  CANVAS_APPROVAL_FINGERPRINT_SECRET: "local-case-approval-secret-2026-value",
};

test("local manual case target parser keeps local and test databases fail-closed", () => {
  const storyRoot = path.resolve("/tmp/videoagent-story-local-case");
  const assetRoot = path.resolve("/tmp/videoagent-control-assets-local-case");
  assert.equal(parseLocalManualCaseOptions(["--target", "local"], {
    ...strongSecrets,
    DATABASE_URL: "postgresql://127.0.0.1:5432/videoagent_control",
    STORYCANVAS_LOCAL_CASE_ROOT: storyRoot,
    CANVAS_ASSET_STORAGE_ROOT: assetRoot,
  }).target, "local");
  assert.equal(parseLocalManualCaseOptions(["--target=test"], {
    ...strongSecrets,
    PILOT_E2E: "true",
    CONTROL_API_TEST_DATABASE_URL: "postgresql://127.0.0.1:5432/videoagent_control_test",
    STORYCANVAS_LOCAL_CASE_ROOT: storyRoot,
    CANVAS_ASSET_STORAGE_ROOT: assetRoot,
  }).target, "test");

  for (const [argv, environment] of [
    [["--target", "local"], { DATABASE_URL: "postgresql://db.example.com/videoagent_control" }],
    [["--target", "local"], { DATABASE_URL: "postgresql://127.0.0.1/other" }],
    [["--target=test"], { PILOT_E2E: "true", CONTROL_API_TEST_DATABASE_URL: "postgresql://127.0.0.1/videoagent_control" }],
    [["--target=test"], { CONTROL_API_TEST_DATABASE_URL: "postgresql://127.0.0.1/videoagent_control_test" }],
  ] as const) {
    assert.throws(() => parseLocalManualCaseOptions(argv, {
      ...strongSecrets,
      STORYCANVAS_LOCAL_CASE_ROOT: storyRoot,
      CANVAS_ASSET_STORAGE_ROOT: assetRoot,
      ...environment,
    }));
  }
});

test("local manual case refuses unsafe or overlapping filesystem roots", () => {
  const base = {
    ...strongSecrets,
    DATABASE_URL: "postgresql://127.0.0.1:5432/videoagent_control",
    CANVAS_ASSET_STORAGE_ROOT: "/tmp/videoagent-story-local-case/assets",
  };
  for (const storyRoot of ["/", ".", "/tmp/not-a-dedicated-story-root", "/tmp/videoagent-story-local-case/assets/story"]) {
    assert.throws(() => parseLocalManualCaseOptions(["--target=local"], {
      ...base,
      STORYCANVAS_LOCAL_CASE_ROOT: storyRoot,
    }));
  }
});

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const integrationEnabled = (() => {
  if (!databaseUrl) return false;
  try {
    return decodeURIComponent(new URL(databaseUrl).pathname.slice(1)).endsWith("_test");
  } catch {
    return false;
  }
})();

test("complete case is repeatable, persistent, blocked without Provider, and zero-paid", {
  skip: !integrationEnabled,
  timeout: 180_000,
}, async () => {
  const unique = `${process.pid}-${Date.now()}`;
  const environment = {
    ...process.env,
    ...strongSecrets,
    PILOT_E2E: "true",
    CONTROL_API_TEST_DATABASE_URL: databaseUrl!,
    STORYCANVAS_LOCAL_CASE_ROOT: path.resolve(`/tmp/videoagent-story-local-case-test-${unique}`),
    CANVAS_ASSET_STORAGE_ROOT: path.resolve(`/tmp/videoagent-control-assets-local-case-${unique}`),
  };
  const options = parseLocalManualCaseOptions(["--target=test"], environment);
  const first = await runLocalManualCase(options);
  const replay = await runLocalManualCase({ ...options, resetTestTarget: false });

  assert.equal(first.control.migrationCount, 27);
  assert.equal(first.story.migrationCount, 5);
  assert.deepEqual(first.control.roles, [
    "platform_admin", "channel_admin", "tenant_admin", "content_operator",
  ]);
  assert.deepEqual(first.control.authorityCounts, {
    brief: 1,
    script: 1,
    scriptApproval: 1,
    storyboard: 1,
    storyboardApproval: 1,
    package: 1,
    activeGrant: 1,
    assets: 4,
    authorizedAssets: 4,
    approvedAssets: 4,
  });
  assert.deepEqual(first.story.factCounts, {
    projectMapping: 1,
    acceptedPackage: 1,
    document: 1,
    projectedAssets: 4,
    requirements: 3,
    readiness: 3,
    media: 1,
    assetMapping: 1,
    providerBindings: 0,
    entityBindings: 0,
  });
  assert.deepEqual(first.story.readinessReasonCodes, [
    "PROVIDER_UNAVAILABLE",
    "ENTITY_BINDING_MISSING",
    "CAPABILITY_UNAVAILABLE",
  ]);
  assert.equal(first.providerConfigured, false);
  assert.equal(first.paidProviderCalls, 0);
  assert.equal(first.status, "BLOCKED_NO_PROVIDER");
  assert.equal(replay.semanticFingerprint, first.semanticFingerprint);
  assert.deepEqual(replay.control.authorityCounts, first.control.authorityCounts);
  assert.deepEqual(replay.story.factCounts, first.story.factCounts);
  assert.equal(replay.entry.handle, first.entry.handle);
  assert.doesNotMatch(JSON.stringify(first), /accessToken|password|secret|authorization/i);
});
