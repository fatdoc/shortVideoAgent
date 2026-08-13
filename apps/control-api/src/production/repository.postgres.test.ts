import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from '../db/migrations/001_pilot_core.js';
import { up as addContentTenantIntegrity } from '../db/migrations/003_content_tenant_integrity.js';
import { up as addProductionPackageGrant } from '../db/migrations/004_production_package_grant.js';
import { up as hardenProductionSecurity } from '../db/migrations/005_production_security_hardening.js';
import { up as addStoryboardAuthority } from '../db/migrations/020_storyboard_authority.js';
import { up as addProductionStoryboardAuthority } from '../db/migrations/022_production_storyboard_authority.js';
import type { SessionActor } from '../projects/types.js';
import { ProductionAuthorityResourceNotFoundError } from './authority.js';
import { contractPayloadDigest, tokenDigest } from './digest.js';
import { ProductionDomainError, ProductionIdempotencyConflictError } from './errors.js';
import { ProjectGrantTokenService } from './grantToken.js';
import { productionIdempotencyDigest } from './idempotency.js';
import { PostgresProductionStore } from './repository.js';
import type { CreatePackageInput, IdempotencyInput, IssueGrantInput } from './types.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const tenantId = '24000000-0000-4000-8000-000000000001';
const userId = '24000000-0000-4000-8000-000000000002';
const projectId = '24000000-0000-4000-8000-000000000003';
const briefId = '24000000-0000-4000-8000-000000000004';
const scriptVersionId = '24000000-0000-4000-8000-000000000005';
const storyboardVersionId = '24000000-0000-4000-8000-000000000006';
const olderStoryboardVersionId = '24000000-0000-4000-8000-000000000007';
const scriptApprovalId = '24000000-0000-4000-8000-000000000008';
const storyboardApprovalId = '24000000-0000-4000-8000-000000000009';
const olderStoryboardApprovalId = '24000000-0000-4000-8000-000000000010';
const revokeApprovalId = '24000000-0000-4000-8000-000000000011';
const scriptDigest = `sha256:${'a'.repeat(64)}`;
const storyboardDigest = `sha256:${'b'.repeat(64)}`;
const olderStoryboardDigest = `sha256:${'c'.repeat(64)}`;
const fixedNow = new Date('2026-08-11T04:00:00.000Z');
const signingSecret = 'repository-v03-project-grant-secret-at-least-32-chars';

const actor: SessionActor = {
  userId,
  membershipId: '24000000-0000-4000-8000-000000000012',
  organizationId: tenantId,
  organizationType: 'TENANT',
  tenantId,
  membershipVersion: 1,
  primaryRole: 'tenant_admin',
  roles: ['tenant_admin'],
};

function packageInput(storyboardId = storyboardVersionId): CreatePackageInput {
  return {
    scriptVersionId,
    storyboardVersionId: storyboardId,
    capabilityRequirements: ['video.generate'],
    expiresInSeconds: 3_600,
  };
}

function idempotency(key: string): IdempotencyInput {
  return {
    operation: 'production.package.create',
    key,
    scope: { projectId },
    // Deliberately omit storyboardVersionId. The repository must construct the
    // canonical package payload from CreatePackageInput rather than trusting callers.
    payload: {
      scriptVersionId,
      capabilityRequirements: ['video.generate'],
      expiresInSeconds: 3_600,
    },
  };
}

function grantInput(packageId: string): IssueGrantInput {
  return {
    packageId,
    requestedCapabilities: ['video.generate'],
    requestedScopes: ['production.package.read'],
    ttlSeconds: 600,
  };
}

function grantIdempotency(key: string, packageId: string): IdempotencyInput {
  return {
    operation: 'production.grant.issue',
    key,
    scope: { projectId },
    payload: grantInput(packageId),
  };
}

