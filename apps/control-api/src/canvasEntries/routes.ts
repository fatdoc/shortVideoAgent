import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { readCookie, SESSION_COOKIE_NAME } from '../auth/session.js';
import type { PublicSession } from '../auth/service.js';
import { allowsProjectAction, type ProjectPolicy } from '../projects/policy.js';
import type { SessionActor } from '../projects/types.js';
import { CanvasEntryDomainError, canvasEntryError, safeCanvasEntryError } from './errors.js';
import {
  assertNonSecretBrowserPayload,
  parseCanvasEntryHandle,
  parseCanvasEntryPublicDto,
  parseCanvasEntryUuid,
  parseCreateCanvasEntryInput,
} from './parser.js';
import type { CanvasEntryService } from './service.js';
import {
  CANVAS_ENTRY_MAX_TTL_SECONDS,
  CANVAS_ENTRY_MIN_TTL_SECONDS,
  type CanvasEntryPublicDto,
  type CreateCanvasEntryResult,
} from './types.js';

const createBodySchema = z
  .object({
    packageId: z.string().uuid(),
    ttlSeconds: z
      .number()
      .int()
      .min(CANVAS_ENTRY_MIN_TTL_SECONDS)
      .max(CANVAS_ENTRY_MAX_TTL_SECONDS),
  })
  .strict();

export type CanvasEntryRouteService = Pick<CanvasEntryService, 'createEntry' | 'readEntry'>;

type SessionResolution = { token?: string; session: PublicSession };

export type CanvasEntryRouterOptions = {
  service: CanvasEntryRouteService;
  policy: ProjectPolicy;
  resolveSession: (token: string) => Promise<SessionResolution | null>;
  secureCookies: boolean;
  sessionTtlSeconds: number;
};

type ActorResponse = Response & { locals: { requestId: string; actor?: SessionActor } };

function publicError(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({
    error: { code, message, requestId: response.locals.requestId },
  });
}

function domainError(response: Response, caught: CanvasEntryDomainError): void {
  const safe = safeCanvasEntryError(caught);
  response.status(safe.status).json({
    error: {
      code: safe.code,
      message: safe.message,
      category: safe.category,
      retryable: safe.retryable,
      details: safe.details,
      requestId: response.locals.requestId,
    },
  });
}

function internalError(response: Response): void {
  publicError(response, 500, 'INTERNAL_ERROR', 'Canvas Entry service is temporarily unavailable.');
}

function actor(response: ActorResponse): SessionActor {
  if (!response.locals.actor) throw new Error('authenticated actor is missing');
  return response.locals.actor;
}

function setRotatedCookie(
  response: Response,
  token: string,
  options: CanvasEntryRouterOptions,
): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: options.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: options.sessionTtlSeconds * 1000,
  });
}

function schemaError(fieldPaths: string[] = []): CanvasEntryDomainError {
  return canvasEntryError(
    'CANVAS_ENTRY_SCHEMA_INVALID',
    'Canvas Entry HTTP input violated the strict browser contract.',
    fieldPaths.length > 0 ? { fieldPaths } : {},
  );
}

function parseCreateBody(input: unknown): { packageId: string; ttlSeconds: number } {
  assertNonSecretBrowserPayload(input);
  const parsed = createBodySchema.safeParse(input);
  if (!parsed.success) {
    const fieldPaths = parsed.error.issues
      .map((issue) => `/${issue.path.map(String).join('/')}`)
      .filter((path, index, paths) => paths.indexOf(path) === index)
      .slice(0, 20);
    throw schemaError(fieldPaths);
  }
  return parsed.data;
}

function validateCreateResult(result: CreateCanvasEntryResult): {
  value: CanvasEntryPublicDto;
  replayed: boolean;
} {
  if (typeof result.replayed !== 'boolean') throw new Error('invalid replay result');
  return { value: parseCanvasEntryPublicDto(result.value), replayed: result.replayed };
}

