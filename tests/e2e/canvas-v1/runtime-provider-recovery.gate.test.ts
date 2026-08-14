import knex, { type Knex } from 'knex';
import { expect, test } from 'vitest';

import type { CanvasProductionScope } from '../../../apps/storycanvas/src/services/storycanvas/assets-v1';
import {
  CanvasV1ShotProductionAdapter,
  isCanvasV1ShotProductionConfigured,
  type CanvasV1ApprovedPackage,
  type CanvasV1ShotProvider,
} from '../../../apps/storycanvas/src/services/storycanvas/canvas-v1/shotProductionAdapter';

const scope: CanvasProductionScope = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  packageId: '33333333-3333-4333-8333-333333333333',
  canvasSessionId: 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678',
  actorId: '12121212-1212-4212-8212-121212121212',
  localProjectId: 42,
};
const commandId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const shotId = '66666666-6666-4666-8666-666666666666';
const assetId = '88888888-8888-4888-8888-888888888888';
const taskId = '18181818-1818-4818-8818-181818181818';

const assert = {
  equal(actual: unknown, expected: unknown) {
    expect(actual).toBe(expected);
  },
  deepEqual(actual: unknown, expected: unknown) {
    expect(actual).toEqual(expected);
  },
  async rejects(action: () => Promise<unknown>, expected?: Record<string, unknown>) {
    if (expected) await expect(action()).rejects.toMatchObject(expected);
    else await expect(action()).rejects.toBeDefined();
  },
  doesNotMatch(value: string, pattern: RegExp) {
    expect(value).not.toMatch(pattern);
  },
  match(value: string, pattern: RegExp) {
    expect(value).toMatch(pattern);
  },
  fail(message: string): never {
    throw new Error(message);
  },
};

const approvedPackage = {
  contractVersion: '0.3',
  status: 'ready',
  tenantId: scope.tenantId,
  projectId: scope.projectId,
  packageId: scope.packageId,
  expiresAt: '2099-08-14T02:00:00.000Z',
  capabilityRequirements: ['video.generate'],
  target: { aspectRatio: '9:16', durationSeconds: 30 },
  storyboard: [
    { shotId, sequence: 1, description: '门店入口', durationSeconds: 6, sourceMode: 'generated' },
  ],
} as unknown as CanvasV1ApprovedPackage;

