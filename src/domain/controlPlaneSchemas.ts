import {
  CONTROL_PLANE_CONTRACT_VERSION,
  CONTROL_PLANE_FIXTURE_ID,
  DEMO_DATA_LABEL,
  type AssetReceipt,
  type Capability,
  type CapabilityTruthManifest,
  type ChannelOrganization,
  type ControlPlaneDemoState,
  type CreditLedger,
  type CreditLedgerEntry,
  type CreditLot,
  type DataScope,
  type DemoProjectGrant,
  type DemoRateCard,
  type Entitlement,
  type ExportReceipt,
  type GenerationTaskReceipt,
  type Membership,
  type PlatformContext,
  type Product,
  type ProjectProductionPackage,
  type ScriptApproval,
  type SKU,
  type TenantContext,
  type Wallet,
} from './controlPlane';
import { canonicalize, digestValue } from './controlPlaneUtils';

export interface RuntimeSchema<T> {
  readonly name: string;
  parse(value: unknown): T;
  safeParse(value: unknown):
    | { success: true; data: T }
    | { success: false; error: Error };
}

function schema<T>(
  name: string,
  validate: (value: unknown) => asserts value is T,
): RuntimeSchema<T> {
  return {
    name,
    parse(value) {
      validate(value);
      return value;
    },
    safeParse(value) {
      try {
        validate(value);
        return { success: true, data: value };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },
  };
}

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}

function assertArray(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
}

function assertDemoCredit(value: unknown, label: string) {
  assertRecord(value, label);
  assertNumber(value.value, `${label}.value`);
  if (!Number.isInteger(value.value)) throw new Error(`${label}.value must be an integer`);
  if (value.unit !== 'AI_VIDEO_CREDIT') throw new Error(`${label}.unit is invalid`);
  if (value.dataMode !== 'DEMO' || value.quoteStatus !== 'NON_QUOTE') {
    throw new Error(`${label} must retain DEMO/NON_QUOTE semantics`);
  }
  if (value.label !== DEMO_DATA_LABEL) throw new Error(`${label}.label is invalid`);
}

export const platformContextSchema = schema<PlatformContext>(
  'PlatformContext',
  (value): asserts value is PlatformContext => {
    assertRecord(value, 'PlatformContext');
    assertString(value.platformId, 'PlatformContext.platformId');
    if (value.contextType !== 'PLATFORM') throw new Error('PlatformContext.contextType is invalid');
  },
);

export const channelOrganizationSchema = schema<ChannelOrganization>(
  'ChannelOrganization',
  (value): asserts value is ChannelOrganization => {
    assertRecord(value, 'ChannelOrganization');
    assertString(value.channelOrganizationId, 'ChannelOrganization.channelOrganizationId');
    if (value.contextType !== 'CHANNEL') {
      throw new Error('ChannelOrganization.contextType is invalid');
    }
    if ('tenantId' in value) {
      throw new Error('ChannelOrganization must remain independent from Tenant');
    }
    if (![1, 2, 3].includes(value.depth as number)) {
      throw new Error('ChannelOrganization.depth must be 1..3');
    }
  },
);

export const tenantContextSchema = schema<TenantContext>(
  'TenantContext',
  (value): asserts value is TenantContext => {
    assertRecord(value, 'TenantContext');
    assertString(value.tenantId, 'TenantContext.tenantId');
    if (value.contextType !== 'TENANT' || value.dataBoundary !== 'PRODUCTION_CONTENT') {
      throw new Error('TenantContext must be the production content boundary');
    }
  },
);

export const dataScopeSchema = schema<DataScope>(
  'DataScope',
  (value): asserts value is DataScope => {
    assertRecord(value, 'DataScope');
    assertString(value.kind, 'DataScope.kind');
    for (const key of ['brandIds', 'storeIds', 'projectIds'] as const) {
      if (value[key] !== undefined) assertArray(value[key], `DataScope.${key}`);
    }
  },
);

export const membershipSchema = schema<Membership>(
  'Membership',
  (value): asserts value is Membership => {
    assertRecord(value, 'Membership');
    assertString(value.membershipId, 'Membership.membershipId');
    assertString(value.organizationId, 'Membership.organizationId');
    assertArray(value.roleCodes, 'Membership.roleCodes');
    assertArray(value.dataScopes, 'Membership.dataScopes');
    value.dataScopes.forEach((item) => dataScopeSchema.parse(item));
  },
);

