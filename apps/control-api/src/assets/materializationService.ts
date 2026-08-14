import { createHash, randomUUID } from 'node:crypto';
import { CanvasAssetDomainError } from './errors.js';
import { materializationError } from './materializationErrors.js';
import {
  detectCanvasMaterializationMime,
  parseCanvasAssetMaterializationRequest,
  parseCanvasAssetMaterializationResponse,
} from './materializationParser.js';
import {
  CANVAS_MATERIALIZATION_MAX_BYTES,
  type CanvasAssetMaterializationAttemptStore,
  type CanvasAssetMaterializationResponse,
  type CanvasAssetMaterializationStorage,
} from './materializationTypes.js';
import type { AssetAuthorityRecord } from './types.js';

type SessionAuthority = {
  assertActiveSession(input: unknown): Promise<void>;
};

type AssetLookup = {
  getAsset(input: {
    tenantId: string;
    projectId: string;
    assetId: string;
  }): Promise<AssetAuthorityRecord | null>;
};

export type CanvasAssetMaterializationServiceDependencies = {
  sessionAuthority: SessionAuthority;
  assets: AssetLookup;
  storage: CanvasAssetMaterializationStorage;
  attempts: CanvasAssetMaterializationAttemptStore;
  now?: () => Date;
  newId?: () => string;
};

function validNow(clock: () => Date): Date {
  const value = clock();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw materializationError('CANVAS_MATERIALIZATION_DEPENDENCY_UNAVAILABLE');
  }
  return new Date(value.getTime());
}

export class CanvasAssetMaterializationService {
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(private readonly dependencies: CanvasAssetMaterializationServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.newId = dependencies.newId ?? randomUUID;
  }

  async materialize(inputValue: unknown): Promise<CanvasAssetMaterializationResponse> {
    const input = parseCanvasAssetMaterializationRequest(inputValue);
    const verifiedAt = validNow(this.now);
    try {
      await this.dependencies.sessionAuthority.assertActiveSession({
        tenantId: input.tenantId,
        projectId: input.projectId,
        packageId: input.packageId,
        canvasSessionId: input.canvasSessionId,
        actorId: input.actorId,
      });
    } catch (error) {
      if (error instanceof CanvasAssetDomainError && error.code === 'CANVAS_SESSION_INVALID') {
        throw materializationError('CANVAS_MATERIALIZATION_SESSION_INVALID');
      }
      throw materializationError('CANVAS_MATERIALIZATION_DEPENDENCY_UNAVAILABLE');
    }

    let asset: AssetAuthorityRecord | null;
    try {
      asset = await this.dependencies.assets.getAsset({
        tenantId: input.tenantId,
        projectId: input.projectId,
        assetId: input.assetId,
      });
    } catch {
      throw materializationError('CANVAS_MATERIALIZATION_DEPENDENCY_UNAVAILABLE');
    }
    if (!asset) throw materializationError('CANVAS_MATERIALIZATION_ASSET_NOT_FOUND');
    if (
      asset.assetId !== input.assetId ||
      asset.tenantId !== input.tenantId ||
      asset.projectId !== input.projectId ||
      asset.packageId !== input.packageId
    ) {
      throw materializationError('CANVAS_MATERIALIZATION_SCOPE_MISMATCH');
    }
    if (asset.category !== 'virtual_character') {
      throw materializationError('CANVAS_MATERIALIZATION_CATEGORY_UNSUPPORTED');
    }
    if (
      asset.rightsStatus !== 'authorized' ||
      !asset.rightsValidFrom ||
      !Number.isFinite(asset.rightsValidFrom.getTime()) ||
      asset.rightsValidFrom.getTime() > verifiedAt.getTime() ||
      (asset.rightsValidUntil !== null &&
        (!Number.isFinite(asset.rightsValidUntil.getTime()) ||
          asset.rightsValidUntil.getTime() <= verifiedAt.getTime()))
    ) {
      throw materializationError('CANVAS_MATERIALIZATION_RIGHTS_NOT_AUTHORIZED');
    }
    if (asset.approvalStatus !== 'approved') {
      throw materializationError('CANVAS_MATERIALIZATION_ASSET_NOT_APPROVED');
    }

    const source = await this.dependencies.storage.read(asset.storageReference);
    if (!Buffer.isBuffer(source.bytes) || source.bytes.length === 0) {
      throw materializationError('CANVAS_MATERIALIZATION_SOURCE_EMPTY');
    }
    if (source.bytes.length > CANVAS_MATERIALIZATION_MAX_BYTES) {
      throw materializationError('CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE');
    }
    const actualMime = detectCanvasMaterializationMime(source.bytes);
    if (!actualMime) throw materializationError('CANVAS_MATERIALIZATION_MIME_UNSUPPORTED');
    const actualChecksum = `sha256:${createHash('sha256').update(source.bytes).digest('hex')}`;
    if (
      source.byteSize !== source.bytes.length ||
      source.mimeType !== actualMime ||
      source.checksum !== actualChecksum ||
      actualChecksum !== asset.checksum
    ) {
      throw materializationError('CANVAS_MATERIALIZATION_CONTENT_INTEGRITY_FAILED');
    }

    let outcome;
    try {
      outcome = await this.dependencies.attempts.createOrReplay({
        materializationAttemptId: input.materializationAttemptId,
        materializationId: this.newId(),
        tenantId: input.tenantId,
        projectId: input.projectId,
        packageId: input.packageId,
        canvasSessionId: input.canvasSessionId,
        actorId: input.actorId,
        assetId: input.assetId,
        authorityChecksum: source.checksum,
        mimeType: source.mimeType,
        byteSize: source.byteSize,
        createdAt: verifiedAt,
      });
    } catch {
      throw materializationError('CANVAS_MATERIALIZATION_DEPENDENCY_UNAVAILABLE');
    }
    if (outcome.kind === 'conflict') {
      throw materializationError('CANVAS_MATERIALIZATION_IDEMPOTENCY_CONFLICT');
    }
    if (
      outcome.value.authorityChecksum !== source.checksum ||
      outcome.value.mimeType !== source.mimeType ||
      outcome.value.byteSize !== source.byteSize
    ) {
      throw materializationError('CANVAS_MATERIALIZATION_CONTENT_INTEGRITY_FAILED');
    }

    return parseCanvasAssetMaterializationResponse({
      objectType: 'CanvasAssetMaterialization',
      contractVersion: '0.1',
      tenantId: input.tenantId,
      projectId: input.projectId,
      packageId: input.packageId,
      canvasSessionId: input.canvasSessionId,
      assetId: input.assetId,
      materializationAttemptId: input.materializationAttemptId,
      materializationId: outcome.value.materializationId,
      category: 'virtual_character',
      mimeType: source.mimeType,
      byteSize: source.byteSize,
      checksum: source.checksum,
      contentEncoding: 'base64',
      contentBase64: source.bytes.toString('base64'),
      replayed: outcome.kind === 'replayed',
      requestId: input.requestId,
      occurredAt: verifiedAt.toISOString(),
    });
  }
}
