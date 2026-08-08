import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from './migrations/001_pilot_core.js';
import { up as addOrganizationFoundation } from './migrations/006_organization_foundation.js';
import { up as addChannelFoundation } from './migrations/007_channel_foundation.js';
import { up as addOrganizationMembership } from './migrations/008_organization_membership.js';
import { up as addTermsVersioning } from './migrations/011_terms_versioning.js';
import { up as addInvitationLifecycle } from './migrations/012_invitation_lifecycle.js';
import { up as addRegistrationAttribution } from './migrations/013_registration_attribution.js';
import {
  down as removeRechargePaymentFoundation,
  up as addRechargePaymentFoundation,
} from './migrations/014_recharge_payment_foundation.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const tenantId = 'a1000000-0000-4000-8000-000000000001';
const otherTenantId = 'a1000000-0000-4000-8000-000000000002';
const platformOrganizationId = 'a2000000-0000-4000-8000-000000000001';
const buyerUserId = 'a3000000-0000-4000-8000-000000000001';
const otherBuyerUserId = 'a3000000-0000-4000-8000-000000000002';
const platformAdminUserId = 'a3000000-0000-4000-8000-000000000003';
const buyerMembershipId = 'a4000000-0000-4000-8000-000000000001';
const otherBuyerMembershipId = 'a4000000-0000-4000-8000-000000000002';
const platformAdminMembershipId = 'a4000000-0000-4000-8000-000000000003';
const walletId = 'a5000000-0000-4000-8000-000000000001';
const otherWalletId = 'a5000000-0000-4000-8000-000000000002';
const testRuleId = 'a6000000-0000-4000-8000-000000000001';
const liveRuleId = 'a6000000-0000-4000-8000-000000000002';
const orderId = 'a7000000-0000-4000-8000-000000000001';
const orderEventId = 'a8000000-0000-4000-8000-000000000001';
const paymentEventId = 'a9000000-0000-4000-8000-000000000001';
const alternatePaymentEventId = 'a9000000-0000-4000-8000-000000000002';

const digest = (character: string): string => character.repeat(64);

