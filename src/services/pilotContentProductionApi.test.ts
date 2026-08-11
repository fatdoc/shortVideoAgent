import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PilotRuntime } from '../config/pilotRuntime';
import {
  createPilotContentProductionApi,
  type PilotCanvasEntry,
  type PilotProductionEligibility,
  type PilotProductionPackage,
  type PilotScriptVersion,
  type PilotStoryboardVersion,
} from './pilotContentProductionApi';

const runtime: PilotRuntime = {
  mode: 'pilot',
  controlApiBaseUrl: 'https://control.example.com',
  configurationError: null,
};
const projectId = '10000000-0000-4000-8000-000000000001';
const scriptVersionId = '10000000-0000-4000-8000-000000000002';
const storyboardVersionId = '10000000-0000-4000-8000-000000000003';
const packageId = '10000000-0000-4000-8000-000000000004';
const entryHandle = `ce_${'h'.repeat(32)}`;
const actorId = '10000000-0000-4000-8000-000000000006';
const tenantId = '10000000-0000-4000-8000-000000000008';
const approvalId = '10000000-0000-4000-8000-000000000007';
const digest = `sha256:${'a'.repeat(64)}`;

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

const scriptVersionResponse = {
  id: scriptVersionId,
  projectId,
  version: 1,
  status: 'approved',
  payload: { title: 'Pilot Script', content: 'Approved content' },
  createdBy: actorId,
  createdAt: '2026-08-11T01:00:00.000Z',
} as const;
const scriptVersion: PilotScriptVersion = scriptVersionResponse;

const storyboardDraftRevision = {
  objectType: 'StoryboardDraftRevision',
  contractVersion: '0.2',
  status: 'draft',
  tenantId,
  projectId,
  approvedScriptVersionId: scriptVersionId,
  approvedScriptDigest: digest,
  draftRevisionId: '10000000-0000-4000-8000-000000000010',
  revisionNumber: 1,
  previousRevisionId: null,
  shots: [
    {
      shotId: '10000000-0000-4000-8000-000000000009',
      sequence: 1,
      durationSeconds: 5,
      description: 'Opening shot',
      sourceMode: 'mixed',
    },
  ],
  sourceReceipt: {
    providerId: 'storycanvas',
    sourceSystem: 'storycanvas',
    sourceContractVersion: '0.2',
    commandId: '10000000-0000-4000-8000-000000000011',
    receiptId: '10000000-0000-4000-8000-000000000012',
    receiptDigest: digest,
    receivedAt: '2026-08-11T01:00:30.000Z',
  },
  generationPolicy: {
    policyId: 'storyboard-draft-default',
    policyVersion: '1.0.0',
  },
  validationSummary: { status: 'passed', issueCodes: [] },
  createdAt: '2026-08-11T01:00:31.000Z',
  payloadDigest: digest,
} as const;

const storyboardVersionResponse = {
  id: storyboardVersionId,
  projectId,
  scriptVersionId,
  version: 1,
  status: 'approved',
  shots: [
    {
      shotId: '10000000-0000-4000-8000-000000000009',
      sequence: 1,
      durationSeconds: 5,
      description: 'Opening shot',
      sourceMode: 'mixed',
    },
  ],
  draftProvenance: {
    draftRevisionId: 'draft-revision-1',
    draftRevisionNumber: 1,
    previousDraftRevisionId: null,
    sourceCommandId: 'command-1',
    sourceReceiptId: 'receipt-1',
    generationPolicyVersion: 'storyboard-policy-v1',
    validationSummary: 'validated',
  },
  createdBy: actorId,
  createdAt: '2026-08-11T01:01:00.000Z',
} as const;
const storyboardVersion: PilotStoryboardVersion = {
  id: storyboardVersionId,
  projectId,
  scriptVersionId,
  version: 1,
  status: 'approved',
  shots: storyboardVersionResponse.shots.map((shot) => ({ ...shot })),
  draftProvenance: { ...storyboardVersionResponse.draftProvenance },
  createdBy: actorId,
  createdAt: '2026-08-11T01:01:00.000Z',
};

const approvalResponse = {
  id: approvalId,
  projectId,
  storyboardVersionId,
  status: 'approved',
  factRiskStatus: 'cleared',
  reason: null,
  actedBy: actorId,
  actedAt: '2026-08-11T01:02:00.000Z',
} as const;

const eligibilityResponse = {
  projectId,
  eligible: true,
  scriptVersionId,
  scriptVersion: 1,
  storyboardVersionId,
  storyboardVersion: 1,
  reasonCode: 'ELIGIBLE',
  scriptApproval: {
    id: approvalId,
    projectId,
    scriptVersionId,
    status: 'approved',
    factRiskStatus: 'cleared',
    reason: null,
    actedBy: actorId,
    actedAt: '2026-08-11T01:02:00.000Z',
  },
  storyboardApproval: approvalResponse,
} as const;
const eligibility: PilotProductionEligibility = eligibilityResponse;

