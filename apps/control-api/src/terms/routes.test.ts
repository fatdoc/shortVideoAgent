import express, { type ErrorRequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { PublicSession } from '../auth/service.js';
import {
  TermsNotAvailableError,
  TermsPublishConflictError,
  TermsVersionNotFoundError,
} from './errors.js';
import { createTermsRouter } from './routes.js';
import type { TermsDocument, TermsVersion } from './types.js';

const userId = '10000000-0000-4000-8000-000000000001';
const documentId = '20000000-0000-4000-8000-000000000001';
const versionId = '30000000-0000-4000-8000-000000000001';

const document: TermsDocument = {
  termsDocumentId: documentId,
  documentCode: 'registration-notice',
  title: 'Registration notice test fixture',
  status: 'active',
  createdAt: '2026-08-07T10:00:00.000Z',
  updatedAt: '2026-08-07T10:00:00.000Z',
};

const version: TermsVersion = {
  termsVersionId: versionId,
  termsDocumentId: documentId,
  versionLabel: 'test-v1',
  status: 'PUBLISHED',
  content: 'Test-only terms body.',
  contentDigest: 'f'.repeat(64),
  locale: 'zh-CN',
  publishedAt: '2026-08-07T10:30:00.000Z',
  effectiveAt: '2026-08-07T11:00:00.000Z',
  publishedBy: userId,
  supersedesTermsVersionId: null,
  mustReaccept: false,
  createdAt: '2026-08-07T10:00:00.000Z',
  updatedAt: '2026-08-07T10:30:00.000Z',
};

function session(
  organizationType: PublicSession['activeContext']['organizationType'],
  roles: PublicSession['roles'],
): PublicSession {
  return {
    user: { id: userId, email: 'terms@example.com', displayName: 'Terms User' },
    tenant:
      organizationType === 'TENANT'
        ? { id: '40000000-0000-4000-8000-000000000001', displayName: 'Tenant' }
        : null,
    roles,
    activeContext: {
      membershipId: '50000000-0000-4000-8000-000000000001',
      organizationId: '60000000-0000-4000-8000-000000000001',
      organizationType,
      organizationDisplayName: 'Test Organization',
      membershipVersion: 1,
      primaryRole: roles[0] ?? 'pilot_support',
      roles,
      tenantId: organizationType === 'TENANT' ? '40000000-0000-4000-8000-000000000001' : null,
    },
    expiresAt: '2026-08-08T00:00:00.000Z',
  };
}

function service() {
  return {
    getPublicCurrent: vi.fn(async () => ({ document, version })),
    createDocument: vi.fn(async () => document),
    createDraft: vi.fn(async () => ({ ...version, status: 'DRAFT' as const })),
    updateDraft: vi.fn(async () => ({ ...version, status: 'DRAFT' as const })),
    publishVersion: vi.fn(async () => ({ value: version, replayed: false })),
    retireVersion: vi.fn(async () => ({
      value: { ...version, status: 'RETIRED' as const },
      replayed: false,
    })),
  };
}

function app(
  termsService: ReturnType<typeof service>,
  resolveSession: (
    token: string,
  ) => Promise<{ token?: string; session: PublicSession } | null> = async (token) =>
    token === 'platform-session' ? { session: session('PLATFORM', ['platform_admin']) } : null,
) {
  const application = express();
  application.use(express.json({ limit: '1mb', strict: true }));
  application.use((_request, response, next) => {
    response.locals.requestId = 'terms-request-1';
    next();
  });
  application.use(
    '/api/v1',
    createTermsRouter({
      service: termsService,
      resolveSession,
      secureCookies: false,
      sessionTtlSeconds: 28_800,
      now: () => new Date('2026-08-07T12:00:00.000Z'),
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

describe('Terms HTTP contract', () => {
  it('returns only the frozen public current Terms fields and no publication actor', async () => {
    const termsService = service();
    const response = await request(app(termsService)).get(
      '/api/v1/public/terms/current?documentCode=registration-notice&locale=zh-CN',
    );

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      terms: {
        termsDocumentId: documentId,
        termsVersionId: versionId,
        documentCode: document.documentCode,
        title: document.title,
        versionLabel: version.versionLabel,
        locale: version.locale,
        content: version.content,
        contentDigest: version.contentDigest,
        effectiveAt: version.effectiveAt,
        mustReaccept: version.mustReaccept,
      },
    });
    expect(response.text).not.toContain(userId);
    expect(termsService.getPublicCurrent).toHaveBeenCalledWith(
      'registration-notice',
      'zh-CN',
      new Date('2026-08-07T12:00:00.000Z'),
    );
  });

  it('rejects invalid public input and fails closed when no current Terms exist', async () => {
    const termsService = service();
    const invalid = await request(app(termsService)).get('/api/v1/public/terms/current');
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_TERMS_REQUEST');
    expect(termsService.getPublicCurrent).not.toHaveBeenCalled();

    termsService.getPublicCurrent.mockRejectedValueOnce(new TermsNotAvailableError());
    const unavailable = await request(app(termsService)).get(
      '/api/v1/public/terms/current?documentCode=registration-notice&locale=zh-CN',
    );
    expect(unavailable.status).toBe(503);
    expect(unavailable.body.error).toMatchObject({
      code: 'TERMS_NOT_AVAILABLE',
      requestId: 'terms-request-1',
    });
  });

  it('requires a valid PLATFORM platform_admin session before any management call', async () => {
    const termsService = service();
    const missing = await request(app(termsService)).post('/api/v1/platform/terms/documents').send({
      documentCode: 'registration-notice',
      title: 'Registration notice',
    });
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('AUTHENTICATION_REQUIRED');

    const denied = await request(
      app(termsService, async () => ({ session: session('CHANNEL', ['platform_admin']) })),
    )
      .post('/api/v1/platform/terms/documents')
      .set('cookie', 'videoagent_session=channel-session')
      .send({ documentCode: 'registration-notice', title: 'Registration notice' });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('TERMS_PERMISSION_DENIED');
    expect(termsService.createDocument).not.toHaveBeenCalled();
  });

  it('strictly validates management bodies without accepting publication facts', async () => {
    const termsService = service();
    const response = await request(app(termsService))
      .post('/api/v1/platform/terms/documents')
      .set('cookie', 'videoagent_session=platform-session')
      .send({
        documentCode: 'registration-notice',
        title: 'Registration notice',
        publishedBy: userId,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_TERMS_REQUEST');
    expect(termsService.createDocument).not.toHaveBeenCalled();
  });

  it('creates Documents and DRAFT Versions with the authenticated actor', async () => {
    const termsService = service();
    const createdDocument = await request(app(termsService))
      .post('/api/v1/platform/terms/documents')
      .set('cookie', 'videoagent_session=platform-session')
      .send({ documentCode: 'registration-notice', title: 'Registration notice' });
    expect(createdDocument.status).toBe(201);
    expect(termsService.createDocument).toHaveBeenCalledWith(
      { userId, organizationType: 'PLATFORM', roles: ['platform_admin'] },
      { documentCode: 'registration-notice', title: 'Registration notice' },
    );

    const createdDraft = await request(app(termsService))
      .post(`/api/v1/platform/terms/documents/${documentId}/versions`)
      .set('cookie', 'videoagent_session=platform-session')
      .send({
        versionLabel: 'test-v1',
        content: 'Test-only terms body.',
        locale: 'zh-CN',
        mustReaccept: false,
        supersedesTermsVersionId: null,
      });
    expect(createdDraft.status).toBe(201);
    expect(termsService.createDraft).toHaveBeenCalledWith(
      { userId, organizationType: 'PLATFORM', roles: ['platform_admin'] },
      {
        termsDocumentId: documentId,
        versionLabel: 'test-v1',
        content: 'Test-only terms body.',
        locale: 'zh-CN',
        mustReaccept: false,
        supersedesTermsVersionId: null,
      },
    );
  });

  it('updates a DRAFT without accepting client digest or publication evidence', async () => {
    const termsService = service();
    const response = await request(app(termsService))
      .patch(`/api/v1/platform/terms/versions/${versionId}`)
      .set('cookie', 'videoagent_session=platform-session')
      .send({
        versionLabel: 'test-v1-edited',
        content: 'Edited test-only terms body.',
        locale: 'zh-CN',
        mustReaccept: true,
        supersedesTermsVersionId: null,
        effectiveAt: '2026-08-07T13:00:00.000Z',
      });

    expect(response.status).toBe(200);
    expect(termsService.updateDraft).toHaveBeenCalledWith(
      { userId, organizationType: 'PLATFORM', roles: ['platform_admin'] },
      versionId,
      {
        versionLabel: 'test-v1-edited',
        content: 'Edited test-only terms body.',
        locale: 'zh-CN',
        mustReaccept: true,
        supersedesTermsVersionId: null,
        effectiveAt: new Date('2026-08-07T13:00:00.000Z'),
      },
    );
  });

  it('publishes with replay metadata and maps stable domain conflicts', async () => {
    const termsService = service();
    const first = await request(app(termsService))
      .post(`/api/v1/platform/terms/versions/${versionId}/publish`)
      .set('cookie', 'videoagent_session=platform-session')
      .send({ effectiveAt: '2026-08-07T13:00:00.000Z' });
    expect(first.status).toBe(201);
    expect(first.headers['idempotency-replayed']).toBe('false');

    termsService.publishVersion.mockResolvedValueOnce({ value: version, replayed: true });
    const replay = await request(app(termsService))
      .post(`/api/v1/platform/terms/versions/${versionId}/publish`)
      .set('cookie', 'videoagent_session=platform-session')
      .send({ effectiveAt: '2026-08-07T13:00:00.000Z' });
    expect(replay.status).toBe(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');

    termsService.publishVersion.mockRejectedValueOnce(new TermsPublishConflictError());
    const conflict = await request(app(termsService))
      .post(`/api/v1/platform/terms/versions/${versionId}/publish`)
      .set('cookie', 'videoagent_session=platform-session')
      .send({ effectiveAt: '2026-08-07T14:00:00.000Z' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('TERMS_PUBLISH_CONFLICT');
  });

  it('retires Versions idempotently and maps not-found without leaking internals', async () => {
    const termsService = service();
    const retired = await request(app(termsService))
      .post(`/api/v1/platform/terms/versions/${versionId}/retire`)
      .set('cookie', 'videoagent_session=platform-session')
      .send({});
    expect(retired.status).toBe(200);
    expect(retired.headers['idempotency-replayed']).toBe('false');

    termsService.retireVersion.mockRejectedValueOnce(new TermsVersionNotFoundError());
    const missing = await request(app(termsService))
      .post(`/api/v1/platform/terms/versions/${versionId}/retire`)
      .set('cookie', 'videoagent_session=platform-session')
      .send({});
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('TERMS_VERSION_NOT_FOUND');
  });

  it('preserves session rotation for authenticated Terms management', async () => {
    const termsService = service();
    const response = await request(
      app(termsService, async () => ({
        token: 'rotated-session',
        session: session('PLATFORM', ['platform_admin']),
      })),
    )
      .post('/api/v1/platform/terms/documents')
      .set('cookie', 'videoagent_session=old-session')
      .send({ documentCode: 'registration-notice', title: 'Registration notice' });

    expect(response.status).toBe(201);
    expect(response.headers['set-cookie']?.join(';')).toContain(
      'videoagent_session=rotated-session',
    );
    expect(response.headers['set-cookie']?.join(';')).not.toContain('old-session');
  });
});
