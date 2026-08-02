import { create } from 'zustand';
import type {
  ActiveOrganizationContext,
  ControlPlaneDemoState,
  ControlPlaneBootstrapResult,
  ControlPlaneErrorShape,
  DemoProjectGrant,
  ProjectProductionPackage,
  ReceiptSyncResult,
  ScriptApproval,
  SourceChain,
  StoryCanvasHandoffState,
} from '../domain/controlPlane';
import {
  applyPhase1CreditCommand,
  createPhase1ControlPlaneProjection,
  isPhase1ControlPlaneProjection,
  projectCanonicalReceipts,
  projectPhase1Asset,
  projectPhase1Attempt,
  projectPhase1Export,
  projectPhase1RoughCut,
  projectPhase1Task,
  recordPhase1Handoff,
  selectPhase1Attempt,
  type Phase1ControlPlaneProjection,
  type Phase1CreditCommand,
  type Phase1ExportArtifact,
  type Phase1MediaAsset,
  type Phase1RoughCut,
  type Phase1RuntimeTask,
  type Phase1ShotAttempt,
} from '../domain/phase1Production';
import {
  CAPABILITY_IDS,
  createCanonicalFailureTaskReceipt,
  createCanonicalSuccessAssetReceipt,
  createCanonicalSuccessTaskReceipt,
  DEMO_FAILURE_RESERVATION_ID,
  DEMO_FAILURE_TASK_ID,
  DEMO_PACKAGE_IDEMPOTENCY_KEY,
  DEMO_SUCCESS_RESERVATION_ID,
  DEMO_SUCCESS_TASK_ID,
  DEMO_TENANT_ORGANIZATION_ID,
} from '../mocks/controlPlaneDemo';
import {
  ControlPlaneMockError,
  controlPlaneMockAdapter,
  tenantDemoAuthorization,
} from '../services/controlPlaneMockAdapter';
import {
  storyCanvasBridge,
  type SendPackageResult as BridgeSendPackageResult,
} from '../services/storyCanvasBridge';
import { CanonicalRouteError } from '../services/canonicalRouteGuard';
import {
  loadActiveOrganizationId,
  resolveActiveOrganization,
  saveActiveOrganizationId,
} from '../services/activeOrganization';

const PHASE1_STORAGE_KEY = 'videoagent:control-plane:phase1:v1';

function loadPhase1Projection(): Phase1ControlPlaneProjection {
  if (typeof window === 'undefined') return createPhase1ControlPlaneProjection();
  try {
    const raw = window.localStorage.getItem(PHASE1_STORAGE_KEY);
    if (!raw) return createPhase1ControlPlaneProjection();
    const parsed: unknown = JSON.parse(raw);
    return isPhase1ControlPlaneProjection(parsed)
      ? parsed
      : createPhase1ControlPlaneProjection();
  } catch {
    return createPhase1ControlPlaneProjection();
  }
}

function savePhase1Projection(projection: Phase1ControlPlaneProjection) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(PHASE1_STORAGE_KEY, JSON.stringify(projection));
  }
}

