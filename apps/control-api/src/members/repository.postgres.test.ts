import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresAuthRepository } from '../auth/repository.js';
import { migrationConfig } from '../db/migrationConfig.js';
import {
  MemberLastAdminConflictError,
  MemberNotFoundError,
  MemberSelfSuspendForbiddenError,
  MemberStatusConflictError,
  MemberVersionConflictError,
} from './errors.js';
import { PostgresMemberDirectoryRepository } from './repository.js';
import type { MemberAdministratorRole, MemberStatus } from './types.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const platformOrganizationId = '10000000-0000-4000-8000-000000000001';
const otherPlatformOrganizationId = '10000000-0000-4000-8000-000000000002';
const tenantId = '20000000-0000-4000-8000-000000000001';

async function resetDatabase(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await database.schema.withSchema('public').dropTableIfExists('control_api_migrations_lock');
  await database.schema.withSchema('public').dropTableIfExists('control_api_migrations');
  await database.migrate.latest(
    migrationConfig(new URL('../db/migrationConfig.ts', import.meta.url).href),
  );
}

async function insertOrganization(
  database: Knex,
  organizationId: string,
  organizationType: 'PLATFORM' | 'TENANT',
): Promise<void> {
  await database('control_plane.organizations').insert({
    organization_id: organizationId,
    organization_type: organizationType,
    display_name: `${organizationType} ${organizationId.slice(-4)}`,
    status: 'active',
  });
  if (organizationType === 'TENANT') {
    await database('control_plane.tenants').insert({
      tenant_id: organizationId,
      organization_id: organizationId,
      display_name: 'Tenant Directory',
      status: 'active',
    });
  }
}

async function insertUser(
  database: Knex,
  input: { userId: string; displayName: string; email: string },
): Promise<void> {
  await database('control_plane.users').insert({
    user_id: input.userId,
    email: input.email,
    display_name: input.displayName,
    password_hash: 'unused',
    status: 'active',
  });
}

async function insertCanonicalMembership(
  database: Knex,
  input: {
    membershipId: string;
    userId: string;
    organizationId: string;
    status?: MemberStatus;
    primaryRole: MemberAdministratorRole | 'pilot_support' | 'content_operator';
    roles?: Array<MemberAdministratorRole | 'pilot_support' | 'content_operator'>;
  },
): Promise<number> {
  await database.transaction(async (transaction) => {
    await transaction('control_plane.organization_memberships').insert({
      membership_id: input.membershipId,
      user_id: input.userId,
      organization_id: input.organizationId,
      status: input.status ?? 'active',
      primary_role_code: input.primaryRole,
    });
    await transaction('control_plane.organization_membership_roles').insert(
      (input.roles ?? [input.primaryRole]).map((roleCode) => ({
        membership_id: input.membershipId,
        role_code: roleCode,
      })),
    );
  });
  return membershipVersion(database, input.membershipId);
}

async function insertLegacyMembership(
  database: Knex,
  input: {
    membershipId: string;
    userId: string;
    roleCode: 'tenant_admin' | 'content_operator';
  },
): Promise<number> {
  await database('control_plane.memberships').insert({
    membership_id: input.membershipId,
    tenant_id: tenantId,
    user_id: input.userId,
    role_code: input.roleCode,
    status: 'active',
  });
  return membershipVersion(database, input.membershipId);
}

async function membershipVersion(database: Knex, membershipId: string): Promise<number> {
  const row = await database('control_plane.organization_memberships')
    .select('version')
    .where({ membership_id: membershipId })
    .first<{ version: number }>();
  return row!.version;
}

async function membershipStatus(database: Knex, membershipId: string): Promise<MemberStatus> {
  const row = await database('control_plane.organization_memberships')
    .select('status')
    .where({ membership_id: membershipId })
    .first<{ status: MemberStatus }>();
  return row!.status;
}

async function roles(database: Knex, membershipId: string): Promise<string[]> {
  const rows = await database('control_plane.organization_membership_roles')
    .select('role_code')
    .where({ membership_id: membershipId })
    .orderBy('role_code');
  return rows.map(({ role_code: roleCode }) => roleCode);
}

