import crypto from "node:crypto";
import type { Knex } from "knex";

import {
  CANVAS_V1_REASON_CODES,
  parseCanvasV1Contract,
  type AssetRecordV01,
  type CanvasBootstrapV01,
  type EntityBindingV01,
  type ProviderAssetBindingV01,
  type ShotAssetRequirementV01,
  type ShotReadinessV01,
} from "@/contracts/canvas-v1";
import {
  deriveCanvasShotRequirementId,
  deriveCanvasTargetEntityId,
  parseCanvasWorkspaceAuthorityRequestV01,
  selectPrimaryVirtualCharacter,
  type CanvasWorkspaceAuthorityRequestV01,
  type CanvasWorkspaceAuthorityV01,
} from "@/contracts/canvas-v1/workspaceMaterialization";
import type { CanvasProductionScope } from "../assets-v1";
import { CanvasDocumentStore } from "./documentStore";
import { CanvasCommandServiceError } from "./errors";

const URL_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
const WORKSPACE_NAMESPACE = "0f88cfb6-eef3-5961-8e78-c6f5aa24af6c";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export interface CanvasV1ApprovedWorkspacePackage {
  scriptVersionId: string;
  storyboardVersionId: string;
  approvedScript: { content: string };
  storyboard: Array<{
    shotId: string;
    sequence: number;
    description: string;
    durationSeconds: number;
    sourceMode: string;
  }>;
}

export interface CanvasWorkspaceAuthorityPort {
  fetch(request: CanvasWorkspaceAuthorityRequestV01): Promise<CanvasWorkspaceAuthorityV01>;
}

export interface CanvasV1WorkspacePrepareInput {
  scope: CanvasProductionScope;
  approvedPackage: CanvasV1ApprovedWorkspacePackage;
  requestId: string;
}

export interface CanvasV1WorkspacePrepareResult {
  authority: CanvasWorkspaceAuthorityV01;
  bootstrap: CanvasBootstrapV01;
  document: Awaited<ReturnType<CanvasDocumentStore["create"]>>;
}

export interface CanvasV1WorkspacePreparerOptions {
  database: Knex;
  authorityClient: CanvasWorkspaceAuthorityPort;
  now?: () => Date;
  capabilityAvailable?: () => boolean;
}