interface ControlPlaneStoreState {
  snapshot: ControlPlaneDemoState;
  phase1Projection: Phase1ControlPlaneProjection;
  loading: boolean;
  error: ControlPlaneErrorShape | null;
  lastAction: string | null;
  lastSourceChain: SourceChain | null;
  bootstrapResult: ControlPlaneBootstrapResult;
  lastPackageDispatch: BridgeSendPackageResult | null;
  lastReceiptSync: ReceiptSyncResult | null;
  handoffState: StoryCanvasHandoffState;
  activeOrganization: ActiveOrganizationContext | null;
  upsertPhase1Task: (task: Phase1RuntimeTask) => void;
  upsertPhase1Attempt: (attempt: Phase1ShotAttempt) => void;
  upsertPhase1Asset: (asset: Phase1MediaAsset) => void;
  selectPhase1Attempt: (attemptId: string) => void;
  upsertPhase1RoughCut: (roughCut: Phase1RoughCut) => void;
  upsertPhase1Export: (artifact: Phase1ExportArtifact) => void;
  applyPhase1Credit: (command: Phase1CreditCommand) => boolean;
  refresh: () => void;
  bootstrap: () => ControlPlaneBootstrapResult;
  configureStoryCanvasBaseUrl: (baseUrl: string) => void;
  switchActiveOrganization: (
    organizationId: string,
  ) => ActiveOrganizationContext | null;
  issueCurrentGrant: () => void;
  dispatchCanonicalPackage: () => Promise<BridgeSendPackageResult | null>;
  retryCanonicalPackage: () => Promise<BridgeSendPackageResult | null>;
  syncStoryCanvasReceipts: () => Promise<ReceiptSyncResult | null>;
  openStoryCanvas: () => StoryCanvasHandoffState | null;
  clearStoryCanvasHandoff: () => void;
  createCanonicalPackage: () => void;
  issueCanonicalGrant: () => void;
  reserveCanonicalSuccess: () => void;
  acceptCanonicalSuccessTaskReceipt: () => void;
  acceptCanonicalSuccessAssetReceipt: () => void;
  reserveCanonicalFailure: () => void;
  acceptCanonicalFailureTaskReceipt: () => void;
  runCanonicalSuccess: () => void;
  runCanonicalFailure: () => void;
  approveCanonicalScript: (
    approvedBy?: string,
    approvedAt?: string,
  ) => ScriptApproval | null;
  revokeCanonicalScript: (
    revokedBy?: string,
    revokedAt?: string,
  ) => ScriptApproval | null;
  blockCanonicalScript: (
    reason: string,
    factRiskIds: string[],
    blockedBy?: string,
    blockedAt?: string,
  ) => ScriptApproval | null;
  resetDemoReady: () => Promise<void>;
  setResetPending: () => void;
  applyResetSnapshot: (snapshot: ControlPlaneDemoState) => void;
  applyResetFailure: (
    snapshot: ControlPlaneDemoState,
    error: ControlPlaneErrorShape,
  ) => void;
  clearError: () => void;
}

function toErrorShape(error: unknown): ControlPlaneErrorShape {
  if (error instanceof ControlPlaneMockError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      details: error.details,
    };
  }
  if (error instanceof CanonicalRouteError) {
    return {
      code: error.code,
      message: error.message,
      retryable: false,
      details: error.details,
    };
  }
  return {
    code: 'CONTRACT_VALIDATION_FAILED',
    message: error instanceof Error ? error.message : '控制平面 Demo 操作失败。',
    retryable: false,
    details: {},
  };
}

