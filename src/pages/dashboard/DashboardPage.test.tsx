import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/Providers';
import type { ExportReceipt, ReceiptSyncResult } from '../../domain/controlPlane';
import { applyCreditCommand } from '../../domain/creditLedger';
import {
  CAPABILITY_IDS,
  canonicalProjectProductionPackage,
  createCanonicalDemoGrant,
  createCanonicalSuccessAssetReceipt,
  createCanonicalSuccessTaskReceipt,
  createControlPlaneDemoState,
  DEMO_RATE_CARD_ID,
  DEMO_RATE_CARD_VERSION,
  DEMO_SUCCESS_RESERVATION_ID,
  DEMO_SUCCESS_TASK_ID,
} from '../../mocks/controlPlaneDemo';
import { cloneDemoWorkspace } from '../../mocks/demoWorkspace';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';
import { useProjectStore } from '../../stores/projectStore';
import { DashboardPage } from './DashboardPage';

function renderPage() {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects/new" element={<div>Brief route</div>} />
          <Route path="/projects/:projectId/script" element={<div>Script route</div>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

function createReadyDeliverySnapshot() {
  const snapshot = createControlPlaneDemoState();
  snapshot.package = {
    ...structuredClone(canonicalProjectProductionPackage),
    expiresAt: '2099-08-06T00:03:00.000Z',
  };
  snapshot.grants = [
    createCanonicalDemoGrant(snapshot.package, [CAPABILITY_IDS.baseGeneration], new Date()),
  ];
  snapshot.transport = {
    ...snapshot.transport,
    phase: 'accepted',
    connected: true,
    retryCount: 1,
    packageId: snapshot.package.packageId,
    projectId: snapshot.package.projectId,
    lastAttemptAt: '2026-08-03T00:00:01.000Z',
    lastConnectedAt: '2026-08-03T00:00:02.000Z',
  };
  return snapshot;
}

function addCanonicalSuccessEvidence(snapshot: ReturnType<typeof createReadyDeliverySnapshot>) {
  const successTask = createCanonicalSuccessTaskReceipt();
  const queuedTask = {
    ...successTask,
    status: 'queued' as const,
    progress: 20,
    actualCredits: null,
    outputAssetIds: [],
    createdAt: '2026-07-30T00:04:00.000Z',
    startedAt: null,
    completedAt: null,
    idempotencyKey: 'receipt-task-demo-success-queued-v1',
  };
  const successAsset = createCanonicalSuccessAssetReceipt();
  successAsset.reviewStatus = 'approved';
  const exportReceipt: ExportReceipt = {
    contractVersion: successTask.contractVersion,
    exportId: 'export-demo-success',
    tenantId: successTask.tenantId,
    projectId: successTask.projectId,
    generationTaskId: successTask.generationTaskId,
    status: 'succeeded',
    outputAssetIds: [...successTask.outputAssetIds],
    checksum: successAsset.checksum,
    error: null,
    idempotencyKey: 'export-demo-success-v1',
    createdAt: '2026-07-30T00:07:00.000Z',
    truthMode: 'MOCK-CONTRACT',
  };

  snapshot.generationTaskReceipts = [queuedTask, successTask];
  snapshot.assetReceipts = [successAsset];
  snapshot.exportReceipts = [exportReceipt];

  let creditState = applyCreditCommand(snapshot.commercial.creditState, {
    type: 'reserve',
    taskId: DEMO_SUCCESS_TASK_ID,
    reservationId: DEMO_SUCCESS_RESERVATION_ID,
    credits: 120,
    rateCardId: DEMO_RATE_CARD_ID,
    rateCardVersion: DEMO_RATE_CARD_VERSION,
    quoteSnapshotId: 'quote-task-demo-success',
    idempotencyKey: 'reserve-task-demo-success-v1',
    occurredAt: '2026-07-30T00:04:30.000Z',
  }).state;
  creditState = applyCreditCommand(creditState, {
    type: 'settle_success',
    taskId: DEMO_SUCCESS_TASK_ID,
    reservationId: DEMO_SUCCESS_RESERVATION_ID,
    actualCredits: 100,
    idempotencyKey: 'settle-task-demo-success-v1',
    occurredAt: '2026-07-30T00:05:07.000Z',
  }).state;
  snapshot.commercial.creditState = creditState;

  return { snapshot, successTask, successAsset, exportReceipt };
}

describe('DashboardPage', () => {
  beforeEach(() => {
    useControlPlaneStore.setState({
      snapshot: createControlPlaneDemoState(),
      lastReceiptSync: null,
      error: null,
    });
    useProjectStore.setState({
      workspace: cloneDemoWorkspace(),
      loading: false,
      error: null,
      hydrated: true,
      lastAction: null,
    });
  });

  it('renders unified demo metrics and project row', () => {
    renderPage();
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    expect(screen.getByText('海底捞火锅·北京三里屯店探店视频')).toBeInTheDocument();
    expect(screen.getByText('品牌事实')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-progress')).toBeInTheDocument();
    expect(screen.getByText('团队成员')).toBeInTheDocument();
    expect(screen.getByText('已购能力')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-delivery-status')).toHaveTextContent('项目交付状态');
  });

  it('shows a safe empty delivery state instead of receipt event counts', () => {
    renderPage();

    const delivery = screen.getByTestId('dashboard-delivery-status');
    expect(delivery).toHaveTextContent('项目交付状态');
    expect(delivery).toHaveTextContent('Package missing');
    expect(delivery).toHaveTextContent('Grant missing');
    expect(delivery).toHaveTextContent('传输 offline');
    expect(delivery).toHaveTextContent('最近同步 idle');
    expect(delivery).toHaveTextContent('唯一任务 0');
    expect(delivery).toHaveTextContent('可交付 Asset 0');
    expect(delivery).toHaveTextContent('Export 0');
    expect(delivery).not.toHaveTextContent('GenerationTask');
  });

  it('projects canonical delivery evidence and deduplicates task events', () => {
    const { snapshot, successTask, successAsset, exportReceipt } = addCanonicalSuccessEvidence(
      createReadyDeliverySnapshot(),
    );
    useControlPlaneStore.setState({ snapshot });

    renderPage();

    const delivery = screen.getByTestId('dashboard-delivery-status');
    expect(delivery).toHaveTextContent('Package ready');
    expect(delivery).toHaveTextContent('Grant active');
    expect(delivery).toHaveTextContent('传输 accepted');
    expect(delivery).toHaveTextContent('唯一任务 1');
    expect(delivery).toHaveTextContent('成功 1');
    expect(delivery).toHaveTextContent('失败 0');
    expect(delivery).toHaveTextContent('可交付 Asset 1');
    expect(delivery).toHaveTextContent('Export 1');
    expect(delivery).toHaveTextContent('reserved 0');
    expect(delivery).toHaveTextContent('consumed 100');
    expect(delivery).toHaveTextContent('released 20');
    expect(delivery).toHaveTextContent('DEMO');
    expect(delivery).toHaveTextContent('MOCK-CONTRACT');
    expect(delivery).toHaveTextContent('NON_SERVER_SOURCE');
    expect(delivery).not.toHaveTextContent(successTask.inputDigest);
    expect(delivery).not.toHaveTextContent(successAsset.storageReference);
    expect(delivery).not.toHaveTextContent(exportReceipt.checksum ?? '');
  });

  it('shows partial receipt synchronization with only safe error fields', () => {
    const snapshot = createReadyDeliverySnapshot();
    const receiptSync: ReceiptSyncResult = {
      transport: snapshot.transport,
      items: [
        {
          receiptId: 'receipt-sensitive-accepted',
          deliveryId: 'delivery-sensitive-accepted',
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
            details: { storageReference: 'demo://must-not-leak.png' },
          },
        },
      ],
    };
    useControlPlaneStore.setState({
      snapshot,
      lastReceiptSync: receiptSync,
      error: {
        code: 'TRANSPORT_OFFLINE',
        message: '部分回执尚未确认。',
        retryable: true,
        details: { inputDigest: 'must-not-leak-input-digest' },
      },
    });

    renderPage();

    const delivery = screen.getByTestId('dashboard-delivery-status');
    expect(delivery).toHaveTextContent('最近同步 partial_failure');
    expect(delivery).toHaveTextContent('ACK error 1');
    expect(delivery).toHaveTextContent('TRANSPORT_OFFLINE');
    expect(delivery).toHaveTextContent('部分回执尚未确认。');
    expect(delivery).toHaveTextContent('可重试：是');
    expect(delivery).not.toHaveTextContent('receipt-sensitive-accepted');
    expect(delivery).not.toHaveTextContent('delivery-sensitive-ack-error');
    expect(delivery).not.toHaveTextContent('demo://must-not-leak.png');
    expect(delivery).not.toHaveTextContent('must-not-leak-input-digest');
  });

  it('clears stale delivery evidence after the store returns to DEMO_READY', () => {
    const { snapshot } = addCanonicalSuccessEvidence(createReadyDeliverySnapshot());
    const receiptSync: ReceiptSyncResult = {
      transport: snapshot.transport,
      items: [
        {
          receiptId: 'receipt-before-reset',
          deliveryId: 'delivery-before-reset',
          kind: 'generation-task',
          status: 'accepted',
          acked: true,
          error: null,
        },
      ],
    };
    useControlPlaneStore.setState({ snapshot, lastReceiptSync: receiptSync });
    renderPage();

    expect(screen.getByTestId('dashboard-delivery-status')).toHaveTextContent('唯一任务 1');

    act(() => {
      useControlPlaneStore.setState({
        snapshot: createControlPlaneDemoState(),
        lastReceiptSync: null,
        error: null,
      });
    });

    const delivery = screen.getByTestId('dashboard-delivery-status');
    expect(delivery).toHaveTextContent('Package missing');
    expect(delivery).toHaveTextContent('Grant missing');
    expect(delivery).toHaveTextContent('传输 offline');
    expect(delivery).toHaveTextContent('最近同步 idle');
    expect(delivery).toHaveTextContent('唯一任务 0');
    expect(delivery).toHaveTextContent('consumed 0');
    expect(delivery).toHaveTextContent('released 0');
  });

  it('opens the Brief route from new project', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId('dashboard-new-project'));
    expect(await screen.findByText('Brief route')).toBeInTheDocument();
  });
});
