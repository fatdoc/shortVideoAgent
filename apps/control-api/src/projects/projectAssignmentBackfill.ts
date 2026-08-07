import { createHash, randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { z } from 'zod';

export type ProjectAssignmentAccessLevel = 'viewer' | 'editor';

export type ProjectAssignmentManifestEntry = {
  membershipId: string;
  projectId: string;
  accessLevel: ProjectAssignmentAccessLevel;
};

export type ProjectAssignmentManifest = {
  manifestVersion: 1;
  manifestId: string;
  tenantId: string;
  approvedByUserId: string;
  assignments: ProjectAssignmentManifestEntry[];
};

export type ProjectAssignmentBackfillResult = {
  manifestId: string;
  manifestDigest: string;
  assignmentCount: number;
  replay: boolean;
};

export type ProjectAssignmentBackfillLogEntry = ProjectAssignmentBackfillResult & {
  event: 'project_assignment_backfill_completed' | 'project_assignment_backfill_replayed';
};

export type ProjectAssignmentBackfillOptions = {
  logger?: (entry: ProjectAssignmentBackfillLogEntry) => void;
};

export type ProjectAssignmentBackfillErrorCode =
  | 'MANIFEST_INVALID'
  | 'MANIFEST_ID_CONFLICT'
  | 'MANIFEST_DIGEST_CONFLICT'
  | 'TENANT_INVALID'
  | 'APPROVER_UNAUTHORIZED'
  | 'ASSIGNMENT_TARGET_INVALID'
  | 'PROJECT_INVALID';

export class ProjectAssignmentBackfillError extends Error {
  readonly name = 'ProjectAssignmentBackfillError';

  constructor(readonly code: ProjectAssignmentBackfillErrorCode) {
    super(`Project assignment backfill rejected: ${code}`);
  }
}

const normalizedUuid = z
  .string()
  .uuid()
  .transform((value) => value.toLowerCase());

const assignmentSchema = z
  .object({
    membershipId: normalizedUuid,
    projectId: normalizedUuid,
    accessLevel: z.enum(['viewer', 'editor']),
  })
  .strict();

const manifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    manifestId: z.string().trim().min(1).max(200),
    tenantId: normalizedUuid,
    approvedByUserId: normalizedUuid,
    assignments: z.array(assignmentSchema).min(1),
  })
  .strict();

function reject(code: ProjectAssignmentBackfillErrorCode): never {
  throw new ProjectAssignmentBackfillError(code);
}

