import { createHmac, randomUUID } from 'node:crypto';
import { canvasAssetError } from './errors.js';
import {
  parseAssetRecordProjection,
  parseConsumeHighCostApprovalInput,
  parseCreateAssetInput,
  parseCreateHighCostApprovalInput,
  parseHighCostApprovalProjection,
  parseTransitionAssetApprovalInput,
  parseTransitionAssetRightsInput,
  parseUuid,
} from './parser.js';
import type {
  AssetApprovalStatus,
  AssetAuthorityRecord,
  AssetRecordProjection,
  AssetRightsStatus,
  CanvasAssetAuthorityStore,
  ConsumeHighCostApprovalInput,
  CreateAssetInput,
  CreateHighCostApprovalInput,
  HighCostApprovalProjection,
  HighCostCommandType,
  SessionActorScope,
  TransitionAssetApprovalInput,
  TransitionAssetRightsInput,
} from './types.js';
import type { CanvasAssetSessionVerifier } from './sessionTypes.js';

type ServiceOptions = {
  now?: () => Date;
  newId?: (kind: 'asset' | 'approval') => string;
  sessionAuthority?: CanvasAssetSessionVerifier;
};

const rightsTransitions: Record<AssetRightsStatus, readonly AssetRightsStatus[]> = {
  pending: ['authorized', 'rejected'],
  authorized: ['revoked', 'expired'],
  rejected: [],
  revoked: [],
  expired: [],
};
const approvalTransitions: Record<AssetApprovalStatus, readonly AssetApprovalStatus[]> = {
  pending: ['approved', 'rejected'],
  approved: ['revoked'],
  rejected: [],
  revoked: [],
};

function time(now: () => Date): Date {
  const value = now();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw canvasAssetError('CANVAS_SCHEMA_INVALID', 'Canvas Asset service clock is invalid.');
  }
  return new Date(value.getTime());
}

