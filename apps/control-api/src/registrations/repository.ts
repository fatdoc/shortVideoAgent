import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import {
  InvitationIdempotencyConflictError,
  InvitationUnavailableError,
} from '../invitations/errors.js';
import {
  lockRegistrationInvitationInTransaction,
  recordRegistrationInvitationUsageInTransaction,
  type LockedRegistrationInvitation,
} from '../invitations/repository.js';
import { TermsVersionStaleError } from '../terms/errors.js';
import {
  lockRegistrationTermsInTransaction,
  recordRegistrationConsentInTransaction,
} from '../terms/repository.js';
import {
  RegistrationConflictError,
  RegistrationIdempotencyConflictError,
  RegistrationInvitationUnavailableError,
  RegistrationTermsNotAvailableError,
  RegistrationValidationError,
} from './errors.js';
import type {
  RegistrationPath,
  RegistrationRecordInput,
  RegistrationResult,
  RegistrationStore,
  ReplayableRegistrationResult,
} from './types.js';

type RegistrationRow = {
  registration_id: string;
  user_id: string;
  tenant_id: string;
  membership_id: string;
  registration_path: RegistrationPath;
  request_digest: string;
  completed_at: Date | string;
};

type PostgresError = {
  code?: string;
  constraint?: string;
};

type RegistrationEntity =
  | 'organization'
  | 'tenant'
  | 'user'
  | 'membership'
  | 'registration'
  | 'consent'
  | 'usage'
  | 'attribution'
  | 'event';

function registrationFromRow(row: RegistrationRow): RegistrationResult {
  return {
    registrationId: row.registration_id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    membershipId: row.membership_id,
    registrationPath: row.registration_path,
    completedAt: new Date(row.completed_at).toISOString(),
  };
}

function postgresError(error: unknown): PostgresError {
  return (error as PostgresError | null) ?? {};
}

function isUniqueViolation(error: unknown): boolean {
  return postgresError(error).code === '23505';
}

function pathForInvitation(invitation: LockedRegistrationInvitation | null): RegistrationPath {
  if (!invitation) return 'DIRECT';
  if (invitation.invitationType === 'PLATFORM') return 'PLATFORM_INVITATION';
  if (invitation.invitationType === 'CHANNEL') return 'CHANNEL_INVITATION';
  return 'TENANT_MEMBER_INVITATION';
}

export class PostgresRegistrationRepository implements RegistrationStore {
  constructor(
    private readonly database: Knex,
    private readonly newId: (entity: RegistrationEntity) => string = () => randomUUID(),
  ) {}

