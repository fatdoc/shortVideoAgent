import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';
import { useAuthStore } from '../../stores/authStore';

describe('V3 neutral login entry', () => {
  const login = vi.fn().mockReturnValue(null);

  beforeEach(() => {
    login.mockClear();
    useAuthStore.setState({
      status: 'anonymous',
      identity: null,
      currentIdentity: null,
      activeOrganization: null,
      activeMembership: null,
      allowedWorkbenches: [],
      defaultRoute: null,
      error: null,
      isAuthenticated: false,
      login,
      clearError: vi.fn(),
    });
  });

  it('keeps Demo login functional without old branding, KPI cases, or role shortcuts', async () => {
    const { container } = render(<LoginPage />);

    expect(screen.getByTestId('login-page')).toHaveClass('va-auth-page');
    expect(screen.getByRole('heading', { name: '登录工作台' })).toBeInTheDocument();
    expect(screen.queryByTestId('demo-identities')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent(/海底捞|短视频营销 Agent|快速选择演示身份|统一密码|KPI/i);
    expect(container.querySelector('img')).toBeNull();

    fireEvent.change(screen.getByTestId('login-account'), {
      target: { value: 'tenant' },
    });
    fireEvent.change(screen.getByTestId('login-password'), {
      target: { value: 'demo-password' },
    });
    fireEvent.click(screen.getByTestId('login-submit'));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({ loginName: 'tenant', password: 'demo-password' });
    });
  });
});