export function parseProjectAssignmentManifest(input: unknown): ProjectAssignmentManifest {
  const parsed = manifestSchema.safeParse(input);
  if (!parsed.success) reject('MANIFEST_INVALID');

  const seenPairs = new Set<string>();
  for (const assignment of parsed.data.assignments) {
    const pair = `${assignment.membershipId}:${assignment.projectId}`;
    if (seenPairs.has(pair)) reject('MANIFEST_INVALID');
    seenPairs.add(pair);
  }

  return parsed.data;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function projectAssignmentManifestDigest(manifest: ProjectAssignmentManifest): string {
  const assignments = [...manifest.assignments].sort((left, right) => {
    return (
      left.membershipId.localeCompare(right.membershipId) ||
      left.projectId.localeCompare(right.projectId) ||
      left.accessLevel.localeCompare(right.accessLevel)
    );
  });
  const payload = canonicalize({
    manifestVersion: manifest.manifestVersion,
    tenantId: manifest.tenantId,
    approvedByUserId: manifest.approvedByUserId,
    assignments,
  });
  const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return `sha256:${digest}`;
}

async function acquireIdempotencyLocks(
  transaction: Knex.Transaction,
  manifestId: string,
  manifestDigest: string,
): Promise<void> {
  const lockKeys = [
    `project-assignment:id:${manifestId}`,
    `project-assignment:digest:${manifestDigest}`,
  ].sort();
  for (const lockKey of lockKeys) {
    await transaction.raw('select pg_advisory_xact_lock(hashtextextended(?, 0))', [lockKey]);
  }
}

async function executeBackfill(
  transaction: Knex.Transaction,
  manifest: ProjectAssignmentManifest,
  manifestDigest: string,
): Promise<ProjectAssignmentBackfillResult> {
  await acquireIdempotencyLocks(transaction, manifest.manifestId, manifestDigest);

  const existingRuns = await transaction('control_plane.project_assignment_backfill_runs')
    .select('manifest_id', 'manifest_digest', 'assignment_count')
    .where({ manifest_id: manifest.manifestId })
    .orWhere({ manifest_digest: manifestDigest });
  const existingById = existingRuns.find((run) => run.manifest_id === manifest.manifestId);
  const existingByDigest = existingRuns.find((run) => run.manifest_digest === manifestDigest);

  if (existingById) {
    if (existingById.manifest_digest !== manifestDigest) reject('MANIFEST_ID_CONFLICT');
    return {
      manifestId: existingById.manifest_id,
      manifestDigest: existingById.manifest_digest,
      assignmentCount: Number(existingById.assignment_count),
      replay: true,
    };
  }
  if (existingByDigest) reject('MANIFEST_DIGEST_CONFLICT');

  const tenant = await transaction('control_plane.tenants as tenant')
    .join(
      'control_plane.organizations as organization',
      'organization.organization_id',
      'tenant.organization_id',
    )
    .where('tenant.tenant_id', manifest.tenantId)
    .where('tenant.status', 'active')
    .where('organization.organization_type', 'TENANT')
    .where('organization.status', 'active')
    .select('tenant.organization_id')
    .first<{ organization_id: string }>();
  if (!tenant) reject('TENANT_INVALID');

  const approver = await transaction('control_plane.organization_memberships as membership')
    .join(
      'control_plane.organization_membership_roles as membership_role',
      'membership_role.membership_id',
      'membership.membership_id',
    )
    .join('control_plane.users as user', 'user.user_id', 'membership.user_id')
    .where('membership.organization_id', tenant.organization_id)
    .where('membership.user_id', manifest.approvedByUserId)
    .where('membership.status', 'active')
    .where('membership_role.role_code', 'tenant_admin')
    .where('user.status', 'active')
    .select('membership.membership_id')
    .first();
  if (!approver) reject('APPROVER_UNAUTHORIZED');

  const membershipIds = [...new Set(manifest.assignments.map((item) => item.membershipId))];
  const validMemberships = await transaction('control_plane.organization_memberships as membership')
    .join(
      'control_plane.organization_membership_roles as membership_role',
      'membership_role.membership_id',
      'membership.membership_id',
    )
    .join('control_plane.users as user', 'user.user_id', 'membership.user_id')
    .where('membership.organization_id', tenant.organization_id)
    .where('membership.status', 'active')
    .where('membership_role.role_code', 'content_operator')
    .where('user.status', 'active')
    .whereIn('membership.membership_id', membershipIds)
    .distinct('membership.membership_id');
  if (validMemberships.length !== membershipIds.length) reject('ASSIGNMENT_TARGET_INVALID');

  const projectIds = [...new Set(manifest.assignments.map((item) => item.projectId))];
  const validProjects = await transaction('control_plane.projects')
    .where({ tenant_id: manifest.tenantId })
    .whereIn('project_id', projectIds)
    .select('project_id');
  if (validProjects.length !== projectIds.length) reject('PROJECT_INVALID');

  const backfillRunId = randomUUID();
  await transaction('control_plane.project_assignment_backfill_runs').insert({
    backfill_run_id: backfillRunId,
    manifest_id: manifest.manifestId,
    manifest_digest: manifestDigest,
    manifest_version: manifest.manifestVersion,
    assignment_count: manifest.assignments.length,
    tenant_id: manifest.tenantId,
    organization_id: tenant.organization_id,
    approved_by: manifest.approvedByUserId,
  });
  await transaction('control_plane.project_assignments').insert(
    manifest.assignments.map((assignment) => ({
      project_assignment_id: randomUUID(),
      project_id: assignment.projectId,
      membership_id: assignment.membershipId,
      tenant_id: manifest.tenantId,
      organization_id: tenant.organization_id,
      access_level: assignment.accessLevel,
      status: 'active',
      assignment_source: 'pilot_backfill',
      backfill_run_id: backfillRunId,
      created_by: manifest.approvedByUserId,
    })),
  );

  return {
    manifestId: manifest.manifestId,
    manifestDigest,
    assignmentCount: manifest.assignments.length,
    replay: false,
  };
}

export async function runProjectAssignmentBackfill(
  database: Knex,
  input: unknown,
  options: ProjectAssignmentBackfillOptions = {},
): Promise<ProjectAssignmentBackfillResult> {
  const manifest = parseProjectAssignmentManifest(input);
  const manifestDigest = projectAssignmentManifestDigest(manifest);
  const result = await database.transaction((transaction) =>
    executeBackfill(transaction, manifest, manifestDigest),
  );

  options.logger?.({
    event: result.replay
      ? 'project_assignment_backfill_replayed'
      : 'project_assignment_backfill_completed',
    ...result,
  });
  return result;
}
