import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { json, Router } from 'express';
import { CANVAS_ASSET_ERROR_STATUS, CanvasAssetDomainError } from './errors.js';
import { parseCanvasAssetSessionRegistration } from './sessionService.js';
import type { CanvasAssetSessionRegistrationResult } from './sessionTypes.js';

const MAX_BODY_BYTES = 16 * 1024;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export interface InternalCanvasAssetSessionService {
  registerSession(input: unknown): Promise<CanvasAssetSessionRegistrationResult>;
}

export type InternalCanvasAssetSessionRouterOptions = {
  internalToken: string;
  service: InternalCanvasAssetSessionService;
};

function sameToken(expected: string, supplied: string | undefined): boolean {
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(expected), digest(supplied ?? ''));
}

function requestId(request: Request, response: Response): string {
  const local = response.locals.requestId;
  if (typeof local === 'string' && REQUEST_ID_PATTERN.test(local)) return local;
  const supplied = request.header('x-request-id');
  return supplied && REQUEST_ID_PATTERN.test(supplied) ? supplied : randomUUID();
}

function fail(response: Response, status: number, code: string, message: string, id: string): void {
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-request-id', id);
  response.status(status).json({ error: { code, message, requestId: id } });
}

export function createInternalCanvasAssetSessionRouter(
  options: InternalCanvasAssetSessionRouterOptions,
): Router {
  if (Buffer.byteLength(options.internalToken, 'utf8') < 32) {
    throw new Error('Internal Canvas asset session token must contain at least 32 bytes.');
  }
  const router = Router();
  router.post(
    '/canvas-asset-sessions',
    (request, response, next) => {
      const id = requestId(request, response);
      response.locals.requestId = id;
      response.setHeader('cache-control', 'no-store');
      response.setHeader('x-request-id', id);
      if (
        !sameToken(
          options.internalToken,
          request.header('x-production-plane-internal-token') ?? undefined,
        )
      ) {
        fail(response, 401, 'CANVAS_SESSION_UNAUTHORIZED', 'Internal authentication failed.', id);
        return;
      }
      next();
    },
    json({ limit: MAX_BODY_BYTES, strict: true }),
    async (request, response) => {
      const id = requestId(request, response);
      const contentLength = Number(request.header('content-length') ?? '0');
      if (
        (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) ||
        Buffer.byteLength(JSON.stringify(request.body ?? null), 'utf8') > MAX_BODY_BYTES
      ) {
        fail(response, 413, 'CANVAS_SESSION_REQUEST_TOO_LARGE', 'Request body is too large.', id);
        return;
      }
      try {
        const result = await options.service.registerSession(
          parseCanvasAssetSessionRegistration(request.body),
        );
        response.setHeader('idempotency-replayed', String(result.replayed));
        response.status(result.replayed ? 200 : 201).json(result);
      } catch (error) {
        if (error instanceof CanvasAssetDomainError) {
          fail(response, CANVAS_ASSET_ERROR_STATUS[error.code], error.code, error.message, id);
          return;
        }
        fail(
          response,
          503,
          'CANVAS_SESSION_UNAVAILABLE',
          'Canvas session authority is unavailable.',
          id,
        );
      }
    },
  );
  router.use((error: unknown, request: Request, response: Response, next: NextFunction) => {
    const parser = error as { status?: number; type?: string } | null;
    const id = requestId(request, response);
    if (parser?.status === 413 || parser?.type === 'entity.too.large') {
      fail(response, 413, 'CANVAS_SESSION_REQUEST_TOO_LARGE', 'Request body is too large.', id);
      return;
    }
    if (parser?.status === 400 || parser?.type === 'entity.parse.failed') {
      fail(response, 400, 'CANVAS_SESSION_REQUEST_INVALID', 'Request body is invalid.', id);
      return;
    }
    next(error);
  });
  return router;
}
