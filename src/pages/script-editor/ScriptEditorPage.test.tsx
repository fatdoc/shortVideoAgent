import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ScriptEditorPage } from './ScriptEditorPage';

describe('Store visit script page', () => {
  it('keeps fact citations and risks beside the editable script structure', () => {
    render(<MemoryRouter initialEntries={['/projects/demo/script']}><Routes><Route path="/projects/:projectId/script" element={<ScriptEditorPage />} /></Routes></MemoryRouter>);
    expect(screen.getByTestId('script-editor-page')).toBeInTheDocument();
    expect(screen.getByText('事实引用（5）')).toBeInTheDocument();
    expect(screen.getByText('请勿虚构未核实的限量活动。')).toBeInTheDocument();
    expect(screen.getByTestId('script-block-content-hook')).toBeInTheDocument();
  });

  it('moves an approved script into the existing storyboard route', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/projects/demo/script']}><Routes><Route path="/projects/:projectId/script" element={<ScriptEditorPage />} /><Route path="/projects/:projectId/storyboard" element={<div>storyboard route</div>} /></Routes></MemoryRouter>);
    await user.click(screen.getByTestId('script-to-storyboard-btn'));
    expect(await screen.findByText('storyboard route')).toBeInTheDocument();
  });
});
