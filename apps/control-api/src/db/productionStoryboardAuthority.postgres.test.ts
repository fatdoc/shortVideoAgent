import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from './migrations/001_pilot_core.js';
import { up as addContentTenantIntegrity } from './migrations/003_content_tenant_integrity.js';
import { up as addProductionPackageGrant } from './migrations/004_production_package_grant.js';
import { up as hardenProductionSecurity } from './migrations/005_production_security_hardening.js';
import { up as addStoryboardAuthority } from './migrations/020_storyboard_authority.js';
import {
  down as removeProductionStoryboardAuthority,
  up as addProductionStoryboardAuthority,
} from './migrations/022_production_storyboard_authority.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const tenantId = '22000000-0000-4000-8000-000000000001';
const otherTenantId = '22000000-0000-4000-8000-000000000002';
const userId = '22000000-0000-4000-8000-000000000003';
const projectId = '22000000-0000-4000-8000-000000000004';
const otherProjectId = '22000000-0000-4000-8000-000000000005';
const scriptVersionId = '22000000-0000-4000-8000-000000000006';
const otherScriptVersionId = '22000000-0000-4000-8000-000000000007';
const storyboardVersionId = '22000000-0000-4000-8000-000000000008';
const otherStoryboardVersionId = '22000000-0000-4000-8000-000000000009';
const packageId = '22000000-0000-4000-8000-000000000010';
const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;
const digestC = `sha256:${'c'.repeat(64)}`;
const digestD = `sha256:${'d'.repeat(64)}`;

async function resetFoundation(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);
  await addContentTenantIntegrity(database);
  await addProductionPackageGrant(database);
  await hardenProductionSecurity(database);
  await addStoryboardAuthority(database);

  await database('control_plane.tenants').insert([
    { tenant_id: tenantId, display_name: 'Production Authority Tenant', status: 'active' },
    { tenant_id: otherTenantId, display_name: 'Other Tenant', status: 'active' },
  ]);
  await database('control_plane.users').insert({
    user_id: userId,
    email: 'production-authority@example.com',
    display_name: 'Production Authority',
    password_hash: 'unused',
    status: 'active',
  });
  await database('control_plane.projects').insert([
    {
      project_id: projectId,
      tenant_id: tenantId,
      name: 'Production Project',
      status: 'active',
      platform: 'douyin',
      aspect_ratio: '9:16',
      target_duration_seconds: 30,
      created_by: userId,
    },
    {
      project_id: otherProjectId,
      tenant_id: tenantId,
      name: 'Other Project',
      status: 'active',
      platform: 'douyin',
      aspect_ratio: '9:16',
      target_duration_seconds: 30,
      created_by: userId,
    },
  ]);
  await database('control_plane.script_versions').insert([
    {
      script_version_id: scriptVersionId,
      tenant_id: tenantId,
      project_id: projectId,
      version: 1,
      status: 'approved',
      payload: { title: 'Approved Script' },
      payload_digest: digestA,
      created_by: userId,
    },
    {
      script_version_id: otherScriptVersionId,
      tenant_id: tenantId,
      project_id: otherProjectId,
      version: 1,
      status: 'approved',
      payload: { title: 'Other Script' },
      payload_digest: digestB,
      created_by: userId,
    },
  ]);
  await database('control_plane.storyboard_versions').insert([
    storyboardRow(),
    storyboardRow({
      storyboard_version_id: otherStoryboardVersionId,
      project_id: otherProjectId,
      script_version_id: otherScriptVersionId,
      draft_revision_id: 'storyboard-other-001',
      script_payload_digest: digestB,
      payload_digest: digestC,
    }),
  ]);
}

function storyboardRow(overrides: Record<string, unknown> = {}) {
  return {
    storyboard_version_id: storyboardVersionId,
    tenant_id: tenantId,
    project_id: projectId,
    script_version_id: scriptVersionId,
    version: 1,
    status: 'draft',
    draft_revision_id: 'storyboard-authority-001',
    draft_revision_number: 1,
    previous_draft_revision_id: null,
    script_payload_digest: digestA,
    payload: { shots: [{ shotId: 'shot-001', sequence: 1 }] },
    payload_digest: digestB,
    provenance: {
      sourceReceipt: {
        receiptId: 'receipt-001',
        receiptDigest: digestA,
        receivedAt: '2026-08-11T00:00:00.000Z',
      },
    },
    created_by: userId,
    ...overrides,
  };
}

