import { createHash } from 'node:crypto';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import knex, { type Knex } from 'knex';
import { hashPassword } from '../auth/password.js';
import { migrationConfig } from '../db/migrationConfig.js';
import { digestInvitationToken } from '../invitations/token.js';
import { PostgresCommissionSettlementRepository } from '../settlements/repository.js';
import { termsContentDigest } from '../terms/digest.js';
import {
  parsePilotE2eEnvironment,
  runWithVerifiedPilotE2eDatabase,
  safePilotE2eEnvironmentSummary,
  type PilotE2eEnvironment,
} from './environment.js';
import {
  createPilotE2eSecrets,
  pilotE2eFixtureAccounts,
  pilotE2eFixtureIds,
  type PilotE2eAccountKey,
  type PilotE2eSecrets,
} from './fixtures.js';

const fixtureVersion = 1;
const digest = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const termsContent = [
  '# Pilot E2E 服务条款',
  '',
  '仅用于 TEST 浏览器验证。该环境不代表真实支付、到账、提现或自动打款。',
].join('\n');

export type PilotE2eSeedSummary = {
  fixtureVersion: 1;
  migrationCount: number;
  organizationCount: number;
  channelCount: number;
  tenantCount: number;
  userCount: number;
  membershipCount: number;
  projectCount: number;
  projectAssignmentCount: number;
  publishedTermsCount: number;
  invitationCount: number;
  rechargeOrderCount: number;
  paymentEventCount: number;
  commissionAccrualCount: number;
  commissionSettlementDraftCount: number;
  liveFactCount: number;
  activeSessionCount: number;
  seedFingerprint: string;
};

export type PilotE2eSeedResult = {
  environment: ReturnType<typeof safePilotE2eEnvironmentSummary>;
  summary: PilotE2eSeedSummary;
  secrets: PilotE2eSecrets;
};

function migrationAnchorUrl(): string {
  const extension = extname(fileURLToPath(import.meta.url));
  return new URL(`../db/migrate${extension}`, import.meta.url).href;
}

function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function daysFrom(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 86_400_000);
}

function countValue(row: unknown): number {
  if (typeof row !== 'object' || row === null || !('count' in row)) {
    throw new Error('PILOT_E2E_POSTCONDITION_INVALID');
  }
  const value = Number((row as { count: unknown }).count);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('PILOT_E2E_POSTCONDITION_INVALID');
  }
  return value;
}

async function tableCount(database: Knex, table: string): Promise<number> {
  const row = await database(table).count('* as count').first();
  return countValue(row);
}

export async function resetPilotE2eStorage(
  database: Knex,
  environment: PilotE2eEnvironment,
): Promise<void> {
  await runWithVerifiedPilotE2eDatabase(database, environment, async () => {
    await database.raw('drop schema if exists control_plane cascade');
    await database.raw('drop table if exists public.control_api_migrations_lock');
    await database.raw('drop table if exists public.control_api_migrations');
  });
}

export async function migratePilotE2eDatabase(database: Knex): Promise<void> {
  await database.migrate.latest(migrationConfig(migrationAnchorUrl()));
}

async function passwordHashes(
  secrets: PilotE2eSecrets,
): Promise<Record<PilotE2eAccountKey, string>> {
  return Object.fromEntries(
    await Promise.all(
      (Object.keys(pilotE2eFixtureAccounts) as PilotE2eAccountKey[]).map(async (key) => [
        key,
        await hashPassword(secrets.accounts[key].password),
      ]),
    ),
  ) as Record<PilotE2eAccountKey, string>;
}

