import type { Knex } from "knex";
import { isDeepStrictEqual } from "node:util";

import {
  parseCanvasV1Contract,
  type AssetRecordV01,
  type CanvasBootstrapV01,
  type CanvasCommandV01,
  type CanvasDocumentV01,
  type CanvasEventV01,
  type EntityBindingV01,
  type ProviderAssetBindingV01,
  type ShotAssetRequirementV01,
  type ShotReadinessV01,
} from "@/contracts/canvas-v1";
import {
  CANVAS_WORKSPACE_REASON_CODES,
  deriveCanvasTargetEntityId,
  parseCanvasWorkspaceV01,
  selectPrimaryVirtualCharacter,
  type CanvasWorkspaceAuthorityV01,
  type CanvasWorkspaceV01,
} from "@/contracts/canvas-v1/workspaceMaterialization";
import type { CanvasProductionScope } from "../assets-v1";
import { CanvasDocumentStore } from "./documentStore";
import { CanvasCommandServiceError } from "./errors";
import {
  deriveCanvasDocumentId,
  type CanvasV1ApprovedWorkspacePackage,
} from "./workspacePrepare";

interface JsonRow { projectionJson: string }
interface BindingRow { authorityJson?: string; projectionJson?: string }
interface CommandRow { commandJson: string }
interface EventRow { eventId: string; eventJson: string }

export interface CanvasV1WorkspaceReadInput {
  scope: CanvasProductionScope;
  approvedPackage: CanvasV1ApprovedWorkspacePackage;
  authority: CanvasWorkspaceAuthorityV01;
  requestId: string;
}

export interface CanvasV1WorkspaceReaderOptions {
  database: Knex;
  now?: () => Date;
}

function scopeOf(scope: CanvasProductionScope) {
  return { tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId };
}

function parseType<T>(value: string, objectType: string): T {
  try {
    const parsed = parseCanvasV1Contract(JSON.parse(value));
    if (parsed.objectType !== objectType) throw new Error("type mismatch");
    return parsed as T;
  } catch {
    throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
  }
}

export class CanvasV1WorkspaceReader {
  private readonly now: () => Date;

