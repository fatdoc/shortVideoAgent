import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { RegistrationDomainError } from './errors.js';
import type { RegistrationService } from './service.js';
import type { PublicRegistrationInput } from './types.js';

const registrationSchema = z
  .object({
    email: z.string().trim().email().max(320),
    password: z.string().min(12).max(1_024),
    displayName: z.string().trim().min(1).max(200),
    tenantDisplayName: z.string().trim().min(1).max(300).optional(),
    invitationToken: z.string().trim().min(1).max(500).optional(),
    termsVersionId: z.string().uuid(),
    locale: z.string().trim().min(1).max(35),
    accepted: z.boolean(),
    emailVerificationToken: z.string().trim().min(1).max(2_000),
    idempotencyKey: z.string().trim().min(1).max(200),
  })
  .strict();

type RegistrationHttpService = Pick<RegistrationService, 'register'>;
type RegistrationLimiter = {
  retryAfterSeconds(key: string): number | null;
  record(key: string): void;
};

export type RegistrationRouterOptions = {
  service: RegistrationHttpService;
  limiter: RegistrationLimiter;
};

const safeMessages: Record<string, string> = {
  INVALID_REGISTRATION_REQUEST: '注册请求格式无效。',
  REGISTRATION_TERMS_NOT_ACCEPTED: '请明确接受当前用户须知。',
  INVITATION_UNAVAILABLE: '邀请不可用。',
  REGISTRATION_CONFLICT: '无法使用当前身份完成注册。',
  REGISTRATION_IDEMPOTENCY_CONFLICT: '幂等键已用于不同的注册请求。',
  TERMS_NOT_AVAILABLE: '当前注册须知暂不可用。',
  EMAIL_VERIFICATION_UNAVAILABLE: '邮箱验证服务暂不可用。',
  EMAIL_VERIFICATION_FAILED: '邮箱验证失败。',
};

function sendError(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({
    error: { code, message, requestId: response.locals.requestId },
  });
}

function limiterKey(request: Request, normalizedEmail: string): string {
  const address = request.ip ?? request.socket.remoteAddress ?? 'unknown';
  return createHash('sha256').update(`${address}\u0000${normalizedEmail}`, 'utf8').digest('hex');
}

export function createRegistrationRouter(options: RegistrationRouterOptions): Router {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader('cache-control', 'no-store');
    next();
  });

  router.post('/public/registrations', async (request, response, next) => {
    const parsed = registrationSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(response, 400, 'INVALID_REGISTRATION_REQUEST', '注册请求格式无效。');
      return;
    }

    const key = limiterKey(request, parsed.data.email.toLowerCase());
    const retryAfter = options.limiter.retryAfterSeconds(key);
    if (retryAfter) {
      response.setHeader('retry-after', retryAfter);
      sendError(response, 429, 'REGISTRATION_RATE_LIMITED', '注册请求过多，请稍后重试。');
      return;
    }
    options.limiter.record(key);

    try {
      const registrationInput: PublicRegistrationInput = {
        email: parsed.data.email,
        password: parsed.data.password,
        displayName: parsed.data.displayName,
        termsVersionId: parsed.data.termsVersionId,
        locale: parsed.data.locale,
        accepted: parsed.data.accepted,
        emailVerificationToken: parsed.data.emailVerificationToken,
        idempotencyKey: parsed.data.idempotencyKey,
        ...(parsed.data.tenantDisplayName === undefined
          ? {}
          : { tenantDisplayName: parsed.data.tenantDisplayName }),
        ...(parsed.data.invitationToken === undefined
          ? {}
          : { invitationToken: parsed.data.invitationToken }),
      };
      const result = await options.service.register(registrationInput);
      if (result.replayed) response.setHeader('idempotency-replayed', 'true');
      response.status(result.replayed ? 200 : 201).json({ registration: result.value });
    } catch (error) {
      if (error instanceof RegistrationDomainError) {
        sendError(response, error.status, error.code, safeMessages[error.code] ?? '注册请求失败。');
        return;
      }
      next(error);
    }
  });

  return router;
}
