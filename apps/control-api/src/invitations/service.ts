import {
  InvitationPermissionDeniedError,
  InvitationUnavailableError,
  InvitationValidationError,
} from './errors.js';
import {
  createInvitationToken,
  digestInvitationToken,
  invitationRequestDigest,
  isInvitationToken,
} from './token.js';
import type {
  CreateInvitationRecord,
  Invitation,
  InvitationActor,
  InvitationStore,
  IssuedInvitation,
  ReplayableResult,
  InvitationUsageResult,
} from './types.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digestPattern = /^[0-9a-f]{64}$/;
const emailPattern = /^[^\s@]+@[^\s@]+$/;
const dayMilliseconds = 86_400_000;

type ServiceOptions = {
  now?: () => Date;
  createToken?: () => string;
};

type PlatformCreationInput = {
  targetEmail: string;
  attributionChannelId: string | null;
  idempotencyKey: string;
};

type ChannelCreationInput = { idempotencyKey: string };
type TenantCreationInput = { targetEmail: string; idempotencyKey: string };

type RegistrationConsumptionInput = {
  token: string;
  registrationId: string;
  userId: string;
  email: string;
  idempotencyKey: string;
  requestDigest: string;
};

function uuid(value: string, field: string): string {
  const normalized = value.trim().toLowerCase();
  if (!uuidPattern.test(normalized))
    throw new InvitationValidationError(`${field} must be a UUID.`);
  return normalized;
}

function optionalUuid(value: string | null, field: string): string | null {
  return value === null ? null : uuid(value, field);
}

function nonempty(value: string, field: string, maximum: number): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximum) {
    throw new InvitationValidationError(`${field} is invalid.`);
  }
  return normalized;
}

function email(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 254 || !emailPattern.test(normalized)) {
    throw new InvitationValidationError('target email is invalid.');
  }
  return normalized;
}

export class InvitationService {
  private readonly now: () => Date;
  private readonly createToken: () => string;

  constructor(
    private readonly store: InvitationStore,
    options: ServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.createToken = options.createToken ?? createInvitationToken;
  }

  async createPlatformInvitation(
    actor: InvitationActor,
    input: PlatformCreationInput,
  ): Promise<IssuedInvitation> {
    this.requireRole(actor, 'PLATFORM', 'platform_admin');
    return this.create(actor, {
      invitationType: 'PLATFORM',
      targetOrganizationId: null,
      targetRoleCode: null,
      targetEmailNormalized: email(input.targetEmail),
      attributionChannelId: optionalUuid(input.attributionChannelId, 'attributionChannelId'),
      maxUses: 1,
      durationDays: 7,
      idempotencyKey: nonempty(input.idempotencyKey, 'idempotencyKey', 200),
    });
  }

  async createChannelInvitation(
    actor: InvitationActor,
    input: ChannelCreationInput,
  ): Promise<IssuedInvitation> {
    this.requireRole(actor, 'CHANNEL', 'channel_admin');
    return this.create(actor, {
      invitationType: 'CHANNEL',
      targetOrganizationId: null,
      targetRoleCode: null,
      targetEmailNormalized: null,
      attributionChannelId: null,
      maxUses: 100,
      durationDays: 30,
      idempotencyKey: nonempty(input.idempotencyKey, 'idempotencyKey', 200),
    });
  }

  async createTenantMemberInvitation(
    actor: InvitationActor,
    input: TenantCreationInput,
  ): Promise<IssuedInvitation> {
    this.requireRole(actor, 'TENANT', 'tenant_admin');
    return this.create(actor, {
      invitationType: 'TENANT_MEMBER',
      targetOrganizationId: uuid(actor.organizationId, 'actor.organizationId'),
      targetRoleCode: 'content_operator',
      targetEmailNormalized: email(input.targetEmail),
      attributionChannelId: null,
      maxUses: 1,
      durationDays: 7,
      idempotencyKey: nonempty(input.idempotencyKey, 'idempotencyKey', 200),
    });
  }

  async listInvitations(actor: InvitationActor): Promise<Invitation[]> {
    this.requireManager(actor);
    return this.store.listByIssuerOrganization(
      uuid(actor.organizationId, 'actor.organizationId'),
      this.now(),
    );
  }

