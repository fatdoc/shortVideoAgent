import { describe, expect, it, vi } from 'vitest';
import type { SessionActor } from '../projects/types.js';
import { CanvasEntryService } from './service.js';
import type { CanvasEntryStore } from './types.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const packageId = '33333333-3333-4333-8333-333333333333';
const grantId = '44444444-4444-4444-8444-444444444444';
const userId = '55555555-5555-4555-8555-555555555555';
const handle = `ce_${'A'.repeat(32)}`;
const digestSecret = 'canvas-entry-service-test-secret-32-bytes-minimum';

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

function stores(overrides: Partial<CanvasEntryStore> = {}): CanvasEntryStore {
  return {
    createEntry: vi.fn<CanvasEntryStore['createEntry']>(),
    readEntry: vi.fn<CanvasEntryStore['readEntry']>(),
    consumeEntry: vi.fn<CanvasEntryStore['consumeEntry']>(),
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

  it('produces a stable digest for equivalent facts and changes it for TTL changes', async () => {
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

  it('rejects a secret-bearing or scope-conflicting Store response instead of serializing it', async () => {
    const malicious = { ...publicEntry, accessToken: 'raw-project-grant' };
    const wrongScope = { ...publicEntry, tenantId: '99999999-9999-4999-8999-999999999999' };
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

  it('consumes only through the authenticated tenant/project/package scope', async () => {
    const consumed = {
      handle,
      tenantId,
      projectId,
      packageId,
      grantId,
      consumedAt: '2026-08-11T03:00:00.000Z',
    };
    const consumeEntry = vi.fn<CanvasEntryStore['consumeEntry']>(async () => consumed);
    const entryService = service(stores({ consumeEntry }));

    await expect(
      entryService.consumeEntry(actor, projectId, { packageId, handle }),
    ).resolves.toEqual(consumed);
    expect(consumeEntry).toHaveBeenCalledWith({
      handle,
      tenantId,
      projectId,
      packageId,
      consumedAt: new Date('2026-08-11T03:00:00.000Z'),
    });
  });

  it('requires a dedicated digest secret and validates all IDs, handle and TTL before Store access', async () => {
    expect(() => new CanvasEntryService(stores(), 'too-short')).toThrow(/32 bytes/i);
    const createEntry = vi.fn<CanvasEntryStore['createEntry']>();
    const consumeEntry = vi.fn<CanvasEntryStore['consumeEntry']>();
    const entryService = service(stores({ createEntry, consumeEntry }));

    await expect(
      entryService.createEntry(actor, 'not-a-uuid', {
        packageId,
        idempotencyKey: 'canvas-entry-create-1',
        ttlSeconds: 120,
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'CANVAS_ENTRY_SCHEMA_INVALID' }));
    await expect(
      entryService.consumeEntry(actor, projectId, { packageId, handle: 'raw.grant.token' }),
    ).rejects.toEqual(expect.objectContaining({ code: 'CANVAS_ENTRY_SCHEMA_INVALID' }));
    expect(createEntry).not.toHaveBeenCalled();
    expect(consumeEntry).not.toHaveBeenCalled();
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
      projectId: '88888888-8888-4888-8888-888888888888',
    }));
    const entryService = service(stores({ readEntry }));

    await expect(entryService.readEntry(actor, projectId, handle)).rejects.toEqual(
      expect.objectContaining({ code: 'CANVAS_ENTRY_NOT_FOUND', status: 404 }),
    );
  });
});
