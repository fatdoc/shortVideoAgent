import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DemoTruthBar } from './WorkbenchChrome';

describe('V3 workbench chrome', () => {
  it('shows a safe governance status without exposing fixture digests', () => {
    const { container } = render(<DemoTruthBar />);

    expect(screen.getByTestId('demo-truth-bar')).toHaveClass('va-truth-bar');
    expect(container).not.toHaveTextContent(/Fixture|digest|[a-f0-9]{16,}/i);
  });
});
