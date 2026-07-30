import {
  type AssetReceipt,
  type AuthorizationContext,
  type ControlPlaneDemoState,
  type ControlPlaneErrorCode,
  type DemoProjectGrant,
  type ExportReceipt,
  type GenerationTaskReceipt,
  type ProjectProductionPackage,
  type ReceiptAcceptance,
  type SourceChain,
  type ScriptApproval,
  type StoryCanvasTransportState,
} from '../domain/controlPlane';
import {
  applyCreditCommand,
  CreditStateError,
} from '../domain/creditLedger';
import {
  assetReceiptSchema,
  controlPlaneDemoStateSchema,
  demoProjectGrantSchema,
  exportReceiptSchema,
  generationTaskReceiptSchema,
  projectProductionPackageSchema,
} from '../domain/controlPlaneSchemas';
import { digestValue } from '../domain/controlPlaneUtils';
import type { DemoWorkspace } from '../domain/types';
import {
  CAPABILITY_IDS,
  createCanonicalDemoGrant,
  createCanonicalFailureTaskReceipt,
  createCanonicalSuccessAssetReceipt,
  createCanonicalSuccessTaskReceipt,
  createControlPlaneDemoState,
  DEMO_FAILURE_RESERVATION_ID,
  DEMO_FAILURE_TASK_ID,
  DEMO_PACKAGE_IDEMPOTENCY_KEY,
  DEMO_RATE_CARD_ID,
  DEMO_RATE_CARD_VERSION,
  DEMO_SUCCESS_RESERVATION_ID,
  DEMO_SUCCESS_TASK_ID,
  DEMO_TENANT_ID,
  DEMO_TENANT_ORGANIZATION_ID,
  buildProjectProductionPackage,
  buildCapabilityTruthManifest,
  createCanonicalScriptApproval,
} from '../mocks/controlPlaneDemo';
import { cloneDemoWorkspace } from '../mocks/demoWorkspace';
import {
  loadDemoScriptApproval,
  saveDemoScriptApproval,
} from './controlPlanePersistence';
import { loadWorkspace } from './storage';

export class ControlPlaneMockError extends Error {
  readonly code: ControlPlaneErrorCode;
  readonly details: Record<string, string | number | boolean>;
  readonly retryable: boolean;

  constructor(
    code: ControlPlaneErrorCode,
    message: string,
    details: Record<string, string | number | boolean> = {},
    retryable = false,
  ) {
    super(message);
    this.name = 'ControlPlaneMockError';
    this.code = code;
    this.details = details;
    this.retryable = retryable;
  }
}

export const tenantDemoAuthorization: AuthorizationContext = {
  principalId: 'principal-demo-owner',
  membershipId: 'membership-demo-tenant-owner',
  organizationType: 'TENANT',
  organizationId: DEMO_TENANT_ORGANIZATION_ID,
  tenantId: DEMO_TENANT_ID,
  projectId: 'demo-local-001',
};

export const channelCommercialOnlyAuthorization: AuthorizationContext = {
  principalId: 'principal-demo-owner',
  membershipId: 'membership-demo-channel-level-1',
  organizationType: 'CHANNEL',
  organizationId: 'channel-demo-level-1',
  tenantId: null,
  projectId: null,
};

export const channelTenantContentSpoofAuthorization: AuthorizationContext = {
  ...channelCommercialOnlyAuthorization,
  tenantId: DEMO_TENANT_ID,
  projectId: 'demo-local-001',
};

export const canonicalControlPlaneErrorVectors = [
  {
    caseId: 'ERR-SCOPE-001',
    expectedCode: 'ACTION_SCOPE_DENIED',
    operation: 'createProjectProductionPackage',
    inputHint: '使用 channelTenantContentSpoofAuthorization 模拟渠道绕过 Tenant Membership',
  },
  {
    caseId: 'ERR-TENANT-001',
    expectedCode: 'TENANT_SCOPE_MISMATCH',
    operation: 'createProjectProductionPackage',
    inputHint: '复制 tenantDemoAuthorization 并将 tenantId 改为其他 Tenant',
  },
  {
    caseId: 'ERR-IDEMPOTENCY-001',
    expectedCode: 'IDEMPOTENCY_CONFLICT',
    operation: 'createProjectProductionPackage',
    inputHint: '先创建 canonical 包，再用同一 idempotencyKey 和不同 capabilityIds 重放',
  },
  {
    caseId: 'ERR-LOCKED-001',
    expectedCode: 'CAPABILITY_LOCKED',
    operation: 'createProjectProductionPackage',
    inputHint: '请求 CAPABILITY_IDS.digitalHuman 或 CAPABILITY_IDS.apiAccess',
  },
  {
    caseId: 'ERR-CREDIT-001',
    expectedCode: 'INSUFFICIENT_CREDITS',
    operation: 'reserveGenerationTask',
    inputHint: '在 DEMO_READY 钱包请求冻结 1001 额度',
  },
] as const;

