import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from './migrations/001_pilot_core.js';
import {
  down as removeOrganizationFoundation,
  up as addOrganizationFoundation,
} from './migrations/006_organization_foundation.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);
const tenantA = '10000000-0000-4000-8000-000000000001';
const tenantB = '20000000-0000-4000-8000-000000000001';

async function expectOrganizationFoundationPresent(database: Knex) {
  const result = await database.raw<{ rows: Array<{ organizations: string | null }> }>(
    `select to_regclass('control_plane.organizations')::text as organizations`,
  );
  expect(result.rows[0]).toEqual({ organizations: 'control_plane.organizations' });

  const organizationColumn = await database('information_schema.columns')
    .select('is_nullable')
    .where({
      table_schema: 'control_plane',
      table_name: 'tenants',
      column_name: 'organization_id',
    })
    .first();
  expect(organizationColumn).toEqual({ is_nullable: 'NO' });
}

describe.runIf(hasDedicatedTestDatabase)('A-BIZ-01.1 organization foundation migration', () => {
  let database: Knex;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await database.raw('drop schema if exists control_plane cascade');
    await createPilotCore(database);
    await database('control_plane.tenants').insert([
      { tenant_id: tenantA, display_name: 'Tenant A', status: 'active' },
      { tenant_id: tenantB, display_name: 'Tenant B', status: 'suspended' },
    ]);
  });

  afterAll(async () => {
    await database?.raw('drop schema if exists control_plane cascade');
    await database?.destroy();
  });

  it('creates the organization root and backfills each existing tenant with the same UUID', async () => {
    await addOrganizationFoundation(database);
    await expectOrganizationFoundationPresent(database);

    const organizations = await database('control_plane.organizations')
      .select('organization_id', 'organization_type', 'display_name', 'status')
      .orderBy('organization_id');
    expect(organizations).toEqual([
      {
        organization_id: tenantA,
        organization_type: 'TENANT',
        display_name: 'Tenant A',
        status: 'active',
      },
      {
        organization_id: tenantB,
        organization_type: 'TENANT',
        display_name: 'Tenant B',
        status: 'suspended',
      },
    ]);

    const tenants = await database('control_plane.tenants')
      .select('tenant_id', 'organization_id')
      .orderBy('tenant_id');
    expect(tenants).toEqual([
      { tenant_id: tenantA, organization_id: tenantA },
      { tenant_id: tenantB, organization_id: tenantB },
    ]);
  });

  it('enforces organization type, status, parent, self-parent and one-to-one tenant constraints', async () => {
    await addOrganizationFoundation(database);
    await expectOrganizationFoundationPresent(database);

    await expect(
      database('control_plane.organizations').insert({
        organization_id: '30000000-0000-4000-8000-000000000001',
        organization_type: 'UNKNOWN',
        display_name: 'Invalid type',
        status: 'active',
      }),
    ).rejects.toThrow();

    await expect(
      database('control_plane.organizations').insert({
        organization_id: '30000000-0000-4000-8000-000000000002',
        organization_type: 'CHANNEL',
        display_name: 'Invalid status',
        status: 'deleted',
      }),
    ).rejects.toThrow();

    await expect(
      database('control_plane.organizations').insert({
        organization_id: '30000000-0000-4000-8000-000000000003',
        organization_type: 'CHANNEL',
        display_name: 'Missing parent',
        status: 'active',
        parent_organization_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      }),
    ).rejects.toThrow();

    await expect(
      database('control_plane.organizations').insert({
        organization_id: '30000000-0000-4000-8000-000000000004',
        organization_type: 'CHANNEL',
        display_name: 'Self parent',
        status: 'active',
        parent_organization_id: '30000000-0000-4000-8000-000000000004',
      }),
    ).rejects.toThrow();

    await expect(
      database('control_plane.tenants').insert({
        tenant_id: '30000000-0000-4000-8000-000000000005',
        organization_id: tenantA,
        display_name: 'Duplicate organization mapping',
        status: 'active',
      }),
    ).rejects.toThrow();

    await expect(
      database('control_plane.tenants').insert({
        tenant_id: '30000000-0000-4000-8000-000000000006',
        organization_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        display_name: 'Missing organization mapping',
        status: 'active',
      }),
    ).rejects.toThrow();

    const platformOrganizationId = '30000000-0000-4000-8000-000000000009';
    await database('control_plane.organizations').insert({
      organization_id: platformOrganizationId,
      organization_type: 'PLATFORM',
      display_name: 'Wrong tenant organization type',
      status: 'active',
    });
    await expect(
      database('control_plane.tenants').insert({
        tenant_id: '30000000-0000-4000-8000-000000000010',
        organization_id: platformOrganizationId,
        display_name: 'Platform cannot extend Tenant',
        status: 'active',
      }),
    ).rejects.toThrow(/TENANT organization/);

    await expect(
      database('control_plane.organizations')
        .where({ organization_id: tenantA })
        .update({ organization_type: 'CHANNEL' }),
    ).rejects.toThrow(/must remain TENANT/);
  });

  it('keeps platform cardinality out of the schema and does not bootstrap commercial data', async () => {
    await addOrganizationFoundation(database);
    await expectOrganizationFoundationPresent(database);

    expect(
      await database('control_plane.organizations').where({ organization_type: 'PLATFORM' }),
    ).toHaveLength(0);

    await database('control_plane.organizations').insert([
      {
        organization_id: '30000000-0000-4000-8000-000000000007',
        organization_type: 'PLATFORM',
        display_name: 'Platform One',
        status: 'active',
      },
      {
        organization_id: '30000000-0000-4000-8000-000000000008',
        organization_type: 'PLATFORM',
        display_name: 'Platform Two',
        status: 'active',
      },
    ]);

    expect(
      await database('control_plane.organizations')
        .where({ organization_type: 'PLATFORM', status: 'active' })
        .count('* as count')
        .first(),
    ).toEqual({ count: '2' });
  });

  it('rolls back only the organization foundation and preserves legacy tenant rows', async () => {
    await addOrganizationFoundation(database);
    await expectOrganizationFoundationPresent(database);
    await removeOrganizationFoundation(database);

    expect(
      await database('control_plane.tenants').select('tenant_id').orderBy('tenant_id'),
    ).toEqual([{ tenant_id: tenantA }, { tenant_id: tenantB }]);

    const organizationTable = await database('information_schema.tables')
      .select('table_name')
      .where({ table_schema: 'control_plane', table_name: 'organizations' })
      .first();
    expect(organizationTable).toBeUndefined();

    const organizationColumn = await database('information_schema.columns')
      .select('column_name')
      .where({
        table_schema: 'control_plane',
        table_name: 'tenants',
        column_name: 'organization_id',
      })
      .first();
    expect(organizationColumn).toBeUndefined();
  });
});
