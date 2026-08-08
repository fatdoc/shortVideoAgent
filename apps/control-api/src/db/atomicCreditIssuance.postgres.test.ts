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
import {
  down as removeAtomicCreditIssuance,
  up as addAtomicCreditIssuance,
} from './migrations/015_atomic_credit_issuance.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const tenantId = 'c1000000-0000-4000-8000-000000000001';
const platformOrganizationId = 'c2000000-0000-4000-8000-000000000001';
const buyerUserId = 'c3000000-0000-4000-8000-000000000001';
const platformAdminUserId = 'c3000000-0000-4000-8000-000000000002';
const buyerMembershipId = 'c4000000-0000-4000-8000-000000000001';
const platformAdminMembershipId = 'c4000000-0000-4000-8000-000000000002';
const walletId = 'c5000000-0000-4000-8000-000000000001';
const ruleId = 'c6000000-0000-4000-8000-000000000001';
const orderId = 'c7000000-0000-4000-8000-000000000001';
const paymentEventId = 'c8000000-0000-4000-8000-000000000001';
const purchaseLotId = 'c9000000-0000-4000-8000-000000000001';
const bonusLotId = 'c9000000-0000-4000-8000-000000000002';
const purchaseLedgerId = 'ca000000-0000-4000-8000-000000000001';
const bonusLedgerId = 'ca000000-0000-4000-8000-000000000002';
const postingGroupId = paymentEventId;
const issuedAt = '2026-08-08T08:00:00.000Z';
const bonusExpiresAt = '2026-11-06T08:00:00.000Z';
const digest = (character: string): string => character.repeat(64);

