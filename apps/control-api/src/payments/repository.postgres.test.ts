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
  PaymentIdempotencyConflictError,
  PaymentOrderConflictError,
  RechargeIdempotencyConflictError,
  RechargeRuleUnavailableError,
  RechargeScopeConflictError,
} from './errors.js';
import { PostgresPaymentFoundationRepository } from './repository.js';
import type { CreateRechargeOrderRecord, ReceivePaymentEventRecord } from './types.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const now = new Date('2026-08-08T06:00:00.000Z');
const tenantId = 'b1000000-0000-4000-8000-000000000001';
const tenantOrganizationId = tenantId;
const otherTenantId = 'b1000000-0000-4000-8000-000000000002';
const buyerUserId = 'b2000000-0000-4000-8000-000000000001';
const otherUserId = 'b2000000-0000-4000-8000-000000000002';
const platformAdminUserId = 'b2000000-0000-4000-8000-000000000003';
const buyerMembershipId = 'b3000000-0000-4000-8000-000000000001';
const otherMembershipId = 'b3000000-0000-4000-8000-000000000002';
const platformAdminMembershipId = 'b3000000-0000-4000-8000-000000000003';
const platformOrganizationId = 'b4000000-0000-4000-8000-000000000001';
const testRuleId = 'b5000000-0000-4000-8000-000000000001';
const liveRuleId = 'b5000000-0000-4000-8000-000000000002';
const orderId = 'b6000000-0000-4000-8000-000000000001';
const walletId = 'b7000000-0000-4000-8000-000000000001';
const paymentEventId = 'b9000000-0000-4000-8000-000000000001';
const channelAdminUserId = 'bc000000-0000-4000-8000-000000000001';
const channelOrganizationId = 'bc000000-0000-4000-8000-000000000002';
const channelId = 'bc000000-0000-4000-8000-000000000003';
const channelAdminMembershipId = 'bc000000-0000-4000-8000-000000000004';
const termsDocumentId = 'bc000000-0000-4000-8000-000000000005';
const termsVersionId = 'bc000000-0000-4000-8000-000000000006';
const invitationId = 'bc000000-0000-4000-8000-000000000007';
const registrationId = 'bc000000-0000-4000-8000-000000000008';
const attributionId = 'bc000000-0000-4000-8000-000000000009';
const commissionRuleId = 'bd000000-0000-4000-8000-000000000001';
const secondCommissionRuleId = 'bd000000-0000-4000-8000-000000000002';
const commissionOutcomeId = 'be000000-0000-4000-8000-000000000001';
const commissionAccrualId = 'bf000000-0000-4000-8000-000000000001';

const digest = (character: string): string => character.repeat(64);
const tokenDigest = (character: string): string => `sha256:v1:${character.repeat(64)}`;
const termsContent = 'TEST / NON_QUOTE atomic commission accrual fixture.';
const termsContentDigest = createHash('sha256').update(termsContent, 'utf8').digest('hex');

async function resetFoundation(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);
  await database('control_plane.tenants').insert([
    { tenant_id: tenantId, display_name: 'Payment Tenant', status: 'active' },
    { tenant_id: otherTenantId, display_name: 'Other Tenant', status: 'active' },
  ]);
  await database('control_plane.users').insert([
    {
      user_id: buyerUserId,
      email: 'payment-buyer@example.com',
      display_name: 'Payment Buyer',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: otherUserId,
      email: 'other-payment-buyer@example.com',
      display_name: 'Other Buyer',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: platformAdminUserId,
      email: 'payment-platform-admin@example.com',
      display_name: 'Payment Platform Admin',
      password_hash: 'unused',
      status: 'active',
    },
  ]);
  await database('control_plane.memberships').insert([
    {
      membership_id: buyerMembershipId,
      tenant_id: tenantId,
      user_id: buyerUserId,
      role_code: 'tenant_admin',
      status: 'active',
    },
    {
      membership_id: otherMembershipId,
      tenant_id: otherTenantId,
      user_id: otherUserId,
      role_code: 'tenant_admin',
      status: 'active',
    },
  ]);

  await addOrganizationFoundation(database);
  await addChannelFoundation(database);
  await addOrganizationMembership(database);
  await addTermsVersioning(database);
  await addInvitationLifecycle(database);
  await addRegistrationAttribution(database);
  await addRechargePaymentFoundation(database);
  await addAtomicCreditIssuance(database);
  await addCommissionShadowLedger(database);
  await addFullTestPaymentReversal(database);

  await database('control_plane.organizations').insert({
    organization_id: platformOrganizationId,
    organization_type: 'PLATFORM',
    display_name: 'Payment Platform',
    status: 'active',
  });
  await database.transaction(async (transaction) => {
    await transaction.raw('set constraints all deferred');
    await transaction('control_plane.organization_memberships').insert({
      membership_id: platformAdminMembershipId,
      user_id: platformAdminUserId,
      organization_id: platformOrganizationId,
      status: 'active',
      primary_role_code: 'platform_admin',
    });
    await transaction('control_plane.organization_membership_roles').insert({
      membership_id: platformAdminMembershipId,
      role_code: 'platform_admin',
    });
  });

  await database('control_plane.credit_conversion_rule_versions').insert([
    {
      rule_version_id: testRuleId,
      rule_code: 'TEST_REPOSITORY',
      version_label: 'v1',
      payment_mode: 'TEST',
      status: 'ACTIVE',
      currency: 'CNY',
      amount_minor: 100,
      purchased_credits: 10,
      bonus_credits: 2,
      bonus_expires_in_days: 30,
      rule_digest: digest('1'),
      effective_at: '2026-08-08T05:00:00.000Z',
      approved_by_membership_id: platformAdminMembershipId,
    },
    {
      rule_version_id: liveRuleId,
      rule_code: 'LIVE_REPOSITORY',
      version_label: 'v1',
      payment_mode: 'LIVE',
      status: 'ACTIVE',
      currency: 'CNY',
      amount_minor: 500,
      purchased_credits: 50,
      bonus_credits: 0,
      bonus_expires_in_days: null,
      rule_digest: digest('2'),
      effective_at: '2026-08-08T05:00:00.000Z',
      approved_by_membership_id: platformAdminMembershipId,
    },
  ]);
}

