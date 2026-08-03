import type {
  AspectRatio,
  Claim,
  ProjectBrief,
  ScriptVersion,
  StoryboardShot,
} from './types';

export const CONTROL_PLANE_CONTRACT_VERSION = '0.1' as const;
export const CONTROL_PLANE_FIXTURE_ID = 'demo-local-001' as const;
export const DEMO_DATA_LABEL = '演示数据 · 非正式报价' as const;
export const DEMO_READY = 'DEMO_READY' as const;

export type ContractVersion = typeof CONTROL_PLANE_CONTRACT_VERSION;
export type DemoDataLabel = typeof DEMO_DATA_LABEL;
export type DemoStateName = typeof DEMO_READY | 'IN_PROGRESS';

export interface DemoSemantic {
  dataMode: 'DEMO';
  quoteStatus: 'NON_QUOTE';
  label: DemoDataLabel;
}

export interface DemoCreditValue extends DemoSemantic {
  value: number;
  unit: 'AI_VIDEO_CREDIT';
}

export interface DemoMoneyValue extends DemoSemantic {
  amountMinor: number;
  currency: 'CNY';
}

export type DemoCommercialPartyType = 'PROVIDER' | OrganizationContextType;

export interface DemoCommercialParty {
  partyType: DemoCommercialPartyType;
  partyId: string;
  displayName: string;
}

export type DemoPriceLayer =
  'UPSTREAM_COST' | 'PLATFORM_SETTLEMENT' | 'CHANNEL_WHOLESALE' | 'CUSTOMER_RETAIL' | 'CAMPAIGN';

export interface DemoPriceSnapshot {
  priceSnapshotId: string;
  version: 'demo-v1';
  priceLayer: DemoPriceLayer;
  seller: DemoCommercialParty;
  buyer: DemoCommercialParty;
  skuId: string;
  chargeUnit: 'PER_STANDARD_TASK' | 'PER_AI_VIDEO_CREDIT';
  unitPrice: DemoMoneyValue;
  taxIncluded: false;
  effectiveFrom: string;
  effectiveTo: string;
  disclaimer: DemoDataLabel;
}

export interface DemoCommercialOrder {
  orderId: string;
  seller: DemoCommercialParty;
  buyer: DemoCommercialParty;
  skuId: string;
  status: 'fulfilled';
  creditAmount: DemoCreditValue;
  listAmount: DemoMoneyValue;
  discountAmount: DemoMoneyValue;
  netAmount: DemoMoneyValue;
  acquisitionCost: DemoMoneyValue;
  grossSpread: DemoMoneyValue;
  priceSnapshotIds: string[];
  fulfilledAt: string;
  disclaimer: DemoDataLabel;
}

export interface DemoChannelCreditInventory {
  channelOrganizationId: string;
  purchasedCredits: DemoCreditValue;
  allocatedToSubchannels: DemoCreditValue;
  allocatedToTenants: DemoCreditValue;
  availableCredits: DemoCreditValue;
  asOf: string;
  disclaimer: DemoDataLabel;
}

export interface DemoChannelSettlementSummary {
  settlementId: string;
  channelOrganizationId: string;
  periodStart: string;
  periodEnd: string;
  status: 'reviewed';
  orderIds: string[];
  openingAvailableCredits: DemoCreditValue;
  purchasedCredits: DemoCreditValue;
  soldCredits: DemoCreditValue;
  closingAvailableCredits: DemoCreditValue;
  salesNetAmount: DemoMoneyValue;
  acquisitionCost: DemoMoneyValue;
  grossSpread: DemoMoneyValue;
  unmatchedItemCount: number;
  disclaimer: DemoDataLabel;
}

export interface DemoPlatformRiskSummary {
  openCommercialExceptions: number;
  unmatchedReceiptCount: number;
  frozenWalletCount: number;
  auditEventCount: number;
  asOf: string;
  disclaimer: DemoDataLabel;
}

export interface DemoCommercialProjection {
  fixedChannelOrganizationId: string;
  priceSnapshots: DemoPriceSnapshot[];
  orders: DemoCommercialOrder[];
  channelInventories: DemoChannelCreditInventory[];
  settlementSummaries: DemoChannelSettlementSummary[];
  platformRisk: DemoPlatformRiskSummary;
  disclaimer: DemoDataLabel;
}

