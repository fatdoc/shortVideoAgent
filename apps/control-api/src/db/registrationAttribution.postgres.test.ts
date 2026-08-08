import { createHash } from 'node:crypto';
import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from './migrations/001_pilot_core.js';
import { up as addOrganizationFoundation } from './migrations/006_organization_foundation.js';
import { up as addChannelFoundation } from './migrations/007_channel_foundation.js';
import { up as addOrganizationMembership } from './migrations/008_organization_membership.js';
import { up as addTermsVersioning } from './migrations/011_terms_versioning.js';
import { up as addInvitationLifecycle } from './migrations/012_invitation_lifecycle.js';
import {
  down as removeRegistrationAttribution,
  up as addRegistrationAttribution,
} from './migrations/013_registration_attribution.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const platformOrganizationId = '91000000-0000-4000-8000-000000000001';
const channelOrganizationId = '91000000-0000-4000-8000-000000000002';
const tenantId = '91000000-0000-4000-8000-000000000003';
const channelId = '92000000-0000-4000-8000-000000000001';
const publisherUserId = '93000000-0000-4000-8000-000000000001';
const platformUserId = '93000000-0000-4000-8000-000000000002';
const channelUserId = '93000000-0000-4000-8000-000000000003';
const tenantAdminUserId = '93000000-0000-4000-8000-000000000004';
const registeredUserId = '93000000-0000-4000-8000-000000000005';
const alternateUserId = '93000000-0000-4000-8000-000000000006';
const platformMembershipId = '94000000-0000-4000-8000-000000000001';
const channelMembershipId = '94000000-0000-4000-8000-000000000002';
const tenantAdminMembershipId = '94000000-0000-4000-8000-000000000003';
const registeredMembershipId = '94000000-0000-4000-8000-000000000004';
const alternateMembershipId = '94000000-0000-4000-8000-000000000005';
const platformInvitationId = '95000000-0000-4000-8000-000000000001';
const channelInvitationId = '95000000-0000-4000-8000-000000000002';
const tenantInvitationId = '95000000-0000-4000-8000-000000000003';
const termsDocumentId = '96000000-0000-4000-8000-000000000001';
const termsVersionId = '96000000-0000-4000-8000-000000000002';
const registrationId = '97000000-0000-4000-8000-000000000001';
const alternateRegistrationId = '97000000-0000-4000-8000-000000000002';
const attributionId = '98000000-0000-4000-8000-000000000001';
const alternateAttributionId = '98000000-0000-4000-8000-000000000002';
const eventId = '99000000-0000-4000-8000-000000000001';
const consentId = '9a000000-0000-4000-8000-000000000001';
const usageId = '9b000000-0000-4000-8000-000000000001';

const requestDigest = (character: string): string => character.repeat(64);
const tokenDigest = (character: string): string => `sha256:v1:${character.repeat(64)}`;
const content = 'Registration attribution migration test terms.';
const contentDigest = createHash('sha256').update(content, 'utf8').digest('hex');

