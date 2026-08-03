import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ProjectProductionPackage,
  ReceiptSyncResult,
  StandardReceiptError,
  StoryCanvasTransportState,
} from '../domain/controlPlane';
import { selectTenantProjectDeliveryView } from '../domain/controlPlaneDeliveryView';
import {
  CAPABILITY_IDS,
  DEMO_PACKAGE_IDEMPOTENCY_KEY,
  DEMO_SUCCESS_RESERVATION_ID,
  DEMO_SUCCESS_TASK_ID,
  DEMO_TENANT_ID,
  DEMO_TENANT_ORGANIZATION_ID,
  createCanonicalSuccessAssetReceipt,
  createCanonicalSuccessTaskReceipt,
} from '../mocks/controlPlaneDemo';
import { cloneDemoWorkspace } from '../mocks/demoWorkspace';
import { resolveActiveOrganization } from '../services/activeOrganization';
import {
  controlPlaneMockAdapter,
  tenantDemoAuthorization,
} from '../services/controlPlaneMockAdapter';
import { storyCanvasBridge, type SendPackageResult } from '../services/storyCanvasBridge';
import { useControlPlaneStore } from './controlPlaneStore';

const TEST_NOW = new Date('2026-08-03T12:00:00.000Z');
const PROJECT_ID = 'demo-local-001';

function resetStore() {
  controlPlaneMockAdapter.resetDemoReady(cloneDemoWorkspace());
  storyCanvasBridge.resetOffline();
  const snapshot = controlPlaneMockAdapter.getState();
  useControlPlaneStore.setState({
    snapshot,
    loading: false,
    error: null,
    lastAction: null,
    lastSourceChain: null,
    bootstrapResult: storyCanvasBridge.bootstrap(),
    lastPackageDispatch: null,
    lastReceiptSync: null,
    handoffState: storyCanvasBridge.getHandoffState(),
    activeOrganization: resolveActiveOrganization(snapshot, DEMO_TENANT_ORGANIZATION_ID),
  });
}

function createPackage() {
  return controlPlaneMockAdapter.createProjectProductionPackage({
    authorization: tenantDemoAuthorization,
    projectId: PROJECT_ID,
    capabilityIds: [CAPABILITY_IDS.baseGeneration, CAPABILITY_IDS.localLife],
    idempotencyKey: DEMO_PACKAGE_IDEMPOTENCY_KEY,
  });
}

function reserveSuccess() {
  return controlPlaneMockAdapter.reserveGenerationTask({
    authorization: tenantDemoAuthorization,
    generationTaskId: DEMO_SUCCESS_TASK_ID,
    reservationId: DEMO_SUCCESS_RESERVATION_ID,
    capabilityId: CAPABILITY_IDS.baseGeneration,
    maxReservedCredits: 120,
    idempotencyKey: 'credit-reserve-demo-success-v1',
    occurredAt: '2026-07-30T00:05:00.000Z',
  });
}

function createTransport(
  productionPackage: ProjectProductionPackage,
  phase: StoryCanvasTransportState['phase'],
  options: {
    connected?: boolean;
    retryCount?: number;
    error?: StandardReceiptError | null;
  } = {},
): StoryCanvasTransportState {
  return {
    ...storyCanvasBridge.getState(),
    phase,
    connected: options.connected ?? (phase === 'accepted' || phase === 'duplicate'),
    retryCount: options.retryCount ?? 0,
    lastAttemptAt: '2026-08-03T11:59:00.000Z',
    lastConnectedAt:
      (options.connected ?? (phase === 'accepted' || phase === 'duplicate'))
        ? '2026-08-03T11:59:01.000Z'
        : null,
    deepLink:
      phase === 'accepted' || phase === 'duplicate'
        ? `http://localhost:50188/project/${productionPackage.projectId}`
        : null,
    packageId: productionPackage.packageId,
    projectId: productionPackage.projectId,
    lastError: options.error ?? null,
  };
}

