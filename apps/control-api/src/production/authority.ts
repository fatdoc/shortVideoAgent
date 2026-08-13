import type { Knex } from 'knex';
import { evaluateProductionEligibility } from '../projects/productionEligibility.js';
import type {
  ProductionEligibilityDecision,
  ProductionScriptApprovalAuthority,
  ProductionScriptAuthority,
  ProductionStoryboardApprovalAuthority,
  ProductionStoryboardAuthority,
} from '../projects/types.js';
import { ProductionDomainError } from './errors.js';
import type {
  ProductionCapability,
  ProjectProductionPackage,
  ProjectProductionPackageV03,
} from './types.js';

type AuthorityDatabase = Knex | Knex.Transaction;

type ScriptRow = {
  script_version_id: string;
  project_id: string;
  version: number;
  status: 'draft' | 'approved' | 'revoked' | 'superseded';
  payload: unknown;
  payload_digest: string;
};

type ScriptApprovalRow = {
  approval_id: string;
  project_id: string;
  script_version_id: string;
  approval_sequence: string | number;
  status: 'approved' | 'revoked' | 'blocked';
  fact_risk_status: 'cleared' | 'unresolved';
  reason: string | null;
  acted_by: string;
  acted_at: Date | string;
};

type StoryboardRow = {
  storyboard_version_id: string;
  project_id: string;
  script_version_id: string;
  version: number;
  status: 'draft' | 'approved' | 'revoked' | 'superseded';
  script_payload_digest: string;
  payload: unknown;
  payload_digest: string;
};

type StoryboardApprovalRow = {
  storyboard_approval_id: string;
  project_id: string;
  storyboard_version_id: string;
  approval_sequence: string | number;
  status: 'approved' | 'revoked' | 'blocked';
  fact_risk_status: 'cleared' | 'unresolved';
  reason: string | null;
  acted_by: string;
  acted_at: Date | string;
};

type PackageRow = {
  package_id: string;
  snapshot: ProjectProductionPackage | string;
  contract_version: '0.2' | '0.3';
  status: 'ready' | 'dispatched' | 'accepted' | 'rejected' | 'expired';
  approved_script_version_id: string;
  approved_storyboard_version_id?: string | null;
  approved_script_digest?: string | null;
  approved_storyboard_digest?: string | null;
  expires_at: Date | string;
};

export type CurrentProductionAuthority = {
  decision: ProductionEligibilityDecision;
  script: ScriptRow | null;
  storyboard: StoryboardRow | null;
};

export type VerifiedProductionPackageAuthority = {
  packageId: string;
  contractVersion: '0.3';
  status: 'ready';
  expiresAt: Date;
  capabilityRequirements: ProductionCapability[];
  scriptVersionId: string;
  storyboardVersionId: string;
  approvedScriptDigest: string;
  approvedStoryboardDigest: string;
};

export type ProductionAuthorityScope = {
  tenantId: string;
  projectId: string;
};

export type ProductionPackageAuthorityInput = ProductionAuthorityScope & {
  packageId: string;
  now: Date;
};

/** Server-only signal translated by repository/HTTP boundaries to a safe 404. */
export class ProductionAuthorityResourceNotFoundError extends Error {}

export function productionAuthorityStaleError(authorityReasonCode: string): ProductionDomainError {
  return new ProductionDomainError(
    'Production authority changed before Grant authorization.',
    409,
    'PRODUCTION_AUTHORITY_STALE',
    'authority',
    { reasonCode: 'PRODUCTION_AUTHORITY_STALE', authorityReasonCode },
  );
}

function schemaError(message: string): ProductionDomainError {
  return new ProductionDomainError(message, 422, 'SCHEMA_INVALID', 'schema');
}

function canonicalAuthorityDigest(value: string, field: string): `sha256:${string}` {
  const match = /^(?:sha256:)?([a-f0-9]{64})$/.exec(value);
  if (!match?.[1]) throw schemaError(`${field} 格式无效。`);
  return `sha256:${match[1]}`;
}

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function jsonValue<T>(value: T | string): T {
  return typeof value === 'string' ? (JSON.parse(value) as T) : value;
}

/**
 * Loads canonical Script + Storyboard authority facts from the server database.
 * This helper deliberately accepts no browser session, token, or Grant object.
 */
