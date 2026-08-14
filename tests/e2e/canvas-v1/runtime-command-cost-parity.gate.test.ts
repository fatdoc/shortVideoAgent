import knex from 'knex';
import { expect, test } from 'vitest';

import {
  parseCanvasV1Contract,
  type CanvasCommandV01,
} from '../../../apps/storycanvas/src/contracts/canvas-v1';
import migration from '../../../apps/storycanvas/migrations/005_canvas_v1_asset_command';
import { CanvasCommandService } from '../../../apps/storycanvas/src/services/storycanvas/canvas-v1/canvasCommandService';

const scope = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  packageId: '33333333-3333-4333-8333-333333333333',
  canvasSessionId: 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678',
  actorId: '12121212-1212-4212-8212-121212121212',
  localProjectId: 42,
} as const;
const occurredAt = '2026-08-14T02:00:00.000Z';
const assetId = '88888888-8888-4888-8888-888888888888';

function command(
  commandType: CanvasCommandV01['commandType'],
  payload: CanvasCommandV01['payload'],
  approvalId: string | null,
): CanvasCommandV01 {
  return {
    objectType: 'CanvasCommand',
    contractVersion: '0.1',
    tenantId: scope.tenantId,
    projectId: scope.projectId,
    packageId: scope.packageId,
    canvasSessionId: scope.canvasSessionId,
    commandId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    commandType,
    requestedByActorId: scope.actorId,
    requestSource: 'user',
    approvalId,
    payload,
    requestId: `req-${commandType.toLowerCase()}`,
    occurredAt,
  } as CanvasCommandV01;
}

test('SYNC is low-cost: approvalId=null reaches its adapter without approval consumption', async (context) => {
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  });
  context.onTestFinished(() => db.destroy());
  await migration.up(db);
  let approvals = 0;
  let syncs = 0;
  const service = new CanvasCommandService({
    database: db,
    resolveScope: async () => scope,
    validateApproval: async () => {
      approvals += 1;
      return false;
    },
    getReadiness: async () => null,
    resolveProviderAssetUris: async () => [],
    startShotProduction: async () => {
      throw new Error('must not run');
    },
    syncProviderAsset: async (value, valueScope) => {
      syncs += 1;
      expect(value).toBe(assetId);
      expect(valueScope).toEqual(scope);
      return {
        objectType: 'ProviderAssetBinding',
        contractVersion: '0.1',
        tenantId: scope.tenantId,
        projectId: scope.projectId,
        packageId: scope.packageId,
        canvasSessionId: scope.canvasSessionId,
        bindingId: '99999999-9999-4999-8999-999999999999',
        assetId,
        provider: 'byteplus',
        providerStatus: 'active',
        providerAssetId: 'provider-asset-server-only',
        providerGroupId: 'provider-group-server-only',
        assetUri: 'asset://provider-asset-server-only',
        registeredAt: occurredAt,
        updatedAt: occurredAt,
        occurredAt,
      };
    },
    now: () => new Date(occurredAt),
    randomId: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  });
  const value = command('SYNC_PROVIDER_ASSET', { assetId }, null);
  expect(parseCanvasV1Contract(value).objectType).toBe('CanvasCommand');
  await expect(service.execute(value)).resolves.toMatchObject({ status: 'accepted' });
  expect(approvals).toBe(0);
  expect(syncs).toBe(1);
});

test.each([
  ['CREATE_VIRTUAL_CHARACTER', {
    assetId,
    entityId: '16161616-1616-4616-8616-161616161616',
    prompt: 'safe',
  }],
  ['BIND_ASSET_TO_ENTITY', { assetId, entityId: '16161616-1616-4616-8616-161616161616' }],
  ['GENERATE_SHOT', {
    shotId: '66666666-6666-4666-8666-666666666666',
    readinessId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    prompt: 'safe',
    referenceAssetIds: [assetId],
  }],
  ['SELECT_SHOT_OUTPUT', {
    documentId: '77777777-7777-4777-8777-777777777777',
    shotId: '66666666-6666-4666-8666-666666666666',
    outputAssetId: '99999999-9999-4999-8999-999999999999',
    expectedVersion: 1,
  }],
  ['EXPORT_PLAYLIST', {
    documentId: '77777777-7777-4777-8777-777777777777',
    expectedVersion: 1,
  }],
] as const)('%s remains approval-gated when approvalId is null', (commandType, payload) => {
  expect(() => parseCanvasV1Contract(command(commandType, payload, null))).toThrowError(
    expect.objectContaining({ code: 'CANVAS_APPROVAL_REQUIRED' }),
  );
});
