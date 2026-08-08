import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { readCookie, SESSION_COOKIE_NAME } from '../auth/session.js';
import type { PublicSession } from '../auth/service.js';
import { PaymentFoundationDomainError } from './errors.js';
import type { PaymentFoundationService } from './service.js';
import type { RechargeActor, ReplayableResult } from './types.js';

const INTERNAL_TOKEN_HEADER = 'x-test-payment-internal-token';
const uuidSchema = z.string().uuid();
const listQuerySchema = z
  .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
  .strict();
const createRechargeOrderSchema = z
  .object({
    paymentMode: z.literal('TEST'),
    conversionRuleVersionId: uuidSchema,
    idempotencyKey: z.string().trim().min(1).max(200),
  })
  .strict();
const testPaymentEventSchema = z
  .object({
    paymentMode: z.literal('TEST'),
    providerEventId: z.string().trim().min(1).max(200),
    eventType: z.enum([
      'payment_succeeded',
      'payment_failed',
      'refund_succeeded',
      'chargeback_succeeded',
    ]),
    rechargeOrderId: uuidSchema,
    amountMinor: z.number().int().positive().safe(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/),
    occurredAt: z.iso.datetime({ offset: true }),
  })
  .strict();

type SessionResolution = { token?: string; session: PublicSession };
type PaymentHttpService = Pick<
  PaymentFoundationService,
  'createRechargeOrder' | 'listRechargeOrders' | 'receivePaymentEvent' | 'listPaymentEvents'
>;

export type PaymentRouterOptions = {
  service: PaymentHttpService;
  resolveSession: (token: string) => Promise<SessionResolution | null>;
  internalToken: string;
  secureCookies: boolean;
  sessionTtlSeconds: number;
};

type PaymentLocals = {
  requestId?: string;
  paymentActor?: RechargeActor;
  paymentSession?: PublicSession;
};
type PaymentResponse = Response<unknown, PaymentLocals>;

const RECHARGE_PERMISSION_DENIED_MESSAGE = '当前角色无权管理充值订单。';
const PAYMENT_PERMISSION_DENIED_MESSAGE = '当前角色无权查看 Payment Event。';

const safeMessages: Record<string, string> = {
  RECHARGE_PERMISSION_DENIED: RECHARGE_PERMISSION_DENIED_MESSAGE,
  RECHARGE_VALIDATION_FAILED: '充值订单请求格式无效。',
  RECHARGE_RULE_UNAVAILABLE: '当前 TEST 额度转换规则不可用。',
  RECHARGE_SCOPE_CONFLICT: '充值订单范围与当前企业不一致。',
  RECHARGE_IDEMPOTENCY_CONFLICT: '幂等键已用于不同的充值订单请求。',
  PAYMENT_PROVIDER_UNAVAILABLE: '支付 Provider 当前不可用。',
  PAYMENT_VERIFICATION_FAILED: 'TEST Payment Event 验证失败。',
  PAYMENT_MODE_MISMATCH: 'Payment Event 模式不匹配。',
  PAYMENT_ORDER_CONFLICT: 'Payment Event 与 RechargeOrder 事实不一致。',
  PAYMENT_IDEMPOTENCY_CONFLICT: 'Provider Event identity 已用于不同事件。',
  PAYMENT_PERMISSION_DENIED: PAYMENT_PERMISSION_DENIED_MESSAGE,
};

function sendError(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({
    error: { code, message, requestId: response.locals.requestId },
  });
}

function domainError(response: Response, caught: PaymentFoundationDomainError): void {
  const status = caught.code === 'RECHARGE_VALIDATION_FAILED' ? 400 : caught.status;
  sendError(response, status, caught.code, safeMessages[caught.code] ?? '支付请求失败。');
}

function setRotatedCookie(response: Response, token: string, options: PaymentRouterOptions): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: options.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: options.sessionTtlSeconds * 1000,
  });
}

function actor(response: PaymentResponse): RechargeActor {
  if (!response.locals.paymentActor) throw new Error('authenticated Payment actor is missing');
  return response.locals.paymentActor;
}

function activeSession(response: PaymentResponse): PublicSession {
  if (!response.locals.paymentSession) throw new Error('authenticated Payment session is missing');
  return response.locals.paymentSession;
}

function constantTimeTokenEqual(supplied: string | undefined, expected: string): boolean {
  if (!supplied) return false;
  const suppliedDigest = createHash('sha256').update(supplied).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(suppliedDigest, expectedDigest);
}

function sendReplayable<T>(
  response: Response,
  result: ReplayableResult<T>,
  createdStatus: number,
  key: string,
): void {
  response.setHeader('idempotency-replayed', String(result.replayed));
  response.status(result.replayed ? 200 : createdStatus).json({ [key]: result.value });
}