export interface PlatformContext {
  platformId: string;
  displayName: string;
  status: 'active';
  contextType: 'PLATFORM';
}

export type ChannelTier = 'MASTER' | 'LEVEL_1' | 'LEVEL_2';

export interface ChannelOrganization {
  channelOrganizationId: string;
  displayName: string;
  contextType: 'CHANNEL';
  tier: ChannelTier;
  depth: 1 | 2 | 3;
  parentChannelOrganizationId: string | null;
  status: 'active' | 'suspended';
  whiteLabelMode: boolean;
}

export interface TenantContext {
  tenantId: string;
  displayName: string;
  contextType: 'TENANT';
  status: 'active' | 'suspended';
  acquisitionMode: 'DIRECT' | 'CHANNEL' | 'API_DIRECT' | 'API_CHANNEL';
  currentServiceChannelOrganizationId: string | null;
  dataBoundary: 'PRODUCTION_CONTENT';
}

export type OrganizationContextType = 'PLATFORM' | 'CHANNEL' | 'TENANT';
export type DataScopeKind =
  | 'PLATFORM_GLOBAL'
  | 'CHANNEL_SELF'
  | 'CHANNEL_SUBTREE_COMMERCIAL'
  | 'TENANT_WIDE'
  | 'BRAND_SET'
  | 'STORE_SET'
  | 'PROJECT_SET'
  | 'OWN_RECORDS'
  | 'SUPPORT_GRANT';

export interface DataScope {
  kind: DataScopeKind;
  tenantId?: string;
  brandIds?: string[];
  storeIds?: string[];
  projectIds?: string[];
  expiresAt?: string;
  reason?: string;
}

export interface Membership {
  membershipId: string;
  principalId: string;
  organizationType: OrganizationContextType;
  organizationId: string;
  roleCodes: string[];
  dataScopes: DataScope[];
  status: 'active' | 'suspended' | 'expired';
  validFrom: string;
  validTo: string | null;
}

export type CapabilityAvailability = 'active' | 'explanation_only' | 'locked';

export interface Capability {
  capabilityId: string;
  code: string;
  displayName: string;
  description: string;
  category: 'production' | 'agent' | 'addon' | 'access';
  availability: CapabilityAvailability;
  dependencyCapabilityIds: string[];
}

export interface Product {
  productId: string;
  code: string;
  displayName: string;
  description: string;
  productType: 'base' | 'agent' | 'addon';
  capabilityIds: string[];
  availability: CapabilityAvailability;
  demoAction: 'usable' | 'explain' | 'locked';
}

export interface SKU {
  skuId: string;
  productId: string;
  code: string;
  displayName: string;
  status: 'active' | 'explanation_only' | 'locked';
  entitlementCapabilityIds: string[];
  includedCredits: DemoCreditValue;
  validityDays: number;
}

export interface Entitlement {
  entitlementId: string;
  tenantId: string;
  capabilityId: string;
  sourceType: 'DEMO_SKU' | 'DEMO_LOCK';
  sourceId: string;
  scope: DataScope;
  status: 'active' | 'locked';
  validFrom: string;
  validTo: string;
  demo: DemoSemantic;
}

export interface DemoRateCard {
  rateCardId: string;
  version: string;
  capabilityId: string;
  meterCode: 'STANDARD_5S_720P_VIDEO';
  meteringRule: 'PER_DELIVERABLE_ASSET';
  inputBand: {
    durationSeconds: 5;
    resolution: '720p';
  };
  estimatedCredits: DemoCreditValue;
  maxReservedCredits: DemoCreditValue;
  minimumChargeCredits: DemoCreditValue;
  billableOutcome: 'SUCCEEDED_WITH_REGISTERED_DELIVERABLE_ASSET';
  effectiveFrom: string;
  effectiveTo: string;
  disclaimer: DemoDataLabel;
}

export type WalletStatus = 'active' | 'frozen' | 'closed';

export interface Wallet {
  walletId: string;
  tenantId: string;
  ownerContextType: 'TENANT';
  creditType: 'AI_VIDEO_CREDIT';
  status: WalletStatus;
  available: DemoCreditValue;
  reserved: DemoCreditValue;
  createdAt: string;
  disclaimer: DemoDataLabel;
}

