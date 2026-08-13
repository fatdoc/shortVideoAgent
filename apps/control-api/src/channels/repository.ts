import type { Knex } from 'knex';
import type { CommercialChannelReference, CommercialChannelStore } from './types.js';

type CommercialChannelRow = {
  channel_id: string;
  organization_id: string;
  display_name: string;
  organization_status: 'active';
};

function boundedLimit(limit: number): number {
  return Math.max(1, Math.min(100, Math.trunc(limit)));
}

function channelFromRow(row: CommercialChannelRow): CommercialChannelReference {
  return {
    channelId: row.channel_id,
    organizationId: row.organization_id,
    displayName: row.display_name,
    organizationStatus: row.organization_status,
  };
}

export class PostgresCommercialChannelRepository implements CommercialChannelStore {
  constructor(private readonly database: Knex) {}

  async findCurrentChannelByOrganizationId(
    organizationId: string,
  ): Promise<CommercialChannelReference | null> {
    const row = (await this.database({ channel: 'control_plane.channels' })
      .join(
        { organization: 'control_plane.organizations' },
        'organization.organization_id',
        'channel.organization_id',
      )
      .select(
        'channel.channel_id',
        'organization.organization_id',
        'organization.display_name',
        this.database.raw('organization.status as organization_status'),
      )
      .where('channel.organization_id', organizationId)
      .andWhere('organization.organization_type', 'CHANNEL')
      .andWhere('organization.status', 'active')
      .first()) as CommercialChannelRow | undefined;

    return row ? channelFromRow(row) : null;
  }

  async listActiveChannels(limit: number): Promise<CommercialChannelReference[]> {
    const rows = (await this.database({ channel: 'control_plane.channels' })
      .join(
        { organization: 'control_plane.organizations' },
        'organization.organization_id',
        'channel.organization_id',
      )
      .select(
        'channel.channel_id',
        'organization.organization_id',
        'organization.display_name',
        this.database.raw('organization.status as organization_status'),
      )
      .where('organization.organization_type', 'CHANNEL')
      .andWhere('organization.status', 'active')
      .orderBy('organization.display_name', 'asc')
      .orderBy('channel.channel_id', 'asc')
      .limit(boundedLimit(limit))) as CommercialChannelRow[];

    return rows.map(channelFromRow);
  }
}
