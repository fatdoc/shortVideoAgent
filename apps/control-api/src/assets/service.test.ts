import { describe, expect, it } from 'vitest';
import { CanvasAssetDomainError } from './errors.js';
import { CanvasAssetAuthorityService } from './service.js';
import type {
  AssetAuthorityRecord,
  CanvasAssetAuthorityStore,
  CreateAssetAuthorityRecord,
  CreateHighCostApprovalRecord,
  HighCostCommandApprovalAuthority,
  SessionActorScope,
} from './types.js';

const ids = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  otherTenantId: '10101010-1010-4010-8010-101010101010',
  projectId: '22222222-2222-4222-8222-222222222222',
  otherProjectId: '20202020-2020-4020-8020-202020202020',
  packageId: '33333333-3333-4333-8333-333333333333',
  actorId: '12121212-1212-4212-8212-121212121212',
  assetId: '88888888-8888-4888-8888-888888888888',
  approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  commandId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  otherCommandId: 'abababab-abab-4bab-8bab-abababababab',
};

const canvasSessionId = 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678';
const otherCanvasSessionId = 'pcs_ZYXWVUTSRQPONMLKJIHGFEDC87654321';
const now = new Date('2026-08-14T02:00:00.000Z');
const actor: SessionActorScope = { userId: ids.actorId, tenantId: ids.tenantId };

class MemoryStore implements CanvasAssetAuthorityStore {
  assets = new Map<string, AssetAuthorityRecord>();
  approvals = new Map<string, HighCostCommandApprovalAuthority>();

  async createAsset(input: CreateAssetAuthorityRecord): Promise<AssetAuthorityRecord> {
    const record: AssetAuthorityRecord = {
      ...input,
      approvalStatus: 'pending',
      approvalReviewedByActorId: null,
      approvalReviewedAt: null,
      createdAt: input.declaredAt,
      updatedAt: input.declaredAt,
    };
    this.assets.set(input.assetId, record);
    return structuredClone(record);
  }

  async listAssets(input: {
    tenantId: string;
    projectId: string;
  }): Promise<AssetAuthorityRecord[]> {
    return [...this.assets.values()]
      .filter((asset) => asset.tenantId === input.tenantId && asset.projectId === input.projectId)
      .map((asset) => structuredClone(asset));
  }

  async getAsset(input: {
    tenantId: string;
    projectId: string;
    assetId: string;
  }): Promise<AssetAuthorityRecord | null> {
    const record = this.assets.get(input.assetId);
    return record && record.tenantId === input.tenantId && record.projectId === input.projectId
      ? structuredClone(record)
      : null;
  }

  async transitionAssetRights(input: {
    tenantId: string;
    projectId: string;
    assetId: string;
    fromStatus: AssetAuthorityRecord['rightsStatus'];
    toStatus: AssetAuthorityRecord['rightsStatus'];
    validFrom: Date | null;
    validUntil: Date | null;
    reviewedByActorId: string;
    reviewedAt: Date;
  }): Promise<AssetAuthorityRecord | null> {
    const record = await this.getAsset(input);
    if (!record || record.rightsStatus !== input.fromStatus) return null;
    const updated = {
      ...record,
      rightsStatus: input.toStatus,
      rightsValidFrom: input.validFrom,
      rightsValidUntil: input.validUntil,
      rightsReviewedByActorId: input.reviewedByActorId,
      rightsReviewedAt: input.reviewedAt,
      updatedAt: input.reviewedAt,
    };
    this.assets.set(input.assetId, updated);
    return structuredClone(updated);
  }

  async transitionAssetApproval(input: {
    tenantId: string;
    projectId: string;
    assetId: string;
    fromStatus: AssetAuthorityRecord['approvalStatus'];
    toStatus: AssetAuthorityRecord['approvalStatus'];
    reviewedByActorId: string;
    reviewedAt: Date;
  }): Promise<AssetAuthorityRecord | null> {
    const record = await this.getAsset(input);
    if (!record || record.approvalStatus !== input.fromStatus) return null;
    const updated = {
      ...record,
      approvalStatus: input.toStatus,
      approvalReviewedByActorId: input.reviewedByActorId,
      approvalReviewedAt: input.reviewedAt,
      updatedAt: input.reviewedAt,
    };
    this.assets.set(input.assetId, updated);
    return structuredClone(updated);
  }

