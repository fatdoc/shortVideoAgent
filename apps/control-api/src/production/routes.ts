import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { readCookie, SESSION_COOKIE_NAME } from '../auth/session.js';
import type { PublicSession } from '../auth/service.js';
import { allowsProjectAction, type ProjectAction, type ProjectPolicy } from '../projects/policy.js';
import type { SessionActor } from '../projects/types.js';
import { contractPayloadDigest } from './digest.js';
import { ProductionDomainError, safeProductionError } from './errors.js';
import { productionCapabilities, productionScopes, type ProductionStore } from './types.js';

const uuidSchema = z.string().uuid();
const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/);
const capabilitySchema = z.enum(productionCapabilities);
const scopeSchema = z.enum(productionScopes);
const createPackageSchema = z
  .object({
    scriptVersionId: uuidSchema,
    capabilityRequirements: z.array(capabilitySchema).min(1).max(4),
    expiresInSeconds: z.number().int().min(300).max(86_400).default(21_600),
  })
  .strict()
  .refine(
    (value) => new Set(value.capabilityRequirements).size === value.capabilityRequirements.length,
    'capabilityRequirements must be unique',
  );
const issueGrantSchema = z
  .object({
    packageId: uuidSchema,
    requestedCapabilities: z.array(capabilitySchema).min(1).max(4),
    requestedScopes: z.array(scopeSchema).min(1).max(5),
    ttlSeconds: z.number().int().min(60).max(900).default(600),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.requestedCapabilities).size === value.requestedCapabilities.length &&
      new Set(value.requestedScopes).size === value.requestedScopes.length,
    'grant capabilities and scopes must be unique',
  );

type SessionResolution = { token?: string; session: PublicSession };

export type ProductionRouterOptions = {
  store: ProductionStore;
  policy: ProjectPolicy;
  resolveSession: (token: string) => Promise<SessionResolution | null>;
  secureCookies: boolean;
  sessionTtlSeconds: number;
};

type ActorResponse = Response & { locals: { requestId: string; actor?: SessionActor } };

function legacyError(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({ error: { code, message, requestId: response.locals.requestId } });
}

function standardError(
  response: ActorResponse,
  caught: ProductionDomainError,
  projectId: string,
  idempotencyKey: string,
): void {
  const actor = response.locals.actor;
  if (!actor) throw new Error('authenticated actor is missing');
  const safe = safeProductionError(caught);
  const unsigned = {
    objectType: 'StandardError' as const,
    contractVersion: '0.2' as const,
    tenantId: actor.tenantId,
    projectId,
    idempotencyKey,
    occurredAt: new Date().toISOString(),
    errorId: randomUUID(),
    requestId: response.locals.requestId,
    error: {
      code: safe.code,
      message: safe.message,
      retryable: safe.retryable,
      category: safe.category,
      details: safe.details,
    },
  };
  response
    .status(safe.status)
    .json({ ...unsigned, payloadDigest: contractPayloadDigest(unsigned) });
}

function actor(response: ActorResponse): SessionActor {
  if (!response.locals.actor) throw new Error('authenticated actor is missing');
  return response.locals.actor;
}

async function authorizeProject(
  response: ActorResponse,
  options: ProductionRouterOptions,
  projectId: string,
  action: ProjectAction,
  idempotencyKey: string,
): Promise<boolean> {
  const access = await options.policy.resolveProjectAccess(actor(response), projectId);
  if (!access) {
    standardError(
      response,
      new ProductionDomainError('project scope denied', 403, 'PROJECT_SCOPE_MISMATCH', 'scope'),
      projectId,
      idempotencyKey,
    );
    return false;
  }
  if (!allowsProjectAction(access, action)) {
    standardError(
      response,
      new ProductionDomainError('project action denied', 403, 'CAPABILITY_SCOPE_DENIED', 'scope'),
      projectId,
      idempotencyKey,
    );
    return false;
  }
  return true;
}

function idempotency(response: Response, value: string | undefined): string | null {
  const parsed = idempotencyKeySchema.safeParse(value);
  if (!parsed.success) {
    legacyError(
      response,
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
      '写入请求必须提供有效的 Idempotency-Key。',
    );
    return null;
  }
  return parsed.data;
}

function setRotatedCookie(
  response: Response,
  token: string,
  options: ProductionRouterOptions,
): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: options.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: options.sessionTtlSeconds * 1000,
  });
}

