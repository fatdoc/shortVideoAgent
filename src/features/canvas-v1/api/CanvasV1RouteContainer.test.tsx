import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { PilotStoryCanvasBridge } from '../../../services/pilotStoryCanvasBridge';
import { CanvasV1RouteContainer } from './CanvasV1RouteContainer';

const workspace = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      'docs/program/contracts/canvas-v1/fixtures/workspace-materialization.json',
    ),
    'utf8',
  ),
).workspaceResponse;

function bridge(): PilotStoryCanvasBridge {
  return {
    activate: vi.fn(async ({ projectId, packageId }) => ({
      selection: { projectId, packageId },
      canvasSessionId: workspace.canvasSessionId,
      workspace,
    })),
    prepareApproval: vi.fn(async () => ({
      approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      status: 'active' as const,
    })),
    dispatch: vi.fn(async () => workspace.shots[0].event),
    refreshWorkspace: vi.fn(async (state) => state),
  };
}

function renderRoute(
  entry: string,
  adapter: PilotStoryCanvasBridge,
  options: { pollIntervalMs?: number } = {},
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/production/canvas/:projectId"
          element={<CanvasV1RouteContainer bridge={adapter} {...options} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CanvasV1RouteContainer production hydration', () => {
  it('blocks missing package selection before any activation side effect', () => {
    const adapter = bridge();
    renderRoute(`/production/canvas/${workspace.projectId}`, adapter);

    expect(screen.getByTestId('pilot-storycanvas-boundary-blocked')).toHaveTextContent(
      '不会回退 Demo',
    );
    expect(screen.getByRole('link', { name: '选择生产包并进入画布' })).toHaveAttribute(
      'href',
      `/production/inbox/${workspace.projectId}?target=canvas`,
    );
    expect(adapter.activate).not.toHaveBeenCalled();
  });

  it('hydrates CanvasV1Page only from the complete formal workspace', async () => {
    const adapter = bridge();
    renderRoute(
      `/production/canvas/${workspace.projectId}?packageId=${workspace.packageId}`,
      adapter,
    );

    expect(await screen.findByText(workspace.project.projectName)).toBeInTheDocument();
    expect(screen.getAllByText('镜头 01').length).toBeGreaterThan(0);
    expect(screen.getAllByText('门店讲解员').length).toBeGreaterThan(0);
    expect(screen.queryByText('门店探店视频')).not.toBeInTheDocument();
    expect(adapter.activate).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: workspace.projectId,
        packageId: workspace.packageId,
        activationAttemptId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
      }),
    );
  });

  it('fails closed without rendering workspace data when activation rejects', async () => {
    const adapter = bridge();
    vi.mocked(adapter.activate).mockRejectedValueOnce(new Error('unsafe raw upstream detail'));
    renderRoute(
      `/production/canvas/${workspace.projectId}?packageId=${workspace.packageId}`,
      adapter,
    );

    await waitFor(() => {
      expect(screen.getByTestId('pilot-storycanvas-boundary-blocked')).toBeInTheDocument();
    });
    expect(screen.queryByText(workspace.project.projectName)).not.toBeInTheDocument();
    expect(screen.queryByText('unsafe raw upstream detail')).not.toBeInTheDocument();
  });

  it('polls authoritative workspace facts until a submitted generation becomes terminal', async () => {
    const taskCreated = {
      ...workspace.shots[0].event,
      status: 'task_created',
      providerSubmitted: true,
      taskCreated: true,
      outputRegistered: false,
      taskId: '18181818-1818-4818-8818-181818181818',
      outputAssetId: null,
    };
    const outputRegistered = {
      ...taskCreated,
      status: 'output_registered',
      outputRegistered: true,
      outputAssetId: workspace.shots[0].outputs[0].assetId,
    };
    const runningWorkspace = {
      ...workspace,
      shots: [{ ...workspace.shots[0], event: taskCreated }],
    };
    const terminalWorkspace = {
      ...workspace,
      shots: [{ ...workspace.shots[0], event: outputRegistered }],
    };
    const adapter = bridge();
    vi.mocked(adapter.activate).mockResolvedValueOnce({
      selection: { projectId: workspace.projectId, packageId: workspace.packageId },
      canvasSessionId: workspace.canvasSessionId,
      workspace: runningWorkspace,
    });
    vi.mocked(adapter.refreshWorkspace).mockResolvedValueOnce({
      selection: { projectId: workspace.projectId, packageId: workspace.packageId },
      canvasSessionId: workspace.canvasSessionId,
      workspace: terminalWorkspace,
    });

    renderRoute(
      `/production/canvas/${workspace.projectId}?packageId=${workspace.packageId}`,
      adapter,
      { pollIntervalMs: 1 },
    );
    expect(await screen.findByText(workspace.project.projectName)).toBeInTheDocument();
    await waitFor(() => expect(adapter.refreshWorkspace).toHaveBeenCalledTimes(1));
    expect(vi.mocked(adapter.refreshWorkspace).mock.calls[0][0].workspace).toEqual(
      runningWorkspace,
    );
  });
});
