import type { Knex } from 'knex';
import type { RoleCode } from '../auth/types.js';
import {
  MemberLastAdminConflictError,
  MemberNotFoundError,
  MemberSelfSuspendForbiddenError,
  MemberStatusConflictError,
  MemberVersionConflictError,
} from './errors.js';
import type {
  ListCurrentOrganizationMembersInput,
  MemberDirectoryStore,
  MemberProjection,
  MemberStatus,
  SuspendCurrentOrganizationMemberInput,
  SuspendMemberResult,
} from './types.js';

type MemberProjectionRow = {
  membership_id: string;
  display_name: string;
  email: string;
  status: MemberStatus;
  primary_role_code: RoleCode;
  roles: RoleCode[];
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
};

type LockedMembershipRow = {
  membership_id: string;
  status: MemberStatus;
  version: number;
};

function memberProjection(row: MemberProjectionRow, actorMembershipId: string): MemberProjection {
  return {
    membershipId: row.membership_id,
    displayName: row.display_name,
    email: row.email.trim().toLowerCase(),
    status: row.status,
    primaryRole: row.primary_role_code,
    roles: [...new Set(row.roles)].sort(),
    version: row.version,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    isCurrentActor: row.membership_id === actorMembershipId,
  };
}

function projectionQuery(database: Knex | Knex.Transaction) {
  return database({ membership: 'control_plane.organization_memberships' })
    .join({ account_user: 'control_plane.users' }, 'account_user.user_id', 'membership.user_id')
    .join(
      { membership_role: 'control_plane.organization_membership_roles' },
      'membership_role.membership_id',
      'membership.membership_id',
    )
    .select(
      'membership.membership_id',
      'account_user.display_name',
      'account_user.email',
      'membership.status',
      'membership.primary_role_code',
      'membership.version',
      'membership.created_at',
      'membership.updated_at',
    )
    .select(
      database.raw(
        'array_agg(distinct membership_role.role_code order by membership_role.role_code) as roles',
      ),
    )
    .groupBy(
      'membership.membership_id',
      'account_user.display_name',
      'account_user.email',
      'membership.status',
      'membership.primary_role_code',
      'membership.version',
      'membership.created_at',
      'membership.updated_at',
    );
}

export class PostgresMemberDirectoryRepository implements MemberDirectoryStore {
  constructor(private readonly database: Knex) {}

  async listCurrentOrganizationMembers(
    input: ListCurrentOrganizationMembersInput,
  ): Promise<MemberProjection[]> {
    const query = projectionQuery(this.database)
      .where('membership.organization_id', input.organizationId)
      .orderByRaw('lower(account_user.display_name) asc')
      .orderByRaw('lower(account_user.email) asc')
      .orderBy('membership.membership_id', 'asc')
      .limit(input.limit);
    if (input.status !== 'all') query.where('membership.status', input.status);
    const rows = (await query) as MemberProjectionRow[];
    return rows.map((row) => memberProjection(row, input.actorMembershipId));
  }

  async suspendCurrentOrganizationMember(
    input: SuspendCurrentOrganizationMemberInput,
  ): Promise<SuspendMemberResult> {
    return this.database.transaction(async (transaction) => {
      const legacyMembership = (await transaction({ legacy: 'control_plane.memberships' })
        .join({ tenant: 'control_plane.tenants' }, 'tenant.tenant_id', 'legacy.tenant_id')
        .select('legacy.membership_id')
        .where({
          'legacy.membership_id': input.targetMembershipId,
          'tenant.organization_id': input.organizationId,
        })
        .forUpdate('legacy')
        .first()) as { membership_id: string } | undefined;

      const lockedMemberships = (await transaction({
        membership: 'control_plane.organization_memberships',
      })
        .select('membership.membership_id', 'membership.status', 'membership.version')
        .where('membership.organization_id', input.organizationId)
        .andWhere(function lockTargetAndAdministrators() {
          this.where('membership.membership_id', input.targetMembershipId).orWhere(function () {
            this.where('membership.status', 'active').whereExists(function () {
              this.select(transaction.raw('1'))
                .from({ membership_role: 'control_plane.organization_membership_roles' })
                .whereRaw('membership_role.membership_id = membership.membership_id')
                .andWhere('membership_role.role_code', input.administratorRole);
            });
          });
        })
        .orderBy('membership.membership_id', 'asc')
        .forUpdate('membership')) as LockedMembershipRow[];

      const target = lockedMemberships.find(
        ({ membership_id: membershipId }) => membershipId === input.targetMembershipId,
      );
      if (!target) throw new MemberNotFoundError();
      if (target.status === 'suspended') {
        return {
          member: await this.loadProjection(
            transaction,
            input.organizationId,
            input.targetMembershipId,
            input.actorMembershipId,
          ),
          replayed: true,
        };
      }
      if (target.status !== 'active') throw new MemberStatusConflictError();
      if (target.membership_id === input.actorMembershipId) {
        throw new MemberSelfSuspendForbiddenError();
      }
      if (target.version !== input.expectedVersion) throw new MemberVersionConflictError();

      const targetIsAdministrator = await transaction('control_plane.organization_membership_roles')
        .where({
          membership_id: input.targetMembershipId,
          role_code: input.administratorRole,
        })
        .first();
      if (
        targetIsAdministrator &&
        !lockedMemberships.some(
          ({ membership_id: membershipId, status }) =>
            membershipId !== input.targetMembershipId && status === 'active',
        )
      ) {
        throw new MemberLastAdminConflictError();
      }

      const updated = legacyMembership
        ? await transaction('control_plane.memberships')
            .where({ membership_id: input.targetMembershipId, status: 'active' })
            .update({ status: 'suspended', updated_at: transaction.fn.now() })
        : await transaction('control_plane.organization_memberships')
            .where({
              membership_id: input.targetMembershipId,
              organization_id: input.organizationId,
              status: 'active',
              version: input.expectedVersion,
            })
            .update({ status: 'suspended', updated_at: transaction.fn.now() });
      if (updated !== 1) throw new MemberVersionConflictError();

      const member = await this.loadProjection(
        transaction,
        input.organizationId,
        input.targetMembershipId,
        input.actorMembershipId,
      );
      if (member.status !== 'suspended' || member.version !== input.expectedVersion + 1) {
        throw new Error('suspended Membership did not preserve the canonical version contract');
      }
      return { member, replayed: false };
    });
  }

  private async loadProjection(
    database: Knex.Transaction,
    organizationId: string,
    membershipId: string,
    actorMembershipId: string,
  ): Promise<MemberProjection> {
    const row = (await projectionQuery(database)
      .where({
        'membership.organization_id': organizationId,
        'membership.membership_id': membershipId,
      })
      .first()) as MemberProjectionRow | undefined;
    if (!row) throw new MemberNotFoundError();
    return memberProjection(row, actorMembershipId);
  }
}
