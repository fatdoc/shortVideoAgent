import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseCanvasV1BrowserContract,
  type AssetRecordV01,
  type CanvasCommandV01,
  type CanvasEventV01,
  type ShotAssetRequirementV01,
  type ShotReadinessV01,
} from "../../../apps/storycanvas/src/contracts/canvas-v1/index.js";
import {
  CANVAS_AGENT_TOOL_NAMES,
  CanvasAgentPolicyError,
  CanvasAgentRuntime,
  type CanvasAgentRuntimeOptions,
} from "../../../apps/storycanvas/src/agents/canvas-v1/index.js";

const authority = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  packageId: "33333333-3333-4333-8333-333333333333",
  canvasSessionId: "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678",
  actorId: "12121212-1212-4212-8212-121212121212",
} as const;
const scope = {
  tenantId: authority.tenantId,
  projectId: authority.projectId,
  packageId: authority.packageId,
  canvasSessionId: authority.canvasSessionId,
} as const;
const occurredAt = "2026-08-14T02:02:00.000Z";
const assetId = "88888888-8888-4888-8888-888888888888";
const entityId = "16161616-1616-4616-8616-161616161616";
const shotId = "66666666-6666-4666-8666-666666666666";
const readinessId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const documentId = "77777777-7777-4777-8777-777777777777";
const outputAssetId = "19191919-1919-4919-8919-191919191919";
const approvalId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const asset: AssetRecordV01 = {
  objectType: "AssetRecord",
  contractVersion: "0.1",
  ...scope,
  assetId,
  category: "virtual_character",
  displayName: "门店讲解员",
  provenance: { kind: "provider_generated", sourceAssetId: null, declaredByActorId: authority.actorId, declaredAt: occurredAt },
  rights: { status: "authorized", basis: "provider_generated", validFrom: occurredAt, validUntil: null, reviewedAt: occurredAt },
  approval: { status: "approved", reviewedByActorId: authority.actorId, reviewedAt: occurredAt },
  controlledPreviewUrl: `/api/canvas-v1/assets/${assetId}/preview`,
  createdAt: occurredAt,
  updatedAt: occurredAt,
  occurredAt,
};

