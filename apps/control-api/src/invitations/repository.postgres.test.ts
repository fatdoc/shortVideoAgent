import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from '../db/migrations/001_pilot_core.js';
import { up as addOrganizationFoundation } from '../db/migrations/006_organization_foundation.js';
import { up as addChannelFoundation } from '../db/migrations/007_channel_foundation.js';
import { up as addOrganizationMembership } from '../db/migrations/008_organization_membership.js';
import { up as addInvitationLifecycle } from '../db/migrations/012_invitation_lifecycle.js';
import {
  InvitationIdempotencyConflictError,
  InvitationNotFoundError,
  InvitationStateConflictError,
  InvitationUnavailableError,
} from './errors.js';
import { PostgresInvitationRepository } from './repository.js';
import type { CreateInvitationRecord } from './types.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const now = new Date('2026-08-07T12:00:00.000Z');
const platformOrganizationId = '91000000-0000-4000-8000-000000000001';
const channelOrganizationId = '91000000-0000-4000-8000-000000000002';
const tenantOrganizationId = '91000000-0000-4000-8000-000000000003';
const otherChannelOrganizationId = '91000000-0000-4000-8000-000000000004';
const channelId = '92000000-0000-4000-8000-000000000001';
const otherChannelId = '92000000-0000-4000-8000-000000000002';
const platformUserId = '93000000-0000-4000-8000-000000000001';
const channelUserId = '93000000-0000-4000-8000-000000000002';
const tenantUserId = '93000000-0000-4000-8000-000000000003';
const inviteeUserId = '93000000-0000-4000-8000-000000000004';
const platformMembershipId = '94000000-0000-4000-8000-000000000001';
const channelMembershipId = '94000000-0000-4000-8000-000000000002';
const tenantMembershipId = '94000000-0000-4000-8000-000000000003';
const invitationIds = [
  '95000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000002',
  '95000000-0000-4000-8000-000000000003',
  '95000000-0000-4000-8000-000000000004',
  '95000000-0000-4000-8000-000000000005',
];
const usageIds = [
  '96000000-0000-4000-8000-000000000001',
  '96000000-0000-4000-8000-000000000002',
  '96000000-0000-4000-8000-000000000003',
];

const tokenDigest = (character: string): string => `sha256:v1:${character.repeat(64)}`;
const requestDigest = (character: string): string => character.repeat(64);

async function resetFoundation(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);
  await database('control_plane.tenants').insert({
    tenant_id: tenantOrganizationId,
    display_name: 'Invitation Repository Tenant',
    status: 'active',
  });
  await database('control_plane.users').insert([
    {
      user_id: platformUserId,
      email: 'repository-platform@example.com',
      display_name: 'Repository Platform',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: channelUserId,
      email: 'repository-channel@example.com',
      display_name: 'Repository Channel',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: tenantUserId,
      email: 'repository-tenant@example.com',
      display_name: 'Repository Tenant',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: inviteeUserId,
      email: 'repository-invitee@example.com',
      display_name: 'Repository Invitee',
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
      display_name: 'Repository Platform Organization',
      status: 'active',
    },
    {
      organization_id: channelOrganizationId,
      organization_type: 'CHANNEL',
      display_name: 'Repository Channel Organization',
      status: 'active',
    },
    {
      organization_id: otherChannelOrganizationId,
      organization_type: 'CHANNEL',
      display_name: 'Repository Other Channel',
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
    ]);
    await transaction('control_plane.organization_membership_roles').insert([
      { membership_id: platformMembershipId, role_code: 'platform_admin' },
      { membership_id: channelMembershipId, role_code: 'channel_admin' },
    ]);
  });
  await addInvitationLifecycle(database);
}

