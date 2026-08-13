import {
  CommercialChannelPermissionDeniedError,
  CommercialChannelScopeNotFoundError,
} from './errors.js';
import type {
  CommercialChannelActor,
  CommercialChannelReference,
  CommercialChannelStore,
} from './types.js';

function boundedLimit(limit: number): number {
  return Math.max(1, Math.min(100, Math.trunc(limit)));
}

export class CommercialChannelService {
  constructor(private readonly store: CommercialChannelStore) {}

  async readCurrentChannel(actor: CommercialChannelActor): Promise<CommercialChannelReference> {
    if (actor.organizationType !== 'CHANNEL') throw new CommercialChannelScopeNotFoundError();

    const channel = await this.store.findCurrentChannelByOrganizationId(actor.organizationId);
    if (!channel || channel.organizationId !== actor.organizationId) {
      throw new CommercialChannelScopeNotFoundError();
    }
    if (!actor.roles.includes('channel_admin')) {
      throw new CommercialChannelPermissionDeniedError();
    }
    return channel;
  }

  async listActiveChannels(
    actor: CommercialChannelActor,
    limit: number,
  ): Promise<CommercialChannelReference[]> {
    if (actor.organizationType !== 'PLATFORM') throw new CommercialChannelScopeNotFoundError();
    if (!actor.roles.includes('platform_admin')) {
      throw new CommercialChannelPermissionDeniedError();
    }
    return this.store.listActiveChannels(boundedLimit(limit));
  }
}
