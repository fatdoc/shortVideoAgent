export type TenantPageRole = 'tenant_admin' | 'content_operator';

export interface TenantPageHandoffContext {
  readonly projectId: string;
  readonly tenantId: string;
  readonly sessionMembershipId: string;
  readonly roleCodes: readonly TenantPageRole[];
  readonly runtimeMode: 'pilot';
  readonly controlApiBaseUrl: string;
}

export interface TenantPageHandoffInput {
  runtime: {
    mode: 'demo' | 'pilot' | null;
    controlApiBaseUrl: string | null;
    configurationError: string | null;
  };
  sessionContext: {
    organizationType: string;
    tenantId: string | null;
    membershipId: string;
    roleCodes: readonly string[];
  } | null;
  projectContext: {
    tenantId: string;
    projectId: string;
    sessionMembershipId: string;
    roleCodes: readonly string[];
  } | null;
  requestedProjectId: string | null;
}

export type TenantPageHandoffUnavailableReason =
  | 'runtime-not-pilot'
  | 'control-api-unavailable'
  | 'tenant-context-required'
  | 'project-context-unavailable'
  | 'project-mismatch'
  | 'membership-context-mismatch'
  | 'role-context-mismatch';

export type TenantPageHandoffResolution =
  | { status: 'ready'; context: TenantPageHandoffContext }
  | { status: 'unavailable'; reason: TenantPageHandoffUnavailableReason };

const TENANT_PAGE_ROLES = ['tenant_admin', 'content_operator'] as const;

function nonEmptyIdentifier(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function safeControlApiBaseUrl(value: string | null): string | null {
  if (!nonEmptyIdentifier(value)) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return value.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function canonicalRoles(roleCodes: readonly string[]): readonly TenantPageRole[] | null {
  if (
    roleCodes.length === 0 ||
    roleCodes.some((role): boolean => !TENANT_PAGE_ROLES.includes(role as TenantPageRole))
  ) {
    return null;
  }
  const roles = TENANT_PAGE_ROLES.filter((role) => roleCodes.includes(role));
  return roles.length > 0 ? Object.freeze([...roles]) : null;
}

function sameRoles(left: readonly TenantPageRole[], right: readonly TenantPageRole[]): boolean {
  return left.length === right.length && left.every((role, index) => role === right[index]);
}

function unavailable(reason: TenantPageHandoffUnavailableReason): TenantPageHandoffResolution {
  return { status: 'unavailable', reason };
}

export function resolveTenantPageHandoffContext(
  input: TenantPageHandoffInput,
): TenantPageHandoffResolution {
  if (input.runtime.mode !== 'pilot') return unavailable('runtime-not-pilot');

  const controlApiBaseUrl = safeControlApiBaseUrl(input.runtime.controlApiBaseUrl);
  if (input.runtime.configurationError !== null || controlApiBaseUrl === null) {
    return unavailable('control-api-unavailable');
  }

  const session = input.sessionContext;
  if (
    !session ||
    session.organizationType !== 'TENANT' ||
    !nonEmptyIdentifier(session.tenantId) ||
    !nonEmptyIdentifier(session.membershipId)
  ) {
    return unavailable('tenant-context-required');
  }

  const project = input.projectContext;
  if (
    !project ||
    !nonEmptyIdentifier(project.tenantId) ||
    !nonEmptyIdentifier(project.projectId) ||
    !nonEmptyIdentifier(project.sessionMembershipId) ||
    !nonEmptyIdentifier(input.requestedProjectId)
  ) {
    return unavailable('project-context-unavailable');
  }

  if (project.tenantId !== session.tenantId) return unavailable('tenant-context-required');
  if (project.projectId !== input.requestedProjectId) return unavailable('project-mismatch');
  if (project.sessionMembershipId !== session.membershipId) {
    return unavailable('membership-context-mismatch');
  }

  const sessionRoles = canonicalRoles(session.roleCodes);
  const projectRoles = canonicalRoles(project.roleCodes);
  if (!sessionRoles || !projectRoles || !sameRoles(sessionRoles, projectRoles)) {
    return unavailable('role-context-mismatch');
  }

  const context: TenantPageHandoffContext = Object.freeze({
    projectId: project.projectId,
    tenantId: project.tenantId,
    sessionMembershipId: project.sessionMembershipId,
    roleCodes: sessionRoles,
    runtimeMode: 'pilot',
    controlApiBaseUrl,
  });
  return { status: 'ready', context };
}
