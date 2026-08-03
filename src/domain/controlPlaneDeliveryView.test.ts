import { describe, expect, it } from 'vitest';
import type { ExportReceipt, GenerationTaskReceipt, ReceiptSyncResult } from './controlPlane';
import { applyCreditCommand, createDemoReadyCreditState } from './creditLedger';
import { selectTenantProjectDeliveryView } from './controlPlaneDeliveryView';
import {
  CAPABILITY_IDS,
  canonicalProjectProductionPackage,
  createCanonicalDemoGrant,
  createCanonicalFailureTaskReceipt,
  createCanonicalSuccessAssetReceipt,
  createCanonicalSuccessTaskReceipt,
  createControlPlaneDemoState,
  DEMO_FAILURE_RESERVATION_ID,
  DEMO_FAILURE_TASK_ID,
  DEMO_RATE_CARD_ID,
  DEMO_RATE_CARD_VERSION,
  DEMO_SUCCESS_RESERVATION_ID,
  DEMO_SUCCESS_TASK_ID,
  DEMO_TENANT_ID,
} from '../mocks/controlPlaneDemo';

const PROJECT_ID = 'demo-local-001';
const NOW = '2026-08-03T12:00:00.000Z';

function createScopedSnapshot() {
  const snapshot = createControlPlaneDemoState();
  snapshot.package = structuredClone(canonicalProjectProductionPackage);
  snapshot.grants = [
    createCanonicalDemoGrant(snapshot.package, [CAPABILITY_IDS.baseGeneration], new Date(NOW)),
  ];
  snapshot.transport = {
    ...snapshot.transport,
    phase: 'accepted',
    connected: true,
    packageId: snapshot.package.packageId,
    projectId: PROJECT_ID,
    lastAttemptAt: '2026-08-03T11:59:00.000Z',
    lastConnectedAt: '2026-08-03T11:59:01.000Z',
  };
  return snapshot;
}

function createExportReceipt(task: GenerationTaskReceipt): ExportReceipt {
  return {
    contractVersion: task.contractVersion,
    exportId: `export-${task.generationTaskId}`,
    tenantId: task.tenantId,
    projectId: task.projectId,
    generationTaskId: task.generationTaskId,
    status: 'succeeded',
    outputAssetIds: [...task.outputAssetIds],
    checksum: 'sensitive-export-checksum',
    error: null,
    idempotencyKey: `export-${task.generationTaskId}-v1`,
    createdAt: '2026-08-03T12:05:00.000Z',
    truthMode: 'MOCK-CONTRACT',
  };
}

function reserveCredits(
  state: ReturnType<typeof createDemoReadyCreditState>,
  input: {
    taskId: string;
    reservationId: string;
    credits: number;
    occurredAt: string;
  },
) {
  return applyCreditCommand(state, {
    type: 'reserve',
    taskId: input.taskId,
    reservationId: input.reservationId,
    credits: input.credits,
    rateCardId: DEMO_RATE_CARD_ID,
    rateCardVersion: DEMO_RATE_CARD_VERSION,
    quoteSnapshotId: `quote-${input.taskId}`,
    idempotencyKey: `reserve-${input.taskId}-v1`,
    occurredAt: input.occurredAt,
  }).state;
}

