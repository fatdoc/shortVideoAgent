import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import type { SessionActor } from '../projects/types.js';
import { contractPayloadDigest, tokenDigest } from './digest.js';
import { ProductionDomainError, ProductionIdempotencyConflictError } from './errors.js';
import { assertGrantRequestAllowed } from './grantPolicy.js';
import { productionIdempotencyDigest } from './idempotency.js';
import {
  type ProjectGrantClaims,
  ProjectGrantTokenService,
} from './grantToken.js';
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
  payload: unknown;
};

type ApprovalRow = {
  status: 'approved' | 'revoked' | 'blocked';
  fact_risk_status: 'cleared' | 'unresolved';
  acted_by: string;
  acted_at: Date | string;
};

type PackageRow = {
  package_id: string;
  snapshot: ProjectProductionPackage | string;
  approved_script_version_id: string;
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
    '当前批准脚本不具备生产资格。',
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

function storyboardFromScript(payload: Record<string, unknown>): StoryboardShot[] {
  if (!Array.isArray(payload.storyboard) || payload.storyboard.length === 0) {
    throw schemaError('批准脚本必须包含至少一个分镜。');
  }
  const seen = new Set<string>();
  return payload.storyboard.map((value, index) => {
    const shot = record(value, `script.payload.storyboard[${index}]`);
    const shotId = contractId(shot.shotId, `storyboard[${index}].shotId`);
    if (seen.has(shotId)) throw schemaError('storyboard.shotId 不能重复。');
    seen.add(shotId);
    if (!Number.isInteger(shot.sequence) || (shot.sequence as number) < 1) {
      throw schemaError('storyboard.sequence 必须是正整数。');
    }
    if (typeof shot.durationSeconds !== 'number' || shot.durationSeconds <= 0) {
      throw schemaError('storyboard.durationSeconds 必须大于 0。');
    }
    if (!['uploaded', 'generated', 'mixed'].includes(String(shot.sourceMode))) {
      throw schemaError('storyboard.sourceMode 无效。');
    }
    return {
      shotId,
      sequence: shot.sequence as number,
      description: stringValue(shot.description, `storyboard[${index}].description`),
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
  ): Promise<IdempotentResult<ProjectProductionPackage> | null> {
    try {
      return await this.idempotent(actor, idempotency, async (transaction) => {
        const project = (await transaction('control_plane.projects')
          .select('project_id', 'platform', 'aspect_ratio', 'target_duration_seconds')
          .where({ tenant_id: actor.tenantId, project_id: projectId })
          .forUpdate()
          .first()) as ProjectRow | undefined;
        if (!project) throw new ResourceNotFoundError();

        const script = (await transaction('control_plane.script_versions')
          .select('script_version_id', 'payload')
          .where({ tenant_id: actor.tenantId, project_id: projectId })
          .orderBy('version', 'desc')
          .first()) as ScriptRow | undefined;
        if (!script) throw eligibilityError('NO_SCRIPT_VERSION');
        if (script.script_version_id !== input.scriptVersionId) {
          throw eligibilityError('SCRIPT_NOT_APPROVED');
        }
        const approval = (await transaction('control_plane.script_approvals')
          .select('status', 'fact_risk_status', 'acted_by', 'acted_at')
          .where({
            tenant_id: actor.tenantId,
            project_id: projectId,
            script_version_id: input.scriptVersionId,
          })
          .orderBy('approval_sequence', 'desc')
          .first()) as ApprovalRow | undefined;
        if (!approval) throw eligibilityError('SCRIPT_NOT_APPROVED');
        if (approval.fact_risk_status !== 'cleared') {
          throw eligibilityError('FACT_RISK_UNRESOLVED');
        }
        if (approval.status === 'revoked') throw eligibilityError('APPROVAL_REVOKED');
        if (approval.status === 'blocked') throw eligibilityError('SCRIPT_BLOCKED');
        if (approval.status !== 'approved') throw eligibilityError('SCRIPT_NOT_APPROVED');

        const brief = (await transaction('control_plane.creative_briefs')
          .select('brief_id', 'payload')
          .where({ tenant_id: actor.tenantId, project_id: projectId })
          .orderBy('version', 'desc')
          .first()) as BriefRow | undefined;
        if (!brief) throw schemaError('项目没有可用于发包的 Brief。');
        const briefPayload = record(brief.payload, 'brief.payload');
        const scriptPayload = record(script.payload, 'script.payload');
        if (!/^[1-9][0-9]*:[1-9][0-9]*$/.test(project.aspect_ratio)) {
          throw schemaError('项目画幅比例不符合 Pilot Contract v0.2。');
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
          contractVersion: '0.2' as const,
          tenantId: actor.tenantId,
          projectId,
          idempotencyKey: idempotency.key,
          occurredAt: createdAt.toISOString(),
          packageId: randomUUID(),
          packageVersion: (latestPackage?.package_version ?? 0) + 1,
          organizationId: actor.tenantId,
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
            content: stringValue(contentValue, 'script.payload.content'),
            approvedAt: iso(approval.acted_at),
            approvedBy: approval.acted_by,
          },
          storyboard: storyboardFromScript(scriptPayload),
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
        const value: ProjectProductionPackage = {
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
          status: 'ready',
          valid_from: createdAt,
          expires_at: expiresAt,
          package_version: value.packageVersion,
          organization_id: value.organizationId,
          approved_script_version_id: value.approvedScript.scriptVersionId,
          created_by: actor.userId,
        });
        return value;
      }, async (transaction, value) => {
        await this.assertCurrentlyEligible(
          transaction,
          actor,
          projectId,
          value.approvedScript.scriptVersionId,
        );
      });
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
      const persisted = await this.idempotent(actor, idempotency, async (transaction) => {
        const project = await transaction('control_plane.projects')
          .select('project_id')
          .where({ tenant_id: actor.tenantId, project_id: projectId })
          .forUpdate()
          .first();
        if (!project) throw new ResourceNotFoundError();
        const packageRow = (await transaction('control_plane.production_packages')
          .select('package_id', 'snapshot', 'approved_script_version_id', 'expires_at')
          .where({
            tenant_id: actor.tenantId,
            project_id: projectId,
            package_id: input.packageId,
          })
          .first()) as PackageRow | undefined;
        if (!packageRow) throw new ResourceNotFoundError();
        const packageValue = jsonValue(packageRow.snapshot);
        const now = this.now();
        if (now.getTime() >= new Date(packageRow.expires_at).getTime()) {
          throw new ProductionDomainError('生产包已过期。', 410, 'GRANT_EXPIRED', 'grant');
        }
        await this.assertCurrentlyEligible(
          transaction,
          actor,
          projectId,
          packageRow.approved_script_version_id,
        );
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
        const grant: ProjectGrant = { ...unsigned, payloadDigest: contractPayloadDigest(unsigned) };
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
      }, async (transaction, grant) => {
        await this.assertCurrentlyEligible(
          transaction,
          actor,
          projectId,
          grant.packageId === input.packageId
            ? await this.packageScriptVersion(transaction, actor, projectId, grant.packageId)
            : '',
        );
        await this.assertGrantActive(transaction, actor, projectId, grant.grantId);
      });

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
        throw new ProductionDomainError('grant signing key is no longer active', 401, 'GRANT_INVALID', 'grant');
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
      row.token_digest !== tokenDigest(token) ||
      row.nonce !== claims.nonce ||
      JSON.stringify(jsonValue(row.capabilities)) !== JSON.stringify(claims.capabilities) ||
      JSON.stringify(jsonValue(row.scopes)) !== JSON.stringify(claims.scopes)
    ) {
      throw new ProductionDomainError('grant binding mismatch', 401, 'GRANT_INVALID', 'grant');
    }
    return claims;
  }

  private async assertCurrentlyEligible(
    transaction: Knex.Transaction,
    actor: SessionActor,
    projectId: string,
    scriptVersionId: string,
  ): Promise<void> {
    const latestScript = await transaction('control_plane.script_versions')
      .select('script_version_id')
      .where({ tenant_id: actor.tenantId, project_id: projectId })
      .orderBy('version', 'desc')
      .first<{ script_version_id: string }>();
    if (!latestScript || latestScript.script_version_id !== scriptVersionId) {
      throw eligibilityError('SCRIPT_NOT_APPROVED');
    }
    const approval = (await transaction('control_plane.script_approvals')
      .select('status', 'fact_risk_status', 'acted_by', 'acted_at')
      .where({
        tenant_id: actor.tenantId,
        project_id: projectId,
        script_version_id: scriptVersionId,
      })
      .orderBy('approval_sequence', 'desc')
      .first()) as ApprovalRow | undefined;
    if (!approval) throw eligibilityError('SCRIPT_NOT_APPROVED');
    if (approval.fact_risk_status !== 'cleared') throw eligibilityError('FACT_RISK_UNRESOLVED');
    if (approval.status === 'revoked') throw eligibilityError('APPROVAL_REVOKED');
    if (approval.status === 'blocked') throw eligibilityError('SCRIPT_BLOCKED');
    if (approval.status !== 'approved') throw eligibilityError('SCRIPT_NOT_APPROVED');
  }

  private async packageScriptVersion(
    transaction: Knex.Transaction,
    actor: SessionActor,
    projectId: string,
    packageId: string,
  ): Promise<string> {
    const row = await transaction('control_plane.production_packages')
      .select('approved_script_version_id')
      .where({ tenant_id: actor.tenantId, project_id: projectId, package_id: packageId })
      .first<{ approved_script_version_id: string }>();
    if (!row) throw new ResourceNotFoundError();
    return row.approved_script_version_id;
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

  private assertGrantRowActive(
    row: Pick<GrantRow, 'status' | 'revoked_at' | 'expires_at'>,
  ): void {
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