  constructor(private readonly options: CanvasV1WorkspaceReaderOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async read(input: CanvasV1WorkspaceReadInput): Promise<CanvasWorkspaceV01> {
    const { scope, authority, approvedPackage } = input;
    if (authority.tenantId !== scope.tenantId || authority.projectId !== scope.projectId
      || authority.packageId !== scope.packageId || authority.canvasSessionId !== scope.canvasSessionId
      || authority.approvedScript.scriptId !== approvedPackage.scriptVersionId
      || authority.approvedStoryboard.storyboardId !== approvedPackage.storyboardVersionId) {
      throw new CanvasCommandServiceError("CANVAS_SCOPE_MISMATCH");
    }
    const primary = selectPrimaryVirtualCharacter(authority);
    const targetEntityId = deriveCanvasTargetEntityId(authority, primary.assetId);
    const stableScope = scopeOf(scope);
    const document = await new CanvasDocumentStore({ database: this.options.database }).read({
      scope,
      documentId: deriveCanvasDocumentId(scope),
    });
    if (!document) throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");

    const assetRows = await this.options.database<JsonRow>("sc_canvas_v1_asset_records")
      .where(stableScope).orderBy("updatedAt", "desc");
    const assetsById = new Map(assetRows.map((row) => {
      const asset = parseType<AssetRecordV01>(row.projectionJson, "AssetRecord");
      return [asset.assetId, asset] as const;
    }));
    if (assetRows.length !== authority.assets.length
      || authority.assets.some((asset) => !isDeepStrictEqual(assetsById.get(asset.assetId), asset))) {
      throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
    }

    const requirementRows = await this.options.database<JsonRow>("sc_canvas_v1_requirements")
      .where(stableScope).orderBy("updatedAt", "asc");
    const requirements = requirementRows.map((row) => parseType<ShotAssetRequirementV01>(row.projectionJson, "ShotAssetRequirement"));
    const readinessRows = await this.options.database<JsonRow>("sc_canvas_v1_readiness")
      .where(stableScope).orderBy("evaluatedAt", "asc");
    const readinessValues = readinessRows.map((row) => parseType<ShotReadinessV01>(row.projectionJson, "ShotReadiness"));
    if (requirements.length !== approvedPackage.storyboard.length || readinessValues.length !== approvedPackage.storyboard.length) {
      throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
    }

    const providerRows = await this.options.database<BindingRow>("sc_canvas_v1_provider_bindings").where(stableScope);
    const providers = providerRows.map((row) => parseType<ProviderAssetBindingV01>(String(row.authorityJson), "ProviderAssetBinding"));
    const entityRows = await this.options.database<BindingRow>("sc_canvas_v1_entity_bindings").where(stableScope);
    const entities = entityRows.map((row) => parseType<EntityBindingV01>(String(row.projectionJson), "EntityBinding"));
    const materializations = await this.materializationStates(scope, authority.assets);
    const assetViews = authority.assets.map((asset) => {
      const provider = providers.find((candidate) => candidate.assetId === asset.assetId
        && candidate.canvasSessionId === scope.canvasSessionId);
      const entity = entities.find((candidate) => candidate.assetId === asset.assetId
        && candidate.canvasSessionId === scope.canvasSessionId);
      return {
        assetId: asset.assetId,
        category: asset.category,
        displayName: asset.displayName,
        rightsStatus: asset.rights.status,
        approvalStatus: asset.approval.status,
        providerStatus: provider?.providerStatus ?? "unavailable" as const,
        entityBindingStatus: entity?.status ?? "pending" as const,
        controlledPreviewUrl: asset.controlledPreviewUrl,
        targetEntityId: asset.assetId === primary.assetId ? targetEntityId : null,
        materialization: materializations.get(asset.assetId)!,
      };
    });
    const videoAvailable = readinessValues.every(({ ready }) => ready);
    const firstReason = readinessValues.flatMap(({ reasonCodes }) => reasonCodes)[0] ?? "CAPABILITY_UNAVAILABLE";
    const bootstrap = parseCanvasV1Contract({
      objectType: "CanvasBootstrap",
      contractVersion: "0.1",
      ...stableScope,
      canvasSessionId: scope.canvasSessionId,
      status: videoAvailable ? "ready" : "blocked",
      approvedScript: { scriptId: authority.approvedScript.scriptId, version: authority.approvedScript.version, status: "approved" },
      approvedStoryboard: { storyboardId: authority.approvedStoryboard.storyboardId, version: authority.approvedStoryboard.version, status: "approved" },
      document: { documentId: document.documentId, version: document.version },
      assetSummaries: assetViews.map(({ targetEntityId: _target, materialization: _state, ...summary }) => summary),
      capabilities: [
        { capability: "video_generation", available: videoAvailable, reasonCode: videoAvailable ? null : firstReason },
        { capability: "playlist_export", available: true, reasonCode: null },
      ],
      requestId: input.requestId,
      occurredAt: this.now().toISOString(),
    }) as CanvasBootstrapV01;

    const commandRows = await this.options.database<CommandRow>("sc_canvas_v1_commands")
      .where({ ...stableScope, canvasSessionId: scope.canvasSessionId });
    const commands = commandRows.map((row) => parseType<CanvasCommandV01>(row.commandJson, "CanvasCommand"))
      .filter(({ commandType }) => commandType === "GENERATE_SHOT");
    const eventRows = await this.options.database<EventRow>("sc_canvas_v1_events")
      .where({ ...stableScope, canvasSessionId: scope.canvasSessionId });
    const events = eventRows.map((row) => parseType<CanvasEventV01>(row.eventJson, "CanvasEvent"))
      .filter(({ commandType }) => commandType === "GENERATE_SHOT");

    const shots = [] as CanvasWorkspaceV01["shots"];
    for (const [index, packageShot] of approvedPackage.storyboard.entries()) {
      const shotRequirements = requirements.filter(({ shotId }) => shotId === packageShot.shotId);
      const readiness = readinessValues.find(({ shotId }) => shotId === packageShot.shotId);
      const documentShot = document.shots[index];
      if (shotRequirements.length !== 1 || !readiness || !documentShot || documentShot.shotId !== packageShot.shotId) {
        throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
      }
      const shotCommands = commands.filter((command) =>
        (command.payload as { shotId?: unknown }).shotId === packageShot.shotId);
      const commandIds = new Set(shotCommands.map(({ commandId }) => commandId));
      const shotEvents = events.filter(({ commandId }) => commandIds.has(commandId))
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.eventId.localeCompare(left.eventId));
      const outputs = await this.outputsFor(scope, document, shotEvents);
      const selected = outputs.find(({ selected }) => selected);
      shots.push({
        shotId: packageShot.shotId,
        sequence: packageShot.sequence,
        title: `镜头 ${String(packageShot.sequence).padStart(2, "0")}`,
        durationSeconds: packageShot.durationSeconds,
        scriptText: approvedPackage.approvedScript.content,
        storyboardText: packageShot.description,
        thumbnailUrl: selected?.previewUrl ?? null,
        requirements: shotRequirements,
        readiness,
        requiredAssetLabels: ["虚拟人物"],
        outputs,
        event: shotEvents[0] ?? null,
      });
    }

    const completeness = {
      assets: true,
      requirements: true,
      readiness: true,
      outputs: true,
      events: true,
      controlledMedia: true,
    };
    const reasonCodes: typeof CANVAS_WORKSPACE_REASON_CODES[number][] = [];
    if (bootstrap.status === "blocked") reasonCodes.push("WORKSPACE_CAPABILITY_BLOCKED");
    if (shots.some(({ readiness }) => !readiness.ready)) reasonCodes.push("WORKSPACE_SHOT_BLOCKED");
    return parseCanvasWorkspaceV01({
      objectType: "CanvasWorkspace",
      contractVersion: "0.1",
      ...stableScope,
      canvasSessionId: scope.canvasSessionId,
      status: reasonCodes.length ? "blocked" : "ready",
      reasonCodes,
      completeness,
      project: { projectName: authority.project.projectName, requestedByActorId: scope.actorId },
      bootstrap,
      document,
      shots,
      assets: assetViews,
      saveState: "saved",
      requestId: input.requestId,
      occurredAt: this.now().toISOString(),
    });
  }