async function authenticate(
  request: { header(name: string): string | undefined },
  response: ActorResponse,
  options: CanvasEntryRouterOptions,
): Promise<boolean> {
  if (response.locals.actor) return true;
  const token = readCookie(request.header('cookie'), SESSION_COOKIE_NAME);
  if (!token) {
    publicError(response, 401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
    return false;
  }
  const resolved = await options.resolveSession(token);
  if (!resolved) {
    publicError(response, 401, 'SESSION_INVALID', 'The session is invalid or expired.');
    return false;
  }
  if (resolved.token) setRotatedCookie(response, resolved.token, options);
  const context = resolved.session.activeContext;
  if (!resolved.session.tenant || context.organizationType !== 'TENANT') {
    publicError(response, 403, 'TENANT_CONTEXT_REQUIRED', 'A Tenant session is required.');
    return false;
  }
  if (context.tenantId !== resolved.session.tenant.id) {
    publicError(response, 401, 'SESSION_INVALID', 'The session context is invalid.');
    return false;
  }
  response.locals.actor = {
    userId: resolved.session.user.id,
    membershipId: context.membershipId,
    organizationId: context.organizationId,
    organizationType: 'TENANT',
    tenantId: resolved.session.tenant.id,
    membershipVersion: context.membershipVersion,
    primaryRole: context.primaryRole,
    roles: context.roles,
  };
  return true;
}

export function createCanvasEntryRouter(options: CanvasEntryRouterOptions): Router {
  const router = Router();

  router.use(
    '/projects/:projectId/canvas-entries',
    async (request, response: ActorResponse, next) => {
      response.setHeader('cache-control', 'no-store');
      try {
        if (await authenticate(request, response, options)) next();
      } catch {
        internalError(response);
      }
    },
  );

  router.post('/projects/:projectId/canvas-entries', async (request, response: ActorResponse) => {
    try {
      const projectId = parseCanvasEntryUuid(request.params.projectId);
      const body = parseCreateBody(request.body);
      const input = parseCreateCanvasEntryInput({
        packageId: body.packageId,
        ttlSeconds: body.ttlSeconds,
        idempotencyKey: request.header('idempotency-key'),
      });
      const access = await options.policy.resolveProjectAccess(actor(response), projectId);
      if (!access) {
        domainError(
          response,
          canvasEntryError('CANVAS_ENTRY_NOT_FOUND', 'Project scope was not available.'),
        );
        return;
      }
      if (!allowsProjectAction(access, 'project.production.write')) {
        publicError(
          response,
          403,
          'PERMISSION_DENIED',
          'The current project role cannot create Canvas Entries.',
        );
        return;
      }

      const result = validateCreateResult(
        await options.service.createEntry(actor(response), projectId, input),
      );
      response.setHeader('idempotency-replayed', String(result.replayed));
      response.status(result.replayed ? 200 : 201).json(result.value);
    } catch (caught) {
      if (caught instanceof CanvasEntryDomainError) {
        domainError(response, caught);
        return;
      }
      internalError(response);
    }
  });

  router.get(
    '/projects/:projectId/canvas-entries/:handle',
    async (request, response: ActorResponse) => {
      try {
        const projectId = parseCanvasEntryUuid(request.params.projectId);
        const handle = parseCanvasEntryHandle(request.params.handle);
        const access = await options.policy.resolveProjectAccess(actor(response), projectId);
        if (!access) {
          domainError(
            response,
            canvasEntryError('CANVAS_ENTRY_NOT_FOUND', 'Project scope was not available.'),
          );
          return;
        }
        if (!allowsProjectAction(access, 'project.production.read')) {
          publicError(
            response,
            403,
            'PERMISSION_DENIED',
            'The current project role cannot read Canvas Entries.',
          );
          return;
        }

        const value = parseCanvasEntryPublicDto(
          await options.service.readEntry(actor(response), projectId, handle),
        );
        response.status(200).json(value);
      } catch (caught) {
        if (caught instanceof CanvasEntryDomainError) {
          domainError(response, caught);
          return;
        }
        internalError(response);
      }
    },
  );

  return router;
}