async function revokeStoryboardAuthority(database: Knex): Promise<void> {
  await database('control_plane.storyboard_approvals').insert({
    storyboard_approval_id: revokeApprovalId,
    tenant_id: tenantId,
    project_id: projectId,
    storyboard_version_id: storyboardVersionId,
    status: 'revoked',
    fact_risk_status: 'cleared',
    reason: 'Authority revoked after package creation.',
    idempotency_key: 'storyboard-revoke-grant',
    event_digest: `sha256:${'3'.repeat(64)}`,
    acted_by: userId,
    acted_at: new Date('2026-08-11T04:01:00.000Z'),
  });
  await database('control_plane.storyboard_versions')
    .where({ storyboard_version_id: storyboardVersionId })
    .update({ status: 'revoked' });
}

async function seedFoundation(database: Knex): Promise<void> {
  await database('control_plane.tenants').insert({
    tenant_id: tenantId,
    display_name: 'Production Package v0.3 Tenant',
    status: 'active',
  });
  await database('control_plane.users').insert({
    user_id: userId,
    email: 'package-v03@example.com',
    display_name: 'Package v0.3 User',
    password_hash: 'unused',
    status: 'active',
  });
  await database('control_plane.projects').insert({
    project_id: projectId,
    tenant_id: tenantId,
    name: 'Package v0.3 Project',
    status: 'active',
    platform: 'douyin',
    aspect_ratio: '9:16',
    target_duration_seconds: 30,
    created_by: userId,
  });
  await database('control_plane.creative_briefs').insert({
    brief_id: briefId,
    tenant_id: tenantId,
    project_id: projectId,
    version: 1,
    status: 'approved',
    payload: {
      objective: 'Create a controlled pilot video.',
      audience: ['pilot-reviewers'],
      platforms: ['douyin'],
      brandPolicySnapshot: {
        facts: [],
        prohibitedTerms: [],
        requiredDisclosures: ['TEST only'],
        sourceDigest: `sha256:${'d'.repeat(64)}`,
      },
    },
    payload_digest: `sha256:${'e'.repeat(64)}`,
    created_by: userId,
  });
  await database('control_plane.script_versions').insert({
    script_version_id: scriptVersionId,
    tenant_id: tenantId,
    project_id: projectId,
    version: 1,
    status: 'approved',
    payload: {
      content: 'Approved script authority content.',
      storyboard: [
        {
          shotId: 'legacy-script-fallback',
          sequence: 1,
          description: 'This must never enter a v0.3 package.',
          durationSeconds: 30,
          sourceMode: 'generated',
        },
      ],
    },
    payload_digest: scriptDigest,
    created_by: userId,
  });
  await database('control_plane.script_approvals').insert({
    approval_id: scriptApprovalId,
    tenant_id: tenantId,
    project_id: projectId,
    script_version_id: scriptVersionId,
    status: 'approved',
    fact_risk_status: 'cleared',
    reason: 'Approved for TEST production.',
    acted_by: userId,
    acted_at: new Date('2026-08-11T03:55:00.000Z'),
  });
}

