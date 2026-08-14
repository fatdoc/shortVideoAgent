import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CanvasCommandV01 } from '@/contracts/canvas-v1';
import type { PilotCanvasServerAuthority } from '../pilotCanvasCapability';
import type { CanvasProductionScope } from '../assets-v1';
import { createCanvasV1ApprovalValidator } from './runtimeApprovalValidator';

const scope: CanvasProductionScope = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  packageId: '33333333-3333-4333-8333-333333333333',
  canvasSessionId: 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678',
  actorId: '12121212-1212-4212-8212-121212121212',
  localProjectId: 42,
};
const shotId = '66666666-6666-4666-8666-666666666666';

function command(commandType: CanvasCommandV01['commandType'], payload: CanvasCommandV01['payload']): CanvasCommandV01 {
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
    approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    payload,
    requestId: `req-${commandType.toLowerCase()}`,
    occurredAt: '2026-08-14T02:00:00.000Z',
  } as CanvasCommandV01;
}

const commands = [
  command('CREATE_VIRTUAL_CHARACTER', { assetId: '88888888-8888-4888-8888-888888888888', entityId: 'host', prompt: '门店讲解员' }),
  command('BIND_ASSET_TO_ENTITY', { assetId: '88888888-8888-4888-8888-888888888888', entityId: 'host' }),
  command('GENERATE_SHOT', { shotId, readinessId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', prompt: '门店入口', referenceAssetIds: [] }),
  command('SELECT_SHOT_OUTPUT', { documentId: '77777777-7777-4777-8777-777777777777', shotId, outputAssetId: '99999999-9999-4999-8999-999999999999', expectedVersion: 1 }),
  command('EXPORT_PLAYLIST', { documentId: '77777777-7777-4777-8777-777777777777', expectedVersion: 1 }),
] as const;

function authority(): PilotCanvasServerAuthority {
  return {
    actorId: scope.actorId,
    expiresAt: '2099-08-14T02:00:00.000Z',
    redemption: {
      tenantId: scope.tenantId,
      projectId: scope.projectId,
      packageId: scope.packageId,
      productionPackage: {
        status: 'ready',
        contractVersion: '0.3',
        target: { aspectRatio: '9:16' },
        capabilityRequirements: ['video.generate'],
        storyboard: [{ shotId }],
      },
    },
  } as PilotCanvasServerAuthority;
}

test('all five high-cost commands reach Control with their exact immutable action', async () => {
  const consumed: Array<{ command: CanvasCommandV01; scope: CanvasProductionScope }> = [];
  const validate = createCanvasV1ApprovalValidator({
    readAuthority: () => authority(),
    shotProductionConfigured: () => true,
    consume: async (value, valueScope) => {
      consumed.push({ command: value, scope: valueScope });
      return true;
    },
  });
  for (const value of commands) assert.equal(await validate(value, scope), true);
  assert.deepEqual(consumed.map(({ command: value }) => ({
    commandType: value.commandType,
    action: { commandId: value.commandId, payload: value.payload },
  })), commands.map((value) => ({
    commandType: value.commandType,
    action: { commandId: value.commandId, payload: value.payload },
  })));
});

test('only GENERATE_SHOT depends on provider configuration and Package shot capability', async () => {
  const consumed: string[] = [];
  const validate = createCanvasV1ApprovalValidator({
    readAuthority: () => authority(),
    shotProductionConfigured: () => false,
    consume: async (value) => { consumed.push(value.commandType); return true; },
  });
  for (const value of commands.filter((item) => item.commandType !== 'GENERATE_SHOT')) {
    assert.equal(await validate(value, scope), true);
  }
  assert.equal(await validate(commands[2], scope), false);
  assert.deepEqual(consumed, [
    'CREATE_VIRTUAL_CHARACTER',
    'BIND_ASSET_TO_ENTITY',
    'SELECT_SHOT_OUTPUT',
    'EXPORT_PLAYLIST',
  ]);
});