export const capabilitySchema = schema<Capability>(
  'Capability',
  (value): asserts value is Capability => {
    assertRecord(value, 'Capability');
    assertString(value.capabilityId, 'Capability.capabilityId');
    assertString(value.code, 'Capability.code');
    assertArray(value.dependencyCapabilityIds, 'Capability.dependencyCapabilityIds');
  },
);

export const productSchema = schema<Product>(
  'Product',
  (value): asserts value is Product => {
    assertRecord(value, 'Product');
    assertString(value.productId, 'Product.productId');
    assertArray(value.capabilityIds, 'Product.capabilityIds');
  },
);

export const skuSchema = schema<SKU>(
  'SKU',
  (value): asserts value is SKU => {
    assertRecord(value, 'SKU');
    assertString(value.skuId, 'SKU.skuId');
    assertArray(value.entitlementCapabilityIds, 'SKU.entitlementCapabilityIds');
    assertDemoCredit(value.includedCredits, 'SKU.includedCredits');
  },
);

export const entitlementSchema = schema<Entitlement>(
  'Entitlement',
  (value): asserts value is Entitlement => {
    assertRecord(value, 'Entitlement');
    assertString(value.entitlementId, 'Entitlement.entitlementId');
    assertString(value.tenantId, 'Entitlement.tenantId');
    dataScopeSchema.parse(value.scope);
    assertRecord(value.demo, 'Entitlement.demo');
    if (value.demo.dataMode !== 'DEMO' || value.demo.quoteStatus !== 'NON_QUOTE') {
      throw new Error('Entitlement.demo must retain DEMO/NON_QUOTE semantics');
    }
  },
);

export const demoRateCardSchema = schema<DemoRateCard>(
  'DemoRateCard',
  (value): asserts value is DemoRateCard => {
    assertRecord(value, 'DemoRateCard');
    assertString(value.rateCardId, 'DemoRateCard.rateCardId');
    assertDemoCredit(value.estimatedCredits, 'DemoRateCard.estimatedCredits');
    assertDemoCredit(value.maxReservedCredits, 'DemoRateCard.maxReservedCredits');
    assertDemoCredit(value.minimumChargeCredits, 'DemoRateCard.minimumChargeCredits');
    if (value.disclaimer !== DEMO_DATA_LABEL) throw new Error('DemoRateCard disclaimer missing');
  },
);

export const walletSchema = schema<Wallet>(
  'Wallet',
  (value): asserts value is Wallet => {
    assertRecord(value, 'Wallet');
    assertString(value.walletId, 'Wallet.walletId');
    assertString(value.tenantId, 'Wallet.tenantId');
    assertDemoCredit(value.available, 'Wallet.available');
    assertDemoCredit(value.reserved, 'Wallet.reserved');
    if (value.disclaimer !== DEMO_DATA_LABEL) throw new Error('Wallet disclaimer missing');
  },
);

export const creditLotSchema = schema<CreditLot>(
  'CreditLot',
  (value): asserts value is CreditLot => {
    assertRecord(value, 'CreditLot');
    assertString(value.lotId, 'CreditLot.lotId');
    assertDemoCredit(value.originalCredits, 'CreditLot.originalCredits');
    assertDemoCredit(value.remainingAvailable, 'CreditLot.remainingAvailable');
    assertDemoCredit(value.remainingReserved, 'CreditLot.remainingReserved');
  },
);

export const creditLedgerEntrySchema = schema<CreditLedgerEntry>(
  'CreditLedgerEntry',
  (value): asserts value is CreditLedgerEntry => {
    assertRecord(value, 'CreditLedgerEntry');
    assertString(value.entryId, 'CreditLedgerEntry.entryId');
    assertString(value.postingGroupId, 'CreditLedgerEntry.postingGroupId');
    assertDemoCredit(value.delta, 'CreditLedgerEntry.delta');
    if (value.disclaimer !== DEMO_DATA_LABEL) {
      throw new Error('CreditLedgerEntry disclaimer missing');
    }
  },
);

export const creditLedgerSchema = schema<CreditLedger>(
  'CreditLedger',
  (value): asserts value is CreditLedger => {
    assertArray(value, 'CreditLedger');
    value.forEach((item) => creditLedgerEntrySchema.parse(item));
  },
);

