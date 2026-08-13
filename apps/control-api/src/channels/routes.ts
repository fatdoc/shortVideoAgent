import type { RequestHandler, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { readCookie, SESSION_COOKIE_NAME } from '../auth/session.js';
import type { PublicSession } from '../auth/service.js';
import { CommercialChannelDomainError } from './errors.js';
import type { CommercialChannelService } from './service.js';
import type { CommercialChannelActor } from './types.js';

const emptyQuerySchema = z.object({}).strict();
const directoryQuerySchema = z
  .object({
    status: z.literal('active').default('active'),
    limit: z.coerce.number().int().min(1).max(100).default(100),
  })
  .strict();

type SessionResolution = { token?: string; session: PublicSession };
type CommercialChannelHttpService = Pick<
  CommercialChannelService,
  'readCurrentChannel' | 'listActiveChannels'
>;

export type CommercialChannelRouterOptions = {
  service: CommercialChannelHttpService;
  resolveSession: (token: string) => Promise<SessionResolution | null>;
  secureCookies: boolean;
  sessionTtlSeconds: number;
};

type CommercialChannelLocals = {
  requestId?: string;
  commercialChannelActor?: CommercialChannelActor;
};
type CommercialChannelResponse = Response<unknown, CommercialChannelLocals>;

const safeMessages = {
  CHANNEL_SCOPE_NOT_FOUND: '商业渠道范围不存在。',
  CHANNEL_PERMISSION_DENIED: '当前角色无权访问商业渠道信息。',
} as const;

function sendError(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({
    error: { code, message, requestId: response.locals.requestId },
  });
}

function setRotatedCookie(
  response: Response,
  token: string,
  options: CommercialChannelRouterOptions,
): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: options.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: options.sessionTtlSeconds * 1000,
  });
}

function actor(response: CommercialChannelResponse): CommercialChannelActor {
  if (!response.locals.commercialChannelActor) {
    throw new Error('authenticated Commercial Channel actor is missing');
  }
  return response.locals.commercialChannelActor;
}

function domainError(response: Response, caught: CommercialChannelDomainError): void {
  sendError(response, caught.status, caught.code, safeMessages[caught.code]);
}

export function createCommercialChannelRouter(options: CommercialChannelRouterOptions): Router {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader('cache-control', 'no-store');
    next();
  });

  const authenticated: RequestHandler = async (request, response, next) => {
    const channelResponse = response as CommercialChannelResponse;
    try {
      const token = readCookie(request.header('cookie'), SESSION_COOKIE_NAME);
      if (!token) {
        sendError(channelResponse, 401, 'AUTHENTICATION_REQUIRED', '请先登录。');
        return;
      }
      const resolved = await options.resolveSession(token);
      if (!resolved) {
        sendError(channelResponse, 401, 'SESSION_INVALID', '会话已失效，请重新登录。');
        return;
      }
      if (resolved.token) setRotatedCookie(channelResponse, resolved.token, options);
      const context = resolved.session.activeContext;
      channelResponse.locals.commercialChannelActor = {
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

  router.get('/channels/current', authenticated, async (request, response, next) => {
    const channelResponse = response as CommercialChannelResponse;
    if (!emptyQuerySchema.safeParse(request.query).success) {
      sendError(channelResponse, 422, 'CHANNEL_QUERY_INVALID', '商业渠道查询格式无效。');
      return;
    }
    try {
      channelResponse.status(200).json({
        channel: await options.service.readCurrentChannel(actor(channelResponse)),
      });
    } catch (caught) {
      if (caught instanceof CommercialChannelDomainError) domainError(channelResponse, caught);
      else next(caught);
    }
  });

  router.get('/platform/channels', authenticated, async (request, response, next) => {
    const channelResponse = response as CommercialChannelResponse;
    const parsed = directoryQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      sendError(channelResponse, 422, 'CHANNEL_QUERY_INVALID', '商业渠道查询格式无效。');
      return;
    }
    try {
      channelResponse.status(200).json({
        channels: await options.service.listActiveChannels(
          actor(channelResponse),
          parsed.data.limit,
        ),
      });
    } catch (caught) {
      if (caught instanceof CommercialChannelDomainError) domainError(channelResponse, caught);
      else next(caught);
    }
  });

  return router;
}
