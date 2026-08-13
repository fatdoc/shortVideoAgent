import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { ProjectPolicy } from '../projects/policy.js';
import { contractPayloadDigest } from './digest.js';
import { ProductionDomainError, ProductionIdempotencyConflictError } from './errors.js';
import { createProductionRouter, type ProductionRouterOptions } from './routes.js';
import type { ProductionStore, ProjectGrant, ProjectProductionPackage } from './types.js';

const tenantId = '10000000-0000-4000-8000-000000000001';
const userId = '10000000-0000-4000-8000-000000000002';
const projectId = '10000000-0000-4000-8000-000000000003';
const scriptVersionId = '10000000-0000-4000-8000-000000000004';
const packageId = '10000000-0000-4000-8000-000000000005';
const storyboardVersionId = '10000000-0000-4000-8000-000000000008';
const approvedScriptDigest = `sha256:${'1'.repeat(64)}`;
const approvedStoryboardDigest = `sha256:${'2'.repeat(64)}`;

const publicPackageKeys = [
  'objectType',
  'contractVersion',
  'tenantId',
  'projectId',
  'packageId',
  'packageVersion',
  'scriptVersionId',
  'storyboardVersionId',
  'capabilityRequirements',
  'status',
  'payloadDigest',
  'approvedScriptDigest',
  'approvedStoryboardDigest',
  'createdAt',
  'expiresAt',
] as const;

function packageFixture(): ProjectProductionPackage {
  const unsigned = {
    objectType: 'ProjectProductionPackage' as const,
    contractVersion: '0.3' as const,
    status: 'ready' as const,
    tenantId,
    projectId,
    idempotencyKey: 'package-key-1',
    occurredAt: '2026-08-11T01:00:00.000Z',
    packageId,
    packageVersion: 1,
    organizationId: tenantId,
    scriptVersionId,
    storyboardVersionId,
    approvedScriptDigest,
    approvedStoryboardDigest,
    briefSnapshot: {
      briefVersionId: '10000000-0000-4000-8000-000000000006',
      objective: 'Pilot objective',
      audience: ['visitors'],
      platforms: ['douyin'],
    },
    brandPolicySnapshot: {
      facts: [],
      prohibitedTerms: [],
      requiredDisclosures: ['internal-controlled-pilot'],
      sourceDigest: `sha256:${'3'.repeat(64)}`,
    },
    approvedScript: {
      scriptVersionId,
      payloadDigest: approvedScriptDigest,
      content: 'Approved script that must never reach the browser.',
      approvedAt: '2026-08-11T00:59:00.000Z',
      approvedBy: userId,
    },
    approvedStoryboard: {
      storyboardVersionId,
      scriptVersionId,
      scriptPayloadDigest: approvedScriptDigest,
      payloadDigest: approvedStoryboardDigest,
      approvedAt: '2026-08-11T00:59:30.000Z',
      approvedBy: userId,
    },
    storyboard: [
      {
        shotId: 'shot-1',
        sequence: 1,
        description: 'Opening shot that must never reach the browser.',
        durationSeconds: 5,
        sourceMode: 'mixed' as const,
      },
    ],
    target: {
      aspectRatio: '9:16',
      durationSeconds: 15,
      container: 'mp4' as const,
      videoCodec: 'h264' as const,
    },
    capabilityRequirements: ['video.generate' as const],
    createdAt: '2026-08-11T01:00:00.000Z',
    expiresAt: '2026-08-11T02:00:00.000Z',
  };
  return { ...unsigned, payloadDigest: contractPayloadDigest(unsigned) };
}

function publicPackageFixture() {
  const value = packageFixture();
  if (value.contractVersion !== '0.3') throw new Error('v0.3 fixture required');
  return {
    objectType: value.objectType,
    contractVersion: value.contractVersion,
    tenantId: value.tenantId,
    projectId: value.projectId,
    packageId: value.packageId,
    packageVersion: value.packageVersion,
    scriptVersionId: value.scriptVersionId,
    storyboardVersionId: value.storyboardVersionId,
    capabilityRequirements: value.capabilityRequirements,
    status: value.status,
    payloadDigest: value.payloadDigest,
    approvedScriptDigest: value.approvedScriptDigest,
    approvedStoryboardDigest: value.approvedStoryboardDigest,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
  };
}