export async function seedPilotE2eDatabase(
  database: Knex,
  secrets: PilotE2eSecrets,
  now: Date = new Date(),
): Promise<void> {
  const ids = pilotE2eFixtureIds;
  const hashes = await passwordHashes(secrets);
  const anchor = utcDayStart(now);
  const invitationWindows = {
    valid: { validFrom: daysFrom(anchor, -1), expiresAt: daysFrom(anchor, 20) },
    expired: { validFrom: daysFrom(anchor, -40), expiresAt: daysFrom(anchor, -10) },
    revoked: { validFrom: daysFrom(anchor, -1), expiresAt: daysFrom(anchor, 6) },
    exhausted: { validFrom: daysFrom(anchor, -1), expiresAt: daysFrom(anchor, 6) },
  };

  await database.transaction(async (transaction) => {
    await transaction('control_plane.organizations').insert([
      {
        organization_id: ids.organizations.platform,
        organization_type: 'PLATFORM',
        display_name: 'Pilot E2E Platform',
        status: 'active',
        parent_organization_id: null,
      },
      {
        organization_id: ids.organizations.channelA,
        organization_type: 'CHANNEL',
        display_name: 'Pilot E2E Channel A',
        status: 'active',
        parent_organization_id: ids.organizations.platform,
      },
      {
        organization_id: ids.organizations.channelB,
        organization_type: 'CHANNEL',
        display_name: 'Pilot E2E Channel B',
        status: 'active',
        parent_organization_id: ids.organizations.platform,
      },
      {
        organization_id: ids.organizations.tenantA,
        organization_type: 'TENANT',
        display_name: 'Pilot E2E Tenant A',
        status: 'active',
        parent_organization_id: ids.organizations.channelA,
      },
      {
        organization_id: ids.organizations.tenantB,
        organization_type: 'TENANT',
        display_name: 'Pilot E2E Tenant B',
        status: 'active',
        parent_organization_id: ids.organizations.channelB,
      },
    ]);

    await transaction('control_plane.tenants').insert([
      {
        tenant_id: ids.tenants.tenantA,
        organization_id: ids.organizations.tenantA,
        display_name: 'Pilot E2E Tenant A',
        status: 'active',
      },
      {
        tenant_id: ids.tenants.tenantB,
        organization_id: ids.organizations.tenantB,
        display_name: 'Pilot E2E Tenant B',
        status: 'active',
      },
    ]);

    await transaction('control_plane.channels').insert([
      { channel_id: ids.channels.channelA, organization_id: ids.organizations.channelA },
      { channel_id: ids.channels.channelB, organization_id: ids.organizations.channelB },
    ]);

    const accountKeys = Object.keys(pilotE2eFixtureAccounts) as PilotE2eAccountKey[];
    await transaction('control_plane.users').insert(
      accountKeys.map((key) => ({
        user_id: ids.users[key],
        email: pilotE2eFixtureAccounts[key].email,
        display_name: pilotE2eFixtureAccounts[key].displayName,
        password_hash: hashes[key],
        status: 'active',
      })),
    );

    const membershipFacts: Array<{
      key: PilotE2eAccountKey;
      organizationId: string;
      role:
        'platform_admin' | 'pilot_support' | 'channel_admin' | 'tenant_admin' | 'content_operator';
    }> = [
      { key: 'platformAdmin', organizationId: ids.organizations.platform, role: 'platform_admin' },
      { key: 'platformSupport', organizationId: ids.organizations.platform, role: 'pilot_support' },
      { key: 'channelAdminA', organizationId: ids.organizations.channelA, role: 'channel_admin' },
      { key: 'channelAdminB', organizationId: ids.organizations.channelB, role: 'channel_admin' },
      { key: 'tenantAdminA', organizationId: ids.organizations.tenantA, role: 'tenant_admin' },
      {
        key: 'tenantOperatorA',
        organizationId: ids.organizations.tenantA,
        role: 'content_operator',
      },
      {
        key: 'tenantSuspendableA',
        organizationId: ids.organizations.tenantA,
        role: 'content_operator',
      },
      { key: 'tenantAdminB', organizationId: ids.organizations.tenantB, role: 'tenant_admin' },
    ];
    await transaction('control_plane.organization_memberships').insert(
      membershipFacts.map((fact) => ({
        membership_id: ids.memberships[fact.key],
        user_id: ids.users[fact.key],
        organization_id: fact.organizationId,
        status: 'active',
        primary_role_code: fact.role,
        version: 1,
      })),
    );
    await transaction('control_plane.organization_membership_roles').insert(
      membershipFacts.map((fact) => ({
        membership_id: ids.memberships[fact.key],
        role_code: fact.role,
      })),
    );

    await transaction('control_plane.projects').insert({
      project_id: ids.project,
      tenant_id: ids.tenants.tenantA,
      name: 'Pilot E2E Assigned Project',
      status: 'active',
      platform: 'douyin',
      aspect_ratio: '9:16',
      target_duration_seconds: 30,
      created_by: ids.users.tenantAdminA,
    });
    await transaction('control_plane.project_assignments').insert({
      project_assignment_id: ids.projectAssignment,
      project_id: ids.project,
      membership_id: ids.memberships.tenantOperatorA,
      tenant_id: ids.tenants.tenantA,
      organization_id: ids.organizations.tenantA,
      access_level: 'editor',
      status: 'active',
      assignment_source: 'manual',
      backfill_run_id: null,
      created_by: ids.users.tenantAdminA,
      revoked_at: null,
    });
    await transaction('control_plane.wallets').insert({
      wallet_id: ids.wallet,
      tenant_id: ids.tenants.tenantA,
      credit_type: 'AI_VIDEO_CREDIT',
      status: 'active',
    });

    await transaction('control_plane.terms_documents').insert({
      terms_document_id: ids.termsDocument,
      document_code: 'registration-notice',
      title: 'Pilot E2E 注册服务条款',
      status: 'active',
    });
    await transaction('control_plane.terms_versions').insert({
      terms_version_id: ids.termsVersion,
      terms_document_id: ids.termsDocument,
      version_label: 'pilot-e2e-v1',
      status: 'PUBLISHED',
      content: termsContent,
      content_digest: termsContentDigest(termsContent),
      locale: 'zh-CN',
      published_at: '2026-01-01T00:00:00.000Z',
      effective_at: '2026-01-01T00:00:00.000Z',
      published_by: ids.users.platformAdmin,
      must_reaccept: false,
    });

    await transaction('control_plane.invitations').insert([
      {
        invitation_id: ids.invitations.valid,
        issuer_membership_id: ids.memberships.channelAdminA,
        issuer_organization_id: ids.organizations.channelA,
        invitation_type: 'CHANNEL',
        target_organization_id: null,
        target_role_code: null,
        target_email_normalized: null,
        attribution_channel_id: ids.channels.channelA,
        token_digest: digestInvitationToken(secrets.invitationTokens.valid),
        status: 'active',
        valid_from: invitationWindows.valid.validFrom,
        expires_at: invitationWindows.valid.expiresAt,
        max_uses: 100,
        used_count: 0,
        creation_idempotency_key: 'pilot-e2e-valid',
        creation_request_digest: digest('pilot-e2e-valid'),
      },
      {
        invitation_id: ids.invitations.expired,
        issuer_membership_id: ids.memberships.channelAdminA,
        issuer_organization_id: ids.organizations.channelA,
        invitation_type: 'CHANNEL',
        target_organization_id: null,
        target_role_code: null,
        target_email_normalized: null,
        attribution_channel_id: ids.channels.channelA,
        token_digest: digestInvitationToken(secrets.invitationTokens.expired),
        status: 'expired',
        valid_from: invitationWindows.expired.validFrom,
        expires_at: invitationWindows.expired.expiresAt,
        max_uses: 100,
        used_count: 0,
        creation_idempotency_key: 'pilot-e2e-expired',
        creation_request_digest: digest('pilot-e2e-expired'),
      },
      {
        invitation_id: ids.invitations.revoked,
        issuer_membership_id: ids.memberships.channelAdminA,
        issuer_organization_id: ids.organizations.channelA,
        invitation_type: 'CHANNEL',
        target_organization_id: null,
        target_role_code: null,
        target_email_normalized: null,
        attribution_channel_id: ids.channels.channelA,
        token_digest: digestInvitationToken(secrets.invitationTokens.revoked),
        status: 'revoked',
        valid_from: invitationWindows.revoked.validFrom,
        expires_at: invitationWindows.revoked.expiresAt,
        max_uses: 100,
        used_count: 0,
        creation_idempotency_key: 'pilot-e2e-revoked',
        creation_request_digest: digest('pilot-e2e-revoked'),
        revoked_at: anchor,
        revoked_by_membership_id: ids.memberships.channelAdminA,
      },
      {
        invitation_id: ids.invitations.exhausted,
        issuer_membership_id: ids.memberships.channelAdminA,
        issuer_organization_id: ids.organizations.channelA,
        invitation_type: 'CHANNEL',
        target_organization_id: null,
        target_role_code: null,
        target_email_normalized: null,
        attribution_channel_id: ids.channels.channelA,
        token_digest: digestInvitationToken(secrets.invitationTokens.exhausted),
        status: 'exhausted',
        valid_from: invitationWindows.exhausted.validFrom,
        expires_at: invitationWindows.exhausted.expiresAt,
        max_uses: 1,
        used_count: 1,
        creation_idempotency_key: 'pilot-e2e-exhausted',
        creation_request_digest: digest('pilot-e2e-exhausted'),
      },
      {
        invitation_id: ids.invitations.attribution,
        issuer_membership_id: ids.memberships.channelAdminA,
        issuer_organization_id: ids.organizations.channelA,
        invitation_type: 'CHANNEL',
        target_organization_id: null,
        target_role_code: null,
        target_email_normalized: null,
        attribution_channel_id: ids.channels.channelA,
        token_digest: `sha256:v1:${digest('pilot-e2e-attribution-token')}`,
        status: 'expired',
        valid_from: '2026-01-01T00:00:00.000Z',
        expires_at: '2026-01-30T00:00:00.000Z',
        max_uses: 100,
        used_count: 1,
        creation_idempotency_key: 'pilot-e2e-attribution',
        creation_request_digest: digest('pilot-e2e-attribution'),
      },
    ]);

    await transaction('control_plane.registrations').insert({
      registration_id: ids.registration,
      normalized_email: pilotE2eFixtureAccounts.tenantAdminA.email,
      status: 'completed',
      registration_path: 'CHANNEL_INVITATION',
      invitation_id: ids.invitations.attribution,
      user_id: ids.users.tenantAdminA,
      tenant_id: ids.tenants.tenantA,
      membership_id: ids.memberships.tenantAdminA,
      terms_version_id: ids.termsVersion,
      idempotency_key: 'pilot-e2e-commercial-registration',
      request_digest: digest('pilot-e2e-commercial-registration'),
      completed_at: '2026-01-03T00:00:00.000Z',
    });
    await transaction('control_plane.referral_attributions').insert({
      referral_attribution_id: ids.referralAttribution,
      registration_id: ids.registration,
      user_id: ids.users.tenantAdminA,
      tenant_id: ids.tenants.tenantA,
      acquisition_source: 'CHANNEL_INVITATION',
      invitation_id: ids.invitations.attribution,
      referrer_channel_id: ids.channels.channelA,
      effective_from: '2026-01-03T00:00:00.000Z',
      protected_until: '2027-01-03T00:00:00.000Z',
      protection_rule_version: 'pilot-e2e-attribution-v1',
      evidence_digest: digest('pilot-e2e-attribution-evidence'),
      status: 'active',
    });

    await transaction('control_plane.credit_conversion_rule_versions').insert({
      rule_version_id: ids.conversionRule,
      rule_code: 'PILOT_E2E_TEST_CREDITS',
      version_label: 'v1-test-only',
      payment_mode: 'TEST',
      status: 'ACTIVE',
      currency: 'CNY',
      amount_minor: 100,
      purchased_credits: 10,
      bonus_credits: 0,
      bonus_expires_in_days: null,
      rule_digest: digest('pilot-e2e-conversion-rule'),
      effective_at: '2026-01-01T00:00:00.000Z',
      retired_at: null,
      approved_by_membership_id: ids.memberships.platformAdmin,
    });
    await transaction('control_plane.commission_rule_versions').insert({
      commission_rule_version_id: ids.commissionRule,
      rule_code: 'PILOT_E2E_TEST_DIRECT',
      version_label: 'v1-test-non-quote',
      payment_mode: 'TEST',
      status: 'ACTIVE',
      scope_type: 'DIRECT_ATTRIBUTION',
      basis_type: 'NET_PAID_AMOUNT',
      currency: 'CNY',
      rate_numerator: 15,
      rate_denominator: 100,
      rounding_mode: 'FLOOR',
      refund_observation_days: 7,
      rule_digest: digest('pilot-e2e-commission-rule'),
      effective_at: '2026-01-01T00:00:00.000Z',
      retired_at: null,
      approved_by_membership_id: ids.memberships.platformAdmin,
      created_at: '2026-01-01T00:00:00.000Z',
    });

    await transaction('control_plane.recharge_orders').insert({
      recharge_order_id: ids.rechargeOrder,
      tenant_id: ids.tenants.tenantA,
      wallet_id: ids.wallet,
      buyer_user_id: ids.users.tenantAdminA,
      buyer_membership_id: ids.memberships.tenantAdminA,
      payment_mode: 'TEST',
      conversion_rule_version_id: ids.conversionRule,
      amount_minor: 100,
      currency: 'CNY',
      purchased_credits: 10,
      bonus_credits: 0,
      bonus_expires_in_days: null,
      status: 'created',
      attribution_snapshot_id: ids.referralAttribution,
      idempotency_key: 'pilot-e2e-test-recharge',
      request_digest: digest('pilot-e2e-test-recharge'),
      created_at: '2026-07-08T07:59:00.000Z',
    });
    await transaction('control_plane.recharge_orders')
      .where({ recharge_order_id: ids.rechargeOrder })
      .update({ status: 'pending' });
    await transaction('control_plane.payment_events').insert({
      payment_event_id: ids.paymentEvent,
      payment_mode: 'TEST',
      provider_code: 'test-payment',
      provider_event_id: 'pilot-e2e-payment-succeeded',
      event_type: 'payment_succeeded',
      event_digest: digest('pilot-e2e-payment-succeeded'),
      recharge_order_id: ids.rechargeOrder,
      amount_minor: 100,
      currency: 'CNY',
      occurred_at: '2026-07-08T08:00:00.000Z',
      received_at: '2026-07-08T08:00:01.000Z',
      processing_status: 'received',
      error_code: null,
    });
    await transaction('control_plane.payment_events')
      .where({ payment_event_id: ids.paymentEvent })
      .update({ processing_status: 'applied', processed_at: '2026-07-08T08:00:02.000Z' });
    await transaction('control_plane.recharge_orders')
      .where({ recharge_order_id: ids.rechargeOrder })
      .update({ status: 'paid' });
    await transaction('control_plane.commission_calculation_outcomes').insert({
      commission_calculation_outcome_id: ids.commissionOutcome,
      source_payment_event_id: ids.paymentEvent,
      recharge_order_id: ids.rechargeOrder,
      referral_attribution_id: ids.referralAttribution,
      beneficiary_channel_id: ids.channels.channelA,
      commission_rule_version_id: ids.commissionRule,
      basis_amount_minor: 100,
      currency: 'CNY',
      outcome: 'accrued',
      reason_code: 'commission_accrued',
      calculation_snapshot: { fixture: 'PILOT_E2E_TEST_NON_QUOTE' },
      calculation_digest: digest('pilot-e2e-calculation'),
      occurred_at: '2026-07-08T08:00:00.000Z',
      created_at: '2026-07-08T08:00:02.000Z',
    });
    await transaction('control_plane.commission_accruals').insert({
      commission_accrual_id: ids.commissionAccrual,
      calculation_outcome_id: ids.commissionOutcome,
      source_payment_event_id: ids.paymentEvent,
      recharge_order_id: ids.rechargeOrder,
      referral_attribution_id: ids.referralAttribution,
      beneficiary_channel_id: ids.channels.channelA,
      commission_rule_version_id: ids.commissionRule,
      basis_amount_minor: 100,
      commission_amount_minor: 15,
      currency: 'CNY',
      eligible_at: '2026-07-15T08:00:00.000Z',
      calculation_snapshot: { fixture: 'PILOT_E2E_TEST_NON_QUOTE', result: 15 },
      calculation_digest: digest('pilot-e2e-calculation'),
      occurred_at: '2026-07-08T08:00:00.000Z',
      created_at: '2026-07-08T08:00:02.000Z',
    });
  });

  const settlementRepository = new PostgresCommissionSettlementRepository(
    database,
    () => ids.commissionSettlement,
  );
  await settlementRepository.createDraft({
    paymentMode: 'TEST',
    beneficiaryChannelId: ids.channels.channelB,
    currency: 'CNY',
    periodStart: new Date('2026-06-01T00:00:00.000Z'),
    periodEnd: new Date('2026-07-01T00:00:00.000Z'),
    cutoffAt: new Date('2026-07-01T00:00:00.000Z'),
    idempotencyKey: 'pilot-e2e-empty-test-settlement-draft',
    requestDigest: digest('pilot-e2e-empty-test-settlement-draft'),
    createdByUserId: ids.users.platformAdmin,
    createdByMembershipId: ids.memberships.platformAdmin,
    createdAt: new Date('2026-07-01T00:00:01.000Z'),
  });
}

