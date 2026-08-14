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
    expect(screen.getByText('仅填充邮箱，实际权限由服务端账号决定')).toBeInTheDocument();

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

  it('fills the email from a local quick account without granting a browser-side role', async () => {
    render(<LoginPage />);

    fireEvent.mouseDown(screen.getByRole('combobox', { name: '快捷账号' }));
    fireEvent.click(await screen.findByText('内容运营'));

    expect(screen.getByTestId('pilot-login-email')).toHaveValue('operator@videoagent.test');
    expect(login).not.toHaveBeenCalled();
    expect(screen.getByTestId('pilot-login-password')).toHaveFocus();
  });

  it('offers a Pilot-only registration entry without changing Demo login behavior', () => {
    const onRegister = vi.fn();
    render(<LoginPage onRegister={onRegister} />);

    fireEvent.click(screen.getByRole('button', { name: '创建账号' }));

    expect(onRegister).toHaveBeenCalledTimes(1);
  });
});
