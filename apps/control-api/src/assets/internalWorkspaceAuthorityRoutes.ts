import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { json, Router } from 'express';
import {
  CANVAS_WORKSPACE_AUTHORITY_ERROR_POLICY,
  CanvasWorkspaceAuthorityError,
  type CanvasWorkspaceAuthorityPublicErrorCode,
} from './workspaceAuthorityErrors.js';
import {
  parseCanvasWorkspaceAuthorityRequest,
  parseCanvasWorkspaceAuthorityResponse,
} from './workspaceAuthorityParser.js';
import { CANVAS_WORKSPACE_AUTHORITY_MAX_REQUEST_BYTES } from './workspaceAuthorityTypes.js';

const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export interface InternalCanvasWorkspaceAuthorityService {
  read(input: unknown): Promise<unknown>;
}

export type InternalCanvasWorkspaceAuthorityRouterOptions = {
  internalToken: string;
  service: InternalCanvasWorkspaceAuthorityService;
};

function sameToken(expected: string, supplied: string | undefined): boolean {
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(expected), digest(supplied ?? ''));
}

function resolveRequestId(request: Request, response: Response): string {
  const local = response.locals.requestId;
  if (typeof local === 'string' && REQUEST_ID.test(local)) return local;
  const supplied = request.header('x-request-id');
  return supplied && REQUEST_ID.test(supplied) ? supplied : randomUUID();
}

function fail(
  response: Response,
  code: CanvasWorkspaceAuthorityPublicErrorCode,
  requestId: string,
): void {
  const policy = CANVAS_WORKSPACE_AUTHORITY_ERROR_POLICY[code];
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-request-id', requestId);
  response.status(policy.status).json({
    error: {
      code,
      message: policy.message,
      retryable: policy.retryable,
      requestId,
    },
  });
}

function isPublicErrorCode(
  code: string,
): code is CanvasWorkspaceAuthorityPublicErrorCode {
  return Object.hasOwn(CANVAS_WORKSPACE_AUTHORITY_ERROR_POLICY, code);
}

export function createInternalCanvasWorkspaceAuthorityRouter(
  options: InternalCanvasWorkspaceAuthorityRouterOptions,
): Router {
  if (Buffer.byteLength(options.internalToken, 'utf8') < 32) {
    throw new Error('Internal Canvas workspace authority token must contain at least 32 bytes.');
  }

  const router = Router();
  router.post(
    '/canvas-workspace-authorities',
    (request, response, next) => {
      const requestId = resolveRequestId(request, response);
      response.locals.requestId = requestId;
      response.setHeader('cache-control', 'no-store');
      response.setHeader('x-request-id', requestId);
      if (
        !sameToken(
          options.internalToken,
          request.header('x-production-plane-internal-token') ?? undefined,
        )
      ) {
        fail(response, 'CANVAS_WORKSPACE_AUTHORITY_INTERNAL_AUTH_INVALID', requestId);
        return;
      }
      next();
    },
    json({ limit: CANVAS_WORKSPACE_AUTHORITY_MAX_REQUEST_BYTES, strict: true }),
    async (request, response) => {
      const requestId = resolveRequestId(request, response);
      try {
        const contentLength = Number(request.header('content-length') ?? '0');
        if (
          (Number.isFinite(contentLength) &&
            contentLength > CANVAS_WORKSPACE_AUTHORITY_MAX_REQUEST_BYTES) ||
          Buffer.byteLength(JSON.stringify(request.body ?? null), 'utf8') >
            CANVAS_WORKSPACE_AUTHORITY_MAX_REQUEST_BYTES
        ) {
          fail(response, 'CANVAS_WORKSPACE_AUTHORITY_REQUEST_TOO_LARGE', requestId);
          return;
        }
        const input = parseCanvasWorkspaceAuthorityRequest(request.body);
        const output = parseCanvasWorkspaceAuthorityResponse(await options.service.read(input));
        response.status(200).json(output);
      } catch (error) {
        if (
          error instanceof CanvasWorkspaceAuthorityError &&
          isPublicErrorCode(error.code)
        ) {
          fail(response, error.code, requestId);
          return;
        }
        fail(response, 'CANVAS_WORKSPACE_AUTHORITY_DEPENDENCY_UNAVAILABLE', requestId);
      }
    },
  );

  router.use((error: unknown, request: Request, response: Response, next: NextFunction) => {
    void next;
    const parser = error as { status?: number; type?: string } | null;
    const requestId = resolveRequestId(request, response);
    if (parser?.status === 413 || parser?.type === 'entity.too.large') {
      fail(response, 'CANVAS_WORKSPACE_AUTHORITY_REQUEST_TOO_LARGE', requestId);
      return;
    }
    if (parser?.status === 400 || parser?.type === 'entity.parse.failed') {
      fail(response, 'CANVAS_WORKSPACE_AUTHORITY_REQUEST_INVALID', requestId);
      return;
    }
    fail(response, 'CANVAS_WORKSPACE_AUTHORITY_DEPENDENCY_UNAVAILABLE', requestId);
  });

  return router;
}
