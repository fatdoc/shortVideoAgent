import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { BrandBrainPage } from './BrandBrainPage';

describe('Store profile page', () => {
  it('shows verified store facts, sources and validity information', () => {
    render(<MemoryRouter><BrandBrainPage /></MemoryRouter>);
    expect(screen.getByTestId('store-profile-page')).toBeInTheDocument();
    expect(screen.getByText('资料来源')).toBeInTheDocument();
    expect(screen.getByText('食品经营许可证')).toBeInTheDocument();
    expect(screen.getByText('96%')).toBeInTheDocument();
  });
});