function input(overrides: Record<string, unknown> = {}) {
  return {
    scope,
    commandId,
    shotId,
    prompt: 'safe prompt',
    referenceAssetIds: [assetId],
    referenceAssetUris: ['asset://server-only'],
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

function adapter(db: Knex, provider: CanvasV1ShotProvider, overrides: Record<string, unknown> = {}) {
  return new CanvasV1ShotProductionAdapter({
    database: db,
    readiness: () => true,
    resolveApprovedPackage: () => approvedPackage,
    provider,
    persistOutput: async () => ({ outputAssetId: assetId }),
    newId: () => taskId,
    now: () => new Date('2026-08-14T02:00:00.000Z'),
    ...overrides,
  });
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 500): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(`condition did not settle within ${timeoutMs}ms`);
}

test('rights/readiness and Package authority fail before paid Provider submission', async (context) => {
  const db = await database();
  context.onTestFinished(() => db.destroy());
  let starts = 0;
  const production = adapter(db, {
    start: async () => {
      starts += 1;
      throw new Error('must not start');
    },
  }, { readiness: () => false });

  await assert.rejects(() => production.start(input()), { code: 'CANVAS_CAPABILITY_UNAVAILABLE' });
  assert.equal(starts, 0);
  assert.equal((await db('sc_tasks')).length, 0);

  const wrongPackage = adapter(db, {
    start: async () => {
      starts += 1;
      throw new Error('must not start');
    },
  }, { resolveApprovedPackage: () => ({ ...approvedPackage, packageId: assetId }) });
  await assert.rejects(() => wrongPackage.start(input()), { code: 'CANVAS_SCOPE_MISMATCH' });
  assert.equal(starts, 0);
});

test('same command response-loss recovery never starts the paid Provider twice', async (context) => {
  const db = await database();
  context.onTestFinished(() => db.destroy());
  let starts = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const production = adapter(db, {
    start: async (_providerInput, hooks) => {
      starts += 1;
      await hooks.onTaskCreated('provider-task-1');
      await pending;
      return { externalTaskId: 'provider-task-1', videoUrl: 'https://provider.invalid/signed?secret=1' };
    },
  });
  const first = await production.start(input());
  const replay = await production.start(input());
  assert.deepEqual(replay, first);
  assert.equal(starts, 1);
  release();
});

test('unknown queued recovery fails closed without a second paid submission', async (context) => {
  const db = await database();
  context.onTestFinished(() => db.destroy());
  await db('sc_tasks').insert({
    id: taskId,
    projectId: scope.localProjectId,
    taskType: 'canvas_v1_video_generation',
    provider: 'byteplus',
    status: 'queued',
    progress: 0,
    inputJson: '{}',
    outputJson: null,
    errorJson: null,
    idempotencyKey: `canvas-v1:${commandId}`,
    externalTaskId: null,
    createdAt: '2026-08-14T02:00:00.000Z',
    updatedAt: '2026-08-14T02:00:00.000Z',
  });
  let starts = 0;
  const production = adapter(db, {
    start: async () => {
      starts += 1;
      throw new Error('must not start');
    },
  });
  await assert.rejects(() => production.start(input()), { code: 'CANVAS_PROVIDER_FAILED' });
  assert.equal(starts, 0);
});

test('task-created is durable before adapter resolution and same hook id is idempotent', async (context) => {
  const db = await database();
  context.onTestFinished(() => db.destroy());
  const production = adapter(db, {
    start: async (_providerInput, hooks) => {
      await hooks.onTaskCreated('provider-task-1');
      await hooks.onTaskCreated('provider-task-1');
      return { externalTaskId: 'provider-task-1', videoUrl: 'https://provider.invalid/result' };
    },
  });
  await production.start(input());
  assert.equal((await db('sc_tasks').first()).externalTaskId, 'provider-task-1');
  await waitFor(async () => (await db('sc_tasks').first()).status === 'succeeded');
});

test('provider completion without onTaskCreated fails bounded and does not hang', async (context) => {
  const db = await database();
  context.onTestFinished(() => db.destroy());
  const production = adapter(db, {
    start: async () => ({
      externalTaskId: 'provider-task-without-hook',
      videoUrl: 'https://provider.invalid/result',
    }),
  });
  const result = await Promise.race([
    production.start(input()).then(() => 'resolved', (error: { code?: string }) => error.code),
    new Promise<string>((resolve) => setTimeout(() => resolve('hung'), 500)),
  ]);
  assert.equal(result, 'CANVAS_PROVIDER_FAILED');
  assert.equal((await db('sc_tasks').first()).status, 'failed');
});

test('changed hook id poisons the task and cannot overwrite the first durable external id', async (context) => {
  const db = await database();
  context.onTestFinished(() => db.destroy());
  let outputs = 0;
  const production = adapter(db, {
    start: async (_providerInput, hooks) => {
      await hooks.onTaskCreated('provider-task-1');
      await assert.rejects(() => hooks.onTaskCreated('provider-task-2'));
      return { externalTaskId: 'provider-task-1', videoUrl: 'https://provider.invalid/result' };
    },
  }, {
    persistOutput: async () => {
      outputs += 1;
      return { outputAssetId: assetId };
    },
  });
  await production.start(input());
  await waitFor(async () => (await db('sc_tasks').first()).status === 'failed');
  const row = await db('sc_tasks').first();
  assert.equal(row.externalTaskId, 'provider-task-1');
  assert.equal(outputs, 0);
});

test('returned externalTaskId mismatch is rejected before output registration', async (context) => {
  const db = await database();
  context.onTestFinished(() => db.destroy());
  let outputs = 0;
  const production = adapter(db, {
    start: async (_providerInput, hooks) => {
      await hooks.onTaskCreated('provider-task-1');
      return { externalTaskId: 'provider-task-returned-drift', videoUrl: 'https://provider.invalid/result' };
    },
  }, {
    persistOutput: async () => {
      outputs += 1;
      return { outputAssetId: assetId };
    },
  });
  await production.start(input());
  await waitFor(async () => (await db('sc_tasks').first()).status === 'failed');
  assert.equal(outputs, 0);
  assert.equal((await db('sc_tasks').first()).externalTaskId, 'provider-task-1');
});

test('task persistence and errors expose no raw Provider body, URL or asset URI', async (context) => {
  const db = await database();
  context.onTestFinished(() => db.destroy());
  const production = adapter(db, {
    start: async (_providerInput, hooks) => {
      await hooks.onTaskCreated('provider-task-1');
      throw new Error('Bearer paid-secret providerRawBody asset://private signed?credential=x');
    },
  });
  await production.start(input());
  await waitFor(async () => (await db('sc_tasks').first()).status === 'failed');
  const serialized = JSON.stringify(await db('sc_tasks'));
  assert.doesNotMatch(serialized, /paid-secret|providerRawBody|asset:\/\/|signed\?|credential=x/iu);
  assert.match(serialized, /CANVAS_PROVIDER_FAILED/u);
});

test('Provider configuration is fail-closed for every missing required credential', () => {
  const complete = {
    ARK_API_KEY: 'api',
    ARK_ASSET_ACCESS_KEY: 'access',
    ARK_ASSET_SECRET_KEY: 'secret',
    ARK_ASSET_GROUP_ID: 'group',
    ARK_ASSET_TOS_BUCKET: 'bucket',
    ARK_ASSET_TOS_ENDPOINT: 'https://tos.example.test',
  } as NodeJS.ProcessEnv;
  assert.equal(isCanvasV1ShotProductionConfigured(complete), true);
  for (const key of Object.keys(complete)) {
    assert.equal(isCanvasV1ShotProductionConfigured({ ...complete, [key]: '' }), false, key);
  }
});
