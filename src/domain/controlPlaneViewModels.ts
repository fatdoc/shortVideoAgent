import {
  DEMO_DATA_LABEL,
  type Capability,
  type ChannelOrganization,
  type ControlPlaneDemoState,
  type DemoChannelCreditInventory,
  type DemoChannelSettlementSummary,
  type DemoCommercialOrder,
  type DemoCreditValue,
  type DemoPlatformRiskSummary,
  type DemoPriceSnapshot,
  type DemoRateCard,
  type Entitlement,
  type PlatformContext,
  type Product,
  type SKU,
  type TenantContext,
  type WalletStatus,
} from './controlPlane';

type StatusCounts = Record<string, number>;

export interface CommercialOperationsSummary {
  generationTasks: {
    total: number;
    failed: number;
    byStatus: StatusCounts;
  };
  assets: {
    total: number;
    byReviewStatus: StatusCounts;
  };
  exports: {
    total: number;
    failed: number;
    byStatus: StatusCounts;
  };
}

export interface TenantCommercialSummary {
  tenantId: string;
  displayName: string;
  status: TenantContext['status'];
  acquisitionMode: TenantContext['acquisitionMode'];
  currentServiceChannelOrganizationId: string | null;
  entitlementCount: number;
  activeEntitlementCount: number;
  wallet: {
    status: WalletStatus;
    available: DemoCreditValue;
    reserved: DemoCreditValue;
    disclaimer: typeof DEMO_DATA_LABEL;
  };
  creditUsage: {
    scenarioCount: number;
    consumed: DemoCreditValue;
    released: DemoCreditValue;
    disclaimer: typeof DEMO_DATA_LABEL;
  };
  operations: CommercialOperationsSummary;
}

export interface PlatformCommercialView {
  platform: PlatformContext;
  channels: ChannelOrganization[];
  tenant: TenantCommercialSummary;
  capabilities: Capability[];
  products: Product[];
  skus: SKU[];
  rateCard: DemoRateCard;
  priceSnapshots: DemoPriceSnapshot[];
  orders: DemoCommercialOrder[];
  channelInventories: DemoChannelCreditInventory[];
  settlementSummaries: DemoChannelSettlementSummary[];
  platformRisk: DemoPlatformRiskSummary;
  operations: CommercialOperationsSummary;
  disclaimer: typeof DEMO_DATA_LABEL;
}

export interface ChannelCommercialView {
  channel: ChannelOrganization;
  directSubchannels: ChannelOrganization[];
  customers: TenantCommercialSummary[];
  products: Product[];
  skus: SKU[];
  priceSnapshots: DemoPriceSnapshot[];
  orders: DemoCommercialOrder[];
  inventory: DemoChannelCreditInventory;
  settlementSummary: DemoChannelSettlementSummary;
  disclaimer: typeof DEMO_DATA_LABEL;
}

export interface TenantProductView {
  product: Product;
  skus: SKU[];
  purchaseState: 'purchased' | 'locked' | 'explanation_only';
}

