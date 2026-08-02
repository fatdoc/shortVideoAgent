import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import knex, { type Knex } from "knex";
import coreMigration from "../../../migrations/001_storycanvas_core";
import continuityMigration from "../../../migrations/002_storycanvas_continuity_memory";
import contractMigration from "../../../migrations/003_storycanvas_production_contract";
import runtimeMigration from "../../../migrations/004_storycanvas_phase1_runtime";
import canonicalPackage from "@/fixtures/production-contract/v0.1/project-production-package.json";
import { Phase1RuntimeService } from "./phase1Runtime";
import { DemoFixtureRuntimeAdapter, type PlayableAssetValidator, type RuntimeProviderAdapter } from "./phase1RuntimeAdapter";

const NOW = "2026-08-02T08:00:00.000Z";
const PACKAGE_RECORD_ID = "90000000-0000-4000-8000-000000000001";
const SCRIPT_VERSION_ID = "90000000-0000-4000-8000-000000000002";

async function createDatabase() {
  const database = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  await database.raw("PRAGMA foreign_keys = ON");
  await database.schema.createTable("o_project", (table) => table.integer("id").primary());
  await database.schema.createTable("o_script", (table) => table.integer("id").primary());
  await database.schema.createTable("o_storyboard", (table) => table.integer("id").primary());
  await database.schema.createTable("o_image", (table) => table.integer("id").primary());
  await database.schema.createTable("o_video", (table) => table.integer("id").primary());
  await coreMigration.up(database);
  await continuityMigration.up(database);
  await contractMigration.up(database);
  await runtimeMigration.up(database);
  await database("o_project").insert({ id: 1 });
  await database("o_script").insert({ id: 1 });
  await database("sc_project_profile").insert({
    projectId: 1, category: "local-life-food", status: "canvas_ready", briefJson: "{}",
    currentScriptVersionId: SCRIPT_VERSION_ID, createdAt: NOW, updatedAt: NOW,
  });
  await database("sc_script_versions").insert({
    id: SCRIPT_VERSION_ID, projectId: 1, scriptId: 1, version: 1,
    structuredJson: JSON.stringify(canonicalPackage.approvedScriptVersion), source: "contract-v0.1", createdAt: NOW,
  });
  await database("sc_scenes").insert({
    id: "90000000-0000-4000-8000-000000000003", projectId: 1, title: "fixture", description: "", location: "fixture", sortOrder: 1,
  });
  await database("sc_production_packages").insert({
    id: PACKAGE_RECORD_ID,
    packageId: canonicalPackage.packageId,
    packageVersion: canonicalPackage.packageVersion,
    contractVersion: canonicalPackage.contractVersion,
    tenantId: canonicalPackage.tenantId,
    externalProjectId: canonicalPackage.projectId,
    internalProjectId: 1,
    idempotencyKey: canonicalPackage.idempotencyKey,
    payloadDigest: canonicalPackage.digest,
    sourceSuiteDigest: "sha256:" + "1".repeat(64),
    capabilityIdsJson: JSON.stringify(canonicalPackage.capabilityGrants.map((grant) => grant.capabilityId)),
    snapshotJson: JSON.stringify(canonicalPackage),
    status: "accepted",
    acceptedAt: NOW,
    createdAt: NOW,
  });
  for (const shot of canonicalPackage.shotDrafts) {
    await database("o_storyboard").insert({ id: shot.order });
    await database("sc_external_mappings").insert({
      id: crypto.randomUUID(), system: "saas-control-plane", entityType: "shot", localId: String(shot.order), externalId: shot.id, metadataJson: "{}", createdAt: NOW,
    });
    await database("sc_shot_metadata").insert({
      storyboardId: shot.order, sceneId: "90000000-0000-4000-8000-000000000003", shotType: shot.shotType,
      cameraMovement: shot.cameraPosition, visualDescription: shot.description, imagePrompt: `image ${shot.id}`,
      videoPrompt: `video ${shot.id}`, narration: shot.narration, onScreenText: shot.screenText, transitionName: "cut",
      materialStrategy: shot.sourceType, durationSeconds: shot.duration, locked: false, sortOrder: shot.order, generationStatus: "ready",
    });
    await database("sc_shot_contracts").insert({
      projectId: 1, shotId: shot.order, worldRevision: 1, entitySlugsJson: "[]",
      mustPreserveJson: JSON.stringify(["approved facts"]), requiredStateJson: "{}", statePatchJson: "{}",
      actionJson: "{}", cameraJson: "{}", transitionJson: "{}", updatedAt: NOW,
    });
  }
  return database;
}

