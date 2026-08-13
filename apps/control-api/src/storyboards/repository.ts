import { createHash, randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import type { SessionActor } from '../projects/types.js';
import { parseStoryboardDraftRevision } from './contract.js';
import { StoryboardAuthorityError, StoryboardContractError } from './errors.js';
import type { StoryboardDraftRevision } from './schema.js';
import type {
  CreateStoryboardApprovalInput,
  IdempotentStoryboardResult,
  StoryboardApprovalEvent,
  StoryboardAuthorityStore,
  StoryboardVersion,
  StoryboardVersionStatus,
} from './types.js';

type ProjectRow = { project_id: string };

type ScriptRow = {
  script_version_id: string;
  status: 'draft' | 'approved' | 'revoked' | 'superseded';
  payload_digest: string;
};

type ScriptApprovalRow = {
  status: 'approved' | 'revoked' | 'blocked';
  fact_risk_status: 'cleared' | 'unresolved';
};

type StoryboardVersionRow = {
  storyboard_version_id: string;
  tenant_id: string;
  project_id: string;
  script_version_id: string;
  version: number;
  status: StoryboardVersionStatus;
  draft_revision_id: string;
  draft_revision_number: number;
  previous_draft_revision_id: string | null;
  script_payload_digest: string;
  payload: Record<string, unknown>;
  payload_digest: string;
  provenance: Record<string, unknown>;
  created_by: string;
  created_at: Date | string;
};

type StoryboardApprovalRow = {
  storyboard_approval_id: string;
  approval_sequence: string | number;
  tenant_id: string;
  project_id: string;
  storyboard_version_id: string;
  status: StoryboardApprovalEvent['status'];
  fact_risk_status: StoryboardApprovalEvent['factRiskStatus'];
  reason: string | null;
  idempotency_key: string;
  event_digest: string;
  acted_by: string;
  acted_at: Date | string;
};

type IdempotencyRow<T> = {
  request_digest: string;
  response_body: T | string | null;
};

class ScopedResourceNotFoundError extends Error {}

function iso(value: Date | string): string {
  const result = new Date(value).toISOString();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result)) {
    throw new StoryboardAuthorityError('STORYBOARD_STORAGE_ERROR');
  }
  return result;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
    .join(',')}}`;
}

function authorityDigest(value: unknown): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

function canonicalScriptDigest(value: string): `sha256:${string}` | null {
  if (/^sha256:[0-9a-f]{64}$/.test(value)) return value as `sha256:${string}`;
  if (/^[0-9a-f]{64}$/.test(value)) return `sha256:${value}`;
  return null;
}

function splitDraft(draft: StoryboardDraftRevision): {
  payload: { shots: StoryboardDraftRevision['shots'] };
  provenance: Omit<StoryboardDraftRevision, 'shots'>;
} {
  const { shots, ...provenance } = draft;
  return { payload: { shots }, provenance };
}

function draftFromRow(row: StoryboardVersionRow): StoryboardDraftRevision {
  if (
    row.payload === null ||
    typeof row.payload !== 'object' ||
    Array.isArray(row.payload) ||
    Object.keys(row.payload).length !== 1 ||
    !Object.hasOwn(row.payload, 'shots')
  ) {
    throw new StoryboardAuthorityError('STORYBOARD_STORAGE_ERROR');
  }
  try {
    const draft = parseStoryboardDraftRevision({
      ...row.provenance,
      shots: row.payload.shots,
    });
    if (
      draft.tenantId !== row.tenant_id ||
      draft.projectId !== row.project_id ||
      draft.approvedScriptVersionId !== row.script_version_id ||
      draft.draftRevisionId !== row.draft_revision_id ||
      draft.revisionNumber !== row.draft_revision_number ||
      draft.previousRevisionId !== row.previous_draft_revision_id ||
      draft.approvedScriptDigest !== row.script_payload_digest ||
      draft.payloadDigest !== row.payload_digest
    ) {
      throw new StoryboardAuthorityError('STORYBOARD_STORAGE_ERROR');
    }
    return draft;
  } catch (error) {
    if (error instanceof StoryboardAuthorityError) throw error;
    throw new StoryboardAuthorityError('STORYBOARD_STORAGE_ERROR');
  }
}

function versionFromRow(row: StoryboardVersionRow): StoryboardVersion {
  return {
    id: row.storyboard_version_id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    scriptVersionId: row.script_version_id,
    version: row.version,
    status: row.status,
    draft: draftFromRow(row),
    createdBy: row.created_by,
    createdAt: iso(row.created_at),
  };
}

function approvalFromRow(row: StoryboardApprovalRow): StoryboardApprovalEvent {
  return {
    id: row.storyboard_approval_id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    storyboardVersionId: row.storyboard_version_id,
    sequence: String(row.approval_sequence),
    status: row.status,
    factRiskStatus: row.fact_risk_status,
    reason: row.reason,
    eventDigest: row.event_digest,
    actedBy: row.acted_by,
    actedAt: iso(row.acted_at),
  };
}

function jsonValue<T>(value: T | string): T {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new StoryboardAuthorityError('STORYBOARD_STORAGE_ERROR');
  }
}

function postgresCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function rethrowSafe(error: unknown): never {
  if (error instanceof StoryboardAuthorityError) throw error;
  if (error instanceof StoryboardContractError) {
    throw new StoryboardAuthorityError('STORYBOARD_STORAGE_ERROR');
  }
  const code = postgresCode(error);
  if (code === '23505' || code === '40001' || code === '40P01') {
    throw new StoryboardAuthorityError('STORYBOARD_CONFLICT');
  }
  throw new StoryboardAuthorityError('STORYBOARD_STORAGE_ERROR');
}

export class PostgresStoryboardAuthorityStore implements StoryboardAuthorityStore {
  constructor(
    private readonly database: Knex,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createVersion(
    actor: SessionActor,
    projectId: string,
    untrustedDraft: StoryboardDraftRevision,
    idempotencyKey: string,
  ): Promise<IdempotentStoryboardResult<StoryboardVersion> | null> {
    try {
      const draft = parseStoryboardDraftRevision(untrustedDraft);
      return await this.idempotent(
        actor,
        'storyboards.create-version',
        idempotencyKey,
        {
          actorId: actor.userId,
          projectId,
          draftPayloadDigest: draft.payloadDigest,
        },
        async (transaction) => {
          if (!(await this.lockProject(transaction, actor, projectId))) {
            throw new ScopedResourceNotFoundError();
          }
          if (draft.tenantId !== actor.tenantId || draft.projectId !== projectId) {
            throw new ScopedResourceNotFoundError();
          }
          await this.assertApprovedScript(transaction, actor, projectId, draft);

          const latest = (await transaction('control_plane.storyboard_versions')
            .select('*')
            .where({ tenant_id: actor.tenantId, project_id: projectId })
            .orderBy('version', 'desc')
            .first()) as StoryboardVersionRow | undefined;
          if (
            (latest === undefined &&
              (draft.revisionNumber !== 1 || draft.previousRevisionId !== null)) ||
            (latest !== undefined &&
              (draft.revisionNumber !== latest.draft_revision_number + 1 ||
                draft.previousRevisionId !== latest.draft_revision_id))
          ) {
            throw new StoryboardAuthorityError('STORYBOARD_STALE_REVISION');
          }

          const stored = splitDraft(draft);
          const [row] = (await transaction('control_plane.storyboard_versions')
            .insert({
              storyboard_version_id: randomUUID(),
              tenant_id: actor.tenantId,
              project_id: projectId,
              script_version_id: draft.approvedScriptVersionId,
              version: (latest?.version ?? 0) + 1,
              status: 'draft',
              draft_revision_id: draft.draftRevisionId,
              draft_revision_number: draft.revisionNumber,
              previous_draft_revision_id: draft.previousRevisionId,
              script_payload_digest: draft.approvedScriptDigest,
              payload: stored.payload,
              payload_digest: draft.payloadDigest,
              provenance: stored.provenance,
              created_by: actor.userId,
            })
            .returning('*')) as StoryboardVersionRow[];
          if (!row) throw new StoryboardAuthorityError('STORYBOARD_STORAGE_ERROR');
          return versionFromRow(row);
        },
      );
    } catch (error) {
      if (error instanceof ScopedResourceNotFoundError) return null;
      rethrowSafe(error);
    }
  }

  async listVersions(actor: SessionActor, projectId: string): Promise<StoryboardVersion[] | null> {
    try {
      if (!(await this.projectExists(actor, projectId))) return null;
      const rows = (await this.database('control_plane.storyboard_versions')
        .select('*')
        .where({ tenant_id: actor.tenantId, project_id: projectId })
        .orderBy('version')) as StoryboardVersionRow[];
      return rows.map(versionFromRow);
    } catch (error) {
      rethrowSafe(error);
    }
  }

  async createApproval(
    actor: SessionActor,
    projectId: string,
    storyboardVersionId: string,
    input: CreateStoryboardApprovalInput,
  ): Promise<IdempotentStoryboardResult<StoryboardApprovalEvent> | null> {
    try {
      return await this.idempotent(
        actor,
        'storyboards.create-approval',
        input.idempotencyKey,
        {
          actorId: actor.userId,
          projectId,
          storyboardVersionId,
          expectedVersion: input.expectedVersion,
          status: input.status,
          factRiskStatus: input.factRiskStatus,
          reason: input.reason ?? null,
        },
        async (transaction) => {
          if (!(await this.lockProject(transaction, actor, projectId))) {
            throw new ScopedResourceNotFoundError();
          }
          const target = (await transaction('control_plane.storyboard_versions')
            .select('*')
            .where({
              tenant_id: actor.tenantId,
              project_id: projectId,
              storyboard_version_id: storyboardVersionId,
            })
            .forUpdate()
            .first()) as StoryboardVersionRow | undefined;
          if (!target) throw new ScopedResourceNotFoundError();

          const latestVersion = (await transaction('control_plane.storyboard_versions')
            .select('version')
            .where({ tenant_id: actor.tenantId, project_id: projectId })
            .orderBy('version', 'desc')
            .first()) as Pick<StoryboardVersionRow, 'version'> | undefined;
          if (
            target.version !== input.expectedVersion ||
            latestVersion?.version !== input.expectedVersion
          ) {
            throw new StoryboardAuthorityError('STORYBOARD_STALE_VERSION');
          }
          if (target.status === 'revoked' || target.status === 'superseded') {
            throw new StoryboardAuthorityError('STORYBOARD_APPROVAL_STATE_INVALID');
          }

          const latestApproval = (await transaction('control_plane.storyboard_approvals')
            .select('*')
            .where({
              tenant_id: actor.tenantId,
              project_id: projectId,
              storyboard_version_id: storyboardVersionId,
            })
            .orderBy('approval_sequence', 'desc')
            .first()) as StoryboardApprovalRow | undefined;
          this.assertApprovalTransition(latestApproval, target, input);

          const eventDigest = authorityDigest({
            tenantId: actor.tenantId,
            projectId,
            storyboardVersionId,
            expectedVersion: input.expectedVersion,
            status: input.status,
            factRiskStatus: input.factRiskStatus,
            reason: input.reason ?? null,
            actedBy: actor.userId,
          });
          const [row] = (await transaction('control_plane.storyboard_approvals')
            .insert({
              storyboard_approval_id: randomUUID(),
              tenant_id: actor.tenantId,
              project_id: projectId,
              storyboard_version_id: storyboardVersionId,
              status: input.status,
              fact_risk_status: input.factRiskStatus,
              reason: input.reason ?? null,
              idempotency_key: input.idempotencyKey,
              event_digest: eventDigest,
              acted_by: actor.userId,
            })
            .returning('*')) as StoryboardApprovalRow[];
          if (!row) throw new StoryboardAuthorityError('STORYBOARD_STORAGE_ERROR');

          const projectedStatus: StoryboardVersionStatus =
            input.status === 'blocked' ? 'draft' : input.status;
          const updated = await transaction('control_plane.storyboard_versions')
            .where({
              tenant_id: actor.tenantId,
              project_id: projectId,
              storyboard_version_id: storyboardVersionId,
            })
            .update({ status: projectedStatus });
          if (updated !== 1) throw new StoryboardAuthorityError('STORYBOARD_STORAGE_ERROR');
          return approvalFromRow(row);
        },
      );
    } catch (error) {
      if (error instanceof ScopedResourceNotFoundError) return null;
      rethrowSafe(error);
    }
  }

  async listApprovals(
    actor: SessionActor,
    projectId: string,
    storyboardVersionId: string,
  ): Promise<StoryboardApprovalEvent[] | null> {
    try {
      const version = await this.database('control_plane.storyboard_versions')
        .select('storyboard_version_id')
        .where({
          tenant_id: actor.tenantId,
          project_id: projectId,
          storyboard_version_id: storyboardVersionId,
        })
        .first();
      if (!version) return null;
      const rows = (await this.database('control_plane.storyboard_approvals')
        .select('*')
        .where({
          tenant_id: actor.tenantId,
          project_id: projectId,
          storyboard_version_id: storyboardVersionId,
        })
        .orderBy('approval_sequence')) as StoryboardApprovalRow[];
      return rows.map(approvalFromRow);
    } catch (error) {
      rethrowSafe(error);
    }
  }

  private async assertApprovedScript(
    transaction: Knex.Transaction,
    actor: SessionActor,
    projectId: string,
    draft: StoryboardDraftRevision,
  ): Promise<void> {
    const script = (await transaction('control_plane.script_versions')
      .select('script_version_id', 'status', 'payload_digest')
      .where({
        tenant_id: actor.tenantId,
        project_id: projectId,
        script_version_id: draft.approvedScriptVersionId,
      })
      .first()) as ScriptRow | undefined;
    if (!script) throw new ScopedResourceNotFoundError();
    const scriptDigest = canonicalScriptDigest(script.payload_digest);
    if (!scriptDigest || scriptDigest !== draft.approvedScriptDigest) {
      throw new StoryboardAuthorityError('STORYBOARD_SCRIPT_DIGEST_MISMATCH');
    }

    const latestApproval = (await transaction('control_plane.script_approvals')
      .select('status', 'fact_risk_status')
      .where({
        tenant_id: actor.tenantId,
        project_id: projectId,
        script_version_id: draft.approvedScriptVersionId,
      })
      .orderBy('approval_sequence', 'desc')
      .first()) as ScriptApprovalRow | undefined;
    if (
      script.status !== 'approved' ||
      latestApproval?.status !== 'approved' ||
      latestApproval.fact_risk_status !== 'cleared'
    ) {
      throw new StoryboardAuthorityError('STORYBOARD_SCRIPT_NOT_APPROVED');
    }
  }

  private assertApprovalTransition(
    latest: StoryboardApprovalRow | undefined,
    target: StoryboardVersionRow,
    input: CreateStoryboardApprovalInput,
  ): void {
    if (input.status === 'approved' && input.factRiskStatus !== 'cleared') {
      throw new StoryboardAuthorityError('STORYBOARD_APPROVAL_STATE_INVALID');
    }
    if (input.status !== 'approved' && !input.reason) {
      throw new StoryboardAuthorityError('STORYBOARD_APPROVAL_STATE_INVALID');
    }
    if (latest?.status === 'revoked') {
      throw new StoryboardAuthorityError('STORYBOARD_APPROVAL_STATE_INVALID');
    }
    if (latest?.status === 'approved' && input.status !== 'revoked') {
      throw new StoryboardAuthorityError('STORYBOARD_APPROVAL_STATE_INVALID');
    }
    if (
      input.status === 'revoked' &&
      (latest?.status !== 'approved' || target.status !== 'approved')
    ) {
      throw new StoryboardAuthorityError('STORYBOARD_APPROVAL_STATE_INVALID');
    }
    if (input.status === 'blocked' && latest?.status === 'blocked') {
      throw new StoryboardAuthorityError('STORYBOARD_APPROVAL_STATE_INVALID');
    }
  }

  private async projectExists(actor: SessionActor, projectId: string): Promise<boolean> {
    const row = (await this.database('control_plane.projects')
      .select('project_id')
      .where({ tenant_id: actor.tenantId, project_id: projectId })
      .first()) as ProjectRow | undefined;
    return Boolean(row);
  }

  private async lockProject(
    transaction: Knex.Transaction,
    actor: SessionActor,
    projectId: string,
  ): Promise<ProjectRow | undefined> {
    return (await transaction('control_plane.projects')
      .select('project_id')
      .where({ tenant_id: actor.tenantId, project_id: projectId })
      .forUpdate()
      .first()) as ProjectRow | undefined;
  }

  private async idempotent<T>(
    actor: SessionActor,
    operation: string,
    idempotencyKey: string,
    payload: unknown,
    work: (transaction: Knex.Transaction) => Promise<T>,
  ): Promise<IdempotentStoryboardResult<T>> {
    return this.database.transaction(async (transaction) => {
      const requestDigest = authorityDigest(payload);
      const inserted = await transaction('control_plane.idempotency_records')
        .insert({
          idempotency_record_id: randomUUID(),
          tenant_id: actor.tenantId,
          operation,
          idempotency_key: idempotencyKey,
          request_digest: requestDigest,
          expires_at: new Date(this.now().getTime() + 24 * 60 * 60 * 1_000),
        })
        .onConflict(['tenant_id', 'operation', 'idempotency_key'])
        .ignore()
        .returning('idempotency_record_id');
      if (inserted.length === 0) {
        const existing = await transaction('control_plane.idempotency_records')
          .select('request_digest', 'response_body')
          .where({
            tenant_id: actor.tenantId,
            operation,
            idempotency_key: idempotencyKey,
          })
          .forUpdate()
          .first<IdempotencyRow<T>>();
        if (
          !existing ||
          existing.request_digest !== requestDigest ||
          existing.response_body === null
        ) {
          throw new StoryboardAuthorityError('STORYBOARD_IDEMPOTENCY_CONFLICT');
        }
        return { value: jsonValue(existing.response_body), replayed: true };
      }

      const value = await work(transaction);
      await transaction('control_plane.idempotency_records')
        .where({
          tenant_id: actor.tenantId,
          operation,
          idempotency_key: idempotencyKey,
        })
        .update({ response_status: 200, response_body: JSON.stringify(value) });
      return { value, replayed: false };
    });
  }
}