  async createHighCostApproval(
    input: CreateHighCostApprovalRecord,
  ): Promise<HighCostCommandApprovalAuthority> {
    const record: HighCostCommandApprovalAuthority = {
      ...input,
      status: 'active',
      consumedAt: null,
      consumedByCommandId: null,
    };
    this.approvals.set(input.approvalId, record);
    return structuredClone(record);
  }

  async getHighCostApproval(input: {
    tenantId: string;
    projectId: string;
    approvalId: string;
  }): Promise<HighCostCommandApprovalAuthority | null> {
    const record = this.approvals.get(input.approvalId);
    return record && record.tenantId === input.tenantId && record.projectId === input.projectId
      ? structuredClone(record)
      : null;
  }

  async consumeHighCostApproval(input: {
    tenantId: string;
    projectId: string;
    approvalId: string;
    packageId: string;
    canvasSessionId: string;
    actorId: string;
    commandType: HighCostCommandApprovalAuthority['commandType'];
    actionFingerprint: string;
    commandId: string;
    consumedAt: Date;
  }): Promise<{ value: HighCostCommandApprovalAuthority; replayed: boolean } | null> {
    const record = await this.getHighCostApproval(input);
    if (!record) return null;
    if (
      record.packageId !== input.packageId ||
      record.canvasSessionId !== input.canvasSessionId ||
      record.actorId !== input.actorId ||
      record.commandType !== input.commandType ||
      record.actionFingerprint !== input.actionFingerprint
    ) {
      return null;
    }
    if (record.consumedByCommandId === input.commandId) return { value: record, replayed: true };
    if (record.status !== 'active' || record.expiresAt.getTime() <= input.consumedAt.getTime()) {
      return null;
    }
    const consumed = {
      ...record,
      status: 'consumed' as const,
      consumedAt: input.consumedAt,
      consumedByCommandId: input.commandId,
    };
    this.approvals.set(input.approvalId, consumed);
    return { value: structuredClone(consumed), replayed: false };
  }
}

function service(store = new MemoryStore()) {
  const sessionAuthority = {
    assertActiveSession: async () => undefined,
  };
  return {
    store,
    authority: new CanvasAssetAuthorityService(store, 'a'.repeat(32), {
      now: () => new Date(now),
      newId: (kind) => (kind === 'asset' ? ids.assetId : ids.approvalId),
      sessionAuthority,
    }),
  };
}

function createAsset(authority: CanvasAssetAuthorityService) {
  return authority.createAsset(actor, ids.projectId, {
    packageId: ids.packageId,
    canvasSessionId,
    category: 'virtual_character',
    displayName: '门店讲解员',
    provenance: { kind: 'provider_generated', sourceAssetId: null },
    rights: {
      status: 'pending',
      basis: 'customer_owned',
      validFrom: null,
      validUntil: null,
    },
    storageReference: 'tenant-assets/virtual-character/guide.png',
    checksum: `sha256:${'a'.repeat(64)}`,
    reuseScope: 'project',
    controlledPreviewUrl: `/api/canvas-v1/assets/${ids.assetId}/preview`,
  });
}

