import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { evaluateProductionEligibility } from '../projects/productionEligibility.js';
import type {
  ProductionEligibilityDecision,
  ProductionScriptApprovalAuthority,
  ProductionScriptAuthority,
  ProductionStoryboardApprovalAuthority,
  ProductionStoryboardAuthority,
  SessionActor,
} from '../projects/types.js';
import { contractPayloadDigest, tokenDigest } from './digest.js';
import { ProductionDomainError, ProductionIdempotencyConflictError } from './errors.js';
import { assertGrantRequestAllowed } from './grantPolicy.js';
import { productionIdempotencyDigest } from './idempotency.js';
import { type ProjectGrantClaims, ProjectGrantTokenService } from './grantToken.js';
import type {
  BrandPolicySnapshot,
  CreatePackageInput,
  IdempotencyInput,
  IdempotentResult,
  IssuedProjectGrant,
  IssueGrantInput,
  ProductionCapability,
  ProductionStore,
  ProjectGrant,
  ProjectProductionPackage,
  ProjectProductionPackageV03,
  StoryboardShot,
} from './types.js';

type ProjectRow = {
  project_id: string;
  platform: string;
  aspect_ratio: string;
  target_duration_seconds: number;
};

type BriefRow = {
  brief_id: string;
  payload: unknown;
};

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

type CurrentProductionAuthority = {
  decision: ProductionEligibilityDecision;
  script: ScriptRow | null;
  storyboard: StoryboardRow | null;
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

type GrantRow = {
  grant_id: string;
  tenant_id: string;
  project_id: string;
  package_id: string;
  token_digest?: string;
  capabilities: ProductionCapability[] | string;
  scopes: ProjectGrant['scopes'] | string;
  key_id: string;
  nonce: string;
  status: 'active' | 'revoked' | 'expired';
  revoked_at: Date | string | null;
  issued_at: Date | string;
  expires_at: Date | string;
};

class ResourceNotFoundError extends Error {}

function productionAuthorityStale(authorityReasonCode: string): ProductionDomainError {
  return new ProductionDomainError(
    'Production authority changed before Grant authorization.',
    409,
    'PRODUCTION_AUTHORITY_STALE',
    'authority',
    { reasonCode: 'PRODUCTION_AUTHORITY_STALE', authorityReasonCode },
  );
}

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function jsonValue<T>(value: T | string): T {
  return typeof value === 'string' ? (JSON.parse(value) as T) : value;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw schemaError(`${field} 必须是对象。`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw schemaError(`${field} 必须是非空字符串。`);
  }
  return value;
}

function contractId(value: unknown, field: string): string {
  const result = stringValue(value, field);
  if (result.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(result)) {
    throw schemaError(`${field} 不符合 Pilot Contract ID 格式。`);
  }
  return result;
}

function stringArray(value: unknown, field: string, allowEmpty = true): string[] {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    value.some((item) => typeof item !== 'string' || item.length === 0)
  ) {
    throw schemaError(`${field} 必须是${allowEmpty ? '' : '非空'}字符串数组。`);
  }
  if (new Set(value).size !== value.length) throw schemaError(`${field} 不能包含重复值。`);
  return value as string[];
}

function schemaError(message: string): ProductionDomainError {
  return new ProductionDomainError(message, 422, 'SCHEMA_INVALID', 'schema');
}

function eligibilityError(reasonCode: string): ProductionDomainError {
  return new ProductionDomainError(
    '当前 Script 与 Storyboard 批准事实不具备生产资格。',
    403,
    'CAPABILITY_SCOPE_DENIED',
    'scope',
    { reasonCode },
  );
}