  async preview(token: string): Promise<Invitation> {
    if (!isInvitationToken(token)) throw new InvitationUnavailableError();
    const invitation = await this.store.findAvailableByTokenDigest(
      digestInvitationToken(token),
      this.now(),
    );
    if (!invitation) throw new InvitationUnavailableError();
    return invitation;
  }

  async revokeInvitation(
    actor: InvitationActor,
    invitationId: string,
  ): Promise<ReplayableResult<Invitation>> {
    this.requireManager(actor);
    return this.store.revoke({
      invitationId: uuid(invitationId, 'invitationId'),
      issuerOrganizationId: uuid(actor.organizationId, 'actor.organizationId'),
      revokedByMembershipId: uuid(actor.membershipId, 'actor.membershipId'),
      revokedAt: this.now(),
    });
  }

  async consumeForRegistration(
    input: RegistrationConsumptionInput,
  ): Promise<ReplayableResult<InvitationUsageResult>> {
    if (!isInvitationToken(input.token)) throw new InvitationUnavailableError();
    const requestDigest = input.requestDigest.trim().toLowerCase();
    if (!digestPattern.test(requestDigest)) {
      throw new InvitationValidationError('requestDigest must be a SHA-256 digest.');
    }
    return this.store.consume({
      tokenDigest: digestInvitationToken(input.token),
      registrationId: uuid(input.registrationId, 'registrationId'),
      userId: uuid(input.userId, 'userId'),
      emailNormalized: email(input.email),
      idempotencyKey: nonempty(input.idempotencyKey, 'idempotencyKey', 200),
      requestDigest,
      usedAt: this.now(),
    });
  }

  private async create(
    actor: InvitationActor,
    input: Omit<
      CreateInvitationRecord,
      | 'issuerMembershipId'
      | 'issuerOrganizationId'
      | 'tokenDigest'
      | 'validFrom'
      | 'expiresAt'
      | 'creationIdempotencyKey'
      | 'creationRequestDigest'
    > & { durationDays: number; idempotencyKey: string },
  ): Promise<IssuedInvitation> {
    const validFrom = this.now();
    const token = this.createToken();
    if (!isInvitationToken(token)) {
      throw new Error('Invitation token generator returned an invalid token.');
    }
    const issuerMembershipId = uuid(actor.membershipId, 'actor.membershipId');
    const issuerOrganizationId = uuid(actor.organizationId, 'actor.organizationId');
    const requestFacts = {
      issuerOrganizationId,
      invitationType: input.invitationType,
      targetOrganizationId: input.targetOrganizationId,
      targetRoleCode: input.targetRoleCode,
      targetEmailNormalized: input.targetEmailNormalized,
      attributionChannelId: input.attributionChannelId,
      maxUses: input.maxUses,
    };
    const result = await this.store.create({
      issuerMembershipId,
      issuerOrganizationId,
      invitationType: input.invitationType,
      targetOrganizationId: input.targetOrganizationId,
      targetRoleCode: input.targetRoleCode,
      targetEmailNormalized: input.targetEmailNormalized,
      attributionChannelId: input.attributionChannelId,
      tokenDigest: digestInvitationToken(token),
      validFrom,
      expiresAt: new Date(validFrom.getTime() + input.durationDays * dayMilliseconds),
      maxUses: input.maxUses,
      creationIdempotencyKey: input.idempotencyKey,
      creationRequestDigest: invitationRequestDigest(requestFacts),
    });
    return {
      invitation: result.value,
      token: result.replayed ? null : token,
      replayed: result.replayed,
    };
  }

  private requireManager(actor: InvitationActor): void {
    if (actor.organizationType === 'PLATFORM') {
      this.requireRole(actor, 'PLATFORM', 'platform_admin');
      return;
    }
    if (actor.organizationType === 'CHANNEL') {
      this.requireRole(actor, 'CHANNEL', 'channel_admin');
      return;
    }
    this.requireRole(actor, 'TENANT', 'tenant_admin');
  }

  private requireRole(
    actor: InvitationActor,
    organizationType: InvitationActor['organizationType'],
    role: InvitationActor['roles'][number],
  ): void {
    if (actor.organizationType !== organizationType || !actor.roles.includes(role)) {
      throw new InvitationPermissionDeniedError();
    }
  }
}
