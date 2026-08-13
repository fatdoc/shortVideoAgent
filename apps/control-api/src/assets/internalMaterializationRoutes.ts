import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { json, Router } from 'express';
import {
  CANVAS_MATERIALIZATION_ERROR_POLICY,
  CanvasMaterializationError,
  type CanvasMaterializationErrorCode,
} from './materializationErrors.js';
import {
  parseCanvasAssetMaterializationRequest,
  parseCanvasAssetMaterializationResponse,
} from './materializationParser.js';
import { CANVAS_MATERIALIZATION_MAX_REQUEST_BYTES } from './materializationTypes.js';

const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export interface InternalCanvasAssetMaterializationService {
  materialize(input: unknown): Promise<unknown>;
}

export type InternalCanvasAssetMaterializationRouterOptions = {
  internalToken: string;
  service: InternalCanvasAssetMaterializationService;
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

function fail(response: Response, code: CanvasMaterializationErrorCode, id: string): void {
  const policy = CANVAS_MATERIALIZATION_ERROR_POLICY[code];
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-request-id', id);
  response.status(policy.status).json({
    error: { code, message: policy.message, retryable: policy.retryable, requestId: id },
  });
}

export function createInternalCanvasAssetMaterializationRouter(
  options: InternalCanvasAssetMaterializationRouterOptions,
): Router {
  if (Buffer.byteLength(options.internalToken, 'utf8') < 32) {
    throw new Error('Internal Canvas asset materialization token must contain at least 32 bytes.');
  }
  const router = Router();
  router.post(
    '/canvas-assets/materializations',
    (request, response, next) => {
      const id = resolveRequestId(request, response);
      response.locals.requestId = id;
      response.setHeader('cache-control', 'no-store');
      response.setHeader('x-request-id', id);
      if (
        !sameToken(
          options.internalToken,
          request.header('x-production-plane-internal-token') ?? undefined,
        )
      ) {
        fail(response, 'CANVAS_MATERIALIZATION_INTERNAL_AUTH_INVALID', id);
        return;
      }
      next();
    },
    json({ limit: CANVAS_MATERIALIZATION_MAX_REQUEST_BYTES, strict: true }),
    async (request, response) => {
      const id = resolveRequestId(request, response);
      try {
        const contentLength = Number(request.header('content-length') ?? '0');
        if (
          (Number.isFinite(contentLength) &&
            contentLength > CANVAS_MATERIALIZATION_MAX_REQUEST_BYTES) ||
          Buffer.byteLength(JSON.stringify(request.body ?? null), 'utf8') >
            CANVAS_MATERIALIZATION_MAX_REQUEST_BYTES
        ) {
          fail(response, 'CANVAS_MATERIALIZATION_REQUEST_TOO_LARGE', id);
          return;
        }
        const input = parseCanvasAssetMaterializationRequest(request.body);
        const output = parseCanvasAssetMaterializationResponse(
          await options.service.materialize(input),
        );
        response.status(output.replayed ? 200 : 201).json(output);
      } catch (error) {
        if (error instanceof CanvasMaterializationError) {
          fail(response, error.code, id);
          return;
        }
        fail(response, 'CANVAS_MATERIALIZATION_DEPENDENCY_UNAVAILABLE', id);
      }
    },
  );
  router.use((error: unknown, request: Request, response: Response, next: NextFunction) => {
    void next;
    const parser = error as { status?: number; type?: string } | null;
    const id = resolveRequestId(request, response);
    if (parser?.status === 413 || parser?.type === 'entity.too.large') {
      fail(response, 'CANVAS_MATERIALIZATION_REQUEST_TOO_LARGE', id);
      return;
    }
    if (parser?.status === 400 || parser?.type === 'entity.parse.failed') {
      fail(response, 'CANVAS_MATERIALIZATION_REQUEST_INVALID', id);
      return;
    }
    fail(response, 'CANVAS_MATERIALIZATION_DEPENDENCY_UNAVAILABLE', id);
  });
  return router;
}