const PACKAGE_FORBIDDEN_KEYS = new Set([
  'wallet',
  'creditLedger',
  'rateCard',
  'customerPrice',
  'customerRetailPrice',
  'providerKey',
  'upstreamApiKey',
  'accessToken',
  'mockHandle',
]);

function assertNoForbiddenPackageData(value: unknown, path = 'package') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenPackageData(item, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (PACKAGE_FORBIDDEN_KEYS.has(key)) {
      throw new Error(`${path}.${key} is forbidden in ProjectProductionPackage`);
    }
    assertNoForbiddenPackageData(child, `${path}.${key}`);
  }
}

export const projectProductionPackageSchema = schema<ProjectProductionPackage>(
  'ProjectProductionPackage',
  (value): asserts value is ProjectProductionPackage => {
    assertRecord(value, 'ProjectProductionPackage');
    if (value.contractVersion !== CONTROL_PLANE_CONTRACT_VERSION) {
      throw new Error('ProjectProductionPackage.contractVersion is unsupported');
    }
    if (value.projectId !== CONTROL_PLANE_FIXTURE_ID) {
      throw new Error('ProjectProductionPackage must use the canonical demo project');
    }
    assertString(value.tenantId, 'ProjectProductionPackage.tenantId');
    assertString(value.organizationId, 'ProjectProductionPackage.organizationId');
    assertString(value.idempotencyKey, 'ProjectProductionPackage.idempotencyKey');
    assertArray(value.brandFactsSnapshot, 'ProjectProductionPackage.brandFactsSnapshot');
    assertArray(value.shotDrafts, 'ProjectProductionPackage.shotDrafts');
    assertArray(value.capabilityGrants, 'ProjectProductionPackage.capabilityGrants');
    const claimIds = value.brandFactsSnapshot.map((claim, index) => {
      assertRecord(claim, `ProjectProductionPackage.brandFactsSnapshot[${index}]`);
      assertString(claim.id, `ProjectProductionPackage.brandFactsSnapshot[${index}].id`);
      return claim.id;
    });
    if (claimIds.join(',') !== 'C1,C2,C3,C4,C5,C6,C7,C8') {
      throw new Error('ProjectProductionPackage must contain the canonical C1-C8 claims');
    }
    assertRecord(
      value.approvedScriptVersion,
      'ProjectProductionPackage.approvedScriptVersion',
    );
    if (value.approvedScriptVersion.approvalStatus !== 'approved') {
      throw new Error('ProjectProductionPackage requires an approved script');
    }
    assertString(
      value.approvedScriptVersion.approvedAt,
      'ProjectProductionPackage.approvedScriptVersion.approvedAt',
    );
    assertString(
      value.approvedScriptVersion.approvedBy,
      'ProjectProductionPackage.approvedScriptVersion.approvedBy',
    );
    if (value.shotDrafts.length !== 8) {
      throw new Error('ProjectProductionPackage requires exactly 8 shots');
    }
    if (canonicalize(value).includes('南城咖啡')) {
      throw new Error('ProjectProductionPackage cannot contain the historical StoryCanvas fixture');
    }
    assertNoForbiddenPackageData(value);
    const { digest, ...unsignedPackage } = value;
    if (digest !== digestValue(unsignedPackage)) {
      throw new Error('ProjectProductionPackage.digest does not match canonical content');
    }
  },
);

export const scriptApprovalSchema = schema<ScriptApproval>(
  'ScriptApproval',
  (value): asserts value is ScriptApproval => {
    assertRecord(value, 'ScriptApproval');
    if (value.fixtureId !== CONTROL_PLANE_FIXTURE_ID) {
      throw new Error('ScriptApproval.fixtureId is invalid');
    }
    assertString(value.approvalId, 'ScriptApproval.approvalId');
    assertString(value.tenantId, 'ScriptApproval.tenantId');
    assertString(value.projectId, 'ScriptApproval.projectId');
    assertString(value.scriptVersionId, 'ScriptApproval.scriptVersionId');
    assertString(value.scriptDigest, 'ScriptApproval.scriptDigest');
    if (!['pending', 'approved', 'revoked', 'blocked'].includes(value.status as string)) {
      throw new Error('ScriptApproval.status is invalid');
    }
    if (!['unresolved', 'cleared'].includes(value.factRiskStatus as string)) {
      throw new Error('ScriptApproval.factRiskStatus is invalid');
    }
    assertArray(value.factRiskIds, 'ScriptApproval.factRiskIds');
    if (
      value.status === 'approved' &&
      (!value.approvedAt || !value.approvedBy || value.factRiskStatus !== 'cleared')
    ) {
      throw new Error('Approved ScriptApproval requires approval evidence and cleared fact risk');
    }
    if (value.status === 'blocked' && (!value.blockedAt || !value.blockedBy)) {
      throw new Error('Blocked ScriptApproval requires block evidence');
    }
  },
);

