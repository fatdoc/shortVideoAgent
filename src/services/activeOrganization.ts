import {
  CONTROL_PLANE_FIXTURE_ID,
  type ActiveOrganizationContext,
  type ControlPlaneDemoState,
  type Membership,
  type OrganizationContextType,
  type WorkbenchKind,
} from '../domain/controlPlane';
import { ControlPlaneMockError } from './controlPlaneMockAdapter';

const ACTIVE_ORGANIZATION_STORAGE_KEY =
  'videoagent:control-plane:active-organization:v1';
export const DEMO_PRINCIPAL_ID = 'principal-demo-owner';

function organizationTypeForId(
  snapshot: ControlPlaneDemoState,
  organizationId: string,
): OrganizationContextType | null {
  if (snapshot.commercial.platform.platformId === organizationId) {
    return 'PLATFORM';
  }
  if (
    snapshot.commercial.channels.some(
      (item) => item.channelOrganizationId === organizationId,
    )
  ) {
    return 'CHANNEL';
  }
  if (snapshot.commercial.tenant.tenantId === organizationId) {
    return 'TENANT';
  }
  return null;
}

function workbenchKindForType(
  organizationType: OrganizationContextType,
): WorkbenchKind {
  if (organizationType === 'PLATFORM') return 'platform';
  if (organizationType === 'CHANNEL') return 'channel';
  return 'tenant';
}

function requireActiveMembership(
  snapshot: ControlPlaneDemoState,
  organizationId: string,
  principalId: string,
  now: Date,
): Membership {
  const organizationType = organizationTypeForId(snapshot, organizationId);
  if (!organizationType) {
    throw new ControlPlaneMockError(
      'ROUTE_ID_REJECTED',
      'activeOrganizationId 不属于任何 canonical Demo 组织。',
      { organizationId },
    );
  }
  const organizationActive =
    organizationType === 'PLATFORM'
      ? snapshot.commercial.platform.status === 'active'
      : organizationType === 'CHANNEL'
        ? snapshot.commercial.channels.some(
            (item) =>
              item.channelOrganizationId === organizationId &&
              item.status === 'active',
          )
        : snapshot.commercial.tenant.status === 'active';
  if (!organizationActive) {
    throw new ControlPlaneMockError(
      'ACTION_SCOPE_DENIED',
      '目标组织当前不是 active 状态。',
      { organizationId },
    );
  }
  const membership = snapshot.commercial.memberships.find(
    (item) =>
      item.principalId === principalId &&
      item.organizationType === organizationType &&
      item.organizationId === organizationId,
  );
  const nowMs = now.getTime();
  if (
    !membership ||
    membership.status !== 'active' ||
    Date.parse(membership.validFrom) > nowMs ||
    (membership.validTo !== null && Date.parse(membership.validTo) <= nowMs)
  ) {
    throw new ControlPlaneMockError(
      'ACTION_SCOPE_DENIED',
      '当前 actor 没有目标组织的有效 Membership。',
      { organizationId, principalId },
    );
  }
  return membership;
}

export function resolveActiveOrganization(
  snapshot: ControlPlaneDemoState,
  organizationId: string,
  principalId = DEMO_PRINCIPAL_ID,
  now = new Date(),
): ActiveOrganizationContext {
  const membership = requireActiveMembership(
    snapshot,
    organizationId,
    principalId,
    now,
  );
  const projectIds = new Set<string>();
  if (
    membership.organizationType === 'TENANT' &&
    membership.dataScopes.some((scope) => scope.kind === 'TENANT_WIDE')
  ) {
    projectIds.add(CONTROL_PLANE_FIXTURE_ID);
  }
  membership.dataScopes.forEach((scope) => {
    if (scope.kind === 'PROJECT_SET') {
      scope.projectIds?.forEach((projectId) => projectIds.add(projectId));
    }
  });
  const tenantId =
    membership.organizationType === 'TENANT'
      ? snapshot.commercial.tenant.tenantId
      : null;
  const canViewTenantContent =
    tenantId !== null && projectIds.has(CONTROL_PLANE_FIXTURE_ID);
  const canExecuteProduction =
    canViewTenantContent &&
    membership.roleCodes.includes('production.operator');

  return {
    activeOrganizationId: organizationId,
    organizationType: membership.organizationType,
    workbenchKind: workbenchKindForType(membership.organizationType),
    membershipId: membership.membershipId,
    roleCodes: [...membership.roleCodes],
    tenantId,
    projectIds: [...projectIds],
    menuContext: {
      canViewCommercial: true,
      canViewTenantContent,
      canExecuteProduction,
      canManagePlatform: membership.roleCodes.includes('platform.admin'),
      canManageChannel: membership.roleCodes.includes('channel.admin'),
    },
  };
}

export function loadActiveOrganizationId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveOrganizationId(organizationId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    ACTIVE_ORGANIZATION_STORAGE_KEY,
    organizationId,
  );
}
