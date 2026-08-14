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

  it('renders a V3 store operations workbench without KPI-card-wall or raw ids', () => {
    renderPage();
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    expect(screen.getByText('海底捞火锅·北京三里屯店探店视频')).toBeInTheDocument();
    expect(screen.getByText('门店建档')).toBeInTheDocument();
    expect(screen.getByText('商品套餐')).toBeInTheDocument();
    expect(screen.getByText('门店资产')).toBeInTheDocument();
    expect(screen.getByText('获客任务')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-store-hero')).toHaveTextContent('门店素材');
    expect(screen.getByTestId('dashboard-operations-queue')).toHaveTextContent('生产队列');
    expect(screen.getByTestId('dashboard-inspector')).toHaveTextContent('下一步');
    expect(screen.queryByText('品牌事实')).not.toBeInTheDocument();
    expect(screen.queryByText('demo-local-001')).not.toBeInTheDocument();
    expect(screen.queryByText(/matchStatus=/)).not.toBeInTheDocument();
  });

  it('shows safe delivery readiness without raw receipt event labels', () => {
    renderPage();

    const delivery = screen.getByTestId('dashboard-delivery-status');
    expect(delivery).toHaveTextContent('门店资产入口');
    expect(delivery).toHaveTextContent('待配置');
    expect(delivery).toHaveTextContent('没有可展示的生成结果');
    expect(delivery).not.toHaveTextContent('Package');
    expect(delivery).not.toHaveTextContent('Grant');
    expect(delivery).not.toHaveTextContent('MOCK');
    expect(delivery).not.toHaveTextContent('GenerationTask');
  });

  it('projects canonical delivery evidence and deduplicates task events', () => {
    const { snapshot, successTask, successAsset, exportReceipt } = addCanonicalSuccessEvidence(
      createReadyDeliverySnapshot(),
    );
    useControlPlaneStore.setState({ snapshot });

    renderPage();

    const delivery = screen.getByTestId('dashboard-delivery-status');
    expect(delivery).toHaveTextContent('可进入资产工作流');
    expect(delivery).toHaveTextContent('已生成 1');
    expect(delivery).toHaveTextContent('可交付素材 1');
    expect(delivery).toHaveTextContent('导出 1');
    expect(delivery).not.toHaveTextContent('MOCK-CONTRACT');
    expect(delivery).not.toHaveTextContent('NON_SERVER_SOURCE');
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
    expect(delivery).toHaveTextContent('回执确认待处理');
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

    expect(screen.getByTestId('dashboard-delivery-status')).toHaveTextContent('已生成 1');

    act(() => {
      useControlPlaneStore.setState({
        snapshot: createControlPlaneDemoState(),
        lastReceiptSync: null,
        error: null,
      });
    });

    const delivery = screen.getByTestId('dashboard-delivery-status');
    expect(delivery).toHaveTextContent('待配置');
    expect(delivery).toHaveTextContent('没有可展示的生成结果');
  });

  it('opens the Brief route from new project', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId('dashboard-new-project'));
    expect(await screen.findByText('Brief route')).toBeInTheDocument();
  });
});
