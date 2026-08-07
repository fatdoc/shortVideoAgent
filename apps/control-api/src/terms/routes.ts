import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { readCookie, SESSION_COOKIE_NAME } from '../auth/session.js';
import type { PublicSession } from '../auth/service.js';
import { TermsDomainError } from './errors.js';
import type { TermsService } from './service.js';
import type { ReplayableResult, TermsActor, TermsVersion } from './types.js';

const uuidSchema = z.string().uuid();
const publicCurrentSchema = z
  .object({
    documentCode: z.string().trim().min(1).max(100),
    locale: z.string().trim().min(1).max(35),
  })
  .strict();
const createDocumentSchema = z
  .object({
    documentCode: z.string().trim().min(1).max(100),
    title: z.string().trim().min(1).max(300),
  })
  .strict();
const draftFields = {
  versionLabel: z.string().trim().min(1).max(100),
  content: z.string().trim().min(1).max(1_000_000),
  locale: z.string().trim().min(1).max(35),
  mustReaccept: z.boolean(),
  supersedesTermsVersionId: uuidSchema.nullable(),
};
const createDraftSchema = z.object(draftFields).strict();
const updateDraftSchema = z
  .object({
    ...draftFields,
    effectiveAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict();
const publishSchema = z.object({ effectiveAt: z.string().datetime({ offset: true }) }).strict();
const emptySchema = z.object({}).strict();

type SessionResolution = { token?: string; session: PublicSession };
type TermsHttpService = Pick<
  TermsService,
  | 'getPublicCurrent'
  | 'createDocument'
  | 'createDraft'
  | 'updateDraft'
  | 'publishVersion'
  | 'retireVersion'
>;

export type TermsRouterOptions = {
  service: TermsHttpService;
  resolveSession: (token: string) => Promise<SessionResolution | null>;
  secureCookies: boolean;
  sessionTtlSeconds: number;
  now?: () => Date;
};

type TermsResponse = Response & { locals: { requestId: string; termsActor?: TermsActor } };

const safeMessages: Record<string, string> = {
  TERMS_PERMISSION_DENIED: '当前角色无权管理 Terms。',
  TERMS_DOCUMENT_NOT_FOUND: 'Terms 文档不存在。',
  TERMS_VERSION_NOT_FOUND: 'Terms 版本不存在。',
  TERMS_STATE_CONFLICT: 'Terms 当前状态不允许此操作。',
  TERMS_PUBLISH_CONFLICT: 'Terms 发布请求与既有发布事实冲突。',
  TERMS_VERSION_STALE: 'Terms 版本已不是当前版本。',
  TERMS_ACCEPTANCE_REQUIRED: '必须显式接受 Terms。',
  TERMS_VALIDATION_FAILED: 'Terms 请求格式无效。',
  TERMS_NOT_AVAILABLE: '当前 Terms 暂不可用。',
};

function error(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({
    error: { code, message, requestId: response.locals.requestId },
  });
}

function invalid(response: Response): void {
  error(response, 400, 'INVALID_TERMS_REQUEST', 'Terms 请求格式无效。');
}

function domainError(response: Response, caught: TermsDomainError): void {
  const status = caught.code === 'TERMS_VALIDATION_FAILED' ? 400 : caught.status;
  error(response, status, caught.code, safeMessages[caught.code] ?? 'Terms 请求失败。');
}

function actor(response: TermsResponse): TermsActor {
  if (!response.locals.termsActor) throw new Error('authenticated Terms actor is missing');
  return response.locals.termsActor;
}

function setRotatedCookie(response: Response, token: string, options: TermsRouterOptions): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: options.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: options.sessionTtlSeconds * 1000,
  });
}

function sendReplayable(
  response: Response,
  result: ReplayableResult<TermsVersion>,
  createdStatus: number,
): void {
  response.setHeader('idempotency-replayed', String(result.replayed));
  response.status(result.replayed ? 200 : createdStatus).json(result.value);
}

