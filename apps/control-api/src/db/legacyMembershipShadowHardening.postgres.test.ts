import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from './migrations/001_pilot_core.js';
import { up as addOrganizationFoundation } from './migrations/006_organization_foundation.js';
import { up as addOrganizationMembership } from './migrations/008_organization_membership.js';
import { up as addSessionActiveContext } from './migrations/010_session_active_context.js';
import {
  down as restoreLegacyMembershipShadow,
  up as hardenLegacyMembershipShadow,
} from './migrations/019_harden_legacy_membership_shadow.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const tenantId = '10000000-0000-4000-8000-000000000001';
const userId = '10000000-0000-4000-8000-000000000002';
const membershipId = '10000000-0000-4000-8000-000000000003';

async function resetLegacyMembership(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);
  await database('control_plane.tenants').insert({
    tenant_id: tenantId,
    display_name: 'Legacy Tenant',
    status: 'active',
  });
  await database('control_plane.users').insert({
    user_id: userId,
    email: 'legacy-admin@example.com',
    display_name: 'Legacy Admin',
    password_hash: 'unused',
    status: 'active',
  });
  await database('control_plane.memberships').insert({
    membership_id: membershipId,
    tenant_id: tenantId,
    user_id: userId,
    role_code: 'tenant_admin',
    status: 'active',
  });
  await addOrganizationFoundation(database);
  await addOrganizationMembership(database);
  await addSessionActiveContext(database);
  await database('control_plane.organization_membership_roles').insert({
    membership_id: membershipId,
    role_code: 'content_operator',
  });
}

async function membershipVersion(database: Knex): Promise<number> {
  const membership = await database('control_plane.organization_memberships')
    .select('version')
    .where({ membership_id: membershipId })
    .first<{ version: number }>();
  return membership!.version;
}

async function membershipRoles(database: Knex): Promise<string[]> {
  const roles = await database('control_plane.organization_membership_roles')
    .select('role_code')
    .where({ membership_id: membershipId })
    .orderBy('role_code');
  return roles.map(({ role_code: roleCode }) => roleCode);
}

describe.runIf(hasDedicatedTestDatabase)('legacy Membership shadow hardening', () => {
  let database: Knex;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await resetLegacyMembership(database);
  });

  afterAll(async () => {
    await database?.raw('drop schema if exists control_plane cascade');
    await database?.destroy();
  });

  it('preserves secondary roles and bumps canonical version exactly once for status-only updates', async () => {
    await hardenLegacyMembershipShadow(database);
    const beforeVersion = await membershipVersion(database);

    await database('control_plane.memberships')
      .where({ membership_id: membershipId })
      .update({ status: 'suspended' });

    expect(await membershipRoles(database)).toEqual(['content_operator', 'tenant_admin']);
    expect(
      await database('control_plane.organization_memberships')
        .select('status', 'version')
        .where({ membership_id: membershipId })
        .first(),
    ).toEqual({ status: 'suspended', version: beforeVersion + 1 });
  });

  it('retains legacy single-role compatibility when the primary role changes', async () => {
    await hardenLegacyMembershipShadow(database);

    await database('control_plane.memberships')
      .where({ membership_id: membershipId })
      .update({ role_code: 'content_operator' });

    expect(await membershipRoles(database)).toEqual(['content_operator']);
    expect(
      await database('control_plane.organization_memberships')
        .select('primary_role_code')
        .where({ membership_id: membershipId })
        .first(),
    ).toEqual({ primary_role_code: 'content_operator' });
  });

  it('restores the previous trigger behavior on rollback', async () => {
    await hardenLegacyMembershipShadow(database);
    await restoreLegacyMembershipShadow(database);
    const beforeVersion = await membershipVersion(database);

    await database('control_plane.memberships')
      .where({ membership_id: membershipId })
      .update({ status: 'suspended' });

    expect(await membershipRoles(database)).toEqual(['tenant_admin']);
    expect(await membershipVersion(database)).toBe(beforeVersion + 2);
  });
});
