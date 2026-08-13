import {
  parseCanvasV1Contract,
  type AssetRecordV01,
  type EntityBindingV01,
  type ProviderAssetBindingV01,
} from "@/contracts/canvas-v1";
import type { Knex } from "knex";
import { getBytePlusAsset, toAssetUri, type BytePlusAssetItem } from "../byteplusAssets";
import { persistCharacterAssetBinding } from "../characterAssetBinding";
import { normalizeProviderAssetStatus } from "./readiness";
import type { CanvasProductionScope } from "./scope";
import { assertExactCanvasProductionScope } from "./scope";

export type CanvasAssetProductionErrorCode =
  | "CANVAS_RIGHTS_NOT_AUTHORIZED"
  | "CANVAS_ASSET_NOT_APPROVED"
  | "CANVAS_PROVIDER_NOT_ACTIVE"
  | "CANVAS_ENTITY_BINDING_NOT_APPROVED";

export class CanvasAssetProductionError extends Error {
  readonly status = 409;
  readonly retryable = false;

  constructor(readonly code: CanvasAssetProductionErrorCode) {
    const messages: Record<CanvasAssetProductionErrorCode, string> = {
      CANVAS_RIGHTS_NOT_AUTHORIZED: "Asset rights are not authorized.",
      CANVAS_ASSET_NOT_APPROVED: "Asset is not approved.",
      CANVAS_PROVIDER_NOT_ACTIVE: "Provider asset is not active.",
      CANVAS_ENTITY_BINDING_NOT_APPROVED: "Entity binding is not approved.",
    };
    super(messages[code]);
    this.name = "CanvasAssetProductionError";
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message, retryable: this.retryable };
  }
}

export interface PersistVirtualCharacterBindingInput {
  localProjectId: number;
  entityId: string;
  assetId: string;
  assetUri: string;
  providerAssetId: string;
  providerGroupId: string;
  actorId: string;
  bindingId: string;
  occurredAt: string;
}

export interface BindActiveVirtualCharacterInput {
  scope: CanvasProductionScope;
  asset: AssetRecordV01;
  providerBinding: ProviderAssetBindingV01;
  entityId: string;
  bindingId: string;
  occurredAt: string;
  persistBinding(input: PersistVirtualCharacterBindingInput): Promise<number>;
}

export interface SyncBytePlusProviderAssetInput {
  scope: CanvasProductionScope;
  assetId: string;
  providerAssetId: string;
  providerGroupId: string;
  bindingId: string;
  occurredAt: string;
  queryAsset?: (providerAssetId: string) => Promise<BytePlusAssetItem>;
}

export async function syncBytePlusProviderAsset(
  input: SyncBytePlusProviderAssetInput,
): Promise<ProviderAssetBindingV01> {
  let providerItem: BytePlusAssetItem;
  try {
    providerItem = await (input.queryAsset ?? getBytePlusAsset)(input.providerAssetId);
  } catch {
    providerItem = { Status: "unavailable" };
  }
  const status = normalizeProviderAssetStatus(providerItem.Status);
  const providerAssetId = providerItem.Id || providerItem.AssetId || input.providerAssetId;
  const active = status === "active";
  const result: ProviderAssetBindingV01 = {
    objectType: "ProviderAssetBinding",
    contractVersion: "0.1",
    tenantId: input.scope.tenantId,
    projectId: input.scope.projectId,
    packageId: input.scope.packageId,
    canvasSessionId: input.scope.canvasSessionId,
    bindingId: input.bindingId,
    assetId: input.assetId,
    provider: "byteplus",
    providerStatus: status,
    providerAssetId,
    providerGroupId: input.providerGroupId,
    assetUri: active ? toAssetUri(providerAssetId) : null,
    registeredAt: active ? input.occurredAt : null,
    updatedAt: input.occurredAt,
    occurredAt: input.occurredAt,
  };
  return parseCanvasV1Contract(result) as ProviderAssetBindingV01;
}

interface ExistingCharacterAssetRow {
  id: string;
  localPath: string;
  metadataJson: string;
}

function jsonRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export function createExistingCharacterBindingPersistence(database: Knex) {
  return async (input: PersistVirtualCharacterBindingInput): Promise<number> => {
    const asset = await database<ExistingCharacterAssetRow>("sc_media_assets")
      .where({ id: input.assetId, projectId: input.localProjectId, type: "character" })
      .first();
    const entity = await database("sc_entities")
      .where({ id: input.entityId, projectId: input.localProjectId, entityType: "character" })
      .first();
    if (!asset || !entity) throw new CanvasAssetProductionError("CANVAS_ENTITY_BINDING_NOT_APPROVED");
    const before = await database("sc_continuity_profiles").where({ projectId: input.localProjectId }).first();
    if (!before || !Number.isSafeInteger(Number(before.revision))) {
      throw new CanvasAssetProductionError("CANVAS_ENTITY_BINDING_NOT_APPROVED");
    }
    const metadata = jsonRecord(asset.metadataJson);
    await persistCharacterAssetBinding(database, {
      projectId: input.localProjectId,
      entityId: input.entityId,
      canonical: jsonRecord(String(entity.canonicalJson)),
      assetId: input.assetId,
      assetLocalPath: asset.localPath,
      remoteAssetId: input.providerAssetId,
      assetUri: input.assetUri,
      characterProfile: metadata.profile,
      referenceId: input.bindingId,
      timestamp: input.occurredAt,
    });
    const after = await database("sc_continuity_profiles").where({ projectId: input.localProjectId }).first();
    const revision = Number(after?.revision);
    if (!Number.isSafeInteger(revision) || revision !== Number(before.revision) + 1) {
      throw new CanvasAssetProductionError("CANVAS_ENTITY_BINDING_NOT_APPROVED");
    }
    return revision;
  };
}

export async function bindActiveVirtualCharacter(input: BindActiveVirtualCharacterInput): Promise<EntityBindingV01> {
  assertExactCanvasProductionScope(input.scope, input.asset);
  assertExactCanvasProductionScope(input.scope, input.providerBinding);
  if (input.asset.assetId !== input.providerBinding.assetId) {
    throw new CanvasAssetProductionError("CANVAS_PROVIDER_NOT_ACTIVE");
  }
  if (input.asset.category !== "virtual_character") {
    throw new CanvasAssetProductionError("CANVAS_ENTITY_BINDING_NOT_APPROVED");
  }
  if (input.asset.rights.status !== "authorized") {
    throw new CanvasAssetProductionError("CANVAS_RIGHTS_NOT_AUTHORIZED");
  }
  if (input.asset.approval.status !== "approved") {
    throw new CanvasAssetProductionError("CANVAS_ASSET_NOT_APPROVED");
  }
  const binding = input.providerBinding;
  if (binding.providerStatus !== "active" || !binding.assetUri || !binding.providerAssetId || !binding.providerGroupId) {
    throw new CanvasAssetProductionError("CANVAS_PROVIDER_NOT_ACTIVE");
  }
  const continuityRevision = await input.persistBinding({
    localProjectId: input.scope.localProjectId,
    entityId: input.entityId,
    assetId: input.asset.assetId,
    assetUri: binding.assetUri,
    providerAssetId: binding.providerAssetId,
    providerGroupId: binding.providerGroupId,
    actorId: input.scope.actorId,
    bindingId: input.bindingId,
    occurredAt: input.occurredAt,
  });
  if (!Number.isSafeInteger(continuityRevision) || continuityRevision < 1) {
    throw new CanvasAssetProductionError("CANVAS_ENTITY_BINDING_NOT_APPROVED");
  }
  const output: EntityBindingV01 = {
    objectType: "EntityBinding",
    contractVersion: "0.1",
    tenantId: input.scope.tenantId,
    projectId: input.scope.projectId,
    packageId: input.scope.packageId,
    canvasSessionId: input.scope.canvasSessionId,
    bindingId: input.bindingId,
    assetId: input.asset.assetId,
    entityId: input.entityId,
    entityType: "virtual_character",
    status: "approved",
    approvedByActorId: input.scope.actorId,
    approvedAt: input.occurredAt,
    continuityRevision,
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
    occurredAt: input.occurredAt,
  };
  return parseCanvasV1Contract(output) as EntityBindingV01;
}
