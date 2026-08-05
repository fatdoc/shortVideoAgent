import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import { Router } from 'express';
import { contractPayloadDigest } from './digest.js';
import { ProductionDomainError, safeProductionError } from './errors.js';
import type { ProjectGrantClaims } from './grantToken.js';

const INTERNAL_TOKEN_HEADER = 'x-production-plane-internal-token';
const INTERNAL_SCOPE_ID = 'internal-production-plane';

export interface ActiveProjectGrantVerifier {
  verifyActiveGrantToken(token: string): Promise<ProjectGrantClaims>;
}

export type InternalProjectGrantRouterOptions = {
  internalToken: string;
  verifier: ActiveProjectGrantVerifier;
};

function constantTimeTokenEqual(supplied: string | undefined, expected: string): boolean {
  if (!supplied) return false;
  const suppliedDigest = createHash('sha256').update(supplied).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(suppliedDigest, expectedDigest);
}

function bearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization);
  return match?.[1] ?? null;
}

function sendStandardError(
  response: Response,
  error: ProductionDomainError,
  idempotencyKey: string,
): void {
  const safe = safeProductionError(error);
  const unsigned = {
    objectType: 'StandardError' as const,
    contractVersion: '0.2' as const,
    tenantId: INTERNAL_SCOPE_ID,
    projectId: INTERNAL_SCOPE_ID,
    idempotencyKey,
    occurredAt: new Date().toISOString(),
    errorId: randomUUID(),
    requestId: response.locals.requestId as string,
    error: {
      code: safe.code,
      message: safe.message,
      retryable: safe.retryable,
      category: safe.category,
      details: safe.details,
    },
  };
  response.setHeader('cache-control', 'no-store');
  response.status(safe.status).json({ ...unsigned, payloadDigest: contractPayloadDigest(unsigned) });
}

function invalidAuthorization(): ProductionDomainError {
  return new ProductionDomainError('internal authorization failed', 401, 'GRANT_INVALID', 'grant');
}

export function createInternalProjectGrantRouter(
  options: InternalProjectGrantRouterOptions,
): Router {
  const router = Router();

  router.post('/project-grants/introspect', async (request, response) => {
    const requestKey = `introspect-${response.locals.requestId as string}`;
    if (!constantTimeTokenEqual(request.header(INTERNAL_TOKEN_HEADER), options.internalToken)) {
      sendStandardError(response, invalidAuthorization(), requestKey);
      return;
    }
    const grantToken = bearerToken(request.header('authorization'));
    if (!grantToken) {
      sendStandardError(response, invalidAuthorization(), requestKey);
      return;
    }
    if (
      request.body !== undefined &&
      (typeof request.body !== 'object' ||
        request.body === null ||
        Array.isArray(request.body) ||
        Object.keys(request.body as Record<string, unknown>).length > 0)
    ) {
      sendStandardError(
        response,
        new ProductionDomainError('unexpected introspection body', 422, 'SCHEMA_INVALID', 'schema'),
        requestKey,
      );
      return;
    }

    try {
      const claims = await options.verifier.verifyActiveGrantToken(grantToken);
      response.setHeader('cache-control', 'no-store');
      response.status(200).json({
        active: true,
        grantId: claims.jti,
        tenantId: claims.tenantId,
        projectId: claims.projectId,
        packageId: claims.packageId,
        capabilities: claims.capabilities,
        scopes: claims.scopes,
        exp: claims.exp,
      });
    } catch (error) {
      sendStandardError(
        response,
        error instanceof ProductionDomainError ? error : invalidAuthorization(),
        requestKey,
      );
    }
  });

  return router;
}
