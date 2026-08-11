import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { readCookie, SESSION_COOKIE_NAME } from '../auth/session.js';
import type { PublicSession } from '../auth/service.js';
import { allowsProjectAction, type ProjectAction, type ProjectPolicy } from '../projects/policy.js';
import type { SessionActor } from '../projects/types.js';
import { StoryboardAuthorityError, StoryboardContractError } from './errors.js';
import type { StoryboardAuthorityService } from './service.js';
import type { StoryboardApprovalEvent, StoryboardVersion } from './types.js';

const canonicalUuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/);
const createVersionBodySchema = z.object({ draftRevision: z.unknown() }).strict();
const createApprovalBodySchema = z
  .object({
    expectedVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    status: z.enum(['approved', 'revoked', 'blocked']),
    factRiskStatus: z.enum(['cleared', 'unresolved']),
    reason: z
      .string()
      .min(1)
      .max(2_000)
      .refine((value) => value.trim() === value)
      .optional(),
  })
  .strict();

const storyboardPaths = [
  '/projects/:projectId/storyboard-versions',
  '/projects/:projectId/storyboard-versions/:storyboardVersionId/approvals',
];

type SessionResolution = { token?: string; session: PublicSession };
type StoryboardService = Pick<
  StoryboardAuthorityService,
  'createVersion' | 'listVersions' | 'createApproval' | 'listApprovals'
>;

export type StoryboardRouterOptions = {
  service: StoryboardService;
  policy: ProjectPolicy;
  resolveSession: (token: string) => Promise<SessionResolution | null>;
  secureCookies: boolean;
  sessionTtlSeconds: number;
};

type ActorResponse = Response & { locals: { requestId: string; actor?: SessionActor } };

type BrowserStoryboardVersion = {
  id: string;
  projectId: string;
  scriptVersionId: string;
  version: number;
  status: StoryboardVersion['status'];
  shots: StoryboardVersion['draft']['shots'];
  draftProvenance: {
    draftRevisionId: string;
    draftRevisionNumber: number;
    previousDraftRevisionId: string | null;
    sourceCommandId: string;
    sourceReceiptId: string;
    generationPolicyVersion: string;
    validationSummary: string;
  };
  createdBy: string;
  createdAt: string;
};

type BrowserStoryboardApproval = Omit<
  StoryboardApprovalEvent,
  'tenantId' | 'sequence' | 'eventDigest'
>;

function sendError(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({
    error: { code, message, requestId: response.locals.requestId },
  });
}

function sendInputInvalid(response: Response): void {
  sendError(response, 422, 'STORYBOARD_INPUT_INVALID', 'Storyboard authority input is invalid.');
}

function sendNotFound(response: Response): void {
  sendError(response, 404, 'STORYBOARD_NOT_FOUND', 'Storyboard authority resource was not found.');
}

function sendUnexpected(response: Response): void {
  sendError(response, 500, 'STORYBOARD_STORAGE_ERROR', 'Storyboard authority is unavailable.');
}

function sendCaught(response: Response, caught: unknown): void {
  if (caught instanceof StoryboardAuthorityError || caught instanceof StoryboardContractError) {
    sendError(response, caught.status, caught.code, caught.message);
    return;
  }
  sendUnexpected(response);
}

function actor(response: ActorResponse): SessionActor {
  if (!response.locals.actor) throw new StoryboardAuthorityError('STORYBOARD_ACTOR_INVALID');
  return response.locals.actor;
}

function setRotatedCookie(
  response: Response,
  token: string,
  options: StoryboardRouterOptions,
): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: options.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: options.sessionTtlSeconds * 1000,
  });
}

async function authorizeProject(
  response: ActorResponse,
  options: StoryboardRouterOptions,
  projectId: string,
  action: ProjectAction,
): Promise<boolean> {
  const access = await options.policy.resolveProjectAccess(actor(response), projectId);
  if (!access) {
    sendNotFound(response);
    return false;
  }
  if (!allowsProjectAction(access, action)) {
    sendError(response, 403, 'PERMISSION_DENIED', '当前角色无权执行此项目操作。');
    return false;
  }
  return true;
}

