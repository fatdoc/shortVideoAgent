export const CANVAS_ASSET_CONTRACT_VERSION = '0.1' as const;

export const ASSET_CATEGORIES = [
  'human',
  'virtual_character',
  'store',
  'product',
  'brand',
  'prop',
  'voice',
  'image',
  'video',
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const ASSET_RIGHTS_STATUSES = [
  'pending',
  'authorized',
  'rejected',
  'revoked',
  'expired',
] as const;
export type AssetRightsStatus = (typeof ASSET_RIGHTS_STATUSES)[number];

export const ASSET_APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'revoked'] as const;
export type AssetApprovalStatus = (typeof ASSET_APPROVAL_STATUSES)[number];

export const CANVAS_COMMAND_TYPES = [
  'ANALYZE_ASSET_REQUIREMENTS',
  'CREATE_VIRTUAL_CHARACTER',
  'SYNC_PROVIDER_ASSET',
  'BIND_ASSET_TO_ENTITY',
  'GENERATE_SHOT',
  'SELECT_SHOT_OUTPUT',
  'SAVE_CANVAS_DOCUMENT',
  'EXPORT_PLAYLIST',
] as const;
export type CanvasCommandType = (typeof CANVAS_COMMAND_TYPES)[number];

export const HIGH_COST_COMMAND_TYPES = [
  'CREATE_VIRTUAL_CHARACTER',
  'SYNC_PROVIDER_ASSET',
  'BIND_ASSET_TO_ENTITY',
  'GENERATE_SHOT',
  'SELECT_SHOT_OUTPUT',
  'EXPORT_PLAYLIST',
] as const satisfies readonly CanvasCommandType[];
export type HighCostCommandType = (typeof HIGH_COST_COMMAND_TYPES)[number];

export type AssetProvenanceKind =
  'customer_upload' | 'provider_generated' | 'licensed' | 'control_synced';
export type AssetRightsBasis =
  'customer_owned' | 'licensed' | 'provider_generated' | 'external_identity_verification';
export type AssetReuseScope = 'project' | 'tenant';

export type SessionActorScope = {
  userId: string;
  tenantId: string;
};

export type AssetRecordProjection = {
  objectType: 'AssetRecord';
  contractVersion: typeof CANVAS_ASSET_CONTRACT_VERSION;
  tenantId: string;
  projectId: string;
  packageId: string;
  canvasSessionId: string;
  assetId: string;
  category: AssetCategory;
  displayName: string;
  provenance: {
    kind: AssetProvenanceKind;
    sourceAssetId: string | null;
    declaredByActorId: string;
    declaredAt: string;
  };
  rights: {
    status: AssetRightsStatus;
    basis: AssetRightsBasis;
    validFrom: string | null;
    validUntil: string | null;
    reviewedAt: string | null;
  };
  approval: {
    status: AssetApprovalStatus;
    reviewedByActorId: string | null;
    reviewedAt: string | null;
  };
  controlledPreviewUrl: string | null;
  createdAt: string;
  updatedAt: string;
  occurredAt: string;
};

export type CreateAssetInput = {
  packageId: string;
  canvasSessionId: string;
  category: AssetCategory;
  displayName: string;
  provenance: { kind: AssetProvenanceKind; sourceAssetId: string | null };
  rights: {
    status: Extract<AssetRightsStatus, 'pending' | 'authorized'>;
    basis: AssetRightsBasis;
    validFrom: string | null;
    validUntil: string | null;
  };
  storageReference: string;
  checksum: string;
  reuseScope: AssetReuseScope;
  controlledPreviewUrl: string | null;
};

export type TransitionAssetRightsInput = {
  status: Exclude<AssetRightsStatus, 'pending'>;
  validFrom: string | null;
  validUntil: string | null;
};

export type TransitionAssetApprovalInput = {
  status: Exclude<AssetApprovalStatus, 'pending'>;
};