function iso(value: Date | null): string | null {
  if (!value) return null;
  if (!Number.isFinite(value.getTime())) {
    throw canvasAssetError('CANVAS_SCHEMA_INVALID', 'Canvas Asset timestamp is invalid.');
  }
  return value.toISOString();
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
    .join(',')}}`;
}

function effectiveRights(record: AssetAuthorityRecord, occurredAt: Date): AssetRightsStatus {
  return record.rightsStatus === 'authorized' &&
    record.rightsValidUntil &&
    record.rightsValidUntil.getTime() <= occurredAt.getTime()
    ? 'expired'
    : record.rightsStatus;
}

function project(record: AssetAuthorityRecord, occurredAt: Date): AssetRecordProjection {
  return parseAssetRecordProjection({
    objectType: 'AssetRecord',
    contractVersion: '0.1',
    tenantId: record.tenantId,
    projectId: record.projectId,
    packageId: record.packageId,
    canvasSessionId: record.canvasSessionId,
    assetId: record.assetId,
    category: record.category,
    displayName: record.displayName,
    provenance: {
      kind: record.provenanceKind,
      sourceAssetId: record.sourceAssetId,
      declaredByActorId: record.declaredByActorId,
      declaredAt: iso(record.declaredAt),
    },
    rights: {
      status: effectiveRights(record, occurredAt),
      basis: record.rightsBasis,
      validFrom: iso(record.rightsValidFrom),
      validUntil: iso(record.rightsValidUntil),
      reviewedAt: iso(record.rightsReviewedAt),
    },
    approval: {
      status: record.approvalStatus,
      reviewedByActorId: record.approvalReviewedByActorId,
      reviewedAt: iso(record.approvalReviewedAt),
    },
    controlledPreviewUrl: record.controlledPreviewUrl,
    createdAt: iso(record.createdAt),
    updatedAt: iso(record.updatedAt),
    occurredAt: iso(occurredAt),
  });
}

function notFound(): never {
  throw canvasAssetError('CANVAS_ASSET_NOT_FOUND', 'Canvas Asset was not found in this project.');
}

export class CanvasAssetAuthorityService {
  private readonly now: () => Date;
  private readonly newId: (kind: 'asset' | 'approval') => string;
  private readonly sessionAuthority: CanvasAssetSessionVerifier | undefined;

  constructor(
    private readonly store: CanvasAssetAuthorityStore,
    private readonly fingerprintSecret: string,
    options: ServiceOptions = {},
  ) {
    if (Buffer.byteLength(fingerprintSecret, 'utf8') < 32) {
      throw new Error('Canvas approval fingerprint secret must contain at least 32 bytes.');
    }
    this.now = options.now ?? (() => new Date());
    this.newId = options.newId ?? (() => randomUUID());
    this.sessionAuthority = options.sessionAuthority;
  }

  private async assertActiveSession(
    actor: SessionActorScope,
    projectId: string,
    packageId: string,
    canvasSessionId: string,
  ): Promise<void> {
    if (!this.sessionAuthority) {
      throw canvasAssetError('CANVAS_SESSION_INVALID', 'Canvas session authority is unavailable.');
    }
    await this.sessionAuthority.assertActiveSession({
      tenantId: parseUuid(actor.tenantId),
      projectId: parseUuid(projectId),
      packageId,
      canvasSessionId,
      actorId: parseUuid(actor.userId),
    });
  }

  async createAsset(
    actor: SessionActorScope,
    projectIdInput: string,
    inputValue: CreateAssetInput,
  ): Promise<AssetRecordProjection> {
    const input = parseCreateAssetInput(inputValue);
    const tenantId = parseUuid(actor.tenantId);
    const projectId = parseUuid(projectIdInput);
    const declaredByActorId = parseUuid(actor.userId);
    await this.assertActiveSession(
      actor,
      projectId,
      input.packageId,
      input.canvasSessionId,
    );
    const declaredAt = time(this.now);
    const rightsValidFrom = input.rights.validFrom ? new Date(input.rights.validFrom) : null;
    const rightsValidUntil = input.rights.validUntil ? new Date(input.rights.validUntil) : null;
    const record = await this.store.createAsset({
      assetId: parseUuid(this.newId('asset')),
      tenantId,
      projectId,
      packageId: input.packageId,
      canvasSessionId: input.canvasSessionId,
      category: input.category,
      displayName: input.displayName,
      provenanceKind: input.provenance.kind,
      sourceAssetId: input.provenance.sourceAssetId,
      declaredByActorId,
      declaredAt,
      rightsStatus: input.rights.status,
      rightsBasis: input.rights.basis,
      rightsValidFrom,
      rightsValidUntil,
      rightsReviewedByActorId: input.rights.status === 'authorized' ? declaredByActorId : null,
      rightsReviewedAt: input.rights.status === 'authorized' ? declaredAt : null,
      storageReference: input.storageReference,
      checksum: input.checksum,
      reuseScope: input.reuseScope,
      controlledPreviewUrl: input.controlledPreviewUrl,
    });
    return project(record, declaredAt);
  }

  async listAssets(
    actor: SessionActorScope,
    projectIdInput: string,
  ): Promise<AssetRecordProjection[]> {
    const occurredAt = time(this.now);
    const records = await this.store.listAssets({
      tenantId: parseUuid(actor.tenantId),
      projectId: parseUuid(projectIdInput),
    });
    return records.map((record) => project(record, occurredAt));
  }

  async getAsset(
    actor: SessionActorScope,
    projectIdInput: string,
    assetIdInput: string,
  ): Promise<AssetRecordProjection> {
    const occurredAt = time(this.now);
    const record = await this.store.getAsset({
      tenantId: parseUuid(actor.tenantId),
      projectId: parseUuid(projectIdInput),
      assetId: parseUuid(assetIdInput),
    });
    if (!record) notFound();
    return project(record, occurredAt);
  }

  async transitionRights(
    actor: SessionActorScope,
    projectIdInput: string,
    assetIdInput: string,
    inputValue: TransitionAssetRightsInput,
  ): Promise<AssetRecordProjection> {
    const input = parseTransitionAssetRightsInput(inputValue);
    const tenantId = parseUuid(actor.tenantId);
    const projectId = parseUuid(projectIdInput);
    const assetId = parseUuid(assetIdInput);
    const current = await this.store.getAsset({ tenantId, projectId, assetId });
    if (!current) notFound();
    if (!rightsTransitions[current.rightsStatus].includes(input.status)) {
      throw canvasAssetError(
        'CANVAS_ASSET_LIFECYCLE_INVALID',
        'Canvas Asset rights transition is not permitted.',
      );
    }
    const reviewedAt = time(this.now);
    const updated = await this.store.transitionAssetRights({
      tenantId,
      projectId,
      assetId,
      fromStatus: current.rightsStatus,
      toStatus: input.status,
      validFrom: input.validFrom ? new Date(input.validFrom) : null,
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      reviewedByActorId: parseUuid(actor.userId),
      reviewedAt,
    });
    if (!updated) {
      throw canvasAssetError(
        'CANVAS_ASSET_LIFECYCLE_INVALID',
        'Canvas Asset rights changed concurrently.',
      );
    }
    return project(updated, reviewedAt);
  }

  async transitionApproval(
    actor: SessionActorScope,
    projectIdInput: string,
    assetIdInput: string,
    inputValue: TransitionAssetApprovalInput,
  ): Promise<AssetRecordProjection> {
    const input = parseTransitionAssetApprovalInput(inputValue);
    const tenantId = parseUuid(actor.tenantId);
    const projectId = parseUuid(projectIdInput);
    const assetId = parseUuid(assetIdInput);
    const current = await this.store.getAsset({ tenantId, projectId, assetId });
    if (!current) notFound();
    if (!approvalTransitions[current.approvalStatus].includes(input.status)) {
      throw canvasAssetError(
        'CANVAS_ASSET_LIFECYCLE_INVALID',
        'Canvas Asset approval transition is not permitted.',
      );
    }
    const reviewedAt = time(this.now);
    const updated = await this.store.transitionAssetApproval({
      tenantId,
      projectId,
      assetId,
      fromStatus: current.approvalStatus,
      toStatus: input.status,
      reviewedByActorId: parseUuid(actor.userId),
      reviewedAt,
    });
    if (!updated) {
      throw canvasAssetError(
        'CANVAS_ASSET_LIFECYCLE_INVALID',
        'Canvas Asset approval changed concurrently.',
      );
    }
    return project(updated, reviewedAt);
  }

  actionFingerprint(commandType: HighCostCommandType, action: Record<string, unknown>): string {
    const input = parseCreateHighCostApprovalInput({
      packageId: '00000000-0000-4000-8000-000000000000',
      canvasSessionId: 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX',
      commandType,
      action,
      expiresInSeconds: 30,
      replayPolicy: 'single_use_replay_same_command',
    });
    return `sha256:${createHmac('sha256', this.fingerprintSecret)
      .update(canonical({ commandType: input.commandType, action: input.action }))
      .digest('hex')}`;
  }

  async createHighCostApproval(
    actor: SessionActorScope,
    projectIdInput: string,
    inputValue: CreateHighCostApprovalInput,
  ): Promise<HighCostApprovalProjection> {
    const input = parseCreateHighCostApprovalInput(inputValue);
    const projectId = parseUuid(projectIdInput);
    await this.assertActiveSession(
      actor,
      projectId,
      input.packageId,
      input.canvasSessionId,
    );
    const confirmedAt = time(this.now);
    const value = await this.store.createHighCostApproval({
      approvalId: parseUuid(this.newId('approval')),
      tenantId: parseUuid(actor.tenantId),
      projectId,
      packageId: input.packageId,
      canvasSessionId: input.canvasSessionId,
      actorId: parseUuid(actor.userId),
      commandType: input.commandType,
      actionFingerprint: this.actionFingerprint(input.commandType, input.action),
      confirmedAt,
      expiresAt: new Date(confirmedAt.getTime() + input.expiresInSeconds * 1000),
      replayPolicy: input.replayPolicy,
    });
    return parseHighCostApprovalProjection({ approvalId: value.approvalId, status: value.status });
  }

  async readHighCostApproval(
    actor: SessionActorScope,
    projectIdInput: string,
    approvalIdInput: string,
  ): Promise<HighCostApprovalProjection> {
    const record = await this.store.getHighCostApproval({
      tenantId: parseUuid(actor.tenantId),
      projectId: parseUuid(projectIdInput),
      approvalId: parseUuid(approvalIdInput),
    });
    if (!record || record.actorId !== parseUuid(actor.userId)) {
      throw canvasAssetError('CANVAS_APPROVAL_INVALID', 'Canvas approval is invalid.');
    }
    const status =
      record.status === 'active' && record.expiresAt.getTime() <= time(this.now).getTime()
        ? 'expired'
        : record.status;
    return parseHighCostApprovalProjection({ approvalId: record.approvalId, status });
  }

  async consumeHighCostApproval(
    inputValue: ConsumeHighCostApprovalInput,
  ): Promise<HighCostApprovalProjection & { replayed: boolean }> {
    const input = parseConsumeHighCostApprovalInput(inputValue);
    await this.assertActiveSession(
      { userId: input.actorId, tenantId: input.tenantId },
      input.projectId,
      input.packageId,
      input.canvasSessionId,
    );
    const current = await this.store.getHighCostApproval({
      tenantId: input.tenantId,
      projectId: input.projectId,
      approvalId: input.approvalId,
    });
    const consumedAt = time(this.now);
    const actionFingerprint = this.actionFingerprint(input.commandType, input.action);
    if (
      !current ||
      current.packageId !== input.packageId ||
      current.canvasSessionId !== input.canvasSessionId ||
      current.actorId !== input.actorId ||
      current.commandType !== input.commandType ||
      current.actionFingerprint !== actionFingerprint ||
      !['active', 'consumed'].includes(current.status) ||
      (current.status === 'active' && current.expiresAt.getTime() <= consumedAt.getTime())
    ) {
      throw canvasAssetError('CANVAS_APPROVAL_INVALID', 'Canvas approval is invalid.');
    }
    const { action: _action, ...scope } = input;
    const result = await this.store.consumeHighCostApproval({
      ...scope,
      actionFingerprint,
      consumedAt,
    });
    if (!result) {
      throw canvasAssetError('CANVAS_APPROVAL_INVALID', 'Canvas approval is invalid or consumed.');
    }
    const value = parseHighCostApprovalProjection({
      approvalId: result.value.approvalId,
      status: result.value.status,
    });
    return { ...value, replayed: result.replayed };
  }
}
