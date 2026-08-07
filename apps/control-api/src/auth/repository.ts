import type { Knex } from 'knex';
import type {
  AuthRepository,
  LoginIdentity,
  MembershipContext,
  NewSession,
  OrganizationType,
  RoleCode,
  StoredSession,
} from './types.js';

type IdentityRow = {
  user_id: string;
  email: string;
  display_name: string;
  password_hash: string;
  membership_id: string;
  organization_id: string;
  organization_type: OrganizationType;
  organization_display_name: string;
  membership_version: number;
  primary_role_code: RoleCode;
  role_code: RoleCode;
  tenant_id: string | null;
  tenant_display_name: string | null;
};

type ContextRow = Omit<IdentityRow, 'password_hash'>;

type SessionRow = ContextRow & {
  session_id: string;
  expires_at: Date;
  rotation_due_at: Date;
  created_at: Date;
};

class SessionRotationConflict extends Error {}

function roleMatchesOrganization(role: RoleCode, organizationType: OrganizationType): boolean {
  if (organizationType === 'PLATFORM') {
    return role === 'platform_admin' || role === 'pilot_support';
  }
  if (organizationType === 'CHANNEL') return role === 'channel_admin';
  return role === 'tenant_admin' || role === 'content_operator';
}

function groupContext(rows: ContextRow[]): MembershipContext | null {
  const first = rows[0];
  if (!first) return null;
  if (
    rows.some(
      (row) =>
        row.membership_id !== first.membership_id ||
        row.organization_id !== first.organization_id ||
        row.organization_type !== first.organization_type ||
        row.organization_display_name !== first.organization_display_name ||
        row.membership_version !== first.membership_version ||
        row.primary_role_code !== first.primary_role_code ||
        row.tenant_id !== first.tenant_id ||
        row.tenant_display_name !== first.tenant_display_name,
    )
  ) {
    return null;
  }

  const roles = [...new Set(rows.map((row) => row.role_code))];
  if (
    roles.length === 0 ||
    !roles.includes(first.primary_role_code) ||
    roles.some((role) => !roleMatchesOrganization(role, first.organization_type)) ||
    (first.organization_type === 'TENANT' && (!first.tenant_id || !first.tenant_display_name)) ||
    (first.organization_type !== 'TENANT' &&
      (first.tenant_id !== null || first.tenant_display_name !== null))
  ) {
    return null;
  }

  return {
    membershipId: first.membership_id,
    organizationId: first.organization_id,
    organizationType: first.organization_type,
    organizationDisplayName: first.organization_display_name,
    membershipVersion: first.membership_version,
    primaryRole: first.primary_role_code,
    roles,
    tenantId: first.tenant_id,
    tenantDisplayName: first.tenant_display_name,
  };
}

function groupIdentity(rows: IdentityRow[]): LoginIdentity | null {
  const first = rows[0];
  const context = groupContext(rows);
  if (!first || !context) return null;
  if (
    rows.some(
      (row) =>
        row.user_id !== first.user_id ||
        row.email !== first.email ||
        row.display_name !== first.display_name ||
        row.password_hash !== first.password_hash,
    )
  ) {
    return null;
  }
  return {
    ...context,
    userId: first.user_id,
    email: first.email,
    displayName: first.display_name,
    passwordHash: first.password_hash,
  };
}

function groupSession(rows: SessionRow[]): StoredSession | null {
  const first = rows[0];
  const context = groupContext(rows);
  if (!first || !context) return null;
  if (
    rows.some(
      (row) =>
        row.session_id !== first.session_id ||
        row.user_id !== first.user_id ||
        row.email !== first.email ||
        row.display_name !== first.display_name ||
        new Date(row.expires_at).getTime() !== new Date(first.expires_at).getTime() ||
        new Date(row.rotation_due_at).getTime() !== new Date(first.rotation_due_at).getTime() ||
        new Date(row.created_at).getTime() !== new Date(first.created_at).getTime(),
    )
  ) {
    return null;
  }
  return {
    ...context,
    sessionId: first.session_id,
    userId: first.user_id,
    email: first.email,
    displayName: first.display_name,
    expiresAt: new Date(first.expires_at),
    rotationDueAt: new Date(first.rotation_due_at),
    createdAt: new Date(first.created_at),
  };
}