export interface CreditLot {
  lotId: string;
  walletId: string;
  sourceType: 'DEMO_ISSUANCE';
  sourceId: string;
  originalCredits: DemoCreditValue;
  remainingAvailable: DemoCreditValue;
  remainingReserved: DemoCreditValue;
  issuedAt: string;
  expiresAt: string;
  transferPolicy: 'NON_TRANSFERABLE_DEMO';
  refundPolicy: 'NON_REFUNDABLE_DEMO';
  disclaimer: DemoDataLabel;
}

export type CreditBucket =
  | 'available'
  | 'reserved'
  | 'PURCHASE_ISSUANCE'
  | 'CONSUMED_SINK';
export type CreditOperation =
  | 'DEMO_ISSUE_CREDIT'
  | 'RESERVE_CREDIT'
  | 'CONSUME_CREDIT'
  | 'RELEASE_CREDIT';

export interface CreditLedgerEntry {
  entryId: string;
  postingGroupId: string;
  accountId: string;
  walletId: string;
  bucket: CreditBucket;
  delta: DemoCreditValue;
  operation: CreditOperation;
  lotId: string;
  referenceType: 'DEMO_RESET' | 'GENERATION_TASK';
  referenceId: string;
  reservationId: string | null;
  idempotencyKey: string;
  occurredAt: string;
  actorType: 'DEMO_SYSTEM';
  actorId: 'control-plane-mock-adapter';
  reasonCode: string;
  disclaimer: DemoDataLabel;
}

export type CreditLedger = CreditLedgerEntry[];

export interface CreditReservation {
  reservationId: string;
  walletId: string;
  taskId: string;
  status: 'reserved' | 'consumed' | 'released';
  reservedCredits: DemoCreditValue;
  consumedCredits: DemoCreditValue;
  releasedCredits: DemoCreditValue;
  rateCardId: string;
  rateCardVersion: string;
  quoteSnapshotId: string;
  createdAt: string;
  updatedAt: string;
  disclaimer: DemoDataLabel;
}

export interface ProcessedCreditCommand {
  idempotencyKey: string;
  payloadDigest: string;
  postingGroupIds: string[];
  processedAt: string;
}

export interface CreditState {
  wallet: Wallet;
  lots: CreditLot[];
  ledger: CreditLedger;
  reservations: CreditReservation[];
  processedCommands: ProcessedCreditCommand[];
}

export type CreditCommand =
  | {
      type: 'reserve';
      taskId: string;
      reservationId: string;
      credits: number;
      rateCardId: string;
      rateCardVersion: string;
      quoteSnapshotId: string;
      idempotencyKey: string;
      occurredAt: string;
    }
  | {
      type: 'settle_success';
      taskId: string;
      reservationId: string;
      actualCredits: number;
      idempotencyKey: string;
      occurredAt: string;
    }
  | {
      type: 'settle_failure';
      taskId: string;
      reservationId: string;
      idempotencyKey: string;
      occurredAt: string;
    };

export interface CreditTransitionResult {
  state: CreditState;
  duplicate: boolean;
  postingGroupIds: string[];
}

export interface DemoCreditScenario {
  scenarioId: 'canonical_success' | 'canonical_failure';
  taskId: string;
  reservationId: string;
  outcome: 'succeeded_with_deliverable' | 'failed_without_deliverable';
  maxReservedCredits: DemoCreditValue;
  consumedCredits: DemoCreditValue;
  releasedCredits: DemoCreditValue;
  expectedSequence:
    | ['requested', 'reserved', 'consumed', 'released_remainder']
    | ['requested', 'reserved', 'released'];
  disclaimer: DemoDataLabel;
}

export interface ProductionCapabilityGrant {
  capabilityId: string;
  entitlementId: string;
  constraints: {
    projectId: string;
    maxDurationSeconds: number;
    aspectRatio: AspectRatio;
  };
}

export interface ApprovedScriptSnapshot extends ScriptVersion {
  approvalStatus: 'approved';
  approvedAt: string;
  approvedBy: string;
}

export type ScriptApprovalStatus =
  | 'pending'
  | 'approved'
  | 'revoked'
  | 'blocked';