describe('A-04.1 tenant/project delivery evidence projection', () => {
  it('returns a safe empty project projection before package creation', () => {
    const view = selectTenantProjectDeliveryView(createControlPlaneDemoState(), {
      tenantId: DEMO_TENANT_ID,
      projectId: PROJECT_ID,
      now: NOW,
    });

    expect(view.scope).toEqual({ tenantId: DEMO_TENANT_ID, projectId: PROJECT_ID });
    expect(view.package).toEqual({ status: 'missing', createdAt: null, expiresAt: null });
    expect(view.grant).toEqual({ status: 'missing', issuedAt: null, expiresAt: null });
    expect(view.transport.status).toBe('offline');
    expect(view.receiptSync.status).toBe('idle');
    expect(view.tasks).toEqual([]);
    expect(view.summary).toEqual({
      uniqueTaskCount: 0,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
      inProgress: 0,
      deliverableAssetCount: 0,
      exportCount: 0,
      credits: { reserved: 0, consumed: 0, released: 0, unit: 'AI_VIDEO_CREDIT' },
    });
    expect(view.availableActions).toEqual(['create_package']);
    expect(view.disclaimer).toEqual({
      dataMode: 'DEMO',
      truthMode: 'MOCK-CONTRACT',
      authority: 'NON_SERVER_SOURCE',
      label: '演示数据 · 非正式报价',
    });
  });

  it('projects ready package, active grant and accepted transport without credential fields', () => {
    const snapshot = createScopedSnapshot();
    const view = selectTenantProjectDeliveryView(snapshot, {
      tenantId: DEMO_TENANT_ID,
      projectId: PROJECT_ID,
      now: NOW,
    });

    expect(view.package).toEqual({
      status: 'ready',
      createdAt: snapshot.package?.createdAt,
      expiresAt: snapshot.package?.expiresAt,
    });
    expect(view.grant).toEqual({
      status: 'active',
      issuedAt: snapshot.grants[0].issuedAt,
      expiresAt: snapshot.grants[0].expiresAt,
    });
    expect(view.transport).toMatchObject({
      status: 'accepted',
      connected: true,
      retryCount: 0,
    });
    expect(view.availableActions).toContain('sync_receipts');

    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain(snapshot.package?.digest);
    expect(serialized).not.toContain(snapshot.package?.brandFactsSnapshot[0]?.text ?? '');
    expect(serialized).not.toContain(snapshot.grants[0].mockHandle);
    expect(serialized).not.toContain(snapshot.grants[0].warning);
  });

  it('folds receipt history into unique tasks and filters both tenant and project scope', () => {
    const snapshot = createScopedSnapshot();
    const succeeded = createCanonicalSuccessTaskReceipt();
    const requested: GenerationTaskReceipt = {
      ...succeeded,
      status: 'requested',
      progress: 0,
      actualCredits: null,
      outputAssetIds: [],
      error: null,
      createdAt: '2026-08-03T12:00:00.000Z',
      startedAt: null,
      completedAt: null,
      idempotencyKey: 'receipt-task-demo-success-requested-v1',
    };
    const running: GenerationTaskReceipt = {
      ...requested,
      status: 'running',
      progress: 60,
      createdAt: '2026-08-03T12:01:00.000Z',
      startedAt: '2026-08-03T12:01:00.000Z',
      idempotencyKey: 'receipt-task-demo-success-running-v1',
    };
    const latestSucceeded = {
      ...succeeded,
      createdAt: '2026-08-03T12:02:00.000Z',
      completedAt: '2026-08-03T12:02:00.000Z',
    };
    const failed = createCanonicalFailureTaskReceipt();
    const otherProject = {
      ...failed,
      generationTaskId: 'task-other-project',
      projectId: 'project-other',
      idempotencyKey: 'receipt-task-other-project-v1',
    };
    const otherTenant = {
      ...failed,
      generationTaskId: 'task-other-tenant',
      tenantId: 'tenant-other',
      idempotencyKey: 'receipt-task-other-tenant-v1',
    };
    snapshot.generationTaskReceipts = [
      requested,
      running,
      latestSucceeded,
      failed,
      otherProject,
      otherTenant,
    ];
    const asset = createCanonicalSuccessAssetReceipt();
    asset.reviewStatus = 'approved';
    snapshot.assetReceipts = [
      asset,
      { ...asset, assetId: 'asset-other-project', projectId: 'project-other' },
    ];
    snapshot.exportReceipts = [
      createExportReceipt(latestSucceeded),
      {
        ...createExportReceipt(otherProject),
        exportId: 'export-other-project',
      },
    ];

    const view = selectTenantProjectDeliveryView(snapshot, {
      tenantId: DEMO_TENANT_ID,
      projectId: PROJECT_ID,
      now: NOW,
    });

    expect(view.tasks.map((task) => [task.generationTaskId, task.status])).toEqual([
      [DEMO_FAILURE_TASK_ID, 'failed'],
      [DEMO_SUCCESS_TASK_ID, 'succeeded'],
    ]);
    expect(view.summary).toMatchObject({
      uniqueTaskCount: 2,
      succeeded: 1,
      failed: 1,
      cancelled: 0,
      inProgress: 0,
      deliverableAssetCount: 1,
      exportCount: 1,
    });
    expect(view.tasks.find((task) => task.generationTaskId === DEMO_SUCCESS_TASK_ID)).toMatchObject(
      {
        terminalStatus: 'succeeded',
        assetEvidence: { total: 1, approved: 1, qaBlocked: 0 },
        exportEvidence: { total: 1, succeeded: 1, failed: 0 },
      },
    );
  });

  it('derives reserved, consumed and released credits from scoped runtime reservations', () => {
    const snapshot = createScopedSnapshot();
    const succeeded = createCanonicalSuccessTaskReceipt();
    const failed = createCanonicalFailureTaskReceipt();
    const running: GenerationTaskReceipt = {
      ...succeeded,
      generationTaskId: 'task-demo-running',
      reservationReference: 'reservation-demo-running-40',
      status: 'running',
      progress: 50,
      actualCredits: null,
      outputAssetIds: [],
      error: null,
      createdAt: '2026-08-03T12:03:00.000Z',
      completedAt: null,
      idempotencyKey: 'receipt-task-demo-running-v1',
    };
    snapshot.generationTaskReceipts = [succeeded, failed, running];
    snapshot.assetReceipts = [createCanonicalSuccessAssetReceipt()];

    let creditState = createDemoReadyCreditState();
    creditState = reserveCredits(creditState, {
      taskId: DEMO_SUCCESS_TASK_ID,
      reservationId: DEMO_SUCCESS_RESERVATION_ID,
      credits: 120,
      occurredAt: '2026-08-03T12:00:00.000Z',
    });
    creditState = applyCreditCommand(creditState, {
      type: 'settle_success',
      taskId: DEMO_SUCCESS_TASK_ID,
      reservationId: DEMO_SUCCESS_RESERVATION_ID,
      actualCredits: 100,
      idempotencyKey: 'settle-task-demo-success-v1',
      occurredAt: '2026-08-03T12:01:00.000Z',
    }).state;
    creditState = reserveCredits(creditState, {
      taskId: DEMO_FAILURE_TASK_ID,
      reservationId: DEMO_FAILURE_RESERVATION_ID,
      credits: 80,
      occurredAt: '2026-08-03T12:02:00.000Z',
    });
    creditState = applyCreditCommand(creditState, {
      type: 'settle_failure',
      taskId: DEMO_FAILURE_TASK_ID,
      reservationId: DEMO_FAILURE_RESERVATION_ID,
      idempotencyKey: 'settle-task-demo-failure-v1',
      occurredAt: '2026-08-03T12:03:00.000Z',
    }).state;
    creditState = reserveCredits(creditState, {
      taskId: running.generationTaskId,
      reservationId: running.reservationReference,
      credits: 40,
      occurredAt: '2026-08-03T12:04:00.000Z',
    });
    snapshot.commercial.creditState = creditState;

    const view = selectTenantProjectDeliveryView(snapshot, {
      tenantId: DEMO_TENANT_ID,
      projectId: PROJECT_ID,
      now: NOW,
    });

    expect(view.summary.credits).toEqual({
      reserved: 40,
      consumed: 100,
      released: 100,
      unit: 'AI_VIDEO_CREDIT',
    });
    expect(
      view.tasks.find((task) => task.generationTaskId === DEMO_SUCCESS_TASK_ID)?.credit,
    ).toEqual({
      status: 'consumed',
      reserved: 0,
      consumed: 100,
      released: 20,
      unit: 'AI_VIDEO_CREDIT',
    });
    expect(
      view.tasks.find((task) => task.generationTaskId === DEMO_FAILURE_TASK_ID)?.credit,
    ).toEqual({
      status: 'released',
      reserved: 0,
      consumed: 0,
      released: 80,
      unit: 'AI_VIDEO_CREDIT',
    });
    expect(
      view.tasks.find((task) => task.generationTaskId === running.generationTaskId)?.credit,
    ).toEqual({
      status: 'reserved',
      reserved: 40,
      consumed: 0,
      released: 0,
      unit: 'AI_VIDEO_CREDIT',
    });
  });

  it('reduces sync failures and receipt payloads to safe evidence fields', () => {
    const snapshot = createScopedSnapshot();
    const succeeded = createCanonicalSuccessTaskReceipt();
    const asset = createCanonicalSuccessAssetReceipt();
    const exportReceipt = createExportReceipt(succeeded);
    snapshot.generationTaskReceipts = [succeeded];
    snapshot.assetReceipts = [asset];
    snapshot.exportReceipts = [exportReceipt];
    const receiptSync: ReceiptSyncResult = {
      transport: snapshot.transport,
      items: [
        {
          receiptId: 'receipt-safe-accepted',
          deliveryId: 'delivery-safe-accepted',
          kind: 'generation-task',
          status: 'accepted',
          acked: true,
          error: null,
        },
        {
          receiptId: 'receipt-sensitive-ack-error',
          deliveryId: 'delivery-sensitive-ack-error',
          kind: 'asset',
          status: 'ack_error',
          acked: false,
          error: {
            code: 'ACK_FAILED',
            message: '回执确认失败，可安全重试。',
            retryable: true,
            details: { credential: 'must-not-leak' },
          },
        },
      ],
    };

    const view = selectTenantProjectDeliveryView(snapshot, {
      tenantId: DEMO_TENANT_ID,
      projectId: PROJECT_ID,
      now: NOW,
      receiptSync,
    });

    expect(view.receiptSync).toEqual({
      status: 'partial_failure',
      accepted: 1,
      duplicate: 0,
      rejected: 0,
      ackError: 1,
    });
    expect(view.lastError).toEqual({
      code: 'ACK_FAILED',
      message: '回执确认失败，可安全重试。',
      retryable: true,
    });
    expect(view.availableActions).toContain('retry_receipt_sync');

    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain(succeeded.inputDigest);
    expect(serialized).not.toContain(succeeded.provider);
    expect(serialized).not.toContain(succeeded.model);
    expect(serialized).not.toContain(asset.storageReference);
    expect(serialized).not.toContain(asset.promptDigest ?? '');
    expect(serialized).not.toContain(asset.checksum);
    expect(serialized).not.toContain(exportReceipt.checksum ?? '');
    expect(serialized).not.toContain(exportReceipt.outputAssetIds[0]);
    expect(serialized).not.toContain('must-not-leak');
    expect(serialized).not.toContain('receipt-sensitive-ack-error');
    expect(serialized).not.toContain('delivery-sensitive-ack-error');
    expect(serialized).not.toContain('ledger-demo-issue-wallet');
  });

  it('marks expired packages and scope-mismatched runtime evidence without leaking foreign scope', () => {
    const snapshot = createScopedSnapshot();
    snapshot.grants = [{ ...snapshot.grants[0], projectId: 'project-foreign' }];
    snapshot.transport = {
      ...snapshot.transport,
      projectId: 'project-foreign',
      phase: 'error',
      connected: false,
      lastError: {
        code: 'FOREIGN_PROJECT_ERROR',
        message: 'foreign-project-secret',
        retryable: true,
        details: { projectId: 'project-foreign' },
      },
    };

    const mismatch = selectTenantProjectDeliveryView(snapshot, {
      tenantId: DEMO_TENANT_ID,
      projectId: PROJECT_ID,
      now: NOW,
    });
    expect(mismatch.grant.status).toBe('scope_mismatch');
    expect(mismatch.transport.status).toBe('offline');
    expect(mismatch.lastError).toBeNull();
    expect(JSON.stringify(mismatch)).not.toContain('project-foreign');
    expect(JSON.stringify(mismatch)).not.toContain('foreign-project-secret');

    const expired = selectTenantProjectDeliveryView(snapshot, {
      tenantId: DEMO_TENANT_ID,
      projectId: PROJECT_ID,
      now: '2026-08-07T00:00:00.000Z',
    });
    expect(expired.package.status).toBe('expired');
    expect(expired.availableActions).toContain('create_package');
  });
});
