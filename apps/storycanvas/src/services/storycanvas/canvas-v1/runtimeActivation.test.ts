import assert from 'node:assert/strict';
import { test } from 'node:test';
import knex, { type Knex } from 'knex';

import type { CanvasCommandV01 } from '@/contracts/canvas-v1';
import type { CanvasProductionScope } from '../assets-v1';
import {
  ControlCanvasApprovalClient,
  type CanvasApprovalFetch,
} from './controlApprovalClient';
import {
  CanvasV1ShotProductionAdapter,
  type CanvasV1ShotProvider,
} from './shotProductionAdapter';

const scope: CanvasProductionScope = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  packageId: '33333333-3333-4333-8333-333333333333',
  canvasSessionId: 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678',
  actorId: '12121212-1212-4212-8212-121212121212',
  localProjectId: 42,
};
const approvalId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const commandId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const shotId = '66666666-6666-4666-8666-666666666666';
const assetId = '88888888-8888-4888-8888-888888888888';

const approvedPackage = {
  tenantId: scope.tenantId,
  projectId: scope.projectId,
  packageId: scope.packageId,
  target: { aspectRatio: '9:16', durationSeconds: 30 },
  storyboard: [
    { shotId, sequence: 1, description: '门店入口', durationSeconds: 6, sourceMode: 'generated' },
  ],
};

function command(overrides: Partial<CanvasCommandV01> = {}): CanvasCommandV01 {
  return {
    objectType: 'CanvasCommand',
    contractVersion: '0.1',
    tenantId: scope.tenantId,
    projectId: scope.projectId,
    packageId: scope.packageId,
    canvasSessionId: scope.canvasSessionId,
    commandId,
    commandType: 'GENERATE_SHOT',
    requestedByActorId: scope.actorId,
    requestSource: 'user',
    approvalId,
    payload: {
      shotId,
      readinessId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      prompt: '门店入口讲解招牌套餐',
      referenceAssetIds: [assetId],
    },
    requestId: 'req-runtime-activation',
    occurredAt: '2026-08-14T02:00:00.000Z',
    ...overrides,
  };
}

async function database(): Promise<Knex> {
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  });
  await db.schema.createTable('sc_tasks', (table) => {
    table.string('id', 36).primary();
    table.integer('projectId').notNullable();
    table.string('taskType', 64).notNullable();
    table.string('provider', 100).notNullable();
    table.string('status', 32).notNullable();
    table.float('progress').notNullable();
    table.text('inputJson').notNullable();
    table.text('outputJson');
    table.text('errorJson');
    table.string('idempotencyKey', 300).notNullable().unique();
    table.string('externalTaskId', 300);
    table.text('createdAt').notNullable();
    table.text('updatedAt').notNullable();
  });
  return db;
}

