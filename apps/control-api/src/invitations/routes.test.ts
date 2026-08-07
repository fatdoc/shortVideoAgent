import express, { type ErrorRequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { PublicSession } from '../auth/service.js';
import {
  InvitationIdempotencyConflictError,
  InvitationNotFoundError,
  InvitationPermissionDeniedError,
  InvitationScopeConflictError,
  InvitationStateConflictError,
  InvitationUnavailableError,
} from './errors.js';
import { createInvitationRouter } from './routes.js';
import type { Invitation, InvitationActor } from './types.js';

const now = new Date('2026-08-07T12:00:00.000Z');
const token = 'A'.repeat(43);
const invitationId = '30000000-0000-4000-8000-000000000001';
const platformOrganizationId = '10000000-0000-4000-8000-000000000001';
const channelOrganizationId = '10000000-0000-4000-8000-000000000002';
const tenantOrganizationId = '10000000-0000-4000-8000-000000000003';
const platformMembershipId = '20000000-0000-4000-8000-000000000001';
const channelMembershipId = '20000000-0000-4000-8000-000000000002';
const tenantMembershipId = '20000000-0000-4000-8000-000000000003';
const channelId = '40000000-0000-4000-8000-000000000001';

const platformInvitation: Invitation = {
  invitationId,
  issuerMembershipId: platformMembershipId,
  issuerOrganizationId: platformOrganizationId,
  invitationType: 'PLATFORM',
  targetOrganizationId: null,
  targetRoleCode: null,
  targetEmailNormalized: 'new-user@example.com',
  attributionChannelId: channelId,
  status: 'active',
  validFrom: now.toISOString(),
  expiresAt: '2026-08-14T12:00:00.000Z',
  maxUses: 1,
  usedCount: 0,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  revokedAt: null,
  revokedByMembershipId: null,
};

function session(
  organizationType: PublicSession['activeContext']['organizationType'],
  roles: PublicSession['roles'],
): PublicSession {
  const organizationId =
    organizationType === 'PLATFORM'
      ? platformOrganizationId
      : organizationType === 'CHANNEL'
        ? channelOrganizationId
        : tenantOrganizationId;
  const membershipId =
    organizationType === 'PLATFORM'
      ? platformMembershipId
      : organizationType === 'CHANNEL'
        ? channelMembershipId
        : tenantMembershipId;
  return {
    user: {
      id: '50000000-0000-4000-8000-000000000001',
      email: 'admin@example.com',
      displayName: 'Invitation Admin',
    },
    tenant:
      organizationType === 'TENANT' ? { id: tenantOrganizationId, displayName: 'Tenant' } : null,
    roles,
    activeContext: {
      membershipId,
      organizationId,
      organizationType,
      organizationDisplayName: 'Test Organization',
      membershipVersion: 1,
      primaryRole: roles[0] ?? 'pilot_support',
      roles,
      tenantId: organizationType === 'TENANT' ? tenantOrganizationId : null,
    },
    expiresAt: '2026-08-08T00:00:00.000Z',
  };
}

function actor(organizationType: InvitationActor['organizationType']): InvitationActor {
  const resolved = session(
    organizationType,
    organizationType === 'PLATFORM'
      ? ['platform_admin']
      : organizationType === 'CHANNEL'
        ? ['channel_admin']
        : ['tenant_admin'],
  );
  return {
    userId: resolved.user.id,
    membershipId: resolved.activeContext.membershipId,
    organizationId: resolved.activeContext.organizationId,
    organizationType,
    roles: resolved.activeContext.roles,
  };
}

function service() {
  return {
    createPlatformInvitation: vi.fn(async () => ({
      invitation: platformInvitation,
      token,
      replayed: false,
    })),
    createChannelInvitation: vi.fn(async () => ({
      invitation: {
        ...platformInvitation,
        issuerMembershipId: channelMembershipId,
        issuerOrganizationId: channelOrganizationId,
        invitationType: 'CHANNEL' as const,
        targetEmailNormalized: null,
      },
      token,
      replayed: false,
    })),
    createTenantMemberInvitation: vi.fn(async () => ({
      invitation: {
        ...platformInvitation,
        issuerMembershipId: tenantMembershipId,
        issuerOrganizationId: tenantOrganizationId,
        invitationType: 'TENANT_MEMBER' as const,
        targetOrganizationId: tenantOrganizationId,
        targetRoleCode: 'content_operator' as const,
        targetEmailNormalized: 'worker@example.com',
        attributionChannelId: null,
      },
      token,
      replayed: false,
    })),
    listInvitations: vi.fn(async () => [platformInvitation]),
    preview: vi.fn(async () => platformInvitation),
    revokeInvitation: vi.fn(async () => ({
      value: {
        ...platformInvitation,
        status: 'revoked' as const,
        revokedAt: now.toISOString(),
        revokedByMembershipId: platformMembershipId,
      },
      replayed: false,
    })),
  };
}

type TestService = ReturnType<typeof service>;
type ResolveSession = (value: string) => Promise<{ token?: string; session: PublicSession } | null>;

function app(
  invitationService: TestService,
  options: {
    resolveSession?: ResolveSession;
    resolveChannelIdForOrganization?: (organizationId: string) => Promise<string | null>;
    limiter?: {
      retryAfterSeconds(key: string): number | null;
      record(key: string): void;
    };
  } = {},
) {
  const application = express();
  application.set('trust proxy', 1);
  application.use(express.json({ limit: '1mb', strict: true }));
  application.use((_request, response, next) => {
    response.locals.requestId = 'invitation-request-1';
    next();
  });
  application.use(
    '/api/v1',
    createInvitationRouter({
      service: invitationService,
      limiter: options.limiter ?? {
        retryAfterSeconds: () => null,
        record: () => undefined,
      },
      resolveSession:
        options.resolveSession ??
        (async (value) =>
          value === 'platform-session'
            ? { session: session('PLATFORM', ['platform_admin']) }
            : value === 'channel-session'
              ? { session: session('CHANNEL', ['channel_admin']) }
              : value === 'tenant-session'
                ? { session: session('TENANT', ['tenant_admin']) }
                : null),
      resolveChannelIdForOrganization:
        options.resolveChannelIdForOrganization ?? (async () => channelId),
      secureCookies: false,
      sessionTtlSeconds: 28_800,
    }),
  );
  const errors: ErrorRequestHandler = (_error, _request, response, next) => {
    void next;
    response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected error.',
        requestId: response.locals.requestId,
      },
    });
  };
  application.use(errors);
  return application;
}

