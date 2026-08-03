import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/Providers';
import type { ExportReceipt } from '../../domain/controlPlane';
import {
  createCanonicalFailureTaskReceipt,
  createCanonicalSuccessAssetReceipt,
  createCanonicalSuccessTaskReceipt,
  createControlPlaneDemoState,
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

describe('DashboardPage', () => {
  beforeEach(() => {
    useControlPlaneStore.setState({ snapshot: createControlPlaneDemoState() });
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
    expect(screen.getByTestId('dashboard-production-results')).toHaveTextContent('GenerationTask');
  });

  it('summarizes production receipt metadata without rendering receipt payload details', () => {
    const snapshot = createControlPlaneDemoState();
    const successTask = createCanonicalSuccessTaskReceipt();
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
    snapshot.generationTaskReceipts = [successTask, createCanonicalFailureTaskReceipt()];
    snapshot.assetReceipts = [successAsset];
    snapshot.exportReceipts = [exportReceipt];
    useControlPlaneStore.setState({ snapshot });

    renderPage();

    const results = screen.getByTestId('dashboard-production-results');
    expect(results).toHaveTextContent('GenerationTask2');
    expect(results).toHaveTextContent('成功 1');
    expect(results).toHaveTextContent('失败 1');
    expect(results).toHaveTextContent('Asset1');
    expect(results).toHaveTextContent('已通过 1');
    expect(results).toHaveTextContent('Export1');
    expect(results).not.toHaveTextContent(successAsset.storageReference);
    expect(results).not.toHaveTextContent(successTask.inputDigest);
  });

  it('opens the Brief route from new project', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId('dashboard-new-project'));
    expect(await screen.findByText('Brief route')).toBeInTheDocument();
  });
});