function brandPolicyFromBrief(payload: Record<string, unknown>): BrandPolicySnapshot {
  const policy = record(payload.brandPolicySnapshot, 'brief.payload.brandPolicySnapshot');
  if (!Array.isArray(policy.facts)) throw schemaError('品牌事实必须是数组。');
  const facts = policy.facts.map((value, index) => {
    const fact = record(value, `brandPolicySnapshot.facts[${index}]`);
    if (fact.approved !== true) throw schemaError('生产包只能包含已批准品牌事实。');
    return {
      factId: contractId(fact.factId, `brandPolicySnapshot.facts[${index}].factId`),
      text: stringValue(fact.text, `brandPolicySnapshot.facts[${index}].text`),
      sourceReference: stringValue(
        fact.sourceReference,
        `brandPolicySnapshot.facts[${index}].sourceReference`,
      ),
      approved: true as const,
    };
  });
  const sourceDigest = stringValue(policy.sourceDigest, 'brandPolicySnapshot.sourceDigest');
  if (!/^sha256:[a-f0-9]{64}$/.test(sourceDigest)) {
    throw schemaError('brandPolicySnapshot.sourceDigest 格式无效。');
  }
  return {
    facts,
    prohibitedTerms: stringArray(policy.prohibitedTerms, 'brandPolicySnapshot.prohibitedTerms'),
    requiredDisclosures: stringArray(
      policy.requiredDisclosures,
      'brandPolicySnapshot.requiredDisclosures',
    ),
    sourceDigest,
  };
}

function canonicalAuthorityDigest(value: string, field: string): `sha256:${string}` {
  const match = /^(?:sha256:)?([a-f0-9]{64})$/.exec(value);
  if (!match?.[1]) throw schemaError(`${field} 格式无效。`);
  return `sha256:${match[1]}`;
}

function storyboardFromAuthority(payload: unknown): StoryboardShot[] {
  const authorityPayload = record(payload, 'storyboard.payload');
  if (!Array.isArray(authorityPayload.shots) || authorityPayload.shots.length === 0) {
    throw schemaError('批准分镜必须包含至少一个 Shot。');
  }
  const seen = new Set<string>();
  return authorityPayload.shots.map((value, index) => {
    const shot = record(value, `storyboard.payload.shots[${index}]`);
    const shotId = contractId(shot.shotId, `storyboard.shots[${index}].shotId`);
    if (seen.has(shotId)) throw schemaError('storyboard.shots.shotId 不能重复。');
    seen.add(shotId);
    if (!Number.isInteger(shot.sequence) || (shot.sequence as number) !== index + 1) {
      throw schemaError('storyboard.shots.sequence 必须连续且从 1 开始。');
    }
    if (typeof shot.durationSeconds !== 'number' || shot.durationSeconds <= 0) {
      throw schemaError('storyboard.shots.durationSeconds 必须大于 0。');
    }
    if (!['uploaded', 'generated', 'mixed'].includes(String(shot.sourceMode))) {
      throw schemaError('storyboard.shots.sourceMode 无效。');
    }
    return {
      shotId,
      sequence: shot.sequence as number,
      description: stringValue(shot.description, `storyboard.shots[${index}].description`),
      durationSeconds: shot.durationSeconds,
      sourceMode: shot.sourceMode as StoryboardShot['sourceMode'],
    };
  });
}

function grantClaims(row: GrantRow): ProjectGrantClaims {
  const issuedSeconds = Math.floor(new Date(row.issued_at).getTime() / 1000);
  return {
    iss: 'videoagent-control-plane',
    aud: 'storycanvas-production-plane',
    jti: row.grant_id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    packageId: row.package_id,
    capabilities: jsonValue(row.capabilities),
    scopes: jsonValue(row.scopes),
    contractVersion: '0.2',
    nonce: row.nonce,
    iat: issuedSeconds,
    nbf: issuedSeconds,
    exp: Math.floor(new Date(row.expires_at).getTime() / 1000),
  };
}

