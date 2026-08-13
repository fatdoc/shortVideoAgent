import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CommissionSettlementPermissionDeniedError,
  CommissionSettlementScopeNotFoundError,
  CommissionSettlementValidationError,
} from './errors.js';
import { CommissionSettlementService } from './service.js';
import type {
  CommissionSettlementActor,
  CommissionSettlementStore,
  CreateCommissionSettlementInput,
} from './types.js';

const platformOrganizationId = 'a0000000-0000-4000-8000-000000000001';
const platformUserId = 'b0000000-0000-4000-8000-000000000001';
const platformMembershipId = 'c0000000-0000-4000-8000-000000000001';
const channelId = 'd0000000-0000-4000-8000-000000000001';

function actor(
  organizationType: CommissionSettlementActor['organizationType'] = 'PLATFORM',
  roles: CommissionSettlementActor['roles'] = ['platform_admin'],
): CommissionSettlementActor {
  return {
    userId: platformUserId,
    membershipId: platformMembershipId,
    organizationId: platformOrganizationId,
    organizationType,
    roles,
  };
}

function input(
  overrides: Partial<CreateCommissionSettlementInput> = {},
): CreateCommissionSettlementInput {
  return {
    paymentMode: 'TEST',
    beneficiaryChannelId: channelId,
    currency: 'CNY',
    periodStart: '2026-08-01',
    cutoffAt: '2026-09-08T00:00:00.000Z',
    idempotencyKey: 'commission-settlement:august',
    ...overrides,
  };
}

function stores() {
  return { createDraft: vi.fn<CommissionSettlementStore['createDraft']>() };
}

const draft = {
  commissionSettlementId: 'e0000000-0000-4000-8000-000000000001',
  paymentMode: 'TEST' as const,
  beneficiaryChannelId: channelId,
  currency: 'CNY',
  periodStart: '2026-08-01',
  periodEnd: '2026-09-01',
  cutoffAt: '2026-09-08T00:00:00.000Z',
  status: 'draft' as const,
  grossAccrualAmountMinor: 15,
  grossReversalAmountMinor: 0,
  netAmountMinor: 15,
  accrualItemCount: 1,
  reversalItemCount: 0,
  itemCount: 1,
  createdAt: '2026-09-08T00:00:01.000Z',
};

describe('CommissionSettlementService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('normalizes a Platform Admin TEST monthly request and signs stable facts', async () => {
    const store = stores();
    store.createDraft.mockResolvedValue({ value: draft, replayed: false });
    const service = new CommissionSettlementService(
      store,
      'settlement-test-secret',
      () => new Date('2026-09-08T00:00:01.000Z'),
    );

    await expect(
      service.createDraft(
        actor(),
        input({
          beneficiaryChannelId: channelId.toUpperCase(),
          idempotencyKey: ' commission-settlement:august ',
        }),
      ),
    ).resolves.toEqual({ value: draft, replayed: false });

    expect(store.createDraft).toHaveBeenCalledWith({
      paymentMode: 'TEST',
      beneficiaryChannelId: channelId,
      currency: 'CNY',
      periodStart: new Date('2026-08-01T00:00:00.000Z'),
      periodEnd: new Date('2026-09-01T00:00:00.000Z'),
      cutoffAt: new Date('2026-09-08T00:00:00.000Z'),
      idempotencyKey: 'commission-settlement:august',
      requestDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      createdByUserId: platformUserId,
      createdByMembershipId: platformMembershipId,
      createdAt: new Date('2026-09-08T00:00:01.000Z'),
    });
  });

  it('produces the same digest for equivalent facts and a different digest for changed cutoff', async () => {
    const store = stores();
    store.createDraft.mockResolvedValue({ value: draft, replayed: false });
    const service = new CommissionSettlementService(store, 'settlement-test-secret');

    await service.createDraft(actor(), input());
    await service.createDraft(actor(), input({ idempotencyKey: ' commission-settlement:august ' }));
    await service.createDraft(actor(), input({ cutoffAt: '2026-09-09T00:00:00.000Z' }));

    const first = store.createDraft.mock.calls[0]?.[0].requestDigest;
    const second = store.createDraft.mock.calls[1]?.[0].requestDigest;
    const changed = store.createDraft.mock.calls[2]?.[0].requestDigest;
    expect(first).toBe(second);
    expect(changed).not.toBe(first);
  });

  it('hides the capability outside Platform scope and rejects missing Platform role before writes', async () => {
    const store = stores();
    const service = new CommissionSettlementService(store, 'settlement-test-secret');

    await expect(
      service.createDraft(actor('TENANT', ['tenant_admin']), input()),
    ).rejects.toBeInstanceOf(CommissionSettlementScopeNotFoundError);
    await expect(
      service.createDraft(actor('PLATFORM', ['content_operator']), input()),
    ).rejects.toBeInstanceOf(CommissionSettlementPermissionDeniedError);
    expect(store.createDraft).not.toHaveBeenCalled();
  });

  it.each([
    [{ paymentMode: 'LIVE' }, /paymentMode/i],
    [{ beneficiaryChannelId: 'not-a-uuid' }, /beneficiaryChannelId/i],
    [{ currency: 'cny' }, /currency/i],
    [{ periodStart: '2026-08-02' }, /periodStart/i],
    [{ periodStart: '2026-13-01' }, /periodStart/i],
    [{ cutoffAt: '2026-08-31T23:59:59.999Z' }, /cutoffAt/i],
    [{ cutoffAt: '2026-09-08T00:00:00.000' }, /cutoffAt/i],
    [{ idempotencyKey: 'bad key' }, /idempotencyKey/i],
  ] as const)('rejects invalid TEST draft facts %#', async (overrides, message) => {
    const store = stores();
    const service = new CommissionSettlementService(store, 'settlement-test-secret');

    await expect(
      service.createDraft(actor(), input(overrides as Partial<CreateCommissionSettlementInput>)),
    ).rejects.toEqual(expect.objectContaining({ message: expect.stringMatching(message) }));
    await expect(
      service.createDraft(actor(), input(overrides as Partial<CreateCommissionSettlementInput>)),
    ).rejects.toBeInstanceOf(CommissionSettlementValidationError);
    expect(store.createDraft).not.toHaveBeenCalled();
  });
});