async function resetFoundation(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);
  await database('control_plane.tenants').insert({
    tenant_id: tenantId,
    display_name: 'Atomic Credit Tenant',
    status: 'active',
  });
  await database('control_plane.users').insert([
    {
      user_id: buyerUserId,
      email: 'atomic-credit-buyer@example.com',
      display_name: 'Atomic Credit Buyer',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: platformAdminUserId,
      email: 'atomic-credit-platform@example.com',
      display_name: 'Atomic Credit Platform',
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
  await addTermsVersioning(database);
  await addInvitationLifecycle(database);
  await addRegistrationAttribution(database);
  await database('control_plane.organizations').insert({
    organization_id: platformOrganizationId,
    organization_type: 'PLATFORM',
    display_name: 'Atomic Credit Platform',
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
  await database('control_plane.wallets').insert({
    wallet_id: walletId,
    tenant_id: tenantId,
    credit_type: 'AI_VIDEO_CREDIT',
    status: 'active',
  });
  await addRechargePaymentFoundation(database);
}

async function seedPaymentFacts(database: Knex): Promise<void> {
  await database('control_plane.credit_conversion_rule_versions').insert({
    rule_version_id: ruleId,
    rule_code: 'TEST_ATOMIC_CREDIT',
    version_label: 'v1',
    payment_mode: 'TEST',
    status: 'ACTIVE',
    currency: 'CNY',
    amount_minor: 100,
    purchased_credits: 10,
    bonus_credits: 2,
    bonus_expires_in_days: 90,
    rule_digest: digest('a'),
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
    conversion_rule_version_id: ruleId,
    amount_minor: 100,
    currency: 'CNY',
    purchased_credits: 10,
    bonus_credits: 2,
    bonus_expires_in_days: 90,
    status: 'created',
    attribution_snapshot_id: null,
    idempotency_key: 'atomic-credit-order',
    request_digest: digest('b'),
    created_at: '2026-08-08T07:30:00.000Z',
    updated_at: '2026-08-08T07:30:00.000Z',
  });
  await database('control_plane.recharge_order_events').insert({
    recharge_order_event_id: 'cc000000-0000-4000-8000-000000000001',
    recharge_order_id: orderId,
    event_type: 'created',
    source_payment_event_id: null,
    actor_type: 'user',
    actor_id: buyerUserId,
    reason_code: 'tenant_recharge_requested',
    occurred_at: '2026-08-08T07:30:00.000Z',
  });
  await database('control_plane.payment_events').insert({
    payment_event_id: paymentEventId,
    payment_mode: 'TEST',
    provider_code: 'test-payment',
    provider_event_id: 'atomic-credit-event-001',
    event_type: 'payment_succeeded',
    event_digest: digest('c'),
    recharge_order_id: orderId,
    amount_minor: 100,
    currency: 'CNY',
    occurred_at: issuedAt,
    received_at: issuedAt,
    processing_status: 'received',
    error_code: null,
  });
}

async function insertLot(
  database: Knex,
  lotType: 'PURCHASED' | 'BONUS',
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await database('control_plane.credit_lots').insert({
    credit_lot_id: lotType === 'PURCHASED' ? purchaseLotId : bonusLotId,
    tenant_id: tenantId,
    wallet_id: walletId,
    recharge_order_id: orderId,
    source_payment_event_id: paymentEventId,
    conversion_rule_version_id: ruleId,
    lot_type: lotType,
    original_credits: lotType === 'PURCHASED' ? 10 : 2,
    issued_at: issuedAt,
    expires_at: lotType === 'PURCHASED' ? null : bonusExpiresAt,
    created_at: issuedAt,
    ...overrides,
  });
}

async function insertLedger(
  database: Knex,
  lotType: 'PURCHASED' | 'BONUS',
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const purchased = lotType === 'PURCHASED';
  await database('control_plane.credit_ledger_entries').insert({
    ledger_entry_id: purchased ? purchaseLedgerId : bonusLedgerId,
    tenant_id: tenantId,
    wallet_id: walletId,
    reservation_id: null,
    credit_lot_id: purchased ? purchaseLotId : bonusLotId,
    posting_group_id: postingGroupId,
    operation: 'issue',
    bucket: 'available',
    delta: purchased ? 10 : 2,
    reference_type: 'recharge_order',
    reference_id: orderId,
    idempotency_key: `payment-event:${paymentEventId}:${purchased ? 'purchased' : 'bonus'}`,
    actor_type: 'system',
    actor_id: 'test-payment',
    reason_code: purchased ? 'recharge_purchase_issued' : 'recharge_bonus_issued',
    occurred_at: issuedAt,
    created_at: issuedAt,
    ...overrides,
  });
}

const describeDatabase = hasDedicatedTestDatabase ? describe : describe.skip;
const database = databaseUrl
  ? knex({ client: 'pg', connection: databaseUrl, pool: { min: 0, max: 1 } })
  : null;

describeDatabase('atomic credit issuance migration PostgreSQL contract', () => {
  beforeEach(async () => {
    if (!database) throw new Error('CONTROL_API_TEST_DATABASE_URL is required.');
    await resetFoundation(database);
    await addAtomicCreditIssuance(database);
  });

  afterAll(async () => {
    if (database) await database.destroy();
  });

  it('adds empty Credit Lot and Payment processing evidence schema without seed facts', async () => {
    if (!database) return;
    const table = await database.raw<{ rows: Array<{ table_name: string | null }> }>(
      "select to_regclass('control_plane.credit_lots')::text as table_name",
    );
    const columns = await database('information_schema.columns')
      .select('table_name', 'column_name')
      .where({ table_schema: 'control_plane' })
      .whereIn(
        ['table_name', 'column_name'],
        [
          ['payment_events', 'processed_at'],
          ['credit_ledger_entries', 'credit_lot_id'],
        ],
      );

    expect(table.rows[0]?.table_name).toBe('control_plane.credit_lots');
    expect(columns).toEqual(
      expect.arrayContaining([
        { table_name: 'payment_events', column_name: 'processed_at' },
        { table_name: 'credit_ledger_entries', column_name: 'credit_lot_id' },
      ]),
    );
    await expect(
      database('control_plane.credit_lots').count('* as count').first(),
    ).resolves.toEqual({
      count: '0',
    });
  });

  it('accepts purchased and bonus lots with exactly one matching append-only issue each', async () => {
    if (!database) return;
    await seedPaymentFacts(database);
    await insertLot(database, 'PURCHASED');
    await insertLot(database, 'BONUS');
    await insertLedger(database, 'PURCHASED');
    await insertLedger(database, 'BONUS');

    const lots = await database('control_plane.credit_lots')
      .select('lot_type', 'original_credits', 'expires_at')
      .orderBy('lot_type');
    expect(
      lots.map((row) => ({
        ...row,
        original_credits: Number(row.original_credits),
        expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      })),
    ).toEqual([
      { lot_type: 'BONUS', original_credits: 2, expires_at: bonusExpiresAt },
      { lot_type: 'PURCHASED', original_credits: 10, expires_at: null },
    ]);
    await expect(
      database('control_plane.credit_ledger_entries').count('* as count').first(),
    ).resolves.toEqual({
      count: '2',
    });
    await expect(
      insertLedger(database, 'PURCHASED', {
        ledger_entry_id: 'ca000000-0000-4000-8000-000000000003',
      }),
    ).rejects.toThrow();
    await expect(
      database('control_plane.credit_lots')
        .where({ credit_lot_id: purchaseLotId })
        .update({ original_credits: 11 }),
    ).rejects.toThrow(/immutable/i);
  });

  it('rejects lot and Ledger facts that do not match the frozen Order and Payment Event', async () => {
    if (!database) return;
    await seedPaymentFacts(database);
    await expect(insertLot(database, 'PURCHASED', { original_credits: 11 })).rejects.toThrow(
      /credits/i,
    );
    await expect(insertLot(database, 'PURCHASED', { expires_at: bonusExpiresAt })).rejects.toThrow(
      /expiry|expires/i,
    );
    await insertLot(database, 'PURCHASED');
    await expect(insertLedger(database, 'PURCHASED', { delta: 9 })).rejects.toThrow(
      /Ledger|credits|delta/i,
    );
    await expect(
      insertLedger(database, 'PURCHASED', { actor_id: 'browser-session' }),
    ).rejects.toThrow(/Ledger|actor|Provider/i);
  });

  it('requires terminal Payment processing evidence and makes it immutable', async () => {
    if (!database) return;
    await seedPaymentFacts(database);
    await expect(
      database('control_plane.payment_events')
        .where({ payment_event_id: paymentEventId })
        .update({ processing_status: 'applied', processed_at: null }),
    ).rejects.toThrow();
    await database('control_plane.payment_events')
      .where({ payment_event_id: paymentEventId })
      .update({ processing_status: 'applied', processed_at: '2026-08-08T08:00:01.000Z' });
    await expect(
      database('control_plane.payment_events')
        .where({ payment_event_id: paymentEventId })
        .update({ processed_at: '2026-08-08T08:00:02.000Z' }),
    ).rejects.toThrow(/terminal|immutable/i);
  });

  it('blocks destructive rollback when issuance evidence exists and cleanly rolls back empty schema', async () => {
    if (!database) return;
    await seedPaymentFacts(database);
    await insertLot(database, 'PURCHASED');
    await expect(removeAtomicCreditIssuance(database)).rejects.toThrow(/rollback blocked/i);

    await resetFoundation(database);
    await addAtomicCreditIssuance(database);
    await removeAtomicCreditIssuance(database);
    const table = await database.raw<{ rows: Array<{ table_name: string | null }> }>(
      "select to_regclass('control_plane.credit_lots')::text as table_name",
    );
    expect(table.rows[0]?.table_name).toBeNull();
    await expect(
      database('information_schema.columns')
        .where({
          table_schema: 'control_plane',
          table_name: 'payment_events',
          column_name: 'processed_at',
        })
        .count('* as count')
        .first(),
    ).resolves.toEqual({ count: '0' });
  });
});
