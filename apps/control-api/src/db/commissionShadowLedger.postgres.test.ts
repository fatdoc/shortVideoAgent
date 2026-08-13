import { createHash } from 'node:crypto';
import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from './migrations/001_pilot_core.js';
import { up as addOrganizationFoundation } from './migrations/006_organization_foundation.js';
import { up as addChannelFoundation } from './migrations/007_channel_foundation.js';
import { up as addOrganizationMembership } from './migrations/008_organization_membership.js';
import { up as addTermsVersioning } from './migrations/011_terms_versioning.js';
import { up as addInvitationLifecycle } from './migrations/012_invitation_lifecycle.js';
import { up as addRegistrationAttribution } from './migrations/013_registration_attribution.js';
import { up as addRechargePaymentFoundation } from './migrations/014_recharge_payment_foundation.js';
import { up as addAtomicCreditIssuance } from './migrations/015_atomic_credit_issuance.js';
import {
  down as removeCommissionShadowLedger,
  up as addCommissionShadowLedger,
} from './migrations/016_commission_shadow_ledger.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const tenantId = 'd1000000-0000-4000-8000-000000000001';
const platformOrganizationId = 'd2000000-0000-4000-8000-000000000001';
const channelOrganizationId = 'd2000000-0000-4000-8000-000000000002';
const channelId = 'd3000000-0000-4000-8000-000000000001';
const buyerUserId = 'd4000000-0000-4000-8000-000000000001';
const platformAdminUserId = 'd4000000-0000-4000-8000-000000000002';
const channelAdminUserId = 'd4000000-0000-4000-8000-000000000003';
const buyerMembershipId = 'd5000000-0000-4000-8000-000000000001';
const platformAdminMembershipId = 'd5000000-0000-4000-8000-000000000002';
const channelAdminMembershipId = 'd5000000-0000-4000-8000-000000000003';
const termsDocumentId = 'd6000000-0000-4000-8000-000000000001';
const termsVersionId = 'd6000000-0000-4000-8000-000000000002';
const invitationId = 'd7000000-0000-4000-8000-000000000001';
const registrationId = 'd8000000-0000-4000-8000-000000000001';
const attributionId = 'd9000000-0000-4000-8000-000000000001';
const walletId = 'da000000-0000-4000-8000-000000000001';
const conversionRuleId = 'db000000-0000-4000-8000-000000000001';
const orderId = 'dc000000-0000-4000-8000-000000000001';
const succeededPaymentEventId = 'dd000000-0000-4000-8000-000000000001';
const refundPaymentEventId = 'dd000000-0000-4000-8000-000000000002';
const alternateRefundPaymentEventId = 'dd000000-0000-4000-8000-000000000003';
const commissionRuleId = 'de000000-0000-4000-8000-000000000001';
const outcomeId = 'df000000-0000-4000-8000-000000000001';
const accrualId = 'e0000000-0000-4000-8000-000000000001';
const reversalId = 'e1000000-0000-4000-8000-000000000001';
const settlementId = 'e2000000-0000-4000-8000-000000000001';
const settlementItemId = 'e3000000-0000-4000-8000-000000000001';

const digest = (character: string): string => character.repeat(64);
const tokenDigest = (character: string): string => `sha256:v1:${character.repeat(64)}`;
const termsContent = 'TEST / NON_QUOTE commission shadow ledger fixture.';
const termsContentDigest = createHash('sha256').update(termsContent, 'utf8').digest('hex');

async function registeredTable(database: Knex, tableName: string): Promise<string | null> {
  const result = await database.raw<{ rows: Array<{ table_name: string | null }> }>(
    'select to_regclass(?)::text as table_name',
    [`control_plane.${tableName}`],
  );
  return result.rows[0]?.table_name ?? null;
}