export function createPaymentRouter(options: PaymentRouterOptions): Router {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader('cache-control', 'no-store');
    next();
  });

  const authenticated: RequestHandler = async (request, response, next) => {
    const paymentResponse = response as PaymentResponse;
    try {
      const token = readCookie(request.header('cookie'), SESSION_COOKIE_NAME);
      if (!token) {
        sendError(paymentResponse, 401, 'AUTHENTICATION_REQUIRED', '请先登录。');
        return;
      }
      const resolved = await options.resolveSession(token);
      if (!resolved) {
        sendError(paymentResponse, 401, 'SESSION_INVALID', '会话已失效，请重新登录。');
        return;
      }
      if (resolved.token) setRotatedCookie(paymentResponse, resolved.token, options);
      const context = resolved.session.activeContext;
      paymentResponse.locals.paymentSession = resolved.session;
      paymentResponse.locals.paymentActor = {
        userId: resolved.session.user.id,
        membershipId: context.membershipId,
        organizationId: context.organizationId,
        organizationType: context.organizationType,
        roles: [...context.roles],
        tenantId: context.tenantId,
      };
      next();
    } catch (caught) {
      next(caught);
    }
  };

  router.use('/tenants/:tenantId/recharge-orders', authenticated);
  router.use('/platform/payment-events', authenticated);

  router.post(
    '/tenants/:tenantId/recharge-orders',
    async (request, response: PaymentResponse, next) => {
      const parsedTenantId = uuidSchema.safeParse(request.params.tenantId);
      const parsed = createRechargeOrderSchema.safeParse(request.body);
      if (!parsedTenantId.success || !parsed.success) {
        sendError(response, 400, 'RECHARGE_VALIDATION_FAILED', '充值订单请求格式无效。');
        return;
      }
      const context = activeSession(response).activeContext;
      if (
        context.organizationType !== 'TENANT' ||
        context.tenantId !== parsedTenantId.data ||
        context.organizationId !== parsedTenantId.data
      ) {
        sendError(response, 404, 'RECHARGE_SCOPE_NOT_FOUND', '充值订单范围不存在。');
        return;
      }
      if (!context.roles.includes('tenant_admin')) {
        sendError(response, 403, 'RECHARGE_PERMISSION_DENIED', RECHARGE_PERMISSION_DENIED_MESSAGE);
        return;
      }
      try {
        sendReplayable(
          response,
          await options.service.createRechargeOrder(actor(response), parsed.data),
          201,
          'rechargeOrder',
        );
      } catch (caught) {
        if (caught instanceof PaymentFoundationDomainError) domainError(response, caught);
        else next(caught);
      }
    },
  );

  router.get(
    '/tenants/:tenantId/recharge-orders',
    async (request, response: PaymentResponse, next) => {
      const parsedTenantId = uuidSchema.safeParse(request.params.tenantId);
      const parsed = listQuerySchema.safeParse(request.query);
      if (!parsedTenantId.success || !parsed.success) {
        sendError(response, 400, 'RECHARGE_VALIDATION_FAILED', '充值订单查询格式无效。');
        return;
      }
      const context = activeSession(response).activeContext;
      if (
        context.organizationType !== 'TENANT' ||
        context.tenantId !== parsedTenantId.data ||
        context.organizationId !== parsedTenantId.data
      ) {
        sendError(response, 404, 'RECHARGE_SCOPE_NOT_FOUND', '充值订单范围不存在。');
        return;
      }
      if (!context.roles.includes('tenant_admin')) {
        sendError(response, 403, 'RECHARGE_PERMISSION_DENIED', RECHARGE_PERMISSION_DENIED_MESSAGE);
        return;
      }
      try {
        const rechargeOrders = await options.service.listRechargeOrders(
          actor(response),
          parsed.data.limit,
        );
        response.status(200).json({ rechargeOrders });
      } catch (caught) {
        if (caught instanceof PaymentFoundationDomainError) domainError(response, caught);
        else next(caught);
      }
    },
  );

  router.post('/internal/payments/test/events', async (request, response, next) => {
    if (!constantTimeTokenEqual(request.header(INTERNAL_TOKEN_HEADER), options.internalToken)) {
      sendError(
        response,
        401,
        'PAYMENT_INTERNAL_AUTHORIZATION_FAILED',
        'TEST Payment 内部鉴权失败。',
      );
      return;
    }
    const parsed = testPaymentEventSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(response, 400, 'PAYMENT_VERIFICATION_FAILED', 'TEST Payment Event 格式无效。');
      return;
    }
    try {
      sendReplayable(
        response,
        await options.service.receivePaymentEvent({
          paymentMode: 'TEST',
          payload: parsed.data,
        }),
        202,
        'paymentEvent',
      );
    } catch (caught) {
      if (caught instanceof PaymentFoundationDomainError) domainError(response, caught);
      else next(caught);
    }
  });

  router.get('/platform/payment-events', async (request, response: PaymentResponse, next) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      sendError(response, 400, 'PAYMENT_VERIFICATION_FAILED', 'Payment Event 查询格式无效。');
      return;
    }
    const context = activeSession(response).activeContext;
    if (context.organizationType !== 'PLATFORM') {
      sendError(response, 404, 'PAYMENT_EVENTS_NOT_FOUND', 'Payment Event 范围不存在。');
      return;
    }
    if (!context.roles.includes('platform_admin')) {
      sendError(response, 403, 'PAYMENT_PERMISSION_DENIED', PAYMENT_PERMISSION_DENIED_MESSAGE);
      return;
    }
    try {
      const paymentEvents = await options.service.listPaymentEvents(
        actor(response),
        parsed.data.limit,
      );
      response.status(200).json({ paymentEvents });
    } catch (caught) {
      if (caught instanceof PaymentFoundationDomainError) domainError(response, caught);
      else next(caught);
    }
  });

  return router;
}
