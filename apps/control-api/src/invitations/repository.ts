import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import {
  InvitationIdempotencyConflictError,
  InvitationNotFoundError,
  InvitationScopeConflictError,
  InvitationStateConflictError,
  InvitationUnavailableError,
} from './errors.js';
import type {
  ConsumeInvitationRecord,
  CreateInvitationRecord,
  Invitation,
  InvitationStatus,
  InvitationStore,
  InvitationType,
  InvitationUsage,
  InvitationUsageResult,
  ReplayableResult,
  RevokeInvitationRecord,
} from './types.js';

type InvitationRow = {
  invitation_id: string;
  issuer_membership_id: string;
  issuer_organization_id: string;
  invitation_type: InvitationType;
  target_organization_id: string | null;
  target_role_code: 'content_operator' | null;
  target_email_normalized: string | null;
  attribution_channel_id: string | null;
  token_digest: string;
  status: InvitationStatus;
  valid_from: Date | string;
  expires_at: Date | string;
  max_uses: number;
  used_count: number;
  creation_idempotency_key: string;
  creation_request_digest: string;
  created_at: Date | string;
  updated_at: Date | string;
  revoked_at: Date | string | null;
  revoked_by_membership_id: string | null;
};

type InvitationUsageRow = {
  invitation_usage_id: string;
  invitation_id: string;
  registration_id: string;
  user_id: string;
  used_at: Date | string;
  idempotency_key: string;
  request_digest: string;
  created_at: Date | string;
};

type PostgresError = {
  code?: string;
  constraint?: string;
};

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function nullableIso(value: Date | string | null): string | null {
  return value === null ? null : iso(value);
}

function invitationFromRow(row: InvitationRow): Invitation {
  return {
    invitationId: row.invitation_id,
    issuerMembershipId: row.issuer_membership_id,
    issuerOrganizationId: row.issuer_organization_id,
    invitationType: row.invitation_type,
    targetOrganizationId: row.target_organization_id,
    targetRoleCode: row.target_role_code,
    targetEmailNormalized: row.target_email_normalized,
    attributionChannelId: row.attribution_channel_id,
    status: row.status,
    validFrom: iso(row.valid_from),
    expiresAt: iso(row.expires_at),
    maxUses: row.max_uses,
    usedCount: row.used_count,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    revokedAt: nullableIso(row.revoked_at),
    revokedByMembershipId: row.revoked_by_membership_id,
  };
}

function usageFromRow(row: InvitationUsageRow): InvitationUsage {
  return {
    invitationUsageId: row.invitation_usage_id,
    invitationId: row.invitation_id,
    registrationId: row.registration_id,
    userId: row.user_id,
    usedAt: iso(row.used_at),
    createdAt: iso(row.created_at),
  };
}

function postgresError(error: unknown): PostgresError {
  return (error as PostgresError | null) ?? {};
}

function isUniqueViolation(error: unknown): boolean {
  return postgresError(error).code === '23505';
}

function isCreationIdempotencyViolation(error: unknown): boolean {
  return (
    isUniqueViolation(error) &&
    postgresError(error).constraint === 'invitations_creation_idempotency_uq'
  );
}

function isDatabaseScopeViolation(error: unknown): boolean {
  return ['23503', '23514', 'P0001'].includes(postgresError(error).code ?? '');
}

export class PostgresInvitationRepository implements InvitationStore {
  constructor(
    private readonly database: Knex,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: (entity: 'invitation' | 'usage') => string = () => randomUUID(),
  ) {}