export const demoProjectGrantSchema = schema<DemoProjectGrant>(
  'DemoProjectGrant',
  (value): asserts value is DemoProjectGrant => {
    assertRecord(value, 'DemoProjectGrant');
    if (value.mock !== true || value.truthMode !== 'MOCK-CONTRACT') {
      throw new Error('DemoProjectGrant must be explicitly marked Mock');
    }
    assertString(value.tenantId, 'DemoProjectGrant.tenantId');
    assertString(value.organizationId, 'DemoProjectGrant.organizationId');
    assertArray(value.capabilityIds, 'DemoProjectGrant.capabilityIds');
    assertArray(value.scopes, 'DemoProjectGrant.scopes');
    if ('accessToken' in value) throw new Error('DemoProjectGrant cannot expose a plaintext token');
    assertString(value.issuedAt, 'DemoProjectGrant.issuedAt');
    assertString(value.expiresAt, 'DemoProjectGrant.expiresAt');
    if (Date.parse(value.expiresAt) - Date.parse(value.issuedAt) !== 15 * 60 * 1000) {
      throw new Error('DemoProjectGrant must use the deterministic 15-minute Mock TTL');
    }
    if (!String(value.mockHandle).startsWith('mock-handle:')) {
      throw new Error('DemoProjectGrant.mockHandle must be visibly non-credential Mock data');
    }
  },
);

export const generationTaskReceiptSchema = schema<GenerationTaskReceipt>(
  'GenerationTaskReceipt',
  (value): asserts value is GenerationTaskReceipt => {
    assertRecord(value, 'GenerationTaskReceipt');
    if (value.contractVersion !== CONTROL_PLANE_CONTRACT_VERSION) {
      throw new Error('GenerationTaskReceipt.contractVersion is unsupported');
    }
    assertString(value.generationTaskId, 'GenerationTaskReceipt.generationTaskId');
    assertString(value.tenantId, 'GenerationTaskReceipt.tenantId');
    assertString(value.projectId, 'GenerationTaskReceipt.projectId');
    assertNumber(value.progress, 'GenerationTaskReceipt.progress');
    assertArray(value.outputAssetIds, 'GenerationTaskReceipt.outputAssetIds');
    if (value.progress < 0 || value.progress > 100) {
      throw new Error('GenerationTaskReceipt.progress must be 0..100');
    }
    if (value.actualCredits) assertDemoCredit(value.actualCredits, 'GenerationTaskReceipt.actualCredits');
    if (value.status === 'succeeded' && value.outputAssetIds.length === 0) {
      throw new Error('Succeeded GenerationTaskReceipt requires an output asset');
    }
    if (value.status === 'failed' && !value.error) {
      throw new Error('Failed GenerationTaskReceipt requires a standard error');
    }
  },
);

export const assetReceiptSchema = schema<AssetReceipt>(
  'AssetReceipt',
  (value): asserts value is AssetReceipt => {
    assertRecord(value, 'AssetReceipt');
    if (value.contractVersion !== CONTROL_PLANE_CONTRACT_VERSION) {
      throw new Error('AssetReceipt.contractVersion is unsupported');
    }
    assertString(value.assetId, 'AssetReceipt.assetId');
    assertString(value.tenantId, 'AssetReceipt.tenantId');
    assertString(value.projectId, 'AssetReceipt.projectId');
    assertString(value.checksum, 'AssetReceipt.checksum');
    assertString(value.storageReference, 'AssetReceipt.storageReference');
    assertString(value.rightsNote, 'AssetReceipt.rightsNote');
    if (value.storageReference.includes('sqlite')) {
      throw new Error('AssetReceipt cannot use StoryCanvas SQLite as an integration reference');
    }
  },
);