function grantFixture(): ProjectGrant {
  const unsigned = {
    objectType: 'ProjectGrant' as const,
    contractVersion: '0.2' as const,
    tenantId,
    projectId,
    idempotencyKey: 'grant-key-1',
    occurredAt: '2026-08-11T01:00:01.000Z',
    grantId: '10000000-0000-4000-8000-000000000007',
    packageId,
    capabilities: ['video.generate' as const],
    scopes: ['production.package.read' as const, 'production.task.write' as const],
    tokenDigest: `sha256:${'4'.repeat(64)}`,
    keyId: 'pilot-kid-1',
    issuedAt: '2026-08-11T01:00:01.000Z',
    expiresAt: '2026-08-11T01:10:01.000Z',
  };
  return { ...unsigned, payloadDigest: contractPayloadDigest(unsigned) };
}

const managerPolicy: ProjectPolicy = {
  canCreateProject: async () => true,
  listVisibleProjectIds: async () => null,
  resolveProjectAccess: async () => 'manager',
};

function testApp(store: ProductionStore, policy: ProjectPolicy = managerPolicy) {
  const productionRouter = createProductionRouter({
    store,
    policy,
    resolveSession: async (token) => {
      if (token === 'valid-session') {
        return {
          session: {
            user: { id: userId, email: 'pilot@example.com', displayName: 'Pilot User' },
            tenant: { id: tenantId, displayName: 'Pilot Tenant' },
            roles: ['tenant_admin'] as const,
            activeContext: {
              membershipId: '10000000-0000-4000-8000-000000000006',
              organizationId: tenantId,
              organizationType: 'TENANT' as const,
              organizationDisplayName: 'Pilot Tenant',
              membershipVersion: 1,
              primaryRole: 'tenant_admin' as const,
              roles: ['tenant_admin'] as const,
              tenantId,
            },
            expiresAt: '2026-08-11T08:00:00.000Z',
          },
        };
      }
      if (token === 'platform-session') {
        return {
          session: {
            user: { id: userId, email: 'platform@example.com', displayName: 'Platform Admin' },
            tenant: null,
            roles: ['platform_admin'] as const,
            activeContext: {
              membershipId: '20000000-0000-4000-8000-000000000006',
              organizationId: '20000000-0000-4000-8000-000000000007',
              organizationType: 'PLATFORM' as const,
              organizationDisplayName: 'Pilot Platform',
              membershipVersion: 1,
              primaryRole: 'platform_admin' as const,
              roles: ['platform_admin'] as const,
              tenantId: null,
            },
            expiresAt: '2026-08-11T08:00:00.000Z',
          },
        };
      }
      return null;
    },
    secureCookies: false,
    sessionTtlSeconds: 28_800,
  });
  return createApp({
    appVersion: 'test',
    nodeEnv: 'test',
    readinessProbe: async () => undefined,
    productionRouter,
  });
}

function store(overrides: Partial<ProductionStore> = {}): ProductionStore {
  return {
    createPackage: vi.fn(async () => ({ value: packageFixture(), replayed: false })),
    getPackage: vi.fn(async () => packageFixture()),
    issueGrant: vi.fn(async () => null),
    ...overrides,
  };
}

function expectSafeError(
  response: request.Response,
  status: number,
  code: string,
  requestId: string,
): void {
  expect(response.status).toBe(status);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['x-request-id']).toBe(requestId);
  expect(response.body).toEqual({
    error: {
      code,
      message: expect.any(String),
      requestId,
    },
  });
  for (const forbidden of [
    'tenantId',
    'projectId',
    'packageId',
    'idempotencyKey',
    'payloadDigest',
    'approvedScriptDigest',
    'approvedStoryboardDigest',
    'occurredAt',
    'errorId',
    'details',
  ]) {
    expect(response.text).not.toContain(forbidden);
  }
}

function createPackageCommand() {
  return {
    scriptVersionId,
    storyboardVersionId,
    capabilityRequirements: ['video.generate'] as const,
    expiresInSeconds: 3600,
  };
}

