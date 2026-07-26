import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/Providers';
import { DEMO_PROJECT_ID } from '../../domain/constants';
import { cloneDemoWorkspace } from '../../mocks/demoWorkspace';
import { clearWorkspace } from '../../services/storage';
import { useProjectStore } from '../../stores/projectStore';
import { BrandBrainPage } from './BrandBrainPage';

function renderPage() {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[`/projects/${DEMO_PROJECT_ID}/brand`]}>
        <Routes>
          <Route path="/projects/:projectId/brand" element={<BrandBrainPage />} />
          <Route path="/projects/:projectId/script" element={<div>Script route</div>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('BrandBrainPage', () => {
  const originalGetComputedStyle = window.getComputedStyle.bind(window);

  beforeEach(() => {
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
      originalGetComputedStyle(element),
    );
    clearWorkspace();
    window.localStorage.clear();
    useProjectStore.setState({
      workspace: cloneDemoWorkspace(),
      loading: false,
      error: null,
      hydrated: true,
      lastAction: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the dense merchant overview and unified C1-C8 facts', () => {
    renderPage();
    expect(screen.getByTestId('brand-brain-page')).toBeInTheDocument();
    expect(screen.getAllByText('海底捞火锅·北京三里屯店').length).toBeGreaterThan(0);
    expect(screen.getByText('四宫格锅底')).toBeInTheDocument();
    expect(screen.getByTestId('brand-facts-panel')).toBeInTheDocument();
    expect(screen.getByText('C1')).toBeInTheDocument();
    expect(screen.getByText('C8')).toBeInTheDocument();
  });

  it('edits merchant data and persists through updateBrand', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId('brand-edit'));
    const merchant = screen.getByTestId('brand-merchant-input');
    fireEvent.change(merchant, { target: { value: '海底捞火锅·北京三里屯旗舰店' } });
    await user.click(screen.getByTestId('brand-drawer-save'));
    await waitFor(() => {
      expect(useProjectStore.getState().workspace.brand.merchant).toBe(
        '海底捞火锅·北京三里屯旗舰店',
      );
    }, { timeout: 3000 });
    expect(await screen.findByText('已保存')).toBeInTheDocument();
  });

  it('changes claim status and saves it to the shared workspace', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: '事实库' }));
    await user.click(screen.getByRole('combobox', { name: 'C1 状态' }));
    await user.click(await screen.findByText('待复核'));
    await user.click(screen.getByTestId('brand-save'));
    await waitFor(() => {
      expect(useProjectStore.getState().workspace.brand.facts[0].status).toBe('pending');
    });
  });

  it('opens the script page entry', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId('brand-to-script'));
    expect(await screen.findByText('Script route')).toBeInTheDocument();
  });
});