export class PostgresProductionStore implements ProductionStore {
  constructor(
    private readonly database: Knex,
    private readonly tokens: ProjectGrantTokenService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createPackage(
    actor: SessionActor,
    projectId: string,
    input: CreatePackageInput,
    idempotency: IdempotencyInput,
  ): Promise<IdempotentResult<ProjectProductionPackageV03> | null> {
    try {
      const canonicalIdempotency: IdempotencyInput = {
        operation: idempotency.operation,
        key: idempotency.key,
        scope: { projectId },
        payload: {
          scriptVersionId: input.scriptVersionId,
          storyboardVersionId: input.storyboardVersionId,
          capabilityRequirements: input.capabilityRequirements,
          expiresInSeconds: input.expiresInSeconds,
        },
      };
      return await this.idempotent(
        actor,
        canonicalIdempotency,
        async (transaction) => {
          const project = (await transaction('control_plane.projects')
            .select('project_id', 'platform', 'aspect_ratio', 'target_duration_seconds')
            .where({ tenant_id: actor.tenantId, project_id: projectId })
            .forUpdate()
            .first()) as ProjectRow | undefined;
          if (!project) throw new ResourceNotFoundError();

          const authority = await this.currentProductionAuthority(transaction, actor, projectId);
          this.assertRequestedAuthority(authority, input, false);
          const script = authority.script;
          const storyboard = authority.storyboard;
          const scriptApproval = authority.decision.scriptApproval;
          const storyboardApproval = authority.decision.storyboardApproval;
          if (!script || !storyboard || !scriptApproval || !storyboardApproval) {
            throw eligibilityError(authority.decision.reasonCode);
          }

          const brief = (await transaction('control_plane.creative_briefs')
            .select('brief_id', 'payload')
            .where({ tenant_id: actor.tenantId, project_id: projectId })
            .orderBy('version', 'desc')
            .first()) as BriefRow | undefined;
          if (!brief) throw schemaError('项目没有可用于发包的 Brief。');
          const briefPayload = record(brief.payload, 'brief.payload');
          const scriptPayload = record(script.payload, 'script.payload');
          if (!/^[1-9][0-9]*:[1-9][0-9]*$/.test(project.aspect_ratio)) {
            throw schemaError('项目画幅比例不符合 Pilot Contract v0.3。');
          }
          const approvedScriptDigest = canonicalAuthorityDigest(
            script.payload_digest,
            'script.payloadDigest',
          );
          const approvedStoryboardDigest = canonicalAuthorityDigest(
            storyboard.payload_digest,
            'storyboard.payloadDigest',
          );
          const boundScriptDigest = canonicalAuthorityDigest(
            storyboard.script_payload_digest,
            'storyboard.scriptPayloadDigest',
          );
          if (boundScriptDigest !== approvedScriptDigest) {
            throw eligibilityError('SCRIPT_STORYBOARD_BINDING_MISMATCH');
          }
          const contentValue = scriptPayload.content ?? scriptPayload.fullText;
          const createdAt = this.now();
          const expiresAt = new Date(createdAt.getTime() + input.expiresInSeconds * 1000);
          const latestPackage = (await transaction('control_plane.production_packages')
            .select('package_version')
            .where({ tenant_id: actor.tenantId, project_id: projectId })
            .orderBy('package_version', 'desc')
            .first()) as { package_version: number } | undefined;

          const unsigned = {
            objectType: 'ProjectProductionPackage' as const,
            contractVersion: '0.3' as const,
            status: 'ready' as const,
            tenantId: actor.tenantId,
            projectId,
            idempotencyKey: idempotency.key,
            occurredAt: createdAt.toISOString(),
            packageId: randomUUID(),
            packageVersion: (latestPackage?.package_version ?? 0) + 1,
            organizationId: actor.tenantId,
            scriptVersionId: script.script_version_id,
            storyboardVersionId: storyboard.storyboard_version_id,
            approvedScriptDigest,
            approvedStoryboardDigest,
            briefSnapshot: {
              briefVersionId: brief.brief_id,
              objective: stringValue(briefPayload.objective, 'brief.payload.objective'),
              audience: stringArray(briefPayload.audience ?? [], 'brief.payload.audience'),
              platforms: stringArray(
                briefPayload.platforms ?? [project.platform],
                'brief.payload.platforms',
                false,
              ),
            },
            brandPolicySnapshot: brandPolicyFromBrief(briefPayload),
            approvedScript: {
              scriptVersionId: script.script_version_id,
              payloadDigest: approvedScriptDigest,
              content: stringValue(contentValue, 'script.payload.content'),
              approvedAt: scriptApproval.actedAt,
              approvedBy: scriptApproval.actedBy,
            },
            approvedStoryboard: {
              storyboardVersionId: storyboard.storyboard_version_id,
              scriptVersionId: storyboard.script_version_id,
              scriptPayloadDigest: boundScriptDigest,
              payloadDigest: approvedStoryboardDigest,
              approvedAt: storyboardApproval.actedAt,
              approvedBy: storyboardApproval.actedBy,
            },
            storyboard: storyboardFromAuthority(storyboard.payload),
            target: {
              aspectRatio: project.aspect_ratio,
              durationSeconds: project.target_duration_seconds,
              container: 'mp4' as const,
              videoCodec: 'h264' as const,
            },
            capabilityRequirements: input.capabilityRequirements,
            createdAt: createdAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
          };
          const value: ProjectProductionPackageV03 = {
            ...unsigned,
            payloadDigest: contractPayloadDigest(unsigned),
          };
          await transaction('control_plane.production_packages').insert({
            package_id: value.packageId,
            tenant_id: actor.tenantId,
            project_id: projectId,
            contract_version: value.contractVersion,
            idempotency_key: idempotency.key,
            package_digest: value.payloadDigest,
            snapshot: JSON.stringify(value),
            status: value.status,
            valid_from: createdAt,
            expires_at: expiresAt,
            package_version: value.packageVersion,
            organization_id: value.organizationId,
            approved_script_version_id: value.scriptVersionId,
            approved_storyboard_version_id: value.storyboardVersionId,
            approved_script_digest: value.approvedScriptDigest,
            approved_storyboard_digest: value.approvedStoryboardDigest,
            created_by: actor.userId,
          });
          return value;
        },
        async (transaction, value) => {
          await this.assertPackageReplayAuthority(transaction, actor, projectId, value);
        },
      );
    } catch (error) {
      if (error instanceof ResourceNotFoundError) return null;
      throw error;
    }
  }

  async getPackage(
    actor: SessionActor,
    projectId: string,
    packageId: string,
  ): Promise<ProjectProductionPackage | null> {
    const row = (await this.database('control_plane.production_packages')
      .select('snapshot')
      .where({ tenant_id: actor.tenantId, project_id: projectId, package_id: packageId })
      .first()) as Pick<PackageRow, 'snapshot'> | undefined;
    return row ? jsonValue(row.snapshot) : null;
  }

  async issueGrant(
    actor: SessionActor,
    projectId: string,
    input: IssueGrantInput,
    idempotency: IdempotencyInput,
  ): Promise<IdempotentResult<IssuedProjectGrant> | null> {
    try {
      const persisted = await this.idempotent(
        actor,
        idempotency,
        async (transaction) => {
          const project = await transaction('control_plane.projects')
            .select('project_id')
            .where({ tenant_id: actor.tenantId, project_id: projectId })
            .forUpdate()
            .first();
          if (!project) throw new ResourceNotFoundError();
          const { row: packageRow, value: packageValue } = await this.assertPackageGrantAuthority(
            transaction,
            actor,
            projectId,
            input.packageId,
          );
          const now = this.now();
          assertGrantRequestAllowed(
            packageValue.capabilityRequirements,
            input.requestedCapabilities,
            input.requestedScopes,
          );

          const issuedAt = now;
          const packageExpiry = new Date(packageRow.expires_at).getTime();
          const expiresAt = new Date(
            Math.min(issuedAt.getTime() + input.ttlSeconds * 1000, packageExpiry),
          );
          if (expiresAt.getTime() <= issuedAt.getTime()) {
            throw new ProductionDomainError('生产包已过期。', 410, 'GRANT_EXPIRED', 'grant');
          }
          const row: GrantRow = {
            grant_id: randomUUID(),
            tenant_id: actor.tenantId,
            project_id: projectId,
            package_id: input.packageId,
            capabilities: input.requestedCapabilities,
            scopes: input.requestedScopes,
            key_id: this.tokens.keyId,
            nonce: randomUUID(),
            status: 'active',
            revoked_at: null,
            issued_at: issuedAt,
            expires_at: expiresAt,
          };
          const accessToken = this.tokens.issue(grantClaims(row));
          const unsigned = {
            objectType: 'ProjectGrant' as const,
            contractVersion: '0.2' as const,
            tenantId: actor.tenantId,
            projectId,
            idempotencyKey: idempotency.key,
            occurredAt: issuedAt.toISOString(),
            grantId: row.grant_id,
            packageId: input.packageId,
            capabilities: input.requestedCapabilities,
            scopes: input.requestedScopes,
            tokenDigest: tokenDigest(accessToken),
            keyId: this.tokens.keyId,
            issuedAt: issuedAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
          };
          const grant: ProjectGrant = {
            ...unsigned,
            payloadDigest: contractPayloadDigest(unsigned),
          };
          await transaction('control_plane.project_grants').insert({
            grant_id: row.grant_id,
            tenant_id: actor.tenantId,
            project_id: projectId,
            package_id: input.packageId,
            token_digest: grant.tokenDigest,
            capabilities: JSON.stringify(grant.capabilities),
            status: 'active',
            issued_at: issuedAt,
            expires_at: expiresAt,
            contract_version: grant.contractVersion,
            idempotency_key: idempotency.key,
            payload_digest: grant.payloadDigest,
            scopes: JSON.stringify(grant.scopes),
            key_id: grant.keyId,
            nonce: row.nonce,
            created_by: actor.userId,
          });
          return grant;
        },
        async (transaction, grant) => {
          if (grant.packageId !== input.packageId) {
            throw productionAuthorityStale('PACKAGE_BINDING_MISMATCH');
          }
          await this.assertPackageGrantAuthority(transaction, actor, projectId, grant.packageId);
          await this.assertGrantActive(transaction, actor, projectId, grant.grantId);
        },
      );

      const grant = persisted.value;
      const row = (await this.database('control_plane.project_grants')
        .select(
          'grant_id',
          'tenant_id',
          'project_id',
          'package_id',
          'capabilities',
          'scopes',
          'key_id',
          'nonce',
          'status',
          'revoked_at',
          'issued_at',
          'expires_at',
        )
        .where({
          tenant_id: actor.tenantId,
          project_id: projectId,
          grant_id: grant.grantId,
        })
        .first()) as GrantRow | undefined;
      if (!row) throw new Error('persisted project grant is missing');
      this.assertGrantRowActive(row);
      if (row.key_id !== this.tokens.keyId) {
        throw new ProductionDomainError(
          'grant signing key is no longer active',
          401,
          'GRANT_INVALID',
          'grant',
        );
      }
      const accessToken = this.tokens.issue(grantClaims(row));
      if (tokenDigest(accessToken) !== grant.tokenDigest) {
        throw new Error('persisted project grant token digest mismatch');
      }
      return {
        value: { grant, tokenType: 'Bearer', accessToken },
        replayed: persisted.replayed,
      };
    } catch (error) {
      if (error instanceof ResourceNotFoundError) return null;
      throw error;
    }
  }

  async verifyActiveGrantToken(token: string): Promise<ProjectGrantClaims> {
    const claims = this.tokens.verify(token);
    const row = (await this.database('control_plane.project_grants')
      .select(
        'grant_id',
        'tenant_id',
        'project_id',
        'package_id',
        'token_digest',
        'capabilities',
        'scopes',
        'key_id',
        'nonce',
        'status',
        'revoked_at',
        'issued_at',
        'expires_at',
      )
      .where({
        grant_id: claims.jti,
        tenant_id: claims.tenantId,
        project_id: claims.projectId,
        package_id: claims.packageId,
        key_id: this.tokens.keyId,
      })
      .first()) as GrantRow | undefined;
    if (!row) throw new ProductionDomainError('grant missing', 401, 'GRANT_INVALID', 'grant');
    this.assertGrantRowActive(row);
    if (
      row.grant_id !== claims.jti ||
      row.token_digest !== tokenDigest(token) ||
      row.nonce !== claims.nonce ||
      JSON.stringify(jsonValue(row.capabilities)) !== JSON.stringify(claims.capabilities) ||
      JSON.stringify(jsonValue(row.scopes)) !== JSON.stringify(claims.scopes)
    ) {
      throw new ProductionDomainError('grant binding mismatch', 401, 'GRANT_INVALID', 'grant');
    }
    await this.database.transaction(async (transaction) => {
      await this.assertPackageGrantAuthority(
        transaction,
        { tenantId: claims.tenantId },
        claims.projectId,
        claims.packageId,
      );
    });
    return claims;
  }

  private async currentProductionAuthority(
    transaction: Knex.Transaction,
    actor: Pick<SessionActor, 'tenantId'>,
    projectId: string,
  ): Promise<CurrentProductionAuthority> {
    const scripts = (await transaction('control_plane.script_versions')
      .select('script_version_id', 'project_id', 'version', 'status', 'payload', 'payload_digest')
      .where({ tenant_id: actor.tenantId, project_id: projectId })) as ScriptRow[];
    const scriptApprovals = (await transaction('control_plane.script_approvals')
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
      .where({ tenant_id: actor.tenantId, project_id: projectId })) as ScriptApprovalRow[];
    const storyboards = (await transaction('control_plane.storyboard_versions')
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
      .where({ tenant_id: actor.tenantId, project_id: projectId })) as StoryboardRow[];
    const storyboardApprovals = (await transaction('control_plane.storyboard_approvals')
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
      .where({ tenant_id: actor.tenantId, project_id: projectId })) as StoryboardApprovalRow[];

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
      projectId,
      scripts: scriptAuthorities,
      scriptApprovals: scriptApprovalAuthorities,
      storyboards: storyboardAuthorities,
      storyboardApprovals: storyboardApprovalAuthorities,
    });
    return {
      decision,
      script: scripts.find((row) => row.script_version_id === decision.scriptVersionId) ?? null,
      storyboard:
        storyboards.find((row) => row.storyboard_version_id === decision.storyboardVersionId) ??
        null,
    };
  }

  private assertRequestedAuthority(
    authority: CurrentProductionAuthority,
    input: Pick<CreatePackageInput, 'scriptVersionId' | 'storyboardVersionId'>,
    replay: boolean,
  ): void {
    const pairMatches =
      authority.decision.eligible &&
      authority.decision.scriptVersionId === input.scriptVersionId &&
      authority.decision.storyboardVersionId === input.storyboardVersionId;
    if (pairMatches) return;

    const authorityReasonCode = authority.decision.eligible
      ? 'SCRIPT_STORYBOARD_BINDING_MISMATCH'
      : authority.decision.reasonCode;
    if (replay) {
      throw new ProductionDomainError(
        'Production authority changed before idempotent replay.',
        409,
        'CAPABILITY_SCOPE_DENIED',
        'scope',
        {
          reasonCode: 'PRODUCTION_AUTHORITY_STALE',
          authorityReasonCode,
        },
      );
    }
    throw eligibilityError(authorityReasonCode);
  }

  private async assertPackageReplayAuthority(
    transaction: Knex.Transaction,
    actor: SessionActor,
    projectId: string,
    value: ProjectProductionPackageV03,
  ): Promise<void> {
    if (
      value.contractVersion !== '0.3' ||
      typeof value.scriptVersionId !== 'string' ||
      typeof value.storyboardVersionId !== 'string'
    ) {
      throw new ProductionDomainError(
        'Production package replay has no dual-authority binding.',
        409,
        'CAPABILITY_SCOPE_DENIED',
        'scope',
        { reasonCode: 'PRODUCTION_AUTHORITY_STALE' },
      );
    }
    const authority = await this.currentProductionAuthority(transaction, actor, projectId);
    this.assertRequestedAuthority(
      authority,
      {
        scriptVersionId: value.scriptVersionId,
        storyboardVersionId: value.storyboardVersionId,
      },
      true,
    );
  }

  private async assertPackageGrantAuthority(
    transaction: Knex.Transaction,
    actor: Pick<SessionActor, 'tenantId'>,
    projectId: string,
    packageId: string,
  ): Promise<{ row: PackageRow; value: ProjectProductionPackageV03 }> {
    const row = (await transaction('control_plane.production_packages')
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
      .where({ tenant_id: actor.tenantId, project_id: projectId, package_id: packageId })
      .first()) as PackageRow | undefined;
    if (!row) throw new ResourceNotFoundError();
    if (this.now().getTime() >= new Date(row.expires_at).getTime()) {
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
      throw productionAuthorityStale('PACKAGE_NOT_GRANT_ELIGIBLE');
    }
    if (
      value.packageId !== row.package_id ||
      value.scriptVersionId !== row.approved_script_version_id ||
      value.storyboardVersionId !== row.approved_storyboard_version_id ||
      value.approvedScriptDigest !== row.approved_script_digest ||
      value.approvedStoryboardDigest !== row.approved_storyboard_digest
    ) {
      throw productionAuthorityStale('PACKAGE_BINDING_MISMATCH');
    }

    const authority = await this.currentProductionAuthority(transaction, actor, projectId);
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
      throw productionAuthorityStale(
        authority.decision.eligible ? 'PACKAGE_BINDING_MISMATCH' : authority.decision.reasonCode,
      );
    }
    return { row, value };
  }

  private async assertGrantActive(
    transaction: Knex.Transaction,
    actor: SessionActor,
    projectId: string,
    grantId: string,
  ): Promise<void> {
    const row = (await transaction('control_plane.project_grants')
      .select('status', 'revoked_at', 'expires_at')
      .where({ tenant_id: actor.tenantId, project_id: projectId, grant_id: grantId })
      .first()) as Pick<GrantRow, 'status' | 'revoked_at' | 'expires_at'> | undefined;
    if (!row) throw new ProductionDomainError('grant missing', 401, 'GRANT_INVALID', 'grant');
    this.assertGrantRowActive(row);
  }

  private assertGrantRowActive(row: Pick<GrantRow, 'status' | 'revoked_at' | 'expires_at'>): void {
    if (row.status !== 'active' || row.revoked_at !== null) {
      throw new ProductionDomainError('grant revoked', 401, 'GRANT_INVALID', 'grant');
    }
    if (this.now().getTime() >= new Date(row.expires_at).getTime()) {
      throw new ProductionDomainError('grant expired', 410, 'GRANT_EXPIRED', 'grant');
    }
  }

  private async idempotent<T>(
    actor: SessionActor,
    input: IdempotencyInput,
    work: (transaction: Knex.Transaction) => Promise<T>,
    replayGuard?: (transaction: Knex.Transaction, value: T) => Promise<void>,
  ): Promise<IdempotentResult<T>> {
    return this.database.transaction(async (transaction) => {
      const digest = productionIdempotencyDigest(actor.tenantId, input);
      const inserted = await transaction('control_plane.idempotency_records')
        .insert({
          idempotency_record_id: randomUUID(),
          tenant_id: actor.tenantId,
          operation: input.operation,
          idempotency_key: input.key,
          request_digest: digest,
          expires_at: new Date(this.now().getTime() + 365 * 24 * 60 * 60 * 1000),
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
          .first<{ request_digest: string; response_body: T | string | null }>();
        if (!existing || existing.request_digest !== digest || existing.response_body === null) {
          throw new ProductionIdempotencyConflictError();
        }
        const value = jsonValue(existing.response_body);
        await replayGuard?.(transaction, value);
        return { value, replayed: true };
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