function managementInvitation() {
  return {
    invitationId,
    invitationType: 'PLATFORM',
    targetOrganizationId: null,
    targetRoleCode: null,
    targetEmail: 'new-user@example.com',
    attributionChannelId: channelId,
    status: 'active',
    validFrom: now.toISOString(),
    expiresAt: '2026-08-14T12:00:00.000Z',
    maxUses: 1,
    usedCount: 0,
    remainingUses: 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    revokedAt: null,
  };
}

describe('Invitation HTTP contract', () => {
  it('previews by POST body with a public whitelist and no sensitive issuer or email facts', async () => {
    const invitationService = service();
    const limiter = {
      retryAfterSeconds: vi.fn(() => null),
      record: vi.fn(),
    };
    const response = await request(app(invitationService, { limiter }))
      .post('/api/v1/public/invitations/preview')
      .set('x-forwarded-for', '203.0.113.10')
      .send({ token });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      invitation: {
        invitationType: 'PLATFORM',
        targetRoleCode: null,
        targetOrganizationId: null,
        attributionChannelId: channelId,
        expiresAt: '2026-08-14T12:00:00.000Z',
        remainingUses: 1,
      },
    });
    expect(response.text).not.toContain(token);
    expect(response.text).not.toContain('new-user@example.com');
    expect(response.text).not.toContain(platformMembershipId);
    expect(invitationService.preview).toHaveBeenCalledWith(token);
    const limiterKey = limiter.retryAfterSeconds.mock.calls[0]?.[0];
    expect(limiterKey).toMatch(/^[0-9a-f]{64}$/);
    expect(limiterKey).not.toContain(token);
    expect(limiter.record).toHaveBeenCalledWith(limiterKey);
  });

  it('strictly rejects malformed Preview bodies before calling the service', async () => {
    const invitationService = service();
    const response = await request(app(invitationService))
      .post('/api/v1/public/invitations/preview')
      .send({ token, issuerOrganizationId: platformOrganizationId });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVITATION_VALIDATION_FAILED');
    expect(invitationService.preview).not.toHaveBeenCalled();
  });

  it('makes every unavailable Preview state a stable 404 and rate limits by an opaque key', async () => {
    const invitationService = service();
    invitationService.preview.mockRejectedValueOnce(new InvitationUnavailableError());
    const unavailable = await request(app(invitationService))
      .post('/api/v1/public/invitations/preview')
      .send({ token: 'malformed-token' });
    expect(unavailable.status).toBe(404);
    expect(unavailable.body.error.code).toBe('INVITATION_UNAVAILABLE');

    const limitedService = service();
    const limited = await request(
      app(limitedService, {
        limiter: { retryAfterSeconds: () => 17, record: vi.fn() },
      }),
    )
      .post('/api/v1/public/invitations/preview')
      .send({ token });
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBe('17');
    expect(limited.body.error.code).toBe('INVITATION_RATE_LIMITED');
    expect(limitedService.preview).not.toHaveBeenCalled();
  });

  it('requires a valid session and preserves session rotation on management calls', async () => {
    const invitationService = service();
    const missing = await request(app(invitationService)).get('/api/v1/platform/invitations');
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('AUTHENTICATION_REQUIRED');

    const invalid = await request(app(invitationService))
      .get('/api/v1/platform/invitations')
      .set('cookie', 'videoagent_session=invalid-session');
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.code).toBe('SESSION_INVALID');

    const rotated = await request(
      app(invitationService, {
        resolveSession: async () => ({
          token: 'rotated-session',
          session: session('PLATFORM', ['platform_admin']),
        }),
      }),
    )
      .get('/api/v1/platform/invitations')
      .set('cookie', 'videoagent_session=old-session');
    expect(rotated.status).toBe(200);
    expect(rotated.headers['set-cookie']?.join(';')).toContain(
      'videoagent_session=rotated-session',
    );
  });

  it('creates and lists PLATFORM invitations with strict client-writable fields and replay metadata', async () => {
    const invitationService = service();
    const created = await request(app(invitationService))
      .post('/api/v1/platform/invitations')
      .set('cookie', 'videoagent_session=platform-session')
      .send({
        targetEmail: 'new-user@example.com',
        attributionChannelId: channelId,
        idempotencyKey: 'platform-create-1',
      });

    expect(created.status).toBe(201);
    expect(created.headers['idempotency-replayed']).toBe('false');
    expect(created.body).toEqual({ invitation: managementInvitation(), token });
    expect(invitationService.createPlatformInvitation).toHaveBeenCalledWith(actor('PLATFORM'), {
      targetEmail: 'new-user@example.com',
      attributionChannelId: channelId,
      idempotencyKey: 'platform-create-1',
    });

    invitationService.createPlatformInvitation.mockResolvedValueOnce({
      invitation: platformInvitation,
      token: null,
      replayed: true,
    });
    const replay = await request(app(invitationService))
      .post('/api/v1/platform/invitations')
      .set('cookie', 'videoagent_session=platform-session')
      .send({
        targetEmail: 'new-user@example.com',
        attributionChannelId: channelId,
        idempotencyKey: 'platform-create-1',
      });
    expect(replay.status).toBe(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(replay.body.token).toBeNull();

    const listed = await request(app(invitationService))
      .get('/api/v1/platform/invitations')
      .set('cookie', 'videoagent_session=platform-session');
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual({ invitations: [managementInvitation()] });

    const rejected = await request(app(invitationService))
      .post('/api/v1/platform/invitations')
      .set('cookie', 'videoagent_session=platform-session')
      .send({
        targetEmail: 'new-user@example.com',
        attributionChannelId: channelId,
        idempotencyKey: 'platform-create-2',
        maxUses: 999,
      });
    expect(rejected.status).toBe(400);
    expect(invitationService.createPlatformInvitation).toHaveBeenCalledTimes(2);
  });

  it('validates CHANNEL path ownership instead of trusting the client path', async () => {
    const invitationService = service();
    const created = await request(app(invitationService))
      .post(`/api/v1/channels/${channelId}/invitations`)
      .set('cookie', 'videoagent_session=channel-session')
      .send({ idempotencyKey: 'channel-create-1' });
    expect(created.status).toBe(201);
    expect(invitationService.createChannelInvitation).toHaveBeenCalledWith(actor('CHANNEL'), {
      idempotencyKey: 'channel-create-1',
    });

    const mismatch = await request(app(invitationService))
      .get('/api/v1/channels/40000000-0000-4000-8000-000000000099/invitations')
      .set('cookie', 'videoagent_session=channel-session');
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.error.code).toBe('INVITATION_SCOPE_CONFLICT');

    const unresolved = await request(
      app(invitationService, { resolveChannelIdForOrganization: async () => null }),
    )
      .get(`/api/v1/channels/${channelId}/invitations`)
      .set('cookie', 'videoagent_session=channel-session');
    expect(unresolved.status).toBe(409);
    expect(invitationService.listInvitations).not.toHaveBeenCalled();
  });

  it('validates TENANT path scope and derives the fixed member role server-side', async () => {
    const invitationService = service();
    const created = await request(app(invitationService))
      .post(`/api/v1/tenants/${tenantOrganizationId}/invitations`)
      .set('cookie', 'videoagent_session=tenant-session')
      .send({ targetEmail: 'worker@example.com', idempotencyKey: 'tenant-create-1' });
    expect(created.status).toBe(201);
    expect(invitationService.createTenantMemberInvitation).toHaveBeenCalledWith(actor('TENANT'), {
      targetEmail: 'worker@example.com',
      idempotencyKey: 'tenant-create-1',
    });

    const mismatch = await request(app(invitationService))
      .get('/api/v1/tenants/10000000-0000-4000-8000-000000000099/invitations')
      .set('cookie', 'videoagent_session=tenant-session');
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.error.code).toBe('INVITATION_SCOPE_CONFLICT');
  });

  it('denies the wrong active organization role before invoking management services', async () => {
    const invitationService = service();
    const denied = await request(
      app(invitationService, {
        resolveSession: async () => ({ session: session('PLATFORM', ['pilot_support']) }),
      }),
    )
      .get('/api/v1/platform/invitations')
      .set('cookie', 'videoagent_session=platform-session');

    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('INVITATION_PERMISSION_DENIED');
    expect(invitationService.listInvitations).not.toHaveBeenCalled();
  });

  it('revokes inside the authenticated issuer scope and safely reports replay or lifecycle conflicts', async () => {
    const invitationService = service();
    const revoked = await request(app(invitationService))
      .post(`/api/v1/invitations/${invitationId}/revoke`)
      .set('cookie', 'videoagent_session=platform-session')
      .send({});
    expect(revoked.status).toBe(200);
    expect(revoked.headers['idempotency-replayed']).toBe('false');
    expect(invitationService.revokeInvitation).toHaveBeenCalledWith(
      actor('PLATFORM'),
      invitationId,
    );

    invitationService.revokeInvitation.mockResolvedValueOnce({
      value: { ...platformInvitation, status: 'revoked' },
      replayed: true,
    });
    const replay = await request(app(invitationService))
      .post(`/api/v1/invitations/${invitationId}/revoke`)
      .set('cookie', 'videoagent_session=platform-session')
      .send({});
    expect(replay.status).toBe(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');

    invitationService.revokeInvitation.mockRejectedValueOnce(new InvitationStateConflictError());
    const conflict = await request(app(invitationService))
      .post(`/api/v1/invitations/${invitationId}/revoke`)
      .set('cookie', 'videoagent_session=platform-session')
      .send({});
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('INVITATION_STATE_CONFLICT');
  });

  it('maps stable domain errors and delegates unknown failures to the global 500 handler', async () => {
    const invitationService = service();
    invitationService.createPlatformInvitation.mockRejectedValueOnce(
      new InvitationIdempotencyConflictError(),
    );
    const conflict = await request(app(invitationService))
      .post('/api/v1/platform/invitations')
      .set('cookie', 'videoagent_session=platform-session')
      .send({
        targetEmail: 'new-user@example.com',
        attributionChannelId: null,
        idempotencyKey: 'platform-create-1',
      });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('INVITATION_IDEMPOTENCY_CONFLICT');

    invitationService.listInvitations.mockRejectedValueOnce(new InvitationNotFoundError());
    const missing = await request(app(invitationService))
      .get('/api/v1/platform/invitations')
      .set('cookie', 'videoagent_session=platform-session');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('INVITATION_NOT_FOUND');

    invitationService.listInvitations.mockRejectedValueOnce(new InvitationPermissionDeniedError());
    const denied = await request(app(invitationService))
      .get('/api/v1/platform/invitations')
      .set('cookie', 'videoagent_session=platform-session');
    expect(denied.status).toBe(403);

    invitationService.listInvitations.mockRejectedValueOnce(new InvitationScopeConflictError());
    const scope = await request(app(invitationService))
      .get('/api/v1/platform/invitations')
      .set('cookie', 'videoagent_session=platform-session');
    expect(scope.status).toBe(409);

    invitationService.listInvitations.mockRejectedValueOnce(
      new Error('postgres://secret@internal'),
    );
    const unexpected = await request(app(invitationService))
      .get('/api/v1/platform/invitations')
      .set('cookie', 'videoagent_session=platform-session');
    expect(unexpected.status).toBe(500);
    expect(unexpected.body.error.code).toBe('INTERNAL_ERROR');
    expect(unexpected.text).not.toContain('secret');
  });
});