function invitationWindow(days: number): { validFrom: string; expiresAt: string } {
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
    tenant_id: tenantId,
    display_name: 'Registration Tenant Fixture',
    status: 'active',
  });
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
    {
      user_id: registeredUserId,
      email: 'registered@example.com',
      display_name: 'Registered User',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: alternateUserId,
      email: 'alternate@example.com',
      display_name: 'Alternate User',
      password_hash: 'unused',
      status: 'active',
    },
  ]);
  await database('control_plane.memberships').insert([
    {
      membership_id: tenantAdminMembershipId,
      tenant_id: tenantId,
      user_id: tenantAdminUserId,
      role_code: 'tenant_admin',
      status: 'active',
    },
    {
      membership_id: registeredMembershipId,
      tenant_id: tenantId,
      user_id: registeredUserId,
      role_code: 'content_operator',
      status: 'active',
    },
    {
      membership_id: alternateMembershipId,
      tenant_id: tenantId,
      user_id: alternateUserId,
      role_code: 'content_operator',
      status: 'active',
    },
  ]);

  await addOrganizationFoundation(database);
  await addChannelFoundation(database);
  await addOrganizationMembership(database);

  await database('control_plane.organizations').insert([
    {
      organization_id: platformOrganizationId,
      organization_type: 'PLATFORM',
      display_name: 'Registration Platform Fixture',
      status: 'active',
    },
    {
      organization_id: channelOrganizationId,
      organization_type: 'CHANNEL',
      display_name: 'Registration Channel Fixture',
      status: 'active',
    },
  ]);
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
    ]);
    await transaction('control_plane.organization_membership_roles').insert([
      { membership_id: platformMembershipId, role_code: 'platform_admin' },
      { membership_id: channelMembershipId, role_code: 'channel_admin' },
    ]);
  });

  await addTermsVersioning(database);
  await database('control_plane.terms_documents').insert({
    terms_document_id: termsDocumentId,
    document_code: 'registration-notice',
    title: 'Registration notice',
    status: 'active',
  });
  await database('control_plane.terms_versions').insert({
    terms_version_id: termsVersionId,
    terms_document_id: termsDocumentId,
    version_label: 'test-v1',
    status: 'PUBLISHED',
    content,
    content_digest: contentDigest,
    locale: 'zh-CN',
    published_at: '2026-08-08T01:00:00.000Z',
    effective_at: '2026-08-08T01:00:00.000Z',
    published_by: publisherUserId,
    must_reaccept: false,
  });

  await addInvitationLifecycle(database);
  const directedWindow = invitationWindow(7);
  const channelWindow = invitationWindow(30);
  await database('control_plane.invitations').insert([
    {
      invitation_id: platformInvitationId,
      issuer_membership_id: platformMembershipId,
      issuer_organization_id: platformOrganizationId,
      invitation_type: 'PLATFORM',
      target_organization_id: null,
      target_role_code: null,
      target_email_normalized: 'registered@example.com',
      attribution_channel_id: null,
      token_digest: tokenDigest('a'),
      status: 'active',
      valid_from: directedWindow.validFrom,
      expires_at: directedWindow.expiresAt,
      max_uses: 1,
      creation_idempotency_key: 'platform-registration-invitation',
      creation_request_digest: requestDigest('a'),
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
      token_digest: tokenDigest('b'),
      status: 'active',
      valid_from: channelWindow.validFrom,
      expires_at: channelWindow.expiresAt,
      max_uses: 100,
      creation_idempotency_key: 'channel-registration-invitation',
      creation_request_digest: requestDigest('b'),
    },
    {
      invitation_id: tenantInvitationId,
      issuer_membership_id: tenantAdminMembershipId,
      issuer_organization_id: tenantId,
      invitation_type: 'TENANT_MEMBER',
      target_organization_id: tenantId,
      target_role_code: 'content_operator',
      target_email_normalized: 'registered@example.com',
      attribution_channel_id: null,
      token_digest: tokenDigest('c'),
      status: 'active',
      valid_from: directedWindow.validFrom,
      expires_at: directedWindow.expiresAt,
      max_uses: 1,
      creation_idempotency_key: 'tenant-registration-invitation',
      creation_request_digest: requestDigest('c'),
    },
  ]);
}

async function tableRegistration(database: Knex, tableName: string): Promise<string | null> {
  const result = await database.raw<{ rows: Array<{ table_name: string | null }> }>(
    'select to_regclass(?)::text as table_name',
    [`control_plane.${tableName}`],
  );
  return result.rows[0]?.table_name ?? null;
}

async function insertRegistration(
  database: Knex,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await database('control_plane.registrations').insert({
    registration_id: registrationId,
    normalized_email: 'registered@example.com',
    status: 'completed',
    registration_path: 'DIRECT',
    invitation_id: null,
    user_id: registeredUserId,
    tenant_id: tenantId,
    membership_id: registeredMembershipId,
    terms_version_id: termsVersionId,
    idempotency_key: 'registration-key',
    request_digest: requestDigest('d'),
    completed_at: '2026-08-08T02:00:00.000Z',
    ...overrides,
  });
}

async function insertAttribution(
  database: Knex,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await database('control_plane.referral_attributions').insert({
    referral_attribution_id: attributionId,
    registration_id: registrationId,
    user_id: registeredUserId,
    tenant_id: tenantId,
    acquisition_source: 'DIRECT',
    invitation_id: null,
    referrer_channel_id: null,
    effective_from: '2026-08-08T02:00:00.000Z',
    protected_until: null,
    protection_rule_version: 'registration-attribution-v1',
    evidence_digest: requestDigest('e'),
    status: 'active',
    ...overrides,
  });
}