function uuidV5(namespace: string, name: string): string {
  const bytes = crypto.createHash("sha1")
    .update(Buffer.from(namespace.replaceAll("-", ""), "hex"))
    .update(name, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function deriveCanvasDocumentId(scope: Pick<CanvasProductionScope, "tenantId" | "projectId" | "packageId">): string {
  return uuidV5(URL_NAMESPACE, `videoagent:canvas-document:v1:${scope.tenantId}:${scope.projectId}:${scope.packageId}`);
}

function deriveReadinessId(scope: CanvasProductionScope, shotId: string): string {
  return uuidV5(
    WORKSPACE_NAMESPACE,
    `shot-readiness|tenant=${scope.tenantId}|project=${scope.projectId}|package=${scope.packageId}|shot=${shotId}`,
  );
}

function projectionScope(scope: CanvasProductionScope) {
  return { tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId };
}

function reasonCodes(input: ShotReadinessV01["requirements"][number]) {
  const reasons = new Set<(typeof CANVAS_V1_REASON_CODES)[number]>();
  if (!input.scopeMatched) reasons.add("SCOPE_MISMATCH");
  if (input.assetId === null) reasons.add("REQUIRED_ASSET_MISSING");
  if (input.rightsStatus !== "authorized") reasons.add(`RIGHTS_${input.rightsStatus.toUpperCase()}` as typeof CANVAS_V1_REASON_CODES[number]);
  if (input.approvalStatus !== "approved") reasons.add(`ASSET_APPROVAL_${input.approvalStatus.toUpperCase()}` as typeof CANVAS_V1_REASON_CODES[number]);
  if (input.providerStatus !== "active") reasons.add(`PROVIDER_${input.providerStatus.toUpperCase()}` as typeof CANVAS_V1_REASON_CODES[number]);
  if (input.entityBindingStatus === null) reasons.add("ENTITY_BINDING_MISSING");
  else if (input.entityBindingStatus !== "approved") reasons.add(`ENTITY_BINDING_${input.entityBindingStatus.toUpperCase()}` as typeof CANVAS_V1_REASON_CODES[number]);
  if (!input.capabilityAvailable) reasons.add("CAPABILITY_UNAVAILABLE");
  return CANVAS_V1_REASON_CODES.filter((code) => reasons.has(code));
}

function parseOptionalProjection<T extends ProviderAssetBindingV01 | EntityBindingV01>(raw: unknown): T | null {
  if (typeof raw !== "string") return null;
  try {
    return parseCanvasV1Contract(JSON.parse(raw)) as T;
  } catch {
    return null;
  }
}

export class CanvasV1WorkspacePreparer {
  private readonly now: () => Date;
  private readonly capabilityAvailable: () => boolean;

  constructor(private readonly options: CanvasV1WorkspacePreparerOptions) {
    this.now = options.now ?? (() => new Date());
    this.capabilityAvailable = options.capabilityAvailable ?? (() => false);
  }

  async prepare(input: CanvasV1WorkspacePrepareInput): Promise<CanvasV1WorkspacePrepareResult> {
    const occurredAt = this.now().toISOString();
    const request = parseCanvasWorkspaceAuthorityRequestV01({
      objectType: "CanvasWorkspaceAuthorityRequest",
      contractVersion: "0.1",
      tenantId: input.scope.tenantId,
      projectId: input.scope.projectId,
      packageId: input.scope.packageId,
      canvasSessionId: input.scope.canvasSessionId,
      actorId: input.scope.actorId,
      requestId: input.requestId,
      occurredAt,
    });
    const authority = await this.options.authorityClient.fetch(request);
    if (authority.tenantId !== input.scope.tenantId || authority.projectId !== input.scope.projectId
      || authority.packageId !== input.scope.packageId || authority.canvasSessionId !== input.scope.canvasSessionId
      || authority.approvedScript.scriptId !== input.approvedPackage.scriptVersionId
      || authority.approvedStoryboard.storyboardId !== input.approvedPackage.storyboardVersionId) {
      throw new CanvasCommandServiceError("CANVAS_SCOPE_MISMATCH");
    }
    const primary = selectPrimaryVirtualCharacter(authority);
    if (!input.approvedPackage.storyboard.length || input.approvedPackage.storyboard.some((shot, index) =>
      !UUID.test(shot.shotId) || shot.sequence !== index + 1 || !shot.description)) {
      throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
    }
    const targetEntityId = deriveCanvasTargetEntityId(authority, primary.assetId);
    const result = await this.options.database.transaction(async (transaction) => {
      const scope = projectionScope(input.scope);
      const document = await new CanvasDocumentStore({ database: transaction, now: this.now }).create({
        scope: input.scope,
        documentId: deriveCanvasDocumentId(input.scope),
        shots: input.approvedPackage.storyboard.map((shot, index) => ({
          shotId: shot.shotId,
          position: index,
          selectedOutputAssetId: null,
          prompt: shot.description,
          updatedAt: occurredAt,
        })),
        playlist: { shotIds: input.approvedPackage.storyboard.map(({ shotId }) => shotId) },
      });

      const assetIds = authority.assets.map(({ assetId }) => assetId);
      if (assetIds.length) {
        await transaction("sc_canvas_v1_asset_records").where(scope).whereNotIn("assetId", assetIds).delete();
      } else {
        await transaction("sc_canvas_v1_asset_records").where(scope).delete();
      }
      for (const asset of authority.assets) {
        const existing = await transaction("sc_canvas_v1_asset_records").where({ assetId: asset.assetId }).first();
        if (existing && (existing.tenantId !== scope.tenantId || existing.projectId !== scope.projectId || existing.packageId !== scope.packageId)) {
          throw new CanvasCommandServiceError("CANVAS_SCOPE_MISMATCH");
        }
        const values = { ...scope, projectionJson: JSON.stringify(asset), updatedAt: asset.updatedAt };
        if (existing) await transaction("sc_canvas_v1_asset_records").where({ assetId: asset.assetId }).update(values);
        else await transaction("sc_canvas_v1_asset_records").insert({ assetId: asset.assetId, ...values });
      }

      await transaction("sc_canvas_v1_requirements").where(scope).delete();
      await transaction("sc_canvas_v1_readiness").where(scope).delete();
      const providerRow = await transaction("sc_canvas_v1_provider_bindings")
        .where({ ...scope, assetId: primary.assetId }).first();
      const entityRow = await transaction("sc_canvas_v1_entity_bindings")
        .where({ ...scope, entityId: targetEntityId, assetId: primary.assetId }).first();
      const provider = parseOptionalProjection<ProviderAssetBindingV01>(providerRow?.authorityJson);
      const entity = parseOptionalProjection<EntityBindingV01>(entityRow?.projectionJson);
      const providerStatus = provider?.canvasSessionId === input.scope.canvasSessionId
        ? provider.providerStatus : "unavailable";
      const entityStatus = entity?.canvasSessionId === input.scope.canvasSessionId ? entity.status : null;
      const readinessValues: ShotReadinessV01[] = [];
      for (const shot of input.approvedPackage.storyboard) {
        const requirement: ShotAssetRequirementV01 = parseCanvasV1Contract({
          objectType: "ShotAssetRequirement",
          contractVersion: "0.1",
          ...scope,
          canvasSessionId: input.scope.canvasSessionId,
          requirementId: deriveCanvasShotRequirementId(authority, shot.shotId, primary.assetId),
          shotId: shot.shotId,
          assetCategory: "virtual_character",
          entityId: targetEntityId,
          status: "required",
          source: {
            scriptId: authority.approvedScript.scriptId,
            scriptVersion: authority.approvedScript.version,
            storyboardId: authority.approvedStoryboard.storyboardId,
            storyboardVersion: authority.approvedStoryboard.version,
          },
          requiredCapabilities: ["video_generation"],
          createdAt: occurredAt,
          updatedAt: occurredAt,
          occurredAt,
        }) as ShotAssetRequirementV01;
        const readinessRequirement: ShotReadinessV01["requirements"][number] = {
          requirementId: requirement.requirementId,
          assetId: primary.assetId,
          scopeMatched: true,
          rightsStatus: primary.rights.status,
          approvalStatus: primary.approval.status,
          providerStatus,
          entityBindingStatus: entityStatus,
          capabilityAvailable: this.capabilityAvailable(),
          ready: false,
          reasonCodes: [],
        };
        readinessRequirement.reasonCodes = reasonCodes(readinessRequirement);
        readinessRequirement.ready = readinessRequirement.reasonCodes.length === 0;
        const readiness = parseCanvasV1Contract({
          objectType: "ShotReadiness",
          contractVersion: "0.1",
          ...scope,
          canvasSessionId: input.scope.canvasSessionId,
          readinessId: deriveReadinessId(input.scope, shot.shotId),
          shotId: shot.shotId,
          ready: readinessRequirement.ready,
          reasonCodes: readinessRequirement.reasonCodes,
          script: { scriptId: authority.approvedScript.scriptId, version: authority.approvedScript.version, current: true },
          storyboard: { storyboardId: authority.approvedStoryboard.storyboardId, version: authority.approvedStoryboard.version, current: true },
          requirements: [readinessRequirement],
          evaluatedAt: occurredAt,
          occurredAt,
        }) as ShotReadinessV01;
        await transaction("sc_canvas_v1_requirements").insert({
          requirementId: requirement.requirementId,
          shotId: shot.shotId,
          ...scope,
          projectionJson: JSON.stringify(requirement),
          updatedAt: occurredAt,
        });
        await transaction("sc_canvas_v1_readiness").insert({
          readinessId: readiness.readinessId,
          shotId: shot.shotId,
          ...scope,
          projectionJson: JSON.stringify(readiness),
          evaluatedAt: occurredAt,
        });
        readinessValues.push(readiness);
      }
      return { document, providerStatus, entityStatus, readinessValues };
    });

    const assetSummaries = authority.assets.map((asset: AssetRecordV01) => ({
      assetId: asset.assetId,
      category: asset.category,
      displayName: asset.displayName,
      rightsStatus: asset.rights.status,
      approvalStatus: asset.approval.status,
      providerStatus: asset.assetId === primary.assetId ? result.providerStatus : "unavailable" as const,
      entityBindingStatus: asset.assetId === primary.assetId ? (result.entityStatus ?? "pending") : "pending" as const,
      controlledPreviewUrl: asset.controlledPreviewUrl,
    }));
    const videoAvailable = result.readinessValues.every(({ ready }) => ready);
    const firstReason = result.readinessValues.flatMap(({ reasonCodes: codes }) => codes)[0] ?? "CAPABILITY_UNAVAILABLE";
    const bootstrap = parseCanvasV1Contract({
      objectType: "CanvasBootstrap",
      contractVersion: "0.1",
      tenantId: input.scope.tenantId,
      projectId: input.scope.projectId,
      packageId: input.scope.packageId,
      canvasSessionId: input.scope.canvasSessionId,
      status: videoAvailable ? "ready" : "blocked",
      approvedScript: { scriptId: authority.approvedScript.scriptId, version: authority.approvedScript.version, status: "approved" },
      approvedStoryboard: { storyboardId: authority.approvedStoryboard.storyboardId, version: authority.approvedStoryboard.version, status: "approved" },
      document: { documentId: result.document.documentId, version: result.document.version },
      assetSummaries,
      capabilities: [
        { capability: "video_generation", available: videoAvailable, reasonCode: videoAvailable ? null : firstReason },
        { capability: "playlist_export", available: true, reasonCode: null },
      ],
      requestId: input.requestId,
      occurredAt,
    }) as CanvasBootstrapV01;
    return { authority, bootstrap, document: result.document };
  }
}
