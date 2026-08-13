import express, { type ErrorRequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE_NAME } from '../auth/session.js';
import type { PublicSession } from '../auth/service.js';
import {
  MemberLastAdminConflictError,
  MemberNotFoundError,
  MemberPermissionDeniedError,
  MemberSelfSuspendForbiddenError,
  MemberStatusConflictError,
  MemberVersionConflictError,
} from './errors.js';
import { createMemberDirectoryRouter } from './routes.js';
import type { MemberProjection } from './types.js';

const organizationId = '10000000-0000-4000-8000-000000000001';
const actorMembershipId = '20000000-0000-4000-8000-000000000001';
const targetMembershipId = '20000000-0000-4000-8000-000000000002';

const member: MemberProjection = {
  membershipId: targetMembershipId,
  displayName: 'Pilot Member',
  email: 'member@example.com',
  status: 'active',
  primaryRole: 'content_operator',
  roles: ['content_operator'],
  version: 2,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-08T00:00:00.000Z',
  isCurrentActor: false,
};

function session(
  organizationType: PublicSession['activeContext']['organizationType'] = 'TENANT',
  roles: PublicSession['roles'] = ['tenant_admin'],
): PublicSession {
  return {
    user: {
      id: '30000000-0000-4000-8000-000000000001',
      email: 'admin@example.com',
      displayName: 'Member Admin',
    },
    tenant: organizationType === 'TENANT' ? { id: organizationId, displayName: 'Tenant' } : null,
    roles,
    activeContext: {
      membershipId: actorMembershipId,
      organizationId,
      organizationType,
      organizationDisplayName: 'Test Organization',
      membershipVersion: 1,
      primaryRole: roles[0] ?? 'content_operator',
      roles,
      tenantId: organizationType === 'TENANT' ? organizationId : null,
    },
    expiresAt: '2026-08-10T00:00:00.000Z',
  };
}

function services() {
  return {
    listCurrentOrganizationMembers: vi.fn(async () => [member]),
    suspendCurrentOrganizationMember: vi.fn(async () => ({
      member: { ...member, status: 'suspended' as const, version: 3 },
      replayed: false,
    })),
  };
}

type TestService = ReturnType<typeof services>;
type ResolveSession = (token: string) => Promise<{ token?: string; session: PublicSession } | null>;

function application(
  options: {
    activeSession?: PublicSession;
    rotatedToken?: string;
    service?: TestService;
    resolveSession?: ResolveSession;
  } = {},
) {
  const service = options.service ?? services();
  const activeSession = options.activeSession ?? session();
  const router = createMemberDirectoryRouter({
    service,
    resolveSession:
      options.resolveSession ??
      vi.fn(async (token: string) =>
        token === 'session-token'
          ? {
              session: activeSession,
              ...(options.rotatedToken ? { token: options.rotatedToken } : {}),
            }
          : null,
      ),
    secureCookies: false,
    sessionTtlSeconds: 3600,
  });
  const app = express();
  app.use((request, response, next) => {
    response.locals.requestId = request.header('x-request-id') ?? 'member-request-id';
    next();
  });
  app.use(express.json());
  app.use('/api/v1', router);
  const errorHandler: ErrorRequestHandler = (_error, _request, response, _next) => {
    void _next;
    response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Control API 发生未预期错误。',
        requestId: response.locals.requestId,
      },
    });
  };
  app.use(errorHandler);
  return { app, service };
}

const cookie = () => `${SESSION_COOKIE_NAME}=session-token`;