  async register(input: RegistrationRecordInput): Promise<ReplayableRegistrationResult> {
    try {
      return await this.database.transaction(async (transaction) => {
        await transaction.raw('select pg_advisory_xact_lock(hashtextextended(?, 0))', [
          `registration:idempotency:${input.idempotencyKey}`,
        ]);
        const existing = (await transaction('control_plane.registrations')
          .where({ idempotency_key: input.idempotencyKey })
          .forUpdate()
          .first()) as RegistrationRow | undefined;
        if (existing) {
          if (existing.request_digest !== input.requestDigest) {
            throw new RegistrationIdempotencyConflictError();
          }
          return { value: registrationFromRow(existing), replayed: true };
        }

        await transaction.raw('select pg_advisory_xact_lock(hashtextextended(?, 0))', [
          `registration:email:${input.normalizedEmail}`,
        ]);
        const existingUser = await transaction('control_plane.users')
          .select('user_id')
          .whereRaw('lower(email) = ?', [input.normalizedEmail])
          .first();
        if (existingUser) throw new RegistrationConflictError();

        const invitation =
          input.invitationTokenDigest === null
            ? null
            : await lockRegistrationInvitationInTransaction(transaction, {
                tokenDigest: input.invitationTokenDigest,
                emailNormalized: input.normalizedEmail,
                usedAt: input.completedAt,
              });
        const registrationPath = pathForInvitation(invitation);
        if (registrationPath === 'TENANT_MEMBER_INVITATION') {
          if (input.tenantDisplayName !== null) {
            throw new RegistrationValidationError(
              'tenantDisplayName is forbidden for Tenant member registration.',
            );
          }
        } else if (input.tenantDisplayName === null) {
          throw new RegistrationValidationError(
            'tenantDisplayName is required when registration creates a Tenant.',
          );
        }

        const lockedTerms = await lockRegistrationTermsInTransaction(transaction, {
          documentCode: 'registration-notice',
          locale: input.locale,
          termsVersionId: input.termsVersionId,
          asOf: input.completedAt,
        });

        const userId = this.newId('user');
        const membershipId = this.newId('membership');
        const registrationId = this.newId('registration');
        let tenantId: string;

        await transaction('control_plane.users').insert({
          user_id: userId,
          email: input.normalizedEmail,
          display_name: input.displayName,
          password_hash: input.passwordHash,
          status: 'active',
          created_at: input.completedAt,
          updated_at: input.completedAt,
        });

        if (registrationPath === 'TENANT_MEMBER_INVITATION') {
          if (
            invitation?.targetOrganizationId === null ||
            invitation?.targetRoleCode !== 'content_operator'
          ) {
            throw new RegistrationInvitationUnavailableError();
          }
          const targetTenant = (await transaction('control_plane.tenants')
            .select('tenant_id')
            .where({ organization_id: invitation.targetOrganizationId, status: 'active' })
            .forUpdate()
            .first()) as { tenant_id: string } | undefined;
          if (!targetTenant) throw new RegistrationInvitationUnavailableError();
          tenantId = targetTenant.tenant_id;
          await transaction('control_plane.memberships').insert({
            membership_id: membershipId,
            tenant_id: tenantId,
            user_id: userId,
            role_code: 'content_operator',
            status: 'active',
            created_at: input.completedAt,
            updated_at: input.completedAt,
          });
        } else {
          const organizationId = this.newId('organization');
          tenantId = this.newId('tenant');
          await transaction('control_plane.organizations').insert({
            organization_id: organizationId,
            organization_type: 'TENANT',
            display_name: input.tenantDisplayName,
            status: 'active',
            created_at: input.completedAt,
            updated_at: input.completedAt,
          });
          await transaction('control_plane.tenants').insert({
            tenant_id: tenantId,
            organization_id: organizationId,
            display_name: input.tenantDisplayName,
            status: 'active',
            created_at: input.completedAt,
            updated_at: input.completedAt,
          });
          await transaction('control_plane.memberships').insert({
            membership_id: membershipId,
            tenant_id: tenantId,
            user_id: userId,
            role_code: 'tenant_admin',
            status: 'active',
            created_at: input.completedAt,
            updated_at: input.completedAt,
          });
        }

        const [registration] = (await transaction('control_plane.registrations')
          .insert({
            registration_id: registrationId,
            normalized_email: input.normalizedEmail,
            status: 'completed',
            registration_path: registrationPath,
            invitation_id: invitation?.invitationId ?? null,
            user_id: userId,
            tenant_id: tenantId,
            membership_id: membershipId,
            terms_version_id: lockedTerms.termsVersionId,
            idempotency_key: input.idempotencyKey,
            request_digest: input.requestDigest,
            completed_at: input.completedAt,
            created_at: input.completedAt,
          })
          .returning('*')) as RegistrationRow[];
        if (!registration) throw new Error('registration insert returned no row');

        await recordRegistrationConsentInTransaction(transaction, {
          userConsentId: this.newId('consent'),
          userId,
          lockedTerms,
          acceptedAt: input.completedAt,
          registrationId,
          evidenceMetadata: {
            channel: 'web',
            explicitAccepted: true,
            requestId: input.idempotencyKey,
            verificationEvidenceId: input.verificationEvidenceId,
          },
          createdAt: input.completedAt,
        });

        if (invitation) {
          await recordRegistrationInvitationUsageInTransaction(transaction, {
            invitation,
            invitationUsageId: this.newId('usage'),
            registrationId,
            userId,
            idempotencyKey: input.idempotencyKey,
            requestDigest: input.requestDigest,
            usedAt: input.completedAt,
            createdAt: input.completedAt,
          });
        }

        const referrerChannelId = invitation?.attributionChannelId ?? null;
        const attributionId = this.newId('attribution');
        await transaction('control_plane.referral_attributions').insert({
          referral_attribution_id: attributionId,
          registration_id: registrationId,
          user_id: userId,
          tenant_id: tenantId,
          acquisition_source: registrationPath,
          invitation_id: invitation?.invitationId ?? null,
          referrer_channel_id: referrerChannelId,
          effective_from: input.completedAt,
          protected_until:
            referrerChannelId === null
              ? null
              : transaction.raw("?::timestamptz + interval '12 months'", [input.completedAt]),
          protection_rule_version: 'registration-attribution-v1',
          evidence_digest: input.requestDigest,
          status: 'active',
          created_at: input.completedAt,
        });
        await transaction('control_plane.referral_attribution_events').insert({
          event_id: this.newId('event'),
          referral_attribution_id: attributionId,
          event_type: 'created',
          reason_code: 'registration_completed',
          acted_by: null,
          occurred_at: input.completedAt,
          evidence_digest: input.requestDigest,
          created_at: input.completedAt,
        });

        return { value: registrationFromRow(registration), replayed: false };
      });
    } catch (error) {
      if (
        error instanceof RegistrationConflictError ||
        error instanceof RegistrationIdempotencyConflictError ||
        error instanceof RegistrationInvitationUnavailableError ||
        error instanceof RegistrationTermsNotAvailableError ||
        error instanceof RegistrationValidationError
      ) {
        throw error;
      }
      if (error instanceof InvitationUnavailableError) {
        throw new RegistrationInvitationUnavailableError();
      }
      if (error instanceof InvitationIdempotencyConflictError) {
        throw new RegistrationIdempotencyConflictError();
      }
      if (error instanceof TermsVersionStaleError) {
        throw new RegistrationTermsNotAvailableError();
      }
      if (isUniqueViolation(error)) {
        if (postgresError(error).constraint === 'registrations_idempotency_key_uq') {
          throw new RegistrationIdempotencyConflictError();
        }
        throw new RegistrationConflictError();
      }
      throw error;
    }
  }
}
