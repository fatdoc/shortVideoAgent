import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import knex, { type Knex } from "knex";

import {
  parseCanvasV1BrowserContract,
  type AssetRecordV01,
  type CanvasCommandV01,
  type CanvasEventV01,
  type ShotAssetRequirementV01,
  type ShotReadinessV01,
} from "@/contracts/canvas-v1";
import canvasV1Migration from "../../../migrations/005_canvas_v1_asset_command";
import { CanvasCommandService } from "@/services/storycanvas/canvas-v1";
import {
  CANVAS_AGENT_TOOL_NAMES,
  CanvasAgentPolicyError,
  CanvasAgentRuntime,
  buildCanvasAgentCommand,
  canvasAgentContractScope,
  type CanvasAgentRuntimeOptions,
} from ".";

const authority = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  packageId: "33333333-3333-4333-8333-333333333333",
  canvasSessionId: "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678",
  actorId: "12121212-1212-4212-8212-121212121212",
} as const;
const occurredAt = "2026-08-14T02:02:00.000Z";
const contractScope = canvasAgentContractScope(authority);
const assetId = "88888888-8888-4888-8888-888888888888";
const entityId = "16161616-1616-4616-8616-161616161616";
const shotId = "66666666-6666-4666-8666-666666666666";
const readinessId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const documentId = "77777777-7777-4777-8777-777777777777";
const approvalId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const asset: AssetRecordV01 = {
  objectType: "AssetRecord",
  contractVersion: "0.1",
  ...contractScope,
  assetId,
  category: "virtual_character",
  displayName: "门店讲解员",
  provenance: {
    kind: "provider_generated",
    sourceAssetId: null,
    declaredByActorId: authority.actorId,
    declaredAt: occurredAt,
  },
  rights: {
    status: "authorized",
    basis: "provider_generated",
    validFrom: occurredAt,
    validUntil: null,
    reviewedAt: occurredAt,
  },
  approval: { status: "approved", reviewedByActorId: authority.actorId, reviewedAt: occurredAt },
  controlledPreviewUrl: `/api/canvas-v1/assets/${assetId}/preview`,
  createdAt: occurredAt,
  updatedAt: occurredAt,
  occurredAt,
};

const requirement: ShotAssetRequirementV01 = {
  objectType: "ShotAssetRequirement",
  contractVersion: "0.1",
  ...contractScope,
  requirementId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  shotId,
  assetCategory: "virtual_character",
  entityId,
  status: "satisfied",
  source: {
    scriptId: "44444444-4444-4444-8444-444444444444",
    scriptVersion: 3,
    storyboardId: "55555555-5555-4555-8555-555555555555",
    storyboardVersion: 2,
  },
  requiredCapabilities: ["video_generation"],
  createdAt: occurredAt,
  updatedAt: occurredAt,
  occurredAt,
};

function readiness(overrides: Partial<ShotReadinessV01> = {}): ShotReadinessV01 {
  return {
    objectType: "ShotReadiness",
    contractVersion: "0.1",
    ...contractScope,
    readinessId,
    shotId,
    ready: true,
    reasonCodes: [],
    script: { scriptId: requirement.source.scriptId, version: 3, current: true },
    storyboard: { storyboardId: requirement.source.storyboardId, version: 2, current: true },
    requirements: [{
      requirementId: requirement.requirementId,
      assetId,
      scopeMatched: true,
      rightsStatus: "authorized",
      approvalStatus: "approved",
      providerStatus: "active",
      entityBindingStatus: "approved",
      capabilityAvailable: true,
      ready: true,
      reasonCodes: [],
    }],
    evaluatedAt: occurredAt,
    occurredAt,
    ...overrides,
  };
}

function event(command: CanvasCommandV01, replayed = false): CanvasEventV01 {
  return {
    objectType: "CanvasEvent",
    contractVersion: "0.1",
    tenantId: command.tenantId,
    projectId: command.projectId,
    packageId: command.packageId,
    canvasSessionId: command.canvasSessionId,
    eventId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    commandId: command.commandId,
    commandType: command.commandType,
    status: "accepted",
    providerSubmitted: false,
    taskCreated: false,
    outputRegistered: false,
    receiptRecorded: false,
    taskId: null,
    outputAssetId: null,
    receiptId: null,
    replayed,
    error: null,
    requestId: command.requestId,
    occurredAt,
  };
}