  async create(input: CreateInvitationRecord): Promise<ReplayableResult<Invitation>> {
    const existing = await this.findByCreationKey(
      this.database,
      input.issuerOrganizationId,
      input.creationIdempotencyKey,
    );
    if (existing) return this.creationReplay(existing, input.creationRequestDigest);

    try {
      return await this.database.transaction(async (transaction) => {
        const lockedExisting = await this.findByCreationKey(
          transaction,
          input.issuerOrganizationId,
          input.creationIdempotencyKey,
          true,
        );
        if (lockedExisting) {
          return this.creationReplay(lockedExisting, input.creationRequestDigest);
        }

        const attributionChannelId =
          input.invitationType === 'CHANNEL'
            ? await this.channelIdForOrganization(transaction, input.issuerOrganizationId)
            : input.attributionChannelId;
        const timestamp = this.now();
        const [row] = (await transaction('control_plane.invitations')
          .insert({
            invitation_id: this.newId('invitation'),
            issuer_membership_id: input.issuerMembershipId,
            issuer_organization_id: input.issuerOrganizationId,
            invitation_type: input.invitationType,
            target_organization_id: input.targetOrganizationId,
            target_role_code: input.targetRoleCode,
            target_email_normalized: input.targetEmailNormalized,
            attribution_channel_id: attributionChannelId,
            token_digest: input.tokenDigest,
            status: 'active',
            valid_from: input.validFrom,
            expires_at: input.expiresAt,
            max_uses: input.maxUses,
            used_count: 0,
            creation_idempotency_key: input.creationIdempotencyKey,
            creation_request_digest: input.creationRequestDigest,
            created_at: timestamp,
            updated_at: timestamp,
          })
          .returning('*')) as InvitationRow[];
        if (!row) throw new Error('invitation insert returned no row');
        return { value: invitationFromRow(row), replayed: false };
      });
    } catch (error) {
      if (isCreationIdempotencyViolation(error)) {
        const replay = await this.findByCreationKey(
          this.database,
          input.issuerOrganizationId,
          input.creationIdempotencyKey,
        );
        if (replay) return this.creationReplay(replay, input.creationRequestDigest);
      }
      if (isUniqueViolation(error)) throw new InvitationStateConflictError();
      if (isDatabaseScopeViolation(error)) throw new InvitationScopeConflictError();
      throw error;
    }
  }

  async listByIssuerOrganization(issuerOrganizationId: string, asOf: Date): Promise<Invitation[]> {
    const rows = (await this.database('control_plane.invitations')
      .where({ issuer_organization_id: issuerOrganizationId })
      .orderBy('created_at', 'desc')
      .orderBy('invitation_id', 'desc')) as InvitationRow[];
    return rows.map((row) => {
      const invitation = invitationFromRow(row);
      return invitation.status === 'active' &&
        new Date(invitation.expiresAt).getTime() <= asOf.getTime()
        ? { ...invitation, status: 'expired' }
        : invitation;
    });
  }

  async findAvailableByTokenDigest(tokenDigest: string, asOf: Date): Promise<Invitation | null> {
    const row = (await this.database('control_plane.invitations')
      .where({ token_digest: tokenDigest, status: 'active' })
      .where('valid_from', '<=', asOf)
      .where('expires_at', '>', asOf)
      .whereRaw('used_count < max_uses')
      .first()) as InvitationRow | undefined;
    return row ? invitationFromRow(row) : null;
  }

  async revoke(input: RevokeInvitationRecord): Promise<ReplayableResult<Invitation>> {
    try {
      return await this.database.transaction(async (transaction) => {
        const existing = (await transaction('control_plane.invitations')
          .where({
            invitation_id: input.invitationId,
            issuer_organization_id: input.issuerOrganizationId,
          })
          .forUpdate()
          .first()) as InvitationRow | undefined;
        if (!existing) throw new InvitationNotFoundError();
        if (existing.status === 'revoked') {
          return { value: invitationFromRow(existing), replayed: true };
        }
        if (
          existing.status !== 'active' ||
          new Date(existing.expires_at).getTime() <= input.revokedAt.getTime()
        ) {
          throw new InvitationStateConflictError();
        }

        const [row] = (await transaction('control_plane.invitations')
          .where({ invitation_id: input.invitationId })
          .update({
            status: 'revoked',
            revoked_at: input.revokedAt,
            revoked_by_membership_id: input.revokedByMembershipId,
          })
          .returning('*')) as InvitationRow[];
        if (!row) throw new Error('invitation revoke returned no row');
        return { value: invitationFromRow(row), replayed: false };
      });
    } catch (error) {
      if (
        error instanceof InvitationNotFoundError ||
        error instanceof InvitationStateConflictError
      ) {
        throw error;
      }
      if (isDatabaseScopeViolation(error)) throw new InvitationScopeConflictError();
      throw error;
    }
  }

