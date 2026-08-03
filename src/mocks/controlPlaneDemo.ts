import {
  CONTROL_PLANE_CONTRACT_VERSION,
  CONTROL_PLANE_FIXTURE_ID,
  DEMO_DATA_LABEL,
  DEMO_READY,
  type Capability,
  type CapabilityTruthManifest,
  type ChannelOrganization,
  type DemoCommercialParty,
  type DemoCommercialProjection,
  type ControlPlaneCommercialFixture,
  type ControlPlaneDemoState,
  type DemoMoneyValue,
  type DemoProjectGrant,
  type Entitlement,
  type AssetReceipt,
  type GenerationTaskReceipt,
  type Membership,
  type Product,
  type ProjectProductionPackage,
  type ScriptApproval,
  type SKU,
  type StoryCanvasTransportState,
} from '../domain/controlPlane';
import { createDemoReadyCreditState, demoCredits } from '../domain/creditLedger';
import { digestValue } from '../domain/controlPlaneUtils';
import type { DemoWorkspace } from '../domain/types';
import { cloneDemoWorkspace } from './demoWorkspace';

export const DEMO_TENANT_ID = 'tenant-demo-hdl';
export const DEMO_TENANT_ORGANIZATION_ID = DEMO_TENANT_ID;
export const DEMO_BRAND_ID = 'brand-demo-hdl';
export const DEMO_STORE_ID = 'store-demo-hdl-sanlitun';
export const DEMO_CAMPAIGN_ID = 'campaign-demo-hdl-douyin';
export const DEMO_PACKAGE_ID = 'package-demo-local-001-v1';
export const DEMO_PACKAGE_IDEMPOTENCY_KEY = 'package-create-demo-local-001-v1';
export const DEMO_RATE_CARD_ID = 'ratecard-demo-standard-video';
export const DEMO_RATE_CARD_VERSION = 'demo-v1';
export const DEMO_SUCCESS_TASK_ID = 'task-demo-success';
export const DEMO_SUCCESS_RESERVATION_ID = 'reservation-demo-success-120';
export const DEMO_SUCCESS_ASSET_ID = 'asset-demo-generated-shot-07';
export const DEMO_FAILURE_TASK_ID = 'task-demo-failure';
export const DEMO_FAILURE_RESERVATION_ID = 'reservation-demo-failure-80';

export const CAPABILITY_IDS = {
  baseGeneration: 'cap-production-base-generation',
  localLife: 'cap-agent-local-life',
  ownerIp: 'cap-agent-owner-ip',
  ecommerce: 'cap-agent-ecommerce',
  digitalHuman: 'cap-addon-digital-human',
  apiAccess: 'cap-access-api',
} as const;

export const ENTITLEMENT_IDS = {
  baseGeneration: 'ent-demo-base-generation-active',
  localLife: 'ent-demo-local-life-active',
  digitalHuman: 'ent-demo-digital-human-locked',
  apiAccess: 'ent-demo-api-locked',
} as const;

const DEMO_CREATED_AT = '2026-07-30T00:00:00.000Z';
const DEMO_VALID_TO = '2027-07-30T00:00:00.000Z';
const DEMO_CHANNEL_MASTER_ID = 'channel-demo-master';
const DEMO_CHANNEL_LEVEL_1_ID = 'channel-demo-level-1';
const DEMO_CHANNEL_LEVEL_2_ID = 'channel-demo-level-2';
const DEMO_PLATFORM_ID = 'platform-videoagent';
const DEMO_PROVIDER_ID = 'provider-demo-generation';
export const DEFAULT_STORYCANVAS_API_BASE =
  'http://localhost:10588/api/production/v0.1';

function demoMoney(amountMinor: number): DemoMoneyValue {
  return {
    amountMinor,
    currency: 'CNY',
    dataMode: 'DEMO',
    quoteStatus: 'NON_QUOTE',
    label: DEMO_DATA_LABEL,
  };
}

function demoParty(
  partyType: DemoCommercialParty['partyType'],
  partyId: string,
  displayName: string,
): DemoCommercialParty {
  return { partyType, partyId, displayName };
}

const capabilities: Capability[] = [
  {
    capabilityId: CAPABILITY_IDS.baseGeneration,
    code: 'production.base_generation',
    displayName: 'AI 视频基础生成',
    description: 'Brief、脚本、分镜、生成、资产、QA 与导出的共享生产能力。',
    category: 'production',
    availability: 'active',
    dependencyCapabilityIds: [],
  },
  {
    capabilityId: CAPABILITY_IDS.localLife,
    code: 'agent.local_life',
    displayName: '本地生活 Agent',
    description: '门店事实、镜头规划、团购 CTA 与本地生活生产流程。',
    category: 'agent',
    availability: 'active',
    dependencyCapabilityIds: [CAPABILITY_IDS.baseGeneration],
  },
  {
    capabilityId: CAPABILITY_IDS.ownerIp,
    code: 'agent.owner_ip',
    displayName: '老板 IP Agent',
    description: 'D1 仅展示产品说明，不进入可执行黄金路径。',
    category: 'agent',
    availability: 'explanation_only',
    dependencyCapabilityIds: [CAPABILITY_IDS.baseGeneration],
  },
  {
    capabilityId: CAPABILITY_IDS.ecommerce,
    code: 'agent.ecommerce',
    displayName: '电商素材 Agent',
    description: 'D1 仅展示产品说明，不进入可执行黄金路径。',
    category: 'agent',
    availability: 'explanation_only',
    dependencyCapabilityIds: [CAPABILITY_IDS.baseGeneration],
  },
  {
    capabilityId: CAPABILITY_IDS.digitalHuman,
    code: 'addon.digital_human',
    displayName: '数字人 Add-on',
    description: 'D1 未购买且待授权，执行端点必须拒绝。',
    category: 'addon',
    availability: 'locked',
    dependencyCapabilityIds: [
      CAPABILITY_IDS.baseGeneration,
      CAPABILITY_IDS.localLife,
    ],
  },
  {
    capabilityId: CAPABILITY_IDS.apiAccess,
    code: 'access.api',
    displayName: 'API Add-on',
    description: 'D1 未购买且待授权，不代表已开放真实 API。',
    category: 'access',
    availability: 'locked',
    dependencyCapabilityIds: [CAPABILITY_IDS.baseGeneration],
  },
];

