import { describe, expect, it, vi } from 'vitest';
import {
  InvitationIdempotencyConflictError,
  InvitationPermissionDeniedError,
  InvitationUnavailableError,
  InvitationValidationError,
} from './errors.js';
import { InvitationService } from './service.js';
import { digestInvitationToken } from './token.js';
import type {
  Invitation,
  InvitationActor,
  InvitationStore,
  InvitationUsageResult,
} from './types.js';

const now = new Date('2026-08-07T12:00:00.000Z');
const plaintextToken = 'A'.repeat(43);
const platformOrganizationId = '10000000-0000-4000-8000-000000000001';
const channelOrganizationId = '10000000-0000-4000-8000-000000000002';
const tenantOrganizationId = '10000000-0000-4000-8000-000000000003';
const platformMembershipId = '20000000-0000-4000-8000-000000000001';
const channelMembershipId = '20000000-0000-4000-8000-000000000002';
const tenantMembershipId = '20000000-0000-4000-8000-000000000003';
const invitationId = '30000000-0000-4000-8000-000000000001';

const platformAdmin: InvitationActor = {
  userId: '40000000-0000-4000-8000-000000000001',
  membershipId: platformMembershipId,
  organizationId: platformOrganizationId,
  organizationType: 'PLATFORM',
  roles: ['platform_admin'],
};
const channelAdmin: InvitationActor = {
  userId: '40000000-0000-4000-8000-000000000002',
  membershipId: channelMembershipId,
  organizationId: channelOrganizationId,
  organizationType: 'CHANNEL',
  roles: ['channel_admin'],
};
const tenantAdmin: InvitationActor = {
  userId: '40000000-0000-4000-8000-000000000003',
  membershipId: tenantMembershipId,
  organizationId: tenantOrganizationId,
  organizationType: 'TENANT',
  roles: ['tenant_admin'],
};

const platformInvitation: Invitation = {
  invitationId,
  issuerMembershipId: platformMembershipId,
  issuerOrganizationId: platformOrganizationId,
  invitationType: 'PLATFORM',
  targetOrganizationId: null,
  targetRoleCode: null,
  targetEmailNormalized: 'new-user@example.com',
  attributionChannelId: null,
  status: 'active',
  validFrom: now.toISOString(),
  expiresAt: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
  maxUses: 1,
  usedCount: 0,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  revokedAt: null,
  revokedByMembershipId: null,
};

const usageResult: InvitationUsageResult = {
  invitation: { ...platformInvitation, status: 'exhausted', usedCount: 1 },
  usage: {
    invitationUsageId: '50000000-0000-4000-8000-000000000001',
    invitationId,
    registrationId: '60000000-0000-4000-8000-000000000001',
    userId: '70000000-0000-4000-8000-000000000001',
    usedAt: now.toISOString(),
    createdAt: now.toISOString(),
  },
};

function store(overrides: Partial<InvitationStore> = {}): InvitationStore {
  return {
    create: vi.fn(async () => ({ value: platformInvitation, replayed: false })),
    listByIssuerOrganization: vi.fn(async () => [platformInvitation]),
    findAvailableByTokenDigest: vi.fn(async () => platformInvitation),
    revoke: vi.fn(async () => ({
      value: {
        ...platformInvitation,
        status: 'revoked',
        revokedAt: now.toISOString(),
        revokedByMembershipId: platformMembershipId,
      },
      replayed: false,
    })),
    consume: vi.fn(async () => ({ value: usageResult, replayed: false })),
    ...overrides,
  };
}

function service(invitationStore: InvitationStore): InvitationService {
  return new InvitationService(invitationStore, {
    now: () => now,
    createToken: () => plaintextToken,
  });
}

