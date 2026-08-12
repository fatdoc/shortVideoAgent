import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProductCatalogPage } from './ProductCatalogPage';

describe('Store offer catalog', () => {
  it('shows offer facts without claiming live inventory or provider synchronization', () => {
    render(<MemoryRouter><ProductCatalogPage /></MemoryRouter>);
    expect(screen.getByTestId('store-offer-page')).toBeInTheDocument();
    expect(screen.getAllByText('平台待同步').length).toBeGreaterThan(0);
    expect(screen.getByText('手冲体验 ¥68')).toBeInTheDocument();
  });
});
