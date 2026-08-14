import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

// Knex publishes types for its package root but not for its explicit ESM runtime entry.
// @ts-expect-error the integration test uses the package's stable ESM runtime entry
import controlKnex from "../../apps/control-api/node_modules/knex/knex.mjs";
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
  const localWithoutPassword = Object.fromEntries(
    Object.entries(strongSecrets).filter(([key]) => key !== "PILOT_LOCAL_ACCOUNT_PASSWORD"),
  );
  assert.equal(parseLocalManualCaseOptions(["--target", "local"], {
    ...localWithoutPassword,
    DATABASE_URL: "postgresql://127.0.0.1:5432/videoagent_control",
    STORYCANVAS_LOCAL_CASE_ROOT: storyRoot,
    CANVAS_ASSET_STORAGE_ROOT: assetRoot,
  }).accountPassword, null);
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
  const verificationDatabase = controlKnex({
    client: "pg",
    connection: databaseUrl,
    pool: { min: 0, max: 1 },
  });
  const invitationRows = await verificationDatabase("control_plane.invitations")
    .select(
      "invitation_type",
      "target_email_normalized",
      "status",
      "token_digest",
      "creation_idempotency_key",
    )
    .whereIn("creation_idempotency_key", [
      "canvas-local-manual-case-v1:invitation:platform",
      "canvas-local-manual-case-v1:invitation:channel",
      "canvas-local-manual-case-v1:invitation:tenant",
    ])
    .orderBy("invitation_type");
  assert.deepEqual(invitationRows.map((row) => ({
    type: row.invitation_type,
    email: row.target_email_normalized,
    status: row.status,
    hasDigestOnly: /^sha256:v1:[0-9a-f]{64}$/u.test(String(row.token_digest)),
  })), [
    { type: "CHANNEL", email: null, status: "revoked", hasDigestOnly: true },
    {
      type: "PLATFORM",
      email: "canvas-local-platform@example.invalid",
      status: "revoked",
      hasDigestOnly: true,
    },
    {
      type: "TENANT_MEMBER",
      email: "canvas-local-tenant@example.invalid",
      status: "revoked",
      hasDigestOnly: true,
    },
  ]);
  const termsDocument = await verificationDatabase("control_plane.terms_documents")
    .where({ document_code: "canvas-local-case-terms" }).first();
  assert.equal(termsDocument?.status, "active");
  assert.match(String(termsDocument?.title), /CANVAS_FULL_CASE_TERMS/u);
  const termsVersions = await verificationDatabase("control_plane.terms_versions")
    .where({ terms_document_id: termsDocument?.terms_document_id });
  assert.equal(termsVersions.length, 1);
  assert.deepEqual(termsVersions.map((row) => ({
    status: row.status,
    locale: row.locale,
    mustReaccept: row.must_reaccept,
    publishedAt: row.published_at,
  })), [{ status: "DRAFT", locale: "zh-CN", mustReaccept: false, publishedAt: null }]);
  assert.match(String(termsVersions[0]?.content), /CANVAS_FULL_CASE_TERMS/u);
  assert.equal(Number((await verificationDatabase("control_plane.user_consents")
    .where({ terms_version_id: termsVersions[0]?.terms_version_id })
    .count("* as count").first())?.count ?? 0), 0);
  const forbiddenCommerceTables = [
    "credit_conversion_rule_versions",
    "wallets",
    "recharge_orders",
    "recharge_order_events",
    "payment_events",
    "commission_rule_versions",
    "commission_calculation_outcomes",
    "commission_accruals",
    "commission_reversals",
    "commission_settlements",
    "commission_settlement_items",
  ] as const;
  const forbiddenCommerceSnapshot = Object.fromEntries(await Promise.all(
    forbiddenCommerceTables.map(async (table) => [
      table,
      Number((await verificationDatabase(`control_plane.${table}`).count("* as count").first())?.count ?? 0),
    ]),
  ));
  const beforeReplay = {
    users: await verificationDatabase("control_plane.users").count("* as count").first(),
    projects: await verificationDatabase("control_plane.projects").count("* as count").first(),
    hashes: await verificationDatabase("control_plane.users")
      .select("user_id", "password_hash").orderBy("user_id"),
    invitations: await verificationDatabase("control_plane.invitations")
      .select("invitation_id", "status", "updated_at").orderBy("invitation_id"),
    termsDocuments: await verificationDatabase("control_plane.terms_documents")
      .select("terms_document_id", "status", "updated_at").orderBy("terms_document_id"),
    termsVersions: await verificationDatabase("control_plane.terms_versions")
      .select("terms_version_id", "status", "updated_at").orderBy("terms_version_id"),
    forbiddenCommerce: forbiddenCommerceSnapshot,
  };
  const persistedMarkers = JSON.stringify({
    project: await verificationDatabase("control_plane.projects")
      .where({ project_id: first.entry.projectId }).first("name"),
    brief: await verificationDatabase("control_plane.creative_briefs")
      .where({ project_id: first.entry.projectId }).first("payload"),
    script: await verificationDatabase("control_plane.script_versions")
      .where({ project_id: first.entry.projectId }).first("payload"),
    storyboard: await verificationDatabase("control_plane.storyboard_versions")
      .where({ project_id: first.entry.projectId }).first("payload"),
    production: await verificationDatabase("control_plane.production_packages")
      .where({ package_id: first.entry.packageId }).first("snapshot"),
  });
  for (const marker of ["PROJECT", "BRAND", "BRIEF", "SCRIPT", "STORYBOARD", "PRODUCTION"]) {
    assert.match(persistedMarkers, new RegExp(`CANVAS_FULL_CASE_${marker}`));
  }
  const replay = await runLocalManualCase({
    ...options,
    accountPassword: "Different-Local-Case-2026!",
    resetTestTarget: false,
  });
  const afterReplay = {
    users: await verificationDatabase("control_plane.users").count("* as count").first(),
    projects: await verificationDatabase("control_plane.projects").count("* as count").first(),
    hashes: await verificationDatabase("control_plane.users")
      .select("user_id", "password_hash").orderBy("user_id"),
    invitations: await verificationDatabase("control_plane.invitations")
      .select("invitation_id", "status", "updated_at").orderBy("invitation_id"),
    termsDocuments: await verificationDatabase("control_plane.terms_documents")
      .select("terms_document_id", "status", "updated_at").orderBy("terms_document_id"),
    termsVersions: await verificationDatabase("control_plane.terms_versions")
      .select("terms_version_id", "status", "updated_at").orderBy("terms_version_id"),
    forbiddenCommerce: Object.fromEntries(await Promise.all(
      forbiddenCommerceTables.map(async (table) => [
        table,
        Number((await verificationDatabase(`control_plane.${table}`).count("* as count").first())?.count ?? 0),
      ]),
    )),
  };
  await verificationDatabase.destroy();

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
  assert.deepEqual(first.control.operationsCounts, {
    members: { platform: 2, channel: 1, tenant: 3 },
    revokedInvitations: { platform: 1, channel: 1, tenant: 1 },
    terms: { documents: 1, drafts: 1, published: 0, consents: 0 },
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
  assert.deepEqual(replay.control.operationsCounts, first.control.operationsCounts);
  assert.deepEqual(replay.story.factCounts, first.story.factCounts);
  assert.equal(replay.entry.handle, first.entry.handle);
  assert.deepEqual(afterReplay, beforeReplay);
  assert.doesNotMatch(JSON.stringify(first), /accessToken|password|secret|authorization/i);
});