const products: Product[] = [
  {
    productId: 'product-demo-base-generation',
    code: 'product.base_generation',
    displayName: 'AI 视频基础生成包',
    description: '共享媒体生产能力与演示 AI 视频额度。',
    productType: 'base',
    capabilityIds: [CAPABILITY_IDS.baseGeneration],
    availability: 'active',
    demoAction: 'usable',
  },
  {
    productId: 'product-demo-local-life',
    code: 'product.local_life_agent',
    displayName: '本地生活 Agent 包',
    description: '海底捞三里屯 D1 黄金路径主场景。',
    productType: 'agent',
    capabilityIds: [CAPABILITY_IDS.localLife],
    availability: 'active',
    demoAction: 'usable',
  },
  {
    productId: 'product-demo-owner-ip',
    code: 'product.owner_ip_agent',
    displayName: '老板 IP Agent 包',
    description: '说明态产品卡，不进入黄金路径。',
    productType: 'agent',
    capabilityIds: [CAPABILITY_IDS.ownerIp],
    availability: 'explanation_only',
    demoAction: 'explain',
  },
  {
    productId: 'product-demo-ecommerce',
    code: 'product.ecommerce_agent',
    displayName: '电商素材 Agent 包',
    description: '说明态产品卡，不进入黄金路径。',
    productType: 'agent',
    capabilityIds: [CAPABILITY_IDS.ecommerce],
    availability: 'explanation_only',
    demoAction: 'explain',
  },
  {
    productId: 'product-demo-digital-human',
    code: 'product.digital_human_addon',
    displayName: '数字人 Add-on',
    description: '未购买 / 待授权。',
    productType: 'addon',
    capabilityIds: [CAPABILITY_IDS.digitalHuman],
    availability: 'locked',
    demoAction: 'locked',
  },
  {
    productId: 'product-demo-api',
    code: 'product.api_addon',
    displayName: 'API Add-on',
    description: '未购买 / 待授权。',
    productType: 'addon',
    capabilityIds: [CAPABILITY_IDS.apiAccess],
    availability: 'locked',
    demoAction: 'locked',
  },
];

const skus: SKU[] = products.map((product, index) => ({
  skuId: `sku-demo-${index + 1}`,
  productId: product.productId,
  code: `${product.code}.demo`,
  displayName: `${product.displayName} · D1 演示规格`,
  status:
    product.availability === 'active'
      ? 'active'
      : product.availability === 'locked'
        ? 'locked'
        : 'explanation_only',
  entitlementCapabilityIds: [...product.capabilityIds],
  includedCredits: demoCredits(product.code === 'product.base_generation' ? 1000 : 0),
  validityDays: 365,
}));

const tenantWideScope = {
  kind: 'TENANT_WIDE' as const,
  tenantId: DEMO_TENANT_ID,
};

const entitlements: Entitlement[] = [
  {
    entitlementId: ENTITLEMENT_IDS.baseGeneration,
    tenantId: DEMO_TENANT_ID,
    capabilityId: CAPABILITY_IDS.baseGeneration,
    sourceType: 'DEMO_SKU',
    sourceId: 'sku-demo-1',
    scope: tenantWideScope,
    status: 'active',
    validFrom: DEMO_CREATED_AT,
    validTo: DEMO_VALID_TO,
    demo: {
      dataMode: 'DEMO',
      quoteStatus: 'NON_QUOTE',
      label: DEMO_DATA_LABEL,
    },
  },
  {
    entitlementId: ENTITLEMENT_IDS.localLife,
    tenantId: DEMO_TENANT_ID,
    capabilityId: CAPABILITY_IDS.localLife,
    sourceType: 'DEMO_SKU',
    sourceId: 'sku-demo-2',
    scope: tenantWideScope,
    status: 'active',
    validFrom: DEMO_CREATED_AT,
    validTo: DEMO_VALID_TO,
    demo: {
      dataMode: 'DEMO',
      quoteStatus: 'NON_QUOTE',
      label: DEMO_DATA_LABEL,
    },
  },
  {
    entitlementId: ENTITLEMENT_IDS.digitalHuman,
    tenantId: DEMO_TENANT_ID,
    capabilityId: CAPABILITY_IDS.digitalHuman,
    sourceType: 'DEMO_LOCK',
    sourceId: 'sku-demo-5',
    scope: tenantWideScope,
    status: 'locked',
    validFrom: DEMO_CREATED_AT,
    validTo: DEMO_VALID_TO,
    demo: {
      dataMode: 'DEMO',
      quoteStatus: 'NON_QUOTE',
      label: DEMO_DATA_LABEL,
    },
  },
  {
    entitlementId: ENTITLEMENT_IDS.apiAccess,
    tenantId: DEMO_TENANT_ID,
    capabilityId: CAPABILITY_IDS.apiAccess,
    sourceType: 'DEMO_LOCK',
    sourceId: 'sku-demo-6',
    scope: tenantWideScope,
    status: 'locked',
    validFrom: DEMO_CREATED_AT,
    validTo: DEMO_VALID_TO,
    demo: {
      dataMode: 'DEMO',
      quoteStatus: 'NON_QUOTE',
      label: DEMO_DATA_LABEL,
    },
  },
];

