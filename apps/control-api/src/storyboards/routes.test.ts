import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { PublicSession } from '../auth/service.js';
import type { ProjectAccess, ProjectPolicy } from '../projects/policy.js';
import { createStoryboardDraftRevision } from './contract.js';
import { StoryboardAuthorityError } from './errors.js';
import { createStoryboardRouter, type StoryboardRouterOptions } from './routes.js';
import type { StoryboardApprovalEvent, StoryboardVersion } from './types.js';

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

function draft(tenantId = IDS.tenantId) {
  return createStoryboardDraftRevision({
    objectType: 'StoryboardDraftRevision',
    contractVersion: '0.2',
    status: 'draft',
    tenantId,
    projectId: IDS.projectId,
    approvedScriptVersionId: IDS.scriptVersionId,
    approvedScriptDigest: `sha256:${'a'.repeat(64)}`,
    draftRevisionId: IDS.draftRevisionId,
    revisionNumber: 1,
    previousRevisionId: null,
    shots: [
      {
        shotId: IDS.shotId,
        sequence: 1,
        description: 'Opening shot',
        durationSeconds: 5,
        sourceMode: 'mixed',
      },
    ],
    sourceReceipt: {
      providerId: 'storycanvas',
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

function version(tenantId = IDS.tenantId): StoryboardVersion {
  return {
    id: IDS.storyboardVersionId,
    tenantId,
    projectId: IDS.projectId,
    scriptVersionId: IDS.scriptVersionId,
    version: 1,
    status: 'draft',
    draft: draft(tenantId),
    createdBy: IDS.userId,
    createdAt: '2026-08-11T03:00:02.000Z',
  };
}

function approval(tenantId = IDS.tenantId): StoryboardApprovalEvent {
  return {
    id: IDS.approvalId,
    tenantId,
    projectId: IDS.projectId,
    storyboardVersionId: IDS.storyboardVersionId,
    sequence: '1',
    status: 'approved',
    factRiskStatus: 'cleared',
    reason: null,
    eventDigest: `sha256:${'c'.repeat(64)}`,
    actedBy: IDS.userId,
    actedAt: '2026-08-11T03:00:03.000Z',
  };
}

function tenantSession(role: 'tenant_admin' | 'content_operator' = 'tenant_admin'): PublicSession {
  return {
    user: { id: IDS.userId, email: 'pilot@example.com', displayName: 'Pilot User' },
    tenant: { id: IDS.tenantId, displayName: 'Pilot Tenant' },
    roles: [role],
    activeContext: {
      membershipId: IDS.membershipId,
      organizationId: IDS.tenantId,
      organizationType: 'TENANT',
      organizationDisplayName: 'Pilot Tenant',
      membershipVersion: 1,
      primaryRole: role,
      roles: [role],
      tenantId: IDS.tenantId,
    },
    expiresAt: '2026-08-11T11:00:00.000Z',
  };
}

function platformSession(): PublicSession {
  return {
    user: { id: IDS.userId, email: 'platform@example.com', displayName: 'Platform Admin' },
    tenant: null,
    roles: ['platform_admin'],
    activeContext: {
      membershipId: IDS.membershipId,
      organizationId: IDS.otherTenantId,
      organizationType: 'PLATFORM',
      organizationDisplayName: 'Pilot Platform',
      membershipVersion: 1,
      primaryRole: 'platform_admin',
      roles: ['platform_admin'],
      tenantId: null,
    },
    expiresAt: '2026-08-11T11:00:00.000Z',
  };
}

function policy(access: ProjectAccess | null = 'manager'): ProjectPolicy {
  return {
    canCreateProject: vi.fn(async () => access === 'manager'),
    listVisibleProjectIds: vi.fn(async () => (access === 'manager' ? null : [IDS.projectId])),
    resolveProjectAccess: vi.fn(async () => access),
  };
}

function service(overrides: Partial<StoryboardRouterOptions['service']> = {}) {
  return {
    createVersion: vi.fn(async () => ({ value: version(), replayed: false })),
    listVersions: vi.fn(async () => [version()]),
    createApproval: vi.fn(async () => ({ value: approval(), replayed: false })),
    listApprovals: vi.fn(async () => [approval()]),
    ...overrides,
  };
}

function testApp(
  authorityService = service(),
  projectPolicy: ProjectPolicy = policy(),
  resolveSession: StoryboardRouterOptions['resolveSession'] = async (token) => {
    if (token === 'tenant-session') return { session: tenantSession() };
    if (token === 'platform-session') return { session: platformSession() };
    if (token === 'rotating-session') {
      return { token: 'rotated-token', session: tenantSession('content_operator') };
    }
    return null;
  },
) {
  const storyboardRouter = createStoryboardRouter({
    service: authorityService,
    policy: projectPolicy,
    resolveSession,
    secureCookies: false,
    sessionTtlSeconds: 28_800,
  });
  return createApp({
    appVersion: 'test',
    nodeEnv: 'test',
    readinessProbe: async () => undefined,
    contentRouter: storyboardRouter,
  });
}

function cookie(token = 'tenant-session'): string {
  return `videoagent_session=${token}`;
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((child) => collectKeys(child, keys));
    return keys;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      keys.add(key);
      collectKeys(child, keys);
    });
  }
  return keys;
}

const expectedVersionDto = {
  id: IDS.storyboardVersionId,
  projectId: IDS.projectId,
  scriptVersionId: IDS.scriptVersionId,
  version: 1,
  status: 'draft',
  shots: [
    {
      shotId: IDS.shotId,
      sequence: 1,
      description: 'Opening shot',
      durationSeconds: 5,
      sourceMode: 'mixed',
    },
  ],
  draftProvenance: {
    draftRevisionId: IDS.draftRevisionId,
    draftRevisionNumber: 1,
    previousDraftRevisionId: null,
    sourceCommandId: IDS.commandId,
    sourceReceiptId: IDS.receiptId,
    generationPolicyVersion: '1.0.0',
    validationSummary: 'passed',
  },
  createdBy: IDS.userId,
  createdAt: '2026-08-11T03:00:02.000Z',
};

const expectedApprovalDto = {
  id: IDS.approvalId,
  projectId: IDS.projectId,
  storyboardVersionId: IDS.storyboardVersionId,
  status: 'approved',
  factRiskStatus: 'cleared',
  reason: null,
  actedBy: IDS.userId,
  actedAt: '2026-08-11T03:00:03.000Z',
};

describe('Storyboard HTTP routes', () => {
  it('requires a real Session Cookie and preserves Request ID on 401', async () => {
    const authorityService = service();
    const response = await request(testApp(authorityService))
      .get(`/api/v1/projects/${IDS.projectId}/storyboard-versions`)
      .set('x-request-id', 'storyboard-request-401');

    expect(response.status).toBe(401);
    expect(response.headers['x-request-id']).toBe('storyboard-request-401');
    expect(response.body).toEqual({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: '请先登录。',
        requestId: 'storyboard-request-401',
      },
    });
    expect(authorityService.listVersions).not.toHaveBeenCalled();
  });

  it('rejects PLATFORM context with 403 before Policy or authority service', async () => {
    const authorityService = service();
    const projectPolicy = policy();
    const response = await request(testApp(authorityService, projectPolicy))
      .get(`/api/v1/projects/${IDS.projectId}/storyboard-versions`)
      .set('cookie', cookie('platform-session'));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('TENANT_CONTEXT_REQUIRED');
    expect(projectPolicy.resolveProjectAccess).not.toHaveBeenCalled();
    expect(authorityService.listVersions).not.toHaveBeenCalled();
  });

  it('lists exact browser Storyboard DTOs while redacting authority-only fields and digests', async () => {
    const response = await request(testApp())
      .get(`/api/v1/projects/${IDS.projectId}/storyboard-versions`)
      .set('cookie', cookie());

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ storyboardVersions: [expectedVersionDto] });
    const keys = collectKeys(response.body);
    expect(keys).not.toContain('tenantId');
    expect(keys).not.toContain('approvedScriptDigest');
    expect(keys).not.toContain('payloadDigest');
    expect(keys).not.toContain('scriptPayloadDigest');
    expect(keys).not.toContain('storyboardPayloadDigest');
    expect(keys).not.toContain('receiptDigest');
    expect(keys).not.toContain('eventDigest');
  });

  it('creates a version from strict draftRevision body and header-only idempotency', async () => {
    const createVersion = vi.fn(async () => ({ value: version(), replayed: false }));
    const authorityService = service({ createVersion });
    const body = { draftRevision: draft() };
    const response = await request(testApp(authorityService))
      .post(`/api/v1/projects/${IDS.projectId}/storyboard-versions`)
      .set('cookie', cookie('rotating-session'))
      .set('idempotency-key', 'storyboard-create-001')
      .send(body);

    expect(response.status).toBe(201);
    expect(response.headers['idempotency-replayed']).toBe('false');
    expect(response.headers['set-cookie']?.[0]).toContain('videoagent_session=rotated-token');
    expect(response.body).toEqual(expectedVersionDto);
    expect(createVersion).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: IDS.tenantId, organizationType: 'TENANT' }),
      IDS.projectId,
      { draft: body.draftRevision, idempotencyKey: 'storyboard-create-001' },
    );
  });

  it('returns 200 plus idempotency-replayed on mutation replay', async () => {
    const authorityService = service({
      createVersion: vi.fn(async () => ({ value: version(), replayed: true })),
      createApproval: vi.fn(async () => ({ value: approval(), replayed: true })),
    });
    const application = testApp(authorityService);

    const versionResponse = await request(application)
      .post(`/api/v1/projects/${IDS.projectId}/storyboard-versions`)
      .set('cookie', cookie())
      .set('idempotency-key', 'storyboard-create-replay')
      .send({ draftRevision: draft() });
    const approvalResponse = await request(application)
      .post(
        `/api/v1/projects/${IDS.projectId}/storyboard-versions/${IDS.storyboardVersionId}/approvals`,
      )
      .set('cookie', cookie())
      .set('idempotency-key', 'storyboard-approval-replay')
      .send({ expectedVersion: 1, status: 'approved', factRiskStatus: 'cleared' });

    expect(versionResponse.status).toBe(200);
    expect(versionResponse.headers['idempotency-replayed']).toBe('true');
    expect(approvalResponse.status).toBe(200);
    expect(approvalResponse.headers['idempotency-replayed']).toBe('true');
  });

  it('lists and creates exact browser Approval DTOs without sequence or event digest', async () => {
    const createApproval = vi.fn(async () => ({ value: approval(), replayed: false }));
    const authorityService = service({ createApproval });
    const application = testApp(authorityService);
    const path = `/api/v1/projects/${IDS.projectId}/storyboard-versions/${IDS.storyboardVersionId}/approvals`;

    const listed = await request(application).get(path).set('cookie', cookie());
    const created = await request(application)
      .post(path)
      .set('cookie', cookie())
      .set('idempotency-key', 'storyboard-approval-001')
      .send({
        expectedVersion: 1,
        status: 'approved',
        factRiskStatus: 'cleared',
      });

    expect(listed.status).toBe(200);
    expect(listed.body).toEqual({ storyboardApprovals: [expectedApprovalDto] });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(expectedApprovalDto);
    expect(createApproval).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: IDS.tenantId }),
      IDS.projectId,
      IDS.storyboardVersionId,
      {
        expectedVersion: 1,
        status: 'approved',
        factRiskStatus: 'cleared',
        idempotencyKey: 'storyboard-approval-001',
      },
    );
    const keys = collectKeys({ listed: listed.body, created: created.body });
    expect(keys).not.toContain('tenantId');
    expect(keys).not.toContain('sequence');
    expect(keys).not.toContain('eventDigest');
  });

  it('returns 422 for missing idempotency header or non-exact request bodies', async () => {
    const authorityService = service();
    const application = testApp(authorityService);

    const missingKey = await request(application)
      .post(`/api/v1/projects/${IDS.projectId}/storyboard-versions`)
      .set('cookie', cookie())
      .send({ draftRevision: draft() });
    const extraVersionField = await request(application)
      .post(`/api/v1/projects/${IDS.projectId}/storyboard-versions`)
      .set('cookie', cookie())
      .set('idempotency-key', 'storyboard-create-extra')
      .send({ draftRevision: draft(), idempotencyKey: 'body-key-forbidden' });
    const extraApprovalField = await request(application)
      .post(
        `/api/v1/projects/${IDS.projectId}/storyboard-versions/${IDS.storyboardVersionId}/approvals`,
      )
      .set('cookie', cookie())
      .set('idempotency-key', 'storyboard-approval-extra')
      .send({
        expectedVersion: 1,
        status: 'approved',
        factRiskStatus: 'cleared',
        review: true,
      });

    for (const response of [missingKey, extraVersionField, extraApprovalField]) {
      expect(response.status).toBe(422);
      expect(response.body.error).toMatchObject({ code: 'STORYBOARD_INPUT_INVALID' });
    }
    expect(authorityService.createVersion).not.toHaveBeenCalled();
    expect(authorityService.createApproval).not.toHaveBeenCalled();
  });

  it('allows read policy but rejects viewer writes with 403', async () => {
    const authorityService = service();
    const application = testApp(authorityService, policy('viewer'));

    const listed = await request(application)
      .get(`/api/v1/projects/${IDS.projectId}/storyboard-versions`)
      .set('cookie', cookie());
    const created = await request(application)
      .post(`/api/v1/projects/${IDS.projectId}/storyboard-versions`)
      .set('cookie', cookie())
      .set('idempotency-key', 'viewer-write')
      .send({ draftRevision: draft() });

    expect(listed.status).toBe(200);
    expect(created.status).toBe(403);
    expect(created.body.error.code).toBe('PERMISSION_DENIED');
    expect(authorityService.createVersion).not.toHaveBeenCalled();
  });

  it('makes unknown Project and cross-tenant Storyboard resource equivalent safe 404s', async () => {
    const notFoundService = service({
      listVersions: vi.fn(async () => {
        throw new StoryboardAuthorityError('STORYBOARD_NOT_FOUND');
      }),
      listApprovals: vi.fn(async () => {
        throw new StoryboardAuthorityError('STORYBOARD_NOT_FOUND');
      }),
    });
    const unknownProject = await request(testApp(service(), policy(null)))
      .get(`/api/v1/projects/${IDS.projectId}/storyboard-versions`)
      .set('cookie', cookie())
      .set('x-request-id', 'safe-not-found');
    const crossTenantResource = await request(testApp(notFoundService))
      .get(
        `/api/v1/projects/${IDS.projectId}/storyboard-versions/${IDS.storyboardVersionId}/approvals`,
      )
      .set('cookie', cookie())
      .set('x-request-id', 'safe-not-found');

    expect(unknownProject.status).toBe(404);
    expect(crossTenantResource.status).toBe(404);
    expect(unknownProject.body).toEqual(crossTenantResource.body);
    expect(JSON.stringify(unknownProject.body)).not.toContain(IDS.otherTenantId);
  });

  it('maps stale/state/idempotency errors to 409 and sanitizes unexpected 500 errors', async () => {
    const approvalPath =
      `/api/v1/projects/${IDS.projectId}/storyboard-versions/` +
      `${IDS.storyboardVersionId}/approvals`;
    const conflictCodes = [
      'STORYBOARD_STALE_VERSION',
      'STORYBOARD_APPROVAL_STATE_INVALID',
      'STORYBOARD_IDEMPOTENCY_CONFLICT',
    ] as const;
    const conflicts = await Promise.all(
      conflictCodes.map((code) =>
        request(
          testApp(
            service({
              createApproval: vi.fn(async () => {
                throw new StoryboardAuthorityError(code);
              }),
            }),
          ),
        )
          .post(approvalPath)
          .set('cookie', cookie())
          .set('idempotency-key', `conflict-${code.toLowerCase()}`)
          .send({ expectedVersion: 1, status: 'approved', factRiskStatus: 'cleared' }),
      ),
    );

    const sensitive = `select tenant_id='${IDS.otherTenantId}' payload_digest='sha256:${'d'.repeat(64)}'`;
    const failed = await request(
      testApp(
        service({
          listVersions: vi.fn(async () => {
            throw new Error(sensitive);
          }),
        }),
      ),
    )
      .get(`/api/v1/projects/${IDS.projectId}/storyboard-versions`)
      .set('cookie', cookie())
      .set('x-request-id', 'storyboard-safe-500');

    conflicts.forEach((response, index) => {
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe(conflictCodes[index]);
    });
    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({
      error: {
        code: 'STORYBOARD_STORAGE_ERROR',
        message: 'Storyboard authority is unavailable.',
        requestId: 'storyboard-safe-500',
      },
    });
    expect(failed.text).not.toContain(sensitive);
    expect(failed.text).not.toContain(IDS.otherTenantId);
    expect(failed.text).not.toContain('payload_digest');
  });
});