function packageRow(overrides: Record<string, unknown> = {}) {
  const { snapshot: rawSnapshotOverrides, ...columnOverrides } = overrides;
  const resolvedPackageId = (columnOverrides.package_id as string | undefined) ?? packageId;
  const resolvedPackageVersion = (columnOverrides.package_version as number | undefined) ?? 1;
  const resolvedPackageDigest = (columnOverrides.package_digest as string | undefined) ?? digestC;
  const snapshotOverrides = (rawSnapshotOverrides as Record<string, unknown> | undefined) ?? {};
  const row = {
    package_id: resolvedPackageId,
    tenant_id: tenantId,
    project_id: projectId,
    contract_version: '0.3',
    idempotency_key: 'production-package-v03',
    package_digest: resolvedPackageDigest,
    snapshot: {
      objectType: 'ProjectProductionPackage',
      contractVersion: '0.3',
      tenantId,
      projectId,
      packageId: resolvedPackageId,
      packageVersion: resolvedPackageVersion,
      scriptVersionId,
      storyboardVersionId,
      payloadDigest: resolvedPackageDigest,
      approvedScriptDigest: digestA,
      approvedStoryboardDigest: digestB,
      ...snapshotOverrides,
    },
    status: 'ready',
    valid_from: '2026-08-11T01:00:00.000Z',
    expires_at: '2026-08-11T02:00:00.000Z',
    package_version: resolvedPackageVersion,
    organization_id: tenantId,
    approved_script_version_id: scriptVersionId,
    approved_storyboard_version_id: storyboardVersionId,
    approved_script_digest: digestA,
    approved_storyboard_digest: digestB,
    created_by: userId,
    ...columnOverrides,
  };
  return row;
}

function legacyPackageRow() {
  return {
    package_id: packageId,
    tenant_id: tenantId,
    project_id: projectId,
    contract_version: '0.2',
    idempotency_key: 'production-package-v02',
    package_digest: digestC,
    snapshot: {
      objectType: 'ProjectProductionPackage',
      contractVersion: '0.2',
      tenantId,
      projectId,
      packageId,
      payloadDigest: digestC,
      approvedScript: { scriptVersionId },
    },
    status: 'ready',
    valid_from: '2026-08-11T01:00:00.000Z',
    expires_at: '2026-08-11T02:00:00.000Z',
    package_version: 1,
    organization_id: tenantId,
    approved_script_version_id: scriptVersionId,
    created_by: userId,
  };
}