async function insertEvent(database: Knex, overrides: Record<string, unknown> = {}): Promise<void> {
  await database('control_plane.referral_attribution_events').insert({
    event_id: eventId,
    referral_attribution_id: attributionId,
    event_type: 'created',
    reason_code: 'registration_completed',
    acted_by: null,
    occurred_at: '2026-08-08T02:00:00.000Z',
    evidence_digest: requestDigest('f'),
    ...overrides,
  });
}

async function insertConsent(
  database: Knex,
  registrationReference: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await database('control_plane.user_consents').insert({
    user_consent_id: consentId,
    user_id: registeredUserId,
    terms_version_id: termsVersionId,
    content_digest_snapshot: contentDigest,
    accepted_at: '2026-08-08T02:00:00.000Z',
    acceptance_context: 'public_registration',
    registration_id: registrationReference,
    evidence_metadata: { locale: 'zh-CN' },
    ...overrides,
  });
}

async function insertUsage(
  database: Knex,
  registrationReference: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await database('control_plane.invitation_usages').insert({
    invitation_usage_id: usageId,
    invitation_id: platformInvitationId,
    registration_id: registrationReference,
    user_id: registeredUserId,
    idempotency_key: 'registration-usage-key',
    request_digest: requestDigest('0'),
    ...overrides,
  });
}

