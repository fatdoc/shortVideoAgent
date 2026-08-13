import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  PilotCanvasBootstrapError,
  PilotCanvasBoundaryPage,
  PilotScriptBoundaryPage,
  PilotStoryboardBoundaryPage,
  type PilotCanvasEntryReference,
} from './PilotProductionBoundaryPages';

const entry: PilotCanvasEntryReference = {
  handle: `ce_${'A'.repeat(32)}`,
  tenantId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  packageId: '33333333-3333-4333-8333-333333333333',
};

describe('B-owned Pilot production boundaries', () => {
  it('exports stable Script and Storyboard boundaries without Demo state', () => {
    render(<PilotScriptBoundaryPage projectId={entry.projectId} />);
    expect(screen.getByTestId('pilot-script-boundary')).toHaveAttribute('data-project-id', entry.projectId);
    render(<PilotStoryboardBoundaryPage projectId={entry.projectId} />);
    expect(screen.getByTestId('pilot-storyboard-boundary')).toHaveAttribute('data-project-id', entry.projectId);
  });

  it('fails closed when no deterministic Package-backed Entry exists', () => {
    render(<PilotCanvasBoundaryPage projectId={entry.projectId} entry={null} consumer={{ openEntry: vi.fn() }} />);
    expect(screen.getByTestId('pilot-storycanvas-boundary-blocked')).toHaveTextContent('尚未准备');
    expect(screen.queryByTestId('demo-integrated-storycanvas-page')).not.toBeInTheDocument();
  });

  it('opens only the exact Entry and exposes safe ready selectors', async () => {
    const openEntry = vi.fn(async () => ({
      schemaVersion: 'pilot-canvas-bootstrap.v1' as const,
      status: 'ready' as const,
      projectId: entry.projectId,
      packageId: entry.packageId,
      canvasSessionId: `pcs_${'A'.repeat(32)}`,
      expiresAt: '2026-08-12T01:30:00.000Z',
      requestId: 'request-ui-1',
    }));
    render(<PilotCanvasBoundaryPage projectId={entry.projectId} entry={entry} consumer={{ openEntry }} />);
    await waitFor(() => expect(screen.getByTestId('pilot-storycanvas-boundary-ready')).toBeInTheDocument());
    expect(openEntry).toHaveBeenCalledTimes(1);
    expect(openEntry).toHaveBeenCalledWith(entry);
    expect(document.body.textContent).not.toContain(entry.handle);
    expect(document.body.textContent).not.toContain(entry.packageId);
  });

  it('shows only a safe Request ID and allows bounded user-driven retry', async () => {
    const openEntry = vi.fn()
      .mockRejectedValueOnce(new PilotCanvasBootstrapError(503, 'PILOT_CANVAS_DEPENDENCY_UNAVAILABLE', true, 'request-safe-1'))
      .mockResolvedValueOnce({
        schemaVersion: 'pilot-canvas-bootstrap.v1' as const,
        status: 'ready' as const,
        projectId: entry.projectId,
        packageId: entry.packageId,
        canvasSessionId: `pcs_${'B'.repeat(32)}`,
        expiresAt: '2026-08-12T01:30:00.000Z',
        requestId: 'request-safe-2',
      });
    render(<PilotCanvasBoundaryPage projectId={entry.projectId} entry={entry} consumer={{ openEntry }} />);
    expect(await screen.findByTestId('pilot-storycanvas-boundary-error')).toHaveAttribute('data-error-status', '503');
    expect(screen.getByTestId('pilot-storycanvas-request-id')).toHaveTextContent('request-safe-1');
    fireEvent.click(screen.getByTestId('pilot-storycanvas-retry'));
    expect(await screen.findByTestId('pilot-storycanvas-boundary-ready')).toBeInTheDocument();
    expect(openEntry).toHaveBeenCalledTimes(2);
  });
});
