import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DemoProjectGrant } from '../../domain/controlPlane';
import { IntegratedStoryCanvasPage } from './IntegratedStoryCanvasPage';

const mocks = vi.hoisted(() => ({
  dispatchCanonicalPackage: vi.fn<() => Promise<null>>(),
  state: {
    snapshot: { grants: [] as DemoProjectGrant[] },
    error: null as { message: string } | null,
  },
}));

vi.mock('../../stores/controlPlaneStore', () => ({
  useControlPlaneStore: (selector: (state: unknown) => unknown) =>
    selector({
      ...mocks.state,
      dispatchCanonicalPackage: mocks.dispatchCanonicalPackage,
    }),
}));

vi.mock('../../features/storycanvas/StoryCanvasApp', () => ({
  StoryCanvasApp: ({ grant }: { grant: DemoProjectGrant }) => (
    <div data-testid="storycanvas-app">{grant.grantId}</div>
  ),
}));

function createGrant(): DemoProjectGrant {
  return {
    grantId: 'grant-demo-local-001-v1',
    grantType: 'DEMO_PROJECT_GRANT',
    mock: true,
    truthMode: 'MOCK-CONTRACT',
    tenantId: 'tenant-demo-hdl',
    organizationId: 'tenant-demo-hdl',
    organizationType: 'TENANT',
    projectId: 'demo-local-001',
    packageId: 'package-demo-local-001-v1',
    packageVersion: 1,
    capabilityIds: ['cap-production-base-generation'],
    scopes: ['production.package.read', 'production.receipt.write'],
    issuedAt: '2026-08-02T11:55:00.000Z',
    expiresAt: '2026-08-02T12:10:00.000Z',
    mockHandle: 'mock-handle:grant-demo-local-001-v1',
    warning: 'DEMO ONLY · NOT A SIGNED TOKEN · DO NOT USE AS CREDENTIAL',
  };
}

function renderPage(path = '/production/canvas/demo-local-001') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/production/canvas/:projectId"
            element={<IntegratedStoryCanvasPage />}
          />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

describe('IntegratedStoryCanvasPage', () => {
  beforeEach(() => {
    mocks.dispatchCanonicalPackage.mockReset();
    mocks.dispatchCanonicalPackage.mockResolvedValue(null);
    mocks.state.snapshot.grants = [];
    mocks.state.error = null;
  });

  it('dispatches the canonical package once under StrictMode and renders the grant', async () => {
    mocks.state.snapshot.grants = [createGrant()];
    renderPage();

    expect(await screen.findByTestId('storycanvas-app')).toHaveTextContent(
      'grant-demo-local-001-v1',
    );
    expect(mocks.dispatchCanonicalPackage).toHaveBeenCalledTimes(1);
  });

  it('shows the preparation failure when the API does not produce a grant', async () => {
    mocks.state.error = { message: 'StoryCanvas API offline' };
    renderPage();

    expect(await screen.findByText('生产授权准备失败')).toBeInTheDocument();
    expect(screen.getByText('StoryCanvas API offline')).toBeInTheDocument();
  });

  it('rejects a non-canonical project without dispatching a package', async () => {
    renderPage('/production/canvas/project-other');

    expect(await screen.findByText('ROUTE_ID_REJECTED')).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.dispatchCanonicalPackage).not.toHaveBeenCalled();
    });
  });
});
