import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { PublicSession } from '../auth/service.js';
import { canvasEntryError } from './errors.js';
import {
  createCanvasEntryRouter,
  type CanvasEntryRouterOptions,
  type CanvasEntryRouteService,
} from './routes.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const packageId = '33333333-3333-4333-8333-333333333333';
const userId = '55555555-5555-4555-8555-555555555555';
const membershipId = '66666666-6666-4666-8666-666666666666';
const organizationId = '77777777-7777-4777-8777-777777777777';
const handle = `ce_${'A'.repeat(32)}`;

const publicEntry = {
  objectType: 'CanvasEntry' as const,
  contractVersion: '0.2' as const,
  handle,
  tenantId,
  projectId,
  packageId,
  state: 'active' as const,
  issuedAt: '2026-08-11T03:00:00.000Z',
  expiresAt: '2026-08-11T03:02:00.000Z',
};

function tenantSession(): PublicSession {
  return {
    user: { id: userId, email: 'pilot@example.com', displayName: 'Pilot User' },
    tenant: { id: tenantId, displayName: 'Pilot Tenant' },
    roles: ['tenant_admin'],
    activeContext: {
      membershipId,
      organizationId,
      organizationType: 'TENANT',
      organizationDisplayName: 'Pilot Tenant',
      membershipVersion: 3,
      primaryRole: 'tenant_admin',
      roles: ['tenant_admin'],
      tenantId,
    },
    expiresAt: '2026-08-11T11:00:00.000Z',
  };
}

function platformSession(): PublicSession {
  return {
    user: { id: userId, email: 'platform@example.com', displayName: 'Platform Admin' },
    tenant: null,
    roles: ['platform_admin'],
    activeContext: {
      membershipId,
      organizationId: '88888888-8888-4888-8888-888888888888',
      organizationType: 'PLATFORM',
      organizationDisplayName: 'Pilot Platform',
      membershipVersion: 1,
      primaryRole: 'platform_admin',
      roles: ['platform_admin'],
      tenantId: null,
    },
    expiresAt: '2026-08-11T11:00:00.000Z',
  };
}

function service(overrides: Partial<CanvasEntryRouteService> = {}): CanvasEntryRouteService {
  return {
    createEntry: vi.fn(async () => ({ value: publicEntry, replayed: false })),
    readEntry: vi.fn(async () => publicEntry),
    ...overrides,
  };
}

function options(
  entryService: CanvasEntryRouteService = service(),
  overrides: Partial<CanvasEntryRouterOptions> = {},
): CanvasEntryRouterOptions {
  return {
    service: entryService,
    policy: {
      canCreateProject: async () => false,
      listVisibleProjectIds: async () => [projectId],
      resolveProjectAccess: async () => 'manager',
    },
    resolveSession: async (token) => {
      if (token === 'tenant-session') return { session: tenantSession() };
      if (token === 'rotating-session') {
        return { token: 'rotated-session-token', session: tenantSession() };
      }
      if (token === 'platform-session') return { session: platformSession() };
      return null;
    },
    secureCookies: false,
    sessionTtlSeconds: 28_800,
    ...overrides,
  };
}

function app(routerOptions: CanvasEntryRouterOptions = options()) {
  return createApp({
    appVersion: 'test',
    nodeEnv: 'test',
    readinessProbe: async () => undefined,
    productionRouter: createCanvasEntryRouter(routerOptions),
  });
}

function post(application = app()) {
  return request(application)
    .post(`/api/v1/projects/${projectId}/canvas-entries`)
    .set('cookie', 'videoagent_session=tenant-session')
    .set('idempotency-key', 'canvas-entry-create-1')
    .send({ packageId, ttlSeconds: 120 });
}