export const exportReceiptSchema = schema<ExportReceipt>(
  'ExportReceipt',
  (value): asserts value is ExportReceipt => {
    assertRecord(value, 'ExportReceipt');
    if (value.contractVersion !== CONTROL_PLANE_CONTRACT_VERSION) {
      throw new Error('ExportReceipt.contractVersion is unsupported');
    }
    assertString(value.exportId, 'ExportReceipt.exportId');
    assertString(value.tenantId, 'ExportReceipt.tenantId');
    assertString(value.projectId, 'ExportReceipt.projectId');
    assertString(value.generationTaskId, 'ExportReceipt.generationTaskId');
    assertArray(value.outputAssetIds, 'ExportReceipt.outputAssetIds');
    if (value.status === 'succeeded' && value.outputAssetIds.length === 0) {
      throw new Error('Succeeded ExportReceipt requires an output asset');
    }
    if (value.status === 'failed' && !value.error) {
      throw new Error('Failed ExportReceipt requires a standard error');
    }
  },
);

export const capabilityTruthManifestSchema = schema<CapabilityTruthManifest>(
  'CapabilityTruthManifest',
  (value): asserts value is CapabilityTruthManifest => {
    assertRecord(value, 'CapabilityTruthManifest');
    if (value.fixtureId !== CONTROL_PLANE_FIXTURE_ID) {
      throw new Error('CapabilityTruthManifest.fixtureId is invalid');
    }
    assertArray(value.entries, 'CapabilityTruthManifest.entries');
    const modes = new Set(
      value.entries.map((entry, index) => {
        assertRecord(entry, `CapabilityTruthManifest.entries[${index}]`);
        assertString(entry.mode, `CapabilityTruthManifest.entries[${index}].mode`);
        assertString(
          entry.transport,
          `CapabilityTruthManifest.entries[${index}].transport`,
        );
        assertString(
          entry.persistence,
          `CapabilityTruthManifest.entries[${index}].persistence`,
        );
        assertString(
          entry.billing,
          `CapabilityTruthManifest.entries[${index}].billing`,
        );
        assertRecord(
          entry.statusSource,
          `CapabilityTruthManifest.entries[${index}].statusSource`,
        );
        assertString(
          entry.statusSource.transport,
          `CapabilityTruthManifest.entries[${index}].statusSource.transport`,
        );
        assertString(
          entry.statusSource.persistence,
          `CapabilityTruthManifest.entries[${index}].statusSource.persistence`,
        );
        assertString(
          entry.statusSource.billing,
          `CapabilityTruthManifest.entries[${index}].statusSource.billing`,
        );
        return entry.mode;
      }),
    );
    const requiredModes = [
      'REAL-UI',
      'REAL-CAP',
      'MOCK-CONTRACT',
      'HYBRID',
      'LOCKED',
      'FALLBACK',
    ] as const;
    for (const required of requiredModes) {
      if (!modes.has(required)) {
        throw new Error(`CapabilityTruthManifest is missing ${required}`);
      }
    }
  },
);