const validFixtureValidator: PlayableAssetValidator = async (output) => {
  const file = output.localPath ? await import("node:fs/promises").then(({ stat }) => stat(output.localPath!)) : null;
  return {
    status: file && file.size > 0 && output.playableUrl ? "valid" : "missing",
    playable: Boolean(file && file.size > 0 && output.playableUrl),
    durationSeconds: 3.75,
    width: 720,
    height: 1280,
    details: { validator: "test-fixture" },
  };
};

async function makeRuntime(database: Knex) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "storycanvas-phase1-"));
  const fixturePath = path.join(directory, "fixture.mp4");
  await writeFile(fixturePath, Buffer.from("phase1-local-video-fixture"));
  const runtime = new Phase1RuntimeService(database, {
    adapter: new DemoFixtureRuntimeAdapter({ fixturePath, outputDirectory: path.join(directory, "outputs"), actualCredit: 100 }),
    validator: validFixtureValidator,
    clock: () => new Date(NOW),
  });
  return { runtime, directory };
}

async function approvePlan(runtime: Phase1RuntimeService, shotId: string, suffix: string) {
  return runtime.saveGenerationPlan(shotId, {
    imagePrompt: `image prompt ${suffix}`,
    videoPrompt: `video prompt ${suffix}`,
    estimatedCredit: 100,
    generatedBy: "phase1-test-agent",
    approvedByOperator: "operator-test",
    idempotencyKey: `plan-idempotency-${suffix}`,
  });
}