export function createProductionRouter(options: ProductionRouterOptions): Router {
  const router = Router();

  router.use(async (request, response: ActorResponse, next) => {
    try {
      if (response.locals.actor) {
        next();
        return;
      }
      const token = readCookie(request.header('cookie'), SESSION_COOKIE_NAME);
      if (!token) {
        legacyError(response, 401, 'AUTHENTICATION_REQUIRED', '请先登录。');
        return;
      }
      const resolved = await options.resolveSession(token);
      if (!resolved) {
        legacyError(response, 401, 'SESSION_INVALID', '会话已失效，请重新登录。');
        return;
      }
      if (resolved.token) setRotatedCookie(response, resolved.token, options);
      if (!resolved.session.tenant) {
        legacyError(response, 403, 'TENANT_CONTEXT_REQUIRED', '当前组织不能访问生产内容。');
        return;
      }
      const context = resolved.session.activeContext;
      if (
        context.organizationType !== 'TENANT' ||
        context.tenantId !== resolved.session.tenant.id
      ) {
        legacyError(response, 401, 'SESSION_INVALID', '会话上下文无效，请重新登录。');
        return;
      }
      response.locals.actor = {
        userId: resolved.session.user.id,
        membershipId: context.membershipId,
        organizationId: context.organizationId,
        organizationType: context.organizationType,
        tenantId: resolved.session.tenant.id,
        membershipVersion: context.membershipVersion,
        primaryRole: context.primaryRole,
        roles: context.roles,
      };
      next();
    } catch (error) {
      next(error);
    }
  });

  router.use((request, response: ActorResponse, next) => {
    if (request.method !== 'POST') {
      next();
      return;
    }
    const roles = actor(response).roles;
    if (!roles.includes('tenant_admin') && !roles.includes('content_operator')) {
      legacyError(response, 403, 'PRODUCTION_WRITE_FORBIDDEN', '当前角色不能签发生产包或授权。');
      return;
    }
    next();
  });

  router.post(
    '/projects/:projectId/production-packages',
    async (request, response: ActorResponse, next) => {
      const parsedProject = uuidSchema.safeParse(request.params.projectId);
      const parsed = createPackageSchema.safeParse(request.body);
      const key = idempotency(response, request.header('idempotency-key'));
      if (!parsedProject.success || !parsed.success || !key) {
        if ((!parsedProject.success || !parsed.success) && key) {
          standardError(
            response,
            new ProductionDomainError(
              '生产包请求不符合 Pilot Contract v0.2。',
              422,
              'SCHEMA_INVALID',
              'schema',
            ),
            parsedProject.success ? parsedProject.data : 'invalid-project',
            key,
          );
        }
        return;
      }
      try {
        if (
          !(await authorizeProject(
            response,
            options,
            parsedProject.data,
            'project.production.write',
            key,
          ))
        )
          return;
        const result = await options.store.createPackage(
          actor(response),
          parsedProject.data,
          parsed.data,
          {
            operation: 'production.package.create',
            key,
            scope: { projectId: parsedProject.data },
            payload: parsed.data,
          },
        );
        if (!result) {
          standardError(
            response,
            new ProductionDomainError(
              'project lookup failed',
              403,
              'PROJECT_SCOPE_MISMATCH',
              'scope',
            ),
            parsedProject.data,
            key,
          );
          return;
        }
        response.setHeader('idempotency-replayed', String(result.replayed));
        response.status(result.replayed ? 200 : 201).json(result.value);
      } catch (error) {
        if (error instanceof ProductionDomainError) {
          standardError(response, error, parsedProject.data, key);
          return;
        }
        next(error);
      }
    },
  );

  router.get(
    '/projects/:projectId/production-packages/:packageId',
    async (request, response: ActorResponse, next) => {
      const parsedProject = uuidSchema.safeParse(request.params.projectId);
      const parsedPackage = uuidSchema.safeParse(request.params.packageId);
      if (!parsedProject.success || !parsedPackage.success) {
        standardError(
          response,
          new ProductionDomainError('invalid path', 422, 'SCHEMA_INVALID', 'schema'),
          parsedProject.success ? parsedProject.data : 'invalid-project',
          `read-${response.locals.requestId}`,
        );
        return;
      }
      try {
        const readKey = `read-${response.locals.requestId}`;
        if (
          !(await authorizeProject(
            response,
            options,
            parsedProject.data,
            'project.production.read',
            readKey,
          ))
        )
          return;
        const value = await options.store.getPackage(
          actor(response),
          parsedProject.data,
          parsedPackage.data,
        );
        if (!value) {
          standardError(
            response,
            new ProductionDomainError(
              'package lookup failed',
              403,
              'PROJECT_SCOPE_MISMATCH',
              'scope',
            ),
            parsedProject.data,
            readKey,
          );
        } else response.status(200).json(value);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/projects/:projectId/production-grants',
    async (request, response: ActorResponse, next) => {
      const parsedProject = uuidSchema.safeParse(request.params.projectId);
      const parsed = issueGrantSchema.safeParse(request.body);
      const key = idempotency(response, request.header('idempotency-key'));
      if (!parsedProject.success || !parsed.success || !key) {
        if ((!parsedProject.success || !parsed.success) && key) {
          standardError(
            response,
            new ProductionDomainError(
              '项目授权请求不符合 Pilot Contract v0.2。',
              422,
              'SCHEMA_INVALID',
              'schema',
            ),
            parsedProject.success ? parsedProject.data : 'invalid-project',
            key,
          );
        }
        return;
      }
      try {
        if (
          !(await authorizeProject(
            response,
            options,
            parsedProject.data,
            'project.production.write',
            key,
          ))
        )
          return;
        const result = await options.store.issueGrant(
          actor(response),
          parsedProject.data,
          parsed.data,
          {
            operation: 'production.grant.issue',
            key,
            scope: { projectId: parsedProject.data },
            payload: parsed.data,
          },
        );
        if (!result) {
          standardError(
            response,
            new ProductionDomainError(
              'package lookup failed',
              403,
              'PROJECT_SCOPE_MISMATCH',
              'scope',
            ),
            parsedProject.data,
            key,
          );
          return;
        }
        response.setHeader('cache-control', 'no-store');
        response.setHeader('idempotency-replayed', String(result.replayed));
        response.status(result.replayed ? 200 : 201).json(result.value);
      } catch (error) {
        if (error instanceof ProductionDomainError) {
          standardError(response, error, parsedProject.data, key);
          return;
        }
        next(error);
      }
    },
  );

  return router;
}
