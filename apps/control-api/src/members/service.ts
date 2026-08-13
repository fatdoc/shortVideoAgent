import { MemberPermissionDeniedError } from './errors.js';
import type {
  MemberAdministratorRole,
  MemberDirectoryActor,
  MemberDirectoryStore,
  MemberProjection,
  MemberStatusFilter,
  SuspendMemberResult,
} from './types.js';

function administratorRole(actor: MemberDirectoryActor): MemberAdministratorRole {
  const role: MemberAdministratorRole =
    actor.organizationType === 'PLATFORM'
      ? 'platform_admin'
      : actor.organizationType === 'CHANNEL'
        ? 'channel_admin'
        : 'tenant_admin';
  if (!actor.roles.includes(role)) throw new MemberPermissionDeniedError();
  return role;
}

export class MemberDirectoryService {
  constructor(private readonly store: MemberDirectoryStore) {}

  async listCurrentOrganizationMembers(
    actor: MemberDirectoryActor,
    query: { status: MemberStatusFilter; limit: number },
  ): Promise<MemberProjection[]> {
    administratorRole(actor);
    return this.store.listCurrentOrganizationMembers({
      organizationId: actor.organizationId,
      actorMembershipId: actor.membershipId,
      status: query.status,
      limit: query.limit,
    });
  }

  async suspendCurrentOrganizationMember(
    actor: MemberDirectoryActor,
    targetMembershipId: string,
    expectedVersion: number,
  ): Promise<SuspendMemberResult> {
    return this.store.suspendCurrentOrganizationMember({
      organizationId: actor.organizationId,
      actorMembershipId: actor.membershipId,
      targetMembershipId,
      expectedVersion,
      administratorRole: administratorRole(actor),
    });
  }
}