async function resetFoundation(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);
  await database('control_plane.tenants').insert({
    tenant_id: tenantId,
    display_name: 'Commission TEST Tenant',
    status: 'active',
  });
  await database('control_plane.users').insert([
    {
      user_id: buyerUserId,
      email: 'commission-buyer@example.com',
      display_name: 'Commission Buyer',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: platformAdminUserId,
      email: 'commission-platform@example.com',
      display_name: 'Commission Platform Admin',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: channelAdminUserId,
      email: 'commission-channel@example.com',
      display_name: 'Commission Channel Admin',
      password_hash: 'unused',
      status: 'active',
    },
  ]);
  await database('control_plane.memberships').insert({
    membership_id: buyerMembershipId,
    tenant_id: tenantId,
    user_id: buyerUserId,
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
      display_name: 'Commission TEST Platform',
      status: 'active',
    },
    {
      organization_id: channelOrganizationId,
      organization_type: 'CHANNEL',
      display_name: 'Commission TEST Channel',
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
        membership_id: platformAdminMembershipId,
        user_id: platformAdminUserId,
        organization_id: platformOrganizationId,
        status: 'active',
        primary_role_code: 'platform_admin',
      },
      {
        membership_id: channelAdminMembershipId,
        user_id: channelAdminUserId,
        organization_id: channelOrganizationId,
        status: 'active',
        primary_role_code: 'channel_admin',
      },
    ]);
    await transaction('control_plane.organization_membership_roles').insert([
      { membership_id: platformAdminMembershipId, role_code: 'platform_admin' },
      { membership_id: channelAdminMembershipId, role_code: 'channel_admin' },
    ]);
  });

  await addTermsVersioning(database);
  await database('control_plane.terms_documents').insert({
    terms_document_id: termsDocumentId,
    document_code: 'commission-test-notice',
    title: 'Commission TEST notice',
    status: 'active',
  });
  await database('control_plane.terms_versions').insert({
    terms_version_id: termsVersionId,
    terms_document_id: termsDocumentId,
    version_label: 'test-v1',
    status: 'PUBLISHED',
    content: termsContent,
    content_digest: termsContentDigest,
    locale: 'zh-CN',
    published_at: '2026-08-08T06:00:00.000Z',
    effective_at: '2026-08-08T06:00:00.000Z',
    published_by: platformAdminUserId,
    must_reaccept: false,
  });

  await addInvitationLifecycle(database);
  await database('control_plane.invitations').insert({
    invitation_id: invitationId,
    issuer_membership_id: channelAdminMembershipId,
    issuer_organization_id: channelOrganizationId,
    invitation_type: 'CHANNEL',
    target_organization_id: null,
    target_role_code: null,
    target_email_normalized: null,
    attribution_channel_id: channelId,
    token_digest: tokenDigest('a'),
    status: 'active',
    valid_from: '2026-08-01T00:00:00.000Z',
    expires_at: '2026-08-31T00:00:00.000Z',
    max_uses: 100,
    creation_idempotency_key: 'commission-test-invitation',
    creation_request_digest: digest('b'),
  });

  await addRegistrationAttribution(database);
  await database('control_plane.registrations').insert({
    registration_id: registrationId,
    normalized_email: 'commission-buyer@example.com',
    status: 'completed',
    registration_path: 'CHANNEL_INVITATION',
    invitation_id: invitationId,
    user_id: buyerUserId,
    tenant_id: tenantId,
    membership_id: buyerMembershipId,
    terms_version_id: termsVersionId,
    idempotency_key: 'commission-test-registration',
    request_digest: digest('c'),
    completed_at: '2026-08-08T07:00:00.000Z',
  });
  await database('control_plane.referral_attributions').insert({
    referral_attribution_id: attributionId,
    registration_id: registrationId,
    user_id: buyerUserId,
    tenant_id: tenantId,
    acquisition_source: 'CHANNEL_INVITATION',
    invitation_id: invitationId,
    referrer_channel_id: channelId,
    effective_from: '2026-08-08T07:00:00.000Z',
    protected_until: '2027-08-08T07:00:00.000Z',
    protection_rule_version: 'registration-attribution-v1',
    evidence_digest: digest('d'),
    status: 'active',
  });

  await database('control_plane.wallets').insert({
    wallet_id: walletId,
    tenant_id: tenantId,
    credit_type: 'AI_VIDEO_CREDIT',
    status: 'active',
  });
  await addRechargePaymentFoundation(database);
  await addAtomicCreditIssuance(database);
  await database('control_plane.credit_conversion_rule_versions').insert({
    rule_version_id: conversionRuleId,
    rule_code: 'TEST_COMMISSION_CREDITS',
    version_label: 'v1',
    payment_mode: 'TEST',
    status: 'ACTIVE',
    currency: 'CNY',
    amount_minor: 100,
    purchased_credits: 10,
    bonus_credits: 0,
    bonus_expires_in_days: null,
    rule_digest: digest('e'),
    effective_at: '2026-08-08T07:00:00.000Z',
    approved_by_membership_id: platformAdminMembershipId,
  });
  await database('control_plane.recharge_orders').insert({
    recharge_order_id: orderId,
    tenant_id: tenantId,
    wallet_id: walletId,
    buyer_user_id: buyerUserId,
    buyer_membership_id: buyerMembershipId,
    payment_mode: 'TEST',
    conversion_rule_version_id: conversionRuleId,
    amount_minor: 100,
    currency: 'CNY',
    purchased_credits: 10,
    bonus_credits: 0,
    bonus_expires_in_days: null,
    status: 'created',
    attribution_snapshot_id: attributionId,
    idempotency_key: 'commission-test-order',
    request_digest: digest('f'),
    created_at: '2026-08-08T07:30:00.000Z',
  });
  await database('control_plane.recharge_orders')
    .where({ recharge_order_id: orderId })
    .update({ status: 'pending' });
  await database('control_plane.payment_events').insert({
    payment_event_id: succeededPaymentEventId,
    payment_mode: 'TEST',
    provider_code: 'test-provider',
    provider_event_id: 'commission-succeeded-001',
    event_type: 'payment_succeeded',
    event_digest: digest('1'),
    recharge_order_id: orderId,
    amount_minor: 100,
    currency: 'CNY',
    occurred_at: '2026-08-08T08:00:00.000Z',
    received_at: '2026-08-08T08:00:01.000Z',
    processing_status: 'received',
    error_code: null,
  });
  await database('control_plane.payment_events')
    .where({ payment_event_id: succeededPaymentEventId })
    .update({ processing_status: 'applied', processed_at: '2026-08-08T08:00:02.000Z' });
  await database('control_plane.recharge_orders')
    .where({ recharge_order_id: orderId })
    .update({ status: 'paid' });

  await addCommissionShadowLedger(database);
}

