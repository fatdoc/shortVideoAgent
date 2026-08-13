import { describe, expect, it, vi } from 'vitest';
import { CanvasWorkspaceAuthorityService } from './workspaceAuthorityService.js';

const request = {
  objectType: 'CanvasWorkspaceAuthorityRequest' as const,
  contractVersion: '0.1' as const,
  tenantId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  packageId: '33333333-3333-4333-8333-333333333333',
  canvasSessionId: 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678',
  actorId: '12121212-1212-4212-8212-121212121212',
  requestId: 'req-canvas-workspace-authority-001',
  occurredAt: '2026-08-14T02:03:00.000Z',
};

function record(
  assetId: string,
  category: 'virtual_character' | 'store',
  overrides: Record<string, unknown> = {},
) {
  return {
    assetId,
    tenantId: request.tenantId,
    projectId: request.projectId,
    packageId: request.packageId,
    canvasSessionId: 'pcs_ORIGINALCREATIONSESSION1234567890',
    category,
    displayName: category === 'store' ? '示范门店' : '门店讲解员',
    provenanceKind: 'customer_upload' as const,
    sourceAssetId: null,
    declaredByActorId: request.actorId,
    declaredAt: new Date('2026-08-14T01:40:00.000Z'),
    rightsStatus: 'authorized' as const,
    rightsBasis: 'customer_owned' as const,
    rightsValidFrom: new Date('2026-08-14T01:40:00.000Z'),
    rightsValidUntil: null,
    rightsReviewedByActorId: request.actorId,
    rightsReviewedAt: new Date('2026-08-14T01:42:00.000Z'),
    approvalStatus: 'approved' as const,
    approvalReviewedByActorId: request.actorId,
    approvalReviewedAt: new Date('2026-08-14T01:43:00.000Z'),
    storageReference: 'private/never-project.png',
    checksum: `sha256:${'a'.repeat(64)}`,
    reuseScope: 'project' as const,
    controlledPreviewUrl: `/api/canvas-v1/assets/${assetId}/preview`,
    createdAt: new Date('2026-08-14T01:40:00.000Z'),
    updatedAt: new Date('2026-08-14T01:43:00.000Z'),
    ...overrides,
  };
}

function harness(records = [
  record('99999999-9999-4999-8999-999999999999', 'store'),
  record('88888888-8888-4888-8888-888888888888', 'virtual_character'),
]) {
  const sessionAuthority = { assertActiveSession: vi.fn(async () => undefined) };
  const productionAuthority = {
    readExact: vi.fn(async () => ({
      projectName: '门店探店获客视频',
      scriptId: '44444444-4444-4444-8444-444444444444',
      scriptVersion: 3,
      storyboardId: '55555555-5555-4555-8555-555555555555',
      storyboardVersion: 2,
    })),
  };
  const assets = { listAssets: vi.fn(async () => records) };
  const service = new CanvasWorkspaceAuthorityService({
    sessionAuthority,
    productionAuthority,
    assets,
    now: () => new Date('2026-08-14T02:03:00.100Z'),
  });
  return { service, sessionAuthority, productionAuthority, assets };
}

describe('CanvasWorkspaceAuthorityService', () => {
  it('reads active exact Package authority and returns a complete ordered safe aggregate', async () => {
    const h = harness();
    const result = await h.service.read(request);
    expect(h.sessionAuthority.assertActiveSession).toHaveBeenCalledWith({
      tenantId: request.tenantId,
      projectId: request.projectId,
      packageId: request.packageId,
      canvasSessionId: request.canvasSessionId,
      actorId: request.actorId,
    });
    expect(h.productionAuthority.readExact).toHaveBeenCalledWith({
      tenantId: request.tenantId,
      projectId: request.projectId,
      packageId: request.packageId,
      now: new Date('2026-08-14T02:03:00.100Z'),
    });
    expect(result).toMatchObject({
      project: { projectName: '门店探店获客视频' },
      approvedScript: { scriptId: '44444444-4444-4444-8444-444444444444', version: 3 },
      approvedStoryboard: {
        storyboardId: '55555555-5555-4555-8555-555555555555',
        version: 2,
      },
      completeness: { project: true, approvedScript: true, approvedStoryboard: true, assets: true },
    });
    expect(result.assets.map(({ category, assetId }) => [category, assetId])).toEqual([
      ['virtual_character', '88888888-8888-4888-8888-888888888888'],
      ['store', '99999999-9999-4999-8999-999999999999'],
    ]);
    expect(result.assets.every(({ canvasSessionId }) => canvasSessionId === request.canvasSessionId)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/storageReference|checksum|packageSnapshot|provider/i);
  });

  it('returns the unique pending virtual character instead of using readiness as a casting heuristic', async () => {
    const pending = record('88888888-8888-4888-8888-888888888888', 'virtual_character', {
      rightsStatus: 'pending',
      rightsValidFrom: null,
      rightsReviewedByActorId: null,
      rightsReviewedAt: null,
      approvalStatus: 'pending',
      approvalReviewedByActorId: null,
      approvalReviewedAt: null,
    });
    await expect(harness([pending]).service.read(request)).resolves.toMatchObject({
      assets: [{ assetId: pending.assetId, rights: { status: 'pending' }, approval: { status: 'pending' } }],
    });
  });

  it('blocks zero or multiple virtual characters without returning a partial aggregate', async () => {
    const cases = [
      [[record('99999999-9999-4999-8999-999999999999', 'store')], 'PRIMARY_VIRTUAL_CHARACTER_MISSING'],
      [[
        record('88888888-8888-4888-8888-888888888888', 'virtual_character'),
        record('77777777-7777-4777-8777-777777777777', 'virtual_character'),
      ], 'PRIMARY_VIRTUAL_CHARACTER_AMBIGUOUS'],
    ] as const;
    for (const [records, code] of cases) {
      await expect(harness([...records]).service.read(request)).rejects.toMatchObject({ code });
    }
  });
});