function idSequence() {
  const ids = [
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    "abababab-abab-4bab-8bab-abababababab",
    "acacacac-acac-4cac-8cac-acacacacacac",
    "adadadad-adad-4dad-8dad-adadadadadad",
  ];
  return () => ids.shift() ?? "aeaeaeae-aeae-4eae-8eae-aeaeaeaeaeae";
}

function options(overrides: Partial<CanvasAgentRuntimeOptions> = {}): CanvasAgentRuntimeOptions {
  return {
    authority,
    ports: {
      listProjectAssets: async () => [asset],
      listShotRequirements: async () => [requirement],
      getShotReadiness: async () => readiness(),
      getGenerationEvent: async () => null,
      executeCanvasCommand: async (command) => event(command),
    },
    now: () => new Date(occurredAt),
    randomId: idSequence(),
    ...overrides,
  };
}

test("freezes the exact allowlist and rejects unknown, cross-scope, provider and batch arguments", async () => {
  assert.deepEqual(CANVAS_AGENT_TOOL_NAMES, [
    "list_project_assets",
    "inspect_asset_readiness",
    "analyze_script_entities",
    "propose_missing_assets",
    "create_virtual_character",
    "sync_provider_asset",
    "bind_asset_to_entity",
    "generate_shot",
    "get_generation_task",
    "select_shot_output",
    "save_canvas_document",
    "export_playlist",
  ]);
  let reads = 0;
  let dispatches = 0;
  const runtime = new CanvasAgentRuntime(options({
    ports: {
      ...options().ports,
      listProjectAssets: async () => { reads += 1; return [asset]; },
      executeCanvasCommand: async (command) => { dispatches += 1; return event(command); },
    },
  }));

  for (const [name, input] of [
    ["drop_database", {}],
    ["list_project_assets", { tenantId: authority.tenantId }],
    ["sync_provider_asset", { assetId, providerAssetId: "private" }],
    ["generate_shot", { shotIds: [shotId], readinessId, prompt: "x", referenceAssetIds: [assetId] }],
  ] as const) {
    await assert.rejects(
      () => runtime.invokeTool(name, input),
      (error: unknown) => error instanceof CanvasAgentPolicyError && error.code === "CANVAS_AGENT_TOOL_INPUT_INVALID",
    );
  }
  assert.equal(reads, 0);
  assert.equal(dispatches, 0);
});

test("missing assets and non-ready shots only return a deterministic plan with zero dispatch", async () => {
  let dispatches = 0;
  const missing = readiness({
    ready: false,
    reasonCodes: ["REQUIRED_ASSET_MISSING", "ENTITY_BINDING_MISSING"],
    requirements: [{
      ...readiness().requirements[0],
      assetId: null,
      entityBindingStatus: null,
      ready: false,
      reasonCodes: ["REQUIRED_ASSET_MISSING", "ENTITY_BINDING_MISSING"],
    }],
  });
  const runtime = new CanvasAgentRuntime(options({
    ports: {
      ...options().ports,
      listProjectAssets: async () => [],
      getShotReadiness: async () => missing,
      executeCanvasCommand: async (command) => { dispatches += 1; return event(command); },
    },
  }));

  const proposal = await runtime.invokeTool("propose_missing_assets", { shotId });
  assert.equal(proposal.status, "blocked");
  assert.deepEqual(proposal.reasonCodes, ["REQUIRED_ASSET_MISSING", "ENTITY_BINDING_MISSING"]);
  assert.equal(proposal.plan?.[0]?.action, "provide_or_authorize_asset");

  const generated = await runtime.invokeTool("generate_shot", {
    shotId,
    readinessId,
    prompt: "门店入口介绍招牌套餐",
    referenceAssetIds: [assetId],
  });
  assert.equal(generated.status, "blocked");
  assert.deepEqual(generated.reasonCodes, missing.reasonCodes);
  assert.equal(dispatches, 0);
});

