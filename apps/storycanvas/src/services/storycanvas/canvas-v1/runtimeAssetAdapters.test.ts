import assert from 'node:assert/strict';
import { test } from 'node:test';
import knex from 'knex';

import type { AssetRecordV01, ProviderAssetBindingV01 } from '@/contracts/canvas-v1';
import type { CanvasProductionScope } from '../assets-v1';
import {
  createCanvasV1AssetRuntimeAdapters,
  createCanvasV1OutputAssetAssertion,
} from './runtimeAssetAdapters';

const scope: CanvasProductionScope = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  packageId: '33333333-3333-4333-8333-333333333333',
  canvasSessionId: 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678',
  actorId: '12121212-1212-4212-8212-121212121212',
  localProjectId: 42,
};
const assetId = '88888888-8888-4888-8888-888888888888';
const localAssetId = '17171717-1717-4717-8717-171717171717';
const entityId = '16161616-1616-4616-8616-161616161616';
const occurredAt = '2026-08-14T02:00:00.000Z';

const asset: AssetRecordV01 = {
  objectType: 'AssetRecord', contractVersion: '0.1',
  tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId,
  canvasSessionId: scope.canvasSessionId, assetId, category: 'virtual_character', displayName: '门店讲解员',
  provenance: { kind: 'provider_generated', sourceAssetId: null, declaredByActorId: scope.actorId, declaredAt: occurredAt },
  rights: { status: 'authorized', basis: 'provider_generated', validFrom: occurredAt, validUntil: null, reviewedAt: occurredAt },
  approval: { status: 'approved', reviewedByActorId: scope.actorId, reviewedAt: occurredAt },
  controlledPreviewUrl: `/api/canvas-v1/assets/${assetId}/preview`, createdAt: occurredAt, updatedAt: occurredAt, occurredAt,
};

async function database() {
  const db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  await db.schema.createTable('sc_external_mappings', (table) => {
    table.string('id').primary(); table.string('system'); table.string('entityType'); table.string('localId'); table.string('externalId'); table.text('metadataJson');
  });
  await db.schema.createTable('sc_media_assets', (table) => {
    table.string('id').primary(); table.integer('projectId'); table.string('type'); table.string('source'); table.text('localPath'); table.text('metadataJson');
  });
  await db.schema.createTable('sc_canvas_v1_asset_records', (table) => {
    table.string('assetId').primary(); table.string('tenantId'); table.string('projectId'); table.string('packageId'); table.text('projectionJson');
  });
  await db.schema.createTable('sc_canvas_v1_provider_bindings', (table) => {
    table.string('bindingId').primary(); table.string('assetId'); table.string('tenantId'); table.string('projectId'); table.string('packageId'); table.text('authorityJson'); table.text('updatedAt');
  });
  await db.schema.createTable('sc_entities', (table) => {
    table.string('id').primary(); table.integer('projectId'); table.string('entityType'); table.text('canonicalJson'); table.text('updatedAt');
  });
  await db.schema.createTable('sc_continuity_profiles', (table) => {
    table.string('id').primary(); table.integer('projectId'); table.integer('revision'); table.text('updatedAt');
  });
  await db.schema.createTable('sc_reference_bindings', (table) => {
    table.string('id').primary(); table.integer('projectId'); table.string('entityId'); table.integer('shotId'); table.string('role'); table.string('assetId'); table.text('sourceUri'); table.string('view'); table.integer('priority'); table.boolean('approved'); table.text('createdAt');
  });
  await db.schema.createTable('sc_shot_contracts', (table) => { table.string('id').primary(); table.integer('projectId'); table.integer('worldRevision'); table.text('updatedAt'); });
  await db.schema.createTable('sc_tasks', (table) => { table.string('id').primary(); table.integer('projectId'); table.string('taskType'); table.string('status'); });
  await db('sc_media_assets').insert({ id: localAssetId, projectId: 42, type: 'character', source: 'generated', localPath: '/safe/character.png', metadataJson: '{}' });
  await db('sc_canvas_v1_asset_records').insert({ assetId, tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId, projectionJson: JSON.stringify(asset) });
  await db('sc_entities').insert({ id: entityId, projectId: 42, entityType: 'character', canonicalJson: '{}', updatedAt: occurredAt });
  await db('sc_continuity_profiles').insert({ id: '10101010-1010-4010-8010-101010101010', projectId: 42, revision: 1, updatedAt: occurredAt });
  await db('sc_external_mappings').insert([
    { id: '18181818-1818-4818-8818-181818181818', system: 'saas-control-plane', entityType: 'canvas-v1-asset', localId: localAssetId, externalId: assetId, metadataJson: '{}' },
    { id: '19191919-1919-4919-8919-191919191919', system: 'byteplus-modelark', entityType: 'character-asset', localId: localAssetId, externalId: 'provider-asset-server-only-001', metadataJson: JSON.stringify({ groupId: 'provider-group-server-only-001', assetUri: 'asset://provider-asset-server-only-001' }) },
  ]);
  return db;
}

