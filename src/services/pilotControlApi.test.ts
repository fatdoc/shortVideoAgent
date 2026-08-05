import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/pilotRuntime', () => ({
  pilotRuntime: {
    mode: 'pilot',
    controlApiBaseUrl: 'https://control.example.com',
    configurationError: null,
  },
}));

import { hydratePilotSession, loginToPilot, logoutPilotSession } from './pilotControlApi';

const session = {
  user: { id: 'user-1', email: 'pilot@example.com', displayName: '试点用户' },
  tenant: { id: 'tenant-1', displayName: '试点企业' },
  roles: ['tenant_admin'],
  expiresAt: '2026-08-06T00:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200, requestId = 'req-1') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-request-id': requestId },
  });
}

describe('pilot Control API adapter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    window.localStorage.clear();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('logs in with Cookie credentials without persisting password or session data', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ session, returnTo: '/pilot' }));

    await expect(
      loginToPilot({ email: ' pilot@example.com ', password: 'secret' }),
    ).resolves.toMatchObject({
      user: { id: 'user-1' },
      tenant: { id: 'tenant-1' },
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://control.example.com/api/v1/auth/login',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    const request = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      email: 'pilot@example.com',
      password: 'secret',
      returnTo: '/pilot',
    });
    expect(window.localStorage.length).toBe(0);
  });

  it('restores a server session and treats the error envelope as authoritative', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ session }));
    await expect(hydratePilotSession()).resolves.toMatchObject({
      user: { email: 'pilot@example.com' },
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '邮箱或密码不正确。',
            requestId: 'req-invalid',
          },
        },
        401,
      ),
    );
    await expect(
      loginToPilot({ email: 'pilot@example.com', password: 'wrong' }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      status: 401,
      requestId: 'req-invalid',
    });
  });

  it('surfaces 5xx and network failures instead of returning mock data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        { error: { code: 'INTERNAL_ERROR', message: '服务错误', requestId: 'req-500' } },
        500,
      ),
    );
    await expect(hydratePilotSession()).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId: 'req-500',
    });

    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('network down'));
    await expect(hydratePilotSession()).rejects.toEqual(
      expect.objectContaining({
        code: 'CONTROL_API_UNREACHABLE',
        status: null,
      }),
    );
  });

  it('revokes the server session using Cookie credentials', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    await logoutPilotSession();
    expect(fetch).toHaveBeenCalledWith(
      'https://control.example.com/api/v1/auth/logout',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });
});