export interface ScriptApproval {
  approvalId: string;
  fixtureId: typeof CONTROL_PLANE_FIXTURE_ID;
  tenantId: string;
  projectId: string;
  scriptVersionId: string;
  scriptDigest: string;
  status: ScriptApprovalStatus;
  factRiskStatus: 'unresolved' | 'cleared';
  factRiskIds: string[];
  approvedAt: string | null;
  approvedBy: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  blockedAt: string | null;
  blockedBy: string | null;
  blockedReason: string | null;
  updatedAt: string;
}

export interface ProjectProductionPackage {
  packageId: string;
  packageVersion: 1;
  contractVersion: ContractVersion;
  tenantId: string;
  organizationId: string;
  organizationType: OrganizationContextType;
  projectId: string;
  brandId: string;
  storeId: string;
  campaignId: string;
  agentTemplateCode: 'local_life';
  creativeBriefSnapshot: ProjectBrief;
  brandFactsSnapshot: Claim[];
  riskRulesSnapshot: {
    prohibitedWords: string[];
    restrictions: string[];
    requiredClaimIds: string[];
  };
  approvedScriptVersion: ApprovedScriptSnapshot;
  shotDrafts: StoryboardShot[];
  target: {
    platform: '抖音';
    aspectRatio: '9:16';
    durationSeconds: 30;
  };
  capabilityGrants: ProductionCapabilityGrant[];
  sourceVersions: {
    demoWorkspace: 'videoagent:mvp:v1';
    project: number;
    brief: number;
    brand: number;
    script: number;
    storyboard: number;
  };
  idempotencyKey: string;
  digest: string;
  createdAt: string;
  expiresAt: string;
  truthMode: 'MOCK-CONTRACT';
}

export interface DemoProjectGrant {
  grantId: string;
  grantType: 'DEMO_PROJECT_GRANT';
  mock: true;
  truthMode: 'MOCK-CONTRACT';
  tenantId: string;
  organizationId: string;
  organizationType: OrganizationContextType;
  projectId: string;
  packageId: string;
  packageVersion: 1;
  capabilityIds: string[];
  scopes: Array<'production.package.read' | 'production.receipt.write'>;
  issuedAt: string;
  expiresAt: string;
  mockHandle: string;
  warning: 'DEMO ONLY · NOT A SIGNED TOKEN · DO NOT USE AS CREDENTIAL';
}

export type GenerationTaskStatus =
  | 'requested'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface StandardReceiptError {
  code: string;
  message: string;
  retryable: boolean;
  details: Record<string, string>;
}

export interface GenerationTaskReceipt {
  contractVersion: ContractVersion;
  generationTaskId: string;
  tenantId: string;
  projectId: string;
  shotId: string;
  taskType: 'video.generate' | 'image.generate';
  capabilityId: string;
  provider: 'DemoGenerator';
  model: 'deterministic-demo-v1';
  status: GenerationTaskStatus;
  progress: number;
  inputDigest: string;
  referenceAssetIds: string[];
  reservationReference: string;
  actualCredits: DemoCreditValue | null;
  outputAssetIds: string[];
  error: StandardReceiptError | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  idempotencyKey: string;
  truthMode: 'MOCK-CONTRACT';
}

export interface AssetReceipt {
  contractVersion: ContractVersion;
  assetId: string;
  tenantId: string;
  projectId: string;
  shotId: string;
  type: 'image' | 'video';
  mimeType: string;
  dimensions: {
    width: number;
    height: number;
  };
  durationSeconds: number;
  checksum: string;
  source: 'DemoGenerator' | 'upload' | 'library';
  model: 'deterministic-demo-v1' | null;
  generationTaskId: string | null;
  promptDigest: string | null;
  storageReference: string;
  rightsNote: string;
  reviewStatus: 'registered' | 'qa_blocked' | 'approved';
  version: number;
  idempotencyKey: string;
  createdAt: string;
  truthMode: 'MOCK-CONTRACT';
}

export interface ExportReceipt {
  contractVersion: ContractVersion;
  exportId: string;
  tenantId: string;
  projectId: string;
  generationTaskId: string;
  status: 'succeeded' | 'failed';
  outputAssetIds: string[];
  checksum: string | null;
  error: StandardReceiptError | null;
  idempotencyKey: string;
  createdAt: string;
  truthMode: 'MOCK-CONTRACT';
}