async function insertCommissionRule(
  database: Knex,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await database('control_plane.commission_rule_versions').insert({
    commission_rule_version_id: commissionRuleId,
    rule_code: 'TEST_DIRECT_COMMISSION',
    version_label: 'v1-non-quote',
    payment_mode: 'TEST',
    status: 'ACTIVE',
    scope_type: 'DIRECT_ATTRIBUTION',
    basis_type: 'NET_PAID_AMOUNT',
    currency: 'CNY',
    rate_numerator: 15,
    rate_denominator: 100,
    rounding_mode: 'FLOOR',
    refund_observation_days: 7,
    rule_digest: digest('2'),
    effective_at: '2026-08-08T07:00:00.000Z',
    retired_at: null,
    approved_by_membership_id: platformAdminMembershipId,
    created_at: '2026-08-08T07:00:00.000Z',
    ...overrides,
  });
}

async function insertOutcome(
  database: Knex,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await database('control_plane.commission_calculation_outcomes').insert({
    commission_calculation_outcome_id: outcomeId,
    source_payment_event_id: succeededPaymentEventId,
    recharge_order_id: orderId,
    referral_attribution_id: attributionId,
    beneficiary_channel_id: channelId,
    commission_rule_version_id: commissionRuleId,
    basis_amount_minor: 100,
    currency: 'CNY',
    outcome: 'accrued',
    reason_code: 'commission_accrued',
    calculation_snapshot: { fixture: 'TEST_NON_QUOTE', rate: '15/100' },
    calculation_digest: digest('3'),
    occurred_at: '2026-08-08T08:00:00.000Z',
    created_at: '2026-08-08T08:00:02.000Z',
    ...overrides,
  });
}