describe('InvitationService', () => {
  it('derives immutable PLATFORM, CHANNEL and TENANT_MEMBER creation facts from the actor', async () => {
    const create = vi.fn<InvitationStore['create']>(async () => ({
      value: platformInvitation,
      replayed: false,
    }));
    const invitations = service(store({ create }));

    await invitations.createPlatformInvitation(platformAdmin, {
      targetEmail: '  New-User@Example.COM ',
      attributionChannelId: null,
      idempotencyKey: ' platform-create-1 ',
    });
    await invitations.createChannelInvitation(channelAdmin, {
      idempotencyKey: ' channel-create-1 ',
    });
    await invitations.createTenantMemberInvitation(tenantAdmin, {
      targetEmail: ' Worker@Example.COM ',
      idempotencyKey: ' tenant-create-1 ',
    });

    expect(create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        issuerMembershipId: platformMembershipId,
        issuerOrganizationId: platformOrganizationId,
        invitationType: 'PLATFORM',
        targetEmailNormalized: 'new-user@example.com',
        targetOrganizationId: null,
        targetRoleCode: null,
        attributionChannelId: null,
        maxUses: 1,
        tokenDigest: digestInvitationToken(plaintextToken),
      }),
    );
    expect(create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        issuerMembershipId: channelMembershipId,
        issuerOrganizationId: channelOrganizationId,
        invitationType: 'CHANNEL',
        targetEmailNormalized: null,
        targetOrganizationId: null,
        targetRoleCode: null,
        attributionChannelId: null,
        maxUses: 100,
      }),
    );
    expect(create).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        issuerMembershipId: tenantMembershipId,
        issuerOrganizationId: tenantOrganizationId,
        invitationType: 'TENANT_MEMBER',
        targetEmailNormalized: 'worker@example.com',
        targetOrganizationId: tenantOrganizationId,
        targetRoleCode: 'content_operator',
        attributionChannelId: null,
        maxUses: 1,
      }),
    );
  });

  it('returns plaintext Token only for the first creation and never for an idempotent replay', async () => {
    const create = vi
      .fn<InvitationStore['create']>()
      .mockResolvedValueOnce({ value: platformInvitation, replayed: false })
      .mockResolvedValueOnce({ value: platformInvitation, replayed: true });
    const invitations = service(store({ create }));
    const input = {
      targetEmail: 'new-user@example.com',
      attributionChannelId: null,
      idempotencyKey: 'platform-create-1',
    };

    await expect(invitations.createPlatformInvitation(platformAdmin, input)).resolves.toMatchObject(
      {
        invitation: platformInvitation,
        token: plaintextToken,
        replayed: false,
      },
    );
    await expect(invitations.createPlatformInvitation(platformAdmin, input)).resolves.toMatchObject(
      {
        invitation: platformInvitation,
        token: null,
        replayed: true,
      },
    );
  });

  it('rejects wrong organization roles before calling the Store', async () => {
    const create = vi.fn<InvitationStore['create']>();
    const invitations = service(store({ create }));

    await expect(
      invitations.createPlatformInvitation(channelAdmin, {
        targetEmail: 'new-user@example.com',
        attributionChannelId: null,
        idempotencyKey: 'platform-create-1',
      }),
    ).rejects.toBeInstanceOf(InvitationPermissionDeniedError);
    await expect(
      invitations.createChannelInvitation(
        { ...channelAdmin, roles: ['content_operator'] },
        {
          idempotencyKey: 'channel-create-1',
        },
      ),
    ).rejects.toBeInstanceOf(InvitationPermissionDeniedError);
    await expect(
      invitations.createTenantMemberInvitation(
        { ...tenantAdmin, roles: ['content_operator'] },
        {
          targetEmail: 'worker@example.com',
          idempotencyKey: 'tenant-create-1',
        },
      ),
    ).rejects.toBeInstanceOf(InvitationPermissionDeniedError);
    expect(create).not.toHaveBeenCalled();
  });

  it('validates email, UUID and idempotency input before reaching the Store', async () => {
    const create = vi.fn<InvitationStore['create']>();
    const invitations = service(store({ create }));

    await expect(
      invitations.createPlatformInvitation(platformAdmin, {
        targetEmail: 'not-an-email',
        attributionChannelId: null,
        idempotencyKey: 'platform-create-1',
      }),
    ).rejects.toBeInstanceOf(InvitationValidationError);
    await expect(
      invitations.createPlatformInvitation(platformAdmin, {
        targetEmail: 'new-user@example.com',
        attributionChannelId: 'not-a-uuid',
        idempotencyKey: 'platform-create-1',
      }),
    ).rejects.toBeInstanceOf(InvitationValidationError);
    await expect(
      invitations.createChannelInvitation(channelAdmin, { idempotencyKey: '   ' }),
    ).rejects.toBeInstanceOf(InvitationValidationError);
    expect(create).not.toHaveBeenCalled();
  });

  it('keeps list and revoke access inside the active organization scope', async () => {
    const listByIssuerOrganization = vi.fn<InvitationStore['listByIssuerOrganization']>(
      async () => [platformInvitation],
    );
    const revoke = vi.fn<InvitationStore['revoke']>(async () => ({
      value: { ...platformInvitation, status: 'revoked' },
      replayed: false,
    }));
    const invitations = service(store({ listByIssuerOrganization, revoke }));

    await invitations.listInvitations(platformAdmin);
    expect(listByIssuerOrganization).toHaveBeenCalledWith(platformOrganizationId, now);
    await invitations.revokeInvitation(platformAdmin, invitationId);
    expect(revoke).toHaveBeenCalledWith({
      invitationId,
      issuerOrganizationId: platformOrganizationId,
      revokedByMembershipId: platformMembershipId,
      revokedAt: now,
    });

    await expect(
      invitations.listInvitations({ ...tenantAdmin, roles: ['content_operator'] }),
    ).rejects.toBeInstanceOf(InvitationPermissionDeniedError);
  });

  it('uses a versioned digest for Preview and makes malformed or missing Tokens uniformly unavailable', async () => {
    const findAvailableByTokenDigest = vi.fn<InvitationStore['findAvailableByTokenDigest']>(
      async () => platformInvitation,
    );
    const invitations = service(store({ findAvailableByTokenDigest }));

    await expect(invitations.preview(plaintextToken)).resolves.toEqual(platformInvitation);
    expect(findAvailableByTokenDigest).toHaveBeenCalledWith(
      digestInvitationToken(plaintextToken),
      now,
    );

    await expect(invitations.preview('plaintext-token')).rejects.toBeInstanceOf(
      InvitationUnavailableError,
    );
    expect(findAvailableByTokenDigest).toHaveBeenCalledTimes(1);

    findAvailableByTokenDigest.mockResolvedValueOnce(null);
    await expect(invitations.preview('B'.repeat(43))).rejects.toBeInstanceOf(
      InvitationUnavailableError,
    );
  });

  it('normalizes registration identity and preserves replay/conflict facts from atomic Usage', async () => {
    const consume = vi.fn<InvitationStore['consume']>(async () => ({
      value: usageResult,
      replayed: false,
    }));
    const invitations = service(store({ consume }));
    const input = {
      token: plaintextToken,
      registrationId: usageResult.usage.registrationId,
      userId: usageResult.usage.userId,
      email: ' New-User@Example.COM ',
      idempotencyKey: ' registration-use-1 ',
      requestDigest: 'f'.repeat(64),
    };

    await expect(invitations.consumeForRegistration(input)).resolves.toEqual({
      value: usageResult,
      replayed: false,
    });
    expect(consume).toHaveBeenCalledWith({
      tokenDigest: digestInvitationToken(plaintextToken),
      registrationId: usageResult.usage.registrationId,
      userId: usageResult.usage.userId,
      emailNormalized: 'new-user@example.com',
      idempotencyKey: 'registration-use-1',
      requestDigest: 'f'.repeat(64),
      usedAt: now,
    });

    consume.mockRejectedValueOnce(new InvitationIdempotencyConflictError());
    await expect(invitations.consumeForRegistration(input)).rejects.toBeInstanceOf(
      InvitationIdempotencyConflictError,
    );
  });
});
