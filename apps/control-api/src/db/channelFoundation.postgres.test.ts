import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from './migrations/001_pilot_core.js';
import { up as addOrganizationFoundation } from './migrations/006_organization_foundation.js';
import {
  down as removeChannelFoundation,
  up as addChannelFoundation,
} from './migrations/007_channel_foundation.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);
const tenantId = '10000000-0000-4000-8000-000000000001';
const platformOrganizationId = '20000000-0000-4000-8000-000000000001';
const channelOrganizationId = '30000000-0000-4000-8000-000000000001';
const channelId = '30000000-0000-4000-8000-000000000002';

async function expectChannelFoundationPresent(database: Knex) {
  const result = await database.raw<{ rows: Array<{ channels: string | null }> }>(
    `select to_regclass('control_plane.channels')::text as channels`,
  );
  expect(result.rows[0]).toEqual({ channels: 'control_plane.channels' });
}

async function insertOrganization(
  database: Knex,
  organizationId: string,
  organizationType: 'PLATFORM' | 'CHANNEL' | 'TENANT',
  parentOrganizationId: string | null = null,
) {
  await database('control_plane.organizations').insert({
    organization_id: organizationId,
    organization_type: organizationType,
    display_name: `${organizationType} ${organizationId.slice(-4)}`,
    status: 'active',
    parent_organization_id: parentOrganizationId,
  });
}

describe.runIf(hasDedicatedTestDatabase)('A-BIZ-01.1 channel foundation migration', () => {
  let database: Knex;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await database.raw('drop schema if exists control_plane cascade');
    await createPilotCore(database);
    await database('control_plane.tenants').insert({
      tenant_id: tenantId,
      display_name: 'Tenant A',
      status: 'active',
    });
    await addOrganizationFoundation(database);
  });

  afterAll(async () => {
    await database?.raw('drop schema if exists control_plane cascade');
    await database?.destroy();
  });

  it('creates a minimal one-to-one extension for CHANNEL organizations', async () => {
    await addChannelFoundation(database);
    await expectChannelFoundationPresent(database);
    await insertOrganization(database, channelOrganizationId, 'CHANNEL');

    await database('control_plane.channels').insert({
      channel_id: channelId,
      organization_id: channelOrganizationId,
    });

    expect(
      await database('control_plane.channels')
        .select('channel_id', 'organization_id')
        .where({ channel_id: channelId })
        .first(),
    ).toEqual({ channel_id: channelId, organization_id: channelOrganizationId });
  });

  it('enforces the organization foreign key, CHANNEL type and one-to-one mapping in both directions', async () => {
    await addChannelFoundation(database);
    await expectChannelFoundationPresent(database);
    await insertOrganization(database, platformOrganizationId, 'PLATFORM');
    await insertOrganization(database, channelOrganizationId, 'CHANNEL', platformOrganizationId);

    await database('control_plane.channels').insert({
      channel_id: channelId,
      organization_id: channelOrganizationId,
    });

    await expect(
      database('control_plane.channels').insert({
        channel_id: '30000000-0000-4000-8000-000000000003',
        organization_id: channelOrganizationId,
      }),
    ).rejects.toThrow();

    await expect(
      database('control_plane.channels').insert({
        channel_id: '30000000-0000-4000-8000-000000000004',
        organization_id: platformOrganizationId,
      }),
    ).rejects.toThrow(/CHANNEL organization/);

    await expect(
      database('control_plane.channels').insert({
        channel_id: '30000000-0000-4000-8000-000000000005',
        organization_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      }),
    ).rejects.toThrow(/CHANNEL organization/);

    await expect(
      database('control_plane.organizations')
        .where({ organization_id: channelOrganizationId })
        .update({ organization_type: 'TENANT' }),
    ).rejects.toThrow(/must remain CHANNEL/);
  });

  it('does not encode fixed proxy tiers, depth, price or commission fields', async () => {
    await addChannelFoundation(database);
    await expectChannelFoundationPresent(database);

    const columns = await database('information_schema.columns')
      .select('column_name')
      .where({ table_schema: 'control_plane', table_name: 'channels' })
      .orderBy('ordinal_position');
    expect(columns).toEqual([
      { column_name: 'channel_id' },
      { column_name: 'organization_id' },
      { column_name: 'created_at' },
      { column_name: 'updated_at' },
    ]);

    await insertOrganization(database, platformOrganizationId, 'PLATFORM');
    const channelOrganizations = [
      '30000000-0000-4000-8000-000000000010',
      '30000000-0000-4000-8000-000000000011',
      '30000000-0000-4000-8000-000000000012',
      '30000000-0000-4000-8000-000000000013',
    ];
    let parentOrganizationId = platformOrganizationId;
    for (const organizationId of channelOrganizations) {
      await insertOrganization(database, organizationId, 'CHANNEL', parentOrganizationId);
      parentOrganizationId = organizationId;
    }

    await database('control_plane.channels').insert(
      channelOrganizations.map((organizationId, index) => ({
        channel_id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        organization_id: organizationId,
      })),
    );

    expect(await database('control_plane.channels').count('* as count').first()).toEqual({
      count: '4',
    });
  });

  it('rolls back only the Channel extension and preserves organizations and tenants', async () => {
    await addChannelFoundation(database);
    await expectChannelFoundationPresent(database);
    await insertOrganization(database, channelOrganizationId, 'CHANNEL');
    await database('control_plane.channels').insert({
      channel_id: channelId,
      organization_id: channelOrganizationId,
    });

    await removeChannelFoundation(database);

    const channelTable = await database('information_schema.tables')
      .select('table_name')
      .where({ table_schema: 'control_plane', table_name: 'channels' })
      .first();
    expect(channelTable).toBeUndefined();
    expect(
      await database('control_plane.organizations')
        .select('organization_id', 'organization_type')
        .where({ organization_id: channelOrganizationId })
        .first(),
    ).toEqual({
      organization_id: channelOrganizationId,
      organization_type: 'CHANNEL',
    });
    expect(
      await database('control_plane.tenants')
        .select('tenant_id')
        .where({ tenant_id: tenantId })
        .first(),
    ).toEqual({ tenant_id: tenantId });
  });
});
