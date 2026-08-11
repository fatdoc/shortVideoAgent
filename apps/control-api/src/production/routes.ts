import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { readCookie, SESSION_COOKIE_NAME } from '../auth/session.js';
import type { PublicSession } from '../auth/service.js';
import { allowsProjectAction, type ProjectAction, type ProjectPolicy } from '../projects/policy.js';
import type { SessionActor } from '../projects/types.js';
import { ProductionDomainError, safeProductionError } from './errors.js';
import {
  productionCapabilities,
  productionScopes,
  type ProductionStore,
  type ProjectProductionPackage,
} from './types.js';

const uuidSchema = z.string().uuid();
const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/);
const capabilitySchema = z.enum(productionCapabilities);
const scopeSchema = z.enum(productionScopes);
const capabilityRequirementsSchema = z
  .array(capabilitySchema)
  .min(1)
  .max(4)
  .refine((value) => new Set(value).size === value.length, {
    message: 'capabilityRequirements must be unique',
  });
const createPackageSchema = z
  .object({
    scriptVersionId: uuidSchema,
    storyboardVersionId: uuidSchema,
    capabilityRequirements: capabilityRequirementsSchema,
    expiresInSeconds: z.number().int().min(300).max(86_400),
  })
  .strict();
const packagePublicSourceSchema = z
  .object({
    objectType: z.literal('ProjectProductionPackage'),
    contractVersion: z.literal('0.3'),
    tenantId: uuidSchema,
    projectId: uuidSchema,
    packageId: uuidSchema,
    packageVersion: z.number().int().positive(),
    scriptVersionId: uuidSchema,
    storyboardVersionId: uuidSchema,
    capabilityRequirements: capabilityRequirementsSchema,
    status: z.literal('ready'),
    payloadDigest: digestSchema,
    approvedScriptDigest: digestSchema,
    approvedStoryboardDigest: digestSchema,
    createdAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
  })
  .passthrough();
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

const productionAuthorityReasonCodes = new Set([
  'NO_SCRIPT_VERSION',
  'SCRIPT_NOT_APPROVED',
  'SCRIPT_APPROVAL_REVOKED',
  'SCRIPT_BLOCKED',
  'SCRIPT_FACT_RISK_UNRESOLVED',
  'NO_STORYBOARD_VERSION',
  'STORYBOARD_NOT_APPROVED',
  'STORYBOARD_APPROVAL_REVOKED',
  'STORYBOARD_BLOCKED',
  'STORYBOARD_FACT_RISK_UNRESOLVED',
  'SCRIPT_STORYBOARD_BINDING_MISMATCH',
  'PRODUCTION_AUTHORITY_STALE',
]);

type SessionResolution = { token?: string; session: PublicSession };

export type ProductionRouterOptions = {
  store: ProductionStore;
  policy: ProjectPolicy;
  resolveSession: (token: string) => Promise<SessionResolution | null>;
  secureCookies: boolean;
  sessionTtlSeconds: number;
};

type ActorResponse = Response & { locals: { requestId: string; actor?: SessionActor } };

function publicError(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({
    error: {
      code,
      message,
      requestId: response.locals.requestId as string,
    },
  });
}

function domainError(response: ActorResponse, caught: ProductionDomainError): void {
  const safe = safeProductionError(caught);
  publicError(response, safe.status, safe.code, safe.message);
}

function resourceNotFound(response: ActorResponse): void {
  domainError(
    response,
    new ProductionDomainError('resource lookup failed', 404, 'RESOURCE_NOT_FOUND', 'resource'),
  );
}

function internalError(response: ActorResponse): void {
  domainError(
    response,
    new ProductionDomainError('unexpected production failure', 500, 'INTERNAL_ERROR', 'internal'),
  );
}

function packageDomainError(response: ActorResponse, caught: ProductionDomainError): void {
  const reasonCode = caught.details.reasonCode;
  const authorityReasonCode = caught.details.authorityReasonCode;
  if (
    (typeof reasonCode === 'string' && productionAuthorityReasonCodes.has(reasonCode)) ||
    (typeof authorityReasonCode === 'string' &&
      productionAuthorityReasonCodes.has(authorityReasonCode))
  ) {
    domainError(
      response,
      new ProductionDomainError(
        'production authority is stale',
        409,
        'PRODUCTION_AUTHORITY_STALE',
        'authority',
      ),
    );
    return;
  }
  domainError(response, caught);
}

function projectPackagePublicDto(value: ProjectProductionPackage) {
  const parsed = packagePublicSourceSchema.parse(value);
  return {
    objectType: parsed.objectType,
    contractVersion: parsed.contractVersion,
    tenantId: parsed.tenantId,
    projectId: parsed.projectId,
    packageId: parsed.packageId,
    packageVersion: parsed.packageVersion,
    scriptVersionId: parsed.scriptVersionId,
    storyboardVersionId: parsed.storyboardVersionId,
    capabilityRequirements: parsed.capabilityRequirements,
    status: parsed.status,
    payloadDigest: parsed.payloadDigest,
    approvedScriptDigest: parsed.approvedScriptDigest,
    approvedStoryboardDigest: parsed.approvedStoryboardDigest,
    createdAt: parsed.createdAt,
    expiresAt: parsed.expiresAt,
  };
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
): Promise<boolean> {
  const access = await options.policy.resolveProjectAccess(actor(response), projectId);
  if (!access) {
    resourceNotFound(response);
    return false;
  }
  if (!allowsProjectAction(access, action)) {
    domainError(
      response,
      new ProductionDomainError('project action denied', 403, 'CAPABILITY_SCOPE_DENIED', 'scope'),
    );
    return false;
  }
  return true;
}

