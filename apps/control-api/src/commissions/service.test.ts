import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommissionPermissionDeniedError, CommissionScopeNotFoundError } from './errors.js';
import { CommissionAuditService } from './service.js';
import type { CommissionActor, CommissionAuditStore } from './types.js';

const platformOrganizationId = 'a0000000-0000-4000-8000-000000000001';
const channelOrganizationId = 'a0000000-0000-4000-8000-000000000002';
const tenantOrganizationId = 'a0000000-0000-4000-8000-000000000003';
const channelId = 'b0000000-0000-4000-8000-000000000001';
const otherChannelId = 'b0000000-0000-4000-8000-000000000002';

function actor(
  organizationType: CommissionActor['organizationType'],
  roles: CommissionActor['roles'],
  organizationId = platformOrganizationId,
): CommissionActor {
  return {
    userId: 'c0000000-0000-4000-8000-000000000001',
    membershipId: 'd0000000-0000-4000-8000-000000000001',
    organizationId,
    organizationType,
    roles,
  };
}

function stores() {
  return {
    findChannelIdByOrganizationId: vi.fn<CommissionAuditStore['findChannelIdByOrganizationId']>(),
    listCalculations: vi.fn<CommissionAuditStore['listCalculations']>(),
    listAccruals: vi.fn<CommissionAuditStore['listAccruals']>(),
    listReversals: vi.fn<CommissionAuditStore['listReversals']>(),
  };
}

describe('CommissionAuditService', () => {
  const calculation = {
    commissionCalculationOutcomeId: 'e0000000-0000-4000-8000-000000000001',
    sourcePaymentEventId: 'e0000000-0000-4000-8000-000000000002',
    rechargeOrderId: 'e0000000-0000-4000-8000-000000000003',
    beneficiaryChannelId: channelId,
    commissionRuleVersionId: 'e0000000-0000-4000-8000-000000000004',
    basisAmountMinor: 100,
    currency: 'CNY',
    outcome: 'accrued' as const,
    reasonCode: 'eligible_direct_attribution',
    occurredAt: '2026-08-08T06:00:00.000Z',
    createdAt: '2026-08-08T06:00:01.000Z',
  };

  beforeEach(() => vi.restoreAllMocks());

  it('allows a Platform Admin to list global and manual-review audit results', async () => {
    const store = stores();
    store.listCalculations.mockResolvedValue([calculation]);
    const service = new CommissionAuditService(store);
    const platformAdmin = actor('PLATFORM', ['platform_admin']);

    await expect(service.listPlatformCalculations(platformAdmin, 25)).resolves.toEqual([
      calculation,
    ]);
    await expect(service.listPlatformManualReviews(platformAdmin, 10)).resolves.toEqual([
      calculation,
    ]);
    expect(store.listCalculations).toHaveBeenNthCalledWith(1, {}, 25);
    expect(store.listCalculations).toHaveBeenNthCalledWith(2, { outcome: 'manual_review' }, 10);
  });

  it('returns 403 inside Platform scope when the administrator role is absent', async () => {
    const store = stores();
    const service = new CommissionAuditService(store);

    await expect(
      service.listPlatformAccruals(actor('PLATFORM', ['content_operator']), 50),
    ).rejects.toBeInstanceOf(CommissionPermissionDeniedError);
    expect(store.listAccruals).not.toHaveBeenCalled();
  });

  it('hides Commission routes from Tenant and Content Operator contexts with 404', async () => {
    const store = stores();
    const service = new CommissionAuditService(store);
    const tenantActor = actor('TENANT', ['tenant_admin', 'content_operator'], tenantOrganizationId);

    await expect(service.listPlatformReversals(tenantActor, 50)).rejects.toBeInstanceOf(
      CommissionScopeNotFoundError,
    );
    await expect(
      service.listChannelCalculations(tenantActor, channelId, 50),
    ).rejects.toBeInstanceOf(CommissionScopeNotFoundError);
    expect(store.listReversals).not.toHaveBeenCalled();
    expect(store.listCalculations).not.toHaveBeenCalled();
  });

  it('allows a Channel Admin to list only its canonical Channel', async () => {
    const store = stores();
    store.findChannelIdByOrganizationId.mockResolvedValue(channelId);
    store.listCalculations.mockResolvedValue([calculation]);
    const service = new CommissionAuditService(store);
    const channelAdmin = actor('CHANNEL', ['channel_admin'], channelOrganizationId);

    await expect(service.listChannelCalculations(channelAdmin, channelId, 40)).resolves.toEqual([
      calculation,
    ]);
    expect(store.listCalculations).toHaveBeenCalledWith({ beneficiaryChannelId: channelId }, 40);
  });

  it('returns 404 for a valid cross-Channel id before checking the role or listing records', async () => {
    const store = stores();
    store.findChannelIdByOrganizationId.mockResolvedValue(channelId);
    const service = new CommissionAuditService(store);
    const channelMember = actor('CHANNEL', ['content_operator'], channelOrganizationId);

    await expect(
      service.listChannelAccruals(channelMember, otherChannelId, 50),
    ).rejects.toBeInstanceOf(CommissionScopeNotFoundError);
    expect(store.listAccruals).not.toHaveBeenCalled();
  });

  it('returns 403 when the canonical Channel matches but channel_admin is absent', async () => {
    const store = stores();
    store.findChannelIdByOrganizationId.mockResolvedValue(channelId);
    const service = new CommissionAuditService(store);
    const channelMember = actor('CHANNEL', ['content_operator'], channelOrganizationId);

    await expect(service.listChannelReversals(channelMember, channelId, 50)).rejects.toBeInstanceOf(
      CommissionPermissionDeniedError,
    );
    expect(store.listReversals).not.toHaveBeenCalled();
  });
});
