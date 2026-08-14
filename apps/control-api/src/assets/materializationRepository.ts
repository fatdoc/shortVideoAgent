import type { Knex } from 'knex';
import type {
  CanvasAssetMaterializationAttempt,
  CanvasAssetMaterializationAttemptOutcome,
  CanvasAssetMaterializationAttemptStore,
  CanvasMaterializationMime,
} from './materializationTypes.js';

type AttemptRow = {
  materialization_attempt_id: string;
  materialization_id: string;
  tenant_id: string;
  project_id: string;
  package_id: string;
  canvas_session_id: string;
  actor_id: string;
  asset_id: string;
  authority_checksum: string;
  mime_type: CanvasMaterializationMime;
  byte_size: number;
  created_at: Date | string;
};

function fromRow(row: AttemptRow): CanvasAssetMaterializationAttempt {
  const createdAt = new Date(row.created_at);
  if (!Number.isFinite(createdAt.getTime())) throw new Error('Invalid materialization timestamp.');
  return {
    materializationAttemptId: row.materialization_attempt_id,
    materializationId: row.materialization_id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    packageId: row.package_id,
    canvasSessionId: row.canvas_session_id,
    actorId: row.actor_id,
    assetId: row.asset_id,
    authorityChecksum: row.authority_checksum,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    createdAt,
  };
}

function sameAuthority(
  left: CanvasAssetMaterializationAttempt,
  right: CanvasAssetMaterializationAttempt,
): boolean {
  return (
    left.materializationAttemptId === right.materializationAttemptId &&
    left.tenantId === right.tenantId &&
    left.projectId === right.projectId &&
    left.packageId === right.packageId &&
    left.canvasSessionId === right.canvasSessionId &&
    left.actorId === right.actorId &&
    left.assetId === right.assetId &&
    left.authorityChecksum === right.authorityChecksum &&
    left.mimeType === right.mimeType &&
    left.byteSize === right.byteSize
  );
}

export class PostgresCanvasAssetMaterializationRepository
  implements CanvasAssetMaterializationAttemptStore
{
  constructor(private readonly database: Knex) {}

  async createOrReplay(
    input: CanvasAssetMaterializationAttempt,
  ): Promise<CanvasAssetMaterializationAttemptOutcome> {
    return this.database.transaction(async (transaction) => {
      const inserted = (await transaction('control_plane.canvas_asset_materialization_attempts')
        .insert({
          materialization_attempt_id: input.materializationAttemptId,
          materialization_id: input.materializationId,
          tenant_id: input.tenantId,
          project_id: input.projectId,
          package_id: input.packageId,
          canvas_session_id: input.canvasSessionId,
          actor_id: input.actorId,
          asset_id: input.assetId,
          authority_checksum: input.authorityChecksum,
          mime_type: input.mimeType,
          byte_size: input.byteSize,
          created_at: input.createdAt,
        })
        .onConflict('materialization_attempt_id')
        .ignore()
        .returning('*')) as AttemptRow[];
      if (inserted[0]) return { kind: 'created', value: fromRow(inserted[0]) };

      const existing = (await transaction('control_plane.canvas_asset_materialization_attempts')
        .where({ materialization_attempt_id: input.materializationAttemptId })
        .first()) as AttemptRow | undefined;
      if (!existing) throw new Error('Materialization attempt lookup failed.');
      const value = fromRow(existing);
      return sameAuthority(value, input)
        ? { kind: 'replayed', value }
        : { kind: 'conflict' };
    });
  }
}