async function seedApprovedStoryboard(
  database: Knex,
  options: { id: string; approvalId: string; version: number; digest: string; description: string },
): Promise<void> {
  await database('control_plane.storyboard_versions').insert({
    storyboard_version_id: options.id,
    tenant_id: tenantId,
    project_id: projectId,
    script_version_id: scriptVersionId,
    version: options.version,
    status: 'draft',
    draft_revision_id:
      options.version === 1
        ? '24000000-0000-4000-8000-000000000013'
        : '24000000-0000-4000-8000-000000000014',
    draft_revision_number: options.version,
    previous_draft_revision_id:
      options.version === 1 ? null : '24000000-0000-4000-8000-000000000013',
    script_payload_digest: scriptDigest,
    payload: {
      shots: [
        {
          shotId:
            options.version === 1
              ? '24000000-0000-4000-8000-000000000015'
              : '24000000-0000-4000-8000-000000000016',
          sequence: 1,
          description: options.description,
          durationSeconds: 30,
          sourceMode: 'mixed',
        },
      ],
    },
    payload_digest: options.digest,
    provenance: {
      objectType: 'StoryboardDraftRevision',
      contractVersion: '0.2',
      status: 'draft',
      tenantId,
      projectId,
      approvedScriptVersionId: scriptVersionId,
      approvedScriptDigest: scriptDigest,
      draftRevisionId:
        options.version === 1
          ? '24000000-0000-4000-8000-000000000013'
          : '24000000-0000-4000-8000-000000000014',
      revisionNumber: options.version,
      previousRevisionId: options.version === 1 ? null : '24000000-0000-4000-8000-000000000013',
      sourceReceipt: {
        providerId: 'storycanvas',
        sourceSystem: 'storycanvas',
        sourceContractVersion: '0.2',
        commandId:
          options.version === 1
            ? '24000000-0000-4000-8000-000000000017'
            : '24000000-0000-4000-8000-000000000018',
        receiptId:
          options.version === 1
            ? '24000000-0000-4000-8000-000000000019'
            : '24000000-0000-4000-8000-000000000020',
        receiptDigest: `sha256:${'f'.repeat(64)}`,
        receivedAt: '2026-08-11T03:50:00.000Z',
      },
      generationPolicy: { policyId: 'pilot.storyboard', policyVersion: '0.2.0' },
      validationSummary: { status: 'passed', issueCodes: [] },
      createdAt: '2026-08-11T03:51:00.000Z',
    },
    created_by: userId,
  });
  await database('control_plane.storyboard_approvals').insert({
    storyboard_approval_id: options.approvalId,
    tenant_id: tenantId,
    project_id: projectId,
    storyboard_version_id: options.id,
    status: 'approved',
    fact_risk_status: 'cleared',
    reason: 'Approved storyboard authority.',
    idempotency_key: `storyboard-approval-${options.version}`,
    event_digest: `sha256:${options.version === 1 ? '1' : '2'}`.padEnd(
      71,
      options.version === 1 ? '1' : '2',
    ),
    acted_by: userId,
    acted_at: new Date(`2026-08-11T03:5${options.version}:00.000Z`),
  });
  await database('control_plane.storyboard_versions')
    .where({ storyboard_version_id: options.id })
    .update({ status: 'approved' });
}

