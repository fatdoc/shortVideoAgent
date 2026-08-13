import crypto from "node:crypto";
import {
  type AssetRecordV01,
  type CanvasCommandV01,
  type CanvasEventV01,
  type ShotAssetRequirementV01,
  type ShotReadinessV01,
} from "@/contracts/canvas-v1";
import {
  approveCanvasAgentCommand,
  buildCanvasAgentCommand,
  buildCanvasAgentCommandDraft,
  pendingAction,
  type CanvasAgentCommandDraft,
} from "./commandFactory";
import {
  assertCanvasAgentAuthority,
  assertCanvasAgentOutputSafe,
  CanvasAgentPolicyError,
  parseCanvasAgentToolInput,
  parseCanvasAgentHostConfirmation,
  parseScopedBrowserContract,
  safeError,
} from "./policy";
import {
  CANVAS_AGENT_COMMAND_TYPES,
  CANVAS_AGENT_HIGH_COST_TOOLS,
  isCanvasAgentToolName,
} from "./tools";
import type {
  CanvasAgentMissingAssetPlanItem,
  CanvasAgentRuntimeOptions,
  CanvasAgentToolName,
  CanvasAgentToolResult,
} from "./types";

const TERMINAL_EVENT_STATUS = new Set<CanvasEventV01["status"]>([
  "output_registered",
  "receipt_recorded",
  "failed",
]);

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function asAsset(raw: unknown, options: CanvasAgentRuntimeOptions): AssetRecordV01 {
  const parsed = parseScopedBrowserContract(raw, options.authority);
  if (parsed.objectType !== "AssetRecord") throw new CanvasAgentPolicyError("CANVAS_AGENT_OUTPUT_UNSAFE");
  return parsed;
}

function asRequirement(raw: unknown, options: CanvasAgentRuntimeOptions): ShotAssetRequirementV01 {
  const parsed = parseScopedBrowserContract(raw, options.authority);
  if (parsed.objectType !== "ShotAssetRequirement") throw new CanvasAgentPolicyError("CANVAS_AGENT_OUTPUT_UNSAFE");
  return parsed;
}

function asReadiness(raw: unknown, options: CanvasAgentRuntimeOptions): ShotReadinessV01 {
  const parsed = parseScopedBrowserContract(raw, options.authority);
  if (parsed.objectType !== "ShotReadiness") throw new CanvasAgentPolicyError("CANVAS_AGENT_OUTPUT_UNSAFE");
  return parsed;
}

function asEvent(raw: unknown, options: CanvasAgentRuntimeOptions): CanvasEventV01 {
  const parsed = parseScopedBrowserContract(raw, options.authority);
  if (parsed.objectType !== "CanvasEvent") throw new CanvasAgentPolicyError("CANVAS_AGENT_OUTPUT_UNSAFE");
  return parsed;
}

function commandPayload(name: CanvasAgentToolName, input: Record<string, unknown>): CanvasCommandV01["payload"] {
  if (!(name in CANVAS_AGENT_COMMAND_TYPES)) {
    throw new CanvasAgentPolicyError("CANVAS_AGENT_CAPABILITY_BLOCKED");
  }
  return structuredClone(input) as CanvasCommandV01["payload"];
}

export class CanvasAgentRuntime {
  private readonly options: CanvasAgentRuntimeOptions;
  private readonly now: () => Date;
  private readonly randomId: () => string;
  private readonly pending = new Map<string, CanvasAgentCommandDraft>();
  private readonly approved = new Map<string, CanvasCommandV01>();

  constructor(options: CanvasAgentRuntimeOptions) {
    assertCanvasAgentAuthority(options.authority);
    this.options = options;
    this.now = options.now ?? (() => new Date());
    this.randomId = options.randomId ?? crypto.randomUUID;
  }

