import { createHash } from 'node:crypto';
import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { migrationConfig } from '../db/migrationConfig.js';
import { digestInvitationToken } from '../invitations/token.js';
import {
  RegistrationConflictError,
  RegistrationIdempotencyConflictError,
  RegistrationInvitationUnavailableError,
  RegistrationTermsNotAvailableError,
} from './errors.js';
import { PostgresRegistrationRepository } from './repository.js';
import type { RegistrationRecordInput } from './types.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const completedAt = new Date('2026-08-08T06:00:00.000Z');
const platformOrganizationId = 'b1000000-0000-4000-8000-000000000001';
const channelOrganizationId = 'b1000000-0000-4000-8000-000000000002';
const targetTenantId = 'b1000000-0000-4000-8000-000000000003';
const channelId = 'b2000000-0000-4000-8000-000000000001';
const publisherUserId = 'b3000000-0000-4000-8000-000000000001';
const platformUserId = 'b3000000-0000-4000-8000-000000000002';
const channelUserId = 'b3000000-0000-4000-8000-000000000003';
const tenantAdminUserId = 'b3000000-0000-4000-8000-000000000004';
const platformMembershipId = 'b4000000-0000-4000-8000-000000000001';
const channelMembershipId = 'b4000000-0000-4000-8000-000000000002';
const tenantAdminMembershipId = 'b4000000-0000-4000-8000-000000000003';
const termsDocumentId = 'b5000000-0000-4000-8000-000000000001';
const termsVersionId = 'b5000000-0000-4000-8000-000000000002';
const platformInvitationId = 'b6000000-0000-4000-8000-000000000001';
const channelInvitationId = 'b6000000-0000-4000-8000-000000000002';
const tenantInvitationId = 'b6000000-0000-4000-8000-000000000003';
const platformToken = 'A'.repeat(43);
const channelToken = 'B'.repeat(43);
const tenantToken = 'C'.repeat(43);

const content = 'Current public registration terms.';
const contentDigest = createHash('sha256').update(content, 'utf8').digest('hex');
const requestDigest = (character: string): string => character.repeat(64);

const defaultIds: Record<string, string> = {
  organization: 'c1000000-0000-4000-8000-000000000001',
  tenant: 'c2000000-0000-4000-8000-000000000001',
  user: 'c3000000-0000-4000-8000-000000000001',
  membership: 'c4000000-0000-4000-8000-000000000001',
  registration: 'c5000000-0000-4000-8000-000000000001',
  consent: 'c6000000-0000-4000-8000-000000000001',
  usage: 'c7000000-0000-4000-8000-000000000001',
  attribution: 'c8000000-0000-4000-8000-000000000001',
  event: 'c9000000-0000-4000-8000-000000000001',
};