export type StoryCanvasTransportPhase =
  | 'offline'
  | 'connecting'
  | 'accepted'
  | 'duplicate'
  | 'rejected'
  | 'error'
  | 'retrying'
  | 'handoff_waiting'
  | 'handoff_ready'
  | 'handoff_timeout';

export type StoryCanvasHandoffStatus =
  | 'idle'
  | 'opening'
  | 'waiting_for_grant_request'
  | 'grant_sent'
  | 'ready'
  | 'timeout'
  | 'closed'
  | 'error';

export interface StoryCanvasHandoffState {
  status: StoryCanvasHandoffStatus;
  origin: 'http://localhost:50188';
  openedAt: string | null;
  expiresAt: string | null;
  readyAt: string | null;
  error: StandardReceiptError | null;
}

export interface StoryCanvasTransportState {
  baseUrl: string;
  phase: StoryCanvasTransportPhase;
  connected: boolean;
  retryCount: number;
  lastAttemptAt: string | null;
  lastConnectedAt: string | null;
  deepLink: string | null;
  packageId: string | null;
  projectId: string | null;
  lastError: StandardReceiptError | null;
}

export interface StoryCanvasPackageResponse {
  status: 'accepted' | 'rejected';
  result: 'accepted' | 'duplicate' | 'rejected';
  packageId: string;
  projectId: string;
  duplicate: boolean;
  deepLink: string | null;
  acceptedAt?: string;
  error?: StandardReceiptError;
}

export interface StoryCanvasApiEnvelope<T> {
  code: number;
  data: T;
  message: string;
}

export interface ReceiptOutboxEnvelope {
  id: string;
  receiptType: 'generation-task' | 'asset' | 'export';
  businessId: string;
  projectId: string;
  packageId: string;
  packageDigest: string;
  deliveryId: string;
  status: 'delivered';
  retryCount: number;
  payloadDigest: string;
  digest: string;
  idempotencyKey: string;
  lastAttempt: string | null;
  deliveredAt: string;
  acknowledgedAt: null;
  createdAt: string;
  updatedAt: string;
  payload: GenerationTaskReceipt | AssetReceipt | ExportReceipt;
}

export interface ReceiptSyncItemResult {
  receiptId: string;
  deliveryId: string;
  kind: ReceiptOutboxEnvelope['receiptType'];
  status: 'accepted' | 'duplicate' | 'rejected' | 'ack_error';
  acked: boolean;
  error: StandardReceiptError | null;
}

export interface ReceiptSyncResult {
  transport: StoryCanvasTransportState;
  items: ReceiptSyncItemResult[];
}

export interface ControlPlaneBootstrapResult {
  status: 'ready' | 'offline' | 'error';
  snapshot: ControlPlaneDemoState;
  transport: StoryCanvasTransportState;
  retryable: boolean;
  error: StandardReceiptError | null;
}

export type WorkbenchKind = 'platform' | 'channel' | 'tenant';

export interface ActiveOrganizationContext {
  activeOrganizationId: string;
  organizationType: OrganizationContextType;
  workbenchKind: WorkbenchKind;
  membershipId: string;
  roleCodes: string[];
  tenantId: string | null;
  projectIds: string[];
  menuContext: {
    canViewCommercial: boolean;
    canViewTenantContent: boolean;
    canExecuteProduction: boolean;
    canManagePlatform: boolean;
    canManageChannel: boolean;
  };
}

export type CapabilityTruthMode =
  | 'REAL-UI'
  | 'REAL-CAP'
  | 'MOCK-CONTRACT'
  | 'HYBRID'
  | 'LOCKED'
  | 'FALLBACK';

export interface CapabilityTruthEntry {
  capabilityId: string;
  displayName: string;
  mode: CapabilityTruthMode;
  ui: 'REAL-UI' | 'NOT_IMPLEMENTED';
  execution: 'REAL-CAP' | 'MOCK' | 'LOCKED' | 'FALLBACK';
  transport:
    | 'LOCAL'
    | 'MOCK-CONTRACT'
    | 'HTTP_NOT_CONNECTED'
    | 'HTTP_CONNECTED'
    | 'HTTP_ERROR'
    | 'HTTP_RETRYING';
  persistence: 'LOCAL_DEMO' | 'REMOTE_API' | 'NOT_APPLICABLE';
  provider: 'DemoGenerator' | 'StoryCanvas' | 'FFmpeg' | 'NONE';
  billing: 'MOCK-CONTRACT' | 'NOT_APPLICABLE';
  statusSource: {
    transport: 'bridge-runtime';
    persistence: 'adapter-runtime' | 'bridge-contract';
    billing: 'credit-ledger' | 'not-applicable';
  };
  projectIntegrated: boolean;
  fallbackLabel: string | null;
  knownLimitations: string[];
}

