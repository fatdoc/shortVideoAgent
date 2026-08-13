import { describe, expect, it, vi } from 'vitest';
import type { SessionActor } from '../projects/types.js';
import { contractPayloadDigest, tokenDigest } from '../production/digest.js';
import type { ProjectGrant, ProjectProductionPackageV03 } from '../production/types.js';
import { CanvasEntryService } from './service.js';
import type {
  CanvasEntryRedemptionValue,
  CanvasEntryStore,
  RedeemCanvasEntryInput,
} from './types.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const packageId = '33333333-3333-4333-8333-333333333333';
const grantId = '44444444-4444-4444-8444-444444444444';
const userId = '55555555-5555-4555-8555-555555555555';
const scriptVersionId = '88888888-8888-4888-8888-888888888888';
const storyboardVersionId = '99999999-9999-4999-8999-999999999999';
const handle = `ce_${'A'.repeat(32)}`;
const digestSecret = 'canvas-entry-service-test-secret-32-bytes-minimum';
const accessToken = 'eyJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJncmFudCJ9.signature';
const approvedScriptDigest = `sha256:${'1'.repeat(64)}`;
const approvedStoryboardDigest = `sha256:${'2'.repeat(64)}`;

const actor: SessionActor = {
  userId,
  membershipId: '66666666-6666-4666-8666-666666666666',
  organizationId: '77777777-7777-4777-8777-777777777777',
  organizationType: 'TENANT',
  tenantId,
  membershipVersion: 1,
  primaryRole: 'tenant_admin',
  roles: ['tenant_admin'],
};

const publicEntry = {
  objectType: 'CanvasEntry' as const,
  contractVersion: '0.2' as const,
  handle,
  tenantId,
  projectId,
  packageId,
  state: 'active' as const,
  issuedAt: '2026-08-11T03:00:00.000Z',
  expiresAt: '2026-08-11T03:02:00.000Z',
};

function productionPackage(): ProjectProductionPackageV03 {
  const unsigned = {
    objectType: 'ProjectProductionPackage' as const,
    contractVersion: '0.3' as const,
    status: 'ready' as const,
    tenantId,
    projectId,
    idempotencyKey: 'package-create-1',
    occurredAt: '2026-08-11T02:00:00.000Z',
    packageId,
    packageVersion: 1,
    organizationId: tenantId,
    scriptVersionId,
    storyboardVersionId,
    approvedScriptDigest,
    approvedStoryboardDigest,
    briefSnapshot: {
      briefVersionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      objective: 'Create a controlled pilot video.',
      audience: ['pilot-users'],
      platforms: ['douyin'],
    },
    brandPolicySnapshot: {
      facts: [],
      prohibitedTerms: [],
      requiredDisclosures: ['internal-controlled-pilot'],
      sourceDigest: `sha256:${'3'.repeat(64)}`,
    },
    approvedScript: {
      scriptVersionId,
      payloadDigest: approvedScriptDigest,
      content: 'Approved script held only on the server.',
      approvedAt: '2026-08-11T01:58:00.000Z',
      approvedBy: userId,
    },
    approvedStoryboard: {
      storyboardVersionId,
      scriptVersionId,
      scriptPayloadDigest: approvedScriptDigest,
      payloadDigest: approvedStoryboardDigest,
      approvedAt: '2026-08-11T01:59:00.000Z',
      approvedBy: userId,
    },
    storyboard: [
      {
        shotId: 'shot-1',
        sequence: 1,
        description: 'Opening shot.',
        durationSeconds: 5,
        sourceMode: 'mixed' as const,
      },
    ],
    target: {
      aspectRatio: '9:16',
      durationSeconds: 15,
      container: 'mp4' as const,
      videoCodec: 'h264' as const,
    },
    capabilityRequirements: ['video.generate' as const],
    createdAt: '2026-08-11T02:00:00.000Z',
    expiresAt: '2026-08-11T04:00:00.000Z',
  };
  return { ...unsigned, payloadDigest: contractPayloadDigest(unsigned) };
}

function projectGrant(): ProjectGrant {
  const unsigned = {
    objectType: 'ProjectGrant' as const,
    contractVersion: '0.2' as const,
    tenantId,
    projectId,
    idempotencyKey: 'grant-issue-1',
    occurredAt: '2026-08-11T02:30:00.000Z',
    grantId,
    packageId,
    capabilities: ['video.generate' as const],
    scopes: ['production.package.read' as const, 'production.task.write' as const],
    tokenDigest: tokenDigest(accessToken),
    keyId: 'pilot-project-grant-hs256-v1',
    issuedAt: '2026-08-11T02:30:00.000Z',
    expiresAt: '2026-08-11T03:10:00.000Z',
  };
  return { ...unsigned, payloadDigest: contractPayloadDigest(unsigned) };
}