export type AssetAuthorityRecord = {
  assetId: string;
  tenantId: string;
  projectId: string;
  packageId: string;
  canvasSessionId: string;
  category: AssetCategory;
  displayName: string;
  provenanceKind: AssetProvenanceKind;
  sourceAssetId: string | null;
  declaredByActorId: string;
  declaredAt: Date;
  rightsStatus: AssetRightsStatus;
  rightsBasis: AssetRightsBasis;
  rightsValidFrom: Date | null;
  rightsValidUntil: Date | null;
  rightsReviewedByActorId: string | null;
  rightsReviewedAt: Date | null;
  approvalStatus: AssetApprovalStatus;
  approvalReviewedByActorId: string | null;
  approvalReviewedAt: Date | null;
  storageReference: string;
  checksum: string;
  reuseScope: AssetReuseScope;
  controlledPreviewUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateAssetAuthorityRecord = Omit<
  AssetAuthorityRecord,
  'approvalStatus' | 'approvalReviewedByActorId' | 'approvalReviewedAt' | 'createdAt' | 'updatedAt'
>;

export type ApprovalReplayPolicy = 'single_use_replay_same_command';
export type HighCostApprovalStatus = 'active' | 'consumed' | 'expired' | 'revoked';

export type HighCostApprovalAction = {
  commandId: string;
  payload: Record<string, unknown>;
};

export type CreateHighCostApprovalInput = {
  packageId: string;
  canvasSessionId: string;
  commandType: HighCostCommandType;
  action: HighCostApprovalAction;
  expiresInSeconds: number;
  replayPolicy: ApprovalReplayPolicy;
};

export type HighCostCommandApprovalAuthority = {
  approvalId: string;
  tenantId: string;
  projectId: string;
  packageId: string;
  canvasSessionId: string;
  actorId: string;
  commandType: HighCostCommandType;
  actionFingerprint: string;
  confirmedAt: Date;
  expiresAt: Date;
  replayPolicy: ApprovalReplayPolicy;
  status: HighCostApprovalStatus;
  consumedAt: Date | null;
  consumedByCommandId: string | null;
};

export type CreateHighCostApprovalRecord = Omit<
  HighCostCommandApprovalAuthority,
  'status' | 'consumedAt' | 'consumedByCommandId'
>;

export type HighCostApprovalProjection = {
  approvalId: string;
  status: HighCostApprovalStatus;
};

export type ConsumeHighCostApprovalInput = {
  approvalId: string;
  tenantId: string;
  projectId: string;
  packageId: string;
  canvasSessionId: string;
  actorId: string;
  commandType: HighCostCommandType;
  action: HighCostApprovalAction;
  commandId: string;
};

export type ConsumeHighCostApprovalRecord = Omit<ConsumeHighCostApprovalInput, 'action'> & {
  actionFingerprint: string;
};

export interface CanvasAssetAuthorityStore {
  createAsset(input: CreateAssetAuthorityRecord): Promise<AssetAuthorityRecord>;
  listAssets(input: { tenantId: string; projectId: string }): Promise<AssetAuthorityRecord[]>;
  getAsset(input: {
    tenantId: string;
    projectId: string;
    assetId: string;
  }): Promise<AssetAuthorityRecord | null>;
  transitionAssetRights(input: {
    tenantId: string;
    projectId: string;
    assetId: string;
    fromStatus: AssetRightsStatus;
    toStatus: AssetRightsStatus;
    validFrom: Date | null;
    validUntil: Date | null;
    reviewedByActorId: string;
    reviewedAt: Date;
  }): Promise<AssetAuthorityRecord | null>;
  transitionAssetApproval(input: {
    tenantId: string;
    projectId: string;
    assetId: string;
    fromStatus: AssetApprovalStatus;
    toStatus: AssetApprovalStatus;
    reviewedByActorId: string;
    reviewedAt: Date;
  }): Promise<AssetAuthorityRecord | null>;
  createHighCostApproval(
    input: CreateHighCostApprovalRecord,
  ): Promise<HighCostCommandApprovalAuthority>;
  getHighCostApproval(input: {
    tenantId: string;
    projectId: string;
    approvalId: string;
  }): Promise<HighCostCommandApprovalAuthority | null>;
  consumeHighCostApproval(
    input: ConsumeHighCostApprovalRecord & { consumedAt: Date },
  ): Promise<{ value: HighCostCommandApprovalAuthority; replayed: boolean } | null>;
}