describe('Canvas Asset authority service', () => {
  it('rejects forged package/session scope before asset or approval persistence', async () => {
    const store = new MemoryStore();
    const assertActiveSession = async () => {
      throw new CanvasAssetDomainError('CANVAS_SESSION_INVALID', 'Canvas session is invalid.');
    };
    const authority = new CanvasAssetAuthorityService(store, 'a'.repeat(32), {
      now: () => new Date(now),
      newId: (kind) => (kind === 'asset' ? ids.assetId : ids.approvalId),
      sessionAuthority: { assertActiveSession },
    });

    await expect(createAsset(authority)).rejects.toMatchObject({ code: 'CANVAS_SESSION_INVALID' });
    expect(store.assets.size).toBe(0);
    await expect(
      authority.createHighCostApproval(actor, ids.projectId, {
        packageId: ids.packageId,
        canvasSessionId,
        commandType: 'GENERATE_SHOT',
        action: {
          commandId: ids.commandId,
          payload: { shotId: '66666666-6666-4666-8666-666666666666' },
        },
        expiresInSeconds: 60,
        replayPolicy: 'single_use_replay_same_command',
      }),
    ).rejects.toMatchObject({ code: 'CANVAS_SESSION_INVALID' });
    expect(store.approvals.size).toBe(0);
  });

  it('keeps tenant/project authority exact and returns not-found for either mismatch', async () => {
    const { authority } = service();
    await createAsset(authority);

    await expect(authority.getAsset(actor, ids.otherProjectId, ids.assetId)).rejects.toMatchObject({
      code: 'CANVAS_ASSET_NOT_FOUND',
    });
    await expect(
      authority.getAsset({ ...actor, tenantId: ids.otherTenantId }, ids.projectId, ids.assetId),
    ).rejects.toMatchObject({ code: 'CANVAS_ASSET_NOT_FOUND' });
  });

  it('enforces rights and approval lifecycle and projects expiry without exposing storage facts', async () => {
    const { authority } = service();
    await createAsset(authority);
    const authorized = await authority.transitionRights(actor, ids.projectId, ids.assetId, {
      status: 'authorized',
      validFrom: '2026-08-14T01:00:00.000Z',
      validUntil: '2026-08-14T03:00:00.000Z',
    });
    expect(authorized.rights.status).toBe('authorized');
    const approved = await authority.transitionApproval(actor, ids.projectId, ids.assetId, {
      status: 'approved',
    });
    expect(approved.approval.status).toBe('approved');
    expect(JSON.stringify(approved)).not.toMatch(
      /storageReference|checksum|providerAsset|asset:\/\//i,
    );
    const revoked = await authority.transitionRights(actor, ids.projectId, ids.assetId, {
      status: 'revoked',
      validFrom: '2026-08-14T01:00:00.000Z',
      validUntil: '2026-08-14T03:00:00.000Z',
    });
    expect(revoked.rights.status).toBe('revoked');
    await expect(
      authority.transitionRights(actor, ids.projectId, ids.assetId, {
        status: 'authorized',
        validFrom: '2026-08-14T01:00:00.000Z',
        validUntil: '2026-08-14T04:00:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'CANVAS_ASSET_LIFECYCLE_INVALID' });
  });

  it('binds a high-cost approval to authenticated actor and exact action scope', async () => {
    const { authority } = service();
    const action = {
      commandId: ids.commandId,
      payload: {
        shotId: '66666666-6666-4666-8666-666666666666',
        readinessId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
    };
    const created = await authority.createHighCostApproval(actor, ids.projectId, {
      packageId: ids.packageId,
      canvasSessionId,
      commandType: 'GENERATE_SHOT',
      action,
      expiresInSeconds: 60,
      replayPolicy: 'single_use_replay_same_command',
    });
    expect(created).toEqual({ approvalId: ids.approvalId, status: 'active' });

    await expect(
      authority.consumeHighCostApproval({
        approvalId: ids.approvalId,
        tenantId: ids.tenantId,
        projectId: ids.otherProjectId,
        packageId: ids.packageId,
        canvasSessionId,
        actorId: ids.actorId,
        commandType: 'GENERATE_SHOT',
        action,
        commandId: ids.commandId,
      }),
    ).rejects.toMatchObject({ code: 'CANVAS_APPROVAL_INVALID' });
    await expect(
      authority.consumeHighCostApproval({
        approvalId: ids.approvalId,
        tenantId: ids.tenantId,
        projectId: ids.projectId,
        packageId: ids.packageId,
        canvasSessionId,
        actorId: ids.otherCommandId,
        commandType: 'GENERATE_SHOT',
        action,
        commandId: ids.commandId,
      }),
    ).rejects.toMatchObject({ code: 'CANVAS_APPROVAL_INVALID' });
    await expect(
      authority.consumeHighCostApproval({
        approvalId: ids.approvalId,
        tenantId: ids.tenantId,
        projectId: ids.projectId,
        packageId: ids.packageId,
        canvasSessionId: otherCanvasSessionId,
        actorId: ids.actorId,
        commandType: 'GENERATE_SHOT',
        action,
        commandId: ids.commandId,
      }),
    ).rejects.toMatchObject({ code: 'CANVAS_APPROVAL_INVALID' });

    const first = await authority.consumeHighCostApproval({
      approvalId: ids.approvalId,
      tenantId: ids.tenantId,
      projectId: ids.projectId,
      packageId: ids.packageId,
      canvasSessionId,
      actorId: ids.actorId,
      commandType: 'GENERATE_SHOT',
      action,
      commandId: ids.commandId,
    });
    expect(first).toEqual({ approvalId: ids.approvalId, status: 'consumed', replayed: false });
    await expect(
      authority.consumeHighCostApproval({
        approvalId: ids.approvalId,
        tenantId: ids.tenantId,
        projectId: ids.projectId,
        packageId: ids.packageId,
        canvasSessionId,
        actorId: ids.actorId,
        commandType: 'GENERATE_SHOT',
        action,
        commandId: ids.commandId,
      }),
    ).resolves.toEqual({ approvalId: ids.approvalId, status: 'consumed', replayed: true });
    await expect(
      authority.consumeHighCostApproval({
        approvalId: ids.approvalId,
        tenantId: ids.tenantId,
        projectId: ids.projectId,
        packageId: ids.packageId,
        canvasSessionId,
        actorId: ids.actorId,
        commandType: 'GENERATE_SHOT',
        action,
        commandId: ids.otherCommandId,
      }),
    ).rejects.toMatchObject({ code: 'CANVAS_SCHEMA_INVALID' });
    await expect(
      authority.consumeHighCostApproval({
        approvalId: ids.approvalId,
        tenantId: ids.tenantId,
        projectId: ids.projectId,
        packageId: ids.packageId,
        canvasSessionId,
        actorId: ids.actorId,
        commandType: 'GENERATE_SHOT',
        action: {
          ...action,
          payload: { ...action.payload, readinessId: 'abababab-abab-4bab-8bab-abababababab' },
        },
        commandId: ids.commandId,
      }),
    ).rejects.toMatchObject({ code: 'CANVAS_APPROVAL_INVALID' });
  });

  it('requires the exact Canvas session to remain active before first consume and replay', async () => {
    const store = new MemoryStore();
    let active = true;
    const authority = new CanvasAssetAuthorityService(store, 'a'.repeat(32), {
      now: () => new Date(now),
      newId: () => ids.approvalId,
      sessionAuthority: {
        assertActiveSession: async (input) => {
          expect(input).toEqual({
            tenantId: ids.tenantId,
            projectId: ids.projectId,
            packageId: ids.packageId,
            canvasSessionId,
            actorId: ids.actorId,
          });
          if (!active) {
            throw new CanvasAssetDomainError(
              'CANVAS_SESSION_INVALID',
              'Canvas session authority is invalid.',
            );
          }
        },
      },
    });
    const action = {
      commandId: ids.commandId,
      payload: { shotId: '66666666-6666-4666-8666-666666666666' },
    };
    await authority.createHighCostApproval(actor, ids.projectId, {
      packageId: ids.packageId,
      canvasSessionId,
      commandType: 'GENERATE_SHOT',
      action,
      expiresInSeconds: 60,
      replayPolicy: 'single_use_replay_same_command',
    });
    const input = {
      approvalId: ids.approvalId,
      tenantId: ids.tenantId,
      projectId: ids.projectId,
      packageId: ids.packageId,
      canvasSessionId,
      actorId: ids.actorId,
      commandType: 'GENERATE_SHOT' as const,
      action,
      commandId: ids.commandId,
    };

    active = false;
    await expect(authority.consumeHighCostApproval(input)).rejects.toMatchObject({
      code: 'CANVAS_SESSION_INVALID',
    });
    expect(store.approvals.get(ids.approvalId)).toMatchObject({
      status: 'active',
      consumedByCommandId: null,
    });

    active = true;
    await expect(authority.consumeHighCostApproval(input)).resolves.toMatchObject({
      status: 'consumed',
      replayed: false,
    });
    active = false;
    await expect(authority.consumeHighCostApproval(input)).rejects.toMatchObject({
      code: 'CANVAS_SESSION_INVALID',
    });
  });

  it('rejects an expired approval before consumption', async () => {
    const store = new MemoryStore();
    const authority = new CanvasAssetAuthorityService(store, 'a'.repeat(32), {
      now: () => new Date('2026-08-14T02:03:00.000Z'),
      newId: () => ids.approvalId,
      sessionAuthority: { assertActiveSession: async () => undefined },
    });
    const action = {
      commandId: ids.commandId,
      payload: { documentId: '77777777-7777-4777-8777-777777777777' },
    };
    await store.createHighCostApproval({
      approvalId: ids.approvalId,
      tenantId: ids.tenantId,
      projectId: ids.projectId,
      packageId: ids.packageId,
      canvasSessionId,
      actorId: ids.actorId,
      commandType: 'EXPORT_PLAYLIST',
      actionFingerprint: authority.actionFingerprint('EXPORT_PLAYLIST', action),
      confirmedAt: new Date('2026-08-14T02:00:00.000Z'),
      expiresAt: new Date('2026-08-14T02:02:00.000Z'),
      replayPolicy: 'single_use_replay_same_command',
    });
    await expect(
      authority.consumeHighCostApproval({
        approvalId: ids.approvalId,
        tenantId: ids.tenantId,
        projectId: ids.projectId,
        packageId: ids.packageId,
        canvasSessionId,
        actorId: ids.actorId,
        commandType: 'EXPORT_PLAYLIST',
        action,
        commandId: ids.commandId,
      }),
    ).rejects.toMatchObject({ code: 'CANVAS_APPROVAL_INVALID' });
  });

  it('replays persisted same-command consumption after expiry without authorizing a new command', async () => {
    const store = new MemoryStore();
    let clock = new Date('2026-08-14T02:00:00.000Z');
    const authority = new CanvasAssetAuthorityService(store, 'a'.repeat(32), {
      now: () => new Date(clock),
      newId: () => ids.approvalId,
      sessionAuthority: { assertActiveSession: async () => undefined },
    });
    const action = {
      commandId: ids.commandId,
      payload: { shotId: '66666666-6666-4666-8666-666666666666' },
    };
    await authority.createHighCostApproval(actor, ids.projectId, {
      packageId: ids.packageId,
      canvasSessionId,
      commandType: 'GENERATE_SHOT',
      action,
      expiresInSeconds: 60,
      replayPolicy: 'single_use_replay_same_command',
    });
    clock = new Date('2026-08-14T02:00:30.000Z');
    const input = {
      approvalId: ids.approvalId,
      tenantId: ids.tenantId,
      projectId: ids.projectId,
      packageId: ids.packageId,
      canvasSessionId,
      actorId: ids.actorId,
      commandType: 'GENERATE_SHOT' as const,
      action,
      commandId: ids.commandId,
    };
    await expect(authority.consumeHighCostApproval(input)).resolves.toMatchObject({
      status: 'consumed',
      replayed: false,
    });
    clock = new Date('2026-08-14T02:02:00.000Z');
    await expect(authority.consumeHighCostApproval(input)).resolves.toMatchObject({
      status: 'consumed',
      replayed: true,
    });
    await expect(
      authority.consumeHighCostApproval({ ...input, commandId: ids.otherCommandId }),
    ).rejects.toMatchObject({ code: 'CANVAS_SCHEMA_INVALID' });
  });

  it('uses bounded domain errors rather than reflecting secret inputs', () => {
    const error = new CanvasAssetDomainError('CANVAS_SCHEMA_INVALID', 'safe');
    expect(error.message).toBe('safe');
    expect(error.code).toBe('CANVAS_SCHEMA_INVALID');
  });
});