function redemptionValue(
  overrides: Partial<CanvasEntryRedemptionValue> = {},
): CanvasEntryRedemptionValue {
  return {
    objectType: 'CanvasEntryRedemption',
    contractVersion: '0.1',
    handle,
    tenantId,
    projectId,
    packageId,
    consumedAt: '2026-08-11T03:00:00.000Z',
    productionPackage: productionPackage(),
    grant: projectGrant(),
    tokenType: 'Bearer',
    accessToken,
    ...overrides,
  };
}

const redeemInput: RedeemCanvasEntryInput = {
  handle,
  tenantId,
  projectId,
  packageId,
  idempotencyKey: 'canvas-entry-redeem-1',
  redeemedBy: 'storycanvas-production-plane',
};

function stores(overrides: Partial<CanvasEntryStore> = {}): CanvasEntryStore {
  return {
    createEntry: vi.fn<CanvasEntryStore['createEntry']>(),
    readEntry: vi.fn<CanvasEntryStore['readEntry']>(),
    redeemEntry: vi.fn<CanvasEntryStore['redeemEntry']>(),
    ...overrides,
  };
}

function service(store: CanvasEntryStore): CanvasEntryService {
  return new CanvasEntryService(store, digestSecret, {
    now: () => new Date('2026-08-11T03:00:00.000Z'),
    generateHandle: () => handle,
  });
}