export interface CapabilityTruthManifest {
  manifestVersion: 'D1.0';
  releaseId: 'D1-FOUNDATION-MOCK';
  fixtureId: typeof CONTROL_PLANE_FIXTURE_ID;
  fixtureDigest: string;
  disclaimer: DemoDataLabel;
  entries: CapabilityTruthEntry[];
}

export interface ReceiptAcceptance {
  accepted: boolean;
  duplicate: boolean;
  status: 'accepted' | 'pending' | 'duplicate';
  resourceId: string;
  creditState: CreditState;
}

export interface SourceChain {
  tenantId: string;
  projectId: string;
  packageId: string;
  packageDigest: string;
  claimIds: string[];
  approvedScriptVersionId: string;
  shotId: string;
  generationTaskReceipt: GenerationTaskReceipt;
  assetReceipt: AssetReceipt | null;
  exportReceipt: ExportReceipt | null;
  creditReservation: CreditReservation;
  rateCard: DemoRateCard;
  creditEntries: CreditLedgerEntry[];
  truthManifest: CapabilityTruthManifest;
}

export interface ControlPlaneCommercialFixture {
  platform: PlatformContext;
  channels: ChannelOrganization[];
  tenant: TenantContext;
  memberships: Membership[];
  capabilities: Capability[];
  products: Product[];
  skus: SKU[];
  entitlements: Entitlement[];
  rateCard: DemoRateCard;
  creditScenarios: DemoCreditScenario[];
  creditState: CreditState;
  demoBusiness: DemoCommercialProjection;
}

export interface ControlPlaneDemoState {
  stateName: DemoStateName;
  fixtureId: typeof CONTROL_PLANE_FIXTURE_ID;
  fixtureDigest: string;
  commercial: ControlPlaneCommercialFixture;
  scriptApprovals: ScriptApproval[];
  package: ProjectProductionPackage | null;
  grants: DemoProjectGrant[];
  generationTaskReceipts: GenerationTaskReceipt[];
  assetReceipts: AssetReceipt[];
  exportReceipts: ExportReceipt[];
  transport: StoryCanvasTransportState;
  truthManifest: CapabilityTruthManifest;
}

export type ControlPlaneErrorCode =
  | 'ACTION_SCOPE_DENIED'
  | 'TENANT_SCOPE_MISMATCH'
  | 'IDEMPOTENCY_CONFLICT'
  | 'CAPABILITY_NOT_ENTITLED'
  | 'CAPABILITY_LOCKED'
  | 'INSUFFICIENT_CREDITS'
  | 'CONTRACT_VALIDATION_FAILED'
  | 'PROJECT_NOT_FOUND'
  | 'PACKAGE_NOT_FOUND'
  | 'RESERVATION_NOT_FOUND'
  | 'RECEIPT_CONFLICT'
  | 'SCRIPT_NOT_APPROVED'
  | 'SCRIPT_APPROVAL_BLOCKED'
  | 'FACT_RISK_UNRESOLVED'
  | 'ROUTE_ID_REJECTED'
  | 'TRANSPORT_REJECTED'
  | 'TRANSPORT_OFFLINE'
  | 'GRANT_EXPIRED'
  | 'GRANT_SCOPE_MISMATCH'
  | 'HANDOFF_ORIGIN_REJECTED'
  | 'HANDOFF_TIMEOUT';

export interface ControlPlaneErrorShape {
  code: ControlPlaneErrorCode;
  message: string;
  retryable: boolean;
  details: Record<string, string | number | boolean>;
}

export interface AuthorizationContext {
  principalId: string;
  membershipId: string;
  organizationType: OrganizationContextType;
  organizationId: string;
  tenantId: string | null;
  projectId: string | null;
}
