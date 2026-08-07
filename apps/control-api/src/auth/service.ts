import type { AuthRepository, LoginIdentity, NewSession, StoredSession } from './types.js';
import { verifyPassword } from './password.js';
import { createSessionToken, digestSessionToken, newSessionId } from './session.js';

export type PublicSession = {
  user: { id: string; email: string; displayName: string };
  tenant: { id: string; displayName: string } | null;
  roles: StoredSession['roles'];
  activeContext: {
    membershipId: string;
    organizationId: string;
    organizationType: StoredSession['organizationType'];
    organizationDisplayName: string;
    membershipVersion: number;
    primaryRole: StoredSession['primaryRole'];
    roles: StoredSession['roles'];
    tenantId: string | null;
  };
  expiresAt: string;
};

export class InvalidCredentialsError extends Error {}

type IssuedSession = {
  token: string;
  session: StoredSession;
};

function publicSession(session: StoredSession): PublicSession {
  return {
    user: { id: session.userId, email: session.email, displayName: session.displayName },
    tenant:
      session.tenantId && session.tenantDisplayName
        ? { id: session.tenantId, displayName: session.tenantDisplayName }
        : null,
    roles: session.roles,
    activeContext: {
      membershipId: session.membershipId,
      organizationId: session.organizationId,
      organizationType: session.organizationType,
      organizationDisplayName: session.organizationDisplayName,
      membershipVersion: session.membershipVersion,
      primaryRole: session.primaryRole,
      roles: session.roles,
      tenantId: session.tenantId,
    },
    expiresAt: session.expiresAt.toISOString(),
  };
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly sessionSecret: string,
    private readonly sessionTtlSeconds: number,
    private readonly sessionRotationSeconds: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async login(email: string, password: string): Promise<{ token: string; session: PublicSession }> {
    const normalizedEmail = email.trim().toLowerCase();
    const identity = await this.repository.findLoginIdentity(normalizedEmail);
    const passwordMatches = await verifyPassword(password, identity?.passwordHash);
    if (!identity || !passwordMatches) throw new InvalidCredentialsError();

    const issued = this.issue(identity);
    await this.repository.replaceLoginSessions(this.newStoredSession(issued, identity));
    return { token: issued.token, session: publicSession(issued.session) };
  }

  async resolve(token: string): Promise<{ token?: string; session: PublicSession } | null> {
    const current = await this.repository.findSession(
      digestSessionToken(token, this.sessionSecret),
    );
    if (!current) return null;

    const now = this.now();
    if (current.rotationDueAt.getTime() <= now.getTime()) {
      const issued = this.issue(current);
      const rotated = await this.repository.rotateSession(
        current.sessionId,
        this.newStoredSession(issued, current, current.sessionId),
      );
      if (!rotated) return null;
      return { token: issued.token, session: publicSession(issued.session) };
    }

    await this.repository.touchSession(current.sessionId, now);
    return { session: publicSession(current) };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    const session = await this.repository.findSession(
      digestSessionToken(token, this.sessionSecret),
    );
    if (session) await this.repository.revokeSession(session.sessionId, this.now());
  }

  private issue(identity: Omit<LoginIdentity, 'passwordHash'>): IssuedSession {
    const token = createSessionToken();
    const now = this.now();
    const expiresAt = new Date(now.getTime() + this.sessionTtlSeconds * 1000);
    const rotationDueAt = new Date(
      Math.min(expiresAt.getTime(), now.getTime() + this.sessionRotationSeconds * 1000),
    );
    return {
      token,
      session: {
        sessionId: newSessionId(),
        userId: identity.userId,
        email: identity.email,
        displayName: identity.displayName,
        membershipId: identity.membershipId,
        organizationId: identity.organizationId,
        organizationType: identity.organizationType,
        organizationDisplayName: identity.organizationDisplayName,
        membershipVersion: identity.membershipVersion,
        primaryRole: identity.primaryRole,
        roles: identity.roles,
        tenantId: identity.tenantId,
        tenantDisplayName: identity.tenantDisplayName,
        createdAt: now,
        expiresAt,
        rotationDueAt,
      },
    };
  }

  private newStoredSession(
    issued: IssuedSession,
    identity: Omit<LoginIdentity, 'passwordHash'>,
    rotatedFromSessionId?: string,
  ): NewSession {
    return {
      sessionId: issued.session.sessionId,
      userId: identity.userId,
      tenantId: identity.tenantId,
      activeMembershipId: identity.membershipId,
      activeOrganizationId: identity.organizationId,
      membershipVersion: identity.membershipVersion,
      tokenDigest: digestSessionToken(issued.token, this.sessionSecret),
      expiresAt: issued.session.expiresAt,
      rotationDueAt: issued.session.rotationDueAt,
      ...(rotatedFromSessionId ? { rotatedFromSessionId } : {}),
    };
  }
}