export const controlPlaneDemoStateSchema = schema<ControlPlaneDemoState>(
  'ControlPlaneDemoState',
  (value): asserts value is ControlPlaneDemoState => {
    assertRecord(value, 'ControlPlaneDemoState');
    if (value.fixtureId !== CONTROL_PLANE_FIXTURE_ID) {
      throw new Error('ControlPlaneDemoState.fixtureId is invalid');
    }
    if (!['DEMO_READY', 'IN_PROGRESS'].includes(value.stateName as string)) {
      throw new Error('ControlPlaneDemoState.stateName is invalid');
    }
    const commercial = value.commercial;
    assertRecord(commercial, 'ControlPlaneDemoState.commercial');
    platformContextSchema.parse(commercial.platform);
    assertArray(commercial.channels, 'ControlPlaneDemoState.commercial.channels');
    commercial.channels.forEach((item) => channelOrganizationSchema.parse(item));
    tenantContextSchema.parse(commercial.tenant);
    assertArray(commercial.memberships, 'ControlPlaneDemoState.commercial.memberships');
    commercial.memberships.forEach((item) => membershipSchema.parse(item));
    assertArray(commercial.capabilities, 'ControlPlaneDemoState.commercial.capabilities');
    commercial.capabilities.forEach((item) => capabilitySchema.parse(item));
    assertArray(commercial.products, 'ControlPlaneDemoState.commercial.products');
    commercial.products.forEach((item) => productSchema.parse(item));
    assertArray(commercial.skus, 'ControlPlaneDemoState.commercial.skus');
    commercial.skus.forEach((item) => skuSchema.parse(item));
    assertArray(commercial.entitlements, 'ControlPlaneDemoState.commercial.entitlements');
    commercial.entitlements.forEach((item) => entitlementSchema.parse(item));
    demoRateCardSchema.parse(commercial.rateCard);
    assertArray(
      commercial.creditScenarios,
      'ControlPlaneDemoState.commercial.creditScenarios',
    );
    commercial.creditScenarios.forEach((scenario, index) => {
      assertRecord(
        scenario,
        `ControlPlaneDemoState.commercial.creditScenarios[${index}]`,
      );
      assertDemoCredit(
        scenario.maxReservedCredits,
        `ControlPlaneDemoState.commercial.creditScenarios[${index}].maxReservedCredits`,
      );
      assertDemoCredit(
        scenario.consumedCredits,
        `ControlPlaneDemoState.commercial.creditScenarios[${index}].consumedCredits`,
      );
      assertDemoCredit(
        scenario.releasedCredits,
        `ControlPlaneDemoState.commercial.creditScenarios[${index}].releasedCredits`,
      );
    });
    assertRecord(commercial.creditState, 'ControlPlaneDemoState.commercial.creditState');
    walletSchema.parse(commercial.creditState.wallet);
    assertArray(
      commercial.creditState.lots,
      'ControlPlaneDemoState.commercial.creditState.lots',
    );
    commercial.creditState.lots.forEach((item) => creditLotSchema.parse(item));
    assertArray(
      commercial.creditState.ledger,
      'ControlPlaneDemoState.commercial.creditState.ledger',
    );
    creditLedgerSchema.parse(commercial.creditState.ledger);
    assertArray(value.scriptApprovals, 'ControlPlaneDemoState.scriptApprovals');
    value.scriptApprovals.forEach((item) => scriptApprovalSchema.parse(item));
    if (value.package) projectProductionPackageSchema.parse(value.package);
    assertArray(value.grants, 'ControlPlaneDemoState.grants');
    value.grants.forEach((item) => demoProjectGrantSchema.parse(item));
    assertArray(
      value.generationTaskReceipts,
      'ControlPlaneDemoState.generationTaskReceipts',
    );
    value.generationTaskReceipts.forEach((item) => generationTaskReceiptSchema.parse(item));
    assertArray(value.assetReceipts, 'ControlPlaneDemoState.assetReceipts');
    value.assetReceipts.forEach((item) => assetReceiptSchema.parse(item));
    assertArray(value.exportReceipts, 'ControlPlaneDemoState.exportReceipts');
    value.exportReceipts.forEach((item) => exportReceiptSchema.parse(item));
    assertRecord(value.transport, 'ControlPlaneDemoState.transport');
    assertString(value.transport.baseUrl, 'ControlPlaneDemoState.transport.baseUrl');
    assertString(value.transport.phase, 'ControlPlaneDemoState.transport.phase');
    if (
      ![
        'offline',
        'connecting',
        'accepted',
        'duplicate',
        'rejected',
        'error',
        'retrying',
        'handoff_waiting',
        'handoff_ready',
        'handoff_timeout',
      ].includes(value.transport.phase)
    ) {
      throw new Error('ControlPlaneDemoState.transport.phase is invalid');
    }
    if (typeof value.transport.connected !== 'boolean') {
      throw new Error('ControlPlaneDemoState.transport.connected must be boolean');
    }
    capabilityTruthManifestSchema.parse(value.truthManifest);
  },
);

export const controlPlaneSchemas = {
  PlatformContext: platformContextSchema,
  ChannelOrganization: channelOrganizationSchema,
  TenantContext: tenantContextSchema,
  DataScope: dataScopeSchema,
  Membership: membershipSchema,
  Capability: capabilitySchema,
  Product: productSchema,
  SKU: skuSchema,
  Entitlement: entitlementSchema,
  DemoRateCard: demoRateCardSchema,
  Wallet: walletSchema,
  CreditLot: creditLotSchema,
  CreditLedger: creditLedgerSchema,
  CreditLedgerEntry: creditLedgerEntrySchema,
  ProjectProductionPackage: projectProductionPackageSchema,
  ScriptApproval: scriptApprovalSchema,
  DemoProjectGrant: demoProjectGrantSchema,
  GenerationTaskReceipt: generationTaskReceiptSchema,
  AssetReceipt: assetReceiptSchema,
  ExportReceipt: exportReceiptSchema,
  CapabilityTruthManifest: capabilityTruthManifestSchema,
  ControlPlaneDemoState: controlPlaneDemoStateSchema,
} as const;
