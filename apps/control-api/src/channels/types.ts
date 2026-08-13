import type { OrganizationType, RoleCode } from '../auth/types.js';

export type CommercialChannelReference = {
  channelId: string;
  organizationId: string;
  displayName: string;
  organizationStatus: 'active';
};

export type CommercialChannelActor = {
  userId: string;
  membershipId: string;
  organizationId: string;
  organizationType: OrganizationType;
  roles: readonly RoleCode[];
};

export interface CommercialChannelStore {
  findCurrentChannelByOrganizationId(
    organizationId: string,
  ): Promise<CommercialChannelReference | null>;
  listActiveChannels(limit: number): Promise<CommercialChannelReference[]>;
}
