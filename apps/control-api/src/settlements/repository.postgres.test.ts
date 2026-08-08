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
import {
  down as removeCommissionSettlementItemValidationFix,
  up as fixCommissionSettlementItemValidation,
} from '../db/migrations/018_fix_commission_settlement_item_validation.js';
import {
  CommissionSettlementIdempotencyConflictError,
  CommissionSettlementPeriodConflictError,
} from './errors.js';
import { PostgresCommissionSettlementRepository } from './repository.js';
import type { CreateCommissionSettlementRecord } from './types.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const tenantId = '31000000-0000-4000-8000-000000000001';
const platformOrganizationId = '32000000-0000-4000-8000-000000000001';
const channelOrganizationId = '32000000-0000-4000-8000-000000000002';
const channelId = '33000000-0000-4000-8000-000000000001';
const buyerUserId = '34000000-0000-4000-8000-000000000001';
const platformAdminUserId = '34000000-0000-4000-8000-000000000002';
const channelAdminUserId = '34000000-0000-4000-8000-000000000003';
const buyerMembershipId = '35000000-0000-4000-8000-000000000001';
const platformAdminMembershipId = '35000000-0000-4000-8000-000000000002';
const channelAdminMembershipId = '35000000-0000-4000-8000-000000000003';
const termsDocumentId = '36000000-0000-4000-8000-000000000001';
const termsVersionId = '36000000-0000-4000-8000-000000000002';
const invitationId = '37000000-0000-4000-8000-000000000001';
const registrationId = '38000000-0000-4000-8000-000000000001';
const attributionId = '39000000-0000-4000-8000-000000000001';
const walletId = '3a000000-0000-4000-8000-000000000001';
const conversionRuleId = '3b000000-0000-4000-8000-000000000001';
const commissionRuleId = '3c000000-0000-4000-8000-000000000001';

const digest = (character: string): string => character.repeat(64);
const tokenDigest = (character: string): string => `sha256:v1:${character.repeat(64)}`;
const termsContent = 'TEST / NON_QUOTE Commission Settlement fixture.';
const termsContentDigest = createHash('sha256').update(termsContent, 'utf8').digest('hex');

const bundleIds = {
  august: {
    orderId: '41000000-0000-4000-8000-000000000001',
    paymentEventId: '42000000-0000-4000-8000-000000000001',
    outcomeId: '43000000-0000-4000-8000-000000000001',
    accrualId: '44000000-0000-4000-8000-000000000001',
  },
  lateAugust: {
    orderId: '41000000-0000-4000-8000-000000000002',
    paymentEventId: '42000000-0000-4000-8000-000000000002',
    outcomeId: '43000000-0000-4000-8000-000000000002',
    accrualId: '44000000-0000-4000-8000-000000000002',
  },
  secondAugust: {
    orderId: '41000000-0000-4000-8000-000000000003',
    paymentEventId: '42000000-0000-4000-8000-000000000003',
    outcomeId: '43000000-0000-4000-8000-000000000003',
    accrualId: '44000000-0000-4000-8000-000000000003',
  },
} as const;

