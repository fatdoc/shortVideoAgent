import { describe, expect, it, vi } from 'vitest';
import { createStoryboardDraftRevision } from './contract.js';
import { StoryboardAuthorityService } from './service.js';
import type {
  CreateStoryboardApprovalInput,
  StoryboardApprovalEvent,
  StoryboardAuthorityStore,
  StoryboardVersion,
} from './types.js';

const IDS = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  otherTenantId: '99999999-9999-4999-8999-999999999999',
  userId: '22222222-2222-4222-8222-222222222222',
  membershipId: '33333333-3333-4333-8333-333333333333',
  projectId: '44444444-4444-4444-8444-444444444444',
  scriptVersionId: '55555555-5555-4555-8555-555555555555',
  draftRevisionId: '66666666-6666-4666-8666-666666666666',
  shotId: '77777777-7777-4777-8777-777777777777',
  commandId: '88888888-8888-4888-8888-888888888888',
  receiptId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  storyboardVersionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  approvalId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
} as const;

const actor = {
  userId: IDS.userId,
  membershipId: IDS.membershipId,
  organizationId: IDS.tenantId,
  organizationType: 'TENANT' as const,
  tenantId: IDS.tenantId,
  membershipVersion: 1,
  primaryRole: 'tenant_admin' as const,
  roles: ['tenant_admin'] as const,
};

function draft(tenantId = IDS.tenantId, projectId = IDS.projectId) {
  return createStoryboardDraftRevision({
    objectType: 'StoryboardDraftRevision',
    contractVersion: '0.2',
    status: 'draft',
    tenantId,
    projectId,
    approvedScriptVersionId: IDS.scriptVersionId,
    approvedScriptDigest: `sha256:${'a'.repeat(64)}`,
    draftRevisionId: IDS.draftRevisionId,
    revisionNumber: 1,
    previousRevisionId: null,
    shots: [
      {
        shotId: IDS.shotId,
        sequence: 1,
        description: 'Opening controlled pilot shot.',
        durationSeconds: 5,
        sourceMode: 'mixed',
      },
    ],
    sourceReceipt: {
      providerId: 'openai',
      sourceSystem: 'storycanvas',
      sourceContractVersion: '0.2',
      commandId: IDS.commandId,
      receiptId: IDS.receiptId,
      receiptDigest: `sha256:${'b'.repeat(64)}`,
      receivedAt: '2026-08-11T03:00:00.000Z',
    },
    generationPolicy: { policyId: 'storyboard-draft-default', policyVersion: '1.0.0' },
    validationSummary: { status: 'passed', issueCodes: [] },
    createdAt: '2026-08-11T03:00:01.000Z',
  });
}

function version(): StoryboardVersion {
  return {
    id: IDS.storyboardVersionId,
    tenantId: IDS.tenantId,
    projectId: IDS.projectId,
    scriptVersionId: IDS.scriptVersionId,
    version: 1,
    status: 'draft',
    draft: draft(),
    createdBy: IDS.userId,
    createdAt: '2026-08-11T03:00:02.000Z',
  };
}

function approval(input: CreateStoryboardApprovalInput): StoryboardApprovalEvent {
  return {
    id: IDS.approvalId,
    tenantId: IDS.tenantId,
    projectId: IDS.projectId,
    storyboardVersionId: IDS.storyboardVersionId,
    sequence: '1',
    status: input.status,
    factRiskStatus: input.factRiskStatus,
    reason: input.reason ?? null,
    eventDigest: `sha256:${'c'.repeat(64)}`,
    actedBy: IDS.userId,
    actedAt: '2026-08-11T03:00:03.000Z',
  };
}

function store(overrides: Partial<StoryboardAuthorityStore> = {}): StoryboardAuthorityStore {
  return {
    createVersion: vi.fn(async () => ({ value: version(), replayed: false })),
    listVersions: vi.fn(async () => [version()]),
    createApproval: vi.fn(async (_actor, _projectId, _versionId, input) => ({
      value: approval(input),
      replayed: false,
    })),
    listApprovals: vi.fn(async () => []),
    ...overrides,
  };
}

describe('StoryboardAuthorityService', () => {
  it('strictly parses the B draft before handing it to the authority store', async () => {
    const authorityStore = store();
    const service = new StoryboardAuthorityService(authorityStore);
    const unsafe = { ...draft(), payloadDigest: `sha256:${'0'.repeat(64)}` };

    await expect(
      service.createVersion(actor, IDS.projectId, {
        draft: unsafe,
        idempotencyKey: 'storyboard-create-001',
      }),
    ).rejects.toMatchObject({ code: 'STORYBOARD_DIGEST_MISMATCH' });
    expect(authorityStore.createVersion).not.toHaveBeenCalled();
  });

  it('returns the same safe 404 for draft, actor, project, or resource scope mismatches', async () => {
    const authorityStore = store({ listVersions: vi.fn(async () => null) });
    const service = new StoryboardAuthorityService(authorityStore);

    await expect(
      service.createVersion(actor, IDS.projectId, {
        draft: draft(IDS.otherTenantId),
        idempotencyKey: 'storyboard-create-002',
      }),
    ).rejects.toMatchObject({ code: 'STORYBOARD_NOT_FOUND', status: 404 });

    await expect(service.listVersions(actor, IDS.projectId)).rejects.toMatchObject({
      code: 'STORYBOARD_NOT_FOUND',
      status: 404,
    });
  });

  it('rejects non-tenant or internally inconsistent actor context before storage access', async () => {
    const authorityStore = store();
    const service = new StoryboardAuthorityService(authorityStore);

    await expect(
      service.listVersions(
        { ...actor, organizationType: 'PLATFORM', organizationId: IDS.otherTenantId } as never,
        IDS.projectId,
      ),
    ).rejects.toMatchObject({ code: 'STORYBOARD_ACTOR_INVALID', status: 403 });
    expect(authorityStore.listVersions).not.toHaveBeenCalled();
  });

  it('enforces approval input, expectedVersion, and fact-cleared approval before storage', async () => {
    const authorityStore = store();
    const service = new StoryboardAuthorityService(authorityStore);

    await expect(
      service.createApproval(actor, IDS.projectId, IDS.storyboardVersionId, {
        expectedVersion: 1,
        status: 'approved',
        factRiskStatus: 'unresolved',
        idempotencyKey: 'storyboard-approve-001',
      }),
    ).rejects.toMatchObject({ code: 'STORYBOARD_APPROVAL_STATE_INVALID', status: 409 });

    await expect(
      service.createApproval(actor, IDS.projectId, IDS.storyboardVersionId, {
        expectedVersion: 0,
        status: 'blocked',
        factRiskStatus: 'unresolved',
        reason: 'Fact risk remains unresolved.',
        idempotencyKey: 'storyboard-block-001',
      }),
    ).rejects.toMatchObject({ code: 'STORYBOARD_INPUT_INVALID', status: 422 });
    expect(authorityStore.createApproval).not.toHaveBeenCalled();
  });

  it('sanitizes unexpected storage errors without echoing SQL, payload, or digest values', async () => {
    const sensitive = `select payload_digest='sha256:${'d'.repeat(64)}' password=private`;
    const service = new StoryboardAuthorityService(
      store({
        listVersions: vi.fn(async () => {
          throw new Error(sensitive);
        }),
      }),
    );

    let thrown: unknown;
    try {
      await service.listVersions(actor, IDS.projectId);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ code: 'STORYBOARD_STORAGE_ERROR', status: 500 });
    expect(String(thrown)).not.toContain(sensitive);
    expect(JSON.stringify(thrown)).not.toContain(sensitive);
  });
});
