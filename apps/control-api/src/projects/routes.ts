import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { readCookie, SESSION_COOKIE_NAME } from '../auth/session.js';
import type { PublicSession } from '../auth/service.js';
import { approvalSchema } from '../approvals/schema.js';
import { briefVersionSchema } from '../briefs/schema.js';
import { scriptVersionSchema } from '../scripts/schema.js';
import { ContentConflictError, IdempotencyConflictError } from './errors.js';
import type { ContentStore, SessionActor } from './types.js';

const projectStatus = z.enum(['draft', 'active', 'production', 'completed', 'archived']);
const projectFields = {
  name: z.string().trim().min(1).max(200),
  status: projectStatus,
  platform: z.string().trim().min(1).max(100),
  aspectRatio: z
    .string()
    .trim()
    .regex(/^\d{1,3}:\d{1,3}$/),
  targetDurationSeconds: z.number().int().min(1).max(86_400),
};
const createProjectSchema = z.object(projectFields).strict();
const updateProjectSchema = z
  .object(projectFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'at least one project field is required');
const uuidSchema = z.string().uuid();
const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9._:-]{1,200}$/);

type SessionResolution = {
  token?: string;
  session: PublicSession;
};

export type ContentRouterOptions = {
  store: ContentStore;
  resolveSession: (token: string) => Promise<SessionResolution | null>;
  secureCookies: boolean;
  sessionTtlSeconds: number;
};

type ActorResponse = Response & { locals: { requestId: string; actor?: SessionActor } };

function error(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({
    error: { code, message, requestId: response.locals.requestId },
  });
}

function actor(response: ActorResponse): SessionActor {
  if (!response.locals.actor) throw new Error('authenticated actor is missing');
  return response.locals.actor;
}

function projectId(value: string | undefined): string | null {
  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function idempotency(response: Response, value: string | undefined): string | null {
  const parsed = idempotencyKeySchema.safeParse(value);
  if (!parsed.success) {
    error(response, 400, 'IDEMPOTENCY_KEY_REQUIRED', '写入请求必须提供有效的 Idempotency-Key。');
    return null;
  }
  return parsed.data;
}

function sendIdempotent<T>(
  response: Response,
  result: { value: T; replayed: boolean },
  createdStatus = 201,
): void {
  response.setHeader('idempotency-replayed', String(result.replayed));
  response.status(result.replayed ? 200 : createdStatus).json(result.value);
}

function setRotatedCookie(response: Response, token: string, options: ContentRouterOptions): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: options.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: options.sessionTtlSeconds * 1000,
  });
}

