import { createHash } from 'node:crypto';
import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from '../db/migrations/001_pilot_core.js';
import { up as addOrganizationFoundation } from '../db/migrations/006_organization_foundation.js';
import { up as addChannelFoundation } from '../db/migrations/007_channel_foundation.js';
import { up as addOrganizationMembership } from '../db/migrations/008_organization_membership.js';
import { up as addTermsVersioning } from '../db/migrations/011_terms_versioning.js';
import { up as addInvitationLifecycle } from '../db/migrations/012_invitation_lifecycle.js';
import { up as addRegistrationAttribution } from '../db/migrations/013_registration_attribution.js';
import { up as addRechargePaymentFoundation } from '../db/migrations/014_recharge_payment_foundation.js';
import { up as addAtomicCreditIssuance } from '../db/migrations/015_atomic_credit_issuance.js';
import { up as addCommissionShadowLedger } from '../db/migrations/016_commission_shadow_ledger.js';
import { up as addFullTestPaymentReversal } from '../db/migrations/017_full_test_payment_reversal.js';
import { PostgresCommissionAuditRepository } from './repository.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const tenantId = '11000000-0000-4000-8000-000000000001';
const platformOrganizationId = '12000000-0000-4000-8000-000000000001';
const channelOrganizationId = '12000000-0000-4000-8000-000000000002';
const channelId = '13000000-0000-4000-8000-000000000001';
const buyerUserId = '14000000-0000-4000-8000-000000000001';
const platformAdminUserId = '14000000-0000-4000-8000-000000000002';
const channelAdminUserId = '14000000-0000-4000-8000-000000000003';
const buyerMembershipId = '15000000-0000-4000-8000-000000000001';
const platformAdminMembershipId = '15000000-0000-4000-8000-000000000002';
const channelAdminMembershipId = '15000000-0000-4000-8000-000000000003';
const termsDocumentId = '16000000-0000-4000-8000-000000000001';
const termsVersionId = '16000000-0000-4000-8000-000000000002';
const invitationId = '17000000-0000-4000-8000-000000000001';
const registrationId = '18000000-0000-4000-8000-000000000001';
const attributionId = '19000000-0000-4000-8000-000000000001';
const walletId = '1a000000-0000-4000-8000-000000000001';
const conversionRuleId = '1b000000-0000-4000-8000-000000000001';
const orderId = '1c000000-0000-4000-8000-000000000001';
const manualOrderId = '1c000000-0000-4000-8000-000000000002';
const succeededPaymentEventId = '1d000000-0000-4000-8000-000000000001';
const manualPaymentEventId = '1d000000-0000-4000-8000-000000000002';
const refundPaymentEventId = '1d000000-0000-4000-8000-000000000003';
const commissionRuleId = '1e000000-0000-4000-8000-000000000001';
const outcomeId = '1f000000-0000-4000-8000-000000000001';
const manualOutcomeId = '1f000000-0000-4000-8000-000000000002';
const accrualId = '20000000-0000-4000-8000-000000000001';
const reversalId = '21000000-0000-4000-8000-000000000001';

const digest = (character: string): string => character.repeat(64);
const tokenDigest = (character: string): string => `sha256:v1:${character.repeat(64)}`;
const termsContent = 'TEST / NON_QUOTE scoped Commission audit fixture.';
const termsContentDigest = createHash('sha256').update(termsContent, 'utf8').digest('hex');

