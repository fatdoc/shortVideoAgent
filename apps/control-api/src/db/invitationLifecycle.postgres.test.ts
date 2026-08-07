import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from './migrations/001_pilot_core.js';
import { up as addOrganizationFoundation } from './migrations/006_organization_foundation.js';
import { up as addChannelFoundation } from './migrations/007_channel_foundation.js';
import { up as addOrganizationMembership } from './migrations/008_organization_membership.js';
import {
  down as removeInvitationLifecycle,
  up as addInvitationLifecycle,
} from './migrations/012_invitation_lifecycle.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const platformOrganizationId = '81000000-0000-4000-8000-000000000001';
const channelOrganizationId = '81000000-0000-4000-8000-000000000002';
const tenantOrganizationId = '81000000-0000-4000-8000-000000000003';
const otherChannelOrganizationId = '81000000-0000-4000-8000-000000000004';
const channelId = '82000000-0000-4000-8000-000000000001';
const otherChannelId = '82000000-0000-4000-8000-000000000002';
const platformUserId = '83000000-0000-4000-8000-000000000001';
const channelUserId = '83000000-0000-4000-8000-000000000002';
const tenantUserId = '83000000-0000-4000-8000-000000000003';
const inviteeUserId = '83000000-0000-4000-8000-000000000004';
const otherChannelUserId = '83000000-0000-4000-8000-000000000005';
const platformMembershipId = '84000000-0000-4000-8000-000000000001';
const channelMembershipId = '84000000-0000-4000-8000-000000000002';
const tenantMembershipId = '84000000-0000-4000-8000-000000000003';
const otherChannelMembershipId = '84000000-0000-4000-8000-000000000004';
const platformInvitationId = '85000000-0000-4000-8000-000000000001';
const channelInvitationId = '85000000-0000-4000-8000-000000000002';
const tenantInvitationId = '85000000-0000-4000-8000-000000000003';
const registrationOneId = '86000000-0000-4000-8000-000000000001';
const registrationTwoId = '86000000-0000-4000-8000-000000000002';
const usageOneId = '87000000-0000-4000-8000-000000000001';
const usageTwoId = '87000000-0000-4000-8000-000000000002';

const digest = (character: string): string => `sha256:v1:${character.repeat(64)}`;
const requestDigest = (character: string): string => character.repeat(64);

function timeWindow(days: number): { validFrom: string; expiresAt: string } {
  const validFrom = new Date(Date.now() - 60_000);
  return {
    validFrom: validFrom.toISOString(),
    expiresAt: new Date(validFrom.getTime() + days * 86_400_000).toISOString(),
  };
}

async function resetFoundation(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);

  await database('control_plane.tenants').insert({
    tenant_id: tenantOrganizationId,
    display_name: 'Invitation Tenant Fixture',
    status: 'active',
  });
  await database('control_plane.users').insert([
    {
      user_id: platformUserId,
      email: 'platform-inviter@example.com',
      display_name: 'Platform Inviter',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: channelUserId,
      email: 'channel-inviter@example.com',
      display_name: 'Channel Inviter',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: tenantUserId,
      email: 'tenant-inviter@example.com',
      display_name: 'Tenant Inviter',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: inviteeUserId,
      email: 'invitee@example.com',
      display_name: 'Invitee',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: otherChannelUserId,
      email: 'other-channel@example.com',
      display_name: 'Other Channel Inviter',
      password_hash: 'unused',
      status: 'active',
    },
  ]);
  await database('control_plane.memberships').insert({
    membership_id: tenantMembershipId,
    tenant_id: tenantOrganizationId,
    user_id: tenantUserId,
    role_code: 'tenant_admin',
    status: 'active',
  });

  await addOrganizationFoundation(database);
  await addChannelFoundation(database);
  await addOrganizationMembership(database);

  await database('control_plane.organizations').insert([
    {
      organization_id: platformOrganizationId,
      organization_type: 'PLATFORM',
      display_name: 'Invitation Platform Fixture',
      status: 'active',
    },
    {
      organization_id: channelOrganizationId,
      organization_type: 'CHANNEL',
      display_name: 'Invitation Channel Fixture',
      status: 'active',
    },
    {
      organization_id: otherChannelOrganizationId,
      organization_type: 'CHANNEL',
      display_name: 'Other Channel Fixture',
      status: 'active',
    },
  ]);
  await database('control_plane.channels').insert([
    { channel_id: channelId, organization_id: channelOrganizationId },
    { channel_id: otherChannelId, organization_id: otherChannelOrganizationId },
  ]);

  await database.transaction(async (transaction) => {
    await transaction('control_plane.organization_memberships').insert([
      {
        membership_id: platformMembershipId,
        user_id: platformUserId,
        organization_id: platformOrganizationId,
        status: 'active',
        primary_role_code: 'platform_admin',
      },
      {
        membership_id: channelMembershipId,
        user_id: channelUserId,
        organization_id: channelOrganizationId,
        status: 'active',
        primary_role_code: 'channel_admin',
      },
      {
        membership_id: otherChannelMembershipId,
        user_id: otherChannelUserId,
        organization_id: otherChannelOrganizationId,
        status: 'active',
        primary_role_code: 'channel_admin',
      },
    ]);
    await transaction('control_plane.organization_membership_roles').insert([
      { membership_id: platformMembershipId, role_code: 'platform_admin' },
      { membership_id: channelMembershipId, role_code: 'channel_admin' },
      { membership_id: otherChannelMembershipId, role_code: 'channel_admin' },
    ]);
  });
}