function creation(
  invitationType: CreateInvitationRecord['invitationType'],
  overrides: Partial<CreateInvitationRecord> = {},
): CreateInvitationRecord {
  const directed = invitationType !== 'CHANNEL';
  const issuerMembershipId =
    invitationType === 'PLATFORM'
      ? platformMembershipId
      : invitationType === 'CHANNEL'
        ? channelMembershipId
        : tenantMembershipId;
  const issuerOrganizationId =
    invitationType === 'PLATFORM'
      ? platformOrganizationId
      : invitationType === 'CHANNEL'
        ? channelOrganizationId
        : tenantOrganizationId;
  return {
    issuerMembershipId,
    issuerOrganizationId,
    invitationType,
    targetOrganizationId: invitationType === 'TENANT_MEMBER' ? tenantOrganizationId : null,
    targetRoleCode: invitationType === 'TENANT_MEMBER' ? 'content_operator' : null,
    targetEmailNormalized: directed ? `${invitationType.toLowerCase()}@example.com` : null,
    attributionChannelId: null,
    tokenDigest:
      invitationType === 'PLATFORM'
        ? tokenDigest('a')
        : invitationType === 'CHANNEL'
          ? tokenDigest('b')
          : tokenDigest('c'),
    validFrom: now,
    expiresAt: new Date(now.getTime() + (directed ? 7 : 30) * 86_400_000),
    maxUses: directed ? 1 : 100,
    creationIdempotencyKey: `${invitationType.toLowerCase()}-create-1`,
    creationRequestDigest:
      invitationType === 'PLATFORM'
        ? requestDigest('a')
        : invitationType === 'CHANNEL'
          ? requestDigest('b')
          : requestDigest('c'),
    ...overrides,
  };
}

