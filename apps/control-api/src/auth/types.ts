export type RoleCode = 'tenant_admin' | 'content_operator' | 'pilot_support';

export type LoginIdentity = {
  userId: string;
  tenantId: string;
  email: string;
  displayName: string;
  tenantDisplayName: string;
  passwordHash: string;
  roles: RoleCode[];
};

export type StoredSession = Omit<LoginIdentity, 'passwordHash'> & {
  sessionId: string;
  expiresAt: Date;
  rotationDueAt: Date;
  createdAt: Date;
};

export type NewSession = {
  sessionId: string;
  userId: string;
  tenantId: string;
  tokenDigest: string;
  expiresAt: Date;
  rotationDueAt: Date;
  rotatedFromSessionId?: string;
};

export interface AuthRepository {
  findLoginIdentity(email: string): Promise<LoginIdentity | null>;
  replaceLoginSessions(session: NewSession): Promise<void>;
  findSession(tokenDigest: string): Promise<StoredSession | null>;
  rotateSession(previousSessionId: string, session: NewSession): Promise<boolean>;
  revokeSession(sessionId: string, revokedAt: Date): Promise<void>;
  touchSession(sessionId: string, seenAt: Date): Promise<void>;
}
