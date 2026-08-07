import { createHash } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { readCookie, SESSION_COOKIE_NAME } from '../auth/session.js';
import type { PublicSession } from '../auth/service.js';
import {
  InvitationDomainError,
  InvitationPermissionDeniedError,
  InvitationScopeConflictError,
} from './errors.js';
import type { InvitationService } from './service.js';
import type { Invitation, InvitationActor, IssuedInvitation, ReplayableResult } from './types.js';

const uuidSchema = z.string().uuid();
const idempotencyKeySchema = z.string().trim().min(1).max(200);
const previewSchema = z.object({ token: z.string().min(1).max(1024) }).strict();
const platformCreateSchema = z
  .object({
    targetEmail: z.string().trim().email().max(254),
    attributionChannelId: uuidSchema.nullable(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();
const channelCreateSchema = z.object({ idempotencyKey: idempotencyKeySchema }).strict();
const tenantCreateSchema = z
  .object({
    targetEmail: z.string().trim().email().max(254),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();
const emptySchema = z.object({}).strict();

type SessionResolution = { token?: string; session: PublicSession };
type InvitationHttpService = Pick<
  InvitationService,
  | 'createPlatformInvitation'
  | 'createChannelInvitation'
  | 'createTenantMemberInvitation'
  | 'listInvitations'
  | 'preview'
  | 'revokeInvitation'
>;
type PreviewLimiter = {
  retryAfterSeconds(key: string): number | null;
  record(key: string): void;
};

export type InvitationRouterOptions = {
  service: InvitationHttpService;
  limiter: PreviewLimiter;
  resolveSession: (token: string) => Promise<SessionResolution | null>;
  resolveChannelIdForOrganization: (organizationId: string) => Promise<string | null>;
  secureCookies: boolean;
  sessionTtlSeconds: number;
};

type InvitationLocals = {
  requestId?: string;
  invitationActor?: InvitationActor;
  invitationSession?: PublicSession;
};
type InvitationResponse = Response<unknown, InvitationLocals>;

const safeMessages: Record<string, string> = {
  INVITATION_PERMISSION_DENIED: '当前角色无权管理邀请。',
  INVITATION_NOT_FOUND: '邀请不存在。',
  INVITATION_UNAVAILABLE: '邀请不可用。',
  INVITATION_STATE_CONFLICT: '邀请当前状态不允许此操作。',
  INVITATION_IDEMPOTENCY_CONFLICT: '幂等键已用于不同的邀请请求。',
  INVITATION_SCOPE_CONFLICT: '邀请范围与当前组织不一致。',
  INVITATION_VALIDATION_FAILED: '邀请请求格式无效。',
};

function sendError(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({
    error: { code, message, requestId: response.locals.requestId },
  });
}

function invalid(response: Response): void {
  sendError(response, 400, 'INVITATION_VALIDATION_FAILED', '邀请请求格式无效。');
}

function domainError(response: Response, caught: InvitationDomainError): void {
  const status = caught.code === 'INVITATION_VALIDATION_FAILED' ? 400 : caught.status;
  sendError(response, status, caught.code, safeMessages[caught.code] ?? '邀请请求失败。');
}

function setRotatedCookie(
  response: Response,
  token: string,
  options: InvitationRouterOptions,
): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: options.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: options.sessionTtlSeconds * 1000,
  });
}

function actor(response: InvitationResponse): InvitationActor {
  if (!response.locals.invitationActor) {
    throw new Error('authenticated Invitation actor is missing');
  }
  return response.locals.invitationActor;
}

function activeSession(response: InvitationResponse): PublicSession {
  if (!response.locals.invitationSession) {
    throw new Error('authenticated Invitation session is missing');
  }
  return response.locals.invitationSession;
}

function requireManager(context: PublicSession['activeContext']): void {
  const allowed =
    (context.organizationType === 'PLATFORM' && context.roles.includes('platform_admin')) ||
    (context.organizationType === 'CHANNEL' && context.roles.includes('channel_admin')) ||
    (context.organizationType === 'TENANT' && context.roles.includes('tenant_admin'));
  if (!allowed) throw new InvitationPermissionDeniedError();
}

function requireOrganizationType(
  response: InvitationResponse,
  expected: PublicSession['activeContext']['organizationType'],
): PublicSession['activeContext'] {
  const context = activeSession(response).activeContext;
  if (context.organizationType !== expected) throw new InvitationPermissionDeniedError();
  return context;
}

function managementView(invitation: Invitation) {
  return {
    invitationId: invitation.invitationId,
    invitationType: invitation.invitationType,
    targetOrganizationId: invitation.targetOrganizationId,
    targetRoleCode: invitation.targetRoleCode,
    targetEmail: invitation.targetEmailNormalized,
    attributionChannelId: invitation.attributionChannelId,
    status: invitation.status,
    validFrom: invitation.validFrom,
    expiresAt: invitation.expiresAt,
    maxUses: invitation.maxUses,
    usedCount: invitation.usedCount,
    remainingUses: Math.max(0, invitation.maxUses - invitation.usedCount),
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
    revokedAt: invitation.revokedAt,
  };
}

function previewView(invitation: Invitation) {
  return {
    invitationType: invitation.invitationType,
    targetRoleCode: invitation.targetRoleCode,
    targetOrganizationId: invitation.targetOrganizationId,
    attributionChannelId: invitation.attributionChannelId,
    expiresAt: invitation.expiresAt,
    remainingUses: Math.max(0, invitation.maxUses - invitation.usedCount),
  };
}

function sendIssued(response: Response, issued: IssuedInvitation): void {
  response.setHeader('idempotency-replayed', String(issued.replayed));
  response.status(issued.replayed ? 200 : 201).json({
    invitation: managementView(issued.invitation),
    token: issued.token,
  });
}

function sendReplayable(response: Response, result: ReplayableResult<Invitation>): void {
  response.setHeader('idempotency-replayed', String(result.replayed));
  response.status(200).json({ invitation: managementView(result.value) });
}

function previewLimiterKey(request: Request, token: string): string {
  const address = request.ip ?? request.socket.remoteAddress ?? 'unknown';
  return createHash('sha256').update(`${address}\u0000${token}`, 'utf8').digest('hex');
}

function authenticate(options: InvitationRouterOptions): RequestHandler {
  return async (request, response: InvitationResponse, next) => {
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
      const context = resolved.session.activeContext;
      requireManager(context);
      response.locals.invitationSession = resolved.session;
      response.locals.invitationActor = {
        userId: resolved.session.user.id,
        membershipId: context.membershipId,
        organizationId: context.organizationId,
        organizationType: context.organizationType,
        roles: [...context.roles],
      };
      next();
    } catch (caught) {
      if (caught instanceof InvitationDomainError) domainError(response, caught);
      else next(caught);
    }
  };
}

async function handle(
  response: Response,
  next: NextFunction,
  operation: () => Promise<void>,
): Promise<void> {
  try {
    await operation();
  } catch (caught) {
    if (caught instanceof InvitationDomainError) domainError(response, caught);
    else next(caught);
  }
}

export function createInvitationRouter(options: InvitationRouterOptions): Router {
  const router = Router();

  router.use((_request, response, next) => {
    response.setHeader('cache-control', 'no-store');
    next();
  });

  router.post('/public/invitations/preview', async (request, response, next) => {
    const parsed = previewSchema.safeParse(request.body);
    if (!parsed.success) {
      invalid(response);
      return;
    }
    const key = previewLimiterKey(request, parsed.data.token);
    const retryAfter = options.limiter.retryAfterSeconds(key);
    if (retryAfter) {
      response.setHeader('retry-after', retryAfter);
      sendError(response, 429, 'INVITATION_RATE_LIMITED', '邀请校验请求过多，请稍后重试。');
      return;
    }
    options.limiter.record(key);
    await handle(response, next, async () => {
      const invitation = await options.service.preview(parsed.data.token);
      response.status(200).json({ invitation: previewView(invitation) });
    });
  });

  const authenticated = authenticate(options);
  router.use('/platform/invitations', authenticated);
  router.use('/channels/:channelId/invitations', authenticated);
  router.use('/tenants/:tenantId/invitations', authenticated);
  router.use('/invitations/:invitationId/revoke', authenticated);

  router.post('/platform/invitations', async (request, response: InvitationResponse, next) => {
    const parsed = platformCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      invalid(response);
      return;
    }
    await handle(response, next, async () => {
      requireOrganizationType(response, 'PLATFORM');
      sendIssued(
        response,
        await options.service.createPlatformInvitation(actor(response), parsed.data),
      );
    });
  });

  router.get('/platform/invitations', async (_request, response: InvitationResponse, next) => {
    await handle(response, next, async () => {
      requireOrganizationType(response, 'PLATFORM');
      const invitations = await options.service.listInvitations(actor(response));
      response.status(200).json({ invitations: invitations.map(managementView) });
    });
  });

  router.post(
    '/channels/:channelId/invitations',
    async (request, response: InvitationResponse, next) => {
      const parsedChannelId = uuidSchema.safeParse(request.params.channelId);
      const parsed = channelCreateSchema.safeParse(request.body);
      if (!parsedChannelId.success || !parsed.success) {
        invalid(response);
        return;
      }
      await handle(response, next, async () => {
        const context = requireOrganizationType(response, 'CHANNEL');
        const actualChannelId = await options.resolveChannelIdForOrganization(
          context.organizationId,
        );
        if (!actualChannelId || actualChannelId !== parsedChannelId.data) {
          throw new InvitationScopeConflictError();
        }
        sendIssued(
          response,
          await options.service.createChannelInvitation(actor(response), parsed.data),
        );
      });
    },
  );

  router.get(
    '/channels/:channelId/invitations',
    async (request, response: InvitationResponse, next) => {
      const parsedChannelId = uuidSchema.safeParse(request.params.channelId);
      if (!parsedChannelId.success) {
        invalid(response);
        return;
      }
      await handle(response, next, async () => {
        const context = requireOrganizationType(response, 'CHANNEL');
        const actualChannelId = await options.resolveChannelIdForOrganization(
          context.organizationId,
        );
        if (!actualChannelId || actualChannelId !== parsedChannelId.data) {
          throw new InvitationScopeConflictError();
        }
        const invitations = await options.service.listInvitations(actor(response));
        response.status(200).json({ invitations: invitations.map(managementView) });
      });
    },
  );

  router.post(
    '/tenants/:tenantId/invitations',
    async (request, response: InvitationResponse, next) => {
      const parsedTenantId = uuidSchema.safeParse(request.params.tenantId);
      const parsed = tenantCreateSchema.safeParse(request.body);
      if (!parsedTenantId.success || !parsed.success) {
        invalid(response);
        return;
      }
      await handle(response, next, async () => {
        const context = requireOrganizationType(response, 'TENANT');
        if (
          context.organizationId !== parsedTenantId.data ||
          context.tenantId !== parsedTenantId.data
        ) {
          throw new InvitationScopeConflictError();
        }
        sendIssued(
          response,
          await options.service.createTenantMemberInvitation(actor(response), parsed.data),
        );
      });
    },
  );

  router.get(
    '/tenants/:tenantId/invitations',
    async (request, response: InvitationResponse, next) => {
      const parsedTenantId = uuidSchema.safeParse(request.params.tenantId);
      if (!parsedTenantId.success) {
        invalid(response);
        return;
      }
      await handle(response, next, async () => {
        const context = requireOrganizationType(response, 'TENANT');
        if (
          context.organizationId !== parsedTenantId.data ||
          context.tenantId !== parsedTenantId.data
        ) {
          throw new InvitationScopeConflictError();
        }
        const invitations = await options.service.listInvitations(actor(response));
        response.status(200).json({ invitations: invitations.map(managementView) });
      });
    },
  );

  router.post(
    '/invitations/:invitationId/revoke',
    async (request, response: InvitationResponse, next) => {
      const parsedInvitationId = uuidSchema.safeParse(request.params.invitationId);
      const parsed = emptySchema.safeParse(request.body);
      if (!parsedInvitationId.success || !parsed.success) {
        invalid(response);
        return;
      }
      await handle(response, next, async () => {
        sendReplayable(
          response,
          await options.service.revokeInvitation(actor(response), parsedInvitationId.data),
        );
      });
    },
  );

  return router;
}