function ids() {
  const values: Record<string, string[]> = {
    wallet: [walletId, 'b7000000-0000-4000-8000-000000000002'],
    order: [
      orderId,
      'b6000000-0000-4000-8000-000000000002',
      'b6000000-0000-4000-8000-000000000003',
    ],
    orderEvent: Array.from(
      { length: 12 },
      (_, index) => `b8000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    ),
    paymentEvent: Array.from(
      { length: 6 },
      (_, index) => `b9000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    ),
    creditLot: Array.from(
      { length: 8 },
      (_, index) => `ba000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    ),
    ledgerEntry: Array.from(
      { length: 8 },
      (_, index) => `bb000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    ),
    commissionOutcome: [
      commissionOutcomeId,
      ...Array.from(
        { length: 7 },
        (_, index) => `be000000-0000-4000-8000-${String(index + 2).padStart(12, '0')}`,
      ),
    ],
    commissionAccrual: [
      commissionAccrualId,
      ...Array.from(
        { length: 7 },
        (_, index) => `bf000000-0000-4000-8000-${String(index + 2).padStart(12, '0')}`,
      ),
    ],
    commissionReversal: Array.from(
      { length: 8 },
      (_, index) => `c0000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    ),
  };
  return (
    entity:
      | 'wallet'
      | 'order'
      | 'orderEvent'
      | 'paymentEvent'
      | 'creditLot'
      | 'ledgerEntry'
      | 'commissionOutcome'
      | 'commissionAccrual'
      | 'commissionReversal',
  ): string => {
    const value = values[entity]?.shift();
    if (!value) throw new Error(`missing test id for ${entity}`);
    return value;
  };
}

async function seedDirectAttribution(
  database: Knex,
  options: { effectiveFrom?: string; organizationStatus?: 'active' | 'suspended' } = {},
): Promise<void> {
  const effectiveFrom = options.effectiveFrom ?? '2026-08-08T05:30:00.000Z';
  const effectiveDate = new Date(effectiveFrom);
  const protectedUntilDate = new Date(effectiveDate);
  protectedUntilDate.setUTCFullYear(protectedUntilDate.getUTCFullYear() + 1);
  const protectedUntil = protectedUntilDate.toISOString();
  const invitationValidFrom = new Date(effectiveDate.getTime() - 24 * 60 * 60 * 1000);
  const invitationExpiresAt = new Date(invitationValidFrom.getTime() + 30 * 24 * 60 * 60 * 1000);

  await database('control_plane.users').insert({
    user_id: channelAdminUserId,
    email: 'payment-channel-admin@example.com',
    display_name: 'Payment Channel Admin',
    password_hash: 'unused',
    status: 'active',
  });
  await database('control_plane.organizations').insert({
    organization_id: channelOrganizationId,
    organization_type: 'CHANNEL',
    display_name: 'Payment TEST Channel',
    status: 'active',
  });
  await database('control_plane.channels').insert({
    channel_id: channelId,
    organization_id: channelOrganizationId,
  });
  await database.transaction(async (transaction) => {
    await transaction('control_plane.organization_memberships').insert({
      membership_id: channelAdminMembershipId,
      user_id: channelAdminUserId,
      organization_id: channelOrganizationId,
      status: 'active',
      primary_role_code: 'channel_admin',
    });
    await transaction('control_plane.organization_membership_roles').insert({
      membership_id: channelAdminMembershipId,
      role_code: 'channel_admin',
    });
  });
  await database('control_plane.terms_documents').insert({
    terms_document_id: termsDocumentId,
    document_code: 'payment-commission-test-notice',
    title: 'Payment commission TEST notice',
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
    published_at: '2025-01-01T00:00:00.000Z',
    effective_at: '2025-01-01T00:00:00.000Z',
    published_by: platformAdminUserId,
    must_reaccept: false,
  });
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
    valid_from: invitationValidFrom,
    expires_at: invitationExpiresAt,
    max_uses: 100,
    creation_idempotency_key: 'payment-commission-test-invitation',
    creation_request_digest: digest('b'),
  });
  await database('control_plane.registrations').insert({
    registration_id: registrationId,
    normalized_email: 'payment-buyer@example.com',
    status: 'completed',
    registration_path: 'CHANNEL_INVITATION',
    invitation_id: invitationId,
    user_id: buyerUserId,
    tenant_id: tenantId,
    membership_id: buyerMembershipId,
    terms_version_id: termsVersionId,
    idempotency_key: 'payment-commission-test-registration',
    request_digest: digest('c'),
    completed_at: effectiveFrom,
  });
  await database('control_plane.referral_attributions').insert({
    referral_attribution_id: attributionId,
    registration_id: registrationId,
    user_id: buyerUserId,
    tenant_id: tenantId,
    acquisition_source: 'CHANNEL_INVITATION',
    invitation_id: invitationId,
    referrer_channel_id: channelId,
    effective_from: effectiveFrom,
    protected_until: protectedUntil,
    protection_rule_version: 'registration-attribution-v1',
    evidence_digest: digest('d'),
    status: 'active',
  });
  if (options.organizationStatus === 'suspended') {
    await database('control_plane.organizations')
      .where({ organization_id: channelOrganizationId })
      .update({ status: 'suspended' });
  }
}

async function seedCommissionRule(
  database: Knex,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await database('control_plane.commission_rule_versions').insert({
    commission_rule_version_id: commissionRuleId,
    rule_code: 'TEST_ATOMIC_COMMISSION',
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
    rule_digest: digest('e'),
    effective_at: '2026-08-08T05:00:00.000Z',
    retired_at: null,
    approved_by_membership_id: platformAdminMembershipId,
    created_at: '2026-08-08T05:00:00.000Z',
    ...overrides,
  });
}

function orderRecord(
  overrides: Partial<CreateRechargeOrderRecord> = {},
): CreateRechargeOrderRecord {
  return {
    tenantId,
    tenantOrganizationId,
    buyerUserId,
    buyerMembershipId,
    paymentMode: 'TEST',
    conversionRuleVersionId: testRuleId,
    idempotencyKey: 'recharge-repository-001',
    requestDigest: digest('3'),
    createdAt: now,
    ...overrides,
  };
}

function paymentRecord(
  overrides: Partial<ReceivePaymentEventRecord> = {},
): ReceivePaymentEventRecord {
  return {
    paymentMode: 'TEST',
    providerCode: 'test-payment',
    providerEventId: 'provider-event-001',
    eventType: 'payment_succeeded',
    eventDigest: digest('4'),
    rechargeOrderId: orderId,
    amountMinor: 100,
    currency: 'CNY',
    occurredAt: new Date('2026-08-08T05:59:00.000Z'),
    receivedAt: now,
    ...overrides,
  };
}

async function count(database: Knex, tableName: string): Promise<number> {
  const row = (await database(`control_plane.${tableName}`).count('* as count').first()) as {
    count: string;
  };
  return Number(row.count);
}

describe.runIf(hasDedicatedTestDatabase)('PostgresPaymentFoundationRepository', () => {
  let database: Knex;
  let repository: PostgresPaymentFoundationRepository;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await resetFoundation(database);
    repository = new PostgresPaymentFoundationRepository(database, ids());
  });

  afterAll(async () => {
    if (!database) return;
    await database.raw('drop schema if exists control_plane cascade');
    await database.destroy();
  });

  it('atomically resolves the active TEST Rule, creates the Tenant Wallet and appends created evidence', async () => {
    const result = await repository.createRechargeOrder(orderRecord());

    expect(result).toEqual({
      replayed: false,
      value: {
        rechargeOrderId: orderId,
        tenantId,
        walletId,
        buyerUserId,
        buyerMembershipId,
        paymentMode: 'TEST',
        conversionRuleVersionId: testRuleId,
        amountMinor: 100,
        currency: 'CNY',
        purchasedCredits: 10,
        bonusCredits: 2,
        bonusExpiresInDays: 30,
        status: 'created',
        attributionSnapshotId: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
    await expect(count(database, 'wallets')).resolves.toBe(1);
    await expect(count(database, 'recharge_order_events')).resolves.toBe(1);
    await expect(count(database, 'payment_events')).resolves.toBe(0);
    await expect(count(database, 'credit_ledger_entries')).resolves.toBe(0);
  });

  it('lists bounded RechargeOrders only from the requested Tenant in newest-first order', async () => {
    await repository.createRechargeOrder(orderRecord());
    await repository.createRechargeOrder(
      orderRecord({
        idempotencyKey: 'recharge-repository-002',
        requestDigest: digest('7'),
        createdAt: new Date('2026-08-08T06:02:00.000Z'),
      }),
    );
    await repository.createRechargeOrder(
      orderRecord({
        tenantId: otherTenantId,
        tenantOrganizationId: otherTenantId,
        buyerUserId: otherUserId,
        buyerMembershipId: otherMembershipId,
        idempotencyKey: 'other-tenant-recharge-001',
        requestDigest: digest('8'),
        createdAt: new Date('2026-08-08T06:01:00.000Z'),
      }),
    );

    const tenantOrders = await repository.listRechargeOrders(tenantId, 1);
    const otherTenantOrders = await repository.listRechargeOrders(otherTenantId, 10);

    expect(tenantOrders).toHaveLength(1);
    expect(tenantOrders[0]).toMatchObject({
      rechargeOrderId: 'b6000000-0000-4000-8000-000000000002',
      tenantId,
      paymentMode: 'TEST',
      status: 'created',
    });
    expect(otherTenantOrders).toHaveLength(1);
    expect(otherTenantOrders[0]).toMatchObject({
      rechargeOrderId: 'b6000000-0000-4000-8000-000000000003',
      tenantId: otherTenantId,
      paymentMode: 'TEST',
    });
  });

  it('replays the same Tenant idempotency digest and rejects a different digest', async () => {
    const first = await repository.createRechargeOrder(orderRecord());
    await expect(
      repository.createRechargeOrder(
        orderRecord({ createdAt: new Date('2026-08-08T06:01:00.000Z') }),
      ),
    ).resolves.toEqual({ value: first.value, replayed: true });
    await expect(
      repository.createRechargeOrder(orderRecord({ requestDigest: digest('5') })),
    ).rejects.toBeInstanceOf(RechargeIdempotencyConflictError);
    await expect(count(database, 'recharge_orders')).resolves.toBe(1);
    await expect(count(database, 'recharge_order_events')).resolves.toBe(1);
  });

  it('rejects LIVE/missing Rules and mismatched active Tenant Membership scope', async () => {
    await expect(
      repository.createRechargeOrder(orderRecord({ conversionRuleVersionId: liveRuleId })),
    ).rejects.toBeInstanceOf(RechargeRuleUnavailableError);
    await expect(
      repository.createRechargeOrder(
        orderRecord({ conversionRuleVersionId: 'b5000000-0000-4000-8000-000000000099' }),
      ),
    ).rejects.toBeInstanceOf(RechargeRuleUnavailableError);
    await expect(
      repository.createRechargeOrder(orderRecord({ buyerMembershipId: otherMembershipId })),
    ).rejects.toBeInstanceOf(RechargeScopeConflictError);
    await expect(count(database, 'recharge_orders')).resolves.toBe(0);
    await expect(count(database, 'wallets')).resolves.toBe(0);
  });

  it('serializes concurrent identical order requests into one Order and one created event', async () => {
    const firstRepository = new PostgresPaymentFoundationRepository(database, ids());
    const secondRepository = new PostgresPaymentFoundationRepository(database, ids());
    const results = await Promise.all([
      firstRepository.createRechargeOrder(orderRecord()),
      secondRepository.createRechargeOrder(orderRecord()),
    ]);

    expect(results.filter((result) => result.replayed)).toHaveLength(1);
    expect(results.filter((result) => !result.replayed)).toHaveLength(1);
    await expect(count(database, 'recharge_orders')).resolves.toBe(1);
    await expect(count(database, 'recharge_order_events')).resolves.toBe(1);
    await expect(count(database, 'wallets')).resolves.toBe(1);
  });

  it('atomically applies a TEST success into paid Order, purchased/bonus Lots and matching Ledger entries', async () => {
    await repository.createRechargeOrder(orderRecord());
    const result = await repository.receivePaymentEvent(paymentRecord());

    expect(result).toMatchObject({
      replayed: false,
      value: {
        paymentEventId,
        paymentMode: 'TEST',
        providerCode: 'test-payment',
        providerEventId: 'provider-event-001',
        rechargeOrderId: orderId,
        processingStatus: 'applied',
        errorCode: null,
        processedAt: now.toISOString(),
      },
    });
    await expect(
      database('control_plane.recharge_orders')
        .select('status')
        .where({ recharge_order_id: orderId })
        .first(),
    ).resolves.toEqual({ status: 'paid' });
    await expect(
      database('control_plane.recharge_order_events')
        .select('event_type', 'source_payment_event_id')
        .where({ recharge_order_id: orderId })
        .orderBy('created_at', 'asc')
        .orderBy('recharge_order_event_id', 'asc'),
    ).resolves.toEqual([
      { event_type: 'created', source_payment_event_id: null },
      { event_type: 'pending', source_payment_event_id: null },
      { event_type: 'paid', source_payment_event_id: paymentEventId },
    ]);

    const lots = await database('control_plane.credit_lots')
      .select('credit_lot_id', 'lot_type', 'original_credits', 'issued_at', 'expires_at')
      .where({ recharge_order_id: orderId })
      .orderBy('lot_type', 'desc');
    expect(lots).toHaveLength(2);
    expect(lots[0]).toMatchObject({
      credit_lot_id: 'ba000000-0000-4000-8000-000000000001',
      lot_type: 'PURCHASED',
      original_credits: '10',
      expires_at: null,
    });
    expect(new Date(lots[0].issued_at).toISOString()).toBe('2026-08-08T05:59:00.000Z');
    expect(lots[1]).toMatchObject({
      credit_lot_id: 'ba000000-0000-4000-8000-000000000002',
      lot_type: 'BONUS',
      original_credits: '2',
    });
    expect(new Date(lots[1].expires_at).toISOString()).toBe('2026-09-07T05:59:00.000Z');

    const ledger = await database('control_plane.credit_ledger_entries')
      .select(
        'credit_lot_id',
        'posting_group_id',
        'operation',
        'bucket',
        'delta',
        'reference_type',
        'reference_id',
        'actor_type',
        'actor_id',
        'reason_code',
      )
      .where({ reference_id: orderId })
      .orderBy('reason_code', 'desc');
    expect(ledger).toEqual([
      {
        credit_lot_id: 'ba000000-0000-4000-8000-000000000001',
        posting_group_id: paymentEventId,
        operation: 'issue',
        bucket: 'available',
        delta: '10',
        reference_type: 'recharge_order',
        reference_id: orderId,
        actor_type: 'system',
        actor_id: 'test-payment',
        reason_code: 'recharge_purchase_issued',
      },
      {
        credit_lot_id: 'ba000000-0000-4000-8000-000000000002',
        posting_group_id: paymentEventId,
        operation: 'issue',
        bucket: 'available',
        delta: '2',
        reference_type: 'recharge_order',
        reference_id: orderId,
        actor_type: 'system',
        actor_id: 'test-payment',
        reason_code: 'recharge_bonus_issued',
      },
    ]);
  });

  it('lists bounded terminal Payment Events newest-first without unsafe Provider payloads', async () => {
    await repository.createRechargeOrder(orderRecord());
    await repository.receivePaymentEvent(paymentRecord());
    await repository.createRechargeOrder(
      orderRecord({
        idempotencyKey: 'recharge-repository-002',
        requestDigest: digest('7'),
        createdAt: new Date('2026-08-08T06:01:00.000Z'),
      }),
    );
    await repository.receivePaymentEvent(
      paymentRecord({
        providerEventId: 'provider-event-002',
        eventDigest: digest('8'),
        rechargeOrderId: 'b6000000-0000-4000-8000-000000000002',
        occurredAt: new Date('2026-08-08T06:01:30.000Z'),
        receivedAt: new Date('2026-08-08T06:02:00.000Z'),
      }),
    );

    const events = await repository.listPaymentEvents(1);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      paymentEventId: 'b9000000-0000-4000-8000-000000000002',
      paymentMode: 'TEST',
      providerEventId: 'provider-event-002',
      processingStatus: 'applied',
      errorCode: null,
      processedAt: '2026-08-08T06:02:00.000Z',
    });
    expect(events[0]).not.toHaveProperty('signature');
    expect(events[0]).not.toHaveProperty('rawCardData');
  });

  it('replays the same Provider identity/digest without duplicating issuance and rejects different facts', async () => {
    await repository.createRechargeOrder(orderRecord());
    const first = await repository.receivePaymentEvent(paymentRecord());
    await expect(
      repository.receivePaymentEvent(paymentRecord({ receivedAt: new Date(now.getTime() + 1000) })),
    ).resolves.toEqual({ value: first.value, replayed: true });
    await expect(
      repository.receivePaymentEvent(paymentRecord({ eventDigest: digest('6') })),
    ).rejects.toBeInstanceOf(PaymentIdempotencyConflictError);
    await expect(count(database, 'payment_events')).resolves.toBe(1);
    await expect(count(database, 'credit_lots')).resolves.toBe(2);
    await expect(count(database, 'credit_ledger_entries')).resolves.toBe(2);
    await expect(count(database, 'recharge_order_events')).resolves.toBe(3);
  });

  it('serializes concurrent identical Provider Events into one apply and one replay', async () => {
    await repository.createRechargeOrder(orderRecord());
    const firstRepository = new PostgresPaymentFoundationRepository(database);
    const secondRepository = new PostgresPaymentFoundationRepository(database);
    const results = await Promise.all([
      firstRepository.receivePaymentEvent(paymentRecord()),
      secondRepository.receivePaymentEvent(paymentRecord()),
    ]);

    expect(results.filter((result) => result.replayed)).toHaveLength(1);
    expect(results.filter((result) => !result.replayed)).toHaveLength(1);
    expect(results.every((result) => result.value.processingStatus === 'applied')).toBe(true);
    expect(new Set(results.map((result) => result.value.paymentEventId)).size).toBe(1);
    await expect(count(database, 'payment_events')).resolves.toBe(1);
    await expect(count(database, 'credit_lots')).resolves.toBe(2);
    await expect(count(database, 'credit_ledger_entries')).resolves.toBe(2);
    await expect(count(database, 'recharge_order_events')).resolves.toBe(3);
  });

  it('serializes concurrent different success Events for one Order into one issuance and one rejection', async () => {
    await repository.createRechargeOrder(orderRecord());
    const firstRepository = new PostgresPaymentFoundationRepository(database);
    const secondRepository = new PostgresPaymentFoundationRepository(database);
    const results = await Promise.all([
      firstRepository.receivePaymentEvent(paymentRecord()),
      secondRepository.receivePaymentEvent(
        paymentRecord({ providerEventId: 'provider-event-002', eventDigest: digest('5') }),
      ),
    ]);

    expect(results.filter((result) => result.value.processingStatus === 'applied')).toHaveLength(1);
    expect(results.filter((result) => result.value.processingStatus === 'rejected')).toHaveLength(
      1,
    );
    expect(
      results.find((result) => result.value.processingStatus === 'rejected')?.value.errorCode,
    ).toBe('invalid_order_state');
    await expect(count(database, 'payment_events')).resolves.toBe(2);
    await expect(count(database, 'credit_lots')).resolves.toBe(2);
    await expect(count(database, 'credit_ledger_entries')).resolves.toBe(2);
    await expect(count(database, 'recharge_order_events')).resolves.toBe(3);
  });

  it('rejects unsupported Events and a frozen Wallet without Order or Credit side effects', async () => {
    await repository.createRechargeOrder(orderRecord());
    const unsupported = await repository.receivePaymentEvent(
      paymentRecord({ eventType: 'payment_failed' }),
    );
    expect(unsupported.value).toMatchObject({
      processingStatus: 'rejected',
      errorCode: 'unsupported_event_type',
      processedAt: now.toISOString(),
    });

    await database('control_plane.wallets')
      .where({ wallet_id: walletId })
      .update({ status: 'frozen' });
    const frozen = await repository.receivePaymentEvent(
      paymentRecord({ providerEventId: 'provider-event-002', eventDigest: digest('5') }),
    );
    expect(frozen.value).toMatchObject({
      processingStatus: 'rejected',
      errorCode: 'wallet_unavailable',
      processedAt: now.toISOString(),
    });
    await expect(
      database('control_plane.recharge_orders')
        .select('status')
        .where({ recharge_order_id: orderId })
        .first(),
    ).resolves.toEqual({ status: 'created' });
    await expect(count(database, 'payment_events')).resolves.toBe(2);
    await expect(count(database, 'credit_lots')).resolves.toBe(0);
    await expect(count(database, 'credit_ledger_entries')).resolves.toBe(0);
    await expect(count(database, 'recharge_order_events')).resolves.toBe(1);
    await expect(count(database, 'commission_calculation_outcomes')).resolves.toBe(0);
    await expect(count(database, 'commission_accruals')).resolves.toBe(0);
  });

  it('rolls back Event, Order, Lot and Ledger evidence when issuance fails mid-transaction', async () => {
    await repository.createRechargeOrder(orderRecord());
    const failingRepository = new PostgresPaymentFoundationRepository(database, (entity) => {
      if (entity === 'paymentEvent') return 'b9000000-0000-4000-8000-000000000099';
      if (entity === 'orderEvent') return 'b8000000-0000-4000-8000-000000000099';
      if (entity === 'creditLot') return 'ba000000-0000-4000-8000-000000000099';
      throw new Error('forced ledger id failure');
    });

    await expect(failingRepository.receivePaymentEvent(paymentRecord())).rejects.toThrow(
      'forced ledger id failure',
    );
    await expect(
      database('control_plane.recharge_orders')
        .select('status')
        .where({ recharge_order_id: orderId })
        .first(),
    ).resolves.toEqual({ status: 'created' });
    await expect(count(database, 'payment_events')).resolves.toBe(0);
    await expect(count(database, 'credit_lots')).resolves.toBe(0);
    await expect(count(database, 'credit_ledger_entries')).resolves.toBe(0);
    await expect(count(database, 'recharge_order_events')).resolves.toBe(1);
  });

  it('atomically appends an accrued Commission Outcome and Accrual for a frozen direct Attribution', async () => {
    await seedDirectAttribution(database);
    await seedCommissionRule(database);
    const order = await repository.createRechargeOrder(orderRecord());
    expect(order.value.attributionSnapshotId).toBe(attributionId);

    await expect(repository.receivePaymentEvent(paymentRecord())).resolves.toMatchObject({
      replayed: false,
      value: { processingStatus: 'applied', errorCode: null },
    });

    const outcome = await database('control_plane.commission_calculation_outcomes').first();
    const accrual = await database('control_plane.commission_accruals').first();
    expect(outcome).toMatchObject({
      commission_calculation_outcome_id: commissionOutcomeId,
      source_payment_event_id: paymentEventId,
      recharge_order_id: orderId,
      referral_attribution_id: attributionId,
      beneficiary_channel_id: channelId,
      commission_rule_version_id: commissionRuleId,
      basis_amount_minor: '100',
      currency: 'CNY',
      outcome: 'accrued',
      reason_code: 'commission_accrued',
    });
    expect(outcome.calculation_snapshot).toMatchObject({
      schemaVersion: 'commission-calculation-v1',
      outcome: 'accrued',
      rateNumerator: '15',
      rateDenominator: '100',
      roundingMode: 'FLOOR',
      commissionAmountMinor: 15,
    });
    expect(outcome.calculation_digest).toMatch(/^[0-9a-f]{64}$/);
    expect(accrual).toMatchObject({
      commission_accrual_id: commissionAccrualId,
      calculation_outcome_id: commissionOutcomeId,
      source_payment_event_id: paymentEventId,
      commission_amount_minor: '15',
      currency: 'CNY',
    });
    expect(new Date(accrual.eligible_at).toISOString()).toBe('2026-08-15T05:59:00.000Z');
    expect(accrual.calculation_digest).toBe(outcome.calculation_digest);
  });

  it('records not_attributed without blocking TEST payment and Credit issuance', async () => {
    await repository.createRechargeOrder(orderRecord());
    const result = await repository.receivePaymentEvent(paymentRecord());

    expect(result.value.processingStatus).toBe('applied');
    await expect(
      database('control_plane.commission_calculation_outcomes')
        .select('outcome', 'reason_code')
        .first(),
    ).resolves.toEqual({ outcome: 'not_attributed', reason_code: 'no_frozen_attribution' });
    await expect(count(database, 'commission_accruals')).resolves.toBe(0);
    await expect(count(database, 'credit_lots')).resolves.toBe(2);
  });

  it('records attribution_expired without a default Accrual', async () => {
    await seedDirectAttribution(database, { effectiveFrom: '2025-08-08T05:00:00.000Z' });
    await seedCommissionRule(database);
    await repository.createRechargeOrder(orderRecord());

    await expect(repository.receivePaymentEvent(paymentRecord())).resolves.toMatchObject({
      value: { processingStatus: 'applied' },
    });
    await expect(
      database('control_plane.commission_calculation_outcomes')
        .select('outcome', 'reason_code', 'referral_attribution_id', 'beneficiary_channel_id')
        .first(),
    ).resolves.toEqual({
      outcome: 'attribution_expired',
      reason_code: 'attribution_expired',
      referral_attribution_id: attributionId,
      beneficiary_channel_id: channelId,
    });
    await expect(count(database, 'commission_accruals')).resolves.toBe(0);
  });

  it.each([
    ['inactive Channel Organization', true],
    ['missing Commission Rule', false],
  ])('records manual_review for %s without guessing a rate', async (_caseName, inactiveChannel) => {
    await seedDirectAttribution(database, {
      organizationStatus: inactiveChannel ? 'suspended' : 'active',
    });
    if (inactiveChannel) await seedCommissionRule(database);
    await repository.createRechargeOrder(orderRecord());

    await expect(repository.receivePaymentEvent(paymentRecord())).resolves.toMatchObject({
      value: { processingStatus: 'applied' },
    });
    await expect(
      database('control_plane.commission_calculation_outcomes')
        .select('outcome', 'reason_code')
        .first(),
    ).resolves.toEqual({
      outcome: 'manual_review',
      reason_code: inactiveChannel ? 'channel_unavailable' : 'commission_rule_unavailable',
    });
    await expect(count(database, 'commission_accruals')).resolves.toBe(0);
  });

  it('does not duplicate Commission facts for Provider replay', async () => {
    await seedDirectAttribution(database);
    await seedCommissionRule(database);
    await repository.createRechargeOrder(orderRecord());

    const first = await repository.receivePaymentEvent(paymentRecord());
    await expect(repository.receivePaymentEvent(paymentRecord())).resolves.toEqual({
      value: first.value,
      replayed: true,
    });
    await expect(count(database, 'commission_calculation_outcomes')).resolves.toBe(1);
    await expect(count(database, 'commission_accruals')).resolves.toBe(1);
  });

  it('keeps one Commission fact set for concurrent different success Events on one Order', async () => {
    await seedDirectAttribution(database);
    await seedCommissionRule(database);
    await repository.createRechargeOrder(orderRecord());
    const results = await Promise.all([
      new PostgresPaymentFoundationRepository(database).receivePaymentEvent(paymentRecord()),
      new PostgresPaymentFoundationRepository(database).receivePaymentEvent(
        paymentRecord({ providerEventId: 'provider-event-002', eventDigest: digest('5') }),
      ),
    ]);

    expect(results.filter((result) => result.value.processingStatus === 'applied')).toHaveLength(1);
    await expect(count(database, 'commission_calculation_outcomes')).resolves.toBe(1);
    await expect(count(database, 'commission_accruals')).resolves.toBe(1);
  });

  it('rolls back Payment, Order, Credit and Commission when Accrual ID allocation fails', async () => {
    await seedDirectAttribution(database);
    await seedCommissionRule(database);
    await repository.createRechargeOrder(orderRecord());
    const failureIds: Record<string, string[]> = {
      paymentEvent: ['b9000000-0000-4000-8000-000000000099'],
      orderEvent: ['b8000000-0000-4000-8000-000000000098', 'b8000000-0000-4000-8000-000000000099'],
      creditLot: ['ba000000-0000-4000-8000-000000000098', 'ba000000-0000-4000-8000-000000000099'],
      ledgerEntry: ['bb000000-0000-4000-8000-000000000098', 'bb000000-0000-4000-8000-000000000099'],
      commissionOutcome: ['be000000-0000-4000-8000-000000000099'],
    };
    const failingRepository = new PostgresPaymentFoundationRepository(database, (entity) => {
      if (entity === 'commissionAccrual') throw new Error('forced commission accrual id failure');
      const value = failureIds[entity]?.shift();
      if (!value) throw new Error(`missing failure id for ${entity}`);
      return value;
    });

    await expect(failingRepository.receivePaymentEvent(paymentRecord())).rejects.toThrow(
      'forced commission accrual id failure',
    );
    await expect(
      database('control_plane.recharge_orders')
        .select('status')
        .where({ recharge_order_id: orderId })
        .first(),
    ).resolves.toEqual({ status: 'created' });
    await expect(count(database, 'payment_events')).resolves.toBe(0);
    await expect(count(database, 'credit_lots')).resolves.toBe(0);
    await expect(count(database, 'credit_ledger_entries')).resolves.toBe(0);
    await expect(count(database, 'commission_calculation_outcomes')).resolves.toBe(0);
    await expect(count(database, 'commission_accruals')).resolves.toBe(0);
  });

  it('fails closed and rolls back when multiple matching ACTIVE Rules are present', async () => {
    await seedDirectAttribution(database);
    await database.raw(
      'drop trigger commission_rules_validation_guard on control_plane.commission_rule_versions',
    );
    await seedCommissionRule(database);
    await seedCommissionRule(database, {
      commission_rule_version_id: secondCommissionRuleId,
      rule_code: 'TEST_ATOMIC_COMMISSION_CONFLICT',
      version_label: 'v2-non-quote',
      rule_digest: digest('f'),
    });
    await repository.createRechargeOrder(orderRecord());

    await expect(repository.receivePaymentEvent(paymentRecord())).rejects.toThrow(
      'Multiple matching Commission Rules',
    );
    await expect(count(database, 'payment_events')).resolves.toBe(0);
    await expect(count(database, 'credit_lots')).resolves.toBe(0);
    await expect(count(database, 'commission_calculation_outcomes')).resolves.toBe(0);
  });

  it('atomically applies a full TEST refund into Credit reclaim, Commission Reversal and refunded Order', async () => {
    await seedDirectAttribution(database);
    await seedCommissionRule(database);
    await repository.createRechargeOrder(orderRecord());
    await repository.receivePaymentEvent(paymentRecord());

    const refund = await repository.receivePaymentEvent(
      paymentRecord({
        providerEventId: 'provider-refund-001',
        eventType: 'refund_succeeded',
        eventDigest: digest('7'),
        occurredAt: new Date('2026-08-09T06:00:00.000Z'),
        receivedAt: new Date('2026-08-09T06:00:01.000Z'),
      }),
    );

    expect(refund.value).toMatchObject({ processingStatus: 'applied', errorCode: null });
    await expect(
      database('control_plane.recharge_orders')
        .select('status')
        .where({ recharge_order_id: orderId })
        .first(),
    ).resolves.toEqual({ status: 'refunded' });
    await expect(
      database('control_plane.credit_ledger_entries')
        .select('operation', 'bucket', 'delta')
        .where({ operation: 'reclaim' })
        .orderBy('delta'),
    ).resolves.toEqual([
      { operation: 'reclaim', bucket: 'available', delta: '-10' },
      { operation: 'reclaim', bucket: 'available', delta: '-2' },
    ]);
    await expect(
      database('control_plane.commission_reversals')
        .select('reversal_type', 'amount_minor', 'currency')
        .first(),
    ).resolves.toEqual({ reversal_type: 'refund', amount_minor: '15', currency: 'CNY' });
  });

  it('applies a full TEST chargeback without inventing a Commission Reversal when no Accrual exists', async () => {
    await repository.createRechargeOrder(orderRecord());
    await repository.receivePaymentEvent(paymentRecord());

    const chargeback = await repository.receivePaymentEvent(
      paymentRecord({
        providerEventId: 'provider-chargeback-001',
        eventType: 'chargeback_succeeded',
        eventDigest: digest('8'),
        occurredAt: new Date('2026-08-09T07:00:00.000Z'),
        receivedAt: new Date('2026-08-09T07:00:01.000Z'),
      }),
    );

    expect(chargeback.value).toMatchObject({ processingStatus: 'applied', errorCode: null });
    await expect(
      database('control_plane.recharge_orders')
        .select('status')
        .where({ recharge_order_id: orderId })
        .first(),
    ).resolves.toEqual({ status: 'disputed' });
    await expect(count(database, 'commission_reversals')).resolves.toBe(0);
    await expect(
      database('control_plane.credit_ledger_entries')
        .where({ operation: 'reclaim' })
        .count('* as count')
        .first(),
    ).resolves.toMatchObject({ count: '2' });
  });

  it('stably rejects partial refunds without changing Credit, Commission or Order', async () => {
    await repository.createRechargeOrder(orderRecord());
    await repository.receivePaymentEvent(paymentRecord());

    const partial = await repository.receivePaymentEvent(
      paymentRecord({
        providerEventId: 'provider-refund-partial',
        eventType: 'refund_succeeded',
        eventDigest: digest('9'),
        amountMinor: 50,
        occurredAt: new Date('2026-08-09T08:00:00.000Z'),
        receivedAt: new Date('2026-08-09T08:00:01.000Z'),
      }),
    );

    expect(partial.value).toMatchObject({
      processingStatus: 'rejected',
      errorCode: 'partial_refund_unsupported',
    });
    await expect(
      database('control_plane.recharge_orders')
        .select('status')
        .where({ recharge_order_id: orderId })
        .first(),
    ).resolves.toEqual({ status: 'paid' });
    await expect(count(database, 'commission_reversals')).resolves.toBe(0);
  });

  it('fails closed when Wallet activity makes complete Lot reclaim unprovable', async () => {
    await repository.createRechargeOrder(orderRecord());
    await repository.receivePaymentEvent(paymentRecord());
    await database('control_plane.credit_ledger_entries').insert({
      ledger_entry_id: 'bb000000-0000-4000-8000-000000000099',
      tenant_id: tenantId,
      wallet_id: walletId,
      reservation_id: null,
      posting_group_id: 'bb000000-0000-4000-8000-000000000098',
      operation: 'adjust',
      bucket: 'available',
      delta: -1,
      reference_type: 'manual_test',
      reference_id: orderId,
      idempotency_key: 'unsafe-wallet-adjustment',
      actor_type: 'admin',
      actor_id: platformAdminMembershipId,
      reason_code: 'test_unsafe_reclaim_evidence',
      occurred_at: '2026-08-09T08:30:00.000Z',
      created_at: '2026-08-09T08:30:00.000Z',
      credit_lot_id: null,
    });

    const refund = await repository.receivePaymentEvent(
      paymentRecord({
        providerEventId: 'provider-refund-unsafe',
        eventType: 'refund_succeeded',
        eventDigest: digest('a'),
        occurredAt: new Date('2026-08-09T09:00:00.000Z'),
        receivedAt: new Date('2026-08-09T09:00:01.000Z'),
      }),
    );

    expect(refund.value).toMatchObject({
      processingStatus: 'rejected',
      errorCode: 'credit_reclaim_unsafe',
    });
    await expect(
      database('control_plane.recharge_orders')
        .select('status')
        .where({ recharge_order_id: orderId })
        .first(),
    ).resolves.toEqual({ status: 'paid' });
    await expect(
      database('control_plane.credit_ledger_entries')
        .where({ operation: 'reclaim' })
        .count('* as count')
        .first(),
    ).resolves.toMatchObject({ count: '0' });
  });

  it('replays a full refund without duplicating reclaim, Commission Reversal or Order evidence', async () => {
    await seedDirectAttribution(database);
    await seedCommissionRule(database);
    await repository.createRechargeOrder(orderRecord());
    await repository.receivePaymentEvent(paymentRecord());
    const input = paymentRecord({
      providerEventId: 'provider-refund-replay',
      eventType: 'refund_succeeded',
      eventDigest: digest('b'),
      occurredAt: new Date('2026-08-09T09:30:00.000Z'),
      receivedAt: new Date('2026-08-09T09:30:01.000Z'),
    });

    const first = await repository.receivePaymentEvent(input);
    const replay = await repository.receivePaymentEvent(input);

    expect(first.replayed).toBe(false);
    expect(replay).toEqual({ ...first, replayed: true });
    await expect(count(database, 'payment_events')).resolves.toBe(2);
    await expect(count(database, 'commission_reversals')).resolves.toBe(1);
    await expect(
      database('control_plane.credit_ledger_entries')
        .where({ operation: 'reclaim' })
        .count('* as count')
        .first(),
    ).resolves.toMatchObject({ count: '2' });
    await expect(
      database('control_plane.recharge_order_events')
        .where({ event_type: 'refunded' })
        .count('* as count')
        .first(),
    ).resolves.toMatchObject({ count: '1' });
  });

  it('serializes competing full refund and chargeback Events so at most one is applied', async () => {
    await repository.createRechargeOrder(orderRecord());
    await repository.receivePaymentEvent(paymentRecord());

    const [refund, chargeback] = await Promise.all([
      repository.receivePaymentEvent(
        paymentRecord({
          providerEventId: 'provider-refund-race',
          eventType: 'refund_succeeded',
          eventDigest: digest('c'),
          occurredAt: new Date('2026-08-09T10:00:00.000Z'),
          receivedAt: new Date('2026-08-09T10:00:01.000Z'),
        }),
      ),
      repository.receivePaymentEvent(
        paymentRecord({
          providerEventId: 'provider-chargeback-race',
          eventType: 'chargeback_succeeded',
          eventDigest: digest('d'),
          occurredAt: new Date('2026-08-09T10:00:02.000Z'),
          receivedAt: new Date('2026-08-09T10:00:03.000Z'),
        }),
      ),
    ]);

    expect([refund.value.processingStatus, chargeback.value.processingStatus].sort()).toEqual([
      'applied',
      'rejected',
    ]);
    await expect(
      database('control_plane.credit_ledger_entries')
        .where({ operation: 'reclaim' })
        .count('* as count')
        .first(),
    ).resolves.toMatchObject({ count: '2' });
    await expect(
      database('control_plane.recharge_order_events')
        .whereIn('event_type', ['refunded', 'disputed'])
        .count('* as count')
        .first(),
    ).resolves.toMatchObject({ count: '1' });
  });

  it('rejects full reversal when the Wallet has historical Credit Reservation evidence', async () => {
    await repository.createRechargeOrder(orderRecord());
    await repository.receivePaymentEvent(paymentRecord());
    const projectId = 'c1000000-0000-4000-8000-000000000001';
    const packageId = 'c2000000-0000-4000-8000-000000000001';
    const reservationId = 'c3000000-0000-4000-8000-000000000001';
    const taskId = 'c4000000-0000-4000-8000-000000000001';
    await database.transaction(async (transaction) => {
      await transaction.raw('set constraints all deferred');
      await transaction('control_plane.projects').insert({
        project_id: projectId,
        tenant_id: tenantId,
        name: 'Historical reservation proof',
        status: 'active',
        platform: 'test',
        aspect_ratio: '9:16',
        target_duration_seconds: 30,
        created_by: buyerUserId,
      });
      await transaction('control_plane.production_packages').insert({
        package_id: packageId,
        tenant_id: tenantId,
        project_id: projectId,
        contract_version: 'test-v1',
        idempotency_key: 'historical-reservation-package',
        package_digest: digest('e'),
        snapshot: {},
        status: 'ready',
        valid_from: '2026-08-08T00:00:00.000Z',
        expires_at: '2026-08-10T00:00:00.000Z',
      });
      await transaction('control_plane.credit_reservations').insert({
        reservation_id: reservationId,
        tenant_id: tenantId,
        wallet_id: walletId,
        generation_task_id: taskId,
        status: 'released',
        reserved_credits: 1,
        consumed_credits: 0,
        released_credits: 1,
        rate_card_version: 'test-v1',
        idempotency_key: 'historical-reservation',
      });
      await transaction('control_plane.production_tasks').insert({
        generation_task_id: taskId,
        tenant_id: tenantId,
        project_id: projectId,
        package_id: packageId,
        reservation_id: reservationId,
        task_type: 'video',
        capability_code: 'test',
        status: 'cancelled',
        idempotency_key: 'historical-reservation-task',
      });
    });

    const refund = await repository.receivePaymentEvent(
      paymentRecord({
        providerEventId: 'provider-refund-reservation',
        eventType: 'refund_succeeded',
        eventDigest: digest('f'),
        occurredAt: new Date('2026-08-09T10:30:00.000Z'),
        receivedAt: new Date('2026-08-09T10:30:01.000Z'),
      }),
    );

    expect(refund.value).toMatchObject({
      processingStatus: 'rejected',
      errorCode: 'credit_reclaim_unsafe',
    });
    await expect(count(database, 'commission_reversals')).resolves.toBe(0);
  });

  it('rejects full reversal for frozen Wallets and non-paid Orders', async () => {
    await repository.createRechargeOrder(orderRecord());
    const nonPaid = await repository.receivePaymentEvent(
      paymentRecord({
        providerEventId: 'provider-refund-non-paid',
        eventType: 'refund_succeeded',
        eventDigest: digest('0'),
      }),
    );
    expect(nonPaid.value).toMatchObject({
      processingStatus: 'rejected',
      errorCode: 'invalid_order_state',
    });

    await repository.receivePaymentEvent(
      paymentRecord({
        providerEventId: 'provider-payment-after-rejection',
        eventDigest: digest('1'),
      }),
    );
    await database('control_plane.wallets')
      .where({ wallet_id: walletId })
      .update({ status: 'frozen' });
    const frozen = await repository.receivePaymentEvent(
      paymentRecord({
        providerEventId: 'provider-refund-frozen',
        eventType: 'refund_succeeded',
        eventDigest: digest('2'),
        occurredAt: new Date('2026-08-09T11:00:00.000Z'),
        receivedAt: new Date('2026-08-09T11:00:01.000Z'),
      }),
    );
    expect(frozen.value).toMatchObject({
      processingStatus: 'rejected',
      errorCode: 'wallet_unavailable',
    });
    await expect(
      database('control_plane.recharge_orders')
        .select('status')
        .where({ recharge_order_id: orderId })
        .first(),
    ).resolves.toEqual({ status: 'paid' });
  });

  it('stably rejects when an Accrual already has Commission Reversal evidence', async () => {
    await seedDirectAttribution(database);
    await seedCommissionRule(database);
    await repository.createRechargeOrder(orderRecord());
    await repository.receivePaymentEvent(paymentRecord());
    const existingRefundEventId = 'c8000000-0000-4000-8000-000000000001';
    const existingRefundOccurredAt = '2026-08-09T11:15:00.000Z';
    const existingRefundReceivedAt = '2026-08-09T11:15:01.000Z';
    await database('control_plane.payment_events').insert({
      payment_event_id: existingRefundEventId,
      payment_mode: 'TEST',
      provider_code: 'test-payment',
      provider_event_id: 'provider-refund-existing-commission',
      event_type: 'refund_succeeded',
      event_digest: digest('5'),
      recharge_order_id: orderId,
      amount_minor: 100,
      currency: 'CNY',
      occurred_at: existingRefundOccurredAt,
      received_at: existingRefundReceivedAt,
      processing_status: 'received',
      error_code: null,
      processed_at: null,
    });
    await database('control_plane.payment_events')
      .where({ payment_event_id: existingRefundEventId })
      .update({
        processing_status: 'applied',
        processed_at: existingRefundReceivedAt,
      });
    await database('control_plane.commission_reversals').insert({
      commission_reversal_id: 'c9000000-0000-4000-8000-000000000001',
      commission_accrual_id: commissionAccrualId,
      source_payment_event_id: existingRefundEventId,
      reversal_type: 'refund',
      amount_minor: 15,
      currency: 'CNY',
      reversal_snapshot: { schemaVersion: 'commission-reversal-v1', fixture: true },
      reversal_digest: digest('6'),
      occurred_at: existingRefundOccurredAt,
      created_at: existingRefundReceivedAt,
    });

    const refund = await repository.receivePaymentEvent(
      paymentRecord({
        providerEventId: 'provider-refund-commission-conflict',
        eventType: 'refund_succeeded',
        eventDigest: digest('7'),
        occurredAt: new Date('2026-08-09T11:20:00.000Z'),
        receivedAt: new Date('2026-08-09T11:20:01.000Z'),
      }),
    );

    expect(refund.value).toMatchObject({
      processingStatus: 'rejected',
      errorCode: 'commission_reversal_conflict',
    });
    await expect(
      database('control_plane.credit_ledger_entries')
        .where({ operation: 'reclaim' })
        .count('* as count')
        .first(),
    ).resolves.toMatchObject({ count: '0' });
  });

  it('rolls back the reversal Event when reclaim Ledger ID allocation fails', async () => {
    await repository.createRechargeOrder(orderRecord());
    await repository.receivePaymentEvent(paymentRecord());
    const failureIds: Record<string, string[]> = {
      paymentEvent: ['c5000000-0000-4000-8000-000000000001'],
    };
    const failingRepository = new PostgresPaymentFoundationRepository(database, (entity) => {
      if (entity === 'ledgerEntry') throw new Error('forced reclaim ledger id failure');
      const value = failureIds[entity]?.shift();
      if (!value) throw new Error(`missing failure id for ${entity}`);
      return value;
    });

    await expect(
      failingRepository.receivePaymentEvent(
        paymentRecord({
          providerEventId: 'provider-refund-ledger-failure',
          eventType: 'refund_succeeded',
          eventDigest: digest('3'),
          occurredAt: new Date('2026-08-09T11:30:00.000Z'),
          receivedAt: new Date('2026-08-09T11:30:01.000Z'),
        }),
      ),
    ).rejects.toThrow('forced reclaim ledger id failure');
    await expect(count(database, 'payment_events')).resolves.toBe(1);
    await expect(
      database('control_plane.credit_ledger_entries')
        .where({ operation: 'reclaim' })
        .count('* as count')
        .first(),
    ).resolves.toMatchObject({ count: '0' });
  });

  it('rolls back reclaim and Payment evidence when Commission Reversal ID allocation fails', async () => {
    await seedDirectAttribution(database);
    await seedCommissionRule(database);
    await repository.createRechargeOrder(orderRecord());
    await repository.receivePaymentEvent(paymentRecord());
    const failureIds: Record<string, string[]> = {
      paymentEvent: ['c6000000-0000-4000-8000-000000000001'],
      ledgerEntry: ['c7000000-0000-4000-8000-000000000001', 'c7000000-0000-4000-8000-000000000002'],
    };
    const failingRepository = new PostgresPaymentFoundationRepository(database, (entity) => {
      if (entity === 'commissionReversal') {
        throw new Error('forced commission reversal id failure');
      }
      const value = failureIds[entity]?.shift();
      if (!value) throw new Error(`missing failure id for ${entity}`);
      return value;
    });

    await expect(
      failingRepository.receivePaymentEvent(
        paymentRecord({
          providerEventId: 'provider-refund-commission-failure',
          eventType: 'refund_succeeded',
          eventDigest: digest('4'),
          occurredAt: new Date('2026-08-09T12:00:00.000Z'),
          receivedAt: new Date('2026-08-09T12:00:01.000Z'),
        }),
      ),
    ).rejects.toThrow('forced commission reversal id failure');
    await expect(count(database, 'payment_events')).resolves.toBe(1);
    await expect(count(database, 'commission_reversals')).resolves.toBe(0);
    await expect(
      database('control_plane.credit_ledger_entries')
        .where({ operation: 'reclaim' })
        .count('* as count')
        .first(),
    ).resolves.toMatchObject({ count: '0' });
    await expect(
      database('control_plane.recharge_orders')
        .select('status')
        .where({ recharge_order_id: orderId })
        .first(),
    ).resolves.toEqual({ status: 'paid' });
  });

  it('rejects Payment Event facts that do not match the locked Recharge Order', async () => {
    await repository.createRechargeOrder(orderRecord());
    await expect(
      repository.receivePaymentEvent(paymentRecord({ amountMinor: 101 })),
    ).rejects.toBeInstanceOf(PaymentOrderConflictError);
    await expect(
      repository.receivePaymentEvent(paymentRecord({ currency: 'USD' })),
    ).rejects.toBeInstanceOf(PaymentOrderConflictError);
    await expect(count(database, 'payment_events')).resolves.toBe(0);
  });
});
