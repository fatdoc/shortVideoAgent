import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/pilotRuntime', () => ({
  pilotRuntime: {
    mode: 'pilot',
    controlApiBaseUrl: 'https://control.example.com',
    configurationError: null,
  },
}));

import {
  createPilotProject,
  createPilotChannelInvitation,
  createPilotPlatformInvitation,
  createPilotTenantInvitation,
  createPilotTermsDocument,
  createPilotTermsDraft,
  createPilotTestCommissionSettlement,
  hydratePilotSession,
  listPilotTermsDocuments,
  listPilotTermsVersions,
  listPilotActiveChannels,
  listPilotChannelInvitations,
  listPilotChannelCommissionAccruals,
  listPilotChannelCommissionCalculations,
  listPilotChannelCommissionReversals,
  listPilotCurrentOrganizationMembers,
  listPilotPlatformCommissionAccruals,
  listPilotPlatformCommissionCalculations,
  listPilotPlatformCommissionManualReviews,
  listPilotPlatformCommissionReversals,
  listPilotPlatformInvitations,
  listPilotPlatformPaymentEvents,
  listPilotProjects,
  listPilotTenantInvitations,
  listPilotTenantRechargeOrders,
  loginToPilot,
  logoutPilotSession,
  readPilotCurrentChannel,
  publishPilotTermsVersion,
  readPilotProject,
  retirePilotTermsVersion,
  revokePilotInvitation,
  suspendPilotCurrentOrganizationMember,
  updatePilotTermsDraft,
} from './pilotControlApi';

const session = {
  user: { id: 'user-1', email: 'pilot@example.com', displayName: '试点用户' },
  tenant: { id: 'tenant-1', displayName: '试点企业' },
  roles: ['tenant_admin'],
  activeContext: {
    membershipId: 'membership-1',
    organizationId: 'tenant-organization-1',
    organizationType: 'TENANT',
    organizationDisplayName: '试点企业',
    membershipVersion: 3,
    primaryRole: 'tenant_admin',
    roles: ['tenant_admin'],
    tenantId: 'tenant-1',
  },
  expiresAt: '2026-08-08T00:00:00.000Z',
};

const project = {
  id: 'project-1',
  name: '真实项目',
  status: 'active',
  platform: 'douyin',
  aspectRatio: '9:16',
  targetDurationSeconds: 30,
  createdBy: 'user-1',
  createdAt: '2026-08-07T00:00:00.000Z',
  updatedAt: '2026-08-07T01:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200, requestId = 'req-1') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-request-id': requestId },
  });
}