const channels: ChannelOrganization[] = [
  {
    channelOrganizationId: DEMO_CHANNEL_MASTER_ID,
    displayName: '总代理演示组织',
    contextType: 'CHANNEL',
    tier: 'MASTER',
    depth: 1,
    parentChannelOrganizationId: null,
    status: 'active',
    whiteLabelMode: false,
  },
  {
    channelOrganizationId: DEMO_CHANNEL_LEVEL_1_ID,
    displayName: '一级代理演示组织',
    contextType: 'CHANNEL',
    tier: 'LEVEL_1',
    depth: 2,
    parentChannelOrganizationId: DEMO_CHANNEL_MASTER_ID,
    status: 'active',
    whiteLabelMode: false,
  },
  {
    channelOrganizationId: DEMO_CHANNEL_LEVEL_2_ID,
    displayName: '二级代理演示组织',
    contextType: 'CHANNEL',
    tier: 'LEVEL_2',
    depth: 3,
    parentChannelOrganizationId: DEMO_CHANNEL_LEVEL_1_ID,
    status: 'active',
    whiteLabelMode: false,
  },
];

const memberships: Membership[] = [
  {
    membershipId: 'membership-demo-platform-admin',
    principalId: 'principal-demo-owner',
    organizationType: 'PLATFORM',
    organizationId: 'platform-videoagent',
    roleCodes: ['platform.admin'],
    dataScopes: [{ kind: 'PLATFORM_GLOBAL' }],
    status: 'active',
    validFrom: DEMO_CREATED_AT,
    validTo: null,
  },
  {
    membershipId: 'membership-demo-channel-level-1',
    principalId: 'principal-demo-owner',
    organizationType: 'CHANNEL',
    organizationId: DEMO_CHANNEL_LEVEL_1_ID,
    roleCodes: ['channel.admin'],
    dataScopes: [{ kind: 'CHANNEL_SUBTREE_COMMERCIAL' }],
    status: 'active',
    validFrom: DEMO_CREATED_AT,
    validTo: null,
  },
  {
    membershipId: 'membership-demo-tenant-owner',
    principalId: 'principal-demo-owner',
    organizationType: 'TENANT',
    organizationId: DEMO_TENANT_ORGANIZATION_ID,
    roleCodes: ['tenant.owner', 'production.operator'],
    dataScopes: [
      tenantWideScope,
      {
        kind: 'PROJECT_SET',
        tenantId: DEMO_TENANT_ID,
        projectIds: [CONTROL_PLANE_FIXTURE_ID],
      },
    ],
    status: 'active',
    validFrom: DEMO_CREATED_AT,
    validTo: null,
  },
];

