import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/Providers';
import { createControlPlaneDemoState } from '../../mocks/controlPlaneDemo';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';
import { ProductCatalog } from './ProductCatalog';

vi.mock('../../config/pilotRuntime', () => ({
  pilotRuntime: {
    mode: 'pilot',
    controlApiBaseUrl: 'http://127.0.0.1:10600',
    configurationError: null,
  },
}));

describe('ProductCatalog pilot projection', () => {
  beforeEach(() => {
    useControlPlaneStore.setState({ snapshot: createControlPlaneDemoState() });
  });

  it('does not project demo-only visual assets into Pilot product rows', () => {
    render(
      <AppProviders>
        <MemoryRouter>
          <ProductCatalog />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(screen.queryByLabelText('套餐视觉示意，非运行数据')).not.toBeInTheDocument();
    expect(screen.queryByText('视觉示意')).not.toBeInTheDocument();
  });
});