const packageResponse = {
  objectType: 'ProjectProductionPackage',
  contractVersion: '0.3',
  tenantId,
  projectId,
  packageId,
  packageVersion: 1,
  scriptVersionId,
  storyboardVersionId,
  capabilityRequirements: ['video.generate'],
  status: 'ready',
  payloadDigest: digest,
  approvedScriptDigest: digest,
  approvedStoryboardDigest: digest,
  createdAt: '2026-08-11T01:03:00.000Z',
  expiresAt: '2026-08-11T02:03:00.000Z',
} as const;
const packageProjection: PilotProductionPackage = {
  objectType: 'ProjectProductionPackage',
  contractVersion: '0.3',
  projectId,
  packageId,
  packageVersion: 1,
  scriptVersionId,
  storyboardVersionId,
  capabilityRequirements: ['video.generate'],
  status: 'ready',
  createdAt: '2026-08-11T01:03:00.000Z',
  expiresAt: '2026-08-11T02:03:00.000Z',
};

const canvasEntryResponse = {
  objectType: 'CanvasEntry',
  contractVersion: '0.2',
  handle: entryHandle,
  tenantId,
  projectId,
  packageId,
  state: 'active',
  issuedAt: '2026-08-11T01:04:00.000Z',
  expiresAt: '2026-08-11T01:06:00.000Z',
} as const;
const canvasEntry: PilotCanvasEntry = canvasEntryResponse;