function acceptedDispatchResult(
  productionPackage: ProjectProductionPackage,
  result: 'accepted' | 'duplicate' = 'accepted',
): SendPackageResult {
  const transport = storyCanvasBridge.restoreState(createTransport(productionPackage, result));
  return {
    response: {
      status: 'accepted',
      result,
      packageId: productionPackage.packageId,
      projectId: productionPackage.projectId,
      duplicate: result === 'duplicate',
      deepLink: transport.deepLink,
      acceptedAt: '2026-08-03T11:59:01.000Z',
    },
    transport,
  };
}

function rejectedDispatchResult(productionPackage: ProjectProductionPackage): SendPackageResult {
  const error: StandardReceiptError = {
    code: 'STORYCANVAS_PACKAGE_REJECTED',
    message: 'StoryCanvas 拒绝了当前生产包。',
    retryable: false,
    details: { reason: 'contract_mismatch' },
  };
  const transport = storyCanvasBridge.restoreState(
    createTransport(productionPackage, 'rejected', {
      connected: true,
      error,
    }),
  );
  return {
    response: {
      status: 'rejected',
      result: 'rejected',
      packageId: productionPackage.packageId,
      projectId: productionPackage.projectId,
      duplicate: false,
      deepLink: null,
      error,
    },
    transport,
  };
}

function prepareAcceptedPackage() {
  const productionPackage = createPackage();
  storyCanvasBridge.restoreState(
    createTransport(productionPackage, 'accepted', { connected: true }),
  );
  useControlPlaneStore.setState({
    snapshot: controlPlaneMockAdapter.getState(),
    bootstrapResult: storyCanvasBridge.bootstrap(),
  });
  return productionPackage;
}

function getSuccessReservation() {
  const reservation = controlPlaneMockAdapter
    .getState()
    .commercial.creditState.reservations.find(
      (item) => item.reservationId === DEMO_SUCCESS_RESERVATION_ID,
    );
  expect(reservation).toBeDefined();
  return reservation!;
}