export function createTermsRouter(options: TermsRouterOptions): Router {
  const router = Router();
  const now = options.now ?? (() => new Date());

  router.use((_request, response, next) => {
    response.setHeader('cache-control', 'no-store');
    next();
  });

  router.get('/public/terms/current', async (request, response, next) => {
    const parsed = publicCurrentSchema.safeParse(request.query);
    if (!parsed.success) {
      invalid(response);
      return;
    }
    try {
      const current = await options.service.getPublicCurrent(
        parsed.data.documentCode,
        parsed.data.locale,
        now(),
      );
      response.status(200).json({
        terms: {
          termsDocumentId: current.document.termsDocumentId,
          termsVersionId: current.version.termsVersionId,
          documentCode: current.document.documentCode,
          title: current.document.title,
          versionLabel: current.version.versionLabel,
          locale: current.version.locale,
          content: current.version.content,
          contentDigest: current.version.contentDigest,
          effectiveAt: current.version.effectiveAt,
          mustReaccept: current.version.mustReaccept,
        },
      });
    } catch (caught) {
      if (caught instanceof TermsDomainError) domainError(response, caught);
      else next(caught);
    }
  });

  router.use('/platform/terms', async (request, response: TermsResponse, next) => {
    try {
      const token = readCookie(request.header('cookie'), SESSION_COOKIE_NAME);
      if (!token) {
        error(response, 401, 'AUTHENTICATION_REQUIRED', '请先登录。');
        return;
      }
      const resolved = await options.resolveSession(token);
      if (!resolved) {
        error(response, 401, 'SESSION_INVALID', '会话已失效，请重新登录。');
        return;
      }
      if (resolved.token) setRotatedCookie(response, resolved.token, options);
      const context = resolved.session.activeContext;
      if (context.organizationType !== 'PLATFORM' || !context.roles.includes('platform_admin')) {
        error(
          response,
          403,
          'TERMS_PERMISSION_DENIED',
          safeMessages.TERMS_PERMISSION_DENIED ?? '当前角色无权管理 Terms。',
        );
        return;
      }
      response.locals.termsActor = {
        userId: resolved.session.user.id,
        organizationType: context.organizationType,
        roles: [...context.roles],
      };
      next();
    } catch (caught) {
      next(caught);
    }
  });

  router.post('/platform/terms/documents', async (request, response: TermsResponse, next) => {
    const parsed = createDocumentSchema.safeParse(request.body);
    if (!parsed.success) {
      invalid(response);
      return;
    }
    try {
      response.status(201).json(await options.service.createDocument(actor(response), parsed.data));
    } catch (caught) {
      if (caught instanceof TermsDomainError) domainError(response, caught);
      else next(caught);
    }
  });

  router.post(
    '/platform/terms/documents/:documentId/versions',
    async (request, response: TermsResponse, next) => {
      const documentId = uuidSchema.safeParse(request.params.documentId);
      const parsed = createDraftSchema.safeParse(request.body);
      if (!documentId.success || !parsed.success) {
        invalid(response);
        return;
      }
      try {
        response.status(201).json(
          await options.service.createDraft(actor(response), {
            termsDocumentId: documentId.data,
            ...parsed.data,
          }),
        );
      } catch (caught) {
        if (caught instanceof TermsDomainError) domainError(response, caught);
        else next(caught);
      }
    },
  );

  router.patch(
    '/platform/terms/versions/:versionId',
    async (request, response: TermsResponse, next) => {
      const versionId = uuidSchema.safeParse(request.params.versionId);
      const parsed = updateDraftSchema.safeParse(request.body);
      if (!versionId.success || !parsed.success) {
        invalid(response);
        return;
      }
      try {
        const { effectiveAt, ...draftInput } = parsed.data;
        const input =
          effectiveAt === undefined
            ? draftInput
            : {
                ...draftInput,
                effectiveAt: effectiveAt === null ? null : new Date(effectiveAt),
              };
        response
          .status(200)
          .json(await options.service.updateDraft(actor(response), versionId.data, input));
      } catch (caught) {
        if (caught instanceof TermsDomainError) domainError(response, caught);
        else next(caught);
      }
    },
  );

  router.post(
    '/platform/terms/versions/:versionId/publish',
    async (request, response: TermsResponse, next) => {
      const versionId = uuidSchema.safeParse(request.params.versionId);
      const parsed = publishSchema.safeParse(request.body);
      if (!versionId.success || !parsed.success) {
        invalid(response);
        return;
      }
      try {
        sendReplayable(
          response,
          await options.service.publishVersion(
            actor(response),
            versionId.data,
            new Date(parsed.data.effectiveAt),
          ),
          201,
        );
      } catch (caught) {
        if (caught instanceof TermsDomainError) domainError(response, caught);
        else next(caught);
      }
    },
  );

  router.post(
    '/platform/terms/versions/:versionId/retire',
    async (request, response: TermsResponse, next) => {
      const versionId = uuidSchema.safeParse(request.params.versionId);
      const parsed = emptySchema.safeParse(request.body);
      if (!versionId.success || !parsed.success) {
        invalid(response);
        return;
      }
      try {
        sendReplayable(
          response,
          await options.service.retireVersion(actor(response), versionId.data),
          200,
        );
      } catch (caught) {
        if (caught instanceof TermsDomainError) domainError(response, caught);
        else next(caught);
      }
    },
  );

  return router;
}