describe.runIf(hasDedicatedTestDatabase)('Production Package v0.3 repository/core', () => {
  let database: Knex;
  let store: PostgresProductionStore;

  beforeAll(async () => {
    database = knex({ client: 'pg', connection: databaseUrl });
    await database.raw('drop schema if exists control_plane cascade');
    await createPilotCore(database);
    await addContentTenantIntegrity(database);
    await addProductionPackageGrant(database);
    await hardenProductionSecurity(database);
    await addStoryboardAuthority(database);
    await addProductionStoryboardAuthority(database);
    store = new PostgresProductionStore(
      database,
      new ProjectGrantTokenService(signingSecret, 'package-v03-test-kid', () => fixedNow),
      () => fixedNow,
    );
  });

  beforeEach(async () => {
    await database.raw(`
      truncate table
        control_plane.project_grants,
        control_plane.production_packages,
        control_plane.storyboard_approvals,
        control_plane.storyboard_versions,
        control_plane.script_approvals,
        control_plane.script_versions,
        control_plane.creative_briefs,
        control_plane.idempotency_records,
        control_plane.projects,
        control_plane.users,
        control_plane.tenants
      restart identity cascade
    `);
    await seedFoundation(database);
  });

  afterAll(async () => {
    await database?.destroy();
  });

  it('rejects creation when the requested storyboard is not the latest approved and cleared binding', async () => {
    await seedApprovedStoryboard(database, {
      id: olderStoryboardVersionId,
      approvalId: olderStoryboardApprovalId,
      version: 1,
      digest: olderStoryboardDigest,
      description: 'Older approved storyboard.',
    });
    await seedApprovedStoryboard(database, {
      id: storyboardVersionId,
      approvalId: storyboardApprovalId,
      version: 2,
      digest: storyboardDigest,
      description: 'Latest approved storyboard.',
    });

    await expect(
      store.createPackage(
        actor,
        projectId,
        packageInput(olderStoryboardVersionId),
        idempotency('stale-pair'),
      ),
    ).rejects.toMatchObject({
      code: 'CAPABILITY_SCOPE_DENIED',
      details: { reasonCode: 'SCRIPT_STORYBOARD_BINDING_MISMATCH' },
    });
    expect(await database('control_plane.production_packages').count('* as count').first()).toEqual(
      {
        count: '0',
      },
    );
  });

  it('creates only a v0.3 package bound to canonical Script and Storyboard authority facts', async () => {
    await seedApprovedStoryboard(database, {
      id: storyboardVersionId,
      approvalId: storyboardApprovalId,
      version: 1,
      digest: storyboardDigest,
      description: 'Authoritative storyboard shot.',
    });

    const created = await store.createPackage(
      actor,
      projectId,
      packageInput(),
      idempotency('create-v03'),
    );

    expect(created).not.toBeNull();
    expect(created?.replayed).toBe(false);
    expect(created?.value).toMatchObject({
      objectType: 'ProjectProductionPackage',
      contractVersion: '0.3',
      status: 'ready',
      tenantId,
      projectId,
      scriptVersionId,
      storyboardVersionId,
      approvedScriptDigest: scriptDigest,
      approvedStoryboardDigest: storyboardDigest,
      approvedScript: {
        scriptVersionId,
        content: 'Approved script authority content.',
      },
      approvedStoryboard: {
        storyboardVersionId,
        scriptVersionId,
        scriptPayloadDigest: scriptDigest,
        payloadDigest: storyboardDigest,
      },
      storyboard: [{ description: 'Authoritative storyboard shot.' }],
    });
    expect(JSON.stringify(created?.value)).not.toContain('legacy-script-fallback');

    const row = await database('control_plane.production_packages')
      .select(
        'contract_version',
        'approved_script_version_id',
        'approved_storyboard_version_id',
        'approved_script_digest',
        'approved_storyboard_digest',
        'snapshot',
      )
      .first();
    expect(row).toMatchObject({
      contract_version: '0.3',
      approved_script_version_id: scriptVersionId,
      approved_storyboard_version_id: storyboardVersionId,
      approved_script_digest: scriptDigest,
      approved_storyboard_digest: storyboardDigest,
    });
    expect(row?.snapshot).toEqual(created?.value);
  });

  it('includes storyboardVersionId in the repository-owned canonical idempotency payload', async () => {
    await seedApprovedStoryboard(database, {
      id: storyboardVersionId,
      approvalId: storyboardApprovalId,
      version: 1,
      digest: storyboardDigest,
      description: 'Authoritative storyboard shot.',
    });
    await store.createPackage(actor, projectId, packageInput(), idempotency('canonical-body'));

    await expect(
      store.createPackage(
        actor,
        projectId,
        packageInput(olderStoryboardVersionId),
        idempotency('canonical-body'),
      ),
    ).rejects.toBeInstanceOf(ProductionIdempotencyConflictError);
  });

  it('revalidates authority before returning an idempotent package replay', async () => {
    await seedApprovedStoryboard(database, {
      id: storyboardVersionId,
      approvalId: storyboardApprovalId,
      version: 1,
      digest: storyboardDigest,
      description: 'Authoritative storyboard shot.',
    });
    await store.createPackage(actor, projectId, packageInput(), idempotency('replay-stale'));
    await database('control_plane.storyboard_approvals').insert({
      storyboard_approval_id: revokeApprovalId,
      tenant_id: tenantId,
      project_id: projectId,
      storyboard_version_id: storyboardVersionId,
      status: 'revoked',
      fact_risk_status: 'cleared',
      reason: 'Authority revoked before replay.',
      idempotency_key: 'storyboard-revoke-1',
      event_digest: `sha256:${'3'.repeat(64)}`,
      acted_by: userId,
      acted_at: new Date('2026-08-11T04:01:00.000Z'),
    });
    await database('control_plane.storyboard_versions')
      .where({ storyboard_version_id: storyboardVersionId })
      .update({ status: 'revoked' });

    await expect(
      store.createPackage(actor, projectId, packageInput(), idempotency('replay-stale')),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ProductionDomainError &&
        error.status === 409 &&
        error.details.reasonCode === 'PRODUCTION_AUTHORITY_STALE' &&
        error.details.authorityReasonCode === 'STORYBOARD_APPROVAL_REVOKED',
    );
  });

  it('keeps historical v0.2 packages readable without creating new v0.2 facts', async () => {
    const legacyPackageId = '24000000-0000-4000-8000-000000000021';
    const legacySnapshot = {
      objectType: 'ProjectProductionPackage',
      contractVersion: '0.2',
      tenantId,
      projectId,
      packageId: legacyPackageId,
      packageVersion: 1,
      payloadDigest: `sha256:${'4'.repeat(64)}`,
      capabilityRequirements: ['video.generate'],
    };
    await database('control_plane.production_packages').insert({
      package_id: legacyPackageId,
      tenant_id: tenantId,
      project_id: projectId,
      contract_version: '0.2',
      idempotency_key: 'legacy-package-read',
      package_digest: legacySnapshot.payloadDigest,
      snapshot: legacySnapshot,
      status: 'ready',
      valid_from: new Date('2026-08-11T03:00:00.000Z'),
      expires_at: new Date('2026-08-11T05:00:00.000Z'),
      package_version: 1,
      organization_id: tenantId,
      approved_script_version_id: scriptVersionId,
      created_by: userId,
    });

    await expect(store.getPackage(actor, projectId, legacyPackageId)).resolves.toEqual(
      legacySnapshot,
    );
  });

  it('rejects Grant issuance after Storyboard authority becomes stale without inserting a Grant', async () => {
    await seedApprovedStoryboard(database, {
      id: storyboardVersionId,
      approvalId: storyboardApprovalId,
      version: 1,
      digest: storyboardDigest,
      description: 'Grant authority storyboard.',
    });
    const created = await store.createPackage(
      actor,
      projectId,
      packageInput(),
      idempotency('grant-authority-package'),
    );
    const packageId = created?.value.packageId as string;
    await revokeStoryboardAuthority(database);

    await expect(
      store.issueGrant(
        actor,
        projectId,
        grantInput(packageId),
        grantIdempotency('grant-authority-stale', packageId),
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: 'PRODUCTION_AUTHORITY_STALE',
    });
    expect(await database('control_plane.project_grants').count('* as count').first()).toEqual({
      count: '0',
    });
  });

  it('rejects Grant issuance when a newer approved Storyboard replaces the Package binding', async () => {
    await seedApprovedStoryboard(database, {
      id: storyboardVersionId,
      approvalId: storyboardApprovalId,
      version: 1,
      digest: storyboardDigest,
      description: 'Original Package-bound storyboard.',
    });
    const created = await store.createPackage(
      actor,
      projectId,
      packageInput(),
      idempotency('grant-replaced-authority-package'),
    );
    const packageId = created?.value.packageId as string;
    await seedApprovedStoryboard(database, {
      id: olderStoryboardVersionId,
      approvalId: olderStoryboardApprovalId,
      version: 2,
      digest: olderStoryboardDigest,
      description: 'New current storyboard authority.',
    });

    await expect(
      store.issueGrant(
        actor,
        projectId,
        grantInput(packageId),
        grantIdempotency('grant-replaced-authority', packageId),
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: 'PRODUCTION_AUTHORITY_STALE',
      details: { authorityReasonCode: 'PACKAGE_BINDING_MISMATCH' },
    });
    expect(await database('control_plane.project_grants').count('* as count').first()).toEqual({
      count: '0',
    });
  });

  it('revalidates dual authority before replaying or introspecting an issued Grant', async () => {
    await seedApprovedStoryboard(database, {
      id: storyboardVersionId,
      approvalId: storyboardApprovalId,
      version: 1,
      digest: storyboardDigest,
      description: 'Grant replay authority storyboard.',
    });
    const created = await store.createPackage(
      actor,
      projectId,
      packageInput(),
      idempotency('grant-replay-package'),
    );
    const packageId = created?.value.packageId as string;
    const issued = await store.issueGrant(
      actor,
      projectId,
      grantInput(packageId),
      grantIdempotency('grant-replay', packageId),
    );
    expect(issued?.replayed).toBe(false);
    await revokeStoryboardAuthority(database);

    await expect(
      store.issueGrant(
        actor,
        projectId,
        grantInput(packageId),
        grantIdempotency('grant-replay', packageId),
      ),
    ).rejects.toMatchObject({ status: 409, code: 'PRODUCTION_AUTHORITY_STALE' });
    await expect(
      store.verifyActiveGrantToken(issued?.value.accessToken as string),
    ).rejects.toMatchObject({ status: 409, code: 'PRODUCTION_AUTHORITY_STALE' });
    expect(await database('control_plane.project_grants').count('* as count').first()).toEqual({
      count: '1',
    });
  });

  it('restores the exact Package v0.3 and canonical active Grant without creating new authority', async () => {
    await seedApprovedStoryboard(database, {
      id: storyboardVersionId,
      approvalId: storyboardApprovalId,
      version: 1,
      digest: storyboardDigest,
      description: 'Restorable Canvas authorization storyboard.',
    });
    const created = await store.createPackage(
      actor,
      projectId,
      packageInput(),
      idempotency('restore-authority-package'),
    );
    const packageId = created?.value.packageId as string;
    const issued = await store.issueGrant(
      actor,
      projectId,
      grantInput(packageId),
      grantIdempotency('restore-authority-grant', packageId),
    );
    const grantId = issued?.value.grant.grantId as string;

    const restored = await database.transaction((transaction) =>
      store.restoreGrantAuthorization(transaction, {
        tenantId,
        projectId,
        packageId,
        grantId,
        now: fixedNow,
      }),
    );

    expect(restored).toEqual({
      productionPackage: created?.value,
      grant: issued?.value.grant,
      tokenType: 'Bearer',
      accessToken: issued?.value.accessToken,
    });
    expect(await database('control_plane.project_grants').count('* as count').first()).toEqual({
      count: '1',
    });

    await expect(
      database.transaction((transaction) =>
        store.restoreGrantAuthorization(transaction, {
          tenantId,
          projectId,
          packageId,
          grantId: '24000000-0000-4000-8000-000000000099',
          now: fixedNow,
        }),
      ),
    ).rejects.toBeInstanceOf(ProductionAuthorityResourceNotFoundError);
  });

  it('revalidates Package dual authority before restoring a persisted Grant', async () => {
    await seedApprovedStoryboard(database, {
      id: storyboardVersionId,
      approvalId: storyboardApprovalId,
      version: 1,
      digest: storyboardDigest,
      description: 'Authority revalidation restoration storyboard.',
    });
    const created = await store.createPackage(
      actor,
      projectId,
      packageInput(),
      idempotency('restore-stale-package'),
    );
    const packageId = created?.value.packageId as string;
    const issued = await store.issueGrant(
      actor,
      projectId,
      grantInput(packageId),
      grantIdempotency('restore-stale-grant', packageId),
    );
    await revokeStoryboardAuthority(database);

    await expect(
      database.transaction((transaction) =>
        store.restoreGrantAuthorization(transaction, {
          tenantId,
          projectId,
          packageId,
          grantId: issued?.value.grant.grantId as string,
          now: fixedNow,
        }),
      ),
    ).rejects.toMatchObject({ status: 409, code: 'PRODUCTION_AUTHORITY_STALE' });
  });

  it('rejects restoration after the exact Grant expires at the caller supplied time', async () => {
    await seedApprovedStoryboard(database, {
      id: storyboardVersionId,
      approvalId: storyboardApprovalId,
      version: 1,
      digest: storyboardDigest,
      description: 'Expired restoration storyboard.',
    });
    const created = await store.createPackage(
      actor,
      projectId,
      packageInput(),
      idempotency('restore-expired-package'),
    );
    const packageId = created?.value.packageId as string;
    const issued = await store.issueGrant(
      actor,
      projectId,
      grantInput(packageId),
      grantIdempotency('restore-expired-grant', packageId),
    );

    await expect(
      database.transaction((transaction) =>
        store.restoreGrantAuthorization(transaction, {
          tenantId,
          projectId,
          packageId,
          grantId: issued?.value.grant.grantId as string,
          now: new Date(fixedNow.getTime() + 600_000),
        }),
      ),
    ).rejects.toMatchObject({ status: 410, code: 'GRANT_EXPIRED' });
  });

  it('rejects restoration when the persisted Grant keyId is no longer active', async () => {
    await seedApprovedStoryboard(database, {
      id: storyboardVersionId,
      approvalId: storyboardApprovalId,
      version: 1,
      digest: storyboardDigest,
      description: 'Retired signing key restoration storyboard.',
    });
    const created = await store.createPackage(
      actor,
      projectId,
      packageInput(),
      idempotency('restore-retired-key-package'),
    );
    const packageId = created?.value.packageId as string;
    const retiredKeyStore = new PostgresProductionStore(
      database,
      new ProjectGrantTokenService(signingSecret, 'retired-package-v03-kid', () => fixedNow),
      () => fixedNow,
    );
    const issued = await retiredKeyStore.issueGrant(
      actor,
      projectId,
      grantInput(packageId),
      grantIdempotency('restore-retired-key-grant', packageId),
    );

    await expect(
      database.transaction((transaction) =>
        store.restoreGrantAuthorization(transaction, {
          tenantId,
          projectId,
          packageId,
          grantId: issued?.value.grant.grantId as string,
          now: fixedNow,
        }),
      ),
    ).rejects.toMatchObject({ status: 401, code: 'GRANT_INVALID' });
  });

  it('rejects restoration when deterministic token re-signing does not match tokenDigest', async () => {
    await seedApprovedStoryboard(database, {
      id: storyboardVersionId,
      approvalId: storyboardApprovalId,
      version: 1,
      digest: storyboardDigest,
      description: 'Token digest mismatch restoration storyboard.',
    });
    const created = await store.createPackage(
      actor,
      projectId,
      packageInput(),
      idempotency('restore-token-digest-package'),
    );
    const packageId = created?.value.packageId as string;
    const foreignSecretStore = new PostgresProductionStore(
      database,
      new ProjectGrantTokenService(
        'foreign-project-grant-secret-at-least-32-characters',
        'package-v03-test-kid',
        () => fixedNow,
      ),
      () => fixedNow,
    );
    const issued = await foreignSecretStore.issueGrant(
      actor,
      projectId,
      grantInput(packageId),
      grantIdempotency('restore-token-digest-grant', packageId),
    );

    await expect(
      database.transaction((transaction) =>
        store.restoreGrantAuthorization(transaction, {
          tenantId,
          projectId,
          packageId,
          grantId: issued?.value.grant.grantId as string,
          now: fixedNow,
        }),
      ),
    ).rejects.toMatchObject({ status: 401, code: 'GRANT_INVALID' });
  });

  it('rejects Grant issuance when a v0.3 Package is no longer ready', async () => {
    await seedApprovedStoryboard(database, {
      id: storyboardVersionId,
      approvalId: storyboardApprovalId,
      version: 1,
      digest: storyboardDigest,
      description: 'Non-ready Grant package storyboard.',
    });
    const created = await store.createPackage(
      actor,
      projectId,
      packageInput(),
      idempotency('non-ready-grant-package'),
    );
    const packageId = created?.value.packageId as string;
    await database('control_plane.production_packages')
      .where({ package_id: packageId })
      .update({ status: 'dispatched' });

    await expect(
      store.issueGrant(
        actor,
        projectId,
        grantInput(packageId),
        grantIdempotency('non-ready-grant', packageId),
      ),
    ).rejects.toMatchObject({ status: 409, code: 'PRODUCTION_AUTHORITY_STALE' });
    expect(await database('control_plane.project_grants').count('* as count').first()).toEqual({
      count: '0',
    });
  });

  it('never issues or introspects a Grant bound to a historical v0.2 Package', async () => {
    const legacyPackageId = '24000000-0000-4000-8000-000000000021';
    const legacyGrantId = '24000000-0000-4000-8000-000000000022';
    const legacyNonce = '24000000-0000-4000-8000-000000000023';
    const legacySnapshot = {
      objectType: 'ProjectProductionPackage',
      contractVersion: '0.2',
      tenantId,
      projectId,
      packageId: legacyPackageId,
      packageVersion: 1,
      payloadDigest: `sha256:${'4'.repeat(64)}`,
      capabilityRequirements: ['video.generate'],
    };
    await database('control_plane.production_packages').insert({
      package_id: legacyPackageId,
      tenant_id: tenantId,
      project_id: projectId,
      contract_version: '0.2',
      idempotency_key: 'legacy-package-grant',
      package_digest: legacySnapshot.payloadDigest,
      snapshot: legacySnapshot,
      status: 'ready',
      valid_from: new Date('2026-08-11T03:00:00.000Z'),
      expires_at: new Date('2026-08-11T05:00:00.000Z'),
      package_version: 1,
      organization_id: tenantId,
      approved_script_version_id: scriptVersionId,
      created_by: userId,
    });

    await expect(
      store.issueGrant(
        actor,
        projectId,
        grantInput(legacyPackageId),
        grantIdempotency('legacy-package-grant-issue', legacyPackageId),
      ),
    ).rejects.toMatchObject({ status: 409, code: 'PRODUCTION_AUTHORITY_STALE' });

    const legacyClaims = {
      iss: 'videoagent-control-plane' as const,
      aud: 'storycanvas-production-plane' as const,
      jti: legacyGrantId,
      tenantId,
      projectId,
      packageId: legacyPackageId,
      capabilities: ['video.generate'] as const,
      scopes: ['production.package.read'] as const,
      contractVersion: '0.2' as const,
      nonce: legacyNonce,
      iat: Math.floor(fixedNow.getTime() / 1000),
      nbf: Math.floor(fixedNow.getTime() / 1000),
      exp: Math.floor(fixedNow.getTime() / 1000) + 600,
    };
    const legacyToken = new ProjectGrantTokenService(
      signingSecret,
      'package-v03-test-kid',
      () => fixedNow,
    ).issue(legacyClaims);
    const legacyGrantUnsigned = {
      objectType: 'ProjectGrant' as const,
      contractVersion: '0.2' as const,
      tenantId,
      projectId,
      idempotencyKey: 'legacy-grant-replay',
      occurredAt: fixedNow.toISOString(),
      grantId: legacyGrantId,
      packageId: legacyPackageId,
      capabilities: ['video.generate'] as const,
      scopes: ['production.package.read'] as const,
      tokenDigest: tokenDigest(legacyToken),
      keyId: 'package-v03-test-kid',
      issuedAt: fixedNow.toISOString(),
      expiresAt: new Date(fixedNow.getTime() + 600_000).toISOString(),
    };
    const legacyGrant = {
      ...legacyGrantUnsigned,
      payloadDigest: contractPayloadDigest(legacyGrantUnsigned),
    };
    await database('control_plane.project_grants').insert({
      grant_id: legacyGrantId,
      tenant_id: tenantId,
      project_id: projectId,
      package_id: legacyPackageId,
      token_digest: legacyGrant.tokenDigest,
      capabilities: JSON.stringify(legacyClaims.capabilities),
      status: 'active',
      issued_at: fixedNow,
      expires_at: new Date(fixedNow.getTime() + 600_000),
      contract_version: '0.2',
      idempotency_key: legacyGrant.idempotencyKey,
      payload_digest: legacyGrant.payloadDigest,
      scopes: JSON.stringify(legacyClaims.scopes),
      key_id: 'package-v03-test-kid',
      nonce: legacyNonce,
      created_by: userId,
    });
    const replayInput = grantIdempotency(legacyGrant.idempotencyKey, legacyPackageId);
    await database('control_plane.idempotency_records').insert({
      idempotency_record_id: '24000000-0000-4000-8000-000000000024',
      tenant_id: tenantId,
      operation: replayInput.operation,
      idempotency_key: replayInput.key,
      request_digest: productionIdempotencyDigest(tenantId, replayInput),
      response_status: 200,
      response_body: legacyGrant,
      expires_at: new Date('2027-08-11T04:00:00.000Z'),
    });

    await expect(
      store.issueGrant(actor, projectId, grantInput(legacyPackageId), replayInput),
    ).rejects.toMatchObject({ status: 409, code: 'PRODUCTION_AUTHORITY_STALE' });

    await expect(store.verifyActiveGrantToken(legacyToken)).rejects.toMatchObject({
      status: 409,
      code: 'PRODUCTION_AUTHORITY_STALE',
    });
  });
});
