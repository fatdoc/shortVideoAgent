import { describe, expect, it, vi } from 'vitest';
import {
  CommercialChannelPermissionDeniedError,
  CommercialChannelScopeNotFoundError,
} from './errors.js';
import { CommercialChannelService } from './service.js';
import type { CommercialChannelActor, CommercialChannelStore } from './types.js';

const platformOrganizationId = 'a0000000-0000-4000-8000-000000000001';
const channelOrganizationId = 'a0000000-0000-4000-8000-000000000002';
const tenantOrganizationId = 'a0000000-0000-4000-8000-000000000003';
const channelId = 'b0000000-0000-4000-8000-000000000001';
const channel = {
  channelId,
  organizationId: channelOrganizationId,
  displayName: 'Canonical Channel',
  organizationStatus: 'active' as const,
};

function actor(
  organizationType: CommercialChannelActor['organizationType'],
  roles: CommercialChannelActor['roles'],
  organizationId = platformOrganizationId,
): CommercialChannelActor {
  return {
    userId: 'c0000000-0000-4000-8000-000000000001',
    membershipId: 'd0000000-0000-4000-8000-000000000001',
    organizationId,
    organizationType,
    roles,
  };
}

function stores() {
  return {
    findCurrentChannelByOrganizationId:
      vi.fn<CommercialChannelStore['findCurrentChannelByOrganizationId']>(),
    listActiveChannels: vi.fn<CommercialChannelStore['listActiveChannels']>(),
  };
}

describe('CommercialChannelService', () => {
  it('returns the canonical active Channel reference for a Channel Admin', async () => {
    const store = stores();
    store.findCurrentChannelByOrganizationId.mockResolvedValue(channel);
    const service = new CommercialChannelService(store);

    await expect(
      service.readCurrentChannel(actor('CHANNEL', ['channel_admin'], channelOrganizationId)),
    ).resolves.toEqual(channel);
    expect(store.findCurrentChannelByOrganizationId).toHaveBeenCalledWith(channelOrganizationId);
  });

  it('hides Current Channel from Platform and Tenant scopes without querying the store', async () => {
    const store = stores();
    const service = new CommercialChannelService(store);

    for (const scopedActor of [
      actor('PLATFORM', ['platform_admin']),
      actor('TENANT', ['tenant_admin'], tenantOrganizationId),
    ]) {
      await expect(service.readCurrentChannel(scopedActor)).rejects.toBeInstanceOf(
        CommercialChannelScopeNotFoundError,
      );
    }
    expect(store.findCurrentChannelByOrganizationId).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing or inconsistent canonical mapping before role checks', async () => {
    const store = stores();
    const service = new CommercialChannelService(store);
    const channelMember = actor('CHANNEL', ['content_operator'], channelOrganizationId);

    store.findCurrentChannelByOrganizationId.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...channel,
      organizationId: 'a0000000-0000-4000-8000-000000000099',
    });

    await expect(service.readCurrentChannel(channelMember)).rejects.toBeInstanceOf(
      CommercialChannelScopeNotFoundError,
    );
    await expect(service.readCurrentChannel(channelMember)).rejects.toBeInstanceOf(
      CommercialChannelScopeNotFoundError,
    );
  });

  it('returns 403 when the canonical Channel exists but channel_admin is absent', async () => {
    const store = stores();
    store.findCurrentChannelByOrganizationId.mockResolvedValue(channel);
    const service = new CommercialChannelService(store);

    await expect(
      service.readCurrentChannel(actor('CHANNEL', ['content_operator'], channelOrganizationId)),
    ).rejects.toBeInstanceOf(CommercialChannelPermissionDeniedError);
  });

  it('allows only a Platform Admin to list the active Channel Directory and bounds the limit', async () => {
    const store = stores();
    store.listActiveChannels.mockResolvedValue([channel]);
    const service = new CommercialChannelService(store);

    await expect(
      service.listActiveChannels(actor('PLATFORM', ['platform_admin']), 1000),
    ).resolves.toEqual([channel]);
    expect(store.listActiveChannels).toHaveBeenCalledWith(100);
  });

  it('returns 404 for non-Platform directory probes and 403 for a Platform without platform_admin', async () => {
    const store = stores();
    const service = new CommercialChannelService(store);

    await expect(
      service.listActiveChannels(actor('CHANNEL', ['channel_admin'], channelOrganizationId), 50),
    ).rejects.toBeInstanceOf(CommercialChannelScopeNotFoundError);
    await expect(
      service.listActiveChannels(actor('PLATFORM', ['pilot_support']), 50),
    ).rejects.toBeInstanceOf(CommercialChannelPermissionDeniedError);
    expect(store.listActiveChannels).not.toHaveBeenCalled();
  });
});