describe.runIf(hasDedicatedTestDatabase)('PostgresMemberDirectoryRepository', () => {
  let database: Knex;
  let repository: PostgresMemberDirectoryRepository;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl, pool: { min: 0, max: 8 } });
    await resetDatabase(database);
    repository = new PostgresMemberDirectoryRepository(database);
  });

  afterAll(async () => {
    if (!database) return;
    await database.raw('drop schema if exists control_plane cascade');
    await database.schema.withSchema('public').dropTableIfExists('control_api_migrations_lock');
    await database.schema.withSchema('public').dropTableIfExists('control_api_migrations');
    await database.destroy();
  });

  it('lists only the canonical Organization with deterministic sorting, filtering and a bounded projection', async () => {
    await insertOrganization(database, platformOrganizationId, 'PLATFORM');
    await insertOrganization(database, otherPlatformOrganizationId, 'PLATFORM');
    const actorMembershipId = '30000000-0000-4000-8000-000000000001';
    const suspendedMembershipId = '30000000-0000-4000-8000-000000000002';
    const activeMembershipId = '30000000-0000-4000-8000-000000000003';
    const outsiderMembershipId = '30000000-0000-4000-8000-000000000004';
    const users = [
      ['40000000-0000-4000-8000-000000000001', 'Beta Admin', 'BETA@EXAMPLE.COM'],
      ['40000000-0000-4000-8000-000000000002', 'alpha Support', 'ALPHA@EXAMPLE.COM'],
      ['40000000-0000-4000-8000-000000000003', 'Gamma Support', 'gamma@example.com'],
      ['40000000-0000-4000-8000-000000000004', 'Aardvark Outsider', 'outside@example.com'],
    ] as const;
    for (const [userId, displayName, email] of users) {
      await insertUser(database, { userId, displayName, email });
    }
    await insertCanonicalMembership(database, {
      membershipId: actorMembershipId,
      userId: users[0][0],
      organizationId: platformOrganizationId,
      primaryRole: 'platform_admin',
    });
    await insertCanonicalMembership(database, {
      membershipId: suspendedMembershipId,
      userId: users[1][0],
      organizationId: platformOrganizationId,
      status: 'suspended',
      primaryRole: 'pilot_support',
    });
    await insertCanonicalMembership(database, {
      membershipId: activeMembershipId,
      userId: users[2][0],
      organizationId: platformOrganizationId,
      primaryRole: 'pilot_support',
    });
    await insertCanonicalMembership(database, {
      membershipId: outsiderMembershipId,
      userId: users[3][0],
      organizationId: otherPlatformOrganizationId,
      primaryRole: 'platform_admin',
    });

    const all = await repository.listCurrentOrganizationMembers({
      organizationId: platformOrganizationId,
      actorMembershipId,
      status: 'all',
      limit: 2,
    });
    expect(all).toHaveLength(2);
    expect(all.map(({ membershipId }) => membershipId)).toEqual([
      suspendedMembershipId,
      actorMembershipId,
    ]);
    expect(all[0]).toMatchObject({
      displayName: 'alpha Support',
      email: 'alpha@example.com',
      status: 'suspended',
      primaryRole: 'pilot_support',
      roles: ['pilot_support'],
      isCurrentActor: false,
    });
    expect(all[1]?.isCurrentActor).toBe(true);
    expect(Object.keys(all[0] ?? {}).sort()).toEqual(
      [
        'membershipId',
        'displayName',
        'email',
        'status',
        'primaryRole',
        'roles',
        'version',
        'createdAt',
        'updatedAt',
        'isCurrentActor',
      ].sort(),
    );

    const active = await repository.listCurrentOrganizationMembers({
      organizationId: platformOrganizationId,
      actorMembershipId,
      status: 'active',
      limit: 100,
    });
    expect(active.map(({ membershipId }) => membershipId)).toEqual([
      actorMembershipId,
      activeMembershipId,
    ]);
  });

  it('suspends a canonical member once and replays without another version bump', async () => {
    await insertOrganization(database, platformOrganizationId, 'PLATFORM');
    const actorMembershipId = '50000000-0000-4000-8000-000000000001';
    const targetMembershipId = '50000000-0000-4000-8000-000000000002';
    await insertUser(database, {
      userId: '60000000-0000-4000-8000-000000000001',
      displayName: 'Platform Admin',
      email: 'admin@example.com',
    });
    await insertUser(database, {
      userId: '60000000-0000-4000-8000-000000000002',
      displayName: 'Pilot Support',
      email: 'support@example.com',
    });
    await insertCanonicalMembership(database, {
      membershipId: actorMembershipId,
      userId: '60000000-0000-4000-8000-000000000001',
      organizationId: platformOrganizationId,
      primaryRole: 'platform_admin',
    });
    const expectedVersion = await insertCanonicalMembership(database, {
      membershipId: targetMembershipId,
      userId: '60000000-0000-4000-8000-000000000002',
      organizationId: platformOrganizationId,
      primaryRole: 'pilot_support',
    });

    const first = await repository.suspendCurrentOrganizationMember({
      organizationId: platformOrganizationId,
      actorMembershipId,
      targetMembershipId,
      expectedVersion,
      administratorRole: 'platform_admin',
    });
    expect(first).toMatchObject({ replayed: false, member: { status: 'suspended' } });
    expect(first.member.version).toBe(expectedVersion + 1);

    const replay = await repository.suspendCurrentOrganizationMember({
      organizationId: platformOrganizationId,
      actorMembershipId,
      targetMembershipId,
      expectedVersion,
      administratorRole: 'platform_admin',
    });
    expect(replay).toEqual({ member: first.member, replayed: true });
    expect(await membershipVersion(database, targetMembershipId)).toBe(expectedVersion + 1);
  });

  it('suspends a legacy Tenant member without deleting secondary roles and invalidates its old Session', async () => {
    await insertOrganization(database, tenantId, 'TENANT');
    const actorMembershipId = '70000000-0000-4000-8000-000000000001';
    const targetMembershipId = '70000000-0000-4000-8000-000000000002';
    const actorUserId = '80000000-0000-4000-8000-000000000001';
    const targetUserId = '80000000-0000-4000-8000-000000000002';
    await insertUser(database, {
      userId: actorUserId,
      displayName: 'Tenant Admin A',
      email: 'tenant-a@example.com',
    });
    await insertUser(database, {
      userId: targetUserId,
      displayName: 'Tenant Admin B',
      email: 'tenant-b@example.com',
    });
    await insertCanonicalMembership(database, {
      membershipId: actorMembershipId,
      userId: actorUserId,
      organizationId: tenantId,
      primaryRole: 'tenant_admin',
    });
    await insertLegacyMembership(database, {
      membershipId: targetMembershipId,
      userId: targetUserId,
      roleCode: 'tenant_admin',
    });
    await database('control_plane.organization_membership_roles').insert({
      membership_id: targetMembershipId,
      role_code: 'content_operator',
    });
    const expectedVersion = await membershipVersion(database, targetMembershipId);
    await database('control_plane.auth_sessions').insert({
      session_id: '90000000-0000-4000-8000-000000000001',
      user_id: targetUserId,
      tenant_id: tenantId,
      active_membership_id: targetMembershipId,
      active_organization_id: tenantId,
      membership_version: expectedVersion,
      token_digest: 'legacy-member-session-digest',
      expires_at: '2099-08-10T00:00:00.000Z',
      rotation_due_at: '2099-08-09T23:59:00.000Z',
    });
    const authRepository = new PostgresAuthRepository(database);
    await expect(
      authRepository.findSession('legacy-member-session-digest'),
    ).resolves.not.toBeNull();

    const result = await repository.suspendCurrentOrganizationMember({
      organizationId: tenantId,
      actorMembershipId,
      targetMembershipId,
      expectedVersion,
      administratorRole: 'tenant_admin',
    });

    expect(result).toMatchObject({
      replayed: false,
      member: {
        status: 'suspended',
        primaryRole: 'tenant_admin',
        roles: ['content_operator', 'tenant_admin'],
        version: expectedVersion + 1,
      },
    });
    expect(await roles(database, targetMembershipId)).toEqual(['content_operator', 'tenant_admin']);
    await expect(authRepository.findSession('legacy-member-session-digest')).resolves.toBeNull();
  });

  it('rolls back the Membership status when a downstream database failure occurs', async () => {
    await insertOrganization(database, platformOrganizationId, 'PLATFORM');
    const actorMembershipId = '91000000-0000-4000-8000-000000000001';
    const targetMembershipId = '91000000-0000-4000-8000-000000000002';
    await insertUser(database, {
      userId: '92000000-0000-4000-8000-000000000001',
      displayName: 'Rollback Admin',
      email: 'rollback-admin@example.com',
    });
    await insertUser(database, {
      userId: '92000000-0000-4000-8000-000000000002',
      displayName: 'Rollback Target',
      email: 'rollback-target@example.com',
    });
    await insertCanonicalMembership(database, {
      membershipId: actorMembershipId,
      userId: '92000000-0000-4000-8000-000000000001',
      organizationId: platformOrganizationId,
      primaryRole: 'platform_admin',
    });
    const expectedVersion = await insertCanonicalMembership(database, {
      membershipId: targetMembershipId,
      userId: '92000000-0000-4000-8000-000000000002',
      organizationId: platformOrganizationId,
      primaryRole: 'pilot_support',
    });
    await database.raw(`
      create function control_plane.fail_member_suspend_for_test()
        returns trigger language plpgsql as $$
        begin
          if new.membership_id = '${targetMembershipId}' and new.status = 'suspended' then
            raise exception 'forced member suspend failure';
          end if;
          return new;
        end;
        $$;
      create trigger fail_member_suspend_for_test
        after update of status on control_plane.organization_memberships
        for each row execute function control_plane.fail_member_suspend_for_test();
    `);

    await expect(
      repository.suspendCurrentOrganizationMember({
        organizationId: platformOrganizationId,
        actorMembershipId,
        targetMembershipId,
        expectedVersion,
        administratorRole: 'platform_admin',
      }),
    ).rejects.toThrow(/forced member suspend failure/);
    expect(await membershipStatus(database, targetMembershipId)).toBe('active');
    expect(await membershipVersion(database, targetMembershipId)).toBe(expectedVersion);
  });

  it('fails closed for cross-Organization, self, stale, expired and last-admin attempts', async () => {
    await insertOrganization(database, platformOrganizationId, 'PLATFORM');
    await insertOrganization(database, otherPlatformOrganizationId, 'PLATFORM');
    const actorMembershipId = 'a0000000-0000-4000-8000-000000000001';
    const staleTargetId = 'a0000000-0000-4000-8000-000000000002';
    const expiredTargetId = 'a0000000-0000-4000-8000-000000000003';
    const outsiderTargetId = 'a0000000-0000-4000-8000-000000000004';
    const userIds = [
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000003',
      'b0000000-0000-4000-8000-000000000004',
    ];
    for (const [index, userId] of userIds.entries()) {
      await insertUser(database, {
        userId,
        displayName: `Member ${index}`,
        email: `member-${index}@example.com`,
      });
    }
    const actorVersion = await insertCanonicalMembership(database, {
      membershipId: actorMembershipId,
      userId: userIds[0]!,
      organizationId: platformOrganizationId,
      primaryRole: 'platform_admin',
    });
    const staleVersion = await insertCanonicalMembership(database, {
      membershipId: staleTargetId,
      userId: userIds[1]!,
      organizationId: platformOrganizationId,
      primaryRole: 'pilot_support',
    });
    const expiredVersion = await insertCanonicalMembership(database, {
      membershipId: expiredTargetId,
      userId: userIds[2]!,
      organizationId: platformOrganizationId,
      status: 'expired',
      primaryRole: 'pilot_support',
    });
    const outsiderVersion = await insertCanonicalMembership(database, {
      membershipId: outsiderTargetId,
      userId: userIds[3]!,
      organizationId: otherPlatformOrganizationId,
      primaryRole: 'platform_admin',
    });
    const suspend = (targetMembershipId: string, expectedVersion: number) =>
      repository.suspendCurrentOrganizationMember({
        organizationId: platformOrganizationId,
        actorMembershipId,
        targetMembershipId,
        expectedVersion,
        administratorRole: 'platform_admin',
      });

    await expect(suspend(outsiderTargetId, outsiderVersion)).rejects.toBeInstanceOf(
      MemberNotFoundError,
    );
    await expect(suspend(actorMembershipId, actorVersion)).rejects.toBeInstanceOf(
      MemberSelfSuspendForbiddenError,
    );
    await expect(suspend(staleTargetId, staleVersion + 1)).rejects.toBeInstanceOf(
      MemberVersionConflictError,
    );
    await expect(suspend(expiredTargetId, expiredVersion)).rejects.toBeInstanceOf(
      MemberStatusConflictError,
    );
    expect(await membershipStatus(database, staleTargetId)).toBe('active');
  });

  it('protects the last active administrator even when the admin role is secondary', async () => {
    await insertOrganization(database, tenantId, 'TENANT');
    const actorMembershipId = 'c0000000-0000-4000-8000-000000000001';
    const actorUserId = 'd0000000-0000-4000-8000-000000000001';
    await insertUser(database, {
      userId: actorUserId,
      displayName: 'Secondary Admin',
      email: 'secondary-admin@example.com',
    });
    const version = await insertCanonicalMembership(database, {
      membershipId: actorMembershipId,
      userId: actorUserId,
      organizationId: tenantId,
      primaryRole: 'content_operator',
      roles: ['content_operator', 'tenant_admin'],
    });

    await expect(
      repository.suspendCurrentOrganizationMember({
        organizationId: tenantId,
        actorMembershipId: 'eeeeeeee-0000-4000-8000-000000000001',
        targetMembershipId: actorMembershipId,
        expectedVersion: version,
        administratorRole: 'tenant_admin',
      }),
    ).rejects.toBeInstanceOf(MemberLastAdminConflictError);
    expect(await membershipStatus(database, actorMembershipId)).toBe('active');
  });

  it('serializes concurrent administrator suspension so at most one succeeds', async () => {
    await insertOrganization(database, platformOrganizationId, 'PLATFORM');
    const membershipA = 'e0000000-0000-4000-8000-000000000001';
    const membershipB = 'e0000000-0000-4000-8000-000000000002';
    const userA = 'f0000000-0000-4000-8000-000000000001';
    const userB = 'f0000000-0000-4000-8000-000000000002';
    await insertUser(database, {
      userId: userA,
      displayName: 'Admin A',
      email: 'admin-a@example.com',
    });
    await insertUser(database, {
      userId: userB,
      displayName: 'Admin B',
      email: 'admin-b@example.com',
    });
    const versionA = await insertCanonicalMembership(database, {
      membershipId: membershipA,
      userId: userA,
      organizationId: platformOrganizationId,
      primaryRole: 'platform_admin',
    });
    const versionB = await insertCanonicalMembership(database, {
      membershipId: membershipB,
      userId: userB,
      organizationId: platformOrganizationId,
      primaryRole: 'platform_admin',
    });

    const results = await Promise.allSettled([
      repository.suspendCurrentOrganizationMember({
        organizationId: platformOrganizationId,
        actorMembershipId: membershipA,
        targetMembershipId: membershipB,
        expectedVersion: versionB,
        administratorRole: 'platform_admin',
      }),
      repository.suspendCurrentOrganizationMember({
        organizationId: platformOrganizationId,
        actorMembershipId: membershipB,
        targetMembershipId: membershipA,
        expectedVersion: versionA,
        administratorRole: 'platform_admin',
      }),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    const rejection = results.find(({ status }) => status === 'rejected');
    expect(rejection).toMatchObject({ reason: expect.any(MemberLastAdminConflictError) });
    expect(
      await database('control_plane.organization_memberships').where({
        organization_id: platformOrganizationId,
        status: 'active',
      }),
    ).toHaveLength(1);
  });
});
