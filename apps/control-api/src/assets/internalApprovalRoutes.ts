import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { json, Router } from 'express';
import { CANVAS_ASSET_ERROR_STATUS, CanvasAssetDomainError } from './errors.js';
import { parseConsumeHighCostApprovalInput, parseHighCostApprovalProjection } from './parser.js';

const MAX_BODY_BYTES = 64 * 1024;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export interface InternalCanvasApprovalService {
  consumeHighCostApproval(input: unknown): Promise<unknown>;
}

export type InternalCanvasApprovalRouterOptions = {
  internalToken: string;
  service: InternalCanvasApprovalService;
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

function fail(
  response: Response,
  status: number,
  code: string,
  message: string,
  id: string,
  retryable = false,
): void {
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-request-id', id);
  response.status(status).json({ error: { code, message, retryable, requestId: id } });
}

export function createInternalCanvasApprovalRouter(
  options: InternalCanvasApprovalRouterOptions,
): Router {
  if (Buffer.byteLength(options.internalToken, 'utf8') < 32) {
    throw new Error('Internal Canvas approval token must contain at least 32 bytes.');
  }
  const router = Router();
  router.post(
    '/canvas-command-approvals/consume',
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
        fail(
          response,
          401,
          'CANVAS_APPROVAL_INTERNAL_AUTHORIZATION_INVALID',
          'Internal authorization is invalid.',
          id,
        );
        return;
      }
      next();
    },
    json({ limit: MAX_BODY_BYTES, strict: true }),
    async (request, response) => {
      const id = requestId(request, response);
      try {
        const input = parseConsumeHighCostApprovalInput(request.body);
        const consumed = await options.service.consumeHighCostApproval(input);
        const authority = consumed as {
          approvalId?: unknown;
          status?: unknown;
          replayed?: unknown;
        };
        const projection = parseHighCostApprovalProjection({
          approvalId: authority.approvalId,
          status: authority.status,
        });
        const replayed = authority.replayed;
        if (projection.status !== 'consumed' || typeof replayed !== 'boolean') {
          fail(
            response,
            503,
            'CANVAS_APPROVAL_DEPENDENCY_UNAVAILABLE',
            'Canvas approval authority is unavailable.',
            id,
            true,
          );
          return;
        }
        response.status(200).json({ ...projection, replayed });
      } catch (error) {
        if (error instanceof CanvasAssetDomainError) {
          fail(
            response,
            CANVAS_ASSET_ERROR_STATUS[error.code],
            error.code,
            error.message,
            id,
          );
          return;
        }
        fail(
          response,
          503,
          'CANVAS_APPROVAL_DEPENDENCY_UNAVAILABLE',
          'Canvas approval authority is unavailable.',
          id,
          true,
        );
      }
    },
  );
  router.use((error: unknown, request: Request, response: Response, next: NextFunction) => {
    const parser = error as { status?: number; type?: string } | null;
    const id = requestId(request, response);
    if (parser?.status === 413 || parser?.type === 'entity.too.large') {
      fail(
        response,
        413,
        'CANVAS_APPROVAL_REQUEST_TOO_LARGE',
        'Request body is too large.',
        id,
      );
      return;
    }
    if (parser?.status === 400 || parser?.type === 'entity.parse.failed') {
      fail(response, 400, 'CANVAS_APPROVAL_REQUEST_INVALID', 'Request body is invalid.', id);
      return;
    }
    next(error);
  });
  return router;
}
