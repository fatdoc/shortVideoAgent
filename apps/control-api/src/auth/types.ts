export type RoleCode =
  'platform_admin' | 'channel_admin' | 'tenant_admin' | 'content_operator' | 'pilot_support';

export type OrganizationType = 'PLATFORM' | 'CHANNEL' | 'TENANT';

export type MembershipContext = {
  membershipId: string;
  organizationId: string;
  organizationType: OrganizationType;
  organizationDisplayName: string;
  membershipVersion: number;
  primaryRole: RoleCode;
  roles: RoleCode[];
  tenantId: string | null;
  tenantDisplayName: string | null;
};

export type LoginIdentity = MembershipContext & {
  userId: string;
  email: string;
  displayName: string;
  passwordHash: string;
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
  tenantId: string | null;
  activeMembershipId: string;
  activeOrganizationId: string;
  membershipVersion: number;
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
