import type { Knex } from 'knex';
import type {
  AssetApprovalStatus,
  AssetAuthorityRecord,
  AssetCategory,
  AssetProvenanceKind,
  AssetReuseScope,
  AssetRightsBasis,
  AssetRightsStatus,
  CanvasAssetAuthorityStore,
  ConsumeHighCostApprovalRecord,
  CreateAssetAuthorityRecord,
  CreateHighCostApprovalRecord,
  HighCostApprovalStatus,
  HighCostCommandApprovalAuthority,
  HighCostCommandType,
} from './types.js';

type AssetRow = {
  asset_id: string;
  tenant_id: string;
  project_id: string;
  package_id: string;
  canvas_session_id: string;
  category: AssetCategory;
  display_name: string;
  provenance_kind: AssetProvenanceKind;
  source_asset_id: string | null;
  declared_by_actor_id: string;
  declared_at: Date | string;
  rights_status: AssetRightsStatus;
  rights_basis: AssetRightsBasis;
  rights_valid_from: Date | string | null;
  rights_valid_until: Date | string | null;
  rights_reviewed_by_actor_id: string | null;
  rights_reviewed_at: Date | string | null;
  approval_status: AssetApprovalStatus;
  approval_reviewed_by_actor_id: string | null;
  approval_reviewed_at: Date | string | null;
  storage_reference: string;
  checksum: string;
  reuse_scope: AssetReuseScope;
  controlled_preview_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type ApprovalRow = {
  approval_id: string;
  tenant_id: string;
  project_id: string;
  package_id: string;
  canvas_session_id: string;
  actor_id: string;
  command_type: HighCostCommandType;
  action_fingerprint: string;
  confirmed_at: Date | string;
  expires_at: Date | string;
  replay_policy: 'single_use_replay_same_command';
  status: HighCostApprovalStatus;
  consumed_at: Date | string | null;
  consumed_by_command_id: string | null;
};

function date(value: Date | string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error('Canvas authority timestamp is invalid.');
  return parsed;
}

function optionalDate(value: Date | string | null): Date | null {
  return value === null ? null : date(value);
}

function assetFromRow(row: AssetRow): AssetAuthorityRecord {
  return {
    assetId: row.asset_id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    packageId: row.package_id,
    canvasSessionId: row.canvas_session_id,
    category: row.category,
    displayName: row.display_name,
    provenanceKind: row.provenance_kind,
    sourceAssetId: row.source_asset_id,
    declaredByActorId: row.declared_by_actor_id,
    declaredAt: date(row.declared_at),
    rightsStatus: row.rights_status,
    rightsBasis: row.rights_basis,
    rightsValidFrom: optionalDate(row.rights_valid_from),
    rightsValidUntil: optionalDate(row.rights_valid_until),
    rightsReviewedByActorId: row.rights_reviewed_by_actor_id,
    rightsReviewedAt: optionalDate(row.rights_reviewed_at),
    approvalStatus: row.approval_status,
    approvalReviewedByActorId: row.approval_reviewed_by_actor_id,
    approvalReviewedAt: optionalDate(row.approval_reviewed_at),
    storageReference: row.storage_reference,
    checksum: row.checksum,
    reuseScope: row.reuse_scope,
    controlledPreviewUrl: row.controlled_preview_url,
    createdAt: date(row.created_at),
    updatedAt: date(row.updated_at),
  };
}

function approvalFromRow(row: ApprovalRow): HighCostCommandApprovalAuthority {
  return {
    approvalId: row.approval_id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    packageId: row.package_id,
    canvasSessionId: row.canvas_session_id,
    actorId: row.actor_id,
    commandType: row.command_type,
    actionFingerprint: row.action_fingerprint,
    confirmedAt: date(row.confirmed_at),
    expiresAt: date(row.expires_at),
    replayPolicy: row.replay_policy,
    status: row.status,
    consumedAt: optionalDate(row.consumed_at),
    consumedByCommandId: row.consumed_by_command_id,
  };
}

export class PostgresCanvasAssetAuthorityRepository implements CanvasAssetAuthorityStore {
  constructor(private readonly database: Knex) {}

  async createAsset(input: CreateAssetAuthorityRecord): Promise<AssetAuthorityRecord> {
    const rows = (await this.database('control_plane.canvas_asset_records')
      .insert({
        asset_id: input.assetId,
        tenant_id: input.tenantId,
        project_id: input.projectId,
        package_id: input.packageId,
        canvas_session_id: input.canvasSessionId,
        category: input.category,
        display_name: input.displayName,
        provenance_kind: input.provenanceKind,
        source_asset_id: input.sourceAssetId,
        declared_by_actor_id: input.declaredByActorId,
        declared_at: input.declaredAt,
        rights_status: input.rightsStatus,
        rights_basis: input.rightsBasis,
        rights_valid_from: input.rightsValidFrom,
        rights_valid_until: input.rightsValidUntil,
        rights_reviewed_by_actor_id: input.rightsReviewedByActorId,
        rights_reviewed_at: input.rightsReviewedAt,
        approval_status: 'pending',
        approval_reviewed_by_actor_id: null,
        approval_reviewed_at: null,
        storage_reference: input.storageReference,
        checksum: input.checksum,
        reuse_scope: input.reuseScope,
        controlled_preview_url: input.controlledPreviewUrl,
        created_at: input.declaredAt,
        updated_at: input.declaredAt,
      })
      .returning('*')) as AssetRow[];
    const row = rows[0];
    if (!row) throw new Error('Canvas Asset insert returned no row.');
    return assetFromRow(row);
  }

  async listAssets(input: {
    tenantId: string;
    projectId: string;
  }): Promise<AssetAuthorityRecord[]> {
    const rows = (await this.database('control_plane.canvas_asset_records')
      .where({ tenant_id: input.tenantId, project_id: input.projectId })
      .orderBy([
        { column: 'created_at', order: 'asc' },
        { column: 'asset_id', order: 'asc' },
      ])) as AssetRow[];
    return rows.map(assetFromRow);
  }

  async getAsset(input: {
    tenantId: string;
    projectId: string;
    assetId: string;
  }): Promise<AssetAuthorityRecord | null> {
    const row = (await this.database('control_plane.canvas_asset_records')
      .where({
        tenant_id: input.tenantId,
        project_id: input.projectId,
        asset_id: input.assetId,
      })
      .first()) as AssetRow | undefined;
    return row ? assetFromRow(row) : null;
  }

  async transitionAssetRights(input: {
    tenantId: string;
    projectId: string;
    assetId: string;
    fromStatus: AssetRightsStatus;
    toStatus: AssetRightsStatus;
    validFrom: Date | null;
    validUntil: Date | null;
    reviewedByActorId: string;
    reviewedAt: Date;
  }): Promise<AssetAuthorityRecord | null> {
    const rows = (await this.database('control_plane.canvas_asset_records')
      .where({
        tenant_id: input.tenantId,
        project_id: input.projectId,
        asset_id: input.assetId,
        rights_status: input.fromStatus,
      })
      .update({
        rights_status: input.toStatus,
        rights_valid_from: input.validFrom,
        rights_valid_until: input.validUntil,
        rights_reviewed_by_actor_id: input.reviewedByActorId,
        rights_reviewed_at: input.reviewedAt,
        updated_at: input.reviewedAt,
      })
      .returning('*')) as AssetRow[];
    return rows[0] ? assetFromRow(rows[0]) : null;
  }

  async transitionAssetApproval(input: {
    tenantId: string;
    projectId: string;
    assetId: string;
    fromStatus: AssetApprovalStatus;
    toStatus: AssetApprovalStatus;
    reviewedByActorId: string;
    reviewedAt: Date;
  }): Promise<AssetAuthorityRecord | null> {
    const rows = (await this.database('control_plane.canvas_asset_records')
      .where({
        tenant_id: input.tenantId,
        project_id: input.projectId,
        asset_id: input.assetId,
        approval_status: input.fromStatus,
      })
      .update({
        approval_status: input.toStatus,
        approval_reviewed_by_actor_id: input.reviewedByActorId,
        approval_reviewed_at: input.reviewedAt,
        updated_at: input.reviewedAt,
      })
      .returning('*')) as AssetRow[];
    return rows[0] ? assetFromRow(rows[0]) : null;
  }

  async createHighCostApproval(
    input: CreateHighCostApprovalRecord,
  ): Promise<HighCostCommandApprovalAuthority> {
    const rows = (await this.database('control_plane.high_cost_command_approvals')
      .insert({
        approval_id: input.approvalId,
        tenant_id: input.tenantId,
        project_id: input.projectId,
        package_id: input.packageId,
        canvas_session_id: input.canvasSessionId,
        actor_id: input.actorId,
        command_type: input.commandType,
        action_fingerprint: input.actionFingerprint,
        confirmed_at: input.confirmedAt,
        expires_at: input.expiresAt,
        replay_policy: input.replayPolicy,
        status: 'active',
        consumed_at: null,
        consumed_by_command_id: null,
      })
      .returning('*')) as ApprovalRow[];
    const row = rows[0];
    if (!row) throw new Error('Canvas approval insert returned no row.');
    return approvalFromRow(row);
  }

  async getHighCostApproval(input: {
    tenantId: string;
    projectId: string;
    approvalId: string;
  }): Promise<HighCostCommandApprovalAuthority | null> {
    const row = (await this.database('control_plane.high_cost_command_approvals')
      .where({
        tenant_id: input.tenantId,
        project_id: input.projectId,
        approval_id: input.approvalId,
      })
      .first()) as ApprovalRow | undefined;
    return row ? approvalFromRow(row) : null;
  }

  async consumeHighCostApproval(
    input: ConsumeHighCostApprovalRecord & { consumedAt: Date },
  ): Promise<{ value: HighCostCommandApprovalAuthority; replayed: boolean } | null> {
    return this.database.transaction(async (transaction) => {
      const row = (await transaction('control_plane.high_cost_command_approvals')
        .where({
          approval_id: input.approvalId,
          tenant_id: input.tenantId,
          project_id: input.projectId,
          package_id: input.packageId,
          canvas_session_id: input.canvasSessionId,
          actor_id: input.actorId,
          command_type: input.commandType,
          action_fingerprint: input.actionFingerprint,
          replay_policy: 'single_use_replay_same_command',
        })
        .forUpdate()
        .first()) as ApprovalRow | undefined;
      if (!row) return null;
      if (row.status === 'consumed') {
        return row.consumed_by_command_id === input.commandId
          ? { value: approvalFromRow(row), replayed: true }
          : null;
      }
      if (row.status !== 'active' || date(row.expires_at).getTime() <= input.consumedAt.getTime()) {
        return null;
      }
      const rows = (await transaction('control_plane.high_cost_command_approvals')
        .where({ approval_id: input.approvalId, status: 'active' })
        .update({
          status: 'consumed',
          consumed_at: input.consumedAt,
          consumed_by_command_id: input.commandId,
        })
        .returning('*')) as ApprovalRow[];
      return rows[0] ? { value: approvalFromRow(rows[0]), replayed: false } : null;
    });
  }
}