function buildDemoCommercialProjection(): DemoCommercialProjection {
  const provider = demoParty('PROVIDER', DEMO_PROVIDER_ID, '演示生成服务商');
  const platform = demoParty('PLATFORM', DEMO_PLATFORM_ID, '短视频营销 Agent 平台');
  const master = demoParty('CHANNEL', DEMO_CHANNEL_MASTER_ID, '总代理演示组织');
  const level1 = demoParty('CHANNEL', DEMO_CHANNEL_LEVEL_1_ID, '一级代理演示组织');
  const level2 = demoParty('CHANNEL', DEMO_CHANNEL_LEVEL_2_ID, '二级代理演示组织');
  const tenant = demoParty('TENANT', DEMO_TENANT_ID, '海底捞演示企业');

  return {
    fixedChannelOrganizationId: DEMO_CHANNEL_LEVEL_1_ID,
    priceSnapshots: [
      {
        priceSnapshotId: 'price-demo-upstream-cost',
        version: 'demo-v1',
        priceLayer: 'UPSTREAM_COST',
        seller: provider,
        buyer: platform,
        skuId: 'sku-demo-1',
        chargeUnit: 'PER_STANDARD_TASK',
        unitPrice: demoMoney(680),
        taxIncluded: false,
        effectiveFrom: DEMO_CREATED_AT,
        effectiveTo: DEMO_VALID_TO,
        disclaimer: DEMO_DATA_LABEL,
      },
      {
        priceSnapshotId: 'price-demo-platform-master',
        version: 'demo-v1',
        priceLayer: 'PLATFORM_SETTLEMENT',
        seller: platform,
        buyer: master,
        skuId: 'sku-demo-1',
        chargeUnit: 'PER_AI_VIDEO_CREDIT',
        unitPrice: demoMoney(8),
        taxIncluded: false,
        effectiveFrom: DEMO_CREATED_AT,
        effectiveTo: DEMO_VALID_TO,
        disclaimer: DEMO_DATA_LABEL,
      },
      {
        priceSnapshotId: 'price-demo-master-level-1',
        version: 'demo-v1',
        priceLayer: 'CHANNEL_WHOLESALE',
        seller: master,
        buyer: level1,
        skuId: 'sku-demo-1',
        chargeUnit: 'PER_AI_VIDEO_CREDIT',
        unitPrice: demoMoney(10),
        taxIncluded: false,
        effectiveFrom: DEMO_CREATED_AT,
        effectiveTo: DEMO_VALID_TO,
        disclaimer: DEMO_DATA_LABEL,
      },
      {
        priceSnapshotId: 'price-demo-level-1-level-2',
        version: 'demo-v1',
        priceLayer: 'CHANNEL_WHOLESALE',
        seller: level1,
        buyer: level2,
        skuId: 'sku-demo-1',
        chargeUnit: 'PER_AI_VIDEO_CREDIT',
        unitPrice: demoMoney(12),
        taxIncluded: false,
        effectiveFrom: DEMO_CREATED_AT,
        effectiveTo: DEMO_VALID_TO,
        disclaimer: DEMO_DATA_LABEL,
      },
      {
        priceSnapshotId: 'price-demo-level-1-tenant-retail',
        version: 'demo-v1',
        priceLayer: 'CUSTOMER_RETAIL',
        seller: level1,
        buyer: tenant,
        skuId: 'sku-demo-1',
        chargeUnit: 'PER_AI_VIDEO_CREDIT',
        unitPrice: demoMoney(18),
        taxIncluded: false,
        effectiveFrom: DEMO_CREATED_AT,
        effectiveTo: DEMO_VALID_TO,
        disclaimer: DEMO_DATA_LABEL,
      },
      {
        priceSnapshotId: 'price-demo-level-1-tenant-campaign',
        version: 'demo-v1',
        priceLayer: 'CAMPAIGN',
        seller: level1,
        buyer: tenant,
        skuId: 'sku-demo-1',
        chargeUnit: 'PER_AI_VIDEO_CREDIT',
        unitPrice: demoMoney(15),
        taxIncluded: false,
        effectiveFrom: DEMO_CREATED_AT,
        effectiveTo: DEMO_VALID_TO,
        disclaimer: DEMO_DATA_LABEL,
      },
    ],
    orders: [
      {
        orderId: 'order-demo-level-1-level-2-500',
        seller: level1,
        buyer: level2,
        skuId: 'sku-demo-1',
        status: 'fulfilled',
        creditAmount: demoCredits(500),
        listAmount: demoMoney(6000),
        discountAmount: demoMoney(0),
        netAmount: demoMoney(6000),
        acquisitionCost: demoMoney(5000),
        grossSpread: demoMoney(1000),
        priceSnapshotIds: ['price-demo-master-level-1', 'price-demo-level-1-level-2'],
        fulfilledAt: '2026-07-30T01:00:00.000Z',
        disclaimer: DEMO_DATA_LABEL,
      },
      {
        orderId: 'order-demo-level-1-tenant-1000',
        seller: level1,
        buyer: tenant,
        skuId: 'sku-demo-1',
        status: 'fulfilled',
        creditAmount: demoCredits(1000),
        listAmount: demoMoney(18000),
        discountAmount: demoMoney(3000),
        netAmount: demoMoney(15000),
        acquisitionCost: demoMoney(10000),
        grossSpread: demoMoney(5000),
        priceSnapshotIds: [
          'price-demo-master-level-1',
          'price-demo-level-1-tenant-retail',
          'price-demo-level-1-tenant-campaign',
        ],
        fulfilledAt: '2026-07-30T02:00:00.000Z',
        disclaimer: DEMO_DATA_LABEL,
      },
    ],
    channelInventories: [
      {
        channelOrganizationId: DEMO_CHANNEL_LEVEL_1_ID,
        purchasedCredits: demoCredits(2000),
        allocatedToSubchannels: demoCredits(500),
        allocatedToTenants: demoCredits(1000),
        availableCredits: demoCredits(500),
        asOf: '2026-07-30T23:59:59.000Z',
        disclaimer: DEMO_DATA_LABEL,
      },
    ],
    settlementSummaries: [
      {
        settlementId: 'settlement-demo-level-1-2026-07',
        channelOrganizationId: DEMO_CHANNEL_LEVEL_1_ID,
        periodStart: '2026-07-01T00:00:00.000Z',
        periodEnd: '2026-07-31T23:59:59.000Z',
        status: 'reviewed',
        orderIds: ['order-demo-level-1-level-2-500', 'order-demo-level-1-tenant-1000'],
        openingAvailableCredits: demoCredits(0),
        purchasedCredits: demoCredits(2000),
        soldCredits: demoCredits(1500),
        closingAvailableCredits: demoCredits(500),
        salesNetAmount: demoMoney(21000),
        acquisitionCost: demoMoney(15000),
        grossSpread: demoMoney(6000),
        unmatchedItemCount: 0,
        disclaimer: DEMO_DATA_LABEL,
      },
    ],
    platformRisk: {
      openCommercialExceptions: 1,
      unmatchedReceiptCount: 0,
      frozenWalletCount: 0,
      auditEventCount: 12,
      asOf: '2026-07-30T23:59:59.000Z',
      disclaimer: DEMO_DATA_LABEL,
    },
    disclaimer: DEMO_DATA_LABEL,
  };
}

