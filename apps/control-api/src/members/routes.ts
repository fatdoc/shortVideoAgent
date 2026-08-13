import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { readCookie, SESSION_COOKIE_NAME } from '../auth/session.js';
import type { PublicSession } from '../auth/service.js';
import { MemberDomainError } from './errors.js';
import type { MemberDirectoryService } from './service.js';
import type { MemberDirectoryActor } from './types.js';

const listQuerySchema = z
  .object({
    status: z.enum(['all', 'active', 'suspended', 'expired']).default('all'),
    limit: z.coerce.number().int().min(1).max(100).default(100),
  })
  .strict();
const suspendParamsSchema = z.object({ membershipId: z.string().uuid() }).strict();
const suspendBodySchema = z.object({ expectedVersion: z.number().int().positive() }).strict();

type SessionResolution = { token?: string; session: PublicSession };
type MemberDirectoryHttpService = Pick<
  MemberDirectoryService,
  'listCurrentOrganizationMembers' | 'suspendCurrentOrganizationMember'
>;

export type MemberDirectoryRouterOptions = {
  service: MemberDirectoryHttpService;
  resolveSession: (token: string) => Promise<SessionResolution | null>;
  secureCookies: boolean;
  sessionTtlSeconds: number;
};

type MemberLocals = {
  requestId?: string;
  memberActor?: MemberDirectoryActor;
};
type MemberResponse = Response<unknown, MemberLocals>;

const safeMessages: Record<string, string> = {
  MEMBER_PERMISSION_DENIED: '当前角色无权管理成员。',
  MEMBER_NOT_FOUND: '成员不存在。',
  MEMBER_SELF_SUSPEND_FORBIDDEN: '不能停用当前登录成员。',
  MEMBER_LAST_ADMIN_CONFLICT: '不能停用当前组织最后一名活动管理员。',
  MEMBER_VERSION_CONFLICT: '成员版本已变化，请刷新后重试。',
  MEMBER_STATUS_CONFLICT: '成员当前状态不允许停用。',
};

function sendError(response: MemberResponse, status: number, code: string, message: string): void {
  response.status(status).json({
    error: { code, message, requestId: response.locals.requestId },
  });
}

function setRotatedCookie(
  response: MemberResponse,
  token: string,
  options: MemberDirectoryRouterOptions,
): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: options.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: options.sessionTtlSeconds * 1000,
  });
}

function actor(response: MemberResponse): MemberDirectoryActor {
  if (!response.locals.memberActor) throw new Error('authenticated Member actor is missing');
  return response.locals.memberActor;
}

function domainError(response: MemberResponse, caught: MemberDomainError): void {
  sendError(response, caught.status, caught.code, safeMessages[caught.code] ?? '成员请求失败。');
}

export function createMemberDirectoryRouter(options: MemberDirectoryRouterOptions): Router {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader('cache-control', 'no-store');
    next();
  });

  const authenticated: RequestHandler = async (request, response, next) => {
    const memberResponse = response as MemberResponse;
    try {
      const token = readCookie(request.header('cookie'), SESSION_COOKIE_NAME);
      if (!token) {
        sendError(memberResponse, 401, 'AUTHENTICATION_REQUIRED', '请先登录。');
        return;
      }
      const resolved = await options.resolveSession(token);
      if (!resolved) {
        sendError(memberResponse, 401, 'SESSION_INVALID', '会话已失效，请重新登录。');
        return;
      }
      if (resolved.token) setRotatedCookie(memberResponse, resolved.token, options);
      const context = resolved.session.activeContext;
      memberResponse.locals.memberActor = {
        userId: resolved.session.user.id,
        membershipId: context.membershipId,
        organizationId: context.organizationId,
        organizationType: context.organizationType,
        roles: [...context.roles],
      };
      next();
    } catch (caught) {
      next(caught);
    }
  };

  router.get(
    '/organizations/current/members',
    authenticated,
    async (request: Request, response: Response, next: NextFunction) => {
      const memberResponse = response as MemberResponse;
      const parsed = listQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        sendError(memberResponse, 422, 'MEMBER_QUERY_INVALID', '成员目录查询参数无效。');
        return;
      }
      try {
        const members = await options.service.listCurrentOrganizationMembers(
          actor(memberResponse),
          parsed.data,
        );
        memberResponse.status(200).json({ members });
      } catch (caught) {
        if (caught instanceof MemberDomainError) domainError(memberResponse, caught);
        else next(caught);
      }
    },
  );

  router.post(
    '/organizations/current/members/:membershipId/suspend',
    authenticated,
    async (request: Request, response: Response, next: NextFunction) => {
      const memberResponse = response as MemberResponse;
      const params = suspendParamsSchema.safeParse(request.params);
      const body = suspendBodySchema.safeParse(request.body);
      if (!params.success || !body.success) {
        sendError(memberResponse, 422, 'MEMBER_REQUEST_INVALID', '成员停用请求无效。');
        return;
      }
      try {
        const result = await options.service.suspendCurrentOrganizationMember(
          actor(memberResponse),
          params.data.membershipId,
          body.data.expectedVersion,
        );
        memberResponse.setHeader('idempotency-replayed', String(result.replayed));
        memberResponse.status(200).json({ member: result.member });
      } catch (caught) {
        if (caught instanceof MemberDomainError) domainError(memberResponse, caught);
        else next(caught);
      }
    },
  );

  return router;
}
