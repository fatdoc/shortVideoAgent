import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../app/App';

describe('app smoke', () => {
  it('renders dashboard placeholder through router', async () => {
    window.history.pushState({}, '', '/dashboard');
    render(<App />);
    expect(await screen.findByText('工作台 / 项目列表')).toBeInTheDocument();
    expect(screen.getByText('短视频 Agent')).toBeInTheDocument();
  });
});
