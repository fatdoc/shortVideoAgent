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

const digest = (character: string): string => character.repeat(64);

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
  };
  return (
    entity: 'wallet' | 'order' | 'orderEvent' | 'paymentEvent' | 'creditLot' | 'ledgerEntry',
  ): string => {
    const value = values[entity]?.shift();
    if (!value) throw new Error(`missing test id for ${entity}`);
    return value;
  };
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