test("stable Shot mapping, persisted creative fields, references, task idempotency and playable success", async (context) => {
  const database = await createDatabase();
  const { runtime, directory } = await makeRuntime(database);
  context.after(async () => { await database.destroy(); await rm(directory, { recursive: true, force: true }); });

  const firstSync = await runtime.synchronizeProductionShots(canonicalPackage.projectId);
  const secondSync = await runtime.synchronizeProductionShots(canonicalPackage.projectId);
  assert.equal(firstSync.length, 8);
  assert.deepEqual(firstSync.map((shot) => shot.id), secondSync.map((shot) => shot.id));
  const shot = firstSync[0];

  await assert.rejects(() => runtime.updateCreativeFields(shot.id, { price: 88 }), /已审批商业事实/);
  await assert.rejects(() => runtime.updateCreativeFields(shot.id, { requiredCTA: "changed" }), /已审批商业事实/);
  await runtime.updateCreativeFields(shot.id, { videoPrompt: "operator persisted prompt" });
  await runtime.replaceReferences(shot.id, [{ referenceRole: "previs_reference", sourceUri: "demo://previs/shot-01" }]);
  await approvePlan(runtime, shot.id, "shot-01-v1");

  const created = await runtime.createTask({
    shotId: shot.id, taskType: "video-generation", model: "demo:fixture-v1",
    idempotencyKey: "task-idempotency-shot-01-v1", reservedCredit: 120,
  });
  const duplicate = await runtime.createTask({
    shotId: shot.id, taskType: "video-generation", model: "demo:fixture-v1",
    idempotencyKey: "task-idempotency-shot-01-v1", reservedCredit: 120,
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.task.id, created.task.id);
  assert.equal((await database("sc_runtime_credit_entries").where({ taskId: created.task.id, operation: "reserve" })).length, 1);

  const succeeded = await runtime.runDemoTask(created.task.id);
  assert.equal(succeeded.status, "succeeded");
  assert.equal(succeeded.consumedCredit, 100);
  assert.equal(succeeded.releasedCredit, 20);
  const asset = await database("sc_media_assets").where({ attemptId: created.attempt.id }).first();
  assert.equal(asset.validationStatus, "valid");
  assert.ok(asset.playableUrl);
  assert.equal((await database("sc_receipt_outbox").where({ receiptType: "task", businessId: created.task.id })).length, 1);
  assert.equal((await database("sc_receipt_outbox").where({ receiptType: "asset", businessId: asset.id })).length, 1);

  await runtime.decideAttempt(shot.id, created.attempt.id, "selected");
  const restoreAdapter: RuntimeProviderAdapter = {
    mode: "DEMO",
    provider: "restore-only",
    async submit() { return { providerTaskId: "unused" }; },
    async poll() { return { status: "failed", errorCode: "UNUSED", errorMessage: "unused" }; },
    async cancel() {},
  };
  const restored = await new Phase1RuntimeService(database, { adapter: restoreAdapter, validator: validFixtureValidator })
    .listProjectState(canonicalPackage.projectId);
  assert.equal(restored.shots[0].editableCreativeFields.videoPrompt, "operator persisted prompt");
  assert.equal(restored.shots[0].selectedAttemptId, created.attempt.id);
  assert.equal(restored.attempts.length, 1);
});

test("multiple attempts keep one selected version and invalid media never succeeds or consumes", async (context) => {
  const database = await createDatabase();
  const { runtime, directory } = await makeRuntime(database);
  context.after(async () => { await database.destroy(); await rm(directory, { recursive: true, force: true }); });
  const [shot] = await runtime.synchronizeProductionShots(canonicalPackage.projectId);
  await approvePlan(runtime, shot.id, "multi-version");
  const first = await runtime.createTask({ shotId: shot.id, taskType: "video-generation", model: "demo:v1", idempotencyKey: "task-multi-version-0001", reservedCredit: 120 });
  const second = await runtime.createTask({ shotId: shot.id, taskType: "video-generation", model: "demo:v1", idempotencyKey: "task-multi-version-0002", reservedCredit: 120 });
  await runtime.runDemoTask(first.task.id);
  await runtime.runDemoTask(second.task.id);
  await runtime.decideAttempt(shot.id, first.attempt.id, "selected");
  await runtime.decideAttempt(shot.id, second.attempt.id, "selected");
  assert.equal((await database("sc_shot_attempts").where({ productionShotId: shot.id, isSelected: true })).length, 1);
  assert.equal((await database("sc_production_shots").where({ id: shot.id }).first()).selectedAttemptId, second.attempt.id);

  const invalidRuntime = new Phase1RuntimeService(database, {
    adapter: new DemoFixtureRuntimeAdapter({ fixturePath: path.join(directory, "fixture.mp4"), outputDirectory: path.join(directory, "invalid") }),
    validator: async () => ({ status: "invalid", playable: false, durationSeconds: null, width: null, height: null, details: { reason: "test" } }),
    clock: () => new Date(NOW),
  });
  const failed = await invalidRuntime.createTask({ shotId: shot.id, taskType: "video-generation", model: "demo:invalid", idempotencyKey: "task-invalid-media-0001", reservedCredit: 80 });
  const result = await invalidRuntime.runDemoTask(failed.task.id);
  assert.equal(result.status, "failed");
  assert.equal(result.consumedCredit, 0);
  assert.equal(result.releasedCredit, 80);
  assert.equal((await database("sc_receipt_outbox").where({ receiptType: "asset", businessId: failed.task.id })).length, 0);
});

test("failure and cancellation release all reserved credit without duplicate settlement", async (context) => {
  const database = await createDatabase();
  const { runtime, directory } = await makeRuntime(database);
  context.after(async () => { await database.destroy(); await rm(directory, { recursive: true, force: true }); });
  const shots = await runtime.synchronizeProductionShots(canonicalPackage.projectId);
  await approvePlan(runtime, shots[1].id, "cancel");
  const cancelled = await runtime.createTask({ shotId: shots[1].id, taskType: "video-generation", model: "demo:v1", idempotencyKey: "task-cancel-0001", reservedCredit: 80 });
  await runtime.cancelTask(cancelled.task.id);
  await runtime.cancelTask(cancelled.task.id);
  const cancelledRow = await database("sc_tasks").where({ id: cancelled.task.id }).first();
  assert.equal(cancelledRow.status, "cancelled");
  assert.equal(Number(cancelledRow.releasedCredit), 80);
  assert.equal((await database("sc_runtime_credit_entries").where({ taskId: cancelled.task.id, operation: "release" })).length, 1);

  await approvePlan(runtime, shots[2].id, "provider-failure");
  const failingAdapter: RuntimeProviderAdapter = {
    mode: "DEMO", provider: "FailingDemo",
    async submit() { return { providerTaskId: "provider-failed-1" }; },
    async poll() { return { status: "failed", errorCode: "PROVIDER_FAILED", errorMessage: "fixture failure" }; },
    async cancel() {},
  };
  const failingRuntime = new Phase1RuntimeService(database, { adapter: failingAdapter, validator: validFixtureValidator, clock: () => new Date(NOW) });
  const failed = await failingRuntime.createTask({ shotId: shots[2].id, taskType: "video-generation", model: "demo:fail", idempotencyKey: "task-failure-0001", reservedCredit: 80 });
  const failedResult = await failingRuntime.runDemoTask(failed.task.id);
  assert.equal(failedResult.status, "failed");
  assert.equal(failedResult.releasedCredit, 80);
});

test("rough cut requires eight valid selections and tenant approval before traceable export", async (context) => {
  const database = await createDatabase();
  const { runtime, directory } = await makeRuntime(database);
  context.after(async () => { await database.destroy(); await rm(directory, { recursive: true, force: true }); });
  const shots = await runtime.synchronizeProductionShots(canonicalPackage.projectId);
  await assert.rejects(() => runtime.createRoughCut(canonicalPackage.projectId, "rough-cut-before-selection"), /尚未选择版本/);

  let firstAssetId = "";
  for (const shot of shots) {
    await approvePlan(runtime, shot.id, `rough-${shot.sequence}`);
    const created = await runtime.createTask({
      shotId: shot.id, taskType: "video-generation", model: "demo:fixture-v1",
      idempotencyKey: `task-rough-cut-${shot.sequence}-v1`, reservedCredit: 120,
    });
    await runtime.runDemoTask(created.task.id);
    const selected = await runtime.decideAttempt(shot.id, created.attempt.id, "selected");
    if (!firstAssetId) firstAssetId = selected.assetId;
  }

  const roughCut = await runtime.createRoughCut(canonicalPackage.projectId, "rough-cut-complete-v1");
  assert.equal(roughCut.orderedShotSelections.length, 8);
  await assert.rejects(() => runtime.approveRoughCut(roughCut.id, { id: "operator", role: "production.operator" }), /tenant.owner/);
  await assert.rejects(() => runtime.createExportArtifact(roughCut.id, firstAssetId), /企业确认粗剪/);
  await runtime.approveRoughCut(roughCut.id, { id: "tenant-owner", role: "tenant.owner" });
  const exported = await runtime.createExportArtifact(roughCut.id, firstAssetId);
  assert.equal(exported.status, "succeeded");
  assert.equal(exported.provenance.storyboardShotIds.length, 8);
  assert.equal(exported.provenance.attempts.length, 8);
  assert.equal(exported.provenance.brandFactIds.join(","), "C1,C2,C3,C4,C5,C6,C7,C8");
  assert.equal((await database("sc_receipt_outbox").where({ receiptType: "export", businessId: exported.id })).length, 1);
});