export interface CreatePackageInput {
  authorization: AuthorizationContext;
  projectId: string;
  capabilityIds: string[];
  idempotencyKey: string;
}

export interface IssueGrantInput {
  authorization: AuthorizationContext;
  packageId: string;
  capabilityIds: string[];
  idempotencyKey: string;
}

export interface ReserveTaskInput {
  authorization: AuthorizationContext;
  generationTaskId: string;
  reservationId: string;
  capabilityId: string;
  maxReservedCredits: number;
  idempotencyKey: string;
  occurredAt: string;
}

interface CommandRecord<T> {
  payloadDigest: string;
  result: T;
}

interface ReceiptRecord {
  payloadDigest: string;
  resourceId: string;
}

export interface ControlPlaneAdapterCheckpoint {
  state: ControlPlaneDemoState;
  commandRecords: Array<[string, CommandRecord<unknown>]>;
  receiptRecords: Array<[string, ReceiptRecord]>;
}

export interface ApproveScriptInput {
  scriptVersionId: string;
  approvedBy: string;
  approvedAt: string;
  unresolvedFactRiskIds?: string[];
}

export interface RevokeScriptInput {
  scriptVersionId: string;
  revokedBy: string;
  revokedAt: string;
}

export interface BlockScriptInput {
  scriptVersionId: string;
  blockedBy: string;
  blockedAt: string;
  reason: string;
  factRiskIds: string[];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class ControlPlaneMockAdapter {
  private state: ControlPlaneDemoState;
  private readonly commandRecords = new Map<string, CommandRecord<unknown>>();
  private readonly receiptRecords = new Map<string, ReceiptRecord>();
  private readonly workspaceProvider: () => DemoWorkspace;

  constructor(
    workspaceProvider: () => DemoWorkspace = cloneDemoWorkspace,
  ) {
    this.workspaceProvider = workspaceProvider;
    const workspace = this.workspaceProvider();
    const approval =
      loadDemoScriptApproval() ?? createCanonicalScriptApproval(workspace);
    this.state = createControlPlaneDemoState(workspace, approval);
    saveDemoScriptApproval(approval);
  }

  getState(): ControlPlaneDemoState {
    controlPlaneDemoStateSchema.parse(this.state);
    return clone(this.state);
  }

  createCheckpoint(): ControlPlaneAdapterCheckpoint {
    return {
      state: clone(this.state),
      commandRecords: clone([...this.commandRecords.entries()]),
      receiptRecords: clone([...this.receiptRecords.entries()]),
    };
  }

  restoreCheckpoint(checkpoint: ControlPlaneAdapterCheckpoint): ControlPlaneDemoState {
    this.state = clone(checkpoint.state);
    this.commandRecords.clear();
    checkpoint.commandRecords.forEach(([key, value]) => {
      this.commandRecords.set(key, clone(value));
    });
    this.receiptRecords.clear();
    checkpoint.receiptRecords.forEach(([key, value]) => {
      this.receiptRecords.set(key, clone(value));
    });
    const approval = this.state.scriptApprovals[0];
    if (approval) saveDemoScriptApproval(approval);
    return this.getState();
  }

  resetDemoReady(
    workspace: DemoWorkspace = this.workspaceProvider(),
  ): ControlPlaneDemoState {
    this.commandRecords.clear();
    this.receiptRecords.clear();
    const approval = createCanonicalScriptApproval(workspace);
    this.state = createControlPlaneDemoState(workspace, approval);
    saveDemoScriptApproval(approval);
    return this.getState();
  }

  getScriptApproval(scriptVersionId = 'script-a'): ScriptApproval {
    const approval = this.state.scriptApprovals.find(
      (item) => item.scriptVersionId === scriptVersionId,
    );
    if (!approval) {
      throw new ControlPlaneMockError(
        'SCRIPT_NOT_APPROVED',
        '找不到脚本批准状态。',
        { scriptVersionId },
      );
    }
    return clone(approval);
  }

  approveScript(input: ApproveScriptInput): ScriptApproval {
    const workspace = this.workspaceProvider();
    const script = workspace.scripts.find(
      (item) => item.id === input.scriptVersionId,
    );
    if (!script || script.id !== 'script-a') {
      throw new ControlPlaneMockError(
        'PROJECT_NOT_FOUND',
        'D1 只允许批准 canonical script-a。',
        { scriptVersionId: input.scriptVersionId },
      );
    }
    if ((input.unresolvedFactRiskIds ?? []).length > 0) {
      throw new ControlPlaneMockError(
        'FACT_RISK_UNRESOLVED',
        '事实风险未解除，不能批准脚本。',
        { factRiskIds: (input.unresolvedFactRiskIds ?? []).join(',') },
      );
    }
    const previous = this.state.scriptApprovals.find(
      (item) => item.scriptVersionId === input.scriptVersionId,
    );
    const approval: ScriptApproval = {
      ...(previous ?? createCanonicalScriptApproval(workspace)),
      scriptDigest: digestValue(script),
      status: 'approved',
      factRiskStatus: 'cleared',
      factRiskIds: [],
      approvedAt: input.approvedAt,
      approvedBy: input.approvedBy,
      revokedAt: null,
      revokedBy: null,
      blockedAt: null,
      blockedBy: null,
      blockedReason: null,
      updatedAt: input.approvedAt,
    };
    return this.persistApprovalAndInvalidateArtifacts(approval);
  }

  revokeScript(input: RevokeScriptInput): ScriptApproval {
    const approval = this.getScriptApproval(input.scriptVersionId);
    const revoked: ScriptApproval = {
      ...approval,
      status: 'revoked',
      approvedAt: null,
      approvedBy: null,
      revokedAt: input.revokedAt,
      revokedBy: input.revokedBy,
      blockedAt: null,
      blockedBy: null,
      blockedReason: null,
      updatedAt: input.revokedAt,
    };
    return this.persistApprovalAndInvalidateArtifacts(revoked);
  }

  blockScript(input: BlockScriptInput): ScriptApproval {
    if (!input.reason.trim() || input.factRiskIds.length === 0) {
      throw new ControlPlaneMockError(
        'FACT_RISK_UNRESOLVED',
        '阻断动作必须记录事实风险与原因。',
        { scriptVersionId: input.scriptVersionId },
      );
    }
    const approval = this.getScriptApproval(input.scriptVersionId);
    const blocked: ScriptApproval = {
      ...approval,
      status: 'blocked',
      factRiskStatus: 'unresolved',
      factRiskIds: [...input.factRiskIds],
      approvedAt: null,
      approvedBy: null,
      revokedAt: null,
      revokedBy: null,
      blockedAt: input.blockedAt,
      blockedBy: input.blockedBy,
      blockedReason: input.reason,
      updatedAt: input.blockedAt,
    };
    return this.persistApprovalAndInvalidateArtifacts(blocked);
  }

  setTransportState(transport: StoryCanvasTransportState): ControlPlaneDemoState {
    this.state.transport = clone(transport);
    this.state.truthManifest = buildCapabilityTruthManifest(
      this.state.fixtureDigest,
      transport,
    );
    return this.getState();
  }

  private persistApprovalAndInvalidateArtifacts(
    approval: ScriptApproval,
  ): ScriptApproval {
    const transport = this.state.transport;
    this.commandRecords.clear();
    this.receiptRecords.clear();
    this.state = createControlPlaneDemoState(
      this.workspaceProvider(),
      approval,
      transport,
    );
    this.state.stateName = 'IN_PROGRESS';
    saveDemoScriptApproval(approval);
    return clone(approval);
  }

  private requireProjectAuthorization(
    authorization: AuthorizationContext,
    projectId: string,
  ) {
    if (authorization.tenantId !== DEMO_TENANT_ID) {
      throw new ControlPlaneMockError(
        'TENANT_SCOPE_MISMATCH',
        'tenantId 与 canonical Demo 项目不匹配。',
        {
          expectedTenantId: DEMO_TENANT_ID,
          receivedTenantId: authorization.tenantId ?? 'null',
        },
      );
    }
    if (projectId !== 'demo-local-001' || authorization.projectId !== projectId) {
      throw new ControlPlaneMockError(
        'ACTION_SCOPE_DENIED',
        '当前授权上下文不包含目标 Project。',
        { projectId },
      );
    }

    const membership = this.state.commercial.memberships.find(
      (item) =>
        item.membershipId === authorization.membershipId &&
        item.principalId === authorization.principalId &&
        item.status === 'active',
    );
    if (!membership) {
      throw new ControlPlaneMockError(
        'ACTION_SCOPE_DENIED',
        '当前主体没有有效 Membership。',
        { membershipId: authorization.membershipId },
      );
    }
    if (
      membership.organizationType !== authorization.organizationType ||
      membership.organizationId !== authorization.organizationId
    ) {
      throw new ControlPlaneMockError(
        'ACTION_SCOPE_DENIED',
        'active organization 与 Membership 不匹配。',
        { organizationId: authorization.organizationId },
      );
    }
    if (membership.organizationType !== 'TENANT') {
      throw new ControlPlaneMockError(
        'ACTION_SCOPE_DENIED',
        '渠道商业关系不能替代 Tenant Membership 读取生产内容。',
        { organizationType: membership.organizationType },
      );
    }

    const hasProjectScope = membership.dataScopes.some(
      (scope) =>
        scope.tenantId === DEMO_TENANT_ID &&
        (scope.kind === 'TENANT_WIDE' ||
          (scope.kind === 'PROJECT_SET' && scope.projectIds?.includes(projectId))),
    );
    if (!hasProjectScope) {
      throw new ControlPlaneMockError(
        'ACTION_SCOPE_DENIED',
        'Membership 未授权目标 Project。',
        { projectId },
      );
    }
  }

  private requireActiveCapabilities(capabilityIds: string[]) {
    for (const capabilityId of capabilityIds) {
      const capability = this.state.commercial.capabilities.find(
        (item) => item.capabilityId === capabilityId,
      );
      if (!capability || capability.availability === 'locked') {
        throw new ControlPlaneMockError(
          'CAPABILITY_LOCKED',
          '请求的 Capability 在 D1 中处于 LOCKED。',
          { capabilityId },
        );
      }
      if (capability.availability !== 'active') {
        throw new ControlPlaneMockError(
          'CAPABILITY_NOT_ENTITLED',
          '说明态 Capability 不可进入执行流程。',
          { capabilityId },
        );
      }
      const entitlement = this.state.commercial.entitlements.find(
        (item) =>
          item.tenantId === DEMO_TENANT_ID &&
          item.capabilityId === capabilityId &&
          item.status === 'active',
      );
      if (!entitlement) {
        throw new ControlPlaneMockError(
          'CAPABILITY_NOT_ENTITLED',
          'Tenant 没有有效 Capability Entitlement。',
          { capabilityId },
        );
      }
    }
  }

  private replayCommand<T>(key: string, payload: unknown): T | null {
    const existing = this.commandRecords.get(key);
    if (!existing) return null;
    const payloadDigest = digestValue(payload);
    if (existing.payloadDigest !== payloadDigest) {
      throw new ControlPlaneMockError(
        'IDEMPOTENCY_CONFLICT',
        '同一幂等键不能用于不同控制平面指令。',
        { idempotencyKey: key },
      );
    }
    return clone(existing.result as T);
  }

  private rememberCommand<T>(key: string, payload: unknown, result: T): T {
    this.commandRecords.set(key, {
      payloadDigest: digestValue(payload),
      result: clone(result),
    });
    return clone(result);
  }

  createProjectProductionPackage(input: CreatePackageInput): ProjectProductionPackage {
    const payload = {
      projectId: input.projectId,
      capabilityIds: [...input.capabilityIds].sort(),
      authorization: input.authorization,
    };
    const replay = this.replayCommand<ProjectProductionPackage>(
      input.idempotencyKey,
      payload,
    );
    if (replay) return replay;

    this.requireProjectAuthorization(input.authorization, input.projectId);
    this.requireActiveCapabilities(input.capabilityIds);
    const canonicalCapabilities = [
      CAPABILITY_IDS.baseGeneration,
      CAPABILITY_IDS.localLife,
    ].sort();
    if (
      [...input.capabilityIds].sort().join(',') !==
      canonicalCapabilities.join(',')
    ) {
      throw new ControlPlaneMockError(
        'CONTRACT_VALIDATION_FAILED',
        'D1 海底捞生产包必须同时包含基础生成与本地生活 Capability。',
        { capabilityIds: [...input.capabilityIds].sort().join(',') },
      );
    }

    if (this.state.package) {
      throw new ControlPlaneMockError(
        'RECEIPT_CONFLICT',
        'D1 canonical package v1 已存在；内容变化必须创建新版本。',
        { packageId: this.state.package.packageId },
      );
    }

    const workspace = this.workspaceProvider();
    const approval = this.getScriptApproval(workspace.activeScriptId);
    if (approval.status === 'blocked') {
      throw new ControlPlaneMockError(
        'SCRIPT_APPROVAL_BLOCKED',
        '脚本已被阻断，不能创建生产包。',
        { scriptVersionId: approval.scriptVersionId },
      );
    }
    if (approval.status !== 'approved') {
      throw new ControlPlaneMockError(
        'SCRIPT_NOT_APPROVED',
        '脚本尚未获得显式批准，不能创建生产包。',
        { scriptVersionId: approval.scriptVersionId, status: approval.status },
      );
    }
    if (approval.factRiskStatus !== 'cleared' || approval.factRiskIds.length > 0) {
      throw new ControlPlaneMockError(
        'FACT_RISK_UNRESOLVED',
        '脚本事实风险未解除，不能创建生产包。',
        { factRiskIds: approval.factRiskIds.join(',') },
      );
    }
    let productionPackage: ProjectProductionPackage;
    try {
      productionPackage = buildProjectProductionPackage(
        workspace,
        approval,
        input.idempotencyKey,
      );
    } catch (error) {
      throw new ControlPlaneMockError(
        'SCRIPT_NOT_APPROVED',
        error instanceof Error ? error.message : '脚本批准证据无效。',
        { scriptVersionId: workspace.activeScriptId },
      );
    }
    const requested = new Set(input.capabilityIds);
    productionPackage.capabilityGrants =
      productionPackage.capabilityGrants.filter((grant) =>
        requested.has(grant.capabilityId),
      );
    const { digest: previousDigest, ...unsignedPackage } = productionPackage;
    if (!previousDigest) {
      throw new ControlPlaneMockError(
        'CONTRACT_VALIDATION_FAILED',
        'ProductionPackage 缺少初始 digest。',
      );
    }
    productionPackage.digest = digestValue(unsignedPackage);
    projectProductionPackageSchema.parse(productionPackage);
    this.state.package = clone(productionPackage);
    this.state.stateName = 'IN_PROGRESS';

    return this.rememberCommand(
      input.idempotencyKey,
      payload,
      productionPackage,
    );
  }

  issueDemoProjectGrant(input: IssueGrantInput): DemoProjectGrant {
    this.requireProjectAuthorization(input.authorization, 'demo-local-001');
    this.requireActiveCapabilities(input.capabilityIds);
    if (!this.state.package || this.state.package.packageId !== input.packageId) {
      throw new ControlPlaneMockError(
        'PACKAGE_NOT_FOUND',
        '必须先创建 canonical ProjectProductionPackage。',
        { packageId: input.packageId },
      );
    }

    const packageCapabilities = new Set(
      this.state.package.capabilityGrants.map((item) => item.capabilityId),
    );
    for (const capabilityId of input.capabilityIds) {
      if (!packageCapabilities.has(capabilityId)) {
        throw new ControlPlaneMockError(
          'ACTION_SCOPE_DENIED',
          'Grant Capability 超出 ProductionPackage 范围。',
          { capabilityId },
        );
      }
    }
    if (
      input.capabilityIds.length !== 1 ||
      input.capabilityIds[0] !== CAPABILITY_IDS.baseGeneration
    ) {
      throw new ControlPlaneMockError(
        'ACTION_SCOPE_DENIED',
        'C5 D1 current grant 只允许最小基础生成 Capability。',
        { capabilityIds: input.capabilityIds.join(',') },
      );
    }

    const grant = createCanonicalDemoGrant(
      this.state.package,
      input.capabilityIds,
    );
    demoProjectGrantSchema.parse(grant);
    this.commandRecords.delete(input.idempotencyKey);
    this.state.grants = [clone(grant)];
    this.state.stateName = 'IN_PROGRESS';
    return clone(grant);
  }

  preflightGenerationTaskReceipt(
    grantId: string,
    receipt: GenerationTaskReceipt,
  ): ReceiptAcceptance {
    const checkpoint = this.createCheckpoint();
    try {
      return this.receiveGenerationTaskReceipt(grantId, receipt);
    } finally {
      this.restoreCheckpoint(checkpoint);
    }
  }

  preflightAssetReceipt(
    grantId: string,
    receipt: AssetReceipt,
  ): ReceiptAcceptance {
    const checkpoint = this.createCheckpoint();
    try {
      return this.receiveAssetReceipt(grantId, receipt);
    } finally {
      this.restoreCheckpoint(checkpoint);
    }
  }

  preflightExportReceipt(
    grantId: string,
    receipt: ExportReceipt,
  ): ReceiptAcceptance {
    const checkpoint = this.createCheckpoint();
    try {
      return this.receiveExportReceipt(grantId, receipt);
    } finally {
      this.restoreCheckpoint(checkpoint);
    }
  }

  reserveGenerationTask(input: ReserveTaskInput) {
    this.requireProjectAuthorization(input.authorization, 'demo-local-001');
    this.requireActiveCapabilities([input.capabilityId]);
    if (!this.state.package) {
      throw new ControlPlaneMockError(
        'PACKAGE_NOT_FOUND',
        '创建可计费任务前必须先发包。',
      );
    }

    try {
      const transition = applyCreditCommand(
        this.state.commercial.creditState,
        {
          type: 'reserve',
          taskId: input.generationTaskId,
          reservationId: input.reservationId,
          credits: input.maxReservedCredits,
          rateCardId: DEMO_RATE_CARD_ID,
          rateCardVersion: DEMO_RATE_CARD_VERSION,
          quoteSnapshotId: `quote:${input.generationTaskId}:demo-v1`,
          idempotencyKey: input.idempotencyKey,
          occurredAt: input.occurredAt,
        },
      );
      this.state.commercial.creditState = transition.state;
      this.state.stateName = 'IN_PROGRESS';
      return clone(transition);
    } catch (error) {
      throw this.mapCreditError(error);
    }
  }

  receiveGenerationTaskReceipt(
    grantId: string,
    receipt: GenerationTaskReceipt,
  ): ReceiptAcceptance {
    generationTaskReceiptSchema.parse(receipt);
    const grant = this.requireGrant(grantId, receipt);
    if (!grant.capabilityIds.includes(receipt.capabilityId)) {
      throw new ControlPlaneMockError(
        'ACTION_SCOPE_DENIED',
        'TaskReceipt Capability 超出 Grant 范围。',
        { capabilityId: receipt.capabilityId },
      );
    }

    const replay = this.checkReceiptReplay(
      `task:${receipt.idempotencyKey}`,
      receipt.generationTaskId,
      receipt,
    );
    if (replay) return replay;

    const taskHistory = this.state.generationTaskReceipts.filter(
      (item) => item.generationTaskId === receipt.generationTaskId,
    );
    const terminal = taskHistory.find((item) =>
      ['succeeded', 'failed', 'cancelled'].includes(item.status),
    );
    if (terminal && digestValue(terminal) !== digestValue(receipt)) {
      throw new ControlPlaneMockError(
        'RECEIPT_CONFLICT',
        '任务已经存在合法终态，后续冲突回执不能覆盖。',
        {
          generationTaskId: receipt.generationTaskId,
          terminalStatus: terminal.status,
          receivedStatus: receipt.status,
        },
      );
    }

    this.state.generationTaskReceipts.push(clone(receipt));
    this.state.stateName = 'IN_PROGRESS';
    this.rememberReceipt(
      `task:${receipt.idempotencyKey}`,
      receipt.generationTaskId,
      receipt,
    );

    if (receipt.status === 'failed' || receipt.status === 'cancelled') {
      this.settleFailure(receipt);
    } else if (receipt.status === 'succeeded') {
      this.maybeSettleSuccess(receipt.generationTaskId);
    }

    return {
      accepted: true,
      duplicate: false,
      status: receipt.status === 'succeeded' ? 'pending' : 'accepted',
      resourceId: receipt.generationTaskId,
      creditState: clone(this.state.commercial.creditState),
    };
  }

  receiveAssetReceipt(
    grantId: string,
    receipt: AssetReceipt,
  ): ReceiptAcceptance {
    assetReceiptSchema.parse(receipt);
    this.requireGrant(grantId, receipt);

    const replay = this.checkReceiptReplay(
      `asset:${receipt.idempotencyKey}`,
      receipt.assetId,
      receipt,
    );
    if (replay) return replay;

    const existing = this.state.assetReceipts.find(
      (item) => item.assetId === receipt.assetId,
    );
    if (existing && existing.checksum !== receipt.checksum) {
      throw new ControlPlaneMockError(
        'RECEIPT_CONFLICT',
        '同一 assetId 不能登记不同 checksum。',
        { assetId: receipt.assetId },
      );
    }
    if (existing) {
      return {
        accepted: true,
        duplicate: true,
        status: 'duplicate',
        resourceId: receipt.assetId,
        creditState: clone(this.state.commercial.creditState),
      };
    }

    this.state.assetReceipts.push(clone(receipt));
    this.state.stateName = 'IN_PROGRESS';
    this.rememberReceipt(
      `asset:${receipt.idempotencyKey}`,
      receipt.assetId,
      receipt,
    );
    if (receipt.generationTaskId) {
      this.maybeSettleSuccess(receipt.generationTaskId);
    }

    return {
      accepted: true,
      duplicate: false,
      status: 'accepted',
      resourceId: receipt.assetId,
      creditState: clone(this.state.commercial.creditState),
    };
  }

  receiveExportReceipt(
    grantId: string,
    receipt: ExportReceipt,
  ): ReceiptAcceptance {
    exportReceiptSchema.parse(receipt);
    this.requireGrant(grantId, receipt);
    const replay = this.checkReceiptReplay(
      `export:${receipt.idempotencyKey}`,
      receipt.exportId,
      receipt,
    );
    if (replay) return replay;
    const knownTask = this.state.generationTaskReceipts.some(
      (item) => item.generationTaskId === receipt.generationTaskId,
    );
    if (!knownTask) {
      throw new ControlPlaneMockError(
        'RECEIPT_CONFLICT',
        'ExportReceipt 引用的任务尚未登记。',
        { generationTaskId: receipt.generationTaskId },
        true,
      );
    }
    this.state.exportReceipts.push(clone(receipt));
    this.rememberReceipt(
      `export:${receipt.idempotencyKey}`,
      receipt.exportId,
      receipt,
    );
    return {
      accepted: true,
      duplicate: false,
      status: 'accepted',
      resourceId: receipt.exportId,
      creditState: clone(this.state.commercial.creditState),
    };
  }

  runCanonicalSuccess() {
    const productionPackage =
      this.state.package ??
      this.createProjectProductionPackage({
        authorization: tenantDemoAuthorization,
        projectId: 'demo-local-001',
        capabilityIds: [
          CAPABILITY_IDS.baseGeneration,
          CAPABILITY_IDS.localLife,
        ],
        idempotencyKey: DEMO_PACKAGE_IDEMPOTENCY_KEY,
      });
    const grant = this.issueDemoProjectGrant({
      authorization: tenantDemoAuthorization,
      packageId: productionPackage.packageId,
      capabilityIds: [CAPABILITY_IDS.baseGeneration],
      idempotencyKey: `grant-current-success:${Date.now()}`,
    });

    const reservation = this.reserveGenerationTask({
      authorization: tenantDemoAuthorization,
      generationTaskId: DEMO_SUCCESS_TASK_ID,
      reservationId: DEMO_SUCCESS_RESERVATION_ID,
      capabilityId: CAPABILITY_IDS.baseGeneration,
      maxReservedCredits: 120,
      idempotencyKey: 'credit-reserve-demo-success-v1',
      occurredAt: '2026-07-30T00:05:00.000Z',
    });
    const taskReceipt = this.receiveGenerationTaskReceipt(
      grant.grantId,
      createCanonicalSuccessTaskReceipt(),
    );
    const assetReceipt = this.receiveAssetReceipt(
      grant.grantId,
      createCanonicalSuccessAssetReceipt(),
    );

    return {
      reservation,
      taskReceipt,
      assetReceipt,
      sourceChain: this.getSourceChain(DEMO_SUCCESS_TASK_ID),
    };
  }

  runCanonicalFailure() {
    const productionPackage =
      this.state.package ??
      this.createProjectProductionPackage({
        authorization: tenantDemoAuthorization,
        projectId: 'demo-local-001',
        capabilityIds: [
          CAPABILITY_IDS.baseGeneration,
          CAPABILITY_IDS.localLife,
        ],
        idempotencyKey: DEMO_PACKAGE_IDEMPOTENCY_KEY,
      });
    const grant = this.issueDemoProjectGrant({
      authorization: tenantDemoAuthorization,
      packageId: productionPackage.packageId,
      capabilityIds: [CAPABILITY_IDS.baseGeneration],
      idempotencyKey: `grant-current-failure:${Date.now()}`,
    });

    const reservation = this.reserveGenerationTask({
      authorization: tenantDemoAuthorization,
      generationTaskId: DEMO_FAILURE_TASK_ID,
      reservationId: DEMO_FAILURE_RESERVATION_ID,
      capabilityId: CAPABILITY_IDS.baseGeneration,
      maxReservedCredits: 80,
      idempotencyKey: 'credit-reserve-demo-failure-v1',
      occurredAt: '2026-07-30T00:06:00.000Z',
    });
    const taskReceipt = this.receiveGenerationTaskReceipt(
      grant.grantId,
      createCanonicalFailureTaskReceipt(),
    );

    return {
      reservation,
      taskReceipt,
      sourceChain: this.getSourceChain(DEMO_FAILURE_TASK_ID),
    };
  }

  getSourceChain(generationTaskId: string): SourceChain {
    if (!this.state.package) {
      throw new ControlPlaneMockError('PACKAGE_NOT_FOUND', '来源链缺少生产包。');
    }
    const taskReceipt = [...this.state.generationTaskReceipts]
      .reverse()
      .find((item) => item.generationTaskId === generationTaskId);
    if (!taskReceipt) {
      throw new ControlPlaneMockError(
        'PROJECT_NOT_FOUND',
        '来源链缺少任务回执。',
        { generationTaskId },
      );
    }
    const assetReceipt =
      this.state.assetReceipts.find(
        (item) => item.generationTaskId === generationTaskId,
      ) ?? null;
    const exportReceipt =
      this.state.exportReceipts.find(
        (item) => item.generationTaskId === generationTaskId,
      ) ?? null;
    const creditEntries = this.state.commercial.creditState.ledger.filter(
      (item) => item.referenceId === generationTaskId,
    );
    const creditReservation = this.state.commercial.creditState.reservations.find(
      (item) => item.taskId === generationTaskId,
    );
    if (!creditReservation) {
      throw new ControlPlaneMockError(
        'RESERVATION_NOT_FOUND',
        '来源链缺少额度冻结记录。',
        { generationTaskId },
      );
    }

    return {
      tenantId: this.state.package.tenantId,
      projectId: this.state.package.projectId,
      packageId: this.state.package.packageId,
      packageDigest: this.state.package.digest,
      claimIds: this.state.package.brandFactsSnapshot.map((claim) => claim.id),
      approvedScriptVersionId: this.state.package.approvedScriptVersion.id,
      shotId: taskReceipt.shotId,
      generationTaskReceipt: clone(taskReceipt),
      assetReceipt: clone(assetReceipt),
      exportReceipt: clone(exportReceipt),
      creditReservation: clone(creditReservation),
      rateCard: clone(this.state.commercial.rateCard),
      creditEntries: clone(creditEntries),
      truthManifest: clone(this.state.truthManifest),
    };
  }

  private requireGrant(
    grantId: string,
    resource: Pick<
      GenerationTaskReceipt | AssetReceipt | ExportReceipt,
      'tenantId' | 'projectId'
    >,
  ) {
    const grant = this.state.grants.find((item) => item.grantId === grantId);
    if (!grant) {
      throw new ControlPlaneMockError(
        'ACTION_SCOPE_DENIED',
        '找不到有效的 DemoProjectGrant。',
        { grantId },
      );
    }
    if (
      grant.tenantId !== resource.tenantId ||
      grant.projectId !== resource.projectId
    ) {
      throw new ControlPlaneMockError(
        'TENANT_SCOPE_MISMATCH',
        'Receipt tenant/project 不能覆盖 Grant 范围。',
        {
          grantTenantId: grant.tenantId,
          receiptTenantId: resource.tenantId,
          grantProjectId: grant.projectId,
          receiptProjectId: resource.projectId,
        },
      );
    }
    return grant;
  }

  private checkReceiptReplay(
    recordKey: string,
    resourceId: string,
    payload: GenerationTaskReceipt | AssetReceipt | ExportReceipt,
  ): ReceiptAcceptance | null {
    const record = this.receiptRecords.get(recordKey);
    if (!record) return null;
    if (record.payloadDigest !== digestValue(payload)) {
      throw new ControlPlaneMockError(
        'IDEMPOTENCY_CONFLICT',
        '同一回执幂等键不能携带不同 payload。',
        { idempotencyKey: recordKey },
      );
    }
    return {
      accepted: true,
      duplicate: true,
      status: 'duplicate',
      resourceId,
      creditState: clone(this.state.commercial.creditState),
    };
  }

  private rememberReceipt(
    recordKey: string,
    resourceId: string,
    payload: GenerationTaskReceipt | AssetReceipt | ExportReceipt,
  ) {
    this.receiptRecords.set(recordKey, {
      payloadDigest: digestValue(payload),
      resourceId,
    });
  }

  private maybeSettleSuccess(generationTaskId: string) {
    const success = [...this.state.generationTaskReceipts]
      .reverse()
      .find(
        (item) =>
          item.generationTaskId === generationTaskId &&
          item.status === 'succeeded',
      );
    if (!success || !success.actualCredits) return;
    const deliverable = this.state.assetReceipts.find(
      (asset) =>
        asset.generationTaskId === generationTaskId &&
        success.outputAssetIds.includes(asset.assetId) &&
        ['registered', 'approved'].includes(asset.reviewStatus),
    );
    if (!deliverable) return;

    try {
      const transition = applyCreditCommand(
        this.state.commercial.creditState,
        {
          type: 'settle_success',
          taskId: generationTaskId,
          reservationId: success.reservationReference,
          actualCredits: success.actualCredits.value,
          idempotencyKey: `credit-settle-success:${success.idempotencyKey}`,
          occurredAt: deliverable.createdAt,
        },
      );
      this.state.commercial.creditState = transition.state;
    } catch (error) {
      throw this.mapCreditError(error);
    }
  }

  private settleFailure(receipt: GenerationTaskReceipt) {
    if (receipt.outputAssetIds.length > 0) {
      throw new ControlPlaneMockError(
        'RECEIPT_CONFLICT',
        '失败任务不能携带伪输出资产。',
        { generationTaskId: receipt.generationTaskId },
      );
    }
    try {
      const transition = applyCreditCommand(
        this.state.commercial.creditState,
        {
          type: 'settle_failure',
          taskId: receipt.generationTaskId,
          reservationId: receipt.reservationReference,
          idempotencyKey: `credit-settle-failure:${receipt.idempotencyKey}`,
          occurredAt: receipt.completedAt ?? receipt.createdAt,
        },
      );
      this.state.commercial.creditState = transition.state;
    } catch (error) {
      throw this.mapCreditError(error);
    }
  }

  private mapCreditError(error: unknown): ControlPlaneMockError {
    if (error instanceof CreditStateError) {
      return new ControlPlaneMockError(
        error.code,
        error.message,
        error.details,
      );
    }
    return new ControlPlaneMockError(
      'CONTRACT_VALIDATION_FAILED',
      error instanceof Error ? error.message : '额度状态推进失败。',
    );
  }
}

export const controlPlaneMockAdapter = new ControlPlaneMockAdapter(
  () => loadWorkspace() ?? cloneDemoWorkspace(),
);