export function createContentRouter(options: ContentRouterOptions): Router {
  const router = Router();

  router.use(async (request, response: ActorResponse, next) => {
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
      if (!resolved.session.tenant) {
        error(response, 403, 'TENANT_CONTEXT_REQUIRED', '当前组织不能访问项目内容。');
        return;
      }
      response.locals.actor = {
        userId: resolved.session.user.id,
        tenantId: resolved.session.tenant.id,
        roles: resolved.session.roles,
      };
      next();
    } catch (caught) {
      next(caught);
    }
  });

  router.use((request, response: ActorResponse, next) => {
    if (!['POST', 'PATCH'].includes(request.method)) {
      next();
      return;
    }
    const roles = actor(response).roles;
    if (!roles.includes('tenant_admin') && !roles.includes('content_operator')) {
      error(response, 403, 'CONTENT_WRITE_FORBIDDEN', '当前角色不能修改项目内容。');
      return;
    }
    next();
  });

  router.post('/projects', async (request, response: ActorResponse, next) => {
    const parsed = createProjectSchema.safeParse(request.body);
    const key = idempotency(response, request.header('idempotency-key'));
    if (!parsed.success || !key) {
      if (!parsed.success && key) error(response, 400, 'INVALID_PROJECT', '项目参数格式无效。');
      return;
    }
    try {
      const result = await options.store.createProject(actor(response), parsed.data, {
        operation: 'project.create',
        key,
        payload: parsed.data,
      });
      sendIdempotent(response, result);
    } catch (caught) {
      next(caught);
    }
  });

  router.get('/projects', async (_request, response: ActorResponse, next) => {
    try {
      response.status(200).json({ projects: await options.store.listProjects(actor(response)) });
    } catch (caught) {
      next(caught);
    }
  });

  router.get('/projects/:projectId', async (request, response: ActorResponse, next) => {
    const id = projectId(request.params.projectId);
    if (!id) {
      error(response, 404, 'PROJECT_NOT_FOUND', '项目不存在。');
      return;
    }
    try {
      const project = await options.store.getProject(actor(response), id);
      if (!project) error(response, 404, 'PROJECT_NOT_FOUND', '项目不存在。');
      else response.status(200).json(project);
    } catch (caught) {
      next(caught);
    }
  });

  router.patch('/projects/:projectId', async (request, response: ActorResponse, next) => {
    const id = projectId(request.params.projectId);
    const parsed = updateProjectSchema.safeParse(request.body);
    const key = idempotency(response, request.header('idempotency-key'));
    if (!id || !parsed.success || !key) {
      if ((!id || !parsed.success) && key)
        error(response, 400, 'INVALID_PROJECT', '项目参数格式无效。');
      return;
    }
    try {
      const result = await options.store.updateProject(actor(response), id, parsed.data, {
        operation: `project.update:${id}`,
        key,
        payload: parsed.data,
      });
      if (!result) error(response, 404, 'PROJECT_NOT_FOUND', '项目不存在。');
      else sendIdempotent(response, result, 200);
    } catch (caught) {
      next(caught);
    }
  });

  router.post(
    '/projects/:projectId/brief-versions',
    async (request, response: ActorResponse, next) => {
      const id = projectId(request.params.projectId);
      const parsed = briefVersionSchema.safeParse(request.body);
      const key = idempotency(response, request.header('idempotency-key'));
      if (!id || !parsed.success || !key) {
        if ((!id || !parsed.success) && key)
          error(response, 400, 'INVALID_BRIEF_VERSION', 'Brief 参数格式无效。');
        return;
      }
      try {
        const result = await options.store.createBriefVersion(
          actor(response),
          id,
          parsed.data.payload,
          {
            operation: `brief.create:${id}`,
            key,
            payload: parsed.data,
          },
        );
        if (!result) error(response, 404, 'PROJECT_NOT_FOUND', '项目不存在。');
        else sendIdempotent(response, result);
      } catch (caught) {
        next(caught);
      }
    },
  );

  router.get(
    '/projects/:projectId/brief-versions',
    async (request, response: ActorResponse, next) => {
      const id = projectId(request.params.projectId);
      if (!id) {
        error(response, 404, 'PROJECT_NOT_FOUND', '项目不存在。');
        return;
      }
      try {
        const versions = await options.store.listBriefVersions(actor(response), id);
        if (!versions) error(response, 404, 'PROJECT_NOT_FOUND', '项目不存在。');
        else response.status(200).json({ briefVersions: versions });
      } catch (caught) {
        next(caught);
      }
    },
  );

  router.post(
    '/projects/:projectId/script-versions',
    async (request, response: ActorResponse, next) => {
      const id = projectId(request.params.projectId);
      const parsed = scriptVersionSchema.safeParse(request.body);
      const key = idempotency(response, request.header('idempotency-key'));
      if (!id || !parsed.success || !key) {
        if ((!id || !parsed.success) && key)
          error(response, 400, 'INVALID_SCRIPT_VERSION', '脚本参数格式无效。');
        return;
      }
      try {
        const result = await options.store.createScriptVersion(
          actor(response),
          id,
          parsed.data.payload,
          {
            operation: `script.create:${id}`,
            key,
            payload: parsed.data,
          },
        );
        if (!result) error(response, 404, 'PROJECT_NOT_FOUND', '项目不存在。');
        else sendIdempotent(response, result);
      } catch (caught) {
        next(caught);
      }
    },
  );

  router.get(
    '/projects/:projectId/script-versions',
    async (request, response: ActorResponse, next) => {
      const id = projectId(request.params.projectId);
      if (!id) {
        error(response, 404, 'PROJECT_NOT_FOUND', '项目不存在。');
        return;
      }
      try {
        const versions = await options.store.listScriptVersions(actor(response), id);
        if (!versions) error(response, 404, 'PROJECT_NOT_FOUND', '项目不存在。');
        else response.status(200).json({ scriptVersions: versions });
      } catch (caught) {
        next(caught);
      }
    },
  );

  router.post(
    '/projects/:projectId/script-versions/:scriptVersionId/approvals',
    async (request, response: ActorResponse, next) => {
      const id = projectId(request.params.projectId);
      const scriptId = projectId(request.params.scriptVersionId);
      const parsed = approvalSchema.safeParse(request.body);
      const key = idempotency(response, request.header('idempotency-key'));
      if (!id || !scriptId || !parsed.success || !key) {
        if ((!id || !scriptId || !parsed.success) && key) {
          error(response, 400, 'INVALID_APPROVAL', '审批参数格式无效。');
        }
        return;
      }
      try {
        const result = await options.store.createApproval(
          actor(response),
          id,
          scriptId,
          parsed.data,
          { operation: `approval.create:${id}:${scriptId}`, key, payload: parsed.data },
        );
        if (!result) error(response, 404, 'SCRIPT_VERSION_NOT_FOUND', '脚本版本不存在。');
        else sendIdempotent(response, result);
      } catch (caught) {
        next(caught);
      }
    },
  );

  router.get(
    '/projects/:projectId/production-eligibility',
    async (request, response: ActorResponse, next) => {
      const id = projectId(request.params.projectId);
      if (!id) {
        error(response, 404, 'PROJECT_NOT_FOUND', '项目不存在。');
        return;
      }
      try {
        const result = await options.store.getProductionEligibility(actor(response), id);
        if (!result) error(response, 404, 'PROJECT_NOT_FOUND', '项目不存在。');
        else response.status(200).json(result);
      } catch (caught) {
        next(caught);
      }
    },
  );

  router.use(
    (caught: unknown, _request: unknown, response: Response, next: (error: unknown) => void) => {
      if (caught instanceof IdempotencyConflictError) {
        error(response, 409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key 已用于不同请求。');
        return;
      }
      if (caught instanceof ContentConflictError) {
        error(response, 409, caught.code, caught.message);
        return;
      }
      next(caught);
    },
  );

  return router;
}
