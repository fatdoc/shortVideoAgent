import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

const INTERNAL_TOKEN_HEADER = 'x-production-plane-internal-token';
const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
const STORYCANVAS_REDEEMER = 'storycanvas-production-plane' as const;
const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;
const idempotencyKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

const uuidSchema = z.string().uuid();
const handleSchema = z.string().regex(/^ce_[A-Za-z0-9_-]{32,64}$/);
const timestampSchema = z.string().refine((value) => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
});
const redemptionBodySchema = z
  .object({
    handle: handleSchema,
    tenantId: uuidSchema,
    projectId: uuidSchema,
    packageId: uuidSchema,
  })
  .strict();
const productionPackageSchema = z
  .object({
    objectType: z.literal('ProjectProductionPackage'),
    contractVersion: z.literal('0.3'),
    tenantId: uuidSchema,
    projectId: uuidSchema,
    packageId: uuidSchema,
  })
  .passthrough();
const projectGrantSchema = z
  .object({
    objectType: z.literal('ProjectGrant'),
    contractVersion: z.literal('0.2'),
    tenantId: uuidSchema,
    projectId: uuidSchema,
    packageId: uuidSchema,
  })
  .passthrough();
const redemptionValueSchema = z
  .object({
    objectType: z.literal('CanvasEntryRedemption'),
    contractVersion: z.literal('0.1'),
    handle: handleSchema,
    tenantId: uuidSchema,
    projectId: uuidSchema,
    packageId: uuidSchema,
    consumedAt: timestampSchema,
    productionPackage: productionPackageSchema,
    grant: projectGrantSchema,
    tokenType: z.literal('Bearer'),
    accessToken: z.string().regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),
  })
  .strict();
const serviceResultSchema = z
  .object({
    value: redemptionValueSchema,
    replayed: z.boolean(),
  })
  .strict();
const redemptionResultSchema = redemptionValueSchema.extend({ replayed: z.boolean() }).strict();

export type RedeemCanvasEntryCommand = {
  handle: string;
  tenantId: string;
  projectId: string;
  packageId: string;
  idempotencyKey: string;
  redeemedBy: typeof STORYCANVAS_REDEEMER;
};

export type CanvasEntryRedemptionResult = z.infer<typeof redemptionResultSchema>;

/** Minimal boundary implemented by the A-BIZ-06E.R3 service slice. */
export interface InternalCanvasEntryRedemptionService {
  redeemEntry(input: RedeemCanvasEntryCommand): Promise<unknown>;
}

export type InternalCanvasEntryRouterOptions = {
  internalToken: string;
  service: InternalCanvasEntryRedemptionService;
};

type SafeError = {
  status: 401 | 404 | 409 | 410 | 422 | 500 | 503;
  code: string;
  message: string;
  category: 'authentication' | 'entry' | 'idempotency' | 'schema' | 'internal' | 'dependency';
  retryable: boolean;
};

const safeErrors = {
  unauthorized: {
    status: 401,
    code: 'CANVAS_ENTRY_INTERNAL_AUTHORIZATION_INVALID',
    message: 'Internal authorization is invalid.',
    category: 'authentication',
    retryable: false,
  },
  notFound: {
    status: 404,
    code: 'CANVAS_ENTRY_NOT_FOUND',
    message: 'Canvas Entry was not found.',
    category: 'entry',
    retryable: false,
  },
  conflict: {
    status: 409,
    code: 'CANVAS_ENTRY_IDEMPOTENCY_CONFLICT',
    message: 'Canvas Entry redemption conflicts with an earlier request.',
    category: 'idempotency',
    retryable: false,
  },
  gone: {
    status: 410,
    code: 'CANVAS_ENTRY_EXPIRED',
    message: 'Canvas Entry authority is no longer active.',
    category: 'entry',
    retryable: false,
  },
  invalid: {
    status: 422,
    code: 'CANVAS_ENTRY_SCHEMA_INVALID',
    message: 'Canvas Entry redemption request cannot be accepted.',
    category: 'schema',
    retryable: false,
  },
  internal: {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Canvas Entry redemption failed unexpectedly.',
    category: 'internal',
    retryable: false,
  },
  unavailable: {
    status: 503,
    code: 'CANVAS_ENTRY_DEPENDENCY_UNAVAILABLE',
    message: 'Canvas Entry redemption is temporarily unavailable.',
    category: 'dependency',
    retryable: true,
  },
} as const satisfies Record<string, SafeError>;