async function resetDatabase(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await database.schema.withSchema('public').dropTableIfExists('control_api_migrations_lock');
  await database.schema.withSchema('public').dropTableIfExists('control_api_migrations');
  await database.migrate.latest(migrationConfig(new URL('../db/migrate.ts', import.meta.url).href));

  await database('control_plane.users').insert([
    {
      user_id: publisherUserId,
      email: 'publisher@example.com',
      display_name: 'Terms Publisher',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: platformUserId,
      email: 'platform@example.com',
      display_name: 'Platform Admin',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: channelUserId,
      email: 'channel@example.com',
      display_name: 'Channel Admin',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: tenantAdminUserId,
      email: 'tenant-admin@example.com',
      display_name: 'Tenant Admin',
      password_hash: 'unused',
      status: 'active',
    },
  ]);
  await database('control_plane.organizations').insert([
    {
      organization_id: platformOrganizationId,
      organization_type: 'PLATFORM',
      display_name: 'Platform Fixture',
      status: 'active',
    },
    {
      organization_id: channelOrganizationId,
      organization_type: 'CHANNEL',
      display_name: 'Channel Fixture',
      status: 'active',
    },
    {
      organization_id: targetTenantId,
      organization_type: 'TENANT',
      display_name: 'Target Tenant Fixture',
      status: 'active',
    },
  ]);
  await database('control_plane.tenants').insert({
    tenant_id: targetTenantId,
    organization_id: targetTenantId,
    display_name: 'Target Tenant Fixture',
    status: 'active',
  });
  await database('control_plane.channels').insert({
    channel_id: channelId,
    organization_id: channelOrganizationId,
  });
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
        membership_id: tenantAdminMembershipId,
        user_id: tenantAdminUserId,
        organization_id: targetTenantId,
        status: 'active',
        primary_role_code: 'tenant_admin',
      },
    ]);
    await transaction('control_plane.organization_membership_roles').insert([
      { membership_id: platformMembershipId, role_code: 'platform_admin' },
      { membership_id: channelMembershipId, role_code: 'channel_admin' },
      { membership_id: tenantAdminMembershipId, role_code: 'tenant_admin' },
    ]);
  });

  await database('control_plane.terms_documents').insert({
    terms_document_id: termsDocumentId,
    document_code: 'registration-notice',
    title: 'Registration notice',
    status: 'active',
  });
  await database('control_plane.terms_versions').insert({
    terms_version_id: termsVersionId,
    terms_document_id: termsDocumentId,
    version_label: 'public-v1',
    status: 'PUBLISHED',
    content,
    content_digest: contentDigest,
    locale: 'zh-CN',
    published_at: '2026-08-08T04:00:00.000Z',
    effective_at: '2026-08-08T05:00:00.000Z',
    published_by: publisherUserId,
    must_reaccept: false,
  });

  const validFrom = '2026-08-08T00:00:00.000Z';
  const directedExpiresAt = '2026-08-15T00:00:00.000Z';
  const channelExpiresAt = '2026-09-07T00:00:00.000Z';
  await database('control_plane.invitations').insert([
    {
      invitation_id: platformInvitationId,
      issuer_membership_id: platformMembershipId,
      issuer_organization_id: platformOrganizationId,
      invitation_type: 'PLATFORM',
      target_organization_id: null,
      target_role_code: null,
      target_email_normalized: 'platform-new@example.com',
      attribution_channel_id: null,
      token_digest: digestInvitationToken(platformToken),
      status: 'active',
      valid_from: validFrom,
      expires_at: directedExpiresAt,
      max_uses: 1,
      creation_idempotency_key: 'platform-registration-fixture',
      creation_request_digest: requestDigest('1'),
    },
    {
      invitation_id: channelInvitationId,
      issuer_membership_id: channelMembershipId,
      issuer_organization_id: channelOrganizationId,
      invitation_type: 'CHANNEL',
      target_organization_id: null,
      target_role_code: null,
      target_email_normalized: null,
      attribution_channel_id: channelId,
      token_digest: digestInvitationToken(channelToken),
      status: 'active',
      valid_from: validFrom,
      expires_at: channelExpiresAt,
      max_uses: 1,
      creation_idempotency_key: 'channel-registration-fixture',
      creation_request_digest: requestDigest('2'),
    },
    {
      invitation_id: tenantInvitationId,
      issuer_membership_id: tenantAdminMembershipId,
      issuer_organization_id: targetTenantId,
      invitation_type: 'TENANT_MEMBER',
      target_organization_id: targetTenantId,
      target_role_code: 'content_operator',
      target_email_normalized: 'tenant-member@example.com',
      attribution_channel_id: null,
      token_digest: digestInvitationToken(tenantToken),
      status: 'active',
      valid_from: validFrom,
      expires_at: directedExpiresAt,
      max_uses: 1,
      creation_idempotency_key: 'tenant-registration-fixture',
      creation_request_digest: requestDigest('3'),
    },
  ]);
}

function ids(overrides: Partial<Record<string, string>> = {}) {
  const values = { ...defaultIds, ...overrides };
  return (entity: string): string => {
    const value = values[entity];
    if (!value) throw new Error(`missing test id for ${entity}`);
    return value;
  };
}

