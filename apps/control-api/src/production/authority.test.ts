import type { Knex } from 'knex';
import { describe, expect, it } from 'vitest';
import {
  ProductionAuthorityResourceNotFoundError,
  verifyProductionPackageAuthority,
} from './authority.js';

const tenantId = '25000000-0000-4000-8000-000000000001';
const projectId = '25000000-0000-4000-8000-000000000002';
const packageId = '25000000-0000-4000-8000-000000000003';
const scriptVersionId = '25000000-0000-4000-8000-000000000004';
const storyboardVersionId = '25000000-0000-4000-8000-000000000005';
const scriptDigest = `sha256:${'a'.repeat(64)}`;
const storyboardDigest = `sha256:${'b'.repeat(64)}`;
const now = new Date('2026-08-11T06:00:00.000Z');
const expiresAt = new Date('2026-08-11T07:00:00.000Z');

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

function authorityDatabase(overrides: Partial<Tables> = {}): Knex.Transaction {
  const snapshot = {
    objectType: 'ProjectProductionPackage',
    contractVersion: '0.3',
    status: 'ready',
    tenantId,
    projectId,
    packageId,
    scriptVersionId,
    storyboardVersionId,
    approvedScriptDigest: scriptDigest,
    approvedStoryboardDigest: storyboardDigest,
    capabilityRequirements: ['video.generate'],
    idempotencyKey: 'must-not-leave-server',
    approvedScript: { content: 'must-not-leave-server' },
    approvedStoryboard: { shots: ['must-not-leave-server'] },
  };
  const tables: Tables = {
    'control_plane.production_packages': [
      {
        package_id: packageId,
        tenant_id: tenantId,
        project_id: projectId,
        snapshot,
        contract_version: '0.3',
        status: 'ready',
        approved_script_version_id: scriptVersionId,
        approved_storyboard_version_id: storyboardVersionId,
        approved_script_digest: scriptDigest,
        approved_storyboard_digest: storyboardDigest,
        expires_at: expiresAt,
      },
    ],
    'control_plane.script_versions': [
      {
        tenant_id: tenantId,
        script_version_id: scriptVersionId,
        project_id: projectId,
        version: 1,
        status: 'approved',
        payload: { content: 'must-not-leave-server' },
        payload_digest: scriptDigest,
      },
    ],
    'control_plane.script_approvals': [
      {
        tenant_id: tenantId,
        approval_id: '25000000-0000-4000-8000-000000000006',
        project_id: projectId,
        script_version_id: scriptVersionId,
        approval_sequence: '1',
        status: 'approved',
        fact_risk_status: 'cleared',
        reason: 'Approved.',
        acted_by: '25000000-0000-4000-8000-000000000007',
        acted_at: now,
      },
    ],
    'control_plane.storyboard_versions': [
      {
        tenant_id: tenantId,
        storyboard_version_id: storyboardVersionId,
        project_id: projectId,
        script_version_id: scriptVersionId,
        version: 1,
        status: 'approved',
        script_payload_digest: scriptDigest,
        payload: { shots: ['must-not-leave-server'] },
        payload_digest: storyboardDigest,
      },
    ],
    'control_plane.storyboard_approvals': [
      {
        tenant_id: tenantId,
        storyboard_approval_id: '25000000-0000-4000-8000-000000000008',
        project_id: projectId,
        storyboard_version_id: storyboardVersionId,
        approval_sequence: '1',
        status: 'approved',
        fact_risk_status: 'cleared',
        reason: 'Approved.',
        acted_by: '25000000-0000-4000-8000-000000000007',
        acted_at: now,
      },
    ],
    ...overrides,
  };

  return ((tableName: string) => {
    let filters: Row = {};
    const rows = tables[tableName] ?? [];
    const matchingRows = () =>
      rows.filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value));
    const builder = {
      select: () => builder,
      where: (where: Row) => {
        filters = { ...filters, ...where };
        return builder;
      },
      first: async () => matchingRows()[0],
      then: <TResult1 = Row[], TResult2 = never>(
        onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) => Promise.resolve(matchingRows()).then(onfulfilled, onrejected),
    };
    return builder;
  }) as unknown as Knex.Transaction;
}

describe('server-only Production Package authority verifier', () => {
  it('returns only the minimal safe Package/authority binding', async () => {
    const binding = await verifyProductionPackageAuthority(authorityDatabase(), {
      tenantId,
      projectId,
      packageId,
      now,
    });

    expect(binding).toStrictEqual({
      packageId,
      contractVersion: '0.3',
      status: 'ready',
      expiresAt,
      capabilityRequirements: ['video.generate'],
      scriptVersionId,
      storyboardVersionId,
      approvedScriptDigest: scriptDigest,
      approvedStoryboardDigest: storyboardDigest,
    });
    expect(JSON.stringify(binding)).not.toMatch(
      /must-not-leave-server|idempotencyKey|accessToken|tokenDigest|grantId/,
    );
  });

  it('fails closed with the frozen authority-stale contract after Storyboard revocation', async () => {
    const database = authorityDatabase({
      'control_plane.storyboard_versions': [
        {
          tenant_id: tenantId,
          storyboard_version_id: storyboardVersionId,
          project_id: projectId,
          script_version_id: scriptVersionId,
          version: 1,
          status: 'revoked',
          script_payload_digest: scriptDigest,
          payload: {},
          payload_digest: storyboardDigest,
        },
      ],
      'control_plane.storyboard_approvals': [
        {
          tenant_id: tenantId,
          storyboard_approval_id: '25000000-0000-4000-8000-000000000008',
          project_id: projectId,
          storyboard_version_id: storyboardVersionId,
          approval_sequence: '2',
          status: 'revoked',
          fact_risk_status: 'cleared',
          reason: 'Revoked.',
          acted_by: '25000000-0000-4000-8000-000000000007',
          acted_at: now,
        },
      ],
    });

    await expect(
      verifyProductionPackageAuthority(database, { tenantId, projectId, packageId, now }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'PRODUCTION_AUTHORITY_STALE',
      details: {
        reasonCode: 'PRODUCTION_AUTHORITY_STALE',
        authorityReasonCode: 'STORYBOARD_APPROVAL_REVOKED',
      },
    });
  });

  it('uses a dedicated server-side not-found signal without revealing scope facts', async () => {
    const database = authorityDatabase({ 'control_plane.production_packages': [] });

    await expect(
      verifyProductionPackageAuthority(database, { tenantId, projectId, packageId, now }),
    ).rejects.toBeInstanceOf(ProductionAuthorityResourceNotFoundError);
  });
});
