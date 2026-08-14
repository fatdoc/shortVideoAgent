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
  isCanvasV1ShotProductionConfigured,
  resolveCanvasV1OutputStorageMode,
  type CanvasV1ApprovedPackage,
  type CanvasV1ShotProvider,
} from './shotProductionAdapter';
import { acceptCanvasV1RuntimeAuthority } from './runtimeAuthorityAcceptance';

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

test('local output mode enables Canvas production without pretending TOS is configured', () => {
  const common = {
    ARK_API_KEY: 'provider-key',
    ARK_ASSET_ACCESS_KEY: 'asset-access',
    ARK_ASSET_SECRET_KEY: 'asset-secret',
    ARK_ASSET_GROUP_ID: 'asset-group',
  };
  assert.equal(resolveCanvasV1OutputStorageMode({ ...common, CANVAS_V1_OUTPUT_STORAGE: 'local' }), 'local');
  assert.equal(isCanvasV1ShotProductionConfigured({ ...common, CANVAS_V1_OUTPUT_STORAGE: 'local' }), true);
  assert.equal(isCanvasV1ShotProductionConfigured({ ...common, CANVAS_V1_OUTPUT_STORAGE: 'tos' }), false);
  assert.equal(isCanvasV1ShotProductionConfigured({
    ...common,
    CANVAS_V1_OUTPUT_STORAGE: 'tos',
    ARK_ASSET_TOS_BUCKET: 'bucket',
    ARK_ASSET_TOS_ENDPOINT: 'tos.example.test',
  }), true);
  assert.equal(isCanvasV1ShotProductionConfigured({ ...common, CANVAS_V1_OUTPUT_STORAGE: 'fallback' }), false);
});

test('runtime authority acceptance requires an existing canonical project mapping and persists exact v0.3 facts', async (context) => {
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  });
  context.after(() => db.destroy());
  await db.schema.createTable('o_project', (table) => table.integer('id').primary());
  await db.schema.createTable('sc_external_mappings', (table) => {
    table.string('id').primary();
    table.string('system');
    table.string('entityType');
    table.string('localId');
    table.string('externalId');
  });
  await db.schema.createTable('sc_production_packages', (table) => {
    table.string('id').primary();
    table.string('packageId');
    table.integer('packageVersion');
    table.string('contractVersion');
    table.string('tenantId');
    table.string('externalProjectId');
    table.integer('internalProjectId');
    table.string('idempotencyKey').unique();
    table.string('payloadDigest');
    table.string('sourceSuiteDigest');
    table.text('capabilityIdsJson');
    table.text('snapshotJson');
    table.string('status');
    table.string('errorCode');
    table.text('errorJson');
    table.text('acceptedAt');
    table.text('createdAt');
  });

  const value = {
    ...approvedPackage,
    objectType: 'ProjectProductionPackage' as const,
    contractVersion: '0.3' as const,
    status: 'ready' as const,
    idempotencyKey: 'package-key',
    occurredAt: '2026-08-14T02:00:00.000Z',
    payloadDigest: `sha256:${'a'.repeat(64)}`,
    packageVersion: 1,
    organizationId: scope.tenantId,
    scriptVersionId: '44444444-4444-4444-8444-444444444444',
    storyboardVersionId: '55555555-5555-4555-8555-555555555555',
    approvedScriptDigest: `sha256:${'b'.repeat(64)}`,
    approvedStoryboardDigest: `sha256:${'c'.repeat(64)}`,
    briefSnapshot: { briefVersionId: assetId, objective: '获客', audience: ['附近顾客'], platforms: ['douyin'] },
    brandPolicySnapshot: { facts: [], prohibitedTerms: [], requiredDisclosures: [], sourceDigest: `sha256:${'d'.repeat(64)}` },
    approvedScript: { scriptVersionId: '44444444-4444-4444-8444-444444444444', payloadDigest: `sha256:${'b'.repeat(64)}`, content: '脚本', approvedAt: '2026-08-14T02:00:00.000Z', approvedBy: scope.actorId },
    approvedStoryboard: { storyboardVersionId: '55555555-5555-4555-8555-555555555555', scriptVersionId: '44444444-4444-4444-8444-444444444444', scriptPayloadDigest: `sha256:${'b'.repeat(64)}`, payloadDigest: `sha256:${'c'.repeat(64)}`, approvedAt: '2026-08-14T02:00:00.000Z', approvedBy: scope.actorId },
    target: { aspectRatio: '9:16', durationSeconds: 30, container: 'mp4' as const, videoCodec: 'h264' as const },
    capabilityRequirements: ['video.generate' as const],
    createdAt: '2026-08-14T02:00:00.000Z',
    expiresAt: '2099-08-14T02:00:00.000Z',
  };
  await assert.rejects(
    () => acceptCanvasV1RuntimeAuthority(db, value),
    (error: unknown) => (error as { code?: unknown }).code === 'CANVAS_CAPABILITY_UNAVAILABLE',
  );
  await db('o_project').insert({ id: 42 });
  await db('sc_external_mappings').insert({ id: assetId, system: 'saas-control-plane', entityType: 'project', localId: '42', externalId: scope.projectId });
  assert.equal(await acceptCanvasV1RuntimeAuthority(db, value), 42);
  assert.equal(await acceptCanvasV1RuntimeAuthority(db, value), 42);
  const rows = await db('sc_production_packages');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'accepted');
  assert.equal(rows[0].internalProjectId, 42);
  await assert.rejects(
    () => acceptCanvasV1RuntimeAuthority(db, { ...value, payloadDigest: `sha256:${'e'.repeat(64)}` }),
    (error: unknown) => (error as { code?: unknown }).code === 'CANVAS_SCOPE_MISMATCH',
  );
  await db('sc_production_packages').insert({
    ...rows[0],
    id: commandId,
    tenantId: assetId,
    idempotencyKey: 'conflicting-package-key',
  });
  await assert.rejects(
    () => acceptCanvasV1RuntimeAuthority(db, value),
    (error: unknown) => (error as { code?: unknown }).code === 'CANVAS_SCOPE_MISMATCH',
  );
  await db('sc_production_packages').where({ id: commandId }).delete();
  await db('sc_external_mappings').insert({ id: approvalId, system: 'saas-control-plane', entityType: 'project', localId: '42', externalId: scope.projectId });
  await assert.rejects(
    () => acceptCanvasV1RuntimeAuthority(db, value),
    (error: unknown) => (error as { code?: unknown }).code === 'CANVAS_CAPABILITY_UNAVAILABLE',
  );
});

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
    action: { commandId, payload: command().payload },
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