export async function verifyPilotE2eSeed(database: Knex): Promise<PilotE2eSeedSummary> {
  const [
    migrationCount,
    organizationCount,
    channelCount,
    tenantCount,
    userCount,
    membershipCount,
    projectCount,
    projectAssignmentCount,
    publishedTermsCount,
    invitationCount,
    rechargeOrderCount,
    paymentEventCount,
    commissionAccrualCount,
    commissionSettlementDraftCount,
    activeSessionCount,
  ] = await Promise.all([
    tableCount(database, 'public.control_api_migrations'),
    tableCount(database, 'control_plane.organizations'),
    tableCount(database, 'control_plane.channels'),
    tableCount(database, 'control_plane.tenants'),
    tableCount(database, 'control_plane.users'),
    tableCount(database, 'control_plane.organization_memberships'),
    tableCount(database, 'control_plane.projects'),
    tableCount(database, 'control_plane.project_assignments'),
    countValue(
      await database('control_plane.terms_versions')
        .where({ status: 'PUBLISHED' })
        .count('* as count')
        .first(),
    ),
    tableCount(database, 'control_plane.invitations'),
    tableCount(database, 'control_plane.recharge_orders'),
    tableCount(database, 'control_plane.payment_events'),
    tableCount(database, 'control_plane.commission_accruals'),
    countValue(
      await database('control_plane.commission_settlements')
        .where({ status: 'draft' })
        .count('* as count')
        .first(),
    ),
    countValue(
      await database('control_plane.auth_sessions')
        .whereNull('revoked_at')
        .count('* as count')
        .first(),
    ),
  ]);

  const liveRows = await database.raw<{ rows: Array<{ count: string }> }>(`
    select (
      (select count(*) from control_plane.credit_conversion_rule_versions where payment_mode = 'LIVE')
      + (select count(*) from control_plane.recharge_orders where payment_mode = 'LIVE')
      + (select count(*) from control_plane.payment_events where payment_mode = 'LIVE')
      + (select count(*) from control_plane.commission_rule_versions where payment_mode = 'LIVE')
    )::text as count
  `);
  const liveFactCount = countValue(liveRows.rows[0]);
  const fingerprintFacts = {
    fixtureVersion,
    ids: pilotE2eFixtureIds,
    migrationCount,
    organizationCount,
    channelCount,
    tenantCount,
    userCount,
    membershipCount,
    projectCount,
    projectAssignmentCount,
    publishedTermsCount,
    invitationCount,
    rechargeOrderCount,
    paymentEventCount,
    commissionAccrualCount,
    commissionSettlementDraftCount,
    liveFactCount,
    activeSessionCount,
  };

  const summary: PilotE2eSeedSummary = {
    fixtureVersion: 1,
    migrationCount,
    organizationCount,
    channelCount,
    tenantCount,
    userCount,
    membershipCount,
    projectCount,
    projectAssignmentCount,
    publishedTermsCount,
    invitationCount,
    rechargeOrderCount,
    paymentEventCount,
    commissionAccrualCount,
    commissionSettlementDraftCount,
    liveFactCount,
    activeSessionCount,
    seedFingerprint: digest(JSON.stringify(fingerprintFacts)),
  };

  const expected = {
    migrationCount: 19,
    organizationCount: 5,
    channelCount: 2,
    tenantCount: 2,
    userCount: Object.keys(pilotE2eFixtureAccounts).length,
    membershipCount: Object.keys(pilotE2eFixtureAccounts).length,
    projectCount: 1,
    projectAssignmentCount: 1,
    publishedTermsCount: 1,
    invitationCount: 5,
    rechargeOrderCount: 1,
    paymentEventCount: 1,
    commissionAccrualCount: 1,
    commissionSettlementDraftCount: 1,
    liveFactCount: 0,
    activeSessionCount: 0,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (summary[key as keyof PilotE2eSeedSummary] !== value) {
      throw new Error(`PILOT_E2E_POSTCONDITION_FAILED:${key}`);
    }
  }
  return summary;
}

export async function resetMigrateSeedPilotE2e(
  environmentVariables: NodeJS.ProcessEnv = process.env,
): Promise<PilotE2eSeedResult> {
  const environment = parsePilotE2eEnvironment(environmentVariables);
  const database = knex({
    client: 'pg',
    connection: environment.databaseUrl,
    pool: { min: 0, max: 1 },
  });
  const secrets = createPilotE2eSecrets();

  try {
    await resetPilotE2eStorage(database, environment);
    await migratePilotE2eDatabase(database);
    await seedPilotE2eDatabase(database, secrets);
    const summary = await verifyPilotE2eSeed(database);
    return {
      environment: safePilotE2eEnvironmentSummary(environment),
      summary,
      secrets,
    };
  } finally {
    await database.destroy();
  }
}

async function main(): Promise<void> {
  try {
    const result = await resetMigrateSeedPilotE2e();
    console.info(
      JSON.stringify({
        event: 'pilot_e2e_database_seeded',
        environment: result.environment,
        summary: result.summary,
        credentialOutput: false,
      }),
    );
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: unknown }).code)
        : 'PILOT_E2E_RESET_SEED_FAILED';
    console.error(JSON.stringify({ event: 'pilot_e2e_database_seed_failed', code }));
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
