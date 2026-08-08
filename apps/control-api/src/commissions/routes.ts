import type { RequestHandler, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { readCookie, SESSION_COOKIE_NAME } from '../auth/session.js';
import type { PublicSession } from '../auth/service.js';
import { CommissionAuditDomainError } from './errors.js';
import type { CommissionAuditService } from './service.js';
import type { CommissionActor } from './types.js';

const uuidSchema = z.string().uuid();
const listQuerySchema = z
  .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
  .strict();

type SessionResolution = { token?: string; session: PublicSession };
type CommissionAuditHttpService = Pick<
  CommissionAuditService,
  | 'listPlatformCalculations'
  | 'listPlatformAccruals'
  | 'listPlatformReversals'
  | 'listPlatformManualReviews'
  | 'listChannelCalculations'
  | 'listChannelAccruals'
  | 'listChannelReversals'
>;

export type CommissionAuditRouterOptions = {
  service: CommissionAuditHttpService;
  resolveSession: (token: string) => Promise<SessionResolution | null>;
  secureCookies: boolean;
  sessionTtlSeconds: number;
};

type CommissionLocals = { requestId?: string; commissionActor?: CommissionActor };
type CommissionResponse = Response<unknown, CommissionLocals>;

const safeMessages = {
  COMMISSION_SCOPE_NOT_FOUND: '佣金审计范围不存在。',
  COMMISSION_PERMISSION_DENIED: '当前角色无权查看佣金审计结果。',
} as const;

function sendError(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({
    error: { code, message, requestId: response.locals.requestId },
  });
}

function setRotatedCookie(
  response: Response,
  token: string,
  options: CommissionAuditRouterOptions,
): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: options.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: options.sessionTtlSeconds * 1000,
  });
}

function actor(response: CommissionResponse): CommissionActor {
  if (!response.locals.commissionActor) {
    throw new Error('authenticated Commission audit actor is missing');
  }
  return response.locals.commissionActor;
}

function domainError(response: Response, caught: CommissionAuditDomainError): void {
  sendError(response, caught.status, caught.code, safeMessages[caught.code]);
}

export function createCommissionAuditRouter(options: CommissionAuditRouterOptions): Router {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader('cache-control', 'no-store');
    next();
  });

  const authenticated: RequestHandler = async (request, response, next) => {
    const commissionResponse = response as CommissionResponse;
    try {
      const token = readCookie(request.header('cookie'), SESSION_COOKIE_NAME);
      if (!token) {
        sendError(commissionResponse, 401, 'AUTHENTICATION_REQUIRED', '请先登录。');
        return;
      }
      const resolved = await options.resolveSession(token);
      if (!resolved) {
        sendError(commissionResponse, 401, 'SESSION_INVALID', '会话已失效，请重新登录。');
        return;
      }
      if (resolved.token) setRotatedCookie(commissionResponse, resolved.token, options);
      const context = resolved.session.activeContext;
      commissionResponse.locals.commissionActor = {
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

  router.use('/platform/commission-audit', authenticated);
  router.use('/channels/:channelId/commission-audit', authenticated);

  const platformLists = [
    ['calculations', 'listPlatformCalculations', 'calculations'],
    ['accruals', 'listPlatformAccruals', 'accruals'],
    ['reversals', 'listPlatformReversals', 'reversals'],
    ['manual-reviews', 'listPlatformManualReviews', 'manualReviews'],
  ] as const;
  for (const [path, method, key] of platformLists) {
    router.get(
      `/platform/commission-audit/${path}`,
      async (request, response: CommissionResponse, next) => {
        const parsed = listQuerySchema.safeParse(request.query);
        if (!parsed.success) {
          sendError(response, 400, 'COMMISSION_QUERY_INVALID', '佣金审计查询格式无效。');
          return;
        }
        try {
          response
            .status(200)
            .json({ [key]: await options.service[method](actor(response), parsed.data.limit) });
        } catch (caught) {
          if (caught instanceof CommissionAuditDomainError) domainError(response, caught);
          else next(caught);
        }
      },
    );
  }

  const channelLists = [
    ['calculations', 'listChannelCalculations', 'calculations'],
    ['accruals', 'listChannelAccruals', 'accruals'],
    ['reversals', 'listChannelReversals', 'reversals'],
  ] as const;
  for (const [path, method, key] of channelLists) {
    router.get(
      `/channels/:channelId/commission-audit/${path}`,
      async (request, response: CommissionResponse, next) => {
        const parsedChannelId = uuidSchema.safeParse(request.params.channelId);
        const parsed = listQuerySchema.safeParse(request.query);
        if (!parsedChannelId.success || !parsed.success) {
          sendError(response, 400, 'COMMISSION_QUERY_INVALID', '佣金审计查询格式无效。');
          return;
        }
        try {
          response.status(200).json({
            [key]: await options.service[method](
              actor(response),
              parsedChannelId.data,
              parsed.data.limit,
            ),
          });
        } catch (caught) {
          if (caught instanceof CommissionAuditDomainError) domainError(response, caught);
          else next(caught);
        }
      },
    );
  }

  return router;
}
