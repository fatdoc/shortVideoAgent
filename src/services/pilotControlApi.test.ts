import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/pilotRuntime', () => ({
  pilotRuntime: {
    mode: 'pilot',
    controlApiBaseUrl: 'https://control.example.com',
    configurationError: null,
  },
}));

import {
  hydratePilotSession,
  listPilotProjects,
  loginToPilot,
  logoutPilotSession,
  readPilotProject,
} from './pilotControlApi';

const session = {
  user: { id: 'user-1', email: 'pilot@example.com', displayName: '试点用户' },
  tenant: { id: 'tenant-1', displayName: '试点企业' },
  roles: ['tenant_admin'],
  activeContext: {
    membershipId: 'membership-1',
    organizationId: 'tenant-1',
    organizationType: 'TENANT',
    organizationDisplayName: '试点企业',
    membershipVersion: 3,
    primaryRole: 'tenant_admin',
    roles: ['tenant_admin'],
    tenantId: 'tenant-1',
  },
  expiresAt: '2026-08-08T00:00:00.000Z',
};

const project = {
  id: 'project-1',
  name: '真实项目',
  status: 'active',
  platform: 'douyin',
  aspectRatio: '9:16',
  targetDurationSeconds: 30,
  createdBy: 'user-1',
  createdAt: '2026-08-07T00:00:00.000Z',
  updatedAt: '2026-08-07T01:00:00.000Z',
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

  it('logs in with the complete active Membership Context without persisting data', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ session, returnTo: '/pilot' }));

    await expect(
      loginToPilot({ email: ' pilot@example.com ', password: 'secret' }),
    ).resolves.toMatchObject({
      user: { id: 'user-1' },
      tenant: { id: 'tenant-1' },
      activeContext: {
        membershipId: 'membership-1',
        organizationType: 'TENANT',
        membershipVersion: 3,
      },
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

  it('accepts a non-Tenant active context without inventing Tenant scope', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        session: {
          ...session,
          tenant: null,
          roles: ['platform_admin'],
          activeContext: {
            ...session.activeContext,
            organizationId: 'platform-1',
            organizationType: 'PLATFORM',
            organizationDisplayName: '试点平台',
            primaryRole: 'platform_admin',
            roles: ['platform_admin'],
            tenantId: null,
          },
        },
      }),
    );

    await expect(hydratePilotSession()).resolves.toMatchObject({
      tenant: null,
      activeContext: { organizationType: 'PLATFORM', tenantId: null },
    });
  });

  it('rejects inconsistent, incomplete, or unknown active contexts', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          session: {
            ...session,
            activeContext: { ...session.activeContext, membershipId: '' },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          session: {
            ...session,
            roles: ['unknown_role'],
            activeContext: {
              ...session.activeContext,
              primaryRole: 'unknown_role',
              roles: ['unknown_role'],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          session: {
            ...session,
            tenant: { id: 'tenant-other', displayName: '错误企业' },
          },
        }),
      );

    await expect(hydratePilotSession()).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
    await expect(hydratePilotSession()).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
    await expect(hydratePilotSession()).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
  });

  it('lists and reads only strictly parsed Control API projects', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ projects: [project] }))
      .mockResolvedValueOnce(jsonResponse(project));

    await expect(listPilotProjects()).resolves.toEqual([project]);
    await expect(readPilotProject('project/with slash')).resolves.toEqual(project);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://control.example.com/api/v1/projects',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://control.example.com/api/v1/projects/project%2Fwith%20slash',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(window.localStorage.length).toBe(0);
  });

  it('rejects malformed project list and project read payloads', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ projects: [{ ...project, id: '' }] }))
      .mockResolvedValueOnce(jsonResponse({ ...project, targetDurationSeconds: 0 }));

    await expect(listPilotProjects()).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
    await expect(readPilotProject('project-1')).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
    });
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

  it('preserves 403, 404, 5xx and network failures instead of returning mock data', async () => {
    for (const [status, code] of [
      [403, 'PERMISSION_DENIED'],
      [404, 'PROJECT_NOT_FOUND'],
      [500, 'INTERNAL_ERROR'],
    ] as const) {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: { code, message: '请求失败', requestId: `req-${status}` } }, status),
      );
      await expect(listPilotProjects()).rejects.toMatchObject({
        code,
        status,
        requestId: `req-${status}`,
      });
    }

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