function serialized(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

function expectNoSensitiveBrowserData(value: unknown): void {
  const body = serialized(value);
  for (const marker of [
    'grantid',
    'rawgrant',
    'accesstoken',
    'tokendigest',
    'authorization',
    'cookie',
    'providerpayload',
    'requestdigest',
    'bearer ',
  ]) {
    expect(body).not.toContain(marker);
  }
}

describe('A-BIZ-06E Canvas Entry HTTP routes', () => {
  it('requires a Session Cookie and preserves the request id without touching Policy or Service', async () => {
    const entryService = service();
    const resolveProjectAccess = vi.fn(async () => 'manager' as const);
    const application = app(
      options(entryService, {
        policy: {
          canCreateProject: async () => false,
          listVisibleProjectIds: async () => [projectId],
          resolveProjectAccess,
        },
      }),
    );

    const response = await request(application)
      .post(`/api/v1/projects/${projectId}/canvas-entries`)
      .set('x-request-id', 'canvas-request-401')
      .set('idempotency-key', 'canvas-entry-create-1')
      .send({ packageId, ttlSeconds: 120 });

    expect(response.status).toBe(401);
    expect(response.headers['x-request-id']).toBe('canvas-request-401');
    expect(response.body).toEqual({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required.',
        requestId: 'canvas-request-401',
      },
    });
    expect(resolveProjectAccess).not.toHaveBeenCalled();
    expect(entryService.createEntry).not.toHaveBeenCalled();
  });

  it('rejects non-TENANT sessions before Policy or Service access', async () => {
    const entryService = service();
    const resolveProjectAccess = vi.fn(async () => 'manager' as const);
    const response = await request(
      app(
        options(entryService, {
          policy: {
            canCreateProject: async () => false,
            listVisibleProjectIds: async () => [projectId],
            resolveProjectAccess,
          },
        }),
      ),
    )
      .post(`/api/v1/projects/${projectId}/canvas-entries`)
      .set('cookie', 'videoagent_session=platform-session')
      .set('idempotency-key', 'canvas-entry-create-1')
      .send({ packageId, ttlSeconds: 120 });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      code: 'TENANT_CONTEXT_REQUIRED',
      requestId: expect.any(String),
    });
    expect(resolveProjectAccess).not.toHaveBeenCalled();
    expect(entryService.createEntry).not.toHaveBeenCalled();
  });

  it('accepts only packageId and ttlSeconds in the body and never lets the browser select grantId', async () => {
    const entryService = service();
    const application = app(options(entryService));
    const maliciousBodies = [
      { packageId, ttlSeconds: 120, grantId: '44444444-4444-4444-8444-444444444444' },
      { packageId, ttlSeconds: 120, idempotencyKey: 'body-key-forbidden' },
      { packageId, ttlSeconds: 120, accessToken: 'Bearer raw-project-grant' },
      { packageId, ttlSeconds: 120, providerPayload: { task: 'secret-provider-task' } },
    ];

    for (const body of maliciousBodies) {
      const response = await request(application)
        .post(`/api/v1/projects/${projectId}/canvas-entries`)
        .set('cookie', 'videoagent_session=tenant-session')
        .set('idempotency-key', 'canvas-entry-create-1')
        .send(body);

      expect(response.status).toBe(422);
      expect(response.body.error).toMatchObject({
        code: 'CANVAS_ENTRY_SCHEMA_INVALID',
        message: 'Canvas Entry request cannot be accepted.',
        retryable: false,
        requestId: expect.any(String),
      });
      expectNoSensitiveBrowserData(response.body);
    }
    expect(entryService.createEntry).not.toHaveBeenCalled();
  });

  it('requires Idempotency-Key only from the header and validates path/body before Service access', async () => {
    const entryService = service();
    const application = app(options(entryService));
    const missingKey = await request(application)
      .post(`/api/v1/projects/${projectId}/canvas-entries`)
      .set('cookie', 'videoagent_session=tenant-session')
      .send({ packageId, ttlSeconds: 120 });
    const invalidPath = await request(application)
      .post('/api/v1/projects/not-a-uuid/canvas-entries')
      .set('cookie', 'videoagent_session=tenant-session')
      .set('idempotency-key', 'canvas-entry-create-1')
      .send({ packageId, ttlSeconds: 120 });
    const invalidTtl = await request(application)
      .post(`/api/v1/projects/${projectId}/canvas-entries`)
      .set('cookie', 'videoagent_session=tenant-session')
      .set('idempotency-key', 'canvas-entry-create-1')
      .send({ packageId, ttlSeconds: 301 });

    for (const response of [missingKey, invalidPath, invalidTtl]) {
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('CANVAS_ENTRY_SCHEMA_INVALID');
      expectNoSensitiveBrowserData(response.body);
    }
    expect(entryService.createEntry).not.toHaveBeenCalled();
  });

  it('returns safe 404 for unknown or cross-scope projects and 403 for insufficient capability', async () => {
    const entryService = service();
    const unknown = await post(
      app(
        options(entryService, {
          policy: {
            canCreateProject: async () => false,
            listVisibleProjectIds: async () => [],
            resolveProjectAccess: async () => null,
          },
        }),
      ),
    );
    const viewer = await post(
      app(
        options(entryService, {
          policy: {
            canCreateProject: async () => false,
            listVisibleProjectIds: async () => [projectId],
            resolveProjectAccess: async () => 'viewer',
          },
        }),
      ),
    );

    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('CANVAS_ENTRY_NOT_FOUND');
    expect(viewer.status).toBe(403);
    expect(viewer.body.error.code).toBe('PERMISSION_DENIED');
    expect(entryService.createEntry).not.toHaveBeenCalled();
  });

  it('creates an exact no-store browser DTO and exposes safe idempotency replay metadata', async () => {
    const createEntry = vi
      .fn<CanvasEntryRouteService['createEntry']>()
      .mockResolvedValueOnce({ value: publicEntry, replayed: false })
      .mockResolvedValueOnce({ value: publicEntry, replayed: true });
    const application = app(options(service({ createEntry })));

    const created = await post(application);
    const replayed = await post(application);

    expect(created.status).toBe(201);
    expect(created.headers['cache-control']).toBe('no-store');
    expect(created.headers['idempotency-replayed']).toBe('false');
    expect(created.body).toEqual(publicEntry);
    expect(replayed.status).toBe(200);
    expect(replayed.headers['idempotency-replayed']).toBe('true');
    expect(replayed.body).toEqual(publicEntry);
    expectNoSensitiveBrowserData(created.body);
    expect(createEntry).toHaveBeenNthCalledWith(
      1,
      {
        userId,
        membershipId,
        organizationId,
        organizationType: 'TENANT',
        tenantId,
        membershipVersion: 3,
        primaryRole: 'tenant_admin',
        roles: ['tenant_admin'],
      },
      projectId,
      { packageId, ttlSeconds: 120, idempotencyKey: 'canvas-entry-create-1' },
    );
  });

  it.each([
    ['CANVAS_ENTRY_NOT_FOUND', 404],
    ['CANVAS_ENTRY_IDEMPOTENCY_CONFLICT', 409],
    ['CANVAS_ENTRY_REPLAYED', 409],
    ['CANVAS_ENTRY_EXPIRED', 410],
    ['CANVAS_ENTRY_SCHEMA_INVALID', 422],
  ] as const)('maps %s to stable browser-safe %i', async (code, status) => {
    const response = await post(
      app(
        options(
          service({
            createEntry: vi.fn(async () => {
              throw canvasEntryError(code, 'postgres leaked raw secret Bearer abc.def.ghi', {
                providerPayload: 'must-not-escape',
              });
            }),
          }),
        ),
      ),
    );

    expect(response.status).toBe(status);
    expect(response.body.error).toMatchObject({
      code,
      retryable: false,
      requestId: expect.any(String),
    });
    expectNoSensitiveBrowserData(response.body);
  });

  it('maps unknown storage failures to a sanitized 500 and rotates a valid Session Cookie', async () => {
    const response = await request(
      app(
        options(
          service({
            createEntry: vi.fn(async () => {
              throw new Error('postgres password=raw-secret authorization=Bearer abc.def.ghi');
            }),
          }),
        ),
      ),
    )
      .post(`/api/v1/projects/${projectId}/canvas-entries`)
      .set('cookie', 'videoagent_session=rotating-session')
      .set('idempotency-key', 'canvas-entry-create-1')
      .send({ packageId, ttlSeconds: 120 });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Canvas Entry service is temporarily unavailable.',
        requestId: expect.any(String),
      },
    });
    expect(response.headers['set-cookie']?.[0]).toContain(
      'videoagent_session=rotated-session-token',
    );
    expectNoSensitiveBrowserData(response.body);
  });

  it('rejects a secret-bearing Service result instead of serializing it', async () => {
    const response = await post(
      app(
        options(
          service({
            createEntry: vi.fn(async () => ({
              value: { ...publicEntry, accessToken: 'Bearer raw-project-grant' } as never,
              replayed: false,
            })),
          }),
        ),
      ),
    );

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('CANVAS_ENTRY_SCHEMA_INVALID');
    expectNoSensitiveBrowserData(response.body);
  });

  it('reads an active Canvas Entry through authenticated tenant/project scope', async () => {
    const readEntry = vi.fn<CanvasEntryRouteService['readEntry']>(async () => publicEntry);
    const response = await request(app(options(service({ readEntry }))))
      .get(`/api/v1/projects/${projectId}/canvas-entries/${handle}`)
      .set('cookie', 'videoagent_session=tenant-session')
      .set('x-request-id', 'canvas-read-active');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual(publicEntry);
    expectNoSensitiveBrowserData(response.body);
    expect(readEntry).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, organizationId }),
      projectId,
      handle,
    );
  });

  it('validates GET path input and returns safe project-scope 404 before Service access', async () => {
    const readEntry = vi.fn<CanvasEntryRouteService['readEntry']>();
    const invalidHandle = await request(app(options(service({ readEntry }))))
      .get(`/api/v1/projects/${projectId}/canvas-entries/not-a-handle`)
      .set('cookie', 'videoagent_session=tenant-session');
    const unknownProject = await request(
      app(
        options(service({ readEntry }), {
          policy: {
            canCreateProject: async () => false,
            listVisibleProjectIds: async () => [],
            resolveProjectAccess: async () => null,
          },
        }),
      ),
    )
      .get(`/api/v1/projects/${projectId}/canvas-entries/${handle}`)
      .set('cookie', 'videoagent_session=tenant-session');

    expect(invalidHandle.status).toBe(422);
    expect(invalidHandle.body.error.code).toBe('CANVAS_ENTRY_SCHEMA_INVALID');
    expect(unknownProject.status).toBe(404);
    expect(unknownProject.body.error.code).toBe('CANVAS_ENTRY_NOT_FOUND');
    expect(readEntry).not.toHaveBeenCalled();
  });

  it.each([
    ['CANVAS_ENTRY_NOT_FOUND', 404],
    ['CANVAS_ENTRY_REPLAYED', 409],
    ['CANVAS_ENTRY_EXPIRED', 410],
  ] as const)('maps GET %s to stable browser-safe %i', async (code, status) => {
    const response = await request(
      app(
        options(
          service({
            readEntry: vi.fn(async () => {
              throw canvasEntryError(code, 'repository leaked authorization Bearer abc.def.ghi');
            }),
          }),
        ),
      ),
    )
      .get(`/api/v1/projects/${projectId}/canvas-entries/${handle}`)
      .set('cookie', 'videoagent_session=tenant-session')
      .set('x-request-id', `canvas-read-${status}`);

    expect(response.status).toBe(status);
    expect(response.body.error).toMatchObject({
      code,
      retryable: false,
      requestId: `canvas-read-${status}`,
    });
    expectNoSensitiveBrowserData(response.body);
  });

  it('rejects a secret-bearing GET Service result instead of serializing it', async () => {
    const response = await request(
      app(
        options(
          service({
            readEntry: vi.fn(
              async () =>
                ({
                  ...publicEntry,
                  providerPayload: { authorization: 'Bearer raw-project-grant' },
                }) as never,
            ),
          }),
        ),
      ),
    )
      .get(`/api/v1/projects/${projectId}/canvas-entries/${handle}`)
      .set('cookie', 'videoagent_session=tenant-session');

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('CANVAS_ENTRY_SCHEMA_INVALID');
    expectNoSensitiveBrowserData(response.body);
  });
});
