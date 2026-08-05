import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    const user = userEvent.setup();
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: '白名单账号登录' })).toBeInTheDocument();
    expect(screen.queryByTestId('demo-identities')).not.toBeInTheDocument();

    await user.type(screen.getByTestId('pilot-login-email'), 'pilot@example.com');
    await user.type(screen.getByTestId('pilot-login-password'), 'secret');
    await user.click(screen.getByTestId('pilot-login-submit'));

    expect(login).toHaveBeenCalledWith({ email: 'pilot@example.com', password: 'secret' });
    expect(screen.getByTestId('pilot-login-password')).toHaveAttribute('type', 'password');
  });
});