function buildCommercialFixture(): ControlPlaneCommercialFixture {
  return {
    platform: {
      platformId: DEMO_PLATFORM_ID,
      displayName: '短视频营销 Agent 平台',
      status: 'active',
      contextType: 'PLATFORM',
    },
    channels: structuredClone(channels),
    tenant: {
      tenantId: DEMO_TENANT_ID,
      displayName: '海底捞演示企业',
      contextType: 'TENANT',
      status: 'active',
      acquisitionMode: 'CHANNEL',
      currentServiceChannelOrganizationId: DEMO_CHANNEL_LEVEL_1_ID,
      dataBoundary: 'PRODUCTION_CONTENT',
    },
    memberships: structuredClone(memberships),
    capabilities: structuredClone(capabilities),
    products: structuredClone(products),
    skus: structuredClone(skus),
    entitlements: structuredClone(entitlements),
    rateCard: {
      rateCardId: DEMO_RATE_CARD_ID,
      version: DEMO_RATE_CARD_VERSION,
      capabilityId: CAPABILITY_IDS.baseGeneration,
      meterCode: 'STANDARD_5S_720P_VIDEO',
      meteringRule: 'PER_DELIVERABLE_ASSET',
      inputBand: {
        durationSeconds: 5,
        resolution: '720p',
      },
      estimatedCredits: demoCredits(100),
      maxReservedCredits: demoCredits(120),
      minimumChargeCredits: demoCredits(0),
      billableOutcome: 'SUCCEEDED_WITH_REGISTERED_DELIVERABLE_ASSET',
      effectiveFrom: DEMO_CREATED_AT,
      effectiveTo: DEMO_VALID_TO,
      disclaimer: DEMO_DATA_LABEL,
    },
    creditScenarios: [
      {
        scenarioId: 'canonical_success',
        taskId: DEMO_SUCCESS_TASK_ID,
        reservationId: DEMO_SUCCESS_RESERVATION_ID,
        outcome: 'succeeded_with_deliverable',
        maxReservedCredits: demoCredits(120),
        consumedCredits: demoCredits(100),
        releasedCredits: demoCredits(20),
        expectedSequence: [
          'requested',
          'reserved',
          'consumed',
          'released_remainder',
        ],
        disclaimer: DEMO_DATA_LABEL,
      },
      {
        scenarioId: 'canonical_failure',
        taskId: DEMO_FAILURE_TASK_ID,
        reservationId: DEMO_FAILURE_RESERVATION_ID,
        outcome: 'failed_without_deliverable',
        maxReservedCredits: demoCredits(80),
        consumedCredits: demoCredits(0),
        releasedCredits: demoCredits(80),
        expectedSequence: ['requested', 'reserved', 'released'],
        disclaimer: DEMO_DATA_LABEL,
      },
    ],
    creditState: createDemoReadyCreditState(),
    demoBusiness: buildDemoCommercialProjection(),
  };
}

function buildFixtureSeed(workspace: DemoWorkspace) {
  return {
    fixtureId: CONTROL_PLANE_FIXTURE_ID,
    project: workspace.project,
    brief: workspace.brief,
    brand: workspace.brand,
    scripts: workspace.scripts,
    activeScriptId: workspace.activeScriptId,
    storyboard: workspace.storyboard,
    commercial: buildCommercialFixture(),
  };
}