describe('Member Directory HTTP API', () => {
  it('requires a valid Session Cookie and preserves rotated cookies', async () => {
    const unauthenticated = await request(application().app).get(
      '/api/v1/organizations/current/members',
    );
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error).toEqual({
      code: 'AUTHENTICATION_REQUIRED',
      message: '请先登录。',
      requestId: 'member-request-id',
    });
    expect(unauthenticated.headers['cache-control']).toBe('no-store');

    const invalidSession = await request(
      application({ resolveSession: vi.fn(async () => null) }).app,
    )
      .get('/api/v1/organizations/current/members')
      .set('cookie', cookie());
    expect(invalidSession.status).toBe(401);
    expect(invalidSession.body.error.code).toBe('SESSION_INVALID');

    const rotated = await request(application({ rotatedToken: 'rotated-token' }).app)
      .get('/api/v1/organizations/current/members')
      .set('cookie', cookie());
    expect(rotated.status).toBe(200);
    expect(rotated.headers['set-cookie']?.[0]).toContain(`${SESSION_COOKIE_NAME}=rotated-token`);
  });

  it('lists the current Organization with strict defaults and canonical actor Scope', async () => {
    const { app, service } = application();
    const response = await request(app)
      .get('/api/v1/organizations/current/members')
      .set('cookie', cookie())
      .set('x-request-id', 'member-list-1');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ members: [member] });
    expect(service.listCurrentOrganizationMembers).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipId: actorMembershipId,
        organizationId,
        organizationType: 'TENANT',
        roles: ['tenant_admin'],
      }),
      { status: 'all', limit: 100 },
    );
  });

  it('passes a strict status/limit query and suspend expectedVersion', async () => {
    const { app, service } = application();
    const listed = await request(app)
      .get('/api/v1/organizations/current/members?status=suspended&limit=25')
      .set('cookie', cookie());
    expect(listed.status).toBe(200);
    expect(service.listCurrentOrganizationMembers).toHaveBeenCalledWith(expect.anything(), {
      status: 'suspended',
      limit: 25,
    });

    const suspended = await request(app)
      .post(`/api/v1/organizations/current/members/${targetMembershipId}/suspend`)
      .set('cookie', cookie())
      .send({ expectedVersion: 2 });
    expect(suspended.status).toBe(200);
    expect(suspended.headers['idempotency-replayed']).toBe('false');
    expect(suspended.body).toEqual({
      member: { ...member, status: 'suspended', version: 3 },
    });
    expect(service.suspendCurrentOrganizationMember).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipId: actorMembershipId,
        organizationId,
        roles: ['tenant_admin'],
      }),
      targetMembershipId,
      2,
    );
  });

  it('marks a duplicate suspend as an explicit resource-state replay', async () => {
    const service = services();
    service.suspendCurrentOrganizationMember.mockResolvedValue({
      member: { ...member, status: 'suspended', version: 7 },
      replayed: true,
    });
    const response = await request(application({ service }).app)
      .post(`/api/v1/organizations/current/members/${targetMembershipId}/suspend`)
      .set('cookie', cookie())
      .send({ expectedVersion: 2 });

    expect(response.status).toBe(200);
    expect(response.headers['idempotency-replayed']).toBe('true');
    expect(response.body.member.version).toBe(7);
  });

  it('rejects invalid query, path and body shapes before calling the Service', async () => {
    const { app, service } = application();
    for (const path of [
      '/api/v1/organizations/current/members?status=unknown',
      '/api/v1/organizations/current/members?limit=0',
      '/api/v1/organizations/current/members?limit=101',
      '/api/v1/organizations/current/members?limit=10&organizationId=probe',
    ]) {
      const response = await request(app).get(path).set('cookie', cookie());
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('MEMBER_QUERY_INVALID');
    }
    for (const requestCase of [
      request(app)
        .post('/api/v1/organizations/current/members/not-a-uuid/suspend')
        .set('cookie', cookie())
        .send({ expectedVersion: 1 }),
      request(app)
        .post(`/api/v1/organizations/current/members/${targetMembershipId}/suspend`)
        .set('cookie', cookie())
        .send({ expectedVersion: 0 }),
      request(app)
        .post(`/api/v1/organizations/current/members/${targetMembershipId}/suspend`)
        .set('cookie', cookie())
        .send({ expectedVersion: 2, organizationId: 'probe' }),
    ]) {
      const response = await requestCase;
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('MEMBER_REQUEST_INVALID');
    }
    expect(service.listCurrentOrganizationMembers).not.toHaveBeenCalled();
    expect(service.suspendCurrentOrganizationMember).not.toHaveBeenCalled();
  });

  it.each([
    [new MemberPermissionDeniedError(), 403, 'MEMBER_PERMISSION_DENIED'],
    [new MemberNotFoundError(), 404, 'MEMBER_NOT_FOUND'],
    [new MemberSelfSuspendForbiddenError(), 409, 'MEMBER_SELF_SUSPEND_FORBIDDEN'],
    [new MemberLastAdminConflictError(), 409, 'MEMBER_LAST_ADMIN_CONFLICT'],
    [new MemberVersionConflictError(), 409, 'MEMBER_VERSION_CONFLICT'],
    [new MemberStatusConflictError(), 409, 'MEMBER_STATUS_CONFLICT'],
  ] as const)('maps safe stable domain errors', async (error, status, code) => {
    const service = services();
    service.suspendCurrentOrganizationMember.mockRejectedValue(error);
    const response = await request(application({ service }).app)
      .post(`/api/v1/organizations/current/members/${targetMembershipId}/suspend`)
      .set('cookie', cookie())
      .send({ expectedVersion: 2 });

    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe(code);
    expect(response.body.error.requestId).toBe('member-request-id');
    expect(response.text).not.toContain(error.message);
  });

  it('passes unexpected failures to the safe application error boundary', async () => {
    const service = services();
    service.listCurrentOrganizationMembers.mockRejectedValue(
      new Error('select password_hash from secret_table'),
    );
    const response = await request(application({ service }).app)
      .get('/api/v1/organizations/current/members')
      .set('cookie', cookie());

    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Control API 发生未预期错误。',
      requestId: 'member-request-id',
    });
    expect(response.text).not.toContain('password_hash');
  });
});