  async invokeTool(name: string, rawInput: unknown): Promise<CanvasAgentToolResult> {
    if (!isCanvasAgentToolName(name)) {
      throw new CanvasAgentPolicyError("CANVAS_AGENT_TOOL_INPUT_INVALID");
    }
    const input = parseCanvasAgentToolInput(name, rawInput);
    let result: CanvasAgentToolResult;
    switch (name) {
      case "list_project_assets":
        result = await this.listAssets();
        break;
      case "inspect_asset_readiness":
        result = await this.inspectReadiness(String(input.shotId));
        break;
      case "analyze_script_entities":
        result = await this.analyzeRequirements(String(input.shotId));
        break;
      case "propose_missing_assets":
        result = await this.proposeMissingAssets(String(input.shotId));
        break;
      case "get_generation_task":
        result = await this.getGenerationTask(String(input.commandId));
        break;
      default:
        result = await this.command(name, input);
        break;
    }
    assertCanvasAgentOutputSafe(result);
    return result;
  }

  async resumeApproved(input: unknown): Promise<CanvasAgentToolResult> {
    const { commandId, approvalId } = parseCanvasAgentHostConfirmation(input);
    const pending = this.pending.get(commandId);
    let command = this.approved.get(commandId);
    if (!command) {
      if (!pending) throw new CanvasAgentPolicyError("CANVAS_AGENT_CONFIRMATION_INVALID");
      command = approveCanvasAgentCommand(pending, approvalId);
      this.approved.set(commandId, command);
      this.pending.delete(commandId);
    } else if (command.approvalId !== approvalId) {
      throw new CanvasAgentPolicyError("CANVAS_AGENT_CONFIRMATION_INVALID");
    }
    const result = await this.dispatch(command);
    assertCanvasAgentOutputSafe(result);
    return result;
  }

  private async listAssets(): Promise<CanvasAgentToolResult> {
    const raw = await this.options.ports.listProjectAssets(this.options.authority);
    const assets = raw.map((value) => asAsset(value, this.options));
    return { status: "ok", tool: "list_project_assets", assets };
  }

  private async requirements(shotId: string): Promise<ShotAssetRequirementV01[]> {
    const raw = await this.options.ports.listShotRequirements(shotId, this.options.authority);
    const requirements = raw.map((value) => asRequirement(value, this.options));
    if (requirements.some((value) => value.shotId !== shotId)) {
      throw new CanvasAgentPolicyError("CANVAS_AGENT_SCOPE_MISMATCH");
    }
    return requirements;
  }

  private async shotReadiness(shotId: string): Promise<ShotReadinessV01> {
    const raw = await this.options.ports.getShotReadiness(shotId, this.options.authority);
    if (!raw) throw new CanvasAgentPolicyError("CANVAS_AGENT_CAPABILITY_BLOCKED");
    const readiness = asReadiness(raw, this.options);
    if (readiness.shotId !== shotId) throw new CanvasAgentPolicyError("CANVAS_AGENT_SCOPE_MISMATCH");
    return readiness;
  }

  private async inspectReadiness(shotId: string): Promise<CanvasAgentToolResult> {
    const readiness = await this.shotReadiness(shotId);
    return {
      status: readiness.ready ? "ok" : "blocked",
      tool: "inspect_asset_readiness",
      readiness,
      reasonCodes: readiness.reasonCodes,
    };
  }

  private async analyzeRequirements(shotId: string): Promise<CanvasAgentToolResult> {
    const requirements = await this.requirements(shotId);
    return {
      status: "ok",
      tool: "analyze_script_entities",
      requirements,
      analysis: {
        shotId,
        categories: unique(requirements.map((value) => value.assetCategory)),
        entityIds: unique(requirements.flatMap((value) => value.entityId ? [value.entityId] : [])),
        requirementCount: requirements.length,
      },
    };
  }

  private async proposeMissingAssets(shotId: string): Promise<CanvasAgentToolResult> {
    const [assetsResult, requirements, readiness] = await Promise.all([
      this.listAssets(),
      this.requirements(shotId),
      this.shotReadiness(shotId),
    ]);
    const assets = assetsResult.assets ?? [];
    const assetIds = new Set(assets.map((value) => value.assetId));
    const readinessByRequirement = new Map(readiness.requirements.map((value) => [value.requirementId, value]));
    const plan: CanvasAgentMissingAssetPlanItem[] = requirements.flatMap((value) => {
      const status = readinessByRequirement.get(value.requirementId);
      if (!status || status.ready) return [];
      const missing = status.assetId === null || !assetIds.has(status.assetId);
      return [{
        requirementId: value.requirementId,
        shotId,
        category: value.assetCategory,
        entityId: value.entityId,
        action: missing ? "provide_or_authorize_asset" : "complete_provider_or_binding",
        reasonCodes: status.reasonCodes,
      }];
    });
    return {
      status: readiness.ready ? "ok" : "blocked",
      tool: "propose_missing_assets",
      plan,
      reasonCodes: readiness.reasonCodes,
    };
  }

