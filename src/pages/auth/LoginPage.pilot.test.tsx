import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/pilotRuntime', () => ({
  pilotRuntime: {
    mode: 'pilot',
    controlApiBaseUrl: 'https://control.example.com',
    configurationError: null,
  },
}));

import { LoginPage } from './LoginPage';
import { usePilotAuthStore } from '../../stores/pilotAuthStore';

describe('Pilot login page', () => {
  const login = vi.fn().mockResolvedValue(null);

  beforeEach(() => {
    login.mockClear();
    usePilotAuthStore.setState({
      status: 'anonymous',
      session: null,
      error: null,
      requestId: null,
      login,
    });
  });

  it('only offers real allowlist login and wires credentials to the Pilot store', async () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: '白名单账号登录' })).toBeInTheDocument();
    expect(screen.queryByTestId('demo-identities')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('pilot-login-email'), {
      target: { value: 'pilot@example.com' },
    });
    fireEvent.change(screen.getByTestId('pilot-login-password'), {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByTestId('pilot-login-submit'));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({ email: 'pilot@example.com', password: 'secret' });
    });
    expect(screen.getByTestId('pilot-login-password')).toHaveAttribute('type', 'password');
  });

  it('offers a Pilot-only registration entry without changing Demo login behavior', () => {
    const onRegister = vi.fn();
    render(<LoginPage onRegister={onRegister} />);

    fireEvent.click(screen.getByRole('button', { name: '创建账号' }));

    expect(onRegister).toHaveBeenCalledTimes(1);
  });
});