function parseScopedId(value: string | undefined): string | null {
  const parsed = canonicalUuidSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseIdempotencyKey(value: string | undefined): string | null {
  const parsed = idempotencyKeySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function projectStoryboardVersion(version: StoryboardVersion): BrowserStoryboardVersion {
  const { draft } = version;
  return {
    id: version.id,
    projectId: version.projectId,
    scriptVersionId: version.scriptVersionId,
    version: version.version,
    status: version.status,
    shots: draft.shots,
    draftProvenance: {
      draftRevisionId: draft.draftRevisionId,
      draftRevisionNumber: draft.revisionNumber,
      previousDraftRevisionId: draft.previousRevisionId,
      sourceCommandId: draft.sourceReceipt.commandId,
      sourceReceiptId: draft.sourceReceipt.receiptId,
      generationPolicyVersion: draft.generationPolicy.policyVersion,
      validationSummary: draft.validationSummary.status,
    },
    createdBy: version.createdBy,
    createdAt: version.createdAt,
  };
}

function projectStoryboardApproval(approval: StoryboardApprovalEvent): BrowserStoryboardApproval {
  return {
    id: approval.id,
    projectId: approval.projectId,
    storyboardVersionId: approval.storyboardVersionId,
    status: approval.status,
    factRiskStatus: approval.factRiskStatus,
    reason: approval.reason,
    actedBy: approval.actedBy,
    actedAt: approval.actedAt,
  };
}

function sendMutation<T>(
  response: Response,
  result: { value: T; replayed: boolean },
  project: (value: T) => unknown,
): void {
  response.setHeader('idempotency-replayed', String(result.replayed));
  response.status(result.replayed ? 200 : 201).json(project(result.value));
}

export function createStoryboardRouter(options: StoryboardRouterOptions): Router {
  const router = Router();

  router.use(storyboardPaths, (_request, response, next) => {
    response.setHeader('cache-control', 'no-store');
    next();
  });

  router.use(storyboardPaths, async (request, response: ActorResponse, next) => {
    void next;
    if (response.locals.actor) return next();
    try {
      const token = readCookie(request.header('cookie'), SESSION_COOKIE_NAME);
      if (!token) {
        sendError(response, 401, 'AUTHENTICATION_REQUIRED', '请先登录。');
        return;
      }
      const resolved = await options.resolveSession(token);
      if (!resolved) {
        sendError(response, 401, 'SESSION_INVALID', '会话已失效，请重新登录。');
        return;
      }
      if (resolved.token) setRotatedCookie(response, resolved.token, options);
      if (!resolved.session.tenant) {
        sendError(response, 403, 'TENANT_CONTEXT_REQUIRED', '当前组织不能访问项目内容。');
        return;
      }
      const context = resolved.session.activeContext;
      if (
        context.organizationType !== 'TENANT' ||
        context.tenantId !== resolved.session.tenant.id ||
        context.organizationId !== resolved.session.tenant.id
      ) {
        sendError(response, 401, 'SESSION_INVALID', '会话上下文无效，请重新登录。');
        return;
      }
      response.locals.actor = {
        userId: resolved.session.user.id,
        membershipId: context.membershipId,
        organizationId: context.organizationId,
        organizationType: context.organizationType,
        tenantId: resolved.session.tenant.id,
        membershipVersion: context.membershipVersion,
        primaryRole: context.primaryRole,
        roles: context.roles,
      };
      next();
    } catch {
      sendUnexpected(response);
    }
  });

  router.get(
    '/projects/:projectId/storyboard-versions',
    async (request, response: ActorResponse) => {
      const projectId = parseScopedId(request.params.projectId);
      if (!projectId) {
        sendNotFound(response);
        return;
      }
      try {
        if (!(await authorizeProject(response, options, projectId, 'project.content.read'))) return;
        const versions = await options.service.listVersions(actor(response), projectId);
        response.status(200).json({
          storyboardVersions: versions.map(projectStoryboardVersion),
        });
      } catch (caught) {
        sendCaught(response, caught);
      }
    },
  );

  router.post(
    '/projects/:projectId/storyboard-versions',
    async (request, response: ActorResponse) => {
      const projectId = parseScopedId(request.params.projectId);
      const body = createVersionBodySchema.safeParse(request.body);
      const idempotencyKey = parseIdempotencyKey(request.header('idempotency-key'));
      if (!projectId) {
        sendNotFound(response);
        return;
      }
      if (!body.success || !idempotencyKey) {
        sendInputInvalid(response);
        return;
      }
      try {
        if (!(await authorizeProject(response, options, projectId, 'project.content.write')))
          return;
        const result = await options.service.createVersion(actor(response), projectId, {
          draft: body.data.draftRevision,
          idempotencyKey,
        });
        sendMutation(response, result, projectStoryboardVersion);
      } catch (caught) {
        sendCaught(response, caught);
      }
    },
  );

  router.get(
    '/projects/:projectId/storyboard-versions/:storyboardVersionId/approvals',
    async (request, response: ActorResponse) => {
      const projectId = parseScopedId(request.params.projectId);
      const storyboardVersionId = parseScopedId(request.params.storyboardVersionId);
      if (!projectId || !storyboardVersionId) {
        sendNotFound(response);
        return;
      }
      try {
        if (!(await authorizeProject(response, options, projectId, 'project.content.read'))) return;
        const approvals = await options.service.listApprovals(
          actor(response),
          projectId,
          storyboardVersionId,
        );
        response.status(200).json({
          storyboardApprovals: approvals.map(projectStoryboardApproval),
        });
      } catch (caught) {
        sendCaught(response, caught);
      }
    },
  );

  router.post(
    '/projects/:projectId/storyboard-versions/:storyboardVersionId/approvals',
    async (request, response: ActorResponse) => {
      const projectId = parseScopedId(request.params.projectId);
      const storyboardVersionId = parseScopedId(request.params.storyboardVersionId);
      const body = createApprovalBodySchema.safeParse(request.body);
      const idempotencyKey = parseIdempotencyKey(request.header('idempotency-key'));
      if (!projectId || !storyboardVersionId) {
        sendNotFound(response);
        return;
      }
      if (!body.success || !idempotencyKey) {
        sendInputInvalid(response);
        return;
      }
      try {
        if (!(await authorizeProject(response, options, projectId, 'project.content.write')))
          return;
        const result = await options.service.createApproval(
          actor(response),
          projectId,
          storyboardVersionId,
          {
            expectedVersion: body.data.expectedVersion,
            status: body.data.status,
            factRiskStatus: body.data.factRiskStatus,
            ...(body.data.reason === undefined ? {} : { reason: body.data.reason }),
            idempotencyKey,
          },
        );
        sendMutation(response, result, projectStoryboardApproval);
      } catch (caught) {
        sendCaught(response, caught);
      }
    },
  );

  return router;
}