test("high-cost tools cannot receive or mint approval and only host resume can dispatch the exact pending action", async () => {
  const commands: CanvasCommandV01[] = [];
  const runtime = new CanvasAgentRuntime(options({
    ports: {
      ...options().ports,
      executeCanvasCommand: async (command) => { commands.push(command); return event(command); },
    },
  }));
  const input = { shotId, readinessId, prompt: "门店入口介绍招牌套餐", referenceAssetIds: [assetId] };

  await assert.rejects(
    () => runtime.invokeTool("generate_shot", { ...input, approvalId }),
    (error: unknown) => error instanceof CanvasAgentPolicyError && error.code === "CANVAS_AGENT_TOOL_INPUT_INVALID",
  );
  const pending = await runtime.invokeTool("generate_shot", input);
  assert.equal(pending.status, "confirmation_required");
  assert.equal(pending.pendingAction?.commandType, "GENERATE_SHOT");
  assert.deepEqual(pending.pendingAction?.payload, input);
  assert.equal(commands.length, 0);

  await assert.rejects(
    () => runtime.resumeApproved({ commandId: "abababab-abab-4bab-8bab-abababababab", approvalId }),
    (error: unknown) => error instanceof CanvasAgentPolicyError && error.code === "CANVAS_AGENT_CONFIRMATION_INVALID",
  );
  const dispatched = await runtime.resumeApproved({ commandId: pending.pendingAction!.commandId, approvalId });
  assert.equal(dispatched.status, "dispatched");
  assert.equal(commands.length, 1);
  assert.equal(commands[0].requestSource, "agent");
  assert.equal(commands[0].approvalId, approvalId);
  assert.equal(commands[0].commandId, pending.pendingAction?.commandId);
  assert.deepEqual(commands[0].payload, pending.pendingAction?.payload);
});

test("validates a complete pending command before confirmation and exact-checks the host resume envelope", async () => {
  const invalidCorrelation = new CanvasAgentRuntime(options({ randomId: () => "not-a-uuid" }));
  await assert.rejects(
    () => invalidCorrelation.invokeTool("generate_shot", {
      shotId,
      readinessId,
      prompt: "门店入口介绍招牌套餐",
      referenceAssetIds: [assetId],
    }),
    (error: unknown) => error instanceof CanvasAgentPolicyError && error.code === "CANVAS_AGENT_TOOL_INPUT_INVALID",
  );

  const runtime = new CanvasAgentRuntime(options());
  const pending = await runtime.invokeTool("generate_shot", {
    shotId,
    readinessId,
    prompt: "门店入口介绍招牌套餐",
    referenceAssetIds: [assetId],
  });
  for (const confirmation of [
    { commandId: pending.pendingAction!.commandId, approvalId, userConfirmed: true },
    { commandId: pending.pendingAction!.commandId, approvalId, tenantId: authority.tenantId },
    { commandId: pending.pendingAction!.commandId },
  ]) {
    await assert.rejects(
      () => runtime.resumeApproved(confirmation),
      (error: unknown) => error instanceof CanvasAgentPolicyError && error.code === "CANVAS_AGENT_CONFIRMATION_INVALID",
    );
  }
  assert.equal(JSON.stringify(pending).includes("00000000-0000-4000-8000-000000000001"), false);
});

test("Agent commands pass the frozen parser and are structurally identical to the UI command shape", () => {
  const agent = buildCanvasAgentCommand({
    authority,
    commandId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    commandType: "GENERATE_SHOT",
    approvalId,
    payload: { shotId, readinessId, prompt: "店员在门店入口介绍招牌套餐，镜头稳定。", referenceAssetIds: [assetId] },
    requestId: "req-canvas-command-001",
    occurredAt,
  });
  const parsed = parseCanvasV1BrowserContract(agent);
  assert.equal(parsed.objectType, "CanvasCommand");
  const fixturePath = path.resolve(__dirname, "../../../../../docs/program/contracts/canvas-v1/fixtures/canvas-command.json");
  const uiFixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as CanvasCommandV01;
  assert.deepEqual(Object.keys(agent).sort(), Object.keys(uiFixture).sort());
  assert.deepEqual(Object.keys(agent.payload).sort(), Object.keys(uiFixture.payload).sort());
  assert.deepEqual(
    { ...agent, requestSource: "user" },
    uiFixture,
  );
});