describe.runIf(hasDedicatedTestDatabase)('production storyboard authority migration', () => {
  let database: Knex;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await resetFoundation(database);
    await addProductionStoryboardAuthority(database);
  });

  afterAll(async () => {
    await database?.raw('drop schema if exists control_plane cascade');
    await database?.destroy();
  });

  it('rejects a v0.3 package without the exact storyboard project and tenant authority binding', async () => {
    const foreignKey = await database.raw<{ rows: Array<{ definition: string }> }>(
      `select pg_get_constraintdef(oid) as definition
       from pg_constraint
       where conname = 'production_packages_storyboard_project_tenant_fk'`,
    );
    expect(foreignKey.rows[0]?.definition).toBe(
      'FOREIGN KEY (approved_storyboard_version_id, project_id, tenant_id) REFERENCES control_plane.storyboard_versions(storyboard_version_id, project_id, tenant_id)',
    );

    await expect(
      database('control_plane.production_packages').insert(
        packageRow({
          approved_storyboard_version_id: otherStoryboardVersionId,
          snapshot: { storyboardVersionId: otherStoryboardVersionId },
        }),
      ),
    ).rejects.toThrow(/foreign key|constraint/i);
  });

  it('preserves historical v0.2 packages and accepts a complete v0.3 authority binding', async () => {
    await database('control_plane.production_packages').insert(legacyPackageRow());
    await expect(
      database('control_plane.production_packages')
        .select(
          'contract_version',
          'approved_storyboard_version_id',
          'approved_script_digest',
          'approved_storyboard_digest',
        )
        .where({ package_id: packageId })
        .first(),
    ).resolves.toEqual({
      contract_version: '0.2',
      approved_storyboard_version_id: null,
      approved_script_digest: null,
      approved_storyboard_digest: null,
    });

    const v03PackageId = '22000000-0000-4000-8000-000000000011';
    await database('control_plane.production_packages').insert(
      packageRow({
        package_id: v03PackageId,
        idempotency_key: 'production-package-v03-second',
        package_digest: digestD,
        package_version: 2,
      }),
    );
    await expect(
      database('control_plane.production_packages')
        .select('approved_storyboard_version_id')
        .where({ package_id: v03PackageId })
        .first(),
    ).resolves.toEqual({ approved_storyboard_version_id: storyboardVersionId });
  });

  it('requires complete sha256 authority facts only for v0.3 packages', async () => {
    await expect(
      database('control_plane.production_packages').insert(
        packageRow({ approved_storyboard_digest: null }),
      ),
    ).rejects.toThrow(/constraint/i);
    await expect(
      database('control_plane.production_packages').insert(
        packageRow({ approved_script_digest: 'not-a-digest' }),
      ),
    ).rejects.toThrow(/constraint/i);
    await expect(
      database('control_plane.production_packages').insert({
        ...legacyPackageRow(),
        approved_storyboard_version_id: storyboardVersionId,
        approved_script_digest: digestA,
        approved_storyboard_digest: digestB,
      }),
    ).rejects.toThrow(/constraint/i);
  });

  it('binds every v0.3 snapshot field to the structured package authority columns', async () => {
    const mismatches = [
      ['packageVersion', 2, '22000000-0000-4000-8000-000000000012'],
      ['scriptVersionId', otherScriptVersionId, '22000000-0000-4000-8000-000000000013'],
      ['storyboardVersionId', otherStoryboardVersionId, '22000000-0000-4000-8000-000000000014'],
      ['approvedScriptDigest', digestB, '22000000-0000-4000-8000-000000000015'],
      ['approvedStoryboardDigest', digestC, '22000000-0000-4000-8000-000000000016'],
    ] as const;
    for (const [key, value, mismatchPackageId] of mismatches) {
      await expect(
        database('control_plane.production_packages').insert(
          packageRow({
            package_id: mismatchPackageId,
            idempotency_key: `mismatch-${key}`,
            snapshot: { [key]: value },
          }),
        ),
      ).rejects.toThrow(/constraint/i);
    }
  });

  it('keeps the new storyboard and digest authority binding immutable', async () => {
    await database('control_plane.production_packages').insert(packageRow());
    await expect(
      database('control_plane.production_packages')
        .where({ package_id: packageId })
        .update({ approved_storyboard_digest: digestC }),
    ).rejects.toThrow(/immutable/i);
    await expect(
      database('control_plane.production_packages')
        .where({ package_id: packageId })
        .update({ approved_storyboard_version_id: otherStoryboardVersionId }),
    ).rejects.toThrow(/immutable/i);
  });

  it('allows a historical v0.2 rollback and fails closed after v0.3 authority facts exist', async () => {
    await database('control_plane.production_packages').insert(legacyPackageRow());
    await removeProductionStoryboardAuthority(database);
    const columnsAfterRollback = await database('information_schema.columns')
      .select('column_name')
      .where({ table_schema: 'control_plane', table_name: 'production_packages' });
    expect(columnsAfterRollback.map(({ column_name }) => column_name)).not.toEqual(
      expect.arrayContaining([
        'approved_storyboard_version_id',
        'approved_script_digest',
        'approved_storyboard_digest',
      ]),
    );

    await expect(
      database('control_plane.production_packages')
        .select('contract_version')
        .where({ package_id: packageId })
        .first(),
    ).resolves.toEqual({ contract_version: '0.2' });

    await addProductionStoryboardAuthority(database);
    await database('control_plane.production_packages').insert(
      packageRow({
        package_id: '22000000-0000-4000-8000-000000000011',
        idempotency_key: 'production-package-v03-after-reapply',
        package_digest: digestD,
        package_version: 2,
      }),
    );
    await expect(removeProductionStoryboardAuthority(database)).rejects.toThrow(
      /rollback blocked/i,
    );
  });
});