describe('CanvasEntryService', () => {
  it('builds a stable scoped create record without raw Grant or token material', async () => {
    const createEntry = vi.fn<CanvasEntryStore['createEntry']>(async () => ({
      value: publicEntry,
      replayed: false,
    }));
    const entryService = service(stores({ createEntry }));

    const result = await entryService.createEntry(actor, projectId, {
      packageId,
      idempotencyKey: 'canvas-entry-create-1',
      ttlSeconds: 120,
    });

    expect(result).toEqual({ value: publicEntry, replayed: false });
    expect(JSON.stringify(result)).not.toContain('requestDigest');
    expect(JSON.stringify(result)).not.toContain('sha256:');

    expect(createEntry).toHaveBeenCalledWith({
      tenantId,
      projectId,
      packageId,
      handle,
      idempotencyKey: 'canvas-entry-create-1',
      requestDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      issuedAt: new Date('2026-08-11T03:00:00.000Z'),
      expiresAt: new Date('2026-08-11T03:02:00.000Z'),
      createdBy: userId,
    });
    const persisted = createEntry.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(Object.keys(persisted)).not.toEqual(
      expect.arrayContaining([
        'accessToken',
        'tokenDigest',
        'rawGrant',
        'authorization',
        'providerPayload',
      ]),
    );
  });

  it('produces a stable create digest for equivalent facts and changes it for TTL changes', async () => {
    const createEntry = vi.fn<CanvasEntryStore['createEntry']>(async () => ({
      value: publicEntry,
      replayed: false,
    }));
    const entryService = service(stores({ createEntry }));
    const input = { packageId, idempotencyKey: 'canvas-entry-create-1', ttlSeconds: 120 };

    await entryService.createEntry(actor, projectId, input);
    await entryService.createEntry(actor, projectId, { ...input });
    await entryService.createEntry(actor, projectId, { ...input, ttlSeconds: 121 });

    const digests = createEntry.mock.calls.map((call) => call[0].requestDigest);
    expect(digests[1]).toBe(digests[0]);
    expect(digests[2]).not.toBe(digests[0]);
  });

  it('strictly rejects secret-bearing or unknown create input before Store access', async () => {
    const createEntry = vi.fn<CanvasEntryStore['createEntry']>();
    const entryService = service(stores({ createEntry }));

    await expect(
      entryService.createEntry(actor, projectId, {
        packageId,
        idempotencyKey: 'canvas-entry-create-1',
        ttlSeconds: 120,
        accessToken: 'Bearer raw-project-grant',
      } as never),
    ).rejects.toEqual(
      expect.objectContaining({ code: 'CANVAS_ENTRY_SCHEMA_INVALID', status: 422 }),
    );
    expect(createEntry).not.toHaveBeenCalled();
  });

  it('rejects a secret-bearing or scope-conflicting create Store response', async () => {
    const malicious = { ...publicEntry, accessToken: 'raw-project-grant' };
    const wrongScope = { ...publicEntry, tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    const createEntry = vi
      .fn<CanvasEntryStore['createEntry']>()
      .mockResolvedValueOnce({ value: malicious as never, replayed: false })
      .mockResolvedValueOnce({ value: wrongScope, replayed: false });
    const entryService = service(stores({ createEntry }));
    const input = { packageId, idempotencyKey: 'canvas-entry-create-1', ttlSeconds: 120 };

    await expect(entryService.createEntry(actor, projectId, input)).rejects.toEqual(
      expect.objectContaining({ code: 'CANVAS_ENTRY_SCHEMA_INVALID' }),
    );
    await expect(entryService.createEntry(actor, projectId, input)).rejects.toEqual(
      expect.objectContaining({ code: 'CANVAS_ENTRY_NOT_FOUND', status: 404 }),
    );
  });

  it('redeems exact server scope into a complete server-only authority result', async () => {
    const value = redemptionValue();
    const redeemEntry = vi.fn<CanvasEntryStore['redeemEntry']>(async () => ({
      value,
      replayed: false,
    }));
    const entryService = service(stores({ redeemEntry }));

    await expect(entryService.redeemEntry(redeemInput)).resolves.toEqual({
      value,
      replayed: false,
    });
    expect(redeemEntry).toHaveBeenCalledWith({
      ...redeemInput,
      requestDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      redeemedAt: new Date('2026-08-11T03:00:00.000Z'),
    });
  });

  it('preserves exact redemption replay and creates a stable request digest', async () => {
    const redeemEntry = vi.fn<CanvasEntryStore['redeemEntry']>(async () => ({
      value: redemptionValue(),
      replayed: true,
    }));
    const entryService = service(stores({ redeemEntry }));

    await expect(entryService.redeemEntry(redeemInput)).resolves.toEqual({
      value: redemptionValue(),
      replayed: true,
    });
    await entryService.redeemEntry({ ...redeemInput });

    expect(redeemEntry.mock.calls[1]?.[0].requestDigest).toBe(
      redeemEntry.mock.calls[0]?.[0].requestDigest,
    );
  });

  it('binds redemption digest to all six exact input facts', async () => {
    const redeemEntry = vi.fn<CanvasEntryStore['redeemEntry']>(async () => ({
      value: redemptionValue(),
      replayed: false,
    }));
    const entryService = service(stores({ redeemEntry }));

    await entryService.redeemEntry(redeemInput);
    await expect(
      entryService.redeemEntry({ ...redeemInput, idempotencyKey: 'canvas-entry-redeem-2' }),
    ).resolves.toBeDefined();
    await expect(
      entryService.redeemEntry({ ...redeemInput, redeemedBy: 'storycanvas-worker-2' }),
    ).resolves.toBeDefined();

    const digests = redeemEntry.mock.calls.map((call) => call[0].requestDigest);
    expect(new Set(digests).size).toBe(3);
  });

  it('rejects extra, secret-bearing, malformed or UUID-reinterpreted redemption input', async () => {
    const redeemEntry = vi.fn<CanvasEntryStore['redeemEntry']>();
    const entryService = service(stores({ redeemEntry }));

    const invalidInputs = [
      { ...redeemInput, accessToken: 'Bearer raw-project-grant' },
      { ...redeemInput, grantId },
      { ...redeemInput, organizationId: tenantId },
      { ...redeemInput, handle: 'raw.grant.token' },
      { ...redeemInput, tenantId: 'not-a-uuid' },
      { ...redeemInput, idempotencyKey: 'contains spaces' },
      { ...redeemInput, redeemedBy: 'contains spaces' },
    ];

    for (const input of invalidInputs) {
      await expect(entryService.redeemEntry(input as never)).rejects.toEqual(
        expect.objectContaining({ code: 'CANVAS_ENTRY_SCHEMA_INVALID', status: 422 }),
      );
    }
    expect(redeemEntry).not.toHaveBeenCalled();
  });

  it('rejects malformed, extra-field, cross-scope or token-mismatched redemption results', async () => {
    const badPackage = productionPackage();
    const badPackageUnsigned = { ...badPackage, contractVersion: '0.2' };
    const outputs = [
      {
        value: { ...redemptionValue(), requestDigest: `sha256:${'0'.repeat(64)}` },
        replayed: false,
      },
      {
        value: redemptionValue({ tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
        replayed: false,
      },
      { value: redemptionValue({ accessToken: 'different.payload.signature' }), replayed: false },
      {
        value: redemptionValue({ productionPackage: badPackageUnsigned as never }),
        replayed: false,
      },
      { value: redemptionValue(), replayed: false, rawGrant: 'secret' },
    ];
    const redeemEntry = vi.fn<CanvasEntryStore['redeemEntry']>();
    outputs.forEach((output) => redeemEntry.mockResolvedValueOnce(output as never));
    const entryService = service(stores({ redeemEntry }));

    for (const output of outputs) {
      void output;
      await expect(entryService.redeemEntry(redeemInput)).rejects.toEqual(
        expect.objectContaining({ code: 'CANVAS_ENTRY_SCHEMA_INVALID', status: 422 }),
      );
    }
  });

  it('hides an otherwise valid Store result whose outer scope does not match the command', async () => {
    const otherTenant = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const otherPackage = productionPackage();
    const packageUnsigned = {
      ...otherPackage,
      tenantId: otherTenant,
      organizationId: otherTenant,
    };
    const scopedPackage = {
      ...packageUnsigned,
      payloadDigest: contractPayloadDigest(packageUnsigned),
    };
    const otherGrant = projectGrant();
    const grantUnsigned = { ...otherGrant, tenantId: otherTenant };
    const scopedGrant = { ...grantUnsigned, payloadDigest: contractPayloadDigest(grantUnsigned) };
    const redeemEntry = vi.fn<CanvasEntryStore['redeemEntry']>(async () => ({
      value: redemptionValue({
        tenantId: otherTenant,
        productionPackage: scopedPackage,
        grant: scopedGrant,
      }),
      replayed: false,
    }));
    const entryService = service(stores({ redeemEntry }));

    await expect(entryService.redeemEntry(redeemInput)).rejects.toEqual(
      expect.objectContaining({ code: 'CANVAS_ENTRY_NOT_FOUND', status: 404 }),
    );
  });

  it('requires a dedicated digest secret and validates IDs, handle and TTL before Store access', async () => {
    expect(() => new CanvasEntryService(stores(), 'too-short')).toThrow(/32 bytes/i);
    const createEntry = vi.fn<CanvasEntryStore['createEntry']>();
    const redeemEntry = vi.fn<CanvasEntryStore['redeemEntry']>();
    const entryService = service(stores({ createEntry, redeemEntry }));

    await expect(
      entryService.createEntry(actor, 'not-a-uuid', {
        packageId,
        idempotencyKey: 'canvas-entry-create-1',
        ttlSeconds: 120,
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'CANVAS_ENTRY_SCHEMA_INVALID' }));
    await expect(
      entryService.redeemEntry({ ...redeemInput, handle: 'raw.grant.token' }),
    ).rejects.toEqual(expect.objectContaining({ code: 'CANVAS_ENTRY_SCHEMA_INVALID' }));
    expect(createEntry).not.toHaveBeenCalled();
    expect(redeemEntry).not.toHaveBeenCalled();
  });

  it('reads only the active browser-safe Entry within the exact tenant/project scope', async () => {
    const readEntry = vi.fn<CanvasEntryStore['readEntry']>(async () => publicEntry);
    const entryService = service(stores({ readEntry }));

    await expect(entryService.readEntry(actor, projectId, handle)).resolves.toEqual(publicEntry);
    expect(readEntry).toHaveBeenCalledWith({
      tenantId,
      projectId,
      handle,
      readAt: new Date('2026-08-11T03:00:00.000Z'),
    });
    expect(JSON.stringify(await entryService.readEntry(actor, projectId, handle))).not.toMatch(
      /grant|token|authorization|cookie|secret|digest/i,
    );
  });

  it('rejects a Store read projection outside the exact browser-safe scope', async () => {
    const readEntry = vi.fn<CanvasEntryStore['readEntry']>(async () => ({
      ...publicEntry,
      projectId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }));
    const entryService = service(stores({ readEntry }));

    await expect(entryService.readEntry(actor, projectId, handle)).rejects.toEqual(
      expect.objectContaining({ code: 'CANVAS_ENTRY_NOT_FOUND', status: 404 }),
    );
  });
});
