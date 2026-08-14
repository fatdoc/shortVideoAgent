import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { SessionActor } from '../projects/types.js';
import {
  CANVAS_ACTIVATION_ENTRY_TTL_SECONDS,
  CanvasActivationService,
} from './activationService.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const packageId = '33333333-3333-4333-8333-333333333333';
const actorId = '12121212-1212-4212-8212-121212121212';
const activationAttemptId = '90909090-9090-4090-8090-909090909090';
const secret = 'independent-canvas-activation-idempotency-secret-for-tests';

const actor: SessionActor = {
  userId: actorId,
  membershipId: '13131313-1313-4313-8313-131313131313',
  organizationId: '14141414-1414-4414-8414-141414141414',
  organizationType: 'TENANT',
  tenantId,
  membershipVersion: 1,
  primaryRole: 'tenant_admin',
  roles: ['tenant_admin'],
};

function entry(overrides: Record<string, unknown> = {}) {
  return {
    objectType: 'CanvasEntry' as const,
    contractVersion: '0.2' as const,
    handle: `ce_${'A'.repeat(32)}`,
    tenantId,
    projectId,
    packageId,
    state: 'active' as const,
    issuedAt: '2026-08-14T02:00:00.000Z',
    expiresAt: '2026-08-14T02:02:00.000Z',
    ...overrides,
  };
}

function expectedKey() {
  const canonicalFacts = JSON.stringify({
    version: 'canvas-entry-activation-v1',
    actorId,
    tenantId,
    projectId,
    packageId,
    activationAttemptId,
  });
  return `cva1.${createHmac('sha256', secret).update(canonicalFacts).digest('base64url')}`;
}

describe('CanvasActivationService', () => {
  it('derives the internal Entry key from canonical server scope and fixes TTL at 120 seconds', async () => {
    const createEntry = vi.fn(async () => ({ value: entry(), replayed: false }));
    const service = new CanvasActivationService({ createEntry }, secret);

    await expect(
      service.activate(actor, projectId, packageId, { activationAttemptId }),
    ).resolves.toEqual({ entry: entry(), replayed: false });

    expect(CANVAS_ACTIVATION_ENTRY_TTL_SECONDS).toBe(120);
    expect(createEntry).toHaveBeenCalledWith(actor, projectId, {
      packageId,
      ttlSeconds: 120,
      idempotencyKey: expectedKey(),
    });
  });

  it('reuses only same-attempt same-scope keys and separates every authority fact', async () => {
    const keys: string[] = [];
    const createEntry = vi.fn(async (_actor, _projectId, input) => {
      keys.push(input.idempotencyKey);
      return { value: entry(), replayed: keys.length === 2 };
    });
    const service = new CanvasActivationService({ createEntry }, secret);

    await service.activate(actor, projectId, packageId, { activationAttemptId });
    await service.activate(actor, projectId, packageId, { activationAttemptId });
    await service.activate({ ...actor, userId: '15151515-1515-4515-8515-151515151515' }, projectId, packageId, { activationAttemptId });
    await service.activate({ ...actor, tenantId: '16161616-1616-4616-8616-161616161616' }, projectId, packageId, { activationAttemptId });
    await service.activate(actor, '17171717-1717-4717-8717-171717171717', packageId, { activationAttemptId });
    await service.activate(actor, projectId, '18181818-1818-4818-8818-181818181818', { activationAttemptId });
    await service.activate(actor, projectId, packageId, {
      activationAttemptId: '19191919-1919-4919-8919-191919191919',
    });

    expect(keys[0]).toBe(keys[1]);
    expect(new Set([keys[0], ...keys.slice(2)]).size).toBe(6);
    expect(keys.every((key) => /^cva1\.[A-Za-z0-9_-]{43}$/.test(key))).toBe(true);
    expect(keys.join(' ')).not.toContain(activationAttemptId);
  });

  it('fails startup when its HMAC secret is shorter than 32 bytes', () => {
    expect(
      () => new CanvasActivationService({ createEntry: vi.fn() }, 'too-short'),
    ).toThrow('Canvas activation idempotency secret must contain at least 32 bytes.');
  });
});
