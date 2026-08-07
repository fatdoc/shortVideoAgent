import type { OrganizationType, RoleCode } from '../auth/types.js';

export type InvitationType = 'PLATFORM' | 'CHANNEL' | 'TENANT_MEMBER';
export type InvitationStatus = 'active' | 'revoked' | 'exhausted' | 'expired';

export type InvitationActor = {
  userId: string;
  membershipId: string;
  organizationId: string;
  organizationType: OrganizationType;
  roles: readonly RoleCode[];
};

export type Invitation = {
  invitationId: string;
  issuerMembershipId: string;
  issuerOrganizationId: string;
  invitationType: InvitationType;
  targetOrganizationId: string | null;
  targetRoleCode: 'content_operator' | null;
  targetEmailNormalized: string | null;
  attributionChannelId: string | null;
  status: InvitationStatus;
  validFrom: string;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
  revokedByMembershipId: string | null;
};

export type InvitationUsage = {
  invitationUsageId: string;
  invitationId: string;
  registrationId: string;
  userId: string;
  usedAt: string;
  createdAt: string;
};

export type InvitationUsageResult = {
  invitation: Invitation;
  usage: InvitationUsage;
};

export type ReplayableResult<T> = {
  value: T;
  replayed: boolean;
};

export type CreateInvitationRecord = {
  issuerMembershipId: string;
  issuerOrganizationId: string;
  invitationType: InvitationType;
  targetOrganizationId: string | null;
  targetRoleCode: 'content_operator' | null;
  targetEmailNormalized: string | null;
  attributionChannelId: string | null;
  tokenDigest: string;
  validFrom: Date;
  expiresAt: Date;
  maxUses: number;
  creationIdempotencyKey: string;
  creationRequestDigest: string;
};

export type RevokeInvitationRecord = {
  invitationId: string;
  issuerOrganizationId: string;
  revokedByMembershipId: string;
  revokedAt: Date;
};

export type ConsumeInvitationRecord = {
  tokenDigest: string;
  registrationId: string;
  userId: string;
  emailNormalized: string;
  idempotencyKey: string;
  requestDigest: string;
  usedAt: Date;
};

export type IssuedInvitation = {
  invitation: Invitation;
  token: string | null;
  replayed: boolean;
};

export interface InvitationStore {
  create(input: CreateInvitationRecord): Promise<ReplayableResult<Invitation>>;
  listByIssuerOrganization(issuerOrganizationId: string, asOf: Date): Promise<Invitation[]>;
  findAvailableByTokenDigest(tokenDigest: string, asOf: Date): Promise<Invitation | null>;
  revoke(input: RevokeInvitationRecord): Promise<ReplayableResult<Invitation>>;
  consume(input: ConsumeInvitationRecord): Promise<ReplayableResult<InvitationUsageResult>>;
}