export interface TenantCommercialView {
  tenant: TenantContext;
  entitlements: Entitlement[];
  products: TenantProductView[];
  wallet: {
    status: WalletStatus;
    available: DemoCreditValue;
    reserved: DemoCreditValue;
    disclaimer: typeof DEMO_DATA_LABEL;
  };
  projectId: string;
  operations: CommercialOperationsSummary;
  disclaimer: typeof DEMO_DATA_LABEL;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function countBy(values: string[]): StatusCounts {
  return values.reduce<StatusCounts>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function selectOperationsSummary(snapshot: ControlPlaneDemoState): CommercialOperationsSummary {
  const taskStatuses = snapshot.generationTaskReceipts.map((receipt) => receipt.status);
  const assetStatuses = snapshot.assetReceipts.map((receipt) => receipt.reviewStatus);
  const exportStatuses = snapshot.exportReceipts.map((receipt) => receipt.status);

  return {
    generationTasks: {
      total: taskStatuses.length,
      failed: taskStatuses.filter((status) => status === 'failed').length,
      byStatus: countBy(taskStatuses),
    },
    assets: {
      total: assetStatuses.length,
      byReviewStatus: countBy(assetStatuses),
    },
    exports: {
      total: exportStatuses.length,
      failed: exportStatuses.filter((status) => status === 'failed').length,
      byStatus: countBy(exportStatuses),
    },
  };
}

function selectTenantSummary(snapshot: ControlPlaneDemoState): TenantCommercialSummary {
  const entitlements = snapshot.commercial.entitlements.filter(
    (entitlement) => entitlement.tenantId === snapshot.commercial.tenant.tenantId,
  );
  const wallet = snapshot.commercial.creditState.wallet;
  const creditScenarios = snapshot.commercial.creditScenarios;
  const consumedCredits = creditScenarios.reduce(
    (total, scenario) => total + scenario.consumedCredits.value,
    0,
  );
  const releasedCredits = creditScenarios.reduce(
    (total, scenario) => total + scenario.releasedCredits.value,
    0,
  );

  return {
    tenantId: snapshot.commercial.tenant.tenantId,
    displayName: snapshot.commercial.tenant.displayName,
    status: snapshot.commercial.tenant.status,
    acquisitionMode: snapshot.commercial.tenant.acquisitionMode,
    currentServiceChannelOrganizationId:
      snapshot.commercial.tenant.currentServiceChannelOrganizationId,
    entitlementCount: entitlements.length,
    activeEntitlementCount: entitlements.filter((item) => item.status === 'active').length,
    wallet: {
      status: wallet.status,
      available: clone(wallet.available),
      reserved: clone(wallet.reserved),
      disclaimer: wallet.disclaimer,
    },
    creditUsage: {
      scenarioCount: creditScenarios.length,
      consumed: {
        ...clone(wallet.available),
        value: consumedCredits,
      },
      released: {
        ...clone(wallet.available),
        value: releasedCredits,
      },
      disclaimer: wallet.disclaimer,
    },
    operations: selectOperationsSummary(snapshot),
  };
}

export function selectPlatformCommercialView(
  snapshot: ControlPlaneDemoState,
): PlatformCommercialView {
  const business = snapshot.commercial.demoBusiness;

  return {
    platform: clone(snapshot.commercial.platform),
    channels: clone(snapshot.commercial.channels),
    tenant: selectTenantSummary(snapshot),
    capabilities: clone(snapshot.commercial.capabilities),
    products: clone(snapshot.commercial.products),
    skus: clone(snapshot.commercial.skus),
    rateCard: clone(snapshot.commercial.rateCard),
    priceSnapshots: clone(business.priceSnapshots),
    orders: clone(business.orders),
    channelInventories: clone(business.channelInventories),
    settlementSummaries: clone(business.settlementSummaries),
    platformRisk: clone(business.platformRisk),
    operations: selectOperationsSummary(snapshot),
    disclaimer: business.disclaimer,
  };
}

export function selectChannelCommercialView(
  snapshot: ControlPlaneDemoState,
): ChannelCommercialView {
  const business = snapshot.commercial.demoBusiness;
  const channelId = business.fixedChannelOrganizationId;
  const channel = snapshot.commercial.channels.find(
    (item) => item.channelOrganizationId === channelId,
  );
  const inventory = business.channelInventories.find(
    (item) => item.channelOrganizationId === channelId,
  );
  const settlementSummary = business.settlementSummaries.find(
    (item) => item.channelOrganizationId === channelId,
  );

  if (!channel || !inventory || !settlementSummary) {
    throw new Error(`Fixed demo channel ${channelId} is not fully configured`);
  }

  const isDirectParty = (price: DemoPriceSnapshot) =>
    price.seller.partyId === channelId || price.buyer.partyId === channelId;
  const tenantBelongsToChannel =
    snapshot.commercial.tenant.currentServiceChannelOrganizationId === channelId;
  const visibleProductIds = new Set(
    snapshot.commercial.products
      .filter((product) => product.availability !== 'locked')
      .map((product) => product.productId),
  );

  return {
    channel: clone(channel),
    directSubchannels: clone(
      snapshot.commercial.channels.filter((item) => item.parentChannelOrganizationId === channelId),
    ),
    customers: tenantBelongsToChannel ? [selectTenantSummary(snapshot)] : [],
    products: clone(
      snapshot.commercial.products.filter((product) => visibleProductIds.has(product.productId)),
    ),
    skus: clone(snapshot.commercial.skus.filter((sku) => visibleProductIds.has(sku.productId))),
    priceSnapshots: clone(business.priceSnapshots.filter(isDirectParty)),
    orders: clone(business.orders.filter((order) => order.seller.partyId === channelId)),
    inventory: clone(inventory),
    settlementSummary: clone(settlementSummary),
    disclaimer: business.disclaimer,
  };
}

export function selectTenantCommercialView(snapshot: ControlPlaneDemoState): TenantCommercialView {
  const tenant = snapshot.commercial.tenant;
  const entitlements = snapshot.commercial.entitlements.filter(
    (item) => item.tenantId === tenant.tenantId,
  );
  const activeCapabilityIds = new Set(
    entitlements.filter((item) => item.status === 'active').map((item) => item.capabilityId),
  );
  const wallet = snapshot.commercial.creditState.wallet;

  return {
    tenant: clone(tenant),
    entitlements: clone(entitlements),
    products: snapshot.commercial.products.map((product) => {
      const productSkus = snapshot.commercial.skus.filter(
        (sku) => sku.productId === product.productId,
      );
      const purchased = product.capabilityIds.some((capabilityId) =>
        activeCapabilityIds.has(capabilityId),
      );
      return {
        product: clone(product),
        skus: clone(productSkus),
        purchaseState: purchased
          ? 'purchased'
          : product.availability === 'locked'
            ? 'locked'
            : 'explanation_only',
      };
    }),
    wallet: {
      status: wallet.status,
      available: clone(wallet.available),
      reserved: clone(wallet.reserved),
      disclaimer: wallet.disclaimer,
    },
    projectId: snapshot.fixtureId,
    operations: selectOperationsSummary(snapshot),
    disclaimer: snapshot.commercial.demoBusiness.disclaimer,
  };
}
