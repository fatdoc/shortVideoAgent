import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { contractPayloadDigest } from './digest.js';
import { createInternalProjectGrantRouter } from './internalRoutes.js';
import { type ProjectGrantClaims, ProjectGrantTokenService } from './grantToken.js';

const internalToken = 'production-plane-internal-token-at-least-32-bytes';
const signingSecret = 'project-grant-signing-secret-at-least-32-bytes';
const issuedAt = new Date('2026-08-05T01:00:00.000Z');

function claims(): ProjectGrantClaims {
  const timestamp = Math.floor(issuedAt.getTime() / 1000);
  return {
    iss: 'videoagent-control-plane',
    aud: 'storycanvas-production-plane',
    jti: '10000000-0000-4000-8000-000000000010',
    tenantId: '10000000-0000-4000-8000-000000000001',
    projectId: '10000000-0000-4000-8000-000000000004',
    packageId: '10000000-0000-4000-8000-000000000008',
    capabilities: ['video.generate'],
    scopes: ['production.package.read', 'production.task.write'],
    contractVersion: '0.2',
    nonce: '10000000-0000-4000-8000-000000000011',
    iat: timestamp,
    nbf: timestamp,
    exp: timestamp + 600,
  };
}

function testContext() {
  let now = issuedAt;
  const tokens = new ProjectGrantTokenService(signingSecret, 'pilot-internal-test-kid', () => now);
  const verifyActiveGrantToken = vi.fn(async (token: string) => tokens.verify(token));
  const internalProductionRouter = createInternalProjectGrantRouter({
    internalToken,
    verifier: { verifyActiveGrantToken },
  });
  const app = createApp({
    appVersion: 'test',
    nodeEnv: 'test',
    readinessProbe: async () => undefined,
    internalProductionRouter,
  });
  return {
    app,
    tokens,
    verifyActiveGrantToken,
    setNow(value: Date) {
      now = value;
    },
  };
}

function introspect(app: ReturnType<typeof createApp>, grantToken: string, serviceToken = internalToken) {
  return request(app)
    .post('/api/v1/internal/project-grants/introspect')
    .set('x-production-plane-internal-token', serviceToken)
    .set('authorization', `Bearer ${grantToken}`);
}

describe('internal ProjectGrant introspection', () => {
  it('fails closed before Grant verification when the internal credential is missing or wrong', async () => {
    const context = testContext();
    const grantToken = context.tokens.issue(claims());
    const missing = await request(context.app)
      .post('/api/v1/internal/project-grants/introspect')
      .set('authorization', `Bearer ${grantToken}`);
    const wrong = await introspect(context.app, grantToken, 'wrong-internal-token-at-least-32-bytes');

    for (const response of [missing, wrong]) {
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        objectType: 'StandardError',
        tenantId: 'internal-production-plane',
        projectId: 'internal-production-plane',
        error: {
          code: 'GRANT_INVALID',
          message: 'Project authorization is invalid.',
          details: {},
        },
      });
      expect(response.body.payloadDigest).toBe(contractPayloadDigest(response.body));
      expect(response.text).not.toContain(grantToken);
      expect(response.text).not.toContain(internalToken);
    }
    expect(context.verifyActiveGrantToken).not.toHaveBeenCalled();
  });

  it('returns only the minimal active scope for two valid credentials', async () => {
    const context = testContext();
    const grantToken = context.tokens.issue(claims());
    const response = await introspect(context.app, grantToken);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      active: true,
      grantId: claims().jti,
      tenantId: claims().tenantId,
      projectId: claims().projectId,
      packageId: claims().packageId,
      capabilities: ['video.generate'],
      scopes: ['production.package.read', 'production.task.write'],
      exp: claims().exp,
    });
    expect(response.text).not.toContain(grantToken);
    expect(response.text).not.toContain(internalToken);
  });

  it('returns frozen safe errors for a tampered or expired Grant without echoing credentials', async () => {
    const context = testContext();
    const grantToken = context.tokens.issue(claims());
    const last = grantToken.at(-1);
    const tampered = `${grantToken.slice(0, -1)}${last === 'a' ? 'b' : 'a'}`;
    const tamperedResponse = await introspect(context.app, tampered);
    expect(tamperedResponse.status).toBe(401);
    expect(tamperedResponse.body.error).toMatchObject({
      code: 'GRANT_INVALID',
      message: 'Project authorization is invalid.',
      details: {},
    });

    context.setNow(new Date('2026-08-05T01:10:05.000Z'));
    const expiredResponse = await introspect(context.app, grantToken);
    expect(expiredResponse.status).toBe(410);
    expect(expiredResponse.body.error).toMatchObject({
      code: 'GRANT_EXPIRED',
      message: 'Project authorization has expired.',
      details: {},
    });
    for (const response of [tamperedResponse, expiredResponse]) {
      expect(response.body.payloadDigest).toBe(contractPayloadDigest(response.body));
      expect(response.text).not.toContain(grantToken);
      expect(response.text).not.toContain(internalToken);
      expect(response.headers['cache-control']).toBe('no-store');
    }
  });

  it('rejects body-carried token material without serializing it', async () => {
    const context = testContext();
    const grantToken = context.tokens.issue(claims());
    const response = await introspect(context.app, grantToken).send({ accessToken: grantToken });
    expect(response.status).toBe(422);
    expect(response.body.error).toMatchObject({
      code: 'SCHEMA_INVALID',
      message: 'Request cannot be accepted.',
      details: {},
    });
    expect(response.text).not.toContain(grantToken);
    expect(context.verifyActiveGrantToken).not.toHaveBeenCalled();
  });

  it('rejects a body-supplied grantId instead of letting it override signed claims', async () => {
    const context = testContext();
    const grantToken = context.tokens.issue(claims());
    const forgedGrantId = '20000000-0000-4000-8000-000000000099';
    const response = await introspect(context.app, grantToken).send({ grantId: forgedGrantId });
    expect(response.status).toBe(422);
    expect(response.body.error).toMatchObject({
      code: 'SCHEMA_INVALID',
      message: 'Request cannot be accepted.',
      details: {},
    });
    expect(response.text).not.toContain(forgedGrantId);
    expect(context.verifyActiveGrantToken).not.toHaveBeenCalled();
  });
});
