import { describe, expect, it, vi } from 'vitest';
import { MemberPermissionDeniedError } from './errors.js';
import { MemberDirectoryService } from './service.js';
import type { MemberDirectoryActor, MemberDirectoryStore, MemberProjection } from './types.js';

const actorMembershipId = '10000000-0000-4000-8000-000000000001';
const organizationId = '20000000-0000-4000-8000-000000000001';
const targetMembershipId = '30000000-0000-4000-8000-000000000001';

const member: MemberProjection = {
  membershipId: targetMembershipId,
  displayName: 'Pilot Member',
  email: 'member@example.com',
  status: 'active',
  primaryRole: 'content_operator',
  roles: ['content_operator'],
  version: 2,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-08T00:00:00.000Z',
  isCurrentActor: false,
};

function actor(
  organizationType: MemberDirectoryActor['organizationType'],
  roles: MemberDirectoryActor['roles'],
): MemberDirectoryActor {
  return {
    userId: '40000000-0000-4000-8000-000000000001',
    membershipId: actorMembershipId,
    organizationId,
    organizationType,
    roles,
  };
}

function stores() {
  return {
    listCurrentOrganizationMembers: vi.fn<MemberDirectoryStore['listCurrentOrganizationMembers']>(),
    suspendCurrentOrganizationMember:
      vi.fn<MemberDirectoryStore['suspendCurrentOrganizationMember']>(),
  };
}

describe('MemberDirectoryService', () => {
  it.each([
    ['PLATFORM', ['platform_admin']],
    ['CHANNEL', ['channel_admin']],
    ['TENANT', ['tenant_admin']],
  ] as const)(
    'allows the canonical %s administrator to list current Organization members',
    async (organizationType, roles) => {
      const store = stores();
      store.listCurrentOrganizationMembers.mockResolvedValue([member]);
      const service = new MemberDirectoryService(store);

      await expect(
        service.listCurrentOrganizationMembers(actor(organizationType, roles), {
          status: 'all',
          limit: 25,
        }),
      ).resolves.toEqual([member]);
      expect(store.listCurrentOrganizationMembers).toHaveBeenCalledWith({
        organizationId,
        actorMembershipId,
        status: 'all',
        limit: 25,
      });
    },
  );

  it.each([
    ['PLATFORM', ['pilot_support']],
    ['TENANT', ['content_operator']],
  ] as const)(
    'rejects non-admin %s roles before querying the directory',
    async (organizationType, roles) => {
      const store = stores();
      const service = new MemberDirectoryService(store);

      await expect(
        service.listCurrentOrganizationMembers(actor(organizationType, roles), {
          status: 'all',
          limit: 100,
        }),
      ).rejects.toBeInstanceOf(MemberPermissionDeniedError);
      expect(store.listCurrentOrganizationMembers).not.toHaveBeenCalled();
    },
  );

  it('passes only the actor canonical Scope and administrator role to suspend', async () => {
    const store = stores();
    store.suspendCurrentOrganizationMember.mockResolvedValue({
      member: { ...member, status: 'suspended', version: 3 },
      replayed: false,
    });
    const service = new MemberDirectoryService(store);

    await expect(
      service.suspendCurrentOrganizationMember(
        actor('TENANT', ['tenant_admin']),
        targetMembershipId,
        2,
      ),
    ).resolves.toEqual({
      member: { ...member, status: 'suspended', version: 3 },
      replayed: false,
    });
    expect(store.suspendCurrentOrganizationMember).toHaveBeenCalledWith({
      organizationId,
      actorMembershipId,
      targetMembershipId,
      expectedVersion: 2,
      administratorRole: 'tenant_admin',
    });
  });

  it('does not fabricate a replay or Membership projection in the Service', async () => {
    const store = stores();
    const repositoryResult = {
      member: { ...member, status: 'suspended' as const, version: 9 },
      replayed: true,
    };
    store.suspendCurrentOrganizationMember.mockResolvedValue(repositoryResult);
    const service = new MemberDirectoryService(store);

    await expect(
      service.suspendCurrentOrganizationMember(
        actor('CHANNEL', ['channel_admin']),
        targetMembershipId,
        1,
      ),
    ).resolves.toBe(repositoryResult);
  });
});
