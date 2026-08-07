import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from './migrations/001_pilot_core.js';
import { up as addOrganizationFoundation } from './migrations/006_organization_foundation.js';
import {
  down as removeOrganizationMembership,
  up as addOrganizationMembership,
} from './migrations/008_organization_membership.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);
const tenantId = '10000000-0000-4000-8000-000000000001';
const tenantAdminUserId = '10000000-0000-4000-8000-000000000002';
const legacyMembershipId = '10000000-0000-4000-8000-000000000003';
const secondaryUserId = '20000000-0000-4000-8000-000000000002';
const platformOrganizationId = '30000000-0000-4000-8000-000000000001';
const channelOrganizationId = '40000000-0000-4000-8000-000000000001';

async function resetLegacyDataset(database: Knex) {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);
  await database('control_plane.tenants').insert({
    tenant_id: tenantId,
    display_name: 'Tenant A',
    status: 'active',
  });
  await database('control_plane.users').insert({
    user_id: tenantAdminUserId,
    email: 'tenant-admin@example.com',
    display_name: 'Tenant Admin',
    password_hash: 'unused',
    status: 'active',
  });
  await database('control_plane.memberships').insert({
    membership_id: legacyMembershipId,
    tenant_id: tenantId,
    user_id: tenantAdminUserId,
    role_code: 'tenant_admin',
    status: 'active',
    created_at: '2026-08-01T01:02:03.000Z',
    updated_at: '2026-08-02T04:05:06.000Z',
  });
  await addOrganizationFoundation(database);
}

async function insertOrganization(
  database: Knex,
  organizationId: string,
  organizationType: 'PLATFORM' | 'CHANNEL' | 'TENANT',
) {
  await database('control_plane.organizations').insert({
    organization_id: organizationId,
    organization_type: organizationType,
    display_name: `${organizationType} Organization`,
    status: 'active',
  });
}

async function insertUser(database: Knex, userId: string, email: string) {
  await database('control_plane.users').insert({
    user_id: userId,
    email,
    display_name: email,
    password_hash: 'unused',
    status: 'active',
  });
}

async function insertOrganizationMembership(
  database: Knex,
  input: {
    membershipId: string;
    userId: string;
    organizationId: string;
    primaryRoleCode: string;
    roles?: string[];
  },
) {
  await database.transaction(async (transaction) => {
    await transaction('control_plane.organization_memberships').insert({
      membership_id: input.membershipId,
      user_id: input.userId,
      organization_id: input.organizationId,
      status: 'active',
      primary_role_code: input.primaryRoleCode,
    });
    await transaction('control_plane.organization_membership_roles').insert(
      (input.roles ?? [input.primaryRoleCode]).map((roleCode) => ({
        membership_id: input.membershipId,
        role_code: roleCode,
      })),
    );
  });
}

async function tableRegistration(database: Knex, tableName: string) {
  const result = await database.raw<{ rows: Array<{ table_name: string | null }> }>(
    'select to_regclass(?)::text as table_name',
    [`control_plane.${tableName}`],
  );
  return result.rows[0]?.table_name ?? null;
}