async function resetFoundation(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);
  await database('control_plane.tenants').insert({
    tenant_id: tenantId,
    display_name: 'Settlement TEST Tenant',
    status: 'active',
  });
  await database('control_plane.users').insert([
    {
      user_id: buyerUserId,
      email: 'settlement-buyer@example.com',
      display_name: 'Settlement Buyer',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: platformAdminUserId,
      email: 'settlement-platform@example.com',
      display_name: 'Settlement Platform Admin',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: channelAdminUserId,
      email: 'settlement-channel@example.com',
      display_name: 'Settlement Channel Admin',
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
      display_name: 'Settlement Platform',
      status: 'active',
    },
    {
      organization_id: channelOrganizationId,
      organization_type: 'CHANNEL',
      display_name: 'Settlement Channel',
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
    document_code: 'commission-settlement-test',
    title: 'Commission Settlement TEST notice',
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
    published_at: '2026-08-01T00:00:00.000Z',
    effective_at: '2026-08-01T00:00:00.000Z',
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
    creation_idempotency_key: 'commission-settlement-invitation',
    creation_request_digest: digest('b'),
  });

  await addRegistrationAttribution(database);
  await database('control_plane.registrations').insert({
    registration_id: registrationId,
    normalized_email: 'settlement-buyer@example.com',
    status: 'completed',
    registration_path: 'CHANNEL_INVITATION',
    invitation_id: invitationId,
    user_id: buyerUserId,
    tenant_id: tenantId,
    membership_id: buyerMembershipId,
    terms_version_id: termsVersionId,
    idempotency_key: 'commission-settlement-registration',
    request_digest: digest('c'),
    completed_at: '2026-08-01T01:00:00.000Z',
  });
  await database('control_plane.referral_attributions').insert({
    referral_attribution_id: attributionId,
    registration_id: registrationId,
    user_id: buyerUserId,
    tenant_id: tenantId,
    acquisition_source: 'CHANNEL_INVITATION',
    invitation_id: invitationId,
    referrer_channel_id: channelId,
    effective_from: '2026-08-01T01:00:00.000Z',
    protected_until: '2027-08-01T01:00:00.000Z',
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
    rule_code: 'TEST_SETTLEMENT_CREDITS',
    version_label: 'v1',
    payment_mode: 'TEST',
    status: 'ACTIVE',
    currency: 'CNY',
    amount_minor: 100,
    purchased_credits: 10,
    bonus_credits: 0,
    bonus_expires_in_days: null,
    rule_digest: digest('e'),
    effective_at: '2026-08-01T00:00:00.000Z',
    approved_by_membership_id: platformAdminMembershipId,
  });

  await addCommissionShadowLedger(database);
  await addFullTestPaymentReversal(database);
  await fixCommissionSettlementItemValidation(database);
  await database('control_plane.commission_rule_versions').insert({
    commission_rule_version_id: commissionRuleId,
    rule_code: 'TEST_DIRECT_SETTLEMENT',
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
    rule_digest: digest('f'),
    effective_at: '2026-08-01T00:00:00.000Z',
    retired_at: null,
    approved_by_membership_id: platformAdminMembershipId,
    created_at: '2026-08-01T00:00:00.000Z',
  });
}

async function insertAccrualBundle(
  database: Knex,
  key: keyof typeof bundleIds,
  occurredAt: string,
  commissionAmountMinor = 15,
): Promise<void> {
  const ids = bundleIds[key];
  const suffix = key === 'august' ? '1' : key === 'lateAugust' ? '2' : '3';
  await database('control_plane.recharge_orders').insert({
    recharge_order_id: ids.orderId,
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
    idempotency_key: `commission-settlement-order-${key}`,
    request_digest: digest(suffix),
    created_at: new Date(new Date(occurredAt).getTime() - 60_000).toISOString(),
  });
  await database('control_plane.recharge_orders')
    .where({ recharge_order_id: ids.orderId })
    .update({ status: 'pending' });
  await database('control_plane.payment_events').insert({
    payment_event_id: ids.paymentEventId,
    payment_mode: 'TEST',
    provider_code: 'test-provider',
    provider_event_id: `commission-settlement-payment-${key}`,
    event_type: 'payment_succeeded',
    event_digest: digest(String(Number(suffix) + 3)),
    recharge_order_id: ids.orderId,
    amount_minor: 100,
    currency: 'CNY',
    occurred_at: occurredAt,
    received_at: new Date(new Date(occurredAt).getTime() + 1000).toISOString(),
    processing_status: 'received',
    error_code: null,
  });
  await database('control_plane.payment_events')
    .where({ payment_event_id: ids.paymentEventId })
    .update({
      processing_status: 'applied',
      processed_at: new Date(new Date(occurredAt).getTime() + 2000).toISOString(),
    });
  await database('control_plane.recharge_orders')
    .where({ recharge_order_id: ids.orderId })
    .update({ status: 'paid' });
  await database('control_plane.commission_calculation_outcomes').insert({
    commission_calculation_outcome_id: ids.outcomeId,
    source_payment_event_id: ids.paymentEventId,
    recharge_order_id: ids.orderId,
    referral_attribution_id: attributionId,
    beneficiary_channel_id: channelId,
    commission_rule_version_id: commissionRuleId,
    basis_amount_minor: 100,
    currency: 'CNY',
    outcome: 'accrued',
    reason_code: 'commission_accrued',
    calculation_snapshot: { fixture: 'TEST_NON_QUOTE', key },
    calculation_digest: digest(String(Number(suffix) + 6)),
    occurred_at: occurredAt,
    created_at: new Date(new Date(occurredAt).getTime() + 2000).toISOString(),
  });
  const eligibleAt = new Date(new Date(occurredAt).getTime() + 7 * 86_400_000).toISOString();
  await database('control_plane.commission_accruals').insert({
    commission_accrual_id: ids.accrualId,
    calculation_outcome_id: ids.outcomeId,
    source_payment_event_id: ids.paymentEventId,
    recharge_order_id: ids.orderId,
    referral_attribution_id: attributionId,
    beneficiary_channel_id: channelId,
    commission_rule_version_id: commissionRuleId,
    basis_amount_minor: 100,
    commission_amount_minor: commissionAmountMinor,
    currency: 'CNY',
    eligible_at: eligibleAt,
    calculation_snapshot: { fixture: 'TEST_NON_QUOTE', key, result: commissionAmountMinor },
    calculation_digest: digest(String(Number(suffix) + 6)),
    occurred_at: occurredAt,
    created_at: new Date(new Date(occurredAt).getTime() + 2000).toISOString(),
  });
}