async function tableRegistration(database: Knex, tableName: string): Promise<string | null> {
  const result = await database.raw<{ rows: Array<{ table_name: string | null }> }>(
    'select to_regclass(?)::text as table_name',
    [`control_plane.${tableName}`],
  );
  return result.rows[0]?.table_name ?? null;
}

async function insertPlatformInvitation(
  database: Knex,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const window = timeWindow(7);
  await database('control_plane.invitations').insert({
    invitation_id: platformInvitationId,
    issuer_membership_id: platformMembershipId,
    issuer_organization_id: platformOrganizationId,
    invitation_type: 'PLATFORM',
    target_organization_id: null,
    target_role_code: null,
    target_email_normalized: 'new-user@example.com',
    attribution_channel_id: null,
    token_digest: digest('a'),
    status: 'active',
    valid_from: window.validFrom,
    expires_at: window.expiresAt,
    max_uses: 1,
    creation_idempotency_key: 'platform-invitation-key',
    creation_request_digest: requestDigest('a'),
    ...overrides,
  });
}

async function insertChannelInvitation(
  database: Knex,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const window = timeWindow(30);
  await database('control_plane.invitations').insert({
    invitation_id: channelInvitationId,
    issuer_membership_id: channelMembershipId,
    issuer_organization_id: channelOrganizationId,
    invitation_type: 'CHANNEL',
    target_organization_id: null,
    target_role_code: null,
    target_email_normalized: null,
    attribution_channel_id: channelId,
    token_digest: digest('b'),
    status: 'active',
    valid_from: window.validFrom,
    expires_at: window.expiresAt,
    max_uses: 100,
    creation_idempotency_key: 'channel-invitation-key',
    creation_request_digest: requestDigest('b'),
    ...overrides,
  });
}

async function insertTenantInvitation(
  database: Knex,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const window = timeWindow(7);
  await database('control_plane.invitations').insert({
    invitation_id: tenantInvitationId,
    issuer_membership_id: tenantMembershipId,
    issuer_organization_id: tenantOrganizationId,
    invitation_type: 'TENANT_MEMBER',
    target_organization_id: tenantOrganizationId,
    target_role_code: 'content_operator',
    target_email_normalized: 'worker@example.com',
    attribution_channel_id: null,
    token_digest: digest('c'),
    status: 'active',
    valid_from: window.validFrom,
    expires_at: window.expiresAt,
    max_uses: 1,
    creation_idempotency_key: 'tenant-invitation-key',
    creation_request_digest: requestDigest('c'),
    ...overrides,
  });
}

async function insertUsage(database: Knex, overrides: Record<string, unknown> = {}): Promise<void> {
  await database('control_plane.invitation_usages').insert({
    invitation_usage_id: usageOneId,
    invitation_id: platformInvitationId,
    registration_id: registrationOneId,
    user_id: inviteeUserId,
    used_at: new Date().toISOString(),
    idempotency_key: 'registration-use-key',
    request_digest: requestDigest('d'),
    ...overrides,
  });
}

