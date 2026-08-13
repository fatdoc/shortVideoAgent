import { describe, expect, it } from 'vitest';
import {
  canonicalStoryboardDraftPayload,
  createStoryboardDraftRevision,
  parseStoryboardDraftRevision,
  storyboardDraftPayloadDigest,
} from './contract.js';

const IDS = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  scriptVersionId: '33333333-3333-4333-8333-333333333333',
  draftRevisionId: '44444444-4444-4444-8444-444444444444',
  shotId: '55555555-5555-4555-8555-555555555555',
  commandId: '66666666-6666-4666-8666-666666666666',
  receiptId: '77777777-7777-4777-8777-777777777777',
} as const;

const DIGESTS = {
  approvedScript: `sha256:${'a'.repeat(64)}`,
  receipt: `sha256:${'b'.repeat(64)}`,
} as const;

function validUnsignedDraft() {
  return {
    objectType: 'StoryboardDraftRevision' as const,
    contractVersion: '0.2' as const,
    status: 'draft' as const,
    tenantId: IDS.tenantId,
    projectId: IDS.projectId,
    approvedScriptVersionId: IDS.scriptVersionId,
    approvedScriptDigest: DIGESTS.approvedScript,
    draftRevisionId: IDS.draftRevisionId,
    revisionNumber: 1,
    previousRevisionId: null,
    shots: [
      {
        shotId: IDS.shotId,
        sequence: 1,
        description: 'Opening controlled pilot shot.',
        durationSeconds: 5,
        sourceMode: 'mixed' as const,
      },
    ],
    sourceReceipt: {
      providerId: 'openai',
      sourceSystem: 'storycanvas',
      sourceContractVersion: '0.2',
      commandId: IDS.commandId,
      receiptId: IDS.receiptId,
      receiptDigest: DIGESTS.receipt,
      receivedAt: '2026-08-11T03:00:00.000Z',
    },
    generationPolicy: {
      policyId: 'storyboard-draft-default',
      policyVersion: '1.0.0',
    },
    validationSummary: {
      status: 'passed' as const,
      issueCodes: [],
    },
    createdAt: '2026-08-11T03:00:01.000Z',
  };
}

function reverseObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .reverse()
        .map(([key, child]) => [key, reverseObjectKeys(child)]),
    );
  }
  return value;
}

describe('StoryboardDraftRevision contract', () => {
  it('fails closed when approved Script digest or source Receipt provenance is absent', () => {
    const withoutScriptDigest = { ...validUnsignedDraft() } as Record<string, unknown>;
    delete withoutScriptDigest.approvedScriptDigest;

    expect(() => createStoryboardDraftRevision(withoutScriptDigest)).toThrowError(
      expect.objectContaining({ code: 'STORYBOARD_SCHEMA_INVALID' }),
    );

    const withoutSourceReceipt = { ...validUnsignedDraft() } as Record<string, unknown>;
    delete withoutSourceReceipt.sourceReceipt;

    expect(() => createStoryboardDraftRevision(withoutSourceReceipt)).toThrowError(
      expect.objectContaining({ code: 'STORYBOARD_SCHEMA_INVALID' }),
    );
  });

  it('creates and parses a strict draft bound to canonical scope, Script, and Receipt provenance', () => {
    const draft = createStoryboardDraftRevision(validUnsignedDraft());

    expect(draft.payloadDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(parseStoryboardDraftRevision(draft)).toEqual(draft);
  });

  it('canonicalizes recursively so property insertion order cannot change serialization or digest', () => {
    const draft = validUnsignedDraft();
    const reordered = reverseObjectKeys(draft);

    expect(canonicalStoryboardDraftPayload(reordered)).toBe(canonicalStoryboardDraftPayload(draft));
    expect(storyboardDraftPayloadDigest(reordered)).toBe(storyboardDraftPayloadDigest(draft));
    expect(storyboardDraftPayloadDigest(draft)).toBe(
      'sha256:9629fac81a0ff6ad9d1f000859ddde78569864ff13da72717ee2bffeda6501e8',
    );
  });

  it('rejects a payload whose immutable digest no longer matches its content', () => {
    const draft = createStoryboardDraftRevision(validUnsignedDraft());
    const tampered = {
      ...draft,
      shots: [{ ...draft.shots[0], description: 'Tampered storyboard content.' }],
    };

    expect(() => parseStoryboardDraftRevision(tampered)).toThrowError(
      expect.objectContaining({ code: 'STORYBOARD_DIGEST_MISMATCH' }),
    );
  });

  it.each([
    ['non-UUID project scope', { projectId: 'project-pilot-01' }],
    ['uppercase digest', { approvedScriptDigest: `sha256:${'A'.repeat(64)}` }],
    ['non-canonical timestamp', { createdAt: '2026-08-11T11:00:01+08:00' }],
    ['unknown top-level property', { approvalStatus: 'approved' }],
  ])('rejects %s with a stable schema error', (_label, patch) => {
    expect(() => createStoryboardDraftRevision({ ...validUnsignedDraft(), ...patch })).toThrowError(
      expect.objectContaining({ code: 'STORYBOARD_SCHEMA_INVALID' }),
    );
  });

  it('recursively rejects secret-bearing fields without echoing the sensitive value', () => {
    const sensitiveValue = 'Bearer should-never-be-returned';
    const unsafe = validUnsignedDraft() as ReturnType<typeof validUnsignedDraft> & {
      sourceReceipt: ReturnType<typeof validUnsignedDraft>['sourceReceipt'] & {
        metadata: { authorization: string };
      };
    };
    unsafe.sourceReceipt.metadata = { authorization: sensitiveValue };

    let thrown: unknown;
    try {
      createStoryboardDraftRevision(unsafe);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toEqual(expect.objectContaining({ code: 'STORYBOARD_SECRET_FIELD_FORBIDDEN' }));
    expect(String(thrown)).not.toContain(sensitiveValue);
    expect(JSON.stringify(thrown)).not.toContain(sensitiveValue);
  });

  it('requires contiguous ordered Shots and coherent revision lineage', () => {
    expect(() =>
      createStoryboardDraftRevision({
        ...validUnsignedDraft(),
        shots: [
          { ...validUnsignedDraft().shots[0], sequence: 2 },
          {
            ...validUnsignedDraft().shots[0],
            shotId: '88888888-8888-4888-8888-888888888888',
            sequence: 4,
          },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: 'STORYBOARD_SCHEMA_INVALID' }));

    expect(() =>
      createStoryboardDraftRevision({
        ...validUnsignedDraft(),
        revisionNumber: 2,
        previousRevisionId: null,
      }),
    ).toThrowError(expect.objectContaining({ code: 'STORYBOARD_SCHEMA_INVALID' }));
  });
});