async function insertFullReversal(
  database: Knex,
  key: keyof typeof bundleIds,
  occurredAt: string,
  reversalId: string,
): Promise<void> {
  const ids = bundleIds[key];
  const paymentEventId = reversalId.replace(/^45/, '46');
  await database('control_plane.payment_events').insert({
    payment_event_id: paymentEventId,
    payment_mode: 'TEST',
    provider_code: 'test-provider',
    provider_event_id: `commission-settlement-refund-${reversalId}`,
    event_type: 'refund_succeeded',
    event_digest: digest('a'),
    recharge_order_id: ids.orderId,
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
    .where({ recharge_order_id: ids.orderId })
    .update({ status: 'refunded' });
  await database('control_plane.commission_reversals').insert({
    commission_reversal_id: reversalId,
    commission_accrual_id: ids.accrualId,
    source_payment_event_id: paymentEventId,
    reversal_type: 'refund',
    amount_minor: 15,
    currency: 'CNY',
    reversal_snapshot: { fixture: 'TEST_NON_QUOTE', key },
    reversal_digest: digest('b'),
    occurred_at: occurredAt,
    created_at: new Date(new Date(occurredAt).getTime() + 2000).toISOString(),
  });
}

function record(
  overrides: Partial<CreateCommissionSettlementRecord> = {},
): CreateCommissionSettlementRecord {
  return {
    paymentMode: 'TEST',
    beneficiaryChannelId: channelId,
    currency: 'CNY',
    periodStart: new Date('2026-08-01T00:00:00.000Z'),
    periodEnd: new Date('2026-09-01T00:00:00.000Z'),
    cutoffAt: new Date('2026-09-01T00:00:00.000Z'),
    idempotencyKey: 'commission-settlement-august',
    requestDigest: digest('c'),
    createdByUserId: platformAdminUserId,
    createdByMembershipId: platformAdminMembershipId,
    createdAt: new Date('2026-09-01T00:00:01.000Z'),
    ...overrides,
  };
}

describe.runIf(hasDedicatedTestDatabase)('PostgresCommissionSettlementRepository', () => {
  let database: Knex;
  let repository: PostgresCommissionSettlementRepository;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await resetFoundation(database);
    repository = new PostgresCommissionSettlementRepository(database);
  });

  afterAll(async () => {
    if (!database) return;
    await database.raw('drop schema if exists control_plane cascade');
    await database.destroy();
  });

  it('creates a safe TEST draft from eligible unoccupied Accruals and replays it', async () => {
    await insertAccrualBundle(database, 'august', '2026-08-08T08:00:00.000Z');

    const created = await repository.createDraft(record());
    expect(created).toEqual({
      replayed: false,
      value: expect.objectContaining({
        paymentMode: 'TEST',
        status: 'draft',
        grossAccrualAmountMinor: 15,
        grossReversalAmountMinor: 0,
        netAmountMinor: 15,
        accrualItemCount: 1,
        reversalItemCount: 0,
        itemCount: 1,
      }),
    });
    const replay = await repository.createDraft(record());
    expect(replay.replayed).toBe(true);
    expect(replay.value).toEqual(created.value);

    const settlement = await database('control_plane.commission_settlements').first();
    const item = await database('control_plane.commission_settlement_items').first();
    expect(settlement.settlement_snapshot).toMatchObject({
      fixture: 'TEST_NON_QUOTE',
      paymentMode: 'TEST',
      netAmountMinor: 15,
    });
    expect(item).toMatchObject({ entry_type: 'accrual', amount_minor: '15' });
    expect(JSON.stringify(created.value)).not.toMatch(/snapshot|digest|paid|withdraw/i);
  });

  it('excludes not-yet-eligible Accruals and permits an auditable zero draft', async () => {
    await insertAccrualBundle(database, 'lateAugust', '2026-08-30T08:00:00.000Z');

    await expect(repository.createDraft(record())).resolves.toEqual({
      replayed: false,
      value: expect.objectContaining({
        grossAccrualAmountMinor: 0,
        grossReversalAmountMinor: 0,
        netAmountMinor: 0,
        itemCount: 0,
      }),
    });
  });

  it('skips a fully reversed unoccupied Accrual instead of manufacturing positive or negative items', async () => {
    await insertAccrualBundle(database, 'august', '2026-08-08T08:00:00.000Z');
    await insertFullReversal(
      database,
      'august',
      '2026-08-20T08:00:00.000Z',
      '45000000-0000-4000-8000-000000000001',
    );

    const created = await repository.createDraft(record());
    expect(created.value).toMatchObject({ netAmountMinor: 0, itemCount: 0 });
    await expect(
      database('control_plane.commission_settlement_items').count('* as count').first(),
    ).resolves.toEqual({ count: '0' });
  });

  it('creates a later-month negative Reversal adjustment only after the original Accrual was occupied', async () => {
    await insertAccrualBundle(database, 'august', '2026-08-08T08:00:00.000Z');
    const august = await repository.createDraft(record());
    expect(august.value.netAmountMinor).toBe(15);

    await insertFullReversal(
      database,
      'august',
      '2026-09-02T08:00:00.000Z',
      '45000000-0000-4000-8000-000000000002',
    );
    const september = await repository.createDraft(
      record({
        periodStart: new Date('2026-09-01T00:00:00.000Z'),
        periodEnd: new Date('2026-10-01T00:00:00.000Z'),
        cutoffAt: new Date('2026-10-01T00:00:00.000Z'),
        idempotencyKey: 'commission-settlement-september',
        requestDigest: digest('d'),
        createdAt: new Date('2026-10-01T00:00:01.000Z'),
      }),
    );

    expect(september.value).toMatchObject({
      grossAccrualAmountMinor: 0,
      grossReversalAmountMinor: 15,
      netAmountMinor: -15,
      accrualItemCount: 0,
      reversalItemCount: 1,
      itemCount: 1,
    });
    await expect(removeCommissionSettlementItemValidationFix(database)).rejects.toThrow(
      /rollback blocked|Reversal Settlement Item evidence/i,
    );
  });

  it('returns stable idempotency and Scope/Period conflicts', async () => {
    await repository.createDraft(record());

    await expect(
      repository.createDraft(
        record({ cutoffAt: new Date('2026-09-02T00:00:00.000Z'), requestDigest: digest('d') }),
      ),
    ).rejects.toBeInstanceOf(CommissionSettlementIdempotencyConflictError);
    await expect(
      repository.createDraft(
        record({
          idempotencyKey: 'commission-settlement-august-other',
          requestDigest: digest('e'),
        }),
      ),
    ).rejects.toBeInstanceOf(CommissionSettlementPeriodConflictError);
  });

  it('serializes concurrent requests into one Settlement and one set of Items', async () => {
    await insertAccrualBundle(database, 'august', '2026-08-08T08:00:00.000Z');
    await insertAccrualBundle(database, 'secondAugust', '2026-08-10T08:00:00.000Z');

    const results = await Promise.all([
      repository.createDraft(record()),
      repository.createDraft(record()),
      repository.createDraft(record()),
    ]);
    expect(results.filter((result) => !result.replayed)).toHaveLength(1);
    expect(new Set(results.map((result) => result.value.commissionSettlementId)).size).toBe(1);
    await expect(
      database('control_plane.commission_settlements').count('* as count').first(),
    ).resolves.toEqual({ count: '1' });
    await expect(
      database('control_plane.commission_settlement_items').count('* as count').first(),
    ).resolves.toEqual({ count: '2' });
  });
});