function insertSession(transaction: Knex.Transaction, session: NewSession) {
  return transaction('control_plane.auth_sessions').insert({
    session_id: session.sessionId,
    user_id: session.userId,
    tenant_id: session.tenantId,
    active_membership_id: session.activeMembershipId,
    active_organization_id: session.activeOrganizationId,
    membership_version: session.membershipVersion,
    token_digest: session.tokenDigest,
    expires_at: session.expiresAt,
    rotation_due_at: session.rotationDueAt,
    rotated_from_session_id: session.rotatedFromSessionId ?? null,
  });
}

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly database: Knex) {}

  async findLoginIdentity(email: string): Promise<LoginIdentity | null> {
    const rows = await this.database<IdentityRow>('control_plane.users as users')
      .join(
        'control_plane.organization_memberships as memberships',
        'memberships.user_id',
        'users.user_id',
      )
      .join(
        'control_plane.organizations as organizations',
        'organizations.organization_id',
        'memberships.organization_id',
      )
      .join(
        'control_plane.organization_membership_roles as membership_roles',
        'membership_roles.membership_id',
        'memberships.membership_id',
      )
      .leftJoin('control_plane.tenants as tenants', function joinTenant() {
        this.on('tenants.organization_id', '=', 'organizations.organization_id');
      })
      .select(
        'users.user_id',
        'users.email',
        'users.display_name',
        'users.password_hash',
        'memberships.membership_id',
        'memberships.organization_id',
        'memberships.version as membership_version',
        'memberships.primary_role_code',
        'organizations.organization_type',
        'organizations.display_name as organization_display_name',
        'membership_roles.role_code',
        'tenants.tenant_id',
        'tenants.display_name as tenant_display_name',
      )
      .whereRaw('lower(users.email) = lower(?)', [email])
      .where('users.status', 'active')
      .where('memberships.status', 'active')
      .where('organizations.status', 'active')
      .whereRaw(
        `
        (
          organizations.organization_type = 'TENANT'
          and tenants.tenant_id is not null
          and tenants.status = 'active'
        ) or (
          organizations.organization_type <> 'TENANT'
          and tenants.tenant_id is null
        )
      `,
      )
      .orderBy('memberships.membership_id')
      .orderBy('membership_roles.role_code');

    return groupIdentity(rows);
  }

  async replaceLoginSessions(session: NewSession): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction('control_plane.auth_sessions')
        .where({
          user_id: session.userId,
          active_membership_id: session.activeMembershipId,
        })
        .whereNull('revoked_at')
        .update({ revoked_at: transaction.fn.now() });
      await insertSession(transaction, session);
    });
  }

  async findSession(tokenDigest: string): Promise<StoredSession | null> {
    const rows = await this.database<SessionRow>('control_plane.auth_sessions as sessions')
      .join('control_plane.users as users', 'users.user_id', 'sessions.user_id')
      .join('control_plane.organization_memberships as memberships', function joinMemberships() {
        this.on('memberships.membership_id', '=', 'sessions.active_membership_id')
          .andOn('memberships.user_id', '=', 'sessions.user_id')
          .andOn('memberships.organization_id', '=', 'sessions.active_organization_id');
      })
      .join(
        'control_plane.organizations as organizations',
        'organizations.organization_id',
        'memberships.organization_id',
      )
      .join(
        'control_plane.organization_membership_roles as membership_roles',
        'membership_roles.membership_id',
        'memberships.membership_id',
      )
      .leftJoin('control_plane.tenants as tenants', function joinTenant() {
        this.on('tenants.tenant_id', '=', 'sessions.tenant_id').andOn(
          'tenants.organization_id',
          '=',
          'organizations.organization_id',
        );
      })
      .select(
        'sessions.session_id',
        'sessions.expires_at',
        'sessions.rotation_due_at',
        'sessions.created_at',
        'users.user_id',
        'users.email',
        'users.display_name',
        'memberships.membership_id',
        'memberships.organization_id',
        'memberships.version as membership_version',
        'memberships.primary_role_code',
        'organizations.organization_type',
        'organizations.display_name as organization_display_name',
        'membership_roles.role_code',
        'sessions.tenant_id',
        'tenants.display_name as tenant_display_name',
      )
      .where('sessions.token_digest', tokenDigest)
      .whereNull('sessions.revoked_at')
      .whereNotNull('sessions.active_membership_id')
      .whereNotNull('sessions.active_organization_id')
      .whereNotNull('sessions.membership_version')
      .where('sessions.expires_at', '>', this.database.fn.now())
      .where('users.status', 'active')
      .where('memberships.status', 'active')
      .where('organizations.status', 'active')
      .whereRaw('sessions.membership_version = memberships.version')
      .whereRaw(
        `
        (
          organizations.organization_type = 'TENANT'
          and sessions.tenant_id is not null
          and tenants.tenant_id is not null
          and tenants.status = 'active'
        ) or (
          organizations.organization_type <> 'TENANT'
          and sessions.tenant_id is null
        )
      `,
      )
      .orderBy('membership_roles.role_code');

    return groupSession(rows);
  }

  async rotateSession(previousSessionId: string, session: NewSession): Promise<boolean> {
    try {
      await this.database.transaction(async (transaction) => {
        await insertSession(transaction, session);
        const updated = await transaction('control_plane.auth_sessions')
          .where({ session_id: previousSessionId })
          .whereNull('revoked_at')
          .where('expires_at', '>', transaction.fn.now())
          .update({ revoked_at: transaction.fn.now(), replaced_by_session_id: session.sessionId });
        if (updated !== 1) throw new SessionRotationConflict();
      });
      return true;
    } catch (error) {
      if (error instanceof SessionRotationConflict) return false;
      throw error;
    }
  }

  async revokeSession(sessionId: string, revokedAt: Date): Promise<void> {
    await this.database('control_plane.auth_sessions')
      .where({ session_id: sessionId })
      .whereNull('revoked_at')
      .update({ revoked_at: revokedAt });
  }

  async touchSession(sessionId: string, seenAt: Date): Promise<void> {
    await this.database('control_plane.auth_sessions')
      .where({ session_id: sessionId })
      .update({ last_seen_at: seenAt });
  }
}