describe('pilot Control API adapter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    window.localStorage.clear();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('logs in with the complete active Membership Context without persisting data', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ session, returnTo: '/pilot' }));

    await expect(
      loginToPilot({ email: ' pilot@example.com ', password: 'secret' }),
    ).resolves.toMatchObject({
      user: { id: 'user-1' },
      tenant: { id: 'tenant-1' },
      activeContext: {
        membershipId: 'membership-1',
        organizationId: 'tenant-organization-1',
        organizationType: 'TENANT',
        membershipVersion: 3,
      },
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://control.example.com/api/v1/auth/login',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    const request = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      email: 'pilot@example.com',
      password: 'secret',
      returnTo: '/pilot',
    });
    expect(window.localStorage.length).toBe(0);
  });

  it('accepts a non-Tenant active context without inventing Tenant scope', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        session: {
          ...session,
          tenant: null,
          roles: ['platform_admin'],
          activeContext: {
            ...session.activeContext,
            organizationId: 'platform-1',
            organizationType: 'PLATFORM',
            organizationDisplayName: '试点平台',
            primaryRole: 'platform_admin',
            roles: ['platform_admin'],
            tenantId: null,
          },
        },
      }),
    );

    await expect(hydratePilotSession()).resolves.toMatchObject({
      tenant: null,
      activeContext: { organizationType: 'PLATFORM', tenantId: null },
    });
  });

  it('rejects inconsistent, incomplete, or unknown active contexts', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          session: {
            ...session,
            activeContext: { ...session.activeContext, membershipId: '' },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          session: {
            ...session,
            roles: ['unknown_role'],
            activeContext: {
              ...session.activeContext,
              primaryRole: 'unknown_role',
              roles: ['unknown_role'],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          session: {
            ...session,
            tenant: { id: 'tenant-other', displayName: '错误企业' },
          },
        }),
      );

    await expect(hydratePilotSession()).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
    await expect(hydratePilotSession()).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
    await expect(hydratePilotSession()).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
  });

  it('lists and reads only strictly parsed Control API projects', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ projects: [project] }))
      .mockResolvedValueOnce(jsonResponse(project));

    await expect(listPilotProjects()).resolves.toEqual([project]);
    await expect(readPilotProject('project/with slash')).resolves.toEqual(project);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://control.example.com/api/v1/projects',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://control.example.com/api/v1/projects/project%2Fwith%20slash',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(window.localStorage.length).toBe(0);
  });

  it('creates a real project with an explicit idempotency key and no browser persistence', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(project), {
        status: 201,
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-project-create',
          'idempotency-replayed': 'false',
        },
      }),
    );

    await expect(
      createPilotProject(
        {
          name: ' 真实项目 ',
          status: 'draft',
          platform: ' douyin ',
          aspectRatio: ' 9:16 ',
          targetDurationSeconds: 30,
        },
        'project-create-manual-1',
      ),
    ).resolves.toEqual({ project, replayed: false });

    expect(fetch).toHaveBeenCalledWith(
      'https://control.example.com/api/v1/projects',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({ 'Idempotency-Key': 'project-create-manual-1' }),
        body: JSON.stringify({
          name: '真实项目',
          status: 'draft',
          platform: 'douyin',
          aspectRatio: '9:16',
          targetDurationSeconds: 30,
        }),
      }),
    );
    expect(window.localStorage.length).toBe(0);
  });

  it('rejects malformed project list and project read payloads', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ projects: [{ ...project, id: '' }] }))
      .mockResolvedValueOnce(jsonResponse({ ...project, targetDurationSeconds: 0 }));

    await expect(listPilotProjects()).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
    await expect(readPilotProject('project-1')).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
    });
  });

  it('restores a server session and treats the error envelope as authoritative', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ session }));
    await expect(hydratePilotSession()).resolves.toMatchObject({
      user: { email: 'pilot@example.com' },
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '邮箱或密码不正确。',
            requestId: 'req-invalid',
          },
        },
        401,
      ),
    );
    await expect(
      loginToPilot({ email: 'pilot@example.com', password: 'wrong' }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      status: 401,
      requestId: 'req-invalid',
    });
  });

  it('preserves 403, 404, 5xx and network failures instead of returning mock data', async () => {
    for (const [status, code] of [
      [403, 'PERMISSION_DENIED'],
      [404, 'PROJECT_NOT_FOUND'],
      [500, 'INTERNAL_ERROR'],
    ] as const) {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: { code, message: '请求失败', requestId: `req-${status}` } }, status),
      );
      await expect(listPilotProjects()).rejects.toMatchObject({
        code,
        status,
        requestId: `req-${status}`,
      });
    }

    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('network down'));
    await expect(hydratePilotSession()).rejects.toEqual(
      expect.objectContaining({
        code: 'CONTROL_API_UNREACHABLE',
        status: null,
      }),
    );
  });

  it('revokes the server session using Cookie credentials', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    await logoutPilotSession();
    expect(fetch).toHaveBeenCalledWith(
      'https://control.example.com/api/v1/auth/logout',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('resolves canonical Channel references and active Platform Directory without caching', async () => {
    const organizationId = 'a0000000-0000-4000-8000-000000000001';
    const canonicalChannelId = 'c0000000-0000-4000-8000-000000000001';
    const channel = {
      channelId: canonicalChannelId,
      organizationId,
      displayName: 'Canonical Channel',
      organizationStatus: 'active',
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ channel }))
      .mockResolvedValueOnce(jsonResponse({ channels: [channel] }));

    await expect(readPilotCurrentChannel()).resolves.toEqual(channel);
    await expect(listPilotActiveChannels(25)).resolves.toEqual([channel]);

    expect(canonicalChannelId).not.toBe(organizationId);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://control.example.com/api/v1/channels/current',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://control.example.com/api/v1/platform/channels?status=active&limit=25',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });

  it('fails closed for malformed Channel reference responses and invalid local limits', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          channel: {
            channelId: 'not-a-uuid',
            organizationId: 'a0000000-0000-4000-8000-000000000001',
            displayName: 'Malformed Channel',
            organizationStatus: 'active',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          channels: [
            {
              channelId: 'c0000000-0000-4000-8000-000000000001',
              organizationId: 'a0000000-0000-4000-8000-000000000001',
              displayName: 'Inactive Channel',
              organizationStatus: 'suspended',
            },
          ],
        }),
      );

    await expect(readPilotCurrentChannel()).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
    });
    await expect(listPilotActiveChannels()).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
    });
    await expect(listPilotActiveChannels(101)).rejects.toMatchObject({
      code: 'INVALID_LIST_LIMIT',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('strictly parses Platform commercial audit lists', async () => {
    const paymentEvent = {
      paymentEventId: '10000000-0000-4000-8000-000000000001',
      paymentMode: 'TEST',
      providerCode: 'test-provider',
      providerEventId: 'provider-event-1',
      eventType: 'payment_succeeded',
      eventDigest: 'a'.repeat(64),
      rechargeOrderId: '10000000-0000-4000-8000-000000000002',
      amountMinor: 100,
      currency: 'CNY',
      occurredAt: '2026-08-09T01:00:00.000Z',
      receivedAt: '2026-08-09T01:00:01.000Z',
      processingStatus: 'applied',
      errorCode: null,
      processedAt: '2026-08-09T01:00:02.000Z',
    };
    const calculation = {
      commissionCalculationOutcomeId: '20000000-0000-4000-8000-000000000001',
      sourcePaymentEventId: paymentEvent.paymentEventId,
      rechargeOrderId: paymentEvent.rechargeOrderId,
      beneficiaryChannelId: '30000000-0000-4000-8000-000000000001',
      commissionRuleVersionId: '40000000-0000-4000-8000-000000000001',
      basisAmountMinor: 100,
      currency: 'CNY',
      outcome: 'accrued',
      reasonCode: 'commission_accrued',
      occurredAt: '2026-08-09T01:00:00.000Z',
      createdAt: '2026-08-09T01:00:02.000Z',
    };
    const accrual = {
      commissionAccrualId: '50000000-0000-4000-8000-000000000001',
      calculationOutcomeId: calculation.commissionCalculationOutcomeId,
      sourcePaymentEventId: paymentEvent.paymentEventId,
      rechargeOrderId: paymentEvent.rechargeOrderId,
      beneficiaryChannelId: calculation.beneficiaryChannelId,
      commissionRuleVersionId: calculation.commissionRuleVersionId,
      basisAmountMinor: 100,
      commissionAmountMinor: 15,
      currency: 'CNY',
      eligibleAt: '2026-08-16T01:00:00.000Z',
      occurredAt: '2026-08-09T01:00:00.000Z',
      createdAt: '2026-08-09T01:00:02.000Z',
    };
    const reversal = {
      commissionReversalId: '60000000-0000-4000-8000-000000000001',
      commissionAccrualId: accrual.commissionAccrualId,
      sourcePaymentEventId: '60000000-0000-4000-8000-000000000002',
      rechargeOrderId: paymentEvent.rechargeOrderId,
      beneficiaryChannelId: calculation.beneficiaryChannelId,
      reversalType: 'refund',
      reversalAmountMinor: 15,
      currency: 'CNY',
      occurredAt: '2026-08-09T02:00:00.000Z',
      createdAt: '2026-08-09T02:00:02.000Z',
    };
    const manualReview = {
      ...calculation,
      commissionCalculationOutcomeId: '20000000-0000-4000-8000-000000000002',
      beneficiaryChannelId: null,
      commissionRuleVersionId: null,
      outcome: 'manual_review',
      reasonCode: 'commission_rule_unavailable',
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ paymentEvents: [paymentEvent] }))
      .mockResolvedValueOnce(jsonResponse({ calculations: [calculation] }))
      .mockResolvedValueOnce(jsonResponse({ accruals: [accrual] }))
      .mockResolvedValueOnce(jsonResponse({ reversals: [reversal] }))
      .mockResolvedValueOnce(jsonResponse({ manualReviews: [manualReview] }));

    await expect(listPilotPlatformPaymentEvents(20)).resolves.toEqual([
      {
        paymentEventId: paymentEvent.paymentEventId,
        paymentMode: 'TEST',
        eventType: 'payment_succeeded',
        rechargeOrderId: paymentEvent.rechargeOrderId,
        amountMinor: 100,
        currency: 'CNY',
        occurredAt: paymentEvent.occurredAt,
        receivedAt: paymentEvent.receivedAt,
        processingStatus: 'applied',
        errorCode: null,
        processedAt: paymentEvent.processedAt,
      },
    ]);
    await expect(listPilotPlatformCommissionCalculations(20)).resolves.toEqual([calculation]);
    await expect(listPilotPlatformCommissionAccruals(20)).resolves.toEqual([accrual]);
    await expect(listPilotPlatformCommissionReversals(20)).resolves.toEqual([reversal]);
    await expect(listPilotPlatformCommissionManualReviews(20)).resolves.toEqual([manualReview]);
    for (const call of vi.mocked(fetch).mock.calls) {
      expect(call[1]).toEqual(expect.objectContaining({ cache: 'no-store' }));
    }
  });

  it('uses only an explicit canonical Channel UUID for Channel commission audit lists', async () => {
    const channelId = '30000000-0000-4000-8000-000000000001';
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ calculations: [] }))
      .mockResolvedValueOnce(jsonResponse({ accruals: [] }))
      .mockResolvedValueOnce(jsonResponse({ reversals: [] }));

    await expect(listPilotChannelCommissionCalculations(channelId, 10)).resolves.toEqual([]);
    await expect(listPilotChannelCommissionAccruals(channelId, 10)).resolves.toEqual([]);
    await expect(listPilotChannelCommissionReversals(channelId, 10)).resolves.toEqual([]);
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
      `https://control.example.com/api/v1/channels/${channelId}/commission-audit/calculations?limit=10`,
      `https://control.example.com/api/v1/channels/${channelId}/commission-audit/accruals?limit=10`,
      `https://control.example.com/api/v1/channels/${channelId}/commission-audit/reversals?limit=10`,
    ]);

    await expect(
      listPilotChannelCommissionCalculations('a0000000-0000-4000-8000-000000000001/other'),
    ).rejects.toMatchObject({ code: 'INVALID_CHANNEL_ID' });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('accepts the canonical date-only TEST Settlement period and preserves idempotency replay state', async () => {
    const input = {
      paymentMode: 'TEST' as const,
      beneficiaryChannelId: '30000000-0000-4000-8000-000000000001',
      currency: 'CNY',
      periodStart: '2026-08-01',
      cutoffAt: '2026-09-01T00:00:00.000Z',
      idempotencyKey: 'settlement:test:2026-08',
    };
    const settlement = {
      commissionSettlementId: '70000000-0000-4000-8000-000000000001',
      paymentMode: 'TEST',
      beneficiaryChannelId: input.beneficiaryChannelId,
      currency: 'CNY',
      periodStart: '2026-08-01',
      periodEnd: '2026-09-01',
      cutoffAt: input.cutoffAt,
      status: 'draft',
      grossAccrualAmountMinor: 0,
      grossReversalAmountMinor: 0,
      netAmountMinor: 0,
      accrualItemCount: 0,
      reversalItemCount: 0,
      itemCount: 0,
      createdAt: '2026-08-09T03:00:00.000Z',
    };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ settlement }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'settlement-request-1',
          'idempotency-replayed': 'true',
        },
      }),
    );

    await expect(createPilotTestCommissionSettlement(input)).resolves.toEqual({
      settlement,
      replayed: true,
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://control.example.com/api/v1/platform/commission-settlements',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toEqual(input);
  });

  it('lists only the safe Tenant RechargeOrder audit projection', async () => {
    const tenantId = '80000000-0000-4000-8000-000000000001';
    const rechargeOrder = {
      rechargeOrderId: '80000000-0000-4000-8000-000000000002',
      tenantId,
      walletId: '80000000-0000-4000-8000-000000000003',
      buyerUserId: '80000000-0000-4000-8000-000000000004',
      buyerMembershipId: '80000000-0000-4000-8000-000000000005',
      paymentMode: 'TEST',
      conversionRuleVersionId: '80000000-0000-4000-8000-000000000006',
      amountMinor: 100,
      currency: 'CNY',
      purchasedCredits: 10,
      bonusCredits: 2,
      bonusExpiresInDays: 30,
      status: 'paid',
      attributionSnapshotId: '80000000-0000-4000-8000-000000000007',
      createdAt: '2026-08-09T04:00:00.000Z',
      updatedAt: '2026-08-09T04:00:02.000Z',
    };
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ rechargeOrders: [rechargeOrder] }));

    await expect(listPilotTenantRechargeOrders(tenantId, 50)).resolves.toEqual([
      {
        rechargeOrderId: rechargeOrder.rechargeOrderId,
        paymentMode: 'TEST',
        amountMinor: 100,
        currency: 'CNY',
        purchasedCredits: 10,
        bonusCredits: 2,
        bonusExpiresInDays: 30,
        status: 'paid',
        createdAt: rechargeOrder.createdAt,
        updatedAt: rechargeOrder.updatedAt,
      },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      `https://control.example.com/api/v1/tenants/${tenantId}/recharge-orders?limit=50`,
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });

  it('rejects malformed commercial enums, money, currency and timestamps', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          paymentEvents: [
            {
              paymentEventId: '10000000-0000-4000-8000-000000000001',
              paymentMode: 'LIVE',
              providerCode: 'provider',
              providerEventId: 'event',
              eventType: 'payment_succeeded',
              eventDigest: 'digest',
              rechargeOrderId: '10000000-0000-4000-8000-000000000002',
              amountMinor: 1.5,
              currency: 'cny',
              occurredAt: '2026-08-09 01:00:00',
              receivedAt: '2026-08-09T01:00:00.000Z',
              processingStatus: 'applied',
              errorCode: null,
              processedAt: null,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ settlement: {} }), {
          status: 201,
          headers: { 'content-type': 'application/json', 'idempotency-replayed': 'maybe' },
        }),
      );

    await expect(listPilotPlatformPaymentEvents()).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
    });
    await expect(
      createPilotTestCommissionSettlement({
        paymentMode: 'TEST',
        beneficiaryChannelId: '30000000-0000-4000-8000-000000000001',
        currency: 'CNY',
        periodStart: '2026-08-01',
        cutoffAt: '2026-09-01T00:00:00.000Z',
        idempotencyKey: 'settlement:test:malformed-response',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
  });

  it('lists bounded current Organization members with real Cookie, no-store, and strict DTO parsing', async () => {
    const member = {
      membershipId: '71000000-0000-4000-8000-000000000001',
      displayName: '运营成员',
      email: 'operator@example.com',
      status: 'active',
      primaryRole: 'tenant_admin',
      roles: ['tenant_admin'],
      version: 2,
      createdAt: '2026-08-09T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
      isCurrentActor: false,
    };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ members: [member] }));

    await expect(listPilotCurrentOrganizationMembers('all', 25)).resolves.toEqual([member]);
    expect(fetch).toHaveBeenCalledWith(
      'https://control.example.com/api/v1/organizations/current/members?status=all&limit=25',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(window.localStorage.length).toBe(0);
  });

  it('rejects invalid Member bounds and sensitive or malformed Member projections', async () => {
    await expect(listPilotCurrentOrganizationMembers('all', 0)).rejects.toMatchObject({
      code: 'INVALID_LIST_LIMIT',
    });
    await expect(listPilotCurrentOrganizationMembers('all', 101)).rejects.toMatchObject({
      code: 'INVALID_LIST_LIMIT',
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        members: [
          {
            membershipId: '71000000-0000-4000-8000-000000000001',
            displayName: '运营成员',
            email: 'operator@example.com',
            status: 'active',
            primaryRole: 'tenant_admin',
            roles: ['tenant_admin'],
            version: 0,
            createdAt: 'not-a-time',
            updatedAt: '2026-08-10T00:00:00.000Z',
            isCurrentActor: false,
            tokenDigest: 'must-not-cross-client-boundary',
          },
        ],
      }),
    );

    await expect(listPilotCurrentOrganizationMembers()).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
    });
    expect(window.localStorage.length).toBe(0);
  });

  it('suspends a current Organization member with expectedVersion and replay evidence', async () => {
    const member = {
      membershipId: '71000000-0000-4000-8000-000000000002',
      displayName: '待停用成员',
      email: 'member@example.com',
      status: 'suspended',
      primaryRole: 'content_operator',
      roles: ['content_operator'],
      version: 3,
      createdAt: '2026-08-09T00:00:00.000Z',
      updatedAt: '2026-08-10T01:00:00.000Z',
      isCurrentActor: false,
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ member }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'member-suspend-1',
          'idempotency-replayed': 'true',
        },
      }),
    );

    await expect(suspendPilotCurrentOrganizationMember(member.membershipId, 2)).resolves.toEqual({
      member,
      replayed: true,
    });
    expect(fetch).toHaveBeenCalledWith(
      `https://control.example.com/api/v1/organizations/current/members/${member.membershipId}/suspend`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({ 'content-type': 'application/json' }),
        body: JSON.stringify({ expectedVersion: 2 }),
      }),
    );
    expect(window.localStorage.length).toBe(0);
  });

  it('rejects invalid Member suspend input and malformed replay evidence', async () => {
    await expect(
      suspendPilotCurrentOrganizationMember('not-a-membership-id', 2),
    ).rejects.toMatchObject({ code: 'INVALID_MEMBERSHIP_ID' });
    await expect(
      suspendPilotCurrentOrganizationMember('71000000-0000-4000-8000-000000000002', 0),
    ).rejects.toMatchObject({ code: 'INVALID_MEMBER_VERSION' });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ member: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'idempotency-replayed': 'maybe' },
      }),
    );
    await expect(
      suspendPilotCurrentOrganizationMember('71000000-0000-4000-8000-000000000002', 2),
    ).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
  });

  it('lists bounded Terms documents and versions with real Cookie, no-store, and exact DTOs', async () => {
    const document = {
      termsDocumentId: '72000000-0000-4000-8000-000000000001',
      documentCode: 'registration-notice',
      title: '注册须知',
      status: 'active',
      createdAt: '2026-08-09T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    };
    const version = {
      termsVersionId: '72000000-0000-4000-8000-000000000002',
      termsDocumentId: document.termsDocumentId,
      versionLabel: 'v1',
      status: 'DRAFT',
      content: '由业务或法务提供的测试正文',
      contentDigest: 'a'.repeat(64),
      locale: 'zh-CN',
      publishedAt: null,
      effectiveAt: null,
      publishedBy: null,
      supersedesTermsVersionId: null,
      mustReaccept: true,
      createdAt: '2026-08-09T01:00:00.000Z',
      updatedAt: '2026-08-10T01:00:00.000Z',
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ documents: [document] }))
      .mockResolvedValueOnce(jsonResponse({ versions: [version] }));

    await expect(listPilotTermsDocuments('active', 25)).resolves.toEqual([document]);
    await expect(listPilotTermsVersions(document.termsDocumentId, 'DRAFT', 20)).resolves.toEqual([
      version,
    ]);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://control.example.com/api/v1/platform/terms/documents?status=active&limit=25',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      `https://control.example.com/api/v1/platform/terms/documents/${document.termsDocumentId}/versions?status=DRAFT&limit=20`,
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(window.localStorage.length).toBe(0);
  });

  it('rejects invalid Terms bounds, identifiers, statuses, and sensitive or malformed projections', async () => {
    await expect(listPilotTermsDocuments('all', 0)).rejects.toMatchObject({
      code: 'INVALID_LIST_LIMIT',
    });
    await expect(listPilotTermsDocuments('unknown' as 'all')).rejects.toMatchObject({
      code: 'INVALID_TERMS_DOCUMENT_STATUS',
    });
    await expect(listPilotTermsVersions('not-a-document-id')).rejects.toMatchObject({
      code: 'INVALID_TERMS_DOCUMENT_ID',
    });
    await expect(
      listPilotTermsVersions('72000000-0000-4000-8000-000000000001', 'ACTIVE' as 'all'),
    ).rejects.toMatchObject({ code: 'INVALID_TERMS_VERSION_STATUS' });

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          documents: [
            {
              termsDocumentId: '72000000-0000-4000-8000-000000000001',
              documentCode: 'registration-notice',
              title: '注册须知',
              status: 'active',
              createdAt: 'not-a-time',
              updatedAt: '2026-08-10T00:00:00.000Z',
              tokenDigest: 'must-not-cross-client-boundary',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          versions: [
            {
              termsVersionId: '72000000-0000-4000-8000-000000000002',
              termsDocumentId: '72000000-0000-4000-8000-000000000001',
              versionLabel: 'v1',
              status: 'DRAFT',
              content: '正文',
              contentDigest: 'not-a-digest',
              locale: 'zh-CN',
              publishedAt: null,
              effectiveAt: null,
              publishedBy: null,
              supersedesTermsVersionId: null,
              mustReaccept: true,
              createdAt: '2026-08-09T01:00:00.000Z',
              updatedAt: '2026-08-10T01:00:00.000Z',
              providerSecret: 'must-not-cross-client-boundary',
            },
          ],
        }),
      );

    await expect(listPilotTermsDocuments()).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
    });
    await expect(
      listPilotTermsVersions('72000000-0000-4000-8000-000000000001'),
    ).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
    expect(window.localStorage.length).toBe(0);
  });

  it('creates and updates Terms drafts using only frozen HTTP fields', async () => {
    const document = {
      termsDocumentId: '72000000-0000-4000-8000-000000000011',
      documentCode: 'privacy-notice',
      title: '隐私须知',
      status: 'active',
      createdAt: '2026-08-10T02:00:00.000Z',
      updatedAt: '2026-08-10T02:00:00.000Z',
    };
    const draft = {
      termsVersionId: '72000000-0000-4000-8000-000000000012',
      termsDocumentId: document.termsDocumentId,
      versionLabel: 'v1-draft',
      status: 'DRAFT',
      content: '业务提供的草稿正文',
      contentDigest: 'b'.repeat(64),
      locale: 'zh-CN',
      publishedAt: null,
      effectiveAt: null,
      publishedBy: null,
      supersedesTermsVersionId: null,
      mustReaccept: false,
      createdAt: '2026-08-10T02:10:00.000Z',
      updatedAt: '2026-08-10T02:10:00.000Z',
    };
    const updated = { ...draft, effectiveAt: '2026-08-12T00:00:00.000+08:00' };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(document, 201))
      .mockResolvedValueOnce(jsonResponse(draft, 201))
      .mockResolvedValueOnce(jsonResponse(updated));

    await expect(
      createPilotTermsDocument({ documentCode: 'privacy-notice', title: '隐私须知' }),
    ).resolves.toEqual(document);
    await expect(
      createPilotTermsDraft(document.termsDocumentId, {
        versionLabel: 'v1-draft',
        content: '业务提供的草稿正文',
        locale: 'zh-CN',
        mustReaccept: false,
        supersedesTermsVersionId: null,
      }),
    ).resolves.toEqual(draft);
    await expect(
      updatePilotTermsDraft(draft.termsVersionId, {
        versionLabel: 'v1-draft',
        content: '业务提供的草稿正文',
        locale: 'zh-CN',
        mustReaccept: false,
        supersedesTermsVersionId: null,
        effectiveAt: '2026-08-12T00:00:00.000+08:00',
      }),
    ).resolves.toEqual(updated);

    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toEqual({
      documentCode: 'privacy-notice',
      title: '隐私须知',
    });
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))).toEqual({
      versionLabel: 'v1-draft',
      content: '业务提供的草稿正文',
      locale: 'zh-CN',
      mustReaccept: false,
      supersedesTermsVersionId: null,
    });
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[2]?.[1]?.body))).toEqual({
      versionLabel: 'v1-draft',
      content: '业务提供的草稿正文',
      locale: 'zh-CN',
      mustReaccept: false,
      supersedesTermsVersionId: null,
      effectiveAt: '2026-08-12T00:00:00.000+08:00',
    });
    expect(window.localStorage.length).toBe(0);
  });

  it('publishes and retires Terms versions with strict replay evidence', async () => {
    const published = {
      termsVersionId: '72000000-0000-4000-8000-000000000022',
      termsDocumentId: '72000000-0000-4000-8000-000000000021',
      versionLabel: 'v1',
      status: 'PUBLISHED',
      content: '业务提供的正式正文',
      contentDigest: 'c'.repeat(64),
      locale: 'zh-CN',
      publishedAt: '2026-08-10T03:00:00.000Z',
      effectiveAt: '2026-08-12T00:00:00.000+08:00',
      publishedBy: '72000000-0000-4000-8000-000000000023',
      supersedesTermsVersionId: null,
      mustReaccept: true,
      createdAt: '2026-08-10T02:00:00.000Z',
      updatedAt: '2026-08-10T03:00:00.000Z',
    };
    const retired = { ...published, status: 'RETIRED', updatedAt: '2026-08-10T04:00:00.000Z' };
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(published), {
          status: 201,
          headers: {
            'content-type': 'application/json',
            'idempotency-replayed': 'false',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(retired), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'idempotency-replayed': 'true',
          },
        }),
      );

    await expect(
      publishPilotTermsVersion(published.termsVersionId, {
        effectiveAt: '2026-08-12T00:00:00.000+08:00',
      }),
    ).resolves.toEqual({ version: published, replayed: false });
    await expect(retirePilotTermsVersion(published.termsVersionId)).resolves.toEqual({
      version: retired,
      replayed: true,
    });
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toEqual({
      effectiveAt: '2026-08-12T00:00:00.000+08:00',
    });
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))).toEqual({});
    expect(window.localStorage.length).toBe(0);
  });

  it('rejects malformed Terms mutation input, responses, and replay evidence', async () => {
    await expect(
      createPilotTermsDocument({ documentCode: ' ', title: '标题' }),
    ).rejects.toMatchObject({ code: 'INVALID_TERMS_DOCUMENT_INPUT' });
    await expect(
      createPilotTermsDraft('not-a-document-id', {
        versionLabel: 'v1',
        content: '正文',
        locale: 'zh-CN',
        mustReaccept: false,
        supersedesTermsVersionId: null,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_TERMS_DOCUMENT_ID' });
    await expect(
      publishPilotTermsVersion('72000000-0000-4000-8000-000000000022', {
        effectiveAt: '2026-08-12',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_TERMS_PUBLISH_INPUT' });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'content-type': 'application/json', 'idempotency-replayed': 'maybe' },
      }),
    );
    await expect(
      retirePilotTermsVersion('72000000-0000-4000-8000-000000000022'),
    ).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
  });

  it('lists bounded Invitation directories for explicit Platform, canonical Channel, and Session Tenant scopes', async () => {
    const platformInvitation = {
      invitationId: '73000000-0000-4000-8000-000000000001',
      invitationType: 'PLATFORM',
      targetOrganizationId: null,
      targetRoleCode: null,
      targetEmail: 'platform-user@example.com',
      attributionChannelId: '73000000-0000-4000-8000-000000000002',
      status: 'active',
      validFrom: '2026-08-10T00:00:00.000Z',
      expiresAt: '2026-08-17T00:00:00.000Z',
      maxUses: 1,
      usedCount: 0,
      remainingUses: 1,
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
      revokedAt: null,
    };
    const channelInvitation = {
      ...platformInvitation,
      invitationId: '73000000-0000-4000-8000-000000000003',
      invitationType: 'CHANNEL',
      targetEmail: null,
      attributionChannelId: '73000000-0000-4000-8000-000000000006',
      maxUses: 100,
      remainingUses: 100,
    };
    const tenantId = '73000000-0000-4000-8000-000000000004';
    const tenantInvitation = {
      ...platformInvitation,
      invitationId: '73000000-0000-4000-8000-000000000005',
      invitationType: 'TENANT_MEMBER',
      targetOrganizationId: tenantId,
      targetRoleCode: 'content_operator',
      targetEmail: 'worker@example.com',
      attributionChannelId: null,
    };
    const channelId = '73000000-0000-4000-8000-000000000006';
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ invitations: [platformInvitation] }))
      .mockResolvedValueOnce(jsonResponse({ invitations: [channelInvitation] }))
      .mockResolvedValueOnce(jsonResponse({ invitations: [tenantInvitation] }));

    await expect(listPilotPlatformInvitations('active', 25)).resolves.toEqual([platformInvitation]);
    await expect(listPilotChannelInvitations(channelId, 'all', 20)).resolves.toEqual([
      channelInvitation,
    ]);
    await expect(listPilotTenantInvitations(tenantId, 'expired', 15)).resolves.toEqual([
      tenantInvitation,
    ]);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://control.example.com/api/v1/platform/invitations?status=active&limit=25',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      `https://control.example.com/api/v1/channels/${channelId}/invitations?status=all&limit=20`,
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      `https://control.example.com/api/v1/tenants/${tenantId}/invitations?status=expired&limit=15`,
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(window.localStorage.length).toBe(0);
  });

  it('rejects Channel invitation projections without one canonical Channel UUID', async () => {
    const channelInvitation = {
      invitationId: '73000000-0000-4000-8000-000000000003',
      invitationType: 'CHANNEL',
      targetOrganizationId: null,
      targetRoleCode: null,
      targetEmail: null,
      attributionChannelId: null,
      status: 'revoked',
      validFrom: '2026-08-10T00:00:00.000Z',
      expiresAt: '2026-08-17T00:00:00.000Z',
      maxUses: 100,
      usedCount: 0,
      remainingUses: 100,
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T01:00:00.000Z',
      revokedAt: '2026-08-10T01:00:00.000Z',
    };

    for (const unsafeProjection of [
      channelInvitation,
      { ...channelInvitation, attributionChannelId: 'not-a-channel-id' },
      {
        ...channelInvitation,
        attributionChannelId: '73000000-0000-4000-8000-000000000006',
        targetEmail: 'must-not-target@example.com',
      },
    ]) {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ invitations: [unsafeProjection] }));
      await expect(
        listPilotChannelInvitations('73000000-0000-4000-8000-000000000006'),
      ).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
    }
  });

  it('rejects guessed Invitation scopes, invalid filters, and sensitive management projections', async () => {
    await expect(
      listPilotChannelInvitations('organization-id-is-not-channel-id'),
    ).rejects.toMatchObject({ code: 'INVALID_CHANNEL_ID' });
    await expect(listPilotTenantInvitations('not-a-tenant-id')).rejects.toMatchObject({
      code: 'INVALID_TENANT_ID',
    });
    await expect(listPilotPlatformInvitations('unknown' as 'all')).rejects.toMatchObject({
      code: 'INVALID_INVITATION_STATUS',
    });
    await expect(listPilotPlatformInvitations('all', 101)).rejects.toMatchObject({
      code: 'INVALID_LIST_LIMIT',
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        invitations: [
          {
            invitationId: '73000000-0000-4000-8000-000000000001',
            invitationType: 'PLATFORM',
            targetOrganizationId: null,
            targetRoleCode: null,
            targetEmail: 'platform-user@example.com',
            attributionChannelId: null,
            status: 'active',
            validFrom: '2026-08-10T00:00:00.000Z',
            expiresAt: '2026-08-17T00:00:00.000Z',
            maxUses: 1,
            usedCount: 0,
            remainingUses: 1,
            createdAt: '2026-08-10T00:00:00.000Z',
            updatedAt: '2026-08-10T00:00:00.000Z',
            revokedAt: null,
            creationRequestDigest: 'must-not-cross-client-boundary',
          },
        ],
      }),
    );
    await expect(listPilotPlatformInvitations()).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
    });
    expect(window.localStorage.length).toBe(0);
  });

  it('creates scoped Invitations and keeps a first-response token only in caller memory', async () => {
    const temporaryToken = ['inv', 'temporary', 'value'].join('_');
    const platformInvitation = {
      invitationId: '73000000-0000-4000-8000-000000000011',
      invitationType: 'PLATFORM',
      targetOrganizationId: null,
      targetRoleCode: null,
      targetEmail: 'new-user@example.com',
      attributionChannelId: null,
      status: 'active',
      validFrom: '2026-08-10T01:00:00.000Z',
      expiresAt: '2026-08-17T01:00:00.000Z',
      maxUses: 1,
      usedCount: 0,
      remainingUses: 1,
      createdAt: '2026-08-10T01:00:00.000Z',
      updatedAt: '2026-08-10T01:00:00.000Z',
      revokedAt: null,
    };
    const channelId = '73000000-0000-4000-8000-000000000012';
    const channelInvitation = {
      ...platformInvitation,
      invitationId: '73000000-0000-4000-8000-000000000013',
      invitationType: 'CHANNEL',
      targetEmail: null,
      attributionChannelId: channelId,
      maxUses: 100,
      remainingUses: 100,
    };
    const tenantId = '73000000-0000-4000-8000-000000000014';
    const tenantInvitation = {
      ...platformInvitation,
      invitationId: '73000000-0000-4000-8000-000000000015',
      invitationType: 'TENANT_MEMBER',
      targetOrganizationId: tenantId,
      targetRoleCode: 'content_operator',
      targetEmail: 'worker@example.com',
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ invitation: platformInvitation, token: temporaryToken }), {
          status: 201,
          headers: {
            'content-type': 'application/json',
            'idempotency-replayed': 'false',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ invitation: channelInvitation, token: null }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'idempotency-replayed': 'true',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ invitation: tenantInvitation, token: temporaryToken }), {
          status: 201,
          headers: {
            'content-type': 'application/json',
            'idempotency-replayed': 'false',
          },
        }),
      );

    await expect(
      createPilotPlatformInvitation({
        targetEmail: 'new-user@example.com',
        attributionChannelId: null,
        idempotencyKey: 'platform-create-1',
      }),
    ).resolves.toEqual({ invitation: platformInvitation, token: temporaryToken, replayed: false });
    await expect(
      createPilotChannelInvitation(channelId, { idempotencyKey: 'channel-create-1' }),
    ).resolves.toEqual({ invitation: channelInvitation, token: null, replayed: true });
    await expect(
      createPilotTenantInvitation(tenantId, {
        targetEmail: 'worker@example.com',
        idempotencyKey: 'tenant-create-1',
      }),
    ).resolves.toEqual({ invitation: tenantInvitation, token: temporaryToken, replayed: false });

    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toEqual({
      targetEmail: 'new-user@example.com',
      attributionChannelId: null,
      idempotencyKey: 'platform-create-1',
    });
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))).toEqual({
      idempotencyKey: 'channel-create-1',
    });
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[2]?.[1]?.body))).toEqual({
      targetEmail: 'worker@example.com',
      idempotencyKey: 'tenant-create-1',
    });
    expect(window.localStorage.length).toBe(0);
  });

  it('revokes Invitations with strict replay evidence and rejects token replay ambiguity', async () => {
    const invitationId = '73000000-0000-4000-8000-000000000021';
    const revokedInvitation = {
      invitationId,
      invitationType: 'PLATFORM',
      targetOrganizationId: null,
      targetRoleCode: null,
      targetEmail: 'new-user@example.com',
      attributionChannelId: null,
      status: 'revoked',
      validFrom: '2026-08-10T01:00:00.000Z',
      expiresAt: '2026-08-17T01:00:00.000Z',
      maxUses: 1,
      usedCount: 0,
      remainingUses: 1,
      createdAt: '2026-08-10T01:00:00.000Z',
      updatedAt: '2026-08-10T02:00:00.000Z',
      revokedAt: '2026-08-10T02:00:00.000Z',
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ invitation: revokedInvitation }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'idempotency-replayed': 'true',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ invitation: revokedInvitation, token: 'unexpected' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'idempotency-replayed': 'true',
          },
        }),
      );

    await expect(revokePilotInvitation(invitationId)).resolves.toEqual({
      invitation: revokedInvitation,
      replayed: true,
    });
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toEqual({});
    await expect(
      createPilotPlatformInvitation({
        targetEmail: 'new-user@example.com',
        attributionChannelId: null,
        idempotencyKey: 'platform-create-1',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
    expect(window.localStorage.length).toBe(0);
  });

  it('preserves Invitation service errors and Request IDs without fallback or token recovery', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'INVITATION_SCOPE_CONFLICT',
            message: '邀请范围与当前组织不一致。',
            requestId: 'invitation-scope-1',
          },
        },
        409,
      ),
    );
    await expect(
      listPilotChannelInvitations('73000000-0000-4000-8000-000000000006'),
    ).rejects.toMatchObject({
      code: 'INVITATION_SCOPE_CONFLICT',
      status: 409,
      requestId: 'invitation-scope-1',
    });
    expect(window.localStorage.length).toBe(0);
  });

  it('preserves commercial 401/403/404/409/422/5xx status and Request ID without fallback data', async () => {
    for (const [status, code] of [
      [401, 'SESSION_INVALID'],
      [403, 'CHANNEL_PERMISSION_DENIED'],
      [404, 'CHANNEL_SCOPE_NOT_FOUND'],
      [409, 'COMMISSION_SETTLEMENT_PERIOD_CONFLICT'],
      [422, 'COMMISSION_SETTLEMENT_VALIDATION_FAILED'],
      [503, 'SERVICE_UNAVAILABLE'],
    ] as const) {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse(
          { error: { code, message: '安全错误', requestId: `commercial-${status}` } },
          status,
        ),
      );
      await expect(readPilotCurrentChannel()).rejects.toMatchObject({
        code,
        status,
        requestId: `commercial-${status}`,
      });
    }
    expect(window.localStorage.length).toBe(0);
  });
});
