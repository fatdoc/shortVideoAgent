import type { OrganizationType, RoleCode } from '../auth/types.js';

export type MemberStatus = 'active' | 'suspended' | 'expired';
export type MemberStatusFilter = MemberStatus | 'all';
export type MemberAdministratorRole = 'platform_admin' | 'channel_admin' | 'tenant_admin';

export type MemberProjection = {
  membershipId: string;
  displayName: string;
  email: string;
  status: MemberStatus;
  primaryRole: RoleCode;
  roles: RoleCode[];
  version: number;
  createdAt: string;
  updatedAt: string;
  isCurrentActor: boolean;
};

export type MemberDirectoryActor = {
  userId: string;
  membershipId: string;
  organizationId: string;
  organizationType: OrganizationType;
  roles: readonly RoleCode[];
};

export type ListCurrentOrganizationMembersInput = {
  organizationId: string;
  actorMembershipId: string;
  status: MemberStatusFilter;
  limit: number;
};

export type SuspendCurrentOrganizationMemberInput = {
  organizationId: string;
  actorMembershipId: string;
  targetMembershipId: string;
  expectedVersion: number;
  administratorRole: MemberAdministratorRole;
};

export type SuspendMemberResult = {
  member: MemberProjection;
  replayed: boolean;
};

export interface MemberDirectoryStore {
  listCurrentOrganizationMembers(
    input: ListCurrentOrganizationMembersInput,
  ): Promise<MemberProjection[]>;
  suspendCurrentOrganizationMember(
    input: SuspendCurrentOrganizationMemberInput,
  ): Promise<SuspendMemberResult>;
}
