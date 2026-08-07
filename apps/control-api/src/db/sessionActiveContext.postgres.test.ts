import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from './migrations/001_pilot_core.js';
import { up as addSessionRotation } from './migrations/002_auth_session_rotation.js';
import { up as addOrganizationFoundation } from './migrations/006_organization_foundation.js';
import { up as addOrganizationMembership } from './migrations/008_organization_membership.js';
import {
  down as removeSessionActiveContext,
  up as addSessionActiveContext,
} from './migrations/010_session_active_context.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const tenantId = '10000000-0000-4000-8000-000000000001';
const tenantUserId = '10000000-0000-4000-8000-000000000002';
const tenantMembershipId = '10000000-0000-4000-8000-000000000003';
const tenantSessionId = '10000000-0000-4000-8000-000000000004';
const orphanUserId = '20000000-0000-4000-8000-000000000002';
const orphanSessionId = '20000000-0000-4000-8000-000000000004';
const platformOrganizationId = '30000000-0000-4000-8000-000000000001';
const platformUserId = '30000000-0000-4000-8000-000000000002';
const platformMembershipId = '30000000-0000-4000-8000-000000000003';
const platformSessionId = '30000000-0000-4000-8000-000000000004';

async function resetFoundation(database: Knex, includeLegacyMembership = true): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);
  await addSessionRotation(database);

  await database('control_plane.tenants').insert({
    tenant_id: tenantId,
    display_name: 'Tenant A',
    status: 'active',
  });
  await database('control_plane.users').insert([
    {
      user_id: tenantUserId,
      email: 'tenant-admin@example.com',
      display_name: 'Tenant Admin',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: orphanUserId,
      email: 'orphan@example.com',
      display_name: 'Orphan User',
      password_hash: 'unused',
      status: 'active',
    },
  ]);
  if (includeLegacyMembership) {
    await database('control_plane.memberships').insert({
      membership_id: tenantMembershipId,
      tenant_id: tenantId,
      user_id: tenantUserId,
      role_code: 'tenant_admin',
      status: 'active',
    });
  }

  await addOrganizationFoundation(database);
  await addOrganizationMembership(database);
}

async function insertLegacySession(
  database: Knex,
  input: { sessionId: string; userId: string; digest: string },
): Promise<void> {
  await database('control_plane.auth_sessions').insert({
    session_id: input.sessionId,
    user_id: input.userId,
    tenant_id: tenantId,
    token_digest: input.digest,
    expires_at: '2026-08-08T00:00:00.000Z',
    rotation_due_at: '2026-08-07T23:00:00.000Z',
  });
}

async function insertPlatformContext(database: Knex): Promise<number> {
  await database('control_plane.organizations').insert({
    organization_id: platformOrganizationId,
    organization_type: 'PLATFORM',
    display_name: 'Platform',
    status: 'active',
  });
  await database('control_plane.users').insert({
    user_id: platformUserId,
    email: 'platform@example.com',
    display_name: 'Platform Admin',
    password_hash: 'unused',
    status: 'active',
  });
  await database.transaction(async (transaction) => {
    await transaction('control_plane.organization_memberships').insert({
      membership_id: platformMembershipId,
      user_id: platformUserId,
      organization_id: platformOrganizationId,
      status: 'active',
      primary_role_code: 'platform_admin',
    });
    await transaction('control_plane.organization_membership_roles').insert({
      membership_id: platformMembershipId,
      role_code: 'platform_admin',
    });
  });
  const membership = await database('control_plane.organization_memberships')
    .select('version')
    .where({ membership_id: platformMembershipId })
    .first<{ version: number }>();
  return membership?.version ?? 0;
}

async function columnRegistration(database: Knex, columnName: string): Promise<string | null> {
  const row = await database('information_schema.columns')
    .select('column_name')
    .where({
      table_schema: 'control_plane',
      table_name: 'auth_sessions',
      column_name: columnName,
    })
    .first<{ column_name: string }>();
  return row?.column_name ?? null;
}

