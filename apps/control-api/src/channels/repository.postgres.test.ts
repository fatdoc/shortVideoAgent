import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from '../db/migrations/001_pilot_core.js';
import { up as addOrganizationFoundation } from '../db/migrations/006_organization_foundation.js';
import { up as addChannelFoundation } from '../db/migrations/007_channel_foundation.js';
import { PostgresCommercialChannelRepository } from './repository.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const tenantId = '10000000-0000-4000-8000-000000000001';
const platformOrganizationId = '20000000-0000-4000-8000-000000000001';
const alphaOrganizationId = '30000000-0000-4000-8000-000000000001';
const betaOrganizationId = '30000000-0000-4000-8000-000000000002';
const suspendedOrganizationId = '30000000-0000-4000-8000-000000000003';
const alphaChannelId = '40000000-0000-4000-8000-000000000002';
const betaChannelId = '40000000-0000-4000-8000-000000000001';
const suspendedChannelId = '40000000-0000-4000-8000-000000000003';

async function resetFoundation(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);
  await database('control_plane.tenants').insert({
    tenant_id: tenantId,
    display_name: 'Commercial Channel Tenant',
    status: 'active',
  });
  await addOrganizationFoundation(database);
  await addChannelFoundation(database);
  await database('control_plane.organizations').insert([
    {
      organization_id: platformOrganizationId,
      organization_type: 'PLATFORM',
      display_name: 'Commercial Platform',
      status: 'active',
    },
    {
      organization_id: alphaOrganizationId,
      organization_type: 'CHANNEL',
      display_name: 'Alpha Channel',
      status: 'active',
      parent_organization_id: platformOrganizationId,
    },
    {
      organization_id: betaOrganizationId,
      organization_type: 'CHANNEL',
      display_name: 'Alpha Channel',
      status: 'active',
      parent_organization_id: platformOrganizationId,
    },
    {
      organization_id: suspendedOrganizationId,
      organization_type: 'CHANNEL',
      display_name: 'Suspended Channel',
      status: 'suspended',
      parent_organization_id: platformOrganizationId,
    },
  ]);
  await database('control_plane.channels').insert([
    { channel_id: alphaChannelId, organization_id: alphaOrganizationId },
    { channel_id: betaChannelId, organization_id: betaOrganizationId },
    { channel_id: suspendedChannelId, organization_id: suspendedOrganizationId },
  ]);
}

describe.runIf(hasDedicatedTestDatabase)('PostgresCommercialChannelRepository', () => {
  let database: Knex;
  let repository: PostgresCommercialChannelRepository;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await resetFoundation(database);
    repository = new PostgresCommercialChannelRepository(database);
  });

  afterAll(async () => {
    if (!database) return;
    await database.raw('drop schema if exists control_plane cascade');
    await database.destroy();
  });

  it('resolves the canonical Channel only through an active CHANNEL Organization', async () => {
    await expect(
      repository.findCurrentChannelByOrganizationId(alphaOrganizationId),
    ).resolves.toEqual({
      channelId: alphaChannelId,
      organizationId: alphaOrganizationId,
      displayName: 'Alpha Channel',
      organizationStatus: 'active',
    });
    await expect(
      repository.findCurrentChannelByOrganizationId(suspendedOrganizationId),
    ).resolves.toBeNull();
    await expect(
      repository.findCurrentChannelByOrganizationId(platformOrganizationId),
    ).resolves.toBeNull();
  });

  it('lists only active CHANNEL Organizations in stable displayName and channelId order', async () => {
    await expect(repository.listActiveChannels(100)).resolves.toEqual([
      {
        channelId: betaChannelId,
        organizationId: betaOrganizationId,
        displayName: 'Alpha Channel',
        organizationStatus: 'active',
      },
      {
        channelId: alphaChannelId,
        organizationId: alphaOrganizationId,
        displayName: 'Alpha Channel',
        organizationStatus: 'active',
      },
    ]);
  });

  it('clamps the directory limit again at the Repository boundary', async () => {
    await expect(repository.listActiveChannels(1_000)).resolves.toHaveLength(2);
    await expect(repository.listActiveChannels(1)).resolves.toHaveLength(1);
  });
});
