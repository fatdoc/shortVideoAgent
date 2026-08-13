import { describe, expect, it } from 'vitest';
import {
  parseAssetRecordProjection,
  parseCreateAssetInput,
  parseCreateHighCostApprovalInput,
} from './parser.js';

const ids = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  packageId: '33333333-3333-4333-8333-333333333333',
  actorId: '12121212-1212-4212-8212-121212121212',
  assetId: '88888888-8888-4888-8888-888888888888',
};

const canvasSessionId = 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678';

function projection() {
  return {
    objectType: 'AssetRecord',
    contractVersion: '0.1',
    tenantId: ids.tenantId,
    projectId: ids.projectId,
    packageId: ids.packageId,
    canvasSessionId,
    assetId: ids.assetId,
    category: 'virtual_character',
    displayName: '门店讲解员',
    provenance: {
      kind: 'provider_generated',
      sourceAssetId: null,
      declaredByActorId: ids.actorId,
      declaredAt: '2026-08-14T01:40:00.000Z',
    },
    rights: {
      status: 'authorized',
      basis: 'customer_owned',
      validFrom: '2026-08-14T01:40:00.000Z',
      validUntil: '2027-08-14T01:40:00.000Z',
      reviewedAt: '2026-08-14T01:42:00.000Z',
    },
    approval: {
      status: 'approved',
      reviewedByActorId: ids.actorId,
      reviewedAt: '2026-08-14T01:43:00.000Z',
    },
    controlledPreviewUrl: `/api/canvas-v1/assets/${ids.assetId}/preview`,
    createdAt: '2026-08-14T01:40:00.000Z',
    updatedAt: '2026-08-14T01:43:00.000Z',
    occurredAt: '2026-08-14T01:43:00.000Z',
  };
}

describe('Canvas Asset strict parsing and projection safety', () => {
  it('accepts the frozen AssetRecord/0.1 browser shape without transformation', () => {
    expect(parseAssetRecordProjection(projection())).toEqual(projection());
  });

  it.each([
    ['top-level unknown field', { ...projection(), unexpected: true }],
    [
      'nested unknown field',
      { ...projection(), rights: { ...projection().rights, rawLicense: 'secret' } },
    ],
    ['provider URI', { ...projection(), controlledPreviewUrl: 'asset://provider-secret' }],
    [
      'signed storage URL',
      {
        ...projection(),
        controlledPreviewUrl: 'https://storage.example.test/preview.png?X-Amz-Signature=secret',
      },
    ],
    ['provider identifier', { ...projection(), providerAssetId: 'provider-secret-id' }],
    ['storage reference', { ...projection(), storageReference: 'tenant/private/file.png' }],
    ['checksum', { ...projection(), checksum: `sha256:${'a'.repeat(64)}` }],
  ])('rejects %s from a browser projection', (_label, value) => {
    expect(() => parseAssetRecordProjection(value)).toThrow();
  });

  it('accepts only bounded server-safe storage references and checksums on create', () => {
    const value = {
      packageId: ids.packageId,
      canvasSessionId,
      category: 'image',
      displayName: '门店外景',
      provenance: { kind: 'customer_upload', sourceAssetId: null },
      rights: {
        status: 'pending',
        basis: 'customer_owned',
        validFrom: null,
        validUntil: null,
      },
      storageReference: 'tenant-assets/2026/08/store-front.png',
      checksum: `sha256:${'a'.repeat(64)}`,
      reuseScope: 'project',
      controlledPreviewUrl: `/api/canvas-v1/assets/${ids.assetId}/preview`,
    };
    expect(parseCreateAssetInput(value)).toEqual(value);
    expect(() =>
      parseCreateAssetInput({ ...value, storageReference: 'asset://provider-internal-id' }),
    ).toThrow();
    expect(() =>
      parseCreateAssetInput({ ...value, storageReference: '../storycanvas/data.sqlite' }),
    ).toThrow();
    expect(() =>
      parseCreateAssetInput({ ...value, storageReference: 'tenant-assets/provider-token.txt' }),
    ).toThrow();
  });

  it.each([
    'remoteAssetId',
    'assetUri',
    'groupId',
    'providerAssetId',
    'providerGroupId',
    'providerTaskId',
    'accessToken',
    'authorization',
    'cookie',
    'grant',
    'projectGrant',
    'productionPackage',
    'packageSnapshot',
    'payloadDigest',
    'approvedScriptDigest',
    'approvedStoryboardDigest',
    'idempotencyKey',
    'internalToken',
    'credential',
    'secret',
    'password',
    'localPath',
    'databaseId',
    'providerRawBody',
    'providerRawMessage',
    'userConfirmed',
  ])('rejects frozen forbidden browser key %s before unknown-field stripping', (key) => {
    expect(() => parseAssetRecordProjection({ ...projection(), [key]: 'forbidden' })).toThrow(
      expect.objectContaining({ code: 'CANVAS_BROWSER_PROJECTION_UNSAFE' }),
    );
  });

  it('does not let the browser mint approval authority or submit userConfirmed', () => {
    const input = {
      packageId: ids.packageId,
      canvasSessionId,
      commandType: 'GENERATE_SHOT',
      action: {
        shotId: '66666666-6666-4666-8666-666666666666',
        readinessId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
      expiresInSeconds: 120,
      replayPolicy: 'single_use_replay_same_command',
    };
    expect(parseCreateHighCostApprovalInput(input)).toEqual(input);
    expect(() => parseCreateHighCostApprovalInput({ ...input, approvalId: ids.assetId })).toThrow();
    expect(() => parseCreateHighCostApprovalInput({ ...input, userConfirmed: true })).toThrow();
    expect(() =>
      parseCreateHighCostApprovalInput({ ...input, actionFingerprint: `sha256:${'b'.repeat(64)}` }),
    ).toThrow();
    expect(() =>
      parseCreateHighCostApprovalInput({ ...input, confirmedAt: '2026-08-14T02:00:00.000Z' }),
    ).toThrow();
    expect(() =>
      parseCreateHighCostApprovalInput({ ...input, commandType: 'SAVE_CANVAS_DOCUMENT' }),
    ).toThrow();
  });
});