async function resetFoundation(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);
  await database('control_plane.tenants').insert({
    tenant_id: tenantId,
    display_name: 'Commission Audit Tenant',
    status: 'active',
  });
  await database('control_plane.users').insert([
    {
      user_id: buyerUserId,
      email: 'commission-audit-buyer@example.com',
      display_name: 'Commission Audit Buyer',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: platformAdminUserId,
      email: 'commission-audit-platform@example.com',
      display_name: 'Commission Audit Platform',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: channelAdminUserId,
      email: 'commission-audit-channel@example.com',
      display_name: 'Commission Audit Channel',
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
      display_name: 'Commission Audit Platform',
      status: 'active',
    },
    {
      organization_id: channelOrganizationId,
      organization_type: 'CHANNEL',
      display_name: 'Commission Audit Channel',
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
    document_code: 'commission-audit-test',
    title: 'Commission Audit TEST notice',
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
    creation_idempotency_key: 'commission-audit-invitation',
    creation_request_digest: digest('b'),
  });

  await addRegistrationAttribution(database);
  await database('control_plane.registrations').insert({
    registration_id: registrationId,
    normalized_email: 'commission-audit-buyer@example.com',
    status: 'completed',
    registration_path: 'CHANNEL_INVITATION',
    invitation_id: invitationId,
    user_id: buyerUserId,
    tenant_id: tenantId,
    membership_id: buyerMembershipId,
    terms_version_id: termsVersionId,
    idempotency_key: 'commission-audit-registration',
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
    rule_code: 'TEST_COMMISSION_AUDIT',
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

  for (const [rechargeOrderId, idempotencyKey] of [
    [orderId, 'commission-audit-order'],
    [manualOrderId, 'commission-audit-manual-order'],
  ] as const) {
    await database('control_plane.recharge_orders').insert({
      recharge_order_id: rechargeOrderId,
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
      idempotency_key: idempotencyKey,
      request_digest: digest(rechargeOrderId === orderId ? 'f' : '0'),
      created_at: '2026-08-08T07:30:00.000Z',
    });
    await database('control_plane.recharge_orders')
      .where({ recharge_order_id: rechargeOrderId })
      .update({ status: 'pending' });
  }

  for (const [paymentEventId, rechargeOrderId, providerEventId, occurredAt, eventDigest] of [
    [
      succeededPaymentEventId,
      orderId,
      'commission-audit-succeeded',
      '2026-08-08T08:00:00.000Z',
      digest('1'),
    ],
    [
      manualPaymentEventId,
      manualOrderId,
      'commission-audit-manual',
      '2026-08-08T09:00:00.000Z',
      digest('2'),
    ],
  ] as const) {
    await database('control_plane.payment_events').insert({
      payment_event_id: paymentEventId,
      payment_mode: 'TEST',
      provider_code: 'test-provider',
      provider_event_id: providerEventId,
      event_type: 'payment_succeeded',
      event_digest: eventDigest,
      recharge_order_id: rechargeOrderId,
      amount_minor: 100,
      currency: 'CNY',
      occurred_at: occurredAt,
      received_at: new Date(new Date(occurredAt).getTime() + 1000).toISOString(),
      processing_status: 'received',
      error_code: null,
    });
    await database('control_plane.payment_events')
      .where({ payment_event_id: paymentEventId })
      .update({
        processing_status: 'applied',
        processed_at: new Date(new Date(occurredAt).getTime() + 2000).toISOString(),
      });
    await database('control_plane.recharge_orders')
      .where({ recharge_order_id: rechargeOrderId })
      .update({ status: 'paid' });
  }

  await addCommissionShadowLedger(database);
  await addFullTestPaymentReversal(database);
  await database('control_plane.commission_rule_versions').insert({
    commission_rule_version_id: commissionRuleId,
    rule_code: 'TEST_DIRECT_AUDIT',
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
    rule_digest: digest('3'),
    effective_at: '2026-08-08T07:00:00.000Z',
    retired_at: null,
    approved_by_membership_id: platformAdminMembershipId,
    created_at: '2026-08-08T07:00:00.000Z',
  });
  await database('control_plane.commission_calculation_outcomes').insert([
    {
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
      calculation_snapshot: { fixture: 'TEST_NON_QUOTE', secret: 'must-not-leak' },
      calculation_digest: digest('4'),
      occurred_at: '2026-08-08T08:00:00.000Z',
      created_at: '2026-08-08T08:00:02.000Z',
    },
    {
      commission_calculation_outcome_id: manualOutcomeId,
      source_payment_event_id: manualPaymentEventId,
      recharge_order_id: manualOrderId,
      referral_attribution_id: attributionId,
      beneficiary_channel_id: channelId,
      commission_rule_version_id: null,
      basis_amount_minor: 100,
      currency: 'CNY',
      outcome: 'manual_review',
      reason_code: 'commission_rule_unavailable',
      calculation_snapshot: { fixture: 'TEST_NON_QUOTE', providerPayload: 'must-not-leak' },
      calculation_digest: digest('5'),
      occurred_at: '2026-08-08T09:00:00.000Z',
      created_at: '2026-08-08T09:00:02.000Z',
    },
  ]);
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
    calculation_snapshot: { fixture: 'TEST_NON_QUOTE', approval: 'must-not-leak' },
    calculation_digest: digest('6'),
    occurred_at: '2026-08-08T08:00:00.000Z',
    created_at: '2026-08-08T08:00:02.000Z',
  });
  await database('control_plane.payment_events').insert({
    payment_event_id: refundPaymentEventId,
    payment_mode: 'TEST',
    provider_code: 'test-provider',
    provider_event_id: 'commission-audit-refund',
    event_type: 'refund_succeeded',
    event_digest: digest('7'),
    recharge_order_id: orderId,
    amount_minor: 100,
    currency: 'CNY',
    occurred_at: '2026-08-09T08:00:00.000Z',
    received_at: '2026-08-09T08:00:01.000Z',
    processing_status: 'received',
    error_code: null,
  });
  await database('control_plane.payment_events')
    .where({ payment_event_id: refundPaymentEventId })
    .update({ processing_status: 'applied', processed_at: '2026-08-09T08:00:02.000Z' });
  await database('control_plane.recharge_orders')
    .where({ recharge_order_id: orderId })
    .update({ status: 'refunded' });
  await database('control_plane.commission_reversals').insert({
    commission_reversal_id: reversalId,
    commission_accrual_id: accrualId,
    source_payment_event_id: refundPaymentEventId,
    reversal_type: 'refund',
    amount_minor: 15,
    currency: 'CNY',
    reversal_snapshot: { fixture: 'TEST_NON_QUOTE', rawPayload: 'must-not-leak' },
    reversal_digest: digest('8'),
    occurred_at: '2026-08-09T08:00:00.000Z',
    created_at: '2026-08-09T08:00:02.000Z',
  });
}