describe('controlPlaneStore delivery synchronization', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(TEST_NOW);
    resetStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('stores an accepted package dispatch and refreshes the canonical snapshot', async () => {
    const sendPackage = vi
      .spyOn(storyCanvasBridge, 'sendPackage')
      .mockImplementation(async (productionPackage) => acceptedDispatchResult(productionPackage));

    const result = await useControlPlaneStore.getState().dispatchCanonicalPackage();
    const state = useControlPlaneStore.getState();

    expect(result?.response).toMatchObject({
      status: 'accepted',
      result: 'accepted',
      duplicate: false,
    });
    expect(sendPackage).toHaveBeenCalledTimes(1);
    expect(sendPackage.mock.calls[0][0]).toEqual(state.snapshot.package);
    expect(sendPackage.mock.calls[0][1]).toEqual(state.snapshot.grants[0]);
    expect(state).toMatchObject({
      loading: false,
      error: null,
      lastAction: 'dispatchCanonicalPackage',
      lastPackageDispatch: result,
    });
    expect(state.snapshot.package).not.toBeNull();
    expect(state.snapshot.grants).toHaveLength(1);
    expect(state.bootstrapResult.status).toBe('ready');
  });

  it('retains a rejected dispatch result and maps its transport error safely', async () => {
    vi.spyOn(storyCanvasBridge, 'sendPackage').mockImplementation(async (productionPackage) =>
      rejectedDispatchResult(productionPackage),
    );

    const result = await useControlPlaneStore.getState().dispatchCanonicalPackage();
    const state = useControlPlaneStore.getState();

    expect(result?.response?.status).toBe('rejected');
    expect(state.lastPackageDispatch).toEqual(result);
    expect(state.error).toEqual({
      code: 'TRANSPORT_REJECTED',
      message: 'StoryCanvas 拒绝了当前生产包。',
      retryable: false,
      details: { reason: 'contract_mismatch' },
    });
    expect(state.loading).toBe(false);
    expect(state.snapshot.package).not.toBeNull();
    expect(state.snapshot.grants).toHaveLength(1);
  });

  it('clears the previous rejection after a successful retry of the same package', async () => {
    vi.spyOn(storyCanvasBridge, 'sendPackage').mockImplementation(async (productionPackage) =>
      rejectedDispatchResult(productionPackage),
    );
    const retryPackage = vi
      .spyOn(storyCanvasBridge, 'retryPackage')
      .mockImplementation(async (productionPackage) => acceptedDispatchResult(productionPackage));

    await useControlPlaneStore.getState().dispatchCanonicalPackage();
    expect(useControlPlaneStore.getState().error?.code).toBe('TRANSPORT_REJECTED');
    const rejectedPackageId = useControlPlaneStore.getState().snapshot.package?.packageId;

    const result = await useControlPlaneStore.getState().retryCanonicalPackage();
    const state = useControlPlaneStore.getState();

    expect(retryPackage).toHaveBeenCalledTimes(1);
    expect(retryPackage.mock.calls[0][0].packageId).toBe(rejectedPackageId);
    expect(result?.response?.status).toBe('accepted');
    expect(state).toMatchObject({
      loading: false,
      error: null,
      lastAction: 'retryCanonicalPackage',
      lastPackageDispatch: result,
    });
    expect(state.bootstrapResult.status).toBe('ready');
  });

  it('preserves partial sync evidence and does not book an asset whose ACK failed', async () => {
    prepareAcceptedPackage();
    reserveSuccess();
    const taskReceipt = createCanonicalSuccessTaskReceipt();
    const ackError: StandardReceiptError = {
      code: 'ACK_FAILED',
      message: '资产回执 ACK 失败，可安全重试。',
      retryable: true,
      details: { receiptId: 'must-not-enter-safe-view' },
    };
    const pollPendingReceipts = vi
      .spyOn(storyCanvasBridge, 'pollPendingReceipts')
      .mockImplementation(async (_productionPackage, grant) => {
        controlPlaneMockAdapter.receiveGenerationTaskReceipt(grant.grantId, taskReceipt);
        return {
          transport: storyCanvasBridge.getState(),
          items: [
            {
              receiptId: 'receipt-task-success',
              deliveryId: 'delivery-task-success',
              kind: 'generation-task',
              status: 'accepted',
              acked: true,
              error: null,
            },
            {
              receiptId: 'receipt-asset-ack-failed',
              deliveryId: 'delivery-asset-ack-failed',
              kind: 'asset',
              status: 'ack_error',
              acked: false,
              error: ackError,
            },
          ],
        } satisfies ReceiptSyncResult;
      });

    const result = await useControlPlaneStore.getState().syncStoryCanvasReceipts();
    const state = useControlPlaneStore.getState();
    const deliveryView = selectTenantProjectDeliveryView(state.snapshot, {
      tenantId: DEMO_TENANT_ID,
      projectId: PROJECT_ID,
      now: TEST_NOW.toISOString(),
      receiptSync: state.lastReceiptSync,
      error: state.error,
    });

    expect(pollPendingReceipts).toHaveBeenCalledTimes(1);
    expect(state.lastReceiptSync).toEqual(result);
    expect(state.error).toBeNull();
    expect(state.snapshot.generationTaskReceipts).toHaveLength(1);
    expect(state.snapshot.assetReceipts).toHaveLength(0);
    expect(getSuccessReservation()).toMatchObject({
      status: 'reserved',
      consumedCredits: { value: 0 },
      releasedCredits: { value: 0 },
    });
    expect(deliveryView.receiptSync.status).toBe('partial_failure');
    expect(deliveryView.lastError).toEqual({
      code: 'ACK_FAILED',
      message: '资产回执 ACK 失败，可安全重试。',
      retryable: true,
    });
    expect(deliveryView.availableActions).toContain('retry_receipt_sync');
    expect(JSON.stringify(deliveryView)).not.toContain('must-not-enter-safe-view');
  });

  it('does not register receipts or settle credits twice across repeated syncs', async () => {
    prepareAcceptedPackage();
    reserveSuccess();
    const taskReceipt = createCanonicalSuccessTaskReceipt();
    const assetReceipt = createCanonicalSuccessAssetReceipt();
    const pollPendingReceipts = vi
      .spyOn(storyCanvasBridge, 'pollPendingReceipts')
      .mockImplementation(async (_productionPackage, grant) => {
        const task = controlPlaneMockAdapter.receiveGenerationTaskReceipt(
          grant.grantId,
          taskReceipt,
        );
        const asset = controlPlaneMockAdapter.receiveAssetReceipt(grant.grantId, assetReceipt);
        return {
          transport: storyCanvasBridge.getState(),
          items: [
            {
              receiptId: 'receipt-task-success',
              deliveryId: 'delivery-task-success',
              kind: 'generation-task',
              status: task.duplicate ? 'duplicate' : 'accepted',
              acked: true,
              error: null,
            },
            {
              receiptId: 'receipt-asset-success',
              deliveryId: 'delivery-asset-success',
              kind: 'asset',
              status: asset.duplicate ? 'duplicate' : 'accepted',
              acked: true,
              error: null,
            },
          ],
        } satisfies ReceiptSyncResult;
      });

    const first = await useControlPlaneStore.getState().syncStoryCanvasReceipts();
    const firstState = controlPlaneMockAdapter.getState();
    const firstLedgerLength = firstState.commercial.creditState.ledger.length;

    const second = await useControlPlaneStore.getState().syncStoryCanvasReceipts();
    const secondState = controlPlaneMockAdapter.getState();

    expect(pollPendingReceipts).toHaveBeenCalledTimes(2);
    expect(first?.items.map((item) => item.status)).toEqual(['accepted', 'accepted']);
    expect(second?.items.map((item) => item.status)).toEqual(['duplicate', 'duplicate']);
    expect(secondState.generationTaskReceipts).toHaveLength(1);
    expect(secondState.assetReceipts).toHaveLength(1);
    expect(secondState.commercial.creditState.ledger).toHaveLength(firstLedgerLength);
    expect(getSuccessReservation()).toMatchObject({
      status: 'consumed',
      consumedCredits: { value: 100 },
      releasedCredits: { value: 20 },
    });
    expect(useControlPlaneStore.getState()).toMatchObject({
      error: null,
      lastAction: 'syncStoryCanvasReceipts',
      lastReceiptSync: second,
    });
  });

  it('maps a receipt polling transport failure to a retryable store error', async () => {
    const productionPackage = prepareAcceptedPackage();
    const pollError: StandardReceiptError = {
      code: 'STORYCANVAS_RECEIPT_POLL_ERROR',
      message: 'Receipt Outbox 轮询失败。',
      retryable: true,
      details: { httpStatus: '503' },
    };
    vi.spyOn(storyCanvasBridge, 'pollPendingReceipts').mockImplementation(async () => {
      const transport = storyCanvasBridge.restoreState(
        createTransport(productionPackage, 'error', {
          connected: false,
          retryCount: 1,
          error: pollError,
        }),
      );
      return { transport, items: [] };
    });

    const result = await useControlPlaneStore.getState().syncStoryCanvasReceipts();
    const state = useControlPlaneStore.getState();

    expect(result?.items).toEqual([]);
    expect(state.lastReceiptSync).toEqual(result);
    expect(state.error).toEqual({
      code: 'TRANSPORT_OFFLINE',
      message: 'Receipt Outbox 轮询失败。',
      retryable: true,
      details: { httpStatus: '503' },
    });
    expect(state.loading).toBe(false);
    expect(state.bootstrapResult.status).toBe('error');
  });
});
