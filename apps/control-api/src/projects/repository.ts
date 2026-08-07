import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { ContentConflictError, IdempotencyConflictError } from './errors.js';
import { payloadDigest } from './digest.js';
import type {
  ApprovalEvent,
  BriefVersion,
  ContentStore,
  CreateApprovalInput,
  CreateProjectInput,
  IdempotencyInput,
  IdempotentResult,
  ProductionEligibility,
  Project,
  ScriptVersion,
  SessionActor,
  UpdateProjectInput,
} from './types.js';

type ProjectRow = {
  project_id: string;
  name: string;
  status: Project['status'];
  platform: string;
  aspect_ratio: string;
  target_duration_seconds: number;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type BriefRow = {
  brief_id: string;
  project_id: string;
  version: number;
  status: BriefVersion['status'];
  payload: Record<string, unknown>;
  created_by: string;
  created_at: Date | string;
};

type ScriptRow = {
  script_version_id: string;
  project_id: string;
  version: number;
  status: ScriptVersion['status'];
  payload: Record<string, unknown>;
  created_by: string;
  created_at: Date | string;
};

type ApprovalRow = {
  approval_id: string;
  project_id: string;
  script_version_id: string;
  status: ApprovalEvent['status'];
  fact_risk_status: ApprovalEvent['factRiskStatus'];
  reason: string | null;
  acted_by: string;
  acted_at: Date | string;
  approval_sequence: string;
};

class ResourceNotFoundError extends Error {}

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.project_id,
    name: row.name,
    status: row.status,
    platform: row.platform,
    aspectRatio: row.aspect_ratio,
    targetDurationSeconds: row.target_duration_seconds,
    createdBy: row.created_by,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function briefFromRow(row: BriefRow): BriefVersion {
  return {
    id: row.brief_id,
    projectId: row.project_id,
    version: row.version,
    status: row.status,
    payload: row.payload,
    createdBy: row.created_by,
    createdAt: iso(row.created_at),
  };
}

function scriptFromRow(row: ScriptRow): ScriptVersion {
  return {
    id: row.script_version_id,
    projectId: row.project_id,
    version: row.version,
    status: row.status,
    payload: row.payload,
    createdBy: row.created_by,
    createdAt: iso(row.created_at),
  };
}

function approvalFromRow(row: ApprovalRow): ApprovalEvent {
  return {
    id: row.approval_id,
    projectId: row.project_id,
    scriptVersionId: row.script_version_id,
    status: row.status,
    factRiskStatus: row.fact_risk_status,
    reason: row.reason,
    actedBy: row.acted_by,
    actedAt: iso(row.acted_at),
  };
}

export class PostgresContentStore implements ContentStore {
  constructor(private readonly database: Knex) {}

  async createProject(
    actor: SessionActor,
    input: CreateProjectInput,
    idempotency: IdempotencyInput,
  ): Promise<IdempotentResult<Project>> {
    return this.idempotent(actor, idempotency, async (transaction) => {
      const [row] = (await transaction('control_plane.projects')
        .insert({
          project_id: randomUUID(),
          tenant_id: actor.tenantId,
          name: input.name,
          status: input.status,
          platform: input.platform,
          aspect_ratio: input.aspectRatio,
          target_duration_seconds: input.targetDurationSeconds,
          created_by: actor.userId,
        })
        .returning('*')) as ProjectRow[];
      if (!row) throw new Error('project insert returned no row');
      return projectFromRow(row);
    });
  }

  async listProjects(
    actor: SessionActor,
    projectIds: readonly string[] | null,
  ): Promise<Project[]> {
    if (projectIds?.length === 0) return [];
    const query = this.database('control_plane.projects')
      .select('*')
      .where({ tenant_id: actor.tenantId });
    if (projectIds) query.whereIn('project_id', projectIds);
    const rows = (await query.orderBy('updated_at', 'desc').orderBy('project_id')) as ProjectRow[];
    return rows.map(projectFromRow);
  }

  async getProject(actor: SessionActor, projectId: string): Promise<Project | null> {
    const row = (await this.database('control_plane.projects')
      .select('*')
      .where({ tenant_id: actor.tenantId, project_id: projectId })
      .first()) as ProjectRow | undefined;
    return row ? projectFromRow(row) : null;
  }

  async updateProject(
    actor: SessionActor,
    projectId: string,
    input: UpdateProjectInput,
    idempotency: IdempotencyInput,
  ): Promise<IdempotentResult<Project> | null> {
    try {
      return await this.idempotent(actor, idempotency, async (transaction) => {
        const existing = await this.lockProject(transaction, actor, projectId);
        if (!existing) throw new ResourceNotFoundError();
        const update: Record<string, unknown> = { updated_at: transaction.fn.now() };
        if (input.name !== undefined) update.name = input.name;
        if (input.status !== undefined) update.status = input.status;
        if (input.platform !== undefined) update.platform = input.platform;
        if (input.aspectRatio !== undefined) update.aspect_ratio = input.aspectRatio;
        if (input.targetDurationSeconds !== undefined) {
          update.target_duration_seconds = input.targetDurationSeconds;
        }
        const [row] = (await transaction('control_plane.projects')
          .where({ tenant_id: actor.tenantId, project_id: projectId })
          .update(update)
          .returning('*')) as ProjectRow[];
        if (!row) throw new Error('project update returned no row');
        return projectFromRow(row);
      });
    } catch (error) {
      if (error instanceof ResourceNotFoundError) return null;
      throw error;
    }
  }

  async createBriefVersion(
    actor: SessionActor,
    projectId: string,
    payload: Record<string, unknown>,
    idempotency: IdempotencyInput,
  ): Promise<IdempotentResult<BriefVersion> | null> {
    try {
      return await this.idempotent(actor, idempotency, async (transaction) => {
        if (!(await this.lockProject(transaction, actor, projectId)))
          throw new ResourceNotFoundError();
        const latest = (await transaction('control_plane.creative_briefs')
          .select('version')
          .where({ tenant_id: actor.tenantId, project_id: projectId })
          .orderBy('version', 'desc')
          .first()) as Pick<BriefRow, 'version'> | undefined;
        const [row] = (await transaction('control_plane.creative_briefs')
          .insert({
            brief_id: randomUUID(),
            tenant_id: actor.tenantId,
            project_id: projectId,
            version: (latest?.version ?? 0) + 1,
            status: 'draft',
            payload,
            payload_digest: payloadDigest(payload),
            created_by: actor.userId,
          })
          .returning('*')) as BriefRow[];
        if (!row) throw new Error('brief insert returned no row');
        return briefFromRow(row);
      });
    } catch (error) {
      if (error instanceof ResourceNotFoundError) return null;
      throw error;
    }
  }

  async listBriefVersions(actor: SessionActor, projectId: string): Promise<BriefVersion[] | null> {
    if (!(await this.getProject(actor, projectId))) return null;
    const rows = (await this.database('control_plane.creative_briefs')
      .select('*')
      .where({ tenant_id: actor.tenantId, project_id: projectId })
      .orderBy('version')) as BriefRow[];
    return rows.map(briefFromRow);
  }

  async createScriptVersion(
    actor: SessionActor,
    projectId: string,
    payload: Record<string, unknown>,
    idempotency: IdempotencyInput,
  ): Promise<IdempotentResult<ScriptVersion> | null> {
    try {
      return await this.idempotent(actor, idempotency, async (transaction) => {
        if (!(await this.lockProject(transaction, actor, projectId)))
          throw new ResourceNotFoundError();
        const latest = (await transaction('control_plane.script_versions')
          .select('version')
          .where({ tenant_id: actor.tenantId, project_id: projectId })
          .orderBy('version', 'desc')
          .first()) as Pick<ScriptRow, 'version'> | undefined;
        const [row] = (await transaction('control_plane.script_versions')
          .insert({
            script_version_id: randomUUID(),
            tenant_id: actor.tenantId,
            project_id: projectId,
            version: (latest?.version ?? 0) + 1,
            status: 'draft',
            payload,
            payload_digest: payloadDigest(payload),
            created_by: actor.userId,
          })
          .returning('*')) as ScriptRow[];
        if (!row) throw new Error('script insert returned no row');
        return scriptFromRow(row);
      });
    } catch (error) {
      if (error instanceof ResourceNotFoundError) return null;
      throw error;
    }
  }

  async listScriptVersions(
    actor: SessionActor,
    projectId: string,
  ): Promise<ScriptVersion[] | null> {
    if (!(await this.getProject(actor, projectId))) return null;
    const rows = (await this.database('control_plane.script_versions')
      .select('*')
      .where({ tenant_id: actor.tenantId, project_id: projectId })
      .orderBy('version')) as ScriptRow[];
    return rows.map(scriptFromRow);
  }

  async createApproval(
    actor: SessionActor,
    projectId: string,
    scriptVersionId: string,
    input: CreateApprovalInput,
    idempotency: IdempotencyInput,
  ): Promise<IdempotentResult<ApprovalEvent> | null> {
    try {
      return await this.idempotent(actor, idempotency, async (transaction) => {
        if (!(await this.lockProject(transaction, actor, projectId)))
          throw new ResourceNotFoundError();
        const script = (await transaction('control_plane.script_versions')
          .select('*')
          .where({
            tenant_id: actor.tenantId,
            project_id: projectId,
            script_version_id: scriptVersionId,
          })
          .first()) as ScriptRow | undefined;
        if (!script) throw new ResourceNotFoundError();
        if (input.status === 'approved' && input.factRiskStatus !== 'cleared') {
          throw new ContentConflictError('风险未清除的脚本不能审批。', 'FACT_RISK_UNRESOLVED');
        }
        if (input.status === 'revoked') {
          const latestApproval = (await transaction('control_plane.script_approvals')
            .select('status')
            .where({
              tenant_id: actor.tenantId,
              project_id: projectId,
              script_version_id: scriptVersionId,
            })
            .orderBy('approval_sequence', 'desc')
            .first()) as Pick<ApprovalRow, 'status'> | undefined;
          if (latestApproval?.status !== 'approved') {
            throw new ContentConflictError('当前脚本没有可撤销的有效审批。', 'APPROVAL_NOT_ACTIVE');
          }
        }
        const [row] = (await transaction('control_plane.script_approvals')
          .insert({
            approval_id: randomUUID(),
            tenant_id: actor.tenantId,
            project_id: projectId,
            script_version_id: scriptVersionId,
            status: input.status,
            fact_risk_status: input.factRiskStatus,
            reason: input.reason ?? null,
            acted_by: actor.userId,
          })
          .returning('*')) as ApprovalRow[];
        if (!row) throw new Error('approval insert returned no row');
        return approvalFromRow(row);
      });
    } catch (error) {
      if (error instanceof ResourceNotFoundError) return null;
      throw error;
    }
  }

  async getProductionEligibility(
    actor: SessionActor,
    projectId: string,
  ): Promise<ProductionEligibility | null> {
    if (!(await this.getProject(actor, projectId))) return null;
    const script = (await this.database('control_plane.script_versions')
      .select('*')
      .where({ tenant_id: actor.tenantId, project_id: projectId })
      .orderBy('version', 'desc')
      .first()) as ScriptRow | undefined;
    if (!script) {
      return {
        projectId,
        eligible: false,
        scriptVersionId: null,
        scriptVersion: null,
        reasonCode: 'NO_SCRIPT_VERSION',
        approval: null,
      };
    }
    const approvalRow = (await this.database('control_plane.script_approvals')
      .select('*')
      .where({
        tenant_id: actor.tenantId,
        project_id: projectId,
        script_version_id: script.script_version_id,
      })
      .orderBy('approval_sequence', 'desc')
      .first()) as ApprovalRow | undefined;
    const approval = approvalRow ? approvalFromRow(approvalRow) : null;
    let reasonCode: ProductionEligibility['reasonCode'] = 'SCRIPT_NOT_APPROVED';
    if (approval?.factRiskStatus === 'unresolved') reasonCode = 'FACT_RISK_UNRESOLVED';
    else if (approval?.status === 'revoked') reasonCode = 'APPROVAL_REVOKED';
    else if (approval?.status === 'blocked') reasonCode = 'SCRIPT_BLOCKED';
    else if (approval?.status === 'approved') reasonCode = 'ELIGIBLE';
    return {
      projectId,
      eligible: reasonCode === 'ELIGIBLE',
      scriptVersionId: script.script_version_id,
      scriptVersion: script.version,
      reasonCode,
      approval,
    };
  }

  private async lockProject(
    transaction: Knex.Transaction,
    actor: SessionActor,
    projectId: string,
  ): Promise<ProjectRow | undefined> {
    return (await transaction('control_plane.projects')
      .select('*')
      .where({ tenant_id: actor.tenantId, project_id: projectId })
      .forUpdate()
      .first()) as ProjectRow | undefined;
  }

  private async idempotent<T>(
    actor: SessionActor,
    input: IdempotencyInput,
    work: (transaction: Knex.Transaction) => Promise<T>,
  ): Promise<IdempotentResult<T>> {
    return this.database.transaction(async (transaction) => {
      const digest = payloadDigest(input.payload);
      const inserted = await transaction('control_plane.idempotency_records')
        .insert({
          idempotency_record_id: randomUUID(),
          tenant_id: actor.tenantId,
          operation: input.operation,
          idempotency_key: input.key,
          request_digest: digest,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        })
        .onConflict(['tenant_id', 'operation', 'idempotency_key'])
        .ignore()
        .returning('idempotency_record_id');
      if (inserted.length === 0) {
        const existing = await transaction('control_plane.idempotency_records')
          .select('request_digest', 'response_body')
          .where({
            tenant_id: actor.tenantId,
            operation: input.operation,
            idempotency_key: input.key,
          })
          .forUpdate()
          .first<{ request_digest: string; response_body: T | null }>();
        if (!existing || existing.request_digest !== digest || existing.response_body === null) {
          throw new IdempotencyConflictError();
        }
        return { value: existing.response_body, replayed: true };
      }
      const value = await work(transaction);
      await transaction('control_plane.idempotency_records')
        .where({
          tenant_id: actor.tenantId,
          operation: input.operation,
          idempotency_key: input.key,
        })
        .update({ response_status: 200, response_body: JSON.stringify(value) });
      return { value, replayed: false };
    });
  }
}