async function insertAccrual(
  database: Knex,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await database('control_plane.commission_accruals').insert({
    commission_accrual_id: accrualId,
    calculation_outcome_id: outcomeId,
    source_payment_event_id: succeededPaymentEventId,
    recharge_order_id: orderId,
    referral_attribution_id: attributionId,
    beneficiary_channel_id: channelId,
    commission_rule_version_id: commissionRuleId,
    basis_amount_minor: 100,
    commission_amount_minor: 15,
    currency: 'CNY',
    eligible_at: '2026-08-15T08:00:00.000Z',
    calculation_snapshot: { fixture: 'TEST_NON_QUOTE', result: 15 },
    calculation_digest: digest('4'),
    occurred_at: '2026-08-08T08:00:00.000Z',
    created_at: '2026-08-08T08:00:02.000Z',
    ...overrides,
  });
}

async function insertRefundEvent(
  database: Knex,
  paymentEventId: string = refundPaymentEventId,
  providerEventId: string = 'commission-refund-001',
): Promise<void> {
  await database('control_plane.payment_events').insert({
    payment_event_id: paymentEventId,
    payment_mode: 'TEST',
    provider_code: 'test-provider',
    provider_event_id: providerEventId,
    event_type: 'refund_succeeded',
    event_digest: digest(paymentEventId === refundPaymentEventId ? '5' : '6'),
    recharge_order_id: orderId,
    amount_minor: 100,
    currency: 'CNY',
    occurred_at:
      paymentEventId === refundPaymentEventId
        ? '2026-08-09T08:00:00.000Z'
        : '2026-08-10T08:00:00.000Z',
    received_at:
      paymentEventId === refundPaymentEventId
        ? '2026-08-09T08:00:01.000Z'
        : '2026-08-10T08:00:01.000Z',
    processing_status: 'received',
    error_code: null,
  });
}

async function seedAccrual(database: Knex): Promise<void> {
  await insertCommissionRule(database);
  await insertOutcome(database);
  await insertAccrual(database);
}