  async consume(input: ConsumeInvitationRecord): Promise<ReplayableResult<InvitationUsageResult>> {
    try {
      return await this.database.transaction(async (transaction) => {
        const invitation = (await transaction('control_plane.invitations')
          .where({ token_digest: input.tokenDigest })
          .forUpdate()
          .first()) as InvitationRow | undefined;
        if (!invitation) throw new InvitationUnavailableError();

        const existingUsage = (await transaction('control_plane.invitation_usages')
          .where({
            invitation_id: invitation.invitation_id,
            idempotency_key: input.idempotencyKey,
          })
          .first()) as InvitationUsageRow | undefined;
        if (existingUsage) {
          if (
            existingUsage.registration_id !== input.registrationId ||
            existingUsage.user_id !== input.userId ||
            existingUsage.request_digest !== input.requestDigest
          ) {
            throw new InvitationIdempotencyConflictError();
          }
          return {
            value: {
              invitation: invitationFromRow(invitation),
              usage: usageFromRow(existingUsage),
            },
            replayed: true,
          };
        }

        if (
          invitation.status !== 'active' ||
          input.usedAt.getTime() < new Date(invitation.valid_from).getTime() ||
          input.usedAt.getTime() >= new Date(invitation.expires_at).getTime() ||
          invitation.used_count >= invitation.max_uses ||
          (invitation.target_email_normalized !== null &&
            invitation.target_email_normalized !== input.emailNormalized)
        ) {
          throw new InvitationUnavailableError();
        }

        const [usage] = (await transaction('control_plane.invitation_usages')
          .insert({
            invitation_usage_id: this.newId('usage'),
            invitation_id: invitation.invitation_id,
            registration_id: input.registrationId,
            user_id: input.userId,
            used_at: input.usedAt,
            idempotency_key: input.idempotencyKey,
            request_digest: input.requestDigest,
            created_at: this.now(),
          })
          .returning('*')) as InvitationUsageRow[];
        if (!usage) throw new Error('invitation Usage insert returned no row');

        const updated = (await transaction('control_plane.invitations')
          .where({ invitation_id: invitation.invitation_id })
          .first()) as InvitationRow | undefined;
        if (!updated) throw new Error('consumed invitation was not found');
        return {
          value: { invitation: invitationFromRow(updated), usage: usageFromRow(usage) },
          replayed: false,
        };
      });
    } catch (error) {
      if (
        error instanceof InvitationUnavailableError ||
        error instanceof InvitationIdempotencyConflictError
      ) {
        throw error;
      }
      if (isUniqueViolation(error)) throw new InvitationIdempotencyConflictError();
      if (isDatabaseScopeViolation(error)) throw new InvitationUnavailableError();
      throw error;
    }
  }

  private creationReplay(row: InvitationRow, requestDigest: string): ReplayableResult<Invitation> {
    if (row.creation_request_digest !== requestDigest) {
      throw new InvitationIdempotencyConflictError();
    }
    return { value: invitationFromRow(row), replayed: true };
  }

  private async findByCreationKey(
    database: Knex | Knex.Transaction,
    issuerOrganizationId: string,
    idempotencyKey: string,
    lock = false,
  ): Promise<InvitationRow | undefined> {
    let query = database('control_plane.invitations').where({
      issuer_organization_id: issuerOrganizationId,
      creation_idempotency_key: idempotencyKey,
    });
    if (lock) query = query.forUpdate();
    return (await query.first()) as InvitationRow | undefined;
  }

  private async channelIdForOrganization(
    transaction: Knex.Transaction,
    organizationId: string,
  ): Promise<string> {
    const channel = (await transaction('control_plane.channels')
      .select('channel_id')
      .where({ organization_id: organizationId })
      .first()) as { channel_id: string } | undefined;
    if (!channel) throw new InvitationScopeConflictError();
    return channel.channel_id;
  }
}