export async function loadCurrentProductionAuthority(
  database: AuthorityDatabase,
  scope: ProductionAuthorityScope,
): Promise<CurrentProductionAuthority> {
  const scripts = (await database('control_plane.script_versions')
    .select('script_version_id', 'project_id', 'version', 'status', 'payload', 'payload_digest')
    .where({ tenant_id: scope.tenantId, project_id: scope.projectId })) as ScriptRow[];
  const scriptApprovals = (await database('control_plane.script_approvals')
    .select(
      'approval_id',
      'project_id',
      'script_version_id',
      'approval_sequence',
      'status',
      'fact_risk_status',
      'reason',
      'acted_by',
      'acted_at',
    )
    .where({ tenant_id: scope.tenantId, project_id: scope.projectId })) as ScriptApprovalRow[];
  const storyboards = (await database('control_plane.storyboard_versions')
    .select(
      'storyboard_version_id',
      'project_id',
      'script_version_id',
      'version',
      'status',
      'script_payload_digest',
      'payload',
      'payload_digest',
    )
    .where({ tenant_id: scope.tenantId, project_id: scope.projectId })) as StoryboardRow[];
  const storyboardApprovals = (await database('control_plane.storyboard_approvals')
    .select(
      'storyboard_approval_id',
      'project_id',
      'storyboard_version_id',
      'approval_sequence',
      'status',
      'fact_risk_status',
      'reason',
      'acted_by',
      'acted_at',
    )
    .where({ tenant_id: scope.tenantId, project_id: scope.projectId })) as StoryboardApprovalRow[];

  const scriptAuthorities: ProductionScriptAuthority[] = scripts.map((row) => ({
    id: row.script_version_id,
    projectId: row.project_id,
    version: row.version,
    status: row.status,
    payloadDigest: row.payload_digest,
  }));
  const scriptApprovalAuthorities: ProductionScriptApprovalAuthority[] = scriptApprovals.map(
    (row) => ({
      id: row.approval_id,
      projectId: row.project_id,
      scriptVersionId: row.script_version_id,
      sequence: String(row.approval_sequence),
      status: row.status,
      factRiskStatus: row.fact_risk_status,
      reason: row.reason,
      actedBy: row.acted_by,
      actedAt: iso(row.acted_at),
    }),
  );
  const storyboardAuthorities: ProductionStoryboardAuthority[] = storyboards.map((row) => ({
    id: row.storyboard_version_id,
    projectId: row.project_id,
    scriptVersionId: row.script_version_id,
    version: row.version,
    status: row.status,
    scriptPayloadDigest: row.script_payload_digest,
    payloadDigest: row.payload_digest,
  }));
  const storyboardApprovalAuthorities: ProductionStoryboardApprovalAuthority[] =
    storyboardApprovals.map((row) => ({
      id: row.storyboard_approval_id,
      projectId: row.project_id,
      storyboardVersionId: row.storyboard_version_id,
      sequence: String(row.approval_sequence),
      status: row.status,
      factRiskStatus: row.fact_risk_status,
      reason: row.reason,
      actedBy: row.acted_by,
      actedAt: iso(row.acted_at),
    }));
  const decision = evaluateProductionEligibility({
    projectId: scope.projectId,
    scripts: scriptAuthorities,
    scriptApprovals: scriptApprovalAuthorities,
    storyboards: storyboardAuthorities,
    storyboardApprovals: storyboardApprovalAuthorities,
  });
  return {
    decision,
    script: scripts.find((row) => row.script_version_id === decision.scriptVersionId) ?? null,
    storyboard:
      storyboards.find((row) => row.storyboard_version_id === decision.storyboardVersionId) ?? null,
  };
}

/**
 * Revalidates a ready Package v0.3 against the current dual authority and returns
 * only the minimal server-side binding needed by Grant and Canvas authorization.
 */
export async function verifyProductionPackageAuthority(
  database: AuthorityDatabase,
  input: ProductionPackageAuthorityInput,
): Promise<VerifiedProductionPackageAuthority> {
  const row = (await database('control_plane.production_packages')
    .select(
      'package_id',
      'snapshot',
      'contract_version',
      'status',
      'approved_script_version_id',
      'approved_storyboard_version_id',
      'approved_script_digest',
      'approved_storyboard_digest',
      'expires_at',
    )
    .where({
      tenant_id: input.tenantId,
      project_id: input.projectId,
      package_id: input.packageId,
    })
    .first()) as PackageRow | undefined;
  if (!row) throw new ProductionAuthorityResourceNotFoundError();
  const expiresAt = new Date(row.expires_at);
  if (input.now.getTime() >= expiresAt.getTime()) {
    throw new ProductionDomainError('生产包已过期。', 410, 'GRANT_EXPIRED', 'grant');
  }

  const value = jsonValue(row.snapshot);
  if (
    row.contract_version !== '0.3' ||
    row.status !== 'ready' ||
    value.contractVersion !== '0.3' ||
    value.status !== 'ready' ||
    !row.approved_storyboard_version_id ||
    !row.approved_script_digest ||
    !row.approved_storyboard_digest
  ) {
    throw productionAuthorityStaleError('PACKAGE_NOT_GRANT_ELIGIBLE');
  }
  if (
    value.packageId !== row.package_id ||
    value.scriptVersionId !== row.approved_script_version_id ||
    value.storyboardVersionId !== row.approved_storyboard_version_id ||
    value.approvedScriptDigest !== row.approved_script_digest ||
    value.approvedStoryboardDigest !== row.approved_storyboard_digest
  ) {
    throw productionAuthorityStaleError('PACKAGE_BINDING_MISMATCH');
  }

  const authority = await loadCurrentProductionAuthority(database, input);
  if (
    !authority.decision.eligible ||
    !authority.script ||
    !authority.storyboard ||
    authority.decision.scriptVersionId !== row.approved_script_version_id ||
    authority.decision.storyboardVersionId !== row.approved_storyboard_version_id ||
    canonicalAuthorityDigest(authority.script.payload_digest, 'script.payloadDigest') !==
      row.approved_script_digest ||
    canonicalAuthorityDigest(authority.storyboard.payload_digest, 'storyboard.payloadDigest') !==
      row.approved_storyboard_digest ||
    canonicalAuthorityDigest(
      authority.storyboard.script_payload_digest,
      'storyboard.scriptPayloadDigest',
    ) !== row.approved_script_digest
  ) {
    throw productionAuthorityStaleError(
      authority.decision.eligible ? 'PACKAGE_BINDING_MISMATCH' : authority.decision.reasonCode,
    );
  }

  const packageValue: ProjectProductionPackageV03 = value;
  return {
    packageId: row.package_id,
    contractVersion: '0.3',
    status: 'ready',
    expiresAt,
    capabilityRequirements: packageValue.capabilityRequirements,
    scriptVersionId: row.approved_script_version_id,
    storyboardVersionId: row.approved_storyboard_version_id,
    approvedScriptDigest: row.approved_script_digest,
    approvedStoryboardDigest: row.approved_storyboard_digest,
  };
}