describe.runIf(hasDedicatedTestDatabase)('migration 016 commission shadow ledger', () => {
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

  it('creates empty Commission tables without seeding TEST or LIVE rules', async () => {
    const tables = [
      'commission_rule_versions',
      'commission_calculation_outcomes',
      'commission_accruals',
      'commission_reversals',
      'commission_settlements',
      'commission_settlement_items',
    ];
    await expect(
      Promise.all(tables.map((table) => registeredTable(database, table))),
    ).resolves.toEqual(tables.map((table) => `control_plane.${table}`));
    await expect(
      database('control_plane.commission_rule_versions').count('* as count').first(),
    ).resolves.toEqual({ count: '0' });
  });

  it('requires Platform approval and non-overlapping immutable ACTIVE Rule windows', async () => {
    await expect(
      insertCommissionRule(database, { approved_by_membership_id: channelAdminMembershipId }),
    ).rejects.toThrow(/PLATFORM|administrator|approval/i);
    await expect(insertCommissionRule(database, { rate_denominator: 0 })).rejects.toThrow(
      /rate|denominator|check/i,
    );
    await insertCommissionRule(database);
    await expect(
      insertCommissionRule(database, {
        commission_rule_version_id: 'de000000-0000-4000-8000-000000000002',
        version_label: 'v2-overlap-non-quote',
        rule_digest: digest('7'),
        effective_at: '2026-08-09T00:00:00.000Z',
      }),
    ).rejects.toThrow(/overlap|window/i);
    await expect(
      database('control_plane.commission_rule_versions')
        .where({ commission_rule_version_id: commissionRuleId })
        .update({ rate_numerator: 20 }),
    ).rejects.toThrow(/immutable/i);
    await expect(
      database('control_plane.commission_rule_versions')
        .where({ commission_rule_version_id: commissionRuleId })
        .delete(),
    ).rejects.toThrow(/cannot be deleted|audit/i);
  });

  it('accepts one exact attributed Accrual and protects Outcome and Accrual as append-only', async () => {
    await seedAccrual(database);
    await expect(
      database('control_plane.commission_accruals')
        .select('basis_amount_minor', 'commission_amount_minor', 'eligible_at')
        .first(),
    ).resolves.toMatchObject({ basis_amount_minor: '100', commission_amount_minor: '15' });
    await expect(
      database('control_plane.commission_calculation_outcomes')
        .where({ commission_calculation_outcome_id: outcomeId })
        .update({ reason_code: 'changed' }),
    ).rejects.toThrow(/append-only|immutable/i);
    await expect(
      database('control_plane.commission_accruals')
        .where({ commission_accrual_id: accrualId })
        .update({ commission_amount_minor: 14 }),
    ).rejects.toThrow(/append-only|immutable/i);
  });

  it('rejects mismatched outcome and computed Accrual facts', async () => {
    await insertCommissionRule(database);
    await expect(insertOutcome(database, { basis_amount_minor: 99 })).rejects.toThrow(
      /basis|Payment|Order/i,
    );
    await insertOutcome(database);
    await expect(insertAccrual(database, { commission_amount_minor: 14 })).rejects.toThrow(
      /calculation|amount|Rule/i,
    );
    await expect(
      insertAccrual(database, { eligible_at: '2026-08-14T08:00:00.000Z' }),
    ).rejects.toThrow(/eligible|observation/i);
  });

  it('limits append-only Reversal totals to the original Accrual', async () => {
    await seedAccrual(database);
    await insertRefundEvent(database);
    await database('control_plane.commission_reversals').insert({
      commission_reversal_id: reversalId,
      commission_accrual_id: accrualId,
      source_payment_event_id: refundPaymentEventId,
      reversal_type: 'refund',
      amount_minor: 15,
      currency: 'CNY',
      reversal_snapshot: { fixture: 'TEST_FULL_REFUND' },
      reversal_digest: digest('8'),
      occurred_at: '2026-08-09T08:00:00.000Z',
      created_at: '2026-08-09T08:00:01.000Z',
    });
    await insertRefundEvent(database, alternateRefundPaymentEventId, 'commission-refund-002');
    await expect(
      database('control_plane.commission_reversals').insert({
        commission_reversal_id: 'e1000000-0000-4000-8000-000000000002',
        commission_accrual_id: accrualId,
        source_payment_event_id: alternateRefundPaymentEventId,
        reversal_type: 'refund',
        amount_minor: 1,
        currency: 'CNY',
        reversal_snapshot: { fixture: 'TEST_OVER_REVERSAL' },
        reversal_digest: digest('9'),
        occurred_at: '2026-08-10T08:00:00.000Z',
        created_at: '2026-08-10T08:00:01.000Z',
      }),
    ).rejects.toThrow(/exceed|Accrual|reversal/i);
    await expect(
      database('control_plane.commission_reversals')
        .where({ commission_reversal_id: reversalId })
        .delete(),
    ).rejects.toThrow(/append-only|immutable/i);
  });

  it('allows only Platform-owned draft/reviewed/approved Settlement evidence and immutable items', async () => {
    await seedAccrual(database);
    await expect(
      database('control_plane.commission_settlements').insert({
        commission_settlement_id: settlementId,
        beneficiary_channel_id: channelId,
        currency: 'CNY',
        period_start: '2026-08-01',
        period_end: '2026-09-01',
        cutoff_at: '2026-09-01T00:00:00.000Z',
        status: 'paid',
        idempotency_key: 'commission-settlement-paid',
        request_digest: digest('a'),
        settlement_snapshot: { fixture: 'TEST_NON_QUOTE' },
        settlement_digest: digest('b'),
        created_by_membership_id: platformAdminMembershipId,
        created_at: '2026-09-01T00:00:01.000Z',
      }),
    ).rejects.toThrow(/status|check|paid/i);
    await database('control_plane.commission_settlements').insert({
      commission_settlement_id: settlementId,
      beneficiary_channel_id: channelId,
      currency: 'CNY',
      period_start: '2026-08-01',
      period_end: '2026-09-01',
      cutoff_at: '2026-09-01T00:00:00.000Z',
      status: 'draft',
      idempotency_key: 'commission-settlement-august',
      request_digest: digest('a'),
      settlement_snapshot: { fixture: 'TEST_NON_QUOTE' },
      settlement_digest: digest('b'),
      created_by_membership_id: platformAdminMembershipId,
      reviewed_by_membership_id: null,
      reviewed_at: null,
      approved_by_membership_id: null,
      approved_at: null,
      created_at: '2026-09-01T00:00:01.000Z',
    });
    await database('control_plane.commission_settlement_items').insert({
      commission_settlement_item_id: settlementItemId,
      commission_settlement_id: settlementId,
      entry_type: 'accrual',
      commission_accrual_id: accrualId,
      commission_reversal_id: null,
      amount_minor: 15,
      currency: 'CNY',
      beneficiary_channel_id: channelId,
      source_occurred_at: '2026-08-08T08:00:00.000Z',
      item_snapshot: { fixture: 'TEST_NON_QUOTE' },
      item_digest: digest('c'),
      created_at: '2026-09-01T00:00:01.000Z',
    });
    await expect(
      database('control_plane.commission_settlement_items')
        .where({ commission_settlement_item_id: settlementItemId })
        .update({ amount_minor: 14 }),
    ).rejects.toThrow(/append-only|immutable/i);
    await expect(
      database('control_plane.commission_settlements')
        .where({ commission_settlement_id: settlementId })
        .update({
          status: 'reviewed',
          reviewed_by_membership_id: channelAdminMembershipId,
          reviewed_at: '2026-09-01T01:00:00.000Z',
        }),
    ).rejects.toThrow(/PLATFORM|administrator|review/i);
    await database('control_plane.commission_settlements')
      .where({ commission_settlement_id: settlementId })
      .update({
        status: 'reviewed',
        reviewed_by_membership_id: platformAdminMembershipId,
        reviewed_at: '2026-09-01T01:00:00.000Z',
      });
    await database('control_plane.commission_settlements')
      .where({ commission_settlement_id: settlementId })
      .update({
        status: 'approved',
        approved_by_membership_id: platformAdminMembershipId,
        approved_at: '2026-09-01T02:00:00.000Z',
      });
    await expect(
      database('control_plane.commission_settlements')
        .where({ commission_settlement_id: settlementId })
        .update({ status: 'draft' }),
    ).rejects.toThrow(/transition|approved/i);
  });

  it('blocks rollback with Commission evidence and cleanly removes an empty schema', async () => {
    await insertCommissionRule(database);
    await expect(removeCommissionShadowLedger(database)).rejects.toThrow(/rollback blocked/i);

    await resetFoundation(database);
    await removeCommissionShadowLedger(database);
    await expect(registeredTable(database, 'commission_rule_versions')).resolves.toBeNull();
  });
});