test('approval client sends exact server-only scope/action and accepts only strict consumption facts', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const fetchImpl: CanvasApprovalFetch = async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(JSON.stringify({ approvalId, status: 'consumed', replayed: false }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const client = new ControlCanvasApprovalClient({
    controlApiBaseUrl: 'https://control.example.test',
    internalToken: 't'.repeat(48),
    fetch: fetchImpl,
  });
  assert.equal(await client.consume(command(), scope), true);
  assert.equal(capturedUrl, 'https://control.example.test/api/v1/internal/canvas-command-approvals/consume');
  assert.equal(new Headers(capturedInit?.headers).get('x-production-plane-internal-token'), 't'.repeat(48));
  const sent = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
  assert.deepEqual(sent, {
    approvalId,
    tenantId: scope.tenantId,
    projectId: scope.projectId,
    packageId: scope.packageId,
    canvasSessionId: scope.canvasSessionId,
    actorId: scope.actorId,
    commandType: 'GENERATE_SHOT',
    action: command().payload,
    commandId,
  });
  assert.equal(JSON.stringify(await client.consume(command({ requestedByActorId: assetId }), scope)), 'false');
});

test('approval client fails closed on response drift, dependency errors and reflected provider data', async () => {
  for (const fetchImpl of [
    async () => new Response(JSON.stringify({ approvalId, status: 'active', replayed: false }), { status: 200 }),
    async () => new Response(JSON.stringify({ approvalId, status: 'consumed', replayed: false, providerRawBody: 'secret' }), { status: 200 }),
    async () => { throw new Error('Bearer secret asset://provider providerRawBody'); },
  ] satisfies CanvasApprovalFetch[]) {
    const client = new ControlCanvasApprovalClient({
      controlApiBaseUrl: 'https://control.example.test',
      internalToken: 't'.repeat(48),
      fetch: fetchImpl,
    });
    assert.equal(await client.consume(command(), scope), false);
  }
});

test('production adapter has zero side effects while readiness is false', async (context) => {
  const db = await database();
  context.after(() => db.destroy());
  let providerStarts = 0;
  const provider: CanvasV1ShotProvider = {
    start: async () => {
      providerStarts += 1;
      throw new Error('must not run');
    },
  };
  const adapter = new CanvasV1ShotProductionAdapter({
    database: db,
    readiness: () => false,
    resolveApprovedPackage: () => approvedPackage,
    provider,
  });
  await assert.rejects(
    () => adapter.start({
      scope,
      commandId,
      shotId,
      prompt: 'prompt',
      referenceAssetIds: [assetId],
      referenceAssetUris: ['asset://server-only'],
    }),
    (error: unknown) => (error as { code?: unknown }).code === 'CANVAS_CAPABILITY_UNAVAILABLE',
  );
  assert.equal(providerStarts, 0);
  assert.equal((await db('sc_tasks')).length, 0);
});

test('production adapter persists before provider submission and same-command replay never pays twice', async (context) => {
  const db = await database();
  context.after(() => db.destroy());
  let providerStarts = 0;
  let releaseProvider!: () => void;
  const providerDone = new Promise<void>((resolve) => { releaseProvider = resolve; });
  const provider: CanvasV1ShotProvider = {
    start: async (providerInput, hooks) => {
      providerStarts += 1;
      assert.equal(providerInput.ratio, '9:16');
      assert.equal(providerInput.duration, 6);
      assert.equal(providerInput.resolution, '720p');
      assert.equal((await db('sc_tasks').where({ idempotencyKey: `canvas-v1:${commandId}` })).length, 1);
      await hooks.onTaskCreated('provider-task-server-only');
      await providerDone;
      return { externalTaskId: 'provider-task-server-only', videoUrl: 'https://provider.invalid/signed?secret=1' };
    },
  };
  const adapter = new CanvasV1ShotProductionAdapter({
    database: db,
    readiness: () => true,
    resolveApprovedPackage: () => approvedPackage,
    provider,
    persistOutput: async () => ({ outputAssetId: '19191919-1919-4919-8919-191919191919' }),
    newId: () => '18181818-1818-4818-8818-181818181818',
    now: () => new Date('2026-08-14T02:00:00.000Z'),
  });
  const input = {
    scope,
    commandId,
    shotId,
    prompt: 'prompt',
    referenceAssetIds: [assetId],
    referenceAssetUris: ['asset://server-only'],
  };
  const first = await adapter.start(input);
  const replay = await adapter.start(input);
  assert.deepEqual(replay, first);
  assert.equal(providerStarts, 1);
  const row = await db('sc_tasks').first();
  assert.equal(row.id, first.taskId);
  assert.equal(row.externalTaskId, 'provider-task-server-only');
  assert.doesNotMatch(String(row.inputJson), /asset:\/\/|provider-task|signed\?|secret/iu);
  releaseProvider();
});

test('provider failure persists only a fixed safe error and remains non-repeatable', async (context) => {
  const db = await database();
  context.after(() => db.destroy());
  let providerStarts = 0;
  const provider: CanvasV1ShotProvider = {
    start: async (_input, hooks) => {
      providerStarts += 1;
      await hooks.onTaskCreated('provider-task-server-only');
      throw new Error('Bearer paid-secret asset://identity providerRawBody signed?credential=x');
    },
  };
  const adapter = new CanvasV1ShotProductionAdapter({
    database: db,
    readiness: () => true,
    resolveApprovedPackage: () => approvedPackage,
    provider,
    newId: () => '18181818-1818-4818-8818-181818181818',
  });
  const input = {
    scope,
    commandId,
    shotId,
    prompt: 'prompt',
    referenceAssetIds: [assetId],
    referenceAssetUris: ['asset://server-only'],
  };
  await adapter.start(input);
  await new Promise((resolve) => setTimeout(resolve, 20));
  await adapter.start(input);
  assert.equal(providerStarts, 1);
  const serialized = JSON.stringify(await db('sc_tasks'));
  assert.doesNotMatch(serialized, /paid-secret|asset:\/\/|providerRawBody|credential=x/iu);
  assert.match(serialized, /CANVAS_PROVIDER_FAILED/u);
});

test('production adapter rejects a shot absent from the approved Package before persistence', async (context) => {
  const db = await database();
  context.after(() => db.destroy());
  let providerStarts = 0;
  const adapter = new CanvasV1ShotProductionAdapter({
    database: db,
    readiness: () => true,
    resolveApprovedPackage: () => approvedPackage,
    provider: {
      start: async () => {
        providerStarts += 1;
        throw new Error('must not run');
      },
    },
  });
  await assert.rejects(
    () => adapter.start({
      scope,
      commandId,
      shotId: '99999999-9999-4999-8999-999999999999',
      prompt: 'prompt',
      referenceAssetIds: [assetId],
      referenceAssetUris: ['asset://server-only'],
    }),
    (error: unknown) => (error as { code?: unknown }).code === 'CANVAS_SHOT_NOT_READY',
  );
  assert.equal(providerStarts, 0);
  assert.equal((await db('sc_tasks')).length, 0);
});