describe.runIf(hasDedicatedTestDatabase)(
  'A-BIZ-01.2 session active membership context migration',
  () => {
    let database: Knex;

    beforeEach(async () => {
      database ??= knex({ client: 'pg', connection: databaseUrl });
      await resetFoundation(database);
    });

    afterAll(async () => {
      await database?.raw('drop schema if exists control_plane cascade');
      await database?.destroy();
    });

    it('backfills a unique active TENANT membership and revokes an unresolved legacy session', async () => {
      await insertLegacySession(database, {
        sessionId: tenantSessionId,
        userId: tenantUserId,
        digest: 'tenant-session-digest',
      });
      await insertLegacySession(database, {
        sessionId: orphanSessionId,
        userId: orphanUserId,
        digest: 'orphan-session-digest',
      });

      await addSessionActiveContext(database);

      expect(
        await database('control_plane.auth_sessions')
          .select(
            'tenant_id',
            'active_membership_id',
            'active_organization_id',
            'membership_version',
            'revoked_at',
          )
          .where({ session_id: tenantSessionId })
          .first(),
      ).toEqual({
        tenant_id: tenantId,
        active_membership_id: tenantMembershipId,
        active_organization_id: tenantId,
        membership_version: 1,
        revoked_at: null,
      });

      const orphan = await database('control_plane.auth_sessions')
        .select(
          'active_membership_id',
          'active_organization_id',
          'membership_version',
          'revoked_at',
        )
        .where({ session_id: orphanSessionId })
        .first();
      expect(orphan).toMatchObject({
        active_membership_id: null,
        active_organization_id: null,
        membership_version: null,
      });
      expect(orphan?.revoked_at).toBeInstanceOf(Date);
    });

    it('accepts a complete PLATFORM context without a Tenant and rejects partial or mismatched context', async () => {
      await addSessionActiveContext(database);
      const platformVersion = await insertPlatformContext(database);

      await expect(
        database('control_plane.auth_sessions').insert({
          session_id: platformSessionId,
          user_id: platformUserId,
          tenant_id: null,
          active_membership_id: platformMembershipId,
          active_organization_id: platformOrganizationId,
          membership_version: platformVersion,
          token_digest: 'platform-session-digest',
          expires_at: '2026-08-08T00:00:00.000Z',
          rotation_due_at: '2026-08-07T23:00:00.000Z',
        }),
      ).resolves.toBeTruthy();

      await expect(
        database('control_plane.auth_sessions').insert({
          session_id: '40000000-0000-4000-8000-000000000001',
          user_id: platformUserId,
          tenant_id: null,
          active_membership_id: platformMembershipId,
          active_organization_id: null,
          membership_version: platformVersion,
          token_digest: 'partial-context-digest',
          expires_at: '2026-08-08T00:00:00.000Z',
          rotation_due_at: '2026-08-07T23:00:00.000Z',
        }),
      ).rejects.toThrow();

      await expect(
        database('control_plane.auth_sessions').insert({
          session_id: '40000000-0000-4000-8000-000000000002',
          user_id: tenantUserId,
          tenant_id: null,
          active_membership_id: platformMembershipId,
          active_organization_id: platformOrganizationId,
          membership_version: platformVersion,
          token_digest: 'mismatched-user-digest',
          expires_at: '2026-08-08T00:00:00.000Z',
          rotation_due_at: '2026-08-07T23:00:00.000Z',
        }),
      ).rejects.toThrow();
    });

    it('rejects TENANT context whose legacy Tenant does not match the active Organization', async () => {
      await addSessionActiveContext(database);
      await database('control_plane.tenants')
        .insert({
          tenant_id: '50000000-0000-4000-8000-000000000001',
          organization_id: tenantId,
          display_name: 'Invalid duplicate mapping',
          status: 'active',
        })
        .catch(() => undefined);

      await expect(
        database('control_plane.auth_sessions').insert({
          session_id: '50000000-0000-4000-8000-000000000004',
          user_id: tenantUserId,
          tenant_id: null,
          active_membership_id: tenantMembershipId,
          active_organization_id: tenantId,
          membership_version: 1,
          token_digest: 'missing-tenant-digest',
          expires_at: '2026-08-08T00:00:00.000Z',
          rotation_due_at: '2026-08-07T23:00:00.000Z',
        }),
      ).rejects.toThrow();
    });

    it('increments Membership Version for security changes and preserves identity through legacy Shadow updates', async () => {
      await addSessionActiveContext(database);
      const initial = await database('control_plane.organization_memberships')
        .select('version')
        .where({ membership_id: tenantMembershipId })
        .first<{ version: number }>();

      await database('control_plane.organization_membership_roles').insert({
        membership_id: tenantMembershipId,
        role_code: 'content_operator',
      });
      const afterRoleInsert = await database('control_plane.organization_memberships')
        .select('version')
        .where({ membership_id: tenantMembershipId })
        .first<{ version: number }>();
      expect(afterRoleInsert!.version).toBeGreaterThan(initial!.version);

      await database('control_plane.organization_membership_roles')
        .where({ membership_id: tenantMembershipId, role_code: 'content_operator' })
        .delete();
      const afterRoleDelete = await database('control_plane.organization_memberships')
        .select('version')
        .where({ membership_id: tenantMembershipId })
        .first<{ version: number }>();
      expect(afterRoleDelete!.version).toBeGreaterThan(afterRoleInsert!.version);

      await database('control_plane.memberships')
        .where({ membership_id: tenantMembershipId })
        .update({ role_code: 'content_operator', status: 'suspended' });

      const shadowed = await database('control_plane.organization_memberships')
        .select('membership_id', 'status', 'primary_role_code', 'version')
        .where({ membership_id: tenantMembershipId })
        .first();
      expect(shadowed).toMatchObject({
        membership_id: tenantMembershipId,
        status: 'suspended',
        primary_role_code: 'content_operator',
      });
      expect(shadowed.version).toBeGreaterThan(afterRoleDelete!.version);
      expect(
        await database('control_plane.organization_membership_roles')
          .select('role_code')
          .where({ membership_id: tenantMembershipId }),
      ).toEqual([{ role_code: 'content_operator' }]);
    });

    it('rolls back for TENANT-only sessions and fails closed while a non-TENANT session exists', async () => {
      await insertLegacySession(database, {
        sessionId: tenantSessionId,
        userId: tenantUserId,
        digest: 'tenant-session-digest',
      });
      await addSessionActiveContext(database);
      const platformVersion = await insertPlatformContext(database);
      await database('control_plane.auth_sessions').insert({
        session_id: platformSessionId,
        user_id: platformUserId,
        tenant_id: null,
        active_membership_id: platformMembershipId,
        active_organization_id: platformOrganizationId,
        membership_version: platformVersion,
        token_digest: 'platform-session-digest',
        expires_at: '2026-08-08T00:00:00.000Z',
        rotation_due_at: '2026-08-07T23:00:00.000Z',
      });

      await expect(removeSessionActiveContext(database)).rejects.toThrow(/non-TENANT|rollback/i);
      expect(await columnRegistration(database, 'active_membership_id')).toBe(
        'active_membership_id',
      );

      await database('control_plane.auth_sessions')
        .where({ session_id: platformSessionId })
        .delete();
      await removeSessionActiveContext(database);

      expect(await columnRegistration(database, 'active_membership_id')).toBeNull();
      const tenantColumn = await database('information_schema.columns')
        .select('is_nullable')
        .where({
          table_schema: 'control_plane',
          table_name: 'auth_sessions',
          column_name: 'tenant_id',
        })
        .first<{ is_nullable: string }>();
      expect(tenantColumn?.is_nullable).toBe('NO');
    });
  },
);
