import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { readCookie, SESSION_COOKIE_NAME } from '../auth/session.js';
import type { PublicSession } from '../auth/service.js';
import { allowsProjectAction, type ProjectPolicy } from '../projects/policy.js';
import type { SessionActor } from '../projects/types.js';
import { CANVAS_ASSET_ERROR_STATUS, CanvasAssetDomainError } from './errors.js';
import {
  assertBrowserSafeAssetProjection,
  parseAssetRecordProjection,
  parseCreateAssetInput,
  parseCreateHighCostApprovalInput,
  parseHighCostApprovalProjection,
  parseTransitionAssetApprovalInput,
  parseTransitionAssetRightsInput,
  parseUuid,
} from './parser.js';
import type { CanvasAssetAuthorityService } from './service.js';

export type CanvasAssetRouteService = Pick<
  CanvasAssetAuthorityService,
  | 'createAsset'
  | 'listAssets'
  | 'getAsset'
  | 'transitionRights'
  | 'transitionApproval'
  | 'createHighCostApproval'
  | 'readHighCostApproval'
>;

type SessionResolution = { token?: string; session: PublicSession };

export type CanvasAssetRouterOptions = {
  service: CanvasAssetRouteService;
  policy: ProjectPolicy;
  resolveSession: (token: string) => Promise<SessionResolution | null>;
  secureCookies: boolean;
  sessionTtlSeconds: number;
  allowedOrigins: readonly string[];
  csrfSecret: string;
};

type AssetLocals = {
  requestId: string;
  actor?: SessionActor;
  sessionToken?: string;
};
type AssetResponse = Response<unknown, AssetLocals>;

function publicError(response: AssetResponse, status: number, code: string, message: string): void {
  response.status(status).json({
    error: { code, message, requestId: response.locals.requestId },
  });
}

function domainError(response: AssetResponse, caught: CanvasAssetDomainError): void {
  publicError(response, CANVAS_ASSET_ERROR_STATUS[caught.code], caught.code, caught.message);
}

function internalError(response: AssetResponse): void {
  publicError(
    response,
    500,
    'INTERNAL_ERROR',
    'Canvas Asset authority is temporarily unavailable.',
  );
}

function actor(response: AssetResponse): SessionActor {
  if (!response.locals.actor) throw new Error('authenticated actor is missing');
  return response.locals.actor;
}

function setRotatedCookie(
  response: AssetResponse,
  token: string,
  options: CanvasAssetRouterOptions,
): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: options.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: options.sessionTtlSeconds * 1000,
  });
}

function csrfToken(sessionToken: string, secret: string): string {
  return createHmac('sha256', secret).update(sessionToken).digest('base64url');
}

