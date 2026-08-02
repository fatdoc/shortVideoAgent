import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExportReceipt } from '../../domain/controlPlane';
import { createPhase1ControlPlaneProjection } from '../../domain/phase1Production';
import {
  DEMO_SUCCESS_ASSET_ID,
  DEMO_SUCCESS_TASK_ID,
  canonicalProjectProductionPackage,
  createCanonicalSuccessAssetReceipt,
  createCanonicalSuccessTaskReceipt,
  createControlPlaneDemoState,
} from '../../mocks/controlPlaneDemo';
import {
  ProductionControlSurface,
  type ProductionView,
} from './ProductionControlSurface';

const storeMock = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  noop: vi.fn(),
  openStoryCanvas: vi.fn(),
}));

vi.mock('../../stores/controlPlaneStore', () => ({
  useControlPlaneStore: (
    selector: (state: Record<string, unknown>) => unknown,
  ) =>
    selector(
      new Proxy(storeMock.state, {
        get(target, property) {
          if (property in target) return target[property as keyof typeof target];
          return storeMock.noop;
        },
      }),
    ),
}));

vi.mock('./CanonicalScriptApproval', () => ({
  CanonicalScriptApproval: () => null,
}));

function createAcceptedSnapshot() {
  const snapshot = createControlPlaneDemoState();
  const productionPackage = structuredClone(canonicalProjectProductionPackage);
  snapshot.package = productionPackage;
  snapshot.transport = {
    ...snapshot.transport,
    phase: 'accepted',
    projectId: productionPackage.projectId,
    packageId: productionPackage.packageId,
    lastAttemptAt: '2026-08-02T12:00:00.000Z',
  };
  return snapshot;
}

function setStoreSnapshot(snapshot: ReturnType<typeof createControlPlaneDemoState>) {
  storeMock.state = {
    snapshot,
    loading: false,
    error: null,
    lastAction: null,
    bootstrapResult: { status: 'accepted' },
    lastPackageDispatch: null,
    lastReceiptSync: null,
    phase1Projection: createPhase1ControlPlaneProjection(),
    openStoryCanvas: storeMock.openStoryCanvas,
  };
}

function renderSurface(view: ProductionView = 'tasks') {
  return render(
    <MemoryRouter initialEntries={['/production/tasks']}>
      <Routes>
        <Route
          path="/production/tasks"
          element={
            <ProductionControlSurface view={view} />
          }
        />
        <Route
          path="/production/canvas/:projectId"
          element={<div>StoryCanvas canonical route</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProductionControlSurface', () => {
  beforeEach(() => {
    storeMock.noop.mockReset();
    storeMock.openStoryCanvas.mockReset();
    setStoreSnapshot(createAcceptedSnapshot());
  });

  it('navigates an accepted package to the embedded StoryCanvas route without popup handoff', async () => {
    const user = userEvent.setup();
    const popupSpy = vi.spyOn(window, 'open');
    renderSurface('inbox');

    await user.click(
      screen.getByRole('button', { name: /进入 StoryCanvas 画布/ }),
    );

    expect(await screen.findByText('StoryCanvas canonical route')).toBeInTheDocument();
    expect(window.location.pathname).not.toContain('storycanvas');
    expect(popupSpy).not.toHaveBeenCalled();
    expect(storeMock.openStoryCanvas).not.toHaveBeenCalled();
  });

  it('requires Task, Asset, and Export Receipt before completing success and opening failure', () => {
    const snapshot = createAcceptedSnapshot();
    const successTask = createCanonicalSuccessTaskReceipt();
    const successAsset = createCanonicalSuccessAssetReceipt();
    snapshot.generationTaskReceipts = [successTask];
    snapshot.assetReceipts = [successAsset];
    setStoreSnapshot(snapshot);

    const view = renderSurface();

    expect(screen.getByRole('button', { name: '同步 Outbox' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reserve 80' })).toBeDisabled();

    const exportReceipt: ExportReceipt = {
      contractVersion: successTask.contractVersion,
      exportId: 'export-demo-success',
      tenantId: successTask.tenantId,
      projectId: successTask.projectId,
      generationTaskId: DEMO_SUCCESS_TASK_ID,
      status: 'succeeded',
      outputAssetIds: [DEMO_SUCCESS_ASSET_ID],
      checksum: 'sha256:demo-success-export',
      error: null,
      idempotencyKey: 'receipt-export-demo-success-v1',
      createdAt: '2026-08-02T12:01:00.000Z',
      truthMode: 'MOCK-CONTRACT',
    };
    snapshot.exportReceipts = [exportReceipt];
    setStoreSnapshot(snapshot);
    view.rerender(
      <MemoryRouter initialEntries={['/production/tasks']}>
        <Routes>
          <Route
            path="/production/tasks"
            element={
              <ProductionControlSurface view={'tasks' as ProductionView} />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: '同步 Outbox' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reserve 80' })).toBeEnabled();
  });

  it('shows the exact Grant rejection reason from the persistent handoff', () => {
    const snapshot = createAcceptedSnapshot();
    setStoreSnapshot(snapshot);
    const projection = createPhase1ControlPlaneProjection();
    projection.handoffs.push({
      packageId: snapshot.package!.packageId,
      projectId: snapshot.package!.projectId,
      packageDigest: snapshot.package!.digest,
      status: 'grant_invalid',
      grantStatus: 'invalid',
      grantId: 'grant-demo-local-001-v1',
      deepLink: null,
      error: {
        code: 'GRANT_EXPIRED',
        message: 'Current Demo grant 已过期，必须重新签发。',
        retryable: false,
        details: { expiresAt: '2026-08-02T12:00:00.000Z' },
      },
      updatedAt: '2026-08-02T12:01:00.000Z',
    });
    storeMock.state.phase1Projection = projection;

    renderSurface('inbox');

    expect(screen.getByText('Production handoff · grant_invalid')).toBeInTheDocument();
    expect(
      screen.getByText(/GRANT_EXPIRED · Current Demo grant 已过期/),
    ).toBeInTheDocument();
  });
});