test('approval client replays the exact consume after response loss', async () => {
  let calls = 0;
  const client = new ControlCanvasApprovalClient({
    controlApiBaseUrl: 'https://control.example.test',
    internalToken: 't'.repeat(48),
    fetch: async () => {
      calls += 1;
      if (calls === 1) throw new Error('response lost');
      return new Response(JSON.stringify({ approvalId, status: 'consumed', replayed: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.equal(await client.consume(command(), scope), true);
  assert.equal(calls, 2);
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
  assert.deepEqual(await first.completion, { outputAssetId: '19191919-1919-4919-8919-191919191919' });
  assert.equal((await db('sc_tasks').first()).status, 'succeeded');
});

test('production adapter resumes an exact persisted provider task after restart without another paid submission', async (context) => {
  const db = await database();
  context.after(() => db.destroy());
  let paidStarts = 0;
  const firstAdapter = new CanvasV1ShotProductionAdapter({
    database: db,
    readiness: () => true,
    resolveApprovedPackage: () => approvedPackage,
    provider: {
      start: async (_input, hooks) => {
        paidStarts += 1;
        await hooks.onTaskCreated('provider-task-restart-safe');
        return await new Promise<never>(() => undefined);
      },
    },
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
  const submitted = await firstAdapter.start(input);
  assert.equal(submitted.taskId, '18181818-1818-4818-8818-181818181818');
  assert.equal((await db('sc_tasks').first()).status, 'running');

  let readOnlyResumes = 0;
  let persistedOutputs = 0;
  const resumedProvider = {
    start: async () => {
      paidStarts += 1;
      throw new Error('restart recovery must not submit a second paid task');
    },
    resume: async (externalTaskId: string) => {
      readOnlyResumes += 1;
      assert.equal(externalTaskId, 'provider-task-restart-safe');
      return {
        externalTaskId,
        videoUrl: 'https://provider.invalid/recovered-result',
      };
    },
  } as CanvasV1ShotProvider & {
    resume(externalTaskId: string): Promise<{ externalTaskId: string; videoUrl: string }>;
  };
  const restartedAdapter = new CanvasV1ShotProductionAdapter({
    database: db,
    readiness: () => true,
    resolveApprovedPackage: () => approvedPackage,
    provider: resumedProvider,
    persistOutput: async ({ externalTaskId }) => {
      persistedOutputs += 1;
      assert.equal(externalTaskId, 'provider-task-restart-safe');
      return { outputAssetId: '19191919-1919-4919-8919-191919191919' };
    },
  });
  const recovered = await restartedAdapter.start(input);
  assert.ok(recovered.completion, 'restart recovery must expose the persisted task completion');
  assert.deepEqual(await recovered.completion, {
    outputAssetId: '19191919-1919-4919-8919-191919191919',
  });
  assert.equal(paidStarts, 1);
  assert.equal(readOnlyResumes, 1);
  assert.equal(persistedOutputs, 1);
  assert.equal((await db('sc_tasks').first()).status, 'succeeded');

  const replay = await restartedAdapter.start(input);
  assert.deepEqual(await replay.completion, {
    outputAssetId: '19191919-1919-4919-8919-191919191919',
  });
  assert.equal(paidStarts, 1);
  assert.equal(readOnlyResumes, 1);
  assert.equal(persistedOutputs, 1);
});

test('production adapter does not resolve until a real provider task id is durably persisted', async (context) => {
  const db = await database();
  context.after(() => db.destroy());
  let releaseTaskCreated!: () => void;
  const taskCreated = new Promise<void>((resolve) => { releaseTaskCreated = resolve; });
  let hook!: (taskId: string) => Promise<void>;
  const adapter = new CanvasV1ShotProductionAdapter({
    database: db,
    readiness: () => true,
    resolveApprovedPackage: () => approvedPackage,
    provider: {
      start: async (_input, hooks) => {
        hook = hooks.onTaskCreated;
        await taskCreated;
        await hook('provider-task-server-only');
        return { externalTaskId: 'provider-task-server-only', videoUrl: 'https://provider.invalid/result' };
      },
    },
    persistOutput: async () => ({ outputAssetId: assetId }),
    newId: () => '18181818-1818-4818-8818-181818181818',
  });
  let settled = false;
  const pending = adapter.start({
    scope,
    commandId,
    shotId,
    prompt: 'prompt',
    referenceAssetIds: [assetId],
    referenceAssetUris: ['asset://server-only'],
  }).then((value) => { settled = true; return value; });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(settled, false);
  assert.equal((await db('sc_tasks').first()).externalTaskId, null);
  releaseTaskCreated();
  const result = await pending;
  assert.equal(result.taskId, '18181818-1818-4818-8818-181818181818');
  assert.equal((await db('sc_tasks').first()).externalTaskId, 'provider-task-server-only');
});

test('provider completion without task-created hook fails deterministically instead of hanging', async (context) => {
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
        return {
          externalTaskId: 'provider-task-without-hook',
          videoUrl: 'https://provider.invalid/result',
        };
      },
    },
    newId: () => '18181818-1818-4818-8818-181818181818',
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
    (error: unknown) => (error as { code?: unknown }).code === 'CANVAS_PROVIDER_FAILED',
  );
  assert.equal((await db('sc_tasks').first()).externalTaskId, null);
  await assert.rejects(
    () => adapter.start({
      scope,
      commandId,
      shotId,
      prompt: 'prompt',
      referenceAssetIds: [assetId],
      referenceAssetUris: ['asset://server-only'],
    }),
    (error: unknown) => (error as { code?: unknown }).code === 'CANVAS_PROVIDER_FAILED',
  );
  assert.equal(providerStarts, 1);
});

test('provider task-created hook is same-id idempotent and rejects a changed id without overwrite', async (context) => {
  const db = await database();
  context.after(() => db.destroy());
  let persistedOutputs = 0;
  const adapter = new CanvasV1ShotProductionAdapter({
    database: db,
    readiness: () => true,
    resolveApprovedPackage: () => approvedPackage,
    provider: {
      start: async (_input, hooks) => {
        await hooks.onTaskCreated('provider-task-server-only');
        await hooks.onTaskCreated('provider-task-server-only');
        await assert.rejects(() => hooks.onTaskCreated('provider-task-changed'));
        return {
          externalTaskId: 'provider-task-server-only',
          videoUrl: 'https://provider.invalid/result',
        };
      },
    },
    persistOutput: async () => {
      persistedOutputs += 1;
      return { outputAssetId: assetId };
    },
    newId: () => '18181818-1818-4818-8818-181818181818',
  });
  await adapter.start({
    scope,
    commandId,
    shotId,
    prompt: 'prompt',
    referenceAssetIds: [assetId],
    referenceAssetUris: ['asset://server-only'],
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const row = await db('sc_tasks').first();
  assert.equal(row.externalTaskId, 'provider-task-server-only');
  assert.equal(row.status, 'failed');
  assert.equal(persistedOutputs, 0);
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
