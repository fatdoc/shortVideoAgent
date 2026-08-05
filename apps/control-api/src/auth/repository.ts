import type { Knex } from 'knex';
import type { AuthRepository, LoginIdentity, NewSession, RoleCode, StoredSession } from './types.js';

type IdentityRow = {
  user_id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  tenant_display_name: string;
  password_hash: string;
  role_code: RoleCode;
};

type SessionRow = Omit<IdentityRow, 'password_hash'> & {
  session_id: string;
  expires_at: Date;
  rotation_due_at: Date;
  created_at: Date;
};

class SessionRotationConflict extends Error {}

function groupIdentity(rows: IdentityRow[]): LoginIdentity | null {
  const first = rows[0];
  if (!first) return null;
  if (rows.some((row) => row.tenant_id !== first.tenant_id)) return null;

  return {
    userId: first.user_id,
    tenantId: first.tenant_id,
    email: first.email,
    displayName: first.display_name,
    tenantDisplayName: first.tenant_display_name,
    passwordHash: first.password_hash,
    roles: [...new Set(rows.map((row) => row.role_code))],
  };
}

function insertSession(transaction: Knex.Transaction, session: NewSession) {
  return transaction('control_plane.auth_sessions').insert({
    session_id: session.sessionId,
    user_id: session.userId,
    tenant_id: session.tenantId,
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
      .join('control_plane.memberships as memberships', 'memberships.user_id', 'users.user_id')
      .join('control_plane.tenants as tenants', 'tenants.tenant_id', 'memberships.tenant_id')
      .select(
        'users.user_id',
        'users.email',
        'users.display_name',
        'users.password_hash',
        'tenants.tenant_id',
        'tenants.display_name as tenant_display_name',
        'memberships.role_code',
      )
      .whereRaw('lower(users.email) = lower(?)', [email])
      .where('users.status', 'active')
      .where('tenants.status', 'active')
      .where('memberships.status', 'active')
      .orderBy('memberships.role_code');

    return groupIdentity(rows);
  }

  async replaceLoginSessions(session: NewSession): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction('control_plane.auth_sessions')
        .where({ user_id: session.userId, tenant_id: session.tenantId })
        .whereNull('revoked_at')
        .update({ revoked_at: transaction.fn.now() });
      await insertSession(transaction, session);
    });
  }

  async findSession(tokenDigest: string): Promise<StoredSession | null> {
    const rows = await this.database<SessionRow>('control_plane.auth_sessions as sessions')
      .join('control_plane.users as users', 'users.user_id', 'sessions.user_id')
      .join('control_plane.tenants as tenants', 'tenants.tenant_id', 'sessions.tenant_id')
      .join('control_plane.memberships as memberships', function joinMemberships() {
        this.on('memberships.user_id', '=', 'sessions.user_id').andOn(
          'memberships.tenant_id',
          '=',
          'sessions.tenant_id',
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
        'tenants.tenant_id',
        'tenants.display_name as tenant_display_name',
        'memberships.role_code',
      )
      .where('sessions.token_digest', tokenDigest)
      .whereNull('sessions.revoked_at')
      .where('sessions.expires_at', '>', this.database.fn.now())
      .where('users.status', 'active')
      .where('tenants.status', 'active')
      .where('memberships.status', 'active')
      .orderBy('memberships.role_code');

    const first = rows[0];
    if (!first) return null;
    return {
      sessionId: first.session_id,
      userId: first.user_id,
      tenantId: first.tenant_id,
      email: first.email,
      displayName: first.display_name,
      tenantDisplayName: first.tenant_display_name,
      expiresAt: new Date(first.expires_at),
      rotationDueAt: new Date(first.rotation_due_at),
      createdAt: new Date(first.created_at),
      roles: [...new Set(rows.map((row) => row.role_code))],
    };
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
