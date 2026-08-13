import { describe, expect, it } from 'vitest';
import {
  parseCanvasWorkspaceAuthorityRequest,
  parseCanvasWorkspaceAuthorityResponse,
} from './workspaceAuthorityParser.js';

const scope = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  packageId: '33333333-3333-4333-8333-333333333333',
  canvasSessionId: 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678',
};

function request() {
  return {
    objectType: 'CanvasWorkspaceAuthorityRequest',
    contractVersion: '0.1',
    ...scope,
    actorId: '12121212-1212-4212-8212-121212121212',
    requestId: 'req-canvas-workspace-authority-001',
    occurredAt: '2026-08-14T02:03:00.000Z',
  };
}

function asset(
  assetId: string,
  category: 'virtual_character' | 'store',
  overrides: Record<string, unknown> = {},
) {
  return {
    objectType: 'AssetRecord',
    contractVersion: '0.1',
    ...scope,
    assetId,
    category,
    displayName: category === 'store' ? '示范门店' : '门店讲解员',
    provenance: {
      kind: 'customer_upload',
      sourceAssetId: null,
      declaredByActorId: request().actorId,
      declaredAt: '2026-08-14T01:40:00.000Z',
    },
    rights: {
      status: 'authorized',
      basis: 'customer_owned',
      validFrom: '2026-08-14T01:40:00.000Z',
      validUntil: null,
      reviewedAt: '2026-08-14T01:42:00.000Z',
    },
    approval: {
      status: 'approved',
      reviewedByActorId: request().actorId,
      reviewedAt: '2026-08-14T01:43:00.000Z',
    },
    controlledPreviewUrl: `/api/canvas-v1/assets/${assetId}/preview`,
    createdAt: '2026-08-14T01:40:00.000Z',
    updatedAt: '2026-08-14T01:43:00.000Z',
    occurredAt: '2026-08-14T02:03:00.100Z',
    ...overrides,
  };
}

function response() {
  return {
    objectType: 'CanvasWorkspaceAuthority',
    contractVersion: '0.1',
    ...scope,
    project: { projectName: '门店探店获客视频' },
    approvedScript: { scriptId: '44444444-4444-4444-8444-444444444444', version: 3 },
    approvedStoryboard: {
      storyboardId: '55555555-5555-4555-8555-555555555555',
      version: 2,
    },
    assets: [
      asset('88888888-8888-4888-8888-888888888888', 'virtual_character'),
      asset('99999999-9999-4999-8999-999999999999', 'store'),
    ],
    completeness: { project: true, approvedScript: true, approvedStoryboard: true, assets: true },
    requestId: request().requestId,
    occurredAt: '2026-08-14T02:03:00.100Z',
  };
}

describe('Canvas workspace authority strict parser', () => {
  it('accepts only the exact request with a canonical timestamp', () => {
    expect(parseCanvasWorkspaceAuthorityRequest(request())).toEqual(request());
    expect(() => parseCanvasWorkspaceAuthorityRequest({ ...request(), unexpected: true })).toThrow(
      'CANVAS_WORKSPACE_AUTHORITY_REQUEST_INVALID',
    );
    expect(() =>
      parseCanvasWorkspaceAuthorityRequest({ ...request(), occurredAt: '2026-02-30T02:03:00.000Z' }),
    ).toThrow('CANVAS_WORKSPACE_AUTHORITY_REQUEST_INVALID');
  });

  it('accepts the complete browser-safe response with deterministic asset ordering', () => {
    expect(parseCanvasWorkspaceAuthorityResponse(response())).toEqual(response());
  });

  it('rejects unsafe, incomplete, wrong-scope and unordered responses with stable codes', () => {
    const cases = [
      [{ ...response(), packageSnapshot: { status: 'ready' } }, 'BROWSER_UNSAFE'],
      [
        { ...response(), assets: [{ ...response().assets[0], storageReference: 'private/a.png' }] },
        'BROWSER_UNSAFE',
      ],
      [{ ...response(), completeness: { ...response().completeness, assets: false } }, 'INCOMPLETE'],
      [
        {
          ...response(),
          assets: [{ ...response().assets[0], projectId: '30303030-3030-4030-8030-303030303030' }],
        },
        'SCOPE_MISMATCH',
      ],
      [{ ...response(), assets: [...response().assets].reverse() }, 'ASSET_ORDER_INVALID'],
    ] as const;
    for (const [value, suffix] of cases) {
      expect(() => parseCanvasWorkspaceAuthorityResponse(value)).toThrow(
        `CANVAS_WORKSPACE_AUTHORITY_${suffix}`,
      );
    }
  });
});