const requirement: ShotAssetRequirementV01 = {
  objectType: "ShotAssetRequirement",
  contractVersion: "0.1",
  ...scope,
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

function ready(overrides: Partial<ShotReadinessV01> = {}): ShotReadinessV01 {
  return {
    objectType: "ShotReadiness",
    contractVersion: "0.1",
    ...scope,
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

function ids() {
  const values = [
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    "abababab-abab-4bab-8bab-abababababab",
    "acacacac-acac-4cac-8cac-acacacacacac",
    "adadadad-adad-4dad-8dad-adadadadadad",
  ];
  return () => values.shift() ?? "aeaeaeae-aeae-4eae-8eae-aeaeaeaeaeae";
}

function options(overrides: Partial<CanvasAgentRuntimeOptions> = {}): CanvasAgentRuntimeOptions {
  return {
    authority,
    ports: {
      listProjectAssets: async () => [asset],
      listShotRequirements: async () => [requirement],
      getShotReadiness: async () => ready(),
      getGenerationEvent: async () => null,
      executeCanvasCommand: async (command) => event(command),
    },
    now: () => new Date(occurredAt),
    randomId: ids(),
    ...overrides,
  };
}

function assertPolicyCode(code: string) {
  return (error: unknown) => error instanceof CanvasAgentPolicyError && error.code === code;
}

test("independent G4 surface keeps exactly twelve tools and binds every read to host authority", async () => {
  assert.deepEqual(CANVAS_AGENT_TOOL_NAMES, [
    "list_project_assets", "inspect_asset_readiness", "analyze_script_entities", "propose_missing_assets",
    "create_virtual_character", "sync_provider_asset", "bind_asset_to_entity", "generate_shot",
    "get_generation_task", "select_shot_output", "save_canvas_document", "export_playlist",
  ]);
  const seen: unknown[] = [];
  const runtime = new CanvasAgentRuntime(options({
    ports: {
      ...options().ports,
      listProjectAssets: async (scope) => { seen.push(scope); return [asset]; },
      listShotRequirements: async (_shot, scope) => { seen.push(scope); return [requirement]; },
      getShotReadiness: async (_shot, scope) => { seen.push(scope); return ready(); },
      getGenerationEvent: async (_command, scope) => { seen.push(scope); return null; },
    },
  }));
  await runtime.invokeTool("list_project_assets", {});
  await runtime.invokeTool("inspect_asset_readiness", { shotId });
  await runtime.invokeTool("analyze_script_entities", { shotId });
  await runtime.invokeTool("propose_missing_assets", { shotId });
  await runtime.invokeTool("get_generation_task", { commandId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" });
  assert.ok(seen.length >= 5);
  for (const scope of seen) assert.deepEqual(scope, authority);
});

test("missing assets and false readiness plan only; readiness identity drift also keeps zero dispatch", async () => {
  const cases = [
    {
      readiness: ready({
      ready: false,
      reasonCodes: ["REQUIRED_ASSET_MISSING", "ENTITY_BINDING_MISSING"],
      requirements: [{ ...ready().requirements[0], assetId: null, entityBindingStatus: null, ready: false, reasonCodes: ["REQUIRED_ASSET_MISSING", "ENTITY_BINDING_MISSING"] }],
      }),
      exactBlockedResult: true,
    },
    {
      readiness: { ...ready(), readinessId: "bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc" },
      exactBlockedResult: false,
    },
  ];
  for (const { readiness, exactBlockedResult } of cases) {
    let dispatches = 0;
    const runtime = new CanvasAgentRuntime(options({
      ports: {
        ...options().ports,
        listProjectAssets: async () => [],
        getShotReadiness: async () => readiness,
        executeCanvasCommand: async (command) => { dispatches += 1; return event(command); },
      },
    }));
    const proposal = await runtime.invokeTool("propose_missing_assets", { shotId });
    if (exactBlockedResult) assert.equal(proposal.status, "blocked");
    const generation = await runtime
      .invokeTool("generate_shot", { shotId, readinessId, prompt: "单镜头", referenceAssetIds: [assetId] })
      .catch((error: unknown) => error);
    if (exactBlockedResult) assert.equal(generation.status, "blocked");
    else assert.ok(generation instanceof CanvasAgentPolicyError || generation.status === "blocked");
    assert.equal(dispatches, 0);
  }
});

test("all five high-cost tools require host confirmation and Agent input cannot carry approval", async () => {
  const highCostCases = [
    ["create_virtual_character", { assetId, entityId, prompt: "门店讲解员" }],
    ["bind_asset_to_entity", { assetId, entityId }],
    ["generate_shot", { shotId, readinessId, prompt: "单镜头", referenceAssetIds: [assetId] }],
    ["select_shot_output", { documentId, expectedVersion: 4, outputAssetId, shotId }],
    ["export_playlist", { documentId, expectedVersion: 4 }],
  ] as const;
  let dispatches = 0;
  for (const [name, input] of highCostCases) {
    const runtime = new CanvasAgentRuntime(options({
      ports: { ...options().ports, executeCanvasCommand: async (command) => { dispatches += 1; return event(command); } },
    }));
    await assert.rejects(() => runtime.invokeTool(name, { ...input, approvalId }), assertPolicyCode("CANVAS_AGENT_TOOL_INPUT_INVALID"));
    const pending = await runtime.invokeTool(name, input);
    assert.equal(pending.status, "confirmation_required", name);
    assert.equal(pending.pendingAction?.commandType, ({
      create_virtual_character: "CREATE_VIRTUAL_CHARACTER",
      bind_asset_to_entity: "BIND_ASSET_TO_ENTITY",
      generate_shot: "GENERATE_SHOT",
      select_shot_output: "SELECT_SHOT_OUTPUT",
      export_playlist: "EXPORT_PLAYLIST",
    } as const)[name]);
    assert.equal(Object.hasOwn(pending.pendingAction ?? {}, "approvalId"), false, `${name} minted approval state`);
  }
  assert.equal(dispatches, 0);
});

test("SYNC remains low-cost but still dispatches one strict Agent CanvasCommand through the common port", async () => {
  const commands: CanvasCommandV01[] = [];
  const runtime = new CanvasAgentRuntime(options({
    ports: { ...options().ports, executeCanvasCommand: async (command) => { commands.push(structuredClone(command)); return event(command); } },
  }));
  const result = await runtime.invokeTool("sync_provider_asset", { assetId });
  assert.equal(result.status, "dispatched");
  assert.equal(commands.length, 1);
  assert.equal(commands[0].commandType, "SYNC_PROVIDER_ASSET");
  assert.equal(commands[0].requestSource, "agent");
  assert.equal(commands[0].approvalId, null);
  assert.deepEqual(
    (({ tenantId, projectId, packageId, canvasSessionId, requestedByActorId }) => ({ tenantId, projectId, packageId, canvasSessionId, requestedByActorId }))(commands[0]),
    { ...scope, requestedByActorId: authority.actorId },
  );
  assert.deepEqual(parseCanvasV1BrowserContract(commands[0]), commands[0]);
});

test("scope/provider/extra and batch arguments fail before every read or write", async () => {
  let calls = 0;
  const runtime = new CanvasAgentRuntime(options({
    ports: {
      listProjectAssets: async () => { calls += 1; return [asset]; },
      listShotRequirements: async () => { calls += 1; return [requirement]; },
      getShotReadiness: async () => { calls += 1; return ready(); },
      getGenerationEvent: async () => { calls += 1; return null; },
      executeCanvasCommand: async (command) => { calls += 1; return event(command); },
    },
  }));
  for (const [name, input] of [
    ["list_project_assets", { projectId: authority.projectId }],
    ["inspect_asset_readiness", { shotId, unexpected: true }],
    ["sync_provider_asset", { assetId, providerAssetId: "server-internal" }],
    ["generate_shot", { shotIds: [shotId], readinessId, prompt: "batch", referenceAssetIds: [assetId] }],
    ["generate_shot", { shotId, readinessId, prompt: "batch", referenceAssetIds: [assetId], batch: true }],
  ] as const) {
    await assert.rejects(() => runtime.invokeTool(name, input), assertPolicyCode("CANVAS_AGENT_TOOL_INPUT_INVALID"));
  }
  assert.equal(calls, 0);
});

test("response-loss retry preserves the complete command byte-for-data", async () => {
  const attempts: CanvasCommandV01[] = [];
  let responseLost = true;
  const runtime = new CanvasAgentRuntime(options({
    ports: {
      ...options().ports,
      executeCanvasCommand: async (command) => {
        attempts.push(structuredClone(command));
        if (responseLost) {
          responseLost = false;
          throw new Error("providerRawBody=must-not-escape");
        }
        return event(command, true);
      },
    },
  }));
  const pending = await runtime.invokeTool("generate_shot", { shotId, readinessId, prompt: "单镜头", referenceAssetIds: [assetId] });
  const first = await runtime.resumeApproved({ commandId: pending.pendingAction!.commandId, approvalId });
  const retry = await runtime.resumeApproved({ commandId: pending.pendingAction!.commandId, approvalId });
  assert.equal(first.status, "failed");
  assert.equal(retry.status, "dispatched");
  assert.deepEqual(attempts[1], attempts[0]);
  assert.equal(JSON.stringify(first).includes("providerRawBody"), false);
});

test("safe projections, errors and public render text contain no forbidden authority markers", async () => {
  const unsafe = { ...asset, providerAssetId: "provider-private-id", controlledPreviewUrl: "asset://private" };
  const runtime = new CanvasAgentRuntime(options({ ports: { ...options().ports, listProjectAssets: async () => [unsafe] } }));
  let captured: unknown;
  try {
    await runtime.invokeTool("list_project_assets", {});
  } catch (error) {
    captured = error;
  }
  assert.ok(captured instanceof CanvasAgentPolicyError);
  const publicText = `<pre>${JSON.stringify(captured)}</pre>`.toLowerCase();
  for (const marker of ["provider-private-id", "asset://", "providerassetid", "access_token=", "bearer ", "password", "secret"]) {
    assert.equal(publicText.includes(marker), false, `unsafe Agent output/DOM marker: ${marker}`);
  }
});