describe.runIf(hasDedicatedTestDatabase)('PostgresInvitationRepository', () => {
  let database: Knex;
  let repository: PostgresInvitationRepository;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await resetFoundation(database);
    const ids = { invitation: [...invitationIds], usage: [...usageIds] };
    repository = new PostgresInvitationRepository(
      database,
      () => now,
      (entity) => ids[entity].shift() ?? '97000000-0000-4000-8000-000000000001',
    );
  });

  afterAll(async () => {
    if (!database) return;
    await database.raw('drop schema if exists control_plane cascade');
    await database.destroy();
  });

  it('creates all three types, derives the Channel id, and lists only the issuer scope', async () => {
    const platform = await repository.create(creation('PLATFORM'));
    const channel = await repository.create(creation('CHANNEL'));
    const tenant = await repository.create(creation('TENANT_MEMBER'));

    expect(platform).toMatchObject({ replayed: false, value: { invitationType: 'PLATFORM' } });
    expect(channel).toMatchObject({
      replayed: false,
      value: { invitationType: 'CHANNEL', attributionChannelId: channelId, maxUses: 100 },
    });
    expect(tenant).toMatchObject({
      replayed: false,
      value: {
        invitationType: 'TENANT_MEMBER',
        targetOrganizationId: tenantOrganizationId,
        targetRoleCode: 'content_operator',
      },
    });
    await expect(repository.listByIssuerOrganization(platformOrganizationId, now)).resolves.toEqual(
      [platform.value],
    );
  });

  it('replays an identical scoped creation without replacing its Token and rejects conflicting facts', async () => {
    const first = await repository.create(creation('PLATFORM'));
    const replay = await repository.create(
      creation('PLATFORM', {
        tokenDigest: tokenDigest('d'),
        validFrom: new Date(now.getTime() + 60_000),
        expiresAt: new Date(now.getTime() + 7 * 86_400_000 + 60_000),
      }),
    );

    expect(replay).toEqual({ value: first.value, replayed: true });
    await expect(
      repository.create(
        creation('PLATFORM', {
          targetEmailNormalized: 'different@example.com',
          creationRequestDigest: requestDigest('f'),
        }),
      ),
    ).rejects.toBeInstanceOf(InvitationIdempotencyConflictError);
  });

  it('finds only currently available Token digests without exposing unavailable states', async () => {
    const created = await repository.create(creation('PLATFORM'));

    await expect(repository.findAvailableByTokenDigest(tokenDigest('a'), now)).resolves.toEqual(
      created.value,
    );
    await expect(
      repository.findAvailableByTokenDigest(tokenDigest('a'), new Date(created.value.expiresAt)),
    ).resolves.toBeNull();
    await expect(repository.findAvailableByTokenDigest(tokenDigest('f'), now)).resolves.toBeNull();
  });

  it('revokes only inside the issuer scope and replays the same terminal fact safely', async () => {
    const created = await repository.create(creation('PLATFORM'));

    await expect(
      repository.revoke({
        invitationId: created.value.invitationId,
        issuerOrganizationId: channelOrganizationId,
        revokedByMembershipId: channelMembershipId,
        revokedAt: now,
      }),
    ).rejects.toBeInstanceOf(InvitationNotFoundError);

    const revoked = await repository.revoke({
      invitationId: created.value.invitationId,
      issuerOrganizationId: platformOrganizationId,
      revokedByMembershipId: platformMembershipId,
      revokedAt: now,
    });
    expect(revoked).toMatchObject({ replayed: false, value: { status: 'revoked' } });
    await expect(
      repository.revoke({
        invitationId: created.value.invitationId,
        issuerOrganizationId: platformOrganizationId,
        revokedByMembershipId: platformMembershipId,
        revokedAt: now,
      }),
    ).resolves.toEqual({ value: revoked.value, replayed: true });
  });

  it('consumes a targeted Invitation atomically and safely replays the same registration command', async () => {
    const created = await repository.create(creation('PLATFORM'));
    const consumeInput = {
      tokenDigest: tokenDigest('a'),
      registrationId: '98000000-0000-4000-8000-000000000001',
      userId: inviteeUserId,
      emailNormalized: 'platform@example.com',
      idempotencyKey: 'registration-use-1',
      requestDigest: requestDigest('d'),
      usedAt: now,
    };

    await expect(
      repository.consume({ ...consumeInput, emailNormalized: 'attacker@example.com' }),
    ).rejects.toBeInstanceOf(InvitationUnavailableError);
    const consumed = await repository.consume(consumeInput);
    expect(consumed).toMatchObject({
      replayed: false,
      value: {
        invitation: { invitationId: created.value.invitationId, status: 'exhausted', usedCount: 1 },
        usage: { registrationId: consumeInput.registrationId, userId: inviteeUserId },
      },
    });
    await expect(repository.consume(consumeInput)).resolves.toEqual({
      value: consumed.value,
      replayed: true,
    });
    await expect(
      repository.consume({ ...consumeInput, requestDigest: requestDigest('e') }),
    ).rejects.toBeInstanceOf(InvitationIdempotencyConflictError);
    await expect(
      database('control_plane.invitation_usages')
        .where({ invitation_id: created.value.invitationId })
        .count('* as count')
        .first(),
    ).resolves.toMatchObject({ count: '1' });
  });

  it('rejects new Usage after revoke, expiration or exhaustion', async () => {
    const revoked = await repository.create(creation('PLATFORM'));
    await repository.revoke({
      invitationId: revoked.value.invitationId,
      issuerOrganizationId: platformOrganizationId,
      revokedByMembershipId: platformMembershipId,
      revokedAt: now,
    });
    await expect(
      repository.consume({
        tokenDigest: tokenDigest('a'),
        registrationId: '98000000-0000-4000-8000-000000000002',
        userId: inviteeUserId,
        emailNormalized: 'platform@example.com',
        idempotencyKey: 'revoked-use',
        requestDigest: requestDigest('d'),
        usedAt: now,
      }),
    ).rejects.toBeInstanceOf(InvitationUnavailableError);

    await repository.create(
      creation('CHANNEL', {
        tokenDigest: tokenDigest('e'),
        validFrom: new Date(now.getTime() - 31 * 86_400_000),
        expiresAt: new Date(now.getTime() - 86_400_000),
      }),
    );
    await expect(
      repository.listByIssuerOrganization(channelOrganizationId, now),
    ).resolves.toMatchObject([{ status: 'expired' }]);
    await expect(
      repository.consume({
        tokenDigest: tokenDigest('e'),
        registrationId: '98000000-0000-4000-8000-000000000003',
        userId: inviteeUserId,
        emailNormalized: 'anyone@example.com',
        idempotencyKey: 'expired-use',
        requestDigest: requestDigest('e'),
        usedAt: now,
      }),
    ).rejects.toBeInstanceOf(InvitationUnavailableError);

    await expect(
      repository.revoke({
        invitationId: revoked.value.invitationId,
        issuerOrganizationId: platformOrganizationId,
        revokedByMembershipId: platformMembershipId,
        revokedAt: now,
      }),
    ).resolves.toMatchObject({ replayed: true });
  });

  it('maps a terminal-state revoke conflict without deleting audit evidence', async () => {
    const created = await repository.create(creation('PLATFORM'));
    await repository.consume({
      tokenDigest: tokenDigest('a'),
      registrationId: '98000000-0000-4000-8000-000000000004',
      userId: inviteeUserId,
      emailNormalized: 'platform@example.com',
      idempotencyKey: 'final-use',
      requestDigest: requestDigest('f'),
      usedAt: now,
    });

    await expect(
      repository.revoke({
        invitationId: created.value.invitationId,
        issuerOrganizationId: platformOrganizationId,
        revokedByMembershipId: platformMembershipId,
        revokedAt: now,
      }),
    ).rejects.toBeInstanceOf(InvitationStateConflictError);
  });
});