describe.runIf(hasDedicatedTestDatabase)('A-BIZ-01.1 organization membership migration', () => {
  let database: Knex;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await resetLegacyDataset(database);
  });

  afterAll(async () => {
    await database?.raw('drop schema if exists control_plane cascade');
    await database?.destroy();
  });

  it('backfills an unambiguous legacy Tenant membership without changing its identity or timestamps', async () => {
    await addOrganizationMembership(database);

    expect(
      await database('control_plane.organization_memberships')
        .select(
          'membership_id',
          'user_id',
          'organization_id',
          'status',
          'primary_role_code',
          'version',
          'created_at',
          'updated_at',
        )
        .where({ membership_id: legacyMembershipId })
        .first(),
    ).toEqual({
      membership_id: legacyMembershipId,
      user_id: tenantAdminUserId,
      organization_id: tenantId,
      status: 'active',
      primary_role_code: 'tenant_admin',
      version: 1,
      created_at: new Date('2026-08-01T01:02:03.000Z'),
      updated_at: new Date('2026-08-02T04:05:06.000Z'),
    });
    expect(
      await database('control_plane.organization_membership_roles')
        .select('membership_id', 'role_code')
        .where({ membership_id: legacyMembershipId }),
    ).toEqual([{ membership_id: legacyMembershipId, role_code: 'tenant_admin' }]);
  });

  it('supports multi-organization memberships and multiple roles with one explicit primary role', async () => {
    await addOrganizationMembership(database);
    await insertOrganization(database, platformOrganizationId, 'PLATFORM');
    await insertOrganization(database, channelOrganizationId, 'CHANNEL');

    await insertOrganizationMembership(database, {
      membershipId: '30000000-0000-4000-8000-000000000003',
      userId: tenantAdminUserId,
      organizationId: platformOrganizationId,
      primaryRoleCode: 'platform_admin',
      roles: ['platform_admin', 'pilot_support'],
    });
    await insertOrganizationMembership(database, {
      membershipId: '40000000-0000-4000-8000-000000000003',
      userId: tenantAdminUserId,
      organizationId: channelOrganizationId,
      primaryRoleCode: 'channel_admin',
    });
    await database('control_plane.organization_membership_roles').insert({
      membership_id: legacyMembershipId,
      role_code: 'content_operator',
    });

    expect(
      await database('control_plane.organization_memberships')
        .where({ user_id: tenantAdminUserId })
        .count('* as count')
        .first(),
    ).toEqual({ count: '3' });
    expect(
      await database('control_plane.organization_membership_roles')
        .select('role_code')
        .where({ membership_id: legacyMembershipId })
        .orderBy('role_code'),
    ).toEqual([{ role_code: 'content_operator' }, { role_code: 'tenant_admin' }]);
  });

  it('rejects role/type mismatches, duplicate User/Organization memberships and missing primary roles', async () => {
    await addOrganizationMembership(database);
    expect(await tableRegistration(database, 'organization_memberships')).toBe(
      'control_plane.organization_memberships',
    );
    expect(await tableRegistration(database, 'organization_membership_roles')).toBe(
      'control_plane.organization_membership_roles',
    );

    await expect(
      insertOrganizationMembership(database, {
        membershipId: '50000000-0000-4000-8000-000000000001',
        userId: tenantAdminUserId,
        organizationId: tenantId,
        primaryRoleCode: 'channel_admin',
      }),
    ).rejects.toThrow();

    await expect(
      insertOrganizationMembership(database, {
        membershipId: '50000000-0000-4000-8000-000000000002',
        userId: tenantAdminUserId,
        organizationId: tenantId,
        primaryRoleCode: 'tenant_admin',
      }),
    ).rejects.toThrow();

    await insertUser(database, secondaryUserId, 'secondary@example.com');
    await expect(
      insertOrganizationMembership(database, {
        membershipId: '50000000-0000-4000-8000-000000000003',
        userId: secondaryUserId,
        organizationId: tenantId,
        primaryRoleCode: 'tenant_admin',
        roles: ['content_operator'],
      }),
    ).rejects.toThrow();

    await expect(
      database('control_plane.organization_membership_roles').insert({
        membership_id: legacyMembershipId,
        role_code: 'unknown_role',
      }),
    ).rejects.toThrow();
  });

  it('shadows legacy insert, update and delete while rejecting a second legacy role row', async () => {
    await addOrganizationMembership(database);
    await insertUser(database, secondaryUserId, 'legacy-writer@example.com');
    const membershipId = '60000000-0000-4000-8000-000000000001';

    await database('control_plane.memberships').insert({
      membership_id: membershipId,
      tenant_id: tenantId,
      user_id: secondaryUserId,
      role_code: 'content_operator',
      status: 'active',
    });
    expect(
      await database('control_plane.organization_memberships')
        .select('membership_id', 'organization_id', 'status', 'primary_role_code')
        .where({ membership_id: membershipId })
        .first(),
    ).toEqual({
      membership_id: membershipId,
      organization_id: tenantId,
      status: 'active',
      primary_role_code: 'content_operator',
    });

    await database('control_plane.memberships')
      .where({ membership_id: membershipId })
      .update({ role_code: 'tenant_admin', status: 'suspended' });
    expect(
      await database('control_plane.organization_memberships')
        .select('status', 'primary_role_code')
        .where({ membership_id: membershipId })
        .first(),
    ).toEqual({ status: 'suspended', primary_role_code: 'tenant_admin' });
    expect(
      await database('control_plane.organization_membership_roles')
        .select('role_code')
        .where({ membership_id: membershipId }),
    ).toEqual([{ role_code: 'tenant_admin' }]);

    await expect(
      database('control_plane.memberships').insert({
        membership_id: '60000000-0000-4000-8000-000000000002',
        tenant_id: tenantId,
        user_id: secondaryUserId,
        role_code: 'content_operator',
        status: 'active',
      }),
    ).rejects.toThrow();

    await database('control_plane.memberships').where({ membership_id: membershipId }).delete();
    expect(
      await database('control_plane.organization_memberships')
        .where({ membership_id: membershipId })
        .first(),
    ).toBeUndefined();
  });

  it('fails closed before migration when legacy rows make the primary role ambiguous', async () => {
    await database('control_plane.memberships').insert({
      membership_id: '70000000-0000-4000-8000-000000000001',
      tenant_id: tenantId,
      user_id: tenantAdminUserId,
      role_code: 'content_operator',
      status: 'active',
    });

    await expect(addOrganizationMembership(database)).rejects.toThrow(/ambiguous|multiple/i);
    expect(await tableRegistration(database, 'organization_memberships')).toBeNull();
  });

  it('fails closed instead of mapping a legacy Tenant pilot_support role to PLATFORM', async () => {
    await database('control_plane.memberships')
      .where({ membership_id: legacyMembershipId })
      .update({ role_code: 'pilot_support' });

    await expect(addOrganizationMembership(database)).rejects.toThrow(/pilot_support|PLATFORM/i);
    expect(await tableRegistration(database, 'organization_memberships')).toBeNull();
  });

  it('protects Organization type in reverse and rolls back only the new membership model', async () => {
    await addOrganizationMembership(database);
    await insertOrganization(database, platformOrganizationId, 'PLATFORM');
    await insertOrganizationMembership(database, {
      membershipId: '80000000-0000-4000-8000-000000000001',
      userId: tenantAdminUserId,
      organizationId: platformOrganizationId,
      primaryRoleCode: 'platform_admin',
    });

    await expect(
      database('control_plane.organizations')
        .where({ organization_id: platformOrganizationId })
        .update({ organization_type: 'CHANNEL' }),
    ).rejects.toThrow();

    await removeOrganizationMembership(database);

    expect(await tableRegistration(database, 'organization_memberships')).toBeNull();
    expect(await tableRegistration(database, 'organization_membership_roles')).toBeNull();
    expect(
      await database('control_plane.memberships')
        .select('membership_id', 'tenant_id', 'user_id', 'role_code', 'status')
        .where({ membership_id: legacyMembershipId })
        .first(),
    ).toEqual({
      membership_id: legacyMembershipId,
      tenant_id: tenantId,
      user_id: tenantAdminUserId,
      role_code: 'tenant_admin',
      status: 'active',
    });
    expect(await tableRegistration(database, 'organizations')).toBe('control_plane.organizations');
    expect(await tableRegistration(database, 'tenants')).toBe('control_plane.tenants');
  });
});
