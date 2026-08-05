import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { AuthService, InvalidCredentialsError } from './service.js';
import { LoginRateLimiter } from './rateLimiter.js';
import { isSafeReturnTo, readCookie, SESSION_COOKIE_NAME } from './session.js';

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
  returnTo: z.string().max(1024).optional(),
});

export type AuthRouterOptions = {
  service: AuthService;
  limiter: LoginRateLimiter;
  secureCookies: boolean;
  sessionTtlSeconds: number;
};

function limiterKey(request: Request, email: string): string {
  return `${request.ip ?? request.socket.remoteAddress ?? 'unknown'}:${email.trim().toLowerCase()}`;
}

function setSessionCookie(response: Response, token: string, options: AuthRouterOptions): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: options.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: options.sessionTtlSeconds * 1000,
  });
}

function clearSessionCookie(response: Response, options: AuthRouterOptions): void {
  response.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: options.secureCookies,
    sameSite: 'lax',
    path: '/',
  });
}

export function createAuthRouter(options: AuthRouterOptions): Router {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader('cache-control', 'no-store');
    next();
  });

  router.post('/login', async (request, response, next) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success || !isSafeReturnTo(parsed.data.returnTo ?? '/')) {
      response.status(400).json({
        error: {
          code: 'INVALID_AUTH_REQUEST',
          message: '登录请求格式无效。',
          requestId: response.locals.requestId,
        },
      });
      return;
    }

    const key = limiterKey(request, parsed.data.email);
    const retryAfter = options.limiter.retryAfterSeconds(key);
    if (retryAfter) {
      response.setHeader('retry-after', retryAfter);
      response.status(429).json({
        error: {
          code: 'LOGIN_RATE_LIMITED',
          message: '登录尝试过多，请稍后重试。',
          requestId: response.locals.requestId,
        },
      });
      return;
    }

    try {
      const result = await options.service.login(parsed.data.email, parsed.data.password);
      options.limiter.succeed(key);
      setSessionCookie(response, result.token, options);
      response.status(200).json({ session: result.session, returnTo: parsed.data.returnTo ?? '/' });
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        options.limiter.fail(key);
        response.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '邮箱或密码不正确。',
            requestId: response.locals.requestId,
          },
        });
        return;
      }
      next(error);
    }
  });

  router.get('/session', async (request, response, next) => {
    try {
      const token = readCookie(request.header('cookie'), SESSION_COOKIE_NAME);
      if (!token) {
        response.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: '请先登录。',
            requestId: response.locals.requestId,
          },
        });
        return;
      }

      const result = await options.service.resolve(token);
      if (!result) {
        clearSessionCookie(response, options);
        response.status(401).json({
          error: {
            code: 'SESSION_INVALID',
            message: '会话已失效，请重新登录。',
            requestId: response.locals.requestId,
          },
        });
        return;
      }

      if (result.token) setSessionCookie(response, result.token, options);
      response.status(200).json({ session: result.session });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', async (request, response, next) => {
    try {
      await options.service.logout(readCookie(request.header('cookie'), SESSION_COOKIE_NAME));
      clearSessionCookie(response, options);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
