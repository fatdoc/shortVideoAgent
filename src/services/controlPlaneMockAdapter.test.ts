import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExportReceipt, GenerationTaskReceipt } from '../domain/controlPlane';
import {
  CAPABILITY_IDS,
  DEMO_FAILURE_RESERVATION_ID,
  DEMO_FAILURE_TASK_ID,
  DEMO_PACKAGE_IDEMPOTENCY_KEY,
  DEMO_SUCCESS_RESERVATION_ID,
  DEMO_SUCCESS_TASK_ID,
  createCanonicalFailureTaskReceipt,
  createCanonicalSuccessAssetReceipt,
  createCanonicalSuccessTaskReceipt,
} from '../mocks/controlPlaneDemo';
import { cloneDemoWorkspace } from '../mocks/demoWorkspace';
import {
  ControlPlaneMockAdapter,
  ControlPlaneMockError,
  tenantDemoAuthorization,
} from './controlPlaneMockAdapter';

const TEST_NOW = new Date('2026-08-03T10:00:00.000Z');

function createAdapter() {
  return new ControlPlaneMockAdapter(() => cloneDemoWorkspace());
}

function createPackage(
  adapter: ControlPlaneMockAdapter,
  idempotencyKey = DEMO_PACKAGE_IDEMPOTENCY_KEY,
) {
  return adapter.createProjectProductionPackage({
    authorization: tenantDemoAuthorization,
    projectId: 'demo-local-001',
    capabilityIds: [CAPABILITY_IDS.baseGeneration, CAPABILITY_IDS.localLife],
    idempotencyKey,
  });
}

function prepareGrant(adapter: ControlPlaneMockAdapter) {
  const productionPackage = createPackage(adapter);
  const grant = adapter.issueDemoProjectGrant({
    authorization: tenantDemoAuthorization,
    packageId: productionPackage.packageId,
    capabilityIds: [CAPABILITY_IDS.baseGeneration],
    idempotencyKey: 'grant-adapter-test-v1',
  });
  return { productionPackage, grant };
}

function reserveSuccess(adapter: ControlPlaneMockAdapter) {
  return adapter.reserveGenerationTask({
    authorization: tenantDemoAuthorization,
    generationTaskId: DEMO_SUCCESS_TASK_ID,
    reservationId: DEMO_SUCCESS_RESERVATION_ID,
    capabilityId: CAPABILITY_IDS.baseGeneration,
    maxReservedCredits: 120,
    idempotencyKey: 'credit-reserve-demo-success-v1',
    occurredAt: '2026-07-30T00:05:00.000Z',
  });
}

function reserveFailure(adapter: ControlPlaneMockAdapter) {
  return adapter.reserveGenerationTask({
    authorization: tenantDemoAuthorization,
    generationTaskId: DEMO_FAILURE_TASK_ID,
    reservationId: DEMO_FAILURE_RESERVATION_ID,
    capabilityId: CAPABILITY_IDS.baseGeneration,
    maxReservedCredits: 80,
    idempotencyKey: 'credit-reserve-demo-failure-v1',
    occurredAt: '2026-07-30T00:06:00.000Z',
  });
}

function expectControlPlaneError(
  operation: () => unknown,
  expectedCode: ControlPlaneMockError['code'],
) {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(ControlPlaneMockError);
    expect((error as ControlPlaneMockError).code).toBe(expectedCode);
    return;
  }
  throw new Error(`Expected ControlPlaneMockError(${expectedCode}).`);
}

function getReservation(adapter: ControlPlaneMockAdapter, reservationId: string) {
  const reservation = adapter
    .getState()
    .commercial.creditState.reservations.find((item) => item.reservationId === reservationId);
  expect(reservation).toBeDefined();
  return reservation!;
}

function createSuccessExportReceipt(taskReceipt: GenerationTaskReceipt): ExportReceipt {
  return {
    contractVersion: taskReceipt.contractVersion,
    exportId: 'export-demo-success-v1',
    tenantId: taskReceipt.tenantId,
    projectId: taskReceipt.projectId,
    generationTaskId: taskReceipt.generationTaskId,
    status: 'succeeded',
    outputAssetIds: [...taskReceipt.outputAssetIds],
    checksum: 'sha256:export-demo-success-v1',
    error: null,
    idempotencyKey: 'receipt-export-demo-success-v1',
    createdAt: '2026-07-30T00:05:07.000Z',
    truthMode: 'MOCK-CONTRACT',
  };
}