async function resetFoundation(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);

  await database('control_plane.tenants').insert([
    {
      tenant_id: tenantId,
      display_name: 'Recharge Tenant',
      status: 'active',
    },
    {
      tenant_id: otherTenantId,
      display_name: 'Other Recharge Tenant',
      status: 'active',
    },
  ]);
  await database('control_plane.users').insert([
    {
      user_id: buyerUserId,
      email: 'recharge-buyer@example.com',
      display_name: 'Recharge Buyer',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: otherBuyerUserId,
      email: 'other-recharge-buyer@example.com',
      display_name: 'Other Recharge Buyer',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: platformAdminUserId,
      email: 'recharge-platform-admin@example.com',
      display_name: 'Recharge Platform Admin',
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
      membership_id: otherBuyerMembershipId,
      tenant_id: otherTenantId,
      user_id: otherBuyerUserId,
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

  await database('control_plane.organizations').insert({
    organization_id: platformOrganizationId,
    organization_type: 'PLATFORM',
    display_name: 'Recharge Platform',
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

  await database('control_plane.wallets').insert([
    {
      wallet_id: walletId,
      tenant_id: tenantId,
      credit_type: 'AI_VIDEO_CREDIT',
      status: 'active',
    },
    {
      wallet_id: otherWalletId,
      tenant_id: otherTenantId,
      credit_type: 'AI_VIDEO_CREDIT',
      status: 'active',
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

async function insertRule(database: Knex, overrides: Record<string, unknown> = {}): Promise<void> {
  await database('control_plane.credit_conversion_rule_versions').insert({
    rule_version_id: testRuleId,
    rule_code: 'TEST_STANDARD',
    version_label: 'v1',
    payment_mode: 'TEST',
    status: 'ACTIVE',
    currency: 'CNY',
    amount_minor: 100,
    purchased_credits: 10,
    bonus_credits: 0,
    bonus_expires_in_days: null,
    rule_digest: digest('a'),
    effective_at: '2026-08-08T02:00:00.000Z',
    retired_at: null,
    approved_by_membership_id: platformAdminMembershipId,
    ...overrides,
  });
}

async function insertOrder(database: Knex, overrides: Record<string, unknown> = {}): Promise<void> {
  await database('control_plane.recharge_orders').insert({
    recharge_order_id: orderId,
    tenant_id: tenantId,
    wallet_id: walletId,
    buyer_user_id: buyerUserId,
    buyer_membership_id: buyerMembershipId,
    payment_mode: 'TEST',
    conversion_rule_version_id: testRuleId,
    amount_minor: 100,
    currency: 'CNY',
    purchased_credits: 10,
    bonus_credits: 0,
    bonus_expires_in_days: null,
    status: 'created',
    attribution_snapshot_id: null,
    idempotency_key: 'recharge-order-key',
    request_digest: digest('b'),
    ...overrides,
  });
}

async function insertOrderEvent(
  database: Knex,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await database('control_plane.recharge_order_events').insert({
    recharge_order_event_id: orderEventId,
    recharge_order_id: orderId,
    event_type: 'created',
    source_payment_event_id: null,
    actor_type: 'user',
    actor_id: buyerUserId,
    reason_code: 'tenant_recharge_requested',
    occurred_at: '2026-08-08T02:01:00.000Z',
    ...overrides,
  });
}

async function insertPaymentEvent(
  database: Knex,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await database('control_plane.payment_events').insert({
    payment_event_id: paymentEventId,
    payment_mode: 'TEST',
    provider_code: 'test-provider',
    provider_event_id: 'test-event-001',
    event_type: 'payment_succeeded',
    event_digest: digest('c'),
    recharge_order_id: orderId,
    amount_minor: 100,
    currency: 'CNY',
    occurred_at: '2026-08-08T02:02:00.000Z',
    processing_status: 'received',
    error_code: null,
    ...overrides,
  });
}

async function prepareOrder(database: Knex): Promise<void> {
  await insertRule(database);
  await insertOrder(database);
}

describe.runIf(hasDedicatedTestDatabase)('migration 014 recharge payment foundation', () => {
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

  it('creates empty recharge and payment tables and accepts explicit TEST facts', async () => {
    await addRechargePaymentFoundation(database);

    await expect(
      Promise.all(
        [
          'credit_conversion_rule_versions',
          'recharge_orders',
          'recharge_order_events',
          'payment_events',
        ].map((tableName) => tableRegistration(database, tableName)),
      ),
    ).resolves.toEqual([
      'control_plane.credit_conversion_rule_versions',
      'control_plane.recharge_orders',
      'control_plane.recharge_order_events',
      'control_plane.payment_events',
    ]);
    await expect(
      database('control_plane.credit_conversion_rule_versions').count('* as count').first(),
    ).resolves.toMatchObject({ count: '0' });

    await prepareOrder(database);
    await insertOrderEvent(database);
    await insertPaymentEvent(database);
  });

  it('does not seed a TEST or LIVE rule or implicitly activate LIVE payment', async () => {
    await addRechargePaymentFoundation(database);

    await expect(
      database('control_plane.credit_conversion_rule_versions')
        .whereIn('payment_mode', ['TEST', 'LIVE'])
        .count('* as count')
        .first(),
    ).resolves.toMatchObject({ count: '0' });
  });

  it('requires positive integer minor amounts, ISO-style currency and valid credit values', async () => {
    await addRechargePaymentFoundation(database);

    await expect(insertRule(database, { amount_minor: 0 })).rejects.toThrow(/amount|check/i);
    await expect(insertRule(database, { amount_minor: 1.5 })).rejects.toThrow(
      /integer|syntax|amount/i,
    );
    await expect(insertRule(database, { currency: 'cny' })).rejects.toThrow(/currency|check/i);
    await expect(insertRule(database, { purchased_credits: 0 })).rejects.toThrow(/credit|check/i);
    await expect(
      insertRule(database, { bonus_credits: 5, bonus_expires_in_days: null }),
    ).rejects.toThrow(/bonus|expire|check/i);
  });

  it('rejects cross-Tenant Wallet and Buyer Membership/User/Organization combinations', async () => {
    await addRechargePaymentFoundation(database);
    await insertRule(database);

    await expect(insertOrder(database, { wallet_id: otherWalletId })).rejects.toThrow(
      /wallet|tenant|foreign key/i,
    );
    await expect(
      insertOrder(database, {
        buyer_user_id: otherBuyerUserId,
        buyer_membership_id: otherBuyerMembershipId,
      }),
    ).rejects.toThrow(/buyer|membership|tenant|organization/i);
    await expect(
      insertOrder(database, {
        buyer_user_id: otherBuyerUserId,
        buyer_membership_id: buyerMembershipId,
      }),
    ).rejects.toThrow(/buyer|membership|user|tenant|organization/i);
  });

  it('freezes order amount, currency and credit conversion exactly from its Rule', async () => {
    await addRechargePaymentFoundation(database);
    await insertRule(database);

    await expect(insertOrder(database, { amount_minor: 101 })).rejects.toThrow(/rule|amount/i);
    await expect(insertOrder(database, { currency: 'USD' })).rejects.toThrow(/rule|currency/i);
    await expect(insertOrder(database, { purchased_credits: 999 })).rejects.toThrow(/rule|credit/i);
    await expect(insertOrder(database, { bonus_credits: 1 })).rejects.toThrow(/rule|bonus|credit/i);
  });

  it('enforces Provider identity uniqueness and Payment Event order facts', async () => {
    await addRechargePaymentFoundation(database);
    await prepareOrder(database);
    await insertPaymentEvent(database);

    await expect(
      insertPaymentEvent(database, {
        payment_event_id: alternatePaymentEventId,
        event_digest: digest('d'),
      }),
    ).rejects.toThrow(/provider|event|unique|duplicate/i);
    await expect(
      insertPaymentEvent(database, {
        payment_event_id: alternatePaymentEventId,
        provider_event_id: 'test-event-002',
        amount_minor: 101,
      }),
    ).rejects.toThrow(/payment|order|amount/i);
    await expect(
      insertPaymentEvent(database, {
        payment_event_id: alternatePaymentEventId,
        provider_event_id: 'test-event-003',
        currency: 'USD',
      }),
    ).rejects.toThrow(/payment|order|currency/i);
  });

  it('keeps evidence append-only and permits only monotonic order/payment transitions', async () => {
    await addRechargePaymentFoundation(database);
    await insertRule(database);
    await expect(insertOrder(database, { status: 'paid' })).rejects.toThrow(
      /order|created|status/i,
    );
    await insertOrder(database);
    await insertOrderEvent(database);
    await expect(insertPaymentEvent(database, { processing_status: 'applied' })).rejects.toThrow(
      /payment|received|inbox|status/i,
    );
    await insertPaymentEvent(database);

    await expect(
      database('control_plane.recharge_order_events')
        .where({ recharge_order_event_id: orderEventId })
        .update({ reason_code: 'rewritten' }),
    ).rejects.toThrow(/order event|append-only|immutable/i);
    await expect(
      database('control_plane.payment_events')
        .where({ payment_event_id: paymentEventId })
        .update({ amount_minor: 99 }),
    ).rejects.toThrow(/payment|immutable|original|fact/i);

    await expect(
      database('control_plane.recharge_orders')
        .where({ recharge_order_id: orderId })
        .update({ status: 'paid' }),
    ).rejects.toThrow(/order|transition|status/i);
    await database('control_plane.recharge_orders')
      .where({ recharge_order_id: orderId })
      .update({ status: 'pending' });
    await expect(
      database('control_plane.recharge_orders')
        .where({ recharge_order_id: orderId })
        .update({ status: 'created' }),
    ).rejects.toThrow(/order|transition|status/i);

    await database('control_plane.payment_events')
      .where({ payment_event_id: paymentEventId })
      .update({ processing_status: 'applied' });
    await expect(
      database('control_plane.payment_events')
        .where({ payment_event_id: paymentEventId })
        .update({ processing_status: 'received' }),
    ).rejects.toThrow(/payment|transition|status|terminal/i);
  });

  it('keeps TEST and LIVE Rule, Order and Payment Event modes separated', async () => {
    await addRechargePaymentFoundation(database);
    await insertRule(database);
    await insertRule(database, {
      rule_version_id: liveRuleId,
      rule_code: 'LIVE_STANDARD',
      payment_mode: 'LIVE',
      rule_digest: digest('d'),
    });

    await expect(insertOrder(database, { conversion_rule_version_id: liveRuleId })).rejects.toThrow(
      /mode|rule|order/i,
    );

    await insertOrder(database);
    await expect(insertPaymentEvent(database, { payment_mode: 'LIVE' })).rejects.toThrow(
      /mode|payment|order/i,
    );
  });

  it('allows empty rollback and blocks rollback once financial or audit facts exist', async () => {
    await addRechargePaymentFoundation(database);
    await removeRechargePaymentFoundation(database);
    await expect(tableRegistration(database, 'recharge_orders')).resolves.toBeNull();

    await addRechargePaymentFoundation(database);
    await insertRule(database);
    await expect(removeRechargePaymentFoundation(database)).rejects.toThrow(
      /recharge|payment|rule|audit|rollback/i,
    );
  });
});