describe('A05 production HTTP boundary', () => {
  it('accepts only the exact four-key v0.3 command and returns the exact 15-key DTO', async () => {
    const createPackage = vi.fn<ProductionStore['createPackage']>().mockResolvedValue({
      value: packageFixture(),
      replayed: false,
    });
    const app = testApp(store({ createPackage }));

    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/production-packages`)
      .set('cookie', 'videoagent_session=valid-session')
      .set('x-request-id', 'package-v03-create')
      .set('idempotency-key', 'package-v03-red-1')
      .send(createPackageCommand());

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-request-id']).toBe('package-v03-create');
    expect(response.headers['idempotency-replayed']).toBe('false');
    expect(Object.keys(response.body)).toEqual(publicPackageKeys);
    expect(response.body).toEqual(publicPackageFixture());
    expect(response.text).not.toContain('Approved script that must never reach the browser.');
    expect(response.text).not.toContain('Opening shot that must never reach the browser.');
    expect(response.body).not.toHaveProperty('idempotencyKey');
    expect(response.body).not.toHaveProperty('briefSnapshot');
    expect(response.body).not.toHaveProperty('approvedScript');
    expect(response.body).not.toHaveProperty('approvedStoryboard');
    expect(response.body).not.toHaveProperty('storyboard');
    expect(createPackage).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, userId }),
      projectId,
      createPackageCommand(),
      expect.objectContaining({
        operation: 'production.package.create',
        key: 'package-v03-red-1',
        payload: createPackageCommand(),
      }),
    );
  });

  it('falls through unrelated GET and POST paths without resolving a Tenant session', async () => {
    const productionStore = store();
    const resolveSession = vi.fn<ProductionRouterOptions['resolveSession']>();
    const productionRouter = createProductionRouter({
      store: productionStore,
      policy: managerPolicy,
      resolveSession,
      secureCookies: false,
      sessionTtlSeconds: 28_800,
    });
    const downstreamRouter = Router();
    downstreamRouter.get('/platform/payment-events', (_request, response) => {
      response.status(200).json({ mounted: true });
    });
    downstreamRouter.post('/platform/commission-settlements', (_request, response) => {
      response.status(201).json({ mounted: true });
    });
    const application = createApp({
      appVersion: 'test',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      productionRouter,
      paymentRouter: downstreamRouter,
    });

    const readResponse = await request(application).get('/api/v1/platform/payment-events');
    const writeResponse = await request(application)
      .post('/api/v1/platform/commission-settlements')
      .send({ paymentMode: 'TEST' });

    expect(readResponse.status).toBe(200);
    expect(readResponse.body).toEqual({ mounted: true });
    expect(writeResponse.status).toBe(201);
    expect(writeResponse.body).toEqual({ mounted: true });
    expect(resolveSession).not.toHaveBeenCalled();
    expect(productionStore.createPackage).not.toHaveBeenCalled();
    expect(productionStore.issueGrant).not.toHaveBeenCalled();
  });

  it('freezes real Session Cookie 401 and PLATFORM context 403 as no-store responses', async () => {
    const createPackage = vi.fn<ProductionStore['createPackage']>();
    const app = testApp(store({ createPackage }));

    const unauthenticated = await request(app)
      .post(`/api/v1/projects/${projectId}/production-packages`)
      .set('x-request-id', 'package-auth-401')
      .set('idempotency-key', 'package-key-1')
      .send(createPackageCommand());
    expectSafeError(unauthenticated, 401, 'AUTHENTICATION_REQUIRED', 'package-auth-401');

    const platform = await request(app)
      .post(`/api/v1/projects/${projectId}/production-packages`)
      .set('cookie', 'videoagent_session=platform-session')
      .set('x-request-id', 'package-platform-403')
      .set('idempotency-key', 'platform-package-key')
      .send(createPackageCommand());
    expectSafeError(platform, 403, 'TENANT_CONTEXT_REQUIRED', 'package-platform-403');
    expect(createPackage).not.toHaveBeenCalled();
  });

  it('requires all four fields, rejects extras, and has no TTL default', async () => {
    const createPackage = vi.fn<ProductionStore['createPackage']>();
    const app = testApp(store({ createPackage }));

    const missingTtl = await request(app)
      .post(`/api/v1/projects/${projectId}/production-packages`)
      .set('cookie', 'videoagent_session=valid-session')
      .set('x-request-id', 'package-missing-ttl')
      .set('idempotency-key', 'package-missing-ttl')
      .send({
        scriptVersionId,
        storyboardVersionId,
        capabilityRequirements: ['video.generate'],
      });
    expectSafeError(missingTtl, 422, 'SCHEMA_INVALID', 'package-missing-ttl');

    const injected = await request(app)
      .post(`/api/v1/projects/${projectId}/production-packages`)
      .set('cookie', 'videoagent_session=valid-session')
      .set('x-request-id', 'package-extra-field')
      .set('idempotency-key', 'package-extra-field')
      .send({ ...createPackageCommand(), tenantId });
    expectSafeError(injected, 422, 'SCHEMA_INVALID', 'package-extra-field');
    expect(createPackage).not.toHaveBeenCalled();
  });

  it('requires Idempotency-Key only from the header', async () => {
    const createPackage = vi.fn<ProductionStore['createPackage']>();
    const app = testApp(store({ createPackage }));
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/production-packages`)
      .set('cookie', 'videoagent_session=valid-session')
      .set('x-request-id', 'package-idempotency-400')
      .send({ ...createPackageCommand(), idempotencyKey: 'body-key' });

    expectSafeError(response, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'package-idempotency-400');
    expect(createPackage).not.toHaveBeenCalled();
  });

  it('returns the same exact public DTO on idempotent replay', async () => {
    const createPackage = vi
      .fn<ProductionStore['createPackage']>()
      .mockResolvedValueOnce({ value: packageFixture(), replayed: false })
      .mockResolvedValueOnce({ value: packageFixture(), replayed: true });
    const app = testApp(store({ createPackage }));
    const send = (requestId: string) =>
      request(app)
        .post(`/api/v1/projects/${projectId}/production-packages`)
        .set('cookie', 'videoagent_session=valid-session')
        .set('x-request-id', requestId)
        .set('idempotency-key', 'package-key-1')
        .send(createPackageCommand());

    const created = await send('package-created');
    const replayed = await send('package-replayed');
    expect(created.status).toBe(201);
    expect(replayed.status).toBe(200);
    expect(replayed.headers['cache-control']).toBe('no-store');
    expect(replayed.headers['idempotency-replayed']).toBe('true');
    expect(Object.keys(replayed.body)).toEqual(publicPackageKeys);
    expect(replayed.body).toEqual(created.body);
  });

  it('maps same-key/different-payload conflicts to a minimal safe envelope', async () => {
    const app = testApp(
      store({
        createPackage: vi.fn(async () => {
          throw new ProductionIdempotencyConflictError();
        }),
      }),
    );
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/production-packages`)
      .set('cookie', 'videoagent_session=valid-session')
      .set('x-request-id', 'package-idempotency-conflict')
      .set('idempotency-key', 'raw-key-must-not-leak')
      .send(createPackageCommand());

    expectSafeError(response, 409, 'IDEMPOTENCY_CONFLICT', 'package-idempotency-conflict');
    expect(response.text).not.toContain('raw-key-must-not-leak');
  });

  it('maps stale Script or Storyboard authority to a generic 409', async () => {
    const app = testApp(
      store({
        createPackage: vi.fn(async () => {
          throw new ProductionDomainError(
            'storyboard approval was revoked',
            403,
            'CAPABILITY_SCOPE_DENIED',
            'scope',
            {
              reasonCode: 'STORYBOARD_APPROVAL_REVOKED',
              authorityReasonCode: 'STORYBOARD_APPROVAL_REVOKED',
            },
          );
        }),
      }),
    );
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/production-packages`)
      .set('cookie', 'videoagent_session=valid-session')
      .set('x-request-id', 'package-authority-stale')
      .set('idempotency-key', 'stale-key-must-not-leak')
      .send(createPackageCommand());

    expectSafeError(response, 409, 'PRODUCTION_AUTHORITY_STALE', 'package-authority-stale');
    expect(response.text).not.toContain('STORYBOARD_APPROVAL_REVOKED');
    expect(response.text).not.toContain('stale-key-must-not-leak');
  });

  it('allows a viewer to read only the strict v0.3 public projection', async () => {
    const getPackage = vi.fn<ProductionStore['getPackage']>().mockResolvedValue(packageFixture());
    const viewerPolicy: ProjectPolicy = {
      canCreateProject: async () => false,
      listVisibleProjectIds: async () => [projectId],
      resolveProjectAccess: async () => 'viewer',
    };
    const app = testApp(store({ getPackage }), viewerPolicy);
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/production-packages/${packageId}`)
      .set('cookie', 'videoagent_session=valid-session')
      .set('x-request-id', 'package-viewer-read');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-request-id']).toBe('package-viewer-read');
    expect(Object.keys(response.body)).toEqual(publicPackageKeys);
    expect(response.body).toEqual(publicPackageFixture());
    expect(response.text).not.toContain('Approved script that must never reach the browser.');
    expect(response.text).not.toContain('Opening shot that must never reach the browser.');
    expect(getPackage).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, userId }),
      projectId,
      packageId,
    );
  });

  it('rejects viewer production writes with 403 before invoking the store', async () => {
    const createPackage = vi.fn<ProductionStore['createPackage']>();
    const viewerPolicy: ProjectPolicy = {
      canCreateProject: async () => false,
      listVisibleProjectIds: async () => [projectId],
      resolveProjectAccess: async () => 'viewer',
    };
    const app = testApp(store({ createPackage }), viewerPolicy);
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/production-packages`)
      .set('cookie', 'videoagent_session=valid-session')
      .set('x-request-id', 'package-viewer-write')
      .set('idempotency-key', 'viewer-package-1')
      .send(createPackageCommand());

    expectSafeError(response, 403, 'CAPABILITY_SCOPE_DENIED', 'package-viewer-write');
    expect(createPackage).not.toHaveBeenCalled();
  });

  it('uses one safe 404 for unknown project and unknown or cross-scope package', async () => {
    const hiddenPolicy: ProjectPolicy = {
      canCreateProject: async () => false,
      listVisibleProjectIds: async () => [],
      resolveProjectAccess: async () => null,
    };
    const hiddenApp = testApp(store(), hiddenPolicy);
    const missingApp = testApp(store({ getPackage: vi.fn(async () => null) }));

    const hidden = await request(hiddenApp)
      .get(`/api/v1/projects/${projectId}/production-packages/${packageId}`)
      .set('cookie', 'videoagent_session=valid-session')
      .set('x-request-id', 'package-safe-404');
    const missing = await request(missingApp)
      .get(`/api/v1/projects/${projectId}/production-packages/${packageId}`)
      .set('cookie', 'videoagent_session=valid-session')
      .set('x-request-id', 'package-safe-404');

    expectSafeError(hidden, 404, 'RESOURCE_NOT_FOUND', 'package-safe-404');
    expectSafeError(missing, 404, 'RESOURCE_NOT_FOUND', 'package-safe-404');
    expect(hidden.body).toEqual(missing.body);
  });

  it('fails closed with a fixed 500 when the store returns a non-v0.3 package', async () => {
    const invalid = {
      ...packageFixture(),
      contractVersion: '0.2',
      internalSql: 'select * from control_plane.production_packages',
    } as unknown as ProjectProductionPackage;
    const app = testApp(store({ getPackage: vi.fn(async () => invalid) }));
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/production-packages/${packageId}`)
      .set('cookie', 'videoagent_session=valid-session')
      .set('x-request-id', 'package-invalid-source');

    expectSafeError(response, 500, 'INTERNAL_ERROR', 'package-invalid-source');
    expect(response.text).not.toContain('control_plane');
    expect(response.text).not.toContain('Zod');
  });

  it('redacts unknown repository failures instead of delegating environment-specific messages', async () => {
    const app = testApp(
      store({
        createPackage: vi.fn(async () => {
          throw new Error(
            `select * from control_plane.production_packages where tenant_id = '${tenantId}'`,
          );
        }),
      }),
    );
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/production-packages`)
      .set('cookie', 'videoagent_session=valid-session')
      .set('x-request-id', 'package-safe-500')
      .set('idempotency-key', 'secret-idempotency-key')
      .send(createPackageCommand());

    expectSafeError(response, 500, 'INTERNAL_ERROR', 'package-safe-500');
    expect(response.text).not.toContain('control_plane');
    expect(response.text).not.toContain(tenantId);
    expect(response.text).not.toContain('secret-idempotency-key');
  });

  it('keeps the Grant URL, body defaults, token, and success contract unchanged', async () => {
    const issueGrant = vi.fn<ProductionStore['issueGrant']>().mockResolvedValue({
      value: { grant: grantFixture(), tokenType: 'Bearer', accessToken: 'signed.token.value' },
      replayed: false,
    });
    const app = testApp(store({ issueGrant }));
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/production-grants`)
      .set('cookie', 'videoagent_session=valid-session')
      .set('x-request-id', 'grant-contract-unchanged')
      .set('idempotency-key', 'grant-key-1')
      .send({
        packageId,
        requestedCapabilities: ['video.generate'],
        requestedScopes: ['production.package.read', 'production.task.write'],
      });

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-request-id']).toBe('grant-contract-unchanged');
    expect(response.body).toEqual({
      grant: grantFixture(),
      tokenType: 'Bearer',
      accessToken: 'signed.token.value',
    });
    expect(issueGrant).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, userId }),
      projectId,
      expect.objectContaining({
        requestedCapabilities: ['video.generate'],
        requestedScopes: ['production.package.read', 'production.task.write'],
        ttlSeconds: 600,
      }),
      expect.objectContaining({ operation: 'production.grant.issue', key: 'grant-key-1' }),
    );
  });
});