test("enforces exact approval policy for all five high-cost commands while low-cost sync and save dispatch directly", async () => {
  const commands: CanvasCommandV01[] = [];
  const runtime = new CanvasAgentRuntime(options({
    ports: {
      ...options().ports,
      executeCanvasCommand: async (command) => { commands.push(command); return event(command); },
    },
  }));
  const highCost: Array<[string, Record<string, unknown>, string]> = [
    ["create_virtual_character", { assetId, entityId, prompt: "稳定的虚拟讲解员设定" }, "CREATE_VIRTUAL_CHARACTER"],
    ["bind_asset_to_entity", { assetId, entityId }, "BIND_ASSET_TO_ENTITY"],
    ["generate_shot", { shotId, readinessId, prompt: "门店入口介绍套餐", referenceAssetIds: [assetId] }, "GENERATE_SHOT"],
    ["select_shot_output", { shotId, outputAssetId: "13131313-1313-4313-8313-131313131313", documentId, expectedVersion: 4 }, "SELECT_SHOT_OUTPUT"],
    ["export_playlist", { documentId, expectedVersion: 4 }, "EXPORT_PLAYLIST"],
  ];
  for (const [tool, input, commandType] of highCost) {
    const pending = await runtime.invokeTool(tool, input);
    assert.equal(pending.status, "confirmation_required");
    assert.equal(pending.pendingAction?.commandType, commandType);
  }
  assert.equal(commands.length, 0);

  const sync = await runtime.invokeTool("sync_provider_asset", { assetId });
  assert.equal(sync.status, "dispatched");
  const save = await runtime.invokeTool("save_canvas_document", {
    documentId,
    expectedVersion: 4,
    shots: [{ shotId, position: 0, selectedOutputAssetId: null, prompt: "门店入口介绍套餐", updatedAt: occurredAt }],
    playlist: { shotIds: [shotId] },
  });
  assert.equal(save.status, "dispatched");
  assert.deepEqual(commands.map((command) => [command.commandType, command.approvalId]), [
    ["SYNC_PROVIDER_ASSET", null],
    ["SAVE_CANVAS_DOCUMENT", null],
  ]);
});

test("cross-scope and forbidden read-port values fail closed without leaking raw values", async () => {
  for (const unsafe of [
    { ...asset, tenantId: "99999999-9999-4999-8999-999999999999" },
    { ...asset, controlledPreviewUrl: "asset://private-value" },
    { ...asset, providerAssetId: "private-provider-id" },
  ]) {
    const runtime = new CanvasAgentRuntime(options({
      ports: { ...options().ports, listProjectAssets: async () => [unsafe] },
    }));
    await assert.rejects(
      () => runtime.invokeTool("list_project_assets", {}),
      (error: unknown) => {
        assert.equal(error instanceof CanvasAgentPolicyError, true);
        assert.equal(JSON.stringify(error).includes("private-value"), false);
        assert.equal(JSON.stringify(error).includes("private-provider-id"), false);
        return true;
      },
    );
  }
});

test("projects host authority to the four-field contract scope and rejects leaked actorId", async () => {
  assert.deepEqual(contractScope, {
    tenantId: authority.tenantId,
    projectId: authority.projectId,
    packageId: authority.packageId,
    canvasSessionId: authority.canvasSessionId,
  });
  assert.equal("actorId" in contractScope, false);
  const runtime = new CanvasAgentRuntime(options());
  const valid = await runtime.invokeTool("list_project_assets", {});
  assert.equal(valid.status, "ok");

  const leaked = { ...asset, actorId: authority.actorId };
  const unsafe = new CanvasAgentRuntime(options({
    ports: { ...options().ports, listProjectAssets: async () => [leaked] },
  }));
  await assert.rejects(
    () => unsafe.invokeTool("list_project_assets", {}),
    (error: unknown) => error instanceof CanvasAgentPolicyError && error.code === "CANVAS_AGENT_OUTPUT_UNSAFE",
  );
});