function idempotency(response: Response, value: string | undefined): string | null {
  const parsed = idempotencyKeySchema.safeParse(value);
  if (!parsed.success) {
    publicError(
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

  const productionPaths = [
    '/projects/:projectId/production-packages',
    '/projects/:projectId/production-grants',
  ];

  router.use(productionPaths, async (request, response: ActorResponse, next) => {
    response.setHeader('cache-control', 'no-store');
    try {
      if (response.locals.actor) {
        next();
        return;
      }
      const token = readCookie(request.header('cookie'), SESSION_COOKIE_NAME);
      if (!token) {
        publicError(response, 401, 'AUTHENTICATION_REQUIRED', '请先登录。');
        return;
      }
      const resolved = await options.resolveSession(token);
      if (!resolved) {
        publicError(response, 401, 'SESSION_INVALID', '会话已失效，请重新登录。');
        return;
      }
      if (resolved.token) setRotatedCookie(response, resolved.token, options);
      if (!resolved.session.tenant) {
        publicError(response, 403, 'TENANT_CONTEXT_REQUIRED', '当前组织不能访问生产内容。');
        return;
      }
      const context = resolved.session.activeContext;
      if (
        context.organizationType !== 'TENANT' ||
        context.tenantId !== resolved.session.tenant.id
      ) {
        publicError(response, 401, 'SESSION_INVALID', '会话上下文无效，请重新登录。');
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
    } catch {
      internalError(response);
    }
  });

  router.use(productionPaths, (request, response: ActorResponse, next) => {
    if (request.method !== 'POST') {
      next();
      return;
    }
    const roles = actor(response).roles;
    if (!roles.includes('tenant_admin') && !roles.includes('content_operator')) {
      publicError(response, 403, 'PRODUCTION_WRITE_FORBIDDEN', '当前角色不能签发生产包或授权。');
      return;
    }
    next();
  });

  router.post(
    '/projects/:projectId/production-packages',
    async (request, response: ActorResponse) => {
      const parsedProject = uuidSchema.safeParse(request.params.projectId);
      const parsed = createPackageSchema.safeParse(request.body);
      const key = idempotency(response, request.header('idempotency-key'));
      if (!parsedProject.success || !parsed.success || !key) {
        if ((!parsedProject.success || !parsed.success) && key) {
          domainError(
            response,
            new ProductionDomainError(
              '生产包请求不符合 Pilot Contract v0.3。',
              422,
              'SCHEMA_INVALID',
              'schema',
            ),
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
          resourceNotFound(response);
          return;
        }
        const value = projectPackagePublicDto(result.value);
        response.setHeader('idempotency-replayed', String(result.replayed));
        response.status(result.replayed ? 200 : 201).json(value);
      } catch (error) {
        if (error instanceof ProductionDomainError) {
          packageDomainError(response, error);
          return;
        }
        internalError(response);
      }
    },
  );

  router.get(
    '/projects/:projectId/production-packages/:packageId',
    async (request, response: ActorResponse) => {
      const parsedProject = uuidSchema.safeParse(request.params.projectId);
      const parsedPackage = uuidSchema.safeParse(request.params.packageId);
      if (!parsedProject.success || !parsedPackage.success) {
        domainError(
          response,
          new ProductionDomainError('invalid path', 422, 'SCHEMA_INVALID', 'schema'),
        );
        return;
      }
      try {
        if (
          !(await authorizeProject(
            response,
            options,
            parsedProject.data,
            'project.production.read',
          ))
        )
          return;
        const value = await options.store.getPackage(
          actor(response),
          parsedProject.data,
          parsedPackage.data,
        );
        if (!value) {
          resourceNotFound(response);
          return;
        }
        response.status(200).json(projectPackagePublicDto(value));
      } catch (error) {
        if (error instanceof ProductionDomainError) {
          packageDomainError(response, error);
          return;
        }
        internalError(response);
      }
    },
  );

  router.post(
    '/projects/:projectId/production-grants',
    async (request, response: ActorResponse) => {
      const parsedProject = uuidSchema.safeParse(request.params.projectId);
      const parsed = issueGrantSchema.safeParse(request.body);
      const key = idempotency(response, request.header('idempotency-key'));
      if (!parsedProject.success || !parsed.success || !key) {
        if ((!parsedProject.success || !parsed.success) && key) {
          domainError(
            response,
            new ProductionDomainError(
              '项目授权请求不符合 Pilot Contract v0.2。',
              422,
              'SCHEMA_INVALID',
              'schema',
            ),
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
          resourceNotFound(response);
          return;
        }
        response.setHeader('idempotency-replayed', String(result.replayed));
        response.status(result.replayed ? 200 : 201).json(result.value);
      } catch (error) {
        if (error instanceof ProductionDomainError) {
          domainError(response, error);
          return;
        }
        internalError(response);
      }
    },
  );

  return router;
}