function sameToken(expected: string, supplied: string | undefined): boolean {
  if (!supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function authenticate(
  request: Request,
  response: AssetResponse,
  options: CanvasAssetRouterOptions,
): Promise<boolean> {
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
  const context = resolved.session.activeContext;
  if (
    !resolved.session.tenant ||
    context.organizationType !== 'TENANT' ||
    context.tenantId !== resolved.session.tenant.id
  ) {
    publicError(response, 401, 'SESSION_INVALID', 'The Tenant session context is invalid.');
    return false;
  }
  const activeToken = resolved.token ?? token;
  if (resolved.token) setRotatedCookie(response, resolved.token, options);
  response.locals.sessionToken = activeToken;
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
  response.setHeader('x-csrf-token', csrfToken(activeToken, options.csrfSecret));
  return true;
}

function enforceMutationGuard(
  request: Request,
  response: AssetResponse,
  options: CanvasAssetRouterOptions,
): boolean {
  const origin = request.header('origin');
  if (!origin || !options.allowedOrigins.includes(origin)) {
    publicError(
      response,
      403,
      'CSRF_ORIGIN_INVALID',
      'The request Origin is not allowed for Canvas Asset mutation.',
    );
    return false;
  }
  const sessionToken = response.locals.sessionToken;
  if (
    !sessionToken ||
    !sameToken(csrfToken(sessionToken, options.csrfSecret), request.header('x-csrf-token'))
  ) {
    publicError(response, 403, 'CSRF_TOKEN_INVALID', 'The CSRF token is invalid.');
    return false;
  }
  return true;
}

async function authorize(
  response: AssetResponse,
  options: CanvasAssetRouterOptions,
  projectId: string,
  write: boolean,
): Promise<boolean> {
  const access = await options.policy.resolveProjectAccess(actor(response), projectId);
  if (!access) {
    publicError(
      response,
      404,
      'CANVAS_ASSET_NOT_FOUND',
      'Canvas Asset project scope was not found.',
    );
    return false;
  }
  if (
    !allowsProjectAction(access, write ? 'project.production.write' : 'project.production.read')
  ) {
    publicError(response, 403, 'PERMISSION_DENIED', 'The current project role is not allowed.');
    return false;
  }
  return true;
}

function projectId(request: Request): string {
  try {
    return parseUuid(request.params.projectId);
  } catch {
    throw new CanvasAssetDomainError(
      'CANVAS_ASSET_NOT_FOUND',
      'Canvas Asset project scope was not found.',
    );
  }
}

function endpoint(
  options: CanvasAssetRouterOptions,
  mutation: boolean,
  handler: (request: Request, response: AssetResponse) => Promise<void>,
) {
  return async (request: Request, response: AssetResponse, _next: NextFunction) => {
    try {
      if (mutation && !enforceMutationGuard(request, response, options)) return;
      await handler(request, response);
    } catch (caught) {
      if (caught instanceof CanvasAssetDomainError) domainError(response, caught);
      else internalError(response);
    }
  };
}

export function createCanvasAssetRouter(options: CanvasAssetRouterOptions): Router {
  if (options.allowedOrigins.length === 0) {
    throw new Error('Canvas Asset allowed Origins must not be empty.');
  }
  if (Buffer.byteLength(options.csrfSecret, 'utf8') < 32) {
    throw new Error('Canvas Asset CSRF secret must contain at least 32 bytes.');
  }
  const router = Router();
  const roots = [
    '/projects/:projectId/canvas-assets',
    '/projects/:projectId/canvas-command-approvals',
  ];
  for (const root of roots) {
    router.use(root, async (request, response: AssetResponse, next) => {
      response.setHeader('cache-control', 'no-store');
      try {
        if (await authenticate(request, response, options)) next();
      } catch {
        internalError(response);
      }
    });
  }

  router.post(
    '/projects/:projectId/canvas-assets',
    endpoint(options, true, async (request, response) => {
      const id = projectId(request);
      if (!(await authorize(response, options, id, true))) return;
      const input = parseCreateAssetInput(request.body);
      const value = parseAssetRecordProjection(
        await options.service.createAsset(actor(response), id, input),
      );
      response.status(201).json(value);
    }),
  );

  router.get(
    '/projects/:projectId/canvas-assets',
    endpoint(options, false, async (request, response) => {
      const id = projectId(request);
      if (!(await authorize(response, options, id, false))) return;
      const assets = (await options.service.listAssets(actor(response), id)).map((value) =>
        parseAssetRecordProjection(value),
      );
      const body = { assets };
      assertBrowserSafeAssetProjection(body);
      response.status(200).json(body);
    }),
  );

  router.get(
    '/projects/:projectId/canvas-assets/:assetId',
    endpoint(options, false, async (request, response) => {
      const id = projectId(request);
      if (!(await authorize(response, options, id, false))) return;
      const value = parseAssetRecordProjection(
        await options.service.getAsset(actor(response), id, parseUuid(request.params.assetId)),
      );
      response.status(200).json(value);
    }),
  );

  router.post(
    '/projects/:projectId/canvas-assets/:assetId/rights-transitions',
    endpoint(options, true, async (request, response) => {
      const id = projectId(request);
      if (!(await authorize(response, options, id, true))) return;
      const value = parseAssetRecordProjection(
        await options.service.transitionRights(
          actor(response),
          id,
          parseUuid(request.params.assetId),
          parseTransitionAssetRightsInput(request.body),
        ),
      );
      response.status(200).json(value);
    }),
  );

  router.post(
    '/projects/:projectId/canvas-assets/:assetId/approval-transitions',
    endpoint(options, true, async (request, response) => {
      const id = projectId(request);
      if (!(await authorize(response, options, id, true))) return;
      const value = parseAssetRecordProjection(
        await options.service.transitionApproval(
          actor(response),
          id,
          parseUuid(request.params.assetId),
          parseTransitionAssetApprovalInput(request.body),
        ),
      );
      response.status(200).json(value);
    }),
  );

  router.post(
    '/projects/:projectId/canvas-command-approvals',
    endpoint(options, true, async (request, response) => {
      const id = projectId(request);
      if (!(await authorize(response, options, id, true))) return;
      const value = parseHighCostApprovalProjection(
        await options.service.createHighCostApproval(
          actor(response),
          id,
          parseCreateHighCostApprovalInput(request.body),
        ),
      );
      response.status(201).json(value);
    }),
  );

  router.get(
    '/projects/:projectId/canvas-command-approvals/:approvalId',
    endpoint(options, false, async (request, response) => {
      const id = projectId(request);
      if (!(await authorize(response, options, id, false))) return;
      const value = parseHighCostApprovalProjection(
        await options.service.readHighCostApproval(
          actor(response),
          id,
          parseUuid(request.params.approvalId),
        ),
      );
      response.status(200).json(value);
    }),
  );

  return router;
}
