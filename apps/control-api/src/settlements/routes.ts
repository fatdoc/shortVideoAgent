import type { RequestHandler, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { readCookie, SESSION_COOKIE_NAME } from '../auth/session.js';
import type { PublicSession } from '../auth/service.js';
import { CommissionSettlementDomainError } from './errors.js';
import type { CommissionSettlementService } from './service.js';
import type { CommissionSettlementActor } from './types.js';

const createSchema = z
  .object({
    paymentMode: z.literal('TEST'),
    beneficiaryChannelId: z.string().uuid(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    periodStart: z.string().regex(/^\d{4}-\d{2}-01$/),
    cutoffAt: z.string().datetime({ offset: true }),
    idempotencyKey: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9._:-]{1,200}$/),
  })
  .strict();

type SessionResolution = { token?: string; session: PublicSession };
type CommissionSettlementHttpService = Pick<CommissionSettlementService, 'createDraft'>;

export type CommissionSettlementRouterOptions = {
  service: CommissionSettlementHttpService;
  resolveSession: (token: string) => Promise<SessionResolution | null>;
  secureCookies: boolean;
  sessionTtlSeconds: number;
};

type SettlementLocals = {
  requestId?: string;
  commissionSettlementActor?: CommissionSettlementActor;
};
type SettlementResponse = Response<unknown, SettlementLocals>;

const safeMessages = {
  COMMISSION_SETTLEMENT_SCOPE_NOT_FOUND: '佣金结算草稿范围不存在。',
  COMMISSION_SETTLEMENT_PERMISSION_DENIED: '当前角色无权创建佣金结算草稿。',
  COMMISSION_SETTLEMENT_VALIDATION_FAILED: '佣金结算草稿请求无效。',
  COMMISSION_SETTLEMENT_IDEMPOTENCY_CONFLICT: '幂等键已被不同的佣金结算请求使用。',
  COMMISSION_SETTLEMENT_PERIOD_CONFLICT: '该渠道、币种和月份已存在佣金结算草稿。',
  COMMISSION_SETTLEMENT_EVIDENCE_INVALID: '佣金结算所需的 TEST 审计证据不完整。',
} as const;

function sendError(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({
    error: { code, message, requestId: response.locals.requestId },
  });
}

function setRotatedCookie(
  response: Response,
  token: string,
  options: CommissionSettlementRouterOptions,
): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: options.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: options.sessionTtlSeconds * 1000,
  });
}

function actor(response: SettlementResponse): CommissionSettlementActor {
  if (!response.locals.commissionSettlementActor) {
    throw new Error('authenticated Commission Settlement actor is missing');
  }
  return response.locals.commissionSettlementActor;
}

function domainError(response: Response, caught: CommissionSettlementDomainError): void {
  sendError(response, caught.status, caught.code, safeMessages[caught.code]);
}

export function createCommissionSettlementRouter(
  options: CommissionSettlementRouterOptions,
): Router {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader('cache-control', 'no-store');
    next();
  });

  const authenticated: RequestHandler = async (request, response, next) => {
    const settlementResponse = response as SettlementResponse;
    try {
      const token = readCookie(request.header('cookie'), SESSION_COOKIE_NAME);
      if (!token) {
        sendError(settlementResponse, 401, 'AUTHENTICATION_REQUIRED', '请先登录。');
        return;
      }
      const resolved = await options.resolveSession(token);
      if (!resolved) {
        sendError(settlementResponse, 401, 'SESSION_INVALID', '会话已失效，请重新登录。');
        return;
      }
      if (resolved.token) setRotatedCookie(settlementResponse, resolved.token, options);
      const context = resolved.session.activeContext;
      settlementResponse.locals.commissionSettlementActor = {
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

  router.post(
    '/platform/commission-settlements',
    authenticated,
    async (request, response, next) => {
      const settlementResponse = response as SettlementResponse;
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) {
        sendError(
          settlementResponse,
          422,
          'COMMISSION_SETTLEMENT_VALIDATION_FAILED',
          '佣金结算草稿请求无效。',
        );
        return;
      }
      try {
        const result = await options.service.createDraft(actor(settlementResponse), parsed.data);
        settlementResponse.setHeader('idempotency-replayed', String(result.replayed));
        settlementResponse.status(result.replayed ? 200 : 201).json({ settlement: result.value });
      } catch (caught) {
        if (caught instanceof CommissionSettlementDomainError) {
          domainError(settlementResponse, caught);
        } else {
          next(caught);
        }
      }
    },
  );

  return router;
}