  private async getGenerationTask(commandId: string): Promise<CanvasAgentToolResult> {
    const raw = await this.options.ports.getGenerationEvent(commandId, this.options.authority);
    if (!raw) return { status: "blocked", tool: "get_generation_task", reasonCodes: ["CAPABILITY_UNAVAILABLE"] };
    const event = asEvent(raw, this.options);
    if (event.commandId !== commandId) throw new CanvasAgentPolicyError("CANVAS_AGENT_SCOPE_MISMATCH");
    return {
      status: event.status === "failed" ? "failed" : "ok",
      tool: "get_generation_task",
      event,
    };
  }

  private async command(name: CanvasAgentToolName, input: Record<string, unknown>): Promise<CanvasAgentToolResult> {
    const commandType = CANVAS_AGENT_COMMAND_TYPES[name];
    if (!commandType) throw new CanvasAgentPolicyError("CANVAS_AGENT_CAPABILITY_BLOCKED");
    if (name === "generate_shot") {
      const readiness = await this.shotReadiness(String(input.shotId));
      if (!readiness.ready || readiness.readinessId !== input.readinessId) {
        return { status: "blocked", tool: name, reasonCodes: readiness.reasonCodes };
      }
      const expected = readiness.requirements.flatMap((value) => value.assetId ? [value.assetId] : []);
      const supplied = input.referenceAssetIds as string[];
      if (expected.length !== supplied.length || expected.some((value) => !supplied.includes(value))) {
        return { status: "blocked", tool: name, reasonCodes: ["REQUIRED_ASSET_MISSING"] };
      }
    }
    const commandId = this.randomId();
    const requestId = `req-canvas-agent-${this.randomId()}`;
    const occurredAt = this.now().toISOString();
    if (CANVAS_AGENT_HIGH_COST_TOOLS.has(name)) {
      const draft = buildCanvasAgentCommandDraft({
        authority: this.options.authority,
        commandId,
        commandType,
        payload: commandPayload(name, input),
        requestId,
        occurredAt,
      });
      this.pending.set(commandId, draft);
      return { status: "confirmation_required", tool: name, pendingAction: pendingAction(draft) };
    }
    const command = buildCanvasAgentCommand({
      authority: this.options.authority,
      commandId,
      commandType,
      approvalId: null,
      payload: commandPayload(name, input),
      requestId,
      occurredAt,
    });
    return this.dispatch(command);
  }

  private async dispatch(command: CanvasCommandV01): Promise<CanvasAgentToolResult> {
    const tool = this.toolForCommand(command.commandType);
    try {
      const raw = await this.options.ports.executeCanvasCommand(structuredClone(command));
      const event = asEvent(raw, this.options);
      if (event.commandId !== command.commandId || event.commandType !== command.commandType) {
        throw new CanvasAgentPolicyError("CANVAS_AGENT_SCOPE_MISMATCH");
      }
      if (TERMINAL_EVENT_STATUS.has(event.status)) this.approved.delete(command.commandId);
      return { status: event.status === "failed" ? "failed" : "dispatched", tool, event };
    } catch (error) {
      return { status: "failed", tool, error: safeError(error) };
    }
  }

  private toolForCommand(commandType: CanvasCommandV01["commandType"]): CanvasAgentToolName {
    const pair = Object.entries(CANVAS_AGENT_COMMAND_TYPES).find(([, value]) => value === commandType);
    if (!pair) throw new CanvasAgentPolicyError("CANVAS_AGENT_CAPABILITY_BLOCKED");
    return pair[0] as CanvasAgentToolName;
  }
}