export function buildProjectProductionPackage(
  workspace: DemoWorkspace,
  approval: ScriptApproval,
  idempotencyKey = DEMO_PACKAGE_IDEMPOTENCY_KEY,
): ProjectProductionPackage {
  if (workspace.project.id !== CONTROL_PLANE_FIXTURE_ID) {
    throw new Error(`Only ${CONTROL_PLANE_FIXTURE_ID} may produce the D1 canonical package.`);
  }
  const activeScript = workspace.scripts.find(
    (script) => script.id === workspace.activeScriptId,
  );
  if (!activeScript || activeScript.id !== 'script-a') {
    throw new Error('D1 canonical package requires active script-a.');
  }
  if (
    approval.projectId !== workspace.project.id ||
    approval.scriptVersionId !== activeScript.id ||
    approval.scriptDigest !== digestValue(activeScript)
  ) {
    throw new Error('ScriptApproval does not match the active script snapshot.');
  }
  if (approval.status === 'blocked') {
    throw new Error('ScriptApproval is blocked.');
  }
  if (approval.status !== 'approved' || !approval.approvedAt || !approval.approvedBy) {
    throw new Error('Active script has not been explicitly approved.');
  }
  if (approval.factRiskStatus !== 'cleared' || approval.factRiskIds.length > 0) {
    throw new Error('Active script still has unresolved fact risk.');
  }
  const grantedCapabilities = [
    {
      capabilityId: CAPABILITY_IDS.baseGeneration,
      entitlementId: ENTITLEMENT_IDS.baseGeneration,
      constraints: {
        projectId: CONTROL_PLANE_FIXTURE_ID,
        maxDurationSeconds: 30,
        aspectRatio: '9:16' as const,
      },
    },
    {
      capabilityId: CAPABILITY_IDS.localLife,
      entitlementId: ENTITLEMENT_IDS.localLife,
      constraints: {
        projectId: CONTROL_PLANE_FIXTURE_ID,
        maxDurationSeconds: 30,
        aspectRatio: '9:16' as const,
      },
    },
  ];

  const unsignedPackage = {
    packageId: DEMO_PACKAGE_ID,
    packageVersion: 1 as const,
    contractVersion: CONTROL_PLANE_CONTRACT_VERSION,
    tenantId: DEMO_TENANT_ID,
    organizationId: DEMO_TENANT_ORGANIZATION_ID,
    organizationType: 'TENANT' as const,
    projectId: CONTROL_PLANE_FIXTURE_ID,
    brandId: DEMO_BRAND_ID,
    storeId: DEMO_STORE_ID,
    campaignId: DEMO_CAMPAIGN_ID,
    agentTemplateCode: 'local_life' as const,
    creativeBriefSnapshot: structuredClone(workspace.brief),
    brandFactsSnapshot: structuredClone(workspace.brand.facts),
    riskRulesSnapshot: {
      prohibitedWords: [...workspace.brand.prohibitedWords],
      restrictions: [...workspace.brief.restrictions],
      requiredClaimIds: workspace.brand.facts.map((claim) => claim.id),
    },
    approvedScriptVersion: {
      ...structuredClone(activeScript),
      approvalStatus: 'approved' as const,
      approvedAt: approval.approvedAt,
      approvedBy: approval.approvedBy,
    },
    shotDrafts: structuredClone(workspace.storyboard),
    target: {
      platform: '抖音' as const,
      aspectRatio: '9:16' as const,
      durationSeconds: 30 as const,
    },
    capabilityGrants: grantedCapabilities,
    sourceVersions: {
      demoWorkspace: 'videoagent:mvp:v1' as const,
      project: 1,
      brief: 1,
      brand: 1,
      script: 1,
      storyboard: 1,
    },
    idempotencyKey,
    createdAt: '2026-07-30T00:03:00.000Z',
    expiresAt: '2026-08-06T00:03:00.000Z',
    truthMode: 'MOCK-CONTRACT' as const,
  };

  return {
    ...unsignedPackage,
    digest: digestValue(unsignedPackage),
  };
}

export function buildCapabilityTruthManifest(
  fixtureDigest: string,
  transportState: StoryCanvasTransportState = createOfflineStoryCanvasTransportState(),
): CapabilityTruthManifest {
  const connected =
    transportState.connected &&
    [
      'accepted',
      'duplicate',
      'handoff_waiting',
      'handoff_ready',
    ].includes(transportState.phase);
  const handoffReady = transportState.phase === 'handoff_ready';
  const storyCanvasTransport =
    connected
      ? 'HTTP_CONNECTED'
      : transportState.phase === 'retrying'
        ? 'HTTP_RETRYING'
        : ['error', 'rejected', 'handoff_timeout'].includes(
              transportState.phase,
            )
          ? 'HTTP_ERROR'
          : 'HTTP_NOT_CONNECTED';
  return {
    manifestVersion: 'D1.0',
    releaseId: 'D1-FOUNDATION-MOCK',
    fixtureId: CONTROL_PLANE_FIXTURE_ID,
    fixtureDigest,
    disclaimer: DEMO_DATA_LABEL,
    entries: [
      {
        capabilityId: 'control.demo-workspace-ui',
        displayName: '现有企业项目与品牌/脚本页面',
        mode: 'REAL-UI',
        ui: 'REAL-UI',
        execution: 'MOCK',
        transport: 'LOCAL',
        persistence: 'LOCAL_DEMO',
        provider: 'NONE',
        billing: 'NOT_APPLICABLE',
        statusSource: {
          transport: 'bridge-runtime',
          persistence: 'adapter-runtime',
          billing: 'not-applicable',
        },
        projectIntegrated: true,
        fallbackLabel: null,
        knownLimitations: ['LocalStorage 不是生产权限或账本事实源'],
      },
      {
        capabilityId: 'production.storycanvas-foundation',
        displayName: 'StoryCanvas 画布与连续性基础',
        mode: 'REAL-CAP',
        ui: 'NOT_IMPLEMENTED',
        execution: 'REAL-CAP',
        transport: storyCanvasTransport,
        persistence: connected ? 'REMOTE_API' : 'NOT_APPLICABLE',
        provider: 'StoryCanvas',
        billing: 'NOT_APPLICABLE',
        statusSource: {
          transport: 'bridge-runtime',
          persistence: 'bridge-contract',
          billing: 'not-applicable',
        },
        projectIntegrated: handoffReady,
        fallbackLabel: null,
        knownLimitations: ['D1 海底捞跨仓适配尚由 C5 接入'],
      },
      {
        capabilityId: 'control.production-contract-adapter',
        displayName: '生产包、Grant 与回执 Adapter',
        mode: 'MOCK-CONTRACT',
        ui: 'NOT_IMPLEMENTED',
        execution: 'MOCK',
        transport: 'MOCK-CONTRACT',
        persistence: 'LOCAL_DEMO',
        provider: 'DemoGenerator',
        billing: 'MOCK-CONTRACT',
        statusSource: {
          transport: 'bridge-runtime',
          persistence: 'adapter-runtime',
          billing: 'credit-ledger',
        },
        projectIntegrated: true,
        fallbackLabel: null,
        knownLimitations: ['进程内 Mock，不是签名令牌或真实后端'],
      },
      {
        capabilityId: 'demo.local-life-golden-path',
        displayName: '海底捞本地生活双平面演示',
        mode: 'HYBRID',
        ui: 'REAL-UI',
        execution: 'MOCK',
        transport: connected ? 'HTTP_CONNECTED' : storyCanvasTransport,
        persistence: 'LOCAL_DEMO',
        provider: 'DemoGenerator',
        billing: 'MOCK-CONTRACT',
        statusSource: {
          transport: 'bridge-runtime',
          persistence: 'adapter-runtime',
          billing: 'credit-ledger',
        },
        projectIntegrated: handoffReady,
        fallbackLabel: '同一项目确定性 Demo 生成',
        knownLimitations: ['控制平面 UI 既有，媒体接线和账本为 Mock'],
      },
      {
        capabilityId: CAPABILITY_IDS.digitalHuman,
        displayName: '数字人 Add-on',
        mode: 'LOCKED',
        ui: 'NOT_IMPLEMENTED',
        execution: 'LOCKED',
        transport: 'MOCK-CONTRACT',
        persistence: 'NOT_APPLICABLE',
        provider: 'NONE',
        billing: 'NOT_APPLICABLE',
        statusSource: {
          transport: 'bridge-runtime',
          persistence: 'adapter-runtime',
          billing: 'not-applicable',
        },
        projectIntegrated: false,
        fallbackLabel: null,
        knownLimitations: ['未购买 / 待授权，不允许执行'],
      },
      {
        capabilityId: 'production.basic-ffmpeg-merge',
        displayName: '基础合并导出',
        mode: 'FALLBACK',
        ui: 'NOT_IMPLEMENTED',
        execution: 'FALLBACK',
        transport: storyCanvasTransport,
        persistence: connected ? 'REMOTE_API' : 'NOT_APPLICABLE',
        provider: 'FFmpeg',
        billing: 'NOT_APPLICABLE',
        statusSource: {
          transport: 'bridge-runtime',
          persistence: 'bridge-contract',
          billing: 'not-applicable',
        },
        projectIntegrated: handoffReady,
        fallbackLabel: '基础合并导出',
        knownLimitations: ['不包含完整 FireRed AI 剪辑'],
      },
    ],
  };
}