  private async materializationStates(scope: CanvasProductionScope, assets: AssetRecordV01[]) {
    const states = new Map<string, CanvasWorkspaceV01["assets"][number]["materialization"]>();
    for (const asset of assets) {
      if (asset.category !== "virtual_character") {
        states.set(asset.assetId, { status: "unsupported", reasonCode: "CATEGORY_UNSUPPORTED" });
        continue;
      }
      if (asset.rights.status !== "authorized") {
        states.set(asset.assetId, { status: "blocked", reasonCode: "RIGHTS_NOT_AUTHORIZED" });
        continue;
      }
      if (asset.approval.status !== "approved") {
        states.set(asset.assetId, { status: "blocked", reasonCode: "APPROVAL_NOT_APPROVED" });
        continue;
      }
      const mappings = await this.options.database("sc_external_mappings")
        .where({ system: "saas-control-plane", entityType: "canvas-v1-asset", externalId: asset.assetId }).limit(2);
      if (mappings.length > 1) {
        states.set(asset.assetId, { status: "blocked", reasonCode: "MATERIALIZATION_CONFLICT" });
        continue;
      }
      if (mappings.length === 0) {
        states.set(asset.assetId, { status: "not_started", reasonCode: "MATERIALIZATION_REQUIRED" });
        continue;
      }
      const media = await this.options.database("sc_media_assets")
        .where({ id: mappings[0].localId, projectId: scope.localProjectId, type: "character" }).limit(2);
      states.set(asset.assetId, media.length === 1
        ? { status: "ready", reasonCode: null }
        : { status: "blocked", reasonCode: "MATERIALIZATION_CONFLICT" });
    }
    return states;
  }

  private async outputsFor(
    scope: CanvasProductionScope,
    document: CanvasDocumentV01,
    events: CanvasEventV01[],
  ): Promise<CanvasWorkspaceV01["shots"][number]["outputs"]> {
    const outputs: CanvasWorkspaceV01["shots"][number]["outputs"] = [];
    for (const event of events) {
      if (!event.taskId) continue;
      const task = await this.options.database("sc_tasks")
        .where({ id: event.taskId, projectId: scope.localProjectId, status: "succeeded" }).first();
      if (!task) continue;
      let outputAssetId: string | null = null;
      try { outputAssetId = JSON.parse(String(task.outputJson)).outputAssetId ?? null; } catch { outputAssetId = null; }
      if (!outputAssetId) continue;
      const media = await this.options.database("sc_media_assets")
        .where({ id: outputAssetId, projectId: scope.localProjectId }).first();
      if (!media || !["image", "video"].includes(String(media.type))) continue;
      let metadataTaskId: string | null = null;
      try { metadataTaskId = JSON.parse(String(media.metadataJson)).taskId ?? null; } catch { metadataTaskId = null; }
      if (metadataTaskId !== event.taskId) continue;
      outputs.push({
        assetId: outputAssetId,
        kind: media.type as "image" | "video",
        previewUrl: `/api/production/pilot/canvas/v1/media/${outputAssetId}/preview`,
        selected: document.shots.some(({ selectedOutputAssetId }) => selectedOutputAssetId === outputAssetId),
      });
    }
    return [...new Map(outputs.map((output) => [output.assetId, output])).values()];
  }
}