function record(overrides: Partial<RegistrationRecordInput> = {}): RegistrationRecordInput {
  return {
    normalizedEmail: 'direct-new@example.com',
    passwordHash: 'scrypt$16384$8$1$c2FsdA==$a2V5',
    displayName: 'Direct New User',
    tenantDisplayName: 'Direct Studio',
    invitationTokenDigest: null,
    termsVersionId,
    locale: 'zh-CN',
    idempotencyKey: 'register-direct-1',
    requestDigest: requestDigest('4'),
    verificationEvidenceId: 'email-verification-evidence-1',
    completedAt,
    ...overrides,
  };
}

async function counts(database: Knex) {
  const tableNames = [
    'users',
    'organizations',
    'tenants',
    'memberships',
    'organization_memberships',
    'registrations',
    'user_consents',
    'invitation_usages',
    'referral_attributions',
    'referral_attribution_events',
  ];
  return Object.fromEntries(
    await Promise.all(
      tableNames.map(async (tableName) => {
        const row = (await database(`control_plane.${tableName}`).count('* as count').first()) as {
          count: string;
        };
        return [tableName, Number(row.count)];
      }),
    ),
  );
}

describe.runIf(hasDedicatedTestDatabase)('PostgresRegistrationRepository', () => {
  let database: Knex;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await resetDatabase(database);
  });

  afterAll(async () => {
    if (!database) return;
    await database.raw('drop schema if exists control_plane cascade');
    await database.schema.withSchema('public').dropTableIfExists('control_api_migrations_lock');
    await database.schema.withSchema('public').dropTableIfExists('control_api_migrations');
    await database.destroy();
  });

  it('atomically creates a direct User, personal Tenant, admin Membership, Consent and Attribution', async () => {
    const repository = new PostgresRegistrationRepository(database, ids());

    await expect(repository.register(record())).resolves.toEqual({
      value: {
        registrationId: defaultIds.registration,
        userId: defaultIds.user,
        tenantId: defaultIds.tenant,
        membershipId: defaultIds.membership,
        registrationPath: 'DIRECT',
        completedAt: completedAt.toISOString(),
      },
      replayed: false,
    });
    await expect(
      database('control_plane.memberships')
        .select('role_code', 'status')
        .where({ membership_id: defaultIds.membership })
        .first(),
    ).resolves.toEqual({ role_code: 'tenant_admin', status: 'active' });
    await expect(
      database('control_plane.user_consents')
        .select('registration_id', 'evidence_metadata')
        .where({ registration_id: defaultIds.registration })
        .first(),
    ).resolves.toMatchObject({
      registration_id: defaultIds.registration,
      evidence_metadata: {
        channel: 'web',
        explicitAccepted: true,
        verificationEvidenceId: 'email-verification-evidence-1',
      },
    });
    await expect(
      database('control_plane.referral_attributions')
        .select('acquisition_source', 'referrer_channel_id', 'protected_until')
        .where({ registration_id: defaultIds.registration })
        .first(),
    ).resolves.toEqual({
      acquisition_source: 'DIRECT',
      referrer_channel_id: null,
      protected_until: null,
    });
  });

  it('derives PLATFORM and CHANNEL paths and freezes Channel protection for twelve calendar months', async () => {
    const platformRepository = new PostgresRegistrationRepository(database, ids());
    await expect(
      platformRepository.register(
        record({
          normalizedEmail: 'platform-new@example.com',
          displayName: 'Platform New User',
          invitationTokenDigest: digestInvitationToken(platformToken),
          idempotencyKey: 'register-platform-1',
          requestDigest: requestDigest('5'),
        }),
      ),
    ).resolves.toMatchObject({ value: { registrationPath: 'PLATFORM_INVITATION' } });

    await resetDatabase(database);
    const channelRepository = new PostgresRegistrationRepository(database, ids());
    await expect(
      channelRepository.register(
        record({
          normalizedEmail: 'channel-new@example.com',
          displayName: 'Channel New User',
          invitationTokenDigest: digestInvitationToken(channelToken),
          idempotencyKey: 'register-channel-1',
          requestDigest: requestDigest('6'),
        }),
      ),
    ).resolves.toMatchObject({ value: { registrationPath: 'CHANNEL_INVITATION' } });
    const attribution = (await database('control_plane.referral_attributions')
      .select('referrer_channel_id', 'effective_from', 'protected_until')
      .where({ registration_id: defaultIds.registration })
      .first()) as {
      referrer_channel_id: string;
      effective_from: Date;
      protected_until: Date;
    };
    expect(attribution.referrer_channel_id).toBe(channelId);
    expect(attribution.effective_from.toISOString()).toBe(completedAt.toISOString());
    expect(attribution.protected_until.toISOString()).toBe('2027-08-08T06:00:00.000Z');
    await expect(
      database('control_plane.invitation_usages')
        .where({ registration_id: defaultIds.registration })
        .count('* as count')
        .first(),
    ).resolves.toMatchObject({ count: '1' });
  });

  it('joins a TENANT_MEMBER to the target Tenant without creating a second Tenant', async () => {
    const before = await counts(database);
    const repository = new PostgresRegistrationRepository(database, ids());

    await expect(
      repository.register(
        record({
          normalizedEmail: 'tenant-member@example.com',
          displayName: 'Tenant Member',
          tenantDisplayName: null,
          invitationTokenDigest: digestInvitationToken(tenantToken),
          idempotencyKey: 'register-tenant-member-1',
          requestDigest: requestDigest('7'),
        }),
      ),
    ).resolves.toMatchObject({
      value: {
        tenantId: targetTenantId,
        registrationPath: 'TENANT_MEMBER_INVITATION',
      },
    });
    const after = await counts(database);
    expect(after.tenants).toBe(before.tenants);
    expect(after.organizations).toBe(before.organizations);
    await expect(
      database('control_plane.memberships')
        .select('tenant_id', 'role_code')
        .where({ membership_id: defaultIds.membership })
        .first(),
    ).resolves.toEqual({ tenant_id: targetTenantId, role_code: 'content_operator' });
  });

  it('safely replays the same command and rejects a different payload for the same key', async () => {
    const repository = new PostgresRegistrationRepository(database, ids());
    const first = await repository.register(record());

    await expect(repository.register(record())).resolves.toEqual({ ...first, replayed: true });
    await expect(
      repository.register(record({ requestDigest: requestDigest('8') })),
    ).rejects.toBeInstanceOf(RegistrationIdempotencyConflictError);
    await expect(
      database('control_plane.registrations').count('* as count').first(),
    ).resolves.toMatchObject({ count: '1' });
  });

  it('fails closed for stale Terms, unavailable Invitation and an existing account with zero partial writes', async () => {
    const baseline = await counts(database);
    const repository = new PostgresRegistrationRepository(database, ids());

    await expect(
      repository.register(record({ termsVersionId: 'b5000000-0000-4000-8000-000000000099' })),
    ).rejects.toBeInstanceOf(RegistrationTermsNotAvailableError);
    expect(await counts(database)).toEqual(baseline);

    await expect(
      repository.register(record({ invitationTokenDigest: digestInvitationToken('Z'.repeat(43)) })),
    ).rejects.toBeInstanceOf(RegistrationInvitationUnavailableError);
    expect(await counts(database)).toEqual(baseline);

    await expect(
      repository.register(record({ normalizedEmail: 'publisher@example.com' })),
    ).rejects.toBeInstanceOf(RegistrationConflictError);
    expect(await counts(database)).toEqual(baseline);
  });

  it('rolls back Invitation usage and every prior write when a late Attribution insert fails', async () => {
    const baseline = await counts(database);
    const repository = new PostgresRegistrationRepository(
      database,
      ids({ attribution: 'not-a-uuid' }),
    );

    await expect(
      repository.register(
        record({
          normalizedEmail: 'channel-new@example.com',
          displayName: 'Channel New User',
          invitationTokenDigest: digestInvitationToken(channelToken),
          idempotencyKey: 'register-channel-rollback',
          requestDigest: requestDigest('9'),
        }),
      ),
    ).rejects.toThrow();
    expect(await counts(database)).toEqual(baseline);
    await expect(
      database('control_plane.invitations')
        .select('used_count', 'status')
        .where({ invitation_id: channelInvitationId })
        .first(),
    ).resolves.toEqual({ used_count: 0, status: 'active' });
  });
});