describe.runIf(hasDedicatedTestDatabase)('migration 013 registration attribution', () => {
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

  it('creates Registration, Attribution and append-only Event tables without seeding facts', async () => {
    await addRegistrationAttribution(database);

    await expect(
      Promise.all(
        ['registrations', 'referral_attributions', 'referral_attribution_events'].map((tableName) =>
          tableRegistration(database, tableName),
        ),
      ),
    ).resolves.toEqual([
      'control_plane.registrations',
      'control_plane.referral_attributions',
      'control_plane.referral_attribution_events',
    ]);
    await expect(
      database('control_plane.registrations').count('* as count').first(),
    ).resolves.toMatchObject({ count: '0' });
  });

  it('enforces Registration path and Invitation type combinations', async () => {
    await addRegistrationAttribution(database);

    await expect(
      insertRegistration(database, {
        registration_path: 'DIRECT',
        invitation_id: platformInvitationId,
      }),
    ).rejects.toThrow(/direct|invitation|path/i);
    await expect(
      insertRegistration(database, {
        registration_path: 'CHANNEL_INVITATION',
        invitation_id: platformInvitationId,
      }),
    ).rejects.toThrow(/channel|invitation|path|type/i);
    await expect(
      insertRegistration(database, {
        registration_path: 'TENANT_MEMBER_INVITATION',
        invitation_id: tenantInvitationId,
      }),
    ).resolves.toBeUndefined();
  });

  it('requires normalized unique email, User and idempotency identity', async () => {
    await addRegistrationAttribution(database);
    await insertRegistration(database);

    await expect(
      insertRegistration(database, {
        registration_id: alternateRegistrationId,
        normalized_email: ' Registered@example.com ',
        user_id: alternateUserId,
        membership_id: alternateMembershipId,
        idempotency_key: 'alternate-key',
        request_digest: requestDigest('1'),
      }),
    ).rejects.toThrow(/email|normalized|check/i);
    await expect(
      insertRegistration(database, {
        registration_id: alternateRegistrationId,
        user_id: alternateUserId,
        membership_id: alternateMembershipId,
        idempotency_key: 'alternate-key',
        request_digest: requestDigest('1'),
      }),
    ).rejects.toThrow(/email|unique|duplicate/i);
    await expect(
      insertRegistration(database, {
        registration_id: alternateRegistrationId,
        normalized_email: 'alternate@example.com',
        membership_id: alternateMembershipId,
        idempotency_key: 'alternate-key',
        request_digest: requestDigest('1'),
      }),
    ).rejects.toThrow(/user|unique|duplicate/i);
    await expect(
      insertRegistration(database, {
        registration_id: alternateRegistrationId,
        normalized_email: 'alternate@example.com',
        user_id: alternateUserId,
        membership_id: alternateMembershipId,
        request_digest: requestDigest('1'),
      }),
    ).rejects.toThrow(/idempotency|unique|duplicate/i);
  });

  it('keeps completed Registration facts immutable', async () => {
    await addRegistrationAttribution(database);
    await insertRegistration(database);

    await expect(
      database('control_plane.registrations')
        .where({ registration_id: registrationId })
        .update({ normalized_email: 'attacker@example.com' }),
    ).rejects.toThrow(/registration|immutable|completed/i);
    await expect(
      database('control_plane.registrations').where({ registration_id: registrationId }).del(),
    ).rejects.toThrow(/registration|immutable|delete/i);
  });

  it('enforces Attribution source, Invitation, Channel and twelve-calendar-month protection', async () => {
    await addRegistrationAttribution(database);
    await insertRegistration(database, {
      registration_path: 'CHANNEL_INVITATION',
      invitation_id: channelInvitationId,
    });

    await expect(
      insertAttribution(database, {
        acquisition_source: 'CHANNEL_INVITATION',
        invitation_id: channelInvitationId,
        referrer_channel_id: null,
      }),
    ).rejects.toThrow(/channel|attribution|referrer/i);
    await expect(
      insertAttribution(database, {
        acquisition_source: 'CHANNEL_INVITATION',
        invitation_id: channelInvitationId,
        referrer_channel_id: channelId,
        protected_until: '2027-08-07T02:00:00.000Z',
      }),
    ).rejects.toThrow(/12 months|protection|protected/i);
    await expect(
      insertAttribution(database, {
        acquisition_source: 'CHANNEL_INVITATION',
        invitation_id: channelInvitationId,
        referrer_channel_id: channelId,
        protected_until: '2027-08-08T02:00:00.000Z',
      }),
    ).resolves.toBeUndefined();
  });

  it('allows only one immutable first Attribution per User and Registration', async () => {
    await addRegistrationAttribution(database);
    await insertRegistration(database);
    await insertAttribution(database);

    await expect(
      insertAttribution(database, {
        referral_attribution_id: alternateAttributionId,
      }),
    ).rejects.toThrow(/registration|user|unique|duplicate/i);
    await expect(
      database('control_plane.referral_attributions')
        .where({ referral_attribution_id: attributionId })
        .update({ status: 'ended' }),
    ).rejects.toThrow(/attribution|immutable|append/i);
    await expect(
      database('control_plane.referral_attributions')
        .where({ referral_attribution_id: attributionId })
        .del(),
    ).rejects.toThrow(/attribution|immutable|delete/i);
  });

  it('keeps Attribution Events append-only', async () => {
    await addRegistrationAttribution(database);
    await insertRegistration(database);
    await insertAttribution(database);
    await insertEvent(database);

    await expect(
      database('control_plane.referral_attribution_events')
        .where({ event_id: eventId })
        .update({ reason_code: 'rewritten' }),
    ).rejects.toThrow(/event|append-only|immutable/i);
    await expect(
      database('control_plane.referral_attribution_events').where({ event_id: eventId }).del(),
    ).rejects.toThrow(/event|append-only|delete/i);
  });

  it('requires Consent and Invitation Usage to reference a real Registration', async () => {
    await addRegistrationAttribution(database);

    await expect(insertConsent(database, alternateRegistrationId)).rejects.toThrow(
      /registration|foreign key/i,
    );
    await expect(insertUsage(database, alternateRegistrationId)).rejects.toThrow(
      /registration|foreign key/i,
    );

    await insertRegistration(database, {
      registration_path: 'PLATFORM_INVITATION',
      invitation_id: platformInvitationId,
    });
    await expect(insertConsent(database, registrationId)).resolves.toBeUndefined();
    await expect(insertUsage(database, registrationId)).resolves.toBeUndefined();
  });

  it('fails closed when legacy Consent or Usage contains an orphan Registration reference', async () => {
    await insertConsent(database, alternateRegistrationId);
    await expect(addRegistrationAttribution(database)).rejects.toThrow(
      /orphan|consent|registration|migration/i,
    );

    await resetFoundation(database);
    await insertUsage(database, alternateRegistrationId);
    await expect(addRegistrationAttribution(database)).rejects.toThrow(
      /orphan|usage|registration|migration/i,
    );
  });

  it('allows empty rollback but blocks destructive rollback once audit facts exist', async () => {
    await addRegistrationAttribution(database);
    await removeRegistrationAttribution(database);
    await expect(tableRegistration(database, 'registrations')).resolves.toBeNull();

    await addRegistrationAttribution(database);
    await insertRegistration(database);
    await expect(removeRegistrationAttribution(database)).rejects.toThrow(
      /registration|attribution|audit|rollback/i,
    );
  });
});