function constantTimeTokenEqual(supplied: string | undefined, expected: string): boolean {
  if (supplied === undefined) return false;
  const suppliedDigest = createHash('sha256').update(supplied, 'utf8').digest();
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(suppliedDigest, expectedDigest);
}

function requestId(response: Response): string {
  const existing = response.locals.requestId;
  if (typeof existing === 'string' && requestIdPattern.test(existing)) return existing;
  const generated = randomUUID();
  response.locals.requestId = generated;
  return generated;
}

function sendError(response: Response, policy: SafeError): void {
  const id = requestId(response);
  response.setHeader('x-request-id', id);
  response.setHeader('cache-control', 'no-store');
  response.status(policy.status).json({
    error: {
      code: policy.code,
      message: policy.message,
      category: policy.category,
      retryable: policy.retryable,
      details: {},
      requestId: id,
    },
  });
}

function caughtStatus(caught: unknown): number | null {
  if (typeof caught !== 'object' || caught === null || !('status' in caught)) return null;
  return typeof caught.status === 'number' ? caught.status : null;
}

function dependencyUnavailable(caught: unknown): boolean {
  if (!(caught instanceof Error) || !('code' in caught) || typeof caught.code !== 'string') {
    return false;
  }
  return (
    ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH'].includes(
      caught.code,
    ) || /^(?:08[A-Z0-9]{3}|53[A-Z0-9]{3}|57P0[123])$/.test(caught.code)
  );
}

function safeCaughtError(caught: unknown): SafeError {
  switch (caughtStatus(caught)) {
    case 404:
      return safeErrors.notFound;
    case 409:
      return safeErrors.conflict;
    case 410:
      return safeErrors.gone;
    case 422:
      return safeErrors.invalid;
    case 503:
      return safeErrors.unavailable;
    default:
      return dependencyUnavailable(caught) ? safeErrors.unavailable : safeErrors.internal;
  }
}

function parseIdempotencyKey(value: string | undefined): string | null {
  return value !== undefined && idempotencyKeyPattern.test(value) ? value : null;
}

function bindingsMatch(
  value: CanvasEntryRedemptionResult,
  input: z.infer<typeof redemptionBodySchema>,
): boolean {
  const records = [value, value.productionPackage, value.grant];
  return (
    value.handle === input.handle &&
    records.every(
      (record) =>
        record.tenantId === input.tenantId &&
        record.projectId === input.projectId &&
        record.packageId === input.packageId,
    )
  );
}

export function createInternalCanvasEntryRouter(options: InternalCanvasEntryRouterOptions): Router {
  if (Buffer.byteLength(options.internalToken, 'utf8') < 32) {
    throw new Error('Internal Canvas Entry token must contain at least 32 bytes.');
  }

  const router = Router();

  router.use((request, response, next) => {
    const existing = response.locals.requestId;
    const supplied = request.header('x-request-id');
    const id =
      typeof existing === 'string' && requestIdPattern.test(existing)
        ? existing
        : supplied && requestIdPattern.test(supplied)
          ? supplied
          : randomUUID();
    response.locals.requestId = id;
    response.setHeader('x-request-id', id);
    response.setHeader('cache-control', 'no-store');
    next();
  });

  router.post('/canvas-entries/redeem', async (request, response) => {
    if (!constantTimeTokenEqual(request.header(INTERNAL_TOKEN_HEADER), options.internalToken)) {
      sendError(response, safeErrors.unauthorized);
      return;
    }

    const idempotencyKey = parseIdempotencyKey(request.header(IDEMPOTENCY_KEY_HEADER));
    const parsedBody = redemptionBodySchema.safeParse(request.body);
    if (!request.is('application/json') || idempotencyKey === null || !parsedBody.success) {
      sendError(response, safeErrors.invalid);
      return;
    }

    try {
      const rawResult = await options.service.redeemEntry({
        ...parsedBody.data,
        idempotencyKey,
        redeemedBy: STORYCANVAS_REDEEMER,
      });
      const parsedServiceResult = serviceResultSchema.safeParse(rawResult);
      if (!parsedServiceResult.success) {
        sendError(response, safeErrors.internal);
        return;
      }
      const result = {
        ...parsedServiceResult.data.value,
        replayed: parsedServiceResult.data.replayed,
      };
      if (!bindingsMatch(result, parsedBody.data)) {
        sendError(response, safeErrors.internal);
        return;
      }

      response.setHeader('idempotency-replayed', String(result.replayed));
      response.status(200).json(result);
    } catch (caught) {
      sendError(response, safeCaughtError(caught));
    }
  });

  return router;
}