describe.runIf(hasDedicatedTestDatabase)('migration 012 invitation lifecycle', () => {
  let database: Knex;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await resetFoundation(database);
  });

  afterAll(async () => {
    if (!database) return;
    await database.raw('drop schema if exists control_plane cascade');
    await database.destroy();
  });

  it('creates Invitation and append-only Usage tables without seeding credentials', async () => {
    await addInvitationLifecycle(database);

    await expect(
      Promise.all(
        ['invitations', 'invitation_usages'].map((tableName) =>
          tableRegistration(database, tableName),
        ),
      ),
    ).resolves.toEqual(['control_plane.invitations', 'control_plane.invitation_usages']);
    await expect(
      database('control_plane.invitations').count('* as count').first(),
    ).resolves.toMatchObject({ count: '0' });
  });

  it('enforces PLATFORM, CHANNEL and TENANT_MEMBER issuer and scope invariants', async () => {
    await addInvitationLifecycle(database);
    await insertPlatformInvitation(database);
    await insertChannelInvitation(database);
    await insertTenantInvitation(database);

    await expect(
      insertChannelInvitation(database, {
        invitation_id: '85000000-0000-4000-8000-000000000010',
        token_digest: digest('d'),
        creation_idempotency_key: 'spoofed-channel-key',
        creation_request_digest: requestDigest('d'),
        attribution_channel_id: otherChannelId,
      }),
    ).rejects.toThrow(/channel|scope|attribution/i);
    await expect(
      insertTenantInvitation(database, {
        invitation_id: '85000000-0000-4000-8000-000000000011',
        token_digest: digest('e'),
        creation_idempotency_key: 'elevated-role-key',
        creation_request_digest: requestDigest('e'),
        target_role_code: 'tenant_admin',
      }),
    ).rejects.toThrow(/role|content_operator|tenant/i);
    await expect(
      insertPlatformInvitation(database, {
        invitation_id: '85000000-0000-4000-8000-000000000012',
        token_digest: digest('f'),
        creation_idempotency_key: 'wrong-issuer-key',
        creation_request_digest: requestDigest('f'),
        issuer_membership_id: channelMembershipId,
        issuer_organization_id: channelOrganizationId,
      }),
    ).rejects.toThrow(/platform|issuer|membership/i);
  });

  it('caps directed Invitations at seven days/one use and Channel shares at thirty days/100 uses', async () => {
    await addInvitationLifecycle(database);
    const eightDays = timeWindow(8);
    const thirtyOneDays = timeWindow(31);

    await expect(
      insertPlatformInvitation(database, {
        expires_at: eightDays.expiresAt,
      }),
    ).rejects.toThrow(/seven|7|duration|window/i);
    await expect(insertTenantInvitation(database, { max_uses: 2 })).rejects.toThrow(
      /max|use|single|1/i,
    );
    await expect(
      insertChannelInvitation(database, {
        expires_at: thirtyOneDays.expiresAt,
      }),
    ).rejects.toThrow(/thirty|30|duration|window/i);
    await expect(insertChannelInvitation(database, { max_uses: 101 })).rejects.toThrow(
      /max|use|100/i,
    );
  });

  it('stores only unique versioned token digests and scoped creation idempotency evidence', async () => {
    await addInvitationLifecycle(database);
    await insertPlatformInvitation(database);

    await expect(
      insertChannelInvitation(database, {
        token_digest: digest('a'),
      }),
    ).rejects.toThrow(/token|unique|duplicate/i);
    await expect(
      insertPlatformInvitation(database, {
        invitation_id: '85000000-0000-4000-8000-000000000020',
        token_digest: 'plaintext-token',
        creation_idempotency_key: 'invalid-digest-key',
      }),
    ).rejects.toThrow(/token|digest|check/i);
    await expect(
      insertPlatformInvitation(database, {
        invitation_id: '85000000-0000-4000-8000-000000000021',
        token_digest: digest('f'),
        creation_request_digest: requestDigest('f'),
      }),
    ).rejects.toThrow(/idempotency|unique|duplicate/i);
  });

  it('makes Invitation scope immutable and lifecycle terminal', async () => {
    await addInvitationLifecycle(database);
    await insertPlatformInvitation(database);

    await expect(
      database('control_plane.invitations')
        .where({ invitation_id: platformInvitationId })
        .update({ target_email_normalized: 'attacker@example.com' }),
    ).rejects.toThrow(/immutable|scope|target/i);

    await database('control_plane.invitations')
      .where({ invitation_id: platformInvitationId })
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by_membership_id: platformMembershipId,
      });
    await expect(
      database('control_plane.invitations')
        .where({ invitation_id: platformInvitationId })
        .update({ status: 'active', revoked_at: null, revoked_by_membership_id: null }),
    ).rejects.toThrow(/terminal|lifecycle|revoked/i);
    await expect(
      database('control_plane.invitations').where({ invitation_id: platformInvitationId }).del(),
    ).rejects.toThrow(/delete|audit|invitation/i);
  });

  it('atomically records append-only Usage, increments usedCount and exhausts the final slot', async () => {
    await addInvitationLifecycle(database);
    await insertPlatformInvitation(database);
    await insertUsage(database);

    await expect(
      database('control_plane.invitations')
        .select('used_count', 'status')
        .where({ invitation_id: platformInvitationId })
        .first(),
    ).resolves.toEqual({ used_count: 1, status: 'exhausted' });
    await expect(
      database('control_plane.invitation_usages')
        .where({ invitation_usage_id: usageOneId })
        .update({ user_id: platformUserId }),
    ).rejects.toThrow(/append|immutable|usage/i);
    await expect(
      database('control_plane.invitation_usages').where({ invitation_usage_id: usageOneId }).del(),
    ).rejects.toThrow(/append|delete|usage/i);
    await expect(
      insertUsage(database, {
        invitation_usage_id: usageTwoId,
        registration_id: registrationTwoId,
        idempotency_key: 'second-registration-use-key',
        request_digest: requestDigest('e'),
      }),
    ).rejects.toThrow(/exhausted|available|usage|limit/i);
  });

  it('rejects revoked or expired Invitation usage and duplicate replay identities', async () => {
    await addInvitationLifecycle(database);
    await insertPlatformInvitation(database);
    await database('control_plane.invitations')
      .where({ invitation_id: platformInvitationId })
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by_membership_id: platformMembershipId,
      });
    await expect(insertUsage(database)).rejects.toThrow(/revoked|available|active/i);

    const expiredInvitationId = '85000000-0000-4000-8000-000000000030';
    const expiredAt = new Date(Date.now() - 86_400_000);
    await insertPlatformInvitation(database, {
      invitation_id: expiredInvitationId,
      token_digest: digest('e'),
      status: 'expired',
      valid_from: new Date(expiredAt.getTime() - 86_400_000).toISOString(),
      expires_at: expiredAt.toISOString(),
      creation_idempotency_key: 'expired-platform-invitation-key',
      creation_request_digest: requestDigest('e'),
    });
    await expect(
      insertUsage(database, {
        invitation_usage_id: usageTwoId,
        invitation_id: expiredInvitationId,
        registration_id: registrationTwoId,
        idempotency_key: 'expired-registration-use-key',
        request_digest: requestDigest('e'),
      }),
    ).rejects.toThrow(/expired|available|active/i);
  });

  it('serializes concurrent final-slot Usage so only one registration succeeds', async () => {
    await addInvitationLifecycle(database);
    await insertPlatformInvitation(database);
    const contender = knex({ client: 'pg', connection: databaseUrl });

    try {
      const results = await Promise.allSettled([
        insertUsage(database),
        insertUsage(contender, {
          invitation_usage_id: usageTwoId,
          registration_id: registrationTwoId,
          idempotency_key: 'concurrent-registration-use-key',
          request_digest: requestDigest('e'),
        }),
      ]);
      expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
      expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
      await expect(
        database('control_plane.invitation_usages')
          .where({ invitation_id: platformInvitationId })
          .count('* as count')
          .first(),
      ).resolves.toMatchObject({ count: '1' });
    } finally {
      await contender.destroy();
    }
  });

  it('allows empty rollback but fails closed once Invitation audit facts exist', async () => {
    await addInvitationLifecycle(database);
    await removeInvitationLifecycle(database);
    await expect(tableRegistration(database, 'invitations')).resolves.toBeNull();

    await addInvitationLifecycle(database);
    await insertPlatformInvitation(database);
    await expect(removeInvitationLifecycle(database)).rejects.toThrow(/invitation|audit|rollback/i);
  });
});
