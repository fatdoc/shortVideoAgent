import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { contractPayloadDigest } from './digest.js';
import { ProductionDomainError, ProductionIdempotencyConflictError } from './errors.js';
import { createProductionRouter } from './routes.js';
import type { ProductionStore, ProjectGrant, ProjectProductionPackage } from './types.js';

const tenantId = '10000000-0000-4000-8000-000000000001';
const userId = '10000000-0000-4000-8000-000000000002';
const projectId = '10000000-0000-4000-8000-000000000003';
const scriptVersionId = '10000000-0000-4000-8000-000000000004';
const packageId = '10000000-0000-4000-8000-000000000005';

function packageFixture(): ProjectProductionPackage {
  const unsigned = {
    objectType: 'ProjectProductionPackage' as const,
    contractVersion: '0.2' as const,
    tenantId,
    projectId,
    idempotencyKey: 'package-key-1',
    occurredAt: '2026-08-05T01:00:00.000Z',
    packageId,
    packageVersion: 1,
    organizationId: tenantId,
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
      sourceDigest: `sha256:${'1'.repeat(64)}`,
    },
    approvedScript: {
      scriptVersionId,
      content: 'Approved script',
      approvedAt: '2026-08-05T00:59:00.000Z',
      approvedBy: userId,
    },
    storyboard: [
      {
        shotId: 'shot-1',
        sequence: 1,
        description: 'Opening',
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
    createdAt: '2026-08-05T01:00:00.000Z',
    expiresAt: '2026-08-05T07:00:00.000Z',
  };
  return { ...unsigned, payloadDigest: contractPayloadDigest(unsigned) };
}

function grantFixture(): ProjectGrant {
  const unsigned = {
    objectType: 'ProjectGrant' as const,
    contractVersion: '0.2' as const,
    tenantId,
    projectId,
    idempotencyKey: 'grant-key-1',
    occurredAt: '2026-08-05T01:00:01.000Z',
    grantId: '10000000-0000-4000-8000-000000000007',
    packageId,
    capabilities: ['video.generate' as const],
    scopes: ['production.package.read' as const, 'production.task.write' as const],
    tokenDigest: `sha256:${'2'.repeat(64)}`,
    keyId: 'pilot-kid-1',
    issuedAt: '2026-08-05T01:00:01.000Z',
    expiresAt: '2026-08-05T01:10:01.000Z',
  };
  return { ...unsigned, payloadDigest: contractPayloadDigest(unsigned) };
}

function testApp(store: ProductionStore) {
  const productionRouter = createProductionRouter({
    store,
    resolveSession: async (token) =>
      token === 'valid-session'
        ? {
            session: {
              user: { id: userId, email: 'pilot@example.com', displayName: 'Pilot User' },
              tenant: { id: tenantId, displayName: 'Pilot Tenant' },
              roles: ['tenant_admin'],
              expiresAt: '2026-08-05T08:00:00.000Z',
            },
          }
        : null,
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

describe('A05 production HTTP boundary', () => {
  it('requires a real session and a strict v0.2 package command', async () => {
    const app = testApp(store());
    const unauthenticated = await request(app)
      .post(`/api/v1/projects/${projectId}/production-packages`)
      .set('idempotency-key', 'package-key-1')
      .send({
        scriptVersionId,
        capabilityRequirements: ['video.generate'],
      });
    expect(unauthenticated.status).toBe(401);

    const injected = await request(app)
      .post(`/api/v1/projects/${projectId}/production-packages`)
      .set('cookie', 'videoagent_session=valid-session')
      .set('idempotency-key', 'package-key-1')
      .send({
        scriptVersionId,
        capabilityRequirements: ['video.generate'],
        tenantId: '20000000-0000-4000-8000-000000000001',
      });
    expect(injected.status).toBe(422);
    expect(injected.body).toMatchObject({
      objectType: 'StandardError',
      contractVersion: '0.2',
      tenantId,
      projectId,
      error: { code: 'SCHEMA_INVALID', category: 'schema', retryable: false },
    });
    expect(injected.body.payloadDigest).toBe(contractPayloadDigest(injected.body));
  });

  it('returns an immutable contract package and exposes safe replay metadata', async () => {
    const createPackage = vi
      .fn<ProductionStore['createPackage']>()
      .mockResolvedValueOnce({ value: packageFixture(), replayed: false })
      .mockResolvedValueOnce({ value: packageFixture(), replayed: true });
    const app = testApp(store({ createPackage }));
    const send = () =>
      request(app)
        .post(`/api/v1/projects/${projectId}/production-packages`)
        .set('cookie', 'videoagent_session=valid-session')
        .set('idempotency-key', 'package-key-1')
        .send({ scriptVersionId, capabilityRequirements: ['video.generate'] });

    const created = await send();
    const replayed = await send();
    expect(created.status).toBe(201);
    expect(created.body).toEqual(packageFixture());
    expect(replayed.status).toBe(200);
    expect(replayed.headers['idempotency-replayed']).toBe('true');
    expect(replayed.body.packageId).toBe(created.body.packageId);
  });

  it('maps same-key/different-payload conflicts to the frozen StandardError', async () => {
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
      .set('idempotency-key', 'package-key-1')
      .send({ scriptVersionId, capabilityRequirements: ['video.generate'] });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(response.body.payloadDigest).toBe(contractPayloadDigest(response.body));
  });

  it('returns a no-store, least-privilege signed Grant envelope', async () => {
    const issueGrant = vi.fn<ProductionStore['issueGrant']>().mockResolvedValue({
      value: { grant: grantFixture(), tokenType: 'Bearer', accessToken: 'signed.token.value' },
      replayed: false,
    });
    const app = testApp(store({ issueGrant }));
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/production-grants`)
      .set('cookie', 'videoagent_session=valid-session')
      .set('idempotency-key', 'grant-key-1')
      .send({
        packageId,
        requestedCapabilities: ['video.generate'],
        requestedScopes: ['production.package.read', 'production.task.write'],
      });

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
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

  it('never serializes signed URLs, scripts, cross-tenant values, or unknown details', async () => {
    const signedUrl = 'https://bucket.example/video.mp4?x-tos-signature=do-not-leak';
    const app = testApp(
      store({
        createPackage: vi.fn(async () => {
          throw new ProductionDomainError(
            `脚本正文: private customer script ${signedUrl}`,
            500,
            'CAPABILITY_SCOPE_DENIED',
            'grant',
            {
              reasonCode: 'tenant-other-secret',
              signedUrl,
              scriptContent: 'private customer script',
              operation: 'production.package.create',
              unknownDetail: 'private unknown detail',
            },
          );
        }),
      }),
    );
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/production-packages`)
      .set('cookie', 'videoagent_session=valid-session')
      .set('idempotency-key', 'safe-error-key-1')
      .send({ scriptVersionId, capabilityRequirements: ['video.generate'] });

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({
      code: 'CAPABILITY_SCOPE_DENIED',
      message: 'Requested capability is not authorized.',
      retryable: false,
      category: 'scope',
      details: { operation: 'production.package.create' },
    });
    expect(response.text).not.toContain('do-not-leak');
    expect(response.text).not.toContain('private customer script');
    expect(response.text).not.toContain('tenant-other-secret');
    expect(response.text).not.toContain('private unknown detail');
    expect(response.body.payloadDigest).toBe(contractPayloadDigest(response.body));
  });
});
