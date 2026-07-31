import { describe, expect, it } from 'vitest';
import { DEMO_DATA_LABEL, type ControlPlaneDemoState } from './controlPlane';
import { controlPlaneDemoStateSchema, demoCommercialProjectionSchema } from './controlPlaneSchemas';
import {
  selectChannelCommercialView,
  selectPlatformCommercialView,
  selectTenantCommercialView,
} from './controlPlaneViewModels';
import { createControlPlaneDemoState, DEMO_TENANT_ID } from '../mocks/controlPlaneDemo';

function assertDemoSemantics(value: unknown) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach(assertDemoSemantics);
    return;
  }

  const record = value as Record<string, unknown>;
  if ('amountMinor' in record || ('value' in record && record.unit === 'AI_VIDEO_CREDIT')) {
    expect(record.dataMode).toBe('DEMO');
    expect(record.quoteStatus).toBe('NON_QUOTE');
    expect(record.label).toBe(DEMO_DATA_LABEL);
  }
  Object.values(record).forEach(assertDemoSemantics);
}

function cloneSnapshot(snapshot: ControlPlaneDemoState): ControlPlaneDemoState {
  return structuredClone(snapshot);
}

describe('A-03.1 commercial demo fixture', () => {
  it('passes the canonical runtime schema with DEMO/NON_QUOTE semantics', () => {
    const snapshot = createControlPlaneDemoState();

    expect(controlPlaneDemoStateSchema.parse(snapshot)).toBe(snapshot);
    assertDemoSemantics(snapshot.commercial.demoBusiness);
  });

  it('keeps order, inventory and settlement arithmetic internally consistent', () => {
    const business = createControlPlaneDemoState().commercial.demoBusiness;

    for (const order of business.orders) {
      expect(order.listAmount.amountMinor - order.discountAmount.amountMinor).toBe(
        order.netAmount.amountMinor,
      );
      expect(order.netAmount.amountMinor - order.acquisitionCost.amountMinor).toBe(
        order.grossSpread.amountMinor,
      );
    }

    const inventory = business.channelInventories[0];
    expect(inventory.purchasedCredits.value).toBe(
      inventory.allocatedToSubchannels.value +
        inventory.allocatedToTenants.value +
        inventory.availableCredits.value,
    );

    const settlement = business.settlementSummaries[0];
    expect(
      settlement.openingAvailableCredits.value +
        settlement.purchasedCredits.value -
        settlement.soldCredits.value,
    ).toBe(settlement.closingAvailableCredits.value);
    expect(settlement.salesNetAmount.amountMinor - settlement.acquisitionCost.amountMinor).toBe(
      settlement.grossSpread.amountMinor,
    );
  });

  it('rejects broken arithmetic and negative commercial credits at the schema boundary', () => {
    const brokenOrder = cloneSnapshot(createControlPlaneDemoState()).commercial.demoBusiness;
    brokenOrder.orders[0].grossSpread.amountMinor = 999;
    expect(() => demoCommercialProjectionSchema.parse(brokenOrder)).toThrow(
      'DemoCommercialOrder gross spread is inconsistent',
    );

    const negativeInventory = cloneSnapshot(createControlPlaneDemoState()).commercial.demoBusiness;
    negativeInventory.channelInventories[0].availableCredits.value = -1;
    expect(() => demoCommercialProjectionSchema.parse(negativeInventory)).toThrow(
      'DemoChannelCreditInventory.availableCredits.value must be non-negative',
    );
  });
});

describe('A-03.1 scoped commercial selectors', () => {
  it('projects every commercial layer and global summary for platform', () => {
    const view = selectPlatformCommercialView(createControlPlaneDemoState());

    expect(new Set(view.priceSnapshots.map((price) => price.priceLayer))).toEqual(
      new Set([
        'UPSTREAM_COST',
        'PLATFORM_SETTLEMENT',
        'CHANNEL_WHOLESALE',
        'CUSTOMER_RETAIL',
        'CAMPAIGN',
      ]),
    );
    expect(view.channels).toHaveLength(3);
    expect(view.orders).toHaveLength(2);
    expect(view.channelInventories[0].availableCredits.value).toBe(500);
    expect(view.settlementSummaries[0].grossSpread.amountMinor).toBe(6000);
    expect(view.platformRisk.openCommercialExceptions).toBe(1);

    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain('scriptApprovals');
    expect(serialized).not.toContain('brandFactsSnapshot');
    expect(serialized).not.toContain('creditState');
    expect(serialized).not.toContain('ledger');
  });

  it('projects only the fixed channel, direct parties and channel commercial records', () => {
    const view = selectChannelCommercialView(createControlPlaneDemoState());

    expect(view.channel.channelOrganizationId).toBe('channel-demo-level-1');
    expect(view.directSubchannels.map((item) => item.channelOrganizationId)).toEqual([
      'channel-demo-level-2',
    ]);
    expect(view.customers.map((item) => item.tenantId)).toEqual([DEMO_TENANT_ID]);
    expect(view.priceSnapshots.map((item) => item.priceSnapshotId)).toEqual([
      'price-demo-master-level-1',
      'price-demo-level-1-level-2',
      'price-demo-level-1-tenant-retail',
      'price-demo-level-1-tenant-campaign',
    ]);
    expect(view.orders).toHaveLength(2);
    expect(
      view.orders.every((order) => order.seller.partyId === view.channel.channelOrganizationId),
    ).toBe(true);
    expect(view.inventory.availableCredits.value).toBe(500);
    expect(view.settlementSummary.grossSpread.amountMinor).toBe(6000);

    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain('UPSTREAM_COST');
    expect(serialized).not.toContain('PLATFORM_SETTLEMENT');
    expect(serialized).not.toContain('provider-demo-generation');
    expect(serialized).not.toContain('platformRisk');
    expect(serialized).not.toContain('scriptApprovals');
    expect(serialized).not.toContain('creditState');
    expect(serialized).not.toContain('ledger');
  });

  it('projects tenant products, entitlement, wallet and receipt counts without price internals', () => {
    const view = selectTenantCommercialView(createControlPlaneDemoState());

    expect(view.tenant.tenantId).toBe(DEMO_TENANT_ID);
    expect(view.projectId).toBe('demo-local-001');
    expect(view.entitlements).toHaveLength(4);
    expect(view.wallet.available.value).toBe(1000);
    expect(view.wallet.reserved.value).toBe(0);
    expect(view.operations).toEqual({
      generationTasks: { total: 0, failed: 0, byStatus: {} },
      assets: { total: 0, byReviewStatus: {} },
      exports: { total: 0, failed: 0, byStatus: {} },
    });
    expect(view.products.filter((item) => item.purchaseState === 'purchased')).toHaveLength(2);

    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain('priceSnapshots');
    expect(serialized).not.toContain('orders');
    expect(serialized).not.toContain('channelInventories');
    expect(serialized).not.toContain('settlementSummaries');
    expect(serialized).not.toContain('platformRisk');
    expect(serialized).not.toContain('UPSTREAM_COST');
    expect(serialized).not.toContain('ledger');
    expect(serialized).not.toContain('scriptApprovals');
  });

  it('throws instead of silently selecting another channel when fixed channel is invalid', () => {
    const snapshot = cloneSnapshot(createControlPlaneDemoState());
    snapshot.commercial.demoBusiness.fixedChannelOrganizationId = 'channel-demo-missing';

    expect(() => selectChannelCommercialView(snapshot)).toThrow(
      'Fixed demo channel channel-demo-missing is not fully configured',
    );
  });
});
