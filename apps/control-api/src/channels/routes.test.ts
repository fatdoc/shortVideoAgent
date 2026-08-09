import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE_NAME } from '../auth/session.js';
import type { PublicSession } from '../auth/service.js';
import {
  CommercialChannelPermissionDeniedError,
  CommercialChannelScopeNotFoundError,
} from './errors.js';
import { createCommercialChannelRouter } from './routes.js';
import type { CommercialChannelService } from './service.js';

const organizationId = 'a0000000-0000-4000-8000-000000000001';
const channelId = 'c0000000-0000-4000-8000-000000000001';
const membershipId = 'b0000000-0000-4000-8000-000000000001';
const channel = {
  channelId,
  organizationId,
  displayName: 'Canonical Channel',
  organizationStatus: 'active' as const,
};

function session(
  organizationType: PublicSession['activeContext']['organizationType'] = 'CHANNEL',
  roles: PublicSession['activeContext']['roles'] = ['channel_admin'],
): PublicSession {
  return {
    user: {
      id: 'd0000000-0000-4000-8000-000000000001',
      email: 'channel@example.com',
      displayName: 'Channel Operator',
    },
    tenant: null,
    roles,
    activeContext: {
      membershipId,
      organizationId,
      organizationType,
      organizationDisplayName: 'Session Organization',
      membershipVersion: 1,
      primaryRole: roles[0] ?? 'content_operator',
      roles,
      tenantId: null,
    },
    expiresAt: '2026-08-09T18:00:00.000Z',
  };
}

function services() {
  return {
    readCurrentChannel: vi.fn<CommercialChannelService['readCurrentChannel']>(),
    listActiveChannels: vi.fn<CommercialChannelService['listActiveChannels']>(),
  };
}

function application(
  options: {
    activeSession?: PublicSession;
    rotatedToken?: string;
    service?: ReturnType<typeof services>;
  } = {},
) {
  const service = options.service ?? services();
  const activeSession = options.activeSession ?? session();
  const router = createCommercialChannelRouter({
    service,
    resolveSession: vi.fn(async (token: string) =>
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
    response.locals.requestId = request.header('x-request-id') ?? 'generated-request-id';
    next();
  });
  app.use(express.json());
  app.use('/api/v1', router);
  return { app, service };
}

const cookie = () => `${SESSION_COOKIE_NAME}=session-token`;

describe('Commercial Channel reference HTTP API', () => {
  it('returns the Repository-resolved canonical Channel instead of guessing from Session organizationId', async () => {
    const service = services();
    service.readCurrentChannel.mockResolvedValue(channel);

    const response = await request(application({ service }).app)
      .get('/api/v1/channels/current')
      .set('cookie', cookie());

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ channel });
    expect(response.body.channel.channelId).not.toBe(organizationId);
    expect(service.readCurrentChannel).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId, organizationType: 'CHANNEL' }),
    );
  });

  it('requires a valid Cookie Session and preserves rotated cookies', async () => {
    const unauthenticated = await request(application().app).get('/api/v1/channels/current');
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('AUTHENTICATION_REQUIRED');

    const invalid = await request(application().app)
      .get('/api/v1/channels/current')
      .set('cookie', `${SESSION_COOKIE_NAME}=invalid`);
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.code).toBe('SESSION_INVALID');

    const service = services();
    service.readCurrentChannel.mockResolvedValue(channel);
    const rotated = await request(
      application({ service, rotatedToken: 'rotated-session-token' }).app,
    )
      .get('/api/v1/channels/current')
      .set('cookie', cookie());
    expect(rotated.headers['set-cookie']?.[0]).toContain(
      `${SESSION_COOKIE_NAME}=rotated-session-token`,
    );
  });

  it('returns the bounded active Platform Channel Directory', async () => {
    const service = services();
    service.listActiveChannels.mockResolvedValue([channel]);

    const response = await request(
      application({ activeSession: session('PLATFORM', ['platform_admin']), service }).app,
    )
      .get('/api/v1/platform/channels?status=active&limit=25')
      .set('cookie', cookie());

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ channels: [channel] });
    expect(service.listActiveChannels).toHaveBeenCalledWith(
      expect.objectContaining({ organizationType: 'PLATFORM', roles: ['platform_admin'] }),
      25,
    );
  });

  it('returns an empty Platform Channel Directory without inventing entries', async () => {
    const service = services();
    service.listActiveChannels.mockResolvedValue([]);

    const response = await request(
      application({ activeSession: session('PLATFORM', ['platform_admin']), service }).app,
    )
      .get('/api/v1/platform/channels')
      .set('cookie', cookie());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ channels: [] });
    expect(service.listActiveChannels).toHaveBeenCalledWith(expect.any(Object), 100);
  });

  it.each([
    '/api/v1/platform/channels?status=inactive',
    '/api/v1/platform/channels?limit=0',
    '/api/v1/platform/channels?limit=101',
    '/api/v1/platform/channels?status=active&secret=probe',
    '/api/v1/channels/current?channelId=c0000000-0000-4000-8000-000000000099',
  ])('returns 422 for invalid or unknown query input: %s', async (path) => {
    const { app, service } = application({
      activeSession: session('PLATFORM', ['platform_admin']),
    });
    const response = await request(app).get(path).set('cookie', cookie());

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('CHANNEL_QUERY_INVALID');
    expect(service.readCurrentChannel).not.toHaveBeenCalled();
    expect(service.listActiveChannels).not.toHaveBeenCalled();
  });

  it.each([
    [new CommercialChannelScopeNotFoundError(), 404, 'CHANNEL_SCOPE_NOT_FOUND'],
    [new CommercialChannelPermissionDeniedError(), 403, 'CHANNEL_PERMISSION_DENIED'],
  ] as const)('maps stable safe scope errors', async (error, status, code) => {
    const service = services();
    service.readCurrentChannel.mockRejectedValue(error);

    const response = await request(application({ service }).app)
      .get('/api/v1/channels/current')
      .set('cookie', cookie())
      .set('x-request-id', 'channel-request-1');

    expect(response.status).toBe(status);
    expect(response.body.error).toMatchObject({ code, requestId: 'channel-request-1' });
    expect(response.text).not.toContain(error.message);
  });
});