describe('ControlPlaneMockAdapter delivery invariants', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(TEST_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('replays the same package command and rejects conflicting reuse or a second v1 package', () => {
    const adapter = createAdapter();
    const first = createPackage(adapter);
    const replay = adapter.createProjectProductionPackage({
      authorization: tenantDemoAuthorization,
      projectId: 'demo-local-001',
      capabilityIds: [CAPABILITY_IDS.localLife, CAPABILITY_IDS.baseGeneration],
      idempotencyKey: DEMO_PACKAGE_IDEMPOTENCY_KEY,
    });

    expect(replay).toEqual(first);
    expect(adapter.createCheckpoint().commandRecords).toHaveLength(1);

    expectControlPlaneError(
      () =>
        adapter.createProjectProductionPackage({
          authorization: tenantDemoAuthorization,
          projectId: 'demo-local-001',
          capabilityIds: [CAPABILITY_IDS.baseGeneration],
          idempotencyKey: DEMO_PACKAGE_IDEMPOTENCY_KEY,
        }),
      'IDEMPOTENCY_CONFLICT',
    );

    expectControlPlaneError(
      () => createPackage(adapter, 'package-create-demo-local-001-v1-retry'),
      'RECEIPT_CONFLICT',
    );
    expect(adapter.getState().package).toEqual(first);
  });

  it('does not freeze credits twice when the same reserve command is replayed', () => {
    const adapter = createAdapter();
    prepareGrant(adapter);

    const first = reserveSuccess(adapter);
    const ledgerLength = first.state.ledger.length;
    const replay = adapter.reserveGenerationTask({
      authorization: tenantDemoAuthorization,
      generationTaskId: DEMO_SUCCESS_TASK_ID,
      reservationId: DEMO_SUCCESS_RESERVATION_ID,
      capabilityId: CAPABILITY_IDS.baseGeneration,
      maxReservedCredits: 120,
      idempotencyKey: 'credit-reserve-demo-success-v1',
      occurredAt: '2026-07-30T00:05:30.000Z',
    });

    expect(first.duplicate).toBe(false);
    expect(replay.duplicate).toBe(true);
    expect(replay.state.ledger).toHaveLength(ledgerLength);
    expect(replay.state.reservations).toHaveLength(1);
    expect(replay.state.wallet.available.value).toBe(880);
    expect(replay.state.wallet.reserved.value).toBe(120);
  });

  it('treats an identical task receipt as duplicate without registering or settling twice', () => {
    const adapter = createAdapter();
    const { grant } = prepareGrant(adapter);
    reserveSuccess(adapter);
    const receipt = createCanonicalSuccessTaskReceipt();

    const first = adapter.receiveGenerationTaskReceipt(grant.grantId, receipt);
    const ledgerLength = adapter.getState().commercial.creditState.ledger.length;
    const replay = adapter.receiveGenerationTaskReceipt(grant.grantId, receipt);
    const state = adapter.getState();

    expect(first).toMatchObject({ duplicate: false, status: 'pending' });
    expect(replay).toMatchObject({ duplicate: true, status: 'duplicate' });
    expect(state.generationTaskReceipts).toHaveLength(1);
    expect(state.commercial.creditState.ledger).toHaveLength(ledgerLength);
    expect(getReservation(adapter, DEMO_SUCCESS_RESERVATION_ID)).toMatchObject({
      status: 'reserved',
      consumedCredits: { value: 0 },
      releasedCredits: { value: 0 },
    });
  });

  it('rejects a conflicting terminal task receipt without overwriting the accepted terminal state', () => {
    const adapter = createAdapter();
    const { grant } = prepareGrant(adapter);
    reserveSuccess(adapter);
    const success = createCanonicalSuccessTaskReceipt();
    adapter.receiveGenerationTaskReceipt(grant.grantId, success);
    const conflict: GenerationTaskReceipt = {
      ...success,
      status: 'failed',
      actualCredits: null,
      outputAssetIds: [],
      error: {
        code: 'LATE_PROVIDER_FAILURE',
        message: 'A later conflicting terminal receipt.',
        retryable: false,
        details: {},
      },
      idempotencyKey: 'receipt-task-demo-success-conflict-v1',
    };

    expectControlPlaneError(
      () => adapter.receiveGenerationTaskReceipt(grant.grantId, conflict),
      'RECEIPT_CONFLICT',
    );

    expect(adapter.getState().generationTaskReceipts).toEqual([success]);
    expect(getReservation(adapter, DEMO_SUCCESS_RESERVATION_ID).status).toBe('reserved');
  });

  it('keeps success credits reserved until a deliverable asset arrives and settles only once', () => {
    const adapter = createAdapter();
    const { grant } = prepareGrant(adapter);
    reserveSuccess(adapter);
    adapter.receiveGenerationTaskReceipt(grant.grantId, createCanonicalSuccessTaskReceipt());

    expect(getReservation(adapter, DEMO_SUCCESS_RESERVATION_ID)).toMatchObject({
      status: 'reserved',
      reservedCredits: { value: 120 },
      consumedCredits: { value: 0 },
      releasedCredits: { value: 0 },
    });
    expect(adapter.getState().commercial.creditState.wallet).toMatchObject({
      available: { value: 880 },
      reserved: { value: 120 },
    });

    const asset = createCanonicalSuccessAssetReceipt();
    const first = adapter.receiveAssetReceipt(grant.grantId, asset);
    const settledState = adapter.getState();
    const settledLedgerLength = settledState.commercial.creditState.ledger.length;
    const replay = adapter.receiveAssetReceipt(grant.grantId, asset);

    expect(first).toMatchObject({ duplicate: false, status: 'accepted' });
    expect(replay).toMatchObject({ duplicate: true, status: 'duplicate' });
    expect(getReservation(adapter, DEMO_SUCCESS_RESERVATION_ID)).toMatchObject({
      status: 'consumed',
      reservedCredits: { value: 120 },
      consumedCredits: { value: 100 },
      releasedCredits: { value: 20 },
    });
    expect(adapter.getState().commercial.creditState.wallet).toMatchObject({
      available: { value: 900 },
      reserved: { value: 0 },
    });
    expect(adapter.getState().assetReceipts).toHaveLength(1);
    expect(adapter.getState().commercial.creditState.ledger).toHaveLength(settledLedgerLength);
  });

  it('releases the full reservation when a task fails without a deliverable', () => {
    const adapter = createAdapter();
    const { grant } = prepareGrant(adapter);
    reserveFailure(adapter);

    adapter.receiveGenerationTaskReceipt(grant.grantId, createCanonicalFailureTaskReceipt());

    expect(getReservation(adapter, DEMO_FAILURE_RESERVATION_ID)).toMatchObject({
      status: 'released',
      reservedCredits: { value: 80 },
      consumedCredits: { value: 0 },
      releasedCredits: { value: 80 },
    });
    expect(adapter.getState().commercial.creditState.wallet).toMatchObject({
      available: { value: 1000 },
      reserved: { value: 0 },
    });
    expect(adapter.getState().assetReceipts).toHaveLength(0);
  });

  it('restores state and idempotency records after every receipt preflight', () => {
    const adapter = createAdapter();
    const { grant } = prepareGrant(adapter);
    reserveSuccess(adapter);
    const taskReceipt = createCanonicalSuccessTaskReceipt();
    const assetReceipt = createCanonicalSuccessAssetReceipt();
    const exportReceipt = createSuccessExportReceipt(taskReceipt);

    const beforeTask = adapter.createCheckpoint();
    expect(adapter.preflightGenerationTaskReceipt(grant.grantId, taskReceipt)).toMatchObject({
      accepted: true,
      duplicate: false,
      status: 'pending',
    });
    expect(adapter.createCheckpoint()).toEqual(beforeTask);

    expect(adapter.receiveGenerationTaskReceipt(grant.grantId, taskReceipt)).toMatchObject({
      duplicate: false,
    });
    const beforeAsset = adapter.createCheckpoint();
    expect(adapter.preflightAssetReceipt(grant.grantId, assetReceipt)).toMatchObject({
      accepted: true,
      duplicate: false,
    });
    expect(adapter.createCheckpoint()).toEqual(beforeAsset);

    expect(adapter.receiveAssetReceipt(grant.grantId, assetReceipt)).toMatchObject({
      duplicate: false,
    });
    const beforeExport = adapter.createCheckpoint();
    expect(adapter.preflightExportReceipt(grant.grantId, exportReceipt)).toMatchObject({
      accepted: true,
      duplicate: false,
    });
    expect(adapter.createCheckpoint()).toEqual(beforeExport);

    expect(adapter.receiveExportReceipt(grant.grantId, exportReceipt)).toMatchObject({
      duplicate: false,
    });
  });
});