export const useControlPlaneStore = create<ControlPlaneStoreState>((set, get) => {
  const initialSnapshot = controlPlaneMockAdapter.getState();
  const storedOrganizationId = loadActiveOrganizationId();
  let initialActiveOrganization: ActiveOrganizationContext | null = null;
  let initialOrganizationError: ControlPlaneErrorShape | null = null;
  try {
    initialActiveOrganization = resolveActiveOrganization(
      initialSnapshot,
      storedOrganizationId ?? DEMO_TENANT_ORGANIZATION_ID,
    );
    if (storedOrganizationId === null) {
      saveActiveOrganizationId(
        initialActiveOrganization.activeOrganizationId,
      );
    }
  } catch (error) {
    initialOrganizationError = toErrorShape(error);
  }

  const requireProductionContext = () => {
    const active = get().activeOrganization;
    if (!active?.menuContext.canExecuteProduction) {
      throw new ControlPlaneMockError(
        'ACTION_SCOPE_DENIED',
        '当前 activeOrganization 没有 tenant/project 生产执行上下文。',
        {
          activeOrganizationId:
            active?.activeOrganizationId ?? 'unresolved',
        },
      );
    }
  };

  const issueCurrentGrant = () => {
    requireProductionContext();
    const snapshot = controlPlaneMockAdapter.getState();
    if (!snapshot.package) {
      throw new ControlPlaneMockError(
        'PACKAGE_NOT_FOUND',
        '签发 current grant 前必须存在 production package。',
      );
    }
    return controlPlaneMockAdapter.issueDemoProjectGrant({
      authorization: tenantDemoAuthorization,
      packageId: snapshot.package.packageId,
      capabilityIds: [CAPABILITY_IDS.baseGeneration],
      idempotencyKey: `grant-current:${Date.now()}`,
    });
  };

  storyCanvasBridge.subscribe((_transport, handoffState) => {
    set({
      snapshot: controlPlaneMockAdapter.getState(),
      handoffState,
      bootstrapResult: storyCanvasBridge.bootstrap(),
    });
  });

  const run = (actionName: string, action: () => SourceChain | null = () => null) => {
    set({ loading: true, error: null, lastAction: actionName });
    try {
      const sourceChain = action();
      set({
        snapshot: controlPlaneMockAdapter.getState(),
        loading: false,
        error: null,
        lastAction: actionName,
        lastSourceChain: sourceChain,
      });
    } catch (error) {
      set({
        loading: false,
        error: toErrorShape(error),
        lastAction: actionName,
      });
    }
  };

  const updatePhase1 = (
    actionName: string,
    update: (current: Phase1ControlPlaneProjection) => Phase1ControlPlaneProjection,
  ) => {
    try {
      const phase1Projection = update(get().phase1Projection);
      savePhase1Projection(phase1Projection);
      set({ phase1Projection, error: null, lastAction: actionName });
      return true;
    } catch (error) {
      set({ error: toErrorShape(error), lastAction: `${actionName}:rejected` });
      return false;
    }
  };

  return {
    snapshot: initialSnapshot,
    phase1Projection: loadPhase1Projection(),
    loading: false,
    error: initialOrganizationError,
    lastAction: null,
    lastSourceChain: null,
    bootstrapResult: storyCanvasBridge.bootstrap(),
    lastPackageDispatch: null,
    lastReceiptSync: null,
    handoffState: storyCanvasBridge.getHandoffState(),
    activeOrganization: initialActiveOrganization,

    upsertPhase1Task: (task) =>
      void updatePhase1('upsertPhase1Task', (current) => projectPhase1Task(current, task)),
    upsertPhase1Attempt: (attempt) =>
      void updatePhase1('upsertPhase1Attempt', (current) =>
        projectPhase1Attempt(current, attempt),
      ),
    upsertPhase1Asset: (asset) =>
      void updatePhase1('upsertPhase1Asset', (current) => projectPhase1Asset(current, asset)),
    selectPhase1Attempt: (attemptId) =>
      void updatePhase1('selectPhase1Attempt', (current) =>
        selectPhase1Attempt(current, attemptId),
      ),
    upsertPhase1RoughCut: (roughCut) =>
      void updatePhase1('upsertPhase1RoughCut', (current) =>
        projectPhase1RoughCut(current, roughCut),
      ),
    upsertPhase1Export: (artifact) =>
      void updatePhase1('upsertPhase1Export', (current) =>
        projectPhase1Export(current, artifact),
      ),
    applyPhase1Credit: (command) => {
      let duplicate = false;
      const accepted = updatePhase1('applyPhase1Credit', (current) => {
        const result = applyPhase1CreditCommand(current, command);
        duplicate = result.duplicate;
        return result.state;
      });
      return accepted && duplicate;
    },

    refresh: () => run('refresh'),

    bootstrap: () => {
      const result = storyCanvasBridge.bootstrap();
      set({
        snapshot: result.snapshot,
        bootstrapResult: result,
        error:
          result.status === 'error' && result.error
            ? {
                code: 'TRANSPORT_OFFLINE',
                message: result.error.message,
                retryable: result.retryable,
                details: result.error.details,
              }
            : null,
        lastAction: 'bootstrap',
      });
      return result;
    },

    configureStoryCanvasBaseUrl: (baseUrl) => {
      storyCanvasBridge.configureBaseUrl(baseUrl);
      const bootstrapResult = storyCanvasBridge.bootstrap();
      set({
        snapshot: controlPlaneMockAdapter.getState(),
        bootstrapResult,
        lastPackageDispatch: null,
        lastReceiptSync: null,
        error: null,
        lastAction: 'configureStoryCanvasBaseUrl',
      });
    },

    switchActiveOrganization: (organizationId) => {
      try {
        const activeOrganization = resolveActiveOrganization(
          controlPlaneMockAdapter.getState(),
          organizationId,
        );
        saveActiveOrganizationId(organizationId);
        set({
          activeOrganization,
          error: null,
          lastAction: 'switchActiveOrganization',
        });
        return activeOrganization;
      } catch (error) {
        set({
          error: toErrorShape(error),
          lastAction: 'switchActiveOrganization:rejected',
        });
        return null;
      }
    },

    issueCurrentGrant: () =>
      run('issueCurrentGrant', () => {
        issueCurrentGrant();
        return null;
      }),

    dispatchCanonicalPackage: async () => {
      set({
        loading: true,
        error: null,
        lastAction: 'dispatchCanonicalPackage',
      });
      let productionPackage: ProjectProductionPackage | null = null;
      let grant: DemoProjectGrant | null = null;
      try {
        requireProductionContext();
        const snapshot = controlPlaneMockAdapter.getState();
        productionPackage =
          snapshot.package ??
          controlPlaneMockAdapter.createProjectProductionPackage({
            authorization: tenantDemoAuthorization,
            projectId: 'demo-local-001',
            capabilityIds: [
              CAPABILITY_IDS.baseGeneration,
              CAPABILITY_IDS.localLife,
            ],
            idempotencyKey: DEMO_PACKAGE_IDEMPOTENCY_KEY,
          });
        grant = issueCurrentGrant();
        const result = await storyCanvasBridge.sendPackage(
          productionPackage,
          grant,
        );
        const bootstrapResult = storyCanvasBridge.bootstrap();
        const phase1Projection = recordPhase1Handoff(get().phase1Projection, {
          productionPackage,
          grant,
          response: result.response,
          error: result.transport.lastError
            ? {
                ...result.transport.lastError,
                details: result.transport.lastError.details,
              }
            : null,
        });
        savePhase1Projection(phase1Projection);
        set({
          snapshot: controlPlaneMockAdapter.getState(),
          loading: false,
          lastPackageDispatch: result,
          bootstrapResult,
          phase1Projection,
          error:
            result.transport.phase === 'error' ||
            result.transport.phase === 'rejected'
              ? {
                  code: 'TRANSPORT_REJECTED',
                  message:
                    result.transport.lastError?.message ??
                    'StoryCanvas 发包失败。',
                  retryable:
                    result.transport.lastError?.retryable ?? true,
                  details: result.transport.lastError?.details ?? {},
                }
              : null,
        });
        return result;
      } catch (error) {
        const errorShape = toErrorShape(error);
        const phase1Projection = productionPackage
          ? recordPhase1Handoff(get().phase1Projection, {
              productionPackage,
              grant,
              response: null,
              error: errorShape,
            })
          : get().phase1Projection;
        savePhase1Projection(phase1Projection);
        set({
          snapshot: controlPlaneMockAdapter.getState(),
          loading: false,
          error: errorShape,
          phase1Projection,
        });
        return null;
      }
    },

    retryCanonicalPackage: async () => {
      set({
        loading: true,
        error: null,
        lastAction: 'retryCanonicalPackage',
      });
      let productionPackage: ProjectProductionPackage | null = null;
      let grant: DemoProjectGrant | null = null;
      try {
        requireProductionContext();
        const snapshot = controlPlaneMockAdapter.getState();
        productionPackage = snapshot.package;
        if (!productionPackage) {
          throw new Error('重试前必须存在同一 package。');
        }
        grant = issueCurrentGrant();
        const result = await storyCanvasBridge.retryPackage(
          productionPackage,
          grant,
        );
        const bootstrapResult = storyCanvasBridge.bootstrap();
        const phase1Projection = recordPhase1Handoff(get().phase1Projection, {
          productionPackage,
          grant,
          response: result.response,
          error: result.transport.lastError
            ? { ...result.transport.lastError, details: result.transport.lastError.details }
            : null,
        });
        savePhase1Projection(phase1Projection);
        set({
          snapshot: controlPlaneMockAdapter.getState(),
          loading: false,
          lastPackageDispatch: result,
          bootstrapResult,
          phase1Projection,
          error:
            result.transport.phase === 'error' ||
            result.transport.phase === 'rejected'
              ? {
                  code: 'TRANSPORT_REJECTED',
                  message:
                    result.transport.lastError?.message ??
                    'StoryCanvas 重试发包失败。',
                  retryable:
                    result.transport.lastError?.retryable ?? true,
                  details: result.transport.lastError?.details ?? {},
                }
              : null,
        });
        return result;
      } catch (error) {
        const errorShape = toErrorShape(error);
        const phase1Projection = productionPackage
          ? recordPhase1Handoff(get().phase1Projection, {
              productionPackage,
              grant,
              response: null,
              error: errorShape,
            })
          : get().phase1Projection;
        savePhase1Projection(phase1Projection);
        set({ loading: false, error: errorShape, phase1Projection });
        return null;
      }
    },

    syncStoryCanvasReceipts: async () => {
      set({
        loading: true,
        error: null,
        lastAction: 'syncStoryCanvasReceipts',
      });
      try {
        requireProductionContext();
        const snapshot = controlPlaneMockAdapter.getState();
        if (!snapshot.package) {
          throw new Error('同步回执前必须完成发包。');
        }
        const grant = issueCurrentGrant();
        const result = await storyCanvasBridge.pollPendingReceipts(
          snapshot.package,
          grant,
        );
        const bootstrapResult = storyCanvasBridge.bootstrap();
        const refreshedSnapshot = controlPlaneMockAdapter.getState();
        const phase1Projection = projectCanonicalReceipts(get().phase1Projection, {
          tasks: refreshedSnapshot.generationTaskReceipts,
          assets: refreshedSnapshot.assetReceipts,
          exports: refreshedSnapshot.exportReceipts,
        });
        savePhase1Projection(phase1Projection);
        set({
          snapshot: refreshedSnapshot,
          phase1Projection,
          loading: false,
          lastReceiptSync: result,
          bootstrapResult,
          error:
            result.transport.phase === 'error'
              ? {
                  code: 'TRANSPORT_OFFLINE',
                  message:
                    result.transport.lastError?.message ??
                    'StoryCanvas 回执同步失败。',
                  retryable: true,
                  details: result.transport.lastError?.details ?? {},
                }
              : null,
        });
        return result;
      } catch (error) {
        set({ loading: false, error: toErrorShape(error) });
        return null;
      }
    },

    openStoryCanvas: () => {
      try {
        requireProductionContext();
        const snapshot = controlPlaneMockAdapter.getState();
        if (!snapshot.package || !snapshot.grants[0]) {
          throw new ControlPlaneMockError(
            'PACKAGE_NOT_FOUND',
            '打开 StoryCanvas 前必须存在 accepted package 与 current grant。',
          );
        }
        const handoffState = storyCanvasBridge.openCanvasWithGrant(
          snapshot.package,
          snapshot.grants[0],
        );
        set({
          handoffState,
          snapshot: controlPlaneMockAdapter.getState(),
          error: handoffState.error
            ? {
                code: 'TRANSPORT_REJECTED',
                message: handoffState.error.message,
                retryable: handoffState.error.retryable,
                details: handoffState.error.details,
              }
            : null,
          lastAction: 'openStoryCanvas',
        });
        return handoffState;
      } catch (error) {
        set({
          error: toErrorShape(error),
          lastAction: 'openStoryCanvas:rejected',
        });
        return null;
      }
    },

    clearStoryCanvasHandoff: () => {
      const handoffState = storyCanvasBridge.clearHandoff();
      set({
        handoffState,
        snapshot: controlPlaneMockAdapter.getState(),
        lastAction: 'clearStoryCanvasHandoff',
      });
    },

    createCanonicalPackage: () =>
      run('createCanonicalPackage', () => {
        requireProductionContext();
        controlPlaneMockAdapter.createProjectProductionPackage({
          authorization: tenantDemoAuthorization,
          projectId: 'demo-local-001',
          capabilityIds: [
            CAPABILITY_IDS.baseGeneration,
            CAPABILITY_IDS.localLife,
          ],
          idempotencyKey: DEMO_PACKAGE_IDEMPOTENCY_KEY,
        });
        return null;
      }),

    issueCanonicalGrant: () =>
      run('issueCanonicalGrant', () => {
        issueCurrentGrant();
        return null;
      }),

    reserveCanonicalSuccess: () =>
      run('reserveCanonicalSuccess', () => {
        requireProductionContext();
        controlPlaneMockAdapter.reserveGenerationTask({
          authorization: tenantDemoAuthorization,
          generationTaskId: DEMO_SUCCESS_TASK_ID,
          reservationId: DEMO_SUCCESS_RESERVATION_ID,
          capabilityId: CAPABILITY_IDS.baseGeneration,
          maxReservedCredits: 120,
          idempotencyKey: 'credit-reserve-demo-success-v1',
          occurredAt: '2026-07-30T00:05:00.000Z',
        });
        return null;
      }),

    acceptCanonicalSuccessTaskReceipt: () =>
      run('acceptCanonicalSuccessTaskReceipt', () => {
        requireProductionContext();
        const grant = controlPlaneMockAdapter.getState().grants[0];
        if (!grant) throw new Error('请先签发 DemoProjectGrant。');
        controlPlaneMockAdapter.receiveGenerationTaskReceipt(
          grant.grantId,
          createCanonicalSuccessTaskReceipt(),
        );
        return null;
      }),

    acceptCanonicalSuccessAssetReceipt: () =>
      run('acceptCanonicalSuccessAssetReceipt', () => {
        requireProductionContext();
        const grant = controlPlaneMockAdapter.getState().grants[0];
        if (!grant) throw new Error('请先签发 DemoProjectGrant。');
        controlPlaneMockAdapter.receiveAssetReceipt(
          grant.grantId,
          createCanonicalSuccessAssetReceipt(),
        );
        return controlPlaneMockAdapter.getSourceChain(DEMO_SUCCESS_TASK_ID);
      }),

    reserveCanonicalFailure: () =>
      run('reserveCanonicalFailure', () => {
        requireProductionContext();
        controlPlaneMockAdapter.reserveGenerationTask({
          authorization: tenantDemoAuthorization,
          generationTaskId: DEMO_FAILURE_TASK_ID,
          reservationId: DEMO_FAILURE_RESERVATION_ID,
          capabilityId: CAPABILITY_IDS.baseGeneration,
          maxReservedCredits: 80,
          idempotencyKey: 'credit-reserve-demo-failure-v1',
          occurredAt: '2026-07-30T00:06:00.000Z',
        });
        return null;
      }),

    acceptCanonicalFailureTaskReceipt: () =>
      run('acceptCanonicalFailureTaskReceipt', () => {
        requireProductionContext();
        const grant = controlPlaneMockAdapter.getState().grants[0];
        if (!grant) throw new Error('请先签发 DemoProjectGrant。');
        controlPlaneMockAdapter.receiveGenerationTaskReceipt(
          grant.grantId,
          createCanonicalFailureTaskReceipt(),
        );
        return controlPlaneMockAdapter.getSourceChain(DEMO_FAILURE_TASK_ID);
      }),

    runCanonicalSuccess: () =>
      run(
        'runCanonicalSuccess',
        () => {
          requireProductionContext();
          return controlPlaneMockAdapter.runCanonicalSuccess().sourceChain;
        },
      ),

    runCanonicalFailure: () =>
      run(
        'runCanonicalFailure',
        () => {
          requireProductionContext();
          return controlPlaneMockAdapter.runCanonicalFailure().sourceChain;
        },
      ),

    approveCanonicalScript: (
      approvedBy = 'principal-demo-owner',
      approvedAt = new Date().toISOString(),
    ) => {
      let result: ScriptApproval | null = null;
      run('approveCanonicalScript', () => {
        result = controlPlaneMockAdapter.approveScript({
          scriptVersionId: 'script-a',
          approvedBy,
          approvedAt,
          unresolvedFactRiskIds: [],
        });
        return null;
      });
      return result;
    },

    revokeCanonicalScript: (
      revokedBy = 'principal-demo-owner',
      revokedAt = new Date().toISOString(),
    ) => {
      let result: ScriptApproval | null = null;
      run('revokeCanonicalScript', () => {
        result = controlPlaneMockAdapter.revokeScript({
          scriptVersionId: 'script-a',
          revokedBy,
          revokedAt,
        });
        return null;
      });
      return result;
    },

    blockCanonicalScript: (
      reason,
      factRiskIds,
      blockedBy = 'principal-demo-owner',
      blockedAt = new Date().toISOString(),
    ) => {
      let result: ScriptApproval | null = null;
      run('blockCanonicalScript', () => {
        result = controlPlaneMockAdapter.blockScript({
          scriptVersionId: 'script-a',
          blockedBy,
          blockedAt,
          reason,
          factRiskIds,
        });
        return null;
      });
      return result;
    },

    resetDemoReady: async () => {
      const { resetDemoExperience } = await import('./demoExperienceStore');
      await resetDemoExperience();
    },

    setResetPending: () =>
      set({
        loading: true,
        error: null,
        lastAction: 'resetDemoExperience',
      }),

    applyResetSnapshot: (snapshot) => {
      try {
        const phase1Projection = createPhase1ControlPlaneProjection();
        savePhase1Projection(phase1Projection);
        const organizationId =
          get().activeOrganization?.activeOrganizationId ??
          loadActiveOrganizationId() ??
          DEMO_TENANT_ORGANIZATION_ID;
        const activeOrganization = resolveActiveOrganization(
          snapshot,
          organizationId,
        );
        set({
          snapshot,
          activeOrganization,
          handoffState: storyCanvasBridge.getHandoffState(),
          loading: false,
          error: null,
          lastAction: 'resetDemoExperience',
          lastSourceChain: null,
        });
      } catch (error) {
        const phase1Projection = createPhase1ControlPlaneProjection();
        savePhase1Projection(phase1Projection);
        set({
          snapshot,
          phase1Projection,
          activeOrganization: null,
          handoffState: storyCanvasBridge.getHandoffState(),
          loading: false,
          error: toErrorShape(error),
          lastAction: 'resetDemoExperience:organization-rejected',
          lastSourceChain: null,
        });
      }
    },

    applyResetFailure: (snapshot, error) =>
      set({
        snapshot,
        loading: false,
        error,
        lastAction: 'resetDemoExperience:failed',
      }),

    clearError: () => set({ error: null }),
  };
});
