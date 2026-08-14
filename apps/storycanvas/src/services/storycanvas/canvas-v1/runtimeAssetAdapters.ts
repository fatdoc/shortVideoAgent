import crypto from 'node:crypto';
import type { Knex } from 'knex';

import { parseCanvasV1Contract, type AssetRecordV01, type ProviderAssetBindingV01 } from '@/contracts/canvas-v1';
import {
  bindActiveVirtualCharacter,
  createExistingCharacterBindingPersistence,
  syncBytePlusProviderAsset,
  type CanvasProductionScope,
} from '../assets-v1';
import type { BytePlusAssetItem } from '../byteplusAssets';
import { CanvasCommandServiceError } from './errors';

export const CANVAS_V1_CONTROL_ASSET_MAPPING = {
  system: 'saas-control-plane',
  entityType: 'canvas-v1-asset',
} as const;

type Mapping = { localId: string; externalId: string; metadataJson: string };

function stableId(namespace: string, ...values: string[]): string {
  const bytes = crypto.createHash('sha256').update([namespace, ...values].join(':')).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function metadata(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

async function uniqueMapping(database: Knex, where: Record<string, string>): Promise<Mapping> {
  const rows = await database<Mapping>('sc_external_mappings').select('localId', 'externalId', 'metadataJson').where(where).limit(2);
  if (rows.length !== 1) throw new CanvasCommandServiceError('CANVAS_PROVIDER_NOT_ACTIVE');
  return rows[0];
}

async function resolveLocalCharacter(database: Knex, assetId: string, scope: CanvasProductionScope) {
  const control = await uniqueMapping(database, { ...CANVAS_V1_CONTROL_ASSET_MAPPING, externalId: assetId });
  const local = await database('sc_media_assets').where({ id: control.localId, projectId: scope.localProjectId, type: 'character' }).first();
  if (!local) throw new CanvasCommandServiceError('CANVAS_PROVIDER_NOT_ACTIVE');
  const provider = await uniqueMapping(database, { system: 'byteplus-modelark', entityType: 'character-asset', localId: control.localId });
  const facts = metadata(provider.metadataJson);
  if (
    typeof facts.groupId !== 'string' || !facts.groupId ||
    facts.assetUri !== `asset://${provider.externalId}`
  ) throw new CanvasCommandServiceError('CANVAS_PROVIDER_NOT_ACTIVE');
  return { localAssetId: control.localId, providerAssetId: provider.externalId, providerGroupId: facts.groupId };
}

function exactAssetRecord(raw: string, assetId: string, scope: CanvasProductionScope): AssetRecordV01 {
  const parsed = parseCanvasV1Contract(JSON.parse(raw));
  if (
    parsed.objectType !== 'AssetRecord' || parsed.assetId !== assetId ||
    parsed.tenantId !== scope.tenantId || parsed.projectId !== scope.projectId ||
    parsed.packageId !== scope.packageId || parsed.canvasSessionId !== scope.canvasSessionId
  ) throw new CanvasCommandServiceError('CANVAS_SCOPE_MISMATCH');
  return parsed;
}

function exactProviderBinding(raw: string, assetId: string, scope: CanvasProductionScope): ProviderAssetBindingV01 {
  const parsed = parseCanvasV1Contract(JSON.parse(raw));
  if (
    parsed.objectType !== 'ProviderAssetBinding' || parsed.assetId !== assetId ||
    parsed.tenantId !== scope.tenantId || parsed.projectId !== scope.projectId ||
    parsed.packageId !== scope.packageId || parsed.canvasSessionId !== scope.canvasSessionId
  ) throw new CanvasCommandServiceError('CANVAS_SCOPE_MISMATCH');
  return parsed;
}

export function createCanvasV1AssetRuntimeAdapters(options: {
  database: Knex;
  queryProviderAsset?: (providerAssetId: string) => Promise<BytePlusAssetItem>;
  now?: () => Date;
}) {
  const now = options.now ?? (() => new Date());
  const persistLocal = createExistingCharacterBindingPersistence(options.database);
  return {
    syncProviderAsset: async (assetId: string, scope: CanvasProductionScope) => {
      const local = await resolveLocalCharacter(options.database, assetId, scope);
      return syncBytePlusProviderAsset({
        scope,
        assetId,
        providerAssetId: local.providerAssetId,
        providerGroupId: local.providerGroupId,
        bindingId: stableId('canvas-v1-provider-binding', scope.tenantId, scope.projectId, scope.packageId, assetId),
        occurredAt: now().toISOString(),
        queryAsset: options.queryProviderAsset
          ? async (providerAssetId) => {
            const value = await options.queryProviderAsset!(providerAssetId);
            const returnedId = value.Id || value.AssetId || providerAssetId;
            if (returnedId !== providerAssetId) {
              throw new CanvasCommandServiceError('CANVAS_PROVIDER_NOT_ACTIVE');
            }
            return value;
          }
          : undefined,
      });
    },
    bindAssetToEntity: async (assetId: string, entityId: string, scope: CanvasProductionScope) => {
      const local = await resolveLocalCharacter(options.database, assetId, scope);
      const assetRows = await options.database('sc_canvas_v1_asset_records')
        .select('projectionJson').where({ assetId, tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId }).limit(2);
      const providerRows = await options.database('sc_canvas_v1_provider_bindings')
        .select('authorityJson').where({ assetId, tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId }).limit(2);
      if (assetRows.length !== 1 || providerRows.length !== 1) {
        throw new CanvasCommandServiceError('CANVAS_ENTITY_BINDING_NOT_APPROVED');
      }
      const providerBinding = exactProviderBinding(providerRows[0].authorityJson, assetId, scope);
      if (
        providerBinding.providerAssetId !== local.providerAssetId ||
        providerBinding.providerGroupId !== local.providerGroupId ||
        providerBinding.assetUri !== `asset://${local.providerAssetId}`
      ) throw new CanvasCommandServiceError('CANVAS_PROVIDER_NOT_ACTIVE');
      return bindActiveVirtualCharacter({
        scope,
        asset: exactAssetRecord(assetRows[0].projectionJson, assetId, scope),
        providerBinding,
        entityId,
        bindingId: stableId('canvas-v1-entity-binding', scope.tenantId, scope.projectId, scope.packageId, entityId),
        occurredAt: now().toISOString(),
        persistBinding: (input) => persistLocal({ ...input, assetId: local.localAssetId }),
      });
    },
  };
}

export function createCanvasV1OutputAssetAssertion(database: Knex) {
  return async (assetId: string, scope: CanvasProductionScope): Promise<boolean> => {
    const assets = await database('sc_media_assets').where({ id: assetId, projectId: scope.localProjectId, source: 'generated' }).limit(2);
    if (assets.length !== 1) return false;
    const taskId = metadata(String(assets[0].metadataJson)).taskId;
    if (typeof taskId !== 'string') return false;
    const tasks = await database('sc_tasks').where({ id: taskId, projectId: scope.localProjectId, taskType: 'canvas_v1_video_generation', status: 'succeeded' }).limit(2);
    return tasks.length === 1;
  };
}