describe.runIf(hasDedicatedTestDatabase)('PostgresCommissionAuditRepository', () => {
  let database: Knex;
  let repository: PostgresCommissionAuditRepository;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await resetFoundation(database);
    repository = new PostgresCommissionAuditRepository(database);
  });

  afterAll(async () => {
    if (!database) return;
    await database.raw('drop schema if exists control_plane cascade');
    await database.destroy();
  });

  it('resolves the canonical Channel and returns stable bounded safe Calculation projections', async () => {
    await expect(repository.findChannelIdByOrganizationId(channelOrganizationId)).resolves.toBe(
      channelId,
    );
    await expect(
      repository.findChannelIdByOrganizationId(platformOrganizationId),
    ).resolves.toBeNull();

    const platform = await repository.listCalculations({}, 1000);
    expect(platform.map((item) => item.commissionCalculationOutcomeId)).toEqual([
      manualOutcomeId,
      outcomeId,
    ]);
    expect(await repository.listCalculations({}, 1)).toEqual([platform[0]]);
    expect(await repository.listCalculations({ outcome: 'manual_review' }, 50)).toEqual([
      platform[0],
    ]);
    expect(await repository.listCalculations({ beneficiaryChannelId: channelId }, 50)).toEqual(
      platform,
    );
    expect(JSON.stringify(platform)).not.toMatch(/snapshot|digest|providerPayload|secret/i);
  });

  it('returns only safe Channel-filtered Accrual and Reversal projections', async () => {
    const accruals = await repository.listAccruals(channelId, 50);
    expect(accruals).toEqual([
      expect.objectContaining({
        commissionAccrualId: accrualId,
        beneficiaryChannelId: channelId,
        basisAmountMinor: 100,
        commissionAmountMinor: 15,
        currency: 'CNY',
      }),
    ]);

    const reversals = await repository.listReversals(channelId, 50);
    expect(reversals).toEqual([
      expect.objectContaining({
        commissionReversalId: reversalId,
        commissionAccrualId: accrualId,
        rechargeOrderId: orderId,
        beneficiaryChannelId: channelId,
        reversalType: 'refund',
        reversalAmountMinor: 15,
      }),
    ]);
    expect(JSON.stringify({ accruals, reversals })).not.toMatch(
      /snapshot|digest|rawPayload|approval/i,
    );
    await expect(
      repository.listReversals('22000000-0000-4000-8000-000000000001', 50),
    ).resolves.toEqual([]);
  });
});