test("response-loss retries the complete identical command and the common service starts production once", async (context) => {
  const database: Knex = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  context.after(() => database.destroy());
  await canvasV1Migration.up(database);
  let providerStarts = 0;
  const service = new CanvasCommandService({
    database,
    resolveScope: async () => ({ ...authority, localProjectId: 42 }),
    validateApproval: async () => true,
    getReadiness: async () => readiness(),
    resolveProviderAssetUris: async () => ["asset://server-only-reference"],
    startShotProduction: async () => {
      providerStarts += 1;
      return { taskId: "18181818-1818-4818-8818-181818181818" };
    },
    now: () => new Date(occurredAt),
    randomId: () => "ffffffff-ffff-4fff-8fff-ffffffffffff",
  });
  const attempts: CanvasCommandV01[] = [];
  let loseResponse = true;
  const runtime = new CanvasAgentRuntime(options({
    ports: {
      ...options().ports,
      executeCanvasCommand: async (command) => {
        attempts.push(structuredClone(command));
        const result = await service.execute(command);
        if (loseResponse) {
          loseResponse = false;
          throw new Error("untrusted transport detail");
        }
        return result;
      },
    },
  }));
  const pending = await runtime.invokeTool("generate_shot", {
    shotId,
    readinessId,
    prompt: "门店入口介绍招牌套餐",
    referenceAssetIds: [assetId],
  });
  const first = await runtime.resumeApproved({ commandId: pending.pendingAction!.commandId, approvalId });
  const retry = await runtime.resumeApproved({ commandId: pending.pendingAction!.commandId, approvalId });
  assert.equal(first.status, "failed");
  assert.equal(retry.status, "dispatched");
  assert.equal(retry.event?.replayed, true);
  assert.deepEqual(attempts[1], attempts[0]);
  assert.equal(providerStarts, 1);
});

test("supports the controlled analysis-to-plan-to-confirm-to-single-shot workflow", async () => {
  let dispatches = 0;
  const runtime = new CanvasAgentRuntime(options({
    ports: {
      ...options().ports,
      executeCanvasCommand: async (command) => { dispatches += 1; return event(command); },
    },
  }));
  const analysis = await runtime.invokeTool("analyze_script_entities", { shotId });
  assert.equal(analysis.status, "ok");
  assert.deepEqual(analysis.analysis?.categories, ["virtual_character"]);
  const inspected = await runtime.invokeTool("inspect_asset_readiness", { shotId });
  assert.equal(inspected.status, "ok");
  const pending = await runtime.invokeTool("generate_shot", {
    shotId,
    readinessId,
    prompt: "门店入口介绍招牌套餐",
    referenceAssetIds: [assetId],
  });
  assert.equal(dispatches, 0);
  const result = await runtime.resumeApproved({ commandId: pending.pendingAction!.commandId, approvalId });
  assert.equal(result.status, "dispatched");
  assert.equal(dispatches, 1);
});

test("production Agent modules cannot reach legacy agents, database, provider, memory or internal URI", () => {
  const root = path.resolve(process.cwd(), "src/agents/canvas-v1");
  const files = fs.readdirSync(root).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"));
  const source = files.map((name) => fs.readFileSync(path.join(root, name), "utf8")).join("\n");
  for (const marker of [
    "productionAgent",
    "scriptAgent",
    "@/utils",
    "knex",
    "Memory",
    "u.db",
    "u.vendor",
    "byteplus",
    "seedance",
  ]) {
    assert.equal(source.includes(marker), false, `forbidden architecture marker: ${marker}`);
  }
  assert.equal(/['"]asset:\/\//u.test(source), false, "internal URI must not be a product-code literal");
});