export function createOfflineStoryCanvasTransportState(
  baseUrl = DEFAULT_STORYCANVAS_API_BASE,
): StoryCanvasTransportState {
  return {
    baseUrl,
    phase: 'offline',
    connected: false,
    retryCount: 0,
    lastAttemptAt: null,
    lastConnectedAt: null,
    deepLink: null,
    packageId: null,
    projectId: null,
    lastError: null,
  };
}

export function createCanonicalScriptApproval(
  workspace: DemoWorkspace = cloneDemoWorkspace(),
): ScriptApproval {
  const script = workspace.scripts.find((item) => item.id === 'script-a');
  if (!script) throw new Error('Canonical DemoWorkspace is missing script-a.');
  return {
    approvalId: 'approval-demo-local-001-script-a-v1',
    fixtureId: CONTROL_PLANE_FIXTURE_ID,
    tenantId: DEMO_TENANT_ID,
    projectId: CONTROL_PLANE_FIXTURE_ID,
    scriptVersionId: script.id,
    scriptDigest: digestValue(script),
    status: 'approved',
    factRiskStatus: 'cleared',
    factRiskIds: [],
    approvedAt: '2026-07-30T00:02:00.000Z',
    approvedBy: 'principal-demo-owner',
    revokedAt: null,
    revokedBy: null,
    blockedAt: null,
    blockedBy: null,
    blockedReason: null,
    updatedAt: '2026-07-30T00:02:00.000Z',
  };
}

export function createControlPlaneDemoState(
  workspace: DemoWorkspace = cloneDemoWorkspace(),
  approval: ScriptApproval = createCanonicalScriptApproval(workspace),
  transport: StoryCanvasTransportState = createOfflineStoryCanvasTransportState(),
): ControlPlaneDemoState {
  const fixtureDigest = digestValue(buildFixtureSeed(workspace));
  return {
    stateName: DEMO_READY,
    fixtureId: CONTROL_PLANE_FIXTURE_ID,
    fixtureDigest,
    commercial: buildCommercialFixture(),
    scriptApprovals: [structuredClone(approval)],
    package: null,
    grants: [],
    generationTaskReceipts: [],
    assetReceipts: [],
    exportReceipts: [],
    transport: structuredClone(transport),
    truthManifest: buildCapabilityTruthManifest(fixtureDigest, transport),
  };
}

export const canonicalProjectProductionPackage = buildProjectProductionPackage(
  cloneDemoWorkspace(),
  createCanonicalScriptApproval(),
);

