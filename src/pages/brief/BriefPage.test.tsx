import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { BriefPage } from './BriefPage';

describe('Acquisition campaign page', () => {
  it('labels real delivery dependencies and enters the script route', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/projects/new']}><Routes><Route path="/projects/new" element={<BriefPage />} /><Route path="/projects/:projectId/script" element={<div>script route</div>} /></Routes></MemoryRouter>);
    expect(screen.getByText('真实投放未接通')).toBeInTheDocument();
    expect(screen.getByText('追踪链接待配置')).toBeInTheDocument();
    await user.click(screen.getByTestId('campaign-generate-script'));
    expect(await screen.findByText('script route')).toBeInTheDocument();
  });
});
