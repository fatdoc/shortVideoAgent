import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { CanvasAssetMaterializationService } from './materializationService.js';

const jpeg = Buffer.from([0xff, 0xd8, 0xff]);
const checksum = `sha256:${createHash('sha256').update(jpeg).digest('hex')}`;

function request(overrides: Record<string, unknown> = {}) {
  return {
    objectType: 'CanvasAssetMaterializationRequest' as const,
    contractVersion: '0.1' as const,
    tenantId: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222',
    packageId: '33333333-3333-4333-8333-333333333333',
    canvasSessionId: 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678',
    assetId: '88888888-8888-4888-8888-888888888888',
    actorId: '12121212-1212-4212-8212-121212121212',
    materializationAttemptId: '90909090-9090-4090-8090-909090909090',
    requestId: 'req-materialization-001',
    occurredAt: '2026-08-14T02:00:00.000Z',
    ...overrides,
  };
}

function asset(overrides: Record<string, unknown> = {}) {
  return {
    assetId: request().assetId,
    tenantId: request().tenantId,
    projectId: request().projectId,
    packageId: request().packageId,
    canvasSessionId: 'pcs_ORIGINALCREATIONSESSION1234567890',
    category: 'virtual_character' as const,
    displayName: 'Guide',
    provenanceKind: 'customer_upload' as const,
    sourceAssetId: null,
    declaredByActorId: request().actorId,
    declaredAt: new Date('2026-08-14T01:00:00.000Z'),
    rightsStatus: 'authorized' as const,
    rightsBasis: 'customer_owned' as const,
    rightsValidFrom: new Date('2026-08-14T01:00:00.000Z'),
    rightsValidUntil: null,
    rightsReviewedByActorId: request().actorId,
    rightsReviewedAt: new Date('2026-08-14T01:00:00.000Z'),
    approvalStatus: 'approved' as const,
    approvalReviewedByActorId: request().actorId,
    approvalReviewedAt: new Date('2026-08-14T01:00:00.000Z'),
    storageReference: 'tenant-assets/guide.jpg',
    checksum,
    reuseScope: 'project' as const,
    controlledPreviewUrl: null,
    createdAt: new Date('2026-08-14T01:00:00.000Z'),
    updatedAt: new Date('2026-08-14T01:00:00.000Z'),
    ...overrides,
  };
}

function harness(options: { asset?: ReturnType<typeof asset> | null; outcome?: 'created' | 'replayed' | 'conflict' } = {}) {
  const authority = { assertActiveSession: vi.fn(async () => undefined) };
  const assets = { getAsset: vi.fn(async () => options.asset === undefined ? asset() : options.asset) };
  const storage = {
    read: vi.fn(async () => ({ bytes: jpeg, mimeType: 'image/jpeg' as const, byteSize: 3, checksum })),
  };
  const attempts = {
    createOrReplay: vi.fn(async (input) => ({
      kind: options.outcome ?? 'created',
      value: {
        ...input,
        materializationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        createdAt: new Date('2026-08-14T02:00:00.000Z'),
      },
    })),
  };
  const service = new CanvasAssetMaterializationService({
    sessionAuthority: authority,
    assets,
    storage,
    attempts,
    now: () => new Date('2026-08-14T02:00:00.000Z'),
    newId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });
  return { service, authority, assets, storage, attempts };
}

describe('CanvasAssetMaterializationService', () => {
  it('checks active exact session and asset authority before storage read', async () => {
    const h = harness();
    const result = await h.service.materialize(request());
    expect(h.authority.assertActiveSession).toHaveBeenCalledWith({
      tenantId: request().tenantId,
      projectId: request().projectId,
      packageId: request().packageId,
      canvasSessionId: request().canvasSessionId,
      actorId: request().actorId,
    });
    expect(h.storage.read).toHaveBeenCalledWith('tenant-assets/guide.jpg');
    expect(result).toMatchObject({
      materializationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      byteSize: 3,
      checksum,
      contentBase64: jpeg.toString('base64'),
      replayed: false,
    });
  });

  it('fails before source read for missing/scope/category/rights/approval authority', async () => {
    const cases = [
      [null, 'ASSET_NOT_FOUND'],
      [asset({ packageId: '30303030-3030-4030-8030-303030303030' }), 'SCOPE_MISMATCH'],
      [asset({ category: 'store' }), 'CATEGORY_UNSUPPORTED'],
      [asset({ rightsStatus: 'revoked' }), 'RIGHTS_NOT_AUTHORIZED'],
      [asset({ rightsValidUntil: new Date('2026-08-14T01:59:59.999Z') }), 'RIGHTS_NOT_AUTHORIZED'],
      [asset({ approvalStatus: 'pending' }), 'ASSET_NOT_APPROVED'],
    ] as const;
    for (const [record, code] of cases) {
      const h = harness({ asset: record });
      await expect(h.service.materialize(request())).rejects.toMatchObject({
        code: `CANVAS_MATERIALIZATION_${code}`,
      });
      expect(h.storage.read).not.toHaveBeenCalled();
      expect(h.attempts.createOrReplay).not.toHaveBeenCalled();
    }
  });

  it('rejects immutable authority checksum drift before persisting an attempt', async () => {
    const h = harness();
    h.storage.read.mockResolvedValue({
      bytes: jpeg,
      mimeType: 'image/jpeg',
      byteSize: 3,
      checksum: `sha256:${'0'.repeat(64)}`,
    });
    await expect(h.service.materialize(request())).rejects.toMatchObject({
      code: 'CANVAS_MATERIALIZATION_CONTENT_INTEGRITY_FAILED',
    });
    expect(h.attempts.createOrReplay).not.toHaveBeenCalled();
  });

  it('returns persisted same-attempt authority as replay and changed scope as conflict', async () => {
    const replay = harness({ outcome: 'replayed' });
    await expect(replay.service.materialize(request())).resolves.toMatchObject({ replayed: true });
    const conflict = harness({ outcome: 'conflict' });
    await expect(conflict.service.materialize(request())).rejects.toMatchObject({
      code: 'CANVAS_MATERIALIZATION_IDEMPOTENCY_CONFLICT',
    });
  });
});