export function createCanonicalDemoGrant(
  productionPackage: ProjectProductionPackage,
  capabilityIds: string[],
  now: Date = new Date(),
): DemoProjectGrant {
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  if (Date.parse(expiresAt) > Date.parse(productionPackage.expiresAt)) {
    throw new Error('Current Demo grant cannot outlive its production package.');
  }
  return {
    grantId: 'grant-demo-local-001-v1',
    grantType: 'DEMO_PROJECT_GRANT',
    mock: true,
    truthMode: 'MOCK-CONTRACT',
    tenantId: productionPackage.tenantId,
    organizationId: productionPackage.organizationId,
    organizationType: productionPackage.organizationType,
    projectId: productionPackage.projectId,
    packageId: productionPackage.packageId,
    packageVersion: productionPackage.packageVersion,
    capabilityIds: [...capabilityIds],
    scopes: ['production.package.read', 'production.receipt.write'],
    issuedAt,
    expiresAt,
    mockHandle: 'mock-handle:grant-demo-local-001-v1',
    warning: 'DEMO ONLY · NOT A SIGNED TOKEN · DO NOT USE AS CREDENTIAL',
  };
}

export function createCanonicalSuccessTaskReceipt(): GenerationTaskReceipt {
  return {
    contractVersion: CONTROL_PLANE_CONTRACT_VERSION,
    generationTaskId: DEMO_SUCCESS_TASK_ID,
    tenantId: DEMO_TENANT_ID,
    projectId: CONTROL_PLANE_FIXTURE_ID,
    shotId: 'shot-07',
    taskType: 'image.generate',
    capabilityId: CAPABILITY_IDS.baseGeneration,
    provider: 'DemoGenerator',
    model: 'deterministic-demo-v1',
    status: 'succeeded',
    progress: 100,
    inputDigest: digestValue({
      projectId: CONTROL_PLANE_FIXTURE_ID,
      shotId: 'shot-07',
      intent: '合规会员权益图卡',
    }),
    referenceAssetIds: [],
    reservationReference: DEMO_SUCCESS_RESERVATION_ID,
    actualCredits: demoCredits(100),
    outputAssetIds: [DEMO_SUCCESS_ASSET_ID],
    error: null,
    createdAt: '2026-07-30T00:05:00.000Z',
    startedAt: '2026-07-30T00:05:01.000Z',
    completedAt: '2026-07-30T00:05:05.000Z',
    idempotencyKey: 'receipt-task-demo-success-v1',
    truthMode: 'MOCK-CONTRACT',
  };
}

export function createCanonicalSuccessAssetReceipt(): AssetReceipt {
  return {
    contractVersion: CONTROL_PLANE_CONTRACT_VERSION,
    assetId: DEMO_SUCCESS_ASSET_ID,
    tenantId: DEMO_TENANT_ID,
    projectId: CONTROL_PLANE_FIXTURE_ID,
    shotId: 'shot-07',
    type: 'image',
    mimeType: 'image/png',
    dimensions: {
      width: 720,
      height: 1280,
    },
    durationSeconds: 0,
    checksum: digestValue({
      fixtureId: CONTROL_PLANE_FIXTURE_ID,
      assetId: DEMO_SUCCESS_ASSET_ID,
      bytes: 'deterministic-demo-placeholder',
    }),
    source: 'DemoGenerator',
    model: 'deterministic-demo-v1',
    generationTaskId: DEMO_SUCCESS_TASK_ID,
    promptDigest: digestValue('合规会员权益图卡 · Prompt 摘要'),
    storageReference: `demo://assets/${DEMO_SUCCESS_ASSET_ID}.png`,
    rightsNote: 'D1 确定性 Demo 生成资产，仅用于内部演示。',
    reviewStatus: 'registered',
    version: 1,
    idempotencyKey: 'receipt-asset-demo-success-v1',
    createdAt: '2026-07-30T00:05:06.000Z',
    truthMode: 'MOCK-CONTRACT',
  };
}

export function createCanonicalFailureTaskReceipt(): GenerationTaskReceipt {
  return {
    contractVersion: CONTROL_PLANE_CONTRACT_VERSION,
    generationTaskId: DEMO_FAILURE_TASK_ID,
    tenantId: DEMO_TENANT_ID,
    projectId: CONTROL_PLANE_FIXTURE_ID,
    shotId: 'shot-05',
    taskType: 'video.generate',
    capabilityId: CAPABILITY_IDS.baseGeneration,
    provider: 'DemoGenerator',
    model: 'deterministic-demo-v1',
    status: 'failed',
    progress: 100,
    inputDigest: digestValue({
      projectId: CONTROL_PLANE_FIXTURE_ID,
      shotId: 'shot-05',
      intent: '失败释放演示',
    }),
    referenceAssetIds: ['asset-shrimp'],
    reservationReference: DEMO_FAILURE_RESERVATION_ID,
    actualCredits: null,
    outputAssetIds: [],
    error: {
      code: 'DEMO_PROVIDER_FAILURE',
      message: '确定性演示失败：未形成可交付资产。',
      retryable: true,
      details: {
        truthMode: 'MOCK-CONTRACT',
      },
    },
    createdAt: '2026-07-30T00:06:00.000Z',
    startedAt: '2026-07-30T00:06:01.000Z',
    completedAt: '2026-07-30T00:06:03.000Z',
    idempotencyKey: 'receipt-task-demo-failure-v1',
    truthMode: 'MOCK-CONTRACT',
  };
}
