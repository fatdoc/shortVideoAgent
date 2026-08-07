import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from '../db/migrations/001_pilot_core.js';
import { up as addSessionRotation } from '../db/migrations/002_auth_session_rotation.js';
import { up as addOrganizationFoundation } from '../db/migrations/006_organization_foundation.js';
import { up as addOrganizationMembership } from '../db/migrations/008_organization_membership.js';
import { up as addSessionActiveContext } from '../db/migrations/010_session_active_context.js';
import { PostgresAuthRepository } from './repository.js';
import type { NewSession } from './types.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const tenantId = '10000000-0000-4000-8000-000000000001';
const userId = '10000000-0000-4000-8000-000000000002';
const tenantMembershipId = '10000000-0000-4000-8000-000000000003';
const platformOrganizationId = '20000000-0000-4000-8000-000000000001';
const platformMembershipId = '20000000-0000-4000-8000-000000000003';
const platformUserId = '20000000-0000-4000-8000-000000000002';

async function resetDatabase(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);
  await addSessionRotation(database);
  await database('control_plane.tenants').insert({
    tenant_id: tenantId,
    display_name: 'Tenant A',
    status: 'active',
  });
  await database('control_plane.users').insert({
    user_id: userId,
    email: 'member@example.com',
    display_name: 'Tenant Member',
    password_hash: 'stored-password-hash',
    status: 'active',
  });
  await database('control_plane.memberships').insert({
    membership_id: tenantMembershipId,
    tenant_id: tenantId,
    user_id: userId,
    role_code: 'tenant_admin',
    status: 'active',
  });
  await addOrganizationFoundation(database);
  await addOrganizationMembership(database);
  await addSessionActiveContext(database);
}

async function insertPlatformMembership(
  database: Knex,
  input: { targetUserId: string; email?: string },
): Promise<number> {
  await database('control_plane.organizations')
    .insert({
      organization_id: platformOrganizationId,
      organization_type: 'PLATFORM',
      display_name: 'Platform',
      status: 'active',
    })
    .onConflict('organization_id')
    .ignore();
  if (input.email) {
    await database('control_plane.users').insert({
      user_id: input.targetUserId,
      email: input.email,
      display_name: 'Platform Admin',
      password_hash: 'stored-password-hash',
      status: 'active',
    });
  }
  await database.transaction(async (transaction) => {
    await transaction('control_plane.organization_memberships').insert({
      membership_id: platformMembershipId,
      user_id: input.targetUserId,
      organization_id: platformOrganizationId,
      status: 'active',
      primary_role_code: 'platform_admin',
    });
    await transaction('control_plane.organization_membership_roles').insert({
      membership_id: platformMembershipId,
      role_code: 'platform_admin',
    });
  });
  const membership = await database('control_plane.organization_memberships')
    .select('version')
    .where({ membership_id: platformMembershipId })
    .first<{ version: number }>();
  return membership?.version ?? 0;
}

function tenantSession(overrides: Partial<NewSession> = {}) {
  return {
    sessionId: '30000000-0000-4000-8000-000000000001',
    userId,
    tenantId,
    activeMembershipId: tenantMembershipId,
    activeOrganizationId: tenantId,
    membershipVersion: 1,
    tokenDigest: 'tenant-token-digest',
    expiresAt: new Date('2099-08-08T00:00:00.000Z'),
    rotationDueAt: new Date('2099-08-07T23:00:00.000Z'),
    ...overrides,
  } as NewSession & {
    activeMembershipId: string;
    activeOrganizationId: string;
    membershipVersion: number;
  };
}

describe.runIf(hasDedicatedTestDatabase)('PostgresAuthRepository active membership context', () => {
  let database: Knex;
  let repository: PostgresAuthRepository;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await resetDatabase(database);
    repository = new PostgresAuthRepository(database);
  });

  afterAll(async () => {
    await database?.raw('drop schema if exists control_plane cascade');
    await database?.destroy();
  });

  it('returns the one active Membership Context and fails closed when another active Membership exists', async () => {
    await expect(repository.findLoginIdentity('MEMBER@example.com')).resolves.toMatchObject({
      userId,
      membershipId: tenantMembershipId,
      organizationId: tenantId,
      organizationType: 'TENANT',
      organizationDisplayName: 'Tenant A',
      membershipVersion: 1,
      primaryRole: 'tenant_admin',
      tenantId,
      tenantDisplayName: 'Tenant A',
      roles: ['tenant_admin'],
    });

    await insertPlatformMembership(database, { targetUserId: userId });
    await expect(repository.findLoginIdentity('member@example.com')).resolves.toBeNull();
  });

  it('writes and resolves a Tenant Session only while its Membership Version is current', async () => {
    await repository.replaceLoginSessions(tenantSession());

    expect(
      await database('control_plane.auth_sessions')
        .select('tenant_id', 'active_membership_id', 'active_organization_id', 'membership_version')
        .where({ session_id: tenantSession().sessionId })
        .first(),
    ).toEqual({
      tenant_id: tenantId,
      active_membership_id: tenantMembershipId,
      active_organization_id: tenantId,
      membership_version: 1,
    });
    await expect(repository.findSession(tenantSession().tokenDigest)).resolves.toMatchObject({
      membershipId: tenantMembershipId,
      organizationId: tenantId,
      organizationType: 'TENANT',
      membershipVersion: 1,
      primaryRole: 'tenant_admin',
      tenantId,
    });

    await database('control_plane.organization_memberships')
      .where({ membership_id: tenantMembershipId })
      .update({ status: 'suspended' });
    await expect(repository.findSession(tenantSession().tokenDigest)).resolves.toBeNull();
  });

  it('invalidates an existing Session when the Membership Role set changes', async () => {
    await repository.replaceLoginSessions(tenantSession());
    await database('control_plane.organization_membership_roles').insert({
      membership_id: tenantMembershipId,
      role_code: 'content_operator',
    });

    await expect(repository.findSession(tenantSession().tokenDigest)).resolves.toBeNull();
  });

  it('resolves a PLATFORM Session without inventing a Tenant scope', async () => {
    const platformVersion = await insertPlatformMembership(database, {
      targetUserId: platformUserId,
      email: 'platform@example.com',
    });
    await database('control_plane.auth_sessions').insert({
      session_id: '40000000-0000-4000-8000-000000000001',
      user_id: platformUserId,
      tenant_id: null,
      active_membership_id: platformMembershipId,
      active_organization_id: platformOrganizationId,
      membership_version: platformVersion,
      token_digest: 'platform-token-digest',
      expires_at: '2099-08-08T00:00:00.000Z',
      rotation_due_at: '2099-08-07T23:00:00.000Z',
    });

    await expect(repository.findSession('platform-token-digest')).resolves.toMatchObject({
      userId: platformUserId,
      membershipId: platformMembershipId,
      organizationId: platformOrganizationId,
      organizationType: 'PLATFORM',
      organizationDisplayName: 'Platform',
      membershipVersion: platformVersion,
      primaryRole: 'platform_admin',
      tenantId: null,
      tenantDisplayName: null,
      roles: ['platform_admin'],
    });
  });
});