describe('pilotContentProductionApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('lists Script versions through a strict Cookie/no-store GET without Demo fallback', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ scriptVersions: [scriptVersionResponse] }));
    const api = createPilotContentProductionApi({ runtime, fetchImpl });

    await expect(api.listScriptVersions(projectId)).resolves.toEqual([scriptVersion]);
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://control.example.com/api/v1/projects/${projectId}/script-versions`,
      expect.objectContaining({ method: 'GET', credentials: 'include', cache: 'no-store' }),
    );
    expect(window.localStorage.length).toBe(0);
  });

  it('creates Script and Storyboard authority facts with exact paths, bodies and stable idempotency keys', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scriptVersionResponse, 201))
      .mockResolvedValueOnce(jsonResponse(storyboardVersionResponse, 201))
      .mockResolvedValueOnce(jsonResponse(approvalResponse, 201));
    const api = createPilotContentProductionApi({ runtime, fetchImpl });

    await expect(
      api.createScriptVersion(
        projectId,
        { payload: { title: 'Pilot Script', content: 'Approved content' } },
        'script-create-1',
      ),
    ).resolves.toEqual({ value: scriptVersion, replayed: false });
    await expect(
      api.createStoryboardVersion(
        projectId,
        {
          draftRevision: {
            ...storyboardDraftRevision,
            shots: storyboardDraftRevision.shots.map((shot) => ({ ...shot })),
            sourceReceipt: { ...storyboardDraftRevision.sourceReceipt },
            generationPolicy: { ...storyboardDraftRevision.generationPolicy },
            validationSummary: {
              ...storyboardDraftRevision.validationSummary,
              issueCodes: [...storyboardDraftRevision.validationSummary.issueCodes],
            },
          },
        },
        'storyboard-create-1',
      ),
    ).resolves.toEqual({ value: storyboardVersion, replayed: false });
    await expect(
      api.createStoryboardApproval(
        projectId,
        storyboardVersionId,
        { expectedVersion: 1, status: 'approved', factRiskStatus: 'cleared' },
        'storyboard-approve-1',
      ),
    ).resolves.toEqual({ value: approvalResponse, replayed: false });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      `https://control.example.com/api/v1/projects/${projectId}/script-versions`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ payload: { title: 'Pilot Script', content: 'Approved content' } }),
        headers: expect.objectContaining({ 'Idempotency-Key': 'script-create-1' }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      `https://control.example.com/api/v1/projects/${projectId}/storyboard-versions`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ draftRevision: storyboardDraftRevision }),
        headers: expect.objectContaining({ 'Idempotency-Key': 'storyboard-create-1' }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      `https://control.example.com/api/v1/projects/${projectId}/storyboard-versions/${storyboardVersionId}/approvals`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          expectedVersion: 1,
          status: 'approved',
          factRiskStatus: 'cleared',
        }),
        headers: expect.objectContaining({ 'Idempotency-Key': 'storyboard-approve-1' }),
      }),
    );
  });

  it('strictly parses Storyboard and Production eligibility DTOs and rejects extra fields', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ storyboardVersions: [storyboardVersionResponse] }))
      .mockResolvedValueOnce(jsonResponse(eligibilityResponse))
      .mockResolvedValueOnce(
        jsonResponse({
          storyboardVersions: [{ ...storyboardVersionResponse, serverStack: 'private' }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          storyboardVersions: [{ ...storyboardVersionResponse, storyboardPayloadDigest: digest }],
        }),
      );
    const api = createPilotContentProductionApi({ runtime, fetchImpl });

    await expect(api.listStoryboardVersions(projectId)).resolves.toEqual([storyboardVersion]);
    await expect(api.readProductionEligibility(projectId)).resolves.toEqual(eligibility);
    await expect(api.listStoryboardVersions(projectId)).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      status: 200,
    });
    await expect(api.listStoryboardVersions(projectId)).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      status: 200,
    });
  });

  it('creates and reads a digest-redacted Production Package projection', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(packageResponse, 201))
      .mockResolvedValueOnce(jsonResponse(packageResponse));
    const api = createPilotContentProductionApi({ runtime, fetchImpl });

    await expect(
      api.createProductionPackage(
        projectId,
        {
          scriptVersionId,
          storyboardVersionId,
          capabilityRequirements: ['video.generate'],
          expiresInSeconds: 3600,
        },
        'package-create-1',
      ),
    ).resolves.toEqual({ value: packageProjection, replayed: false });
    await expect(api.readProductionPackage(projectId, packageId)).resolves.toEqual(
      packageProjection,
    );
    expect(JSON.stringify(packageProjection)).not.toContain('digest');
  });

  it('creates and reads only an exact non-secret Canvas Entry projection', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(canvasEntryResponse, 201))
      .mockResolvedValueOnce(jsonResponse(canvasEntryResponse));
    const api = createPilotContentProductionApi({ runtime, fetchImpl });

    await expect(
      api.createCanvasEntry(projectId, { packageId, ttlSeconds: 120 }, 'canvas-entry-1'),
    ).resolves.toEqual({ value: canvasEntry, replayed: false });
    await expect(api.readCanvasEntry(projectId, entryHandle)).resolves.toEqual(canvasEntry);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      `https://control.example.com/api/v1/projects/${projectId}/canvas-entries`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ packageId, ttlSeconds: 120 }),
        headers: expect.objectContaining({ 'Idempotency-Key': 'canvas-entry-1' }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      `https://control.example.com/api/v1/projects/${projectId}/canvas-entries/${entryHandle}`,
      expect.objectContaining({ method: 'GET', credentials: 'include', cache: 'no-store' }),
    );
    expect(JSON.stringify(canvasEntry)).not.toMatch(
      /token|authorization|cookie|secret|password|digest/i,
    );
  });

  it.each([
    { accessToken: 'signed.token' },
    { nested: { authorization: 'Bearer signed.token' } },
    { nested: [{ cookie: 'videoagent_session=private' }] },
    { metadata: { approvedStoryboardDigest: digest } },
    { password: 'private' },
    { displayName: 'unplanned even when harmless' },
  ])('rejects unplanned or secret-bearing Canvas Entry fields: %o', async (secretField) => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ...canvasEntryResponse, ...secretField }));
    const api = createPilotContentProductionApi({ runtime, fetchImpl });

    await expect(api.readCanvasEntry(projectId, entryHandle)).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      status: 200,
    });
  });

  it('preserves 401/403/404/409/410/422/503 and Request ID without mock fallback', async () => {
    const fetchImpl = vi.fn();
    const api = createPilotContentProductionApi({ runtime, fetchImpl });

    for (const [status, code] of [
      [401, 'SESSION_REQUIRED'],
      [403, 'CAPABILITY_SCOPE_DENIED'],
      [404, 'PROJECT_NOT_FOUND'],
      [409, 'IDEMPOTENCY_CONFLICT'],
      [410, 'CANVAS_ENTRY_EXPIRED'],
      [422, 'SCHEMA_INVALID'],
      [503, 'PROVIDER_UNAVAILABLE'],
    ] as const) {
      fetchImpl.mockResolvedValueOnce(
        jsonResponse(
          { error: { code, message: 'private stack', requestId: `req-${status}` } },
          status,
        ),
      );
      await expect(api.readCanvasEntry(projectId, entryHandle)).rejects.toMatchObject({
        status,
        code,
        requestId: `req-${status}`,
      });
    }
    expect(window.localStorage.length).toBe(0);
  });

  it('allows retry only for GET or an explicitly identical idempotent mutation', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'PROVIDER_UNAVAILABLE' } }, 503))
      .mockResolvedValueOnce(jsonResponse(canvasEntryResponse))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'PROVIDER_UNAVAILABLE' } }, 503))
      .mockResolvedValueOnce(jsonResponse(canvasEntryResponse, 201));
    const api = createPilotContentProductionApi({ runtime, fetchImpl });

    await expect(api.readCanvasEntry(projectId, entryHandle, { maxAttempts: 2 })).resolves.toEqual(
      canvasEntry,
    );
    await expect(
      api.createCanvasEntry(projectId, { packageId, ttlSeconds: 120 }, 'same-entry-key', {
        maxAttempts: 2,
      }),
    ).resolves.toEqual({ value: canvasEntry, replayed: false });

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl.mock.calls[2]?.[1]).toEqual(fetchImpl.mock.calls[3]?.[1]);
  });
});