test('SYNC resolves exact server mappings and BIND persists approved continuity without trusting browser IDs', async (context) => {
  const db = await database(); context.after(() => db.destroy());
  const adapters = createCanvasV1AssetRuntimeAdapters({
    database: db,
    queryProviderAsset: async () => ({ Id: 'provider-asset-server-only-001', Status: 'Active' }),
    now: () => new Date(occurredAt),
  });
  const provider = await adapters.syncProviderAsset(assetId, scope);
  assert.equal(provider.assetId, assetId);
  assert.equal(provider.providerStatus, 'active');
  await db('sc_canvas_v1_provider_bindings').insert({
    bindingId: provider.bindingId,
    assetId,
    tenantId: scope.tenantId,
    projectId: scope.projectId,
    packageId: scope.packageId,
    authorityJson: JSON.stringify(provider),
    updatedAt: occurredAt,
  });
  const binding = await adapters.bindAssetToEntity(assetId, entityId, scope);
  assert.equal(binding.continuityRevision, 2);
  assert.equal((await db('sc_continuity_profiles').first()).revision, 2);
  assert.equal(JSON.parse((await db('sc_entities').first()).canonicalJson).characterAssetId, localAssetId);
});

test('SYNC/BIND fail closed for absent, ambiguous, pending or cross-scope facts with zero continuity mutation', async (context) => {
  const db = await database(); context.after(() => db.destroy());
  const adapters = createCanvasV1AssetRuntimeAdapters({ database: db, queryProviderAsset: async () => ({ Status: 'Active' }), now: () => new Date(occurredAt) });
  await assert.rejects(() => adapters.syncProviderAsset('99999999-9999-4999-8999-999999999999', scope));
  await db('sc_canvas_v1_asset_records').where({ assetId }).update({ projectionJson: JSON.stringify({ ...asset, approval: { ...asset.approval, status: 'pending' } }) });
  const activeProvider = { objectType: 'ProviderAssetBinding', contractVersion: '0.1', tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId, canvasSessionId: scope.canvasSessionId, bindingId: '99999999-9999-4999-8999-999999999999', assetId, provider: 'byteplus', providerStatus: 'active', providerAssetId: 'provider-asset-server-only-001', providerGroupId: 'provider-group-server-only-001', assetUri: 'asset://provider-asset-server-only-001', registeredAt: occurredAt, updatedAt: occurredAt, occurredAt } as ProviderAssetBindingV01;
  await db('sc_canvas_v1_provider_bindings').insert({ bindingId: activeProvider.bindingId, assetId, tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId, authorityJson: JSON.stringify(activeProvider), updatedAt: occurredAt });
  await assert.rejects(() => adapters.bindAssetToEntity(assetId, entityId, scope));
  assert.equal((await db('sc_continuity_profiles').first()).revision, 1);
  await db('sc_external_mappings').insert({ id: '20202020-2020-4020-8020-202020202020', system: 'saas-control-plane', entityType: 'canvas-v1-asset', localId: localAssetId, externalId: assetId, metadataJson: '{}' });
  await assert.rejects(() => adapters.syncProviderAsset(assetId, scope));
});

test('SELECT assertion accepts only a succeeded generated output registered to the exact project task', async (context) => {
  const db = await database(); context.after(() => db.destroy());
  const check = createCanvasV1OutputAssetAssertion(db);
  const outputId = '99999999-9999-4999-8999-999999999999';
  assert.equal(await check(outputId, scope), false);
  await db('sc_tasks').insert({ id: '21212121-2121-4121-8121-212121212121', projectId: 42, taskType: 'canvas_v1_video_generation', status: 'succeeded' });
  await db('sc_media_assets').insert({ id: outputId, projectId: 42, type: 'video', source: 'generated', localPath: '/safe/output.mp4', metadataJson: JSON.stringify({ taskId: '21212121-2121-4121-8121-212121212121' }) });
  assert.equal(await check(outputId, scope), true);
  assert.equal(await check(outputId, { ...scope, localProjectId: 43 }), false);
  await db('sc_tasks').where({ id: '21212121-2121-4121-8121-212121212121' }).update({ status: 'failed' });
  assert.equal(await check(outputId, scope), false);
});
